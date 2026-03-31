// ============================================
// emotions.js — Модуль "Эмоции"
// ============================================

async function openEmotionsScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест для персонального анализа эмоций');
        return;
    }

    showLoading('Анализирую эмоциональную сферу...');

    try {
        // Здесь в будущем можно добавить реальный запрос к backend
        // Пока показываем красивую заглушку с полезным контентом

        const container = document.getElementById('screenContainer');

        container.innerHTML = `
            <div class="full-content-page" style="max-width: 900px;">
                <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
                
                <div class="content-header">
                    <div class="content-emoji" style="font-size: 68px;">💭</div>
                    <h1>Работа с эмоциями</h1>
                    <p style="color: var(--text-secondary);">Эмоциональный интеллект • Распознавание • Регуляция</p>
                </div>

                <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 24px; margin-bottom: 28px;">
                    <h3 style="color: #ff6b3b;">🔥 Что мы можем делать вместе:</h3>
                    <ul style="margin-top: 16px; line-height: 1.8; color: var(--text-secondary);">
                        <li>• Распознавать и называть свои эмоции</li>
                        <li>• Работать с эмоциональными триггерами</li>
                        <li>• Улучшать эмоциональную регуляцию</li>
                        <li>• Развивать эмоциональный интеллект</li>
                        <li>• Превращать сложные эмоции в ресурс</li>
                    </ul>
                </div>

                <h3 style="margin: 28px 0 16px; color: #ff6b3b;">Быстрые практики</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                    <div class="module-card" onclick="startEmotionPractice('naming')">
                        <div class="module-icon">🏷️</div>
                        <div class="module-name">Называние эмоций</div>
                        <div class="module-desc">Учимся точно определять, что вы чувствуете</div>
                    </div>
                    <div class="module-card" onclick="startEmotionPractice('grounding')">
                        <div class="module-icon">🌍</div>
                        <div class="module-name">Заземление 5-4-3-2-1</div>
                        <div class="module-desc">Техника быстрого возврата в настоящее</div>
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center;">
                    <button onclick="startEmotionChat()" class="voice-record-btn-premium">
                        Начать разговор об эмоциях
                    </button>
                </div>
            </div>
        `;

        document.getElementById('backToDashboard').addEventListener('click', renderDashboard);

    } catch (error) {
        showToast('Ошибка загрузки модуля');
        renderDashboard();
    }
}

// Заглушки практик
function startEmotionPractice(type) {
    if (type === 'naming') {
        showToast('🧠 Практика "Называние эмоций" скоро будет доступна');
    } else if (type === 'grounding') {
        showToast('🌍 Техника заземления 5-4-3-2-1 загружается...');
    }
}

function startEmotionChat() {
    showToast('💬 Открываем чат для работы с эмоциями');
    // В будущем здесь можно переключать режим на "emotions"
}

window.openEmotionsScreen = openEmotionsScreen;
