import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const nodeEnv = process.env.NODE_ENV ?? 'development';

// Production-д JSON мөр (docker logs → grep/jq, дараа нь Loki/Datadog г.м.), тестэд чимээгүй.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info'),
  base: { service: 'nous-server' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash', '*.code'],
    remove: true,
  },
});

// HTTP хүсэлт бүрийн log (method, url, status, хугацаа). Health check-ийг алгасна.
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
  autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
