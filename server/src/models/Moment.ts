import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// Нүүр feed болон Дурсамж grid-д харагдах зураг пост.
const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
  },
  { _id: false },
);

const momentSchema = new Schema(
  {
    couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, default: '' },
    caption: { type: String, trim: true, maxlength: 500, default: '' },
    reactions: { type: [reactionSchema], default: [] },
  },
  { timestamps: true },
);

momentSchema.index({ couple: 1, imageUrl: 1 }); // /uploads эрхийн шалгалт

export type MomentDoc = InferSchemaType<typeof momentSchema> & { _id: Types.ObjectId };

export const Moment = model('Moment', momentSchema);
