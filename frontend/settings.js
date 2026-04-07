// ============================================
// settings.js — Экран настроек уведомлений
// Версия 1.0
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
        if (document.getElementById('settings-v1-styles')) return;
        const s = document.createElement('style');
        s.id = 'settings-v1-styles';
        s.textContent = `
            .st-section { margin-bottom: 24px; }
            .st-section-label {
                font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
                text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;
            }
            .st-channel-grid { display: flex; flex-direction: column; gap: 10px; }
            .st-channel-card {
                display: flex; align-items: center; gap: 14px;
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.1);
                border-radius: 18px; padding: 16px;
                cursor: pointer;
                transition: background 0.18s, border-color 0.18s, transform 0.15s;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }
            .st-channel-card:active { transform: scale(0.99); }
            .st-channel-card.active {
                background: rgba(224,224,224,0.13);
                border-color: rgba(224,224,224,0.4);
            }
            .st-channel-icon {
                font-size: 26px; flex-shrink: 0; width: 44px; height: 44px;
                display: flex; align-items: center; justify-content: center;
                background: rgba(224,224,224,0.07); border-radius: 14px;
            }
            .st-channel-body { flex: 1; min-width: 0; }
            .st-channel-title {
                font-size: 14px; font-weight: 700; color: var(--text-primary);
                margin-bottom: 3px;
            }
            .st-channel-desc {
                font-size: 11px; color: var(--text-secondary);
                line-height: 1.4; overflow-wrap: anywhere;
            }
            .st-channel-check {
                font-size: 18px; flex-shrink: 0; opacity: 0;
                transition: opacity 0.18s;
                color: var(--chrome);
            }
            .st-channel-card.active .st-channel-check { opacity: 1; }

            .st-link-row {
                display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                margin-top: 10px; padding-top: 10px;
                border-top: 1px dashed rgba(224,224,224,0.1);
            }
            .st-link-status {
                font-size: 11px; color: var(--text-secondary);
                display: inline-flex; align-items: center; gap: 4px;
            }
            .st-link-status.linked { color: rgba(120, 200, 140, 0.95); }
            .st-link-btn {
                padding: 7px 14px; border-radius: 30px; font-size: 12px;
                font-weight: 500; font-family: inherit; cursor: pointer;
                background: rgba(224,224,224,0.07);
                border: 1px solid rgba(224,224,224,0.18);
                color: var(--text-secondary); text-decoration: none;
                display: inline-flex; align-items: center; gap: 6px;
                transition: background 0.18s, color 0.18s;
                touch-action: manipulation;
            }
            .st-link-btn:hover { background: rgba(224,224,224,0.14); color: var(--text-primary); }
            .st-link-btn.danger { color: rgba(255, 140, 140, 0.85); }

            .st-info-tip {
                background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
                border-radius: 14px; padding: 12px 14px; font-size: 12px;
                color: var(--text-secondary); line-height: 1.55; margin-top: 16px;
            }
            .st-info-tip strong { color: var(--chrome); }
        `;
        document.head.appendChild(s);
    }

    let _state = {
        channel: 'push',
        linked: { telegram: null, max: null }
    };

    async function _loadSettings() {
        const uid = _setUid();
        if (!uid) return;
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
        } catch (e) {
            console.error('settings load error:', e);
        }
    }

    async function _saveChannel(channel) {
        const uid = _setUid();
        if (!uid) return;
        try {
            const r = await fetch(`${_setApi()}/api/settings/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, channel })
            });
            const d = await r.json();
            if (d.success) {
                _state.channel = channel;
                _setToast('Способ уведомлений сохранён', 'info');
            } else {
                _setToast(d.error || 'Не удалось сохранить', 'error');
            }
        } catch (e) {
            _setToast('Ошибка сети', 'error');
        }
    }

    async function _unlink(platform) {
        const uid = _setUid();
        if (!uid) return;
        try {
            const r = await fetch(`${_setApi()}/api/messenger/unlink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, platform })
            });
            const d = await r.json();
            if (d.success) {
                _state.linked[platform] = null;
                _setToast(`${platform} отвязан`, 'info');
                _renderSettings();
            }
        } catch (e) {
            _setToast('Ошибка сети', 'error');
        }
    }

    function _channelCard(key, icon, title, desc, extraHtml) {
        const active = _state.channel === key;
        return `
            <div class="st-channel-card ${active ? 'active' : ''}" data-channel="${key}">
                <div class="st-channel-icon">${icon}</div>
                <div class="st-channel-body">
                    <div class="st-channel-title">${title}</div>
                    <div class="st-channel-desc">${desc}</div>
                    ${extraHtml || ''}
                </div>
                <div class="st-channel-check">✓</div>
            </div>
        `;
    }

    function _linkRow(platform, deepLink) {
        const linked = _state.linked[platform];
        if (linked) {
            const u = linked.username ? `@${linked.username}` : 'привязан';
            return `
                <div class="st-link-row" onclick="event.stopPropagation()">
                    <span class="st-link-status linked">✓ Связан: ${u}</span>
                    <button class="st-link-btn danger" data-action="unlink" data-platform="${platform}">Отвязать</button>
                </div>
            `;
        }
        return `
            <div class="st-link-row" onclick="event.stopPropagation()">
                <span class="st-link-status">Не связан</span>
                <a class="st-link-btn" href="${deepLink}" target="_blank" rel="noopener">🔗 Связать аккаунт</a>
            </div>
        `;
    }

    function _renderSettings() {
        _injectSettingsStyles();
        const c = document.getElementById('screenContainer');
        if (!c) return;

        const uid = _setUid() || 0;
        const tgDeepLink = `https://t.me/${TG_BOT_USERNAME}?start=web_${uid}`;
        const maxDeepLink = `${MAX_BOT_LINK}?start=web_${uid}`;

        const pushCard = _channelCard(
            'push',
            '🔔',
            'Web Push (браузер)',
            'Уведомления в этом браузере. На iPhone требуется добавить приложение на экран Дом.',
            ''
        );
        const tgCard = _channelCard(
            'telegram',
            '✈️',
            'Telegram',
            'Утренние сообщения будут приходить в Telegram-бот Фреди.',
            _linkRow('telegram', tgDeepLink)
        );
        const maxCard = _channelCard(
            'max',
            '💬',
            'Max',
            'Утренние сообщения будут приходить в Max-бот Фреди.',
            _linkRow('max', maxDeepLink)
        );
        const noneCard = _channelCard(
            'none',
            '🔕',
            'Не отправлять',
            'Не присылать утренние сообщения.',
            ''
        );

        c.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="stBack">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">⚙️</div>
                    <h1 class="content-title">Настройки</h1>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Способ доставки утренних сообщений</p>
                </div>

                <div class="st-section">
                    <div class="st-section-label">📬 Куда присылать утренние сообщения</div>
                    <div class="st-channel-grid">
                        ${pushCard}
                        ${tgCard}
                        ${maxCard}
                        ${noneCard}
                    </div>
                </div>

                <div class="st-info-tip">
                    💡 <strong>Как это работает:</strong> каждое утро в 9:00 по вашему местному времени Фреди будет присылать короткое мотивационное сообщение с учётом вашего профиля. По <strong>пятницам</strong> — идеи на выходные.
                </div>
            </div>
        `;

        document.getElementById('stBack').onclick = () => {
            if (typeof renderDashboard === 'function') renderDashboard();
        };

        // Выбор канала
        document.querySelectorAll('.st-channel-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                if (e.target.closest('.st-link-btn') || e.target.closest('.st-link-row')) return;
                const ch = card.dataset.channel;
                if (ch === _state.channel) return;
                await _saveChannel(ch);
                _renderSettings();
            });
        });

        // Кнопки отвязки
        document.querySelectorAll('[data-action="unlink"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const p = btn.dataset.platform;
                if (confirm(`Отвязать ${p}?`)) await _unlink(p);
            });
        });
    }

    async function showSettingsScreen() {
        _renderSettings();
        await _loadSettings();
        _renderSettings();
    }

    window.showSettingsScreen = showSettingsScreen;
    console.log('✅ settings.js загружен');
})();
