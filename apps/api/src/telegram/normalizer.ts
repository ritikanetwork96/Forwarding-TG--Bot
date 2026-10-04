import { GrammyError, HttpError } from 'grammy';
import {
  TelegramChatNotFoundError,
  TelegramNotMemberError,
  TelegramKickedError,
  TelegramNotAdminError,
  TelegramPermissionError,
  TelegramTemporaryUnavailableError,
  TelegramRateLimitError,
  TelegramError,
} from '../utils/errors.js';

/**
 * Checks whether an error represents a temporary network or Telegram 5xx/429 issue
 */
export function isTransientTelegramError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return true; // Network/HTTP transport error
  }

  if (error instanceof GrammyError) {
    if (error.error_code === 429) return true; // Rate limit
    if (error.error_code >= 500) return true; // Telegram 5xx
    const desc = error.description.toLowerCase();
    if (desc.includes('timeout') || desc.includes('retry') || desc.includes('too many requests')) {
      return true;
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('etimedout') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('timeout') ||
      msg.includes('network')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes raw Telegram/grammY errors into strongly typed AppErrors
 */
export function normalizeTelegramError(error: unknown): TelegramError {
  if (error instanceof GrammyError) {
    const desc = error.description.toLowerCase();

    // 1. Rate limiting
    if (error.error_code === 429) {
      const retryAfter = error.parameters?.retry_after;
      return new TelegramRateLimitError(error.description, retryAfter);
    }

    // 2. Chat not found
    if (desc.includes('chat not found') || desc.includes('chat_id is empty')) {
      return new TelegramChatNotFoundError(error.description, error.payload);
    }

    // 3. Bot kicked / blocked / deleted
    if (
      desc.includes('bot was kicked') ||
      desc.includes('bot was blocked') ||
      desc.includes('user is deactivated')
    ) {
      return new TelegramKickedError(error.description, error.payload);
    }

    // 4. Bot not member
    if (desc.includes('not a member') || desc.includes('user not found')) {
      return new TelegramNotMemberError(error.description, error.payload);
    }

    // 5. Bot not administrator in channel
    if (desc.includes('need administrator rights') || desc.includes('not enough rights')) {
      return new TelegramNotAdminError(error.description, error.payload);
    }

    // 6. Permission specific
    if (
      desc.includes('have no rights to send a message') ||
      desc.includes('cannot send messages')
    ) {
      return new TelegramPermissionError(error.description);
    }

    // 7. Temporary server errors
    if (error.error_code >= 500) {
      return new TelegramTemporaryUnavailableError(error.description, error.payload);
    }

    return new TelegramError(error.description, 502, undefined, error.payload);
  }

  if (error instanceof HttpError) {
    return new TelegramTemporaryUnavailableError(
      `Telegram network transport failure: ${error.message}`,
      error
    );
  }

  if (isTransientTelegramError(error)) {
    return new TelegramTemporaryUnavailableError(
      error instanceof Error ? error.message : 'Temporary Telegram network failure',
      error
    );
  }

  return new TelegramError(
    error instanceof Error ? error.message : 'Unknown Telegram API error',
    502,
    undefined,
    error
  );
}
