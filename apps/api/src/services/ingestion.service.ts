import { Message, type IMessage } from '../models/message.model.js';
import { Source, type ISource } from '../models/source.model.js';
import { Destination } from '../models/destination.model.js';
import { getTelegramBot } from '../telegram/bot.js';
import { RuleEngineService } from './rule-engine.service.js';
import { PublishService } from './publish.service.js';
import { albumDebouncer, type PendingAlbumBatch } from '../telegram/debouncer.service.js';
import type { MessageType, MediaItem, MessageContent, ChatType } from '@telegram-forwarder/shared';
import { logger } from '../utils/logger.js';

export interface TelegramRawMessage {
  message_id: number;
  date: number;
  chat: {
    id: number | string;
    type: string;
    title?: string;
    username?: string;
  };
  text?: string;
  entities?: unknown[];
  caption?: string;
  caption_entities?: unknown[];
  media_group_id?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    file_size?: number;
    mime_type?: string;
    file_name?: string;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    file_size?: number;
    file_name?: string;
    mime_type?: string;
  };
  animation?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    file_size?: number;
    mime_type?: string;
    file_name?: string;
  };
  // Service message indicators
  new_chat_members?: unknown[];
  left_chat_member?: unknown;
  new_chat_title?: string;
  new_chat_photo?: unknown[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  pinned_message?: unknown;
  chat_shared?: unknown;
  // Message sender (absent for channel posts)
  from?: {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    username?: string;
  };
}

export class IngestionService {
  private static isDebouncerInitialized = false;

  public static initialize(): void {
    if (this.isDebouncerInitialized) return;
    this.isDebouncerInitialized = true;

    albumDebouncer.setFlushCallback(async (mediaGroupId, batch) => {
      await IngestionService.processFlushedAlbum(mediaGroupId, batch);
    });
    logger.info('IngestionService album debouncer callback initialized');
  }

  /**
   * Helper to check if a Telegram message is a service message
   */
  public static isServiceMessage(msg: TelegramRawMessage): boolean {
    return Boolean(
      msg.new_chat_members ||
      msg.left_chat_member ||
      msg.new_chat_title ||
      msg.new_chat_photo ||
      msg.delete_chat_photo ||
      msg.group_chat_created ||
      msg.supergroup_chat_created ||
      msg.channel_chat_created ||
      msg.pinned_message ||
      msg.chat_shared
    );
  }

  /**
   * Parses media items from a raw Telegram message
   */
  public static extractMediaItem(msg: TelegramRawMessage): {
    mediaItem?: MediaItem;
    messageType: MessageType;
  } {
    if (msg.photo && msg.photo.length > 0) {
      const best = msg.photo[msg.photo.length - 1];
      if (best) {
        return {
          messageType: 'photo',
          mediaItem: {
            mediaType: 'photo',
            fileId: best.file_id,
            fileUniqueId: best.file_unique_id,
            caption: msg.caption || '',
            entities: msg.caption_entities || [],
            width: best.width,
            height: best.height,
            fileSize: best.file_size,
          },
        };
      }
    }

    if (msg.video) {
      return {
        messageType: 'video',
        mediaItem: {
          mediaType: 'video',
          fileId: msg.video.file_id,
          fileUniqueId: msg.video.file_unique_id,
          caption: msg.caption || '',
          entities: msg.caption_entities || [],
          width: msg.video.width,
          height: msg.video.height,
          duration: msg.video.duration,
          fileSize: msg.video.file_size,
          mimeType: msg.video.mime_type,
          fileName: msg.video.file_name,
        },
      };
    }

    if (msg.document) {
      return {
        messageType: 'document',
        mediaItem: {
          mediaType: 'document',
          fileId: msg.document.file_id,
          fileUniqueId: msg.document.file_unique_id,
          caption: msg.caption || '',
          entities: msg.caption_entities || [],
          fileSize: msg.document.file_size,
          fileName: msg.document.file_name,
          mimeType: msg.document.mime_type,
        },
      };
    }

    if (msg.audio) {
      return {
        messageType: 'audio',
        mediaItem: {
          mediaType: 'audio',
          fileId: msg.audio.file_id,
          fileUniqueId: msg.audio.file_unique_id,
          caption: msg.caption || '',
          entities: msg.caption_entities || [],
          duration: msg.audio.duration,
          fileSize: msg.audio.file_size,
          fileName: msg.audio.file_name,
          mimeType: msg.audio.mime_type,
        },
      };
    }

    if (msg.animation) {
      return {
        messageType: 'animation',
        mediaItem: {
          mediaType: 'animation',
          fileId: msg.animation.file_id,
          fileUniqueId: msg.animation.file_unique_id,
          caption: msg.caption || '',
          entities: msg.caption_entities || [],
          width: msg.animation.width,
          height: msg.animation.height,
          duration: msg.animation.duration,
          fileSize: msg.animation.file_size,
          mimeType: msg.animation.mime_type,
          fileName: msg.animation.file_name,
        },
      };
    }

    return {
      messageType: 'text',
    };
  }

  /**
   * Ingests an incoming Telegram message or channel post
   */
  public static async ingestMessage(rawMsg: TelegramRawMessage): Promise<IMessage | null> {
    this.initialize();

    // 1. Validate chat type & service message status
    if (!rawMsg.chat || !rawMsg.chat.id) return null;
    const chatType = rawMsg.chat.type;
    if (chatType !== 'channel' && chatType !== 'supergroup' && chatType !== 'group') {
      return null;
    }

    if (this.isServiceMessage(rawMsg)) {
      logger.debug(`Ignoring service message ${rawMsg.message_id} in chat ${rawMsg.chat.id}`);
      return null;
    }

    // Ignore messages published by this bot to avoid self-echo loops
    try {
      const bot = getTelegramBot();
      if (bot.botInfo && rawMsg.from?.id && rawMsg.from.id === bot.botInfo.id) {
        return null;
      }
    } catch {
      // Safe fallback if bot info is not loaded yet
    }

    const telegramChatId = String(rawMsg.chat.id);
    const telegramMessageId = rawMsg.message_id;

    // 2. Resolve Source or auto-activate from known destination/channel
    let source = await Source.findOne({ telegramChatId });
    if (!source || source.status !== 'active') {
      const dest = await Destination.findOne({ telegramChatId });
      if (dest || chatType === 'channel' || chatType === 'supergroup') {
        const chatTitle =
          ('title' in rawMsg.chat && rawMsg.chat.title) ||
          dest?.title ||
          (rawMsg.chat.username ? `@${rawMsg.chat.username}` : `Chat ${telegramChatId}`);
        const chatUsername = rawMsg.chat.username
          ? rawMsg.chat.username.toLowerCase().trim()
          : (dest?.username || null);
        const resolvedChatType = (
          chatType === 'supergroup' ? 'supergroup' : chatType === 'group' ? 'group' : 'channel'
        ) as ChatType;

        const upserted = await Source.findOneAndUpdate(
          { telegramChatId },
          {
            title: chatTitle,
            username: chatUsername,
            type: resolvedChatType,
            status: 'active',
          },
          { upsert: true, new: true }
        );
        if (!upserted) return null;
        source = upserted;
        logger.info(`Auto-activated Source for chat "${chatTitle}" (${telegramChatId})`);
      } else {
        logger.debug(
          `Safely ignoring message ${telegramMessageId} from unregistered or inactive chat ${telegramChatId}`
        );
        return null;
      }
    }

    // 3. Handle Album debounce if media_group_id is present
    if (rawMsg.media_group_id) {
      const { mediaItem } = this.extractMediaItem(rawMsg);
      if (mediaItem) {
        albumDebouncer.addAlbumItem(
          rawMsg.media_group_id,
          telegramChatId,
          telegramMessageId,
          mediaItem,
          rawMsg.text || rawMsg.caption,
          rawMsg.entities || rawMsg.caption_entities
        );
        return null; // Return null now; the debouncer will process the whole album upon flush
      }
    }

    // 4. Deduplicate using compound unique key
    const existing = await Message.findOne({ telegramChatId, telegramMessageId });
    if (existing) {
      logger.debug(
        `Duplicate Telegram message received and ignored: chat=${telegramChatId}, msgId=${telegramMessageId}`
      );
      return existing;
    }

    // 5. Normalize update into Message model
    const { mediaItem, messageType } = this.extractMediaItem(rawMsg);
    const text = rawMsg.text || rawMsg.caption || '';
    const entities = rawMsg.entities || rawMsg.caption_entities || [];
    const mediaItems: MediaItem[] = mediaItem ? [mediaItem] : [];

    const content: MessageContent = {
      text,
      entities,
      mediaItems,
      mediaGroupId: null,
    };

    let message: IMessage;
    try {
      message = await Message.create({
        sourceId: source._id,
        categoryId: null,
        telegramChatId,
        telegramMessageId,
        mediaGroupId: null,
        messageType,
        content,
        status: 'draft',
        deliverySummary: {
          targetCount: 0,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
        isEditedAtSource: false,
      });
    } catch (err: unknown) {
      // Catch MongoDB duplicate key error (code 11000) for race conditions
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        logger.debug(
          `Caught duplicate key error on insert: chat=${telegramChatId}, msgId=${telegramMessageId}`
        );
        return (await Message.findOne({ telegramChatId, telegramMessageId })) || null;
      }
      throw err;
    }

    // 6. Update Source metadata
    source.lastMessageId = telegramMessageId;
    source.lastIngestedAt = new Date();
    await source.save();

    // 7. Evaluate Forwarding Rules & Execute Workflow
    return await this.processMessageWorkflows(message, source);
  }

  /**
   * Processes an album batch flushed by AlbumDebouncerService
   */
  public static async processFlushedAlbum(
    mediaGroupId: string,
    batch: PendingAlbumBatch
  ): Promise<IMessage | null> {
    const { telegramChatId, items } = batch;
    if (items.length === 0) return null;

    let source = await Source.findOne({ telegramChatId });
    if (!source || source.status !== 'active') {
      const dest = await Destination.findOne({ telegramChatId });
      if (dest) {
        const upserted = await Source.findOneAndUpdate(
          { telegramChatId },
          {
            title: dest.title,
            username: dest.username,
            type: dest.type === 'group' ? 'group' : 'channel',
            status: 'active',
          },
          { upsert: true, new: true }
        );
        if (!upserted) return null;
        source = upserted;
      } else {
        return null;
      }
    }

    // Primary message ID for the album is the first item's message ID
    const firstItem = items[0];
    if (!firstItem) return null;
    const primaryMessageId = firstItem.telegramMessageId;

    // Check duplicate
    const existing = await Message.findOne({
      $or: [{ mediaGroupId }, { telegramChatId, telegramMessageId: primaryMessageId }],
    });
    if (existing) {
      logger.debug(`Album already ingested: mediaGroupId=${mediaGroupId}`);
      return existing;
    }

    // Assemble album content
    const mediaItems: MediaItem[] = items.map((i) => i.mediaItem);
    const captionItem = items.find((i) => Boolean(i.text));
    const text = captionItem?.text || '';
    const entities = captionItem?.entities || [];

    const content: MessageContent = {
      text,
      entities,
      mediaItems,
      mediaGroupId,
    };

    let message: IMessage;
    try {
      message = await Message.create({
        sourceId: source._id,
        categoryId: null,
        telegramChatId,
        telegramMessageId: primaryMessageId,
        mediaGroupId,
        messageType: 'album',
        content,
        status: 'draft',
        deliverySummary: {
          targetCount: 0,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
        isEditedAtSource: false,
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        return (
          (await Message.findOne({ telegramChatId, telegramMessageId: primaryMessageId })) || null
        );
      }
      throw err;
    }

    // Update source metadata with the latest message ID from the album
    const maxMessageId = Math.max(...items.map((i) => i.telegramMessageId));
    source.lastMessageId = maxMessageId;
    source.lastIngestedAt = new Date();
    await source.save();

    // Evaluate rules
    return await this.processMessageWorkflows(message, source);
  }

  /**
   * Handles edited source messages (edited_channel_post, edited_message)
   */
  public static async handleEditedMessage(rawMsg: TelegramRawMessage): Promise<IMessage | null> {
    if (!rawMsg.chat || !rawMsg.chat.id) return null;
    const telegramChatId = String(rawMsg.chat.id);
    const telegramMessageId = rawMsg.message_id;

    const message = await Message.findOne({ telegramChatId, telegramMessageId });
    if (!message) {
      logger.debug(
        `Received edit for untracked message: chat=${telegramChatId}, msgId=${telegramMessageId}`
      );
      return null;
    }

    const newText = rawMsg.text || rawMsg.caption || '';
    const newEntities = rawMsg.entities || rawMsg.caption_entities || [];

    // Case A: status = draft OR pending_approval (or failed)
    if (
      message.status === 'draft' ||
      message.status === 'pending_approval' ||
      message.status === 'failed'
    ) {
      message.content.text = newText;
      message.content.entities = newEntities;
      message.updatedAt = new Date();
      await message.save();
      logger.info(
        `Updated un-published message ${message._id} following source edit in chat ${telegramChatId}`
      );
      return message;
    }

    // Case B: status = published OR partially_published
    if (message.status === 'published' || message.status === 'partially_published') {
      message.isEditedAtSource = true;
      message.sourceEditedAt = new Date();
      await message.save();
      logger.info(
        `Flagged published message ${message._id} as edited at source without mutating published posts`
      );
      return message;
    }

    return message;
  }

  /**
   * Evaluates forwarding rules and executes manual or automatic workflows
   */
  private static async processMessageWorkflows(
    message: IMessage,
    source: ISource
  ): Promise<IMessage> {
    const resolvedTargets = await RuleEngineService.evaluateMessageRules(
      source._id,
      message.categoryId
    );

    // If no specific rule is matched, auto-forward to all active destinations by default (excluding source chat to prevent loops)
    if (resolvedTargets.length === 0) {
      logger.info(
        `No specific rule configured for source "${source.title}". Auto-forwarding to active destinations...`
      );
      const fallbackDests = await Destination.find({
        telegramChatId: { $ne: source.telegramChatId },
        status: 'active',
        'verification.canPublish': { $ne: false },
      }).select('_id');

      if (fallbackDests.length > 0) {
        try {
          await PublishService.publishAutomated({
            messageId: message._id.toString(),
            destinationIds: fallbackDests.map((d) => d._id.toString()),
            publishMode: 'copy',
          });
          logger.info(
            `Default auto-forward executed for message ${message._id} to ${fallbackDests.length} destinations.`
          );
        } catch (pubErr) {
          logger.error(`Error in default auto-forward for message ${message._id}:`, pubErr);
        }
      }
      return (await Message.findById(message._id)) || message;
    }

    for (const target of resolvedTargets) {
      logger.info(
        `Executing publish for message ${message._id} via rule [${target.ruleName}]`
      );
      try {
        await PublishService.publishAutomated({
          messageId: message._id.toString(),
          destinationIds: target.destinationIds,
          publishMode: target.publishMode,
          ruleId: target.ruleId,
        });
      } catch (pubErr) {
        logger.error(
          `Error during automatic publish for message ${message._id} via rule ${target.ruleId}:`,
          pubErr
        );
      }
    }

    // Refresh message to return latest delivery status
    return (await Message.findById(message._id)) || message;
  }
}
