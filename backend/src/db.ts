import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { hashPassword } from './lib/password';
import { config } from './config';

const dbPath = resolve(config.dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	email TEXT UNIQUE,
	phone TEXT UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('tourist','driver','admin')),
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
	email_verified INTEGER NOT NULL DEFAULT 0,
	phone_verified INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification_tokens (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	used_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time phone codes. Keyed by phone rather than user_id because the
-- account may not exist yet (phone login is find-or-create). Codes are stored
-- as a bcrypt hash bound to the phone number, are single-use, and carry the
-- requested role so a client cannot escalate between the start and verify
-- steps. The attempts counter caps brute-forcing of the 6-digit space.
-- user_id is NULL for login codes and set for profile phone-change codes,
-- where the challenge belongs to an already-signed-in account.
CREATE TABLE IF NOT EXISTS phone_otps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	phone TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('tourist','driver')),
	user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
	attempts INTEGER NOT NULL DEFAULT 0,
	expires_at TEXT NOT NULL,
	used_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicle_classes (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	multiplier REAL NOT NULL,
	seats TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	currency TEXT NOT NULL DEFAULT 'USD',
	base_fare REAL NOT NULL,
	per_km REAL NOT NULL,
	per_minute REAL NOT NULL,
	booking_fee REAL NOT NULL,
	surge_multiplier REAL NOT NULL,
	minimum_fare REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	association TEXT,
	vehicle_class_id TEXT REFERENCES vehicle_classes(id),
	verified INTEGER NOT NULL DEFAULT 0,
	rating REAL NOT NULL DEFAULT 0,
	online INTEGER NOT NULL DEFAULT 0,
	online_at TEXT,
	online_seconds INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rides (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id),
	driver_id INTEGER REFERENCES users(id),
	vehicle_class_id TEXT NOT NULL REFERENCES vehicle_classes(id),
	pickup TEXT NOT NULL,
	destination TEXT NOT NULL,
	distance_km REAL NOT NULL DEFAULT 0,
	duration_min REAL NOT NULL DEFAULT 0,
	estimated_fare REAL NOT NULL,
	status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching','active','completed','cancelled')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_a INTEGER NOT NULL REFERENCES users(id),
	user_b INTEGER NOT NULL REFERENCES users(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	sender_id INTEGER NOT NULL REFERENCES users(id),
	body TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone);
CREATE INDEX IF NOT EXISTS idx_rides_user ON rides(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
`);

// Migration: phone_otps.user_id was added after the table shipped, to support
// re-verifying a phone number from the profile screen. Additive and nullable,
// so a plain ALTER is enough.
const otpColumns = db.prepare('PRAGMA table_info(phone_otps)').all() as Array<{ name: string }>;
if (!otpColumns.some((c) => c.name === 'user_id')) {
	db.exec('ALTER TABLE phone_otps ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
}

// Migration: phone-first identity. Pre-existing databases have email NOT NULL
// (and may lack phone_verified). Rebuild users to allow email-less phone-only
// accounts and track phone verification, preserving row ids so foreign keys
// from other tables keep resolving.
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string; notnull: number }>;
const emailColumn = userColumns.find((c) => c.name === 'email');
if (emailColumn && emailColumn.notnull === 1) {
	db.pragma('foreign_keys = OFF');
	const rebuild = db.transaction(() => {
		db.exec(`
			CREATE TABLE users_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT UNIQUE,
				phone TEXT UNIQUE,
				password_hash TEXT NOT NULL,
				role TEXT NOT NULL CHECK (role IN ('tourist','driver','admin')),
				status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
				email_verified INTEGER NOT NULL DEFAULT 0,
				phone_verified INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			INSERT INTO users_new (id, name, email, phone, password_hash, role, status, email_verified, phone_verified, created_at)
				SELECT id, name, email, phone, password_hash, role, status, email_verified, COALESCE(phone_verified, 0), created_at FROM users;
			DROP TABLE users;
			ALTER TABLE users_new RENAME TO users;
		`);
	});
	rebuild();
	db.pragma('foreign_keys = ON');
}

function seed() {
	const hasUsers = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c > 0;
	if (hasUsers) return;

	const insertUser = db.prepare(
		`INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, phone_verified)
		 VALUES (@name, @email, @phone, @passwordHash, @role, @status, @emailVerified, @phoneVerified)`
	);

	const userIds: Record<string, number> = {};
	const user = (key: string, name: string, email: string, phone: string, password: string, role: string, status: string, verified: number) => {
		const info = insertUser.run({
			name,
			email,
			phone,
			passwordHash: hashPassword(password),
			role,
			status,
			emailVerified: verified,
			phoneVerified: 1
		});
		userIds[key] = Number(info.lastInsertRowid);
	};

	user('admin', 'SipiRider Admin', 'admin@sipirider.com', '+256700000001', 'admin1234', 'admin', 'active', 1);
	user('tourist', 'Amara Boateng', 'tourist@sipirider.com', '+256700000002', 'tourist1234', 'tourist', 'active', 1);
	user('david', 'David Kim', 'david@sipirider.com', '+256700000003', 'tourist1234', 'tourist', 'active', 1);
	user('john', 'John Ochieng', 'john@sipirider.com', '+256700000004', 'tourist1234', 'tourist', 'pending', 1);
	user('peter', 'Peter Okello', 'driver@sipirider.com', '+256700111222', 'driver1234', 'driver', 'active', 1);
	user('joseph', 'Joseph Mwangi', 'joseph@sipirider.com', '+256700333444', 'driver1234', 'driver', 'active', 1);
	user('grace', 'Grace Alupo', 'grace@sipirider.com', '+256700555666', 'driver1234', 'driver', 'active', 0);
	user('sarah', 'Sarah Nakato', 'sarah@sipirider.com', '+256700777888', 'driver1234', 'driver', 'pending', 1);

	const insertVc = db.prepare('INSERT INTO vehicle_classes (id, name, multiplier, seats) VALUES (@id, @name, @multiplier, @seats)');
	insertVc.run({ id: 'car', name: 'Car / SUV', multiplier: 1, seats: 'Up to 4 seats' });
	insertVc.run({ id: 'van', name: 'Van / Minibus', multiplier: 1.25, seats: '9-14 seats' });
	insertVc.run({ id: 'coach', name: 'Coach bus', multiplier: 1.6, seats: '15+ seats' });
	insertVc.run({ id: 'truck', name: 'Truck / 4x4 cargo', multiplier: 1.8, seats: 'Heavy load' });

	db.prepare(
		`INSERT INTO pricing (id, currency, base_fare, per_km, per_minute, booking_fee, surge_multiplier, minimum_fare)
		 VALUES (1, 'USD', 3, 1.2, 0.15, 1, 1, 5)`
	).run();

	const insertDriver = db.prepare(
		`INSERT INTO drivers (user_id, association, vehicle_class_id, verified, rating, online)
		 VALUES (@userId, @association, @vehicleClassId, @verified, @rating, 0)`
	);
	insertDriver.run({ userId: userIds.peter, association: 'Mbale Highway Drivers Group', vehicleClassId: 'van', verified: 1, rating: 4.7 });
	insertDriver.run({ userId: userIds.joseph, association: 'Kampala Tourist Taxis Assoc.', vehicleClassId: 'car', verified: 1, rating: 4.9 });
	insertDriver.run({ userId: userIds.grace, association: 'Entebbe Airport Drivers Union', vehicleClassId: 'coach', verified: 0, rating: 4.8 });
	insertDriver.run({ userId: userIds.sarah, association: '', vehicleClassId: 'car', verified: 0, rating: 0 });

	const insertRide = db.prepare(
		`INSERT INTO rides (user_id, driver_id, vehicle_class_id, pickup, destination, distance_km, duration_min, estimated_fare, status, created_at, updated_at)
		 VALUES (@userId, @driverId, @vehicleClassId, @pickup, @destination, @distanceKm, @durationMin, @fare, @status, datetime('now','-5 hours'), datetime('now'))`
	);
	insertRide.run({
		userId: userIds.tourist,
		driverId: userIds.peter,
		vehicleClassId: 'van',
		pickup: 'Sheraton Kampala Hotel',
		destination: 'Entebbe Airport Arrivals',
		distanceKm: 41,
		durationMin: 62,
		fare: 58.17,
		status: 'completed'
	});
	insertRide.run({
		userId: userIds.tourist,
		driverId: null,
		vehicleClassId: 'car',
		pickup: 'Sheraton Kampala Hotel',
		destination: 'Kampala District Exploration',
		distanceKm: 12,
		durationMin: 30,
		fare: 46.34,
		status: 'searching'
	});

	const insertConvo = db.prepare('INSERT INTO conversations (user_a, user_b) VALUES (@a, @b)');
	const convo = insertConvo.run({ a: userIds.tourist, b: userIds.peter });
	const insertMessage = db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (@convo, @sender, @body)');
	insertMessage.run({ convo: convo.lastInsertRowid, sender: userIds.peter, body: 'Hello Amara! I can pick you up at the Sheraton in 20 minutes.' });
	insertMessage.run({ convo: convo.lastInsertRowid, sender: userIds.tourist, body: 'Perfect, thank you Peter.' });
}

// Demo data is opt-in, never inferred. Seeding a real database would create a
// known-password admin (admin@sipirider.com / admin1234) plus seven fake
// accounts, so it requires an explicit ALLOW_SEED=true rather than keying off
// NODE_ENV — which can silently differ between the server process and a
// one-off `npm run create-admin` in another shell.
if (config.allowSeed) {
	seed();
} else {
	const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
	if (userCount === 0) {
		console.log(
			'[db] Empty database and ALLOW_SEED is not "true" — skipping demo seed.\n' +
				'[db]   production: npm run create-admin -- --email <you> --name "<name>"\n' +
				'[db]   local dev:  set ALLOW_SEED=true to load demo users, drivers and rides'
		);
	}
}
