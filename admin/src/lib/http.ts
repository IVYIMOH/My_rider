export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export interface ApiFailure {
	status: number;
	code: string;
	message: string;
}

export class ApiError extends Error {
	status: number;
	code: string;

	constructor(failure: ApiFailure) {
		super(failure.message);
		this.name = 'ApiError';
		this.status = failure.status;
		this.code = failure.code;
	}
}

interface HttpOptions {
	method?: string;
	body?: unknown;
	token?: string | null;
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			method: options.method ?? 'GET',
			headers,
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined
		});
	} catch {
		throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the server. Is the backend running?' });
	}

	if (!res.ok) {
		let failure: ApiFailure = { status: res.status, code: 'UNKNOWN', message: `Request failed (${res.status})` };
		try {
			const data = (await res.json()) as { error?: { code?: string; message?: string } };
			failure = {
				status: res.status,
				code: data.error?.code ?? 'UNKNOWN',
				message: data.error?.message ?? failure.message
			};
		} catch {
			// keep default failure
		}
		throw new ApiError(failure);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}
