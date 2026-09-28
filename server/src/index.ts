import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';

const app = createApp();
const server = createServer(app);
initSocket(server);

async function start(): Promise<void> {
  await connectDB();
  server.listen(env.port, () => {
    console.log(`✓ Server http://localhost:${env.port} дээр ажиллаж байна`);
  });
}

// Docker stop / redeploy үед (SIGTERM) шинэ холболт авахаа зогсоож, DB-г цэвэр хаана.
function shutdown(signal: string): void {
  console.log(`${signal} авлаа — сервер унтарч байна…`);
  server.close(() => {
    void mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('Сервер эхлэхэд алдаа гарлаа:', err);
  process.exit(1);
});
