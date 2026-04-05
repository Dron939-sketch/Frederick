// service_worker.js — Фреди PWA
// Версия 1.0

const CACHE_NAME = 'fredi-v1';
const STATIC_FILES = ['/', '/styles.css', '/app.js', '/mirrors.js', '/admin.js'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ===== PUSH-УВЕДОМЛЕНИЯ =====
self.addEventListener('push', e => {
    let data = { title: 'Фреди', body: 'Есть новое событие', url: '/', icon: '/icon-192.png' };
    try {
        if (e.data) data = { ...data, ...e.data.json() };
    } catch {}

    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/icon-192.png',
            badge: '/icon-72.png',
            tag: 'fredi-notification',
            renotify: true,
            requireInteraction: false,
            data: { url: data.url || '/' },
            actions: [
                { action: 'open', title: 'Открыть' },
                { action: 'close', title: 'Закрыть' }
            ]
        })
    );
});

// Клик по уведомлению
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';

    if (e.action === 'close') return;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
            const match = wins.find(w => w.url.includes(self.location.origin));
            if (match) { match.focus(); match.navigate(url); }
            else clients.openWindow(url);
        })
    );
});

// Fetch — network first, fallback cache
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/api/')) return; // API не кэшируем
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
