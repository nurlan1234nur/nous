import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const message = { error: 'Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу' };

function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    // Тест бүр шинэ app үүсгэдэг ч санах ойн store нэг процесс дотор хуваалцагдана.
    skip: () => env.isTest,
  });
}

// Нэвтрэх: нэг IP-ээс 15 минутад 20 оролдлого (нууц үг таах халдлагаас).
export const loginLimiter = limiter(15 * 60 * 1000, 20);

// OTP илгээх: имэйл spam болон Gmail quota-г хамгаална.
export const otpRequestLimiter = limiter(60 * 60 * 1000, 10);

// OTP баталгаажуулах: 6 оронтой кодыг brute-force хийхээс хамгаална.
export const otpVerifyLimiter = limiter(15 * 60 * 1000, 20);

// Бусад бүх API-д ерөнхий хязгаар.
export const apiLimiter = limiter(60 * 1000, 300);
