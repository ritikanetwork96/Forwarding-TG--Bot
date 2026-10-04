import { Message, type IMessage } from '../models/message.model.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import {
  ErrorCodes,
  type MessageDTO,
  type MessageStatus,
  type MessageType,
  type MessageContent,
  type PaginationMeta,
} from '@telegram-forwarder/shared';
import { Types } from 'mongoose';

export function formatMessageDTO(msg: IMessage): MessageDTO {
  return {
    _id: msg._id.toString(),
    sourceId: msg.sourceId ? msg.sourceId.toString() : null,
    categoryId: msg.categoryId ? msg.categoryId.toString() : null,
    telegramChatId: msg.telegramChatId || null,
    telegramMessageId: msg.telegramMessageId || null,
    mediaGroupId: msg.mediaGroupId || null,
    messageType: msg.messageType,
    content: {
      text: msg.content.text || '',
      entities: msg.content.entities || [],
      mediaItems: (msg.content.mediaItems || []).map((item) => ({
        mediaType: item.mediaType,
        fileId: item.fileId,
        fileUniqueId: item.fileUniqueId,
        caption: item.caption || '',
        entities: item.entities || [],
        width: item.width,
        height: item.height,
        duration: item.duration,
        fileSize: item.fileSize,
        fileName: item.fileName,
        mimeType: item.mimeType,
      })),
      mediaGroupId: msg.content.mediaGroupId || null,
    },
    status: msg.status,
    deliverySummary: {
      targetCount: msg.deliverySummary.targetCount || 0,
      successfulDestinationIds: (msg.deliverySummary.successfulDestinationIds || []).map((id) =>
        id.toString()
      ),
      failedDestinationIds: (msg.deliverySummary.failedDestinationIds || []).map((id) =>
        id.toString()
      ),
      lastAttemptedAt: msg.deliverySummary.lastAttemptedAt
        ? new Date(msg.deliverySummary.lastAttemptedAt).toISOString()
        : null,
    },
    isEditedAtSource: msg.isEditedAtSource,
    sourceEditedAt: msg.sourceEditedAt ? msg.sourceEditedAt.toISOString() : null,
    createdAt: msg.createdAt.toISOString(),
    updatedAt: msg.updatedAt.toISOString(),
  };
}

export class PostService {
  public static async list(query: {
    status?: MessageStatus;
    categoryId?: string;
    sourceId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ posts: MessageDTO[]; meta: PaginationMeta }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);
    if (query.sourceId) filter.sourceId = new Types.ObjectId(query.sourceId);

    const [total, messages] = await Promise.all([
      Message.countDocuments(filter),
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    return {
      posts: messages.map(formatMessageDTO),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getById(id: string): Promise<MessageDTO> {
    const message = await Message.findById(id);
    if (!message) {
      throw new NotFoundError('Post not found');
    }
    return formatMessageDTO(message);
  }

  public static async create(data: {
    sourceId?: string | null;
    categoryId?: string | null;
    telegramChatId?: string | null;
    telegramMessageId?: number | null;
    mediaGroupId?: string | null;
    messageType?: MessageType;
    content: MessageContent;
    status?: MessageStatus;
  }): Promise<MessageDTO> {
    // Derive messageType if not provided
    let messageType: MessageType = data.messageType || 'text';
    if (!data.messageType) {
      if (data.content.mediaItems && data.content.mediaItems.length > 1) {
        messageType = 'album';
      } else if (
        data.content.mediaItems &&
        data.content.mediaItems.length === 1 &&
        data.content.mediaItems[0]
      ) {
        messageType = data.content.mediaItems[0].mediaType;
      } else {
        messageType = 'text';
      }
    }

    const messageData: Record<string, unknown> = {
      sourceId: data.sourceId ? new Types.ObjectId(data.sourceId) : null,
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      messageType,
      content: {
        text: data.content.text || '',
        entities: data.content.entities || [],
        mediaItems: (data.content.mediaItems || []).map((item) => ({
          mediaType: item.mediaType,
          fileId: item.fileId,
          fileUniqueId: item.fileUniqueId,
          caption: item.caption || '',
          entities: item.entities || [],
          width: item.width,
          height: item.height,
          duration: item.duration,
          fileSize: item.fileSize,
          fileName: item.fileName,
          mimeType: item.mimeType,
        })),
        ...(data.mediaGroupId ? { mediaGroupId: data.mediaGroupId } : {}),
      },
      status: data.status || 'draft',
      deliverySummary: {
        targetCount: 0,
        successfulDestinationIds: [],
        failedDestinationIds: [],
        lastAttemptedAt: null,
      },
      isEditedAtSource: false,
      sourceEditedAt: null,
    };

    if (data.telegramChatId) {
      messageData.telegramChatId = data.telegramChatId;
    }
    if (data.telegramMessageId !== undefined && data.telegramMessageId !== null) {
      messageData.telegramMessageId = data.telegramMessageId;
    }
    if (data.mediaGroupId) {
      messageData.mediaGroupId = data.mediaGroupId;
    }

    const message = await Message.create(messageData);

    return formatMessageDTO(message);
  }

  public static async update(
    id: string,
    data: {
      categoryId?: string | null;
      content?: Partial<MessageContent>;
      status?: MessageStatus;
    }
  ): Promise<MessageDTO> {
    const message = await Message.findById(id);
    if (!message) {
      throw new NotFoundError('Post not found');
    }

    if (message.status === 'published' && data.content) {
      throw new BadRequestError(
        'Cannot edit content of an already published post',
        ErrorCodes.CANNOT_EDIT_PUBLISHED
      );
    }

    if (data.categoryId !== undefined) {
      message.categoryId = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
    }

    if (data.status !== undefined) {
      message.status = data.status;
    }

    if (data.content) {
      if (data.content.text !== undefined) {
        message.content.text = data.content.text;
      }
      if (data.content.entities !== undefined) {
        message.content.entities = data.content.entities;
      }
      if (data.content.mediaItems !== undefined) {
        message.content.mediaItems = data.content.mediaItems.map((item) => ({
          mediaType: item.mediaType,
          fileId: item.fileId,
          fileUniqueId: item.fileUniqueId,
          caption: item.caption || '',
          entities: item.entities || [],
          width: item.width,
          height: item.height,
          duration: item.duration,
          fileSize: item.fileSize,
          fileName: item.fileName,
          mimeType: item.mimeType,
        })) as unknown as typeof message.content.mediaItems;

        if (message.content.mediaItems.length > 1) {
          message.messageType = 'album';
        } else if (message.content.mediaItems.length === 1 && message.content.mediaItems[0]) {
          message.messageType = message.content.mediaItems[0].mediaType;
        } else {
          message.messageType = 'text';
        }
      }
    }

    await message.save();
    return formatMessageDTO(message);
  }

  public static async delete(id: string): Promise<void> {
    const message = await Message.findById(id);
    if (!message) {
      throw new NotFoundError('Post not found');
    }
    await Message.findByIdAndDelete(id);
  }
}
