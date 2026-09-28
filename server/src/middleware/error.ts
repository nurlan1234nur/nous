import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Олдсонгүй' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Буруу өгөгдөл', details: err.flatten().fieldErrors });
    return;
  }

  // MongoDB давхардсан түлхүүр (жишээ нь email)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({ error: 'Энэ утга аль хэдийн бүртгэгдсэн байна' });
    return;
  }

  // Буруу ObjectId (жнь /api/moments/abc) — 500 биш 400 буцаана.
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'CastError') {
    res.status(400).json({ error: 'Буруу ID' });
    return;
  }

  // JSON body parse алдаа
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Буруу JSON' });
    return;
  }

  // Зөвшөөрөгдөөгүй файлын төрөл (upload fileFilter)
  if (err instanceof Error && err.message === 'Зөвхөн зураг оруулах боломжтой') {
    res.status(400).json({ error: err.message });
    return;
  }

  // Multer (зураг upload) алдаа — хэт том файл г.м.
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    const msg = code === 'LIMIT_FILE_SIZE' ? 'Зураг хэт том байна (15MB-аас бага байх ёстой)' : 'Зураг upload алдаа';
    res.status(400).json({ error: msg });
    return;
  }

  (req.log ?? logger).error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Серверийн алдаа' });
}
