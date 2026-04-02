// ============================================
// analysis.js — Модуль "Анализ глубинных паттернов"
// Версия 6.1 — с RAW отображением для отладки
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

// ========== ФУНКЦИЯ ПОКАЗА ЗАГРУЗКИ С АНИМАЦИЕЙ ==========
function showAnalysisLoading(message, subMessage = '') {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 400px; gap: 24px; padding: 20px;">
            <div style="position: relative; width: 80px; height: 80px;">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 3px solid rgba(255,107,59,0.1); border-radius: 50%;"></div>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 3px solid #ff6b3b; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 32px;">🧠</div>
            </div>
            <div style="font-size: 18px; font-weight: 500; color: var(--text-primary);">${message}</div>
            <div style="font-size: 13px; color: var(--text-secondary); text-align: center; max-width: 280px;">${subMessage}</div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <div style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite;"></div>
                <div style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite 0.2s;"></div>
                <div style="width: 8px; height: 8px; background: #ff6b3b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite 0.4s;"></div>
            </div>
        </div>
        <style>
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
            }
        </style>
    `;
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

    showAnalysisLoading('🔍 Загружаю данные...', 'Получение профиля');

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
        if (window.showToast) window.showToast('❌ Ошибка загрузки данных');
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    }
}

// ============================================
// ГЛУБОКИЙ AI-АНАЛИЗ
// ============================================

async function generateDeepAnalysis() {
    let timerInterval = null;
    let seconds = 0;
    
    showAnalysisLoading('🧠 Провожу глубинный анализ...', 'Это занимает 20-40 секунд');
    
    const loadingContainer = document.querySelector('.screen-container > div');
    let timeElement = null;
    if (loadingContainer) {
        timeElement = document.createElement('div');
        timeElement.style.cssText = 'font-size: 24px; font-weight: 600; color: #ff6b3b; margin-top: 8px;';
        loadingContainer.appendChild(timeElement);
        
        timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            if (minutes > 0) {
                timeElement.textContent = `${minutes}м ${secs}с`;
            } else {
                timeElement.textContent = `${secs}с`;
            }
            
            if (seconds === 15) {
                const msgDiv = loadingContainer.querySelector('div:nth-child(2)');
                if (msgDiv) msgDiv.textContent = '🧠 Анализирую глубинные паттерны...';
            }
            if (seconds === 30) {
                const msgDiv = loadingContainer.querySelector('div:nth-child(2)');
                if (msgDiv) msgDiv.textContent = '✨ Формирую персональные рекомендации...';
            }
        }, 1000);
    }
    
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
        
        if (timerInterval) clearInterval(timerInterval);
        
        if (data.success && data.analysis) {
            cachedAIAnalysis.profile = data.analysis;
            
            // Сохраняем в localStorage
            try {
                localStorage.setItem(`last_analysis_${userId}`, data.analysis);
                const savedAnalyses = JSON.parse(localStorage.getItem(`deep_analyses_${userId}`) || '[]');
                savedAnalyses.unshift({
                    text: data.analysis,
                    timestamp: Date.now(),
                    date: new Date().toISOString()
                });
                while (savedAnalyses.length > 5) savedAnalyses.pop();
                localStorage.setItem(`deep_analyses_${userId}`, JSON.stringify(savedAnalyses));
                console.log('✅ Анализ сохранён локально');
            } catch (e) {
                console.warn('Local save failed:', e);
            }
            
            renderAnalysisWithTabs();
        } else {
            if (window.showToast) window.showToast('⚠️ Не удалось сгенерировать анализ');
            renderFallbackAnalysis();
        }
        
    } catch (error) {
        console.error('Generate deep analysis error:', error);
        if (timerInterval) clearInterval(timerInterval);
        if (window.showToast) window.showToast('❌ Ошибка при генерации анализа');
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
    <div style="font-size: 64px; margin-bottom: 16px;">🧠</div>
    <div style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Анализ формируется</div>
    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">${userName}, ваш портрет создаётся</div>
    <button onclick="generateDeepAnalysis()" class="analysis-btn" style="margin-top: 8px;">🔄 Попробовать снова</button>
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

            <div id="analysisTabContent"></div>

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
    
    if (!document.querySelector('#analysis-styles')) {
        const style = document.createElement('style');
        style.id = 'analysis-styles';
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
// ВКЛАДКА 1: ПОЛНЫЙ АНАЛИЗ — ВРЕМЕННО ПОКАЗЫВАЕМ RAW ТЕКСТ
// ============================================

function renderOverviewTab() {
    const analysis = cachedAIAnalysis?.profile || '';
    
    if (!analysis) {
        document.getElementById('analysisTabContent').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🧠</div>
                <div style="font-size: 16px; font-weight: 600;">Анализ формируется</div>
                <button onclick="generateDeepAnalysis()" class="analysis-btn" style="margin-top: 16px;">🔄 Провести анализ</button>
            </div>
        `;
        return;
    }
    
    // ВРЕМЕННО: показываем RAW текст от AI без форматирования
    const rawText = analysis
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 16px; font-family: monospace; font-size: 12px;">
            <div style="color: #ff6b3b; margin-bottom: 12px; font-family: sans-serif;">📝 RAW ТЕКСТ ОТ AI (без форматирования):</div>
            <div style="color: #a0a3b0; line-height: 1.5; white-space: pre-wrap;">${rawText}</div>
            <hr style="margin: 20px 0; border-color: #333;">
            <div style="color: #ff6b3b; margin-bottom: 12px; font-family: sans-serif;">📊 СТАТИСТИКА:</div>
            <div style="color: #a0a3b0; font-family: sans-serif;">Длина: ${analysis.length} символов</div>
            <div style="color: #a0a3b0; font-family: sans-serif;">Переносов строк \\n: ${(analysis.match(/\n/g) || []).length}</div>
            <div style="color: #a0a3b0; font-family: sans-serif;">Двойных переносов \\n\\n: ${(analysis.match(/\n\n/g) || []).length}</div>
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
    
    // ВРЕМЕННО: тоже показываем RAW
    const rawText = analysis
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 16px; font-family: monospace; font-size: 12px;">
            <div style="color: #ff6b3b; margin-bottom: 12px;">🔄 ПЕТЛИ И МЕХАНИЗМЫ (RAW)</div>
            <div style="color: #a0a3b0; line-height: 1.5; white-space: pre-wrap;">${rawText}</div>
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
    
    const rawText = analysis
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 16px; font-family: monospace; font-size: 12px;">
            <div style="color: #ff6b3b; margin-bottom: 12px;">🌱 ТОЧКИ РОСТА (RAW)</div>
            <div style="color: #a0a3b0; line-height: 1.5; white-space: pre-wrap;">${rawText}</div>
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
    
    const rawText = thought
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    document.getElementById('analysisTabContent').innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 16px; font-family: monospace; font-size: 12px;">
            <div style="color: #ff6b3b; margin-bottom: 12px;">🧠 МЫСЛИ ПСИХОЛОГА (RAW)</div>
            <div style="color: #a0a3b0; line-height: 1.5; white-space: pre-wrap;">${rawText}</div>
        </div>
    `;
}

// ============================================
// ГЛОБАЛЬНЫЙ ЭКСПОРТ
// ============================================

window.openAnalysisScreen = openAnalysisScreen;
window.generateDeepAnalysis = generateDeepAnalysis;
window.switchTab = switchTab;

console.log('✅ Модуль анализа загружен (версия 6.1 — RAW отображение для отладки)');
