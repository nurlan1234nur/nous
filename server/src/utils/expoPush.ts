import { env } from '../config/env.js';
import { ExpoPushToken } from '../models/ExpoPushToken.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_RE.test(token);
}

export interface NativePushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

// Expo push service рүү илгээнэ. Хүчингүй болсон token-ийг (DeviceNotRegistered) устгана.
export async function sendExpoPush(userIds: string[], message: NativePushMessage): Promise<void> {
  if (!env.expoPushEnabled || env.isTest || userIds.length === 0) return;

  const tokens = await ExpoPushToken.find({ user: { $in: userIds } }).select('token');
  if (tokens.length === 0) return;

  // Expo нэг хүсэлтэд 100 хүртэл мессеж авна.
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const payload = chunk.map((t) => ({
      to: t.token,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
      channelId: 'messages',
    }));

    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[EXPO PUSH] HTTP ${res.status}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const stale = (json.data ?? [])
      .map((ticket, idx) => (ticket.details?.error === 'DeviceNotRegistered' ? chunk[idx].token : null))
      .filter((t): t is string => Boolean(t));
    if (stale.length) {
      // eslint-disable-next-line no-await-in-loop
      await ExpoPushToken.deleteMany({ token: { $in: stale } });
    }
  }
}
