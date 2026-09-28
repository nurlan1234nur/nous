import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

let io: SocketServer | null = null;

// coupleId → онлайн userId-уудын тоолуур (хэрэглэгч олон таб нээж болно).
const presence = new Map<string, Map<string, number>>();
// coupleId → (userId → сүүлд офлайн болсон timestamp ms).
const lastSeen = new Map<string, Map<string, number>>();

// Хос бүр өөрийн "room"-той — зөвхөн тэр хосын гишүүд event авна.
function coupleRoom(coupleId: string): string {
  return `couple:${coupleId}`;
}

function onlineUserIds(coupleId: string): string[] {
  return [...(presence.get(coupleId)?.keys() ?? [])];
}

// presence event-ийн payload: онлайн ID-ууд + сүүлд online байсан огноо.
function presencePayload(coupleId: string): { online: string[]; lastSeen: Record<string, string> } {
  const seen: Record<string, string> = {};
  for (const [uid, ts] of lastSeen.get(coupleId)?.entries() ?? []) {
    seen[uid] = new Date(ts).toISOString();
  }
  return { online: onlineUserIds(coupleId), lastSeen: seen };
}

function setLastSeen(coupleId: string, userId: string): void {
  let m = lastSeen.get(coupleId);
  if (!m) {
    m = new Map();
    lastSeen.set(coupleId, m);
  }
  m.set(userId, Date.now());
}

function bumpPresence(coupleId: string, userId: string, delta: number): void {
  let users = presence.get(coupleId);
  if (!users) {
    users = new Map();
    presence.set(coupleId, users);
  }
  const next = (users.get(userId) ?? 0) + delta;
  if (next <= 0) users.delete(userId);
  else users.set(userId, next);
}

export function initSocket(server: HttpServer): void {
  io = new SocketServer(server, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  // Socket-ийн JWT баталгаажуулалт.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Token шаардлагатай'));
      const { userId } = verifyToken(token);
      const user = await User.findById(userId).select('couple');
      if (!user?.couple) return next(new Error('Хос холбоогүй'));
      socket.data.coupleId = user.couple.toString();
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('Нэвтрэлт амжилтгүй'));
    }
  });

  io.on('connection', (socket) => {
    const coupleId = socket.data.coupleId as string;
    const userId = socket.data.userId as string;
    socket.join(coupleRoom(coupleId));

    bumpPresence(coupleId, userId, 1);
    io?.to(coupleRoom(coupleId)).emit('presence', presencePayload(coupleId));

    // Listener-ээ холболтын дараа бүртгэсэн client (жнь mobile) одоогийн төлвийг асууна.
    socket.on('presence:get', () => {
      socket.emit('presence', presencePayload(coupleId));
    });

    socket.on('typing', (isTyping: boolean) => {
      socket.to(coupleRoom(coupleId)).emit('partner:typing', isTyping);
    });

    socket.on('disconnect', () => {
      bumpPresence(coupleId, userId, -1);
      // Бүх таб хаагдсан бол л офлайн — сүүлд online огноог тэмдэглэнэ.
      if (!onlineUserIds(coupleId).includes(userId)) {
        setLastSeen(coupleId, userId);
        void User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});
      }
      io?.to(coupleRoom(coupleId)).emit('presence', presencePayload(coupleId));
    });
  });
}

// Route-уудаас real-time event илгээх.
export function emitToCouple(coupleId: string, event: string, payload: unknown): void {
  io?.to(coupleRoom(coupleId)).emit(event, payload);
}
