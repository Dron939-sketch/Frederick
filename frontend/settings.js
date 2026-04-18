// ============================================
// settings.js v3.2 — with section descriptions + FrediTheme
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
            .st-acc-body.open{max-height:4000px}
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

            /* ===== Profile editor ===== */
            .st-prof-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
            .st-prof-avatar{width:72px;height:72px;border-radius:50%;background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.18);display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-secondary);overflow:hidden;flex-shrink:0}
            .st-prof-avatar img{width:100%;height:100%;object-fit:cover;display:block}
            .st-prof-photo-actions{display:flex;flex-direction:column;gap:6px}
            .st-prof-btn{padding:7px 12px;border-radius:20px;font-size:11px;font-weight:500;font-family:inherit;cursor:pointer;background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);touch-action:manipulation;text-align:center}
            .st-prof-btn:hover{background:rgba(224,224,224,0.14)}
            .st-prof-btn.danger{color:rgba(255,140,140,0.85)}
            .st-prof-btn.primary{background:linear-gradient(135deg,rgba(155,140,255,0.35),rgba(155,140,255,0.18));border-color:rgba(155,140,255,0.55);color:var(--text-primary)}

            .st-prof-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-bottom:1px solid rgba(224,224,224,0.06)}
            .st-prof-field-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
            .st-prof-field-label{font-size:11px;color:var(--text-secondary);font-weight:600;letter-spacing:0.2px;text-transform:uppercase}
            .st-prof-input{padding:10px 12px;border-radius:10px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.15);color:var(--text-primary);font-family:inherit;font-size:13px;outline:none;box-sizing:border-box;width:100%}
            .st-prof-input:focus{border-color:rgba(155,140,255,0.45)}
            .st-prof-textarea{resize:none;min-height:70px;line-height:1.5}
            .st-prof-priv{display:inline-flex;gap:2px;background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);border-radius:18px;padding:2px}
            .st-prof-priv button{padding:4px 8px;border-radius:14px;border:none;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:11px;transition:background 0.15s;line-height:1}
            .st-prof-priv button.active{background:rgba(155,140,255,0.35);color:var(--text-primary)}
            .st-prof-priv button:hover:not(.active){background:rgba(224,224,224,0.06)}
            .st-prof-footer{display:flex;gap:8px;margin-top:16px}
            .st-prof-save{flex:1;padding:12px;border-radius:24px;border:1px solid rgba(155,140,255,0.5);background:linear-gradient(135deg,rgba(155,140,255,0.4),rgba(155,140,255,0.2));color:var(--text-primary);font-weight:600;font-family:inherit;font-size:13px;cursor:pointer}
            .st-prof-save:disabled{opacity:0.5;cursor:not-allowed}

            /* Inbox */
            .st-inbox-block{margin-top:18px;padding-top:14px;border-top:1px dashed rgba(224,224,224,0.12)}
            .st-inbox-title{font-size:12px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:10px}
            .st-inbox-empty{font-size:11px;color:var(--text-secondary);font-style:italic}
            .st-inbox-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);margin-bottom:8px;font-size:12px}
            .st-inbox-text{flex:1;line-height:1.3}
            .st-inbox-actions{display:flex;gap:6px;flex-shrink:0}
            .st-inbox-actions button{padding:6px 10px;border-radius:16px;border:1px solid rgba(224,224,224,0.18);background:rgba(224,224,224,0.05);color:var(--text-primary);font-family:inherit;font-size:11px;cursor:pointer}
            .st-inbox-actions .btn-grant{background:rgba(120,200,140,0.2);border-color:rgba(120,200,140,0.4);color:#7cc874}
            .st-inbox-actions .btn-deny{background:rgba(255,107,107,0.15);border-color:rgba(255,107,107,0.35);color:#ff8a8a}

            @media (max-width: 480px) {
                .st-prof-head{flex-direction:column;align-items:flex-start}
                .st-prof-photo-actions{flex-direction:row;gap:8px}
                .st-prof-field-row{flex-direction:column;align-items:flex-start}
            }
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
        _state.theme = window.FrediTheme ? window.FrediTheme.get() : (localStorage.getItem('fredi_theme') || 'dark');
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
        if (window.FrediTheme) {
            window.FrediTheme.set(theme);
        } else {
            localStorage.setItem('fredi_theme', theme);
            document.documentElement.setAttribute('data-theme', theme);
            if (document.body) document.body.setAttribute('data-theme', theme);
        }
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
            _renderProfileEditor(el);
        }
    }

    // ============================================
    // PROFILE EDITOR
    // ============================================
    var _profile = null;
    var _profileInbox = [];

    var PROF_FIELDS = [
        { id:'name',       label:'Имя',           type:'text',     placeholder:'Как к тебе обращаться' },
        { id:'age',        label:'Возраст',       type:'number',   placeholder:'25' },
        { id:'city',       label:'Город',         type:'text',     placeholder:'Москва' },
        { id:'bio',        label:'О себе',        type:'textarea', placeholder:'Пара строк о тебе (до 150 знаков)', max:150 },
        { id:'occupation', label:'Род занятий',   type:'text',     placeholder:'Дизайнер, врач, предприниматель…' },
        { id:'telegram',   label:'Telegram',      type:'text',     placeholder:'@username' },
        { id:'instagram',  label:'Instagram',     type:'text',     placeholder:'@username' },
        { id:'phone',      label:'Телефон',       type:'tel',      placeholder:'+7 999 000-00-00' },
        { id:'email',      label:'Email',         type:'email',    placeholder:'you@mail.com' }
    ];
    var PROF_PRIV_LABEL = { public:'🌐 Публично', chat:'💬 В чате', request:'🔒 По запросу' };

    async function _profileLoad() {
        var uid = _uid(); if (!uid) return;
        try {
            var r = await fetch(_api() + '/api/profile/me?user_id=' + uid);
            var d = await r.json();
            if (d.success && d.profile) {
                _profile = d.profile;
                // Синхронизируем имя в localStorage для других модулей
                if (d.profile.name) { try { localStorage.setItem('fredi_user_name', d.profile.name); } catch (e) {} }
            }
        } catch (e) { console.warn('profile load:', e); }
        try {
            var r2 = await fetch(_api() + '/api/profile/access/inbox?user_id=' + uid);
            var d2 = await r2.json();
            if (d2.success) _profileInbox = d2.requests || [];
        } catch (e) { _profileInbox = []; }
    }

    function _profEsc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function _profRenderField(f) {
        var val = (_profile && _profile[f.id] != null) ? String(_profile[f.id]) : '';
        var privacy = (_profile && _profile.privacy && _profile.privacy[f.id]) || 'public';
        var input;
        if (f.type === 'textarea') {
            input = '<textarea class="st-prof-input st-prof-textarea" data-field="' + f.id + '"' +
                (f.max ? ' maxlength="' + f.max + '"' : '') +
                ' placeholder="' + _profEsc(f.placeholder||'') + '">' + _profEsc(val) + '</textarea>';
        } else {
            input = '<input class="st-prof-input" data-field="' + f.id + '" type="' + f.type + '"' +
                ' value="' + _profEsc(val) + '" placeholder="' + _profEsc(f.placeholder||'') + '">';
        }
        var privBtns = ['public','chat','request'].map(function(p) {
            return '<button type="button" data-priv-field="' + f.id + '" data-priv="' + p + '" class="' +
                (privacy === p ? 'active' : '') + '" title="' + PROF_PRIV_LABEL[p] + '">' +
                (p === 'public' ? '🌐' : p === 'chat' ? '💬' : '🔒') +
            '</button>';
        }).join('');
        return '<div class="st-prof-field" data-field-row="' + f.id + '">' +
            '<div class="st-prof-field-row">' +
                '<div class="st-prof-field-label">' + f.label + '</div>' +
                '<div class="st-prof-priv">' + privBtns + '</div>' +
            '</div>' +
            input +
        '</div>';
    }

    function _profRenderInbox() {
        if (!_profileInbox.length) {
            return '<div class="st-inbox-block"><div class="st-inbox-title">🔔 Входящие запросы</div><div class="st-inbox-empty">Нет новых запросов.</div></div>';
        }
        var items = _profileInbox.map(function(req) {
            var label = PROF_FIELDS.find(function(x){ return x.id === req.field; });
            var fieldName = label ? label.label : req.field;
            return '<div class="st-inbox-item" data-inbox-id="' + req.id + '">' +
                '<div class="st-inbox-text"><b>' + _profEsc(req.requester_name) + '</b> запрашивает доступ к полю «' + _profEsc(fieldName) + '»</div>' +
                '<div class="st-inbox-actions">' +
                    '<button class="btn-grant" data-resolve="granted" data-id="' + req.id + '">✓ Дать</button>' +
                    '<button class="btn-deny"  data-resolve="denied"  data-id="' + req.id + '">✗ Нет</button>' +
                '</div>' +
            '</div>';
        }).join('');
        return '<div class="st-inbox-block"><div class="st-inbox-title">🔔 Входящие запросы (' + _profileInbox.length + ')</div>' + items + '</div>';
    }

    function _renderProfileEditor(el) {
        el.innerHTML = '<div class="st-hint">Загружаю профиль…</div>';
        _profileLoad().then(function(){
            var photo = _profile && _profile.photo ? _profile.photo : '';
            var photoPrivacy = (_profile && _profile.privacy && _profile.privacy.photo) || 'public';
            var photoPrivBtns = ['public','chat','request'].map(function(p) {
                return '<button type="button" data-priv-field="photo" data-priv="' + p + '" class="' +
                    (photoPrivacy === p ? 'active' : '') + '" title="' + PROF_PRIV_LABEL[p] + '">' +
                    (p === 'public' ? '🌐' : p === 'chat' ? '💬' : '🔒') +
                '</button>';
            }).join('');

            el.innerHTML =
                '<div class="st-hint">Личный профиль. Каждое поле можно сделать публичным, показывать только в чате или открывать по запросу.</div>' +
                '<div class="st-prof-head">' +
                    '<div class="st-prof-avatar" id="stProfAvatar">' +
                        (photo ? '<img src="' + _profEsc(photo) + '" alt="avatar">' : '👤') +
                    '</div>' +
                    '<div class="st-prof-photo-actions">' +
                        '<button class="st-prof-btn primary" id="stProfUpload">📷 ' + (photo ? 'Заменить фото' : 'Загрузить фото') + '</button>' +
                        (photo ? '<button class="st-prof-btn danger" id="stProfRemove">🗑 Удалить</button>' : '') +
                        '<div class="st-prof-priv" style="align-self:flex-start">' + photoPrivBtns + '</div>' +
                    '</div>' +
                    '<input type="file" id="stProfFile" accept="image/png,image/jpeg,image/webp" style="display:none">' +
                '</div>' +
                PROF_FIELDS.map(_profRenderField).join('') +
                '<div class="st-prof-footer">' +
                    '<button class="st-prof-save" id="stProfSave">💾 Сохранить</button>' +
                '</div>' +
                '<div style="margin-top:12px;font-size:11px;color:var(--text-secondary);line-height:1.5;">' +
                    'User ID: ' + (_uid() || '-') + ' · Фреди v3.2' +
                '</div>' +
                _profRenderInbox();

            _wireProfileEditor(el);
        }).catch(function(e){
            console.warn('profile editor render:', e);
            el.innerHTML = '<div class="st-hint">Не удалось загрузить профиль. Попробуйте позже.</div>';
        });
    }

    function _wireProfileEditor(el) {
        // Radio групп приватности
        el.querySelectorAll('[data-priv-field]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var field = btn.getAttribute('data-priv-field');
                var priv = btn.getAttribute('data-priv');
                el.querySelectorAll('[data-priv-field="' + field + '"]').forEach(function(b) {
                    b.classList.toggle('active', b === btn);
                });
                if (!_profile) _profile = {};
                if (!_profile.privacy) _profile.privacy = {};
                _profile.privacy[field] = priv;
            });
        });

        // Загрузка фото
        var fileInput = el.querySelector('#stProfFile');
        var uploadBtn = el.querySelector('#stProfUpload');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', function(){ fileInput.click(); });
            fileInput.addEventListener('change', async function(e) {
                var file = e.target.files && e.target.files[0];
                if (!file) return;
                try {
                    var dataUrl = await _profResizePhoto(file);
                    if (!_profile) _profile = {};
                    _profile.photo = dataUrl;
                    var avatarEl = el.querySelector('#stProfAvatar');
                    if (avatarEl) avatarEl.innerHTML = '<img src="' + _profEsc(dataUrl) + '" alt="avatar">';
                    _toast('Фото обновлено — не забудь нажать «Сохранить»', 'info');
                } catch (err) {
                    console.warn('photo resize:', err);
                    _toast('Не удалось обработать фото', 'error');
                }
            });
        }

        var removeBtn = el.querySelector('#stProfRemove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                if (!_profile) _profile = {};
                _profile.photo = null;
                var avatarEl = el.querySelector('#stProfAvatar');
                if (avatarEl) avatarEl.innerHTML = '👤';
                _toast('Фото помечено на удаление — нажми «Сохранить»', 'info');
            });
        }

        // Сохранить
        var saveBtn = el.querySelector('#stProfSave');
        if (saveBtn) saveBtn.addEventListener('click', async function() {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Сохраняем…';
            try {
                var fields = {};
                PROF_FIELDS.forEach(function(f) {
                    var input = el.querySelector('[data-field="' + f.id + '"]');
                    if (input) fields[f.id] = input.value.trim();
                });
                var body = {
                    user_id: _uid(),
                    fields: fields,
                    privacy: (_profile && _profile.privacy) || {},
                };
                if (_profile && 'photo' in _profile) body.photo = _profile.photo;
                var r = await fetch(_api() + '/api/profile/me', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(body)
                });
                var d = await r.json();
                if (d.success) {
                    _profile = d.profile;
                    if (d.profile.name) { try { localStorage.setItem('fredi_user_name', d.profile.name); } catch(e){} }
                    _toast('✅ Сохранено', 'success');
                } else {
                    _toast('❌ ' + (d.error || 'Ошибка'), 'error');
                }
            } catch (e) {
                _toast('❌ Ошибка сети', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Сохранить';
            }
        });

        // Inbox resolve
        el.querySelectorAll('[data-resolve]').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.getAttribute('data-id');
                var status = btn.getAttribute('data-resolve');
                btn.disabled = true;
                try {
                    var r = await fetch(_api() + '/api/profile/access/' + id + '/resolve', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ user_id: _uid(), status: status })
                    });
                    var d = await r.json();
                    if (d.success) {
                        _profileInbox = _profileInbox.filter(function(x){ return String(x.id) !== String(id); });
                        var item = el.querySelector('[data-inbox-id="' + id + '"]');
                        if (item) item.remove();
                        _toast(status === 'granted' ? '✓ Доступ выдан' : 'Отказано', 'info');
                    } else {
                        _toast('❌ ' + (d.error || 'Ошибка'), 'error');
                    }
                } catch (e) {
                    _toast('❌ Ошибка сети', 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    // Ресайз + сжатие фото до 400x400 JPEG ~80%
    function _profResizePhoto(file) {
        return new Promise(function(resolve, reject) {
            if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                return reject(new Error('not image'));
            }
            var reader = new FileReader();
            reader.onerror = function(){ reject(new Error('read failed')); };
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    var side = Math.min(img.width, img.height);
                    var sx = (img.width - side) / 2;
                    var sy = (img.height - side) / 2;
                    var size = 400;
                    var canvas = document.createElement('canvas');
                    canvas.width = size; canvas.height = size;
                    var ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.82));
                };
                img.onerror = function() { reject(new Error('image decode failed')); };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function showSettingsScreen() { _renderSettings(); await _loadSettings(); _renderSettings(); }

    window.showSettingsScreen = showSettingsScreen;
    console.log('settings.js v3.3 loaded');
})();
