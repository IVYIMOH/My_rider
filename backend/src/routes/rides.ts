import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { calculateFare } from '../lib/fares';
import type { PricingConfig, Ride, RideDriver, RideStatus, VehicleClass } from '../types';

export const ridesRouter = Router();

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const createRideSchema = z.object({
	vehicleClassId: z.string().min(1),
	pickup: z.string().min(2).max(200),
	destination: z.string().min(2).max(200),
	distanceKm: z.number().min(0),
	durationMin: z.number().min(0)
});
const estimateSchema = z.object({
	vehicleClassId: z.string().min(1),
	distanceKm: z.number().min(0),
	durationMin: z.number().min(0)
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

function loadDriverSummary(userId: number | null): RideDriver | null {
	if (!userId) return null;
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.phone, d.association, d.vehicle_class_id, d.rating, d.verified
			 FROM drivers d JOIN users u ON u.id = d.user_id
			 WHERE d.user_id = ?`
		)
		.get(userId) as
		| { id: number; name: string; phone: string | null; association: string | null; vehicle_class_id: string | null; rating: number; verified: number }
		| undefined;
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		phone: row.phone,
		association: row.association,
		vehicleClassId: row.vehicle_class_id,
		rating: row.rating,
		verified: row.verified === 1
	};
}

function mapRide(row: Record<string, unknown>): Ride {
	return {
		id: row.id as number,
		userId: row.user_id as number,
		driverId: row.driver_id as number | null,
		vehicleClassId: row.vehicle_class_id as string,
		pickup: row.pickup as string,
		destination: row.destination as string,
		distanceKm: row.distance_km as number,
		durationMin: row.duration_min as number,
		estimatedFare: row.estimated_fare as number,
		status: row.status as RideStatus,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
		driver: loadDriverSummary(row.driver_id as number | null)
	};
}

function getVehicleClass(id: string): VehicleClass | undefined {
	return db.prepare('SELECT id, name, multiplier, seats FROM vehicle_classes WHERE id = ?').get(id) as
		| VehicleClass
		| undefined;
}

function loadRide(id: number) {
	const row = db.prepare('SELECT * FROM rides WHERE id = ?').get(id) as Record<string, unknown> | undefined;
	return row ? mapRide(row) : null;
}

ridesRouter.post('/estimate', (req, res) => {
	const body = estimateSchema.parse(req.body);
	const vc = getVehicleClass(body.vehicleClassId);
	if (!vc) throw err.notFound('Unknown vehicle class.');
	const estimatedFare = calculateFare(getConfigRow(), vc, body.distanceKm, body.durationMin);
	res.json({ estimatedFare, currency: getConfigRow().currency });
});

ridesRouter.post('/', requireAuth, requireRole('tourist'), (req, res) => {
	const body = createRideSchema.parse(req.body);
	const vc = getVehicleClass(body.vehicleClassId);
	if (!vc) throw err.notFound('Unknown vehicle class.');

	const config = getConfigRow();
	const estimatedFare = calculateFare(config, vc, body.distanceKm, body.durationMin);
	const info = db
		.prepare(
			`INSERT INTO rides (user_id, driver_id, vehicle_class_id, pickup, destination, distance_km, duration_min, estimated_fare, status)
			 VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'searching')`
		)
		.run(
			req.user!.id,
			body.vehicleClassId,
			body.pickup.trim(),
			body.destination.trim(),
			body.distanceKm,
			body.durationMin,
			estimatedFare
		);

	res.status(201).json({ ride: loadRide(Number(info.lastInsertRowid)) });
});

ridesRouter.get('/', requireAuth, (req, res) => {
	const rows = db
		.prepare('SELECT * FROM rides WHERE user_id = ? OR driver_id = ? ORDER BY id DESC')
		.all(req.user!.id, req.user!.id);
	res.json({ rides: rows.map((r) => mapRide(r as Record<string, unknown>)) });
});

ridesRouter.get('/available', requireAuth, requireRole('driver'), (_req, res) => {
	const rows = db
		.prepare("SELECT * FROM rides WHERE status = 'searching' AND driver_id IS NULL ORDER BY id DESC")
		.all();
	res.json({ rides: rows.map((r) => mapRide(r as Record<string, unknown>)) });
});

ridesRouter.get('/:id', requireAuth, (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	const ride = loadRide(id);
	if (!ride) throw err.notFound('Ride not found.');
	if (ride.userId !== req.user!.id && ride.driverId !== req.user!.id && req.user!.role !== 'admin') {
		throw err.forbidden();
	}
	res.json({ ride });
});

ridesRouter.post('/:id/cancel', requireAuth, (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	const ride = loadRide(id);
	if (!ride) throw err.notFound('Ride not found.');
	if (ride.userId !== req.user!.id) throw err.forbidden();
	if (ride.status !== 'searching' && ride.status !== 'active') {
		throw err.badRequest('This ride can no longer be cancelled.', 'RIDE_NOT_CANCELLABLE');
	}
	db.prepare("UPDATE rides SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
	res.json({ ride: loadRide(id) });
});

ridesRouter.post('/:id/accept', requireAuth, requireRole('driver'), (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	// Single conditional UPDATE: only one driver can ever claim a searching ride.
	const info = db
		.prepare(
			`UPDATE rides SET driver_id = ?, status = 'active', updated_at = datetime('now')
			 WHERE id = ? AND status = 'searching' AND driver_id IS NULL`
		)
		.run(req.user!.id, id);
	if (info.changes === 0) {
		const ride = loadRide(id);
		if (!ride) throw err.notFound('Ride not found.');
		throw err.badRequest('This ride is no longer available.', 'RIDE_TAKEN');
	}
	res.json({ ride: loadRide(id) });
});

ridesRouter.post('/:id/complete', requireAuth, requireRole('driver'), (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	const ride = loadRide(id);
	if (!ride) throw err.notFound('Ride not found.');
	if (ride.driverId !== req.user!.id) throw err.forbidden();
	if (ride.status !== 'active') throw err.badRequest('Only an active ride can be completed.', 'RIDE_NOT_ACTIVE');
	db.prepare("UPDATE rides SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(id);
	res.json({ ride: loadRide(id) });
});
