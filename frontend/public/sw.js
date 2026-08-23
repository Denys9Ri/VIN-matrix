const DEFAULT_ICON = '/manifest.webmanifest/android-chrome-192x192.png';
const DEFAULT_URL = '/app';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'VIN Matrix';
  const options = {
    body: payload.body || 'Нове повідомлення у VIN Matrix',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_ICON,
    tag: payload.tag || undefined,
    data: {
      url: payload.url || DEFAULT_URL,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification?.data?.url || DEFAULT_URL, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windows) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl);
          return;
        }
      } catch {
        // Ignore malformed client URLs and try the next window.
      }
    }

    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
