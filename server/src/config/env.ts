import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = required('JWT_SECRET');
if (isProduction && (jwtSecret.length < 32 || jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET production-д хамгийн багадаа 32 тэмдэгттэй санамсаргүй утга байх ёстой');
}

// Олон origin-ийг таслалаар зааж болно (жнь "https://nous.mn,http://localhost:5173").
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === '') return 1; // nginx client контейнер = 1 hop
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: clientOrigins.length === 1 ? clientOrigins[0] : clientOrigins,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // OTP кодыг API хариунд буцаах эсэх. Зөвхөн dev-д — production-д имэйл явахгүй бол
  // кодыг хэн ч харж болохоор болж, бүртгэл булаах эрсдэлтэй.
  exposeDevOtp: !isProduction && process.env.EXPOSE_DEV_OTP !== 'false',
  // OTP илгээх Gmail (заавал биш — байхгүй бол dev горим, код log-д хэвлэгдэнэ).
  gmailUser: process.env.GMAIL_USER ?? '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:admin@nous.mn',
  // Expo push (native app). Access token заавал биш — Expo "enhanced security" асаасан үед л хэрэгтэй.
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  expoPushEnabled: process.env.EXPO_PUSH_ENABLED !== 'false',
  // Яаралтай үед л true — /uploads-ийг нэвтрэлтгүй нээнэ (хуучин client-уудтай нийцүүлэх).
  uploadsPublic: process.env.UPLOADS_PUBLIC === 'true',
};
