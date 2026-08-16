import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { issueVerificationToken, verifyEmailToken } from '../lib/tokens';
import { sendEmail } from '../lib/mailer';
import { rateLimit } from '../lib/rateLimit';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
import { normalizePhone, canVerify } from '../lib/phone';
import { verifyMtn } from '../lib/mtn';
import { verifySafaricom } from '../lib/daraja';
import type { PublicUser } from '../types';

export const authRouter = Router();

const registerSchema = z.object({
	name: z.string().min(2).max(80),
	email: z.string().email(),
	phone: z.string().max(30).optional(),
	password: z.string().min(8).max(128),
	role: z.enum(['tourist', 'driver', 'admin'])
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1)
});

const emailSchema = z.object({ email: z.string().email() });

const tokenSchema = z.object({ token: z.string().min(8).max(256) });

const phoneLoginSchema = z.object({
	phone: z.string().min(8).max(20),
	role: z.enum(['tourist', 'driver']).optional()
});

function toPublicUser(row: {
	id: number;
	name: string;
	email: string | null;
	phone: string | null;
	role: PublicUser['role'];
	status: PublicUser['status'];
	email_verified: number;
	created_at: string;
}): PublicUser {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		phone: row.phone,
		role: row.role,
		status: row.status,
		emailVerified: row.email_verified === 1,
		createdAt: row.created_at
	};
}

async function sendVerification(user: { id: number; email: string }) {
	const token = issueVerificationToken(user.id);
	const verifyUrl = `${config.publicBaseUrl}/verify-email?token=${token}`;
	await sendEmail(
		user.email,
		'Verify your SipiRider account',
		`<p>Click to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
		`Verify your SipiRider account:\n${verifyUrl}\n\nThis link expires in ${config.verifyTokenTtlMin} minutes.`
	);
}

authRouter.post('/register', async (req, res) => {
	const body = registerSchema.parse(req.body);
	const email = body.email.toLowerCase();

	const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
	if (exists) throw err.conflict('An account with this email already exists.', 'EMAIL_TAKEN');

	const status = body.role === 'driver' ? 'pending' : 'active';
	let phone: string | null = body.phone ?? null;
	if (phone) {
		try {
			phone = normalizePhone(phone).e164;
		} catch {
			// keep the raw value if it cannot be normalized
		}
	}
	const info = db
		.prepare(
			'INSERT INTO users (name, email, phone, password_hash, role, status, email_verified) VALUES (?, ?, ?, ?, ?, ?, 0)'
		)
		.run(body.name.trim(), email, phone, hashPassword(body.password), body.role, status);

	const userId = Number(info.lastInsertRowid);

	let emailDelivered = false;
	try {
		await sendVerification({ id: userId, email });
		emailDelivered = true;
	} catch (error) {
		console.error('[email] verification delivery failed for new user:', error);
	}

	res.status(201).json({
		message: emailDelivered
			? 'Registration successful. Check your email to verify your account.'
			: 'Registration successful, but the verification email could not be sent. Please use the resend link on login.',
		emailVerified: false,
		emailDelivered
	});
});

interface LoginRow {
	id: number;
	name: string;
	email: string;
	phone: string | null;
	role: PublicUser['role'];
	status: PublicUser['status'];
	email_verified: number;
	created_at: string;
	password_hash: string;
}

authRouter.post('/login', (req, res) => {
	const body = loginSchema.parse(req.body);
	const row = db
		.prepare(
			'SELECT id, name, email, phone, role, status, email_verified, password_hash, created_at FROM users WHERE email = ?'
		)
		.get(body.email.toLowerCase()) as LoginRow | undefined;

	if (!row || !verifyPassword(body.password, row.password_hash)) {
		throw err.unauthorized('Invalid email or password.');
	}
	if (row.status === 'suspended') throw err.forbidden('This account has been suspended.');
	if (row.status === 'pending') throw err.forbidden('Your account is pending approval.', 'ACCOUNT_PENDING');
	if (row.email_verified !== 1) {
		throw err.forbidden('Please verify your email before logging in.', 'EMAIL_NOT_VERIFIED');
	}

	res.json({ token: signToken({ id: row.id, role: row.role }), user: toPublicUser(row) });
});

authRouter.post('/phone-login', async (req, res) => {
	const body = phoneLoginSchema.parse(req.body);
	const phone = normalizePhone(body.phone);
	if (!rateLimit(`phonelogin:${phone.e164}`, 10, 60 * 60 * 1000)) {
		throw err.rateLimited('Too many attempts. Try again later.');
	}

	if (!config.phoneMock) {
		if (!canVerify(phone.operator)) {
			throw err.badRequest(
				`Phone verification is not yet available for ${phone.operator} numbers.`,
				'VERIFICATION_UNSUPPORTED'
			);
		}
		const result =
			phone.operator === 'mtn' ? await verifyMtn(phone.e164) : await verifySafaricom(phone.international);
		if (!result.valid) {
			throw err.badRequest('This phone number is not registered with the operator.', 'PHONE_NOT_REGISTERED');
		}
	}

	const existing = db
		.prepare(
			'SELECT id, name, email, phone, role, status, email_verified, created_at FROM users WHERE phone = ?'
		)
		.get(phone.e164) as Parameters<typeof toPublicUser>[0] | undefined;

	if (existing) {
		if (existing.status === 'suspended') throw err.forbidden('This account has been suspended.');
		if (existing.status === 'pending') throw err.forbidden('Your account is pending approval.');
		res.json({ token: signToken({ id: existing.id, role: existing.role }), user: toPublicUser(existing) });
		return;
	}

	const info = db
		.prepare(
			"INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, phone_verified) VALUES ('Rider', NULL, ?, ?, ?, 'active', 0, 1)"
		)
		.run(phone.e164, hashPassword(randomBytes(24).toString('hex')), body.role ?? 'tourist');
	const id = Number(info.lastInsertRowid);
	const created = db
		.prepare('SELECT id, name, email, phone, role, status, email_verified, created_at FROM users WHERE id = ?')
		.get(id) as Parameters<typeof toPublicUser>[0];

	res.status(201).json({ token: signToken({ id, role: created.role }), user: toPublicUser(created) });
});

authRouter.get('/verify-email', (req, res) => {
	const { token } = tokenSchema.parse(req.query);
	const userId = verifyEmailToken(token);
	if (!userId) throw err.badRequest('This verification link is invalid or has expired.', 'INVALID_TOKEN');
	res.json({ message: 'Email verified. You can now log in.' });
});

authRouter.post('/resend-verification', async (req, res) => {
	const { email } = emailSchema.parse(req.body);
	const key = `resend:${email.toLowerCase()}`;
	if (!rateLimit(key, 3, 60 * 60 * 1000)) {
		throw err.rateLimited('Too many verification emails. Try again later.');
	}

	const row = db.prepare('SELECT id, email, email_verified FROM users WHERE email = ?').get(email.toLowerCase()) as
		| { id: number; email: string; email_verified: number }
		| undefined;

	if (!row) {
		res.json({ message: 'If an account exists for that email, a new verification link has been sent.' });
		return;
	}
	if (row.email_verified === 1) {
		res.json({ message: 'This email is already verified.' });
		return;
	}

	try {
		await sendVerification({ id: row.id, email: row.email });
		res.json({ message: 'A new verification link has been sent.' });
	} catch (error) {
		console.error('[email] resend failed:', error);
		res.status(502).json({
			error: { code: 'EMAIL_DELIVERY_FAILED', message: 'Could not send the verification email right now.' }
		});
	}
});

authRouter.get('/me', requireAuth, (req, res) => {
	const row = db
		.prepare('SELECT id, name, email, phone, role, status, email_verified, created_at FROM users WHERE id = ?')
		.get(req.user!.id);
	res.json({ user: toPublicUser(row as Parameters<typeof toPublicUser>[0]) });
});
