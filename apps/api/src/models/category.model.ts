import { Schema, model, Document, Model, Types } from 'mongoose';
import type { CategoryStatus } from '@telegram-forwarder/shared';

export interface ICategory extends Document {
  name: string;
  displayName?: string;
  iconEmoji?: string;
  customEmojiId?: string;
  slug: string;
  description?: string;
  icon?: string;
  destinationIds?: Types.ObjectId[];
  status: CategoryStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    displayName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    iconEmoji: {
      type: String,
      default: '📁',
      trim: true,
    },
    customEmojiId: {
      type: String,
      default: null,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    icon: {
      type: String,
      default: 'Folder',
      trim: true,
    },
    destinationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Destination',
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
  }
);

export const Category: Model<ICategory> = model<ICategory>('Category', categorySchema);
