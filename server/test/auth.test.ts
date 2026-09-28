import { describe, expect, it } from 'vitest';
import { api, auth, createUser } from './helpers.js';
import { env } from '../src/config/env.js';
import { OtpCode } from '../src/models/OtpCode.js';
import { User } from '../src/models/User.js';

describe('health', () => {
  it('GET /api/health', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'nous-server' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('unknown route → 404', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
  });

  it('malformed JSON → 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('register (Gmail OTP)', () => {
  it('request → verify → login', async () => {
    const reqOtp = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'Aysu@Gmail.com' });
    expect(reqOtp.status).toBe(200);
    expect(reqOtp.body.devCode).toMatch(/^\d{6}$/);

    const verify = await api().post('/api/auth/register/verify').send({
      recoveryEmail: 'aysu@gmail.com',
      code: reqOtp.body.devCode,
      username: 'Aysu',
      password: 'secret12',
    });
    expect(verify.status).toBe(201);
    expect(verify.body).toMatchObject({ ok: true, username: 'aysu', changed: false });
    expect(await OtpCode.countDocuments()).toBe(0);

    const login = await api().post('/api/auth/login').send({ username: 'aysu', password: 'secret12' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user).toMatchObject({ email: 'aysu@nous.mn', recoveryEmail: 'aysu@gmail.com', couple: null });
    expect(login.body.user.passwordHash).toBeUndefined();
  });

  it('duplicate username gets a numeric suffix', async () => {
    await createUser('aysu');
    const { body } = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'other@gmail.com' });
    const verify = await api().post('/api/auth/register/verify').send({
      recoveryEmail: 'other@gmail.com',
      code: body.devCode,
      username: 'aysu',
      password: 'secret12',
    });
    expect(verify.body).toMatchObject({ username: 'aysu1', changed: true });
  });

  it('rejects an already registered Gmail', async () => {
    await createUser('bold'); // recoveryEmail bold@gmail.com
    const res = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'bold@gmail.com' });
    expect(res.status).toBe(409);
  });

  it('wrong code is rejected and the OTP is invalidated after 5 attempts', async () => {
    const { body } = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'x@gmail.com' });
    const wrong = body.devCode === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i += 1) {
      const res = await api()
        .post('/api/auth/register/verify')
        .send({ recoveryEmail: 'x@gmail.com', code: wrong, username: 'x', password: 'secret12' });
      expect(res.status).toBe(400);
    }
    // Одоо зөв код ч ажиллахгүй — brute-force хамгаалалт.
    const res = await api()
      .post('/api/auth/register/verify')
      .send({ recoveryEmail: 'x@gmail.com', code: body.devCode, username: 'x', password: 'secret12' });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('expired code is rejected', async () => {
    const { body } = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'late@gmail.com' });
    await OtpCode.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await api()
      .post('/api/auth/register/verify')
      .send({ recoveryEmail: 'late@gmail.com', code: body.devCode, username: 'late', password: 'secret12' });
    expect(res.status).toBe(400);
  });

  it('never exposes the OTP when dev codes are disabled (production)', async () => {
    const prev = env.exposeDevOtp;
    env.exposeDevOtp = false;
    try {
      const res = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'prod@gmail.com' });
      expect(res.status).toBe(200);
      expect(res.body.devCode).toBeUndefined();
    } finally {
      env.exposeDevOtp = prev;
    }
  });

  it('validates input', async () => {
    const res = await api().post('/api/auth/register/request-otp').send({ recoveryEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('wrong password → 401, unknown user → 401', async () => {
    await createUser('nurlan');
    expect((await api().post('/api/auth/login').send({ username: 'nurlan', password: 'nope' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ username: 'ghost', password: 'x' })).status).toBe(401);
  });

  it('accepts full email as username', async () => {
    await createUser('nurlan');
    const res = await api().post('/api/auth/login').send({ username: 'NURLAN@nous.mn', password: 'password123' });
    expect(res.status).toBe(200);
  });

  it('protected routes require a valid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
  });

  it('login starts a streak of 1', async () => {
    const u = await createUser('streaky');
    const me = await api().get('/api/auth/me').set(auth(u));
    expect(me.body.user.streak).toBe(1);
  });
});

describe('forgot password', () => {
  it('request → verify → login with new password', async () => {
    await createUser('nurlan');
    const reqOtp = await api().post('/api/auth/forgot/request-otp').send({ username: 'nurlan' });
    expect(reqOtp.status).toBe(200);
    expect(reqOtp.body.sentTo).toBe('nu****an@gmail.com');

    const verify = await api()
      .post('/api/auth/forgot/verify')
      .send({ username: 'nurlan', code: reqOtp.body.devCode, password: 'newpass1' });
    expect(verify.status).toBe(200);

    expect((await api().post('/api/auth/login').send({ username: 'nurlan', password: 'password123' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ username: 'nurlan', password: 'newpass1' })).status).toBe(200);
  });

  it('code cannot be reused', async () => {
    await createUser('nurlan');
    const { body } = await api().post('/api/auth/forgot/request-otp').send({ username: 'nurlan' });
    await api().post('/api/auth/forgot/verify').send({ username: 'nurlan', code: body.devCode, password: 'newpass1' });
    const again = await api()
      .post('/api/auth/forgot/verify')
      .send({ username: 'nurlan', code: body.devCode, password: 'newpass2' });
    expect(again.status).toBe(400);
  });
});

describe('profile', () => {
  it('PATCH /me updates allowed fields only', async () => {
    const u = await createUser('nurlan');
    const res = await api()
      .patch('/api/auth/me')
      .set(auth(u))
      .send({ name: 'Нурлан', theme: 'ocean', birthday: '2000-01-02', email: 'hack@nous.mn' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Нурлан', theme: 'ocean', birthday: '2000-01-02', email: 'nurlan@nous.mn' });
  });

  it('rejects an invalid theme', async () => {
    const u = await createUser('nurlan');
    expect((await api().patch('/api/auth/me').set(auth(u)).send({ theme: 'neon' })).status).toBe(400);
  });

  it('password change requires the current password', async () => {
    const u = await createUser('nurlan');
    const bad = await api()
      .patch('/api/auth/me/password')
      .set(auth(u))
      .send({ currentPassword: 'wrong', newPassword: 'newpass1' });
    expect(bad.status).toBe(400);
    const same = await api()
      .patch('/api/auth/me/password')
      .set(auth(u))
      .send({ currentPassword: u.password, newPassword: u.password });
    expect(same.status).toBe(400);
    const ok = await api()
      .patch('/api/auth/me/password')
      .set(auth(u))
      .send({ currentPassword: u.password, newPassword: 'newpass1' });
    expect(ok.status).toBe(200);
  });
});
