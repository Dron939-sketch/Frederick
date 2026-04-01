// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 3.1 — с автономной проверкой теста и AI-анализом
// ============================================

// ========== АВТОНОМНАЯ ПРОВЕРКА ПРОХОЖДЕНИЯ ТЕСТА ==========
// Если функция isTestCompleted не определена глобально, создаем свою
if (typeof window.isTestCompleted === 'undefined' && typeof isTestCompleted === 'undefined') {
    window.isTestCompleted = async function() {
        try {
            const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
            const userId = window.CONFIG?.USER_ID || window.USER_ID;
            const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
            const data = await response.json();
            return data.has_profile === true;
        } catch (error) {
            console.warn('isTestCompleted error, checking localStorage:', error);
            const userId = window.CONFIG?.USER_ID || window.USER_ID;
            const stored = localStorage.getItem(`test_results_${userId}`);
            return !!stored;
        }
    };
}

let currentTab = 'overview';
let cachedProfile = null;
let cachedAIAnalysis = null;

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ — ОТКРЫТЬ АНАЛИЗ
// ============================================

async function openAnalysisScreen() {
    // 1. Проверка: пройден ли тест?
    const completed = await window.isTestCompleted();
    if (!completed) {
        if (window.showToast) {
            window.showToast('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        } else {
            alert('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        }
        return;
    }

    // 2. Показываем загрузку
    if (window.showLoading) {
        window.showLoading('🔍 Анализирую ваши глубинные паттерны...');
    }

    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        
        // 3. Получаем AI-профиль и мысль психолога
        const [profileRes, thoughtRes] = await Promise.all([
            fetch(`${apiUrl}/api/generated-profile/${userId}`).then(r => r.json()),
            fetch(`${apiUrl}/api/psychologist-thought/${userId}`).then(r => r.json())
        ]);
        
        cachedProfile = profileRes.success ? profileRes : {};
        cachedAIAnalysis = {
            profile: cachedProfile.ai_profile || '',
            thought: thoughtRes.success ? thoughtRes.thought : ''
        };
        
        // 4. Если AI-профиля нет — генерируем
        if (!cachedAIAnalysis.profile) {
            await generateAIAnalysis();
            return;
        }
        
        // 5. Отображаем анализ
        renderAnalysisWithTabs();

    } catch (error) {
        console.error('Analysis error:', error);
        if (window.showToast) {
            window.showToast('❌ Не удалось загрузить анализ. Попробуйте позже.');
        }
        if (typeof renderDashboard === 'function') {
            renderDashboard();
        } else if (window.renderDashboard) {
            window.renderDashboard();
        }
    }
}

// ============================================
// ГЕНЕРАЦИЯ AI-АНАЛИЗА
// ============================================

async function generateAIAnalysis() {
    if (window.showLoading) {
        window.showLoading('🧠 Генерирую глубинный анализ...');
    }
    
    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const currentMode = window.currentMode || 'psychologist';
        
        // Запрашиваем AI-анализ через чат
        const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                message: `Проведи глубинный психологический анализ моего профиля. 
Выяви:
1. КЛЮЧЕВЫЕ ПАТТЕРНЫ ПОВЕДЕНИЯ
2. СКРЫТЫЕ МЕХАНИЗМЫ
3. ПОВТОРЯЮЩИЕСЯ СЦЕНАРИИ
4. ТОЧКИ НАПРЯЖЕНИЯ
5. РЕСУРСНЫЕ СОСТОЯНИЯ
6. РЕКОМЕНДАЦИИ ДЛЯ РАЗВИТИЯ

Ответ оформи структурированно, с заголовками.`,
                mode: currentMode
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.response) {
            cachedAIAnalysis = {
                profile: data.response,
                thought: cachedAIAnalysis?.thought || ''
            };
            renderAnalysisWithTabs();
        } else {
            if (window.showToast) window.showToast('⚠️ Не удалось сгенерировать анализ');
            if (typeof renderDashboard === 'function') renderDashboard();
            else if (window.renderDashboard) window.renderDashboard();
        }
        
    } catch (error) {
        console.error('Generate analysis error:', error);
        if (window.showToast) window.showToast('❌ Ошибка при генерации анализа');
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    }
}

// ============================================
// ОТРИСОВКА ГЛАВНОГО ЭКРАНА
// ============================================

function renderAnalysisWithTabs() {
    const container = document.getElementById('screenContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 1100px; padding: 20px;">
            <button class="back-btn" id="backToDashboard" style="margin-bottom: 20px;">
                ◀️ НАЗАД К ДАШБОРДУ
            </button>

            <div class="content-header">
                <div class="content-emoji" style="font-size: 64px;">🧠</div>
                <h1>Анализ глубинных паттернов</h1>
                <p style="color: var(--text-secondary); margin-top: 8px;">
                    AI-анализ вашего психологического профиля
                </p>
            </div>

            <!-- Вкладки -->
            <div class="analysis-tabs" style="display: flex; gap: 8px; margin: 32px 0 24px; border-bottom: 1px solid rgba(224,224,224,0.2); padding-bottom: 12px; flex-wrap: wrap;">
                <button class="analysis-tab active" data-tab="overview">📊 Общий анализ</button>
                <button class="analysis-tab" data-tab="patterns">🔄 Паттерны</button>
                <button class="analysis-tab" data-tab="recommendations">💡 Рекомендации</button>
                <button class="analysis-tab" data-tab="thought">🧠 Мысли психолога</button>
            </div>

            <!-- Контент вкладок -->
            <div id="analysisTabContent">
                <!-- Заполняется через JS -->
            </div>

            <!-- Нижние кнопки -->
            <div style="margin-top: 48px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; border-top: 1px solid rgba(224,224,224,0.1); padding-top: 32px;">
                <button id="regenerateAnalysisBtn" class="voice-record-btn-premium" style="background: rgba(255,107,59,0.15); border-color: #ff6b3b;">
                    🔄 Сгенерировать новый анализ
                </button>
                <button id="backToDashboardBtn" class="back-btn" style="min-width: 140px;">
                    Вернуться в дашборд
                </button>
            </div>
        </div>
    `;

    // Активируем первую вкладку
    switchTab('overview');

    // Обработчики
    document.getElementById('backToDashboard')?.addEventListener('click', () => goToDashboard());
    document.getElementById('backToDashboardBtn')?.addEventListener('click', () => goToDashboard());
    document.getElementById('regenerateAnalysisBtn')?.addEventListener('click', () => generateAIAnalysis());
    
    // Обработчики вкладок
    document.querySelectorAll('.analysis-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
            document.querySelectorAll('.analysis-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function goToDashboard() {
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    } else if (window.renderDashboard) {
        window.renderDashboard();
    } else {
        location.reload();
    }
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ============================================

function switchTab(tab) {
    currentTab = tab;
    const contentContainer = document.getElementById('analysisTabContent');
    if (!contentContainer) return;

    if (tab === 'overview') {
        renderOverviewTab();
    } else if (tab === 'patterns') {
        renderPatternsTab();
    } else if (tab === 'recommendations') {
        renderRecommendationsTab();
    } else if (tab === 'thought') {
        renderThoughtTab();
    }
}

// ============================================
// ВКЛАДКА 1: ОБЩИЙ АНАЛИЗ
// ============================================

function renderOverviewTab() {
    const profile = cachedAIAnalysis?.profile || '';
    
    if (!profile) {
        document.getElementById('analysisTabContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🧠</div>
                <h3>Анализ формируется</h3>
                <p style="color: var(--text-secondary);">Нажмите "Сгенерировать новый анализ"</p>
                <button onclick="generateAIAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px;">
                    🔄 Сгенерировать анализ
                </button>
            </div>
        `;
        return;
    }
    
    // Форматируем текст
    let formattedText = profile
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^#+\s*(.*)/gm, '<h3 style="margin: 24px 0 12px; color: #ff6b3b;">$1</h3>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="analysis-content" style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 28px; line-height: 1.7;">
            ${formattedText}
        </div>
    `;
}

// ============================================
// ВКЛАДКА 2: ПАТТЕРНЫ
// ============================================

function renderPatternsTab() {
    const profile = cachedAIAnalysis?.profile || '';
    
    if (!profile) {
        renderOverviewTab();
        return;
    }
    
    // Извлекаем секции с паттернами
    let patternsSection = '';
    const patternMatches = profile.match(/(?:ПАТТЕРНЫ|ПАТТЕРН|ПОВТОРЯЮЩИЕСЯ|СЦЕНАРИИ)[\s\S]*?(?=(?:РЕКОМЕНДАЦИИ|ТОЧКИ|МЫСЛИ|$))/i);
    
    if (patternMatches) {
        patternsSection = patternMatches[0]
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/•/g, '<span style="color: #ff6b3b;">•</span>')
            .replace(/\n/g, '<br>');
    } else {
        patternsSection = '<p style="color: var(--text-secondary);">Специальный раздел с паттернами будет доступен после генерации анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 28px;">
            <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">🔍 АНАЛИЗ ПАТТЕРНОВ</div>
                <div style="height: 2px; background: linear-gradient(90deg, #ff6b3b, transparent); width: 60px;"></div>
            </div>
            <div style="line-height: 1.7;">
                ${patternsSection}
            </div>
        </div>
        
        <div style="margin-top: 24px; background: rgba(255,107,59,0.08); border-radius: 20px; padding: 20px;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                <span style="font-size: 24px;">💡</span>
                <div>
                    <strong>Что с этим делать?</strong>
                    <p style="color: var(--text-secondary); margin-top: 8px;">Осознание паттерна — первый шаг к его изменению. Обсудите эти наблюдения с Фреди в диалоге.</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// ВКЛАДКА 3: РЕКОМЕНДАЦИИ
// ============================================

function renderRecommendationsTab() {
    const profile = cachedAIAnalysis?.profile || '';
    
    if (!profile) {
        renderOverviewTab();
        return;
    }
    
    // Извлекаем секции с рекомендациями
    let recommendationsSection = '';
    const recMatches = profile.match(/(?:РЕКОМЕНДАЦИИ|СОВЕТЫ|РАЗВИТИЕ|ЧТО ДЕЛАТЬ)[\s\S]*?(?=(?:МЫСЛИ|$))/i);
    
    if (recMatches) {
        recommendationsSection = recMatches[0]
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/•/g, '<span style="color: #ff6b3b;">•</span>')
            .replace(/\n/g, '<br>');
    } else {
        recommendationsSection = '<p style="color: var(--text-secondary);">Персональные рекомендации появятся после завершения анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 28px;">
            <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">🎯 ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ</div>
                <div style="height: 2px; background: linear-gradient(90deg, #ff6b3b, transparent); width: 60px;"></div>
            </div>
            <div style="line-height: 1.7;">
                ${recommendationsSection}
            </div>
        </div>
        
        <div style="margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">🧘</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Практика</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Выделите 5 минут на осознанное дыхание</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">📝</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Дневник</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Записывайте повторяющиеся ситуации</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">💬</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Диалог</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Обсудите эти паттерны с Фреди</div>
            </div>
        </div>
    `;
}

// ============================================
// ВКЛАДКА 4: МЫСЛИ ПСИХОЛОГА
// ============================================

function renderThoughtTab() {
    const thought = cachedAIAnalysis?.thought || '';
    
    if (!thought) {
        document.getElementById('analysisTabContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🧠</div>
                <h3>Мысли психолога появятся после анализа</h3>
                <button onclick="generateAIAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px;">
                    🔄 Сгенерировать анализ
                </button>
            </div>
        `;
        return;
    }
    
    let formattedThought = thought
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(255,107,59,0.05), rgba(255,59,59,0.02)); border-radius: 28px; padding: 32px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <div style="font-size: 32px;">🧠</div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary);">ФРЕДИ ГОВОРИТ</div>
                    <div style="font-size: 20px; font-weight: 600;">Мысли психолога</div>
                </div>
            </div>
            <div style="font-size: 16px; line-height: 1.7; font-style: italic; color: var(--text-secondary);">
                ${formattedThought}
            </div>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,107,59,0.2);">
                <p style="font-size: 13px; color: var(--text-secondary);">✨ Это уникальный анализ, сформированный на основе ваших ответов</p>
            </div>
        </div>
    `;
}

// ============================================
// ГЛОБАЛЬНЫЙ ЭКСПОРТ
// ============================================

window.openAnalysisScreen = openAnalysisScreen;
window.generateAIAnalysis = generateAIAnalysis;
window.switchTab = switchTab;

console.log('✅ Модуль анализа загружен (версия 3.1 — AI-анализ с автономной проверкой)');
