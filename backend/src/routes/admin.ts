import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { hashPassword } from '../lib/password';
import { normalizePhone } from '../lib/phone';
import { requireAuth, requireRole } from '../middleware/auth';
import type { PricingConfig, UserStatus } from '../types';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

const pricingSchema = z.object({
	config: z.object({
		currency: z.string().min(3).max(3),
		baseFare: z.number().nonnegative(),
		perKm: z.number().nonnegative(),
		perMinute: z.number().nonnegative(),
		bookingFee: z.number().nonnegative(),
		surgeMultiplier: z.number().nonnegative(),
		minimumFare: z.number().nonnegative()
	}),
	vehicleClasses: z.array(
		z.object({
			id: z.string().min(1).max(30),
			name: z.string().min(1).max(80),
			multiplier: z.number().positive(),
			seats: z.string().max(60).optional()
		})
	)
});

const driverPatchSchema = z.object({ verified: z.boolean() });
const userPatchSchema = z.object({ status: z.enum(['active', 'pending', 'suspended']) });

// Privileged account creation. This is the ONLY way to mint an admin or driver
// account over HTTP — /api/auth/register always produces a tourist. The router
// is mounted behind requireAuth + requireRole('admin'), so a valid admin JWT is
// required to reach it. For the very first admin on a fresh database, use
// `npm run create-admin` (scripts/create-admin.ts) instead.
const createUserSchema = z.object({
	name: z.string().min(2).max(80),
	email: z.string().email(),
	password: z.string().min(12).max(128),
	role: z.enum(['tourist', 'driver', 'admin']),
	phone: z.string().min(7).max(30).optional()
});

function getConfigRow(): PricingConfig {
	const row = db.prepare('SELECT * FROM pricing WHERE id = 1').get() as Record<string, number | string>;
	return {
		currency: row.currency as string,
		baseFare: row.base_fare as number,
		perKm: row.per_km as number,
		perMinute: row.per_minute as number,
		bookingFee: row.booking_fee as number,
		surgeMultiplier: row.surge_multiplier as number,
		minimumFare: row.minimum_fare as number
	};
}

function getVehicleClasses() {
	return db.prepare('SELECT id, name, multiplier, seats FROM vehicle_classes ORDER BY multiplier').all();
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

adminRouter.get('/pricing', (_req, res) => {
	res.json({ config: getConfigRow(), vehicleClasses: getVehicleClasses() });
});

adminRouter.put('/pricing', (req, res) => {
	const body = pricingSchema.parse(req.body);
	const { config, vehicleClasses } = body;

	db.prepare(
		`UPDATE pricing SET currency = ?, base_fare = ?, per_km = ?, per_minute = ?, booking_fee = ?, surge_multiplier = ?, minimum_fare = ? WHERE id = 1`
	).run(
		config.currency,
		config.baseFare,
		config.perKm,
		config.perMinute,
		config.bookingFee,
		config.surgeMultiplier,
		config.minimumFare
	);

	const upsert = db.prepare(
		`INSERT INTO vehicle_classes (id, name, multiplier, seats) VALUES (?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, multiplier = excluded.multiplier, seats = excluded.seats`
	);
	const tx = db.transaction((classes: typeof vehicleClasses) => {
		for (const vc of classes) upsert.run(vc.id, vc.name, vc.multiplier, vc.seats ?? '');
		const placeholders = classes.map(() => '?').join(',') || 'NULL';
		db.prepare(
			`DELETE FROM vehicle_classes
			 WHERE id NOT IN (${placeholders})
			   AND id NOT IN (SELECT vehicle_class_id FROM drivers)
			   AND id NOT IN (SELECT vehicle_class_id FROM rides)`
		).run(...classes.map((vc) => vc.id));
	});
	tx(vehicleClasses);

	res.json({ config: getConfigRow(), vehicleClasses: getVehicleClasses() });
});

adminRouter.get('/drivers', (_req, res) => {
	const rows = db
		.prepare(
			`SELECT dr.id, u.name, dr.association AS "group", dr.verified, dr.rating, u.phone, u.email
			 FROM drivers dr JOIN users u ON u.id = dr.user_id
			 ORDER BY dr.id`
		)
		.all() as Array<Record<string, unknown>>;
	res.json({
		drivers: rows.map((r) => ({
			id: r.id as number,
			name: r.name as string,
			group: r.group as string | null,
			verified: r.verified === 1,
			rating: r.rating as number,
			phone: (r.phone as string | null) ?? undefined,
			email: r.email as string
		}))
	});
});

adminRouter.patch('/drivers/:id', (req, res) => {
	const body = driverPatchSchema.parse(req.body);
	const id = Number(req.params.id);
	const row = db.prepare('SELECT id FROM drivers WHERE id = ?').get(id);
	if (!row) throw err.notFound('Driver not found.');
	db.prepare('UPDATE drivers SET verified = ? WHERE id = ?').run(body.verified ? 1 : 0, id);
	res.json({ id, verified: body.verified });
});

adminRouter.get('/users', (_req, res) => {
	const rows = db
		.prepare('SELECT id, name, role, status, email_verified, phone_verified, phone, created_at FROM users ORDER BY id')
		.all() as Array<Record<string, unknown>>;
	res.json({
		users: rows.map((r) => ({
			id: r.id as number,
			name: r.name as string,
			role: capitalize(r.role as string),
			status: capitalize(r.status as string) as UserStatus,
			joinedAt: r.created_at as string,
			emailVerified: r.email_verified === 1,
			phoneVerified: r.phone_verified === 1,
			phone: (r.phone as string | null) ?? undefined
		}))
	});
});

adminRouter.post('/users', (req, res) => {
	const body = createUserSchema.parse(req.body);
	const email = body.email.toLowerCase();

	if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
		throw err.conflict('An account with this email already exists.', 'EMAIL_TAKEN');
	}

	let phone: string | null = body.phone ?? null;
	if (phone) {
		phone = normalizePhone(phone).e164;
		if (db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) {
			throw err.conflict('An account with this phone number already exists.', 'PHONE_TAKEN');
		}
	}

	// Created by an admin, so the account is trusted: active and email-verified
	// up front. Drivers still need a drivers row (onboarding) and verified = 1
	// before they can accept rides.
	const info = db
		.prepare(
			`INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, phone_verified)
			 VALUES (?, ?, ?, ?, ?, 'active', 1, 0)`
		)
		.run(body.name.trim(), email, phone, hashPassword(body.password), body.role);

	const id = Number(info.lastInsertRowid);
	console.log(`[admin] user #${req.user!.id} created ${body.role} account #${id} (${email})`);

	res.status(201).json({
		user: { id, name: body.name.trim(), email, phone, role: body.role, status: 'active' }
	});
});

adminRouter.patch('/users/:id', (req, res) => {
	const body = userPatchSchema.parse(req.body);
	const id = Number(req.params.id);
	const row = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
	if (!row) throw err.notFound('User not found.');
	db.prepare('UPDATE users SET status = ? WHERE id = ?').run(body.status, id);
	res.json({ id, status: capitalize(body.status) });
});
