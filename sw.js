// sw.js — Service Worker для Push-уведомлений
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Доброе утро! Новое сообщение от Фреди.',
        icon: '/icon-192.png',           // создай такую иконку
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Фреди', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
