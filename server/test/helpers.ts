import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

export const app = createApp();
export const api = () => request(app);

export interface TestUser {
  id: string;
  token: string;
  username: string;
  password: string;
}

export async function createUser(username: string, password = 'password123'): Promise<TestUser> {
  const user = await User.create({
    email: `${username}@nous.mn`,
    recoveryEmail: `${username}@gmail.com`,
    name: username,
    passwordHash: await bcrypt.hash(password, 4),
  });
  const res = await api().post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: user._id.toString(), token: res.body.token, username, password };
}

export const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

// Хоёр хэрэглэгч үүсгээд нэг хос болгоно.
export async function createCouple(a = 'alpha', b = 'betta'): Promise<{ a: TestUser; b: TestUser; inviteCode: string }> {
  const ua = await createUser(a);
  const ub = await createUser(b);
  const created = await api().post('/api/couples/create').set(auth(ua));
  const inviteCode = created.body.couple.inviteCode as string;
  await api().post('/api/couples/join').set(auth(ub)).send({ inviteCode });
  return { a: ua, b: ub, inviteCode };
}
