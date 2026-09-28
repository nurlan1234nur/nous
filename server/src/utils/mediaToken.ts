import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Зургийн (uploads) хандалтын тусгай token. API-ийн JWT-ээс өөр түлхүүрээр гарын үсэг зурдаг тул
// URL-аас алдагдсан ч API эсвэл socket-д нэвтрэх боломжгүй — зөвхөн тухайн хэрэглэгчийн
// харах эрхтэй зургийг л нээнэ.
const MEDIA_SECRET = `${env.jwtSecret}:media`;
const MEDIA_TTL = '30d';

export function signMediaToken(userId: string): string {
  return jwt.sign({ typ: 'media' }, MEDIA_SECRET, { subject: userId, expiresIn: MEDIA_TTL });
}

export function verifyMediaToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, MEDIA_SECRET) as jwt.JwtPayload;
    return payload.typ === 'media' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
