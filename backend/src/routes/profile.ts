import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { normalizePhone, canVerify } from '../lib/phone';
import { issueOtp, verifyOtp, assertOtpSendAllowed, assertOtpVerifyAllowed } from '../lib/otp';
import { verifyMtn } from '../lib/mtn';
import { verifySafaricom } from '../lib/daraja';
import { sendSms } from '../lib/sms';
import type { Role } from '../types';

export const profileRouter = Router();

// `phone` is deliberately absent: changing it goes through the OTP flow below,
// so a number can never be attached to an account without being proven. Zod
// strips unknown keys, so an old client sending { phone } silently changes only
// the name rather than writing an unverified number.
const patchSchema = z.object({
	name: z.string().min(2).max(80).optional()
});

const phoneChangeSchema = z.object({ phone: z.string().min(8).max(20) });
const phoneConfirmSchema = z.object({
	phone: z.string().min(8).max(20),
	code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code.')
});

profileRouter.use(requireAuth);

profileRouter.get('/', async (req, res) => {
	const user = (await db
		.prepare(
			'SELECT id, name, email, phone, role, status, email_verified, phone_verified, created_at FROM users WHERE id = ?'
		)
		.get(req.user!.id)) as Record<string, unknown>;
	const driver = (await db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(req.user!.id)) as
		| Record<string, unknown>
		| undefined;

	res.json({
		profile: {
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			role: user.role,
			status: user.status,
			emailVerified: user.email_verified === 1,
			phoneVerified: user.phone_verified === 1,
			createdAt: user.created_at,
			driver: driver
				? {
						association: driver.association,
						vehicleClassId: driver.vehicle_class_id,
						verified: driver.verified === 1,
						rating: driver.rating,
						online: driver.online === 1
					}
				: null
		}
	});
});

profileRouter.patch('/', async (req, res) => {
	const body = patchSchema.parse(req.body);
	if (body.name !== undefined) {
		await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name.trim(), req.user!.id);
	}
	res.json({ message: 'Profile updated.' });
});

/**
 * Step 1 of changing the account's phone number: text a code to the NEW number.
 *
 * Nothing is written until the code comes back. A direct write would let anyone
 * point their account at a number they do not hold — which both keeps a
 * "Verified" badge on an unproven number and, because users.phone is UNIQUE,
 * squats that number so its real owner can never sign up.
 */
profileRouter.post('/phone', async (req, res) => {
	const body = phoneChangeSchema.parse(req.body);
	const phone = normalizePhone(body.phone);

	const current = (await db.prepare('SELECT phone, role FROM users WHERE id = ?').get(req.user!.id)) as {
		phone: string | null;
		role: Role;
	};
	if (current.phone === phone.e164) {
		throw err.badRequest('That is already your phone number.', 'PHONE_UNCHANGED');
	}

	const taken = await db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone.e164, req.user!.id);
	if (taken) throw err.conflict('That phone number is already in use.', 'PHONE_TAKEN');

	assertOtpSendAllowed(phone.e164, req.ip ?? 'unknown');

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

	// Bound to this account: only the user who asked can redeem it, and it is
	// rejected by the sign-in verifier.
	const otpRole = current.role === 'driver' ? 'driver' : 'tourist';
	const { code, expiresAt } = await issueOtp(phone.e164, otpRole, req.user!.id);
	await sendSms(
		phone.e164,
		`Your SipiRider verification code is ${code}. It expires in ${config.otp.ttlMin} minutes. Never share it with anyone.`
	);

	res.json({
		message: 'We sent a 6-digit code to the new number.',
		phone: phone.e164,
		expiresAt: expiresAt.toISOString(),
		expiresInSeconds: config.otp.ttlMin * 60,
		...(config.phoneMock ? { devCode: code } : {})
	});
});

/** Step 2: confirm the code, then save the number as verified. */
profileRouter.post('/phone/verify', async (req, res) => {
	const body = phoneConfirmSchema.parse(req.body);
	const phone = normalizePhone(body.phone);
	assertOtpVerifyAllowed(phone.e164);

	const result = await verifyOtp(phone.e164, body.code);
	if (!result.ok) {
		switch (result.reason) {
			case 'NO_CODE':
				throw err.badRequest('Request a new code to continue.', 'OTP_NOT_FOUND');
			case 'EXPIRED':
				throw err.badRequest('That code has expired. Request a new one.', 'OTP_EXPIRED');
			case 'TOO_MANY_ATTEMPTS':
				throw err.rateLimited('Too many incorrect attempts. Request a new code.');
			default:
				throw err.badRequest(
					`Incorrect code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`,
					'OTP_INVALID'
				);
		}
	}

	// The challenge must belong to this session — a sign-in code (user_id NULL)
	// or another account's code cannot be used to claim a number here.
	if (result.userId !== req.user!.id) {
		throw err.badRequest('Request a new code to continue.', 'OTP_NOT_FOUND');
	}

	// Re-check: the number may have been claimed while the code was in flight.
	const taken = await db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone.e164, req.user!.id);
	if (taken) throw err.conflict('That phone number is already in use.', 'PHONE_TAKEN');

	await db.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?').run(phone.e164, req.user!.id);
	res.json({ message: 'Phone number updated.', phone: phone.e164, phoneVerified: true });
});
