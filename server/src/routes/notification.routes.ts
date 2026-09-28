import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { pushEnabled } from '../utils/push.js';
import { WebPushSubscription } from '../models/WebPushSubscription.js';
import { ExpoPushToken } from '../models/ExpoPushToken.js';
import { isExpoPushToken } from '../utils/expoPush.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/config', (_req, res) => {
  res.json({ enabled: pushEnabled, publicKey: pushEnabled ? env.vapidPublicKey : '' });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

notificationRouter.post(
  '/subscribe',
  asyncHandler(async (req, res) => {
    if (!pushEnabled) {
      res.status(503).json({ error: 'Push notification тохируулагдаагүй байна' });
      return;
    }
    const subscription = subscriptionSchema.parse(req.body);
    await WebPushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        user: req.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { upsert: true, new: true },
    );
    res.status(201).json({ ok: true });
  }),
);

notificationRouter.delete(
  '/subscribe',
  asyncHandler(async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await WebPushSubscription.deleteOne({ user: req.userId, endpoint });
    res.json({ ok: true });
  }),
);

// ---- Native (Expo) push token ----

const expoTokenSchema = z.object({
  token: z.string().refine(isExpoPushToken, 'Expo push token биш байна'),
  platform: z.enum(['ios', 'android', 'unknown']).optional(),
});

notificationRouter.post(
  '/expo',
  asyncHandler(async (req, res) => {
    const { token, platform } = expoTokenSchema.parse(req.body);
    // Төхөөрөмж өөр хэрэглэгчээр нэвтэрвэл token шинэ эзэндээ шилжинэ.
    await ExpoPushToken.findOneAndUpdate(
      { token },
      { user: req.userId, token, platform: platform ?? 'unknown' },
      { upsert: true, new: true },
    );
    res.status(201).json({ ok: true });
  }),
);

notificationRouter.delete(
  '/expo',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await ExpoPushToken.deleteOne({ user: req.userId, token });
    res.json({ ok: true });
  }),
);
