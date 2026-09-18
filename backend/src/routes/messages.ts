import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { err } from '../errors';
import { requireAuth } from '../middleware/auth';

export const messagesRouter = Router();

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const sendSchema = z.object({ body: z.string().min(1).max(2000) });
const startSchema = z.object({ recipientId: z.number().int().positive(), body: z.string().min(1).max(2000) });

function findConversation(a: number, b: number) {
	return (
		db
			.prepare('SELECT * FROM conversations WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)')
			.get(a, b, b, a) as { id: number } | undefined
	);
}

function assertParticipant(convoId: number, userId: number): void {
	const row = db
		.prepare('SELECT user_a, user_b FROM conversations WHERE id = ?')
		.get(convoId) as { user_a: number; user_b: number } | undefined;
	if (!row) throw err.notFound('Conversation not found.');
	if (row.user_a !== userId && row.user_b !== userId) throw err.forbidden();
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
function shareARide(a: number, b: number): boolean {
	const row = db
		.prepare(
			`SELECT 1 FROM rides
			 WHERE (user_id = ? AND driver_id = ?) OR (user_id = ? AND driver_id = ?)
			 LIMIT 1`
		)
		.get(a, b, b, a);
	return !!row;
}

messagesRouter.use(requireAuth);

messagesRouter.get('/', (req, res) => {
	const rows = db
		.prepare(
			`SELECT c.id, c.user_a, c.user_b, u_a.name AS a_name, u_b.name AS b_name,
			        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
			 FROM conversations c
			 JOIN users u_a ON u_a.id = c.user_a
			 JOIN users u_b ON u_b.id = c.user_b
			 WHERE c.user_a = ? OR c.user_b = ?
			 ORDER BY c.id DESC`
		)
		.all(req.user!.id, req.user!.id) as Array<Record<string, unknown>>;

	res.json({
		conversations: rows.map((r) => {
			const partnerId = r.user_a === req.user!.id ? r.user_b : r.user_a;
			const partnerName = r.user_a === req.user!.id ? r.b_name : r.a_name;
			return {
				id: r.id,
				partnerId,
				partnerName,
				lastMessage: r.last_message ?? null
			};
		})
	});
});

messagesRouter.get('/:id', (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	assertParticipant(id, req.user!.id);
	const messages = db
		.prepare(
			`SELECT m.id, m.sender_id, u.name AS sender_name, m.body, m.created_at
			 FROM messages m JOIN users u ON u.id = m.sender_id
			 WHERE m.conversation_id = ? ORDER BY m.id`
		)
		.all(id);
	res.json({ messages });
});

messagesRouter.post('/:id', (req, res) => {
	const { id } = idParamSchema.parse(req.params);
	const body = sendSchema.parse(req.body);
	assertParticipant(id, req.user!.id);
	const info = db
		.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
		.run(id, req.user!.id, body.body.trim());
	const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
	res.status(201).json({ message });
});

messagesRouter.post('/', (req, res) => {
	const body = startSchema.parse(req.body);
	const recipient = db.prepare('SELECT id FROM users WHERE id = ?').get(body.recipientId);
	if (!recipient) throw err.notFound('Recipient not found.');
	if (body.recipientId === req.user!.id) throw err.badRequest('You cannot message yourself.');

	// Checked before find-or-create, not only before create: otherwise a thread
	// opened while this endpoint was unguarded could still be posted into.
	if (!shareARide(req.user!.id, body.recipientId)) {
		throw err.forbidden(
			'You can only message a driver or rider you share a trip with.',
			'NO_SHARED_RIDE'
		);
	}

	let convo = findConversation(req.user!.id, body.recipientId);
	if (!convo) {
		const info = db
			.prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)')
			.run(req.user!.id, body.recipientId);
		convo = { id: Number(info.lastInsertRowid) };
	}
	const info = db
		.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
		.run(convo.id, req.user!.id, body.body.trim());
	res.status(201).json({ conversationId: convo.id, messageId: Number(info.lastInsertRowid) });
});
