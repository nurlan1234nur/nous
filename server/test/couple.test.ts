import { describe, expect, it } from 'vitest';
import { api, auth, createCouple, createUser } from './helpers.js';
import { Couple } from '../src/models/Couple.js';
import { Message } from '../src/models/Message.js';
import { User } from '../src/models/User.js';

describe('couple setup', () => {
  it('create → join → /me shows both members', async () => {
    const a = await createUser('alpha');
    const b = await createUser('betta');
    const created = await api().post('/api/couples/create').set(auth(a));
    expect(created.status).toBe(201);
    expect(created.body.couple.inviteCode).toMatch(/^[A-Z2-9]{6}$/);

    const joined = await api()
      .post('/api/couples/join')
      .set(auth(b))
      .send({ inviteCode: ` ${created.body.couple.inviteCode.toLowerCase()} ` });
    expect(joined.status).toBe(200);

    const me = await api().get('/api/couples/me').set(auth(b));
    expect(me.body.couple.members).toHaveLength(2);
    // Нууц талбарууд populate-оор гарахгүй.
    expect(me.body.couple.members[0].passwordHash).toBeUndefined();
  });

  it('cannot create twice or join when already in a couple', async () => {
    const { a, inviteCode } = await createCouple();
    expect((await api().post('/api/couples/create').set(auth(a))).status).toBe(409);
    expect((await api().post('/api/couples/join').set(auth(a)).send({ inviteCode })).status).toBe(409);
  });

  it('wrong code → 404, full couple → 409', async () => {
    const { inviteCode } = await createCouple();
    const c = await createUser('gamma');
    expect((await api().post('/api/couples/join').set(auth(c)).send({ inviteCode: 'ZZZZZZ' })).status).toBe(404);
    expect((await api().post('/api/couples/join').set(auth(c)).send({ inviteCode })).status).toBe(409);
  });

  it('concurrent joins never produce a 3-member couple', async () => {
    const a = await createUser('alpha');
    const { body } = await api().post('/api/couples/create').set(auth(a));
    const joiners = await Promise.all(['b1', 'b2', 'b3', 'b4'].map((n) => createUser(n)));
    const results = await Promise.all(
      joiners.map((u) => api().post('/api/couples/join').set(auth(u)).send({ inviteCode: body.couple.inviteCode })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const couple = await Couple.findOne({ inviteCode: body.couple.inviteCode });
    expect(couple!.members).toHaveLength(2);
  });

  it('couple-scoped routes return 403 without a couple', async () => {
    const u = await createUser('solo');
    expect((await api().get('/api/messages').set(auth(u))).status).toBe(403);
    expect((await api().get('/api/moments').set(auth(u))).status).toBe(403);
  });

  it('can set the partner birthday but not a stranger', async () => {
    const { a, b } = await createCouple();
    const stranger = await createUser('stranger');
    const ok = await api().patch('/api/couples/birthday').set(auth(a)).send({ memberId: b.id, birthday: '1999-05-05' });
    expect(ok.status).toBe(200);
    const no = await api()
      .patch('/api/couples/birthday')
      .set(auth(a))
      .send({ memberId: stranger.id, birthday: '1999-05-05' });
    expect(no.status).toBe(403);
  });
});

describe('data isolation between couples', () => {
  it('cannot read or delete another couple’s messages', async () => {
    const one = await createCouple('a1', 'b1');
    const two = await createCouple('a2', 'b2');
    const sent = await api().post('/api/messages').set(auth(one.a)).send({ text: 'secret' });
    expect(sent.status).toBe(201);

    const list = await api().get('/api/messages').set(auth(two.a));
    expect(list.body.messages).toHaveLength(0);

    const del = await api().delete(`/api/messages/${sent.body.message._id}`).set(auth(two.a));
    expect(del.status).toBe(404);
  });

  it('invalid ObjectId → 400 (not 500)', async () => {
    const { a } = await createCouple();
    expect((await api().delete('/api/messages/not-an-id').set(auth(a))).status).toBe(400);
  });
});

describe('messages', () => {
  it('send, list in order, unsend own only', async () => {
    const { a, b } = await createCouple();
    const m1 = await api().post('/api/messages').set(auth(a)).send({ text: 'hi' });
    await api().post('/api/messages').set(auth(b)).send({ text: 'hello' });

    const list = await api().get('/api/messages').set(auth(a));
    expect(list.body.messages.map((m: { text: string }) => m.text)).toEqual(['hi', 'hello']);
    expect(list.body.hasMore).toBe(false);

    expect((await api().delete(`/api/messages/${m1.body.message._id}`).set(auth(b))).status).toBe(403);
    const unsent = await api().delete(`/api/messages/${m1.body.message._id}`).set(auth(a));
    expect(unsent.status).toBe(200);
    expect(unsent.body.message).toMatchObject({ deleted: true, text: '' });
  });

  it('returns the newest messages when there are more than the limit', async () => {
    const { a } = await createCouple();
    const me = await User.findById(a.id);
    const base = Date.now() - 1000 * 60;
    await Message.insertMany(
      Array.from({ length: 205 }, (_, i) => ({
        couple: me!.couple,
        sender: me!._id,
        text: `m${i}`,
        createdAt: new Date(base + i * 100),
      })),
    );
    const list = await api().get('/api/messages').set(auth(a));
    expect(list.body.messages).toHaveLength(200);
    expect(list.body.messages.at(-1).text).toBe('m204');
    expect(list.body.hasMore).toBe(true);

    const older = await api()
      .get('/api/messages')
      .query({ before: list.body.messages[0].createdAt })
      .set(auth(a));
    expect(older.body.messages.map((m: { text: string }) => m.text)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(older.body.hasMore).toBe(false);
  });

  it('rejects empty text', async () => {
    const { a } = await createCouple();
    expect((await api().post('/api/messages').set(auth(a)).send({ text: '' })).status).toBe(400);
  });
});
