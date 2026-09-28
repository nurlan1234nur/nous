import type { Model } from 'mongoose';
import { User } from '../models/User.js';
import { Couple } from '../models/Couple.js';
import { OtpCode } from '../models/OtpCode.js';
import { WebPushSubscription } from '../models/WebPushSubscription.js';
import { ExpoPushToken } from '../models/ExpoPushToken.js';
import { Message } from '../models/Message.js';
import { Moment } from '../models/Moment.js';
import { Capsule } from '../models/Capsule.js';
import { GameRound } from '../models/GameRound.js';
import { WeeklySong } from '../models/WeeklySong.js';
import { Wish } from '../models/Wish.js';
import { BattleshipGame } from '../models/BattleshipGame.js';
import { LoveNote } from '../models/LoveNote.js';
import { Mood } from '../models/Mood.js';
import { WhoIsMoreQuiz } from '../models/WhoIsMoreQuiz.js';
import { NumberGuessGame } from '../models/NumberGuessGame.js';
import { Milestone } from '../models/Milestone.js';
import { DailyAnswer } from '../models/DailyAnswer.js';
import { deleteStoredImage } from '../config/uploads.js';
import { emitToCouple } from '../realtime/socket.js';

// Хосын бүх өгөгдөлтэй collection-ууд (бүгд `couple` талбартай).
const COUPLE_MODELS: Array<Model<any>> = [
  Message,
  Moment,
  Capsule,
  GameRound,
  WeeklySong,
  Wish,
  BattleshipGame,
  LoveNote,
  Mood,
  WhoIsMoreQuiz,
  NumberGuessGame,
  Milestone,
  DailyAnswer,
];

async function deleteCoupleData(coupleId: string): Promise<void> {
  const images = [
    ...(await Message.find({ couple: coupleId, imageUrl: { $nin: ['', null] } }).select('imageUrl imagePublicId')),
    ...(await Moment.find({ couple: coupleId }).select('imageUrl imagePublicId')),
  ];
  await Promise.all(COUPLE_MODELS.map((m) => m.deleteMany({ couple: coupleId })));
  await Couple.deleteOne({ _id: coupleId });
  await Promise.allSettled(images.map((img) => deleteStoredImage(img.imagePublicId, img.imageUrl)));
}

// Хэрэглэгчийн бүртгэлийг бүрмөсөн устгана (App Store / Play Store шаардлага).
// Хос нь хоёулаа байсан бол хосын өгөгдөл хадгалагдаж, нөгөө гишүүн нь ганцаараа үлдэнэ —
// харин хамгийн сүүлийн гишүүн устгавал хосын бүх өгөгдөл устна.
export async function deleteAccount(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const coupleId = user.couple?.toString();
  if (coupleId) {
    const couple = await Couple.findByIdAndUpdate(coupleId, { $pull: { members: user._id } }, { new: true });
    if (!couple || couple.members.length === 0) {
      await deleteCoupleData(coupleId);
    } else {
      emitToCouple(coupleId, 'couple:member-left', { userId });
    }
  }

  await Promise.all([
    WebPushSubscription.deleteMany({ user: user._id }),
    ExpoPushToken.deleteMany({ user: user._id }),
    OtpCode.deleteMany({ $or: [{ user: user._id }, ...(user.recoveryEmail ? [{ email: user.recoveryEmail }] : [])] }),
  ]);
  await user.deleteOne();
  await deleteStoredImage(user.avatarPublicId, user.avatar).catch(() => {});
}
