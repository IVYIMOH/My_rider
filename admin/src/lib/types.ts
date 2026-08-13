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
	seats?: string;
}

export interface Driver {
	id: number;
	name: string;
	group: string;
	verified: boolean;
	rating: number;
	phone?: string;
	email?: string;
}

export type UserStatus = 'Active' | 'Pending' | 'Suspended';
export type UserRole = 'Tourist' | 'Driver' | 'Admin';

export interface User {
	id: number;
	name: string;
	role: UserRole;
	status: UserStatus;
	joinedAt: string;
	emailVerified?: boolean;
}

export interface AuthUser {
	id: number;
	name: string;
	email: string;
	role: 'Admin';
	status: string;
	emailVerified: boolean;
	createdAt: string;
}
