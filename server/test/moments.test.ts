import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { api, auth, createCouple, createUser } from './helpers.js';
import { uploadsDir } from '../src/config/uploads.js';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('moments', () => {
  it('upload → react → partner cannot delete → author deletes (file removed)', async () => {
    const { a, b } = await createCouple();
    const up = await api()
      .post('/api/moments')
      .set(auth(a))
      .field('caption', 'first date')
      .attach('image', PNG, { filename: 'x.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    const { moment } = up.body;
    expect(moment.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
    const file = path.join(uploadsDir, path.basename(moment.imageUrl));
    expect(fs.existsSync(file)).toBe(true);

    const react = await api().post(`/api/moments/${moment._id}/react`).set(auth(b)).send({ emoji: '❤️' });
    expect(react.body.moment.reactions).toHaveLength(1);
    const unreact = await api().post(`/api/moments/${moment._id}/react`).set(auth(b)).send({ emoji: '❤️' });
    expect(unreact.body.moment.reactions).toHaveLength(0);

    expect((await api().delete(`/api/moments/${moment._id}`).set(auth(b))).status).toBe(403);
    expect((await api().delete(`/api/moments/${moment._id}`).set(auth(a))).status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects non-image uploads and missing files', async () => {
    const { a } = await createCouple();
    const txt = await api()
      .post('/api/moments')
      .set(auth(a))
      .attach('image', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);
    expect((await api().post('/api/moments').set(auth(a)).field('caption', 'x')).status).toBe(400);
  });
});

describe('chat images', () => {
  it('image message → listed in /messages/media → unsend removes it', async () => {
    const { a, b } = await createCouple();
    await api().post('/api/messages').set(auth(a)).send({ text: 'text only' });
    const img = await api()
      .post('/api/messages/image')
      .set(auth(a))
      .field('caption', 'look')
      .attach('image', PNG, { filename: 'c.png', contentType: 'image/png' });
    expect(img.status).toBe(201);
    expect(img.body.message).toMatchObject({ text: 'look' });

    const media = await api().get('/api/messages/media').set(auth(b));
    expect(media.body.media).toHaveLength(1);
    expect(media.body.media[0].imageUrl).toBe(img.body.message.imageUrl);

    await api().delete(`/api/messages/${img.body.message._id}`).set(auth(a));
    expect((await api().get('/api/messages/media').set(auth(b))).body.media).toHaveLength(0);
  });

  it('clearing the chat removes every message for both partners', async () => {
    const { a, b } = await createCouple();
    await api().post('/api/messages').set(auth(a)).send({ text: 'x' });
    await api().post('/api/messages').set(auth(b)).send({ text: 'y' });
    expect((await api().delete('/api/messages').set(auth(b))).status).toBe(200);
    expect((await api().get('/api/messages').set(auth(a))).body.messages).toHaveLength(0);
  });
});

describe('upload access control', () => {
  async function uploadMoment(u: { token: string }) {
    const res = await api()
      .post('/api/moments')
      .set({ Authorization: `Bearer ${u.token}` })
      .attach('image', PNG, { filename: 'p.png', contentType: 'image/png' });
    return res.body.moment.imageUrl as string;
  }
  const mediaToken = async (u: { token: string }) =>
    (await api().get('/api/auth/me').set({ Authorization: `Bearer ${u.token}` })).body.user.mediaToken as string;

  it('requires a media token and only serves the couple its own images', async () => {
    const one = await createCouple('a1', 'b1');
    const two = await createCouple('a2', 'b2');
    const url = await uploadMoment(one.a);

    expect((await api().get(url)).status).toBe(401);

    const partnerToken = await mediaToken(one.b);
    const ok = await api().get(url).query({ t: partnerToken });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/image\/png/);
    expect(ok.headers['cache-control']).toBe('private, max-age=86400');

    // Өөр хосын гишүүн — файл байгаа эсэхийг ч мэдэхгүй (404).
    expect((await api().get(url).query({ t: await mediaToken(two.a) })).status).toBe(404);
    // Байхгүй файл
    expect((await api().get('/uploads/nope.png').query({ t: partnerToken })).status).toBe(404);
  });

  it('media token and API token are not interchangeable', async () => {
    const { a } = await createCouple();
    const url = await uploadMoment(a);
    const mt = await mediaToken(a);
    // API JWT-ээр зураг нээхгүй
    expect((await api().get(url).query({ t: a.token })).status).toBe(401);
    // Media token-оор API-д нэвтрэхгүй
    expect((await api().get('/api/auth/me').set({ Authorization: `Bearer ${mt}` })).status).toBe(401);
  });

  it('serves avatars to their owner and partner, even before a couple exists', async () => {
    const { a, b } = await createCouple();
    const up = await api()
      .post('/api/auth/me/avatar')
      .set(auth(a))
      .attach('image', PNG, { filename: 'av.png', contentType: 'image/png' });
    const avatar = up.body.user.avatar as string;
    expect((await api().get(avatar).query({ t: up.body.user.mediaToken })).status).toBe(200);
    expect((await api().get(avatar).query({ t: await mediaToken(b) })).status).toBe(200);

    const solo = await createUser('solo');
    const soloUp = await api()
      .post('/api/auth/me/avatar')
      .set(auth(solo))
      .attach('image', PNG, { filename: 's.png', contentType: 'image/png' });
    expect((await api().get(soloUp.body.user.avatar).query({ t: soloUp.body.user.mediaToken })).status).toBe(200);
    expect((await api().get(soloUp.body.user.avatar).query({ t: await mediaToken(a) })).status).toBe(404);
  });
});

describe('log redaction', () => {
  it('never logs media tokens', async () => {
    const { redactUrl } = await import('../src/utils/logger.js');
    expect(redactUrl('/uploads/a.png?t=abc.def')).toBe('/uploads/a.png?t=[redacted]');
    expect(redactUrl('/uploads/a.png?x=1&t=abc')).toBe('/uploads/a.png?x=1&t=[redacted]');
    expect(redactUrl('/api/messages?limit=5')).toBe('/api/messages?limit=5');
  });
});
