import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto.js';
import { User, type IUser } from '../models/user.model.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { ErrorCodes, type UserRole } from '@telegram-forwarder/shared';

// Extend Express Request interface to include authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Middleware enforcing token-versioned JWT authentication
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
      token = req.query.token.trim();
    }

    if (!token) {
      throw new AuthenticationError('Authentication token missing or invalid');
    }

    const payload = verifyToken(token);

    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user) {
      throw new AuthenticationError('User no longer exists', ErrorCodes.UNAUTHORIZED);
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is disabled', ErrorCodes.ACCOUNT_DISABLED);
    }

    // Token-version validation: invalidates old tokens upon logout or password reset
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new AuthenticationError(
        'Session has been invalidated. Please log in again.',
        ErrorCodes.TOKEN_INVALIDATED
      );
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError(
        `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}
