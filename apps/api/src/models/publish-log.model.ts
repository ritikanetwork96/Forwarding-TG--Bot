import { Schema, model, Document, Model, Types } from 'mongoose';
import type { PublishMode, PublishLogStatus, PublishLogError } from '@telegram-forwarder/shared';

export interface IPublishLog extends Document {
  messageId: Types.ObjectId;
  sourceId?: Types.ObjectId | null;
  categoryId?: Types.ObjectId | null;
  destinationId: Types.ObjectId;
  ruleId?: Types.ObjectId | null;
  triggeredBy?: Types.ObjectId | null;
  publishMode: PublishMode;
  status: PublishLogStatus;
  targetTelegramMessageId?: number | null;
  targetTelegramMessageIds: number[];
  error?: PublishLogError | null;
  executionTimeMs: number;
  createdAt: Date;
}

const publishLogSchema = new Schema<IPublishLog>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    destinationId: {
      type: Schema.Types.ObjectId,
      ref: 'Destination',
      required: true,
      index: true,
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'ForwardingRule',
      default: null,
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishMode: {
      type: String,
      enum: ['forward', 'copy'],
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    targetTelegramMessageId: {
      type: Number,
      default: null,
    },
    targetTelegramMessageIds: {
      type: [Number],
      default: [],
    },
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
      rawTelegram: { type: Schema.Types.Mixed, default: null },
    },
    executionTimeMs: {
      type: Number,
      default: 0,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
    collection: 'publish_logs',
  }
);

publishLogSchema.index({ destinationId: 1, createdAt: -1 });
publishLogSchema.index({ status: 1, createdAt: -1 });

export const PublishLog: Model<IPublishLog> = model<IPublishLog>('PublishLog', publishLogSchema);
