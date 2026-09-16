import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { config } from '../config';

export type OtpRole = 'tourist' | 'driver';

export interface OtpChallenge {
	code: string;
	expiresAt: Date;
}

export type OtpFailure = 'NO_CODE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE';

export type OtpResult = { ok: true; role: OtpRole } | { ok: false; reason: OtpFailure; attemptsLeft: number };

/**
 * Hashes a login code bound to the phone it was issued for, so one stolen hash
 * cannot be replayed against a different number and a single precomputed table
 * cannot cover every row at once.
 *
 * Note: a 6-digit code only has ~20 bits of entropy, so this hash is not a
 * meaningful barrier against an attacker who has already dumped the table —
 * the real protections are the short TTL and the attempt cap below. Raising
 * the code length or switching to bcrypt here would harden the
 * database-compromise case specifically.
 */
export function hashCode(phoneE164: string, code: string): string {
	return createHash('sha256').update(`${phoneE164}:${code}`).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Issues a single-use login code for a phone number, invalidating any codes
 * previously issued to it. Mirrors issueVerificationToken() in tokens.ts.
 */
export function issueOtp(phoneE164: string, role: OtpRole): OtpChallenge {
	db.prepare('DELETE FROM phone_otps WHERE phone = ? AND used_at IS NULL').run(phoneE164);

	// randomInt is CSPRNG-backed; the upper bound is exclusive.
	const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
	const expiresAt = new Date(Date.now() + config.otp.ttlMin * 60_000);

	db.prepare('INSERT INTO phone_otps (phone, code_hash, role, expires_at) VALUES (?, ?, ?, ?)').run(
		phoneE164,
		hashCode(phoneE164, code),
		role,
		expiresAt.toISOString()
	);

	return { code, expiresAt };
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
		| { id: number; code_hash: string; role: OtpRole; attempts: number; expires_at: string }
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

	if (!constantTimeEquals(row.code_hash, hashCode(phoneE164, code))) {
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
	return { ok: true, role: row.role };
}
