// ============================================
// premium_pill.js — Premium-индикаторы на дашборде
//   • ⭐ PREMIUM pill рядом с именем
//   • золотая обводка profile-badge
// Слушает DOM и сам подхватывает rerender'ы дашборда, чтобы не лезть
// в app.js (он 130KB и не помещается в один MCP push).
// ============================================
(function () {
    if (window._premiumPillLoaded) return;
    window._premiumPillLoaded = true;

    var PILL_ID = 'heroPremiumPill';
    var STYLE_ID = 'hero-premium-pill-styles';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
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
            '  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);' +
            '  color: #fff;' +
            '  box-shadow: 0 2px 10px rgba(243, 156, 18, 0.35);' +
            '  vertical-align: middle;' +
            '  text-transform: uppercase;' +
            '  white-space: nowrap;' +
            '  animation: premiumPillGlow 2.5s ease-in-out infinite;' +
            '}' +
            '@keyframes premiumPillGlow {' +
            '  0%, 100% { box-shadow: 0 2px 10px rgba(243, 156, 18, 0.35); }' +
            '  50% { box-shadow: 0 2px 18px rgba(243, 156, 18, 0.65); }' +
            '}' +
            '.profile-badge--premium {' +
            '  border: 1px solid rgba(243, 156, 18, 0.55) !important;' +
            '  box-shadow: 0 4px 16px rgba(243, 156, 18, 0.18) !important;' +
            '}';
        document.head.appendChild(s);
    }

    function isPremium() {
        return window.IS_PREMIUM === true;
    }

    function ensurePill() {
        // Создаёт pill в hero-title рядом с именем, если ещё нет.
        if (document.getElementById(PILL_ID)) return;
        var heroName = document.querySelector('.hero-title .hero-name')
            || document.querySelector('.hero-name');
        if (!heroName) return;
        var pill = document.createElement('span');
        pill.id = PILL_ID;
        pill.className = 'hero-premium-pill';
        pill.title = 'Подписка Фреди Premium активна';
        pill.textContent = '⭐ PREMIUM';
        pill.style.display = 'none';
        heroName.parentNode.insertBefore(pill, heroName.nextSibling);
    }

    function applyState() {
        injectStyles();
        ensurePill();
        var pill = document.getElementById(PILL_ID);
        if (pill) pill.style.display = isPremium() ? 'inline-flex' : 'none';
        var badge = document.getElementById('profileBadge');
        if (badge) badge.classList.toggle('profile-badge--premium', isPremium());
    }

    // 1) Применяем сразу.
    applyState();

    // 2) При появлении дашборда после rerender'а — снова. MutationObserver
    //    на #screenContainer ловит замены innerHTML.
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

    // 3) loadPremiumStatus может закончиться позже первого рендера —
    //    периодически перепроверяем, пока IS_PREMIUM не известен.
    var pollAttempts = 0;
    var pollTimer = setInterval(function () {
        applyState();
        pollAttempts++;
        if (window.IS_PREMIUM !== null && window.IS_PREMIUM !== undefined) {
            clearInterval(pollTimer);
        } else if (pollAttempts > 30) { // ~15 сек
            clearInterval(pollTimer);
        }
    }, 500);

    // Публичный helper на случай ручного апдейта из других модулей.
    window.updatePremiumIndicators = applyState;
})();
