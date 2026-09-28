# nous — Шаардлага, тест, production checklist

Энэ баримт нь nous-ийг **production app** (App Store / Google Play + web) болгоход шаардлагатай бүх зүйлийг нэг дор цуглуулна:
функциональ шаардлага, функциональ бус шаардлага, тестийн хамрах хүрээ, гаргахаас өмнөх checklist.

Тэмдэглэгээ: ✅ хийгдсэн · 🟡 хэсэгчлэн · ⬜ хийгдээгүй

---

## 1. Функциональ шаардлага

### 1.1 Бүртгэл, нэвтрэлт

| ID | Шаардлага | Server | Web | Mobile | Тест |
|----|-----------|:-:|:-:|:-:|:-:|
| AUTH-1 | Gmail руу 6 оронтой OTP илгээж бүртгүүлнэ (username + password ≥ 6) | ✅ | ✅ | ✅ | ✅ server |
| AUTH-2 | Давхцсан username-д автоматаар тоо залгана (`aysu` → `aysu1`) | ✅ | ✅ | ✅ | ✅ server |
| AUTH-3 | Нэг Gmail = нэг бүртгэл | ✅ | ✅ | ✅ | ✅ server |
| AUTH-4 | Username эсвэл бүтэн имэйлээр нэвтэрнэ | ✅ | ✅ | ✅ | ✅ server |
| AUTH-5 | Нууц үг мартсан → OTP → шинэ нууц үг; код нэг л удаа ажиллана | ✅ | ✅ | ✅ | ✅ server |
| AUTH-6 | OTP 10 минутад хүчингүй, 5 буруу оролдлогын дараа хүчингүй | ✅ | — | — | ✅ server |
| AUTH-7 | Production-д OTP кодыг API хариунд **хэзээ ч** буцаахгүй | ✅ | — | — | ✅ server |
| AUTH-8 | Нууц үг солих (одоогийнхоор баталгаажуулна) | ✅ | ✅ | ✅ | ✅ server |
| AUTH-9 | Сэргээх Gmail солих (OTP) | ✅ | ✅ | ✅ | ⬜ |
| AUTH-10 | Session хадгалах (web: localStorage, mobile: SecureStore), 401 үед автоматаар гаргах | ✅ | 🟡 | ✅ | ✅ mobile |
| AUTH-12 | Профайл засах, профайл зураг upload | ✅ | ✅ | ✅ | ✅ server (профайл) |
| AUTH-11 | **Бүртгэл бүрмөсөн устгах** (App Store 5.1.1(v), Google Play шаардлага) | ✅ | ✅ | ✅ | ✅ server + mobile |

### 1.2 Хос холбох

| ID | Шаардлага | Server | Web | Mobile | Тест |
|----|-----------|:-:|:-:|:-:|:-:|
| CPL-1 | Хос үүсгэж 6 тэмдэгттэй урилгын код авна (андуурагдах 0/O, 1/I-гүй) | ✅ | ✅ | ✅ | ✅ server |
| CPL-2 | Кодоор нэгдэнэ; хос 2-оос олон гишүүнтэй болохгүй (зэрэг нэгдэлтэд ч) | ✅ | ✅ | ✅ | ✅ server |
| CPL-3 | Хос бүрийн өгөгдөл бусад хосоос бүрэн тусгаарлагдана | ✅ | — | — | ✅ server |
| CPL-4 | Ой, төрсөн өдөр тохируулах | ✅ | ✅ | ✅ | ✅ server |

### 1.3 Чат (real-time)

| ID | Шаардлага | Server | Web | Mobile | Тест |
|----|-----------|:-:|:-:|:-:|:-:|
| CHAT-1 | Текст зурвас илгээх / хүлээн авах (Socket.IO) | ✅ | ✅ | ✅ | ✅ server + socket |
| CHAT-2 | Зураг илгээх | ✅ | ✅ | ✅ | ✅ server |
| CHAT-8 | Чатын цэс: хуваалцсан зургууд (`/messages/media`, pagination), чат цэвэрлэх | ✅ | ✅ | ✅ | ✅ server |
| CHAT-9 | Хамтрагчийн профайл (онлайн төлөв, хамтдаа хэдэн хоног, төрсөн өдөр) | ✅ | ✅ | ✅ | ✅ mobile (helper) |
| CHAT-3 | Зурвас татах (unsend) — зөвхөн өөрийнхөө | ✅ | ✅ | ✅ | ✅ server |
| CHAT-4 | Бичиж байна…, Үзсэн, Онлайн / сүүлд онлайн | ✅ | ✅ | ✅ | ✅ mobile (format) |
| CHAT-5 | Хамгийн сүүлийн зурвасууд харагдана, хуучныг дээш ачаална (`?before=`) | ✅ | ✅ | ✅ | ✅ server |
| CHAT-6 | Background-оос буцах / сүлжээ тасрах үед алдсан зурвасаа татна | — | 🟡 | ✅ | ⬜ |
| CHAT-7 | Шинэ зурвасын push notification (web: Web Push, mobile: Expo) | ✅ | ✅ | ✅ | ✅ server (token) |

### 1.4 Дурсамж, timeline, өдөр тутмын

| ID | Шаардлага | Server | Web | Mobile | Тест |
|----|-----------|:-:|:-:|:-:|:-:|
| MEM-1 | Зураг + тайлбар оруулах, зөвхөн зураг зөвшөөрнө | ✅ | ✅ | ✅ | ✅ server |
| MEM-2 | Reaction toggle | ✅ | ✅ | ✅ | ✅ server |
| MEM-3 | Зөвхөн зохиогч устгана, файл нь хамт устна | ✅ | ✅ | ✅ | ✅ server |
| TL-1 | Ой / төрсөн өдөр автоматаар, custom milestone нэмэх/устгах | ✅ | ✅ | ✅ | ⬜ |
| DAY-1 | Өдрийн асуулт, хариулт, архив | ✅ | ✅ | ✅ | ✅ server + mobile (helper) |
| MOOD-1 | Сэтгэл санаа тэмдэглэх | ✅ | ✅ | ✅ | ⬜ |

### 1.5 Хамтын функц, тоглоом

| ID | Шаардлага | Server | Web | Mobile | Тест |
|----|-----------|:-:|:-:|:-:|:-:|
| FUN-1 | Love Notes (түгжээтэй захидал) | ✅ | ✅ | ✅ | ✅ server |
| FUN-2 | Time Capsule | ✅ | ✅ | ✅ | ✅ server |
| FUN-3 | Song of Us (YouTube) | ✅ | ✅ | 🟡 (гадна нээнэ, mini player-гүй) | ⬜ |
| FUN-4 | Dream Jar (2/2 зөвшөөрөл) | ✅ | ✅ | ✅ | ✅ server |
| GAME-1 | Хэн нь илүү | ✅ | ✅ | ✅ | ✅ server |
| GAME-2 | Онгоц буудах | ✅ | ✅ | ✅ | ✅ server |
| GAME-3 | Тоо олох | ✅ | ✅ | ✅ | ✅ server |

### 1.6 Web-д байгаа, mobile-д дутуу

- Чатын wallpaper
- Song mini player (app дотор тоглуулах; одоо YouTube-ийг гадна нээнэ)

---

## 2. Функциональ бус шаардлага

| ID | Шаардлага | Төлөв |
|----|-----------|:-:|
| SEC-1 | HTTPS заавал (iOS ATS, Android cleartext хориг — **production API HTTPS-гүй бол mobile app ажиллахгүй**) | ⬜ |
| SEC-2 | `JWT_SECRET` production-д ≥ 32 тэмдэгт, эс бөгөөс server асахгүй | ✅ |
| SEC-3 | Rate limit: login 20/15мин, OTP илгээх 10/цаг, OTP шалгах 20/15мин, API 300/мин (IP-ээр) | ✅ |
| SEC-4 | Helmet security header, `x-powered-by` хаасан | ✅ |
| SEC-5 | OTP/урилгын код `crypto.randomInt`-ээр | ✅ |
| SEC-6 | Буруу ObjectId / JSON → 400 (500 биш) | ✅ |
| SEC-7 | Mobile token SecureStore-д | ✅ |
| SEC-8 | `/uploads` зураг зөвхөн эзэн болон хосдоо (тусгай media token `?t=`, API token-оос тусдаа; эрхгүй бол 404; token log-д бичигдэхгүй). Cloudinary ашиглавал URL нийтэд нээлттэй хэвээр | ✅ (disk) |
| REL-1 | SIGTERM үед graceful shutdown | ✅ |
| REL-2 | MongoDB + uploads backup (`scripts/backup.sh`, cron-д тохируулах үлдсэн) | 🟡 |
| REL-3 | Health check (`/api/health`) + docker healthcheck | ✅ |
| REL-4 | Socket дахин холбогдоход token шинээр уншина, foreground болоход сэргээнэ | ✅ mobile |
| REL-5 | Дэлгэц бүр socket listener-ээ нэрээр нь салгана (таб солиход бусад дэлгэцийн real-time эвдрэхгүй) | ✅ mobile |
| OBS-1 | Алдааны мониторинг (Sentry: server + mobile) | ⬜ |
| OBS-2 | Бүтэцтэй JSON log (pino, request id, token/нууц үг redact) | ✅ |
| SCALE-1 | Presence санах ойд — 1-ээс олон server instance бол Redis adapter хэрэгтэй | ⬜ |
| UX-1 | Safe area (notch, Dynamic Island, home indicator) | ✅ mobile |
| UX-3 | Профайлд сонгосон өнгөний загвар (5 theme) апп даяар хэрэгжинэ | ✅ web + mobile |
| UX-2 | Сүлжээгүй / timeout үед ойлгомжтой алдаа | ✅ mobile |
| LEGAL-1 | Privacy Policy URL (`client/public/privacy.html` → `/privacy.html`; web/mobile-д холбоостой; холбоо барих имэйлийг солих үлдсэн) | 🟡 |
| LEGAL-2 | Play Store Data safety, App Store Privacy nutrition label | ⬜ |

---

## 3. Тест

### 3.1 Ажиллуулах

```bash
# Server (Vitest + Supertest + in-memory MongoDB)
npm --prefix server test

# Mobile (Jest + jest-expo + React Native Testing Library)
npm --prefix mobile test

# Бүх typecheck
npm run typecheck
```

CI (`.github/workflows/deploy-aws-docker.yml`) нь PR болон `main` push бүрд server test, mobile typecheck, mobile test ажиллуулна.
Deploy зөвхөн `main`/`master` дээр, бүх шалгалт давсны дараа явна.

### 3.2 Хамрах хүрээ

| Давхарга | Файл | Юуг шалгадаг |
|----------|------|--------------|
| Server | `server/test/auth.test.ts` | Бүртгэл, OTP (хугацаа, 5 оролдлого, дахин ашиглах), production-д devCode нуух, login, нууц үг сэргээх/солих, профайл |
| Server | `server/test/couple.test.ts` | Хос үүсгэх/нэгдэх, зэрэг нэгдэлт, хос хоорондын тусгаарлалт, чат (жагсаалт, pagination, unsend) |
| Server | `server/test/moments.test.ts` | Зураг upload, reaction, эрх, файл устгах, зураг биш файл татгалзах |
| Server | `server/test/features.test.ts` | Dream Jar 2/2, Love Note нуугдах/нээх эрх, Time Capsule түгжээ, өдрийн асуулт + түүх, Тоо олох (ээлж, alpha/betta, ялагч, reset) |
| Server | `server/test/games.test.ts` | Хэн нь илүү (нуугдах хариулт, эрх, оноо), Battleship бүтэн тоглолт (байрлуулах, ээлж, хамар буудах → ялалт, онгоцны тоо 2/2, давхцал, өрсөлдөгчийн онгоц нуугдах) |
| Server | `server/test/socket.test.ts` | Socket.IO: token/хосгүй холболт татгалзах, хос хоорондын тусгаарлалт, presence, typing |
| Server | `server/test/account.test.ts` | Expo push token бүртгэх/шилжүүлэх, бүртгэл устгах (хамтрагчид өгөгдөл үлдэх, сүүлийнх устгавал бүгд устах) |
| Mobile | `mobile/src/lib/__tests__/api.test.ts` | Token header, алдааны мессеж, 401 → logout, сүлжээний алдаа, asset URL |
| Mobile | `mobile/src/lib/__tests__/format.test.ts` | Хугацаа, онлайн төлөв, "Үзсэн", жагсаалтын туслахууд |
| Mobile | `mobile/src/hooks/__tests__/useSocketEvents.test.ts` | Нэг дэлгэц unmount болоход нөгөөгийн listener үлдэх, хамгийн сүүлийн handler дуудагдах |
| Mobile | `mobile/src/components/__tests__/DeleteAccountSection.test.tsx` | Бүртгэл устгах UI flow |

### 3.3 Дараагийн тестүүд

1. Mobile E2E (Maestro): login → хос → чат → зураг → logout. Бодит төхөөрөмж дээрх QA доорх checklist-ээр.

### 3.4 Гар аргаар QA checklist (build бүрд)

- [ ] Шинэ бүртгэл (жинхэнэ Gmail-д код ирж байна)
- [ ] Нууц үг сэргээх
- [ ] Хос үүсгэх / нэгдэх (2 төхөөрөмж)
- [ ] Чат: текст, зураг, unsend, бичиж байна, Үзсэн, онлайн төлөв
- [ ] App-ийг background-д 1+ минут байлгаад буцахад шинэ зурвас харагдана
- [ ] App хаалттай үед push ирнэ, дарахад чат нээгдэнэ
- [ ] Дурсамж upload / устгах
- [ ] Тоглоом бүрийг 2 төхөөрөмжөөр нэг тойрог тоглох
- [ ] Logout → өөр бүртгэлээр нэвтрэхэд өмнөх хүний push ирэхгүй
- [ ] Бүртгэл устгах
- [ ] iPhone (notch/Dynamic Island), жижиг Android дэлгэц дээр layout

---

## 4. Production гаргах checklist

### Server
- [ ] API-г HTTPS домэйн дээр гаргах (жнь `https://api.nous.mn`; nginx/Caddy + Let's Encrypt)
- [ ] VPS `.env`-д: `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CLIENT_ORIGIN` (https), шаардлагатай бол `CLOUDINARY_*`, `VAPID_*`, `EXPO_ACCESS_TOKEN`
  > ⚠️ Gmail тохируулаагүй бол production-д бүртгэл болон нууц үг сэргээх **ажиллахгүй** (код дэлгэцэнд гарахгүй болсон).
- [ ] MongoDB backup cron
- [ ] Sentry

### Mobile (Expo EAS)
- [ ] `npm i -g eas-cli && eas login && eas init` → `app.json`-ийн `extra.eas.projectId` бөглөгдөнө (push-д заавал)
- [ ] `app.json`-ийн `ios.bundleIdentifier` / `android.package` (`mn.nous.app`)-г эцэслэх — store-д гарсны дараа солих боломжгүй
- [ ] `eas.json`-ийн `EXPO_PUBLIC_API_ORIGIN`-г бодит HTTPS домэйнээр солих
- [ ] Android push: Firebase project → `google-services.json` → `eas credentials` дээр FCM V1 key
- [ ] iOS push: `eas credentials` APNs key автоматаар үүсгэнэ (Apple Developer ($99/жил) шаардлагатай)
- [ ] App icon, splash, store screenshot-ууд
- [ ] Privacy Policy хуудас
- [ ] `eas build --profile preview` → дотоод тест → `eas build --profile production` → `eas submit`
