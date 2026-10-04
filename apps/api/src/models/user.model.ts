import { Schema, model, Document, Model } from 'mongoose';
import type { UserRole, UserStatus } from '@telegram-forwarder/shared';

export interface IUser extends Document {
  email: string;
  username?: string | null;
  passwordHash: string;
  name: string;
  tokenVersion: number;
  role: UserRole;
  status: UserStatus;
  tag?: string | null;
  canManageAdmins?: boolean;
  telegramUserId?: string | null;
  resetPasswordOtp?: string | null;
  resetPasswordExpires?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return password hash by default
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tag: {
      type: String,
      default: null,
      trim: true,
    },
    canManageAdmins: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin'],
      default: 'admin',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      required: true,
    },
    telegramUserId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    resetPasswordOtp: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

export const User: Model<IUser> = model<IUser>('User', userSchema);
