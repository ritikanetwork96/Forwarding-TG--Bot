import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ScheduledPostStatus, PublishMode } from '@telegram-forwarder/shared';

export interface IScheduledPost extends Document {
  _id: Types.ObjectId;
  messageId: Types.ObjectId;
  createdBy?: Types.ObjectId | null;
  destinationIds: Types.ObjectId[];
  categoryId?: Types.ObjectId | null;
  publishMode: PublishMode;
  scheduledFor: Date;
  timezone: string;
  status: ScheduledPostStatus;
  queueJobId?: string | null;
  publishedAt?: Date | null;
  cancelledAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledPostSchema = new Schema<IScheduledPost>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    destinationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Destination',
        required: true,
      },
    ],
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    publishMode: {
      type: String,
      enum: ['copy', 'forward'],
      default: 'copy',
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Kolkata',
    },
    status: {
      type: String,
      enum: ['scheduled', 'processing', 'published', 'partially_published', 'failed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    queueJobId: {
      type: String,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying due schedules and status
scheduledPostSchema.index({ status: 1, scheduledFor: 1 });

export const ScheduledPost = mongoose.model<IScheduledPost>('ScheduledPost', scheduledPostSchema);
