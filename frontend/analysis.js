// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 3.2 — ГЛУБОКИЙ AI-АНАЛИЗ с системными петлями и прогнозом
// ============================================

// ========== АВТОНОМНАЯ ПРОВЕРКА ПРОХОЖДЕНИЯ ТЕСТА ==========
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
    const completed = await window.isTestCompleted();
    if (!completed) {
        if (window.showToast) {
            window.showToast('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        } else {
            alert('📊 Сначала пройдите психологический тест, чтобы увидеть анализ');
        }
        return;
    }

    if (window.showLoading) {
        window.showLoading('🔍 Загружаю данные для анализа...');
    }

    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        
        // Получаем профиль пользователя
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        cachedProfile = await profileRes.json();
        
        // Получаем мысль психолога
        const thoughtRes = await fetch(`${apiUrl}/api/psychologist-thought/${userId}`);
        const thoughtData = await thoughtRes.json();
        
        cachedAIAnalysis = {
            profile: null,
            thought: thoughtData.success ? thoughtData.thought : ''
        };
        
        // Запускаем глубокий анализ
        await generateDeepAnalysis();
        
    } catch (error) {
        console.error('Analysis error:', error);
        if (window.showToast) window.showToast('❌ Не удалось загрузить данные для анализа');
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    }
}

// ============================================
// ГЛУБОКИЙ AI-АНАЛИЗ
// ============================================

async function generateDeepAnalysis() {
    if (window.showLoading) {
        window.showLoading('🧠 Провожу глубинный психологический анализ...');
    }
    
    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const currentMode = window.currentMode || 'psychologist';
        
        // Извлекаем все данные профиля
        const userProfile = cachedProfile?.profile || {};
        const behavioralLevels = userProfile.behavioral_levels || {};
        const deepPatterns = userProfile.deep_patterns || {};
        const perceptionType = userProfile.perception_type || 'не определен';
        const thinkingLevel = userProfile.thinking_level || 5;
        const profileCode = userProfile.display_name || 'не определен';
        
        // Формируем структурированные данные для AI
        const profileForAnalysis = `
=== ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ ===
Код профиля: ${profileCode}
Тип восприятия: ${perceptionType}
Уровень мышления: ${thinkingLevel}/9

=== ПОВЕДЕНЧЕСКИЕ ВЕКТОРЫ ===
• Реакция на давление (СБ): ${JSON.stringify(behavioralLevels.СБ || [])}
• Отношение к деньгам (ТФ): ${JSON.stringify(behavioralLevels.ТФ || [])}
• Понимание мира (УБ): ${JSON.stringify(behavioralLevels.УБ || [])}
• Отношения с людьми (ЧВ): ${JSON.stringify(behavioralLevels.ЧВ || [])}

=== ГЛУБИННЫЕ ПАТТЕРНЫ ===
Тип привязанности: ${deepPatterns.attachment || 'не определен'}
Защитные механизмы: ${JSON.stringify(deepPatterns.defenses || [])}
Глубинные страхи: ${JSON.stringify(deepPatterns.fears || [])}
Ключевые убеждения: ${JSON.stringify(deepPatterns.beliefs || [])}

=== AI-ПРОФИЛЬ ===
${userProfile.ai_generated_profile || 'Нет данных'}
`;

        // Усиленный промпт для глубокого анализа
        const analysisPrompt = `Ты — виртуальный психолог Фреди (цифровая копия Андрея Мейстера).
Проведи ГЛУБОКИЙ ПСИХОЛОГИЧЕСКИЙ АНАЛИЗ на основе данных пользователя.

Данные пользователя:
${profileForAnalysis}

Твой анализ должен быть:
1. **НЕ ПОВЕРХНОСТНЫМ** — не просто пересказывай профиль, а выявляй скрытые связи
2. **СИСТЕМНЫМ** — показывай, как разные паттерны связаны друг с другом
3. **ПРОГНОСТИЧЕСКИМ** — объясняй, к каким последствиям ведут эти паттерны
4. **ПРАКТИЧНЫМ** — давай конкретные точки входа для изменений

Структура ответа (обязательно используй эти заголовки):

## 🔍 ГЛУБИННЫЙ ПОРТРЕТ
- Как сформировалась текущая конфигурация
- Какая травма/опыт стоит за основными паттернами
- Как это проявляется в повседневной жизни

## 🔄 СИСТЕМНЫЕ ПЕТЛИ
- Какие паттерны замыкаются в петли
- Где главная точка напряжения
- Что удерживает систему в равновесии

## 🧠 СКРЫТЫЕ МЕХАНИЗМЫ
- Какие защиты активны
- Какие выгоды даёт текущее состояние
- Чего боится подсознание

## 🌱 ТОЧКИ РОСТА
- Главный рычаг изменений
- Конкретные первые шаги (пошагово)
- Как отличить движение от иллюзии движения

## 📊 ПРОГНОЗ
- Куда ведёт текущая траектория
- Какие кризисы вероятны
- Когда и как они проявятся

## 🔑 ПЕРСОНАЛЬНЫЕ КЛЮЧИ
- Какие техники будут эффективны
- Какие слова/образы отзываются
- Как обходить защиты

ВАЖНО:
- Не используй шаблонные фразы
- Говори о конкретном человеке, а не в общем
- Будь честным, но бережным
- Пиши на русском языке
- Используй эмодзи для визуального выделения разделов`;

        const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                message: analysisPrompt,
                mode: currentMode
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.response) {
            cachedAIAnalysis.profile = data.response;
            renderAnalysisWithTabs();
        } else {
            if (window.showToast) window.showToast('⚠️ Не удалось сгенерировать глубокий анализ');
            renderFallbackAnalysis();
        }
        
    } catch (error) {
        console.error('Generate deep analysis error:', error);
        if (window.showToast) window.showToast('❌ Ошибка при генерации анализа');
        renderFallbackAnalysis();
    }
}

// ============================================
// ЗАГЛУШКА ЕСЛИ AI НЕ ОТВЕЧАЕТ
// ============================================

function renderFallbackAnalysis() {
    const fallbackText = `
## 🔍 ГЛУБИННЫЙ ПОРТРЕТ

Анализ на основе имеющихся данных показывает, что ваша психологическая конфигурация формировалась под влиянием базовых паттернов восприятия и поведения.

**Ключевые особенности:**
- Тип восприятия: ${cachedProfile?.profile?.perception_type || 'определяется'}
- Уровень мышления: ${cachedProfile?.profile?.thinking_level || '5'}/9

## 🔄 СИСТЕМНЫЕ ПЕТЛИ

Для более точного анализа петель поведения необходимо продолжить диалог. Каждый разговор с Фреди помогает выявить скрытые связи.

## 🌱 ТОЧКИ РОСТА

1. **Наблюдение** — начните замечать, в каких ситуациях проявляются автоматические реакции
2. **Дневник** — записывайте повторяющиеся сценарии
3. **Диалог** — обсуждайте эти наблюдения с Фреди

## 🔑 ПЕРСОНАЛЬНЫЕ КЛЮЧИ

Ваш уникальный путь требует времени. Продолжайте исследовать себя через диалог, и анализ будет становиться точнее с каждым разговором.

---

✨ *Для более глубокого анализа продолжайте диалог с Фреди. Каждый разговор добавляет новые данные.*
`;
    
    cachedAIAnalysis.profile = fallbackText;
    renderAnalysisWithTabs();
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
                <h1>Глубинный анализ паттернов</h1>
                <p style="color: var(--text-secondary); margin-top: 8px;">
                    Системный AI-анализ вашей психологической конфигурации
                </p>
            </div>

            <div class="analysis-tabs" style="display: flex; gap: 8px; margin: 32px 0 24px; border-bottom: 1px solid rgba(224,224,224,0.2); padding-bottom: 12px; flex-wrap: wrap;">
                <button class="analysis-tab active" data-tab="overview">📊 Полный анализ</button>
                <button class="analysis-tab" data-tab="patterns">🔄 Петли и механизмы</button>
                <button class="analysis-tab" data-tab="recommendations">🌱 Точки роста</button>
                <button class="analysis-tab" data-tab="thought">🧠 Мысли психолога</button>
            </div>

            <div id="analysisTabContent">
                <!-- Заполняется через JS -->
            </div>

            <div style="margin-top: 48px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; border-top: 1px solid rgba(224,224,224,0.1); padding-top: 32px;">
                <button id="regenerateAnalysisBtn" class="voice-record-btn-premium" style="background: rgba(255,107,59,0.15); border-color: #ff6b3b;">
                    🔄 Провести новый анализ
                </button>
                <button id="backToDashboardBtn" class="back-btn" style="min-width: 140px;">
                    Вернуться в дашборд
                </button>
            </div>
        </div>
    `;

    switchTab('overview');

    document.getElementById('backToDashboard')?.addEventListener('click', () => goToDashboard());
    document.getElementById('backToDashboardBtn')?.addEventListener('click', () => goToDashboard());
    document.getElementById('regenerateAnalysisBtn')?.addEventListener('click', () => generateDeepAnalysis());
    
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
// ВКЛАДКА 1: ПОЛНЫЙ АНАЛИЗ
// ============================================

function renderOverviewTab() {
    const analysis = cachedAIAnalysis?.profile || '';
    
    if (!analysis) {
        document.getElementById('analysisTabContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🧠</div>
                <h3>Анализ формируется</h3>
                <p style="color: var(--text-secondary);">Нажмите "Провести новый анализ"</p>
                <button onclick="generateDeepAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px;">
                    🔄 Провести анализ
                </button>
            </div>
        `;
        return;
    }
    
    let formattedText = analysis
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^##\s*(.*)/gm, '<h2 style="margin: 28px 0 16px; color: #ff6b3b; font-size: 22px;">$1</h2>')
        .replace(/^###\s*(.*)/gm, '<h3 style="margin: 20px 0 12px; color: #ff8c4a;">$1</h3>')
        .replace(/^\*\s*(.*)/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="analysis-content" style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 32px; line-height: 1.8;">
            ${formattedText}
        </div>
    `;
}

// ============================================
// ВКЛАДКА 2: ПЕТЛИ И МЕХАНИЗМЫ
// ============================================

function renderPatternsTab() {
    const analysis = cachedAIAnalysis?.profile || '';
    
    if (!analysis) {
        renderOverviewTab();
        return;
    }
    
    let patternsSection = '';
    const systemMatch = analysis.match(/(?:🔄|СИСТЕМНЫЕ ПЕТЛИ)[\s\S]*?(?=(?:🌱|ТОЧКИ РОСТА|🧠|СКРЫТЫЕ МЕХАНИЗМЫ|$))/i);
    const hiddenMatch = analysis.match(/(?:🧠|СКРЫТЫЕ МЕХАНИЗМЫ)[\s\S]*?(?=(?:🌱|ТОЧКИ РОСТА|🔑|ПЕРСОНАЛЬНЫЕ|$))/i);
    
    let content = '';
    if (systemMatch) {
        content += `<div class="analysis-section" style="margin-bottom: 32px;">
            <h2 style="color: #ff6b3b; margin-bottom: 16px;">🔄 Системные петли</h2>
            <div style="line-height: 1.7;">${systemMatch[0]}</div>
        </div>`;
    }
    
    if (hiddenMatch) {
        content += `<div class="analysis-section" style="margin-bottom: 32px;">
            <h2 style="color: #ff6b3b; margin-bottom: 16px;">🧠 Скрытые механизмы</h2>
            <div style="line-height: 1.7;">${hiddenMatch[0]}</div>
        </div>`;
    }
    
    if (!content) {
        content = '<p style="color: var(--text-secondary); text-align: center;">Специальный раздел с петлями и механизмами будет доступен после проведения анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 32px;">
            ${content}
        </div>
        <div style="margin-top: 24px; background: rgba(255,107,59,0.08); border-radius: 20px; padding: 20px;">
            <div style="display: flex; gap: 12px;">
                <span style="font-size: 24px;">💡</span>
                <div>
                    <strong>Осознание петли — первый шаг к её разрыву</strong>
                    <p style="color: var(--text-secondary); margin-top: 8px;">Обсудите эти наблюдения с Фреди в диалоге. Каждый разговор помогает увидеть новые связи.</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// ВКЛАДКА 3: ТОЧКИ РОСТА
// ============================================

function renderRecommendationsTab() {
    const analysis = cachedAIAnalysis?.profile || '';
    
    if (!analysis) {
        renderOverviewTab();
        return;
    }
    
    let growthSection = '';
    const growthMatch = analysis.match(/(?:🌱|ТОЧКИ РОСТА)[\s\S]*?(?=(?:🔑|ПЕРСОНАЛЬНЫЕ КЛЮЧИ|📊|ПРОГНОЗ|$))/i);
    const keysMatch = analysis.match(/(?:🔑|ПЕРСОНАЛЬНЫЕ КЛЮЧИ)[\s\S]*?(?=(?:$))/i);
    
    let content = '';
    if (growthMatch) {
        content += `<div class="analysis-section" style="margin-bottom: 32px;">
            <h2 style="color: #ff6b3b; margin-bottom: 16px;">🌱 Точки роста</h2>
            <div style="line-height: 1.7;">${growthMatch[0]}</div>
        </div>`;
    }
    
    if (keysMatch) {
        content += `<div class="analysis-section" style="margin-bottom: 32px;">
            <h2 style="color: #ff6b3b; margin-bottom: 16px;">🔑 Персональные ключи</h2>
            <div style="line-height: 1.7;">${keysMatch[0]}</div>
        </div>`;
    }
    
    if (!content) {
        content = '<p style="color: var(--text-secondary); text-align: center;">Персональные рекомендации появятся после проведения анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: rgba(224,224,224,0.03); border-radius: 24px; padding: 32px;">
            ${content}
        </div>
        
        <div style="margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">🧘</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Практика</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Начните с малого: 5 минут осознанности</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">📝</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Дневник</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Записывайте повторяющиеся сценарии</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; text-align: center;">
                <div style="font-size: 32px;">💬</div>
                <div style="font-weight: 600; margin: 12px 0 8px;">Диалог</div>
                <div style="font-size: 13px; color: var(--text-secondary);">Обсудите эти точки роста с Фреди</div>
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
                <button onclick="generateDeepAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px;">
                    🔄 Провести анализ
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
                <p style="font-size: 13px; color: var(--text-secondary);">✨ Этот анализ сформирован на основе ваших ответов и глубинных паттернов</p>
            </div>
        </div>
    `;
}

// ============================================
// ГЛОБАЛЬНЫЙ ЭКСПОРТ
// ============================================

window.openAnalysisScreen = openAnalysisScreen;
window.generateDeepAnalysis = generateDeepAnalysis;
window.switchTab = switchTab;

console.log('✅ Модуль анализа загружен (версия 3.2 — глубокий AI-анализ с системными петлями и прогнозом)');
