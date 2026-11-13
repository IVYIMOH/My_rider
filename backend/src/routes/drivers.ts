import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import {
	computeOnlineSeconds,
	getDriverByUserId as getDriverRow,
	goOffline,
	revokeVerification
} from '../lib/driverState';
import type { DriverRow } from '../lib/driverState';

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

async function buildStats(userId: number, row: DriverRow) {
	const earnings = (await db
		.prepare(
			"SELECT COALESCE(SUM(estimated_fare), 0)::float8 AS total FROM rides WHERE driver_id = ? AND status = 'completed' AND created_at::date = CURRENT_DATE"
		)
		.get(userId)) as { total: number };
	return {
		todayEarnings: Math.round(earnings.total * 100) / 100,
		onlineSeconds: computeOnlineSeconds(row),
		rating: row.rating
	};
}

async function respondProfile(req: Request, res: Response) {
	const user = (await db.prepare('SELECT id, name, email, phone, role, status FROM users WHERE id = ?').get(req.user!.id)) as
		| { id: number; name: string; email: string; phone: string | null }
		| undefined;
	const row = await getDriverRow(req.user!.id);
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
		stats: await buildStats(user.id, row)
	});
}

// Tourist-facing: list available (online + verified) drivers so a rider can
// pick one when saving or confirming a booking draft.
driversRouter.get('/available', requireAuth, async (_req, res) => {
	const rows = (await db
		.prepare(
			`SELECT d.id, u.id AS user_id, u.name, u.phone, d.association, d.vehicle_class_id, d.rating
			 FROM drivers d JOIN users u ON u.id = d.user_id
			 WHERE d.verified = 1 AND d.online = 1`
		)
		.all()) as Array<Record<string, unknown>>;
	res.json({
		drivers: rows.map((r) => ({
			id: r.id as number,
			userId: r.user_id as number,
			name: r.name as string,
			phone: (r.phone as string | null) ?? null,
			association: r.association as string | null,
			vehicleClassId: r.vehicle_class_id as string | null,
			rating: r.rating as number,
			location: null
		}))
	});
});

driversRouter.use('/me', requireAuth, requireRole('driver'));

driversRouter.get('/me', (req, res) => respondProfile(req, res));

driversRouter.patch('/me', async (req, res) => {
	const body = patchSchema.parse(req.body);
	const row = await getDriverRow(req.user!.id);
	if (!row) throw err.notFound('Driver profile not found. Complete onboarding first.');

	// Apply the reviewable fields first: if either changes, verification is
	// revoked, which must be reflected before the online request is judged.
	const associationChanged =
		body.association !== undefined && body.association.trim() !== (row.association ?? '');
	const classChanged =
		body.vehicleClassId !== undefined && body.vehicleClassId !== (row.vehicle_class_id ?? '');

	if (classChanged) {
		const vc = await db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
		if (!vc) throw err.notFound('Unknown vehicle class.');
	}
	if (associationChanged) {
		await db.prepare('UPDATE drivers SET association = ? WHERE id = ?').run(body.association!.trim(), row.id);
	}
	if (classChanged) {
		await db.prepare('UPDATE drivers SET vehicle_class_id = ? WHERE id = ?').run(body.vehicleClassId, row.id);
	}
	if (associationChanged || classChanged) {
		// Approval is for a specific driver on a specific vehicle class under a
		// specific association, so changing either invalidates it. Without this a
		// driver approved as "Kampala Tourist Taxis / car" could quietly switch to
		// a coach under an unreviewed association and keep the Verified badge.
		await revokeVerification(row, 'association or vehicle class changed after approval');
	}

	if (typeof body.online === 'boolean') {
		// Re-read: the block above may have just revoked verification.
		const current = (await getDriverRow(req.user!.id))!;
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
				await db.prepare("UPDATE drivers SET online = 1, online_at = now() WHERE id = ?").run(current.id);
			}
		} else {
			await goOffline(current);
		}
	}

	return respondProfile(req, res);
});

driversRouter.post('/onboarding', requireAuth, async (req, res) => {
	const body = onboardingSchema.parse(req.body);
	const vc = await db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
	if (!vc) throw err.notFound('Unknown vehicle class.');

	const account = (await db.prepare('SELECT role FROM users WHERE id = ?').get(req.user!.id)) as
		| { role: string }
		| undefined;
	if (!account) throw err.notFound('Account not found.');

	// Phone is proven by OTP at sign-in; onboarding must not overwrite the
	// normalized E.164 value with whatever was retyped here.
	if (account.role === 'tourist') {
		// A signed-in tourist applying to drive is promoted here. They are held
		// at 'pending' until an admin verifies the driver profile.
		await db.prepare("UPDATE users SET name = ?, role = 'driver', status = 'pending' WHERE id = ?").run(
			body.fullName.trim(),
			req.user!.id
		);
	} else {
		await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.fullName.trim(), req.user!.id);
	}

	const existing = await getDriverRow(req.user!.id);
	if (existing) {
		// Same reviewable fields as PATCH /me — resubmitting onboarding is
		// another way to change them, so it revokes approval the same way.
		const changed =
			body.association.trim() !== (existing.association ?? '') ||
			body.vehicleClassId !== (existing.vehicle_class_id ?? '');
		await db.prepare('UPDATE drivers SET association = ?, vehicle_class_id = ? WHERE id = ?').run(
			body.association.trim(),
			body.vehicleClassId,
			existing.id
		);
		if (changed) await revokeVerification(existing, 'onboarding re-submitted with different details');
	} else {
		await db
			.prepare(
				'INSERT INTO drivers (user_id, association, vehicle_class_id, verified, rating, online) VALUES (?, ?, ?, 0, 0, 0)'
			)
			.run(req.user!.id, body.association.trim(), body.vehicleClassId);
	}

	res.status(201).json({ message: 'Onboarding submitted. Your profile is pending admin verification.' });
});
