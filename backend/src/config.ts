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
	}
};
