// ============================================
// dreams.js — Интерпретация снов через AI
// Версия: 3.0 — с полным UX и исправлениями
// ============================================

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

// Чат-сессия: массив сообщений в одном окне. Сбрасывается после финального толкования.
// { role: 'user' | 'bot' | 'system', text, ts }
let _drChatSession = [];
let _drChatFinalShown = false;

// Кэш профиля
let _drProfileCache = {
    data: null,
    expires_at: null,
    ttl: 5 * 60 * 1000 // 5 минут
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function _drEscapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
            const draft = {
                text: text,
                last_updated: new Date().toISOString()
            };
            localStorage.setItem(`dream_draft_${CONFIG.USER_ID}`, JSON.stringify(draft));
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
        const saved = localStorage.getItem(`dream_draft_${CONFIG.USER_ID}`);
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
    localStorage.removeItem(`dream_draft_${CONFIG.USER_ID}`);
    _drCurrentText = '';
}

function _drValidateDream(text) {
    const errors = [];
    if (!text || text.trim().length === 0) {
        errors.push('🌙 Расскажите свой сон');
    }
    if (text.length > 5000) {
        errors.push(`📏 Сон слишком длинный (${text.length}/5000 символов). Сократите или разбейте на части.`);
    }
    if (text.split(' ').length < 5) {
        errors.push('📝 Опишите сон подробнее (минимум 5 слов)');
    }
    return { valid: errors.length === 0, errors };
}

async function _drGetCachedProfile() {
    const now = Date.now();
    if (_drProfileCache.data && _drProfileCache.expires_at > now) {
        console.log('Using cached profile');
        return _drProfileCache.data;
    }
    
    console.log('Fetching fresh profile');
    const status = await getUserStatus();
    const profileData = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
    
    _drProfileCache.data = { status, profileData };
    _drProfileCache.expires_at = now + _drProfileCache.ttl;
    
    return _drProfileCache.data;
}

function _drClearProfileCache() {
    _drProfileCache.data = null;
    _drProfileCache.expires_at = null;
}

// ============================================
// СТИЛИ
// ============================================
function _drInjectStyles() {
    if (document.getElementById('dr-v3-styles')) return;
    const style = document.createElement('style');
    style.id = 'dr-v3-styles';
    style.textContent = `
        .dr-tabs {
            display:flex;gap:4px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);
            border-radius:40px;padding:4px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none;
        }
        .dr-tabs::-webkit-scrollbar{display:none}
        .dr-tab {
            flex-shrink:0;padding:8px 12px;border-radius:30px;border:none;
            background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;
            font-family:inherit;cursor:pointer;transition:background 0.2s;min-height:36px;white-space:nowrap;
        }
        .dr-tab.active{background:rgba(224,224,224,0.14);color:var(--text-primary)}

        .dr-record-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:24px;padding:32px;text-align:center}
        .dr-voice-btn{width:100px;height:100px;border-radius:50px;background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);cursor:pointer;margin:20px auto;display:flex;align-items:center;justify-content:center;transition:transform 0.2s}
        .dr-voice-btn:active{transform:scale(0.95)}
        .dr-voice-btn.recording{animation:drPulse 1.5s infinite;background:rgba(224,224,224,0.25)}
        
        .recording-indicator {
            background: rgba(0,0,0,0.7);
            border-radius: 20px;
            padding: 12px 20px;
            margin: 10px auto;
            text-align: center;
            max-width: 250px;
        }
        .recording-wave span {
            display: inline-block;
            width: 4px;
            height: 4px;
            background: #ff6b6b;
            margin: 0 2px;
            animation: drWave 0.5s ease infinite;
            border-radius: 2px;
        }
        .recording-wave span:nth-child(2) { animation-delay: 0.1s; }
        .recording-wave span:nth-child(3) { animation-delay: 0.2s; }
        .recording-wave span:nth-child(4) { animation-delay: 0.3s; }
        .recording-timer { font-size: 24px; font-weight: bold; color: #ff6b6b; margin: 8px 0; }
        .recording-level { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; margin: 8px 0; }
        .level-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #ff6b6b, #ff9800); transition: width 0.05s linear; }
        .recording-hint { font-size: 11px; color: rgba(255,255,255,0.5); }
        
        @keyframes drPulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,107,107,0.4); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255,107,107,0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,107,107,0); }
        }
        @keyframes drWave {
            0%, 100% { height: 4px; }
            50% { height: 20px; }
        }
        
        .dr-textarea{width:100%;padding:16px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);font-family:inherit;font-size:14px;min-height:150px;resize:vertical;margin:20px 0;box-sizing:border-box;line-height:1.6}
        .dr-textarea::placeholder{color:var(--text-secondary)}
        .dr-textarea:focus{outline:none;border-color:rgba(224,224,224,0.35)}
        
        .dr-btn{padding:13px 24px;border-radius:40px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;
            background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);color:var(--text-primary)}
        .dr-btn-ghost{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.14);color:var(--text-secondary)}
        .dr-btn.loading .btn-text { display: none; }
        .dr-btn.loading .btn-loader { display: inline-block; }
        .btn-loader { display: none; animation: drSpin 0.8s linear infinite; }
        
        .dr-interpretation{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin-top:24px}
        .dr-interpretation-text{line-height:1.7;color:var(--text-secondary);margin-bottom:20px;font-size:14px;white-space:pre-wrap}
        .dr-interpretation-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:16px}
        .dr-interpretation-btn{background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.14);padding:8px 16px;border-radius:30px;cursor:pointer;font-size:12px;transition:all 0.2s;font-family:inherit;color:var(--text-secondary)}
        .dr-interpretation-btn:hover{background:rgba(224,224,224,0.16)}
        
        .dr-clarification-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin-top:20px;text-align:left}
        .clarification-progress{font-size:11px;color:var(--chrome);margin-bottom:12px;text-align:center}
        .dr-clarification-q{font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary)}
        .dr-clarification-input{width:100%;padding:12px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);margin-top:12px;font-family:inherit;resize:vertical;box-sizing:border-box;font-size:14px}
        .dr-clarification-input:focus{outline:none;border-color:rgba(224,224,224,0.35)}
        
        .dr-history-header{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .dr-history-search{flex:1;padding:10px 14px;border-radius:30px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.15);color:var(--text-primary);font-family:inherit;font-size:13px}
        .dr-history-search::placeholder{color:var(--text-secondary)}
        .dr-history-item{background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.08);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.2s}
        .dr-history-item:hover{background:rgba(224,224,224,0.08);transform:translateX(4px)}
        .dr-history-date{font-size:11px;color:var(--text-secondary);margin-bottom:8px}
        .dr-history-preview{font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dr-history-tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
        .dr-history-tag{font-size:9px;background:rgba(255,107,59,0.15);padding:2px 8px;border-radius:12px;color:#ff6b3b}
        
        .dr-loading{text-align:center;padding:40px}
        .dr-spinner{font-size:48px;animation:drSpin 1s linear infinite;display:inline-block}
        @keyframes drSpin{to{transform:rotate(360deg)}}
        
        .dr-status{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:16px;padding:16px;margin:16px 0;text-align:center}
        .dr-status-steps{display:flex;justify-content:center;gap:6px;margin-bottom:12px}
        .dr-status-step{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary);opacity:0.4;transition:opacity 0.3s}
        .dr-status-step.active{opacity:1;color:var(--text-primary)}
        .dr-status-step.done{opacity:0.7;color:var(--text-primary)}
        .dr-status-dot{width:8px;height:8px;border-radius:50%;background:rgba(224,224,224,0.2);transition:background 0.3s}
        .dr-status-step.active .dr-status-dot{background:var(--text-primary);animation:drPulse 1.5s infinite}
        .dr-status-step.done .dr-status-dot{background:var(--text-primary)}
        .dr-status-arrow{color:rgba(224,224,224,0.15);font-size:10px}
        .dr-status-text{font-size:13px;color:var(--text-secondary);margin-top:8px}
        
        .draft-indicator {
            font-size: 10px;
            color: var(--chrome);
            text-align: right;
            margin-top: -10px;
            margin-bottom: 10px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .error-message {
            background: rgba(255,59,59,0.1);
            border: 1px solid rgba(255,59,59,0.3);
            border-radius: 12px;
            padding: 10px 14px;
            margin: 10px 0;
            font-size: 12px;
            color: #ff6b6b;
        }
        
        @media (max-width: 480px) {
            .dr-voice-btn { width: 80px; height: 80px; }
            .recording-timer { font-size: 18px; }
        }

        /* ===== Press-анимация для всех кнопок модуля ===== */
        .dr-btn, .dr-btn-ghost, .dr-interpretation-btn, .dr-history-item {
            transition: transform 0.12s ease, background 0.2s ease, box-shadow 0.2s ease;
            -webkit-tap-highlight-color: rgba(255,107,59,0.12);
        }
        .dr-btn:active, .dr-btn-ghost:active, .dr-interpretation-btn:active {
            transform: scale(0.97);
        }
        .dr-history-item:active { transform: scale(0.99); }
        .dr-btn:hover { filter: brightness(1.06); }
        .dr-btn-ghost:hover { background: rgba(127,127,127,0.14); }

        /* ===== Полноэкранный AI-оверлей ===== */
        @keyframes drAISpin { to { transform: rotate(360deg); } }
        @keyframes drAIDot { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        .dr-ai-overlay {
            position: fixed; inset: 0; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.72);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        [data-theme="light"] .dr-ai-overlay { background: rgba(240,240,245,0.82); }
        .dr-ai-box {
            background: #1a1a1c; color: #fff;
            border: 1px solid rgba(127,127,127,0.2);
            border-radius: 20px; padding: 32px 28px;
            max-width: 360px; width: calc(100% - 40px);
            text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        [data-theme="light"] .dr-ai-box {
            background: #fff; color: #1c1c1e;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .dr-ai-spinner {
            width: 64px; height: 64px; margin: 0 auto 20px;
            border: 5px solid rgba(127,127,127,0.18);
            border-top-color: #ff6b3b; border-radius: 50%;
            animation: drAISpin 0.9s linear infinite;
        }
        .dr-ai-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
        .dr-ai-sub { font-size: 13px; opacity: 0.7; line-height: 1.5; margin-bottom: 16px; }
        .dr-ai-dots { display: flex; justify-content: center; gap: 6px; }
        .dr-ai-dots span {
            width: 8px; height: 8px; border-radius: 50%;
            background: #ff6b3b; display: inline-block;
            animation: drAIDot 1.2s ease-in-out infinite;
        }
        .dr-ai-dots span:nth-child(2) { animation-delay: 0.15s; }
        .dr-ai-dots span:nth-child(3) { animation-delay: 0.3s; }

        /* ===== Theme overrides (light) ===== */
        [data-theme="light"] .dr-record-card,
        [data-theme="light"] .dr-interpretation,
        [data-theme="light"] .dr-clarification-card,
        [data-theme="light"] .dr-status,
        [data-theme="light"] .dr-tabs {
            background: rgba(127,127,127,0.06);
            border-color: rgba(127,127,127,0.18);
        }
        [data-theme="light"] .dr-tab.active { background: rgba(127,127,127,0.16); }
        [data-theme="light"] .dr-textarea,
        [data-theme="light"] .dr-clarification-input,
        [data-theme="light"] .dr-history-search {
            background: rgba(127,127,127,0.05);
            border-color: rgba(127,127,127,0.22);
        }
        [data-theme="light"] .dr-history-item {
            background: rgba(127,127,127,0.04);
            border-color: rgba(127,127,127,0.14);
        }
        [data-theme="light"] .dr-btn {
            background: linear-gradient(135deg, rgba(127,127,127,0.14), rgba(127,127,127,0.08));
            border-color: rgba(127,127,127,0.28);
        }
        [data-theme="light"] .dr-btn-ghost,
        [data-theme="light"] .dr-interpretation-btn {
            background: rgba(127,127,127,0.06);
            border-color: rgba(127,127,127,0.22);
        }
        [data-theme="light"] .recording-indicator { background: rgba(255,255,255,0.9); color: #1c1c1e; }
        [data-theme="light"] .recording-hint { color: rgba(0,0,0,0.5); }

        /* Подсветка textarea после успешного распознавания голоса */
        @keyframes drTextareaGlow {
            0% { box-shadow: 0 0 0 0 rgba(255,107,59,0.5); border-color: rgba(255,107,59,0.8); }
            70% { box-shadow: 0 0 0 12px rgba(255,107,59,0); border-color: rgba(255,107,59,0.4); }
            100% { box-shadow: 0 0 0 0 rgba(255,107,59,0); border-color: rgba(224,224,224,0.2); }
        }
        .dr-textarea-highlight {
            animation: drTextareaGlow 2.4s ease-out;
        }

        /* Кнопка «Озвучить вопрос» */
        .dr-speak-question-btn {
            display: block; margin: 8px auto 12px; padding: 8px 16px;
            border-radius: 30px; background: rgba(127,127,127,0.1);
            border: 1px solid rgba(127,127,127,0.22);
            color: var(--text-primary); font-size: 12px; cursor: pointer;
            font-family: inherit;
            transition: transform 0.12s ease, background 0.2s ease;
        }
        .dr-speak-question-btn:hover { background: rgba(127,127,127,0.16); }
        .dr-speak-question-btn:active { transform: scale(0.97); }

        /* Пульс кнопки «Толковать сон» после записи */
        @keyframes drBtnPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,59,0.35); transform: scale(1); }
            50% { box-shadow: 0 0 0 8px rgba(255,107,59,0); transform: scale(1.03); }
        }
        .dr-btn-pulse {
            animation: drBtnPulse 1s ease-in-out 3;
        }

        /* ===== Чат-интерфейс ===== */
        .dr-chat-wrap {
            display: flex; flex-direction: column; gap: 16px;
            min-height: 60vh;
        }
        .dr-chat-log {
            background: rgba(127,127,127,0.04);
            border: 1px solid rgba(127,127,127,0.14);
            border-radius: 20px;
            padding: 20px;
            min-height: 40vh;
            max-height: 60vh;
            overflow-y: auto;
            scroll-behavior: smooth;
        }
        [data-theme="light"] .dr-chat-log {
            background: rgba(127,127,127,0.05);
        }
        .dr-chat-welcome {
            text-align: center; padding: 24px 12px;
            color: var(--text-primary);
        }
        .dr-chat-system {
            text-align: center; color: var(--text-secondary); font-size: 12px;
            padding: 8px 14px; margin: 8px auto; max-width: 70%;
            background: rgba(127,127,127,0.08); border-radius: 14px;
        }
        .dr-chat-row {
            display: flex; gap: 10px; margin: 12px 0; align-items: flex-start;
        }
        .dr-chat-row.is-user { flex-direction: row-reverse; }
        .dr-chat-avatar {
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(127,127,127,0.1);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; flex-shrink: 0;
        }
        .dr-chat-row.is-user .dr-chat-avatar { background: linear-gradient(135deg, #ff6b3b33, #ff3b3b22); }
        .dr-chat-bubble {
            max-width: min(78%, 560px);
            background: rgba(127,127,127,0.1);
            border: 1px solid rgba(127,127,127,0.14);
            border-radius: 18px; padding: 10px 14px;
            color: var(--text-primary);
            line-height: 1.55; font-size: 14px;
        }
        .dr-chat-row.is-user .dr-chat-bubble {
            background: linear-gradient(135deg, rgba(255,107,59,0.18), rgba(255,59,59,0.08));
            border-color: rgba(255,107,59,0.28);
        }
        .dr-chat-label {
            font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;
        }
        .dr-chat-text { white-space: pre-wrap; word-break: break-word; }
        .dr-bubble-actions { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; }
        .dr-bubble-action {
            padding: 4px 10px; border-radius: 20px;
            background: rgba(127,127,127,0.12);
            border: 1px solid rgba(127,127,127,0.2);
            color: var(--text-primary);
            cursor: pointer; font-size: 12px; font-family: inherit;
            transition: transform 0.12s ease, background 0.2s ease;
        }
        .dr-bubble-action:hover { background: rgba(127,127,127,0.18); }
        .dr-bubble-action:active { transform: scale(0.95); }

        .dr-chat-composer {
            position: sticky; bottom: 0;
            background: rgba(127,127,127,0.06);
            border: 1px solid rgba(127,127,127,0.18);
            border-radius: 20px;
            backdrop-filter: blur(6px);
        }
        [data-theme="light"] .dr-chat-composer {
            background: rgba(255,255,255,0.85);
            border-color: rgba(0,0,0,0.08);
        }
        .dr-textarea-chat {
            flex: 1; margin: 0 !important; min-height: 52px; max-height: 150px;
            border-radius: 16px;
        }
        .dr-voice-btn-compact {
            width: 52px; height: 52px; border-radius: 50%;
            margin: 0 !important; flex-shrink: 0;
        }
        .dr-btn-send {
            width: 52px; height: 52px; border-radius: 50%;
            padding: 0 !important;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none; color: #fff;
            flex-shrink: 0;
        }
        .dr-btn-send.loading .btn-text { display: none; }
        .dr-btn-send.loading .btn-loader { display: inline-block; }
        .dr-btn-small {
            padding: 6px 12px; font-size: 11px; border-radius: 20px;
        }
    `;
    document.head.appendChild(style);
}

// Функции показа/скрытия полноэкранного AI-оверлея
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

// ============================================
// СТАТУС-ИНДИКАТОР
// ============================================
function _drShowStatus(stage, text) {
    let statusEl = document.getElementById('drStatusIndicator');
    if (!stage) {
        if (statusEl) statusEl.remove();
        return;
    }
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'drStatusIndicator';
        const resultDiv = document.getElementById('interpretationResult');
        if (resultDiv) resultDiv.before(statusEl);
        else {
            const body = document.getElementById('drBody');
            if (body) body.appendChild(statusEl);
        }
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
        { id: 'record',  label: '🎙️ Рассказать сон' },
        { id: 'history', label: '📜 История' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="dr-tab${_drActiveTab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (_drActiveTab === 'record')  body = _drRenderRecordTab(completed);
    if (_drActiveTab === 'history') body = _drRenderHistoryTab(completed);

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Толкование снов</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Фреди анализирует символику ваших снов</p>
            </div>
            <div class="dr-tabs">${tabsHtml}</div>
            <div id="drBody">${body}</div>
        </div>
    `;

    document.getElementById('drBack').onclick = () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else location.reload();
    };

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
// ВКЛАДКИ
// ============================================

function _drRenderRecordTab(completed) {
    if (!completed) {
        return `
            <div class="dr-record-card">
                <div style="font-size: 64px; margin-bottom: 16px;">🌙</div>
                <h3>Для толкования снов нужен ваш психологический профиль</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Пройдите тест, чтобы Фреди мог давать персонализированные толкования</p>
                <button class="dr-btn" onclick="startTest()">📊 Пройти тест</button>
            </div>
        `;
    }

    const draftText = _drLoadDraft();
    const displayText = draftText || _drCurrentText;

    const canSkip = _drChatSession.some(m => m.role === 'bot' && m.kind === 'clarification');
    const isClarification = _drNeedsClarification;
    const placeholder = isClarification
        ? 'Напиши ответ на вопрос Фреди…'
        : 'Опишите ваш сон максимально подробно…';
    const composerHint = isClarification
        ? '🎤 Нажмите и удерживайте кнопку, чтобы ответить голосом'
        : '🎤 Нажмите и удерживайте кнопку, чтобы надиктовать сон, или напишите его ниже';
    const sendLabel = isClarification ? '📤 Ответить' : '🔮 Толковать сон';

    return `
        <div class="dr-chat-wrap">
            <div class="dr-chat-log" id="drChatLog">
                ${_drRenderChatMessages()}
            </div>

            <div class="dr-chat-composer dr-record-card" style="padding:16px;">
                <div id="validationError" class="error-message" style="display: none;"></div>
                <div style="display:flex;align-items:flex-end;gap:10px;">
                    <button class="dr-voice-btn dr-voice-btn-compact" id="dreamVoiceBtn" title="Нажмите и удерживайте для записи">
                        <span class="dr-voice-icon" style="font-size:28px;">🎤</span>
                    </button>
                    <textarea id="dreamTextInput" class="dr-textarea dr-textarea-chat" rows="3" placeholder="${placeholder}">${_drEscapeHtml(displayText)}</textarea>
                    <button class="dr-btn dr-btn-send" id="interpretDreamBtn" title="${sendLabel}">
                        <span class="btn-text">${isClarification ? '📤' : '🔮'}</span>
                        <span class="btn-loader">⏳</span>
                    </button>
                </div>
                <div class="draft-indicator" id="draftIndicator"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:11px;color:var(--text-secondary);">${composerHint}</span>
                    <div style="display:flex;gap:8px;">
                        ${canSkip ? '<button class="dr-btn dr-btn-ghost dr-btn-small" id="skipClarificationBtn" title="Пропустить уточнения">⏭️ Пропустить</button>' : ''}
                        <button class="dr-btn dr-btn-ghost dr-btn-small" id="newChatBtn" title="Начать новый сон">🔄 Новый сон</button>
                        ${_drHistory.length ? '<button class="dr-btn dr-btn-ghost dr-btn-small" id="exportHistoryBtn" title="Экспорт истории">📥</button>' : ''}
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
                <div style="font-size:56px;margin-bottom:12px;">🌙</div>
                <h2 style="margin:0 0 8px 0;">Расскажите свой сон</h2>
                <p style="color:var(--text-secondary);max-width:480px;margin:0 auto;line-height:1.5;">
                    Нажмите и удерживайте 🎤 ниже, чтобы надиктовать сон голосом, или наберите текст.
                    Фреди может задать пару уточнений — отвечайте так же: голосом или текстом.
                    Ответ появится прямо в этой ленте.
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
    if (isSystem) {
        return `<div class="dr-chat-system">${_drEscapeHtml(msg.text)}</div>`;
    }
    const avatar = isUser ? '👤' : '🌙';
    const label = isUser ? 'Вы' : (msg.kind === 'clarification' ? `Фреди · уточнение ${msg.clarNumber || ''}/3` : 'Фреди');
    const text = _drEscapeHtml(msg.text || '');
    const actions = !isUser && msg.text
        ? `<div class="dr-bubble-actions">
               <button class="dr-bubble-action" data-speak="${idx}" title="Озвучить">🔊</button>
           </div>`
        : '';
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
    if (log) {
        log.innerHTML = _drRenderChatMessages();
        // Прокрутка к последнему сообщению
        log.scrollTop = log.scrollHeight;
    }
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
}

function _drRenderHistoryTab(completed) {
    if (!completed) {
        return `
            <div class="dr-record-card">
                <div style="font-size: 64px; margin-bottom: 16px;">🌙</div>
                <h3>Для просмотра истории нужен психологический профиль</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Пройдите тест, чтобы сохранять и анализировать свои сны</p>
                <button class="dr-btn" onclick="startTest()">📊 Пройти тест</button>
            </div>
        `;
    }
    
    if (_drHistory.length === 0) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📜</div>
                <h3>У вас пока нет сохранённых снов</h3>
                <p style="color: var(--text-secondary);">Расскажите свой первый сон на вкладке «Рассказать сон»</p>
            </div>
        `;
    }

    return `
        <div class="dr-history-header">
            <input type="text" id="historySearch" class="dr-history-search" placeholder="🔍 Поиск по снам...">
            <button class="dr-btn-ghost" id="exportHistoryBtn" style="padding:10px 16px;border-radius:30px;">📥 Экспорт</button>
        </div>
        <div id="historyList">
            ${_drHistory.map((dream, index) => `
                <div class="dr-history-item" onclick="viewDreamDetails(${index})">
                    <div class="dr-history-date">${_drEscapeHtml(dream.date)}</div>
                    <div class="dr-history-preview">${_drEscapeHtml(dream.text.substring(0, 100))}${dream.text.length > 100 ? '...' : ''}</div>
                    <div class="dr-history-tags">
                        ${dream.tags ? dream.tags.map(t => `<span class="dr-history-tag">${_drEscapeHtml(t)}</span>`).join('') : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// ГОЛОСОВАЯ ЗАПИСЬ
// ============================================

function _drInitVoiceButton() {
    const voiceBtn = document.getElementById('dreamVoiceBtn');
    console.log('[dreams] _drInitVoiceButton: btn=', !!voiceBtn, '| voiceManager=', !!window.voiceManager);
    if (!voiceBtn || !window.voiceManager) {
        console.warn('[dreams] ⚠️ Нет кнопки или voiceManager → голос недоступен');
        if (voiceBtn) {
            voiceBtn.style.opacity = '0.4';
            voiceBtn.onclick = () => showToast('🎤 Голосовой ввод недоступен', 'info');
        }
        return;
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
            <div class="recording-wave">
                <span></span><span></span><span></span><span></span>
            </div>
            <div class="recording-timer" id="recordingTimer">0 сек</div>
            <div class="recording-level">
                <div class="level-fill"></div>
            </div>
            <div class="recording-hint">🎙️ Говорите... Отпустите когда закончите</div>
        `;
        voiceBtn.parentNode.insertBefore(recordingIndicator, voiceBtn.nextSibling);
    }
    
    const getIcon = () => voiceBtn.querySelector('.dr-voice-icon');
    
    const uiCleanup = () => {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (levelInterval) { clearInterval(levelInterval); levelInterval = null; }
        isRecording = false;
        voiceBtn.classList.remove('recording');
        if (recordingIndicator) recordingIndicator.style.display = 'none';
        const icon = getIcon();
        if (icon) icon.textContent = '🎤';
    };

    const restoreHandlers = () => {
        // Возврат стандартных обработчиков — вызывается ПОСЛЕ того,
        // как пришёл STT-ответ (в onTranscriptComplete или через страховочный таймаут).
        if (!window.voiceManager) return;
        window.voiceManager.sttOnly = false;
        if (savedOnTranscript !== null) {
            window.voiceManager.onTranscript = savedOnTranscript;
            savedOnTranscript = null;
        }
        if (savedOnComplete !== null) {
            window.voiceManager.onTranscriptComplete = savedOnComplete;
            savedOnComplete = null;
        }
    };

    const stopRecording = () => {
        if (isRecording && window.voiceManager) {
            window.voiceManager.stopRecording();
        }
        uiCleanup();

        // НЕ восстанавливаем обработчики здесь! HTTP-STT возвращает ответ через 3-5 секунд —
        // если сбросить колбеки сейчас, результат распознавания упадёт в void.
        // Страховочный таймаут: если STT не успел за 20 сек — восстановим, чтобы не держать чужой state.
        setTimeout(() => {
            if (savedOnTranscript !== null || savedOnComplete !== null) {
                console.warn('[dreams] ⏱ STT не пришёл за 20с — восстанавливаю обработчики по таймауту');
                restoreHandlers();
            }
        }, 20000);
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
        
        // Таймер
        timerInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
            const timerEl = document.getElementById('recordingTimer');
            if (timerEl) {
                timerEl.textContent = `${seconds} сек`;
                if (seconds >= MAX_RECORD_SECONDS - 5) {
                    timerEl.style.color = '#ff6b6b';
                }
            }
            
            if (seconds >= MAX_RECORD_SECONDS) {
                stopRecording();
                _drShowStatus('transcribing', '📝 Расшифровываю запись...');
                if (typeof showToast === 'function') {
                    showToast('⏱️ Достигнут лимит записи (60 секунд)', 'info');
                }
            }
        }, 100);
        
        // Уровень звука
        levelInterval = setInterval(() => {
            const level = window.voiceManager?.getAudioLevel?.() || 0;
            const fill = document.querySelector('.level-fill');
            if (fill) fill.style.width = `${Math.min(level * 100, 100)}%`;
        }, 50);
        
        // Настраиваем voiceManager
        window.voiceManager.sttOnly = true;
        
        savedOnTranscript = window.voiceManager.onTranscript;
        savedOnComplete = window.voiceManager.onTranscriptComplete;
        
        window.voiceManager.onTranscript = (text) => {
            console.log('[dreams] 🎙️ onTranscript chunk:', JSON.stringify(text));
            const input = document.getElementById('dreamTextInput');
            if (!input) {
                console.error('[dreams] ❌ onTranscript: #dreamTextInput НЕ НАЙДЕН в DOM');
                return;
            }
            const currentText = input.value;
            const newText = currentText ? currentText + ' ' + text : text;
            input.value = newText;
            _drCurrentText = newText;
            _drAutoSaveDraft(newText);
            input.scrollTop = input.scrollHeight;
            console.log('[dreams] 📝 textarea длина теперь:', newText.length);
        };

        window.voiceManager.onTranscriptComplete = (finalText) => {
            console.log('[dreams] ✅ onTranscriptComplete finalText:', JSON.stringify(finalText));
            // UI-cleanup (на случай WS-режима, когда complete может прийти до отпускания кнопки)
            try { uiCleanup(); } catch (e) {}
            // Теперь можно восстановить стандартные обработчики — STT-ответ уже пришёл.
            try { restoreHandlers(); } catch (e) { console.warn('[dreams] restoreHandlers error:', e); }
            _drShowStatus('transcribing', '📝 Расшифровываю...');

            setTimeout(() => {
                const input = document.getElementById('dreamTextInput');
                const value = input ? input.value.trim() : '';
                console.log('[dreams] после 500ms: input exists =', !!input, '| length =', value.length);
                if (input && value) {
                    _drShowStatus(null);
                    if (typeof showToast === 'function') {
                        showToast('✅ Голос распознан. Проверь текст и нажми «Толковать сон»', 'success');
                    }
                    try {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        input.classList.add('dr-textarea-highlight');
                        setTimeout(() => input.classList.remove('dr-textarea-highlight'), 2500);
                        input.focus();
                        input.setSelectionRange(input.value.length, input.value.length);
                    } catch (e) {
                        console.warn('[dreams] focus/scroll failed:', e);
                    }
                    const btn = document.getElementById('interpretDreamBtn');
                    if (btn) {
                        btn.classList.add('dr-btn-pulse');
                        setTimeout(() => btn.classList.remove('dr-btn-pulse'), 3000);
                    }
                } else {
                    _drShowStatus(null);
                    console.warn('[dreams] ⚠️ textarea пустой после STT — finalText был:', JSON.stringify(finalText));
                    if (typeof showToast === 'function') {
                        showToast('❌ Не удалось распознать речь. Попробуйте ещё раз', 'error');
                    }
                }
            }, 500);
        };
        
        console.log('[dreams] 🎙️ startRecording() вызван');
        const started = await window.voiceManager.startRecording();
        console.log('[dreams] startRecording result:', started);
        if (!started) {
            stopRecording();
            if (typeof showToast === 'function') {
                showToast('🎤 Нет доступа к микрофону', 'error');
            }
        }
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

    if (interpretBtn) {
        interpretBtn.addEventListener('click', () => _drInterpret());
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => _drExportHistory());
    }
    
    const skipBtn = document.getElementById('skipClarificationBtn');
    if (skipBtn) {
        skipBtn.addEventListener('click', async () => {
            _drAddChatMessage('system', '⏭️ Ты пропустил уточнения. Фреди попытается дать толкование на основе уже сказанного.');
            _drNeedsClarification = false;
            _drClarificationQuestion = '';
            _drClarificationCount = 3;
            await _drInterpretFinalFallback();
        });
    }

    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            _drResetChatSession();
            showDreamsScreen();
        });
    }

    // Отправка по Enter (Shift+Enter = новая строка)
    const ta = document.getElementById('dreamTextInput');
    if (ta && !ta._drEnterBound) {
        ta._drEnterBound = true;
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _drInterpret();
            }
        });
    }

    // «Озвучить» у каждого сообщения бота
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

async function _drInterpretFinalFallback() {
    // Если пользователь нажал «Пропустить» — бэк не даст толкования (ему нужен ответ),
    // поэтому просто показываем сообщение «переформулируй» в чате и сбрасываем сессию.
    _drAddChatMessage('bot', 'Чтобы дать глубокое толкование, Фреди нужно чуть больше деталей. Попробуй ещё раз — расскажи сон подробнее.', { kind: 'final' });
    _drResetChatSession();
}

// Голосовая запись ответа на уточняющий вопрос
function _drInitClarificationVoiceButton() {
    const voiceBtn = document.getElementById('clarificationVoiceBtn');
    if (!voiceBtn || !window.voiceManager) return;
    if (voiceBtn._dreamClarifInited) return;
    voiceBtn._dreamClarifInited = true;

    let isRecording = false;
    let savedOnTranscript = null;
    let savedOnComplete = null;

    const stop = () => {
        if (isRecording && window.voiceManager) window.voiceManager.stopRecording();
        isRecording = false;
        voiceBtn.classList.remove('recording');
        const icon = voiceBtn.querySelector('.dr-voice-icon');
        if (icon) icon.textContent = '🎤';
        // Handlers восстановим в onTranscriptComplete или через страховочный таймаут
        setTimeout(() => {
            if (!window.voiceManager) return;
            if (savedOnTranscript !== null) {
                window.voiceManager.onTranscript = savedOnTranscript;
                savedOnTranscript = null;
            }
            if (savedOnComplete !== null) {
                window.voiceManager.onTranscriptComplete = savedOnComplete;
                savedOnComplete = null;
            }
            window.voiceManager.sttOnly = false;
        }, 20000);
    };

    const start = async (e) => {
        e.preventDefault();
        if (isRecording) return;
        if (!window.voiceManager) return;

        savedOnTranscript = window.voiceManager.onTranscript;
        savedOnComplete = window.voiceManager.onTranscriptComplete;
        window.voiceManager.sttOnly = true;

        window.voiceManager.onTranscript = (text) => {
            const input = document.getElementById('clarificationAnswer');
            if (!input) return;
            const cur = input.value;
            input.value = cur ? cur + ' ' + text : text;
        };
        window.voiceManager.onTranscriptComplete = (finalText) => {
            console.log('[dreams] clarif STT complete:', JSON.stringify(finalText));
            // Вернуть handlers, так как STT уже пришёл
            if (window.voiceManager) {
                if (savedOnTranscript !== null) {
                    window.voiceManager.onTranscript = savedOnTranscript;
                    savedOnTranscript = null;
                }
                if (savedOnComplete !== null) {
                    window.voiceManager.onTranscriptComplete = savedOnComplete;
                    savedOnComplete = null;
                }
                window.voiceManager.sttOnly = false;
            }
            const input = document.getElementById('clarificationAnswer');
            if (input && input.value.trim()) {
                if (typeof showToast === 'function') showToast('✅ Ответ распознан — нажмите «Ответить»', 'success');
                try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
            }
        };

        isRecording = true;
        voiceBtn.classList.add('recording');
        const icon = voiceBtn.querySelector('.dr-voice-icon');
        if (icon) icon.textContent = '⏺';
        const started = await window.voiceManager.startRecording();
        if (!started) { stop(); if (typeof showToast === 'function') showToast('🎤 Нет доступа к микрофону', 'error'); }
    };

    voiceBtn.addEventListener('mousedown', start);
    voiceBtn.addEventListener('mouseup', stop);
    voiceBtn.addEventListener('mouseleave', stop);
    voiceBtn.addEventListener('touchstart', start, { passive: false });
    voiceBtn.addEventListener('touchend', stop);
}

// ============================================
// ИНТЕРПРЕТАЦИЯ
// ============================================

async function _drInterpret() {
    console.log('[dreams] 🔮 _drInterpret START | clarification?', _drNeedsClarification);
    if (_drIsInterpreting) {
        console.warn('[dreams] уже выполняется — игнор');
        if (typeof showToast === 'function') {
            showToast('⏳ Интерпретация уже выполняется...', 'info');
        }
        return;
    }

    // В чат-режиме кнопка отправки одна для и начального сна, и для уточнения.
    if (_drNeedsClarification) {
        return _drSubmitClarification();
    }

    const input = document.getElementById('dreamTextInput');
    const dreamText = input?.value.trim();
    console.log('[dreams] dreamText длина:', (dreamText || '').length, 'превью:', (dreamText || '').slice(0, 80));

    const validation = _drValidateDream(dreamText);
    const errorDiv = document.getElementById('validationError');

    if (!validation.valid) {
        console.warn('[dreams] ❌ валидация провалена:', validation.errors);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = validation.errors.map(e => `• ${e}`).join('<br>');
        }
        return;
    }

    if (errorDiv) errorDiv.style.display = 'none';

    _drCurrentText = dreamText;
    _drAutoSaveDraft(dreamText);

    // Добавляем пользовательское сообщение в чат и очищаем textarea
    _drAddChatMessage('user', dreamText);
    if (input) input.value = '';

    const interpretBtn = document.getElementById('interpretDreamBtn');

    _drIsInterpreting = true;
    if (interpretBtn) interpretBtn.classList.add('loading');

    _drShowAIOverlay('Фреди толкует твой сон', 'Анализ символов, архетипов и связи с твоим профилем. 20-40 секунд.');

    try {
        const { status, profileData } = await _drGetCachedProfile();
        console.log('[dreams] profile fetched: has_profile=', status?.has_profile, '| profile_code=', status?.profile_code);

        _drShowStatus('interpreting', 'Генерирую юнгианскую интерпретацию...');

        const requestBody = {
            user_id: CONFIG.USER_ID,
            dream_text: dreamText,
            user_name: CONFIG.USER_NAME,
            profile_code: status.profile_code,
            perception_type: profileData.profile?.perception_type,
            thinking_level: profileData.profile?.thinking_level,
            vectors: status.vectors,
            key_characteristic: profileData.profile?.key_characteristic,
            main_trap: profileData.profile?.main_trap,
            clarification_count: _drClarificationCount
        };
        console.log('[dreams] 📤 POST /api/dreams/interpret user_id=', requestBody.user_id, '| dream_length=', requestBody.dream_text.length);
        const _tStart = performance.now();

        const response = await apiCall('/api/dreams/interpret', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        const _tEnd = performance.now();
        console.log('[dreams] 📥 response за', Math.round(_tEnd - _tStart), 'ms:', {
            success: response?.success,
            has_interpretation: !!response?.interpretation,
            interpretation_length: (response?.interpretation || '').length,
            needs_clarification: !!response?.needs_clarification,
            error: response?.error
        });
        
        if (response.needs_clarification && _drClarificationCount < 3) {
            _drNeedsClarification = true;
            _drClarificationSessionId = response.session_id;
            _drClarificationQuestion = response.question || 'Расскажите подробнее об этом сне...';
            console.log('[dreams] 🤔 needs_clarification:', _drClarificationQuestion);
            _drAddChatMessage('bot', _drClarificationQuestion, { kind: 'clarification', clarNumber: _drClarificationCount + 1 });
            _drSpeak(_drClarificationQuestion);
            // Обновить только композер (placeholder / кнопку), оставив ленту
            await showDreamsScreen();
        } else if (response.needs_clarification && _drClarificationCount >= 3) {
            const fallback = response.interpretation || 'На основе твоих ответов Фреди подготовил толкование. Для более точного анализа нужно больше деталей.';
            _drAddChatMessage('bot', fallback, { kind: 'final' });
            _drSpeak(fallback);
            await _drSaveToHistory(dreamText, fallback);
            _drResetChatSession();
            _drChatFinalShown = true;
        } else {
            const interpretText = response.interpretation || 'Фреди не смог сформировать толкование. Попробуйте переформулировать сон подробнее.';
            _drAddChatMessage('bot', interpretText, { kind: 'final' });
            _drSpeak(interpretText);
            await _drSaveToHistory(dreamText, interpretText);
            _drNeedsClarification = false;
            _drClarificationQuestion = '';
            _drClarificationCount = 0;
            _drChatFinalShown = true;
        }

        _drClearDraft();

    } catch (error) {
        console.error('[dreams] ❌ Interpretation error:', error?.name, error?.message, error);
        _drAddChatMessage('system', '😔 Ошибка: ' + (error?.message || 'не удалось получить толкование'));
        if (typeof showToast === 'function') {
            showToast('❌ Ошибка: ' + (error?.message || 'не удалось получить толкование'), 'error');
        }
    } finally {
        _drIsInterpreting = false;
        if (interpretBtn) interpretBtn.classList.remove('loading');
        _drHideAIOverlay();
        console.log('[dreams] 🏁 _drInterpret END');
    }
}

async function _drSubmitClarification() {
    // В чат-режиме ответ вводится в тот же textarea, что и исходный сон.
    const input = document.getElementById('dreamTextInput');
    const answer = (input?.value || '').trim();
    if (!answer) {
        if (typeof showToast === 'function') {
            showToast('📝 Напишите ответ на вопрос', 'error');
        }
        return;
    }

    _drAddChatMessage('user', answer);
    if (input) input.value = '';

    _drClarificationCount++;
    const interpretBtn = document.getElementById('interpretDreamBtn');
    _drIsInterpreting = true;
    if (interpretBtn) interpretBtn.classList.add('loading');
    _drShowAIOverlay('Фреди анализирует твой ответ', 'Ждём следующий вопрос или толкование. 10-30 секунд.');

    try {
        const { status } = await _drGetCachedProfile();

        const response = await apiCall('/api/dreams/clarify', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                session_id: _drClarificationSessionId,
                dream_text: _drCurrentText,
                answer: answer,
                user_name: CONFIG.USER_NAME,
                profile_code: status.profile_code,
                vectors: status.vectors,
                clarification_number: _drClarificationCount
            })
        });
        console.log('[dreams] 📥 clarify response:', { needs_clarification: !!response?.needs_clarification, has_interpretation: !!response?.interpretation });

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
            const interpretText = response.interpretation || 'Фреди не смог сформировать толкование. Попробуйте переформулировать сон подробнее.';
            _drAddChatMessage('bot', interpretText, { kind: 'final' });
            _drSpeak(interpretText);
            await _drSaveToHistory(_drCurrentText, interpretText);
            _drClarificationCount = 0;
            _drChatFinalShown = true;
        }

    } catch (error) {
        console.error('[dreams] ❌ Clarification error:', error);
        _drAddChatMessage('system', '😔 Ошибка уточнения: ' + (error?.message || 'неизвестная'));
        if (typeof showToast === 'function') {
            showToast('❌ Ошибка при уточнении', 'error');
        }
    } finally {
        _drIsInterpreting = false;
        if (interpretBtn) interpretBtn.classList.remove('loading');
        _drHideAIOverlay();
    }
}

// Универсальный TTS-помощник: предпочитает voiceManager, фолбэк на speechSynthesis.
function _drSpeak(text) {
    if (!text) return;
    try {
        if (window.voiceManager && window.voiceManager.textToSpeech) {
            window.voiceManager.textToSpeech(text, 'psychologist').catch(e => console.warn('[dreams] TTS failed:', e));
            return;
        }
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ru-RU';
            speechSynthesis.speak(u);
        }
    } catch (e) { console.warn('[dreams] _drSpeak error:', e); }
}

function _drRenderInterpretation(text) {
    const escapedText = _drEscapeHtml(text);
    const formatted = escapedText.replace(/\n/g, '<br>');
    return `
        <div class="dr-interpretation">
            <div class="dr-interpretation-text">${formatted}</div>
            <div class="dr-interpretation-actions">
                <button class="dr-interpretation-btn" onclick="speakInterpretation()">🔊 Озвучить ещё раз</button>
                <button class="dr-interpretation-btn" onclick="saveDreamToJournal()">💾 Сохранить</button>
            </div>
        </div>
    `;
}

async function speakInterpretation() {
    const resultDiv = document.getElementById('interpretationResult');
    const textDiv = resultDiv?.querySelector('.dr-interpretation-text');
    if (textDiv && window.voiceManager) {
        const plainText = textDiv.textContent || textDiv.innerText;
        await window.voiceManager.textToSpeech(plainText, 'psychologist');
    }
}

// ============================================
// ИСТОРИЯ
// ============================================

async function _drLoadHistory() {
    try {
        const data = await apiCall(`/api/dreams/history/${CONFIG.USER_ID}`);
        _drHistory = data.dreams || [];
    } catch {
        const saved = localStorage.getItem(`dreams_history_${CONFIG.USER_ID}`);
        _drHistory = saved ? JSON.parse(saved) : [];
    }
}

async function _drSaveToHistory(dreamText, interpretation) {
    const safeInterp = typeof interpretation === 'string' && interpretation.trim() ? interpretation : '';
    const newDream = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        time: new Date().toLocaleTimeString('ru-RU'),
        text: dreamText,
        interpretation: safeInterp,
        tags: _drExtractTags(safeInterp),
        clarification_count: _drClarificationCount
    };
    
    _drHistory.unshift(newDream);
    if (_drHistory.length > 50) _drHistory.pop();
    
    localStorage.setItem(`dreams_history_${CONFIG.USER_ID}`, JSON.stringify(_drHistory));
    
    try {
        await apiCall('/api/dreams/save', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, dream: newDream })
        });
    } catch (e) {
        console.warn('Failed to save to backend:', e);
    }
}

function _drExtractTags(interpretation) {
    const tags = [];
    const text = (typeof interpretation === 'string' ? interpretation : '').toLowerCase();
    if (!text) return tags;
    const keywords = ['тревога', 'страх', 'радость', 'уверенность', 'отношения', 'работа', 'дом', 'путешествие'];
    for (const kw of keywords) {
        if (text.includes(kw)) tags.push(kw);
    }
    return tags.slice(0, 3);
}

function _drExportHistory() {
    if (_drHistory.length === 0) {
        if (typeof showToast === 'function') {
            showToast('📭 Нет снов для экспорта', 'info');
        }
        return;
    }
    
    const data = JSON.stringify(_drHistory, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreams_${CONFIG.USER_ID}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    if (typeof showToast === 'function') {
        showToast('📥 История экспортирована', 'success');
    }
}

function viewDreamDetails(index) {
    const dream = _drHistory[index];
    if (!dream) return;
    
    _drInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const escapedText = _drEscapeHtml(dream.text);
    const escapedInterpretation = _drEscapeHtml(dream.interpretation);
    const formatted = escapedInterpretation.replace(/\n/g, '<br>');
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drDetailBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">${_drEscapeHtml(dream.date)}</h1>
            </div>

            <div class="dr-record-card" style="text-align: left;">
                <h3>Ваш сон:</h3>
                <div style="background:rgba(224,224,224,0.03);border-radius:16px;padding:16px;margin:12px 0;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${escapedText}</div>

                <h3 style="margin-top: 20px;">Толкование Фреди:</h3>
                <div class="dr-interpretation" style="margin-top: 0;">
                    <div class="dr-interpretation-text">${formatted}</div>
                    <div class="dr-interpretation-actions">
                        <button class="dr-interpretation-btn" onclick="speakText('${dream.interpretation.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">🔊 Озвучить</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('drDetailBack').onclick = () => showDreamsScreen();
}

function speakText(text) {
    if (window.voiceManager) window.voiceManager.textToSpeech(text, 'psychologist');
}

function saveDreamToJournal() {
    if (typeof showToast === 'function') {
        showToast('💾 Сон сохранён в дневник', 'success');
    }
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showDreamsScreen = showDreamsScreen;
window.viewDreamDetails = viewDreamDetails;
window.speakInterpretation = speakInterpretation;
window.speakText = speakText;
window.saveDreamToJournal = saveDreamToJournal;

console.log('✅ Модуль "Толкование снов" загружен (dreams.js v3.0)');
