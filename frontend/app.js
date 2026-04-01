// ============================================
// ДИНАМИЧЕСКАЯ КОНФИГУРАЦИЯ ПОЛЬЗОВАТЕЛЯ
// ============================================

// Генерация уникального ID для нового пользователя
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Получение или создание пользовательского ID
function getOrCreateUserId() {
    let userId = localStorage.getItem('fredi_user_id');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('fredi_user_id', userId);
        console.log('🆕 New user created with ID:', userId);
    } else {
        console.log('👤 Existing user ID:', userId);
    }
    return userId;
}

// Получение имени пользователя (если есть)
function getUserName() {
    return localStorage.getItem('fredi_user_name') || null;
}

// Сохранение имени пользователя
function setUserName(name) {
    if (name && name.trim()) {
        localStorage.setItem('fredi_user_name', name.trim());
        console.log('📝 User name saved:', name);
    }
}

// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    API_BASE_URL: 'https://fredi-backend-flz2.onrender.com',
    get USER_ID() { return getOrCreateUserId(); },  // Динамический ID
    get USER_NAME() { return getUserName() || 'друг'; },  // Имя или "друг"
    PROFILE_CODE: null  // Профиль определится из БД
};

// Для обратной совместимости
window.CONFIG = CONFIG;

// Режимы (без приветствий)
const MODES = {
    coach: {
        id: 'coach',
        name: 'КОУЧ',
        emoji: '🔮',
        color: '#3b82ff',
        greeting: 'Я твой коуч. Давай найдём ответы внутри тебя.',
        voicePrompt: 'Задай вопрос — я помогу найти решение'
    },
    psychologist: {
        id: 'psychologist',
        name: 'ПСИХОЛОГ',
        emoji: '🧠',
        color: '#ff6b3b',
        greeting: 'Я здесь, чтобы помочь разобраться в глубинных паттернах.',
        voicePrompt: 'Расскажите, что вас беспокоит'
    },
    trainer: {
        id: 'trainer',
        name: 'ТРЕНЕР',
        emoji: '⚡',
        color: '#ff3b3b',
        greeting: 'Давай достигать целей вместе!',
        voicePrompt: 'Сформулируй задачу — получишь чёткий план'
    }
};

// Модули для каждого режима
const MODULES = {
    coach: [
        { id: 'goals', name: 'Цели', icon: '🎯', desc: 'Постановка и достижение' },
        { id: 'strategy', name: 'Стратегия', icon: '📊', desc: 'План действий' },
        { id: 'motivation', name: 'Мотивация', icon: '⚡', desc: 'Энергия для движения' },
        { id: 'habits', name: 'Привычки', icon: '🔄', desc: 'Формирование привычек' }
    ],
    psychologist: [
        { id: 'analysis', name: 'Анализ', icon: '🧠', desc: 'Глубинные паттерны' },
        { id: 'emotions', name: 'Эмоции', icon: '💭', desc: 'Работа с чувствами' },
        { id: 'trauma', name: 'Исцеление', icon: '🕊️', desc: 'Проработка опыта' },
        { id: 'relations', name: 'Отношения', icon: '💕', desc: 'Коммуникация' }
    ],
    trainer: [
        { id: 'workout', name: 'Тренировки', icon: '💪', desc: 'Физическая активность' },
        { id: 'discipline', name: 'Дисциплина', icon: '⏰', desc: 'Режим и порядок' },
        { id: 'results', name: 'Результаты', icon: '🏆', desc: 'Достижения' },
        { id: 'challenges', name: 'Челленджи', icon: '🔥', desc: 'Испытания' }
    ]
};

// Состояние
let currentMode = 'psychologist';
let navigationHistory = [];
let voiceManager = null; // Будет инициализирован позже

// ============================================
// API ВЫЗОВЫ
// ============================================

async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

// ========== КОНФАЙНТМЕНТ-МОДЕЛЬ API ==========

async function getConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement-model?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get confinement model', error);
        return null;
    }
}

async function getConfinementLoops() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/loops`);
        return data;
    } catch (error) {
        console.warn('Failed to get loops', error);
        return null;
    }
}

async function getKeyConfinement() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/key-confinement`);
        return data;
    } catch (error) {
        console.warn('Failed to get key confinement', error);
        return null;
    }
}

async function getIntervention(elementId) {
    try {
        const data = await apiCall(`/api/intervention/${elementId}?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get intervention', error);
        return null;
    }
}

async function rebuildConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/rebuild`, {
            method: 'POST'
        });
        return data;
    } catch (error) {
        console.warn('Failed to rebuild model', error);
        return null;
    }
}

// ========== ПРАКТИКИ API ==========

async function getMorningPractice() {
    try {
        const data = await apiCall('/api/practice/morning');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get morning practice', error);
        return 'Утренняя практика: начните день с намерения. Сделайте 3 глубоких вдоха и скажите себе: "Я выбираю, как мне относиться к этому дню".';
    }
}

async function getEveningPractice() {
    try {
        const data = await apiCall('/api/practice/evening');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get evening practice', error);
        return 'Вечерняя практика: вспомните три хороших события сегодня. За что вы благодарны? Что было важным?';
    }
}

async function getRandomExercise() {
    try {
        const data = await apiCall('/api/practice/random-exercise');
        return data.exercise;
    } catch (error) {
        console.warn('Failed to get exercise', error);
        return 'Сделайте паузу. Обратите внимание на своё дыхание. Вдох... выдох... Повторите 5 раз.';
    }
}

async function getRandomQuote() {
    try {
        const data = await apiCall('/api/practice/random-quote');
        return data.quote;
    } catch (error) {
        console.warn('Failed to get quote', error);
        return '«Не в силе, а в правде. Не в деньгах, а в душевном покое.» — Андрей Мейстер';
    }
}

// ========== ГИПНОЗ API ==========

async function processHypno(text, mode = currentMode) {
    try {
        const data = await apiCall('/api/hypno/process', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                text: text,
                mode: mode
            })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to process hypno', error);
        return 'Сделайте глубокий вдох... Представьте, что с каждым выдохом вы отпускаете напряжение... Вы в безопасности... Дышите...';
    }
}

async function getHypnoSupport(text = '') {
    try {
        const data = await apiCall('/api/hypno/support', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to get support', error);
        return 'Я здесь. Ты справляешься. Дыши спокойно.';
    }
}

// ========== СКАЗКИ API ==========

async function getTales() {
    try {
        const data = await apiCall('/api/tale');
        return data;
    } catch (error) {
        console.warn('Failed to get tales', error);
        return { success: false, available_tales: [] };
    }
}

async function getTaleById(taleId) {
    try {
        const data = await apiCall(`/api/tale/${taleId}`);
        return data.tale;
    } catch (error) {
        console.warn('Failed to get tale', error);
        return null;
    }
}

// ========== ЯКОРЯ API ==========

async function getUserAnchors() {
    try {
        const data = await apiCall(`/api/anchor/user/${CONFIG.USER_ID}`);
        return data.anchors;
    } catch (error) {
        console.warn('Failed to get anchors', error);
        return [];
    }
}

async function setAnchor(anchorName, state, phrase) {
    try {
        const data = await apiCall('/api/anchor/set', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName,
                state: state,
                phrase: phrase
            })
        });
        return data;
    } catch (error) {
        console.warn('Failed to set anchor', error);
        return null;
    }
}

async function fireAnchor(anchorName) {
    try {
        const data = await apiCall('/api/anchor/fire', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName
            })
        });
        return data.phrase;
    } catch (error) {
        console.warn('Failed to fire anchor', error);
        return null;
    }
}

async function getAnchor(state) {
    try {
        const data = await apiCall(`/api/anchor/${state}`);
        return data.phrase;
    } catch (error) {
        console.warn('Failed to get anchor', error);
        return `Я спокоен. Я дышу. Я здесь и сейчас.`;
    }
}

// ========== СТАТИСТИКА API ==========

async function getConfinementStatistics() {
    try {
        const data = await apiCall(`/api/confinement/statistics/${CONFIG.USER_ID}`);
        return data.statistics;
    } catch (error) {
        console.warn('Failed to get statistics', error);
        return {
            total_elements: 0,
            active_elements: 0,
            total_loops: 0,
            is_system_closed: false,
            closure_score: 0
        };
    }
}

// ========== НОВЫЕ API ДЛЯ ПРОВЕРКИ РЕАЛЬНОСТИ ==========

async function getRealityPath(goalId, mode = 'coach') {
    try {
        const data = await apiCall(`/api/reality/path/${goalId}?mode=${mode}`);
        return data.path;
    } catch (error) {
        console.warn('Failed to get reality path', error);
        return null;
    }
}

async function checkReality(goalId, mode = 'coach', lifeContext = {}, goalContext = {}, profile = {}) {
    try {
        const data = await apiCall('/api/reality/check', {
            method: 'POST',
            body: JSON.stringify({
                goal_id: goalId,
                mode: mode,
                life_context: lifeContext,
                goal_context: goalContext,
                profile: profile
            })
        });
        return data.result;
    } catch (error) {
        console.warn('Failed to check reality', error);
        return null;
    }
}

async function getLifeContextQuestions() {
    try {
        const data = await apiCall('/api/reality/questions/life');
        return data.questions;
    } catch (error) {
        console.warn('Failed to get life questions', error);
        return null;
    }
}

async function parseLifeAnswers(text) {
    try {
        const data = await apiCall('/api/reality/parse/life', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.parsed;
    } catch (error) {
        console.warn('Failed to parse life answers', error);
        return null;
    }
}

async function parseGoalAnswers(text) {
    try {
        const data = await apiCall('/api/reality/parse/goal', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.parsed;
    } catch (error) {
        console.warn('Failed to parse goal answers', error);
        return null;
    }
}

// ========== ДРУГИЕ API ==========

async function getUserStatus() {
    try {
        return await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
    } catch (error) {
        console.warn('Failed to get user status, assuming new user:', error);
        return { 
            has_profile: false, 
            test_completed: false, 
            profile_code: null,
            interpretation_ready: false
        };
    }
}

async function getPsychologistThought() {
    try {
        const data = await apiCall(`/api/psychologist-thought/${CONFIG.USER_ID}`);
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function generateNewThought() {
    try {
        const data = await apiCall('/api/psychologist-thoughts/generate', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID })
        });
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function getWeekendIdeas() {
    try {
        const data = await apiCall(`/api/ideas?user_id=${CONFIG.USER_ID}`);
        return data.ideas || [];
    } catch (error) {
        return [];
    }
}

async function getUserProfile() {
    try {
        const data = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        return data.profile?.ai_generated_profile || 'Психологический портрет формируется.';
    } catch (error) {
        console.error('Error getting profile:', error);
        return 'Профиль временно недоступен.';
    }
}

async function getUserGoals() {
    try {
        const data = await apiCall(`/api/goals/with-confinement?user_id=${CONFIG.USER_ID}&mode=${currentMode}`);
        return data.goals || [];
    } catch (error) {
        return [];
    }
}

async function getSmartQuestions() {
    try {
        const data = await apiCall(`/api/smart-questions?user_id=${CONFIG.USER_ID}`);
        return data.questions || [];
    } catch (error) {
        return [];
    }
}

async function getChallenges() {
    try {
        const data = await apiCall(`/api/challenges?user_id=${CONFIG.USER_ID}`);
        return data.challenges || [];
    } catch (error) {
        return [];
    }
}

async function findPsychometricDoubles() {
    try {
        const data = await apiCall(`/api/psychometric/find-doubles?user_id=${CONFIG.USER_ID}&limit=5`);
        return data.doubles || [];
    } catch (error) {
        return [];
    }
}

// ========== НАВИГАЦИЯ ==========

function navigateBack() {
    if (navigationHistory.length > 0) {
        const last = navigationHistory.pop();
        if (last.screen === 'dashboard') {
            renderDashboard();
        } else {
            navigateTo(last.screen, last.params);
        }
    } else {
        renderDashboard();
    }
}

function navigateTo(screen, params = {}) {
    navigationHistory.push({ screen, params });
    
    switch(screen) {
        case 'confinement-model':
            showConfinementModel();
            break;
        case 'confinement-loops':
            showConfinementLoops(params);
            break;
        case 'intervention':
            showIntervention(params);
            break;
        case 'practices':
            showPractices();
            break;
        case 'hypnosis':
            showHypnosis();
            break;
        case 'tales':
            showTales();
            break;
        case 'anchors':
            showAnchors();
            break;
        case 'statistics':
            showStatistics();
            break;
        case 'profile':
            showFullContentScreen('🧠 Психологический портрет', params.content, 'profile');
            break;
        case 'thoughts':
            showFullContentScreen('💭 Мысли психолога', params.content, 'thoughts');
            break;
        case 'weekend':
            showFullContentScreen('🎨 Идеи на выходные', params.content, 'weekend');
            break;
        case 'goals':
            showFullContentScreen('🎯 Ваши цели', params.content, 'goals');
            break;
        case 'questions':
            showFullContentScreen('❓ Вопросы для размышления', params.content, 'questions');
            break;
        case 'challenges':
            showFullContentScreen('🏆 Челленджи', params.content, 'challenges');
            break;
        case 'doubles':
            showFullContentScreen('👥 Психометрические двойники', params.content, 'doubles');
            break;
        case 'analysis':
            if (typeof openAnalysisScreen === 'function') {
                openAnalysisScreen();
            } else {
                showToast('Анализ загружается...', 'info');
                const script = document.createElement('script');
                script.src = 'analysis.js';
                script.onload = () => openAnalysisScreen();
                document.head.appendChild(script);
            }
            break;
        default:
            renderDashboard();
    }
}

function showFullContentScreen(title, content, contentType, rawText = null) {
    const container = document.getElementById('screenContainer');
    
    const emojiMap = {
        profile: '🧠',
        thoughts: '💭',
        goals: '🎯',
        questions: '❓',
        challenges: '🏆',
        doubles: '👥',
        weekend: '🎨',
        confinement: '🔐',
        practices: '🧘',
        hypnosis: '🌙',
        tales: '📚',
        anchors: '⚓',
        statistics: '📊'
    };
    
    const formattedContent = typeof content === 'string' ? formatContentForDisplay(content) : content;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${emojiMap[contentType] || '📄'}</div>
                <h1 class="content-title">${title}</h1>
            </div>
            <div class="content-body" id="contentBody">
                ${formattedContent}
            </div>
        </div>
    `;
    
    // Кнопка НАЗАД - исправлена
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = function() {
            if (container) {
                container.innerHTML = '';
            }
            if (typeof renderDashboard === 'function') {
                renderDashboard();
            } else {
                location.reload();
            }
        };
    }
}

function formatContentForDisplay(text) {
    if (!text) return '<p>Нет данных</p>';
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const headerEmojis = '🔑💪🎯🌱⚠️🔐🔄🚪📊🧠💭💕🕊️✨🏆👥🎨';
    const headerRegex = new RegExp(`([${headerEmojis}])\\s*\\*\\*(.*?)\\*\\*`, 'g');
    formatted = formatted.replace(headerRegex, 
        '<div class="section-header"><span class="section-emoji">$1</span><strong class="section-title">$2</strong></div>');
    formatted = formatted.replace(/•\s*(.*?)(?=\n|$)/g, '<li>$1</li>');
    const paragraphs = formatted.split('\n\n');
    formatted = paragraphs.map(p => {
        if (p.trim().startsWith('<li>')) return `<ul class="styled-list">${p}</ul>`;
        if (p.trim().startsWith('<div class="section-header')) return p;
        return `<p>${p}</p>`;
    }).join('');
    return formatted;
}

// ========== ОТОБРАЖЕНИЕ РАЗДЕЛОВ ==========

async function showConfinementModel() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю модель ограничений...', 'info');
    
    const model = await getConfinementModel();
    if (!model) {
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">🔐</div>
                    <h1 class="content-title">Модель ограничений</h1>
                </div>
                <div class="content-body">
                    <p>Не удалось загрузить модель. Попробуйте позже.</p>
                </div>
            </div>
        `;
        document.getElementById('backBtn').onclick = () => navigateBack();
        return;
    }
    
    let elementsHtml = '';
    if (model.elements) {
        for (let i = 1; i <= 9; i++) {
            const elem = model.elements[i];
            if (elem) {
                elementsHtml += `
                    <div class="confinement-element" data-element="${i}">
                        <div class="element-number">${i}</div>
                        <div class="element-name">${elem.name || `Элемент ${i}`}</div>
                        <div class="element-desc">${(elem.description || '').substring(0, 60)}...</div>
                        <div class="element-meta">
                            <span class="element-strength">💪 ${Math.round((elem.strength || 0.5) * 100)}%</span>
                            <span class="element-vak">🎭 ${elem.vak || 'digital'}</span>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    let loopsHtml = '';
    if (model.loops && model.loops.length) {
        loopsHtml = '<h3>🔄 Петли</h3>';
        model.loops.forEach(loop => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">${loop.type || 'Петля'}</div>
                    <div class="loop-desc">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                </div>
            `;
        });
    }
    
    let keyHtml = '';
    if (model.key_confinement) {
        keyHtml = `
            <div class="key-confinement">
                <div class="key-icon">🔐</div>
                <div class="key-title">КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ</div>
                <div class="key-desc">${model.key_confinement.description || 'Анализ в процессе...'}</div>
                <div class="key-desc" style="margin-top: 8px;">Важность: ${Math.round((model.key_confinement.importance || 0.7) * 100)}%</div>
                <button class="action-btn" id="keyConfinementInterventionBtn" style="margin-top: 12px;">💡 Получить интервенцию</button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔐</div>
                <h1 class="content-title">Модель ограничений</h1>
            </div>
            <div class="content-body">
                <div class="key-confinement" style="background: rgba(224,224,224,0.05); margin-bottom: 20px;">
                    <div class="key-title">📊 СТЕПЕНЬ ЗАМЫКАНИЯ</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--chrome);">${Math.round((model.closure_score || 0) * 100)}%</div>
                    <div>${model.is_closed ? '🔒 Система замкнута' : '🔓 Система открыта'}</div>
                </div>
                
                ${keyHtml}
                
                <h3>📊 ЭЛЕМЕНТЫ МОДЕЛИ</h3>
                <div class="elements-grid" id="elementsGrid">
                    ${elementsHtml || '<p>Нет данных об элементах</p>'}
                </div>
                
                ${loopsHtml}
                
                <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="action-btn" id="loopsBtn">🔄 Все петли</button>
                    <button class="action-btn" id="rebuildModelBtn">🔄 Перестроить модель</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('loopsBtn')?.addEventListener('click', () => navigateTo('confinement-loops', { model: model }));
    document.getElementById('rebuildModelBtn')?.addEventListener('click', async () => {
        showToast('Перестраиваю модель...', 'info');
        const result = await rebuildConfinementModel();
        if (result && result.success) {
            showToast('Модель перестроена', 'success');
            navigateTo('confinement-model');
        } else {
            showToast('Не удалось перестроить модель', 'error');
        }
    });
    document.getElementById('keyConfinementInterventionBtn')?.addEventListener('click', () => {
        if (model.key_confinement && model.key_confinement.element) {
            navigateTo('intervention', { elementId: model.key_confinement.element.id });
        }
    });
}

async function showConfinementLoops(params) {
    const container = document.getElementById('screenContainer');
    showToast('Анализирую петли...', 'info');
    
    const loopsData = await getConfinementLoops();
    
    let loopsHtml = '';
    if (loopsData && loopsData.loops && loopsData.loops.length) {
        loopsData.loops.forEach((loop, idx) => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">🔄 ПЕТЛЯ ${idx + 1}: ${loop.type || 'Цикл'}</div>
                    <div class="loop-desc" style="margin: 8px 0;">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                    ${loop.elements ? `<div class="loop-strength">Элементы: ${loop.elements.join(' → ')}</div>` : ''}
                </div>
            `;
        });
    } else {
        loopsHtml = '<p>Петли не обнаружены</p>';
    }
    
    let statsHtml = '';
    if (loopsData && loopsData.statistics) {
        statsHtml = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card"><div class="stat-value">${loopsData.statistics.total_loops || 0}</div><div class="stat-label">Всего петель</div></div>
                <div class="stat-card"><div class="stat-value">${Math.round((loopsData.statistics.avg_loop_strength || 0) * 100)}%</div><div class="stat-label">Ср. сила петель</div></div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1 class="content-title">Петли системы</h1>
            </div>
            <div class="content-body">
                ${statsHtml}
                <h3>Обнаруженные петли</h3>
                ${loopsHtml}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}

async function showIntervention(params) {
    const elementId = params.elementId;
    const container = document.getElementById('screenContainer');
    showToast('Загружаю интервенцию...', 'info');
    
    const intervention = await getIntervention(elementId);
    
    let elementHtml = '';
    if (intervention && intervention.element) {
        elementHtml = `
            <div class="key-confinement" style="margin-bottom: 20px;">
                <div class="key-title">🧠 ЭЛЕМЕНТ ${intervention.element.id}: ${intervention.element.name || 'Неизвестно'}</div>
                <div class="key-desc">${intervention.element.description || 'Нет описания'}</div>
                <div class="key-desc">Уровень: ${intervention.element.level || 3}/6 | Сила: ${Math.round((intervention.element.strength || 0.5) * 100)}%</div>
            </div>
        `;
    }
    
    let interventionHtml = '';
    if (intervention && intervention.intervention) {
        interventionHtml = `
            <div class="intervention-card">
                <h3>💡 ЧТО ДЕЛАТЬ</h3>
                <div class="intervention-text">${intervention.intervention.description || intervention.intervention}</div>
            </div>
        `;
    }
    
    let dailyHtml = '';
    if (intervention && intervention.daily_practice) {
        dailyHtml = `
            <div class="daily-practice">
                <h3>📝 ЕЖЕДНЕВНАЯ ПРАКТИКА</h3>
                <div class="intervention-text">${intervention.daily_practice}</div>
            </div>
        `;
    }
    
    let weekHtml = '';
    if (intervention && intervention.week_program) {
        weekHtml = `
            <div class="daily-practice">
                <h3>📅 НЕДЕЛЬНАЯ ПРОГРАММА</h3>
                <div class="intervention-text">${intervention.week_program}</div>
            </div>
        `;
    }
    
    let quoteHtml = '';
    if (intervention && intervention.random_quote) {
        quoteHtml = `
            <div class="quote-card">
                <div>${intervention.random_quote}</div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">💡</div>
                <h1 class="content-title">Интервенция</h1>
            </div>
            <div class="content-body">
                ${elementHtml}
                ${interventionHtml}
                ${dailyHtml}
                ${weekHtml}
                ${quoteHtml}
                <button class="action-btn primary-btn" id="speakInterventionBtn" style="margin-top: 16px;">🔊 Озвучить</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakInterventionBtn')?.addEventListener('click', async () => {
        const text = (intervention?.intervention?.description || '') + ' ' + (intervention?.daily_practice || '');
        if (voiceManager) {
            await voiceManager.textToSpeech(text, currentMode);
        }
    });
}

async function showPractices() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю практики...', 'info');
    
    const [morning, evening, exercise, quote] = await Promise.all([
        getMorningPractice(),
        getEveningPractice(),
        getRandomExercise(),
        getRandomQuote()
    ]);
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🧘</div>
                <h1 class="content-title">Практики</h1>
            </div>
            <div class="content-body">
                <div class="practice-card">
                    <h3>🌅 УТРЕННЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${morning}</div>
                    <button class="action-btn" id="speakMorningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🌙 ВЕЧЕРНЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${evening}</div>
                    <button class="action-btn" id="speakEveningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🎲 СЛУЧАЙНОЕ УПРАЖНЕНИЕ</h3>
                    <div class="intervention-text">${exercise}</div>
                    <button class="action-btn" id="newExerciseBtn" style="margin-top: 12px;">🔄 Другое упражнение</button>
                    <button class="action-btn" id="speakExerciseBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="quote-card">
                    <h3>📖 ЦИТАТА ДНЯ</h3>
                    <div class="intervention-text" style="font-style: italic;">${quote}</div>
                    <button class="action-btn" id="newQuoteBtn" style="margin-top: 12px;">🔄 Другая цитата</button>
                    <button class="action-btn" id="speakQuoteBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakMorningBtn')?.addEventListener('click', async () => {
        if (voiceManager) await voiceManager.textToSpeech(morning, currentMode);
    });
    document.getElementById('speakEveningBtn')?.addEventListener('click', async () => {
        if (voiceManager) await voiceManager.textToSpeech(evening, currentMode);
    });
    document.getElementById('newExerciseBtn')?.addEventListener('click', async () => {
        const newExercise = await getRandomExercise();
        const exerciseDiv = document.querySelector('.practice-card:nth-child(3) .intervention-text');
        if (exerciseDiv) exerciseDiv.textContent = newExercise;
    });
    document.getElementById('newQuoteBtn')?.addEventListener('click', async () => {
        const newQuote = await getRandomQuote();
        const quoteDiv = document.querySelector('.quote-card .intervention-text');
        if (quoteDiv) quoteDiv.textContent = newQuote;
    });
}

async function showHypnosis() {
    const container = document.getElementById('screenContainer');
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Гипноз</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics">
                    <button class="topic-btn" data-topic="тревога">Тревога</button>
                    <button class="topic-btn" data-topic="уверенность">Уверенность</button>
                    <button class="topic-btn" data-topic="спокойствие">Спокойствие</button>
                    <button class="topic-btn" data-topic="сон">Сон</button>
                    <button class="topic-btn" data-topic="вдохновение">Вдохновение</button>
                </div>
                <textarea class="hypno-input" id="hypnoInput" rows="3" placeholder="Напишите, что вас беспокоит..."></textarea>
                <button class="action-btn primary-btn" id="processHypnoBtn">🌙 Получить гипнотический ответ</button>
                
                <div id="hypnoResponse" style="margin-top: 20px;"></div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>🎧 ПОДДЕРЖКА</h3>
                    <button class="action-btn" id="supportBtn">Получить поддерживающий ответ</button>
                    <div id="supportResponse" style="margin-top: 12px;"></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const topic = btn.dataset.topic;
            const input = document.getElementById('hypnoInput');
            input.value = `Я чувствую ${topic}`;
            const response = await processHypno(input.value);
            document.getElementById('hypnoResponse').innerHTML = `
                <div class="intervention-card">
                    <div class="intervention-text">${response}</div>
                    <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
                </div>
            `;
            document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
                if (voiceManager) await voiceManager.textToSpeech(response, currentMode);
            });
        });
    });
    
    document.getElementById('processHypnoBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('hypnoInput').value;
        if (!input.trim()) {
            showToast('Напишите, что вас беспокоит', 'info');
            return;
        }
        showToast('Формирую гипнотический ответ...', 'info');
        const response = await processHypno(input);
        document.getElementById('hypnoResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${response}</div>
                <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
            if (voiceManager) await voiceManager.textToSpeech(response, currentMode);
        });
    });
    
    document.getElementById('supportBtn')?.addEventListener('click', async () => {
        const support = await getHypnoSupport();
        document.getElementById('supportResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${support}</div>
                <button class="action-btn" id="speakSupportBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakSupportBtn')?.addEventListener('click', async () => {
            if (voiceManager) await voiceManager.textToSpeech(support, currentMode);
        });
    });
}

async function showTales() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю библиотеку сказок...', 'info');
    
    const talesData = await getTales();
    const talesList = talesData.available_tales || [];
    
    let talesHtml = '';
    if (talesList.length) {
        talesList.forEach(tale => {
            talesHtml += `
                <div class="tale-card" data-tale-id="${tale}">
                    <div class="loop-type">📖 ${tale}</div>
                    <div class="loop-desc">Терапевтическая сказка</div>
                </div>
            `;
        });
    } else {
        talesHtml = '<p>Сказки загружаются...</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📚</div>
                <h1 class="content-title">Терапевтические сказки</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics" style="margin-bottom: 20px;">
                    <button class="topic-btn" data-issue="страх">Страх</button>
                    <button class="topic-btn" data-issue="одиночество">Одиночество</button>
                    <button class="topic-btn" data-issue="уверенность">Уверенность</button>
                    <button class="topic-btn" data-issue="потеря">Потеря</button>
                    <button class="topic-btn" data-issue="любовь">Любовь</button>
                </div>
                <div id="taleContent"></div>
                <h3>📚 БИБЛИОТЕКА СКАЗОК</h3>
                <div id="talesList">
                    ${talesHtml}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const issue = btn.dataset.issue;
            showToast(`Ищу сказку на тему "${issue}"...`, 'info');
            const data = await apiCall(`/api/tale?issue=${issue}`);
            if (data.tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 Сказка</h3>
                        <div class="intervention-text">${data.tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    if (voiceManager) await voiceManager.textToSpeech(data.tale, currentMode);
                });
            }
        });
    });
    
    document.querySelectorAll('.tale-card').forEach(card => {
        card.addEventListener('click', async () => {
            const taleId = card.dataset.taleId;
            const tale = await getTaleById(taleId);
            if (tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 ${taleId}</h3>
                        <div class="intervention-text">${tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    if (voiceManager) await voiceManager.textToSpeech(tale, currentMode);
                });
            }
        });
    });
}

async function showAnchors() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю якоря...', 'info');
    
    const anchors = await getUserAnchors();
    
    let anchorsHtml = '';
    if (anchors && anchors.length) {
        anchors.forEach(anchor => {
            anchorsHtml += `
                <div class="anchor-card">
                    <div>
                        <div class="loop-type">${anchor.name}</div>
                        <div class="anchor-phrase">${anchor.phrase}</div>
                        <div class="loop-strength">Состояние: ${anchor.state}</div>
                    </div>
                    <button class="action-btn fire-anchor" data-name="${anchor.name}" style="padding: 6px 12px;">🔥 Активировать</button>
                </div>
            `;
        });
    } else {
        anchorsHtml = '<p>У вас пока нет якорей. Создайте свой первый якорь.</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">⚓</div>
                <h1 class="content-title">Мои якоря</h1>
            </div>
            <div class="content-body">
                <h3>📋 АКТИВНЫЕ ЯКОРЯ</h3>
                <div id="anchorsList">
                    ${anchorsHtml}
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>➕ СОЗДАТЬ НОВЫЙ ЯКОРЬ</h3>
                    <input type="text" id="anchorName" placeholder="Название якоря" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <input type="text" id="anchorState" placeholder="Состояние (например: спокойствие)" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <textarea id="anchorPhrase" placeholder="Фраза-якорь" rows="2" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; color: white;"></textarea>
                    <button class="action-btn primary-btn" id="createAnchorBtn">✨ СОЗДАТЬ</button>
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>💡 ПРЕДЛОЖЕННЫЕ ЯКОРЯ</h3>
                    <button class="action-btn" id="anchorCalmBtn" style="margin: 5px;">😌 Спокойствие</button>
                    <button class="action-btn" id="anchorConfidenceBtn" style="margin: 5px;">💪 Уверенность</button>
                    <button class="action-btn" id="anchorHereBtn" style="margin: 5px;">🧘 Здесь и сейчас</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.fire-anchor').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name;
            const phrase = await fireAnchor(name);
            if (phrase) {
                showToast(`Активирован якорь: ${phrase}`, 'success');
                if (voiceManager) await voiceManager.textToSpeech(phrase, currentMode);
            }
        });
    });
    
    document.getElementById('createAnchorBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('anchorName').value;
        const state = document.getElementById('anchorState').value;
        const phrase = document.getElementById('anchorPhrase').value;
        if (!name || !state || !phrase) {
            showToast('Заполните все поля', 'error');
            return;
        }
        const result = await setAnchor(name, state, phrase);
        if (result && result.success) {
            showToast('Якорь создан!', 'success');
            showAnchors();
        } else {
            showToast('Не удалось создать якорь', 'error');
        }
    });
    
    document.getElementById('anchorCalmBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('calm');
        showToast(`Якорь: ${phrase}`, 'success');
        if (voiceManager) await voiceManager.textToSpeech(phrase, currentMode);
    });
    
    document.getElementById('anchorConfidenceBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('confidence');
        showToast(`Якорь: ${phrase}`, 'success');
        if (voiceManager) await voiceManager.textToSpeech(phrase, currentMode);
    });
    
    document.getElementById('anchorHereBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('here');
        showToast(`Якорь: ${phrase}`, 'success');
        if (voiceManager) await voiceManager.textToSpeech(phrase, currentMode);
    });
}

async function showStatistics() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю статистику...', 'info');
    
    const stats = await getConfinementStatistics();
    const status = await getUserStatus();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Статистика</h1>
            </div>
            <div class="content-body">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_elements || 0}</div><div class="stat-label">Всего элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.active_elements || 0}</div><div class="stat-label">Активных элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.total_loops || 0}</div><div class="stat-label">Найдено петель</div></div>
                    <div class="stat-card"><div class="stat-value">${Math.round((stats.closure_score || 0) * 100)}%</div><div class="stat-label">Степень замыкания</div></div>
                </div>
                
                <div class="key-confinement" style="margin-top: 20px;">
                    <div class="key-title">${stats.is_system_closed ? '🔒 СИСТЕМА ЗАМКНУТА' : '🔓 СИСТЕМА ОТКРЫТА'}</div>
                    <div class="key-desc">${stats.is_system_closed ? 'Требуется работа с ключевыми элементами для разрыва петель' : 'Система готова к изменениям'}</div>
                </div>
                
                <div class="practice-card">
                    <h3>🧠 ПРОФИЛЬ</h3>
                    <div class="intervention-text">Код: ${status.profile_code || 'Не определен'}</div>
                    <div class="intervention-text">Тест: ${status.test_completed ? '✅ Пройден' : '⏳ Не пройден'}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}

// ========== UI ФУНКЦИИ ==========

function showToast(message, type = 'info') {
    const toast = document.getElementById('toastMessage');
    const textEl = document.getElementById('toastText');
    if (!toast || !textEl) return;
    textEl.textContent = message;
    toast.className = `floating-message ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
    const closeBtn = document.getElementById('toastClose');
    if (closeBtn) closeBtn.onclick = () => toast.style.display = 'none';
}

function addMessage(text, sender = 'bot', audioUrl = null) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    if (container.querySelector('.loading-screen')) container.innerHTML = '';
    let messagesContainer = container.querySelector('.chat-messages');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'chat-messages';
        container.appendChild(messagesContainer);
    }
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    const textSpan = document.createElement('div');
    textSpan.textContent = text;
    messageDiv.appendChild(textSpan);
    if (audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = audioUrl;
        messageDiv.appendChild(audio);
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ========== ОБРАБОТЧИКИ БЫСТРЫХ ДЕЙСТВИЙ ==========

async function handleShowProfile() {
    const profile = await getUserProfile();
    navigateTo('profile', { content: profile });
}

async function handleShowThoughts() {
    const thought = await getPsychologistThought();
    if (thought) navigateTo('thoughts', { content: thought });
    else showToast('Мысли психолога появятся после прохождения теста', 'info');
}

async function handleShowNewThought() {
    const newThought = await generateNewThought();
    if (newThought) navigateTo('thoughts', { content: newThought });
    else showToast('Не удалось сгенерировать мысль', 'error');
}

async function handleShowWeekend() {
    const ideas = await getWeekendIdeas();
    if (ideas.length) navigateTo('weekend', { content: ideas.map(i => i.description || i).join('\n\n') });
    else showToast('Идеи скоро появятся', 'info');
}

async function handleShowGoals() {
    const goals = await getUserGoals();
    if (goals.length) navigateTo('goals', { content: goals.map(g => `**${g.name}**\n⏱ ${g.time || '?'}  |  🎯 ${g.difficulty || 'medium'}\n${g.is_priority ? '🔐 Приоритетная цель' : ''}`).join('\n\n') });
    else showToast('Цели появятся после прохождения теста', 'info');
}

async function handleShowQuestions() {
    const questions = await getSmartQuestions();
    if (questions.length) navigateTo('questions', { content: questions.map((q, i) => `${i+1}. ${q}`).join('\n\n') });
    else showToast('Вопросы появятся после прохождения теста', 'info');
}

async function handleShowChallenges() {
    const challenges = await getChallenges();
    if (challenges.length) navigateTo('challenges', { content: challenges.map(c => `**${c.name}**\n${c.description}\n🎁 Награда: ${c.reward} очков`).join('\n\n') });
    else showToast('Челленджи появятся после прохождения теста', 'info');
}

async function handleShowDoubles() {
    const doubles = await findPsychometricDoubles();
    if (doubles.length) navigateTo('doubles', { content: doubles.map(d => `**${d.name}**\nПрофиль: ${d.profile_code}\nСхожесть: ${Math.round(d.similarity * 100)}%`).join('\n\n') });
    else showToast('Двойники появятся после прохождения теста', 'info');
}

// ========== ДАШБОРД ==========

function updateModeUI() {
    const config = MODES[currentMode];
    document.getElementById('modeLabel').textContent = config.name;
    document.getElementById('modeIndicator').style.background = config.color;
}

async function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    const config = MODES[mode];
    showToast(`Режим "${config.name}" активирован`, 'success');
    await apiCall('/api/save-mode', { method: 'POST', body: JSON.stringify({ user_id: CONFIG.USER_ID, mode }) });
    updateModeUI();
    renderDashboard();
    
    // Обновляем режим в голосовом менеджере
    if (voiceManager) {
        voiceManager.setMode(mode);
    }
}

function initMobileEnhancements() {
    if (window.innerWidth > 768) return;
    
    const container = document.getElementById('screenContainer');
    
    if (container) {
        let hasScrolled = false;
        
        container.addEventListener('scroll', () => {
            if (!hasScrolled && container.scrollTop > 50) {
                hasScrolled = true;
            }
        });
    }
    
    let isScrolling = false;
    const interactiveElements = document.querySelectorAll('.module-card, .quick-action, .mode-btn');
    
    container?.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(window.scrollEndTimer);
        window.scrollEndTimer = setTimeout(() => {
            isScrolling = false;
        }, 150);
    });
    
    interactiveElements.forEach(el => {
        el.addEventListener('click', (e) => {
            if (isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Подождите, скролл завершается...', 'info');
            }
        });
    });
}

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const chatsPanel = document.getElementById('chatsPanel');
    
    if (!mobileMenuBtn || !chatsPanel) return;
    
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatsPanel.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (chatsPanel.classList.contains('open')) {
            if (!chatsPanel.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                chatsPanel.classList.remove('open');
            }
        }
    });
    
    let touchStartX = 0;
    chatsPanel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });
    
    chatsPanel.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        if (touchEndX - touchStartX < -50) {
            chatsPanel.classList.remove('open');
        }
    });
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                chatsPanel.classList.remove('open');
            }
        });
    });
}

function renderDashboard() {
    const container = document.getElementById('screenContainer');
    const modeConfig = MODES[currentMode];
    const modules = MODULES[currentMode];
    
    container.innerHTML = `
        <div class="dashboard-container">
            <div class="hero-section">
                <div class="user-greeting">
                    <div class="greeting-text">
                        <h2>${modeConfig.emoji} ${modeConfig.greeting}</h2>
                        <p>${CONFIG.USER_NAME}, я здесь, чтобы помочь</p>
                    </div>
                    <div class="profile-badge">
                        <div class="profile-code" id="profileCode">${CONFIG.PROFILE_CODE || '🎭'}</div>
                        <div style="font-size: 10px;">ваш психотип</div>
                    </div>
                </div>
            </div>
            
            <div class="mode-selector">
                <button class="mode-btn ${currentMode === 'coach' ? 'active coach' : ''}" data-mode="coach">🔮 КОУЧ</button>
                <button class="mode-btn ${currentMode === 'psychologist' ? 'active psychologist' : ''}" data-mode="psychologist">🧠 ПСИХОЛОГ</button>
                <button class="mode-btn ${currentMode === 'trainer' ? 'active trainer' : ''}" data-mode="trainer">⚡ ТРЕНЕР</button>
            </div>
            
            <div class="voice-section">
                <div class="voice-card">
                    <button class="voice-record-btn-premium" id="mainVoiceBtn">
                        <span class="voice-icon">🎤</span>
                        <span class="voice-text">${modeConfig.voicePrompt}</span>
                    </button>
                    <div class="voice-hint" style="text-align: center; font-size: 11px; color: var(--text-secondary); margin-top: 8px;">🎙️ Нажмите и удерживайте для записи (до 60 сек)</div>
                </div>
            </div>
            
            <div class="swipe-indicator" id="swipeIndicator" style="display: none;">
                ↑ Свайпните вверх для просмотра ↑
            </div>
            
            <div class="modules-grid">
                ${modules.map(module => `
                    <div class="module-card" data-module="${module.id}">
                        <div class="module-icon">${module.icon}</div>
                        <div class="module-name">${module.name}</div>
                        <div class="module-desc">${module.desc}</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="quick-actions">
                <div class="quick-actions-title">⚡ Быстрые действия</div>
                <div class="quick-actions-grid">
                    <div class="quick-action" data-action="profile"><div class="action-icon">🧠</div><div class="action-name">Мой портрет</div></div>
                    <div class="quick-action" data-action="thoughts"><div class="action-icon">💭</div><div class="action-name">Мысли психолога</div></div>
                    <div class="quick-action" data-action="newThought"><div class="action-icon">✨</div><div class="action-name">Свежая мысль</div></div>
                    <div class="quick-action" data-action="weekend"><div class="action-icon">🎨</div><div class="action-name">Идеи на выходные</div></div>
                    <div class="quick-action" data-action="goals"><div class="action-icon">🎯</div><div class="action-name">Цели</div></div>
                    <div class="quick-action" data-action="questions"><div class="action-icon">❓</div><div class="action-name">Вопросы</div></div>
                    <div class="quick-action" data-action="challenges"><div class="action-icon">🏆</div><div class="action-name">Челленджи</div></div>
                    <div class="quick-action" data-action="doubles"><div class="action-icon">👥</div><div class="action-name">Двойники</div></div>
                </div>
            </div>
        </div>
    `;
    
    // Инициализируем голосовую кнопку с VoiceManager
    const voiceBtnElement = document.getElementById('mainVoiceBtn');
    if (voiceBtnElement && voiceManager) {
        setupVoiceButton(voiceBtnElement);
    }
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => { const mode = btn.dataset.mode; if (mode) switchMode(mode); });
    });
    
    // ========== ОБРАБОТЧИК МОДУЛЕЙ (ВКЛЮЧАЯ АНАЛИЗ) ==========
    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => { 
            const moduleId = card.dataset.module;
            const name = card.querySelector('.module-name')?.textContent;
            
            if (moduleId === 'analysis') {
                if (typeof openAnalysisScreen === 'function') {
                    openAnalysisScreen();
                } else {
                    showToast('📊 Модуль анализа загружается...', 'info');
                    const script = document.createElement('script');
                    script.src = 'analysis.js';
                    script.onload = () => openAnalysisScreen();
                    document.head.appendChild(script);
                }
            } else {
                showToast(`Модуль "${name}" — скоро будет доступен`, 'info');
            }
        });
    });
    
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', async () => {
            const actionType = action.dataset.action;
            switch(actionType) {
                case 'profile': await handleShowProfile(); break;
                case 'thoughts': await handleShowThoughts(); break;
                case 'newThought': await handleShowNewThought(); break;
                case 'weekend': await handleShowWeekend(); break;
                case 'goals': await handleShowGoals(); break;
                case 'questions': await handleShowQuestions(); break;
                case 'challenges': await handleShowChallenges(); break;
                case 'doubles': await handleShowDoubles(); break;
            }
        });
    });
    
    // ========== ДОБАВЛЕННЫЙ БЛОК ЗАПРОСА ИМЕНИ ==========
    setTimeout(async () => {
        try {
            const status = await getUserStatus();
            
            // Если у пользователя нет имени в localStorage и он не проходил тест
            if (!localStorage.getItem('fredi_user_name') && !status.has_profile) {
                const name = prompt('Как мне к вам обращаться?', '');
                if (name && name.trim()) {
                    setUserName(name);
                    // Обновляем отображение имени
                    const userNameEl = document.getElementById('userName');
                    if (userNameEl) userNameEl.textContent = name;
                    // Перерисовываем дашборд с новым именем
                    renderDashboard();
                }
            }
            
            // Обновляем отображение кода профиля
            const profileCodeEl = document.getElementById('profileCode');
            if (profileCodeEl) {
                if (status.has_profile && status.profile_code) {
                    profileCodeEl.textContent = status.profile_code;
                } else {
                    profileCodeEl.textContent = '🎭';
                    profileCodeEl.title = 'Пройдите тест, чтобы узнать свой психотип';
                }
            }
        } catch (e) {
            console.warn('Failed to load user status:', e);
        }
    }, 1500);
    // ========== КОНЕЦ ДОБАВЛЕННОГО БЛОКА ==========
    
    initMobileEnhancements();
}

// ========== НАСТРОЙКА ГОЛОСОВОЙ КНОПКИ ==========

function setupVoiceButton(buttonElement) {
    if (!buttonElement || !voiceManager) return;
    
    let pressTimer = null;
    const LONG_PRESS_DURATION = 150;
    
    const onPressStart = (e) => {
        e.preventDefault();
        
        pressTimer = setTimeout(() => {
            voiceManager.startRecording();
        }, LONG_PRESS_DURATION);
    };
    
    const onPressEnd = (e) => {
        e.preventDefault();
        
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        
        if (voiceManager.isRecordingActive()) {
            voiceManager.stopRecording();
        }
    };
    
    // События для мыши
    buttonElement.addEventListener('mousedown', onPressStart);
    buttonElement.addEventListener('mouseup', onPressEnd);
    buttonElement.addEventListener('mouseleave', onPressEnd);
    
    // События для касания (мобильные)
    buttonElement.addEventListener('touchstart', onPressStart, { passive: false });
    buttonElement.addEventListener('touchend', onPressEnd, { passive: false });
    buttonElement.addEventListener('touchcancel', onPressEnd, { passive: false });
    
    buttonElement.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Обновляем UI кнопки при изменении статуса
    voiceManager.onStatusChange = (status) => {
        const iconSpan = buttonElement.querySelector('.voice-icon');
        const textSpan = buttonElement.querySelector('.voice-text');
        
        switch(status) {
            case 'recording':
                buttonElement.classList.add('recording');
                if (iconSpan) iconSpan.textContent = '⏹️';
                if (textSpan) textSpan.textContent = 'Отпустите для отправки';
                break;
            case 'ai_speaking':
                buttonElement.style.border = '2px solid #ff6b3b';
                if (iconSpan) iconSpan.textContent = '🔊';
                break;
            case 'processing':
                if (iconSpan) iconSpan.textContent = '🔄';
                break;
            default:
                buttonElement.classList.remove('recording');
                buttonElement.style.border = '';
                if (iconSpan) iconSpan.textContent = '🎤';
                if (textSpan) textSpan.textContent = MODES[currentMode].voicePrompt;
                buttonElement.style.boxShadow = '';
        }
    };
    
    voiceManager.onVolumeChange = (volume) => {
        const intensity = volume / 100;
        buttonElement.style.boxShadow = `0 0 ${20 + intensity * 30}px rgba(255, 59, 59, ${0.3 + intensity * 0.5})`;
    };
}

// ========== ИНИЦИАЛИЗАЦИЯ ГОЛОСОВОГО МЕНЕДЖЕРА ==========

async function initVoice() {
    // Проверяем, загружен ли VoiceManager
    if (typeof VoiceManager === 'undefined') {
        console.error('VoiceManager not loaded! Make sure voice.js is included before app.js');
        return false;
    }
    
    voiceManager = new VoiceManager(CONFIG.USER_ID, {
        useWebSocket: true,
        apiBaseUrl: CONFIG.API_BASE_URL
    });
    
    // Настройка колбэков
    voiceManager.onTranscript = (text) => {
        addMessage(`🎤 "${text}"`, 'system');
    };
    
    voiceManager.onAIResponse = (answer) => {
        addMessage(answer, 'bot');
    };
    
    voiceManager.onError = (error) => {
        showToast(`❌ ${error}`, 'error');
    };
    
    voiceManager.onRecordingStart = () => {
        console.log('Recording started');
    };
    
    voiceManager.onRecordingStop = (audioBlob) => {
        console.log('Recording stopped', audioBlob?.size);
    };
    
    // Устанавливаем текущий режим
    voiceManager.setMode(currentMode);
    
    return true;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function init() {
    console.log('🚀 FREDI PREMIUM — полная версия с живым голосом');
    
    initMobileMenu();
    
    try {
        const status = await getUserStatus();
        if (status.profile_code) {
            const profileCodeEl = document.getElementById('profileCode');
            if (profileCodeEl) profileCodeEl.textContent = status.profile_code;
        }
    } catch (e) {}
    
    // Инициализируем голосовой менеджер
    await initVoice();
    
    renderDashboard();
    
    document.getElementById('userName').textContent = CONFIG.USER_NAME;
    document.getElementById('userMiniAvatar').textContent = CONFIG.USER_NAME.charAt(0);
    
    // Проверка микрофона
    setTimeout(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Microphone available');
        } catch (error) {
            console.log('Microphone permission not granted yet');
        }
    }, 1000);
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chat = item.dataset.chat;
            
            switch(chat) {
                case 'fredi':
                    renderDashboard();
                    break;
                case 'test':
                    if (window.Test && window.Test.start) {
                        window.Test.init(CONFIG.USER_ID);
                        window.Test.start();
                    } else {
                        console.error('Test module not loaded');
                        showToast('Тест загружается...', 'info');
                        const script = document.createElement('script');
                        script.src = '/test.js';
                        script.onload = () => {
                            window.Test.init(CONFIG.USER_ID);
                            window.Test.start();
                        };
                        document.head.appendChild(script);
                    }
                    break;
                case 'confinement':
                    navigateTo('confinement-model');
                    break;
                case 'practices':
                    navigateTo('practices');
                    break;
                case 'hypnosis':
                    navigateTo('hypnosis');
                    break;
                case 'tales':
                    navigateTo('tales');
                    break;
                case 'anchors':
                    navigateTo('anchors');
                    break;
                case 'statistics':
                    navigateTo('statistics');
                    break;
                default:
                    renderDashboard();
            }
            
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            if (window.innerWidth <= 768) {
                const chatsPanel = document.getElementById('chatsPanel');
                if (chatsPanel) chatsPanel.classList.remove('open');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
