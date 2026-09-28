import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// Имэйл рүү илгээсэн нэг удаагийн баталгаажуулах код.
// expiresAt дээр TTL index — хугацаа дуусмагц MongoDB автоматаар устгана.
const otpSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true }, // код очих жинхэнэ Gmail
  code: { type: String, required: true },
  purpose: { type: String, enum: ['register', 'reset', 'change-email'], required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // reset/change-email-д хэрэглэгчтэй холбоно
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 }, // буруу оролдлогын тоо (brute-force хамгаалалт)
  createdAt: { type: Date, default: Date.now },
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof otpSchema> & { _id: Types.ObjectId };

export const OtpCode = model('OtpCode', otpSchema);
