// ============================================
// settings.js — Экран настроек
// Версия 3.1 — аккордеон, описания секций
// ============================================

(function () {
    if (window._settingsLoaded) return;
    window._settingsLoaded = true;

    const TG_BOT_USERNAME = window.CONFIG?.TG_BOT_USERNAME || 'Nanotech_varik_bot';
    const MAX_BOT_LINK = window.CONFIG?.MAX_BOT_LINK || 'https://max.ru/id502238728185_bot';

    function _setApi() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
    function _setUid() { return window.CONFIG?.USER_ID; }
    function _setToast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }

    function _injectSettingsStyles() {
        if (document.getElementById('settings-v31-styles')) return;
        const s = document.createElement('style');
        s.id = 'settings-v31-styles';
        s.textContent = `
            .st-section { margin-bottom: 8px; border-bottom: 1px solid rgba(224,224,224,0.06); }
            .st-section:last-child { border-bottom: none; }
            .st-section-header {
                display: flex; align-items: center; justify-content: space-between;
                cursor: pointer; padding: 14px 0;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            }
            .st-section-label {
                font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
                text-transform: uppercase; color: var(--text-secondary);
            }
            .st-section-arrow {
                font-size: 10px; color: var(--text-secondary);
                transition: transform 0.25s ease;
            }
            .st-section-header.open .st-section-arrow { transform: rotate(180deg); }
            .st-section-body {
                overflow: hidden; max-height: 0; opacity: 0;
                transition: max-height 0.35s ease, opacity 0.25s ease;
                padding-bottom: 0;
            }
            .st-section-body.open { max-height: 2000px; opacity: 1; padding-bottom: 16px; }
            .st-hint {
                font-size: 12px; color: var(--text-secondary); line-height: 1.55;
                margin-bottom: 14px; padding: 10px 14px;
                background: rgba(224,224,224,0.03); border-radius: 12px;
                border: 1px solid rgba(224,224,224,0.06);
            }
            .st-channel-grid { display: flex; flex-direction: column; gap: 10px; }
            .st-channel-card {
                display: flex; align-items: center; gap: 14px;
                background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
                border-radius: 18px; padding: 16px; cursor: pointer;
                transition: background 0.18s, border-color 0.18s, transform 0.15s;
                touch-action: manipulation; -webkit-tap-highlight-color: transparent;
            }
            .st-channel-card:active { transform: scale(0.99); }
            .st-channel-card.active { background: rgba(224,224,224,0.13); border-color: rgba(224,224,224,0.4); }
            .st-channel-icon {
                font-size: 26px; flex-shrink: 0; width: 44px; height: 44px;
                display: flex; align-items: center; justify-content: center;
                background: rgba(224,224,224,0.07); border-radius: 14px;
            }
            .st-channel-body { flex: 1; min-width: 0; }
            .st-channel-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 3px; }
            .st-channel-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.4; overflow-wrap: anywhere; }
            .st-channel-check { font-size: 18px; flex-shrink: 0; opacity: 0; transition: opacity 0.18s; color: var(--chrome); }
            .st-channel-card.active .st-channel-check { opacity: 1; }
            .st-link-row {
                display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                margin-top: 10px; padding-top: 10px;
                border-top: 1px dashed rgba(224,224,224,0.1);
            }
            .st-link-status { font-size: 11px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px; }
            .st-link-status.linked { color: rgba(120, 200, 140, 0.95); }
            .st-link-btn {
                padding: 7px 14px; border-radius: 30px; font-size: 12px; font-weight: 500;
                font-family: inherit; cursor: pointer; background: rgba(224,224,224,0.07);
                border: 1px solid rgba(224,224,224,0.18); color: var(--text-secondary);
                text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
                transition: background 0.18s, color 0.18s; touch-action: manipulation;
            }
            .st-link-btn:hover { background: rgba(224,224,224,0.14); color: var(--text-primary); }
            .st-link-btn.danger { color: rgba(255, 140, 140, 0.85); }
            .st-theme-grid { display: flex; gap: 10px; }
            .st-theme-card {
                flex: 1; padding: 16px; border-radius: 14px; cursor: pointer;
                text-align: center; border: 1px solid rgba(224,224,224,0.1);
                background: rgba(224,224,224,0.04); transition: border-color 0.18s, background 0.18s;
                -webkit-tap-highlight-color: transparent;
            }
            .st-theme-card.active { border-color: rgba(224,224,224,0.4); background: rgba(224,224,224,0.13); }
            .st-theme-icon { font-size: 24px; margin-bottom: 6px; }
            .st-theme-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
            .st-profile-field { margin-bottom: 14px; }
            .st-profile-label {
                font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;
                text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
            }
            .st-profile-input {
                width: 100%; padding: 12px 14px; border-radius: 12px;
                border: 1px solid rgba(224,224,224,0.15); background: rgba(224,224,224,0.04);
                color: var(--text-primary); font-size: 14px; font-family: inherit;
                outline: none; transition: border-color 0.18s; box-sizing: border-box;
            }
            .st-profile-input:focus { border-color: rgba(224,224,224,0.35); }
            .st-profile-save {
                padding: 10px 20px; border-radius: 10px; border: none;
                background: rgba(59,130,255,0.15); color: rgba(59,130,255,0.95);
                font-size: 13px; font-weight: 600; font-family: inherit;
                cursor: pointer; transition: background 0.18s;
            }
            .st-profile-save:hover { background: rgba(59,130,255,0.25); }
            .st-tasks-empty {
                padding: 20px; text-align: center; color: var(--text-secondary);
                font-size: 13px; line-height: 1.5;
            }
        `;
        document.head.appendChild(s);
    }

    let _state = { channel: 'push', linked: { telegram: null, max: null }, theme: 'dark', name: '' };
    let _openSections = { subscription: true, tasks: false, notifications: false, appearance: false, profile: false };

    async function _loadSettings() {
        const uid = _setUid();
        if (!uid) return;
        _state.name = localStorage.getItem('fredi_user_name') || '';
        _state.theme = localStorage.getItem('fredi_theme') || 'dark';
        try {
            const r = await fetch(`${_setApi()}/api/settings/notifications/${uid}`);
            const d = await r.json();
            if (d.success) {
                _state.channel = d.channel || 'push';
                _state.linked = { telegram: null, max: null };
                for (const l of (d.linked || [])) {
                    if (l.platform === 'telegram') _state.linked.telegram = l;
                    if (l.platform === 'max') _state.linked.max = l;
                }
            }
        } catch (e) { console.error('settings load error:', e); }
    }

    async function _saveChannel(channel) {
        const uid = _setUid();
        if (!uid) return;
        try {
            const r = await fetch(`${_setApi()}/api/settings/notifications`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, channel })
            });
            const d = await r.json();
            if (d.success) { _state.channel = channel; _setToast('Способ уведомлений сохранён', 'info'); }
            else { _setToast(d.error || 'Не удалось сохранить', 'error'); }
        } catch (e) { _setToast('Ошибка сети', 'error'); }
    }

    async function _unlink(platform) {
        const uid = _setUid();
        if (!uid) return;
        try {
            const r = await fetch(`${_setApi()}/api/messenger/unlink`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, platform })
            });
            const d = await r.json();
            if (d.success) { _state.linked[platform] = null; _setToast(`${platform} отвязан`, 'info'); _renderSettings(); }
        } catch (e) { _setToast('Ошибка сети', 'error'); }
    }

    function _saveName(name) {
        localStorage.setItem('fredi_user_name', name);
        _state.name = name;
        if (window.CONFIG) window.CONFIG.USER_NAME = name;
        const el = document.getElementById('userName');
        if (el) el.textContent = name || 'Аноним';
        _setToast('Имя сохранено', 'info');
    }

    function _saveTheme(theme) {
        localStorage.setItem('fredi_theme', theme);
        _state.theme = theme;
        _setToast(theme === 'dark' ? 'Тёмная тема' : 'Светлая тема', 'info');
    }

    function _channelCard(key, icon, title, desc, extraHtml) {
        const active = _state.channel === key;
        return `<div class="st-channel-card ${active ? 'active' : ''}" data-channel="${key}">
            <div class="st-channel-icon">${icon}</div>
            <div class="st-channel-body">
                <div class="st-channel-title">${title}</div>
                <div class="st-channel-desc">${desc}</div>
                ${extraHtml || ''}
            </div>
            <div class="st-channel-check">✓</div>
        </div>`;
    }

    function _linkRow(platform, deepLink) {
        const linked = _state.linked[platform];
        if (linked) {
            const u = linked.username ? `@${linked.username}` : 'привязан';
            return `<div class="st-link-row" onclick="event.stopPropagation()">
                <span class="st-link-status linked">✓ Связан: ${u}</span>
                <button class="st-link-btn danger" data-action="unlink" data-platform="${platform}">Отвязать</button>
            </div>`;
        }
        return `<div class="st-link-row" onclick="event.stopPropagation()">
            <span class="st-link-status">Не связан</span>
            <a class="st-link-btn" href="${deepLink}" target="_blank" rel="noopener">Связать аккаунт</a>
        </div>`;
    }

    function _sectionHtml(key, icon, title, bodyHtml) {
        const open = _openSections[key];
        return `<div class="st-section" data-section="${key}">
            <div class="st-section-header ${open ? 'open' : ''}" data-toggle="${key}">
                <div class="st-section-label">${icon} ${title}</div>
                <div class="st-section-arrow">▼</div>
            </div>
            <div class="st-section-body ${open ? 'open' : ''}">${bodyHtml}</div>
        </div>`;
    }

    function _renderSettings() {
        _injectSettingsStyles();
        const c = document.getElementById('screenContainer');
        if (!c) return;
        const uid = _setUid() || 0;
        const tgDeepLink = `https://t.me/${TG_BOT_USERNAME}?start=web_${uid}`;
        const maxDeepLink = `${MAX_BOT_LINK}?start=web_${uid}`;

        const subscriptionBody = `
            <div class="st-hint">Управление подпиской Фреди Premium. Здесь можно оформить подписку, посмотреть статус и управлять автопродлением.</div>
            <div id="subscriptionSection"></div>`;

        const tasksBody = `
            <div class="st-hint">Здесь отображаются задачи, которые Фреди выполняет для вас в фоне. Например: ежедневные тренировки, анализ привычек, отслеживание целей.</div>
            <div class="st-tasks-empty">Нет активных задач</div>`;

        const pushCard = _channelCard('push', '🔔', 'Web Push', 'Уведомления в этом браузере. На iPhone добавьте приложение на экран Домой.', '');
        const tgCard = _channelCard('telegram', '✈️', 'Telegram', 'Сообщения в Telegram-бот Фреди.', _linkRow('telegram', tgDeepLink));
        const maxCard = _channelCard('max', '💬', 'Max', 'Сообщения в Max-бот Фреди.', _linkRow('max', maxDeepLink));
        const noneCard = _channelCard('none', '🔕', 'Не отправлять', 'Отключить все уведомления.', '');

        const notificationsBody = `
            <div class="st-hint">Выберите, куда Фреди будет отправлять сообщения. Фреди присылает: утренние мотивационные сообщения, напоминания о задачах, идеи на выходные, уведомления после перерыва.</div>
            <div class="st-channel-grid">${pushCard}${tgCard}${maxCard}${noneCard}</div>`;

        const darkActive = _state.theme === 'dark' ? 'active' : '';
        const lightActive = _state.theme === 'light' ? 'active' : '';
        const appearanceBody = `
            <div class="st-hint">Выберите тему оформления приложения.</div>
            <div class="st-theme-grid">
                <div class="st-theme-card ${darkActive}" data-theme="dark">
                    <div class="st-theme-icon">🌙</div>
                    <div class="st-theme-name">Тёмная</div>
                </div>
                <div class="st-theme-card ${lightActive}" data-theme="light">
                    <div class="st-theme-icon">☀️</div>
                    <div class="st-theme-name">Светлая</div>
                </div>
            </div>`;

        const profileBody = `
            <div class="st-hint">Информация о вашем аккаунте. Имя используется в обращениях Фреди.</div>
            <div class="st-profile-field">
                <div class="st-profile-label">Имя</div>
                <input type="text" class="st-profile-input" id="stProfileName" value="${_state.name}" placeholder="Как вас зовут?">
            </div>
            <button class="st-profile-save" id="stProfileSave">Сохранить</button>`;

        c.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="stBack">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">⚙️</div>
                    <h1 class="content-title">Настройки</h1>
                </div>
                ${_sectionHtml('subscription', '💎', 'Подписка', subscriptionBody)}
                ${_sectionHtml('tasks', '📋', 'Активные задачи', tasksBody)}
                ${_sectionHtml('notifications', '📬', 'Уведомления', notificationsBody)}
                ${_sectionHtml('appearance', '🎨', 'Оформление', appearanceBody)}
                ${_sectionHtml('profile', '👤', 'Профиль', profileBody)}
            </div>`;

        document.getElementById('stBack').onclick = () => { if (typeof renderDashboard === 'function') renderDashboard(); };

        document.querySelectorAll('.st-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const key = header.dataset.toggle;
                _openSections[key] = !_openSections[key];
                header.classList.toggle('open');
                const body = header.nextElementSibling;
                if (body) body.classList.toggle('open');
            });
        });

        document.querySelectorAll('.st-channel-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                if (e.target.closest('.st-link-btn') || e.target.closest('.st-link-row')) return;
                const ch = card.dataset.channel;
                if (ch === _state.channel) return;
                await _saveChannel(ch);
                _renderSettings();
            });
        });

        document.querySelectorAll('[data-action="unlink"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); e.preventDefault();
                const p = btn.dataset.platform;
                if (confirm(`Отвязать ${p}?`)) await _unlink(p);
            });
        });

        document.querySelectorAll('.st-theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const t = card.dataset.theme;
                if (t === _state.theme) return;
                _saveTheme(t);
                _renderSettings();
            });
        });

        const saveBtn = document.getElementById('stProfileSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const input = document.getElementById('stProfileName');
                if (input) _saveName(input.value.trim());
            });
        }

        const subContainer = document.getElementById('subscriptionSection');
        if (subContainer && typeof window.renderSubscriptionSection === 'function') {
            window.renderSubscriptionSection(subContainer);
        }
    }

    async function showSettingsScreen() {
        _renderSettings();
        await _loadSettings();
        _renderSettings();
    }

    window.showSettingsScreen = showSettingsScreen;
    console.log('settings.js v3.1 loaded');
})();
