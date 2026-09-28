import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Couple } from '../models/Couple.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const coupleRouter = Router();

// Андуурагдах тэмдэгтгүй (0/O, 1/I) 6 оронтой код.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const code = makeInviteCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await Couple.exists({ inviteCode: code }))) return code;
  }
  throw new Error('Урилгын код үүсгэж чадсангүй');
}

// Шинэ хос үүсгэж урилгын код авах.
coupleRouter.post(
  '/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
      return;
    }
    if (user.couple) {
      res.status(409).json({ error: 'Та аль хэдийн хостой байна' });
      return;
    }

    const couple = await Couple.create({ inviteCode: await uniqueInviteCode(), members: [user._id] });
    user.couple = couple._id;
    await user.save();

    res.status(201).json({ couple: { id: couple._id, inviteCode: couple.inviteCode, members: couple.members } });
  }),
);

// Урилгын кодоор хосд нэгдэх.
const joinSchema = z.object({ inviteCode: z.string().min(1) });

coupleRouter.post(
  '/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { inviteCode } = joinSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
      return;
    }
    if (user.couple) {
      res.status(409).json({ error: 'Та аль хэдийн хостой байна' });
      return;
    }

    const code = inviteCode.trim().toUpperCase();
    // Атомик нэгдэлт: хоёр хүн зэрэг нэгдэхэд 3 гишүүнтэй хос үүсэхээс сэргийлнэ.
    const couple = await Couple.findOneAndUpdate(
      { inviteCode: code, 'members.1': { $exists: false }, members: { $ne: user._id } },
      { $push: { members: user._id } },
      { new: true },
    );
    if (!couple) {
      const exists = await Couple.exists({ inviteCode: code });
      if (!exists) res.status(404).json({ error: 'Урилгын код буруу байна' });
      else res.status(409).json({ error: 'Энэ хос дүүрсэн байна' });
      return;
    }

    user.couple = couple._id;
    await user.save();

    res.json({ couple: { id: couple._id, inviteCode: couple.inviteCode, members: couple.members } });
  }),
);

// Хосын мэдээлэл засах (одоогоор anniversary).
const updateSchema = z.object({ anniversary: z.coerce.date() });

coupleRouter.patch(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { anniversary } = updateSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user?.couple) {
      res.status(403).json({ error: 'Та эхлээд хосоо холбоно уу' });
      return;
    }
    const couple = await Couple.findByIdAndUpdate(
      user.couple,
      { anniversary },
      { new: true },
    ).populate('members', 'name avatar status email birthday lastSeenAt lastReadAt');
    res.json({ couple });
  }),
);

// Хосын аль ч гишүүний төрсөн өдрийг тохируулах (хоёулаа нэг газраас).
const birthdaySchema = z.object({
  memberId: z.string().min(1),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
});

coupleRouter.patch(
  '/birthday',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { memberId, birthday } = birthdaySchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user?.couple) {
      res.status(403).json({ error: 'Та эхлээд хосоо холбоно уу' });
      return;
    }
    const couple = await Couple.findById(user.couple);
    if (!couple || !couple.members.some((m) => m.toString() === memberId)) {
      res.status(403).json({ error: 'Энэ гишүүн таны хост биш' });
      return;
    }
    await User.findByIdAndUpdate(memberId, { birthday });
    const populated = await Couple.findById(user.couple).populate(
      'members',
      'name avatar status email birthday lastSeenAt lastReadAt',
    );
    res.json({ couple: populated });
  }),
);

// Өөрийн хосын мэдээлэл + хоёр гишүүн.
coupleRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user?.couple) {
      res.json({ couple: null });
      return;
    }
    const couple = await Couple.findById(user.couple).populate('members', 'name avatar status email birthday lastSeenAt lastReadAt');
    res.json({ couple });
  }),
);
