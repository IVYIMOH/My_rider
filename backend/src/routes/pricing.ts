import { Router } from 'express';
import { db } from '../db';
import type { PricingConfig, VehicleClass } from '../types';

export const pricingRouter = Router();

async function getConfigRow() {
	const row = (await db.prepare('SELECT * FROM pricing WHERE id = 1').get()) as Record<string, number | string>;
	return {
		currency: row.currency as string,
		baseFare: row.base_fare as number,
		perKm: row.per_km as number,
		perMinute: row.per_minute as number,
		bookingFee: row.booking_fee as number,
		surgeMultiplier: row.surge_multiplier as number,
		minimumFare: row.minimum_fare as number
	} satisfies PricingConfig;
}

async function getVehicleClasses(): Promise<VehicleClass[]> {
	return (await db
		.prepare('SELECT id, name, multiplier, seats FROM vehicle_classes ORDER BY multiplier')
		.all()) as VehicleClass[];
}

pricingRouter.get('/pricing', async (_req, res) => {
	res.json({ config: await getConfigRow(), vehicleClasses: await getVehicleClasses() });
});

pricingRouter.get('/vehicle-classes', async (_req, res) => {
	res.json({ vehicleClasses: await getVehicleClasses() });
});
