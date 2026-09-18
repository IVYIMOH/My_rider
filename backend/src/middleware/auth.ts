import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';
import { db } from '../db';
import { err } from '../errors';
import type { Role } from '../types';

declare global {
	namespace Express {
		interface Request {
			user?: { id: number; role: Role; status: string; emailVerified: number };
		}
	}
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
	const header = req.headers.authorization;
	const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) throw err.unauthorized();

	let payload;
	try {
		payload = verifyToken(token);
	} catch {
		throw err.unauthorized('Invalid or expired session.');
	}

	const row = db
		.prepare('SELECT id, role, status, email_verified FROM users WHERE id = ?')
		.get(payload.sub) as { id: number; role: Role; status: string; email_verified: number } | undefined;
	if (!row) throw err.unauthorized();

	if (row.status === 'suspended') throw err.forbidden('This account has been suspended.');

	req.user = { id: row.id, role: row.role, status: row.status, emailVerified: row.email_verified };
	next();
}

export function requireRole(...roles: Role[]) {
	return (req: Request, _res: Response, next: NextFunction): void => {
		if (!req.user) throw err.unauthorized();
		if (!roles.includes(req.user.role)) throw err.forbidden();
		next();
	};
}

/**
 * Gates anything that treats the caller as a working driver: seeing the ride
 * board, claiming a ride, and anything added later.
 *
 * This lives in one place on purpose. The same three conditions were first
 * enforced only on POST /rides/:id/accept, which left GET /rides/available
 * handing full ride details — pickup, destination, fare — to unapproved
 * accounts. Compose this instead of re-deriving the check per route.
 *
 * Use as: router.get('/path', requireAuth, requireRole('driver'), requireActiveDriver, handler)
 */
export function requireActiveDriver(req: Request, _res: Response, next: NextFunction): void {
	if (!req.user) throw err.unauthorized();

	const driver = db
		.prepare('SELECT verified, online FROM drivers WHERE user_id = ?')
		.get(req.user.id) as { verified: number; online: number } | undefined;

	if (!driver) {
		throw err.forbidden('Complete driver onboarding first.', 'DRIVER_PROFILE_MISSING');
	}
	if (driver.verified !== 1) {
		throw err.forbidden(
			'Your driver account is pending admin verification.',
			'DRIVER_NOT_VERIFIED'
		);
	}
	if (driver.online !== 1) {
		throw err.forbidden('Go online to see and accept ride requests.', 'DRIVER_OFFLINE');
	}
	next();
}
