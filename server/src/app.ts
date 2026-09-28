import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { coupleRouter } from './routes/couple.routes.js';
import { messageRouter } from './routes/message.routes.js';
import { moodRouter } from './routes/mood.routes.js';
import { capsuleRouter } from './routes/capsule.routes.js';
import { momentRouter } from './routes/moment.routes.js';
import { milestoneRouter } from './routes/milestone.routes.js';
import { dailyRouter } from './routes/daily.routes.js';
import { wishRouter } from './routes/wish.routes.js';
import { songRouter } from './routes/song.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { loveNoteRouter } from './routes/loveNote.routes.js';
import { gameRouter } from './routes/game.routes.js';
import { battleshipRouter } from './routes/battleship.routes.js';
import { numberGuessRouter } from './routes/numberGuess.routes.js';
import { notFound, errorHandler } from './middleware/error.js';
import { uploadsDir } from './config/uploads.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { httpLogger } from './utils/logger.js';
import { requireUploadAccess } from './middleware/uploadsAuth.js';

// Express app-ийг үүсгэнэ (HTTP server-ээс салгасан — тестэд supertest-ээр шууд ашиглана).
export function createApp(): Express {
  const app = express();

  // nginx / reverse proxy-ийн ард ажиллана — rate limit бодит IP-г харах ёстой.
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');
  // API нь JSON л буцаадаг; зураг өөр origin (web/mobile)-оос ачаалагдах тул CORP-г cross-origin болгоно.
  app.use(httpLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiLimiter);
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Upload хийсэн зургуудыг статикаар үйлчилнэ (nginx /uploads-ийг энд proxy хийнэ).
  // Зөвхөн эрхтэй хэрэглэгч (өөрийн эсвэл хосын зураг) media token-оор нээнэ.
  app.use('/uploads', requireUploadAccess, express.static(uploadsDir, { index: false, dotfiles: 'deny' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nous-server' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/couples', coupleRouter);
  app.use('/api/messages', messageRouter);
  app.use('/api/moods', moodRouter);
  app.use('/api/capsules', capsuleRouter);
  app.use('/api/moments', momentRouter);
  app.use('/api/milestones', milestoneRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/wishes', wishRouter);
  app.use('/api/songs', songRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/love-notes', loveNoteRouter);
  app.use('/api/games', gameRouter);
  app.use('/api/battleship', battleshipRouter);
  app.use('/api/number-guess', numberGuessRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
