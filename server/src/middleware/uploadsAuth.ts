import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Moment } from '../models/Moment.js';
import { Message } from '../models/Message.js';
import { verifyMediaToken } from '../utils/mediaToken.js';

// Нэг зургийг ойр ойрхон ачаалахад (scroll) DB-г дахин асуухгүйн тулд богино хугацааны кэш.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 5000;
const cache = new Map<string, { allowed: boolean; at: number }>();

function cached(key: string): boolean | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.allowed;
}

function remember(key: string, allowed: boolean): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { allowed, at: Date.now() });
}

export function clearUploadsAuthCache(): void {
  cache.clear();
}

// Хэрэглэгч энэ зургийг харах эрхтэй эсэх: өөрийн avatar, эсвэл өөрийн хосын
// дурсамж / чатын зураг / гишүүний avatar.
async function canView(userId: string, url: string): Promise<boolean> {
  const user = await User.findById(userId).select('couple avatar');
  if (!user) return false;
  if (user.avatar === url) return true;
  if (!user.couple) return false;
  const couple = user.couple;
  const [moment, message, member] = await Promise.all([
    Moment.exists({ couple, imageUrl: url }),
    Message.exists({ couple, imageUrl: url }),
    User.exists({ couple, avatar: url }),
  ]);
  return Boolean(moment || message || member);
}

// /uploads/* — `?t=<media token>` шаардана. Эрхгүй бол 404 (файл байгаа эсэхийг ч илчлэхгүй).
export async function requireUploadAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (env.uploadsPublic) {
    next();
    return;
  }
  try {
    const token = typeof req.query.t === 'string' ? req.query.t : '';
    const userId = token ? verifyMediaToken(token) : null;
    if (!userId) {
      res.status(401).json({ error: 'Зураг харахын тулд нэвтэрнэ үү' });
      return;
    }
    const url = `/uploads/${path.basename(req.path)}`;
    const key = `${userId}:${url}`;
    let allowed = cached(key);
    if (allowed === undefined) {
      allowed = await canView(userId, url);
      remember(key, allowed);
    }
    if (!allowed) {
      res.status(404).json({ error: 'Олдсонгүй' });
      return;
    }
    // Хувийн зураг — зөвхөн хэрэглэгчийн төхөөрөмж кэшлэнэ (CDN/proxy биш).
    res.setHeader('Cache-Control', 'private, max-age=86400');
    next();
  } catch (err) {
    next(err);
  }
}
