import { describe, expect, it } from 'vitest';
import { api, auth, createCouple, createUser, type TestUser } from './helpers.js';

const quizInput = {
  title: 'Хэн нь илүү?',
  questions: [
    { text: 'Хэн нь илүү хоол хийдэг вэ?', options: ['Би', 'Чи'], correctIndex: 0 },
    { text: 'Хэн нь илүү унтдаг вэ?', options: ['Би', 'Чи', 'Хоёулаа'], correctIndex: 2 },
  ],
};

describe('who-is-more quiz', () => {
  it('player answers every question; answers and correct options stay hidden until complete', async () => {
    const { a, b } = await createCouple();
    const created = await api().post('/api/games/quiz').set(auth(a)).send(quizInput);
    expect(created.status).toBe(201);
    const id = created.body.quiz.id;

    // Тоглогчид зөв хариулт харагдахгүй.
    const forB = await api().get(`/api/games/quiz/${id}`).set(auth(b));
    expect(forB.body.quiz.role).toBe('player');
    expect(forB.body.quiz.questions.every((q: { correctOptionId: unknown }) => q.correctOptionId === null)).toBe(true);

    // Үүсгэгч өөрөө хариулж чадахгүй.
    const q0 = forB.body.quiz.questions[0];
    expect(
      (await api().post(`/api/games/quiz/${id}/answer`).set(auth(a)).send({ questionId: q0.id, optionId: q0.options[0].id }))
        .status,
    ).toBe(403);

    await api().post(`/api/games/quiz/${id}/answer`).set(auth(b)).send({ questionId: q0.id, optionId: q0.options[0].id });
    // Нэг асуултад хоёр удаа хариулахгүй.
    expect(
      (await api().post(`/api/games/quiz/${id}/answer`).set(auth(b)).send({ questionId: q0.id, optionId: q0.options[1].id }))
        .status,
    ).toBe(409);
    // Эхэлсэн тестийг засах/устгах боломжгүй.
    expect((await api().put(`/api/games/quiz/${id}`).set(auth(a)).send(quizInput)).status).toBe(403);
    expect((await api().delete(`/api/games/quiz/${id}`).set(auth(a))).status).toBe(403);

    const q1 = forB.body.quiz.questions[1];
    const done = await api()
      .post(`/api/games/quiz/${id}/answer`)
      .set(auth(b))
      .send({ questionId: q1.id, optionId: q1.options[0].id });
    expect(done.body.quiz).toMatchObject({ status: 'completed', score: 1 });
    expect(done.body.quiz.questions.map((q: { correct: boolean }) => q.correct)).toEqual([true, false]);
  });

  it('validates input and needs a partner', async () => {
    const { a } = await createCouple();
    expect(
      (await api().post('/api/games/quiz').set(auth(a)).send({ ...quizInput, questions: quizInput.questions.slice(0, 1) }))
        .status,
    ).toBe(400);
    const bad = { ...quizInput, questions: [{ text: 'x', options: ['a', 'b'], correctIndex: 5 }, quizInput.questions[0]] };
    expect((await api().post('/api/games/quiz').set(auth(a)).send(bad)).status).toBe(400);

    const solo = await createUser('solo');
    const { body } = await api().post('/api/couples/create').set(auth(solo));
    expect(body.couple.inviteCode).toBeTruthy();
    expect((await api().post('/api/games/quiz').set(auth(solo)).send(quizInput)).status).toBe(409);
  });

  it('creator can delete an unanswered quiz, partner cannot', async () => {
    const { a, b } = await createCouple();
    const { body } = await api().post('/api/games/quiz').set(auth(a)).send(quizInput);
    expect((await api().delete(`/api/games/quiz/${body.quiz.id}`).set(auth(b))).status).toBe(403);
    expect((await api().delete(`/api/games/quiz/${body.quiz.id}`).set(auth(a))).status).toBe(200);
  });
});

describe('battleship', () => {
  const post = (u: TestUser, path: string, body: object = {}) =>
    api().post(`/api/battleship${path}`).set(auth(u)).send(body);

  it('full game: place → ready → alternate turns → nose hit wins; opponent planes stay hidden', async () => {
    const { a, b } = await createCouple();
    // Онгоц талбайгаас гарвал татгалзана (x=9 → 11-р багана хүртэл).
    expect((await post(a, '/place', { x: 9, y: 1, rotation: 0 })).status).toBe(400);
    expect((await post(a, '/ready')).status).toBe(409); // онгоцгүй бол бэлэн болохгүй

    await post(a, '/place', { x: 1, y: 1, rotation: 0 });
    await post(b, '/place', { x: 5, y: 5, rotation: 0 });
    await post(a, '/ready');
    const started = await post(b, '/ready');
    expect(started.body.game.status).toBe('playing');
    // Өрсөлдөгчийн онгоцны байрлал payload-д огт байхгүй.
    expect(JSON.stringify(started.body.game.opponent)).not.toMatch(/"planes"|"cells"/);

    const first = started.body.game.turnUserId === a.id ? a : b;
    const second = first === a ? b : a;
    // BASE_PLANE-ийн хамар (x+1, y) — a: (2,1), b: (6,5)
    const noseOfSecond = second === a ? { x: 2, y: 1 } : { x: 6, y: 5 };
    const bodyOfSecond = second === a ? { x: 2, y: 2 } : { x: 6, y: 6 };

    expect((await post(second, '/fire', { x: 10, y: 10 })).status).toBe(409); // ээлж биш
    const hit = await post(first, '/fire', bodyOfSecond);
    expect(hit.body.game.opponent.shots.at(-1).result).toBe('hit');
    expect(hit.body.game.status).toBe('playing');

    await post(second, '/fire', { x: 10, y: 10 });
    expect((await post(first, '/fire', bodyOfSecond)).status).toBe(409); // нэг нүд рүү дахин буудахгүй

    const win = await post(first, '/fire', noseOfSecond);
    expect(win.body.game).toMatchObject({ status: 'finished', winnerUserId: first.id });
    expect(win.body.game.opponent.shots.at(-1).result).toBe('head');

    const reset = await post(second, '/reset');
    expect(reset.body.game).toMatchObject({ status: 'placement', winnerUserId: null });
    expect(reset.body.game.me.planes).toHaveLength(0);
  });

  it('plane count change needs both players and rejects overlapping planes', async () => {
    const { a, b } = await createCouple();
    const proposed = await post(a, '/plane-count/propose', { count: 2 });
    expect(proposed.body.game.planeCount).toBe(1);
    const approved = await post(b, '/plane-count/approve');
    expect(approved.body.game.planeCount).toBe(2);

    await post(a, '/place', { x: 1, y: 1, rotation: 0 });
    expect((await post(a, '/place', { x: 1, y: 2, rotation: 0 })).status).toBe(400); // давхцана
    expect((await post(a, '/ready')).status).toBe(409); // 2 онгоц дутуу
    expect((await post(a, '/place', { x: 5, y: 5, rotation: 90 })).status).toBe(200);
    expect((await post(a, '/ready')).status).toBe(200);
  });


  it('starts in placement and rejects shots before both players are ready', async () => {
    const { a } = await createCouple();
    const game = await api().get('/api/battleship').set(auth(a));
    expect(game.status).toBe(200);
    expect(game.body.game.status).toBe('placement');
    expect((await api().post('/api/battleship/fire').set(auth(a)).send({ x: 1, y: 1 })).status).toBe(409);
    expect((await api().post('/api/battleship/place').set(auth(a)).send({ x: 11, y: 1, rotation: 0 })).status).toBe(400);
  });
});
