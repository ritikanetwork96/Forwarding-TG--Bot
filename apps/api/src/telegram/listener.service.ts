import { getTelegramBot, isBotConfigured } from './bot.js';
import { IngestionService, type TelegramRawMessage } from '../services/ingestion.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/index.js';

import { BotAdminService } from './admin/bot-admin.service.js';

let isListening = false;
let handlersRegistered = false;

function registerHandlers(): void {
  if (handlersRegistered) return;
  const bot = getTelegramBot();

  // Initialize Admin Bot Services
  BotAdminService.initialize();

  // Admin Commands
  bot.command('start', async (ctx) => {
    try {
      await BotAdminService.handleStart(ctx);
    } catch (err) {
      logger.error('Error handling /start command:', err);
    }
  });

  bot.command('new', async (ctx) => {
    try {
      await BotAdminService.handleNew(ctx);
    } catch (err) {
      logger.error('Error handling /new command:', err);
    }
  });

  bot.command('drafts', async (ctx) => {
    try {
      await BotAdminService.handleDrafts(ctx);
    } catch (err) {
      logger.error('Error handling /drafts command:', err);
    }
  });

  bot.command(['recent', 'history', 'posts'], async (ctx) => {
    try {
      await BotAdminService.handleRecent(ctx);
    } catch (err) {
      logger.error('Error handling /recent|history|posts command:', err);
    }
  });

  bot.command('scheduled', async (ctx) => {
    try {
      await BotAdminService.handleScheduled(ctx);
    } catch (err) {
      logger.error('Error handling /scheduled command:', err);
    }
  });

  bot.command('rules', async (ctx) => {
    try {
      await BotAdminService.handleRules(ctx);
    } catch (err) {
      logger.error('Error handling /rules command:', err);
    }
  });

  bot.command('approvals', async (ctx) => {
    try {
      await BotAdminService.handleApprovals(ctx);
    } catch (err) {
      logger.error('Error handling /approvals command:', err);
    }
  });

  bot.command('posts', async (ctx) => {
    try {
      await BotAdminService.handleRecent(ctx);
    } catch (err) {
      logger.error('Error handling /posts command:', err);
    }
  });

  bot.command(['destinations', 'channels'], async (ctx) => {
    try {
      await BotAdminService.handleDestinations(ctx);
    } catch (err) {
      logger.error('Error handling /channels command:', err);
    }
  });

  bot.command(['addchannel', 'connect'], async (ctx) => {
    try {
      await BotAdminService.handleAddDestination(ctx);
    } catch (err) {
      logger.error('Error handling /addchannel command:', err);
    }
  });

  bot.command('categories', async (ctx) => {
    try {
      await BotAdminService.handleCategories(ctx);
    } catch (err) {
      logger.error('Error handling /categories command:', err);
    }
  });

  bot.command('activity', async (ctx) => {
    try {
      await BotAdminService.handleActivity(ctx);
    } catch (err) {
      logger.error('Error handling /activity command:', err);
    }
  });

  bot.command('settings', async (ctx) => {
    try {
      await BotAdminService.handleSettings(ctx);
    } catch (err) {
      logger.error('Error handling /settings command:', err);
    }
  });

  bot.command('help', async (ctx) => {
    try {
      await BotAdminService.handleHelp(ctx);
    } catch (err) {
      logger.error('Error handling /help command:', err);
    }
  });

  bot.command('cancel', async (ctx) => {
    try {
      await BotAdminService.handleCancel(ctx);
    } catch (err) {
      logger.error('Error handling /cancel command:', err);
    }
  });

  bot.command(['reset_password', 'resetpassword', 'password'], async (ctx) => {
    try {
      await BotAdminService.handleResetPasswordCommand(ctx);
    } catch (err) {
      logger.error('Error handling /reset_password command:', err);
    }
  });

  bot.command('dock', async (ctx) => {
    try {
      await BotAdminService.handleShowDock(ctx);
    } catch (err) {
      logger.error('Error handling /dock command:', err);
    }
  });

  bot.command('hidedock', async (ctx) => {
    try {
      await BotAdminService.handleHideDock(ctx);
    } catch (err) {
      logger.error('Error handling /hidedock command:', err);
    }
  });

  // 1. Channel posts (Ingestion)
  bot.on('channel_post', async (ctx) => {
    try {
      if (ctx.channelPost) {
        await IngestionService.ingestMessage(ctx.channelPost as unknown as TelegramRawMessage);
      }
    } catch (err) {
      logger.error('Error handling inbound channel_post:', err);
    }
  });

  // 2. Messages (Private Admin vs Group/Supergroup Ingestion)
  bot.on('message', async (ctx) => {
    try {
      if (!ctx.message) return;

      // Direct admin communication
      if (ctx.chat?.type === 'private') {
        if (ctx.message.text && ctx.message.text.startsWith('/')) {
          // Handled by bot.command()
          return;
        }
        await BotAdminService.handleAdminPrivateMessage(ctx);
        return;
      }

      // Group / Supergroup Ingestion
      await IngestionService.ingestMessage(ctx.message as unknown as TelegramRawMessage);
    } catch (err) {
      logger.error('Error handling inbound message:', err);
    }
  });

  // 3. Callback Queries (Bot Admin UI Buttons)
  bot.on('callback_query:data', async (ctx) => {
    try {
      await BotAdminService.handleCallbackQuery(ctx);
    } catch (err) {
      logger.error('Error handling inbound callback_query:', err);
    }
  });

  // 4. Edited channel posts
  bot.on('edited_channel_post', async (ctx) => {
    try {
      if (ctx.editedChannelPost) {
        await IngestionService.handleEditedMessage(
          ctx.editedChannelPost as unknown as TelegramRawMessage
        );
      }
    } catch (err) {
      logger.error('Error handling edited_channel_post:', err);
    }
  });

  // 5. Edited messages
  bot.on('edited_message', async (ctx) => {
    try {
      if (ctx.editedMessage) {
        await IngestionService.handleEditedMessage(
          ctx.editedMessage as unknown as TelegramRawMessage
        );
      }
    } catch (err) {
      logger.error('Error handling edited_message:', err);
    }
  });

  // 6. My Chat Member updates (Bot added/promoted in channel or group)
  bot.on('my_chat_member', async (ctx) => {
    try {
      if (ctx.myChatMember) {
        await BotAdminService.handleMyChatMemberUpdate(ctx);
      }
    } catch (err) {
      logger.error('Error handling inbound my_chat_member:', err);
    }
  });

  handlersRegistered = true;
  logger.info('Telegram inbound update handlers registered');
}

/**
 * Starts the long-running grammY bot update listener
 */
export async function startBotListener(): Promise<void> {
  if (isListening) {
    logger.warn('Telegram bot listener is already running. Skipping duplicate startup.');
    return;
  }

  if (!isBotConfigured()) {
    logger.warn(
      'Telegram bot token is not configured. Inbound update listener will not be started.'
    );
    return;
  }

  if (env.NODE_ENV === 'test') {
    logger.debug('Skipping bot listener startup in test environment');
    return;
  }

  try {
    registerHandlers();
    const bot = getTelegramBot();

    isListening = true;
    logger.info('Starting Telegram Bot polling listener...');

    // Register bot commands and presentation profile with Telegram
    bot.api
      .setMyCommands([
        { command: 'start', description: '🏠 Dashboard' },
        { command: 'new', description: '✍️ New Post' },
        { command: 'channels', description: '📢 Channels & Groups' },
        { command: 'categories', description: '📁 Categories' },
        { command: 'rules', description: '⚡ Forward Rules' },
        { command: 'scheduled', description: '🕒 Scheduled Posts' },
        { command: 'history', description: '📜 History & Logs' },
        { command: 'drafts', description: '📝 Drafts' },
        { command: 'help', description: '❓ Help' },
        { command: 'cancel', description: '❌ Cancel' },
      ])
      .catch((err) => {
        logger.warn('Could not register Telegram bot commands menu:', err);
      });

    bot.api
      .setMyDescription(
        'Telegram Broadcast Engine — Autonomous Multi-Channel Publishing & Routing Gateway.\n\n' +
          '• Multi-channel parallel broadcast\n' +
          '• Inbound source monitoring & auto-forwarding\n' +
          '• Content album debouncing & rich media handling\n' +
          '• Precision calendar queue scheduling'
      )
      .catch(() => {});

    bot.api
      .setMyShortDescription(
        'Multi-channel broadcast engine & automated Telegram forwarding gateway.'
      )
      .catch(() => {});

    // bot.start() executes long-polling asynchronously in the background
    bot
      .start({
        allowed_updates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'callback_query',
          'my_chat_member',
          'chat_member',
        ],
        onStart: (botInfo) => {
          logger.info(
            `Telegram Bot listener actively running as @${botInfo.username || 'unnamed'} (ID: ${botInfo.id})`
          );
        },
      })
      .catch((err) => {
        logger.error('Telegram bot polling encountered an unhandled error:', err);
        isListening = false;
      });
  } catch (err) {
    isListening = false;
    logger.error('Failed to start Telegram Bot listener:', err);
  }
}

/**
 * Stops the long-running grammY bot listener cleanly
 */
export async function stopBotListener(): Promise<void> {
  if (!isListening) return;

  try {
    logger.info('Stopping Telegram bot polling listener...');
    const bot = getTelegramBot();
    await bot.stop();
    isListening = false;
    logger.info('Telegram bot polling listener stopped cleanly');
  } catch (err) {
    logger.error('Error stopping Telegram bot listener:', err);
    isListening = false;
  }
}

export function isBotListenerActive(): boolean {
  return isListening;
}
