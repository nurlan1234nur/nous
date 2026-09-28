import { describe, expect, it } from 'vitest';
import { api, auth, createCouple, createUser } from './helpers.js';
import { Couple } from '../src/models/Couple.js';
import { ExpoPushToken } from '../src/models/ExpoPushToken.js';
import { Message } from '../src/models/Message.js';
import { User } from '../src/models/User.js';

describe('expo push token', () => {
  it('registers, re-assigns and deletes tokens', async () => {
    const a = await createUser('alpha');
    const b = await createUser('betta');
    const token = 'ExponentPushToken[abc123]';

    expect((await api().post('/api/notifications/expo').set(auth(a)).send({ token: 'junk' })).status).toBe(400);
    expect((await api().post('/api/notifications/expo').set(auth(a)).send({ token, platform: 'ios' })).status).toBe(201);
    // Нэг төхөөрөмж өөр бүртгэлээр нэвтэрвэл token шилжинэ.
    expect((await api().post('/api/notifications/expo').set(auth(b)).send({ token })).status).toBe(201);
    const docs = await ExpoPushToken.find();
    expect(docs).toHaveLength(1);
    expect(docs[0].user.toString()).toBe(b.id);

    // Өөр хүний token-ийг устгаж чадахгүй.
    await api().delete('/api/notifications/expo').set(auth(a)).send({ token });
    expect(await ExpoPushToken.countDocuments()).toBe(1);
    await api().delete('/api/notifications/expo').set(auth(b)).send({ token });
    expect(await ExpoPushToken.countDocuments()).toBe(0);
  });
});

describe('account deletion', () => {
  it('requires the correct password', async () => {
    const u = await createUser('alpha');
    expect((await api().delete('/api/auth/me').set(auth(u)).send({ password: 'wrong' })).status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
  });

  it('keeps couple data for the remaining partner, wipes it when the last member leaves', async () => {
    const { a, b } = await createCouple();
    await api().post('/api/messages').set(auth(a)).send({ text: 'hi' });
    await api().post('/api/notifications/expo').set(auth(a)).send({ token: 'ExponentPushToken[a]' });

    const delA = await api().delete('/api/auth/me').set(auth(a)).send({ password: a.password });
    expect(delA.status).toBe(200);
    expect(await User.exists({ _id: a.id })).toBeNull();
    expect(await ExpoPushToken.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(1);
    expect((await Couple.findOne())!.members.map(String)).toEqual([b.id]);

    // Устгагдсан хэрэглэгчийн token цаашид ажиллахгүй.
    expect((await api().get('/api/couples/me').set(auth(a))).body.couple).toBeNull();

    const delB = await api().delete('/api/auth/me').set(auth(b)).send({ password: b.password });
    expect(delB.status).toBe(200);
    expect(await Couple.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);
  });
});
