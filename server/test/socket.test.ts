import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { app, api, auth, createCouple, createUser } from './helpers.js';
import { initSocket } from '../src/realtime/socket.js';

let server: Server;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = createServer(app);
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function open(token?: string): Socket {
  const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(s);
  return s;
}

const once = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event, (payload: T) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

describe('socket.io', () => {
  it('rejects connections without a valid token or couple', async () => {
    const err1 = await once<Error>(open(), 'connect_error');
    expect(err1.message).toBe('Token шаардлагатай');
    const err2 = await once<Error>(open('junk'), 'connect_error');
    expect(err2.message).toBe('Нэвтрэлт амжилтгүй');
    const solo = await createUser('solo');
    const err3 = await once<Error>(open(solo.token), 'connect_error');
    expect(err3.message).toBe('Хос холбоогүй');
  });

  it('delivers events only to the same couple and reports presence', async () => {
    const one = await createCouple('a1', 'b1');
    const two = await createCouple('a2', 'b2');
    const partner = open(one.b.token);
    const stranger = open(two.b.token);
    await Promise.all([once(partner, 'connect'), once(stranger, 'connect')]);

    partner.emit('presence:get');
    const presence = await once<{ online: string[] }>(partner, 'presence');
    expect(presence.online).toContain(one.b.id);

    let leaked = false;
    stranger.on('message:new', () => {
      leaked = true;
    });
    const received = once<{ text: string }>(partner, 'message:new');
    await api().post('/api/messages').set(auth(one.a)).send({ text: 'hello over socket' });
    expect((await received).text).toBe('hello over socket');
    await new Promise((r) => setTimeout(r, 100));
    expect(leaked).toBe(false);
  });

  it('forwards typing to the partner but not back to the sender', async () => {
    const { a, b } = await createCouple();
    const sa = open(a.token);
    const sb = open(b.token);
    await Promise.all([once(sa, 'connect'), once(sb, 'connect')]);
    let echoed = false;
    sa.on('partner:typing', () => {
      echoed = true;
    });
    const typing = once<boolean>(sb, 'partner:typing');
    sa.emit('typing', true);
    expect(await typing).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(echoed).toBe(false);
  });
});
