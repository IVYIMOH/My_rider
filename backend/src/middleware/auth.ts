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
