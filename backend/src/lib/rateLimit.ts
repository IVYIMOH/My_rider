const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the key is within `max` uses per `windowMs`, false otherwise. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = hits.get(key);
	if (!entry || entry.resetAt <= now) {
		hits.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	if (entry.count >= max) return false;
	entry.count += 1;
	return true;
}
