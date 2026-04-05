// push.js — подписка на push-уведомления
// VAPID Public Key (вставляется автоматически)
const PUSH_PUBLIC_KEY = 'BP-yST0xJbEGx5qfPdkPn2IGcLRru41wwQUdj9vXUOS7DqKd2lxMU_aAcrwRwnp9ioItzKeRFR8NNUOQ9zb2XBY';
const PUSH_API = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

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
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            await savePushSubscription(userId, existing.toJSON());
            return existing;
        }
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY)
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
