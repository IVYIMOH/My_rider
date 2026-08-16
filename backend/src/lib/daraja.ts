import { constants, publicEncrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from '../config';
import { err } from '../errors';

interface TokenCache {
	token: string;
	expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
	if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
	if (!config.daraja.consumerKey || !config.daraja.consumerSecret) {
		throw err.badRequest('Daraja credentials are not configured.', 'CONFIG_MISSING');
	}

	const res = await fetch(config.daraja.tokenUrl, {
		headers: {
			Authorization: 'Basic ' + Buffer.from(`${config.daraja.consumerKey}:${config.daraja.consumerSecret}`).toString('base64')
		}
	});
	const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
	if (!res.ok || !data?.access_token) {
		throw new Error(`Daraja token request failed (${res.status}): ${JSON.stringify(data)}`);
	}
	tokenCache = {
		token: data.access_token,
		expiresAt: Date.now() + Math.max((data.expires_in ?? 3600) - 60, 60) * 1000
	};
	return tokenCache.token;
}

/** RSA-encrypts the initiator password with the M-Pesa public certificate. */
function buildSecurityCredential(password: string): string {
	if (!config.daraja.publicCert) {
		throw err.badRequest('DARAJA_PUBLIC_CERT is not configured.', 'CONFIG_MISSING');
	}
	const cert = readFileSync(config.daraja.publicCert);
	const encrypted = publicEncrypt({ key: cert, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(password));
	return encrypted.toString('base64');
}

/** queryCustomerDetails: HTTP 200 with ResponseCode "0" means the customer is registered. */
function interpret(raw: unknown, status: number): boolean {
	if (status !== 200) return false;
	const body = raw as Record<string, unknown> | null;
	if (!body) return false;
	const code = body.ResponseCode ?? body.responseCode;
	return code === '0' || code === 0;
}

/**
 * Verifies a number is a registered M-Pesa (Safaricom) customer via Daraja's
 * Query Customer Details API. Returns the raw provider response for tuning.
 */
export async function verifySafaricom(phoneInternational: string): Promise<{ valid: boolean; raw: unknown }> {
	if (!config.daraja.shortcode) throw err.badRequest('DARAJA_SHORTCODE is not configured.', 'CONFIG_MISSING');
	if (!config.daraja.initiatorName) throw err.badRequest('DARAJA_INITIATOR_NAME is not configured.', 'CONFIG_MISSING');
	if (!config.daraja.initiatorPassword) {
		throw err.badRequest('DARAJA_INITIATOR_PASSWORD is not configured.', 'CONFIG_MISSING');
	}

	const token = await getAccessToken();
	const payload = {
		Initiator: config.daraja.initiatorName,
		SecurityCredential: buildSecurityCredential(config.daraja.initiatorPassword),
		CommandID: 'CustomerPayBillOnline',
		PartyA: config.daraja.shortcode,
		IdentifierType: '4',
		Remarks: 'SipiRider customer verification',
		PartyB: phoneInternational
	};

	const res = await fetch(config.daraja.queryUrl, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const raw = (await res.json().catch(() => null)) as unknown;
	if (!res.ok) {
		throw new Error(`Daraja lookup failed (${res.status}): ${JSON.stringify(raw)}`);
	}
	return { valid: interpret(raw, res.status), raw };
}
