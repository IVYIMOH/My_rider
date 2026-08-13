import 'dotenv/config';

export const config = {
	port: Number(process.env.PORT ?? 8080),
	dbPath: process.env.DB_PATH ?? './sipi.db',
	jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
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
	phoneMock: process.env.PHONE_MOCK === 'true'
};
