const CACHE = 'nexchat-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'NexChat', body: e.data.text() }; }

  const title = data.title || 'NexChat';
  const options = {
    body: data.body || 'Pesan baru',
    icon: data.icon || '/icon.png',
    badge: '/icon.png',
    tag: data.chatId || 'nexchat',
    data: { chatId: data.chatId, url: '/api/app' },
    requireInteraction: false,
    silent: false,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/api/app';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/api/app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
