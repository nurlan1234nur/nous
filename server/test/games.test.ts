import { describe, expect, it } from 'vitest';
import { api, auth, createCouple, createUser } from './helpers.js';

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
  it('starts in placement and rejects shots before both players are ready', async () => {
    const { a } = await createCouple();
    const game = await api().get('/api/battleship').set(auth(a));
    expect(game.status).toBe(200);
    expect(game.body.game.status).toBe('placement');
    expect((await api().post('/api/battleship/fire').set(auth(a)).send({ x: 1, y: 1 })).status).toBe(409);
    expect((await api().post('/api/battleship/place').set(auth(a)).send({ x: 11, y: 1, rotation: 0 })).status).toBe(400);
  });
});
