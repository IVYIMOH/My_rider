import 'dotenv/config';

/** The secret that used to ship as the fallback. Never acceptable in production. */
const PLACEHOLDER_JWT_SECRET = 'dev-insecure-secret-change-me';
/** Value from .env.example, equally public and equally unacceptable. */
const EXAMPLE_JWT_SECRET = 'change-this-to-a-random-secret';

export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Resolves the JWT signing secret. In production an unset or publicly-known
 * secret lets anyone forge an admin token, so we refuse to boot instead of
 * starting up in a silently-compromised state. In development we fall back to
 * a fixed secret (so sessions survive restarts) but say so loudly.
 */
function resolveJwtSecret(): string {
	const secret = process.env.JWT_SECRET?.trim();
	const isPlaceholder = secret === PLACEHOLDER_JWT_SECRET || secret === EXAMPLE_JWT_SECRET;

	if (isProduction) {
		if (!secret || isPlaceholder) {
			throw new Error(
				[
					'',
					'FATAL: JWT_SECRET is not set to a real value, and NODE_ENV=production.',
					'',
					secret
						? `  JWT_SECRET is still the placeholder value "${secret}".`
						: '  JWT_SECRET is unset.',
					'',
					'  Anyone who knows this value can mint admin tokens for your API.',
					'  Generate one and set it in the environment before starting:',
					'',
					'      JWT_SECRET=$(openssl rand -hex 32)',
					'',
					'  Refusing to start.',
					''
				].join('\n')
			);
		}
		return secret;
	}

	if (!secret) {
		console.warn(
			'[config] WARNING: JWT_SECRET is unset — using the insecure development default.\n' +
				'[config]          Set JWT_SECRET before deploying (NODE_ENV=production will refuse to boot without it).'
		);
		return PLACEHOLDER_JWT_SECRET;
	}
	if (isPlaceholder) {
		console.warn(
			'[config] WARNING: JWT_SECRET is set to a well-known placeholder value.\n' +
				'[config]          Replace it with `openssl rand -hex 32` output before deploying.'
		);
	}
	return secret;
}

export const config = {
	port: Number(process.env.PORT ?? 8080),
	dbPath: process.env.DB_PATH ?? './sipi.db',
	jwtSecret: resolveJwtSecret(),
	publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5174',
	verifyTokenTtlMin: Number(process.env.VERIFY_TOKEN_TTL_MIN ?? 60),
	smtp: {
		host: process.env.SMTP_HOST ?? '',
		port: Number(process.env.SMTP_PORT ?? 587),
		user: process.env.SMTP_USER ?? '',
		pass: process.env.SMTP_PASS ?? '',
		from: process.env.MAIL_FROM ?? 'SipiRider <no-reply@sipirider.com>'
	},
	mtn: {
		clientId: process.env.MTN_CLIENT_ID ?? '',
		clientSecret: process.env.MTN_CLIENT_SECRET ?? '',
		subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY ?? '',
		tokenUrl: process.env.MTN_TOKEN_URL ?? '',
		verifyUrl: process.env.MTN_VERIFY_URL ?? ''
	},
	daraja: {
		consumerKey: process.env.DARAJA_CONSUMER_KEY ?? '',
		consumerSecret: process.env.DARAJA_CONSUMER_SECRET ?? '',
		tokenUrl:
			process.env.DARAJA_TOKEN_URL ??
			'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
		queryUrl:
			process.env.DARAJA_QUERY_URL ??
			'https://sandbox.safaricom.co.ke/v1/payments/query/v1/queryCustomerDetails',
		shortcode: process.env.DARAJA_SHORTCODE ?? '',
		initiatorName: process.env.DARAJA_INITIATOR_NAME ?? '',
		initiatorPassword: process.env.DARAJA_INITIATOR_PASSWORD ?? '',
		publicCert: process.env.DARAJA_PUBLIC_CERT ?? ''
	},
	phoneMock: process.env.PHONE_MOCK === 'true',
	otp: {
		/** Lifetime of a login code, in minutes. Short by design. */
		ttlMin: Number(process.env.OTP_TTL_MIN ?? 5),
		/** Wrong guesses allowed before the code is burned. */
		maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5)
	},
	sms: {
		/**
		 * Outbound SMS gateway. Left unconfigured the app prints codes to the
		 * server console (fine for dev, refused in production). Wire your own
		 * provider in src/lib/sms.ts — see sendViaGateway().
		 */
		gatewayUrl: process.env.SMS_GATEWAY_URL ?? '',
		apiKey: process.env.SMS_API_KEY ?? '',
		sender: process.env.SMS_SENDER_ID ?? 'SipiRider'
	}
};
