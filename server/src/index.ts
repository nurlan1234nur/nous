import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = createServer(app);
initSocket(server);

async function start(): Promise<void> {
  await connectDB();
  server.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'Server listening');
  });
}

// Docker stop / redeploy үед (SIGTERM) шинэ холболт авахаа зогсоож, DB-г цэвэр хаана.
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close(() => {
    void mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});
