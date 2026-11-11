import { model, Schema, type HydratedDocument } from 'mongoose';

interface World {
  name: string;
  data: Buffer;
  size: { x: number; y: number; z: number };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WorldDocument = HydratedDocument<World>;

const WorldSchema = new Schema<World>({
  name: {
    type: String,
    required: true,
  },
  data: {
    type: Buffer,
    required: true,
  },
  size: {
    type: {
      x: {
        type: Number,
        required: true,
      },
      y: {
        type: Number,
        required: true,
      },
      z: {
        type: Number,
        required: true,
      },
    },
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  createdAt: { type: Date, index: -1 },
  updatedAt: Date,
}, { timestamps: true });

export const World = model<World>('World', WorldSchema);
