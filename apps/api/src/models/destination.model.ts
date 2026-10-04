import { Schema, model, Document, Model } from 'mongoose';
import type {
  ChatType,
  DestinationStatus,
  DestinationVerification,
} from '@telegram-forwarder/shared';

export interface IDestination extends Document {
  telegramChatId: string;
  title: string;
  displayName?: string | null;
  iconEmoji?: string | null;
  customEmojiId?: string | null;
  username?: string | null;
  type: ChatType;
  status: DestinationStatus;
  verification: DestinationVerification;
  createdAt: Date;
  updatedAt: Date;
}

const destinationSchema = new Schema<IDestination>(
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
    displayName: {
      type: String,
      default: null,
      trim: true,
    },
    iconEmoji: {
      type: String,
      default: null,
      trim: true,
    },
    customEmojiId: {
      type: String,
      default: null,
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
      enum: ['pending', 'active', 'permission_missing', 'invalid', 'disabled'],
      default: 'pending',
      required: true,
      index: true,
    },
    verification: {
      chatType: {
        type: String,
        enum: ['channel', 'supergroup', 'group'],
        default: 'channel',
        required: true,
      },
      isForum: {
        type: Boolean,
        default: false,
      },
      botRole: {
        type: String,
        enum: ['creator', 'administrator', 'member', 'restricted', 'left', 'kicked', 'unknown'],
        default: 'unknown',
      },
      isMember: {
        type: Boolean,
        default: false,
      },
      canPublish: {
        type: Boolean,
        default: false,
      },
      canSendAsChat: {
        type: Boolean,
        default: false,
      },
      senderIdentity: {
        type: String,
        enum: ['channel', 'anonymous_admin', 'bot'],
        default: 'bot',
      },
      rights: {
        canPostMessages: { type: Boolean, default: false },
        canSendMessages: { type: Boolean, default: false },
        canEditMessages: { type: Boolean, default: false },
        canDeleteMessages: { type: Boolean, default: false },
        canManageTopics: { type: Boolean, default: false },
      },
      lastCheckedAt: {
        type: Date,
        default: null,
      },
      failureReason: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    collection: 'destinations',
  }
);

export const Destination: Model<IDestination> = model<IDestination>(
  'Destination',
  destinationSchema
);
