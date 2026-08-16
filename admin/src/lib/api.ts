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
