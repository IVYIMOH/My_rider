import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { requireAuth } from '../middleware/auth';

export const messagesRouter = Router();

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const sendSchema = z.object({ body: z.string().min(1).max(2000) });
const startSchema = z.object({ recipientId: z.number().int().positive(), body: z.string().min(1).max(2000) });

async function findConversation(a: number, b: number): Promise<{ id: number } | undefined> {
	return (await db
		.prepare('SELECT * FROM conversations WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)')
		.get(a, b, b, a)) as { id: number } | undefined;
}

/**
 * True when the two users are the rider and the driver on some ride — past,
 * present, cancelled or completed. This is the relationship that entitles them
 * to message each other.
 *
 * Existence of the recipient is NOT a relationship: without this check any
 * signed-in account could walk the sequential user ids and open a thread with
 * every rider on the platform.
 */
async function shareARide(a: number, b: number): Promise<boolean> {
	const row = await db
		.prepare(
			`SELECT 1 FROM rides
			 WHERE (user_id = ? AND driver_id = ?) OR (user_id = ? AND driver_id = ?)
			 LIMIT 1`
		)
		.get(a, b, b, a);
	return !!row;
}

function noSharedRide() {
	return err.forbidden('You can only message a driver or rider you share a trip with.', 'NO_SHARED_RIDE');
}

/**
 * The gate for an existing thread. Membership is necessary but not sufficient:
 * the ride relationship is re-checked on every read and every write, so a
 * thread does not stay usable on the strength of having once been created.
 *
 * Membership is checked first on purpose, so a stranger probing thread ids
 * cannot tell "you are not on this thread" apart from "you are, but you no
 * longer share a ride" — the second answer would confirm the thread exists.
 *
 * Pre-existing threads with no qualifying ride are NOT grandfathered. Any that
 * exist were opened before this check covered thread creation, which is exactly
 * the access F2 was about, so honouring them would preserve the finding rather
 * than close it. They are left in the database rather than deleted — an admin
 * investigating harassment still needs the history — but they are unreachable
 * through the API and hidden from the thread list below.
 */
async function assertThreadAccess(convoId: number, userId: number): Promise<void> {
	const row = (await db
		.prepare('SELECT user_a, user_b FROM conversations WHERE id = ?')
		.get(convoId)) as { user_a: number; user_b: number } | undefined;
	if (!row) throw err.notFound('Conversation not found.');
	if (row.user_a !== userId && row.user_b !== userId) throw err.forbidden();
	const partnerId = row.user_a === userId ? row.user_b : row.user_a;
	if (!(await shareARide(userId, partnerId))) throw noSharedRide();
}

messagesRouter.use(requireAuth);

messagesRouter.get('/', async (req, res) => {
	const rows = (await db
		.prepare(
			`SELECT c.id, c.user_a, c.user_b, u_a.name AS a_name, u_b.name AS b_name,
			        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
			 FROM conversations c
			 JOIN users u_a ON u_a.id = c.user_a
			 JOIN users u_b ON u_b.id = c.user_b
			 WHERE c.user_a = ? OR c.user_b = ?
			 ORDER BY c.id DESC`
		)
		.all(req.user!.id, req.user!.id)) as Array<Record<string, unknown>>;

	// Same ride requirement as every other path here. Filtered in JS rather
	// than as a SQL EXISTS so shareARide() stays the single definition of the
	// relationship and cannot drift from a copy.
	const conversations = (
		await Promise.all(
			rows.map(async (r) => {
				const partnerId = (r.user_a === req.user!.id ? r.user_b : r.user_a) as number;
				if (!(await shareARide(req.user!.id, partnerId))) return null;
				const partnerName = r.user_a === req.user!.id ? r.b_name : r.a_name;
				return {
					id: r.id,
					partnerId,
					partnerName,
					lastMessage: r.last_message ?? null
				};
			})
		)
	).filter((c) => c !== null);

	res.json({ conversations });
});

messagesRouter.get('/:id', async (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	await assertThreadAccess(id, req.user!.id);
	const messages = await db
		.prepare(
			`SELECT m.id, m.sender_id, u.name AS sender_name, m.body, m.created_at
			 FROM messages m JOIN users u ON u.id = m.sender_id
			 WHERE m.conversation_id = ? ORDER BY m.id`
		)
		.all(id);
	res.json({ messages });
});

messagesRouter.post('/:id', async (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	const body = sendSchema.parse(req.body);
	await assertThreadAccess(id, req.user!.id);
	const info = await db
		.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
		.run(id, req.user!.id, body.body.trim());
	const message = await db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
	res.status(201).json({ message });
});

messagesRouter.post('/', async (req, res) => {
	const body = startSchema.parse(req.body);
	const recipient = await db.prepare('SELECT id FROM users WHERE id = ?').get(body.recipientId);
	if (!recipient) throw err.notFound('Recipient not found.');
	if (body.recipientId === req.user!.id) throw err.badRequest('You cannot message yourself.');

	// Checked before find-or-create, not only before create, so re-opening an
	// existing thread is gated too. This is one of four places the check runs:
	// GET / filters on it, and GET /:id and POST /:id re-check it per request
	// via assertThreadAccess(), so access cannot outlive the ride relationship.
	if (!(await shareARide(req.user!.id, body.recipientId))) {
		throw noSharedRide();
	}

	let convo = await findConversation(req.user!.id, body.recipientId);
	if (!convo) {
		const created = await db
			.prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)')
			.run(req.user!.id, body.recipientId);
		convo = { id: Number(created.lastInsertRowid) };
	}
	const info = await db
		.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
		.run(convo.id, req.user!.id, body.body.trim());
	res.status(201).json({ conversationId: convo.id, messageId: Number(info.lastInsertRowid) });
});
