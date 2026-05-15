// ============================================
// premium_pill.js — Premium-индикаторы на дашборде
//   • PREMIUM pill рядом с именем (голубой, без анимации)
//   • голубая обводка profile-badge
//   • Affordance для .mode-btn (коуч/психолог/тренер) — контраст,
//     активная подсветка, label сверху, пульс для новичков. Делается
//     здесь чтобы не пушить большие styles.css/app.js.
// ============================================
(function () {
    if (window._premiumPillLoaded) return;
    window._premiumPillLoaded = true;

    var PILL_ID = 'heroPremiumPill';
    var STYLE_ID = 'hero-premium-pill-styles';
    var MODE_STYLE_ID = 'fredi-mode-btn-affordance';
    var MODE_LS_KEY = 'fredi_mode_btn_clicked';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        // Голубой pill без glow-анимации — спокойнее для глаза,
        // не отвлекает от чтения дашборда.
        s.textContent =
            '.hero-premium-pill {' +
            '  display: inline-flex;' +
            '  align-items: center;' +
            '  gap: 4px;' +
            '  font-size: 11px;' +
            '  font-weight: 800;' +
            '  letter-spacing: 0.5px;' +
            '  padding: 3px 9px;' +
            '  margin-left: 10px;' +
            '  border-radius: 10px;' +
            '  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);' +
            '  color: #fff;' +
            '  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.30);' +
            '  vertical-align: middle;' +
            '  text-transform: uppercase;' +
            '  white-space: nowrap;' +
            '}' +
            '.profile-badge--premium {' +
            '  border: 1px solid rgba(59, 130, 246, 0.55) !important;' +
            '  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.18) !important;' +
            '}';
        document.head.appendChild(s);
    }

    function injectModeBtnStyles() {
        // Affordance для переключателя режимов на дашборде. Аналитика
        // показала: новички принимали "коуч/психолог/тренер" за заголовок
        // и не нажимали → 33-секундная сессия и уход. Здесь:
        //   • явный фон и граница неактивных (раньше были transparent)
        //   • активная — фирменный оранжево-фиолетовый градиент + glow
        //   • label "🎭 Выбери стиль общения с Фреди:" сверху над pill'ом
        //   • микро-пульс неактивных для НОВЫХ юзеров (1 раз — после клика
        //     класс снимается навсегда через localStorage флаг)
        if (document.getElementById(MODE_STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = MODE_STYLE_ID;
        s.textContent =
            '.mode-selector { position: relative; gap: 6px !important; margin-top: 26px !important; }' +
            '.mode-selector::before {' +
            '  content: "🎭 Выбери стиль общения с Фреди:";' +
            '  position: absolute; top: -22px; left: 16px;' +
            '  font-size: 11px; font-weight: 600; letter-spacing: 0.3px;' +
            '  color: var(--text-secondary); pointer-events: none;' +
            '}' +
            '.mode-btn {' +
            '  background: rgba(255,255,255,0.06) !important;' +
            '  border: 1px solid rgba(255,255,255,0.12) !important;' +
            '  color: var(--text-primary) !important;' +
            '  transition: background 0.2s, color 0.2s, transform 0.12s, border-color 0.2s, box-shadow 0.2s !important;' +
            '}' +
            '.mode-btn:hover {' +
            '  background: rgba(255,255,255,0.10) !important;' +
            '  border-color: rgba(255,255,255,0.22) !important;' +
            '}' +
            '.mode-btn:active { transform: scale(0.96) !important; }' +
            '.mode-btn.active {' +
            '  background: linear-gradient(135deg, #ff6b3b 0%, #6366f1 100%) !important;' +
            '  color: #fff !important;' +
            '  border-color: transparent !important;' +
            '  box-shadow: 0 4px 14px rgba(255,107,59,0.35) !important;' +
            '}' +
            '@keyframes mode-btn-pulse {' +
            '  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); border-color: rgba(255,255,255,0.12); }' +
            '  50% { box-shadow: 0 0 0 6px rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.45); }' +
            '}' +
            'body.mode-selector--new .mode-btn:not(.active) {' +
            '  animation: mode-btn-pulse 2.2s ease-in-out infinite;' +
            '}' +
            '[data-theme="light"] .mode-btn {' +
            '  background: rgba(0,0,0,0.04) !important;' +
            '  border-color: rgba(0,0,0,0.10) !important;' +
            '}' +
            '[data-theme="light"] .mode-btn:hover {' +
            '  background: rgba(0,0,0,0.07) !important;' +
            '  border-color: rgba(0,0,0,0.18) !important;' +
            '}' +
            '[data-theme="light"] .mode-selector::before {' +
            '  color: rgba(0,0,0,0.55);' +
            '}';
        document.head.appendChild(s);
    }

    function applyModeBtnAttention() {
        try {
            if (localStorage.getItem(MODE_LS_KEY) === '1') {
                document.body.classList.remove('mode-selector--new');
                return;
            }
            // Pulse активен пока ни один mode-btn не нажали
            document.body.classList.add('mode-selector--new');
        } catch (e) {}
        // Навешиваем обработчик на каждую кнопку (один раз)
        document.querySelectorAll('.mode-btn').forEach(function (btn) {
            if (btn.__fpAttn) return;
            btn.__fpAttn = true;
            btn.addEventListener('click', function () {
                try {
                    if (localStorage.getItem(MODE_LS_KEY) !== '1') {
                        localStorage.setItem(MODE_LS_KEY, '1');
                        document.body.classList.remove('mode-selector--new');
                        if (window.FrediTracker && window.FrediTracker.track) {
                            window.FrediTracker.track('mode_btn_first_click', {
                                mode: btn.dataset.mode || ''
                            });
                        }
                    }
                } catch (e) {}
            });
        });
    }

    function isPremium() {
        return window.IS_PREMIUM === true;
    }

    function ensurePill() {
        if (document.getElementById(PILL_ID)) return;
        var heroName = document.querySelector('.hero-title .hero-name')
            || document.querySelector('.hero-name');
        if (!heroName) return;
        var pill = document.createElement('span');
        pill.id = PILL_ID;
        pill.className = 'hero-premium-pill';
        pill.title = 'Подписка Фреди Premium активна';
        pill.textContent = 'PREMIUM';
        pill.style.display = 'none';
        heroName.parentNode.insertBefore(pill, heroName.nextSibling);
    }

    function applyState() {
        injectStyles();
        injectModeBtnStyles();
        ensurePill();
        var pill = document.getElementById(PILL_ID);
        if (pill) pill.style.display = isPremium() ? 'inline-flex' : 'none';
        var badge = document.getElementById('profileBadge');
        if (badge) badge.classList.toggle('profile-badge--premium', isPremium());
        applyModeBtnAttention();
    }

    applyState();

    function startObserver() {
        var root = document.getElementById('screenContainer') || document.body;
        if (!root || !window.MutationObserver) return;
        var debounce;
        var obs = new MutationObserver(function () {
            clearTimeout(debounce);
            debounce = setTimeout(applyState, 50);
        });
        obs.observe(root, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    var pollAttempts = 0;
    var pollTimer = setInterval(function () {
        applyState();
        pollAttempts++;
        if (window.IS_PREMIUM !== null && window.IS_PREMIUM !== undefined) {
            clearInterval(pollTimer);
        } else if (pollAttempts > 30) {
            clearInterval(pollTimer);
        }
    }, 500);

    window.updatePremiumIndicators = applyState;
})();
