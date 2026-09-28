import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { api, auth, createCouple } from './helpers.js';
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
