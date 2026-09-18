import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';

export const driversRouter = Router();

const patchSchema = z.object({
	online: z.boolean().optional(),
	association: z.string().min(2).max(120).optional(),
	vehicleClassId: z.string().min(1).optional()
});

const onboardingSchema = z.object({
	fullName: z.string().min(2).max(80),
	/** Accepted for backwards compatibility but ignored — the account's phone is
	 *  already proven by OTP at sign-in and must not be overwritten from here. */
	phone: z.string().min(7).max(30).optional(),
	association: z.string().min(2).max(120),
	vehicleClassId: z.string().min(1)
});

interface DriverRow {
	id: number;
	user_id: number;
	association: string | null;
	vehicle_class_id: string | null;
	verified: number;
	rating: number;
	online: number;
	online_at: string | null;
	online_seconds: number;
}

function getDriverRow(userId: number): DriverRow | undefined {
	return db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(userId) as DriverRow | undefined;
}

function computeOnlineSeconds(row: DriverRow): number {
	let seconds = row.online_seconds;
	if (row.online && row.online_at) {
		const started = new Date(row.online_at.replace(' ', 'T') + 'Z').getTime();
		seconds += Math.floor((Date.now() - started) / 1000);
	}
	return seconds;
}

function buildStats(userId: number, row: DriverRow) {
	const earnings = db
		.prepare(
			"SELECT COALESCE(SUM(estimated_fare), 0) AS total FROM rides WHERE driver_id = ? AND status = 'completed' AND date(created_at) = date('now')"
		)
		.get(userId) as { total: number };
	return {
		todayEarnings: Math.round(earnings.total * 100) / 100,
		onlineSeconds: computeOnlineSeconds(row),
		rating: row.rating
	};
}

function respondProfile(req: Request, res: Response) {
	const user = db.prepare('SELECT id, name, email, phone, role, status FROM users WHERE id = ?').get(req.user!.id) as
		| { id: number; name: string; email: string; phone: string | null }
		| undefined;
	const row = getDriverRow(req.user!.id);
	if (!user || !row) throw err.notFound('Driver profile not found. Complete onboarding first.');
	res.json({
		profile: {
			id: row.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			association: row.association,
			vehicleClassId: row.vehicle_class_id,
			verified: row.verified === 1,
			rating: row.rating,
			online: row.online === 1
		},
		stats: buildStats(user.id, row)
	});
}

/**
 * Takes a driver offline, banking the time they were online. Safe to call when
 * they are already offline.
 */
function goOffline(row: DriverRow): void {
	if (row.online !== 1) return;
	const delta = computeOnlineSeconds(row) - row.online_seconds;
	db.prepare(
		'UPDATE drivers SET online = 0, online_at = NULL, online_seconds = online_seconds + ? WHERE id = ?'
	).run(delta, row.id);
}

/**
 * Admin verification approves a specific driver on a specific vehicle class,
 * for a specific association — so changing either invalidates the approval.
 * Without this a driver could be verified as "Kampala Tourist Taxis / car" and
 * then quietly switch to a coach under an unreviewed association while keeping
 * the Verified badge.
 */
function revokeVerificationForReReview(row: DriverRow): void {
	if (row.verified !== 1) return;
	goOffline(row);
	db.prepare('UPDATE drivers SET verified = 0 WHERE id = ?').run(row.id);
	console.log(
		`[drivers] driver #${row.id} changed association/vehicle class after approval — verification revoked, needs re-review`
	);
}

driversRouter.use(requireAuth, requireRole('driver'));

driversRouter.get('/me', (req, res) => respondProfile(req, res));

driversRouter.patch('/me', (req, res) => {
	const body = patchSchema.parse(req.body);
	const row = getDriverRow(req.user!.id);
	if (!row) throw err.notFound('Driver profile not found. Complete onboarding first.');

	// Apply the reviewable fields first: if either changes, verification is
	// revoked, which must be reflected before the online request is judged.
	const associationChanged =
		body.association !== undefined && body.association.trim() !== (row.association ?? '');
	const classChanged =
		body.vehicleClassId !== undefined && body.vehicleClassId !== (row.vehicle_class_id ?? '');

	if (classChanged) {
		const vc = db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
		if (!vc) throw err.notFound('Unknown vehicle class.');
	}
	if (associationChanged) {
		db.prepare('UPDATE drivers SET association = ? WHERE id = ?').run(body.association!.trim(), row.id);
	}
	if (classChanged) {
		db.prepare('UPDATE drivers SET vehicle_class_id = ? WHERE id = ?').run(body.vehicleClassId, row.id);
	}
	if (associationChanged || classChanged) {
		revokeVerificationForReReview(row);
	}

	if (typeof body.online === 'boolean') {
		// Re-read: the block above may have just revoked verification.
		const current = getDriverRow(req.user!.id)!;
		if (body.online) {
			if (current.verified !== 1) {
				throw err.forbidden(
					associationChanged || classChanged
						? 'Your details changed and need admin re-verification before you can go online.'
						: 'Your driver account is pending admin verification. You cannot go online yet.',
					'DRIVER_NOT_VERIFIED'
				);
			}
			if (current.online !== 1) {
				db.prepare("UPDATE drivers SET online = 1, online_at = datetime('now') WHERE id = ?").run(current.id);
			}
		} else {
			goOffline(current);
		}
	}

	return respondProfile(req, res);
});

driversRouter.post('/onboarding', (req, res) => {
	const body = onboardingSchema.parse(req.body);
	const vc = db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
	if (!vc) throw err.notFound('Unknown vehicle class.');

	// Phone is proven by OTP at sign-in; onboarding must not overwrite the
	// normalized E.164 value with whatever was retyped here.
	db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.fullName.trim(), req.user!.id);

	const existing = getDriverRow(req.user!.id);
	if (existing) {
		// Same reviewable fields as PATCH /me — resubmitting onboarding is
		// another way to change them, so it revokes approval the same way.
		const changed =
			body.association.trim() !== (existing.association ?? '') ||
			body.vehicleClassId !== (existing.vehicle_class_id ?? '');
		db.prepare('UPDATE drivers SET association = ?, vehicle_class_id = ? WHERE id = ?').run(
			body.association.trim(),
			body.vehicleClassId,
			existing.id
		);
		if (changed) revokeVerificationForReReview(existing);
	} else {
		db.prepare(
			'INSERT INTO drivers (user_id, association, vehicle_class_id, verified, rating, online) VALUES (?, ?, ?, 0, 0, 0)'
		).run(req.user!.id, body.association.trim(), body.vehicleClassId);
	}

	res.status(201).json({ message: 'Onboarding submitted. Your profile is pending admin verification.' });
});
