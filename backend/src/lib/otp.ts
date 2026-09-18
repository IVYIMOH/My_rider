import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { config } from '../config';
import { err } from '../errors';
import { rateLimit } from './rateLimit';

export type OtpRole = 'tourist' | 'driver';

export interface OtpChallenge {
	code: string;
	expiresAt: Date;
}

export type OtpFailure = 'NO_CODE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE';

export type OtpResult =
	| { ok: true; role: OtpRole; userId: number | null }
	| { ok: false; reason: OtpFailure; attemptsLeft: number };

/** Matches lib/password.ts, which uses the same cost for account passwords. */
const BCRYPT_COST = 10;

/**
 * Hashes a login code with bcrypt, bound to the phone it was issued for.
 *
 * bcrypt rather than SHA-256 because a 6-digit code carries only ~20 bits of
 * entropy: the entire 1,000,000-code space is seconds of GPU work against a
 * fast hash, so a leaked table would hand over every live code. At cost 10 each
 * guess costs ~50 ms, putting an exhaustive search at roughly 14 CPU-hours per
 * code — far beyond the 5-minute TTL. bcrypt also salts per row automatically.
 *
 * Binding to the phone number is belt-and-braces: it stops a row's hash being
 * lifted and replayed against a different number.
 */
export function hashCode(phoneE164: string, code: string): string {
	return bcrypt.hashSync(`${phoneE164}:${code}`, BCRYPT_COST);
}

function codeMatches(phoneE164: string, code: string, hash: string): boolean {
	// bcrypt.compareSync is constant-time with respect to the hash contents.
	return bcrypt.compareSync(`${phoneE164}:${code}`, hash);
}

/**
 * Issues a single-use code for a phone number, invalidating any codes
 * previously issued to it. Mirrors issueVerificationToken() in tokens.ts.
 *
 * `userId` is null for sign-in codes (the account may not exist yet) and set
 * for profile phone-change codes, so the challenge can only be redeemed by the
 * account that asked for it.
 */
export function issueOtp(phoneE164: string, role: OtpRole, userId: number | null = null): OtpChallenge {
	db.prepare('DELETE FROM phone_otps WHERE phone = ? AND used_at IS NULL').run(phoneE164);

	// randomInt is CSPRNG-backed; the upper bound is exclusive.
	const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
	const expiresAt = new Date(Date.now() + config.otp.ttlMin * 60_000);

	db.prepare(
		'INSERT INTO phone_otps (phone, code_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?, ?)'
	).run(phoneE164, hashCode(phoneE164, code), role, userId, expiresAt.toISOString());

	return { code, expiresAt };
}

/**
 * The three send-rate gates, shared by every endpoint that texts a code
 * (sign-in and profile phone change) so one flow cannot be used to bypass the
 * other's budget. Ordered widest-first: a client spraying many numbers trips
 * the IP gate without burning a victim's per-number allowance.
 *
 * Throws a 429 ApiError; returns normally when the send is allowed.
 */
export function assertOtpSendAllowed(phoneE164: string, clientIp: string): void {
	const HOUR = 60 * 60 * 1000;
	if (!rateLimit(`otp:ip:${clientIp}`, config.otp.perIpHour, HOUR)) {
		throw err.rateLimited('Too many codes requested from this device. Try again later.');
	}
	if (!rateLimit(`otp:phone:${phoneE164}`, config.otp.perPhoneHour, HOUR)) {
		throw err.rateLimited('Too many codes requested for this number. Try again later.');
	}
	if (!rateLimit(`otp:cooldown:${phoneE164}`, 1, config.otp.cooldownSec * 1000)) {
		throw err.rateLimited(`Please wait ${config.otp.cooldownSec} seconds before requesting another code.`);
	}
}

/** Caps code submissions per number, alongside the per-code attempt limit. */
export function assertOtpVerifyAllowed(phoneE164: string): void {
	if (!rateLimit(`otp:verify:${phoneE164}`, config.otp.verifyPerPhoneHour, 60 * 60 * 1000)) {
		throw err.rateLimited('Too many attempts. Try again later.');
	}
}

/**
 * Consumes a login code. A correct code is burned on success; a wrong one
 * increments the attempt counter and burns the code once the cap is reached,
 * so the 6-digit space cannot be walked.
 */
export function verifyOtp(phoneE164: string, code: string): OtpResult {
	const row = db
		.prepare('SELECT * FROM phone_otps WHERE phone = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1')
		.get(phoneE164) as
		| { id: number; code_hash: string; role: OtpRole; user_id: number | null; attempts: number; expires_at: string }
		| undefined;

	if (!row) return { ok: false, reason: 'NO_CODE', attemptsLeft: 0 };

	if (new Date(row.expires_at).getTime() < Date.now()) {
		db.prepare("UPDATE phone_otps SET used_at = datetime('now') WHERE id = ?").run(row.id);
		return { ok: false, reason: 'EXPIRED', attemptsLeft: 0 };
	}

	if (row.attempts >= config.otp.maxAttempts) {
		db.prepare("UPDATE phone_otps SET used_at = datetime('now') WHERE id = ?").run(row.id);
		return { ok: false, reason: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0 };
	}

	if (!codeMatches(phoneE164, code, row.code_hash)) {
		const attempts = row.attempts + 1;
		const exhausted = attempts >= config.otp.maxAttempts;
		db.prepare(
			`UPDATE phone_otps SET attempts = ?, used_at = CASE WHEN ? THEN datetime('now') ELSE used_at END
			 WHERE id = ?`
		).run(attempts, exhausted ? 1 : 0, row.id);
		return {
			ok: false,
			reason: exhausted ? 'TOO_MANY_ATTEMPTS' : 'INVALID_CODE',
			attemptsLeft: Math.max(config.otp.maxAttempts - attempts, 0)
		};
	}

	db.prepare("UPDATE phone_otps SET used_at = datetime('now') WHERE id = ?").run(row.id);
	return { ok: true, role: row.role, userId: row.user_id };
}
