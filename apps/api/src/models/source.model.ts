import { Schema, model, Document, Model } from 'mongoose';
import type { ChatType, SourceStatus } from '@telegram-forwarder/shared';

export interface ISource extends Document {
  telegramChatId: string;
  title: string;
  username?: string | null;
  type: ChatType;
  status: SourceStatus;
  lastMessageId?: number | null;
  lastIngestedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    telegramChatId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['channel', 'supergroup', 'group'],
      default: 'channel',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled'],
      default: 'active',
      required: true,
      index: true,
    },
    lastMessageId: {
      type: Number,
      default: null,
    },
    lastIngestedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'sources',
  }
);

export const Source: Model<ISource> = model<ISource>('Source', sourceSchema);
