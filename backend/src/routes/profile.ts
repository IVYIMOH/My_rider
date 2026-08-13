import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

export const profileRouter = Router();

const patchSchema = z.object({
	name: z.string().min(2).max(80).optional(),
	phone: z.string().min(7).max(30).optional()
});

profileRouter.use(requireAuth);

profileRouter.get('/', (req, res) => {
	const user = db
		.prepare('SELECT id, name, email, phone, role, status, email_verified, created_at FROM users WHERE id = ?')
		.get(req.user!.id) as Record<string, unknown>;
	const driver = db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(req.user!.id) as
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

profileRouter.patch('/', (req, res) => {
	const body = patchSchema.parse(req.body);
	if (body.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.name.trim(), req.user!.id);
	if (body.phone !== undefined) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(body.phone.trim(), req.user!.id);
	res.json({ message: 'Profile updated.' });
});
