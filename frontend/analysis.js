// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 2.0 — улучшенный дизайн и структура
// ============================================

async function openAnalysisScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        return;
    }

    showLoading('🔍 Анализирую глубинные паттерны и петли...');

    try {
        const userId = USER_ID;

        // Параллельная загрузка данных
        const [modelRes, loopsRes, keyRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}/loops`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}/key-confinement`).then(r => r.json())
        ]);

        const model = modelRes.success ? modelRes : {};
        const loops = loopsRes.success ? loopsRes.loops || [] : [];
        const keyConfinement = keyRes.success ? keyRes.key_confinement : null;

        renderAnalysisUI(model, loops, keyConfinement);

    } catch (error) {
        console.error('Analysis loading error:', error);
        showToast('Не удалось загрузить анализ. Попробуйте позже.');
        renderDashboard();
    }
}

function renderAnalysisUI(model, loops, keyConfinement) {
    const container = document.getElementById('screenContainer');

    // Ключевое ограничение
    let keyHtml = '';
    if (keyConfinement && keyConfinement.name) {
        keyHtml = `
            <div class="analysis-key-confinement">
                <h3>🔑 Ключевое ограничение</h3>
                <div class="key-name">${keyConfinement.name}</div>
                <p>${keyConfinement.description || 'Центральный паттерн, влияющий на многие сферы жизни.'}</p>
            </div>`;
    }

    // Список петель
    const loopsHtml = loops.length > 0 
        ? loops.map((loop, i) => `
            <div class="loop-item">
                <div class="loop-number">Петля ${i+1}</div>
                <div class="loop-name">${loop.name || 'Повторяющийся цикл'}</div>
                <div class="loop-desc">${loop.description || 'Автоматический паттерн мышления и поведения'}</div>
            </div>`).join('')
        : `<div class="no-loops">Пока петли не обнаружены.<br>Продолжайте общение с Фреди — анализ будет обновляться автоматически.</div>`;

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 1100px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">🧠</div>
                <h1>Анализ глубинных паттернов</h1>
                <p style="color: var(--text-secondary);">Конфайнтмент-модель • Психологические петли</p>
            </div>

            ${keyHtml}

            <!-- Статистика -->
            <div class="analysis-stats">
                <div class="stat-card">
                    <div class="stat-icon">📍</div>
                    <div class="stat-value">${Object.keys(model.elements || {}).length}</div>
                    <div class="stat-label">Элементов в модели</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔄</div>
                    <div class="stat-value">${loops.length}</div>
                    <div class="stat-label">Активных петель</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔒</div>
                    <div class="stat-value" style="color: ${model.is_closed ? '#ef4444' : '#10b981'}">
                        ${model.is_closed ? 'Замкнута' : 'Открыта'}
                    </div>
                    <div class="stat-label">Система</div>
                </div>
            </div>

            <!-- Петли -->
            <h3 style="color: #ff6b3b; margin: 32px 0 16px;">🔄 Психологические петли</h3>
            <div class="loops-container">
                ${loopsHtml}
            </div>

            <!-- Действия -->
            <div class="analysis-actions">
                <button onclick="getPersonalIntervention()" class="voice-record-btn-premium">
                    Получить персональную интервенцию
                </button>
            </div>
        </div>
    `;

    // Кнопка "Назад"
    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Заглушка для персональной интервенции
async function getPersonalIntervention() {
    showToast('🧘‍♂️ Генерирую персональную интервенцию...<br>Скоро здесь появится практика из InterventionLibrary');
}

// Экспорт функций
window.openAnalysisScreen = openAnalysisScreen;
window.getPersonalIntervention = getPersonalIntervention;
