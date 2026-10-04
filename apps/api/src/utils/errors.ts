import { ErrorCodes, type AppErrorCode } from '@telegram-forwarder/shared';

export class AppError extends Error {
  public readonly isOperational = true;

  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode: AppErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = 'Bad request',
    errorCode: AppErrorCode = ErrorCodes.VALIDATION_ERROR,
    details?: unknown
  ) {
    super(message, 400, errorCode, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message = 'Authentication required',
    errorCode: AppErrorCode = ErrorCodes.UNAUTHORIZED
  ) {
    super(message, 401, errorCode);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied', errorCode: AppErrorCode = ErrorCodes.FORBIDDEN) {
    super(message, 403, errorCode);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode: AppErrorCode = ErrorCodes.NOT_FOUND) {
    super(message, 404, errorCode);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode: AppErrorCode = ErrorCodes.CONFLICT) {
    super(message, 409, errorCode);
  }
}

export class TelegramError extends AppError {
  constructor(
    message: string,
    statusCode = 502,
    errorCode: AppErrorCode = ErrorCodes.TELEGRAM_API_ERROR,
    details?: unknown
  ) {
    super(message, statusCode, errorCode, details);
  }
}

export class TelegramChatNotFoundError extends TelegramError {
  constructor(message = 'Telegram chat not found or bot cannot access it', details?: unknown) {
    super(message, 400, ErrorCodes.TELEGRAM_CHAT_NOT_FOUND, details);
  }
}

export class TelegramNotMemberError extends TelegramError {
  constructor(message = 'Bot is not a member of the target chat', details?: unknown) {
    super(message, 400, ErrorCodes.BOT_NOT_MEMBER, details);
  }
}

export class TelegramKickedError extends TelegramError {
  constructor(message = 'Bot was kicked/banned from the target chat', details?: unknown) {
    super(message, 400, ErrorCodes.BOT_KICKED, details);
  }
}

export class TelegramNotAdminError extends TelegramError {
  constructor(message = 'Bot must be an administrator in broadcast channels', details?: unknown) {
    super(message, 400, ErrorCodes.BOT_NOT_ADMIN_IN_CHANNEL, details);
  }
}

export class TelegramPermissionError extends TelegramError {
  constructor(
    message = 'Bot lacks required permissions in destination',
    errorCode: AppErrorCode = ErrorCodes.MISSING_CHANNEL_POST_RIGHT,
    details?: unknown
  ) {
    super(message, 400, errorCode, details);
  }
}

export class TelegramTemporaryUnavailableError extends TelegramError {
  constructor(message = 'Telegram API is temporarily unavailable', details?: unknown) {
    super(message, 502, ErrorCodes.TELEGRAM_TEMPORARY_UNAVAILABLE, details);
  }
}

export class TelegramRateLimitError extends TelegramError {
  constructor(
    message = 'Telegram rate limit exceeded',
    public readonly retryAfterSeconds?: number
  ) {
    super(message, 429, ErrorCodes.TELEGRAM_RATE_LIMITED, { retryAfterSeconds });
  }
}
