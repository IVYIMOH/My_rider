export type Role = 'tourist' | 'driver' | 'admin';
export type UserStatus = 'active' | 'pending' | 'suspended';
export type RideStatus = 'searching' | 'active' | 'completed' | 'cancelled';

export interface PublicUser {
	id: number;
	name: string;
	email: string;
	phone: string | null;
	role: Role;
	status: UserStatus;
	emailVerified: boolean;
	createdAt: string;
}

export interface DriverProfile {
	id: number;
	userId: number;
	association: string | null;
	vehicleClassId: string | null;
	verified: boolean;
	rating: number;
	online: boolean;
}

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
	status: RideStatus;
	createdAt: string;
	updatedAt: string;
}
