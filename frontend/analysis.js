// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Улучшенная версия 2.1 с вкладками
// ============================================

let currentTab = 'overview';

async function openAnalysisScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        return;
    }

    showLoading('🔍 Загружаю конфайнтмент-модель...');

    try {
        const userId = USER_ID;

        const [modelRes, loopsRes, keyRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}/loops`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/confinement/model/${userId}/key-confinement`).then(r => r.json())
        ]);

        const model = modelRes.success ? modelRes : {};
        const loops = loopsRes.success ? loopsRes.loops || [] : [];
        const keyConfinement = keyRes.success ? keyRes.key_confinement : null;

        renderAnalysisWithTabs(model, loops, keyConfinement);

    } catch (error) {
        console.error('Analysis error:', error);
        showToast('Не удалось загрузить анализ. Попробуйте позже.');
        renderDashboard();
    }
}

function renderAnalysisWithTabs(model, loops, keyConfinement) {
    const container = document.getElementById('screenContainer');

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 1100px; padding: 20px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>

            <div class="content-header">
                <div class="content-emoji" style="font-size: 64px;">🧠</div>
                <h1>Анализ глубинных паттернов</h1>
                <p style="color: var(--text-secondary);">Конфайнтмент-модель и психологические петли</p>
            </div>

            <!-- Вкладки -->
            <div class="tabs-container" style="margin: 24px 0; display: flex; background: rgba(224,224,224,0.05); border-radius: 50px; padding: 6px; width: fit-content;">
                <button class="tab-btn active" data-tab="overview" onclick="switchTab('overview')">Обзор</button>
                <button class="tab-btn" data-tab="loops" onclick="switchTab('loops')">Петли</button>
                <button class="tab-btn" data-tab="key" onclick="switchTab('key')">Ключевые ограничения</button>
                <button class="tab-btn" data-tab="interventions" onclick="switchTab('interventions')">Интервенции</button>
            </div>

            <!-- Контент вкладок -->
            <div id="tabContent">
                <!-- Будет заполняться через JS -->
            </div>

            <!-- Нижние кнопки -->
            <div style="margin-top: 40px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button onclick="regenerateAnalysis()" class="voice-record-btn-premium" style="background: rgba(255,107,59,0.15); border-color: #ff6b3b;">
                    🔄 Сгенерировать новый анализ
                </button>
                <button onclick="renderDashboard()" class="back-btn" style="min-width: 140px;">
                    Вернуться в дашборд
                </button>
            </div>
        </div>
    `;

    // Активируем первую вкладку
    switchTab('overview', model, loops, keyConfinement);

    // Обработчик кнопки назад
    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Переключение вкладок
function switchTab(tab, model = null, loops = null, keyConfinement = null) {
    currentTab = tab;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const contentContainer = document.getElementById('tabContent');

    if (tab === 'overview') {
        contentContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="module-card">
                    <div class="module-icon">📍</div>
                    <div class="module-name">Элементов</div>
                    <div style="font-size: 42px; font-weight: 700;">${Object.keys(model?.elements || {}).length}</div>
                </div>
                <div class="module-card">
                    <div class="module-icon">🔄</div>
                    <div class="module-name">Петель</div>
                    <div style="font-size: 42px; font-weight: 700;">${loops?.length || 0}</div>
                </div>
                <div class="module-card">
                    <div class="module-icon">🔒</div>
                    <div class="module-name">Состояние</div>
                    <div style="font-size: 20px; font-weight: 600; color: ${model?.is_closed ? '#ef4444' : '#10b981'}">
                        ${model?.is_closed ? '🔒 Система замкнута' : '🔓 Система открыта'}
                    </div>
                </div>
            </div>

            ${keyConfinement && keyConfinement.name ? `
            <div style="background: rgba(255,107,59,0.1); border: 1px solid #ff6b3b; border-radius: 20px; padding: 20px;">
                <h3 style="color: #ff6b3b;">🔑 Ключевое ограничение</h3>
                <strong>${keyConfinement.name}</strong>
                <p style="margin-top: 12px; color: var(--text-secondary);">${keyConfinement.description || ''}</p>
            </div>` : ''}
        `;
    } 
    else if (tab === 'loops') {
        const loopsHtml = loops && loops.length > 0 
            ? loops.map((loop, i) => `
                <div style="background: rgba(26,26,26,0.9); padding: 18px; border-radius: 16px; margin-bottom: 12px; border-left: 5px solid #ff6b3b;">
                    <strong>Петля ${i+1}: ${loop.name || 'Цикл'}</strong><br>
                    <span style="color: var(--text-secondary);">${loop.description || 'Повторяющийся паттерн'}</span>
                </div>`).join('')
            : '<p style="text-align:center; padding: 40px; color: var(--text-secondary);">Петли пока не обнаружены.</p>';

        contentContainer.innerHTML = `<div style="margin-top: 20px;">${loopsHtml}</div>`;
    } 
    else if (tab === 'key') {
        contentContainer.innerHTML = keyConfinement ? `
            <div style="background: rgba(255,107,59,0.12); padding: 28px; border-radius: 20px; margin-top: 20px;">
                <h2 style="color: #ff6b3b;">${keyConfinement.name}</h2>
                <p style="margin-top: 16px; line-height: 1.7;">${keyConfinement.description || 'Описание отсутствует.'}</p>
            </div>` : '<p>Ключевое ограничение пока не определено.</p>';
    } 
    else if (tab === 'interventions') {
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🧘</div>
                <h3>Персональные интервенции</h3>
                <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 30px;">
                    Здесь будут появляться ежедневные практики и упражнения, подобранные специально под вашу конфайнтмент-модель.
                </p>
                <button onclick="getPersonalIntervention()" class="voice-record-btn-premium">
                    Получить сегодняшнюю интервенцию
                </button>
            </div>
        `;
    }
}

// Генерация нового анализа
async function regenerateAnalysis() {
    if (!confirm('Сгенерировать новый анализ? Это может занять некоторое время.')) return;
    
    showLoading('🔄 Генерирую новый анализ...');
    
    try {
        // Здесь можно добавить реальный вызов на backend для перегенерации
        await new Promise(resolve => setTimeout(resolve, 1500)); // имитация
        showToast('✅ Анализ обновлён!');
        openAnalysisScreen(); // перезагружаем экран
    } catch (e) {
        showToast('Не удалось обновить анализ');
    }
}

// Заглушка для интервенции
function getPersonalIntervention() {
    showToast('🧘 Генерирую персональную интервенцию на сегодня...');
}

window.openAnalysisScreen = openAnalysisScreen;
window.switchTab = switchTab;
window.regenerateAnalysis = regenerateAnalysis;
window.getPersonalIntervention = getPersonalIntervention;
