// push.js — подписка на push-уведомления
// VAPID public key подтягивается с бэка из env (VAPID_PUBLIC_KEY), чтобы фронт
// и бэкенд гарантированно использовали одну и ту же пару ключей.
const PUSH_API = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
let _pushPublicKey = null;
let _pushKeyPromise = null;

async function getPushPublicKey() {
    if (_pushPublicKey) return _pushPublicKey;
    if (_pushKeyPromise) return _pushKeyPromise;
    _pushKeyPromise = (async () => {
        try {
            const res = await fetch(PUSH_API + '/api/push/vapid-public-key', {
                credentials: 'include'
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.enabled && data.publicKey) {
                _pushPublicKey = String(data.publicKey).trim();
                return _pushPublicKey;
            }
            console.warn('Push отключён на сервере:', data && data.error);
            return null;
        } catch (e) {
            console.warn('Не удалось получить VAPID public key:', e);
            return null;
        } finally {
            _pushKeyPromise = null;
        }
    })();
    return _pushKeyPromise;
}

// ===== УТИЛИТЫ =====
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

// ===== РЕГИСТРАЦИЯ SERVICE WORKER =====
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('/service_worker.js');
        console.log('✅ Service Worker зарегистрирован');
        return reg;
    } catch(e) {
        console.warn('⚠️ SW registration failed:', e);
        return null;
    }
}

// ===== ПОДПИСКА НА PUSH =====
async function subscribeToPush(userId) {
    try {
        const reg = await navigator.serviceWorker.ready;
        const publicKey = await getPushPublicKey();
        if (!publicKey) {
            console.warn('Push subscribe: VAPID publicKey недоступен');
            return null;
        }
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            // Если ключ сменился (ротация) — отписываемся и пересоздаём подписку.
            const existingKey = existing.options && existing.options.applicationServerKey;
            let sameKey = true;
            try {
                if (existingKey) {
                    const existingB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(existingKey)))
                        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    sameKey = existingB64 === publicKey;
                }
            } catch (e) { sameKey = true; }

            if (sameKey) {
                await savePushSubscription(userId, existing.toJSON());
                return existing;
            }
            console.log('🔄 VAPID ключ сменился — пересоздаём подписку');
            try { await existing.unsubscribe(); } catch (e) {}
        }
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        await savePushSubscription(userId, sub.toJSON());
        console.log('✅ Push подписка создана');
        return sub;
    } catch(e) {
        console.warn('Push subscribe failed:', e);
        return null;
    }
}

async function savePushSubscription(userId, subscription) {
    try {
        await fetch(PUSH_API + '/api/push/subscribe', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId, subscription })
        });
    } catch(e) {
        console.warn('Failed to save push subscription:', e);
    }
}

// ===== ЗАПРОС РАЗРЕШЕНИЯ =====
async function requestPushPermission(userId) {
    if (!('Notification' in window)) {
        console.log('Push не поддерживается');
        return false;
    }

    if (Notification.permission === 'granted') {
        await subscribeToPush(userId);
        return true;
    }

    if (Notification.permission === 'denied') {
        return false;
    }

    // Запрашиваем разрешение
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        await subscribeToPush(userId);
        return true;
    }
    return false;
}

// ===== ОТПИСКА =====
async function unsubscribeFromPush() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        console.log('Push отписка выполнена');
    } catch(e) {
        console.warn('Unsubscribe failed:', e);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initPush(userId) {
    const reg = await registerServiceWorker();
    if (!reg) return;

    // Если уже дали разрешение — просто обновляем подписку
    if (Notification.permission === 'granted') {
        await subscribeToPush(userId);
    }
}

window.PushManager_Fredi = {
    init: initPush,
    request: requestPushPermission,
    unsubscribe: unsubscribeFromPush
};
