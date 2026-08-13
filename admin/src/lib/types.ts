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
}

export interface Driver {
	id: string;
	name: string;
	group: string;
	verified: boolean;
	rating: number;
	phone?: string;
}

export type UserStatus = 'Active' | 'Pending' | 'Suspended';
export type UserRole = 'Tourist' | 'Driver' | 'Admin';

export interface User {
	id: string;
	name: string;
	role: UserRole;
	status: UserStatus;
	joinedAt: string;
}

export interface AuthUser {
	name: string;
	email: string;
	role: 'Admin';
}
