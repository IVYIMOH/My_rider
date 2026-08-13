import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = config.smtp.host
	? nodemailer.createTransport({
			host: config.smtp.host,
			port: config.smtp.port,
			secure: config.smtp.port === 465,
			auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
		})
	: null;

/**
 * Sends an email through the configured SMTP relay (Gmail in production).
 * When SMTP is not configured it falls back to printing the message to the
 * server console, which is how verification links are surfaced locally.
 * Throws on SMTP failure so callers can surface delivery problems.
 */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
	if (!transporter) {
		console.log('\n---[DEV EMAIL OUTBOX]---');
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log(text);
		console.log('------------------------\n');
		return;
	}

	try {
		await transporter.sendMail({ from: config.smtp.from, to, subject, html, text });
		console.log(`[email] verification email sent to ${to}`);
	} catch (error) {
		console.error(`[email] failed to send verification email to ${to}:`, error);
		throw error;
	}
}
