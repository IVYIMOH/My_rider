import { config, isProduction } from '../config';

/**
 * Posts to a generic JSON SMS gateway.
 *
 * This is deliberately a thin, provider-agnostic shape — adapt the body and
 * headers to whichever gateway you contract with (Africa's Talking, Twilio,
 * MTN SMS, Safaricom). The important part for the rest of the app is the
 * sendSms() contract: it resolves on success and throws on failure.
 */
async function sendViaGateway(to: string, body: string): Promise<void> {
	const res = await fetch(config.sms.gatewayUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(config.sms.apiKey ? { Authorization: `Bearer ${config.sms.apiKey}` } : {})
		},
		body: JSON.stringify({ to, from: config.sms.sender, message: body })
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`SMS gateway responded ${res.status}: ${detail.slice(0, 200)}`);
	}
}

/**
 * Sends an SMS. With no gateway configured it prints to the server console,
 * which is how login codes are surfaced in development — mirroring the dev
 * outbox in mailer.ts. In production an unconfigured gateway is a hard error
 * rather than a silent console write, because silently "sending" login codes
 * to a log file would lock every real user out.
 */
export async function sendSms(to: string, body: string): Promise<void> {
	if (!config.sms.gatewayUrl) {
		if (isProduction) {
			throw new Error(
				'SMS_GATEWAY_URL is not configured — cannot deliver login codes in production. ' +
					'Configure an SMS provider in src/lib/sms.ts, or set PHONE_MOCK=true for a non-production environment.'
			);
		}
		console.log('\n---[DEV SMS OUTBOX]---');
		console.log(`To: ${to}`);
		console.log(body);
		console.log('----------------------\n');
		return;
	}

	try {
		await sendViaGateway(to, body);
		console.log(`[sms] login code sent to ${to}`);
	} catch (error) {
		console.error(`[sms] failed to send to ${to}:`, error);
		throw error;
	}
}
