// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 5.0 — КОМПАКТНОЕ ОФОРМЛЕНИЕ БЕЗ ЛИНИЙ
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

// ========== ФУНКЦИЯ ПОКАЗА ЗАГРУЗКИ ==========
function showAnalysisLoading(message) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 16px;">
            <div class="loading-spinner" style="font-size: 48px; animation: spin 1s linear infinite;">🧠</div>
            <div class="loading-text" style="font-size: 14px; color: var(--text-secondary);">${message}</div>
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
        `;
        document.head.appendChild(style);
    }
}

// ========== НОРМАЛИЗАЦИЯ ТЕКСТА ОТ AI ==========
function normalizeAIText(text) {
    if (!text) return '';
    
    let processed = text;
    
    // 1. Добавляем пробел после ##
    processed = processed.replace(/##([^#\s])/g, '## $1');
    
    // 2. Добавляем перенос строки после заголовков
    processed = processed.replace(/(## [^\n]+)(?=[^\n])/g, '$1\n');
    
    // 3. Добавляем перенос перед маркерами списков
    processed = processed.replace(/(\* |• |\d+\. )/g, '\n$1');
    
    // 4. Убираем дублирование заголовков
    const lines = processed.split('\n');
    const uniqueLines = [];
    let lastHeader = '';
    
    for (const line of lines) {
        const isHeader = line.includes('СИСТЕМНЫЕ ПЕТЛИ') || line.includes('СКРЫТЫЕ МЕХАНИЗМЫ') || 
                         line.includes('ТОЧКИ РОСТА') || line.includes('ПРОГНОЗ') || 
                         line.includes('ПЕРСОНАЛЬНЫЕ КЛЮЧИ') || line.includes('ГЛУБИННЫЙ ПОРТРЕТ');
        if (isHeader) {
            if (lastHeader !== line.trim()) {
                uniqueLines.push(line);
                lastHeader = line.trim();
            }
        } else {
            uniqueLines.push(line);
        }
    }
    processed = uniqueLines.join('\n');
    
    // 5. Убираем множественные переносы
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed;
}

// ========== КОМПАКТНОЕ ФОРМАТИРОВАНИЕ ==========
function formatAnalysisText(text) {
    if (!text) return '';
    
    let processed = normalizeAIText(text);
    
    // 1. Заголовки разделов (без линий)
    const headers = ['ГЛУБИННЫЙ ПОРТРЕТ', 'СИСТЕМНЫЕ ПЕТЛИ', 'СКРЫТЫЕ МЕХАНИЗМЫ', 'ТОЧКИ РОСТА', 'ПРОГНОЗ', 'ПЕРСОНАЛЬНЫЕ КЛЮЧИ'];
    for (const header of headers) {
        processed = processed.replace(
            new RegExp(`##?\\s*${header}`, 'gi'),
            `\n<div class="analysis-section-title">${header}</div>\n`
        );
    }
    
    // 2. Заголовки с эмодзи
    processed = processed.replace(/^([🔍🔄🧠🌱📊🔑💡⚠️🎯💪])\s*(.+)$/gm, '<div class="analysis-header">$1 $2</div>');
    
    // 3. Жирный текст
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="analysis-bold">$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<strong class="analysis-bold">$1</strong>');
    
    // 4. Маркированные списки
    processed = processed.replace(/^[\*\•]\s+(.+)$/gm, '<div class="analysis-list-item">• $1</div>');
    
    // 5. Нумерованные списки
    processed = processed.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="analysis-list-item numbered">$1. $2</div>');
    
    // 6. Блоки с подписями (Триггер, Действие, Цена)
    processed = processed.replace(/^([А-ЯЁ][а-яё]+):\s+(.+)$/gm, '<div class="analysis-block"><span class="block-label">$1:</span> $2</div>');
    
    // 7. Прогноз с двумя вариантами
    processed = processed.replace(/Без изменений:/g, '<div class="forecast-bad">▸ Без изменений:');
    processed = processed.replace(/При работе над собой:/g, '<div class="forecast-good">▸ При работе над собой:');
    processed = processed.replace(/<\/div><div class="forecast-good">/g, '</div><div class="forecast-good">');
    
    // 8. Обычные параграфы (всё остальное)
    const lines = processed.split('\n');
    let result = '';
    let inParagraph = false;
    let paragraphText = '';
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        const isSpecial = line.startsWith('<div') || line.startsWith('<strong') || line.startsWith('▸');
        
        if (isSpecial) {
            if (inParagraph && paragraphText) {
                result += `<div class="analysis-text">${paragraphText}</div>`;
                paragraphText = '';
                inParagraph = false;
            }
            result += line;
        } else {
            if (inParagraph) {
                paragraphText += ' ' + line;
            } else {
                paragraphText = line;
                inParagraph = true;
            }
        }
    }
    if (inParagraph && paragraphText) {
        result += `<div class="analysis-text">${paragraphText}</div>`;
    }
    
    return result;
}

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ — ОТКРЫТЬ АНАЛИЗ
// ============================================

async function openAnalysisScreen() {
    const completed = await window.isTestCompleted();
    if (!completed) {
        if (window.showToast) {
            window.showToast('📊 Сначала пройдите психологический тест');
        } else {
            alert('📊 Сначала пройдите психологический тест');
        }
        return;
    }

    showAnalysisLoading('🔍 Загружаю данные...');

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
        if (window.showToast) window.showToast('❌ Ошибка загрузки');
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    }
}

// ============================================
// ГЛУБОКИЙ AI-АНАЛИЗ
// ============================================

async function generateDeepAnalysis() {
    showAnalysisLoading('🧠 Анализирую...');
    
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
            if (window.showToast) window.showToast('⚠️ Ошибка генерации');
            renderFallbackAnalysis();
        }
        
    } catch (error) {
        console.error('Generate deep analysis error:', error);
        if (window.showToast) window.showToast('❌ Ошибка');
        renderFallbackAnalysis();
    }
}

// ============================================
// ЗАГЛУШКА
// ============================================

function renderFallbackAnalysis() {
    const userName = window.CONFIG?.USER_NAME || localStorage.getItem('fredi_user_name') || 'друг';
    
    const fallbackText = `
<div style="text-align: center; padding: 40px 20px;">
    <div style="font-size: 48px; margin-bottom: 12px;">🧠</div>
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Анализ формируется</div>
    <div style="font-size: 13px; color: var(--text-secondary);">${userName}, ваш портрет создаётся</div>
    <button onclick="generateDeepAnalysis()" class="analysis-btn" style="margin-top: 20px;">🔄 Попробовать снова</button>
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
        <div style="max-width: 900px; margin: 0 auto; padding: 16px;">
            <button class="back-btn" id="backToDashboard" style="margin-bottom: 16px; padding: 8px 16px;">◀️ НАЗАД</button>

            <div style="margin-bottom: 16px;">
                <div style="font-size: 24px; font-weight: 700;">🧠 Глубинный анализ паттернов</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Системный AI-анализ</div>
            </div>

            <div class="analysis-tabs" style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button class="analysis-tab active" data-tab="overview">📊 Полный анализ</button>
                <button class="analysis-tab" data-tab="patterns">🔄 Петли и механизмы</button>
                <button class="analysis-tab" data-tab="recommendations">🌱 Точки роста</button>
                <button class="analysis-tab" data-tab="thought">🧠 Мысли психолога</button>
            </div>

            <div id="analysisTabContent" class="fredi-analysis"></div>

            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center;">
                <button id="regenerateAnalysisBtn" class="analysis-btn">🔄 Провести новый анализ</button>
                <button id="backToDashboardBtn" class="analysis-btn">🏠 Вернуться</button>
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
    
    // Добавляем стили если нет
    if (!document.querySelector('#analysis-compact-styles')) {
        const style = document.createElement('style');
        style.id = 'analysis-compact-styles';
        style.textContent = `
            .analysis-tab {
                background: rgba(255,107,59,0.1);
                border: none;
                padding: 6px 14px;
                border-radius: 30px;
                font-size: 12px;
                font-weight: 500;
                color: #a0a3b0;
                cursor: pointer;
                transition: all 0.2s;
            }
            .analysis-tab.active {
                background: #ff6b3b;
                color: white;
            }
            .analysis-btn {
                background: rgba(255,107,59,0.1);
                border: none;
                padding: 8px 20px;
                border-radius: 30px;
                font-size: 13px;
                color: white;
                cursor: pointer;
                transition: all 0.2s;
            }
            .analysis-btn:hover {
                background: rgba(255,107,59,0.2);
            }
            .fredi-analysis .analysis-section-title {
                font-size: 15px;
                font-weight: 700;
                margin: 16px 0 6px;
                color: #ff6b3b;
            }
            .fredi-analysis .analysis-header {
                font-size: 14px;
                font-weight: 600;
                margin: 10px 0 4px;
                color: #ff8c4a;
            }
            .fredi-analysis .analysis-text {
                font-size: 13px;
                line-height: 1.45;
                color: #c0c0c0;
                margin: 4px 0;
            }
            .fredi-analysis .analysis-bold {
                color: #ff6b3b;
                font-weight: 600;
            }
            .fredi-analysis .analysis-list-item {
                font-size: 13px;
                line-height: 1.45;
                color: #c0c0c0;
                margin: 3px 0 3px 16px;
            }
            .fredi-analysis .analysis-list-item.numbered {
                margin-left: 20px;
            }
            .fredi-analysis .analysis-block {
                margin: 6px 0;
                padding: 4px 0 4px 10px;
                background: rgba(255,107,59,0.05);
                border-radius: 6px;
            }
            .fredi-analysis .block-label {
                color: #ff8c4a;
                font-weight: 600;
                margin-right: 6px;
            }
            .fredi-analysis .forecast-bad,
            .fredi-analysis .forecast-good {
                margin: 6px 0;
                font-size: 13px;
                line-height: 1.45;
                color: #c0c0c0;
            }
            .fredi-analysis .forecast-bad {
                color: #ef4444;
            }
            .fredi-analysis .forecast-good {
                color: #10b981;
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
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 40px; margin-bottom: 12px;">🧠</div>
                <div style="font-size: 16px; font-weight: 600;">Анализ формируется</div>
                <button onclick="generateDeepAnalysis()" class="analysis-btn" style="margin-top: 16px;">🔄 Провести анализ</button>
            </div>
        `;
        return;
    }
    
    const formattedHtml = formatAnalysisText(analysis);
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="fredi-analysis">
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
    
    let patternsText = '';
    let hiddenText = '';
    
    const patternsMatch = analysis.match(/(?:СИСТЕМНЫЕ ПЕТЛИ)[\s\S]*?(?=(?:СКРЫТЫЕ МЕХАНИЗМЫ|ТОЧКИ РОСТА|ПРОГНОЗ|$))/i);
    const hiddenMatch = analysis.match(/(?:СКРЫТЫЕ МЕХАНИЗМЫ)[\s\S]*?(?=(?:ТОЧКИ РОСТА|ПРОГНОЗ|$))/i);
    
    if (patternsMatch) {
        let text = patternsMatch[0].replace(/СИСТЕМНЫЕ ПЕТЛИ/i, '');
        patternsText = formatAnalysisText(text);
    }
    
    if (hiddenMatch) {
        let text = hiddenMatch[0].replace(/СКРЫТЫЕ МЕХАНИЗМЫ/i, '');
        hiddenText = formatAnalysisText(text);
    }
    
    let content = '';
    if (patternsText) {
        content += `<div class="analysis-section-title">🔄 Системные петли</div>${patternsText}`;
    }
    if (hiddenText) {
        content += `<div class="analysis-section-title" style="margin-top: 16px;">🧠 Скрытые механизмы</div>${hiddenText}`;
    }
    
    if (!content) {
        content = '<div style="text-align: center; padding: 40px;">Раздел будет доступен после анализа</div>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="fredi-analysis">
            ${content}
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
    
    let growthText = '';
    let keysText = '';
    
    const growthMatch = analysis.match(/(?:ТОЧКИ РОСТА)[\s\S]*?(?=(?:ПРОГНОЗ|ПЕРСОНАЛЬНЫЕ КЛЮЧИ|$))/i);
    const keysMatch = analysis.match(/(?:ПЕРСОНАЛЬНЫЕ КЛЮЧИ)[\s\S]*?(?=(?:$))/i);
    
    if (growthMatch) {
        let text = growthMatch[0].replace(/ТОЧКИ РОСТА/i, '');
        growthText = formatAnalysisText(text);
    }
    
    if (keysMatch) {
        let text = keysMatch[0].replace(/ПЕРСОНАЛЬНЫЕ КЛЮЧИ/i, '');
        keysText = formatAnalysisText(text);
    }
    
    let content = '';
    if (growthText) {
        content += `<div class="analysis-section-title">🌱 Точки роста</div>${growthText}`;
    }
    if (keysText) {
        content += `<div class="analysis-section-title" style="margin-top: 16px;">🔑 Персональные ключи</div>${keysText}`;
    }
    
    if (!content) {
        content = '<div style="text-align: center; padding: 40px;">Раздел будет доступен после анализа</div>';
    }
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="fredi-analysis">
            ${content}
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
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 40px; margin-bottom: 12px;">🧠</div>
                <div style="font-size: 16px; font-weight: 600;">Мысли психолога появятся позже</div>
                <button onclick="generateDeepAnalysis()" class="analysis-btn" style="margin-top: 16px;">🔄 Провести анализ</button>
            </div>
        `;
        return;
    }
    
    let formattedThought = thought
        .replace(/\*\*(.*?)\*\*/g, '<strong class="analysis-bold">$1</strong>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div class="fredi-analysis">
            <div style="background: rgba(255,107,59,0.05); border-radius: 16px; padding: 16px;">
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <div style="font-size: 28px;">🧠</div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-secondary);">ФРЕДИ ГОВОРИТ</div>
                        <div style="font-size: 16px; font-weight: 600;">Мысли психолога</div>
                    </div>
                </div>
                <div style="font-size: 14px; line-height: 1.5; font-style: italic; color: #c0c0c0;">
                    ${formattedThought}
                </div>
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

console.log('✅ Модуль анализа загружен (версия 5.0 — компактное оформление)');
