/**
 * Creates an admin account from the command line.
 *
 * This exists because POST /api/admin/users requires an existing admin JWT —
 * on a fresh database there is nobody to issue one. It is also the right tool
 * for rotating admins on a running deployment without exposing a public
 * signup path.
 *
 *   npm run create-admin -- --email you@example.com --name "Ada Lovelace"
 *
 * The password is read from the ADMIN_PASSWORD environment variable, or
 * generated and printed once if that is unset. It is never taken from argv,
 * where it would land in shell history and the process list.
 */
import { randomBytes } from 'node:crypto';
import { db } from '../src/db';
import { hashPassword } from '../src/lib/password';
import { normalizePhone } from '../src/lib/phone';

function arg(flag: string): string | undefined {
	const i = process.argv.indexOf(flag);
	return i !== -1 ? process.argv[i + 1] : undefined;
}

function fail(message: string): never {
	console.error(`\nError: ${message}\n`);
	console.error('Usage: npm run create-admin -- --email <email> --name <name> [--phone <phone>]');
	console.error('       ADMIN_PASSWORD=<password> npm run create-admin -- --email ... --name ...\n');
	process.exit(1);
}

const email = arg('--email')?.trim().toLowerCase();
const name = arg('--name')?.trim();
const rawPhone = arg('--phone')?.trim();

if (!email) fail('--email is required.');
if (!name || name.length < 2) fail('--name is required (at least 2 characters).');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" is not a valid email address.`);

let phone: string | null = null;
if (rawPhone) {
	try {
		phone = normalizePhone(rawPhone).e164;
	} catch (e) {
		// normalizePhone's ApiError carries the specific reason (bad length,
		// unknown operator, or ambiguous without a country code).
		fail(`--phone "${rawPhone}": ${(e as Error).message}`);
	}
}

if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
	fail(`An account already exists for ${email}.`);
}
if (phone && db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) {
	fail(`An account already exists for ${phone}.`);
}

const envPassword = process.env.ADMIN_PASSWORD;
if (envPassword && envPassword.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters.');
const generated = !envPassword;
const password = envPassword ?? randomBytes(18).toString('base64url');

const info = db
	.prepare(
		`INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, phone_verified)
		 VALUES (?, ?, ?, ?, 'admin', 'active', 1, 0)`
	)
	.run(name, email, phone, hashPassword(password));

console.log(`\n✔ Created admin #${info.lastInsertRowid} <${email}>`);
if (generated) {
	console.log(`\n  Generated password: ${password}`);
	console.log('  Store it in a password manager now — it is not recoverable.\n');
} else {
	console.log('  Password taken from ADMIN_PASSWORD.\n');
}
console.log('  Sign in at the admin console with this email and password.\n');
