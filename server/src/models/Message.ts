import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const messageSchema = new Schema(
  {
    couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', trim: true, maxlength: 4000 },
    imageUrl: { type: String, default: '' }, // зураг илгээсэн бол
    imagePublicId: { type: String, default: '' },
    deleted: { type: Boolean, default: false }, // татаж авсан бол ("X зурвасаа татлаа")
    special: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index(
  { couple: 1, imageUrl: 1 },
  { partialFilterExpression: { imageUrl: { $gt: '' } } }, // /uploads эрхийн шалгалт (зөвхөн зурагтай)
);

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };

export const Message = model('Message', messageSchema);
