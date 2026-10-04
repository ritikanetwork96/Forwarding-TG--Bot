import { Schema, model, Document, Model, Types } from 'mongoose';
import type { PublishMode, WorkflowType } from '@telegram-forwarder/shared';

export interface IForwardingRule extends Document {
  name: string;
  sourceId?: Types.ObjectId | null;
  categoryId?: Types.ObjectId | null;
  destinationIds: Types.ObjectId[];
  destinationGroupIds: Types.ObjectId[];
  publishMode: PublishMode;
  workflowType: WorkflowType;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const forwardingRuleSchema = new Schema<IForwardingRule>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
      required: false,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    destinationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Destination',
      },
    ],
    destinationGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'DestinationGroup',
      },
    ],
    publishMode: {
      type: String,
      enum: ['forward', 'copy'],
      default: 'copy',
      required: true,
    },
    workflowType: {
      type: String,
      enum: ['manual_approval', 'automatic'],
      default: 'manual_approval',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'forwarding_rules',
  }
);

forwardingRuleSchema.index({ sourceId: 1, isActive: 1 });
forwardingRuleSchema.index({ isActive: 1, priority: -1 });

export const ForwardingRule: Model<IForwardingRule> = model<IForwardingRule>(
  'ForwardingRule',
  forwardingRuleSchema
);
