import { describe, expect, it } from 'vitest';
import { api, auth, createCouple, type TestUser } from './helpers.js';

describe('dream jar (wishes)', () => {
  it('needs both partners to complete and to delete', async () => {
    const { a, b } = await createCouple();
    const { body } = await api().post('/api/wishes').set(auth(a)).send({ text: 'Visit Japan' });
    const id = body.wish._id;

    const one = await api().patch(`/api/wishes/${id}/toggle`).set(auth(a));
    expect(one.body.wish.completed).toBe(false);
    const two = await api().patch(`/api/wishes/${id}/toggle`).set(auth(b));
    expect(two.body.wish.completed).toBe(true);
    expect(two.body.wish.completedAt).toBeTruthy();
    const undo = await api().patch(`/api/wishes/${id}/toggle`).set(auth(a));
    expect(undo.body.wish.completed).toBe(false);

    expect((await api().patch(`/api/wishes/${id}/delete-approval`).set(auth(a))).body.deleted).toBe(false);
    expect((await api().patch(`/api/wishes/${id}/delete-approval`).set(auth(b))).body.deleted).toBe(true);
    expect((await api().get('/api/wishes').set(auth(a))).body.wishes).toHaveLength(0);
  });
});

describe('love notes', () => {
  it('text stays hidden from the recipient until opened', async () => {
    const { a, b } = await createCouple();
    const sent = await api().post('/api/love-notes').set(auth(a)).send({ text: 'I love you' });
    expect(sent.status).toBe(201);
    const id = sent.body.note._id;

    const forB = await api().get('/api/love-notes').set(auth(b));
    expect(forB.body.notes[0].text).toBeNull();
    const forA = await api().get('/api/love-notes').set(auth(a));
    expect(forA.body.notes[0].text).toBe('I love you');

    // Зөвхөн хүлээн авагч нээнэ.
    expect((await api().patch(`/api/love-notes/${id}/open`).set(auth(a))).status).toBe(403);
    const opened = await api().patch(`/api/love-notes/${id}/open`).set(auth(b));
    expect(opened.body.note.text).toBe('I love you');
    expect(opened.body.note.openedAt).toBeTruthy();

    // Нээгдсэн note-ийг устгаж болохгүй.
    expect((await api().delete(`/api/love-notes/${id}`).set(auth(a))).status).toBe(403);
  });

  it('author can delete an unopened note, recipient cannot', async () => {
    const { a, b } = await createCouple();
    const { body } = await api().post('/api/love-notes').set(auth(a)).send({ text: 'secret' });
    expect((await api().delete(`/api/love-notes/${body.note._id}`).set(auth(b))).status).toBe(403);
    expect((await api().delete(`/api/love-notes/${body.note._id}`).set(auth(a))).status).toBe(200);
  });
});

describe('time capsules', () => {
  it('hides text until unlockAt and rejects past dates', async () => {
    const { a, b } = await createCouple();
    const past = await api()
      .post('/api/capsules')
      .set(auth(a))
      .send({ text: 'x', unlockAt: new Date(Date.now() - 1000).toISOString() });
    expect(past.status).toBe(400);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const created = await api().post('/api/capsules').set(auth(a)).send({ text: 'open me later', unlockAt: future });
    expect(created.status).toBe(201);

    for (const u of [a, b]) {
      const list = await api().get('/api/capsules').set(auth(u));
      expect(list.body.capsules[0]).toMatchObject({ unlocked: false, text: null });
    }

    expect((await api().delete(`/api/capsules/${created.body.capsule.id}`).set(auth(b))).status).toBe(403);
    expect((await api().delete(`/api/capsules/${created.body.capsule.id}`).set(auth(a))).status).toBe(200);
  });
});

describe('daily question', () => {
  it('answers are upserted per user and show up in history', async () => {
    const { a, b } = await createCouple();
    const today = await api().get('/api/daily').set(auth(a));
    expect(today.body.question).toBeTruthy();

    await api().post('/api/daily').set(auth(a)).send({ text: 'first' });
    await api().post('/api/daily').set(auth(a)).send({ text: 'edited' });
    await api().post('/api/daily').set(auth(b)).send({ text: 'mine' });

    const after = await api().get('/api/daily').set(auth(b));
    expect(after.body.answers).toHaveLength(2);
    expect(after.body.answers.map((x: { text: string }) => x.text).sort()).toEqual(['edited', 'mine']);

    const history = await api().get('/api/daily/history').set(auth(a));
    expect(history.body.days).toHaveLength(1);
    expect(history.body.days[0].question).toBe(today.body.question);
  });
});

describe('number guess game', () => {
  async function play(u: TestUser, path: string, body?: object) {
    return api().post(`/api/number-guess${path}`).set(auth(u)).send(body ?? {});
  }

  it('setup → turns → alpha/betta scoring → winner → reset needs both', async () => {
    const { a, b } = await createCouple();
    expect((await play(a, '/secret', { code: '12a4' })).status).toBe(400);

    const setA = await play(a, '/secret', { code: '1234' });
    expect(setA.body.game.status).toBe('setup');
    const setB = await play(b, '/secret', { code: '5678' });
    expect(setB.body.game.status).toBe('playing');
    // Өрсөлдөгчийн нууц тоо тоглолтын үеэр харагдахгүй.
    expect(setB.body.game.opponent.secret).toBe('');

    const first = setB.body.game.turnUserId === a.id ? a : b;
    const second = first === a ? b : a;
    const secretOfSecond = second === a ? '1234' : '5678';

    expect((await play(second, '/guess', { code: '0000' })).status).toBe(409); // ээлж биш

    const miss = await play(first, '/guess', { code: secretOfSecond.split('').reverse().join('') });
    const last = miss.body.game.attempts.at(-1);
    expect(last).toMatchObject({ alpha: 0, betta: 4 });
    expect(miss.body.game.turnUserId).toBe(second.id);

    await play(second, '/guess', { code: '9999' });
    const win = await play(first, '/guess', { code: secretOfSecond });
    expect(win.body.game).toMatchObject({ status: 'finished', winnerUserId: first.id });
    expect(win.body.game.opponent.secret).toBe(secretOfSecond);

    expect((await play(a, '/reset-request')).body.game.status).toBe('finished');
    const reset = await play(b, '/reset-request');
    expect(reset.body.game).toMatchObject({ status: 'setup', attempts: [] });
  });
});
