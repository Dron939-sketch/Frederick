// ============================================
// healing.js — Модуль "Исцеление"
// ============================================

async function openHealingScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Для работы с исцелением рекомендуется пройти тест');
        return;
    }

    showLoading('Загружаю инструменты исцеления...');

    const container = document.getElementById('screenContainer');

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 900px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">🕊️</div>
                <h1>Исцеление и проработка</h1>
                <p style="color: var(--text-secondary);">Внутренний ребёнок • Травмы • Самосострадание</p>
            </div>

            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05)); border-radius: 20px; padding: 24px; margin-bottom: 28px; border: 1px solid rgba(16,185,129,0.2);">
                <h3 style="color: #10b981;">🌱 Направления исцеления:</h3>
                <ul style="margin-top: 16px; line-height: 1.8;">
                    <li>• Проработка детских травм</li>
                    <li>• Развитие самосострадания</li>
                    <li>• Работа с внутренним критиком</li>
                    <li>• Восстановление после токсичных отношений</li>
                    <li>• Интеграция болезненного опыта</li>
                </ul>
            </div>

            <h3 style="margin: 28px 0 16px; color: #10b981;">Доступные практики</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <div class="module-card" onclick="startHealingPractice('inner-child')">
                    <div class="module-icon">👶</div>
                    <div class="module-name">Внутренний ребёнок</div>
                    <div class="module-desc">Диалог с собой в детстве</div>
                </div>
                <div class="module-card" onclick="startHealingPractice('self-compassion')">
                    <div class="module-icon">❤️</div>
                    <div class="module-name">Самосострадание</div>
                    <div class="module-desc">Учимся быть добрее к себе</div>
                </div>
            </div>

            <div style="margin-top: 40px; text-align: center;">
                <button onclick="startHealingSession()" class="voice-record-btn-premium">
                    Начать сессию исцеления
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

function startHealingPractice(type) {
    showToast(`🕊️ Практика "${type === 'inner-child' ? 'Внутренний ребёнок' : 'Самосострадание'}" в разработке`);
}

function startHealingSession() {
    showToast('🌿 Начинаем терапевтическую сессию исцеления...');
}

window.openHealingScreen = openHealingScreen;
