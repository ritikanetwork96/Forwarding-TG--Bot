import { Schema, model, Document, Model, Types } from 'mongoose';
import type {
  MessageType,
  MessageStatus,
  MessageContent,
  MessageDeliverySummary,
} from '@telegram-forwarder/shared';

export interface IMessage extends Document {
  sourceId?: Types.ObjectId | null;
  categoryId?: Types.ObjectId | null;
  telegramChatId?: string | null;
  telegramMessageId?: number | null;
  mediaGroupId?: string | null;
  messageType: MessageType;
  content: MessageContent;
  status: MessageStatus;
  deliverySummary: MessageDeliverySummary;
  isEditedAtSource: boolean;
  sourceEditedAt?: Date | null;
  silentPublish?: boolean;
  pinOnPublish?: boolean;
  disableWebPreview?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mediaItemSchema = new Schema(
  {
    mediaType: {
      type: String,
      enum: ['photo', 'video', 'document', 'audio', 'animation'],
      required: true,
    },
    fileId: {
      type: String,
      required: true,
      trim: true,
    },
    fileUniqueId: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      default: '',
    },
    entities: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    fileSize: { type: Number },
    fileName: { type: String },
    mimeType: { type: String },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    telegramChatId: {
      type: String,
      trim: true,
    },
    telegramMessageId: {
      type: Number,
    },
    mediaGroupId: {
      type: String,
      sparse: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'photo', 'video', 'document', 'audio', 'animation', 'album'],
      default: 'text',
      required: true,
    },
    content: {
      text: {
        type: String,
        default: '',
      },
      entities: {
        type: [Schema.Types.Mixed],
        default: [],
      },
      mediaItems: {
        type: [mediaItemSchema],
        default: [],
      },
      mediaGroupId: {
        type: String,
        default: null,
      },
      buttons: {
        type: [Schema.Types.Mixed],
        default: [],
      },
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'publishing',
        'published',
        'partially_published',
        'failed',
        'archived',
      ],
      default: 'draft',
      required: true,
      index: true,
    },
    deliverySummary: {
      targetCount: {
        type: Number,
        default: 0,
      },
      successfulDestinationIds: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Destination',
        },
      ],
      failedDestinationIds: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Destination',
        },
      ],
      lastAttemptedAt: {
        type: Date,
        default: null,
      },
    },
    isEditedAtSource: {
      type: Boolean,
      default: false,
    },
    sourceEditedAt: {
      type: Date,
      default: null,
    },
    silentPublish: {
      type: Boolean,
      default: false,
    },
    pinOnPublish: {
      type: Boolean,
      default: false,
    },
    disableWebPreview: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

// Compound sparse unique index for absolute deduplication of incoming Telegram messages
messageSchema.index({ telegramChatId: 1, telegramMessageId: 1 }, { unique: true, sparse: true });

// Status query index
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ sourceId: 1, createdAt: -1 });
messageSchema.index({ 'content.mediaItems.fileUniqueId': 1 }, { sparse: true });

export const Message: Model<IMessage> = model<IMessage>('Message', messageSchema);
