import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface RateLimitOptions {
  windowMs: number; // Duration of window in milliseconds
  max: number; // Max requests allowed per window
  message?: string;
  statusCode?: number;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

/**
 * Creates an in-memory sliding-window rate limiter
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.', statusCode = 429 } = options;
  const store = new Map<string, ClientRecord>();

  // Periodically purge expired records every 2 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now >= record.resetAt) {
        store.delete(ip);
      }
    }
  }, 2 * 60 * 1000);

  // Prevent keeping Node event loop active on shutdown
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record || now >= record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    // Standard RFC RateLimit headers
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      logger.warn(`Rate limit exceeded for IP ${clientIp} on ${req.method} ${req.originalUrl}`);
      res.status(statusCode).json({
        success: false,
        message,
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Strict Rate Limiter for Authentication endpoints (e.g. /api/auth/login)
 * 10 attempts per 15 minutes per IP
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

/**
 * Sensitive Rate Limiter for Telegram Password Reset
 * 5 requests per 15 minutes per IP
 */
export const resetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes before trying again.',
});

/**
 * General API Rate Limiter
 * 300 requests per minute per IP
 */
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'High traffic detected. Please slow down your requests.',
});
