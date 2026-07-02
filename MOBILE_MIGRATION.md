# PWA -> React Native migration

Энэ баримт нь `nous` app-ийг одоогийн PWA хувилбараас React Native mobile app руу аажмаар шилжүүлэх явцыг тэмдэглэнэ. PWA-г ажиллаж байгаа хэвээр хадгалж, native app-ийг зэрэгцээ хөгжүүлнэ.

## Гол зорилго

- Одоогийн `client` PWA-г эвдэхгүй хадгалах.
- `server` backend-ийг аль болох хэвээр ашиглах.
- `mobile` гэсэн тусдаа Expo React Native app нэмэх.
- Feature бүрийг жижиг алхмаар port хийж, явцыг энэ doc дээр тэмдэглэх.
- Шууд App Store/Play Store release хийхээс өмнө internal build ашиглаж төхөөрөмж дээр турших.

## Одоогийн бүтэц

```text
/
  client/   # Vite React PWA
  server/   # Express API + Socket.IO + MongoDB
  legacy/   # хуучин prototype
```

Төлөвлөж буй бүтэц:

```text
/
  client/   # PWA хэвээр
  server/   # shared backend хэвээр
  mobile/   # Expo React Native app
```

## Технологийн шийдвэр

| Хэсэг | Сонголт | Тайлбар |
| --- | --- | --- |
| Native framework | Expo + React Native | Build, native module, internal distribution хийхэд хурдан |
| Navigation | Expo Router эсвэл React Navigation | Scaffold хийх үед нэгийг нь сонгоно |
| API | Одоогийн Express API | Endpoint-уудыг хадгална |
| Auth token | SecureStore/AsyncStorage | PWA-ийн `localStorage`-ийг native storage-оор солино |
| Realtime | `socket.io-client` | Одоогийн socket backend-ийг ашиглана |
| Push notification | Expo Notifications | Web Push/service worker-ийг native push-ээр солино |

## Шилжүүлэх phase-үүд

### Phase 0: Documentation ба migration суурь

- [x] Migration document үүсгэх.
- [x] `mobile` app-ийн scaffold хийхээс өмнө feature inventory гаргах.
- [x] PWA/browser-only хэсгүүдийг тэмдэглэх.

### Phase 1: Native app scaffold

- [x] `mobile/` Expo app үүсгэх.
- [x] TypeScript тохируулах.
- [x] Dev environment config нэмэх.
- [x] Backend API origin тохируулах.
- [x] Root script нэмэх эсэхийг шийдэх.

### Phase 2: Auth ба couple setup

- [ ] API client port хийх.
- [ ] Token storage-г native-д тааруулах.
- [ ] Login/register/OTP flow port хийх.
- [ ] Couple setup screen port хийх.
- [ ] Logout/session restore шалгах.

### Phase 3: Core app navigation

- [ ] Bottom tabs/stack navigation хийх.
- [ ] Home screen port хийх.
- [ ] More/settings screen port хийх.
- [ ] Basic profile UI port хийх.

### Phase 4: Chat ба realtime

- [ ] Socket connection native дээр ажиллуулах.
- [ ] Chat text message flow port хийх.
- [ ] App background/foreground reconnect шалгах.
- [ ] Message list performance шалгах.

### Phase 5: Media ба memories

- [ ] Image picker нэмэх.
- [ ] Upload API-г native FormData дээр шалгах.
- [ ] Memories/timeline list port хийх.
- [ ] Server asset URL-ууд mobile дээр absolute URL болж байгаа эсэхийг шалгах.

### Phase 6: Native push notification

- [ ] Expo notification permission flow хийх.
- [ ] Device push token хадгалах backend model/route нэмэх.
- [ ] Native push send logic нэмэх.
- [ ] Android/iOS device дээр notification шалгах.

### Phase 7: Internal build

- [ ] EAS project тохируулах.
- [ ] Android internal build гаргах.
- [ ] iOS TestFlight/ad hoc боломжийг шалгах.
- [ ] Real device QA checklist ажиллуулах.

## Web-only хэсгүүд

Эдгээрийг React Native дээр шууд хуулж болохгүй, native equivalent хэрэгтэй.

| PWA хэсэг | Native хувилбар |
| --- | --- |
| `localStorage` | `expo-secure-store` эсвэл AsyncStorage |
| Service worker | Native app lifecycle |
| Web Push `PushManager` | Expo Notifications / APNs / FCM |
| DOM elements | `View`, `Text`, `Pressable`, `FlatList` |
| Tailwind CSS classes | React Native styles эсвэл NativeWind |
| Browser file input | `expo-image-picker` |
| Browser audio APIs | `expo-av` эсвэл RN audio library |

## Mobile ажиллуулах

Mobile app нь `mobile/` доторх Expo React Native app. Утаснаас шалгахдаа backend server болон Expo Metro server хоёулаа асаалттай байх ёстой.

### 1. Backend server асаах

Root folder дээр:

```powershell
npm.cmd run dev:server
```

Server default port: `4000`.

Хэрэв MongoDB `ECONNREFUSED` эсвэл DNS алдаа гарвал `.env` доторх `MONGODB_URI` зөв эсэх, интернэт/VPN/firewall асуудалгүй эсэхийг шалгана.

### 2. Компьютерийн LAN IP-г ашиглах

Утас backend рүү `localhost`-оор орж чадахгүй. Тиймээс `EXPO_PUBLIC_API_ORIGIN` дээр компьютерийн LAN IP-г тавина.

Жишээ:

```powershell
$env:EXPO_PUBLIC_API_ORIGIN="http://192.168.100.33:4000"
```

`192.168.100.33` хэсгийг тухайн үеийн компьютерийн IP-р солино.

### 3. Expo Metro асаах

Root folder дээр:

```powershell
npm.cmd --prefix mobile run start -- --clear --lan
```

Гарах QR code-г Expo Go app-аар уншуулна. Утас болон компьютер нэг WiFi дээр байх ёстой.

Хэрэв утаснаас `Could not connect to development server` гарвал:

- server command унтраагүй эсэхийг шалгах
- утас/computer нэг WiFi дээр байгаа эсэхийг шалгах
- Windows Firewall Node/Expo-г block хийгээгүй эсэхийг шалгах
- `--lan` болохгүй бол tunnel mode ашиглах:

```powershell
npm.cmd --prefix mobile run start -- --clear --tunnel
```

### 4. Expo Go version асуудал

`Project is incompatible with this version of Expo Go` гэж гарвал project SDK болон Expo Go runtime таарахгүй байна гэсэн үг. Энэ project одоогоор Expo SDK 54 dependency set дээр тааруулсан. Expo Go update хийсний дараа ч асуудал гарвал:

```powershell
npm.cmd --prefix mobile run typecheck
npx.cmd --prefix mobile expo install --check
```

шаардлагатай dependency version-уудыг SDK-д тааруулж шалгана.

### 5. Нэвтрэх test

Backend server ажиллаж, `EXPO_PUBLIC_API_ORIGIN` зөв LAN IP дээр заасан үед PWA дээр ашигладаг account-аараа mobile дээр нэвтэрнэ.

Жишээ seed/test хэрэглэгч:

```text
username: nurlan
password: password123
```

## Feature inventory

| Feature | PWA source | Native status | Тайлбар |
| --- | --- | --- | --- |
| Auth | `client/src/pages/AuthPage.tsx` | In progress | Native login/session restore, show password, forgot password, register эхэлсэн |
| Couple setup | `client/src/pages/CoupleSetup.tsx` | In progress | Native create/join flow эхэлсэн |
| Home | `client/src/pages/Home.tsx` | In progress | Native dashboard, daily question, mood, latest memory эхэлсэн |
| Timeline | `client/src/pages/Timeline.tsx` | In progress | Native read-only timeline эхэлсэн |
| Memories | `client/src/pages/Memories.tsx` | In progress | Native list, reactions, image upload эхэлсэн |
| Chat | `client/src/pages/Chat.tsx` | In progress | Native text message list/send + realtime эхэлсэн |
| More/settings | `client/src/pages/More.tsx` | In progress | Profile edit, account card, recovery email, password change, logout эхэлсэн |
| Anniversary reminders | `client/src/components/AnniversaryReminderSheet.tsx` | In progress | Native full-screen modal, anniversary update, upcoming reminders, custom reminder add/delete нэмэв |
| Who is more | `client/src/components/CoupleGameSheet.tsx` | In progress | Native full-screen modal, quiz list/create, partner answer, result view, delete unopened quiz нэмэв |
| Battleship | `client/src/components/BattleshipSheet.tsx` | In progress | Native full-screen modal, plane placement, ready/unready, turn shooting, result/reset нэмэв |
| Number Guess | `client/src/components/NumberGuessSheet.tsx` | In progress | Native full-screen modal, secret setup, turn guess, alpha/betta history, reset approval нэмэв |
| Notifications | `client/src/lib/notifications.ts` | Needs native rewrite | Web Push биш native push |
| Socket | `client/src/lib/socket.ts` | Not started | Backend хэвээр |
| API client | `client/src/lib/api.ts` | Not started | Storage/env ялгаатай |

## Migration log

| Огноо | Өөрчлөлт | Тайлбар |
| --- | --- | --- |
| 2026-06-28 | Migration document эхлүүлэв | PWA-г хадгалж, Expo React Native app-ийг `mobile/` дээр зэрэгцээ хөгжүүлэхээр төлөвлөв |
| 2026-06-28 | `mobile/` Expo app scaffold хийв | Expo TypeScript app, root `dev:mobile`, mobile `typecheck`, `EXPO_PUBLIC_API_ORIGIN` config нэмэв |
| 2026-06-28 | Native auth суурь нэмэв | `expo-secure-store`, API client, AuthProvider, login screen, session restore, logout placeholder home нэмэв |
| 2026-06-28 | Expo Go compatibility тохируулав | Expo Go дээр SDK 56 runtime таарахгүй байсан тул `mobile` app-ийг Expo SDK 55 dependency set рүү буулгав |
| 2026-06-28 | Expo Go fallback SDK 54 болгов | Төхөөрөмж дээрх Expo Go SDK 55-г дэмжихгүй байсан тул `mobile` app-ийг SDK 54 dependency set рүү буулгаж `expo install --check` OK болгов |
| 2026-06-29 | Native couple setup эхлүүлэв | Login хийсэн user `couple`-гүй бол create/join invite code screen харуулах flow нэмэв |
| 2026-06-29 | Native tab navigation scaffold нэмэв | Home, Timeline, Memories, Chat, More tab shell нэмэж, Home-оос бусдыг placeholder screen болгож бэлдэв |
| 2026-06-29 | Native More эхлүүлэв | More tab дээр profile card, recovery email display, logout нэмэв; password/notifications дараагийн sub-feature болно |
| 2026-06-29 | Native auth detail нэмэв | Login дээр show/hide password, forgot password request OTP, reset password flow нэмэв |
| 2026-06-29 | Native register flow нэмэв | Gmail OTP request, code + username + password verify, login руу буцах flow нэмэв |
| 2026-06-29 | Native password change нэмэв | More tab дээр current/new/confirm password form, show passwords, `/auth/me/password` submit flow нэмэв |
| 2026-06-29 | Native CoupleContext нэмэв | `/couples/me`-ээс couple мэдээлэл татаж Home/More дээр invite code болон partner info бодитоор харуулдаг болов |
| 2026-06-29 | Native Chat basic нэмэв | Mobile Chat tab дээр `/messages` list, text send, `socket.io-client` realtime message update нэмэв |
| 2026-06-29 | Native recovery email flow нэмэв | More tab дээр recovery Gmail OTP request/verify flow нэмж, auth refresh хийдэг болов |
| 2026-06-29 | Native Chat typing indicator нэмэв | Mobile Chat input typing emit хийж, partner typing event ирэхэд indicator харуулдаг болов |
| 2026-06-29 | Native Chat seen status нэмэв | Mobile Chat дээр `message:read` event сонсож сүүлийн өөрийн message дээр Seen status харуулдаг болов |
| 2026-06-29 | Native Chat unsend нэмэв | Mobile Chat дээр өөрийн message дээр дарж confirm гаргаад `/messages/:id` DELETE хийх flow нэмэв |
| 2026-06-29 | Native Memories list нэмэв | Mobile Memories tab дээр `/moments` list, image render, realtime moment events, reactions нэмэв |
| 2026-06-29 | Native Memories upload нэмэв | Expo image picker ашиглаж caption + image multipart upload хийх flow нэмэв |
| 2026-06-29 | Native Memories delete нэмэв | Mobile Memories дээр өөрийн moment-г optimistic delete хийж `/moments/:id` DELETE дуудах flow нэмэв |
| 2026-06-29 | Native Timeline read-only нэмэв | Mobile Timeline tab дээр anniversary summary, generated anniversaries/birthdays, custom milestones list нэмэв |
| 2026-06-29 | Native Timeline milestones нэмэв | Mobile Timeline дээр custom milestone add form, icon select, long-press delete нэмэв |
| 2026-06-29 | Native Home dashboard нэмэв | Mobile Home дээр days together, memory/streak/invite stats, daily answer submit, mood set, latest memory preview нэмэв |
| 2026-06-29 | Native Love Notes нэмэв | Mobile More tab дээр Love Notes received/sent list, send, open locked note, delete unopened sent note flow нэмэв |
| 2026-06-29 | Native Time Capsule нэмэв | Mobile More tab дээр capsule list, future message create, unlocked text view, own capsule delete flow нэмэв |
| 2026-06-29 | Native Song of Us нэмэв | Mobile More tab дээр weekly song list/current song, YouTube preview metadata, add/edit/delete, external link open flow нэмэв |
| 2026-06-29 | Native Dream Jar нэмэв | Mobile More tab дээр wishes list/add, completion approval 2/2, delete approval 2/2, realtime wish events нэмэв |
| 2026-06-29 | Native design/icon alignment хийв | Mobile tab болон More feature rows-ийн эвдэрсэн icon тэмдэгтүүдийг засаж, PWA шиг icon badge-тэй card row болгож ойртуулав |
| 2026-06-29 | Native PWA theme/font alignment хийв | Mobile өнгөний token-уудыг PWA `rose/blush/cream/warm/deep/card` утгатай тааруулж, Auth logo дээр Playfair Display font load хийв |
| 2026-06-29 | Native modern UI polish хийв | Home dashboard-г PWA rhythm-тэй compact header/pill/dark daily card болгож, tab bar-г floating card style, More/tool cards-г `card` token + shadow-тэй болгож сайжруулав |
| 2026-06-29 | Native core screen polish хийв | Timeline hero/milestone cards, Memories upload/photo cards/reactions, Chat header/bubbles/composer-ийг PWA color token-той тааруулж илүү native app polish-той болгож, mobile source encoding/BOM цэвэрлэв |
| 2026-06-29 | Native Тоо олох тоглоом нэмэв | Mobile More > Хоёулаа хэсгээс full-screen modal нээгддэг болгож, secret setup, ээлжээр таах, alpha/betta history, realtime refresh, хоёр талын шинэ тоглоомын approval нэмэв |
| 2026-06-29 | Native Хэн нь илүү тоглоом нэмэв | Mobile More > Хоёулаа хэсгээс full-screen modal нээгддэг болгож, quiz list/create, partner answer flow, completed result review, эхлээгүй тест устгах flow нэмэв |
| 2026-06-29 | Native Онгоц буудах тоглоом нэмэв | Mobile More > Хоёулаа хэсгээс full-screen modal нээгддэг болгож, plane placement/rotate, ready/unready, turn-based shot board, hit/miss/head state, reset flow нэмэв |
| 2026-06-29 | Native Ойн сануулга нэмэв | Mobile More > Хоёулаа хэсэгт anniversary update, автомат ой/төрсөн өдөр жагсаалт, custom reminder add/delete бүхий full-screen modal нэмэв |
| 2026-06-29 | Native profile edit нэмэв | Mobile More > Бүртгэл дээр name/avatar/status/theme/birthday засах form нэмэж `/auth/me` PATCH болон auth refresh-тэй холбов |
| 2026-06-29 | PWA Тоо олох тоглоом нэмэв | Couples game menu-д 4 оронтой нууц тоо таах alpha/betta тоглоом нэмэв; backend model/route, realtime refresh, PWA sheet UI орсон |
| 2026-06-29 | PWA Тоо олох UI сайжруулав | Дүрмийг `!`/help товчоор нээгддэг болгож, тоглоом дундаас шинэ тоглоом эхлэх action нэмэв |
| 2026-06-29 | PWA Тоо олох approval/fullscreen болгов | Тоо олох тоглоомыг Battleship шиг full-screen view болгож, гарахад confirm, шинэ тоглоом эхлэхэд хоёр талын approval шаарддаг болгов |
| 2026-06-29 | PWA Хэн нь илүү fullscreen болгов | Хэн нь илүү тоглоомыг bottom sheet-ээс full-screen game view болгож, гарахад confirm болон test delete confirm нэмэв |

## Working rules

- PWA болон native app хоёр нэг backend ашиглана.
- PWA дээр ажиллаж байгаа feature-ийг native рүү port хийхдээ эхлээд behavior-ийг ойлгоод дараа нь UI-г native component-оор дахин бүтээнэ.
- Browser-specific API-г shared helper дотор оруулахгүй.
- Shared code гаргахдаа зөвхөн бодитоор давхардсан API/type/helper logic-ийг салгана.
- Том feature бүрийн дараа энэ doc-ийн `Feature inventory` болон `Migration log`-ийг шинэчилнэ.

## Дараагийн алхам

1. `mobile/` Expo app scaffold хийх.
2. `mobile`-ийн dev start/build command-уудыг root workflow-д нэмэх.
3. Auth API client болон token storage-г эхлүүлж login flow ажиллуулах.
