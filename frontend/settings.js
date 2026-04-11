// ============================================
// settings.js v3.1 — with section descriptions
// ============================================

(function () {
    if (window._settingsLoaded) return;
    window._settingsLoaded = true;

    const TG_BOT = window.CONFIG?.TG_BOT_USERNAME || 'Frederick777bot';
    const MAX_LINK = window.CONFIG?.MAX_BOT_LINK || 'https://max.ru/id502238728185_1_bot';

    function _api() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
    function _uid() { return window.CONFIG?.USER_ID; }
    function _toast(msg, t) { if (window.showToast) window.showToast(msg, t || 'info'); }

    function _injectStyles() {
        if (document.getElementById('st3-styles')) return;
        const s = document.createElement('style');
        s.id = 'st3-styles';
        s.textContent = `
            .st-section{margin-bottom:8px}
            .st-acc-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.08);border-radius:14px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:background 0.15s;margin-bottom:2px}
            .st-acc-header:hover{background:rgba(224,224,224,0.06)}
            .st-acc-header.open{border-radius:14px 14px 0 0;border-bottom:none}
            .st-acc-left{display:flex;align-items:center;gap:10px}
            .st-acc-icon{font-size:18px}
            .st-acc-title{font-size:13px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:var(--text-secondary)}
            .st-acc-arrow{font-size:10px;color:var(--text-secondary);transition:transform 0.2s}
            .st-acc-header.open .st-acc-arrow{transform:rotate(90deg)}
            .st-acc-body{overflow:hidden;max-height:0;transition:max-height 0.3s ease;background:rgba(224,224,224,0.02);border:1px solid rgba(224,224,224,0.08);border-top:none;border-radius:0 0 14px 14px}
            .st-acc-body.open{max-height:800px}
            .st-acc-content{padding:16px}
            .st-hint{font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:14px;padding:10px 12px;background:rgba(224,224,224,0.03);border-radius:10px;border:1px solid rgba(224,224,224,0.06)}
            .st-channel-grid{display:flex;flex-direction:column;gap:10px}
            .st-channel-card{display:flex;align-items:center;gap:14px;background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);border-radius:14px;padding:14px;cursor:pointer;transition:background 0.18s,border-color 0.18s;touch-action:manipulation}
            .st-channel-card.active{background:rgba(224,224,224,0.13);border-color:rgba(224,224,224,0.4)}
            .st-channel-icon{font-size:22px;flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:rgba(224,224,224,0.07);border-radius:12px}
            .st-channel-body{flex:1;min-width:0}
            .st-channel-title{font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:2px}
            .st-channel-desc{font-size:11px;color:var(--text-secondary);line-height:1.4}
            .st-channel-check{font-size:16px;flex-shrink:0;opacity:0;transition:opacity 0.18s;color:var(--chrome)}
            .st-channel-card.active .st-channel-check{opacity:1}
            .st-link-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(224,224,224,0.1)}
            .st-link-status{font-size:11px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:4px}
            .st-link-status.linked{color:rgba(120,200,140,0.95)}
            .st-link-btn{padding:6px 12px;border-radius:20px;font-size:11px;font-weight:500;font-family:inherit;cursor:pointer;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.18);color:var(--text-secondary);text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:background 0.18s;touch-action:manipulation}
            .st-link-btn:hover{background:rgba(224,224,224,0.14);color:var(--text-primary)}
            .st-link-btn.danger{color:rgba(255,140,140,0.85)}
            .st-tasks-empty{font-size:12px;color:var(--text-secondary);font-style:italic;padding:8px 0}
            .st-theme-grid{display:flex;gap:10px}
            .st-theme-card{flex:1;padding:16px;border-radius:14px;cursor:pointer;text-align:center;border:2px solid transparent;transition:border-color 0.18s;touch-action:manipulation}
            .st-theme-card.active{border-color:var(--chrome)}
            .st-theme-dark{background:#111;color:#fff}
            .st-theme-light{background:#f0f0f0;color:#111}
            .st-theme-label{font-size:12px;font-weight:600;margin-top:8px}
            .st-profile-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(224,224,224,0.06);font-size:13px}
            .st-profile-label{color:var(--text-secondary)}
            .st-profile-value{color:var(--text-primary);font-weight:500}
        `;
        document.head.appendChild(s);
    }

    let _state = { channel: 'push', linked: { telegram: null, max: null }, theme: 'dark' };

    async function _loadSettings() {
        const uid = _uid(); if (!uid) return;
        try {
            const r = await fetch(`${_api()}/api/settings/notifications/${uid}`);
            const d = await r.json();
            if (d.success) {
                _state.channel = d.channel || 'push';
                _state.linked = { telegram: null, max: null };
                for (const l of (d.linked || [])) {
                    if (l.platform === 'telegram') _state.linked.telegram = l;
                    if (l.platform === 'max') _state.linked.max = l;
                }
            }
        } catch (e) {}
        _state.theme = localStorage.getItem('fredi_theme') || 'dark';
    }

    async function _saveChannel(ch) {
        const uid = _uid(); if (!uid) return;
        try {
            const r = await fetch(`${_api()}/api/settings/notifications`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, channel: ch })
            });
            const d = await r.json();
            if (d.success) { _state.channel = ch; _toast('Сохранено', 'info'); }
        } catch (e) { _toast('Ошибка сети', 'error'); }
    }

    async function _unlink(platform) {
        const uid = _uid(); if (!uid) return;
        try {
            const r = await fetch(`${_api()}/api/messenger/unlink`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, platform })
            });
            const d = await r.json();
            if (d.success) { _state.linked[platform] = null; _toast(platform + ' отвязан', 'info'); _renderSettings(); }
        } catch (e) { _toast('Ошибка сети', 'error'); }
    }

    function _setTheme(theme) {
        _state.theme = theme;
        localStorage.setItem('fredi_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        _toast(theme === 'light' ? 'Светлая тема' : 'Темная тема', 'info');
        _renderSettings();
    }

    function _accordion(id, icon, title) {
        return '<div class="st-acc-header" data-acc="' + id + '"><div class="st-acc-left"><span class="st-acc-icon">' + icon + '</span><span class="st-acc-title">' + title + '</span></div><span class="st-acc-arrow">&#9654;</span></div><div class="st-acc-body" data-acc-body="' + id + '"><div class="st-acc-content" id="stAcc_' + id + '"></div></div>';
    }

    function _channelCard(key, icon, title, desc, extra) {
        var act = _state.channel === key;
        return '<div class="st-channel-card ' + (act ? 'active' : '') + '" data-channel="' + key + '"><div class="st-channel-icon">' + icon + '</div><div class="st-channel-body"><div class="st-channel-title">' + title + '</div><div class="st-channel-desc">' + desc + '</div>' + (extra || '') + '</div><div class="st-channel-check">' + (act ? '\u2713' : '') + '</div></div>';
    }

    function _linkRow(platform, link) {
        var l = _state.linked[platform];
        if (l) {
            var u = l.username ? '@' + l.username : 'привязан';
            return '<div class="st-link-row" onclick="event.stopPropagation()"><span class="st-link-status linked">\u2713 ' + u + '</span><button class="st-link-btn danger" data-action="unlink" data-platform="' + platform + '">Отвязать</button></div>';
        }
        return '<div class="st-link-row" onclick="event.stopPropagation()"><span class="st-link-status">Не связан</span><a class="st-link-btn" href="' + link + '" target="_blank" rel="noopener">Связать</a></div>';
    }

    function _renderSettings() {
        _injectStyles();
        var c = document.getElementById('screenContainer');
        if (!c) return;

        c.innerHTML = '<div class="full-content-page">' +
            '<button class="back-btn" id="stBack">\u25C0\uFE0F НАЗАД</button>' +
            '<div class="content-header"><div class="content-emoji">\u2699\uFE0F</div>' +
            '<h1 class="content-title">Настройки</h1>' +
            '<p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Управление Фреди</p></div>' +
            _accordion('subscription', '\uD83D\uDC8E', 'Подписка') +
            _accordion('tasks', '\uD83D\uDCCB', 'Активные задачи') +
            _accordion('notifications', '\uD83D\uDD14', 'Уведомления') +
            _accordion('appearance', '\uD83C\uDFA8', 'Оформление') +
            _accordion('profile', '\uD83D\uDC64', 'Профиль') +
            '</div>';

        document.getElementById('stBack').onclick = function() { if (typeof renderDashboard === 'function') renderDashboard(); };

        document.querySelectorAll('.st-acc-header').forEach(function(h) {
            h.addEventListener('click', function() {
                var id = h.dataset.acc;
                var body = document.querySelector('[data-acc-body="' + id + '"]');
                var isOpen = h.classList.contains('open');
                document.querySelectorAll('.st-acc-header').forEach(function(x) { x.classList.remove('open'); });
                document.querySelectorAll('.st-acc-body').forEach(function(x) { x.classList.remove('open'); });
                if (!isOpen) { h.classList.add('open'); body.classList.add('open'); _renderSection(id); }
            });
        });

        var subH = document.querySelector('[data-acc="subscription"]');
        if (subH) subH.click();
    }

    function _renderSection(id) {
        var el = document.getElementById('stAcc_' + id);
        if (!el) return;

        if (id === 'subscription') {
            el.innerHTML = '<div class="st-hint">Управление подпиской Фреди Premium. С подпиской Фреди работает без ограничений по времени и с премиум-функциями.</div><div id="subscriptionSection"></div>';
            var sub = document.getElementById('subscriptionSection');
            if (sub && typeof window.renderSubscriptionSection === 'function') window.renderSubscriptionSection(sub);
        }

        if (id === 'tasks') {
            el.innerHTML = '<div class="st-hint">Здесь отображаются задачи, которые Фреди выполняет для вас: отслеживание привычек, контроль целей и напоминания. Скажите Фреди голосом или текстом, что хотите, и задача появится здесь.</div>' +
                '<div class="st-tasks-empty">Пока нет активных задач.</div>' +
                '<div style="margin-top:12px;font-size:11px;color:var(--text-secondary)">' +
                '<b>Примеры команд:</b><br>' +
                '\u2022 "Хочу сформировать привычку медитации"<br>' +
                '\u2022 "Моя цель - выучить английский"<br>' +
                '\u2022 "Напомни завтра в 9 утра позвонить маме"</div>';
        }

        if (id === 'notifications') {
            var uid = _uid() || 0;
            var tgLink = 'https://t.me/' + TG_BOT + '?start=web_' + uid;
            var maxLink = MAX_LINK + '?start=web_' + uid;

            el.innerHTML = '<div class="st-hint">Выберите, куда Фреди будет отправлять сообщения: утренние послания, напоминания о задачах, уведомления о привычках и другие оповещения.</div>' +
                '<div class="st-channel-grid">' +
                _channelCard('push', '\uD83D\uDD14', 'Web Push', 'Уведомления прямо в браузере. На iPhone нужно добавить на экран Домой.', '') +
                _channelCard('telegram', '\u2708\uFE0F', 'Telegram', 'Все сообщения от Фреди будут приходить в Telegram-бот.', _linkRow('telegram', tgLink)) +
                _channelCard('max', '\uD83D\uDCAC', 'Max', 'Все сообщения от Фреди будут приходить в Max-бот.', _linkRow('max', maxLink)) +
                _channelCard('none', '\uD83D\uDD15', 'Не отправлять', 'Фреди не будет присылать уведомления.', '') +
                '</div>' +
                '<div style="margin-top:12px;font-size:11px;color:var(--text-secondary)">' +
                '<b>Что присылает Фреди:</b><br>' +
                '\u2022 Утренние мотивационные сообщения (9:00)<br>' +
                '\u2022 Напоминания о задачах и привычках<br>' +
                '\u2022 Идеи на выходные (по пятницам)<br>' +
                '\u2022 Уведомления об окончании перерыва</div>';

            el.querySelectorAll('.st-channel-card').forEach(function(card) {
                card.addEventListener('click', async function(e) {
                    if (e.target.closest('.st-link-btn') || e.target.closest('.st-link-row')) return;
                    var ch = card.dataset.channel;
                    if (ch === _state.channel) return;
                    await _saveChannel(ch);
                    _renderSection('notifications');
                });
            });

            el.querySelectorAll('[data-action="unlink"]').forEach(function(btn) {
                btn.addEventListener('click', async function(e) {
                    e.stopPropagation(); e.preventDefault();
                    if (confirm('Отвязать ' + btn.dataset.platform + '?')) await _unlink(btn.dataset.platform);
                });
            });
        }

        if (id === 'appearance') {
            el.innerHTML = '<div class="st-hint">Выберите тему оформления приложения.</div>' +
                '<div class="st-theme-grid">' +
                '<div class="st-theme-card st-theme-dark ' + (_state.theme === 'dark' ? 'active' : '') + '" data-theme="dark">\uD83C\uDF19<div class="st-theme-label">Темная</div></div>' +
                '<div class="st-theme-card st-theme-light ' + (_state.theme === 'light' ? 'active' : '') + '" data-theme="light">\u2600\uFE0F<div class="st-theme-label">Светлая</div></div>' +
                '</div>';

            el.querySelectorAll('.st-theme-card').forEach(function(card) {
                card.addEventListener('click', function() { _setTheme(card.dataset.theme); });
            });
        }

        if (id === 'profile') {
            var name = localStorage.getItem('fredi_user_name') || 'Не указано';
            el.innerHTML = '<div class="st-hint">Информация о вашем аккаунте. Имя используется в обращениях Фреди.</div>' +
                '<div class="st-profile-row"><span class="st-profile-label">Имя</span><span class="st-profile-value">' + name + '</span></div>' +
                '<div class="st-profile-row"><span class="st-profile-label">User ID</span><span class="st-profile-value">' + (_uid() || '-') + '</span></div>' +
                '<div class="st-profile-row" style="border-bottom:none"><span class="st-profile-label">Версия</span><span class="st-profile-value">Фреди v3.2</span></div>';
        }
    }

    async function showSettingsScreen() { _renderSettings(); await _loadSettings(); _renderSettings(); }

    window.showSettingsScreen = showSettingsScreen;
    console.log('settings.js v3.1 loaded');
})();
