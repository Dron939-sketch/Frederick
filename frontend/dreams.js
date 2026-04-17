// ============================================
// dreams.js — Интерпретация снов через AI
// Версия: 4.0 — полная версия с исправлением микрофона
// ============================================

// ============================================
// ЕДИНЫЙ СПОСОБ ПОЛУЧЕНИЯ USER_ID
// ============================================
function _drGetUserId() {
    if (window.CONFIG?.USER_ID) return window.CONFIG.USER_ID;
    if (window.getUserId) return window.getUserId();
    if (window.USER_ID) return window.USER_ID;
    try {
        const id = localStorage.getItem('fredi_user_id');
        if (id) return id;
        const permId = localStorage.getItem('fredi_permanent_user_id');
        if (permId) return permId;
    } catch(e) {}
    return 'unknown';
}

// ============================================
// СОСТОЯНИЕ
// ============================================
let _drCurrentText = '';
let _drHistory = [];
let _drNeedsClarification = false;
let _drClarificationQuestion = '';
let _drLastSpokenQuestion = '';
let _drClarificationSessionId = null;
let _drClarificationCount = 0;
let _drActiveTab = 'record';
let _drIsInterpreting = false;
let _drDraftSaveTimer = null;
let _drChatSession = [];
let _drChatFinalShown = false;

// Кэш профиля
let _drProfileCache = {
    data: null,
    expires_at: null,
    ttl: 5 * 60 * 1000
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function _drEscapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _drPlayBeep(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        if (type === 'start') {
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.1;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
        } else if (type === 'end') {
            oscillator.frequency.value = 440;
            gainNode.gain.value = 0.1;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
            oscillator.stop(audioContext.currentTime + 0.2);
        }
        setTimeout(() => audioContext.close(), 500);
    } catch(e) { console.warn('Beep failed:', e); }
}

function _drAutoSaveDraft(text) {
    if (_drDraftSaveTimer) clearTimeout(_drDraftSaveTimer);
    _drDraftSaveTimer = setTimeout(() => {
        if (text && text.trim()) {
            const draft = { text: text, last_updated: new Date().toISOString() };
            const userId = _drGetUserId();
            localStorage.setItem(`dream_draft_${userId}`, JSON.stringify(draft));
            const indicator = document.getElementById('draftIndicator');
            if (indicator) {
                indicator.textContent = '💾 Сохранено';
                indicator.style.opacity = '1';
                setTimeout(() => indicator.style.opacity = '0', 2000);
            }
        }
    }, 1000);
}

function _drLoadDraft() {
    try {
        const userId = _drGetUserId();
        const saved = localStorage.getItem(`dream_draft_${userId}`);
        if (saved) {
            const draft = JSON.parse(saved);
            if (draft.text && draft.text.trim()) {
                _drCurrentText = draft.text;
                return draft.text;
            }
        }
    } catch(e) {}
    return '';
}

function _drClearDraft() {
    const userId = _drGetUserId();
    localStorage.removeItem(`dream_draft_${userId}`);
    _drCurrentText = '';
}

function _drValidateDream(text) {
    const errors = [];
    if (!text || text.trim().length === 0) errors.push('🌙 Расскажите свой сон');
    if (text.length > 5000) errors.push(`📏 Сон слишком длинный (${text.length}/5000 символов)`);
    if (text.split(' ').length < 5) errors.push('📝 Опишите сон подробнее (минимум 5 слов)');
    return { valid: errors.length === 0, errors };
}

async function _drGetCachedProfile() {
    const now = Date.now();
    if (_drProfileCache.data && _drProfileCache.expires_at > now) return _drProfileCache.data;
    const userId = _drGetUserId();
    const status = await getUserStatus();
    const profileData = await apiCall(`/api/get-profile/${userId}`);
    _drProfileCache.data = { status, profileData };
    _drProfileCache.expires_at = now + _drProfileCache.ttl;
    return _drProfileCache.data;
}

function _drClearProfileCache() {
    _drProfileCache.data = null;
    _drProfileCache.expires_at = null;
}

function _drGenerateFallbackInterpretation(dreamText, userName) {
    const dreamLower = (dreamText || '').toLowerCase();
    if (dreamLower.includes('лететь') || dreamLower.includes('полёт')) {
        return `🌙 ${userName}, твой сон о полёте говорит о стремлении к свободе. Ты чувствуешь, что можешь больше, чем проявляешь сейчас. Сделай сегодня что-то новое — это придаст уверенности.`;
    }
    if (dreamLower.includes('падать') || dreamLower.includes('падение')) {
        return `🌙 ${userName}, сон о падении указывает на страх потерять контроль. Возможно, в жизни есть что-то, что вызывает тревогу. Сделай маленький шаг к восстановлению контроля.`;
    }
    if (dreamLower.includes('мотоцикл') || dreamLower.includes('машина') || dreamLower.includes('ехать')) {
        return `🌙 ${userName}, сон о движении символизирует твой жизненный путь. Ты в поиске новых впечатлений. Не бойся менять направление — иногда лучшие открытия случаются на неожиданных маршрутах.`;
    }
    if (dreamLower.includes('кино') || dreamLower.includes('фильм')) {
        return `🌙 ${userName}, сон о кинотеатре говорит о том, что ты наблюдаешь за жизнью со стороны. Пришло время стать активным участником, а не зрителем. Что ты можешь сделать уже сегодня?`;
    }
    if (dreamLower.includes('вода') || dreamLower.includes('море') || dreamLower.includes('река')) {
        return `🌙 ${userName}, вода во сне символизирует эмоции. Ты находишься в потоке перемен. Позволь себе плыть по течению — не всё нужно контролировать. Доверься интуиции.`;
    }
    return `🌙 ${userName}, твой сон отражает глубинные переживания. Обрати внимание на эмоции во сне — они подскажут, что действительно важно. Рекомендую записывать сны и наблюдать за повторяющимися образами.`;
}

// ============================================
// ПРОВЕРКА МИКРОФОНА
// ============================================
async function _drCheckMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('[dreams] ✅ Микрофон доступен');
        return true;
    } catch (error) {
        console.error('[dreams] ❌ Нет доступа к микрофону:', error);
        if (error.name === 'NotAllowedError') {
            if (typeof showToast === 'function') {
                showToast('🎤 Разрешите доступ к микрофону в настройках браузера', 'error');
            }
        } else if (error.name === 'NotFoundError') {
            if (typeof showToast === 'function') {
                showToast('🎤 Микрофон не найден. Подключите устройство', 'error');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('🎤 Ошибка доступа к микрофону', 'error');
            }
        }
        return false;
    }
}

// ============================================
// СТИЛИ (КРАСИВЫЙ UI)
// ============================================
function _drInjectStyles() {
    if (document.getElementById('dr-v4-styles')) return;
    const style = document.createElement('style');
    style.id = 'dr-v4-styles';
    style.textContent = `
        .dr-tabs { display:flex; gap:6px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:60px; padding:5px; margin-bottom:24px; }
        .dr-tab { flex-shrink:0; padding:10px 20px; border-radius:40px; border:none; background:transparent; color:rgba(255,255,255,0.5); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .dr-tab.active { background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; box-shadow:0 4px 12px rgba(255,59,59,0.3); }
        .dr-tab:not(.active):hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8); }
        
        .dr-record-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:32px; padding:28px; }
        .dr-voice-btn { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#ff6b3b,#ff3b3b); border:none; cursor:pointer; margin:0 auto; display:flex; align-items:center; justify-content:center; transition:all 0.2s; box-shadow:0 8px 20px rgba(255,59,59,0.3); }
        .dr-voice-btn:active { transform:scale(0.95); }
        .dr-voice-btn.recording { animation:drPulse 1.5s infinite; }
        .dr-voice-btn-compact { width:52px; height:52px; margin:0; box-shadow:0 4px 12px rgba(255,59,59,0.2); }
        .dr-voice-icon { font-size:28px; }
        
        .recording-indicator { background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); border-radius:28px; padding:16px 24px; margin:12px auto; text-align:center; max-width:280px; border:1px solid rgba(255,107,59,0.3); }
        .recording-wave { display:flex; justify-content:center; gap:4px; margin-bottom:12px; }
        .recording-wave span { width:5px; height:5px; background:#ff6b6b; border-radius:3px; animation:drWave 0.5s ease infinite; }
        .recording-wave span:nth-child(2) { animation-delay:0.1s; }
        .recording-wave span:nth-child(3) { animation-delay:0.2s; }
        .recording-wave span:nth-child(4) { animation-delay:0.3s; }
        .recording-timer { font-size:28px; font-weight:700; color:#ff6b6b; margin:8px 0; font-family:monospace; }
        .recording-level { width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden; margin:12px 0; }
        .level-fill { height:100%; width:0%; background:linear-gradient(90deg,#ff6b6b,#ff9800); transition:width 0.05s linear; }
        .recording-hint { font-size:11px; color:rgba(255,255,255,0.5); }
        
        @keyframes drPulse { 0% { transform:scale(1); box-shadow:0 0 0 0 rgba(255,107,59,0.4); } 70% { transform:scale(1.05); box-shadow:0 0 0 15px rgba(255,107,59,0); } 100% { transform:scale(1); box-shadow:0 0 0 0 rgba(255,107,59,0); } }
        @keyframes drWave { 0%,100% { height:5px; } 50% { height:20px; } }
        
        .dr-textarea { width:100%; padding:16px; border-radius:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; font-family:inherit; font-size:14px; min-height:120px; resize:vertical; margin:16px 0; box-sizing:border-box; line-height:1.6; transition:all 0.2s; }
        .dr-textarea:focus { outline:none; border-color:#ff6b3b; background:rgba(255,107,59,0.05); }
        .dr-textarea::placeholder { color:rgba(255,255,255,0.3); }
        
        .dr-btn { padding:14px 28px; border-radius:40px; border:none; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; }
        .dr-btn-ghost { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; }
        .dr-btn-ghost:hover { background:rgba(255,255,255,0.15); }
        .dr-btn.loading .btn-text { display:none; }
        .dr-btn.loading .btn-loader { display:inline-block; }
        .btn-loader { display:none; animation:drSpin 0.8s linear infinite; }
        
        .dr-btn-send { width:52px; height:52px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; font-size:22px; background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; flex-shrink:0; }
        
        .dr-interpretation { background:linear-gradient(135deg,rgba(255,107,59,0.08),rgba(255,59,59,0.04)); border:1px solid rgba(255,107,59,0.2); border-radius:24px; padding:24px; margin-top:20px; }
        .dr-interpretation-text { line-height:1.8; color:rgba(255,255,255,0.85); font-size:14px; white-space:pre-wrap; }
        .dr-interpretation-actions { display:flex; gap:12px; justify-content:flex-end; margin-top:16px; }
        .dr-interpretation-btn { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); padding:8px 20px; border-radius:30px; cursor:pointer; font-size:12px; transition:all 0.2s; font-family:inherit; color:rgba(255,255,255,0.7); }
        .dr-interpretation-btn:hover { background:rgba(255,255,255,0.15); color:#fff; }
        
        .dr-chat-wrap { display:flex; flex-direction:column; gap:16px; min-height:60vh; }
        .dr-chat-log { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:24px; padding:20px; min-height:40vh; max-height:60vh; overflow-y:auto; }
        .dr-chat-welcome { text-align:center; padding:32px 20px; }
        .dr-chat-welcome h2 { margin:0 0 8px 0; color:#fff; }
        .dr-chat-welcome p { color:rgba(255,255,255,0.5); max-width:480px; margin:0 auto; line-height:1.6; }
        .dr-chat-system { text-align:center; color:rgba(255,255,255,0.4); font-size:12px; padding:8px 14px; margin:8px auto; max-width:70%; background:rgba(255,255,255,0.05); border-radius:20px; }
        .dr-chat-row { display:flex; gap:12px; margin:16px 0; align-items:flex-start; }
        .dr-chat-row.is-user { flex-direction:row-reverse; }
        .dr-chat-avatar { width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        .dr-chat-row.is-user .dr-chat-avatar { background:linear-gradient(135deg,#ff6b3b,#ff3b3b); }
        .dr-chat-bubble { max-width:min(78%, 560px); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:12px 18px; color:#fff; line-height:1.55; font-size:14px; }
        .dr-chat-row.is-user .dr-chat-bubble { background:linear-gradient(135deg,rgba(255,107,59,0.15),rgba(255,59,59,0.08)); border-color:rgba(255,107,59,0.3); }
        .dr-chat-label { font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; letter-spacing:0.5px; }
        .dr-chat-text { white-space:pre-wrap; word-break:break-word; }
        .dr-bubble-actions { display:flex; gap:8px; margin-top:8px; justify-content:flex-end; }
        .dr-bubble-action { padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.7); cursor:pointer; font-size:11px; transition:all 0.2s; }
        .dr-bubble-action:hover { background:rgba(255,255,255,0.15); color:#fff; }
        
        .dr-chat-composer { position:sticky; bottom:0; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:24px; backdrop-filter:blur(10px); padding:16px; }
        .dr-textarea-chat { flex:1; margin:0 !important; min-height:52px; max-height:150px; border-radius:16px; }
        .dr-history-item { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:20px; padding:18px; margin-bottom:12px; cursor:pointer; transition:all 0.2s; }
        .dr-history-item:hover { background:rgba(255,255,255,0.08); transform:translateX(4px); border-color:rgba(255,107,59,0.3); }
        .dr-history-date { font-size:11px; color:rgba(255,255,255,0.4); margin-bottom:8px; }
        .dr-history-preview { font-size:14px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dr-history-tags { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
        .dr-history-tag { font-size:9px; background:rgba(255,107,59,0.2); padding:3px 10px; border-radius:20px; color:#ff6b3b; }
        
        .dr-status { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:20px; margin:16px 0; text-align:center; }
        .dr-status-steps { display:flex; justify-content:center; gap:8px; margin-bottom:12px; }
        .dr-status-step { display:flex; align-items:center; gap:6px; font-size:11px; color:rgba(255,255,255,0.4); opacity:0.5; transition:opacity 0.3s; }
        .dr-status-step.active { opacity:1; color:#ff6b3b; }
        .dr-status-step.done { opacity:0.8; color:#4caf50; }
        .dr-status-dot { width:8px; height:8px; border-radius:50%; background:currentColor; }
        .dr-status-step.active .dr-status-dot { animation:drPulse 1.5s infinite; }
        .dr-status-arrow { color:rgba(255,255,255,0.1); font-size:10px; }
        .dr-status-text { font-size:13px; color:rgba(255,255,255,0.5); margin-top:8px; }
        
        .draft-indicator { font-size:10px; color:#ff6b3b; text-align:right; margin-top:-8px; margin-bottom:8px; opacity:0; transition:opacity 0.3s; }
        .error-message { background:rgba(255,59,59,0.1); border:1px solid rgba(255,59,59,0.3); border-radius:14px; padding:12px 16px; margin:10px 0; font-size:12px; color:#ff6b6b; }
        
        @keyframes drSpin { to { transform:rotate(360deg); } }
        @keyframes drTextareaGlow { 0% { box-shadow:0 0 0 0 rgba(255,107,59,0.4); border-color:#ff6b3b; } 70% { box-shadow:0 0 0 10px rgba(255,107,59,0); border-color:rgba(255,107,59,0.4); } 100% { box-shadow:0 0 0 0 rgba(255,107,59,0); border-color:rgba(255,255,255,0.12); } }
        .dr-textarea-highlight { animation:drTextareaGlow 2s ease-out; }
        
        @keyframes drBtnPulse { 0%,100% { box-shadow:0 0 0 0 rgba(255,107,59,0.4); transform:scale(1); } 50% { box-shadow:0 0 0 8px rgba(255,107,59,0); transform:scale(1.02); } }
        .dr-btn-pulse { animation:drBtnPulse 1s ease-in-out 3; }
        
        @keyframes drAISpin { to { transform:rotate(360deg); } }
        .dr-ai-overlay { position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8); backdrop-filter:blur(12px); }
        .dr-ai-box { background:#1a1a1c; border:1px solid rgba(255,107,59,0.3); border-radius:32px; padding:40px 32px; max-width:360px; width:calc(100% - 40px); text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
        .dr-ai-spinner { width:64px; height:64px; margin:0 auto 20px; border:4px solid rgba(255,107,59,0.2); border-top-color:#ff6b3b; border-radius:50%; animation:drAISpin 0.9s linear infinite; }
        .dr-ai-title { font-size:18px; font-weight:700; color:#fff; margin-bottom:8px; }
        .dr-ai-sub { font-size:13px; color:rgba(255,255,255,0.6); line-height:1.5; margin-bottom:16px; }
        .dr-ai-dots { display:flex; justify-content:center; gap:8px; }
        .dr-ai-dots span { width:8px; height:8px; border-radius:50%; background:#ff6b3b; display:inline-block; animation:drAIDot 1.2s ease-in-out infinite; }
        .dr-ai-dots span:nth-child(2) { animation-delay:0.15s; }
        .dr-ai-dots span:nth-child(3) { animation-delay:0.3s; }
        @keyframes drAIDot { 0%,80%,100% { transform:scale(0.6); opacity:0.4; } 40% { transform:scale(1); opacity:1; } }
        
        @media (max-width: 480px) {
            .dr-voice-btn { width:70px; height:70px; }
            .recording-timer { font-size:22px; }
            .dr-chat-bubble { max-width:85%; }
        }
        
        [data-theme="light"] .dr-record-card,
        [data-theme="light"] .dr-chat-log,
        [data-theme="light"] .dr-interpretation,
        [data-theme="light"] .dr-history-item,
        [data-theme="light"] .dr-status,
        [data-theme="light"] .dr-tabs { background:rgba(0,0,0,0.03); border-color:rgba(0,0,0,0.08); }
        [data-theme="light"] .dr-textarea,
        [data-theme="light"] .dr-chat-composer { background:rgba(0,0,0,0.03); border-color:rgba(0,0,0,0.1); color:#1a1a1c; }
        [data-theme="light"] .dr-textarea { color:#1a1a1c; }
        [data-theme="light"] .dr-chat-bubble { background:rgba(0,0,0,0.05); color:#1a1a1c; }
        [data-theme="light"] .dr-chat-row.is-user .dr-chat-bubble { background:linear-gradient(135deg,rgba(255,107,59,0.1),rgba(255,59,59,0.05)); }
        [data-theme="light"] .dr-ai-box { background:#fff; color:#1a1a1c; }
        [data-theme="light"] .dr-ai-title { color:#1a1a1c; }
        [data-theme="light"] .dr-ai-sub { color:rgba(0,0,0,0.6); }
    `;
    document.head.appendChild(style);
}

// ============================================
// ОВЕРЛЕЙ И СТАТУС
// ============================================
function _drShowAIOverlay(title, subtitle) {
    _drInjectStyles();
    let el = document.getElementById('dr-ai-overlay');
    if (el) {
        const t = el.querySelector('.dr-ai-title');
        const s = el.querySelector('.dr-ai-sub');
        if (t) t.textContent = '🌙 ' + (title || 'Фреди толкует сон');
        if (s) s.textContent = subtitle || 'Это может занять 20-40 секунд. Не закрывайте страницу.';
        el.style.display = 'flex';
        return;
    }
    el = document.createElement('div');
    el.id = 'dr-ai-overlay';
    el.className = 'dr-ai-overlay';
    el.innerHTML = `
        <div class="dr-ai-box">
            <div class="dr-ai-spinner"></div>
            <div class="dr-ai-title">🌙 ${(title || 'Фреди толкует сон').replace(/</g,'&lt;')}</div>
            <div class="dr-ai-sub">${(subtitle || 'Это может занять 20-40 секунд. Не закрывайте страницу.').replace(/</g,'&lt;')}</div>
            <div class="dr-ai-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    document.body.appendChild(el);
}

function _drHideAIOverlay() {
    const el = document.getElementById('dr-ai-overlay');
    if (el) el.remove();
}

function _drShowStatus(stage, text) {
    let statusEl = document.getElementById('drStatusIndicator');
    if (!stage) {
        if (statusEl) statusEl.remove();
        return;
    }
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'drStatusIndicator';
        const body = document.getElementById('drBody');
        if (body) body.prepend(statusEl);
    }
    const stages = ['recording', 'transcribing', 'interpreting'];
    const labels = ['🎤 Запись', '📝 Расшифровка', '🌙 Толкование'];
    const activeIdx = stages.indexOf(stage);
    statusEl.innerHTML = `
        <div class="dr-status">
            <div class="dr-status-steps">
                ${stages.map((s, i) => `
                    <span class="dr-status-step ${i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '')}">
                        <span class="dr-status-dot"></span>${labels[i]}
                    </span>
                    ${i < stages.length - 1 ? '<span class="dr-status-arrow">→</span>' : ''}
                `).join('')}
            </div>
            <div class="dr-status-text">${text || ''}</div>
        </div>
    `;
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================
async function showDreamsScreen() {
    _drInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    const completed = await isTestCompleted();
    await _drLoadHistory();
    _drRender(container, completed);
}

function _drRender(container, completed) {
    const TABS = [
        { id: 'record', label: '🎙️ Рассказать сон' },
        { id: 'history', label: '📜 История снов' }
    ];
    const tabsHtml = TABS.map(t => `<button class="dr-tab${_drActiveTab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
    let body = '';
    if (_drActiveTab === 'record') body = _drRenderRecordTab(completed);
    if (_drActiveTab === 'history') body = _drRenderHistoryTab(completed);
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drBack" style="margin-bottom:16px;">◀️ НАЗАД</button>
            <div class="content-header" style="margin-bottom:20px;">
                <div class="content-emoji" style="font-size:48px;">🌙</div>
                <h1 class="content-title" style="font-size:28px;margin:8px 0;">Толкование снов</h1>
                <p style="font-size:13px;color:rgba(255,255,255,0.5);">Фреди анализирует символику ваших снов</p>
            </div>
            <div class="dr-tabs">${tabsHtml}</div>
            <div id="drBody">${body}</div>
        </div>
    `;
    document.getElementById('drBack').onclick = () => { if (typeof renderDashboard === 'function') renderDashboard(); else location.reload(); };
    document.querySelectorAll('.dr-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _drActiveTab = btn.dataset.tab;
            _drRender(container, completed);
        });
    });
    if (_drActiveTab === 'record' && completed) {
        _drInitVoiceButton();
        _drInitButtons();
    }
}

// ============================================
// ВКЛАДКА ЗАПИСИ
// ============================================
function _drRenderRecordTab(completed) {
    if (!completed) {
        return `
            <div class="dr-record-card" style="text-align:center;padding:48px 24px;">
                <div style="font-size:72px;margin-bottom:16px;">🌙</div>
                <h3 style="margin-bottom:12px;">Для толкования снов нужен профиль</h3>
                <p style="color:rgba(255,255,255,0.5);margin-bottom:24px;">Пройдите тест, чтобы Фреди мог давать персонализированные толкования</p>
                <button class="dr-btn" onclick="startTest()" style="background:linear-gradient(135deg,#ff6b3b,#ff3b3b);">📊 Пройти тест</button>
            </div>
        `;
    }
    const draftText = _drLoadDraft();
    const displayText = draftText || _drCurrentText;
    const canSkip = _drChatSession.some(m => m.role === 'bot' && m.kind === 'clarification');
    const isClarification = _drNeedsClarification;
    const placeholder = isClarification ? 'Напиши ответ на вопрос Фреди…' : 'Опишите ваш сон максимально подробно…';
    const composerHint = isClarification ? '🎤 Нажмите и удерживайте кнопку, чтобы ответить голосом' : '🎤 Нажмите и удерживайте кнопку, чтобы надиктовать сон';
    const sendLabel = isClarification ? '📤 Ответить' : '🔮 Толковать сон';
    return `
        <div class="dr-chat-wrap">
            <div class="dr-chat-log" id="drChatLog">${_drRenderChatMessages()}</div>
            <div class="dr-chat-composer">
                <div id="validationError" class="error-message" style="display:none;"></div>
                <div style="display:flex;align-items:flex-end;gap:12px;">
                    <button class="dr-voice-btn dr-voice-btn-compact" id="dreamVoiceBtn" title="Нажмите и удерживайте для записи">
                        <span class="dr-voice-icon">🎤</span>
                    </button>
                    <textarea id="dreamTextInput" class="dr-textarea dr-textarea-chat" rows="2" placeholder="${placeholder}" style="margin:0;">${_drEscapeHtml(displayText)}</textarea>
                    <button class="dr-btn dr-btn-send" id="interpretDreamBtn" title="${sendLabel}">
                        <span class="btn-text">${isClarification ? '📤' : '🔮'}</span>
                        <span class="btn-loader">⏳</span>
                    </button>
                </div>
                <div class="draft-indicator" id="draftIndicator"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.4);">${composerHint}</span>
                    <div style="display:flex;gap:8px;">
                        ${canSkip ? '<button class="dr-btn-ghost dr-btn-small" id="skipClarificationBtn" style="padding:6px 12px;font-size:11px;">⏭️ Пропустить</button>' : ''}
                        <button class="dr-btn-ghost dr-btn-small" id="newChatBtn" style="padding:6px 12px;font-size:11px;">🔄 Новый сон</button>
                        ${_drHistory.length ? '<button class="dr-btn-ghost dr-btn-small" id="exportHistoryBtn" style="padding:6px 12px;font-size:11px;">📥 Экспорт</button>' : ''}
                    </div>
                </div>
            </div>
        </div>
        <div id="interpretationResult" style="display:none"></div>
    `;
}

function _drRenderChatMessages() {
    if (_drChatSession.length === 0) {
        return `
            <div class="dr-chat-welcome">
                <div style="font-size:64px;margin-bottom:16px;">🌙</div>
                <h2 style="margin:0 0 8px 0;">Расскажите свой сон</h2>
                <p style="color:rgba(255,255,255,0.5);max-width:480px;margin:0 auto;line-height:1.6;">
                    Нажмите и удерживайте 🎤 ниже, чтобы надиктовать сон голосом.<br>
                    Фреди может задать пару уточнений — отвечайте так же: голосом или текстом.
                </p>
            </div>
        `;
    }
    return _drChatSession.map((m, i) => _drRenderChatBubble(m, i)).join('');
}

function _drRenderChatBubble(msg, idx) {
    const role = msg.role || 'bot';
    const isUser = role === 'user';
    const isSystem = role === 'system';
    if (isSystem) return `<div class="dr-chat-system">${_drEscapeHtml(msg.text)}</div>`;
    const avatar = isUser ? '👤' : '🌙';
    const label = isUser ? 'Вы' : (msg.kind === 'clarification' ? `Фреди · уточнение ${msg.clarNumber || ''}/3` : 'Фredi');
    const text = _drEscapeHtml(msg.text || '');
    const actions = !isUser && msg.text ? `<div class="dr-bubble-actions"><button class="dr-bubble-action" data-speak="${idx}">🔊 Озвучить</button></div>` : '';
    return `
        <div class="dr-chat-row ${isUser ? 'is-user' : 'is-bot'}">
            <div class="dr-chat-avatar">${avatar}</div>
            <div class="dr-chat-bubble">
                <div class="dr-chat-label">${label}</div>
                <div class="dr-chat-text">${text.replace(/\n/g, '<br>')}</div>
                ${actions}
            </div>
        </div>
    `;
}

function _drAddChatMessage(role, text, extra) {
    _drChatSession.push(Object.assign({ role, text, ts: Date.now() }, extra || {}));
    const log = document.getElementById('drChatLog');
    if (log) { log.innerHTML = _drRenderChatMessages(); log.scrollTop = log.scrollHeight; }
}

function _drResetChatSession() {
    _drChatSession = [];
    _drChatFinalShown = false;
    _drNeedsClarification = false;
    _drClarificationQuestion = '';
    _drClarificationCount = 0;
    _drClarificationSessionId = null;
    _drCurrentText = '';
    _drClearDraft();
    const input = document.getElementById('dreamTextInput');
    if (input) input.value = '';
}

// ============================================
// ВКЛАДКА ИСТОРИИ
// ============================================
function _drRenderHistoryTab(completed) {
    if (!completed) {
        return `
            <div class="dr-record-card" style="text-align:center;padding:48px 24px;">
                <div style="font-size:72px;margin-bottom:16px;">🌙</div>
                <h3 style="margin-bottom:12px;">Для просмотра истории нужен профиль</h3>
                <p style="color:rgba(255,255,255,0.5);margin-bottom:24px;">Пройдите тест, чтобы сохранять и анализировать свои сны</p>
                <button class="dr-btn" onclick="startTest()">📊 Пройти тест</button>
            </div>
        `;
    }
    if (_drHistory.length === 0) {
        return `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">📜</div>
                <h3 style="margin-bottom:8px;">У вас пока нет сохранённых снов</h3>
                <p style="color:rgba(255,255,255,0.5);">Расскажите свой первый сон на вкладке «Рассказать сон»</p>
            </div>
        `;
    }
    return `
        <div class="dr-history-header" style="display:flex;gap:12px;margin-bottom:20px;">
            <input type="text" id="historySearch" class="dr-history-search" placeholder="🔍 Поиск по снам..." style="flex:1;padding:12px 16px;border-radius:30px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:inherit;">
            <button class="dr-btn-ghost" id="exportHistoryBtn" style="padding:10px 20px;border-radius:30px;">📥 Экспорт</button>
        </div>
        <div id="historyList">
            ${_drHistory.map((dream, index) => `
                <div class="dr-history-item" onclick="viewDreamDetails(${index})">
                    <div class="dr-history-date">📅 ${_drEscapeHtml(dream.date)}</div>
                    <div class="dr-history-preview">${_drEscapeHtml(dream.text.substring(0, 100))}${dream.text.length > 100 ? '...' : ''}</div>
                    <div class="dr-history-tags">${dream.tags ? dream.tags.map(t => `<span class="dr-history-tag">${_drEscapeHtml(t)}</span>`).join('') : ''}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// ГОЛОСОВАЯ ЗАПИСЬ (ИСПРАВЛЕНА)
// ============================================
async function _drInitVoiceButton() {
    const voiceBtn = document.getElementById('dreamVoiceBtn');
    console.log('[dreams] _drInitVoiceButton: btn=', !!voiceBtn, '| voiceManager=', !!window.voiceManager);
    
    if (!voiceBtn) {
        console.warn('[dreams] ⚠️ Кнопка dreamVoiceBtn не найдена');
        return;
    }
    
    // Проверяем и запрашиваем разрешение на микрофон
    const hasMicrophone = await _drCheckMicrophonePermission();
    if (!hasMicrophone) {
        voiceBtn.style.opacity = '0.4';
        voiceBtn.title = 'Нет доступа к микрофону';
        return;
    }
    
    if (!window.voiceManager) {
        console.warn('[dreams] ⚠️ voiceManager не инициализирован, пытаемся инициализировать');
        if (typeof initVoice === 'function') {
            if (typeof showToast === 'function') {
                showToast('🎤 Инициализация голосового ввода...', 'info');
            }
            await initVoice();
        }
        if (!window.voiceManager) {
            voiceBtn.style.opacity = '0.4';
            voiceBtn.title = 'Голосовой ввод недоступен';
            voiceBtn.onclick = () => {
                if (typeof showToast === 'function') {
                    showToast('🎤 Голосовой ввод временно недоступен', 'info');
                }
            };
            return;
        }
    }
    
    if (voiceBtn._dreamVoiceInited) return;
    voiceBtn._dreamVoiceInited = true;

    let isRecording = false;
    let recordingStartTime = null;
    let timerInterval = null;
    let levelInterval = null;
    let savedOnTranscript = null;
    let savedOnComplete = null;
    const MAX_RECORD_SECONDS = 60;
    
    let recordingIndicator = document.getElementById('recordingIndicator');
    if (!recordingIndicator) {
        recordingIndicator = document.createElement('div');
        recordingIndicator.id = 'recordingIndicator';
        recordingIndicator.className = 'recording-indicator';
        recordingIndicator.style.display = 'none';
        recordingIndicator.innerHTML = `
            <div class="recording-wave"><span></span><span></span><span></span><span></span></div>
            <div class="recording-timer" id="recordingTimer">0 сек</div>
            <div class="recording-level"><div class="level-fill"></div></div>
            <div class="recording-hint">🎙️ Говорите... Отпустите когда закончите</div>
        `;
        voiceBtn.parentNode.insertBefore(recordingIndicator, voiceBtn.nextSibling);
    }
    
    const getIcon = () => voiceBtn.querySelector('.dr-voice-icon');
    const uiCleanup = () => {
        if (timerInterval) clearInterval(timerInterval);
        if (levelInterval) clearInterval(levelInterval);
        isRecording = false;
        voiceBtn.classList.remove('recording');
        if (recordingIndicator) recordingIndicator.style.display = 'none';
        if (getIcon()) getIcon().textContent = '🎤';
    };
    const restoreHandlers = () => {
        if (!window.voiceManager) return;
        window.voiceManager.sttOnly = false;
        if (savedOnTranscript !== null) { window.voiceManager.onTranscript = savedOnTranscript; savedOnTranscript = null; }
        if (savedOnComplete !== null) { window.voiceManager.onTranscriptComplete = savedOnComplete; savedOnComplete = null; }
    };
    const stopRecording = () => {
        if (isRecording && window.voiceManager) window.voiceManager.stopRecording();
        uiCleanup();
        setTimeout(() => { if (savedOnTranscript !== null || savedOnComplete !== null) restoreHandlers(); }, 90000);
    };
    const onPressStart = async (e) => {
        e.preventDefault();
        if (isRecording) return;
        _drPlayBeep('start');
        if (navigator.vibrate) navigator.vibrate(50);
        recordingStartTime = Date.now();
        isRecording = true;
        voiceBtn.classList.add('recording');
        if (recordingIndicator) recordingIndicator.style.display = 'block';
        timerInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
            const timerEl = document.getElementById('recordingTimer');
            if (timerEl) timerEl.textContent = `${seconds} сек`;
            if (seconds >= MAX_RECORD_SECONDS) {
                stopRecording();
                _drShowStatus('transcribing', '📝 Расшифровываю запись...');
                if (typeof showToast === 'function') showToast('⏱️ Лимит записи 60 секунд', 'info');
            }
        }, 100);
        levelInterval = setInterval(() => {
            const level = window.voiceManager?.getAudioLevel?.() || 0;
            const fill = document.querySelector('.level-fill');
            if (fill) fill.style.width = `${Math.min(level * 100, 100)}%`;
        }, 50);
        window.voiceManager.sttOnly = true;
        savedOnTranscript = window.voiceManager.onTranscript;
        savedOnComplete = window.voiceManager.onTranscriptComplete;
        window.voiceManager.onTranscript = (text) => {
            const input = document.getElementById('dreamTextInput');
            if (!input) return;
            const currentText = input.value;
            input.value = currentText ? currentText + ' ' + text : text;
            _drCurrentText = input.value;
            _drAutoSaveDraft(_drCurrentText);
            input.scrollTop = input.scrollHeight;
        };
        window.voiceManager.onTranscriptComplete = (finalText) => {
            uiCleanup();
            restoreHandlers();
            _drShowStatus('transcribing', '📝 Расшифровываю...');
            setTimeout(() => {
                const input = document.getElementById('dreamTextInput');
                if (input && input.value.trim()) {
                    _drShowStatus(null);
                    if (typeof showToast === 'function') showToast('✅ Голос распознан. Проверь текст и нажми «Толковать сон»', 'success');
                    input.classList.add('dr-textarea-highlight');
                    setTimeout(() => input.classList.remove('dr-textarea-highlight'), 2500);
                    const btn = document.getElementById('interpretDreamBtn');
                    if (btn) btn.classList.add('dr-btn-pulse');
                    setTimeout(() => btn?.classList.remove('dr-btn-pulse'), 3000);
                } else {
                    _drShowStatus(null);
                    if (typeof showToast === 'function') showToast('❌ Не удалось распознать речь', 'error');
                }
            }, 500);
        };
        const started = await window.voiceManager.startRecording();
        if (!started) { stopRecording(); if (typeof showToast === 'function') showToast('🎤 Нет доступа к микрофону', 'error'); }
    };
    const onPressEnd = (e) => {
        e.preventDefault();
        if (!isRecording) return;
        stopRecording();
        _drShowStatus('transcribing', '📝 Расшифровываю запись...');
    };
    voiceBtn.addEventListener('mousedown', onPressStart);
    voiceBtn.addEventListener('mouseup', onPressEnd);
    voiceBtn.addEventListener('mouseleave', onPressEnd);
    voiceBtn.addEventListener('touchstart', onPressStart, { passive: false });
    voiceBtn.addEventListener('touchend', onPressEnd, { passive: false });
    voiceBtn.addEventListener('touchcancel', onPressEnd);
}

function _drInitButtons() {
    const interpretBtn = document.getElementById('interpretDreamBtn');
    const exportBtn = document.getElementById('exportHistoryBtn');
    if (interpretBtn) interpretBtn.addEventListener('click', () => _drInterpret());
    if (exportBtn) exportBtn.addEventListener('click', () => _drExportHistory());
    const skipBtn = document.getElementById('skipClarificationBtn');
    if (skipBtn) skipBtn.addEventListener('click', async () => {
        _drAddChatMessage('system', '⏭️ Ты пропустил уточнения. Фреди попытается дать толкование на основе уже сказанного.');
        _drNeedsClarification = false;
        _drClarificationCount = 3;
        const fallback = _drGenerateFallbackInterpretation(_drCurrentText, CONFIG.USER_NAME);
        _drAddChatMessage('bot', fallback, { kind: 'final' });
        _drSpeak(fallback);
        await _drSaveToHistory(_drCurrentText, fallback);
        _drResetChatSession();
    });
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) newChatBtn.addEventListener('click', () => { _drResetChatSession(); showDreamsScreen(); });
    const ta = document.getElementById('dreamTextInput');
    if (ta && !ta._drEnterBound) {
        ta._drEnterBound = true;
        ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _drInterpret(); } });
    }
    const log = document.getElementById('drChatLog');
    if (log && !log._drSpeakBound) {
        log._drSpeakBound = true;
        log.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-speak]');
            if (!btn) return;
            const idx = Number(btn.getAttribute('data-speak'));
            const msg = _drChatSession[idx];
            if (msg && msg.text) _drSpeak(msg.text);
        });
    }
}

// ============================================
// ИНТЕРПРЕТАЦИЯ
// ============================================
async function _drInterpret() {
    if (_drIsInterpreting) { if (typeof showToast === 'function') showToast('⏳ Интерпретация уже выполняется...', 'info'); return; }
    if (_drNeedsClarification) return _drSubmitClarification();
    const input = document.getElementById('dreamTextInput');
    const dreamText = input?.value.trim();
    const validation = _drValidateDream(dreamText);
    const errorDiv = document.getElementById('validationError');
    if (!validation.valid) {
        if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerHTML = validation.errors.map(e => `• ${e}`).join('<br>'); }
        return;
    }
    if (errorDiv) errorDiv.style.display = 'none';
    _drCurrentText = dreamText;
    _drAutoSaveDraft(dreamText);
    _drAddChatMessage('user', dreamText);
    if (input) input.value = '';
    const interpretBtn = document.getElementById('interpretDreamBtn');
    _drIsInterpreting = true;
    if (interpretBtn) interpretBtn.classList.add('loading');
    _drShowAIOverlay('Фреди толкует твой сон', 'Анализ символов, архетипов и связи с твоим профилем. 20-40 секунд.');
    try {
        const { status, profileData } = await _drGetCachedProfile();
        const userId = _drGetUserId();
        const response = await apiCall('/api/dreams/interpret', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId, dream_text: dreamText, user_name: CONFIG.USER_NAME,
                profile_code: status.profile_code, perception_type: profileData.profile?.perception_type,
                thinking_level: profileData.profile?.thinking_level, vectors: status.vectors,
                key_characteristic: profileData.profile?.key_characteristic, main_trap: profileData.profile?.main_trap,
                clarification_count: _drClarificationCount
            })
        });
        if (response.needs_clarification && _drClarificationCount < 3) {
            _drNeedsClarification = true;
            _drClarificationSessionId = response.session_id;
            _drClarificationQuestion = response.question || 'Расскажите подробнее об этом сне...';
            _drAddChatMessage('bot', _drClarificationQuestion, { kind: 'clarification', clarNumber: _drClarificationCount + 1 });
            _drSpeak(_drClarificationQuestion);
            await showDreamsScreen();
        } else if (response.needs_clarification && _drClarificationCount >= 3) {
            const fallback = response.interpretation || _drGenerateFallbackInterpretation(dreamText, CONFIG.USER_NAME);
            _drAddChatMessage('bot', fallback, { kind: 'final' });
            _drSpeak(fallback);
            await _drSaveToHistory(dreamText, fallback);
            _drResetChatSession();
        } else {
            const interpretText = response.interpretation || _drGenerateFallbackInterpretation(dreamText, CONFIG.USER_NAME);
            _drAddChatMessage('bot', interpretText, { kind: 'final' });
            _drSpeak(interpretText);
            await _drSaveToHistory(dreamText, interpretText);
            _drNeedsClarification = false;
            _drClarificationQuestion = '';
            _drClarificationCount = 0;
            _drChatFinalShown = true;
        }
        _drClearDraft();
        if (input) input.value = '';
        _drCurrentText = '';
    } catch (error) {
        console.error(error);
        const fallback = _drGenerateFallbackInterpretation(dreamText, CONFIG.USER_NAME);
        _drAddChatMessage('bot', fallback, { kind: 'final' });
        _drSpeak(fallback);
        await _drSaveToHistory(dreamText, fallback);
        _drResetChatSession();
        if (typeof showToast === 'function') showToast('⚠️ Использована локальная интерпретация', 'info');
    } finally {
        _drIsInterpreting = false;
        if (interpretBtn) interpretBtn.classList.remove('loading');
        _drHideAIOverlay();
    }
}

async function _drSubmitClarification() {
    const input = document.getElementById('dreamTextInput');
    const answer = (input?.value || '').trim();
    if (!answer) { if (typeof showToast === 'function') showToast('📝 Напишите ответ на вопрос', 'error'); return; }
    _drAddChatMessage('user', answer);
    if (input) input.value = '';
    _drClarificationCount++;
    const interpretBtn = document.getElementById('interpretDreamBtn');
    _drIsInterpreting = true;
    if (interpretBtn) interpretBtn.classList.add('loading');
    _drShowAIOverlay('Фреди анализирует твой ответ', 'Ждём следующий вопрос или толкование. 10-30 секунд.');
    try {
        const { status } = await _drGetCachedProfile();
        const userId = _drGetUserId();
        const response = await apiCall('/api/dreams/clarify', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId, session_id: _drClarificationSessionId, dream_text: _drCurrentText,
                answer: answer, user_name: CONFIG.USER_NAME, profile_code: status.profile_code,
                vectors: status.vectors, clarification_number: _drClarificationCount
            })
        });
        if (!response.needs_clarification && !response.interpretation) {
            response.interpretation = _drGenerateFallbackInterpretation(_drCurrentText, CONFIG.USER_NAME);
        }
        if (response.needs_clarification && _drClarificationCount < 3) {
            _drNeedsClarification = true;
            _drClarificationSessionId = response.session_id;
            _drClarificationQuestion = response.question || 'Расскажите подробнее...';
            _drAddChatMessage('bot', _drClarificationQuestion, { kind: 'clarification', clarNumber: _drClarificationCount + 1 });
            _drSpeak(_drClarificationQuestion);
            await showDreamsScreen();
        } else {
            _drNeedsClarification = false;
            _drClarificationQuestion = '';
            const interpretText = response.interpretation || _drGenerateFallbackInterpretation(_drCurrentText, CONFIG.USER_NAME);
            _drAddChatMessage('bot', interpretText, { kind: 'final' });
            _drSpeak(interpretText);
            await _drSaveToHistory(_drCurrentText, interpretText);
            _drCurrentText = '';
            _drClarificationCount = 0;
            _drChatFinalShown = true;
            if (input) input.value = '';
        }
    } catch (error) {
        console.error(error);
        const fallback = _drGenerateFallbackInterpretation(_drCurrentText, CONFIG.USER_NAME);
        _drAddChatMessage('bot', fallback, { kind: 'final' });
        _drSpeak(fallback);
        await _drSaveToHistory(_drCurrentText, fallback);
        _drResetChatSession();
        if (typeof showToast === 'function') showToast('⚠️ Использована локальная интерпретация', 'info');
    } finally {
        _drIsInterpreting = false;
        if (interpretBtn) interpretBtn.classList.remove('loading');
        _drHideAIOverlay();
    }
}

function _drSpeak(text) {
    if (!text) return;
    try {
        if (window.voiceManager?.textToSpeech) window.voiceManager.textToSpeech(text, 'psychologist');
        else if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; speechSynthesis.speak(u); }
    } catch (e) { console.warn(e); }
}

// ============================================
// ИСТОРИЯ
// ============================================
async function _drLoadHistory() {
    try { const userId = _drGetUserId(); const data = await apiCall(`/api/dreams/history/${userId}`); _drHistory = data.dreams || []; }
    catch { const userId = _drGetUserId(); const saved = localStorage.getItem(`dreams_history_${userId}`); _drHistory = saved ? JSON.parse(saved) : []; }
}

async function _drSaveToHistory(dreamText, interpretation) {
    const safeInterp = typeof interpretation === 'string' && interpretation.trim() ? interpretation : '';
    const newDream = { id: Date.now(), date: new Date().toLocaleDateString('ru-RU'), time: new Date().toLocaleTimeString('ru-RU'), text: dreamText, interpretation: safeInterp, tags: _drExtractTags(safeInterp), clarification_count: _drClarificationCount };
    _drHistory.unshift(newDream);
    if (_drHistory.length > 50) _drHistory.pop();
    const userId = _drGetUserId();
    localStorage.setItem(`dreams_history_${userId}`, JSON.stringify(_drHistory));
    try { await apiCall('/api/dreams/save', { method: 'POST', body: JSON.stringify({ user_id: userId, dream: newDream }) }); } catch (e) { console.warn(e); }
}

function _drExtractTags(interpretation) {
    const tags = [];
    const text = (typeof interpretation === 'string' ? interpretation : '').toLowerCase();
    if (!text) return tags;
    const keywords = ['тревога', 'страх', 'радость', 'уверенность', 'отношения', 'работа', 'дом', 'путешествие'];
    for (const kw of keywords) if (text.includes(kw)) tags.push(kw);
    return tags.slice(0, 3);
}

function _drExportHistory() {
    if (_drHistory.length === 0) { if (typeof showToast === 'function') showToast('📭 Нет снов для экспорта', 'info'); return; }
    const data = JSON.stringify(_drHistory, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const userId = _drGetUserId();
    a.download = `dreams_${userId}_${Date.now()}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('📥 История экспортирована', 'success');
}

function viewDreamDetails(index) {
    const dream = _drHistory[index];
    if (!dream) return;
    _drInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drDetailBack" style="margin-bottom:16px;">◀️ НАЗАД</button>
            <div class="content-header" style="margin-bottom:20px;">
                <div class="content-emoji" style="font-size:48px;">🌙</div>
                <h1 class="content-title" style="font-size:28px;margin:8px 0;">${_drEscapeHtml(dream.date)}</h1>
            </div>
            <div class="dr-record-card" style="text-align:left;padding:24px;">
                <h3 style="margin-bottom:12px;">✨ Ваш сон</h3>
                <div style="background:rgba(255,255,255,0.05);border-radius:20px;padding:20px;margin-bottom:24px;line-height:1.7;">${_drEscapeHtml(dream.text)}</div>
                <h3 style="margin-bottom:12px;">🌙 Толкование Фреди</h3>
                <div class="dr-interpretation" style="margin-top:0;padding:20px;">
                    <div style="line-height:1.8;">${_drEscapeHtml(dream.interpretation).replace(/\n/g, '<br>')}</div>
                    <div style="margin-top:16px;"><button class="dr-interpretation-btn" onclick="speakText('${dream.interpretation.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">🔊 Озвучить</button></div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('drDetailBack').onclick = () => showDreamsScreen();
}

function speakText(text) { if (window.voiceManager) window.voiceManager.textToSpeech(text, 'psychologist'); }
function saveDreamToJournal() { if (typeof showToast === 'function') showToast('💾 Сон сохранён в дневник', 'success'); }
async function speakInterpretation() {
    const resultDiv = document.getElementById('interpretationResult');
    const textDiv = resultDiv?.querySelector('.dr-interpretation-text');
    if (textDiv && window.voiceManager) await window.voiceManager.textToSpeech(textDiv.textContent || textDiv.innerText, 'psychologist');
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showDreamsScreen = showDreamsScreen;
window.viewDreamDetails = viewDreamDetails;
window.speakInterpretation = speakInterpretation;
window.speakText = speakText;
window.saveDreamToJournal = saveDreamToJournal;
window._drCheckMicrophonePermission = _drCheckMicrophonePermission;

console.log('✅ Модуль "Толкование снов" загружен (dreams.js v4.0)');
