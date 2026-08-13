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
	phone: z.string().min(7).max(30),
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

driversRouter.use(requireAuth, requireRole('driver'));

driversRouter.get('/me', (req, res) => respondProfile(req, res));

driversRouter.patch('/me', (req, res) => {
	const body = patchSchema.parse(req.body);
	const row = getDriverRow(req.user!.id);
	if (!row) throw err.notFound('Driver profile not found. Complete onboarding first.');

	if (typeof body.online === 'boolean') {
		if (body.online && row.online !== 1) {
			db.prepare("UPDATE drivers SET online = 1, online_at = datetime('now') WHERE id = ?").run(row.id);
		} else if (!body.online && row.online === 1) {
			const delta = computeOnlineSeconds(row) - row.online_seconds;
			db.prepare(
				'UPDATE drivers SET online = 0, online_at = NULL, online_seconds = online_seconds + ? WHERE id = ?'
			).run(delta, row.id);
		}
	}
	if (body.association !== undefined) {
		db.prepare('UPDATE drivers SET association = ? WHERE id = ?').run(body.association, row.id);
	}
	if (body.vehicleClassId !== undefined) {
		const vc = db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
		if (!vc) throw err.notFound('Unknown vehicle class.');
		db.prepare('UPDATE drivers SET vehicle_class_id = ? WHERE id = ?').run(body.vehicleClassId, row.id);
	}
	res.json({ profile: {} });
});

driversRouter.post('/onboarding', (req, res) => {
	const body = onboardingSchema.parse(req.body);
	const vc = db.prepare('SELECT id FROM vehicle_classes WHERE id = ?').get(body.vehicleClassId);
	if (!vc) throw err.notFound('Unknown vehicle class.');

	db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(
		body.fullName.trim(),
		body.phone.trim(),
		req.user!.id
	);

	const existing = getDriverRow(req.user!.id);
	if (existing) {
		db.prepare('UPDATE drivers SET association = ?, vehicle_class_id = ? WHERE id = ?').run(
			body.association.trim(),
			body.vehicleClassId,
			existing.id
		);
	} else {
		db.prepare(
			'INSERT INTO drivers (user_id, association, vehicle_class_id, verified, rating, online) VALUES (?, ?, ?, 0, 0, 0)'
		).run(req.user!.id, body.association.trim(), body.vehicleClassId);
	}

	res.status(201).json({ message: 'Onboarding submitted. Your profile is pending admin verification.' });
});
