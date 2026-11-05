import { io, type Socket } from 'socket.io-client';
import { getToken, BASE_PREFIX } from './api';

let socket: Socket | null = null;
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? BASE_PREFIX;
const IS_ABSOLUTE = /^https?:\/\//.test(API_ORIGIN);

// Нэвтэрсэн token-оор socket холбоно. Чат/mood real-time event энд ирнэ.
export function getSocket(): Socket {
  if (!socket) {
    // Абсолют origin бол шууд холбоно; үгүй бол одоогийн origin + (/nous)/socket.io зам.
    socket = io(IS_ABSOLUTE ? API_ORIGIN : undefined, {
      path: `${IS_ABSOLUTE ? '' : API_ORIGIN}/socket.io`,
      auth: { token: getToken() },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
