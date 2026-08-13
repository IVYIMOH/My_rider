import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
	sub: number;
	role: string;
}

export function signToken(user: { id: number; role: string }): string {
	return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
	return jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;
}
