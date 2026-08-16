import type { PricingConfig, VehicleClass } from '../types';

/**
 * Matches the admin console's documented formula:
 * (base + per-km × km + per-min × min) × vehicle class surge × booking fee
 * and never goes below the configured minimum fare.
 */
export function calculateFare(
	config: PricingConfig,
	vc: VehicleClass,
	distanceKm: number,
	durationMin: number
): number {
	const raw =
		(config.baseFare + config.perKm * distanceKm + config.perMinute * durationMin) *
		vc.multiplier *
		config.bookingFee *
		config.surgeMultiplier;
	return Math.round(Math.max(config.minimumFare, raw) * 100) / 100;
}
