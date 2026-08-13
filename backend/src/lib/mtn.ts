import { config } from '../config';
import { err } from '../errors';

interface TokenCache {
	token: string;
	expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
	if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
	if (!config.mtn.clientId || !config.mtn.clientSecret) {
		throw err.badRequest('MTN credentials are not configured.', 'CONFIG_MISSING');
	}
	if (!config.mtn.tokenUrl) {
		throw err.badRequest('MTN_TOKEN_URL is not configured.', 'CONFIG_MISSING');
	}

	const body = new URLSearchParams({ grant_type: 'client_credentials' });
	const res = await fetch(config.mtn.tokenUrl, {
		method: 'POST',
		headers: {
			Authorization: 'Basic ' + Buffer.from(`${config.mtn.clientId}:${config.mtn.clientSecret}`).toString('base64'),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	});
	const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
	if (!res.ok || !data?.access_token) {
		throw new Error(`MTN token request failed (${res.status}): ${JSON.stringify(data)}`);
	}
	tokenCache = {
		token: data.access_token,
		expiresAt: Date.now() + Math.max((data.expires_in ?? 3600) - 60, 60) * 1000
	};
	return tokenCache.token;
}

function buildUrl(phoneE164: string): string {
	if (!config.mtn.verifyUrl) throw err.badRequest('MTN_VERIFY_URL is not configured.', 'CONFIG_MISSING');
	return config.mtn.verifyUrl.replaceAll('{msisdn}', encodeURIComponent(phoneE164));
}

/** Interprets common MTN responses. HTTP 2xx with no error body usually means active. */
function interpret(raw: unknown, status: number): boolean {
	if (status >= 200 && status < 300) {
		const body = raw as Record<string, unknown> | null;
		if (!body) return true;
		const errCode = body.errorCode ?? body.code ?? body.statusCode;
		if (errCode !== undefined && errCode !== 0 && String(errCode) !== '0') return false;
		const state = body.status ?? body.state ?? body.subscriberStatus;
		if (typeof state === 'string') return /active|registered|enabled/i.test(state);
		return true;
	}
	return false;
}

/**
 * Verifies an MSISDN is registered with MTN. Supports either the OAuth
 * client-credentials flow or a plain subscription-key lookup, depending on
 * which credentials are configured. Returns the raw provider response so
 * response parsing can be tuned against real data.
 */
export async function verifyMtn(phoneE164: string): Promise<{ valid: boolean; raw: unknown }> {
	const url = buildUrl(phoneE164);

	let headers: Record<string, string> = { Accept: 'application/json' };
	if (config.mtn.subscriptionKey) {
		headers['Ocp-Apim-Subscription-Key'] = config.mtn.subscriptionKey;
	} else {
		headers['Authorization'] = `Bearer ${await getAccessToken()}`;
	}

	const res = await fetch(url, { method: 'GET', headers });
	const raw = (await res.json().catch(() => null)) as unknown;
	if (!res.ok && res.status !== 404) {
		throw new Error(`MTN lookup failed (${res.status}): ${JSON.stringify(raw)}`);
	}
	return { valid: interpret(raw, res.status), raw };
}
