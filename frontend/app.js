// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    API_BASE_URL: 'https://fredi-backend-flz2.onrender.com',

    // USER_ID: всегда числовой (localStorage + cookie fallback)
    get USER_ID() {
        let id = null;
        try { id = localStorage.getItem('fredi_user_id'); } catch(e){}
        if (!id || isNaN(parseInt(id))) {
            const m = document.cookie.match(/(?:^|; )fredi_uid=([^;]*)/);
            if (m) id = decodeURIComponent(m[1]);
        }
        if (!id || isNaN(parseInt(id))) {
            id = window.USER_ID || Date.now();
        }
        id = parseInt(id);
        try { localStorage.setItem('fredi_user_id', id); } catch(e){}
        document.cookie = 'fredi_uid=' + id + ';path=/;max-age=315360000;SameSite=Lax';
        return id;
    },

    get USER_NAME() {
        return localStorage.getItem('fredi_user_name') || 'друг';
    },

    PROFILE_CODE: null
};

window.CONFIG = CONFIG;

// ============================================
// ГЛОБАЛЬНАЯ ИДЕНТИФИКАЦИЯ ПОЛЬЗОВАТЕЛЯ
// Единая функция для всех модулей (mirrors, anchors, meter, test)
// ============================================
window.getUserId = function () {
    let userId = null;

    // 1. CONFIG.USER_ID — основной источник (localStorage + cookie + parseInt fallback)
    try {
        const cid = CONFIG?.USER_ID;
        if (cid && String(cid) !== 'null' && String(cid) !== 'undefined') userId = cid;
    } catch (e) {}

    // 2. PERMANENT_USER_ID (если где-то выставлен)
    if (!userId && window.PERMANENT_USER_ID && String(window.PERMANENT_USER_ID) !== 'null') {
        userId = window.PERMANENT_USER_ID;
    }

    // 3. window.USER_ID (legacy)
    if (!userId && window.USER_ID && String(window.USER_ID) !== 'null' && String(window.USER_ID) !== 'undefined') {
        userId = window.USER_ID;
    }

    // 4. localStorage fallbacks
    if (!userId) {
        try {
            const lsId = localStorage.getItem('fredi_user_id');
            if (lsId && lsId !== 'null' && lsId !== 'undefined') userId = lsId;
            if (!userId) {
                const permId = localStorage.getItem('fredi_permanent_user_id');
                if (permId && permId !== 'null') userId = permId;
            }
        } catch (e) {}
    }

    // 5. sessionStorage (переживает редиректы в Telegram WebView)
    if (!userId) {
        try {
            const ssId = sessionStorage.getItem('fredi_user_id');
            if (ssId && ssId !== 'null') userId = ssId;
        } catch (e) {}
    }

    // 6. Cookie
    if (!userId) {
        const m = document.cookie.match(/(?:^|; )fredi_uid=([^;]*)/);
        if (m) userId = decodeURIComponent(m[1]);
    }

    // 7. Крайний fallback — временный ID
    if (!userId || userId === 'null' || userId === 'undefined') {
        userId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        try { localStorage.setItem('fredi_user_id', userId); } catch (e) {}
        try { sessionStorage.setItem('fredi_user_id', userId); } catch (e) {}
        console.warn('⚠️ [Auth] Сгенерирован временный USER_ID:', userId);
    }

    // Синхронизация всех хранилищ (на случай приват-режима / sandbox)
    try { localStorage.setItem('fredi_user_id', userId); } catch (e) {}
    try { sessionStorage.setItem('fredi_user_id', userId); } catch (e) {}

    return userId;
};

console.log('✅ [Auth] window.getUserId инициализирован');

// Кроссбраузерное копирование в буфер обмена
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(el);
    el.select();
    try {
        document.execCommand('copy');
        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    } finally {
        document.body.removeChild(el);
    }
}

// ============================================
// РЕЖИМЫ
// ============================================

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

const MODULES = {
    coach: [
        { id: 'goals',      name: 'Цели',      icon: '🎯', desc: 'Постановка и достижение' },
        { id: 'habits',     name: 'Привычки',  icon: '🔄', desc: 'Формирование привычек' },
        { id: 'motivation', name: 'Мотивация', icon: '🔥', desc: 'Энергия для движения' },
        { id: 'strategy',   name: 'Стратегия', icon: '📊', desc: 'Стратегический план' }
    ],
    psychologist: [
        { id: 'analysis',  name: 'Анализ',     icon: '🧠', desc: 'Глубинные паттерны' },
        { id: 'emotions',  name: 'Эмоции',     icon: '💭', desc: 'Работа с чувствами' },
        { id: 'trauma',    name: 'Исцеление',  icon: '🕊️', desc: 'Проработка опыта' },
        { id: 'relations', name: 'Отношения',  icon: '💕', desc: 'Коммуникация' }
    ],
    trainer: [
        { id: 'skill_diagnosis', name: 'Диагностика навыков', icon: '🧠', desc: 'Анализ текущего уровня' },
        { id: 'skill_choice',    name: 'Выбор навыка',        icon: '🎯', desc: 'Выбор + 21-дневный план' },
        { id: 'daily_training',  name: 'Тренировка дня',      icon: '⚡', desc: 'Ежедневное задание' },
        { id: 'progress',        name: 'Прогресс',            icon: '📊', desc: 'Статистика + дневник' }
    ]
};

// ============================================
// СОСТОЯНИЕ
// ============================================

let currentMode = 'psychologist';
let navigationHistory = [];
let voiceManager = null;

// ============================================
// API
// ============================================

const _inflightRequests = new Map();

async function apiCall(endpoint, options = {}) {
    const method = options.method || 'GET';
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    const key = method + ':' + url;

    // Дедупликация GET-запросов
    if (method === 'GET' && _inflightRequests.has(key)) {
        return _inflightRequests.get(key);
    }

    // AI-эндпоинты генерируют ответ до 30-45 сек (DeepSeek/GPT), расширяем таймаут.
    const isAIEndpoint = /\/api\/(ai\/|ai_|hypno|dreams|emotions|tales|relationships|interests|doubles|weekend|brand|hormones|goals|habits|motivation|strategy|healing|confinement|skill|practices|challenges|psychologist|morning|freshthought|meditation|analysis)/i.test(endpoint);
    const defaultTimeout = isAIEndpoint ? 60000 : 15000;
    const timeoutMs = options.timeout || defaultTimeout;

    const promise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            clearTimeout(timeout);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            return data;
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                console.error(`API timeout (${timeoutMs}ms): ${endpoint}`);
                throw new Error('Сервер не отвечает. Попробуйте позже.');
            }
            console.error(`API Error: ${endpoint}`, error);
            throw error;
        }
    })().finally(() => {
        _inflightRequests.delete(key);
    });

    if (method === 'GET') {
        _inflightRequests.set(key, promise);
    }

    return promise;
}

async function isTestCompleted() {
    try {
        const data = await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
        return data.has_profile === true;
    } catch {
        return false;
    }
}

async function getUserStatus() {
    try {
        return await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
    } catch {
        return { has_profile: false, test_completed: false, profile_code: null, interpretation_ready: false };
    }
}

async function getPsychologistThought() {
    try {
        const data = await apiCall(`/api/psychologist-thought/${CONFIG.USER_ID}`);
        return data.thought;
    } catch { return null; }
}

async function generateNewThought() {
    try {
        const data = await apiCall('/api/psychologist-thoughts/generate', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID })
        });
        return data.thought;
    } catch { return null; }
}

// ===== ИДЕИ НА ВЫХОДНЫЕ с кэшем =====
function _cacheIdeas(userId, data) {
    try {
        localStorage.setItem('weekend_ideas_' + userId, JSON.stringify({
            data, generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString()
        }));
    } catch {}
}
function _loadCachedIdeas(userId) {
    try {
        const raw = localStorage.getItem('weekend_ideas_' + userId);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (new Date(cache.expiresAt) > new Date()) return cache.data;
    } catch {}
    return null;
}
async function getWeekendIdeas() {
    try {
        const data = await apiCall(`/api/ideas?user_id=${CONFIG.USER_ID}`);
        return data.ideas || [];
    } catch { return []; }
}

async function getUserProfile() {
    try {
        const data = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        return data.profile?.ai_generated_profile || 'Психологический портрет формируется.';
    } catch { return 'Профиль временно недоступен.'; }
}

async function getUserGoals() {
    try {
        const data = await apiCall(`/api/goals/with-confinement?user_id=${CONFIG.USER_ID}&mode=${currentMode}`);
        return data.goals || [];
    } catch { return []; }
}

async function getSmartQuestions() {
    try {
        const data = await apiCall(`/api/smart-questions?user_id=${CONFIG.USER_ID}`);
        return data.questions || [];
    } catch { return []; }
}

async function getChallenges() {
    try {
        const data = await apiCall(`/api/challenges?user_id=${CONFIG.USER_ID}`);
        return data.challenges || [];
    } catch { return []; }
}

async function getConfinementModel() {
    try { return await apiCall(`/api/confinement-model?user_id=${CONFIG.USER_ID}`); }
    catch { return null; }
}

async function getConfinementLoops() {
    try { return await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/loops`); }
    catch { return null; }
}

async function getIntervention(elementId) {
    try { return await apiCall(`/api/intervention/${elementId}?user_id=${CONFIG.USER_ID}`); }
    catch { return null; }
}

async function rebuildConfinementModel() {
    try { return await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/rebuild`, { method: 'POST' }); }
    catch { return null; }
}

async function getMorningPractice() {
    try { return (await apiCall('/api/practice/morning')).practice; }
    catch { return 'Утренняя практика: начните день с намерения. Сделайте 3 глубоких вдоха.'; }
}

async function getEveningPractice() {
    try { return (await apiCall('/api/practice/evening')).practice; }
    catch { return 'Вечерняя практика: вспомните три хороших события сегодня.'; }
}

async function getRandomExercise() {
    try { return (await apiCall('/api/practice/random-exercise')).exercise; }
    catch { return 'Сделайте паузу. Обратите внимание на своё дыхание. Повторите 5 раз.'; }
}

async function getRandomQuote() {
    try { return (await apiCall('/api/practice/random-quote')).quote; }
    catch { return '«Не в силе, а в правде.» — Андрей Мейстер'; }
}

async function processHypno(text, mode = currentMode) {
    try {
        return (await apiCall('/api/hypno/process', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, text, mode })
        })).response;
    } catch { return 'Сделайте глубокий вдох... Вы в безопасности... Дышите...'; }
}

async function getHypnoSupport(text = '') {
    try { return (await apiCall('/api/hypno/support', { method: 'POST', body: JSON.stringify({ text }) })).response; }
    catch { return 'Я здесь. Ты справляешься. Дыши спокойно.'; }
}

async function getTales() {
    try { return await apiCall('/api/tale'); }
    catch { return { success: false, available_tales: [] }; }
}

async function getTaleById(taleId) {
    try { return (await apiCall(`/api/tale/${taleId}`)).tale; }
    catch { return null; }
}


async function getConfinementStatistics() {
    try { return (await apiCall(`/api/confinement/statistics/${CONFIG.USER_ID}`)).statistics; }
    catch { return { total_elements: 0, active_elements: 0, total_loops: 0, is_system_closed: false, closure_score: 0 }; }
}

// ============================================
// UI ФУНКЦИИ
// ============================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toastMessage');
    const textEl = document.getElementById('toastText');
    if (!toast || !textEl) return;
    textEl.textContent = message;
    toast.className = `floating-message ${type}`;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
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

// Глобальный флаг против двойных нажатий
let _isLoading = false;

function showLoading(message, subtext) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    _isLoading = true;
    const existing = container.querySelector('.fredi-loader-wrap');
    if (existing) {
        const txt = existing.querySelector('.fredi-loader-msg');
        const sub = existing.querySelector('.fredi-loader-sub');
        if (txt) txt.textContent = message || 'Загружаю...';
        if (sub && subtext) sub.textContent = subtext;
        return;
    }
    container.innerHTML = `
        <div class="fredi-loader-wrap">
            <div class="fredi-loader-inner">
                <div class="fredi-loader-ring">
                    <div class="fredi-loader-dot"></div>
                    <div class="fredi-loader-dot"></div>
                    <div class="fredi-loader-dot"></div>
                    <div class="fredi-loader-dot"></div>
                </div>
                <div class="fredi-loader-emoji">🧠</div>
                <div class="fredi-loader-msg">${message || 'Загружаю...'}</div>
                <div class="fredi-loader-sub">${subtext || 'Обычно это занимает несколько секунд'}</div>
            </div>
        </div>
        <style>
            .fredi-loader-wrap { display:flex; align-items:center; justify-content:center; min-height:60vh; padding:40px 20px; }
            .fredi-loader-inner { text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; }
            .fredi-loader-ring { position:relative; width:64px; height:64px; }
            .fredi-loader-dot { position:absolute; width:12px; height:12px; border-radius:50%; background:#ff6b3b; animation:loaderOrbit 1.4s ease-in-out infinite; }
            .fredi-loader-dot:nth-child(1){animation-delay:0s}
            .fredi-loader-dot:nth-child(2){animation-delay:0.35s}
            .fredi-loader-dot:nth-child(3){animation-delay:0.7s}
            .fredi-loader-dot:nth-child(4){animation-delay:1.05s}
            @keyframes loaderOrbit { 0%{transform:rotate(0deg) translateX(26px) scale(1);opacity:1} 50%{transform:rotate(180deg) translateX(26px) scale(0.6);opacity:0.4} 100%{transform:rotate(360deg) translateX(26px) scale(1);opacity:1} }
            .fredi-loader-emoji { font-size:32px; margin-top:4px; animation:loaderPulse 2s ease-in-out infinite; }
            @keyframes loaderPulse { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.1);opacity:1} }
            .fredi-loader-msg { font-size:15px; font-weight:600; color:#e0e0e0; margin-top:4px; }
            .fredi-loader-sub { font-size:12px; color:rgba(255,255,255,0.35); max-width:240px; line-height:1.5; }
        </style>
    `;
}

function hideLoading() { _isLoading = false; }

function lockBtn(el, ms) {
    if (!el) return;
    el.disabled = true; el.style.opacity = '0.5'; el.style.pointerEvents = 'none';
    setTimeout(() => { el.disabled = false; el.style.opacity = ''; el.style.pointerEvents = ''; }, ms || 3000);
}

// ============================================
// НАВИГАЦИЯ
// ============================================

function navigateBack() {
    if (navigationHistory.length > 0) {
        navigationHistory.pop();
    }
    renderDashboard();
}

function navigateTo(screen, params = {}) {
    navigationHistory.push({ screen, params });

    switch (screen) {
        case 'confinement-model': showConfinementModel(); break;
        case 'confinement-loops': showConfinementLoops(params); break;
        case 'intervention': showIntervention(params); break;
        case 'practices': if (typeof showPracticesScreen==='function') showPracticesScreen(); else { const s=document.createElement('script');s.src='practices.js';s.onload=()=>{if(typeof showPracticesScreen==='function')showPracticesScreen();};s.onerror=()=>{showToast('Не удалось загрузить модуль','error');};document.head.appendChild(s); } break;
        case 'hypnosis': if (typeof showHypnosisScreen==='function') showHypnosisScreen(); else { const s=document.createElement('script');s.src='hypnosis.js';s.onload=()=>{if(typeof showHypnosisScreen==='function')showHypnosisScreen();};s.onerror=()=>{showToast('Не удалось загрузить модуль','error');};document.head.appendChild(s); } break;
        case 'tales': if (typeof showTalesScreen==='function') showTalesScreen(); else { const s=document.createElement('script'); s.src='tales.js'; s.onload=()=>{ if(typeof showTalesScreen==='function') showTalesScreen(); }; s.onerror=()=>{showToast('Не удалось загрузить модуль','error');}; document.head.appendChild(s); } break;
        case 'anchors': if (typeof showAnchorsScreen==='function') showAnchorsScreen(); else { const s=document.createElement('script');s.src='anchors.js';s.onload=()=>{if(typeof showAnchorsScreen==='function')showAnchorsScreen();};s.onerror=()=>{showToast('Не удалось загрузить модуль','error');};document.head.appendChild(s); } break;
        case 'dreams': if (typeof showDreamsScreen==='function') showDreamsScreen(); else { const s=document.createElement('script');s.src='dreams.js';s.onload=()=>{if(typeof showDreamsScreen==='function')showDreamsScreen();};s.onerror=()=>{showToast('Не удалось загрузить модуль','error');};document.head.appendChild(s); } break;
        case 'esoterica': if (typeof showEsotericaScreen==='function') showEsotericaScreen(); else { const s=document.createElement('script');s.src='esoterica.js';s.onload=()=>{if(typeof showEsotericaScreen==='function')showEsotericaScreen();};s.onerror=()=>{showToast('Не удалось загрузить модуль','error');};document.head.appendChild(s); } break;
        case 'statistics': showStatistics(); break;
        case 'analysis':
            if (typeof openAnalysisScreen === 'function') {
                openAnalysisScreen();
            } else {
                showToast('Анализ загружается...', 'info');
                const s = document.createElement('script');
                s.src = 'analysis.js';
                s.onload = () => openAnalysisScreen();
                s.onerror = () => { showToast('Не удалось загрузить модуль', 'error'); };
                document.head.appendChild(s);
            }
            break;
        case 'profile':
        case 'thoughts':
        case 'weekend':
        case 'goals':
        case 'questions':
        case 'challenges':
        case 'doubles':
            showFullContentScreen(params.title || screen, params.content, screen);
            break;
        default:
            renderDashboard();
    }
}

// ============================================
// ЗАПУСК ТЕСТА
// ============================================

function startTest() {
    if (window.Test && window.Test.start) {
        if (window.Test.init) window.Test.init(CONFIG.USER_ID);
        window.Test.start();
    } else {
        showToast('📊 Тест загружается...', 'info');
        const script = document.createElement('script');
        script.src = 'test.js';
        script.onload = () => {
            if (window.Test && window.Test.init) window.Test.init(CONFIG.USER_ID);
            if (window.Test && window.Test.start) window.Test.start();
        };
        script.onerror = () => showToast('❌ Не удалось загрузить тест', 'error');
        document.head.appendChild(script);
    }
}

// ============================================
// КОНТЕНТНЫЕ ЭКРАНЫ
// ============================================

// Очищает технический мусор из текста профиля/мыслей с бэкенда
function cleanBackendText(text) {
    if (!text) return '';
    return text
        .replace(/^-{2,}$/gm, '')
        .replace(/🧠\s*AI-СГЕНЕРИРОВАННЫЙ\s*ПРОФИЛЬ\s*:?\s*/gi, '')
        .replace(/^Профиль:\s*[\w\-_]+\s*$/gm, '')
        .replace(/^Тип восприятия:\s*.+$/gm, '')
        .replace(/^Уровень мышления:\s*.+$/gm, '')
        .replace(/^🧠 Глубинный паттерн:\s*.+$/gm, '')
        .replace(/📊 ВАШИ ВЕКТОРЫ:[\s\S]*?(?=🔑|💪|🎯|🌱|⚠️|$)/u, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatContentForDisplay(text) {
    if (!text) return '<p>Нет данных</p>';

    let t = text;

    // Жирный текст **...**
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Нормализуем буллиты — если • стоит не в начале строки,
    // вставляем перенос перед ним чтобы он стал отдельной строкой-элементом
    t = t.replace(/([^\n])\s*•\s+/g, '$1\n• ');

    const lines = t.split('\n');
    let out = '';
    let inList = false;
    let inParagraph = false;

    function isEmojiHeading(line) {
        return /^(🔑|💪|🎯|🌱|⚠️|⚠|📊|🔍|🧠|⚡|🔐|🔗|📌|💡|🌟|🏆|👁|🎨|📖|🤝|💰|🌿|🔄|🔮|📍|🎭)/.test(line);
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            if (inList)      { out += '</ul>\n'; inList = false; }
            if (inParagraph) { out += '</p>\n'; inParagraph = false; }
            continue;
        }

        // Эмодзи-заголовок
        if (isEmojiHeading(line)) {
            if (inList)      { out += '</ul>\n'; inList = false; }
            if (inParagraph) { out += '</p>\n'; inParagraph = false; }
            out += '<div class="profile-section-title">' + line + '</div>\n';
            continue;
        }

        // Элемент списка (•, *, -, нумерованный)
        if (/^[•*\-]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
            if (inParagraph) { out += '</p>\n'; inParagraph = false; }
            if (!inList) { out += '<ul class="styled-list">\n'; inList = true; }
            const itemText = line.replace(/^[•*\-]\s+/, '').replace(/^\d+\.\s+/, '');
            out += '<li>' + itemText + '</li>\n';
            continue;
        }

        // Обычный текст
        if (inList) { out += '</ul>\n'; inList = false; }
        if (!inParagraph) { out += '<p>'; inParagraph = true; }
        else out += ' ';
        out += line;
    }

    if (inList)      out += '</ul>';
    if (inParagraph) out += '</p>';

    return out || '<p>Нет данных</p>';
}

// Специальный форматтер для AI-профиля — красивые карточки секций
function formatProfileForDisplay(text) {
    if (!text) return '<p>Нет данных</p>';

    const sectionEmojis = {
        '🔑': { title: 'КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА', color: '#ff6b3b' },
        '💪': { title: 'СИЛЬНЫЕ СТОРОНЫ',          color: '#4caf50' },
        '🎯': { title: 'ЗОНЫ РОСТА',               color: '#2196f3' },
        '🌱': { title: 'КАК ЭТО СФОРМИРОВАЛОСЬ',   color: '#9c27b0' },
        '⚠️': { title: 'ГЛАВНАЯ ЛОВУШКА',          color: '#ff9800' },
        '⚠':  { title: 'ГЛАВНАЯ ЛОВУШКА',          color: '#ff9800' },
    };

    const lines = text.split('\n');
    let out = '';
    let currentSection = null;
    let sectionContent = [];

    function flushSection() {
        if (!currentSection) return;
        const cfg = Object.entries(sectionEmojis).find(([e]) => currentSection.startsWith(e));
        const color = cfg ? cfg[1].color : '#e0e0e0';

        // Форматируем содержимое секции
        let contentHTML = '';
        let inList = false;
        for (const line of sectionContent) {
            const l = line.trim();
            if (!l) continue;
            if (/^[•*\-]\s+/.test(l)) {
                if (!inList) { contentHTML += '<ul class="profile-list">'; inList = true; }
                contentHTML += '<li>' + l.replace(/^[•*\-]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</li>';
            } else {
                if (inList) { contentHTML += '</ul>'; inList = false; }
                contentHTML += '<p>' + l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</p>';
            }
        }
        if (inList) contentHTML += '</ul>';

        out += `
        <div class="profile-card" style="border-left: 3px solid ${color}">
            <div class="profile-card-header" style="color: ${color}">${currentSection}</div>
            <div class="profile-card-body">${contentHTML}</div>
        </div>`;

        currentSection = null;
        sectionContent = [];
    }

    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;

        const isSection = Object.keys(sectionEmojis).some(e => l.startsWith(e));
        if (isSection) {
            flushSection();
            currentSection = l;
        } else if (currentSection) {
            sectionContent.push(l);
        } else {
            // Текст до первой секции — вводная часть
            out += '<p class="profile-intro">' + l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</p>';
        }
    }
    flushSection();

    return out || '<p>Нет данных</p>';
}

function showFullContentScreen(title, content, contentType) {
    const container = document.getElementById('screenContainer');
    const emojiMap = {
        profile: '🧠', thoughts: '💭', goals: '🎯', questions: '❓',
        challenges: '🏆', doubles: '👥', weekend: '🎨', confinement: '🔐',
        practices: '🧘', hypnosis: '🌀', tales: '🧿', anchors: '⚓', dreams: '🌙', confinement: '🔐'
    };
    // Если content — уже HTML (содержит теги) — не прогоняем через форматтер
    const isHTML = typeof content === 'string' && /<[a-z][\s\S]*>/i.test(content);
    const formattedContent = isHTML
        ? content
        : (typeof content === 'string' ? formatContentForDisplay(content) : (content || '<p>Нет данных</p>'));

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${emojiMap[contentType] || '📄'}</div>
                <h1 class="content-title">${title}</h1>
            </div>
            <div class="content-body">${formattedContent}</div>
        </div>
    `;

    document.getElementById('backBtn').onclick = () => renderDashboard();
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМА
// ============================================

function updateModeUI() {
    const config = MODES[currentMode];
    const label = document.getElementById('modeLabel');
    const indicator = document.getElementById('modeIndicator');
    if (label) label.textContent = config.name;
    if (indicator) indicator.style.background = config.color;
}

async function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    const config = MODES[mode];
    showToast(`Режим "${config.name}" активирован`, 'success');
    updateModeUI();
    if (voiceManager && voiceManager.setMode) voiceManager.setMode(mode);
    try {
        await apiCall('/api/save-mode', { method: 'POST', body: JSON.stringify({ user_id: CONFIG.USER_ID, mode }) });
    } catch (e) { console.warn('Failed to save mode:', e); }
    renderDashboard();
}

// ============================================
// ОБРАБОТЧИКИ БЫСТРЫХ ДЕЙСТВИЙ
// ============================================

async function handleShowProfile() {
    showLoading('Загружаю психологический портрет...');
    try {
        const data = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        const profile = data.profile || {};

        const code  = profile.display_name || '';
        const type  = profile.perception_type || '';
        const lvl   = profile.thinking_level || '';
        const bl    = profile.behavioral_levels || {};
        const avg   = arr => Array.isArray(arr) ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : (arr||'?');
        const sb = avg(bl['СБ']), tf = avg(bl['ТФ']), ub = avg(bl['УБ']), cv = avg(bl['ЧВ']);

        // Шапка с мета-данными
        let meta = '<div class="profile-meta-block">';
        if (code)  meta += `<div class="profile-meta-row"><span class="profile-meta-label">Профиль</span><span class="profile-meta-value">${code.replace(/_/g,' · ')}</span></div>`;
        if (type)  meta += `<div class="profile-meta-row"><span class="profile-meta-label">Восприятие</span><span class="profile-meta-value">${type}</span></div>`;
        if (lvl)   meta += `<div class="profile-meta-row"><span class="profile-meta-label">Мышление</span><span class="profile-meta-value">${lvl}/9</span></div>`;
        if (bl['СБ']) meta += `<div class="profile-vectors-row"><span class="profile-vector">СБ ${sb}/6</span><span class="profile-vector">ТФ ${tf}/6</span><span class="profile-vector">УБ ${ub}/6</span><span class="profile-vector">ЧВ ${cv}/6</span></div>`;
        meta += '</div>';

        const rawAI   = profile.ai_generated_profile || '';
        const cleanAI = rawAI ? cleanBackendText(rawAI) : '';
        const bodyHTML = cleanAI ? formatProfileForDisplay(cleanAI) : '<p class="profile-forming">🔄 Психологический портрет формируется...</p>';

        showFullContentScreen('Психологический портрет', meta + bodyHTML, 'profile');
    } catch {
        showFullContentScreen('Психологический портрет', 'Профиль временно недоступен.', 'profile');
    }
}

async function handleShowThoughts() {
    showLoading('Загружаю мысли психолога...');
    const thought = await getPsychologistThought();
    if (!thought) { showToast('Мысли психолога появятся после прохождения теста', 'info'); return; }
    const clean = thought
        .replace(/^-{2,}$/gm, '')
        .replace(/🧠\s*МЫСЛИ ПСИХОЛОГА\s*:?\s*/gi, '')
        .replace(/^###\s*\d+\.?\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    showFullContentScreen('Мысли психолога', formatContentForDisplay(clean), 'thoughts');
}

// handleShowNewThought → делегируем в freshthought.js
async function handleShowNewThought() {
    if (typeof showFreshThoughtScreen === 'function') {
        showFreshThoughtScreen();
    } else {
        const s = document.createElement('script');
        s.src = 'freshthought.js';
        s.onload = () => { if (typeof showFreshThoughtScreen === 'function') showFreshThoughtScreen(); };
        s.onerror = () => { showToast('Не удалось загрузить модуль', 'error'); };
        document.head.appendChild(s);
    }
}

// handleShowWeekend → делегируем в weekend.js
async function handleShowWeekend() {
    if (typeof showWeekendScreen === 'function') {
        showWeekendScreen();
    } else {
        showToast('🎨 Загрузка...', 'info');
        const s = document.createElement('script');
        s.src = 'weekend.js';
        s.onload = () => { if (typeof showWeekendScreen === 'function') showWeekendScreen(); };
        s.onerror = () => { showToast('Не удалось загрузить модуль', 'error'); };
        document.head.appendChild(s);
    }
}

async function handleShowGoals() {
    showLoading('Загружаю цели...');
    const goals = await getUserGoals();
    if (goals.length) showFullContentScreen('🎯 Ваши цели', goals.map(g => `**${g.name}**\n⏱ ${g.time || '?'}  |  🎯 ${g.difficulty || 'medium'}`).join('\n\n'), 'goals');
    else showToast('Цели появятся после прохождения теста', 'info');
}

async function handleShowQuestions() {
    showLoading('Подбираю вопросы...');
    const questions = await getSmartQuestions();
    if (questions.length) showFullContentScreen('❓ Вопросы для размышления', questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n'), 'questions');
    else showToast('Вопросы появятся после прохождения теста', 'info');
}

async function handleShowChallenges() {
    showLoading('Загружаю челленджи...');
    const challenges = await getChallenges();
    if (challenges.length) showFullContentScreen('🏆 Челленджи', challenges.map(c => `**${c.name}**\n${c.description}\n🎁 Награда: ${c.reward} очков`).join('\n\n'), 'challenges');
    else showToast('Челленджи появятся после прохождения теста', 'info');
}

async function handleShowDoubles() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест', 'info');
        // Показываем предложение пройти тест без нативного confirm()
        showFullContentScreen('👥 Двойники', '**Для поиска двойников нужен психологический профиль.**\n\nПройдите тест — это займёт около 15 минут.', 'doubles');
        const container = document.getElementById('screenContainer');
        if (container) {
            const btn = document.createElement('button');
            btn.className = 'back-btn';
            btn.style.background = 'linear-gradient(135deg, #ff6b3b, #ff3b3b)';
            btn.style.color = 'white';
            btn.style.marginTop = '16px';
            btn.textContent = '📊 Пройти тест';
            btn.onclick = startTest;
            const body = container.querySelector('.content-body');
            if (body) body.appendChild(btn);
        }
        return;
    }

    if (typeof showDoublesScreen === 'function') {
        showDoublesScreen();
    } else {
        showToast('👥 Загрузка модуля двойников...', 'info');
        const script = document.createElement('script');
        script.src = 'doubles.js';
        script.onload = () => {
            if (typeof showDoublesScreen === 'function') showDoublesScreen();
            else showToast('❌ Ошибка загрузки модуля', 'error');
        };
        script.onerror = () => showToast('❌ Не удалось загрузить модуль', 'error');
        document.head.appendChild(script);
    }
}

// ============================================
// РАЗДЕЛЫ МЕНЮ
// ============================================

async function showConfinementModel() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю модель ограничений...', 'info');

    const model = await getConfinementModel();
    if (!model) {
        showFullContentScreen('🔐 Модель ограничений', 'Не удалось загрузить модель. Попробуйте позже.', 'confinement');
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
                    </div>`;
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
                </div>`;
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
            </div>`;
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
                <div class="elements-grid">${elementsHtml || '<p>Нет данных об элементах</p>'}</div>
                ${loopsHtml}
                <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="action-btn" id="loopsBtn">🔄 Все петли</button>
                    <button class="action-btn" id="rebuildModelBtn">🔄 Перестроить модель</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('backBtn').onclick = () => renderDashboard();
    document.getElementById('loopsBtn')?.addEventListener('click', () => showConfinementLoops({ model }));
    document.getElementById('rebuildModelBtn')?.addEventListener('click', async () => {
        showToast('Перестраиваю модель...', 'info');
        const result = await rebuildConfinementModel();
        if (result && result.success) { showToast('Модель перестроена', 'success'); showConfinementModel(); }
        else showToast('Не удалось перестроить модель', 'error');
    });
    document.getElementById('keyConfinementInterventionBtn')?.addEventListener('click', () => {
        if (model.key_confinement?.element) showIntervention({ elementId: model.key_confinement.element.id });
    });
}

async function showConfinementLoops(params) {
    const container = document.getElementById('screenContainer');
    showToast('Анализирую петли...', 'info');
    const loopsData = await getConfinementLoops();

    let loopsHtml = '';
    if (loopsData?.loops?.length) {
        loopsData.loops.forEach((loop, idx) => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">🔄 ПЕТЛЯ ${idx + 1}: ${loop.type || 'Цикл'}</div>
                    <div class="loop-desc" style="margin: 8px 0;">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                    ${loop.elements ? `<div class="loop-strength">Элементы: ${loop.elements.join(' → ')}</div>` : ''}
                </div>`;
        });
    } else {
        loopsHtml = '<p>Петли не обнаружены</p>';
    }

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">🔄</div><h1 class="content-title">Петли системы</h1></div>
            <div class="content-body">${loopsHtml}</div>
        </div>`;
    document.getElementById('backBtn').onclick = () => renderDashboard();
}

async function showIntervention(params) {
    const elementId = params.elementId;
    const container = document.getElementById('screenContainer');
    showToast('Загружаю интервенцию...', 'info');
    const intervention = await getIntervention(elementId);

    let html = '';
    if (intervention?.element) {
        html += `<div class="key-confinement" style="margin-bottom: 20px;">
            <div class="key-title">🧠 ЭЛЕМЕНТ ${intervention.element.id}: ${intervention.element.name || 'Неизвестно'}</div>
            <div class="key-desc">${intervention.element.description || ''}</div>
        </div>`;
    }
    if (intervention?.intervention) html += `<div class="intervention-card"><h3>💡 ЧТО ДЕЛАТЬ</h3><div class="intervention-text">${intervention.intervention.description || intervention.intervention}</div></div>`;
    if (intervention?.daily_practice) html += `<div class="daily-practice"><h3>📝 ЕЖЕДНЕВНАЯ ПРАКТИКА</h3><div class="intervention-text">${intervention.daily_practice}</div></div>`;
    if (intervention?.week_program) html += `<div class="daily-practice"><h3>📅 НЕДЕЛЬНАЯ ПРОГРАММА</h3><div class="intervention-text">${intervention.week_program}</div></div>`;
    if (intervention?.random_quote) html += `<div class="quote-card"><div>${intervention.random_quote}</div></div>`;

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">💡</div><h1 class="content-title">Интервенция</h1></div>
            <div class="content-body">
                ${html}
                <button class="action-btn primary-btn" id="speakInterventionBtn" style="margin-top: 16px;">🔊 Озвучить</button>
            </div>
        </div>`;
    document.getElementById('backBtn').onclick = () => renderDashboard();
    document.getElementById('speakInterventionBtn')?.addEventListener('click', async () => {
        const text = (intervention?.intervention?.description || '') + ' ' + (intervention?.daily_practice || '');
        if (voiceManager) await voiceManager.textToSpeech(text, currentMode);
    });
}

async function showPractices() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю практики...', 'info');
    const [morning, evening, exercise, quote] = await Promise.all([getMorningPractice(), getEveningPractice(), getRandomExercise(), getRandomQuote()]);

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">🧘</div><h1 class="content-title">Практики</h1></div>
            <div class="content-body">
                <div class="practice-card"><h3>🌅 УТРЕННЯЯ ПРАКТИКА</h3><div class="intervention-text" id="morningText">${morning}</div><button class="action-btn" id="speakMorningBtn" style="margin-top:12px">🔊 Озвучить</button></div>
                <div class="practice-card"><h3>🌙 ВЕЧЕРНЯЯ ПРАКТИКА</h3><div class="intervention-text" id="eveningText">${evening}</div><button class="action-btn" id="speakEveningBtn" style="margin-top:12px">🔊 Озвучить</button></div>
                <div class="practice-card"><h3>🎲 СЛУЧАЙНОЕ УПРАЖНЕНИЕ</h3><div class="intervention-text" id="exerciseText">${exercise}</div><button class="action-btn" id="newExerciseBtn" style="margin-top:12px">🔄 Другое</button><button class="action-btn" id="speakExerciseBtn" style="margin-top:12px">🔊 Озвучить</button></div>
                <div class="quote-card"><h3>📖 ЦИТАТА ДНЯ</h3><div class="intervention-text" id="quoteText" style="font-style:italic">${quote}</div><button class="action-btn" id="newQuoteBtn" style="margin-top:12px">🔄 Другая</button><button class="action-btn" id="speakQuoteBtn" style="margin-top:12px">🔊 Озвучить</button></div>
            </div>
        </div>`;

    document.getElementById('backBtn').onclick = () => renderDashboard();
    document.getElementById('speakMorningBtn')?.addEventListener('click', async () => { if (voiceManager) await voiceManager.textToSpeech(document.getElementById('morningText').textContent, currentMode); });
    document.getElementById('speakEveningBtn')?.addEventListener('click', async () => { if (voiceManager) await voiceManager.textToSpeech(document.getElementById('eveningText').textContent, currentMode); });
    document.getElementById('newExerciseBtn')?.addEventListener('click', async () => { document.getElementById('exerciseText').textContent = await getRandomExercise(); });
    document.getElementById('newQuoteBtn')?.addEventListener('click', async () => { document.getElementById('quoteText').textContent = await getRandomQuote(); });
}

async function showHypnosis() {
    const container = document.getElementById('screenContainer');

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">🌀</div><h1 class="content-title">Гипноз</h1></div>
            <div class="content-body">
                <div class="hypno-topics">
                    <button class="topic-btn" data-topic="тревога">Тревога</button>
                    <button class="topic-btn" data-topic="уверенность">Уверенность</button>
                    <button class="topic-btn" data-topic="спокойствие">Спокойствие</button>
                    <button class="topic-btn" data-topic="сон">Сон</button>
                    <button class="topic-btn" data-topic="вдохновение">Вдохновение</button>
                </div>
                <textarea class="hypno-input" id="hypnoInput" rows="3" placeholder="Напишите, что вас беспокоит..."></textarea>
                <button class="action-btn primary-btn" id="processHypnoBtn">🌀 Получить гипнотический ответ</button>
                <div id="hypnoResponse" style="margin-top:20px"></div>
                <div class="practice-card" style="margin-top:20px">
                    <h3>🎧 ПОДДЕРЖКА</h3>
                    <button class="action-btn" id="supportBtn">Получить поддерживающий ответ</button>
                    <div id="supportResponse" style="margin-top:12px"></div>
                </div>
            </div>
        </div>`;

    document.getElementById('backBtn').onclick = () => renderDashboard();

    const renderHypnoResponse = (containerId, response) => {
        document.getElementById(containerId).innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${response}</div>
                <button class="action-btn speak-btn">🔊 Озвучить</button>
            </div>`;
        document.getElementById(containerId).querySelector('.speak-btn')?.addEventListener('click', async () => {
            if (voiceManager) await voiceManager.textToSpeech(response, currentMode);
        });
    };

    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const input = document.getElementById('hypnoInput');
            input.value = `Я чувствую ${btn.dataset.topic}`;
            const response = await processHypno(input.value);
            renderHypnoResponse('hypnoResponse', response);
        });
    });

    document.getElementById('processHypnoBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('hypnoInput').value;
        if (!input.trim()) { showToast('Напишите, что вас беспокоит', 'info'); return; }
        showToast('Формирую гипнотический ответ...', 'info');
        renderHypnoResponse('hypnoResponse', await processHypno(input));
    });

    document.getElementById('supportBtn')?.addEventListener('click', async () => {
        renderHypnoResponse('supportResponse', await getHypnoSupport());
    });
}

// Переименована чтобы не конфликтовать с функцией getTales (API)
async function showTales_screen() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю библиотеку сказок...', 'info');
    const talesData = await getTales();
    const talesList = talesData.available_tales || [];

    const talesHtml = talesList.length
        ? talesList.map(tale => `<div class="tale-card" data-tale-id="${tale}"><div class="loop-type">📖 ${tale}</div><div class="loop-desc">Терапевтическая сказка</div></div>`).join('')
        : '<p>Сказки загружаются...</p>';

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">📚</div><h1 class="content-title">Терапевтические сказки</h1></div>
            <div class="content-body">
                <div class="hypno-topics" style="margin-bottom:20px">
                    <button class="topic-btn" data-issue="страх">Страх</button>
                    <button class="topic-btn" data-issue="одиночество">Одиночество</button>
                    <button class="topic-btn" data-issue="уверенность">Уверенность</button>
                    <button class="topic-btn" data-issue="потеря">Потеря</button>
                    <button class="topic-btn" data-issue="любовь">Любовь</button>
                </div>
                <div id="taleContent"></div>
                <h3>📚 БИБЛИОТЕКА СКАЗОК</h3>
                <div id="talesList">${talesHtml}</div>
            </div>
        </div>`;

    document.getElementById('backBtn').onclick = () => renderDashboard();

    const renderTale = (title, text) => {
        document.getElementById('taleContent').innerHTML = `
            <div class="intervention-card">
                <h3>📖 ${title}</h3>
                <div class="intervention-text">${text}</div>
                <button class="action-btn speak-tale-btn">🔊 Озвучить</button>
            </div>`;
        document.querySelector('.speak-tale-btn')?.addEventListener('click', async () => {
            if (voiceManager) await voiceManager.textToSpeech(text, currentMode);
        });
    };

    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            showToast(`Ищу сказку на тему "${btn.dataset.issue}"...`, 'info');
            const data = await apiCall(`/api/tale?issue=${btn.dataset.issue}`);
            if (data.tale) renderTale('Сказка', data.tale);
        });
    });

    document.querySelectorAll('.tale-card').forEach(card => {
        card.addEventListener('click', async () => {
            const tale = await getTaleById(card.dataset.taleId);
            if (tale) renderTale(card.dataset.taleId, tale);
        });
    });
}


async function showStatistics() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю статистику...', 'info');
    const [stats, status] = await Promise.all([getConfinementStatistics(), getUserStatus()]);

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">📊</div><h1 class="content-title">Статистика</h1></div>
            <div class="content-body">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_elements || 0}</div><div class="stat-label">Всего элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.active_elements || 0}</div><div class="stat-label">Активных</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.total_loops || 0}</div><div class="stat-label">Петель</div></div>
                    <div class="stat-card"><div class="stat-value">${Math.round((stats.closure_score || 0) * 100)}%</div><div class="stat-label">Замыкание</div></div>
                </div>
                <div class="key-confinement" style="margin-top:20px">
                    <div class="key-title">${stats.is_system_closed ? '🔒 СИСТЕМА ЗАМКНУТА' : '🔓 СИСТЕМА ОТКРЫТА'}</div>
                    <div class="key-desc">${stats.is_system_closed ? 'Требуется работа с ключевыми элементами' : 'Система готова к изменениям'}</div>
                </div>
                <div class="practice-card">
                    <h3>🧠 ПРОФИЛЬ</h3>
                    <div class="intervention-text">Код: ${status.profile_code || 'Не определен'}</div>
                    <div class="intervention-text">Тест: ${status.test_completed ? '✅ Пройден' : '⏳ Не пройден'}</div>
                </div>
            </div>
        </div>`;
    document.getElementById('backBtn').onclick = () => renderDashboard();
}

// ============================================
// НАСТРОЙКА ГОЛОСОВОЙ КНОПКИ
// ============================================

// Глобальные обработчики touchend — создаём ОДИН РАЗ
let _voiceTouchEndHandler = null;
let _voiceTouchCancelHandler = null;

function setupVoiceButton(buttonElement) {
    if (!buttonElement || !voiceManager) return;
    // Защита от повторной инициализации
    if (buttonElement._voiceInited) return;
    buttonElement._voiceInited = true;

    let pressTimer     = null;
    let _activeTouchId = null;
    let _recording     = false;
    let _watchdog      = null; // аварийный таймер сброса
    const DELAY        = 400; // ms — защита от случайных касаний
    const WATCHDOG_MS  = 65000; // 65с — максимум записи 60с + запас

    const getIcon = () => buttonElement.querySelector('.voice-icon');
    const getText = () => buttonElement.querySelector('.voice-text');

    const resetBtn = () => {
        buttonElement.style.transform = '';
        buttonElement.style.opacity   = '';
    };

    // Принудительный сброс — вызывается при любом "залипании"
    const forceStop = (reason) => {
        console.warn('⚠️ Voice button force stop:', reason);
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
        resetBtn();
        _activeTouchId = null;
        if (_recording || (voiceManager.isRecordingActive && voiceManager.isRecordingActive())) {
            try { voiceManager.stopRecording(); } catch (e) { console.error('Force stop error:', e); }
        }
        _recording = false;
    };

    const onPressStart = (e) => {
        e.preventDefault();
        if (pressTimer || _recording) return;
        _activeTouchId = e.touches ? e.touches[0].identifier : -1;
        buttonElement.style.transform = 'scale(0.97)';
        buttonElement.style.opacity   = '0.75';
        pressTimer = setTimeout(async () => {
            pressTimer = null;
            resetBtn();
            if (navigator.vibrate) navigator.vibrate(60);
            _recording = true;
            // Watchdog: аварийный сброс через 65с
            _watchdog = setTimeout(() => forceStop('watchdog timeout'), WATCHDOG_MS);
            const started = await voiceManager.startRecording();
            if (!started) {
                // getUserMedia отказал — сбрасываем
                _recording = false;
                if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
            }
        }, DELAY);
    };

    const onPressEnd = (e) => {
        // Для touchcancel — всегда сбрасываем, не проверяем identifier
        if (e.type === 'touchcancel') {
            forceStop('touchcancel');
            return;
        }
        if (e.changedTouches) {
            const ours = Array.from(e.changedTouches)
                .find(t => t.identifier === _activeTouchId);
            if (!ours) return;
        }
        _activeTouchId = null;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            resetBtn();
            return;
        }
        if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
        if (_recording || (voiceManager.isRecordingActive && voiceManager.isRecordingActive())) {
            voiceManager.stopRecording();
        }
        _recording = false;
    };

    // Desktop
    buttonElement.addEventListener('mousedown',  onPressStart);
    buttonElement.addEventListener('mouseup',    onPressEnd);
    buttonElement.addEventListener('mouseleave', onPressEnd);
    // Mobile — touchstart на кнопке
    buttonElement.addEventListener('touchstart', onPressStart, { passive: false });
    // touchend на document — удаляем старый и вешаем новый (один глобальный)
    if (_voiceTouchEndHandler) {
        document.removeEventListener('touchend', _voiceTouchEndHandler);
        document.removeEventListener('touchcancel', _voiceTouchCancelHandler);
    }
    _voiceTouchEndHandler = onPressEnd;
    _voiceTouchCancelHandler = onPressEnd;
    document.addEventListener('touchend',    onPressEnd, { passive: false });
    document.addEventListener('touchcancel', onPressEnd, { passive: false });
    buttonElement.addEventListener('contextmenu', e => e.preventDefault());

    // Сброс при сворачивании приложения / входящем звонке / блокировке экрана
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && _recording) {
            forceStop('app went to background');
        }
    });
    // Сброс при потере фокуса (pull-down уведомлений на Android)
    window.addEventListener('blur', () => {
        if (_recording) {
            forceStop('window blur');
        }
    });

    voiceManager.onStatusChange = (status) => {
        const icon = getIcon();
        const text = getText();
        switch (status) {
            case 'recording':
                buttonElement.classList.add('recording');
                if (icon) icon.textContent = '⏹️';
                if (text) text.textContent = 'Отпустите для отправки';
                break;
            case 'processing':
                _recording = false;
                buttonElement.classList.remove('recording');
                if (icon) icon.textContent = '🔄';
                if (text) text.textContent = 'Распознаю речь...';
                break;
            case 'speaking':
                if (icon) icon.textContent = '🔊';
                if (text) text.textContent = 'Фреди отвечает...';
                break;
            default:
                _recording = false;
                buttonElement.classList.remove('recording');
                buttonElement.style.boxShadow = '';
                if (icon) icon.textContent = '🎤';
                if (text) text.textContent = MODES[currentMode]?.voicePrompt || 'Говорите...';
        }
    };

    // onVolumeChange убран — вызывал дрожание на мобиле
    voiceManager.onVolumeChange = () => {};
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ГОЛОСОВОГО МЕНЕДЖЕРА
// ============================================

async function initVoice() {
    if (typeof VoiceManager === 'undefined') {
        console.warn('⚠️ VoiceManager не загружен');
        return false;
    }

    voiceManager = new VoiceManager(CONFIG.USER_ID, {
        useWebSocket: false,          // HTTP надёжнее на всех устройствах
        apiBaseUrl:   CONFIG.API_BASE_URL
    });

    // Транскрипт — что распознал
    voiceManager.onTranscript = (text) => {
        console.log('📝 Transcript received:', text);
        addMessage('🎤 ' + text, 'system');
    };

    // Текстовый ответ AI
    voiceManager.onAIResponse = (answer) => {
        console.log('🧠 AI answer received, length:', answer?.length);
        addMessage(answer, 'bot');
    };

    // Ошибки
    voiceManager.onError = (error) => {
        console.error('❌ Voice error:', error);
        showToast('❌ ' + error, 'error');
        // Сбросить состояние кнопки при ошибке
        const btn = document.getElementById('mainVoiceBtn');
        if (btn) {
            btn.classList.remove('recording');
            btn.style.transform = '';
            btn.style.opacity = '';
            btn.style.boxShadow = '';
            const icon = btn.querySelector('.voice-icon');
            const text = btn.querySelector('.voice-text');
            if (icon) icon.textContent = '🎤';
            if (text) text.textContent = MODES[currentMode]?.voicePrompt || 'Говорите...';
        }
    };

    // Индикатор "думает"
    voiceManager.onThinking = (isThinking) => {
        console.log('💭 Thinking:', isThinking);
    };

    voiceManager.setMode(currentMode);
    window.voiceManager = voiceManager;
    console.log('✅ VoiceManager инициализирован');
    return true;
}

// ============================================
// РЕНДЕР ДАШБОРДА
// ============================================

function renderDashboard() {
    const container = document.getElementById('screenContainer');
    if (!container) return;

    // Делаем функцию глобальной для test.js
    window.renderDashboard = renderDashboard;

    const modeConfig = MODES[currentMode];
    const modules = MODULES[currentMode];

    container.innerHTML = `
        <div class="dashboard-container">
            <div class="hero-section">
                <div class="hero-greeting">
                    <div class="hero-mode-emoji">${modeConfig.emoji}</div>
                    <h2 class="hero-title">${modeConfig.greeting}, <span class="hero-name">${CONFIG.USER_NAME}</span></h2>
                    <p class="hero-sub">Фреди слушает — говорите голосом или выберите действие</p>
                </div>
                <div class="profile-badge" id="profileBadge">
                    <div class="profile-code" id="profileCode">${CONFIG.PROFILE_CODE || '···'}</div>
                    <div class="profile-status" id="profileStatus">загрузка...</div>
                </div>
            </div>

            <!-- CTA-баннер для новых пользователей -->
            <div id="ctaTestBanner" style="display:none;background:linear-gradient(135deg,rgba(168,196,224,0.12),rgba(120,160,210,0.06));border:1px solid rgba(168,196,224,0.3);border-radius:20px;padding:18px 20px;margin-bottom:20px;align-items:center;gap:16px;cursor:pointer" onclick="startTest()">
                <div style="font-size:36px;flex-shrink:0">🧬</div>
                <div style="flex:1">
                    <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Узнайте свой психотип</div>
                    <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">15 минут — и Фреди будет знать вас по-настоящему. Персональные рекомендации, точный анализ, инструменты под вас.</div>
                </div>
                <div style="flex-shrink:0;background:linear-gradient(135deg,rgba(168,196,224,0.25),rgba(120,160,210,0.15));border:1px solid rgba(168,196,224,0.5);border-radius:30px;padding:9px 16px;font-size:12px;font-weight:700;color:rgba(168,196,224,0.95);white-space:nowrap">Начать →</div>
            </div>

            <div class="mode-selector">
                <button class="mode-btn ${currentMode === 'coach' ? 'active' : ''}" data-mode="coach">🔮 КОУЧ</button>
                <button class="mode-btn ${currentMode === 'psychologist' ? 'active' : ''}" data-mode="psychologist">🧠 ПСИХОЛОГ</button>
                <button class="mode-btn ${currentMode === 'trainer' ? 'active' : ''}" data-mode="trainer">⚡ ТРЕНЕР</button>
            </div>

            <div class="voice-section">
                <div class="voice-card">
                    <button class="voice-record-btn-premium" id="mainVoiceBtn">
                        <span class="voice-icon">🎤</span>
                        <span class="voice-text">${modeConfig.voicePrompt}</span>
                    </button>
                    <div style="text-align:center;font-size:11px;color:var(--text-secondary);margin-top:8px">🎙️ Нажмите и удерживайте для записи</div>
                </div>
            </div>

            <div class="modules-grid">
                ${modules.map(m => `
                    <div class="module-card" data-module="${m.id}">
                        <div class="module-icon">${m.icon}</div>
                        <div class="module-name">${m.name}</div>
                        <div class="module-desc">${m.desc}</div>
                    </div>`).join('')}
            </div>

            <div class="quick-actions">
                <div class="quick-actions-title">⚡ Быстрые действия</div>
                <div class="quick-actions-grid">
                    <div class="quick-action" data-action="profile"><div class="action-icon">🧠</div><div class="action-name">Мой портрет</div></div>
                    <div class="quick-action" data-action="thoughts"><div class="action-icon">💭</div><div class="action-name">Мысли психолога</div></div>
                    <div class="quick-action" data-action="newThought"><div class="action-icon">✨</div><div class="action-name">Свежая мысль</div></div>
                    <div class="quick-action" data-action="weekend"><div class="action-icon">🎨</div><div class="action-name">Идеи на выходные</div></div>
                    <div class="quick-action" data-action="brand"><div class="action-icon">🏆</div><div class="action-name">Мой бренд</div></div>
                    <div class="quick-action" data-action="doubles"><div class="action-icon">👥</div><div class="action-name">Двойники</div></div>
                    <div class="quick-action" data-action="interests"><div class="action-icon">🔮</div><div class="action-name">Интересы</div></div>
                    <div class="quick-action" data-action="hormones"><div class="action-icon">🧬</div><div class="action-name">Гормоны</div></div>
                </div>
            </div>
        </div>
    `;

    // Загружаем статус профиля
    getUserStatus().then(status => {
        const badge  = document.getElementById('profileBadge');
        const codeEl = document.getElementById('profileCode');
        const statusEl = document.getElementById('profileStatus');
        if (status.has_profile && status.profile_code) {
            if (codeEl) codeEl.textContent = status.profile_code;
            if (statusEl) statusEl.textContent = 'ваш психотип';
            if (badge) badge.classList.remove('profile-badge--cta');
        } else {
            if (codeEl) { codeEl.textContent = '📊'; codeEl.style.fontSize = '22px'; }
            if (statusEl) statusEl.textContent = '→ пройти тест';
            if (badge) badge.classList.add('profile-badge--cta');
            // Показываем CTA-баннер
            const ctaBanner = document.getElementById('ctaTestBanner');
            if (ctaBanner) ctaBanner.style.display = 'flex';
        }
    }).catch(() => {
        const statusEl = document.getElementById('profileStatus');
        if (statusEl) statusEl.textContent = 'нет профиля';
    });

    document.getElementById('profileBadge')?.addEventListener('click', async () => {
        const completed = await isTestCompleted();
        if (!completed) startTest();
        else handleShowProfile();
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => { if (btn.dataset.mode) switchMode(btn.dataset.mode); });
    });

    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => {
            const moduleId = card.dataset.module;
            const _load = (src, fn) => { if (typeof fn==='function') { fn(); } else { const s=document.createElement('script'); s.src=src; s.onload=()=>{ if(typeof fn==='function') fn(); }; s.onerror=()=>{showToast('Не удалось загрузить модуль','error');}; document.head.appendChild(s); } };
            const moduleHandlers = {
                analysis:   () => { if (typeof openAnalysisScreen==='function') openAnalysisScreen(); else _load('analysis.js', window.openAnalysisScreen); },
                goals:      () => { if (typeof showGoalsScreen==='function') showGoalsScreen(); else { const s=document.createElement('script');s.src='goals.js';s.onload=()=>{if(typeof showGoalsScreen==='function')showGoalsScreen();};document.head.appendChild(s); } },
                habits:     () => { if (typeof showHabitsScreen==='function') showHabitsScreen(); else { const s=document.createElement('script');s.src='habits.js';s.onload=()=>{if(typeof showHabitsScreen==='function')showHabitsScreen();};document.head.appendChild(s); } },
                motivation: () => { if (typeof showMotivationScreen==='function') showMotivationScreen(); else { const s=document.createElement('script');s.src='motivation.js';s.onload=()=>{if(typeof showMotivationScreen==='function')showMotivationScreen();};document.head.appendChild(s); } },
                strategy:   () => { if (typeof showStrategyScreen==='function') showStrategyScreen(); else { const s=document.createElement('script');s.src='strategy.js';s.onload=()=>{if(typeof showStrategyScreen==='function')showStrategyScreen();};document.head.appendChild(s); } },
                challenges:       () => showToast('Челленджи — скоро', 'info'),
                skill_diagnosis:  () => { if (typeof showSkillDiagnosisScreen==='function') showSkillDiagnosisScreen(); else { const s=document.createElement('script');s.src='skill_diagnosis.js';s.onload=()=>{if(typeof showSkillDiagnosisScreen==='function')showSkillDiagnosisScreen();};document.head.appendChild(s); } },
                skill_choice:     () => { if (typeof showSkillChoiceScreen==='function') showSkillChoiceScreen(); else { const s=document.createElement('script');s.src='skill_choice.js';s.onload=()=>{if(typeof showSkillChoiceScreen==='function')showSkillChoiceScreen();};document.head.appendChild(s); } },
                daily_training:   () => { if (typeof showDailyTrainingScreen==='function') showDailyTrainingScreen(); else { const s=document.createElement('script');s.src='daily_training.js';s.onload=()=>{if(typeof showDailyTrainingScreen==='function')showDailyTrainingScreen();};document.head.appendChild(s); } },
                progress:         () => { if (typeof showProgressScreen==='function') showProgressScreen(); else { const s=document.createElement('script');s.src='progress_tracker.js';s.onload=()=>{if(typeof showProgressScreen==='function')showProgressScreen();};document.head.appendChild(s); } },
                emotions:   () => { if (typeof showEmotionsScreen==='function') showEmotionsScreen(); else { const s=document.createElement('script');s.src='emotions.js';s.onload=()=>{if(typeof showEmotionsScreen==='function')showEmotionsScreen();};document.head.appendChild(s); } },
                trauma:     () => { if (typeof showHealingScreen==='function') showHealingScreen(); else { const s=document.createElement('script');s.src='healing.js';s.onload=()=>{if(typeof showHealingScreen==='function')showHealingScreen();};document.head.appendChild(s); } },
                relations:  () => { if (typeof showRelationshipsScreen==='function') showRelationshipsScreen(); else { const s=document.createElement('script');s.src='relationships.js';s.onload=()=>{if(typeof showRelationshipsScreen==='function')showRelationshipsScreen();};document.head.appendChild(s); } }
            };
            const name = card.querySelector('.module-name')?.textContent;
            if (moduleHandlers[moduleId]) moduleHandlers[moduleId]();
            else showToast(`Модуль "${name}" — скоро будет доступен`, 'info');
        });
    });

    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', async () => {
            const type = action.dataset.action;
            const handlers = {
                profile: handleShowProfile,
                thoughts: handleShowThoughts,
                newThought: handleShowNewThought,
                weekend: () => { if (typeof showWeekendScreen === 'function') showWeekendScreen(); else { const s=document.createElement('script');s.src='weekend.js';s.onload=()=>{if(typeof showWeekendScreen==='function')showWeekendScreen();};document.head.appendChild(s); } },
                goals: () => { if (typeof showGoalsScreen === "function") showGoalsScreen(); else { showToast("🎯 Загрузка...", "info"); const s = document.createElement("script"); s.src = "goals.js"; s.onload = () => { if (typeof showGoalsScreen === "function") showGoalsScreen(); }; document.head.appendChild(s); } },
                questions: handleShowQuestions,
                brand: () => { if (typeof showPersonalBrandScreen === "function") showPersonalBrandScreen(); else { showToast("🏆 Загрузка...", "info"); const s = document.createElement("script"); s.src = "brand.js"; s.onload = () => { if (typeof showPersonalBrandScreen === "function") showPersonalBrandScreen(); }; document.head.appendChild(s); } },
                doubles: handleShowDoubles,
                interests: () => { if (typeof showInterestsScreen === 'function') showInterestsScreen(); else { showToast('🎯 Загрузка...', 'info'); const s = document.createElement('script'); s.src = 'interests.js'; s.onload = () => { if (typeof showInterestsScreen === 'function') showInterestsScreen(); }; document.head.appendChild(s); } },
                hormones: () => { if (typeof showHormonesScreen==='function') showHormonesScreen(); else { const s=document.createElement('script');s.src='hormones.js';s.onload=()=>{if(typeof showHormonesScreen==='function')showHormonesScreen();};document.head.appendChild(s); } },
                habits: () => { if (typeof showHabitsScreen === 'function') showHabitsScreen(); else { showToast('🔄 Загрузка...', 'info'); const s = document.createElement('script'); s.src = 'habits.js'; s.onload = () => { if (typeof showHabitsScreen === 'function') showHabitsScreen(); }; document.head.appendChild(s); } },
                motivation: () => { if (typeof showMotivationScreen === 'function') showMotivationScreen(); else { showToast('🔥 Загрузка...', 'info'); const s = document.createElement('script'); s.src = 'motivation.js'; s.onload = () => { if (typeof showMotivationScreen === 'function') showMotivationScreen(); }; document.head.appendChild(s); } },
                strategy: () => { if (typeof showStrategyScreen === 'function') showStrategyScreen(); else { showToast('🗺️ Загрузка...', 'info'); const s = document.createElement('script'); s.src = 'strategy.js'; s.onload = () => { if (typeof showStrategyScreen === 'function') showStrategyScreen(); }; document.head.appendChild(s); } }
            };
            if (handlers[type]) await handlers[type]();
        });
    });

    const voiceBtn = document.getElementById('mainVoiceBtn');
    if (voiceBtn && voiceManager) setupVoiceButton(voiceBtn);
}

// ============================================
// МОБИЛЬНОЕ МЕНЮ
// ============================================

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const chatsPanel = document.getElementById('chatsPanel');
    if (!mobileMenuBtn || !chatsPanel) return;

    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        chatsPanel.classList.toggle('open');
    });

    // touchstart быстрее click на мобиле (нет 300мс задержки)
    document.addEventListener('touchstart', (e) => {
        if (chatsPanel.classList.contains('open')
            && !chatsPanel.contains(e.target)
            && !mobileMenuBtn.contains(e.target)) {
            chatsPanel.classList.remove('open');
        }
    }, { passive: true });

    // десктоп — обычный click, пропускаем touch-события
    document.addEventListener('click', (e) => {
        if (e.pointerType === 'touch') return;
        if (chatsPanel.classList.contains('open')
            && !chatsPanel.contains(e.target)
            && !mobileMenuBtn.contains(e.target)) {
            chatsPanel.classList.remove('open');
        }
    });

    // свайп влево — закрыть
    let touchStartX = 0;
    chatsPanel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    chatsPanel.addEventListener('touchend', (e) => {
        if (e.changedTouches[0].clientX - touchStartX < -50) {
            chatsPanel.classList.remove('open');
        }
    }, { passive: true });
}

// ============================================
// ВЕРХНЕЕ МЕНЮ (три точки справа в шапке)
// ============================================

// Перехватываем событие PWA-установки как можно раньше, чтобы потом можно было вызвать prompt по клику
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._frediInstallPrompt = e;
});

// ============================================
// КНОПКА ПОДЕЛИТЬСЯ ССЫЛКОЙ (встраиваемая версия, напр. Telegram-miniapp)
// ============================================
// ============================================
// БЕЙДЖ НЕПРОЧИТАННЫХ СООБЩЕНИЙ (запускаем при старте)
// ============================================
// Лениво подгружаем messages.js и сразу стартуем поллинг, чтобы цифра
// у пункта «Сообщения» в сайдбаре появлялась без захода на экран.
function initMessagesBadgePoller() {
    if (window._msBadgePollerStarted) return;
    window._msBadgePollerStarted = true;

    const start = () => {
        if (typeof window.initMessagesBadge === 'function') {
            try { window.initMessagesBadge(); } catch (e) { console.warn('initMessagesBadge failed:', e); }
        }
    };

    if (typeof window.initMessagesBadge === 'function') {
        start();
        return;
    }

    // Подгружаем messages.js в фоне
    const s = document.createElement('script');
    s.src = 'messages.js';
    s.async = true;
    s.onload = start;
    s.onerror = () => console.warn('messages.js load failed — badge poller inactive');
    document.head.appendChild(s);
}

function initShareBtn() {
    const btn = document.getElementById('shareBtn');
    if (!btn || btn._fShareInited) return;
    btn._fShareInited = true;

    btn.addEventListener('click', async () => {
        const shareUrl = 'https://fredi-frontend-flz2.onrender.com/';
        const data = {
            title: 'Фреди — виртуальный психолог',
            text: 'Попробуй Фреди — AI-психолог с голосом, толкованием снов и персональным профилем',
            url: shareUrl
        };
        // Нативный Web Share (мобильные + современный Safari/Chrome)
        if (navigator.share) {
            try {
                await navigator.share(data);
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return; // пользователь закрыл диалог — молча
                // иначе падаем в фолбэк
            }
        }
        // Фолбэк: копируем ссылку
        try {
            await navigator.clipboard.writeText(data.url);
            if (typeof showToast === 'function') showToast('🔗 Ссылка скопирована: ' + data.url, 'success');
        } catch {
            if (typeof showToast === 'function') showToast('Скопируй вручную: ' + data.url, 'info');
            else window.prompt('Ссылка для отправки:', data.url);
        }
    });
}

function initTopMenu() {
    const btn = document.getElementById('menuBtn');
    if (!btn || btn._fTopMenuInited) return;

    // Меню существует ТОЛЬКО на публичном сайте (meysternlp.ru / github.io).
    // Во встраиваемой версии/Telegram-miniapp — прячем кнопку.
    const host = (location.hostname || '').toLowerCase();
    const isPublicSite = host.endsWith('meysternlp.ru') || host.endsWith('github.io') || host === 'localhost' || host === '127.0.0.1';
    if (!isPublicSite) {
        btn.style.display = 'none';
        return;
    }
    btn._fTopMenuInited = true;

    // Стили вставляем один раз
    if (!document.getElementById('fredi-top-menu-styles')) {
        const s = document.createElement('style');
        s.id = 'fredi-top-menu-styles';
        s.textContent = `
            .fredi-top-menu {
                position: fixed;
                top: 58px;
                right: 12px;
                min-width: 240px;
                background: var(--surface, #1a1a1a);
                border: 1px solid rgba(224,224,224,0.14);
                border-radius: 14px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.45);
                padding: 6px;
                z-index: 9000;
                opacity: 0;
                transform: translateY(-6px) scale(0.98);
                transition: opacity 0.14s ease, transform 0.14s ease;
                pointer-events: none;
            }
            .fredi-top-menu.is-open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }
            .fredi-top-menu-item {
                display: flex; align-items: center; gap: 10px;
                padding: 11px 12px;
                border-radius: 10px;
                font-size: 13px;
                color: var(--text-primary);
                cursor: pointer;
                font-family: inherit;
                background: transparent;
                border: none;
                width: 100%;
                text-align: left;
                transition: background 0.15s;
            }
            .fredi-top-menu-item:hover { background: rgba(224,224,224,0.08); }
            .fredi-top-menu-item:active { background: rgba(224,224,224,0.14); }
            .fredi-top-menu-ico { font-size: 18px; width: 22px; text-align: center; }
            [data-theme="light"] .fredi-top-menu {
                background: #FFFFFF;
                border-color: rgba(0,0,0,0.1);
                box-shadow: 0 12px 40px rgba(0,0,0,0.15);
            }
            [data-theme="light"] .fredi-top-menu-item:hover { background: rgba(0,0,0,0.05); }
        `;
        document.head.appendChild(s);
    }

    const menu = document.createElement('div');
    menu.className = 'fredi-top-menu';
    menu.id = 'frediTopMenu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
        <button class="fredi-top-menu-item" data-action="install" role="menuitem">
            <span class="fredi-top-menu-ico">📱</span>
            <span>Отправить ярлык на мой экран</span>
        </button>
        <button class="fredi-top-menu-item" data-action="workshop" role="menuitem">
            <span class="fredi-top-menu-ico">🏛️</span>
            <span>В мейстерскую</span>
        </button>
    `;
    document.body.appendChild(menu);

    const open  = () => menu.classList.add('is-open');
    const close = () => menu.classList.remove('is-open');
    const toggle = () => menu.classList.contains('is-open') ? close() : open();

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });

    menu.addEventListener('click', async (e) => {
        const item = e.target.closest('.fredi-top-menu-item');
        if (!item) return;
        const action = item.getAttribute('data-action');
        close();
        if (action === 'install') {
            const p = window._frediInstallPrompt;
            if (p && typeof p.prompt === 'function') {
                try {
                    p.prompt();
                    const choice = await p.userChoice;
                    if (typeof showToast === 'function') {
                        showToast(choice.outcome === 'accepted' ? '✅ Ярлык добавлен' : 'Установка отменена', 'info');
                    }
                    window._frediInstallPrompt = null;
                } catch (err) {
                    if (typeof showToast === 'function') showToast('Не удалось добавить ярлык', 'error');
                }
            } else {
                const ua = navigator.userAgent || '';
                const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
                if (typeof showToast === 'function') {
                    if (isIOS) {
                        showToast('В Safari нажмите «Поделиться» → «На экран «Домой»»', 'info');
                    } else {
                        showToast('Ярлык уже добавлен или недоступен в этом браузере', 'info');
                    }
                }
            }
        } else if (action === 'workshop') {
            window.open('https://meysternlp.ru/', '_blank', 'noopener');
        }
    });

    document.addEventListener('click', (e) => {
        if (!menu.classList.contains('is-open')) return;
        if (menu.contains(e.target) || btn.contains(e.target)) return;
        close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИМЕНИ (заменяем нативный prompt на inline-форму)
// ============================================

function showNamePrompt() {
    const container = document.getElementById('screenContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="full-content-page" style="max-width:400px;margin:40px auto">
            <div class="content-header">
                <div class="content-emoji">👋</div>
                <h1 class="content-title">Привет!</h1>
            </div>
            <div class="content-body">
                <p style="margin-bottom:16px;color:var(--text-secondary)">Как мне к вам обращаться?</p>
                <input type="text" id="nameInput" placeholder="Ваше имя"
                    style="width:100%;padding:14px;border-radius:30px;border:1px solid rgba(224,224,224,0.2);background:rgba(224,224,224,0.05);color:white;font-size:16px;margin-bottom:12px">
                <button id="saveNameBtn" style="width:100%;padding:14px;border-radius:30px;border:none;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:white;font-weight:600;font-size:16px;cursor:pointer">
                    ✅ Продолжить
                </button>
            </div>
        </div>
    `;

    const input = document.getElementById('nameInput');
    const btn = document.getElementById('saveNameBtn');

    const save = async () => {
        const name = input.value.trim();
        if (!name) { showToast('Введите имя', 'error'); return; }
        localStorage.setItem('fredi_user_name', name);
        const userNameEl = document.getElementById('userName');
        const avatarEl = document.getElementById('userMiniAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
        // Сохраняем имя на бэкенд для двойников и зеркал
        try {
            await apiCall('/api/save-context', {
                method: 'POST',
                body: JSON.stringify({ user_id: CONFIG.USER_ID, context: { name } })
            });
        } catch(e) { console.warn('Failed to save name to backend:', e); }
        renderDashboard();
    };

    btn.addEventListener('click', save);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') save(); });
    input.focus();
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

async function init() {
    console.log('🚀 FREDI PREMIUM запущен. USER_ID:', CONFIG.USER_ID);

    // Делаем renderDashboard глобальной для test.js
    window.renderDashboard = renderDashboard;

    initMobileMenu();
    initTopMenu();
    initShareBtn();
    initMessagesBadgePoller();
    await initVoice();

    // Проверяем имя пользователя
    const userName = localStorage.getItem('fredi_user_name');
    if (userName) {
        const userNameEl = document.getElementById('userName');
        const avatarEl = document.getElementById('userMiniAvatar');
        if (userNameEl) userNameEl.textContent = userName;
        if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();
        renderDashboard();
    } else {
        showNamePrompt();
    }

    // Обработчики пунктов меню
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chat = item.dataset.chat;
            const actions = {
                fredi: renderDashboard,
                test: startTest,
                messages: () => {
                    if (typeof showMessagesScreen === 'function') showMessagesScreen();
                    else { showToast('💬 Загрузка сообщений...', 'info'); const s = document.createElement('script'); s.src = 'messages.js'; s.onload = () => { if (typeof showMessagesScreen === 'function') showMessagesScreen(); }; document.head.appendChild(s); }
                },
                confinement: () => showConfinementModel(),
                practices: () => { if (typeof showPracticesScreen==='function') showPracticesScreen(); else { const s=document.createElement('script');s.src='practices.js';s.onload=()=>{if(typeof showPracticesScreen==='function')showPracticesScreen();};document.head.appendChild(s); } },
                hypnosis: () => { if (typeof showHypnosisScreen==='function') showHypnosisScreen(); else { const s=document.createElement('script');s.src='hypnosis.js';s.onload=()=>{if(typeof showHypnosisScreen==='function')showHypnosisScreen();};document.head.appendChild(s); } },
                diary: () => { if (typeof showDiaryScreen==='function') showDiaryScreen(); else { const s=document.createElement('script');s.src='diary.js';s.onload=()=>{if(typeof showDiaryScreen==='function')showDiaryScreen();};document.head.appendChild(s); } },
                berne: () => { if (typeof showBerneScreen==='function') showBerneScreen(); else { const s=document.createElement('script');s.src='berne.js';s.onload=()=>{if(typeof showBerneScreen==='function')showBerneScreen();};document.head.appendChild(s); } },
                tales: () => { if (typeof showTalesScreen==='function') showTalesScreen(); else { const s=document.createElement('script'); s.src='tales.js'; s.onload=()=>{ if(typeof showTalesScreen==='function') showTalesScreen(); }; document.head.appendChild(s); } },
                anchors: () => { if (typeof showAnchorsScreen==='function') showAnchorsScreen(); else { const s=document.createElement('script');s.src='anchors.js';s.onload=()=>{if(typeof showAnchorsScreen==='function')showAnchorsScreen();};document.head.appendChild(s); } },
                dreams: () => { if (typeof showDreamsScreen==='function') showDreamsScreen(); else { const s=document.createElement('script');s.src='dreams.js';s.onload=()=>{if(typeof showDreamsScreen==='function')showDreamsScreen();};document.head.appendChild(s); } },
                esoterica: () => { if (typeof showEsotericaScreen==='function') showEsotericaScreen(); else { const s=document.createElement('script');s.src='esoterica.js';s.onload=()=>{if(typeof showEsotericaScreen==='function')showEsotericaScreen();};document.head.appendChild(s); } },
                statistics: () => showStatistics(),
                mirrors: () => { if (typeof showMirrorsScreen==='function') showMirrorsScreen(); },
                settings: () => {
                    if (typeof showSettingsScreen === 'function') showSettingsScreen();
                    else { showToast('⚙️ Загрузка...', 'info'); const s=document.createElement('script'); s.src='settings.js'; s.onload=()=>{ if(typeof showSettingsScreen==='function') showSettingsScreen(); }; document.head.appendChild(s); }
                }
            };
            (actions[chat] || renderDashboard)();

            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (window.innerWidth <= 768) {
                document.getElementById('chatsPanel')?.classList.remove('open');
            }
        });
    });

    // Запрашиваем разрешение на микрофон без блокировки UI
    setTimeout(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            console.log('✅ Микрофон доступен');
        } catch {
            console.log('ℹ️ Разрешение на микрофон не выдано');
        }
    }, 2000);

    // Фикс: на мобильных input скроллится в видимую область при фокусе
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
