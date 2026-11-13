import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db';
import { config } from '../config';

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function issueVerificationToken(userId: number): Promise<string> {
	// Invalidate any previously issued, still-unused tokens for this user.
	await db.prepare('DELETE FROM verification_tokens WHERE user_id = ? AND used_at IS NULL').run(userId);
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + config.verifyTokenTtlMin * 60_000).toISOString();
	await db.prepare(
		'INSERT INTO verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
	).run(userId, hashToken(token), expiresAt);
	return token;
}

export async function verifyEmailToken(token: string): Promise<number | null> {
	const row = (await db
		.prepare('SELECT * FROM verification_tokens WHERE token_hash = ? AND used_at IS NULL')
		.get(hashToken(token))) as { id: number; user_id: number; expires_at: string } | undefined;
	if (!row) return null;
	if (new Date(row.expires_at).getTime() < Date.now()) return null;
	await db.prepare("UPDATE verification_tokens SET used_at = now() WHERE id = ?").run(row.id);
	await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
	return row.user_id;
}
