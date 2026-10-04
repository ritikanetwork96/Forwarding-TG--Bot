import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import type { JWTPayload } from '@telegram-forwarder/shared';
import { AuthenticationError } from './errors.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    payload,
    env.JWT_SECRET as jwt.Secret,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET as jwt.Secret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired', ErrorCodes.UNAUTHORIZED);
    }
    throw new AuthenticationError('Invalid token', ErrorCodes.UNAUTHORIZED);
  }
}
