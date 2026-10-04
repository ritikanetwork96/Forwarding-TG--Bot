import type { Response } from 'express';
import type { ApiResponse, PaginationMeta } from '@telegram-forwarder/shared';

/**
 * Send a standardized success JSON response
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200,
  meta?: PaginationMeta
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    meta,
    message,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}

/**
 * Send a standardized error JSON response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errorCode?: string,
  details?: unknown
): Response {
  const payload: ApiResponse = {
    success: false,
    message,
    error: errorCode,
    details,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}
