import net from 'node:net';
import { Pool, type QueryResultRow } from 'pg';
import { hashPassword } from './lib/password';
import { config } from './config';

// Neon's DNS answers include unreachable IPv6 records, and the default 250ms
// Happy Eyeballs window is too short for high-latency links: Node aborts
// before the IPv4 TCP handshake finishes. Give each attempt more time.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

export const pool = new Pool({
	connectionString: config.databaseUrl,
	ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined
});

/** Converts the SQLite-style `?` placeholders used across the app to `$1..$n`. */
function toPg(sql: string): string {
	let index = 0;
	return sql.replace(/\?/g, () => `$${++index}`).replace(/datetime\('now'\)/g, 'now()');
}

export async function query<T extends QueryResultRow = QueryResultRow>(
	sql: string,
	params: unknown[] = []
): Promise<T[]> {
	const result = await pool.query<T>(toPg(sql), params);
	return result.rows;
}

interface RunResult {
	changes: number;
	lastInsertRowid: number | null;
}

/**
 * Thin compatibility wrapper so the route code can stay close to its previous
 * shape. Queries are asynchronous: every call must be awaited.
 */
export const db = {
	prepare(sql: string) {
		const text = toPg(sql);
		const returning =
			/^\s*insert\s/i.test(sql) && !/\breturning\b/i.test(sql) ? `${text} RETURNING id` : text;
		return {
			async get(...params: unknown[]) {
				const result = await pool.query(text, params);
				return result.rows[0];
			},
			async all(...params: unknown[]) {
				const result = await pool.query(text, params);
				return result.rows;
			},
			async run(...params: unknown[]): Promise<RunResult> {
				const result = await pool.query(returning, params);
				return {
					changes: result.rowCount ?? 0,
					lastInsertRowid: (result.rows[0]?.id as number | undefined) ?? null
				};
			}
		};
	},
	async exec(sql: string) {
		await pool.query(toPg(sql));
	}
};

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT UNIQUE,
	phone TEXT UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('tourist','driver','admin')),
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
	email_verified INTEGER NOT NULL DEFAULT 0,
	phone_verified INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time phone codes. Keyed by phone rather than user_id because the
-- account may not exist yet (phone login is find-or-create). Codes are stored
-- as a bcrypt hash bound to the phone number, are single-use, and carry the
-- requested role so a client cannot escalate between the start and verify
-- steps. The attempts counter caps brute-forcing of the 6-digit space.
-- user_id is NULL for login codes and set for profile phone-change codes,
-- where the challenge belongs to an already-signed-in account.
CREATE TABLE IF NOT EXISTS phone_otps (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	phone TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('tourist','driver')),
	user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
	attempts INTEGER NOT NULL DEFAULT 0,
	expires_at TIMESTAMPTZ NOT NULL,
	used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_classes (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	multiplier DOUBLE PRECISION NOT NULL,
	seats TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	currency TEXT NOT NULL DEFAULT 'USD',
	base_fare DOUBLE PRECISION NOT NULL,
	per_km DOUBLE PRECISION NOT NULL,
	per_minute DOUBLE PRECISION NOT NULL,
	booking_fee DOUBLE PRECISION NOT NULL,
	surge_multiplier DOUBLE PRECISION NOT NULL,
	minimum_fare DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	association TEXT,
	vehicle_class_id TEXT REFERENCES vehicle_classes(id),
	verified INTEGER NOT NULL DEFAULT 0,
	rating DOUBLE PRECISION NOT NULL DEFAULT 0,
	online INTEGER NOT NULL DEFAULT 0,
	online_at TIMESTAMPTZ,
	online_seconds INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id),
	driver_id INTEGER REFERENCES users(id),
	vehicle_class_id TEXT NOT NULL REFERENCES vehicle_classes(id),
	pickup TEXT NOT NULL,
	destination TEXT NOT NULL,
	pickup_lat DOUBLE PRECISION,
	pickup_lng DOUBLE PRECISION,
	dest_lat DOUBLE PRECISION,
	dest_lng DOUBLE PRECISION,
	distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
	duration_min DOUBLE PRECISION NOT NULL DEFAULT 0,
	estimated_fare DOUBLE PRECISION NOT NULL,
	status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching','active','completed','cancelled')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_a INTEGER NOT NULL REFERENCES users(id),
	user_b INTEGER NOT NULL REFERENCES users(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	sender_id INTEGER NOT NULL REFERENCES users(id),
	body TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone);
CREATE INDEX IF NOT EXISTS idx_rides_user ON rides(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
`;

async function migrate() {
	// Additive changes kept for databases created by earlier builds.
	await pool.query(
		'ALTER TABLE phone_otps ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE'
	);
	await pool.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
	await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified INTEGER NOT NULL DEFAULT 0');
	await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION');
	await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION');
	await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION');
	await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION');
}

async function seed() {
	const [{ c }] = await query<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
	if (c > 0) return;

	const insertUser = async (
		name: string,
		email: string,
		phone: string,
		password: string,
		role: string,
		status: string,
		verified: number
	) => {
		const [row] = await query<{ id: number }>(
			`INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, phone_verified)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING id`,
			[name, email, phone, hashPassword(password), role, status, verified]
		);
		return row.id;
	};

	const admin = await insertUser('SipiRider Admin', 'admin@sipirider.com', '+256700000001', 'admin1234', 'admin', 'active', 1);
	const tourist = await insertUser('Amara Boateng', 'tourist@sipirider.com', '+256700000002', 'tourist1234', 'tourist', 'active', 1);
	await insertUser('David Kim', 'david@sipirider.com', '+256700000003', 'tourist1234', 'tourist', 'active', 1);
	await insertUser('John Ochieng', 'john@sipirider.com', '+256700000004', 'tourist1234', 'tourist', 'pending', 1);
	const peter = await insertUser('Peter Okello', 'driver@sipirider.com', '+256700111222', 'driver1234', 'driver', 'active', 1);
	const joseph = await insertUser('Joseph Mwangi', 'joseph@sipirider.com', '+256700333444', 'driver1234', 'driver', 'active', 1);
	const grace = await insertUser('Grace Alupo', 'grace@sipirider.com', '+256700555666', 'driver1234', 'driver', 'active', 0);
	const sarah = await insertUser('Sarah Nakato', 'sarah@sipirider.com', '+256700777888', 'driver1234', 'driver', 'pending', 1);

	await query(
		`INSERT INTO vehicle_classes (id, name, multiplier, seats) VALUES
		 ('car', 'Car / SUV', 1, 'Up to 4 seats'),
		 ('van', 'Van / Minibus', 1.25, '9-14 seats'),
		 ('coach', 'Coach bus', 1.6, '15+ seats'),
		 ('truck', 'Truck / 4x4 cargo', 1.8, 'Heavy load')`
	);

	await query(
		`INSERT INTO pricing (id, currency, base_fare, per_km, per_minute, booking_fee, surge_multiplier, minimum_fare)
		 VALUES (1, 'USD', 3, 1.2, 0.15, 1, 1, 5)`
	);

	const insertDriver = (userId: number, association: string, vehicleClassId: string, verified: number, rating: number) =>
		query(
			`INSERT INTO drivers (user_id, association, vehicle_class_id, verified, rating, online)
			 VALUES ($1, $2, $3, $4, $5, 0)`,
			[userId, association, vehicleClassId, verified, rating]
		);
	await insertDriver(peter, 'Mbale Highway Drivers Group', 'van', 1, 4.7);
	await insertDriver(joseph, 'Kampala Tourist Taxis Assoc.', 'car', 1, 4.9);
	await insertDriver(grace, 'Entebbe Airport Drivers Union', 'coach', 0, 4.8);
	await insertDriver(sarah, '', 'car', 0, 0);

	await query(
		`INSERT INTO rides (user_id, driver_id, vehicle_class_id, pickup, destination, distance_km, duration_min, estimated_fare, status, created_at, updated_at)
		 VALUES ($1, $2, 'van', 'Sheraton Kampala Hotel', 'Entebbe Airport Arrivals', 41, 62, 58.17, 'completed', now() - interval '5 hours', now())`,
		[tourist, peter]
	);
	await query(
		`INSERT INTO rides (user_id, driver_id, vehicle_class_id, pickup, destination, distance_km, duration_min, estimated_fare, status)
		 VALUES ($1, NULL, 'car', 'Sheraton Kampala Hotel', 'Kampala District Exploration', 12, 30, 46.34, 'searching')`,
		[tourist]
	);

	const [convo] = await query<{ id: number }>(
		'INSERT INTO conversations (user_a, user_b) VALUES ($1, $2) RETURNING id',
		[tourist, peter]
	);
	await query(
		'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3), ($1, $4, $5)',
		[convo.id, peter, 'Hello Amara! I can pick you up at the Sheraton in 20 minutes.', tourist, 'Perfect, thank you Peter.']
	);

	console.log(`[db] Seeded demo data (admin #${admin}).`);
}

/**
 * Creates the schema and optionally seeds demo data. Must be awaited before
 * serving requests.
 */
export async function initDb(): Promise<void> {
	if (!config.databaseUrl) {
		throw new Error(
			'DATABASE_URL is not set. Add your PostgreSQL connection string to the .env file.'
		);
	}
	await pool.query(schema);
	await migrate();

	// Demo data is opt-in, never inferred. Seeding a real database would create
	// a known-password admin (admin@sipirider.com / admin1234) plus seven fake
	// accounts, so it requires an explicit ALLOW_SEED=true rather than keying
	// off NODE_ENV — which can silently differ between the server process and a
	// one-off `npm run create-admin` in another shell.
	if (config.allowSeed) {
		await seed();
	} else {
		const [{ c }] = await query<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
		if (c === 0) {
			console.log(
				'[db] Empty database and ALLOW_SEED is not "true" — skipping demo seed.\n' +
					'[db]   production: npm run create-admin -- --email <you> --name "<name>"\n' +
					'[db]   local dev:  set ALLOW_SEED=true to load demo users, drivers and rides'
			);
		}
	}
}
