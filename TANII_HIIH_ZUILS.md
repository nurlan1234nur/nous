# Таны хийх зүйлс (owner checklist)

Кодоор шийдэж болох ажлуудыг хийсэн. Доорх зүйлс нь **таны эрх, account, шийдвэр** шаарддаг тул би хийж чадахгүй.
Дарааллаар нь хийвэл хамгийн хурдан production-д хүрнэ. Дууссан бүрийг `[x]` болгоорой.

---

## 🔴 1. Яаралтай — одоо production-д нөлөөлж байгаа

- [x] **Gmail тохируулах.** VPS дээр `/home/<user>/nous/.env` файлд нэмнэ:
  ```env
  GMAIL_USER=таны-gmail@gmail.com
  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
  ```
  App Password авах: Google Account → Security → 2-Step Verification асаах → App passwords → "nous" нэрээр үүсгэнэ.
  > ⚠️ Үүнгүйгээр шинэ хувилбар deploy болмогц **бүртгүүлэх, нууц үг сэргээх ажиллахгүй** болно
  > (өмнө нь код дэлгэцэнд гардаг байсан нь аюулгүй байдлын цоорхой байсан тул хаасан).

- [x] **PR үүсгээд merge хийх.** Бүх өөрчлөлт `claude/gracious-lovelace-t0te25` branch дээр байна.
  GitHub дээр PR нээж, CI (server test + mobile test) ногоон болсны дараа `main` руу merge хийвэл автоматаар deploy болно.
  > Merge хийхээс **өмнө** дээрх Gmail-ийг тохируулсан байх ёстой.

## 🟠 2. Mobile app-ийг store-д гаргахад заавал

- [ ] **HTTPS домэйн.** iOS/Android нь `http://` API-г хориглодог.
  1. Домэйн худалдаж авах (жнь `nous.mn`) эсвэл байгаа домэйнээ ашиглах.
  2. DNS: `api.nous.mn` → `116.206.83.75` (A record).
  3. VPS дээр Caddy эсвэл nginx + Let's Encrypt тавьж `https://api.nous.mn` → `localhost:8300` болгох.
  4. `.env`-д `CLIENT_ORIGIN=https://nous.mn` (web-ийн хаяг).
  5. `mobile/eas.json` доторх `https://api.nous.mn`-г бодит хаягаар солих (өөр домэйн бол).

- [ ] **Expo / EAS account.**
  ```bash
  npm i -g eas-cli
  cd mobile
  eas login          # expo.dev дээр үнэгүй бүртгэл
  eas init           # app.json-д projectId автоматаар бичигдэнэ → commit хий
  ```
  `projectId`-гүй бол push notification ажиллахгүй.

- [ ] **Bundle ID шийдэх.** Одоо `mn.nous.app` гэж түр тавьсан (`mobile/app.json`).
  Store-д нэг гарсны дараа **солих боломжгүй**. Өөрийн домэйнээ урвуулж бичих нь стандарт (`mn.nous.app`, `com.nurlan.nous` г.м.).

- [ ] **Apple Developer Program** ($99/жил) — iOS build, TestFlight, App Store-д заавал.
  https://developer.apple.com/programs/ → бүртгүүлсний дараа `eas build -p ios` APNs push key-г автоматаар үүсгэнэ.

- [ ] **Google Play Console** ($25 нэг удаа) — https://play.google.com/console

- [ ] **Firebase (Android push).**
  1. https://console.firebase.google.com → шинэ project → Android app нэмэх (package = bundle ID).
  2. Project settings → Service accounts → "Generate new private key" (JSON).
  3. `cd mobile && eas credentials` → Android → Push Notifications → FCM V1 → JSON-оо оруулна.
  4. `google-services.json` татаж `mobile/`-д хийгээд `app.json`-д `"android": { "googleServicesFile": "./google-services.json" }` нэмнэ.

- [ ] **Privacy Policy.** Хуудас бэлэн: `client/public/privacy.html` → `https://<web-домэйн>/privacy.html`
  (web болон mobile-ийн More цэснээс холбоостой). Танд үлдсэн нь:
  1. Текстийг уншиж баталгаажуулах.
  2. ~~Холбоо барих имэйл~~ — `nurlant566@gmail.com` болгосон ✅
  3. Store-д энэ URL-г оруулах.

- [ ] **Store материал:** app icon (1024×1024), screenshot-ууд (iPhone 6.7", Android), тайлбар, ангилал.
  App Store-ийн "App Privacy", Play Store-ийн "Data safety" асуулгыг бөглөх.

## 🟡 3. Build ба туршилт

- [ ] Дотоод тест build:
  ```bash
  cd mobile
  eas build --profile preview --platform android   # APK — утсан дээр шууд суулгана
  eas build --profile preview --platform ios       # Apple Developer шаардлагатай
  ```
- [ ] `REQUIREMENTS.md` → **3.4 Гар аргаар QA checklist**-ийг 2 бодит утсаар бүрэн туулах
  (ялангуяа push notification, background-оос буцах, бүртгэл устгах).
- [ ] Бүгд OK бол: `eas build --profile production` → `eas submit`.

## 🟢 4. Production-ийн найдвартай байдал (эхний хэрэглэгчдээс өмнө)

- [ ] **MongoDB backup.** Script бэлэн (`scripts/backup.sh`). VPS дээр cron-д нэмэхэд л болно:
  ```bash
  crontab -e
  # доорх мөрийг нэмнэ (<user>-ийг солино):
  15 3 * * * cd /home/<user>/nous && bash scripts/backup.sh >> backups/backup.log 2>&1
  ```
  Гадна хуулах бол `rclone config` хийгээд cron мөрөнд `RCLONE_REMOTE=gdrive:nous-backups` нэмнэ.
  Нэг удаа гараар ажиллуулж, сэргээж үзэх (script-ийн төгсгөлд заавар бий).
- [ ] **Cloudinary** (заавал биш, санал болгож байна): зургууд одоо VPS disk дээр. Cloudinary үнэгүй
  account нээж `CLOUDINARY_*` 3 утгыг `.env`-д нэмбэл зураг найдвартай хадгалагдана.
- [ ] **Sentry** (алдааны мониторинг) — үнэгүй account нээгээд DSN-ээ надад өгвөл холбож өгнө.
- [ ] **Web Push** (PWA-д): `cd server && npm run generate:vapid` → гарсан 2 key-г `.env`-д `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

## 🔵 5. Cloudflare (web client)

`main` дээр Cloudflare Workers-ийн автомат тохиргоо (`wrangler.jsonc`) merge хийгдсэн байна. Анхаарах:
- [ ] Root дээрх `wrangler.jsonc` нь `"assets": { "directory": "client" }` — build хийгдээгүй **эх код**-ыг serve хийнэ.
  `client/wrangler.jsonc` (build-ийн `dist`-ийг ашигладаг) нь зөв хувилбар. Cloudflare dashboard дээр
  root directory-г `client` болгох эсвэл root `wrangler.jsonc`-г устгахыг зөвлөж байна.
- [ ] Cloudflare дээрх web нь өөр домэйн тул build env-д `VITE_API_ORIGIN=https://api.<домэйн>` тохируулах,
  server `.env`-ийн `CLIENT_ORIGIN`-д Cloudflare-ийн домэйныг таслалаар нэмэх
  (жнь `CLIENT_ORIGIN=https://nous.mn,https://nous.<user>.workers.dev`).
- [ ] Cloudflare нь HTTPS тул API мөн **HTTPS** байх ёстой (эс бөгөөс браузер "mixed content" гэж хаана).

## 6. Мэдээлэл — шийдвэр хэрэгтэй

- **Бүртгэл устгахад** хос дотор хамтрагч үлдвэл дурсамж, зурвас хамтрагчид үлддэг, хоёулаа устгавал бүгд устдаг
  гэж хийсэн. Өөр бодлого хүсвэл (жнь устгасан хүний зурвасыг бас устгах) хэлээрэй.
- **Rate limit:** нэг IP-ээс login 15 минутад 20, OTP илгээх цагт 10. Хэт хатуу/сул бол `server/src/middleware/rateLimit.ts`.

---

Тест ажиллуулах, шаардлагын бүрэн жагсаалт: [`REQUIREMENTS.md`](REQUIREMENTS.md).
Mobile шилжилтийн явц: [`MOBILE_MIGRATION.md`](MOBILE_MIGRATION.md).
