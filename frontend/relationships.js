// ============================================
// relationships.js — Модуль "Отношения"
// ============================================

async function openRelationshipsScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Пройдите тест, чтобы получить персональные рекомендации по отношениям');
        return;
    }

    showLoading('Анализирую сферу отношений...');

    const container = document.getElementById('screenContainer');

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 900px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">💕</div>
                <h1>Отношения и коммуникация</h1>
                <p style="color: var(--text-secondary);">Привязанность • Границы • Конфликты</p>
            </div>

            <div style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 20px; padding: 24px; margin-bottom: 28px;">
                <h3 style="color: #3b82ff;">💞 Что мы разбираем:</h3>
                <ul style="margin-top: 16px; line-height: 1.8;">
                    <li>• Стили привязанности</li>
                    <li>• Установление здоровых границ</li>
                    <li>• Эффективная коммуникация</li>
                    <li>• Работа с конфликтами</li>
                    <li>• Привлечение здоровых отношений</li>
                </ul>
            </div>

            <h3 style="margin: 28px 0 16px; color: #3b82ff;">Полезные инструменты</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <div class="module-card" onclick="startRelationshipTool('boundaries')">
                    <div class="module-icon">🛡️</div>
                    <div class="module-name">Здоровые границы</div>
                    <div class="module-desc">Учимся говорить "нет" и защищать себя</div>
                </div>
                <div class="module-card" onclick="startRelationshipTool('communication')">
                    <div class="module-icon">🗣️</div>
                    <div class="module-name">Я-высказывания</div>
                    <div class="module-desc">Техника ненасильственного общения</div>
                </div>
            </div>

            <div style="margin-top: 40px; text-align: center;">
                <button onclick="startRelationshipChat()" class="voice-record-btn-premium">
                    Обсудить отношения с Фреди
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

function startRelationshipTool(type) {
    showToast(`💕 Инструмент "${type === 'boundaries' ? 'Здоровые границы' : 'Я-высказывания'}" скоро будет доступен`);
}

function startRelationshipChat() {
    showToast('💬 Переключаемся в режим работы с отношениями');
}

window.openRelationshipsScreen = openRelationshipsScreen;
