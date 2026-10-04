import { PublishLog, type IPublishLog } from '../models/publish-log.model.js';
import { Message, type IMessage } from '../models/message.model.js';
import { formatMessageDTO } from './post.service.js';
import { NotFoundError } from '../utils/errors.js';
import {
  type PublishLogDTO,
  type PublishLogStatus,
  type PaginationMeta,
} from '@telegram-forwarder/shared';
import { Types } from 'mongoose';

export function formatLogDTO(log: any, message?: any): PublishLogDTO {
  return {
    _id: log._id.toString(),
    messageId: log.messageId ? log.messageId.toString() : '',
    sourceId: log.sourceId ? log.sourceId.toString() : null,
    categoryId: log.categoryId ? log.categoryId.toString() : null,
    destinationId: log.destinationId ? log.destinationId.toString() : '',
    ruleId: log.ruleId ? log.ruleId.toString() : null,
    triggeredBy: log.triggeredBy ? log.triggeredBy.toString() : null,
    publishMode: log.publishMode,
    status: log.status,
    targetTelegramMessageId: log.targetTelegramMessageId || null,
    targetTelegramMessageIds: log.targetTelegramMessageIds || [],
    error: log.error
      ? {
          code: log.error.code,
          message: log.error.message,
          rawTelegram: log.error.rawTelegram,
        }
      : null,
    executionTimeMs: log.executionTimeMs,
    createdAt: new Date(log.createdAt).toISOString(),
    message: message ? formatMessageDTO(message) : null,
  };
}

export class LogService {
  public static async list(query: {
    messageId?: string;
    destinationId?: string;
    status?: PublishLogStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: PublishLogDTO[]; meta: PaginationMeta }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.messageId) filter.messageId = new Types.ObjectId(query.messageId);
    if (query.destinationId) filter.destinationId = new Types.ObjectId(query.destinationId);
    if (query.status) filter.status = query.status;

    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        dateFilter.$lte = new Date(query.endDate);
      }
      filter.createdAt = dateFilter;
    }

    const [total, logs] = await Promise.all([
      PublishLog.countDocuments(filter),
      PublishLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    // Populate messages for logs
    const messageIds = logs.map((l: any) => l.messageId);
    const messages = await Message.find({ _id: { $in: messageIds } }).lean();
    const messageMap = new Map<string, any>();
    for (const m of messages) {
      messageMap.set(m._id.toString(), m);
    }

    return {
      logs: logs.map((doc: any) =>
        formatLogDTO(doc, messageMap.get(doc.messageId.toString()) || null)
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public static async getById(id: string): Promise<PublishLogDTO> {
    const log = await PublishLog.findById(id);
    if (!log) {
      throw new NotFoundError('Publish log not found');
    }
    const message = await Message.findById(log.messageId);
    return formatLogDTO(log, message);
  }
}
