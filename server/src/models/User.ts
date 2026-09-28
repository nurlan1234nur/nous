import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Сэргээх жинхэнэ Gmail (OTP илгээх хаяг). Заавал биш — seed/хуучин хэрэглэгчид null.
    recoveryEmail: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    // Emoji (жнь '💛') эсвэл байршуулсан зургийн зам (/uploads/...).
    avatar: { type: String, default: '💛' },
    avatarPublicId: { type: String, default: '' },
    // Богино статус/тухай мөр (профайлд харагдана).
    status: { type: String, default: '', trim: true },
    // Аппын өнгөний загвар (rose | sunset | ocean | violet | forest).
    theme: { type: String, default: 'rose' },
    birthday: { type: String, default: '' }, // YYYY-MM-DD (чухал огнуудад ашиглана)
    couple: { type: Schema.Types.ObjectId, ref: 'Couple', default: null },
    // Өдөр алгасалгүй идэвхтэй байсан дараалал (🔥 streak).
    streak: { type: Number, default: 0 },
    lastActiveAt: { type: String, default: '' }, // YYYY-MM-DD (сүүлд идэвхтэй байсан өдөр)
    lastSeenAt: { type: Date, default: null }, // сүүлд онлайн байсан (офлайн үед "тэдэн минутын өмнө")
    lastReadAt: { type: Date, default: null }, // чатыг сүүлд уншсан үе ("Үзсэн" тэмдэг)
  },
  { timestamps: true },
);

// Нэг Gmail = нэг бүртгэл. null/байхгүй утгыг алгасахын тулд partial index.
userSchema.index(
  { recoveryEmail: 1 },
  { unique: true, partialFilterExpression: { recoveryEmail: { $type: 'string' } } },
);

userSchema.index({ couple: 1, avatar: 1 }); // /uploads эрхийн шалгалт

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User = model('User', userSchema);
