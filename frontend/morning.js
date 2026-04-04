// ============================================
// morning.js — Утренние сообщения + Push-уведомления
// ============================================

let pushSubscription = null;

async function openMorningScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Пройдите тест, чтобы получать персональные утренние сообщения');
        return;
    }

    showLoading('🌅 Загружаю утреннее сообщение...');

    try {
        const day = await getCurrentMorningDay();
        const response = await fetch(`${API_BASE_URL}/api/morning-message/${USER_ID}?day=${day}`);
        const data = await response.json();

        if (data.success && data.message) {
            renderMorningMessage(data.message, day);
        } else {
            renderMorningMessage(null, day);
        }
    } catch (error) {
        console.error(error);
        renderMorningMessage(null, 1);
    }
}

function renderMorningMessage(message, day) {
    const container = document.getElementById('screenContainer');

    const formatted = message 
        ? message.replace(/\n/g, '<br><br>')
        : 'Доброе утро! Новый день — новая возможность стать лучше.';

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 820px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 74px;">🌅</div>
                <h1>Утреннее сообщение</h1>
                <p style="color: var(--text-secondary);">День ${day} • Персонально для тебя</p>
            </div>

            <div class="morning-message-card">
                <div class="morning-text">${formatted}</div>
            </div>

            <div class="morning-actions">
                <button onclick="getNextMorningMessage()" class="voice-record-btn-premium">
                    Следующее сообщение
                </button>
                
                <button onclick="subscribeToPushNotifications()" id="pushBtn" class="back-btn" 
                        style="background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.4);">
                    🔔 Включить утренние push-уведомления
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Определение текущего дня серии
async function getCurrentMorningDay() {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = localStorage.getItem(`morning_date_${USER_ID}`);
    let savedDay = parseInt(localStorage.getItem(`morning_day_${USER_ID}`)) || 1;

    if (savedDate === today) {
        return savedDay;
    }

    // Новый день — увеличиваем счётчик (цикл 1→2→3→1)
    savedDay = savedDay % 3 + 1;
    localStorage.setItem(`morning_day_${USER_ID}`, savedDay);
    localStorage.setItem(`morning_date_${USER_ID}`, today);

    return savedDay;
}

async function getNextMorningMessage() {
    showLoading('🌅 Загружаю следующее сообщение...');
    const nextDay = (parseInt(localStorage.getItem(`morning_day_${USER_ID}`)) || 1) % 3 + 1;
    await openMorningScreen(nextDay);
}

// ============================================
// PUSH-УВЕДОМЛЕНИЯ
// ============================================

async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push-уведомления не поддерживаются в вашем браузере');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Вы отклонили разрешение на уведомления');
            return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');

        // VAPID ключ из конфига или переменной окружения
        const vapidKey = window.VAPID_PUBLIC_KEY || window.CONFIG?.VAPID_PUBLIC_KEY;
        if (!vapidKey) {
            showToast('⚠️ Push-уведомления временно недоступны');
            return;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });

        pushSubscription = subscription;

        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;

        await fetch(`${apiUrl}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, subscription: subscription })
        });

        showToast('✅ Push-уведомления включены! Буду присылать утренние сообщения.');

    } catch (error) {
        console.error('Push subscription error:', error);
        showToast('Не удалось включить push-уведомления');
    }
}

// Вспомогательная функция для VAPID
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Автоматическая инициализация Service Worker
async function initMorningPush() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
        } catch (e) {
            console.warn('Service Worker registration failed:', e);
        }
    }
}

// Алиас для совместимости с app.js
window.showMorningScreen = openMorningScreen;
window.openMorningScreen = openMorningScreen;
window.getNextMorningMessage = getNextMorningMessage;
window.subscribeToPushNotifications = subscribeToPushNotifications;
window.initMorningPush = initMorningPush;

console.log('✅ morning.js загружен');
