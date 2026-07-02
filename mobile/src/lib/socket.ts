import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from '../config/env';
import { getToken } from './tokenStorage';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (!API_ORIGIN) throw new Error('EXPO_PUBLIC_API_ORIGIN is not configured');
  if (!socket) {
    socket = io(API_ORIGIN, { auth: { token: await getToken() } });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
