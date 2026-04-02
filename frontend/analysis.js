// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 4.0 — универсальное форматирование для любого текста
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

// ========== УНИВЕРСАЛЬНОЕ ФОРМАТИРОВАНИЕ ТЕКСТА ==========
function formatAnalysisText(text) {
    if (!text) return '';
    
    let processed = text;
    
    // 1. Жирный текст — обрабатываем оба варианта (**текст** и *текст*)
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="analysis-bold">$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<strong class="analysis-bold">$1</strong>');
    
    // 2. Заголовки с ## (с пробелом и без)
    processed = processed.replace(/^##\s*(.+)$/gm, '\n\n<h3 class="analysis-header">$1</h3>\n\n');
    processed = processed.replace(/^##(.+)$/gm, '\n\n<h3 class="analysis-header">$1</h3>\n\n');
    
    // 3. Заголовки с эмодзи в начале (например "🔍 ГЛУБИННЫЙ ПОРТРЕТ")
    processed = processed.replace(/^([🔍🔄🧠🌱📊🔑💡⚠️🎯💪])\s*(.+)$/gm, '\n\n<h3 class="analysis-header">$1 $2</h3>\n\n');
    
    // 4. Заголовки ЗАГЛАВНЫМИ БУКВАМИ (без эмодзи)
    const uppercaseHeaders = ['ГЛУБИННЫЙ ПОРТРЕТ', 'СИСТЕМНЫЕ ПЕТЛИ', 'СКРЫТЫЕ МЕХАНИЗМЫ', 'ТОЧКИ РОСТА', 'ПРОГНОЗ', 'ПЕРСОНАЛЬНЫЕ КЛЮЧИ'];
    for (const header of uppercaseHeaders) {
        const regex = new RegExp(`^${header}\\s*$`, 'gm');
        processed = processed.replace(regex, `\n\n<h3 class="analysis-header">${header}</h3>\n\n`);
    }
    
    // 5. Маркированные списки (* или • в начале строки)
    processed = processed.replace(/^[\*\•]\s+(.+)$/gm, '<li class="analysis-list-item">$1</li>');
    
    // 6. Нумерованные списки
    processed = processed.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="analysis-list-item numbered">$1. $2</li>');
    
    // 7. Блоки с подписями (Триггер:, Действие:, Цена:, Выгода: и т.д.)
    processed = processed.replace(/^([А-ЯЁ][а-яё]+):\s+(.+)$/gm, '<div class="analysis-block"><span class="block-label">$1:</span> $2</div>');
    
    // 8. Добавляем переносы строк после знаков препинания для читаемости
    processed = processed.replace(/([.!?])\s*(?=[А-ЯЁA-Z])/g, '$1\n\n');
    
    // 9. Убираем лишние пустые строки
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // 10. Разбиваем на параграфы
    const lines = processed.split('\n');
    let result = '';
    let inList = false;
    let listItems = [];
    let inParagraph = false;
    let paragraphText = '';
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        // Начало списка
        if (line.startsWith('<li')) {
            if (inParagraph && paragraphText) {
                result += `<p class="analysis-paragraph">${paragraphText}</p>`;
                paragraphText = '';
                inParagraph = false;
            }
            listItems.push(line);
            inList = true;
        }
        // Конец списка
        else if (inList && !line.startsWith('<li')) {
            result += `<ul class="analysis-list">${listItems.join('')}</ul>`;
            listItems = [];
            inList = false;
            // Добавляем текущую строку как обычный текст
            if (line && !line.startsWith('<h3') && !line.startsWith('<div')) {
                if (inParagraph) {
                    paragraphText += ' ' + line;
                } else {
                    paragraphText = line;
                    inParagraph = true;
                }
            } else {
                result += line;
            }
        }
        // Заголовки и блоки
        else if (line.startsWith('<h3') || line.startsWith('<div')) {
            if (inList && listItems.length > 0) {
                result += `<ul class="analysis-list">${listItems.join('')}</ul>`;
                listItems = [];
                inList = false;
            }
            if (inParagraph && paragraphText) {
                result += `<p class="analysis-paragraph">${paragraphText}</p>`;
                paragraphText = '';
                inParagraph = false;
            }
            result += line;
        }
        // Обычный текст
        else {
            if (inParagraph) {
                paragraphText += ' ' + line;
            } else {
                paragraphText = line;
                inParagraph = true;
            }
        }
    }
    
    // Закрываем последний параграф
    if (inParagraph && paragraphText) {
        result += `<p class="analysis-paragraph">${paragraphText}</p>`;
    }
    
    // Закрываем последний список
    if (inList && listItems.length > 0) {
        result += `<ul class="analysis-list">${listItems.join('')}</ul>`;
    }
    
    return result;
}

// ========== ФУНКЦИЯ ПОКАЗА ЗАГРУЗКИ ==========
function showAnalysisLoading(message) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 500px; gap: 24px;">
            <div class="loading-spinner" style="font-size: 72px; animation: spin 1.5s linear infinite; filter: drop-shadow(0 0 10px rgba(255,107,59,0.3));">🧠</div>
            <div class="loading-text" style="font-size: 20px; font-weight: 500; color: var(--text-primary); text-align: center; max-width: 400px;">${message}</div>
            <div class="loading-subtext" style="font-size: 13px; color: var(--text-secondary); opacity: 0.7; text-align: center;">Анализ занимает 20-30 секунд<br>Пожалуйста, подождите</div>
            <div class="loading-dots" style="display: flex; gap: 8px; margin-top: 16px;">
                <span style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1s ease-in-out infinite;"></span>
                <span style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1s ease-in-out infinite 0.2s;"></span>
                <span style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1s ease-in-out infinite 0.4s;"></span>
            </div>
        </div>
    `;
    
    if (!document.querySelector('#analysis-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'analysis-loading-styles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
            }
        `;
        document.head.appendChild(style);
    }
}

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

    showAnalysisLoading('🔍 Загружаю данные для анализа...');

    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        cachedProfile = await profileRes.json();
        
        const thoughtRes = await fetch(`${apiUrl}/api/psychologist-thought/${userId}`);
        const thoughtData = await thoughtRes.json();
        
        cachedAIAnalysis = {
            profile: null,
            thought: thoughtData.success ? thoughtData.thought : ''
        };
        
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
    showAnalysisLoading('🧠 Провожу глубинный психологический анализ...');
    
    try {
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const currentMode = window.currentMode || 'psychologist';
        
        const response = await fetch(`${apiUrl}/api/deep-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                message: "",
                mode: currentMode
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.analysis) {
            cachedAIAnalysis.profile = data.analysis;
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
// КРАСИВАЯ ЗАГЛУШКА
// ============================================

function renderFallbackAnalysis() {
    const userName = window.CONFIG?.USER_NAME || localStorage.getItem('fredi_user_name') || 'друг';
    
    const fallbackText = `
<div style="text-align: center; margin-bottom: 32px;">
    <div style="font-size: 64px; margin-bottom: 16px;">🧠✨</div>
    <h2 style="font-size: 26px; background: linear-gradient(135deg, #ff6b3b, #ff3b3b); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 12px;">Анализ формируется</h2>
    <p style="color: var(--text-secondary); font-size: 15px;">${userName}, ваш уникальный психологический портрет создаётся прямо сейчас</p>
</div>

<div style="background: linear-gradient(135deg, rgba(255,107,59,0.08), rgba(255,59,59,0.03)); border-radius: 28px; padding: 28px; margin: 24px 0;">
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="font-size: 42px;">🔍</div>
        <div>
            <h3 style="color: #ff6b3b; margin: 0; font-size: 18px;">Что происходит сейчас?</h3>
            <p style="color: var(--text-secondary); margin: 4px 0 0; font-size: 14px;">AI анализирует ваши паттерны</p>
        </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 20px;">
        <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 10px;">📊</div>
            <div style="font-weight: 500; font-size: 14px;">${cachedProfile?.profile?.behavioral_levels ? '✅' : '⏳'} Поведенческие векторы</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">СБ, ТФ, УБ, ЧВ</div>
        </div>
        <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 10px;">🧬</div>
            <div style="font-weight: 500; font-size: 14px;">${cachedProfile?.profile?.deep_patterns ? '✅' : '⏳'} Глубинные паттерны</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Привязанность, защиты, убеждения</div>
        </div>
        <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 10px;">🔄</div>
            <div style="font-weight: 500; font-size: 14px;">⏳ Системные петли</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Повторяющиеся сценарии</div>
        </div>
    </div>
</div>

<div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 24px; margin: 24px 0;">
    <div style="display: flex; gap: 14px; align-items: flex-start;">
        <div style="font-size: 26px;">💡</div>
        <div>
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 15px;">Пока анализ готовится...</div>
            <p style="color: var(--text-secondary); margin-bottom: 14px; font-size: 14px;">Вот что вы можете сделать:</p>
            <ul style="color: var(--text-secondary); margin-left: 20px; line-height: 1.6; font-size: 14px;">
                <li>🗣️ <strong>Продолжить диалог с Фреди</strong> — каждый разговор добавляет новые данные</li>
                <li>📝 <strong>Вести дневник мыслей</strong> — записывайте повторяющиеся ситуации</li>
                <li>🧘 <strong>Попробовать практики</strong> — в разделе "Практики" есть упражнения</li>
            </ul>
        </div>
    </div>
</div>

<div style="text-align: center; margin-top: 32px;">
    <button onclick="generateDeepAnalysis()" class="voice-record-btn-premium" style="background: linear-gradient(135deg, #ff6b3b, #ff3b3b); border: none; padding: 12px 28px; font-size: 14px;">
        🔄 Попробовать снова
    </button>
    <p style="color: var(--text-secondary); font-size: 11px; margin-top: 14px;">
        ✨ Чем больше вы общаетесь с Фреди, тем точнее становится анализ
    </p>
</div>
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
                <div class="content-emoji" style="font-size: 56px;">🧠</div>
                <h1 style="font-size: 28px; margin: 12px 0 8px;">Глубинный анализ паттернов</h1>
                <p style="color: var(--text-secondary); margin-top: 8px; font-size: 14px;">
                    Системный AI-анализ вашей психологической конфигурации
                </p>
            </div>

            <div class="analysis-tabs" style="display: flex; gap: 8px; margin: 28px 0 20px; border-bottom: 1px solid rgba(224,224,224,0.2); padding-bottom: 12px; flex-wrap: wrap;">
                <button class="analysis-tab active" data-tab="overview" style="padding: 8px 20px; font-size: 14px;">📊 Полный анализ</button>
                <button class="analysis-tab" data-tab="patterns" style="padding: 8px 20px; font-size: 14px;">🔄 Петли и механизмы</button>
                <button class="analysis-tab" data-tab="recommendations" style="padding: 8px 20px; font-size: 14px;">🌱 Точки роста</button>
                <button class="analysis-tab" data-tab="thought" style="padding: 8px 20px; font-size: 14px;">🧠 Мысли психолога</button>
            </div>

            <div id="analysisTabContent"></div>

            <div style="margin-top: 40px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; border-top: 1px solid rgba(224,224,224,0.1); padding-top: 28px;">
                <button id="regenerateAnalysisBtn" class="voice-record-btn-premium" style="background: rgba(255,107,59,0.15); border-color: #ff6b3b; padding: 10px 24px; font-size: 13px;">
                    🔄 Провести новый анализ
                </button>
                <button id="backToDashboardBtn" class="back-btn" style="min-width: 130px; padding: 10px 20px; font-size: 13px;">
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
    
    // Добавляем стили для анализа
    if (!document.querySelector('#analysis-final-styles')) {
        const style = document.createElement('style');
        style.id = 'analysis-final-styles';
        style.textContent = `
            .analysis-header {
                margin: 24px 0 12px;
                font-size: 18px;
                font-weight: 600;
                color: #ff6b3b;
                border-left: 3px solid #ff6b3b;
                padding-left: 12px;
            }
            .analysis-paragraph {
                margin: 12px 0;
                line-height: 1.7;
                color: var(--text-secondary);
                font-size: 14px;
            }
            .analysis-list {
                margin: 10px 0;
                list-style: none;
                padding: 0;
            }
            .analysis-list-item {
                margin: 6px 0 6px 24px;
                line-height: 1.6;
                color: var(--text-secondary);
                font-size: 14px;
                position: relative;
            }
            .analysis-list-item::before {
                content: '•';
                color: #ff6b3b;
                font-weight: bold;
                position: absolute;
                left: -16px;
            }
            .analysis-bold {
                color: #ff6b3b;
                font-weight: 600;
            }
            .analysis-block {
                margin: 12px 0;
                padding: 8px 12px;
                background: rgba(255, 107, 59, 0.05);
                border-radius: 8px;
            }
            .block-label {
                color: #ff8c4a;
                font-weight: 600;
                margin-right: 6px;
            }
            @media (max-width: 768px) {
                .analysis-header {
                    font-size: 16px;
                    margin: 20px 0 10px;
                }
                .analysis-paragraph {
                    font-size: 13px;
                }
                .analysis-list-item {
                    font-size: 13px;
                    margin-left: 20px;
                }
            }
        `;
        document.head.appendChild(style);
    }
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
                <h3 style="font-size: 18px;">Анализ формируется</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">Нажмите "Провести новый анализ"</p>
                <button onclick="generateDeepAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px; padding: 10px 24px; font-size: 14px;">
                    🔄 Провести анализ
                </button>
            </div>
        `;
        return;
    }
    
    const formattedHtml = formatAnalysisText(analysis);
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="analysis-content">
            ${formattedHtml}
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
    
    // Извлекаем секции
    let patternsSection = '';
    let hiddenSection = '';
    
    const patternsMatch = analysis.match(/(?:СИСТЕМНЫЕ ПЕТЛИ)[\s\S]*?(?=(?:СКРЫТЫЕ МЕХАНИЗМЫ|ТОЧКИ РОСТА|ПРОГНОЗ|$))/i);
    const hiddenMatch = analysis.match(/(?:СКРЫТЫЕ МЕХАНИЗМЫ)[\s\S]*?(?=(?:ТОЧКИ РОСТА|ПРОГНОЗ|$))/i);
    
    if (patternsMatch) {
        let text = patternsMatch[0];
        text = text.replace(/СИСТЕМНЫЕ ПЕТЛИ\s*/i, '');
        text = formatAnalysisText(text);
        patternsSection = `
            <div style="margin-bottom: 28px;">
                <h3 class="analysis-header">🔄 Системные петли</h3>
                <div>${text}</div>
            </div>
        `;
    }
    
    if (hiddenMatch) {
        let text = hiddenMatch[0];
        text = text.replace(/СКРЫТЫЕ МЕХАНИЗМЫ\s*/i, '');
        text = formatAnalysisText(text);
        hiddenSection = `
            <div style="margin-bottom: 28px;">
                <h3 class="analysis-header">🧠 Скрытые механизмы</h3>
                <div>${text}</div>
            </div>
        `;
    }
    
    if (!patternsSection && !hiddenSection) {
        patternsSection = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Специальный раздел с петлями и механизмами будет доступен после проведения анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="analysis-content">
            ${patternsSection}
            ${hiddenSection}
        </div>
        <div style="margin-top: 20px; background: rgba(255,107,59,0.08); border-radius: 20px; padding: 18px;">
            <div style="display: flex; gap: 12px;">
                <span style="font-size: 22px;">💡</span>
                <div>
                    <strong style="font-size: 14px;">Осознание петли — первый шаг к её разрыву</strong>
                    <p style="color: var(--text-secondary); margin-top: 6px; font-size: 13px;">Обсудите эти наблюдения с Фреди в диалоге.</p>
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
    let keysSection = '';
    
    const growthMatch = analysis.match(/(?:ТОЧКИ РОСТА)[\s\S]*?(?=(?:ПРОГНОЗ|ПЕРСОНАЛЬНЫЕ КЛЮЧИ|$))/i);
    const keysMatch = analysis.match(/(?:ПЕРСОНАЛЬНЫЕ КЛЮЧИ)[\s\S]*?(?=(?:$))/i);
    
    if (growthMatch) {
        let text = growthMatch[0];
        text = text.replace(/ТОЧКИ РОСТА\s*/i, '');
        text = formatAnalysisText(text);
        growthSection = `
            <div style="margin-bottom: 28px;">
                <h3 class="analysis-header">🌱 Точки роста</h3>
                <div>${text}</div>
            </div>
        `;
    }
    
    if (keysMatch) {
        let text = keysMatch[0];
        text = text.replace(/ПЕРСОНАЛЬНЫЕ КЛЮЧИ\s*/i, '');
        text = formatAnalysisText(text);
        keysSection = `
            <div style="margin-bottom: 28px;">
                <h3 class="analysis-header">🔑 Персональные ключи</h3>
                <div>${text}</div>
            </div>
        `;
    }
    
    if (!growthSection && !keysSection) {
        growthSection = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Персональные рекомендации появятся после проведения анализа.</p>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="analysis-content">
            ${growthSection}
            ${keysSection}
        </div>
        
        <div style="margin-top: 28px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
            <div style="background: rgba(224,224,224,0.05); border-radius: 18px; padding: 16px; text-align: center;">
                <div style="font-size: 28px;">🧘</div>
                <div style="font-weight: 500; margin: 10px 0 6px; font-size: 14px;">Практика</div>
                <div style="font-size: 12px; color: var(--text-secondary);">5 минут осознанности</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 18px; padding: 16px; text-align: center;">
                <div style="font-size: 28px;">📝</div>
                <div style="font-weight: 500; margin: 10px 0 6px; font-size: 14px;">Дневник</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Записывайте сценарии</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 18px; padding: 16px; text-align: center;">
                <div style="font-size: 28px;">💬</div>
                <div style="font-weight: 500; margin: 10px 0 6px; font-size: 14px;">Диалог</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Обсудите с Фреди</div>
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
                <h3 style="font-size: 18px;">Мысли психолога появятся после анализа</h3>
                <button onclick="generateDeepAnalysis()" class="voice-record-btn-premium" style="margin-top: 24px; padding: 10px 24px; font-size: 14px;">
                    🔄 Провести анализ
                </button>
            </div>
        `;
        return;
    }
    
    let formattedThought = thought
        .replace(/\*\*(.*?)\*\*/g, '<strong class="analysis-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong class="analysis-bold">$1</strong>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="psychologist-thought">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="font-size: 32px;">🧠</div>
                <div>
                    <div style="font-size: 11px; color: var(--text-secondary);">ФРЕДИ ГОВОРИТ</div>
                    <div style="font-size: 18px; font-weight: 500;">Мысли психолога</div>
                </div>
            </div>
            <div style="font-size: 15px; line-height: 1.7; font-style: italic; color: var(--text-secondary);">
                ${formattedThought}
            </div>
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,107,59,0.2);">
                <p style="font-size: 12px; color: var(--text-secondary);">✨ Этот анализ сформирован на основе ваших ответов и глубинных паттернов</p>
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

console.log('✅ Модуль анализа загружен (версия 4.0 — универсальное форматирование)');
