import { redirect } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/auth';

export function load() {
	if (!isAuthenticated()) throw redirect(307, '/login');
}
