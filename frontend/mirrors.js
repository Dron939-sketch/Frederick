// ============================================
// 🪞 ЗЕРКАЛА / ОТРАЖЕНИЯ
// Версия 3.0 — с улучшенными карточками (город, возраст, пол)
// ============================================

const API_BASE = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

// ============================================
// ЛОГГЕР
// ============================================
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

let CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

function _log(level, module, message, data = null) {
    if (level < CURRENT_LOG_LEVEL) return;
    
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'UNKNOWN';
    const prefix = `[${timestamp}] [${levelName}] [${module}]`;
    
    if (data) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }
    
    try {
        const logs = JSON.parse(localStorage.getItem('mirror_debug_logs') || '[]');
        logs.push({ timestamp, level: levelName, module, message, data: data ? JSON.stringify(data) : null });
        while (logs.length > 50) logs.shift();
        localStorage.setItem('mirror_debug_logs', JSON.stringify(logs));
    } catch(e) {}
}

const log = {
    debug: (module, msg, data) => _log(LOG_LEVELS.DEBUG, module, msg, data),
    info: (module, msg, data) => _log(LOG_LEVELS.INFO, module, msg, data),
    warn: (module, msg, data) => _log(LOG_LEVELS.WARN, module, msg, data),
    error: (module, msg, data) => _log(LOG_LEVELS.ERROR, module, msg, data)
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function _escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

function _fixMirrorRef(ref) {
    log.debug('Mirrors', '_fixMirrorRef called', { hasRef: !!ref });
    if (!ref) return ref;
    
    const copy = JSON.parse(JSON.stringify(ref));
    
    ['friend_vectors', 'friend_deep_patterns'].forEach(function(key) {
        if (typeof copy[key] === 'string') {
            try { 
                copy[key] = JSON.parse(copy[key]); 
                log.debug('Mirrors', `Parsed ${key}`, copy[key]);
            } catch(e) { 
                log.warn('Mirrors', `Failed to parse ${key}`, { error: e.message });
                copy[key] = {}; 
            }
        }
        if (!copy[key]) copy[key] = {};
    });
    
    var v = copy.friend_vectors;
    if (v && typeof v === 'object') {
        Object.keys(v).forEach(function(k) { 
            v[k] = Number(v[k]) || 0; 
        });
    }
    
    return copy;
}

function _mirrorsGoBack() {
    log.info('Mirrors', 'Going back to dashboard');
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    } else if (window.renderDashboard) {
        window.renderDashboard();
    } else {
        showMirrorsScreen();
    }
}

async function _copyToClipboard(text) {
    log.debug('Mirrors', 'Copying to clipboard', { textLength: text?.length });
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            log.info('Mirrors', 'Clipboard copy successful (modern API)');
            return true;
        } catch(e) {
            log.warn('Mirrors', 'Clipboard API failed, using fallback', { error: e.message });
        }
    }
    
    return new Promise((resolve) => {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand('copy');
            log.info('Mirrors', 'Clipboard copy successful (fallback)');
            resolve(true);
        } catch(e) {
            log.error('Mirrors', 'Clipboard copy failed', { error: e.message });
            resolve(false);
        }
        document.body.removeChild(el);
    });
}

// ============================================
// КЭШ ОТРАЖЕНИЙ
// ============================================
let reflectionsCache = {
    data: null,
    timestamp: null,
    ttl: 30000
};

function _getCachedReflections() {
    const now = Date.now();
    if (reflectionsCache.data && (now - reflectionsCache.timestamp) < reflectionsCache.ttl) {
        log.debug('Mirrors', 'Using cached reflections', { age: now - reflectionsCache.timestamp });
        return reflectionsCache.data;
    }
    log.debug('Mirrors', 'Cache miss or expired');
    return null;
}

function _setCachedReflections(data) {
    reflectionsCache.data = data;
    reflectionsCache.timestamp = Date.now();
    log.debug('Mirrors', 'Cached reflections', { totalReflections: data?.reflections?.length });
}

function _clearReflectionsCache() {
    reflectionsCache.data = null;
    reflectionsCache.timestamp = null;
    log.info('Mirrors', 'Reflections cache cleared');
}

// ============================================
// СТИЛИ
// ============================================
function injectMirrorStyles() {
    if (document.getElementById('mirror-styles')) return;
    const style = document.createElement('style');
    style.id = 'mirror-styles';
    style.textContent = `
        @keyframes mirrorFadeIn {
            from { opacity:0; transform:translateY(16px); }
            to   { opacity:1; transform:translateY(0); }
        }
        @keyframes mirrorPulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0); }
            50%      { box-shadow: 0 0 0 6px rgba(0,212,255,0.08); }
        }
        @keyframes shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
        }
        .mirror-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 12px;
            transition: border-color 0.2s, background 0.2s, transform 0.15s;
            animation: mirrorFadeIn 0.35s ease both;
            cursor: pointer;
        }
        .mirror-card:hover {
            border-color: rgba(255,107,59,0.35);
            background: rgba(255,107,59,0.04);
            transform: translateY(-2px);
        }
        .mirror-tab-btn {
            flex: 1;
            padding: 11px 8px;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s;
            font-family: inherit;
            letter-spacing: 0.2px;
        }
        .mirror-tab-btn.active {
            background: linear-gradient(135deg, #00d4ff, #0099cc);
            color: #fff;
            box-shadow: 0 4px 14px rgba(0,212,255,0.18), 0 0 6px rgba(0,212,255,0.1);
        }
        .mirror-tab-btn.inactive {
            background: transparent;
            color: rgba(255,255,255,0.4);
        }
        .mirror-tab-btn.inactive:hover {
            color: rgba(255,255,255,0.7);
            background: rgba(255,255,255,0.05);
        }
        .mirror-stat-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 18px;
            text-align: center;
            flex: 1;
        }
        .mirror-action-btn {
            display: flex;
            align-items: center;
            gap: 14px;
            width: 100%;
            padding: 18px 20px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            background: rgba(255,255,255,0.03);
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
            text-align: left;
            margin-bottom: 10px;
        }
        .mirror-action-btn:hover {
            background: rgba(255,255,255,0.07);
            border-color: rgba(255,255,255,0.2);
            transform: translateX(4px);
        }
        .mirror-vector-bar-track {
            background: rgba(255,255,255,0.06);
            border-radius: 4px;
            height: 5px;
            overflow: hidden;
            margin-top: 5px;
        }
        .mirror-vector-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.6s ease;
        }
        .mirror-info-block {
            background: rgba(255,255,255,0.025);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 10px;
        }
        .mirror-info-block-left {
            border-left: 2px solid rgba(255,107,59,0.6);
            padding-left: 14px;
        }
        .mirror-link-box {
            background: #000;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 12px 14px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            word-break: break-all;
            letter-spacing: 0.3px;
            margin-bottom: 12px;
        }
        .mirror-copy-btn {
            flex: 1;
            padding: 13px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
        }
        .mirror-copy-btn:hover { opacity: 0.85; transform: scale(0.98); }
        .mirror-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.3);
            margin-bottom: 10px;
        }
        .mirror-4f-card {
            border-radius: 16px;
            padding: 18px;
            margin-bottom: 10px;
            border-left: 3px solid;
            background: rgba(255,255,255,0.025);
            animation: mirrorFadeIn 0.3s ease both;
        }
        .mirror-wrap {
            padding-bottom: max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px));
        }
        @supports not (padding: max(0px)) {
            .mirror-wrap { padding-bottom: 80px; }
        }
        .mirror-skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 8px;
            height: 14px;
            margin-bottom: 8px;
        }
        .mirror-loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: #ff6b3b;
            border-radius: 50%;
            animation: mirrorSpin 0.8s linear infinite;
        }
        @keyframes mirrorSpin {
            to { transform: rotate(360deg); }
        }
        
        /* Новые стили для карточек */
        .mirror-vector-badge {
            flex: 1;
            text-align: center;
            background: rgba(255,255,255,0.04);
            border-radius: 12px;
            padding: 8px 4px;
            transition: all 0.2s;
        }
        .mirror-vector-badge:hover {
            background: rgba(255,255,255,0.08);
        }
        .mirror-vector-value {
            font-size: 16px;
            font-weight: 700;
        }
        .mirror-vector-label {
            font-size: 9px;
            color: rgba(255,255,255,0.4);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .mirror-city-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(255,255,255,0.06);
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 11px;
            color: rgba(255,255,255,0.6);
        }
    `;
    document.head.appendChild(style);
    log.info('Mirrors', 'Styles injected');
}
injectMirrorStyles();

// ============================================
// API
// ============================================
async function apiCreateMirror(userId, mirrorType) {
    log.info('API', 'apiCreateMirror called', { userId, mirrorType });
    try {
        const res = await fetch(`${API_BASE}/api/mirrors/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, mirror_type: mirrorType })
        });
        const data = await res.json();
        log.info('API', 'apiCreateMirror response', { success: data.success, mirrorCode: data.mirror_code });
        return data;
    } catch (error) {
        log.error('API', 'apiCreateMirror failed', { error: error.message });
        throw error;
    }
}

async function apiGetReflections(userId) {
    log.info('API', 'apiGetReflections called', { userId });
    try {
        const res = await fetch(`${API_BASE}/api/mirrors/${userId}/reflections`);
        const data = await res.json();
        log.info('API', 'apiGetReflections response', { 
            success: !!data, 
            reflectionsCount: data?.reflections?.length,
            hasStats: !!data?.stats
        });
        
        if (data && data.reflections) {
            log.debug('API', 'Applying JSONB fix to reflections');
            data.reflections.forEach((ref, i) => {
                log.debug('API', `Processing reflection ${i}`, { name: ref.friend_name });
                _fixMirrorRef(ref);
            });
        }
        return data;
    } catch (error) {
        log.error('API', 'apiGetReflections failed', { error: error.message });
        throw error;
    }
}

async function apiCheckMirrorStatus(mirrorCode) {
    log.info('API', 'apiCheckMirrorStatus called', { mirrorCode });
    try {
        const res = await fetch(`${API_BASE}/api/mirrors/${mirrorCode}/status`);
        const data = await res.json();
        log.info('API', 'apiCheckMirrorStatus response', { activated: data.activated, completed_at: data.completed_at });
        return data;
    } catch (error) {
        log.error('API', 'apiCheckMirrorStatus failed', { error: error.message });
        return { activated: false, error: error.message };
    }
}

// ============================================
// ГЛАВНЫЙ ЭКРАН
// ============================================
async function showMirrorsScreen() {
    log.info('Mirrors', 'showMirrorsScreen called');
    injectMirrorStyles();
    const container = document.getElementById('screenContainer');
    if (!container) {
        log.error('Mirrors', 'screenContainer not found');
        return;
    }

    container.innerHTML = `
        <div style="max-width:600px; margin:0 auto; padding:20px 16px; padding-bottom: max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px));">

            <!-- ШАПКА -->
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:28px; animation:mirrorFadeIn 0.3s ease;">
                <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                            display:flex;align-items:center;justify-content:center;font-size:22px;
                            box-shadow:0 8px 24px rgba(255,59,59,0.3);">🪞</div>
                <div>
                    <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Зеркало</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px;letter-spacing:0.3px;">
                        Отправь ссылку — получи профиль друга
                    </div>
                </div>
            </div>

            <!-- ТАБЫ -->
            <div style="display:flex;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                        border-radius:14px;padding:4px;margin-bottom:24px;">
                <button class="mirror-tab-btn active" id="tab-reflections" onclick="switchMirrorTab('reflections')">
                    👥 Мои отражения
                </button>
                <button class="mirror-tab-btn inactive" id="tab-create" onclick="switchMirrorTab('create')">
                    🔗 Создать ссылку
                </button>
            </div>

            <div id="mirrorTabContent"></div>
        </div>
    `;
    log.debug('Mirrors', 'Main screen rendered');

    switchMirrorTab('reflections');
}

function switchMirrorTab(tab) {
    log.info('Mirrors', 'switchMirrorTab called', { tab });
    ['reflections','create'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.classList.add('active'); 
            btn.classList.remove('inactive');
        } else {
            btn.classList.remove('active'); 
            btn.classList.add('inactive');
        }
    });
    const content = document.getElementById('mirrorTabContent');
    if (tab === 'reflections') showReflectionsTab(content);
    else showCreateLinkTab(content);
}

// ============================================
// ТАБ: ОТРАЖЕНИЯ (УЛУЧШЕННАЯ ВЕРСИЯ)
// ============================================
async function showReflectionsTab(container) {
    log.info('Mirrors', 'showReflectionsTab called');
    
    container.innerHTML = `
        <div style="padding:32px;text-align:center;color:rgba(255,255,255,0.3);">
            <div class="mirror-skeleton" style="width:60%;margin:0 auto 8px;height:12px;"></div>
            <div class="mirror-skeleton" style="width:40%;margin:0 auto;height:12px;"></div>
        </div>`;

    try {
        let data = _getCachedReflections();
        
        if (!data) {
            log.debug('Mirrors', 'Fetching reflections from API');
            data = await apiGetReflections(window.USER_ID);
            _setCachedReflections(data);
        } else {
            log.debug('Mirrors', 'Using cached reflections');
        }
        
        const reflections = data.reflections || [];
        const stats = data.stats || {};
        
        log.info('Mirrors', 'Reflections loaded', { count: reflections.length, stats });

        if (!reflections.length) {
            log.debug('Mirrors', 'No reflections found, showing empty state');
            container.innerHTML = `
                <div style="animation:mirrorFadeIn 0.4s ease;">
                    <div style="text-align:center;padding:40px 20px;background:rgba(255,255,255,0.02);
                                border:1px dashed rgba(255,255,255,0.1);border-radius:24px;margin-bottom:16px;">
                        <div style="font-size:52px;margin-bottom:16px;opacity:0.6;">🌑</div>
                        <div style="font-size:17px;font-weight:600;color:#fff;margin-bottom:8px;">Зеркало пусто</div>
                        <div style="font-size:13px;color:rgba(255,255,255,0.35);line-height:1.7;max-width:280px;margin:0 auto 24px;">
                            Отправь ссылку другу. Как только он пройдёт тест — его профиль откроется тебе.
                        </div>
                        <button onclick="switchMirrorTab('create')"
                            style="background:linear-gradient(135deg,#00d4ff,#0099cc);color:#fff;border:none;
                                   border-radius:12px;padding:13px 28px;font-size:14px;font-weight:600;
                                   cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(0,212,255,0.15);">
                            Создать первую ссылку →
                        </button>
                    </div>
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
                                border-radius:20px;padding:20px;">
                        <div class="mirror-section-label">КАК ЭТО РАБОТАЕТ</div>
                        ${['1️⃣ Создаёшь уникальную ссылку',
                           '2️⃣ Отправляешь другу в Telegram или MAX',
                           '3️⃣ Друг проходит тест по твоей ссылке',
                           '4️⃣ Тебе открывается его полный профиль + интимный + 4F ключи'].map(s => `
                            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;
                                        border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:rgba(255,255,255,0.6);">
                                ${s}
                            </div>`).join('')}
                    </div>
                </div>`;
            return;
        }

        // СТАТИСТИКА
        let html = `
            <div style="display:flex;gap:10px;margin-bottom:20px;animation:mirrorFadeIn 0.3s ease;">
                <div class="mirror-stat-card">
                    <div style="font-size:30px;font-weight:700;color:#fff;">${stats.total_mirrors || 0}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.3px;">Создано зеркал</div>
                </div>
                <div class="mirror-stat-card" style="border-color:rgba(255,107,59,0.2);">
                    <div style="font-size:30px;font-weight:700;background:linear-gradient(135deg,#00d4ff,#0099cc);
                                -webkit-background-clip:text;-webkit-text-fill-color:transparent;">${reflections.length}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.3px;">Отражений</div>
                </div>
                <button onclick="forceRefreshReflections()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:0 16px;cursor:pointer;">
                    🔄
                </button>
            </div>
            <div class="mirror-section-label">ОТРАЖЕНИЯ</div>`;

        reflections.forEach((ref, i) => {
            const name = _escapeHtml(ref.friend_name) || `Пользователь ${i+1}`;
            const profile = _escapeHtml(ref.friend_profile_code) || '—';
            const date = ref.completed_at ? new Date(ref.completed_at).toLocaleDateString('ru') : '';
            const vectors = ref.friend_vectors || {};
            
            // Получаем контекст друга (город, возраст, пол)
            const friendContext = ref.friend_context || {};
            const city = friendContext.city ? _escapeHtml(friendContext.city) : null;
            const age = friendContext.age ? friendContext.age : null;
            const gender = friendContext.gender === 'male' ? '♂️' : friendContext.gender === 'female' ? '♀️' : null;
            
            // Город + возраст + пол в одну строку
            const locationParts = [];
            if (city) locationParts.push(city);
            if (age) locationParts.push(`${age} лет`);
            if (gender) locationParts.push(gender);
            const locationString = locationParts.join(' • ');
            
            // Значения векторов
            const sb = Math.round(vectors.СБ || 4);
            const tf = Math.round(vectors.ТФ || 4);
            const ub = Math.round(vectors.УБ || 4);
            const chv = Math.round(vectors.ЧВ || 4);
            
            const getColor = (v) => v <= 2 ? '#3b82ff' : v <= 4 ? '#f39c12' : '#ff6b3b';
            
            log.debug('Mirrors', `Rendering reflection ${i}`, { name, profile, city, age, gender, vectors: { sb, tf, ub, chv } });

            html += `
                <div class="mirror-card" style="animation-delay:${i*0.06}s; cursor:pointer;"
                     onclick="showFriendProfile(${JSON.stringify(ref).replace(/"/g,'&quot;')})">
                    
                    <!-- ШАПКА: аватар + имя + профиль -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #ff6b3b, #ff3b3b); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white;">
                                ${name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-size: 16px; font-weight: 600; color: white;">${name}</div>
                                ${locationString ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px;">📍 ${locationString}</div>` : ''}
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.08); border-radius: 20px; padding: 4px 10px; font-size: 10px; color: #ff6b3b; font-family: monospace;">
                            ${profile}
                        </div>
                    </div>
                    
                    <!-- ВЕКТОРЫ (4 компактные плитки) -->
                    <div style="display: flex; gap: 8px; margin: 12px 0;">
                        <div class="mirror-vector-badge">
                            <div class="mirror-vector-value" style="color: ${getColor(sb)};">${sb}/6</div>
                            <div class="mirror-vector-label">САМООБОРОНА</div>
                        </div>
                        <div class="mirror-vector-badge">
                            <div class="mirror-vector-value" style="color: ${getColor(tf)};">${tf}/6</div>
                            <div class="mirror-vector-label">ФИНАНСЫ</div>
                        </div>
                        <div class="mirror-vector-badge">
                            <div class="mirror-vector-value" style="color: ${getColor(ub)};">${ub}/6</div>
                            <div class="mirror-vector-label">МЫШЛЕНИЕ</div>
                        </div>
                        <div class="mirror-vector-badge">
                            <div class="mirror-vector-value" style="color: ${getColor(chv)};">${chv}/6</div>
                            <div class="mirror-vector-label">ОТНОШЕНИЯ</div>
                        </div>
                    </div>
                    
                    <!-- ФУТЕР: дата + кнопка -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 10px; color: rgba(255,255,255,0.3);">📅 ${date}</div>
                        <div style="font-size: 11px; color: rgba(255,107,59,0.7);">Открыть профиль →</div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        log.info('Mirrors', 'Reflections tab rendered successfully');
    } catch(e) {
        log.error('Mirrors', 'Error in showReflectionsTab', { error: e.message, stack: e.stack });
        container.innerHTML = `
            <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
                        border-radius:16px;padding:24px;text-align:center;color:rgba(59,130,246,0.8);">
                <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
                <div style="font-size:13px;">Ошибка загрузки: ${e.message}</div>
                <button onclick="switchMirrorTab('reflections')"
                    style="margin-top:12px;background:rgba(255,255,255,0.08);color:#fff;border:none;
                           border-radius:8px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:12px;">
                    Повторить
                </button>
            </div>`;
    }
}

// ============================================
// ТАБ: СОЗДАТЬ ССЫЛКУ
// ============================================
async function showCreateLinkTab(container) {
    log.info('Mirrors', 'showCreateLinkTab called');
    container.innerHTML = `
        <div style="animation:mirrorFadeIn 0.35s ease;">

            <!-- ВЫБОР ПЛАТФОРМЫ -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:16px;">
                <div class="mirror-section-label">ВЫБЕРИ ПЛАТФОРМУ</div>

                <button class="mirror-action-btn" onclick="generateMirrorLink('telegram')">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(0,136,204,0.15);
                                border:1px solid rgba(0,136,204,0.3);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">✈️</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">Telegram</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">t.me/Nanotech_varik_bot?start=mirror_...</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>

                <button class="mirror-action-btn" onclick="generateMirrorLink('max')">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,107,59,0.12);
                                border:1px solid rgba(255,107,59,0.25);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">⚡</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">MAX</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">max.ru/id502238728185_bot?start=mirror_...</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>

                <button class="mirror-action-btn" onclick="generateMirrorLink('web')" style="margin-bottom:0;">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.06);
                                border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">🌐</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">Веб-ссылка</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">meysternlp.ru/fredi/?ref=...</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>
            </div>

            <!-- РЕЗУЛЬТАТ -->
            <div id="generatedLinkBlock"></div>

            <!-- ЧТО ОТКРОЕТСЯ -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:16px;">
                <div class="mirror-section-label">ЧТО ОТКРОЕТСЯ ТЕБЕ</div>

                ${[
                    ['rgba(255,255,255,0.5)','🧠','ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ','Тип восприятия, векторы поведения (СБ/ТФ/УБ/ЧВ), уровень мышления, глубинные паттерны'],
                    ['#3b82ff','🔞','ИНТИМНЫЙ ПРОФИЛЬ','Что возбуждает, что гасит желание, сексуальный паттерн, главная потребность'],
                    ['#f39c12','🔑','4F КЛЮЧИ','🔥 Ярость — как погасить   🏃 Страх — якоря безопасности   🧬 Желание — слова-пароли   🍽 Деньги — мотиваторы'],
                ].map(([col,emoji,title,desc]) => `
                    <div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:22px;flex-shrink:0;margin-top:2px;">${emoji}</div>
                        <div>
                            <div style="font-size:12px;font-weight:700;color:${col};letter-spacing:0.5px;margin-bottom:4px;">${title}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">${desc}</div>
                        </div>
                    </div>`).join('')}

                <div style="padding-top:14px;">
                    <button onclick="showProfileExample()"
                        style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.12);
                               border-radius:12px;padding:12px;color:rgba(255,255,255,0.5);font-size:13px;
                               font-weight:600;cursor:pointer;font-family:inherit;
                               transition:all 0.2s;letter-spacing:0.3px;"
                        onmouseover="this.style.borderColor='rgba(255,107,59,0.4)';this.style.color='rgba(255,107,59,0.8)'"
                        onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='rgba(255,255,255,0.5)'">
                        👁 Посмотреть пример профиля
                    </button>
                </div>
            </div>
        </div>`;
}

async function generateMirrorLink(mirrorType) {
    log.info('Mirrors', 'generateMirrorLink called', { mirrorType });
    const block = document.getElementById('generatedLinkBlock');
    if (!block) return;
    
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">
            <div class="mirror-skeleton" style="width:50%;margin:0 auto 8px;"></div>
            <div class="mirror-skeleton" style="width:70%;margin:0 auto;"></div>
        </div>`;

    try {
        const data = await apiCreateMirror(window.USER_ID, mirrorType);
        if (!data.success) throw new Error(data.error || 'Ошибка создания зеркала');

        const link = data.link;
        const text = data.invite_text;
        const icons = {telegram:'✈️', max:'⚡', web:'🌐'};

        log.info('Mirrors', 'Mirror created successfully', { mirrorCode: data.mirror_code, link });

        block.innerHTML = `
            <div style="background:rgba(255,107,59,0.06);border:1px solid rgba(255,107,59,0.25);
                        border-radius:20px;padding:20px;margin-bottom:16px;animation:mirrorFadeIn 0.3s ease;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                    <span style="font-size:20px;">${icons[mirrorType] || '🔗'}</span>
                    <span style="font-size:14px;font-weight:700;color:#ff6b3b;">Ссылка создана!</span>
                </div>

                <div class="mirror-link-box">${_escapeHtml(link)}</div>

                <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;
                            font-size:12px;color:rgba(255,255,255,0.45);line-height:1.7;
                            font-style:italic;margin-bottom:14px;border:1px solid rgba(255,255,255,0.06);">
                    «${_escapeHtml(text)}»
                </div>

                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <button class="mirror-copy-btn"
                        style="background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;"
                        onclick="copyMirrorLink('${_escapeHtml(link)}')">
                        🔗 Ссылку
                    </button>
                    <button class="mirror-copy-btn"
                        style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);"
                        onclick="shareMirrorLink('${_escapeHtml(link)}','${_escapeHtml(text).replace(/'/g,"\\'")}')">
                        📤 Поделиться
                    </button>
                </div>
                <button class="mirror-copy-btn"
                    style="width:100%;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#fff;"
                    onclick="copyMirrorWithText('${_escapeHtml(link)}','${_escapeHtml(text).replace(/'/g,"\\'")}')">
                    📋 Скопировать текст + ссылку
                </button>
            </div>`;
            
        _clearReflectionsCache();
        
    } catch(e) {
        log.error('Mirrors', 'generateMirrorLink failed', { error: e.message });
        block.innerHTML = `
            <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
                        border-radius:16px;padding:16px;margin-bottom:16px;text-align:center;
                        color:rgba(59,130,246,0.8);font-size:13px;">
                ❌ ${_escapeHtml(e.message)}
            </div>`;
    }
}

function copyMirrorLink(link) {
    log.info('Mirrors', 'copyMirrorLink called');
    _copyToClipboard(link).then(success => {
        if (success && typeof showToast === 'function') showToast('✅ Ссылка скопирована!');
        else if (typeof showToast === 'function') showToast('❌ Не удалось скопировать', 'error');
    });
}

function copyMirrorWithText(link, text) {
    log.info('Mirrors', 'copyMirrorWithText called');
    const full = text + '\n\n' + link;
    _copyToClipboard(full).then(success => {
        if (success && typeof showToast === 'function') showToast('✅ Текст и ссылка скопированы!');
        else if (typeof showToast === 'function') showToast('❌ Не удалось скопировать', 'error');
    });
}

function shareMirrorLink(link, text) {
    log.info('Mirrors', 'shareMirrorLink called');
    if (navigator.share) {
        navigator.share({ title: 'Фреди — психологический профиль', text, url: link })
            .then(() => log.info('Mirrors', 'Share successful'))
            .catch(e => log.warn('Mirrors', 'Share cancelled or failed', { error: e.message }));
    } else {
        copyMirrorLink(link);
    }
}

// ============================================
// ПРОФИЛЬ ДРУГА (остаётся без изменений)
// ============================================
async function showFriendProfile(ref) {
    log.info('Mirrors', 'showFriendProfile called', { hasRef: !!ref });
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:20px 16px;text-align:center;">
            <div class="mirror-loading-spinner"></div>
            <div style="margin-top:12px;color:var(--text-secondary);">Загрузка профиля...</div>
        </div>`;
    
    ref = _fixMirrorRef(ref);
    
    const name = (ref.friend_name && ref.friend_name !== 'Друг' && ref.friend_name !== 'друг') 
        ? _escapeHtml(ref.friend_name) 
        : 'Пользователь';
    const profile = _escapeHtml(ref.friend_profile_code) || '—';
    const vectors = ref.friend_vectors || {};
    const patterns = ref.friend_deep_patterns || {};
    const aiProfile = ref.friend_ai_profile || '';
    const date = ref.completed_at ? new Date(ref.completed_at).toLocaleDateString('ru') : '';
    const mirrorCode = ref.mirror_code || '';

    const vNames = {'СБ':'Самооборона','ТФ':'Финансы','УБ':'Убеждения','ЧВ':'Чувства'};
    const vColor = v => v<=2?'#3b82ff':v<=4?'#f39c12':'#ff6b3b';

    log.debug('Mirrors', 'Rendering friend profile', { name, profile, hasVectors: !!Object.keys(vectors).length });

    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:20px 16px;padding-bottom:max(80px,calc(env(safe-area-inset-bottom,0px) + 80px));animation:mirrorFadeIn 0.35s ease;">

            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <button onclick="showMirrorsScreen()"
                    style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.06);
                           border:1px solid rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:16px;
                           display:flex;align-items:center;justify-content:center;flex-shrink:0;
                           transition:all 0.2s;font-family:inherit;
                           onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                           onmouseout="this.style.background='rgba(255,255,255,0.06)'">←</button>
                <div style="font-size:17px;font-weight:600;color:#fff;">🪞 Профиль отражения</div>
            </div>

            <div style="background:linear-gradient(135deg,rgba(255,107,59,0.1),rgba(255,59,59,0.05));
                        border:1px solid rgba(255,107,59,0.2);border-radius:24px;
                        padding:28px;margin-bottom:16px;text-align:center;">
                <div style="width:68px;height:68px;border-radius:50%;margin:0 auto 14px;
                            background:linear-gradient(135deg,rgba(255,107,59,0.4),rgba(255,59,59,0.2));
                            border:2px solid rgba(255,107,59,0.4);
                            display:flex;align-items:center;justify-content:center;
                            font-size:28px;font-weight:700;color:#fff;
                            box-shadow:0 8px 24px rgba(255,59,59,0.2);">
                    ${name.charAt(0).toUpperCase()}
                </div>
                <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4);font-family:'SF Mono',monospace;
                            letter-spacing:1px;margin-bottom:4px;">${profile}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.25);">Тест пройден: ${date}</div>
            </div>

            ${Object.keys(vectors).length ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">ВЕКТОРЫ ПОВЕДЕНИЯ</div>
                ${Object.entries(vectors).map(([k,v]) => {
                    const val = typeof v === 'number' ? v : 4;
                    return `
                    <div style="margin-bottom:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="font-size:13px;color:rgba(255,255,255,0.6);">${_escapeHtml(vNames[k] || k)}</span>
                            <span style="font-size:13px;font-weight:700;color:${vColor(val)};">${val.toFixed(1)}/6</span>
                        </div>
                        <div class="mirror-vector-bar-track">
                            <div class="mirror-vector-bar-fill" style="width:${Math.round(val/6*100)}%;background:${vColor(val)};"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>` : '<div class="mirror-info-block" style="text-align:center;color:rgba(255,255,255,0.4);">Нет данных о векторах</div>'}

            ${Object.keys(patterns).length ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">ГЛУБИННЫЕ ПАТТЕРНЫ</div>
                ${patterns.attachment ? `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);">Привязанность</span>
                    <span style="font-size:13px;font-weight:600;color:#fff;">${_escapeHtml(patterns.attachment)}</span>
                </div>` : ''}
                ${patterns.core_fears ? `
                <div style="display:flex;justify-content:space-between;padding:10px 0;align-items:flex-start;gap:12px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);flex-shrink:0;">Страхи</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.6);text-align:right;">${Array.isArray(patterns.core_fears) ? patterns.core_fears.map(f => _escapeHtml(f)).join(', ') : _escapeHtml(patterns.core_fears)}</span>
                </div>` : ''}
            </div>` : ''}

            ${aiProfile ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">AI ПРОФИЛЬ</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
                    ${_escapeHtml(aiProfile.substring(0,500))}${aiProfile.length>500?'…':''}
                </div>
            </div>` : ''}

            <div style="display:flex;gap:10px;margin-bottom:12px;">
                <button onclick="loadIntimateProfile('${mirrorCode}')"
                    style="flex:1;background:rgba(59,130,246,0.08);color:#3b82ff;
                           border:1px solid rgba(59,130,246,0.25);border-radius:14px;
                           padding:14px;font-size:13px;font-weight:600;cursor:pointer;
                           font-family:inherit;transition:all 0.2s;">
                    🔞 Интимный профиль
                </button>
                <button onclick="load4FKeys('${mirrorCode}')"
                    style="flex:1;background:rgba(243,156,18,0.08);color:#f39c12;
                           border:1px solid rgba(243,156,18,0.25);border-radius:14px;
                           padding:14px;font-size:13px;font-weight:600;cursor:pointer;
                           font-family:inherit;transition:all 0.2s;">
                    🔑 4F ключи
                </button>
            </div>

            <div id="friendExtraContent"></div>

            <button onclick="showMirrorsScreen()"
                style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.08);
                       border-radius:14px;padding:14px;color:rgba(255,255,255,0.3);font-size:13px;
                       cursor:pointer;font-family:inherit;margin-top:8px;transition:all 0.2s;">
                ← Назад к отражениям
            </button>
        </div>`;
}

async function loadIntimateProfile(mirrorCode) {
    log.info('Mirrors', 'loadIntimateProfile called', { mirrorCode });
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode || !block) return;
    
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border-radius:16px;padding:20px;margin-bottom:12px;text-align:center;">
            <div class="mirror-loading-spinner"></div>
            <div style="margin-top:12px;color:var(--text-secondary);">Загрузка интимного профиля...</div>
        </div>`;
    
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/intimate');
        const data = await res.json();
        log.debug('Mirrors', 'Intimate profile response', { success: data.success });
        
        if (!data.success) throw new Error(data.error);
        const i = data.intimate;

        let html = `
            <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);
                        border-radius:20px;padding:20px;margin-bottom:12px;animation:mirrorFadeIn 0.3s ease;">
                <div style="font-size:12px;font-weight:700;color:#3b82ff;letter-spacing:0.8px;
                            text-transform:uppercase;margin-bottom:16px;">🔞 Интимный профиль</div>`;

        const sections = [
            ['💋 Что возбуждает', i.sexual_triggers || []],
            ['❄️ Что гасит желание', i.sexual_blockers || []],
        ];
        sections.forEach(([label, items]) => {
            if (items && items.length) {
                html += `<div style="margin-bottom:14px;">
                    <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">${label}</div>
                    ${items.map(t => `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;
                        border-bottom:1px solid rgba(255,255,255,0.04);">• ${_escapeHtml(t)}</div>`).join('')}
                </div>`;
            }
        });

        if (i.intimacy_pattern) html += `
            <div style="margin-bottom:12px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:6px;">🧬 Паттерн близости</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7;">${_escapeHtml(i.intimacy_pattern)}</div>
            </div>`;

        if (i.key_need) html += `
            <div style="background:rgba(59,130,246,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="font-size:11px;color:#3b82ff;letter-spacing:0.5px;margin-bottom:4px;">💡 Главная потребность</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">${_escapeHtml(i.key_need)}</div>
            </div>`;

        if (i.approach_tip) html += `
            <div style="background:rgba(255,107,59,0.08);border-radius:12px;padding:14px;">
                <div style="font-size:11px;color:#ff6b3b;letter-spacing:0.5px;margin-bottom:4px;">🎯 Как подойти</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);">${_escapeHtml(i.approach_tip)}</div>
            </div>`;

        html += '</div>';
        block.innerHTML = html;
        log.info('Mirrors', 'Intimate profile loaded successfully');
    } catch(e) {
        log.error('Mirrors', 'loadIntimateProfile failed', { error: e.message });
        block.innerHTML = `<div style="background:rgba(59,130,246,0.08);border-radius:14px;padding:16px;
            text-align:center;color:rgba(59,130,246,0.7);font-size:13px;margin-bottom:12px;">❌ ${_escapeHtml(e.message)}</div>`;
    }
}

async function load4FKeys(mirrorCode) {
    log.info('Mirrors', 'load4FKeys called', { mirrorCode });
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode || !block) return;
    
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border-radius:16px;padding:20px;margin-bottom:12px;text-align:center;">
            <div class="mirror-loading-spinner"></div>
            <div style="margin-top:12px;color:var(--text-secondary);">Загрузка 4F ключей...</div>
        </div>`;
    
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/4f-keys');
        const data = await res.json();
        log.debug('Mirrors', '4F keys response', { success: data.success });
        
        if (!data.success) throw new Error(data.error);
        const keys = data.keys;
        const palette = {'1F':'#ff6b3b','2F':'#3b82ff','3F':'#a855f7','4F':'#f39c12'};

        let html = '';
        Object.entries(keys).forEach(([code, k], idx) => {
            const col = palette[code] || '#ff6b3b';
            html += `
                <div class="mirror-4f-card" style="border-color:${col};animation-delay:${idx*0.08}s">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                        <span style="font-size:20px;">${k.emoji || ''}</span>
                        <div>
                            <div style="font-size:14px;font-weight:700;color:#fff;">${_escapeHtml(code)} — ${_escapeHtml(k.title || '')}</div>
                        </div>
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">🎯 ТРИГГЕРЫ</div>
                    ${(k.triggers || []).map(t => `
                        <div style="font-size:13px;color:rgba(255,255,255,0.65);padding:5px 0;
                                    border-bottom:1px solid rgba(255,255,255,0.04);">• ${_escapeHtml(t)}</div>`).join('')}
                    <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:12px;margin-top:12px;">
                        <div style="font-size:11px;color:${col};letter-spacing:0.5px;margin-bottom:4px;">🔑 КЛЮЧ</div>
                        <div style="font-size:13px;font-weight:600;color:#fff;">${_escapeHtml(k.key_phrase || '')}</div>
                    </div>
                    ${k.technique ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:10px;line-height:1.5;">⚡ ${_escapeHtml(k.technique)}</div>` : ''}
                    ${k.insight ? `<div style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:6px;font-style:italic;">${_escapeHtml(k.insight)}</div>` : ''}
                </div>`;
        });
        block.innerHTML = html;
        log.info('Mirrors', '4F keys loaded successfully');
    } catch(e) {
        log.error('Mirrors', 'load4FKeys failed', { error: e.message });
        block.innerHTML = `<div style="background:rgba(243,156,18,0.08);border-radius:14px;padding:16px;
            text-align:center;color:rgba(243,156,18,0.7);font-size:13px;margin-bottom:12px;">❌ ${_escapeHtml(e.message)}</div>`;
    }
}

// ============================================
// ПРИМЕР ПРОФИЛЯ (остаётся без изменений)
// ============================================
function showProfileExample() {
    log.info('Mirrors', 'showProfileExample called');
    const container = document.getElementById('screenContainer');
    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:20px 16px;padding-bottom:max(80px,calc(env(safe-area-inset-bottom,0px) + 80px));animation:mirrorFadeIn 0.35s ease;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <button onclick="showMirrorsScreen()"
                    style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.06);
                           border:1px solid rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:16px;
                           display:flex;align-items:center;justify-content:center;font-family:inherit;">←</button>
                <div style="font-size:17px;font-weight:600;color:#fff;">👁 Пример профиля</div>
            </div>

            <div style="display:flex;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                        border-radius:14px;padding:4px;margin-bottom:20px;">
                <button class="mirror-tab-btn active" id="ex-tab-basic" onclick="switchExampleTab('basic')">🧠 Профиль</button>
                <button class="mirror-tab-btn inactive" id="ex-tab-intimate" onclick="switchExampleTab('intimate')">🔞 Интимный</button>
                <button class="mirror-tab-btn inactive" id="ex-tab-4f" onclick="switchExampleTab('4f')">🔑 4F ключи</button>
            </div>

            <div id="exampleTabContent"></div>

            <button onclick="switchMirrorTab('create');showMirrorsScreen()"
                style="width:100%;margin-top:16px;background:linear-gradient(135deg,#00d4ff,#0099cc);
                       color:#fff;border:none;border-radius:14px;padding:15px;font-size:14px;
                       font-weight:600;cursor:pointer;font-family:inherit;
                       box-shadow:0 6px 16px rgba(0,212,255,0.15);">
                Создать своё зеркало →
            </button>
        </div>`;
    switchExampleTab('basic');
}

function switchExampleTab(tab) {
    log.debug('Mirrors', 'switchExampleTab called', { tab });
    ['basic','intimate','4f'].forEach(t => {
        const btn = document.getElementById('ex-tab-'+t);
        if (!btn) return;
        if (t===tab) { btn.classList.add('active'); btn.classList.remove('inactive'); }
        else { btn.classList.remove('active'); btn.classList.add('inactive'); }
    });
    const c = document.getElementById('exampleTabContent');
    if (!c) return;
    if (tab==='basic') showExampleBasic(c);
    else if (tab==='intimate') showExampleIntimate(c);
    else showExample4F(c);
}

function showExampleBasic(c) {
    const data = [['СБ','Самооборона',4,'#3b82ff'],['ТФ','Финансы',2,'#f39c12'],['УБ','Убеждения',5,'#ff6b3b'],['ЧВ','Чувства',3,'#a855f7']];
    c.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(255,107,59,0.1),rgba(255,59,59,0.05));
                    border:1px solid rgba(255,107,59,0.2);border-radius:24px;padding:24px;text-align:center;margin-bottom:12px;">
            <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,rgba(255,107,59,0.4),rgba(255,59,59,0.2));
                        border:2px solid rgba(255,107,59,0.4);margin:0 auto 12px;display:flex;align-items:center;
                        justify-content:center;font-size:26px;font-weight:700;color:#fff;">А</div>
            <div style="font-size:19px;font-weight:700;color:#fff;">Алексей</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);font-family:'SF Mono',monospace;margin-top:4px;letter-spacing:1px;">
                ПРАКТИКО-ОРИЕНТИРОВАННЫЙ · УР. 5
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:20px;margin-bottom:12px;">
            <div class="mirror-section-label">ВЕКТОРЫ ПОВЕДЕНИЯ</div>
            ${data.map(([k,name,v,col]) => `
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:13px;color:rgba(255,255,255,0.6);">${name} (${k})</span>
                        <span style="font-size:13px;font-weight:700;color:${col};">${v}/6</span>
                    </div>
                    <div class="mirror-vector-bar-track">
                        <div class="mirror-vector-bar-fill" style="width:${Math.round(v/6*100)}%;background:${col};"></div>
                    </div>
                </div>`).join('')}
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:20px;">
            <div class="mirror-section-label">ГЛУБИННЫЕ ПАТТЕРНЫ</div>
            ${[['Привязанность','Избегающий'],['Страхи','потеря контроля, зависимость'],['Убеждение','«Я должен справляться сам»']].map(([l,v])=>`
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);">${l}</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;text-align:right;max-width:60%;">${v}</span>
                </div>`).join('')}
        </div>`;
}

function showExampleIntimate(c) {
    c.innerHTML = `
        <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);
                    border-radius:20px;padding:20px;">
            <div style="font-size:12px;font-weight:700;color:#3b82ff;letter-spacing:0.8px;
                        text-transform:uppercase;margin-bottom:16px;">🔞 Интимный профиль — пример</div>

            <div style="margin-bottom:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">💋 ЧТО ВОЗБУЖДАЕТ</div>
                ${['Когда не торопят и дают время','Визуальные стимулы — важнее тактильных','Ощущение контроля в близости'].map(t=>
                    `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`
                ).join('')}
            </div>

            <div style="margin-bottom:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">❄️ ЧТО ГАСИТ ЖЕЛАНИЕ</div>
                ${['Давление и требования','Эмоциональные сцены перед близостью','Ощущение что его оценивают'].map(t=>
                    `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`
                ).join('')}
            </div>

            <div style="background:rgba(59,130,246,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="font-size:11px;color:#3b82ff;letter-spacing:0.5px;margin-bottom:4px;">💡 Главная потребность</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">Ощущение свободы даже в близости</div>
            </div>

            <div style="background:rgba(255,107,59,0.08);border-radius:12px;padding:14px;">
                <div style="font-size:11px;color:#ff6b3b;letter-spacing:0.5px;margin-bottom:4px;">🎯 Как подойти</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);">Близость через общие задачи и проекты. Прикосновения как якорь — без давления.</div>
            </div>
        </div>`;
}

function showExample4F(c) {
    const keys = [
        ['🔥','1F','Ярость / Нападение','#ff6b3b',
            ['Критика при свидетелях','Обесценивание усилий','Игнорирование границ'],
            '«Я вижу как много ты сделал» — снижает напряжение',
            'Пауза 3 сек + имя'],
        ['🏃','2F','Страх / Бегство','#3b82ff',
            ['Вопросы о будущем','Требования и давление','Повышение голоса'],
            '«Я никуда не ухожу, просто поговорим»',
            'Без дедлайнов — безопасная среда'],
        ['🧬','3F','Желание / Секс','#a855f7',
            ['Особая интонация','Зрительный контакт 4+ сек','Неожиданные касания'],
            'Слова: «только мы», «никуда не торопимся»',
            'Плечо → запястье → основание шеи'],
        ['🍽','4F','Деньги / Поглощение','#f39c12',
            ['Упоминание конкурентов','Идеи заработка','Вызов'],
            '«Как думаешь, можно это монетизировать?»',
            'Задача с измеримым результатом'],
    ];
    c.innerHTML = keys.map(([emoji,code,title,col,triggers,key,tech],idx) => `
        <div class="mirror-4f-card" style="border-color:${col};animation-delay:${idx*0.08}s">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <span style="font-size:20px;">${emoji}</span>
                <div>
                    <div style="font-size:14px;font-weight:700;color:#fff;">${code} — ${title}</div>
                </div>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">🎯 ТРИГГЕРЫ</div>
            ${triggers.map(t=>`<div style="font-size:13px;color:rgba(255,255,255,0.65);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`).join('')}
            <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:12px;margin-top:12px;">
                <div style="font-size:11px;color:${col};letter-spacing:0.5px;margin-bottom:4px;">🔑 КЛЮЧ</div>
                <div style="font-size:13px;font-weight:600;color:#fff;">${key}</div>
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px;">⚡ ${tech}</div>
        </div>`).join('');
}

// ============================================
// ФОРСИРОВАННОЕ ОБНОВЛЕНИЕ
// ============================================
async function forceRefreshReflections() {
    log.info('Mirrors', 'forceRefreshReflections called');
    _clearReflectionsCache();
    const container = document.getElementById('mirrorTabContent');
    if (container) {
        await showReflectionsTab(container);
        if (typeof showToast === 'function') showToast('✅ Список обновлён', 'success');
    }
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showMirrorsScreen = showMirrorsScreen;
window.switchMirrorTab = switchMirrorTab;
window.generateMirrorLink = generateMirrorLink;
window.copyMirrorLink = copyMirrorLink;
window.copyMirrorWithText = copyMirrorWithText;
window.shareMirrorLink = shareMirrorLink;
window.showFriendProfile = showFriendProfile;
window.loadIntimateProfile = loadIntimateProfile;
window.load4FKeys = load4FKeys;
window.showProfileExample = showProfileExample;
window.switchExampleTab = switchExampleTab;
window.forceRefreshReflections = forceRefreshReflections;

window.showMirrorDebugLogs = function() {
    const logs = localStorage.getItem('mirror_debug_logs');
    if (logs) {
        console.table(JSON.parse(logs));
    } else {
        console.log('No debug logs found');
    }
};

console.log('✅ mirrors.js v3.0 загружен (улучшенные карточки с городом, возрастом, полом)');
