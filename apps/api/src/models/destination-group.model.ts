import { Schema, model, Document, Model, Types } from 'mongoose';
import type { DestinationGroupStatus } from '@telegram-forwarder/shared';

export interface IDestinationGroup extends Document {
  name: string;
  description?: string | null;
  destinationIds: Types.ObjectId[];
  status: DestinationGroupStatus;
  createdAt: Date;
  updatedAt: Date;
}

const destinationGroupSchema = new Schema<IDestinationGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    destinationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Destination',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'destination_groups',
  }
);

destinationGroupSchema.index({ name: 1, status: 1 });

export const DestinationGroup: Model<IDestinationGroup> = model<IDestinationGroup>(
  'DestinationGroup',
  destinationGroupSchema
);
