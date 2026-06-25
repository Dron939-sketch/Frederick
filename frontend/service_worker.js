// service_worker.js — Фреди PWA
// Версия 1.2 — относительные пути для меуstern-NLP-deployment под /fredi/

// Относительные пути (без ведущего /) — SW резолвит их относительно своей
// собственной локации. SW зарегистрирован как /fredi/service_worker.js,
// значит './styles.css' → '/fredi/styles.css'. Раньше были '/styles.css',
// которые на meysternlp.ru уходили в КОРЕНЬ домена → 404 в nginx-логах:
//   open() "/usr/share/nginx/html/styles.css" failed (No such file or directory)
// Service Worker install падал тихо, кэш был неполный.
const CACHE_NAME = 'fredi-v13';
// ВАЖНО: app.js / kontur.js НЕ кэшируем в precache — они часто меняются
// (новые модули, фичи). Иначе на мобиле застревает старый код, и новые
// пункты меню («Игры») «не открываются».
const STATIC_FILES = ['./', './styles.css'];

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

// SW зарегистрирован под /fredi/ → дефолтные иконки и URL должны идти в
// /fredi/, иначе они уходят в корень meysternlp.ru (где их нет).
const SW_BASE = new URL('./', self.location).pathname;  // '/fredi/'

// ===== PUSH-УВЕДОМЛЕНИЯ =====
self.addEventListener('push', e => {
    let data = { title: 'Фреди', body: 'Есть новое событие', url: SW_BASE, icon: SW_BASE + 'icon-192.png' };
    try {
        if (e.data) data = { ...data, ...e.data.json() };
    } catch {}

    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || (SW_BASE + 'icon-192.png'),
            badge: SW_BASE + 'icon-72.png',
            tag: 'fredi-notification',
            renotify: true,
            requireInteraction: false,
            data: { url: data.url || SW_BASE },
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
    const url = e.notification.data?.url || SW_BASE;

    if (e.action === 'close') return;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
            const match = wins.find(w => w.url.includes(self.location.origin));
            if (match) { match.focus(); match.navigate(url); }
            else clients.openWindow(url);
        })
    );
});

// Fetch — network-first c обходом HTTP-кэша для ЯДРА приложения.
// ПОЧЕМУ: на мобиле fetch(e.request) внутри SW мог вернуть устаревший
// app.js / kontur.js / index.html из HTTP-кэша браузера (не из сети) —
// тогда новый пункт меню «Игры» отсутствовал и «не открывался».
// Решение: для навигации и .js/.css/.html форсируем свежую версию с
// сервера (cache:'reload'), свежую копию кладём в кэш для офлайна.
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/api/')) return; // API не кэшируем

    var sameOrigin = e.request.url.indexOf(self.location.origin) === 0;
    var isCore = false;
    try {
        var p = new URL(e.request.url).pathname;
        isCore = e.request.mode === 'navigate' || (sameOrigin && /\.(js|css|html)$/i.test(p));
    } catch (err) {}

    var req = e.request;
    if (isCore) {
        // new Request(orig, {cache:'reload'}) сохраняет mode/credentials и
        // лишь принудительно идёт мимо HTTP-кэша в сеть.
        try { req = new Request(e.request, { cache: 'reload' }); } catch (err) {}
    }

    e.respondWith(
        fetch(req).then(function (resp) {
            if (resp && resp.ok && sameOrigin && e.request.url.indexOf('chrome-extension') === -1) {
                var copy = resp.clone();
                caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); }).catch(function () {});
            }
            return resp;
        }).catch(function () { return caches.match(e.request); })
    );
});
