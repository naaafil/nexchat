self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'NexChat', body: e.data.text() }; }

  const title = data.title || 'NexChat';
  const opts = {
    body: data.body || 'Pesan baru',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.chatId || 'nexchat-msg',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/api/app', chatId: data.chatId },
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/api/app';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/api/app') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
