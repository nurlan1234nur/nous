import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// Native (Expo) app-ийн push token. Нэг хэрэглэгч олон төхөөрөмжтэй байж болно.
const expoPushTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'unknown'], default: 'unknown' },
  },
  { timestamps: true },
);

export type ExpoPushTokenDoc = InferSchemaType<typeof expoPushTokenSchema> & { _id: Types.ObjectId };

export const ExpoPushToken = model('ExpoPushToken', expoPushTokenSchema);
