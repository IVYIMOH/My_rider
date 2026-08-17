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

export interface RideDriver {
	id: number;
	name: string;
	phone: string | null;
	association: string | null;
	vehicleClassId: string | null;
	rating: number;
	verified: boolean;
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
	driver: RideDriver | null;
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

export interface Message {
	id: number;
	senderId: number;
	senderName: string;
	body: string;
	createdAt: string;
}

export async function getPricing(): Promise<{ config: PricingConfig; vehicleClasses: VehicleClass[] }> {
	return http('/api/pricing');
}

export async function getVehicleClasses(): Promise<VehicleClass[]> {
	return http<{ vehicleClasses: VehicleClass[] }>('/api/vehicle-classes').then((r) => r.vehicleClasses);
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

export async function getAvailableRides(): Promise<Ride[]> {
	return http<{ rides: Ride[] }>('/api/rides/available', { token: requireToken() }).then((r) => r.rides);
}

export async function getRide(id: number): Promise<Ride> {
	return http<{ ride: Ride }>(`/api/rides/${id}`, { token: requireToken() }).then((r) => r.ride);
}

export async function acceptRide(id: number): Promise<Ride> {
	return http<{ ride: Ride }>(`/api/rides/${id}/accept`, { method: 'POST', token: requireToken() }).then((r) => r.ride);
}

export async function completeRide(id: number): Promise<Ride> {
	return http<{ ride: Ride }>(`/api/rides/${id}/complete`, { method: 'POST', token: requireToken() }).then((r) => r.ride);
}

export async function cancelRide(id: number): Promise<Ride> {
	return http<{ ride: Ride }>(`/api/rides/${id}/cancel`, { method: 'POST', token: requireToken() }).then((r) => r.ride);
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

export async function getConversationMessages(id: number): Promise<Message[]> {
	return http<{ messages: Message[] }>(`/api/messages/${id}`, { token: requireToken() }).then(
		(r) => r.messages
	);
}

export async function sendMessage(id: number, body: string): Promise<void> {
	await http(`/api/messages/${id}`, { method: 'POST', token: requireToken(), body: { body } });
}

export async function startConversation(recipientId: number, body: string): Promise<number> {
	return http<{ conversationId: number }>('/api/messages', {
		method: 'POST',
		token: requireToken(),
		body: { recipientId, body }
	}).then((r) => r.conversationId);
}

export async function getProfile(): Promise<{
	profile: {
		id: number;
		name: string;
		email: string;
		phone: string | null;
		role: string;
		emailVerified: boolean;
		phoneVerified: boolean;
	};
}> {
	return http('/api/profile', { token: requireToken() });
}

export async function updateProfile(input: { name?: string; phone?: string }): Promise<void> {
	await http('/api/profile', { method: 'PATCH', token: requireToken(), body: input });
}
