import type { Request, Response, NextFunction } from 'express';

/**
 * High-performance HTTP Security Headers Middleware
 * Protects against MIME-confusion, Clickjacking, Protocol Downgrade, and Cross-Origin attacks.
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Mitigate clickjacking by disallowing framing from third-party domains
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Legacy XSS protection filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Strict Transport Security (HSTS) - enforce HTTPS in production
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Referrer policy controls leakage of path and query data
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Allow loaded assets to be shared cross-origin (needed for media streaming)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Prevent window.opener hijack
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    next();
  };
}
