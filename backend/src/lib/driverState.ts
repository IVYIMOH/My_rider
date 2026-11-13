import { db } from '../db';

/** A row of the drivers table, as stored. */
export interface DriverRow {
	id: number;
	user_id: number;
	association: string | null;
	vehicle_class_id: string | null;
	verified: number;
	rating: number;
	online: number;
	online_at: string | Date | null;
	online_seconds: number;
}

export async function getDriverByUserId(userId: number): Promise<DriverRow | undefined> {
	return (await db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(userId)) as DriverRow | undefined;
}

/** By drivers.id — what the admin panel addresses drivers by. */
export async function getDriverById(id: number): Promise<DriverRow | undefined> {
	return (await db.prepare('SELECT * FROM drivers WHERE id = ?').get(id)) as DriverRow | undefined;
}

/** Banked online time plus the stretch currently in progress, if any. */
export function computeOnlineSeconds(row: DriverRow): number {
	let seconds = row.online_seconds;
	if (row.online && row.online_at) {
		const started = new Date(row.online_at).getTime();
		seconds += Math.floor((Date.now() - started) / 1000);
	}
	return seconds;
}

/**
 * Takes a driver offline, banking the time they were online. Safe to call when
 * they are already offline.
 */
export async function goOffline(row: DriverRow): Promise<void> {
	if (row.online !== 1) return;
	const delta = computeOnlineSeconds(row) - row.online_seconds;
	await db.prepare(
		'UPDATE drivers SET online = 0, online_at = NULL, online_seconds = online_seconds + ? WHERE id = ?'
	).run(delta, row.id);
}

/**
 * Withdraws a driver's verification and takes them offline, in that order.
 *
 * Both halves matter, which is why this is one function rather than a bare
 * `UPDATE drivers SET verified = 0`. requireActiveDriver() checks verified
 * before online, so a driver left at online = 1 while verified = 0 is stopped
 * at the ride gates but still reads as online everywhere else — to themselves
 * in the driver UI, and to anything that reports on the column — and the
 * stretch they were online for is never banked into online_seconds.
 *
 * Every path that withdraws verification goes through here: the self-service
 * association/vehicle-class change and re-submitted onboarding in
 * routes/drivers.ts, and the admin panel in routes/admin.ts.
 *
 * goOffline() runs unconditionally rather than only when verified = 1, so a row
 * already left inconsistent by an earlier build is repaired on the way through
 * instead of being carried forward.
 */
export async function revokeVerification(row: DriverRow, reason: string): Promise<void> {
	await goOffline(row);
	if (row.verified !== 1) return;
	await db.prepare('UPDATE drivers SET verified = 0 WHERE id = ?').run(row.id);
	console.log(`[drivers] driver #${row.id} verification revoked (${reason}) — needs re-review`);
}
