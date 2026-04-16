// ============================================
// messages.js — Сообщения и уведомления
// Версия 2.0 — стиль проекта FREDI
// ============================================

// Guard от двойной загрузки
if (window._msLoaded) {
    console.warn('messages.js уже загружен, пропускаем');
} else {
window._msLoaded = true;

// ============================================
// CSS — один раз
// ============================================
function _msInjectStyles() {
    if (document.getElementById('ms-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'ms-v2-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .ms-tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 20px;
            background: rgba(10,10,10,0.5);
            border-radius: 50px;
            padding: 4px;
            border: 1px solid rgba(224,224,224,0.12);
        }
        .ms-tab {
            flex: 1;
            padding: 9px 8px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-height: 40px;
            white-space: nowrap;
            outline: none;
            touch-action: manipulation;
        }
        .ms-tab.active {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.08));
            color: var(--text-primary);
        }
        .ms-tab-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 16px;
            height: 16px;
            padding: 0 4px;
            background: var(--amg-red);
            color: #fff;
            border-radius: 20px;
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
        }

        /* ===== УВЕДОМЛЕНИЯ ===== */
        .ms-notif-group-title {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin: 0 0 8px;
        }
        .ms-notif-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 8px;
            transition: background 0.2s;
        }
        .ms-notif-item.unread {
            background: rgba(224,224,224,0.07);
            border-color: rgba(224,224,224,0.2);
        }
        .ms-notif-top {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 4px;
            gap: 8px;
        }
        .ms-notif-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
        }
        .ms-notif-time {
            font-size: 10px;
            color: var(--text-secondary);
            flex-shrink: 0;
        }
        .ms-notif-body {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-bottom: 10px;
        }
        .ms-notif-actions {
            display: flex;
            gap: 8px;
        }
        .ms-notif-btn {
            padding: 7px 14px;
            border-radius: 30px;
            font-size: 11px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 36px;
            touch-action: manipulation;
            outline: none;
        }
        .ms-notif-btn:active { transform: scale(0.97); }
        .ms-notif-btn-accept {
            background: rgba(16,185,129,0.15);
            border: 1px solid rgba(16,185,129,0.3);
            color: var(--success);
        }
        .ms-notif-btn-accept:hover { background: rgba(16,185,129,0.25); }
        .ms-notif-btn-decline {
            background: rgba(239,68,68,0.12);
            border: 1px solid rgba(239,68,68,0.25);
            color: var(--error);
        }
        .ms-notif-btn-decline:hover { background: rgba(239,68,68,0.22); }

        /* ===== ЧАТ-СПИСОК ===== */
        .ms-chat-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            touch-action: manipulation;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .ms-chat-item:hover {
            background: rgba(224,224,224,0.08);
            border-color: rgba(224,224,224,0.2);
        }
        .ms-chat-item:active { transform: scale(0.99); }
        .ms-chat-item.unread { border-color: rgba(224,224,224,0.22); }
        .ms-chat-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--chrome), var(--silver-brushed));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }
        .ms-chat-info { flex: 1; min-width: 0; }
        .ms-chat-top {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 3px;
        }
        .ms-chat-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .ms-compat-tag {
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 20px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.15);
            color: var(--text-secondary);
            white-space: nowrap;
            flex-shrink: 0;
        }
        .ms-chat-time { font-size: 10px; color: var(--text-secondary); flex-shrink: 0; }
        .ms-chat-preview {
            font-size: 12px;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ms-unread-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--chrome);
            flex-shrink: 0;
        }

        /* ===== ШАПКА "ОТМЕТИТЬ ВСЕ" ===== */
        .ms-read-all-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 11px;
            cursor: pointer;
            padding: 4px 0;
            font-family: inherit;
            transition: color 0.2s;
        }
        .ms-read-all-btn:hover { color: var(--chrome); }

        /* ===== ПУСТОЕ СОСТОЯНИЕ ===== */
        .ms-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            text-align: center;
            gap: 10px;
        }
        .ms-empty-icon { font-size: 48px; line-height: 1; }
        .ms-empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
        .ms-empty-sub { font-size: 13px; color: var(--text-secondary); max-width: 240px; line-height: 1.5; }

        /* ===== ЧАТ ===== */
        .ms-chat-screen {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
        }
        .ms-chat-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(10,10,10,0.85);
            -webkit-backdrop-filter: blur(20px);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(224,224,224,0.1);
            flex-shrink: 0;
        }
        .ms-chat-header-info { flex: 1; min-width: 0; }
        .ms-chat-header-name {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ms-chat-header-sub {
            font-size: 11px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 1px;
        }
        .ms-online-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: var(--success);
            flex-shrink: 0;
        }
        .ms-menu-btn {
            background: rgba(224,224,224,0.08);
            border: none;
            color: var(--chrome);
            width: 36px; height: 36px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            outline: none;
            transition: background 0.2s;
        }
        .ms-menu-btn:hover { background: rgba(224,224,224,0.14); }

        .ms-messages-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            scrollbar-width: thin;
            scrollbar-color: rgba(224,224,224,0.15) transparent;
        }
        .ms-messages-list::-webkit-scrollbar { width: 3px; }
        .ms-messages-list::-webkit-scrollbar-thumb { background: rgba(224,224,224,0.2); border-radius: 3px; }

        .ms-msg {
            display: flex;
            max-width: 80%;
        }
        .ms-msg-own   { align-self: flex-end;   justify-content: flex-end; }
        .ms-msg-other { align-self: flex-start; }
        .ms-msg-system {
            align-self: center;
            max-width: 90%;
            justify-content: center;
        }
        .ms-msg-bubble {
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .ms-msg-own .ms-msg-bubble {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.25);
            border-bottom-right-radius: 4px;
            color: var(--text-primary);
        }
        .ms-msg-other .ms-msg-bubble {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.12);
            border-bottom-left-radius: 4px;
            color: var(--text-primary);
        }
        .ms-msg-system .ms-msg-bubble {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 12px;
            color: var(--text-secondary);
            font-size: 12px;
            text-align: center;
        }
        .ms-msg-time {
            font-size: 9px;
            opacity: 0.5;
            margin-top: 4px;
            text-align: right;
        }

        .ms-chat-footer {
            flex-shrink: 0;
            padding: 12px 16px;
            padding-bottom: max(12px, calc(env(safe-area-inset-bottom) + 8px));
            background: rgba(10,10,10,0.9);
            border-top: 1px solid rgba(224,224,224,0.1);
        }
        .ms-contact-info {
            background: rgba(16,185,129,0.08);
            border: 1px solid rgba(16,185,129,0.2);
            border-radius: 12px;
            padding: 10px 14px;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.6;
        }
        .ms-input-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .ms-input {
            flex: 1;
            padding: 11px 16px;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 30px;
            color: var(--text-primary);
            font-size: 15px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
            -webkit-appearance: none;
        }
        .ms-input:focus { border-color: rgba(224,224,224,0.35); }
        .ms-input::placeholder { color: var(--text-secondary); }
        .ms-send-btn {
            width: 44px; height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.25);
            color: var(--text-primary);
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            outline: none;
            transition: background 0.2s, transform 0.15s;
            touch-action: manipulation;
        }
        .ms-send-btn:hover { background: rgba(224,224,224,0.28); }
        .ms-send-btn:active { transform: scale(0.95); }
        .ms-extra-actions {
            display: flex;
            gap: 16px;
            justify-content: center;
        }
        .ms-extra-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 12px;
            cursor: pointer;
            font-family: inherit;
            padding: 4px 0;
            transition: color 0.2s;
            touch-action: manipulation;
        }
        .ms-extra-btn:hover { color: var(--chrome); }

        /* ===== КОНТЕКСТНОЕ МЕНЮ ЧАТА ===== */
        .ms-ctx-menu {
            position: absolute;
            right: 12px;
            top: 58px;
            background: var(--carbon-fiber);
            -webkit-backdrop-filter: blur(20px);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px;
            padding: 6px;
            z-index: 500;
            min-width: 180px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .ms-ctx-btn {
            display: block;
            width: 100%;
            padding: 10px 16px;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            text-align: left;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            border-radius: 10px;
            transition: background 0.2s, color 0.2s;
            touch-action: manipulation;
        }
        .ms-ctx-btn:hover { background: rgba(224,224,224,0.08); color: var(--text-primary); }
        .ms-ctx-btn.danger:hover { background: rgba(239,68,68,0.15); color: var(--error); }

        @media (max-width: 768px) {
            .ms-tab { font-size: 11px; padding: 8px 6px; }
            .ms-chat-screen { height: 100dvh; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ
// ============================================
// Защита от двойной загрузки (let бросает SyntaxError при повторном объявлении)
if (!window._msState) {
    window._msState = {
        tab:           'notifications',
        notifications: [],
        chats:         [],
        unreadCount:   0
    };
}
const _msState = window._msState;

// ============================================
// УТИЛИТЫ
// ============================================
function _msApi()    { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _msUserId() { return window.CONFIG?.USER_ID; }
function _msToast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }
function _msHome()   { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }

function _msTime(str) {
    if (!str) return '';
    const d = new Date(str), now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин';
    if (diff < 86400) return Math.floor(diff/3600) + ' ч';
    if (diff < 604800) return Math.floor(diff/86400) + ' д';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function _msEsc(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

async function _msFetch(endpoint, opts = {}) {
    const url = endpoint.startsWith('http') ? endpoint : _msApi() + endpoint;
    const uid = _msUserId();
    // Добавляем user_id в query string вместо кастомного заголовка (CORS preflight)
    const sep = url.includes('?') ? '&' : '?';
    const urlWithUid = url + sep + 'user_id=' + uid;
    const r = await fetch(urlWithUid, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...opts.headers }
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    return d;
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================
async function _loadNotifications() {
    try {
        const d = await _msFetch('/api/notifications');
        if (d.success) _msState.notifications = d.notifications || [];
    } catch (e) { console.warn('notifications fetch:', e.message); }
    return _msState.notifications;
}

async function _loadChats() {
    try {
        const d = await _msFetch('/api/chats');
        if (d.success) {
            _msState.chats = d.chats || [];
            _msState.unreadCount = _msState.chats.reduce((s, c) => s + (c.unreadCount || 0), 0);
        }
    } catch (e) { console.warn('chats fetch:', e.message); }
    _updateBadge();
    return _msState.chats;
}

async function _loadMessages(chatId) {
    try {
        const d = await _msFetch(`/api/chats/${chatId}/messages`);
        return d.success ? d.messages || [] : [];
    } catch (e) { console.warn('messages fetch:', e.message); return []; }
}

async function _sendMessage(chatId, text) {
    try {
        const d = await _msFetch(`/api/chats/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ text: text.trim() })
        });
        return d.success ? d.message : null;
    } catch (e) {
        _msToast('❌ Не удалось отправить сообщение', 'error');
        return null;
    }
}

async function _markRead(chatId) {
    try { await _msFetch(`/api/chats/${chatId}/read`, { method: 'POST', body: JSON.stringify({ user_id: _msUserId() }) }); } catch {}
    const c = _msState.chats.find(x => x.id === chatId);
    if (c) { c.unreadCount = 0; }
    _msState.unreadCount = _msState.chats.reduce((s, c) => s + (c.unreadCount || 0), 0);
    _updateBadge();
}

async function _blockUser(chatId) {
    try {
        const d = await _msFetch(`/api/chats/${chatId}/block`, { method: 'POST' });
        if (d.success) {
            _msState.chats = _msState.chats.filter(c => c.id !== chatId);
            _msToast('🚫 Пользователь заблокирован', 'success');
            return true;
        }
    } catch (e) { _msToast('❌ Ошибка блокировки', 'error'); }
    return false;
}

async function _acceptMatch(matchId, candidateId, candidateName) {
    try {
        const d = await _msFetch(`/api/matches/${matchId}/accept`, { method: 'POST' });
        if (d.success && d.chatId) {
            _msToast(`✅ Чат с ${candidateName} создан`, 'success');
            await _loadChats();
            _openChat(d.chatId);
            return true;
        }
    } catch (e) { _msToast('❌ Не удалось создать чат', 'error'); }
    return false;
}

async function _declineMatch(matchId, candidateName, notifId) {
    try {
        await _msFetch(`/api/matches/${matchId}/decline`, { method: 'POST' });
    } catch {}
    _msState.notifications = _msState.notifications.filter(n => n.id !== notifId);
    _msToast(`Запрос отклонён`, 'info');
    _renderNotifTab();
}

async function _shareContact(chatId) {
    try {
        const d = await _msFetch(`/api/chats/${chatId}/share-contact`, { method: 'POST' });
        if (d.success) return d.contact;
    } catch {}
    return null;
}

// ============================================
// БЕЙДЖ
// ============================================
function _updateBadge() {
    const badge = document.getElementById('messagesBadge');
    const unread = _msState.notifications.filter(n => !n.isRead).length;
    const total  = (_msState.unreadCount || 0) + unread;
    if (badge) {
        badge.style.display = total > 0 ? '' : 'none';
        const span = badge.querySelector('.msg-badge');
        if (span) span.textContent = total > 99 ? '99+' : String(total);
    }
}

// ============================================
// ГЛАВНЫЙ ЭКРАН
// ============================================
function _renderMain() {
    _msInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const unreadNotif = _msState.notifications.filter(n => !n.isRead).length;
    const unreadChats = _msState.unreadCount;

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="msBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">💬</div>
                <h1 class="content-title">Сообщения</h1>
            </div>

            <div class="ms-tabs">
                <button class="ms-tab ${_msState.tab==='notifications'?'active':''}" data-tab="notifications">
                    🔔 Уведомления
                    ${unreadNotif>0?`<span class="ms-tab-badge">${unreadNotif}</span>`:''}
                </button>
                <button class="ms-tab ${_msState.tab==='chats'?'active':''}" data-tab="chats">
                    💬 Чаты
                    ${unreadChats>0?`<span class="ms-tab-badge">${unreadChats}</span>`:''}
                </button>
                <button class="ms-tab ${_msState.tab==='requests'?'active':''}" data-tab="requests">
                    🎯 Запросы
                </button>
            </div>

            <div id="msTabContent"></div>
        </div>`;

    document.getElementById('msBack').onclick = () => _msHome();

    document.querySelectorAll('.ms-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _msState.tab = btn.dataset.tab;
            _renderMain();
        });
    });

    // Грузим данные и рендерим вкладку
    Promise.all([_loadNotifications(), _loadChats()]).then(() => {
        if (_msState.tab === 'notifications') _renderNotifTab();
        else if (_msState.tab === 'chats')    _renderChatsTab();
        else                                  _renderRequestsTab();
    });
}

// ============================================
// ВКЛАДКА: УВЕДОМЛЕНИЯ
// ============================================
function _renderNotifTab() {
    const c = document.getElementById('msTabContent');
    if (!c) return;

    if (!_msState.notifications.length) {
        c.innerHTML = `<div class="ms-empty">
            <div class="ms-empty-icon">🔔</div>
            <div class="ms-empty-title">Нет уведомлений</div>
            <div class="ms-empty-sub">Когда появятся совпадения или запросы — они будут здесь</div>
        </div>`;
        return;
    }

    const unread = _msState.notifications.filter(n => !n.isRead);
    const read   = _msState.notifications.filter(n => n.isRead);

    let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="ms-read-all-btn" id="msReadAll">✓ Отметить всё прочитанным</button>
    </div>`;

    if (unread.length) {
        html += `<p class="ms-notif-group-title">🔴 Новые (${unread.length})</p>`;
        html += unread.map(n => _notifItemHtml(n, true)).join('');
    }
    if (read.length) {
        html += `<p class="ms-notif-group-title" style="margin-top:16px">📖 Прочитанные</p>`;
        html += read.map(n => _notifItemHtml(n, false)).join('');
    }

    c.innerHTML = html;

    document.getElementById('msReadAll')?.addEventListener('click', async () => {
        try { await _msFetch('/api/notifications/read-all', { method: 'POST', body: JSON.stringify({ user_id: _msUserId() }) }); } catch {}
        _msState.notifications.forEach(n => n.isRead = true);
        _updateBadge();
        _renderNotifTab();
    });

    c.querySelectorAll('[data-accept]').forEach(btn => {
        btn.addEventListener('click', () => {
            const { matchId, userId, userName, notifId } = btn.dataset;
            _acceptMatch(matchId, userId, userName);
        });
    });

    c.querySelectorAll('[data-decline]').forEach(btn => {
        btn.addEventListener('click', () => {
            const { matchId, userName, notifId } = btn.dataset;
            _declineMatch(matchId, userName, notifId);
        });
    });

    c.querySelectorAll('[data-share-contact]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const contact = await _shareContact(btn.dataset.chatId);
            if (contact) _msToast('🔓 Контакты раскрыты!', 'success');
        });
    });

    c.querySelectorAll('[data-del-notif]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.delNotif;
            try { await _msFetch(`/api/notifications/${id}`, { method: 'DELETE' }); } catch {}
            _msState.notifications = _msState.notifications.filter(n => n.id !== id);
            _renderNotifTab();
        });
    });
}

function _notifItemHtml(n, unread) {
    let actions = '';
    if (n.type === 'new_match' && n.data) {
        actions = `<div class="ms-notif-actions">
            <button class="ms-notif-btn ms-notif-btn-accept"
                data-accept="1" data-match-id="${n.data.matchId}"
                data-user-id="${n.data.candidateId}" data-user-name="${n.data.candidateName||''}"
                data-notif-id="${n.id}">✅ Написать</button>
            <button class="ms-notif-btn ms-notif-btn-decline"
                data-decline="1" data-match-id="${n.data.matchId}"
                data-user-name="${n.data.candidateName||''}" data-notif-id="${n.id}">✗ Отклонить</button>
        </div>`;
    } else if (n.type === 'contact_request' && n.data) {
        actions = `<div class="ms-notif-actions">
            <button class="ms-notif-btn ms-notif-btn-accept"
                data-share-contact="1" data-chat-id="${n.data.chatId}">🔓 Раскрыть контакты</button>
            <button class="ms-notif-btn ms-notif-btn-decline"
                data-del-notif="${n.id}">✗ Отказать</button>
        </div>`;
    }

    return `<div class="ms-notif-item ${unread?'unread':''}">
        <div class="ms-notif-top">
            <div class="ms-notif-title">${_msEsc(n.title||'')}</div>
            <div class="ms-notif-time">${_msTime(n.createdAt)}</div>
        </div>
        <div class="ms-notif-body">${_msEsc(n.body||'')}</div>
        ${actions}
    </div>`;
}

// ============================================
// ВКЛАДКА: ЧАТЫ
// ============================================
function _renderChatsTab() {
    const c = document.getElementById('msTabContent');
    if (!c) return;

    if (!_msState.chats.length) {
        c.innerHTML = `<div class="ms-empty">
            <div class="ms-empty-icon">💬</div>
            <div class="ms-empty-title">Нет чатов</div>
            <div class="ms-empty-sub">Начните общение с кем-то из найденных кандидатов в разделе «Двойники»</div>
        </div>`;
        return;
    }

    const compatIcon = s => s >= 90 ? '🔥' : s >= 75 ? '✦' : '·';

    c.innerHTML = _msState.chats.map(chat => `
        <div class="ms-chat-item ${chat.unreadCount?'unread':''}" data-chat-id="${chat.id}">
            <div class="ms-chat-avatar">${chat.partnerGender==='female'?'👩':'👨'}</div>
            <div class="ms-chat-info">
                <div class="ms-chat-top">
                    <div class="ms-chat-name">
                        ${_msEsc(chat.partnerName||'Собеседник')}${chat.partnerAge?', '+chat.partnerAge:''}
                        ${chat.compatibility?`<span class="ms-compat-tag">${compatIcon(chat.compatibility)} ${chat.compatibility}%</span>`:''}
                    </div>
                    <div class="ms-chat-time">${_msTime(chat.lastMessageAt)}</div>
                </div>
                <div class="ms-chat-preview">${_msEsc(chat.lastMessage?.text||'Начните диалог')}</div>
            </div>
            ${chat.unreadCount ? '<div class="ms-unread-dot"></div>' : ''}
        </div>`).join('');

    c.querySelectorAll('.ms-chat-item').forEach(el => {
        el.addEventListener('click', () => _openChat(el.dataset.chatId));
    });
}

// ============================================
// ВКЛАДКА: ЗАПРОСЫ
// ============================================
function _renderRequestsTab() {
    const c = document.getElementById('msTabContent');
    if (!c) return;
    c.innerHTML = `<div class="ms-empty">
        <div class="ms-empty-icon">🎯</div>
        <div class="ms-empty-title">Активные запросы</div>
        <div class="ms-empty-sub">Здесь будут ваши активные поиски и их статус</div>
    </div>`;
}

// ============================================
// ОТКРЫТЬ ЧАТ
// ============================================
async function _openChat(chatId) {
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const chat = _msState.chats.find(c => c.id === chatId);
    await _markRead(chatId);
    const messages = await _loadMessages(chatId);
    const uid = _msUserId();

    _msInjectStyles();

    container.innerHTML = `
        <div class="ms-chat-screen" id="msChatScreen">
            <div class="ms-chat-header">
                <button class="back-btn" id="msChatBack" style="margin:0;padding:8px 16px;font-size:13px">◀️</button>
                <div class="ms-chat-header-info">
                    <div class="ms-chat-header-name">
                        ${_msEsc(chat?.partnerName||'Собеседник')}${chat?.partnerAge?', '+chat.partnerAge:''}
                    </div>
                    <div class="ms-chat-header-sub">
                        <span class="ms-online-dot"></span> онлайн
                        ${chat?.compatibility?'&nbsp;·&nbsp;'+chat.compatibility+'% совм.':''}
                    </div>
                </div>
                <button class="ms-menu-btn" id="msChatMenu">⋮</button>
            </div>

            <div class="ms-messages-list" id="msMsgList">
                ${_msRenderMessages(messages, uid, chat)}
            </div>

            <div class="ms-chat-footer">
                <div class="ms-contact-info" id="msContactInfo" style="display:none"></div>
                <div class="ms-input-row">
                    <input class="ms-input" id="msChatInput" placeholder="Сообщение..." autocomplete="off" type="text">
                    <button class="ms-send-btn" id="msSendBtn">➤</button>
                </div>
                <div class="ms-extra-actions">
                    <button class="ms-extra-btn" id="msContactReq">📞 Запросить контакты</button>
                    <button class="ms-extra-btn" id="msShareContact">🔓 Раскрыть мои контакты</button>
                </div>
            </div>
        </div>`;

    // Прокрутка вниз
    setTimeout(() => {
        const list = document.getElementById('msMsgList');
        if (list) list.scrollTop = list.scrollHeight;
    }, 80);

    document.getElementById('msChatBack').onclick = () => _renderMain();

    // Отправка
    const send = async () => {
        const input = document.getElementById('msChatInput');
        const text  = input?.value?.trim();
        if (!text) return;
        input.value = '';
        const msg = await _sendMessage(chatId, text);
        if (msg) {
            const list = document.getElementById('msMsgList');
            if (list) {
                list.insertAdjacentHTML('beforeend', _msMsgHtml(msg, true));
                list.scrollTop = list.scrollHeight;
            }
        }
    };

    document.getElementById('msSendBtn').onclick = send;
    document.getElementById('msChatInput').addEventListener('keypress', e => { if (e.key === 'Enter') send(); });

    document.getElementById('msContactReq').onclick = async () => {
        try { await _msFetch(`/api/chats/${chatId}/contact`, { method: 'POST' }); _msToast('📞 Запрос отправлен', 'success'); }
        catch { _msToast('❌ Ошибка', 'error'); }
    };

    document.getElementById('msShareContact').onclick = async () => {
        const contact = await _shareContact(chatId);
        if (contact) {
            const box = document.getElementById('msContactInfo');
            if (box) {
                box.style.display = '';
                box.innerHTML = `🔓 Контакты раскрыты!<br>📞 ${_msEsc(contact.phone||'—')}&nbsp;&nbsp;📧 ${_msEsc(contact.email||'—')}`;
            }
            _msToast('🔓 Контакты раскрыты!', 'success');
        }
    };

    // Контекстное меню
    document.getElementById('msChatMenu').onclick = (e) => {
        e.stopPropagation();
        document.querySelector('.ms-ctx-menu')?.remove();
        const popup = document.createElement('div');
        popup.className = 'ms-ctx-menu';
        popup.innerHTML = `
            <button class="ms-ctx-btn danger" id="msBlock">🚫 Заблокировать</button>
            <button class="ms-ctx-btn" id="msDelChat">🗑️ Удалить чат</button>`;
        document.getElementById('msChatScreen')?.appendChild(popup);

        document.getElementById('msBlock').onclick = async () => {
            popup.remove();
            const ok = await _msConfirm('Заблокировать пользователя?', 'Чат будет закрыт.');
            if (!ok) return;
            const done = await _blockUser(chatId);
            if (done) _renderMain();
        };
        document.getElementById('msDelChat').onclick = () => {
            popup.remove();
            _msToast('Удаление чата — скоро', 'info');
        };

        const closeMenu = (ev) => {
            if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click', closeMenu); }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 50);
    };
}

function _msRenderMessages(messages, uid, chat) {
    if (!messages?.length) {
        return `
            <div class="ms-msg ms-msg-system"><div class="ms-msg-bubble">💬 Начните общение!</div></div>
            <div class="ms-msg ms-msg-system"><div class="ms-msg-bubble">🔒 Чат анонимный. Контакты раскрываются по согласию.</div></div>
            ${chat?.compatibility?`<div class="ms-msg ms-msg-system"><div class="ms-msg-bubble">✦ Совместимость: ${chat.compatibility}%</div></div>`:''}`;
    }
    return messages.map(m => {
        if (m.type === 'system') return `<div class="ms-msg ms-msg-system"><div class="ms-msg-bubble">${_msEsc(m.text)}</div></div>`;
        return _msMsgHtml(m, m.fromUserId == uid);
    }).join('');
}

function _msMsgHtml(msg, isOwn) {
    const check = isOwn ? (msg.isRead ? ' ✓✓' : ' ✓') : '';
    return `<div class="ms-msg ${isOwn?'ms-msg-own':'ms-msg-other'}">
        <div class="ms-msg-bubble">
            ${_msEsc(msg.text||'')}
            <div class="ms-msg-time">${_msTime(msg.createdAt)}${check}</div>
        </div>
    </div>`;
}

// ============================================
// ДИАЛОГ ПОДТВЕРЖДЕНИЯ
// ============================================
function _msConfirm(title, sub) {
    return new Promise(resolve => {
        _msInjectStyles();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `
            <div style="background:var(--carbon-fiber);border:1px solid rgba(224,224,224,0.2);border-radius:24px;padding:28px 24px;max-width:320px;width:100%;text-align:center">
                <div style="font-size:36px;margin-bottom:10px">⚠️</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">${title}</div>
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.5">${sub}</div>
                <div style="display:flex;gap:10px">
                    <button id="msCancelBtn" style="flex:1;padding:12px;border-radius:30px;background:transparent;border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;font-size:13px;cursor:pointer;min-height:44px">Отмена</button>
                    <button id="msOkBtn" style="flex:1;padding:12px;border-radius:30px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.35);color:var(--error);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:44px">Подтвердить</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('msOkBtn').onclick    = () => { overlay.remove(); resolve(true);  };
        document.getElementById('msCancelBtn').onclick = () => { overlay.remove(); resolve(false); };
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ БЕЙДЖА (вызывается из app.js)
// ============================================
function _initBadge() {
    _loadNotifications().then(_loadChats).then(_updateBadge).catch(() => {});
    // Обновляем бейдж каждые 60 секунд
    if (!window._msBadgeTimer) {
        window._msBadgeTimer = setInterval(() => {
            _loadNotifications().then(_loadChats).then(_updateBadge).catch(() => {});
        }, 60000);
    }
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showMessagesScreen() {
    try {
        const uid = _msUserId();
        const r   = await fetch(`${_msApi()}/api/user-status?user_id=${uid}`);
        const d   = await r.json();
        if (!d.has_profile) {
            _msToast('📊 Сначала пройдите психологический тест', 'info');
            return;
        }
    } catch {
        _msToast('⚠️ Не удалось проверить статус', 'error');
        return;
    }

    _msInjectStyles();
    _renderMain();
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showMessagesScreen  = showMessagesScreen;
window.updateMessagesBadge = _updateBadge;
window.openChat            = _openChat;
window.messagesState       = _msState;

// ============================================
// СОВМЕСТИМОСТЬ С chat.js (встроено)
// ============================================

// Перезагрузить сообщения в открытом чате (вызывается из WebSocket)
window.loadChatMessages = async function(chatId) {
    const id = chatId || _msState._chatId;
    if (!id) return;
    const uid      = _msUserId();
    const messages = await _loadMessages(id);
    const list     = document.getElementById('msMsgList');
    const chat     = _msState.chats.find(c => c.id === id);
    if (list) {
        list.innerHTML = _msRenderMessages(messages, uid, chat);
        list.scrollTop = list.scrollHeight;
        await _markRead(id);
    }
};

// Обновить статус прочтения конкретного сообщения
window.updateMessageStatus = function(messageId, status) {
    // Помечаем галочки ✓✓ если сообщение прочитано
    const msgs = document.querySelectorAll('.ms-msg-own .ms-msg-time');
    msgs.forEach(el => {
        if (el.dataset.msgId === String(messageId) && status === 'read') {
            el.textContent = el.textContent.replace('✓', '✓✓');
        }
    });
    console.log('Message status updated:', messageId, status);
};

// Показать раскрытые контакты в открытом чате
window.showContactShared = function(contact) {
    const box = document.getElementById('msContactInfo');
    if (box) {
        box.style.display = '';
        box.innerHTML = `🔓 Контакты раскрыты!<br>📞 ${contact?.phone || '—'}&nbsp;&nbsp;📧 ${contact?.email || '—'}`;
    }
};

// НЕ вызываем _initBadge() при загрузке — /api/notifications и /api/chats
// могут быть не реализованы на бэкенде и вызывать CORS-ошибки.
// Бейдж обновится когда пользователь откроет экран сообщений.

console.log('✅ messages.js v2.0 загружен (включает chat.js)');

} // end guard
