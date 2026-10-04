import { InlineKeyboard } from 'grammy';
import { getTelegramBot } from './bot.js';
import { normalizeTelegramError } from './normalizer.js';
import type { TelegramPublishParams, TelegramPublishResult } from './types.js';
import { logger } from '../utils/logger.js';

export class TelegramMessageService {
  /**
   * Publish a message (single post or album) via forward or copy mode
   */
  public static async dispatchPublish(
    params: TelegramPublishParams
  ): Promise<TelegramPublishResult> {
    const bot = getTelegramBot();
    const {
      toChatId,
      fromChatId,
      telegramMessageId,
      publishMode,
      text,
      mediaItems = [],
      buttons,
      silent,
      pin,
      disableWebPreview,
    } = params;

    const replyMarkup =
      buttons && buttons.length > 0
        ? new InlineKeyboard(
            buttons.map((row) =>
              row.map((btn) => ({
                text: btn.text,
                url: btn.url,
              }))
            )
          )
        : undefined;

    const commonOptions: Record<string, unknown> = {};
    if (replyMarkup) commonOptions.reply_markup = replyMarkup;
    if (silent) commonOptions.disable_notification = true;
    if (disableWebPreview) commonOptions.link_preview_options = { is_disabled: true };

    try {
      // 1. FORWARD MODE
      if (publishMode === 'forward') {
        if (!fromChatId || !telegramMessageId) {
          throw new Error('Forward mode requires valid source fromChatId and telegramMessageId');
        }

        // Single message forward
        logger.info(
          `Executing forwardMessage: from=${fromChatId}:${telegramMessageId} -> to=${toChatId}`
        );
        const result = await bot.api.forwardMessage(toChatId, fromChatId, telegramMessageId, {
          disable_notification: silent,
        });

        if (pin && result.message_id) {
          try {
            await bot.api.pinChatMessage(toChatId, result.message_id, {
              disable_notification: silent,
            });
          } catch (pinErr) {
            logger.warn(`Could not pin message ${result.message_id} in ${toChatId}:`, pinErr);
          }
        }

        return {
          success: true,
          targetTelegramMessageId: result.message_id,
          targetTelegramMessageIds: [result.message_id],
        };
      }

      // 2. COPY MODE
      let publishedMessageId: number | null = null;
      const publishedMessageIds: number[] = [];

      // Case A: Sourced post with original telegramMessageId -> use copyMessage
      if (fromChatId && telegramMessageId && mediaItems.length <= 1) {
        logger.info(
          `Executing copyMessage: from=${fromChatId}:${telegramMessageId} -> to=${toChatId}`
        );
        const copyOptions: Record<string, unknown> = { ...commonOptions };
        if (text) copyOptions.caption = text;

        const result = await bot.api.copyMessage(
          toChatId,
          fromChatId,
          telegramMessageId,
          copyOptions
        );
        publishedMessageId = result.message_id;
        publishedMessageIds.push(result.message_id);
      } else if (mediaItems.length > 1) {
        // Case B: Album / Multi-item Media Group in copy mode
        logger.info(
          `Executing sendMediaGroup album (${mediaItems.length} items) -> to=${toChatId}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputMediaGroup: any[] = mediaItems.map((item, index) => {
          const base: Record<string, unknown> = {
            type: item.mediaType === 'video' ? 'video' : 'photo',
            media: item.fileId,
          };
          // Attach caption to the first item
          if (index === 0 && (text || item.caption)) {
            base.caption = text || item.caption;
          }
          return base;
        });

        const results = await bot.api.sendMediaGroup(toChatId, inputMediaGroup, {
          disable_notification: silent,
        });
        publishedMessageIds.push(...results.map((m) => m.message_id));
        publishedMessageId = results[0]?.message_id || null;
      } else if (mediaItems.length === 1 && mediaItems[0]) {
        // Case C: Single Media Item with fileId
        const item = mediaItems[0];
        const caption = text || item.caption;
        const mediaOptions: Record<string, unknown> = { ...commonOptions };
        if (caption) mediaOptions.caption = caption;

        let res: { message_id: number };
        if (item.mediaType === 'photo') {
          res = await bot.api.sendPhoto(toChatId, item.fileId, mediaOptions as any);
        } else if (item.mediaType === 'video') {
          res = await bot.api.sendVideo(toChatId, item.fileId, mediaOptions as any);
        } else {
          res = await bot.api.sendDocument(toChatId, item.fileId, mediaOptions as any);
        }
        publishedMessageId = res.message_id;
        publishedMessageIds.push(res.message_id);
      } else {
        // Case D: Pure text message
        logger.info(`Executing sendMessage text -> to=${toChatId}`);
        const res = await bot.api.sendMessage(toChatId, text || '', commonOptions as any);
        publishedMessageId = res.message_id;
        publishedMessageIds.push(res.message_id);
      }

      // Handle Pin on Publish if requested
      if (pin && publishedMessageId) {
        try {
          await bot.api.pinChatMessage(toChatId, publishedMessageId, {
            disable_notification: silent,
          });
        } catch (pinErr) {
          logger.warn(`Could not pin message ${publishedMessageId} in ${toChatId}:`, pinErr);
        }
      }

      return {
        success: true,
        targetTelegramMessageId: publishedMessageId,
        targetTelegramMessageIds: publishedMessageIds,
      };
    } catch (error) {
      logger.error(`Publish failed to destination ${toChatId}:`, error);
      const normalized = normalizeTelegramError(error);
      return {
        success: false,
        error: {
          code: normalized.errorCode,
          message: normalized.message,
          rawTelegram: error,
        },
      };
    }
  }
}
