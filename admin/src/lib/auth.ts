import { writable, get } from 'svelte/store';
import { http } from './http';
import type { AuthUser } from './types';

interface Session {
	token: string;
	user: AuthUser;
}

const SESSION_KEY = 'sipi_admin_session';

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

export function login(email: string, password: string): Promise<AuthUser> {
	return http<{ token: string; user: AuthUser }>('/api/auth/login', {
		method: 'POST',
		body: { email, password }
	}).then(({ token, user }) => {
		const next: Session = { token, user };
		session.set(next);
		persistSession(next);
		return user;
	});
}

/**
 * Admin accounts are NOT self-service. There is deliberately no register()
 * here: POST /api/auth/register only ever creates tourists, and the backend
 * ignores any `role` sent with it.
 *
 * To create an admin or driver account:
 *   - first admin on a fresh database — `npm run create-admin` in backend/
 *   - any account after that — POST /api/admin/users with an admin JWT
 *     (see createUser() in ./api.ts)
 */
export function verifyEmail(token: string): Promise<{ message: string }> {
	return http<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
}

export function resendVerification(email: string): Promise<{ message: string }> {
	return http<{ message: string }>('/api/auth/resend-verification', {
		method: 'POST',
		body: { email }
	});
}

/** Validates the persisted session against the backend, clearing it when invalid. */
export async function restoreSession(): Promise<void> {
	const current = get(session);
	if (!current?.token) return;
	try {
		const { user } = await http<{ user: AuthUser }>('/api/auth/me', { token: current.token });
		const next: Session = { token: current.token, user };
		session.set(next);
		persistSession(next);
	} catch {
		session.set(null);
		persistSession(null);
	}
}

export function logout() {
	session.set(null);
	persistSession(null);
}
