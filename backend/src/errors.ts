export class ApiError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
	}
}

export const err = {
	badRequest: (message = 'Invalid request.', code = 'BAD_REQUEST') => new ApiError(400, code, message),
	unauthorized: (message = 'Authentication required.') => new ApiError(401, 'UNAUTHORIZED', message),
	forbidden: (message = 'You do not have permission to do this.', code = 'FORBIDDEN') =>
		new ApiError(403, code, message),
	notFound: (message = 'Resource not found.') => new ApiError(404, 'NOT_FOUND', message),
	conflict: (message = 'Resource already exists.', code = 'CONFLICT') => new ApiError(409, code, message),
	rateLimited: (message = 'Too many attempts. Try again later.') => new ApiError(429, 'RATE_LIMITED', message)
};
