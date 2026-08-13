import { http } from './http';
import { requireToken } from './auth';

export interface PricingConfig {
	currency: string;
	baseFare: number;
	perKm: number;
	perMinute: number;
	bookingFee: number;
	surgeMultiplier: number;
	minimumFare: number;
}

export interface VehicleClass {
	id: string;
	name: string;
	multiplier: number;
	seats: string;
}

export interface Ride {
	id: number;
	userId: number;
	driverId: number | null;
	vehicleClassId: string;
	pickup: string;
	destination: string;
	distanceKm: number;
	durationMin: number;
	estimatedFare: number;
	status: 'searching' | 'active' | 'completed' | 'cancelled';
	createdAt: string;
	updatedAt: string;
}

export interface DriverMe {
	profile: {
		id: number;
		name: string;
		email: string;
		phone: string | null;
		association: string | null;
		vehicleClassId: string | null;
		verified: boolean;
		rating: number;
		online: boolean;
	};
	stats: {
		todayEarnings: number;
		onlineSeconds: number;
		rating: number;
	};
}

export interface Conversation {
	id: number;
	partnerId: number;
	partnerName: string;
	lastMessage: string | null;
}

export async function getPricing(): Promise<{ config: PricingConfig; vehicleClasses: VehicleClass[] }> {
	return http('/api/pricing');
}

export async function estimateFare(
	vehicleClassId: string,
	distanceKm: number,
	durationMin: number
): Promise<{ estimatedFare: number; currency: string }> {
	return http('/api/rides/estimate', { method: 'POST', body: { vehicleClassId, distanceKm, durationMin } });
}

export async function createRide(input: {
	vehicleClassId: string;
	pickup: string;
	destination: string;
	distanceKm: number;
	durationMin: number;
}): Promise<Ride> {
	return http<{ ride: Ride }>('/api/rides', {
		method: 'POST',
		token: requireToken(),
		body: input
	}).then((r) => r.ride);
}

export async function getRides(): Promise<Ride[]> {
	return http<{ rides: Ride[] }>('/api/rides', { token: requireToken() }).then((r) => r.rides);
}

export async function getDriverMe(): Promise<DriverMe> {
	return http<DriverMe>('/api/drivers/me', { token: requireToken() });
}

export async function setDriverOnline(online: boolean): Promise<void> {
	await http('/api/drivers/me', { method: 'PATCH', token: requireToken(), body: { online } });
}

export async function submitDriverOnboarding(input: {
	fullName: string;
	phone: string;
	association: string;
	vehicleClassId: string;
}): Promise<void> {
	await http('/api/drivers/onboarding', { method: 'POST', token: requireToken(), body: input });
}

export async function getConversations(): Promise<Conversation[]> {
	return http<{ conversations: Conversation[] }>('/api/messages', { token: requireToken() }).then(
		(r) => r.conversations
	);
}

export async function getProfile(): Promise<{ profile: { id: number; name: string; email: string; role: string } }> {
	return http('/api/profile', { token: requireToken() });
}
