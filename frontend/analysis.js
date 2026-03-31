// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// ============================================

// Основная функция открытия экрана анализа
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
        console.error('Analysis error:', error);
        showToast('Не удалось загрузить анализ. Попробуйте позже.');
        renderDashboard();
    }
}

// Рендер интерфейса анализа
function renderAnalysisUI(model, loops, keyConfinement) {
    const container = document.getElementById('screenContainer');

    let keyHtml = '';
    if (keyConfinement) {
        keyHtml = `
            <div style="background: rgba(255,107,59,0.12); border: 1px solid rgba(255,107,59,0.4); border-radius: 20px; padding: 20px; margin-bottom: 28px;">
                <h3 style="color: #ff6b3b; margin-bottom: 10px;">🔑 Ключевое ограничение</h3>
                <strong style="font-size: 18px;">${keyConfinement.name || 'Основное ограничение'}</strong>
                <p style="margin-top: 10px; color: var(--text-secondary); line-height: 1.5;">
                    ${keyConfinement.description || 'Это центральный паттерн, который влияет на многие области вашей жизни.'}
                </p>
            </div>`;
    }

    const loopsHtml = loops.length > 0 
        ? loops.map((loop, i) => `
            <div style="background: rgba(26,26,26,0.8); padding: 18px; border-radius: 16px; border-left: 5px solid #ff6b3b; margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 6px;">Петля ${i+1}: ${loop.name || 'Повторяющийся цикл'}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">${loop.description || 'Автоматический паттерн поведения'}</div>
            </div>`).join('')
        : `<p style="color: var(--text-secondary); text-align: center; padding: 40px 20px;">
            Пока петли не обнаружены.<br>Продолжайте общение с Фреди — анализ будет обновляться.
           </p>`;

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 1100px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 64px;">🧠</div>
                <h1>Анализ глубинных паттернов</h1>
                <p style="color: var(--text-secondary);">Конфайнтмент-модель • Психологические петли • Ключевые ограничения</p>
            </div>

            ${keyHtml}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="module-card">
                    <div class="module-icon">📍</div>
                    <div class="module-name">Элементов в модели</div>
                    <div style="font-size: 36px; font-weight: 700; color: var(--chrome);">${Object.keys(model.elements || {}).length}</div>
                </div>
                <div class="module-card">
                    <div class="module-icon">🔄</div>
                    <div class="module-name">Активных петель</div>
                    <div style="font-size: 36px; font-weight: 700; color: var(--chrome);">${loops.length}</div>
                </div>
                <div class="module-card">
                    <div class="module-icon">🔒</div>
                    <div class="module-name">Состояние системы</div>
                    <div style="font-size: 18px; font-weight: 600; color: ${model.is_closed ? '#ef4444' : '#10b981'}; margin-top: 8px;">
                        ${model.is_closed ? '🔒 Система замкнута' : '🔓 Система открыта'}
                    </div>
                </div>
            </div>

            <h3 style="color: #ff6b3b; margin: 24px 0 16px;">🔄 Психологические петли</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${loopsHtml}
            </div>

            <div style="margin-top: 40px; text-align: center;">
                <button onclick="getPersonalIntervention()" class="voice-record-btn-premium" style="max-width: 360px;">
                    Получить персональную интервенцию
                </button>
            </div>
        </div>
    `;

    // Обработчик кнопки "Назад"
    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Заглушка для интервенции (можно сильно развить позже)
async function getPersonalIntervention() {
    showToast('🧘‍♂️ Персональная интервенция загружается...<br>Скоро здесь появится практика из InterventionLibrary');
}

// Экспортируем главную функцию (для использования в app.js)
window.openAnalysisScreen = openAnalysisScreen;
