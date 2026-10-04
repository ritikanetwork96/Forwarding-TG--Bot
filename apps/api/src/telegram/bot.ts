import { Bot } from 'grammy';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

let botInstance: Bot | null = null;
let cachedBotInfo: { id: number; username?: string } | null = null;

export function getTelegramBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new AppError(
      'TELEGRAM_BOT_TOKEN is not configured in the environment',
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR
    );
  }

  if (!botInstance) {
    logger.info('Initializing grammY Bot instance...');
    botInstance = new Bot(env.TELEGRAM_BOT_TOKEN);
  }

  return botInstance;
}

export function isBotConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN.length > 5);
}

export async function getBotInfo(): Promise<{ id: number; username?: string }> {
  if (cachedBotInfo) return cachedBotInfo;

  const bot = getTelegramBot();
  const info = await bot.api.getMe();
  cachedBotInfo = {
    id: info.id,
    username: info.username,
  };
  return cachedBotInfo;
}

/**
 * Resets cached bot instance (useful for testing)
 */
export function resetBotInstance(): void {
  botInstance = null;
  cachedBotInfo = null;
}
