# Nous — Project Overview

## Нэг өгүүлбэрээр

Nous нь хосуудад зориулсан React web, React Native mobile, Node/Express API, MongoDB болон Socket.IO бүхий real-time full-stack бүтээгдэхүүн юм.

## Хөгжүүлсэн арга

Төслийн санаа, шаардлага, feature чиглэлийг би тодорхойлж, AI-г implementation assistant болгон ашигласан. Миний үүрэг зөвхөн prompt бичихээр хязгаарлагдаагүй: гарсан кодыг ажиллуулах, алдаа засах, client/server integration хийх, workflow-ийг сайжруулах замаар full-stack системийн ойлголтоо хөгжүүлсэн.

## Бүтэц

- `client/` — React/Vite web client
- `mobile/` — React Native mobile client
- `server/` — Express API, Socket.IO, Mongoose
- `legacy/` — эхний prototype
- `.github/workflows/deploy-aws-docker.yml` — AWS/Docker deployment workflow
- `docker-compose*.yml` — local болон production orchestration

## Гол инженерийн ойлголтууд

- JWT authentication болон protected API
- MongoDB document model
- Socket.IO connection, event болон shared state
- Web/mobile client-ийн нэг backend ашиглалт
- Docker multi-service runtime
- Prototype-оос салангид client/server бүтэц рүү шилжилт

## Миний сурсан зүйл

- HTTP request ба WebSocket event-ийн ялгаа
- Authentication state-ийг олон client дээр удирдах
- Environment config болон development/production ялгаа
- Real-time feature дээр reconnect, duplicate event, stale state-ийг бодолцох

## Сайжруулах дараалал

1. Гол хэрэглэгчийн journey бүрд integration/E2E test нэмэх.
2. Socket event contract-уудыг төвлөрүүлж type-safe болгох.
3. Error handling, reconnect болон offline төлвийг баталгаажуулах.
4. Production secrets, logging, backup, rate limit-ийг аудит хийх.

## Portfolio-д хэрэглэх тодорхойлолт

> Шаардлага, бүтээгдэхүүний чиглэлийг өөрөө тодорхойлж, AI-assisted байдлаар хөгжүүлсэн real-time web/mobile application. Энэ төслөөр authentication, Socket.IO, MongoDB, multi-client architecture болон Docker delivery-г практикт сурсан.

