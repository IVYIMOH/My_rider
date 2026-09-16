import { get } from 'svelte/store';
import { http, API_BASE } from './http';
import { session } from './auth';
import type { Driver, PricingConfig, User, VehicleClass } from './types';

export { API_BASE };

export async function getPricing(): Promise<{ config: PricingConfig; vehicleClasses: VehicleClass[] }> {
	return http('/api/admin/pricing', { token: get(session)?.token });
}

export async function savePricing(config: PricingConfig, vehicleClasses: VehicleClass[]): Promise<void> {
	await http('/api/admin/pricing', {
		method: 'PUT',
		token: get(session)?.token,
		body: { config, vehicleClasses }
	});
}

export async function getDrivers(): Promise<Driver[]> {
	return http<{ drivers: Driver[] }>('/api/admin/drivers', { token: get(session)?.token }).then((r) => r.drivers);
}

export async function verifyDriver(id: number, verified: boolean): Promise<void> {
	await http(`/api/admin/drivers/${id}`, {
		method: 'PATCH',
		token: get(session)?.token,
		body: { verified }
	});
}

export async function getUsers(): Promise<User[]> {
	return http<{ users: User[] }>('/api/admin/users', { token: get(session)?.token }).then((r) => r.users);
}

export async function updateUserStatus(id: number, status: User['status']): Promise<void> {
	await http(`/api/admin/users/${id}`, {
		method: 'PATCH',
		token: get(session)?.token,
		body: { status: status.toLowerCase() }
	});
}

/**
 * Creates a privileged account. This is the only HTTP path that can mint an
 * admin or driver — /api/auth/register always produces a tourist — and the
 * backend requires a valid admin JWT to reach it.
 */
export async function createUser(input: {
	name: string;
	email: string;
	password: string;
	role: 'tourist' | 'driver' | 'admin';
	phone?: string;
}): Promise<{ id: number }> {
	return http<{ user: { id: number } }>('/api/admin/users', {
		method: 'POST',
		token: get(session)?.token,
		body: input
	}).then((r) => r.user);
}
