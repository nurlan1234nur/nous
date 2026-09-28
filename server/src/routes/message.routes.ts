import { Router } from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCouple } from '../middleware/couple.js';
import { deleteStoredImage, storeUploadedImage, upload } from '../config/uploads.js';
import { emitToCouple } from '../realtime/socket.js';
import { sendMessagePush } from '../utils/push.js';

export const messageRouter = Router();

messageRouter.use(requireAuth, requireCouple);

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(200),
  before: z.coerce.date().optional(), // энэ огнооноос өмнөх зурвасууд (дээш гүйлгэхэд)
});

// Сүүлийн зурвасууд (хуучнаас шинэ рүү). Хамгийн шинэ `limit`-ийг авч эрэмбийг эргүүлнэ —
// эс бөгөөс 200-аас олон зурвастай хосод шинэ зурвас харагдахгүй болно.
messageRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, before } = listSchema.parse(req.query);
    const filter: Record<string, unknown> = { couple: req.coupleId };
    if (before) filter.createdAt = { $lt: before };
    const latest = await Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('sender', 'name avatar');
    const hasMore = latest.length > limit;
    const messages = latest.slice(0, limit).reverse();
    res.json({ messages, hasMore });
  }),
);

const sendSchema = z.object({
  text: z.string().min(1).max(4000),
  special: z.boolean().optional(),
});

messageRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { text, special } = sendSchema.parse(req.body);
    const message = await Message.create({
      couple: req.coupleId,
      sender: req.userId,
      text,
      special: special ?? false,
    });
    const populated = await message.populate('sender', 'name avatar');

    // Хосын нөгөө гишүүнд real-time дамжуулна.
    emitToCouple(req.coupleId!, 'message:new', populated);
    void sendMessagePush(req.coupleId!, req.userId!, text).catch(() => {});

    res.status(201).json({ message: populated });
  }),
);

// Зураг илгээх (multipart/form-data, талбар: image, caption?).
messageRouter.post(
  '/image',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Зураг шаардлагатай' });
      return;
    }
    const text = typeof req.body.caption === 'string' ? req.body.caption.slice(0, 500) : '';
    const image = await storeUploadedImage(req.file);
    const message = await Message.create({
        couple: req.coupleId,
        sender: req.userId,
        text,
        imageUrl: image.url,
        imagePublicId: image.publicId,
      }).catch(async (error) => {
      await deleteStoredImage(image.publicId, image.url).catch(() => {});
      throw error;
      });
    const populated = await message.populate('sender', 'name avatar');
    emitToCouple(req.coupleId!, 'message:new', populated);
    void sendMessagePush(req.coupleId!, req.userId!, text, true).catch(() => {});
    res.status(201).json({ message: populated });
  }),
);

// Чат бүхэлд нь цэвэрлэх — хосын бүх зурвасыг устгана (хоёуланд нь).
messageRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const images = await Message.find({
      couple: req.coupleId,
      imageUrl: { $ne: '' },
    }).select('imageUrl imagePublicId');
    await Message.deleteMany({ couple: req.coupleId });
    await Promise.allSettled(images.map((image) => deleteStoredImage(image.imagePublicId, image.imageUrl)));
    emitToCouple(req.coupleId!, 'messages:cleared', { by: req.userId });
    res.json({ ok: true });
  }),
);

// Зурвас татаж авах (unsend) — зөвхөн өөрийн зурвас. Агуулгыг арилгаж "татлаа" болгоно.
messageRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const message = await Message.findOne({ _id: req.params.id, couple: req.coupleId });
    if (!message) {
      res.status(404).json({ error: 'Зурвас олдсонгүй' });
      return;
    }
    if (message.sender.toString() !== req.userId) {
      res.status(403).json({ error: 'Зөвхөн өөрийн зурвасаа татаж авна' });
      return;
    }
    message.deleted = true;
    const imageUrl = message.imageUrl;
    const imagePublicId = message.imagePublicId;
    message.text = '';
    message.imageUrl = '';
    message.imagePublicId = '';
    await message.save();
    await deleteStoredImage(imagePublicId, imageUrl).catch(() => {});
    const populated = await message.populate('sender', 'name avatar');
    emitToCouple(req.coupleId!, 'message:update', populated);
    res.json({ message: populated });
  }),
);

// Чатыг "уншсан" гэж тэмдэглэх — нөгөө талд "Үзсэн" харагдана.
messageRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const at = new Date();
    await User.findByIdAndUpdate(req.userId, { lastReadAt: at });
    emitToCouple(req.coupleId!, 'message:read', { userId: req.userId, at: at.toISOString() });
    res.json({ ok: true });
  }),
);
