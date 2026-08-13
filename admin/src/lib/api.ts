import { get } from 'svelte/store';
import { session } from './auth';
import type { Driver, PricingConfig, User, VehicleClass } from './types';

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const seedPricing: PricingConfig = {
	currency: 'USD',
	baseFare: 3,
	perKm: 1.2,
	perMinute: 0.15,
	bookingFee: 1,
	surgeMultiplier: 1,
	minimumFare: 5
};

export const seedVehicleClasses: VehicleClass[] = [
	{ id: 'car', name: 'Car / SUV', multiplier: 1 },
	{ id: 'van', name: 'Van / Minibus', multiplier: 1.25 },
	{ id: 'coach', name: 'Coach bus', multiplier: 1.6 },
	{ id: 'truck', name: 'Truck / 4x4 cargo', multiplier: 1.8 }
];

export const seedDrivers: Driver[] = [
	{
		id: 'd1',
		name: 'Peter Okello',
		group: 'Mbale Highway Drivers Group',
		verified: true,
		rating: 4.7,
		phone: '+256 700 111 222'
	},
	{
		id: 'd2',
		name: 'Joseph Mwangi',
		group: 'Kampala Tourist Taxis Assoc.',
		verified: true,
		rating: 4.9,
		phone: '+256 700 333 444'
	},
	{
		id: 'd3',
		name: 'Grace Alupo',
		group: 'Entebbe Airport Drivers Union',
		verified: false,
		rating: 4.8,
		phone: '+256 700 555 666'
	}
];

export const seedUsers: User[] = [
	{ id: 'u1', name: 'Amara Boateng', role: 'Tourist', status: 'Active', joinedAt: '2026-08-02' },
	{ id: 'u2', name: 'David Kim', role: 'Tourist', status: 'Active', joinedAt: '2026-08-05' },
	{ id: 'u3', name: 'John Ochieng', role: 'Tourist', status: 'Pending', joinedAt: '2026-08-12' },
	{ id: 'u4', name: 'Sarah Nakato', role: 'Driver', status: 'Pending', joinedAt: '2026-08-13' }
];

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = get(session)?.token;
	if (token) headers['Authorization'] = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${path}`, { headers, ...options });
	if (!res.ok) throw new Error(`Request failed (${res.status})`);
	return (await res.json()) as T;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getPricing(): Promise<{ config: PricingConfig; vehicleClasses: VehicleClass[] }> {
	try {
		return await api('/admin/pricing');
	} catch {
		await delay(250);
		return { config: seedPricing, vehicleClasses: seedVehicleClasses };
	}
}

export async function savePricing(config: PricingConfig, vehicleClasses: VehicleClass[]): Promise<void> {
	try {
		await api('/admin/pricing', { method: 'PUT', body: JSON.stringify({ config, vehicleClasses }) });
	} catch {
		await delay(250);
	}
}

export async function getDrivers(): Promise<Driver[]> {
	try {
		return await api('/admin/drivers');
	} catch {
		await delay(250);
		return seedDrivers;
	}
}

export async function verifyDriver(id: string, verified: boolean): Promise<void> {
	try {
		await api(`/admin/drivers/${id}`, { method: 'PATCH', body: JSON.stringify({ verified }) });
	} catch {
		await delay(200);
	}
}

export async function getUsers(): Promise<User[]> {
	try {
		return await api('/admin/users');
	} catch {
		await delay(250);
		return seedUsers;
	}
}

export async function updateUserStatus(id: string, status: User['status']): Promise<void> {
	try {
		await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
	} catch {
		await delay(200);
	}
}
