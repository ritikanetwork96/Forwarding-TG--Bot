import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 1. Known AppError instance
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.errorCode}]: ${err.message}`, err.details);
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // 2. Zod validation error
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    logger.warn('Request validation failed:', formattedIssues);
    sendError(res, 'Request validation failed', 400, ErrorCodes.VALIDATION_ERROR, formattedIssues);
    return;
  }

  // 3. Mongoose duplicate key error (code 11000)
  if ('code' in err && (err as { code: number }).code === 11000) {
    const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
    const key = keyPattern ? Object.keys(keyPattern).join(', ') : 'field';
    logger.warn(`Duplicate key conflict on ${key}`);
    sendError(res, `A resource with this ${key} already exists`, 409, ErrorCodes.CONFLICT, {
      field: key,
    });
    return;
  }

  // 4. Mongoose CastError / ValidationError
  if (err.name === 'CastError') {
    sendError(res, 'Invalid ID format', 400, ErrorCodes.VALIDATION_ERROR);
    return;
  }

  // 5. Unhandled / Unexpected error
  logger.error('Unhandled internal server error:', err.stack || err.message);
  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message || 'An unexpected error occurred';

  const details = env.NODE_ENV !== 'production' ? err.stack : undefined;
  sendError(res, message, 500, ErrorCodes.INTERNAL_SERVER_ERROR, details);
}
