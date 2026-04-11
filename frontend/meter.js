// ============================================
// meter.js — Fading Fredi: free session limits UI
// Checks limits before sending messages
// ============================================

(function () {
    if (window._meterLoaded) return;
    window._meterLoaded = true;

    function _api() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
    function _uid() { return window.CONFIG?.USER_ID; }
    function _toast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }

    function _injectMeterStyles() {
        if (document.getElementById('meter-styles')) return;
        const s = document.createElement('style');
        s.id = 'meter-styles';
        s.textContent = `
            .meter-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); padding: 16px; }
            .meter-modal { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; max-width: 380px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.6); }
            .meter-emoji { font-size: 48px; text-align: center; margin-bottom: 16px; }
            .meter-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px; text-align: center; }
            .meter-text { font-size: 14px; color: rgba(255,255,255,0.65); line-height: 1.6; margin-bottom: 20px; text-align: center; }
            .meter-timer { font-size: 24px; font-weight: 700; color: #3b82ff; text-align: center; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
            .meter-btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 14px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: center; margin-bottom: 10px; touch-action: manipulation; }
            .meter-btn-primary { background: linear-gradient(135deg, #3b82ff 0%, #6366f1 100%); color: #fff; }
            .meter-btn-secondary { background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18); color: rgba(255,255,255,0.6); }
            .meter-progress { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
            .meter-progress-bar { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
            .meter-progress-green { background: linear-gradient(90deg, #10b981, #34d399); }
            .meter-progress-yellow { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .meter-progress-red { background: linear-gradient(90deg, #ef4444, #f87171); }
            .meter-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: rgba(59,130,255,0.12); color: #3b82ff; margin-bottom: 8px; }
        `;
        document.head.appendChild(s);
    }

    // State
    let _lastCheck = null;
    let _lastCheckTime = 0;
    const CHECK_CACHE_MS = 5000;

    // ------------------------------------------------------------------
    // Check if user can send a message
    // ------------------------------------------------------------------
    async function checkCanSend() {
        const uid = _uid();
        if (!uid) return { can_send: true };

        // Cache for 5 seconds
        const now = Date.now();
        if (_lastCheck && (now - _lastCheckTime) < CHECK_CACHE_MS) {
            return _lastCheck;
        }

        try {
            const r = await fetch(`${_api()}/api/meter/can-send/${uid}`);
            const data = await r.json();
            _lastCheck = data;
            _lastCheckTime = now;
            return data;
        } catch (e) {
            console.error('meter check error:', e);
            return { can_send: true }; // Allow on error
        }
    }

    // ------------------------------------------------------------------
    // Record usage after response
    // ------------------------------------------------------------------
    async function recordUsage(seconds) {
        const uid = _uid();
        if (!uid) return;
        try {
            await fetch(`${_api()}/api/meter/record-usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, seconds: seconds || 30 })
            });
            _lastCheck = null; // Invalidate cache
        } catch (e) {
            console.error('meter record error:', e);
        }
    }

    // ------------------------------------------------------------------
    // Show fatigue modal
    // ------------------------------------------------------------------
    function showFatigueModal(data) {
        _injectMeterStyles();

        // Remove existing modal
        document.getElementById('meterOverlay')?.remove();

        const isOnCooldown = data.is_on_cooldown;
        const remaining = data.remaining_cooldown_minutes || 0;
        const message = data.message || 'Fredi needs rest.';

        const emoji = isOnCooldown ? '\u{1F634}' : '\u{1F494}';
        const title = isOnCooldown ? '\u0424\u0440\u0435\u0434\u0438 \u043e\u0442\u0434\u044b\u0445\u0430\u0435\u0442...' : '\u0424\u0440\u0435\u0434\u0438 \u0443\u0441\u0442\u0430\u043b...';

        const overlay = document.createElement('div');
        overlay.className = 'meter-overlay';
        overlay.id = 'meterOverlay';
        overlay.innerHTML = `
            <div class="meter-modal">
                <div class="meter-emoji">${emoji}</div>
                <div class="meter-title">${title}</div>
                ${isOnCooldown && remaining > 0 ? `<div class="meter-timer" id="meterTimer">${remaining} \u043c\u0438\u043d</div>` : ''}
                <div class="meter-text">${message.replace(/\n/g, '<br>')}</div>
                <button class="meter-btn meter-btn-primary" id="meterSubscribeBtn">\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443 \u2014 690 \u20BD</button>
                <button class="meter-btn meter-btn-secondary" id="meterCloseBtn">\u041f\u043e\u043d\u044f\u0442\u043d\u043e</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('meterCloseBtn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('meterSubscribeBtn').addEventListener('click', () => {
            overlay.remove();
            // Open settings -> subscription
            if (typeof showSettingsScreen === 'function') {
                showSettingsScreen();
            }
        });

        // Countdown timer
        if (isOnCooldown && remaining > 0) {
            const timerEl = document.getElementById('meterTimer');
            let secsLeft = remaining * 60;
            const interval = setInterval(() => {
                secsLeft--;
                if (secsLeft <= 0) {
                    clearInterval(interval);
                    overlay.remove();
                    _lastCheck = null;
                    _toast('\u0424\u0440\u0435\u0434\u0438 \u043e\u0442\u0434\u043e\u0445\u043d\u0443\u043b! \u041c\u043e\u0436\u043d\u043e \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c.', 'success');
                    return;
                }
                const mins = Math.floor(secsLeft / 60);
                const secs = secsLeft % 60;
                if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            }, 1000);
        }
    }

    // ------------------------------------------------------------------
    // Show warning toast (5 min left)
    // ------------------------------------------------------------------
    function showWarningToast(warning) {
        _toast(warning.replace(/\*/g, '').replace(/\n/g, ' ').substring(0, 100), 'info');
    }

    // ------------------------------------------------------------------
    // Get remaining minutes progress bar HTML
    // ------------------------------------------------------------------
    function getMeterBadgeHtml(status) {
        if (!status || status.is_premium) return '';
        const remaining = status.remaining_minutes;
        if (remaining === null || remaining === undefined) return '';
        const limit = status.session_limit_minutes || 30;
        const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
        const color = pct > 50 ? 'meter-progress-green' : pct > 20 ? 'meter-progress-yellow' : 'meter-progress-red';
        return `<div class="meter-badge">${Math.round(remaining)} \u043c\u0438\u043d \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e</div><div class="meter-progress"><div class="meter-progress-bar ${color}" style="width:${pct}%"></div></div>`;
    }

    // Expose globally
    window.FrediMeter = {
        checkCanSend,
        recordUsage,
        showFatigueModal,
        showWarningToast,
        getMeterBadgeHtml,
    };

    console.log('meter.js loaded');
})();
