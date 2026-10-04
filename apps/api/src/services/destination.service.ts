import { Destination, type IDestination } from '../models/destination.model.js';
import { DestinationGroup } from '../models/destination-group.model.js';
import { ForwardingRule } from '../models/forwarding-rule.model.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { isTransientTelegramError } from '../telegram/normalizer.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import {
  ErrorCodes,
  type DestinationDTO,
  type DestinationStatus,
  type ChatType,
} from '@telegram-forwarder/shared';
import { logger } from '../utils/logger.js';

export function formatDestinationDTO(dest: IDestination): DestinationDTO {
  return {
    _id: dest._id.toString(),
    telegramChatId: dest.telegramChatId,
    title: dest.title,
    displayName: dest.displayName || undefined,
    iconEmoji: dest.iconEmoji || undefined,
    customEmojiId: dest.customEmojiId || undefined,
    username: dest.username,
    type: dest.type,
    status: dest.status,
    verification: {
      chatType: dest.verification.chatType,
      isForum: dest.verification.isForum,
      botRole: dest.verification.botRole,
      isMember: dest.verification.isMember,
      canPublish: dest.verification.canPublish,
      canSendAsChat: dest.verification.canSendAsChat,
      senderIdentity: dest.verification.senderIdentity,
      rights: {
        canPostMessages: dest.verification.rights.canPostMessages,
        canSendMessages: dest.verification.rights.canSendMessages,
        canEditMessages: dest.verification.rights.canEditMessages,
        canDeleteMessages: dest.verification.rights.canDeleteMessages,
        canManageTopics: dest.verification.rights.canManageTopics,
      },
      lastCheckedAt: dest.verification.lastCheckedAt
        ? new Date(dest.verification.lastCheckedAt).toISOString()
        : null,
      failureReason: dest.verification.failureReason,
    },
    createdAt: dest.createdAt.toISOString(),
    updatedAt: dest.updatedAt.toISOString(),
  };
}

export class DestinationService {
  public static async list(query: { status?: DestinationStatus } = {}): Promise<DestinationDTO[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const destinations = await Destination.find(filter).sort({ createdAt: -1 });
    return destinations.map(formatDestinationDTO);
  }

  public static async getById(id: string): Promise<DestinationDTO> {
    const destination = await Destination.findById(id);
    if (!destination) {
      throw new NotFoundError('Destination not found');
    }
    return formatDestinationDTO(destination);
  }

  public static async create(data: {
    telegramChatId: string;
    title: string;
    username?: string | null;
    type?: ChatType;
  }): Promise<DestinationDTO> {
    const cleanChatId = String(data.telegramChatId).trim();

    const existing = await Destination.findOne({ telegramChatId: cleanChatId });
    if (existing) {
      throw new ConflictError(
        `Destination with Telegram chat ID '${cleanChatId}' is already registered`,
        ErrorCodes.DESTINATION_ALREADY_EXISTS
      );
    }

    const destination = await Destination.create({
      telegramChatId: cleanChatId,
      title: data.title.trim(),
      username: data.username ? data.username.toLowerCase().trim() : null,
      type: data.type || 'channel',
      status: 'pending',
      verification: {
        chatType: data.type || 'channel',
        isForum: false,
        botRole: 'unknown',
        isMember: false,
        canPublish: false,
        rights: {
          canPostMessages: false,
          canSendMessages: false,
          canEditMessages: false,
          canDeleteMessages: false,
          canManageTopics: false,
        },
        lastCheckedAt: null,
        failureReason: 'Awaiting initial permission probe',
      },
    });

    return formatDestinationDTO(destination);
  }

  public static async verify(id: string): Promise<DestinationDTO> {
    const destination = await Destination.findById(id);
    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    try {
      const probeResult = await TelegramService.verifyDestination(destination.telegramChatId);

      // Update metadata if returned from Telegram API
      if (probeResult.metadata) {
        if (probeResult.metadata.title) destination.title = probeResult.metadata.title;
        if (probeResult.metadata.username) destination.username = probeResult.metadata.username;
        destination.type = probeResult.metadata.type;
      }

      // Update verification details
      destination.verification = probeResult.verification;

      // Determine destination status based on chat-type verification rules
      if (probeResult.canPublish) {
        destination.status = 'active';
      } else if (
        probeResult.verification.botRole === 'kicked' ||
        probeResult.verification.botRole === 'left'
      ) {
        destination.status = 'invalid';
      } else {
        destination.status = 'permission_missing';
      }

      await destination.save();
      return formatDestinationDTO(destination);
    } catch (error) {
      // Critical Tenet: Transient network/5xx/429 errors DO NOT corrupt destination state to 'invalid'
      if (isTransientTelegramError(error)) {
        logger.warn(
          `Temporary Telegram error during verification of ${destination.telegramChatId}. Preserving database state.`
        );
        throw error;
      }

      // Definitive failure (chat not found, malformed chat_id, bot blocked)
      logger.error(`Definitive verification failure for ${destination.telegramChatId}:`, error);
      destination.status = 'invalid';
      destination.verification.failureReason =
        error instanceof Error ? error.message : 'Chat not accessible';
      destination.verification.canPublish = false;
      await destination.save();
      throw error;
    }
  }

  public static async update(
    id: string,
    data: {
      title?: string;
      displayName?: string;
      iconEmoji?: string;
      customEmojiId?: string;
      username?: string | null;
      status?: DestinationStatus;
      type?: ChatType;
    }
  ): Promise<DestinationDTO> {
    const destination = await Destination.findById(id);
    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    if (data.title !== undefined) destination.title = data.title.trim();
    if (data.displayName !== undefined) destination.displayName = data.displayName?.trim() || null;
    if (data.iconEmoji !== undefined) destination.iconEmoji = data.iconEmoji?.trim() || null;
    if (data.customEmojiId !== undefined)
      destination.customEmojiId = data.customEmojiId?.trim() || null;
    if (data.username !== undefined) {
      destination.username = data.username ? data.username.toLowerCase().trim() : null;
    }
    if (data.status !== undefined) destination.status = data.status;
    if (data.type !== undefined) destination.type = data.type;

    await destination.save();
    return formatDestinationDTO(destination);
  }

  public static async delete(id: string): Promise<void> {
    const destination = await Destination.findById(id);
    if (!destination) {
      throw new NotFoundError('Destination not found');
    }
    await Destination.findByIdAndDelete(id);

    // Referential integrity: remove deleted destination from any groups or forwarding rules
    await DestinationGroup.updateMany(
      { destinationIds: destination._id },
      { $pull: { destinationIds: destination._id } }
    );
    await ForwardingRule.updateMany(
      { destinationIds: destination._id },
      { $pull: { destinationIds: destination._id } }
    );
  }
}
