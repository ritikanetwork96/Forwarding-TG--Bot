import { Source, type ISource } from '../models/source.model.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import {
  ErrorCodes,
  type SourceDTO,
  type SourceStatus,
  type ChatType,
} from '@telegram-forwarder/shared';

export function formatSourceDTO(source: ISource): SourceDTO {
  return {
    _id: source._id.toString(),
    telegramChatId: source.telegramChatId,
    title: source.title,
    username: source.username,
    type: source.type,
    status: source.status,
    lastMessageId: source.lastMessageId,
    lastIngestedAt: source.lastIngestedAt ? source.lastIngestedAt.toISOString() : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export class SourceService {
  public static async list(query: { status?: SourceStatus } = {}): Promise<SourceDTO[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const sources = await Source.find(filter).sort({ createdAt: -1 });
    return sources.map(formatSourceDTO);
  }

  public static async getById(id: string): Promise<SourceDTO> {
    const source = await Source.findById(id);
    if (!source) {
      throw new NotFoundError('Source not found');
    }
    return formatSourceDTO(source);
  }

  public static async create(data: {
    telegramChatId: string;
    title: string;
    username?: string | null;
    type?: ChatType;
  }): Promise<SourceDTO> {
    const cleanChatId = String(data.telegramChatId).trim();

    const existing = await Source.findOne({ telegramChatId: cleanChatId });
    if (existing) {
      throw new ConflictError(
        `Source with Telegram chat ID '${cleanChatId}' is already registered`,
        ErrorCodes.SOURCE_ALREADY_EXISTS
      );
    }

    const source = await Source.create({
      telegramChatId: cleanChatId,
      title: data.title.trim(),
      username: data.username ? data.username.toLowerCase().trim() : null,
      type: data.type || 'channel',
      status: 'active',
    });

    return formatSourceDTO(source);
  }

  public static async update(
    id: string,
    data: {
      title?: string;
      username?: string | null;
      status?: SourceStatus;
      type?: ChatType;
    }
  ): Promise<SourceDTO> {
    const source = await Source.findById(id);
    if (!source) {
      throw new NotFoundError('Source not found');
    }

    if (data.title !== undefined) source.title = data.title.trim();
    if (data.username !== undefined) {
      source.username = data.username ? data.username.toLowerCase().trim() : null;
    }
    if (data.status !== undefined) source.status = data.status;
    if (data.type !== undefined) source.type = data.type;

    await source.save();
    return formatSourceDTO(source);
  }

  public static async delete(id: string): Promise<void> {
    const source = await Source.findById(id);
    if (!source) {
      throw new NotFoundError('Source not found');
    }
    await Source.findByIdAndDelete(id);
  }
}
