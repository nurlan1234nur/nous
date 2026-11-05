// nous PWA service worker
// Дэд замаар (/nous/) байршсан үед ч ажиллахын тулд угтварыг өөрийн scope-оос авна.
const BASE = new URL(self.registration.scope).pathname; // '/' эсвэл '/nous/'
const CACHE = 'nous-v3';
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icons/icon-192.png', BASE + 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Динамик/proxy зам — кэш хийхгүй, шууд сүлжээгээр.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith(BASE + 'api/') ||
      url.pathname.startsWith(BASE + 'uploads/') ||
      url.pathname.startsWith(BASE + 'socket.io/'))
  ) {
    return;
  }

  // Navigation (HTML) — network-first, офлайнд кэшийн shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(BASE, copy));
          return res;
        })
        .catch(() => caches.match(BASE).then((r) => r || caches.match(BASE + 'index.html'))),
    );
    return;
  }

  // Бусад static asset — cache-first, дараа нь runtime кэш.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const chatIsVisible = clients.some((client) => {
        const url = new URL(client.url);
        return client.visibilityState === 'visible' && url.pathname === BASE + 'chat';
      });
      if (chatIsVisible) return;
      return self.registration.showNotification(data.title ?? 'nous', {
        body: data.body ?? 'Шинэ зурвас ирлээ',
        icon: BASE + 'icons/icon-192.png',
        badge: BASE + 'icons/icon-192.png',
        tag: data.tag ?? 'nous-message',
        renotify: true,
        data: { url: BASE + String(data.url ?? '/chat').replace(/^\//, '') },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url ?? BASE + 'chat', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
