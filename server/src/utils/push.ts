import webpush from 'web-push';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { WebPushSubscription } from '../models/WebPushSubscription.js';
import { sendExpoPush } from './expoPush.js';
import { logger } from './logger.js';

export const pushEnabled = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (pushEnabled) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export async function sendMessagePush(
  coupleId: string,
  senderId: string,
  text: string,
  hasImage = false,
): Promise<void> {
  const [sender, recipients] = await Promise.all([
    User.findById(senderId).select('name'),
    User.find({ couple: coupleId, _id: { $ne: senderId } }).select('_id'),
  ]);
  if (!sender || recipients.length === 0) return;

  const body = text.trim().slice(0, 120) || (hasImage ? 'Зураг илгээлээ' : 'Шинэ зурвас ирлээ');

  // Native app (Expo) — VAPID-аас хамааралгүй.
  await sendExpoPush(
    recipients.map((recipient) => recipient._id.toString()),
    { title: sender.name, body, data: { url: '/chat', type: 'message' } },
  ).catch((err) => logger.error({ err }, 'Expo push failed'));

  if (!pushEnabled) return;

  const subscriptions = await WebPushSubscription.find({
    user: { $in: recipients.map((recipient) => recipient._id) },
  });
  const payload = JSON.stringify({
    title: sender.name,
    body,
    url: '/chat',
    tag: `message:${coupleId}`,
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await subscription.deleteOne();
        }
      }
    }),
  );
}
