import { writable, get } from 'svelte/store';
import { http, ApiError } from './http';

export interface FrontendUser {
	id: number;
	name: string;
	email: string;
	role: string;
}

interface Session {
	token: string;
	user: FrontendUser;
}

const SESSION_KEY = 'sipi_rider_session';

function readSession(): Session | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function persistSession(next: Session | null) {
	if (typeof localStorage !== 'undefined') {
		if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
		else localStorage.removeItem(SESSION_KEY);
	}
}

export const session = writable<Session | null>(readSession());

export function isAuthenticated(): boolean {
	return !!get(session)?.token;
}

/** Returns the current bearer token or throws when the rider is not signed in. */
export function requireToken(): string {
	const token = get(session)?.token;
	if (!token) {
		throw new ApiError({
			status: 401,
			code: 'NO_SESSION',
			message: 'Sign in required to access this feature.'
		});
	}
	return token;
}

export function login(email: string, password: string): Promise<FrontendUser> {
	return http<{ token: string; user: FrontendUser }>('/api/auth/login', {
		method: 'POST',
		body: { email, password }
	}).then(({ token, user }) => {
		const next: Session = { token, user };
		session.set(next);
		persistSession(next);
		return user;
	});
}

export function logout() {
	session.set(null);
	persistSession(null);
}
