import { writable, get } from 'svelte/store';
import type { AuthUser } from './types';

interface MockUser extends AuthUser {
	password: string;
}

interface Session {
	token: string;
	user: AuthUser;
}

const USERS_KEY = 'sipi_admin_users';
const SESSION_KEY = 'sipi_admin_session';

const defaultUsers: MockUser[] = [
	{ name: 'SipiRider Admin', email: 'admin@sipirider.com', password: 'admin1234', role: 'Admin' }
];

function readUsers(): MockUser[] {
	if (typeof localStorage === 'undefined') return [...defaultUsers];
	const raw = localStorage.getItem(USERS_KEY);
	if (!raw) {
		localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
		return [...defaultUsers];
	}
	try {
		return JSON.parse(raw);
	} catch {
		return [...defaultUsers];
	}
}

function persistUsers(users: MockUser[]) {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(USERS_KEY, JSON.stringify(users));
	}
}

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

function makeToken(): string {
	return `mock.${Math.random().toString(36).slice(2, 12)}.${Date.now().toString(36)}`;
}

export const session = writable<Session | null>(readSession());

export function isAuthenticated(): boolean {
	return !!get(session)?.token;
}

export function login(email: string, password: string): Promise<AuthUser> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			const users = readUsers();
			const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
			if (!user || user.password !== password) {
				reject(new Error('Invalid email or password.'));
				return;
			}
			const authUser: AuthUser = { name: user.name, email: user.email, role: user.role };
			const next: Session = { token: makeToken(), user: authUser };
			session.set(next);
			persistSession(next);
			resolve(authUser);
		}, 400);
	});
}

export function register(name: string, email: string, password: string): Promise<AuthUser> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			const users = readUsers();
			if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
				reject(new Error('An account with this email already exists.'));
				return;
			}
			const newUser: MockUser = {
				name: name.trim(),
				email: email.toLowerCase(),
				password,
				role: 'Admin'
			};
			persistUsers([...users, newUser]);
			const authUser: AuthUser = { name: newUser.name, email: newUser.email, role: newUser.role };
			const next: Session = { token: makeToken(), user: authUser };
			session.set(next);
			persistSession(next);
			resolve(authUser);
		}, 400);
	});
}

export function logout() {
	session.set(null);
	persistSession(null);
}
