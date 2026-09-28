import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from '../config/env';
import { getToken } from './tokenStorage';

let socket: Socket | null = null;
let appStateSub: { remove: () => void } | null = null;

export async function getSocket(): Promise<Socket> {
  if (!API_ORIGIN) throw new Error('EXPO_PUBLIC_API_ORIGIN is not configured');
  if (!socket) {
    socket = io(API_ORIGIN, {
      // Дахин холбогдох бүрт token-ийг шинээр уншина (logout/login-ийн дараа хуучин token ашиглахгүй).
      auth: (cb) => {
        void getToken().then((token) => cb({ token }));
      },
      transports: ['websocket'],
      reconnectionDelayMax: 10_000,
    });

    // Утас background-д удаан байхад OS socket-ийг тасалдаг — foreground болоход шууд сэргээнэ.
    appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && socket && !socket.connected) socket.connect();
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  appStateSub?.remove();
  appStateSub = null;
  socket?.disconnect();
  socket = null;
}
