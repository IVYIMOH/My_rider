import { err } from '../errors';

export type Operator =
	| 'mtn'
	| 'airtel'
	| 'utel'
	| 'lycamobile'
	| 'africell'
	| 'safaricom'
	| 'telkom'
	| 'equitel'
	| 'faiba'
	| 'homelands'
	| 'mobilepay'
	| 'eferio'
	| 'semamobile';

export type CountryCode = 'UG' | 'KE';

export interface NormalizedPhone {
	country: CountryCode;
	operator: Operator;
	/** E.164 with leading +, e.g. +256771234567 */
	e164: string;
	/** Country code + national number without leading 0, e.g. 256771234567 */
	international: string;
	/** National significant number without leading 0, e.g. 771234567 */
	national: string;
}

/** [startPrefix, endPrefix, operator] over the 3-digit national prefix. */
type Range = [string, string, Operator];

// Uganda Communications Commission assignments (9-digit NSN, prefix = first 3 digits).
const UG_RANGES: Range[] = [
	['390', '399', 'mtn'], // MTN (039)
	['700', '709', 'airtel'], // Airtel (070)
	['710', '719', 'utel'], // Uganda Telecom (071)
	['720', '729', 'lycamobile'], // Lycamobile (072)
	['730', '739', 'africell'], // Africell (073)
	['740', '759', 'airtel'], // Airtel (074, 075)
	['760', '799', 'mtn'] // MTN (076, 077, 078, 079)
];

// Communications Authority of Kenya assignments (9-digit NSN, prefix = first 3 digits).
const KE_RANGES: Range[] = [
	['100', '109', 'airtel'],
	['110', '119', 'safaricom'],
	['700', '729', 'safaricom'],
	['730', '739', 'airtel'],
	['740', '743', 'safaricom'],
	['744', '744', 'homelands'],
	['745', '746', 'safaricom'],
	['747', '747', 'faiba'],
	['748', '749', 'safaricom'],
	['750', '756', 'airtel'],
	['757', '759', 'safaricom'],
	['760', '760', 'mobilepay'],
	['761', '761', 'eferio'],
	['762', '762', 'airtel'],
	['763', '766', 'equitel'],
	['767', '767', 'semamobile'],
	['768', '769', 'safaricom'],
	['770', '779', 'telkom'],
	['780', '789', 'airtel'],
	['790', '799', 'safaricom']
];

function operatorFor(ranges: Range[], nsn: string): Operator | null {
	const prefix = nsn.slice(0, 3);
	for (const [start, end, operator] of ranges) {
		if (prefix >= start && prefix <= end) return operator;
	}
	return null;
}

/** True when we have an operator API to verify against (MTN, Safaricom). */
export function canVerify(operator: Operator): boolean {
	return operator === 'mtn' || operator === 'safaricom';
}

export function normalizePhone(raw: string): NormalizedPhone {
	const digits = raw.replace(/[^0-9]/g, '');
	if (!/^[0-9]{9,15}$/.test(digits)) throw err.badRequest('Enter a valid phone number.', 'INVALID_PHONE');

	let country: CountryCode | null = null;
	let nsn = '';

	if (digits.startsWith('256')) {
		country = 'UG';
		nsn = digits.slice(3);
	} else if (digits.startsWith('254')) {
		country = 'KE';
		nsn = digits.slice(3);
	} else if (digits.startsWith('0')) {
		nsn = digits.slice(1);
	} else {
		throw err.badRequest('Include the country code (e.g. +256 or +254).', 'INVALID_PHONE');
	}

	if (!/^[0-9]{9}$/.test(nsn)) throw err.badRequest('Enter a valid phone number.', 'INVALID_PHONE');

	let operator: Operator | null = null;
	if (country === 'UG') {
		operator = operatorFor(UG_RANGES, nsn);
	} else if (country === 'KE') {
		operator = operatorFor(KE_RANGES, nsn);
	} else {
		// No country code supplied: only accept numbers that match exactly one country.
		const ug = operatorFor(UG_RANGES, nsn);
		const ke = operatorFor(KE_RANGES, nsn);
		if (ug && !ke) {
			country = 'UG';
			operator = ug;
		} else if (ke && !ug) {
			country = 'KE';
			operator = ke;
		} else {
			throw err.badRequest('Include the country code (e.g. +256 or +254).', 'INVALID_PHONE');
		}
	}

	if (!operator) throw err.badRequest('This number is not on a recognized network.', 'UNSUPPORTED_OPERATOR');

	const cc = country === 'UG' ? '256' : '254';
	return {
		country,
		operator,
		e164: `+${cc}${nsn}`,
		international: `${cc}${nsn}`,
		national: nsn
	};
}
