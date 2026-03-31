// ============================================
// morning.js — Утренние сообщения + автоопределение
// ============================================

async function openMorningScreen(day = null) {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Пройдите тест, чтобы получать персональные утренние сообщения');
        return;
    }

    if (!day) {
        day = await getCurrentMorningDay();
    }

    showLoading('🌅 Загружаю утреннее сообщение...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/morning-message/${USER_ID}?day=${day}`);
        const data = await response.json();

        if (data.success && data.message) {
            renderMorningMessage(data.message, day);
        } else {
            renderMorningMessage(null, day);
        }
    } catch (error) {
        console.error(error);
        renderMorningMessage(null, day);
    }
}

// Определяем, какой день показывать (1, 2 или 3)
async function getCurrentMorningDay() {
    const lastDay = localStorage.getItem(`morning_last_day_${USER_ID}`);
    const lastDate = localStorage.getItem(`morning_last_date_${USER_ID}`);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (lastDate === today && lastDay) {
        return parseInt(lastDay);
    }

    // Новый день — увеличиваем счётчик
    let currentDay = lastDay ? parseInt(lastDay) + 1 : 1;
    if (currentDay > 3) currentDay = 1;

    localStorage.setItem(`morning_last_day_${USER_ID}`, currentDay);
    localStorage.setItem(`morning_last_date_${USER_ID}`, today);

    return currentDay;
}

function renderMorningMessage(message, day) {
    const container = document.getElementById('screenContainer');

    const formattedMessage = message 
        ? message.replace(/\n/g, '<br><br>')
        : `Доброе утро!<br><br>Сегодня новый день. Ты уже на пути к лучшей версии себя.<br><br>Я рядом и верю в тебя.`;

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 820px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 78px;">🌅</div>
                <h1>Утреннее сообщение</h1>
                <p style="color: var(--text-secondary);">День ${day} • Персонально для тебя</p>
            </div>

            <div class="morning-message-card">
                <div class="morning-text">${formattedMessage}</div>
            </div>

            <div class="morning-actions">
                <button onclick="getNextMorningMessage()" class="voice-record-btn-premium">
                    Получить сообщение на следующий день
                </button>
                <button onclick="enableMorningNotifications()" class="back-btn" style="background: rgba(59,130,246,0.1); border-color: #3b82ff;">
                    🔔 Включить push-уведомления
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

async function getNextMorningMessage() {
    let nextDay = 1;
    const currentDay = localStorage.getItem(`morning_last_day_${USER_ID}`);
    if (currentDay) {
        nextDay = parseInt(currentDay) % 3 + 1;
    }
    await openMorningScreen(nextDay);
}

// Заглушка для push-уведомлений (будем развивать позже)
function enableMorningNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            showToast('🔔 Push-уведомления уже включены');
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast('✅ Push-уведомления включены! Теперь я буду присылать утренние сообщения.');
                }
            });
        }
    } else {
        showToast('Push-уведомления не поддерживаются в вашем браузере');
    }
}

// Экспорт
window.openMorningScreen = openMorningScreen;
window.getNextMorningMessage = getNextMorningMessage;
window.enableMorningNotifications = enableMorningNotifications;
