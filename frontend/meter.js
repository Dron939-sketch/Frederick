// ============================================
// meter.js — Fading Fredi: free session limits UI
// Auto-intercepts chat/voice requests to check limits
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
            .meter-text { font-size: 14px; color: rgba(255,255,255,0.65); line-height: 1.6; margin-bottom: 20px; }
            .meter-timer { font-size: 28px; font-weight: 700; color: #3b82ff; text-align: center; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
            .meter-btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 14px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: center; margin-bottom: 10px; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
            .meter-btn:active { transform: scale(0.98); }
            .meter-btn-primary { background: linear-gradient(135deg, #3b82ff 0%, #6366f1 100%); color: #fff; }
            .meter-btn-secondary { background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18); color: rgba(255,255,255,0.6); }
            .meter-progress { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
            .meter-progress-bar { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
            .meter-progress-green { background: linear-gradient(90deg, #10b981, #34d399); }
            .meter-progress-yellow { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .meter-progress-red { background: linear-gradient(90deg, #ef4444, #f87171); }
            .meter-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: rgba(59,130,255,0.12); color: #3b82ff; margin-bottom: 8px; }
            .meter-features { list-style: none; padding: 0; margin: 16px 0; }
            .meter-features li { font-size: 13px; color: rgba(255,255,255,0.5); padding: 4px 0; }
        `;
        document.head.appendChild(s);
    }

    let _lastCheck = null;
    let _lastCheckTime = 0;
    let _warningShown = false;
    const CHECK_CACHE_MS = 5000;

    async function checkCanSend() {
        const uid = _uid();
        if (!uid) return { can_send: true };
        const now = Date.now();
        if (_lastCheck && (now - _lastCheckTime) < CHECK_CACHE_MS) return _lastCheck;
        try {
            const r = await fetch(`${_api()}/api/meter/can-send/${uid}`);
            const data = await r.json();
            _lastCheck = data;
            _lastCheckTime = now;
            return data;
        } catch (e) {
            return { can_send: true };
        }
    }

    async function recordUsage(seconds) {
        const uid = _uid();
        if (!uid) return;
        try {
            await fetch(`${_api()}/api/meter/record-usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, seconds: seconds || 30 })
            });
            _lastCheck = null;
        } catch (e) {}
    }

    function showFatigueModal(data) {
        _injectMeterStyles();
        document.getElementById('meterOverlay')?.remove();

        const isOnCooldown = data.is_on_cooldown;
        const remaining = data.remaining_cooldown_minutes || 0;
        const sessionCount = (data.free_session_count || 0) + 1;
        const nextLimit = data.next_session_limit_minutes;

        let emoji, title, body;

        if (isOnCooldown && remaining > 0) {
            emoji = '\u{1F634}';
            title = '\u0424\u0440\u0435\u0434\u0438 \u043e\u0442\u0434\u044b\u0445\u0430\u0435\u0442...';
            const nextInfo = nextLimit > 0
                ? `\u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0441\u044f \u0447\u0435\u0440\u0435\u0437 ${remaining} \u043c\u0438\u043d\u0443\u0442 \u2014 \u0443 \u0442\u0435\u0431\u044f \u0431\u0443\u0434\u0435\u0442 ${nextLimit} \u043c\u0438\u043d\u0443\u0442 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e\u0433\u043e \u043e\u0431\u0449\u0435\u043d\u0438\u044f.`
                : `\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 \u0437\u0430\u043a\u043e\u043d\u0447\u0438\u043b\u0438\u0441\u044c.`;
            body = `\u041c\u044b \u043e\u0431\u0449\u0430\u043b\u0438\u0441\u044c, \u0438 \u043c\u043d\u0435 \u043d\u0443\u0436\u043d\u043e \u043e\u0442\u0434\u043e\u0445\u043d\u0443\u0442\u044c.<br><br>${nextInfo}<br><br>\u041d\u043e \u0435\u0441\u0442\u044c \u0441\u043f\u043e\u0441\u043e\u0431 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u043f\u0440\u044f\u043c\u043e \u0441\u0435\u0439\u0447\u0430\u0441 \u2014 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u0434\u0430\u0451\u0442 <b>\u0431\u0435\u0437\u043b\u0438\u043c\u0438\u0442\u043d\u043e\u0435 \u043e\u0431\u0449\u0435\u043d\u0438\u0435</b> \u0438 \u0424\u0440\u0435\u0434\u0438 \u043d\u0438\u043a\u043e\u0433\u0434\u0430 \u043d\u0435 \u0443\u0441\u0442\u0430\u043d\u0435\u0442!`;
        } else {
            emoji = '\u{1F494}';
            title = '\u0424\u0440\u0435\u0434\u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e...';
            body = `\u0422\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b \u0432\u0441\u0435 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0435 \u0441\u0435\u0441\u0441\u0438\u0438.<br><br>\u041e\u0444\u043e\u0440\u043c\u0438 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443 \u0438 \u043f\u043e\u043b\u0443\u0447\u0438:<ul class="meter-features"><li>\u2728 \u0411\u0435\u0437\u043b\u0438\u043c\u0438\u0442\u043d\u043e\u0435 \u043e\u0431\u0449\u0435\u043d\u0438\u0435 24/7</li><li>\u{1F3A4} \u0413\u043e\u043b\u043e\u0441\u043e\u0432\u044b\u0435 \u0441\u0435\u0430\u043d\u0441\u044b</li><li>\u{1F9D8} \u041f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0438</li><li>\u{1F305} \u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043f\u043e\u0441\u043b\u0430\u043d\u0438\u044f</li></ul>`;
        }

        const overlay = document.createElement('div');
        overlay.className = 'meter-overlay';
        overlay.id = 'meterOverlay';
        overlay.innerHTML = `
            <div class="meter-modal">
                <div class="meter-emoji">${emoji}</div>
                <div class="meter-title">${title}</div>
                ${isOnCooldown && remaining > 0 ? `<div class="meter-timer" id="meterTimer">${remaining} \u043c\u0438\u043d</div>` : ''}
                <div class="meter-text">${body}</div>
                <button class="meter-btn meter-btn-primary" id="meterSubscribeBtn">\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443 \u2014 690 \u20BD/\u043c\u0435\u0441</button>
                <button class="meter-btn meter-btn-secondary" id="meterCloseBtn">\u041f\u043e\u043d\u044f\u0442\u043d\u043e</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('meterCloseBtn').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.getElementById('meterSubscribeBtn').onclick = () => {
            overlay.remove();
            if (typeof showSettingsScreen === 'function') showSettingsScreen();
        };

        if (isOnCooldown && remaining > 0) {
            const timerEl = document.getElementById('meterTimer');
            let secsLeft = remaining * 60;
            const iv = setInterval(() => {
                secsLeft--;
                if (secsLeft <= 0) { clearInterval(iv); overlay.remove(); _lastCheck = null; _toast('\u0424\u0440\u0435\u0434\u0438 \u043e\u0442\u0434\u043e\u0445\u043d\u0443\u043b! \u041c\u043e\u0436\u043d\u043e \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c.', 'success'); return; }
                const m = Math.floor(secsLeft / 60), sec = secsLeft % 60;
                if (timerEl) timerEl.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
            }, 1000);
        }
    }

    // ------------------------------------------------------------------
    // Auto-intercept: monkey-patch global apiCall
    // ------------------------------------------------------------------
    function _patchApiCall() {
        if (!window.apiCall || window._apiCallPatched) return;
        const _origApiCall = window.apiCall;
        window._apiCallPatched = true;

        window.apiCall = async function(endpoint, options) {
            // Intercept chat and voice endpoints
            const isChatOrVoice = endpoint.includes('/api/chat') || endpoint.includes('/api/voice/process');
            if (isChatOrVoice && options && (options.method === 'POST' || options.body)) {
                const check = await checkCanSend();
                if (!check.can_send) {
                    showFatigueModal(check);
                    throw new Error('METER_BLOCKED');
                }
                if (check.warning && !_warningShown) {
                    _warningShown = true;
                    _toast(`\u26A1 \u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${Math.round(check.remaining_minutes || 5)} \u043c\u0438\u043d \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e`, 'info');
                    setTimeout(() => { _warningShown = false; }, 60000);
                }
            }

            const result = await _origApiCall(endpoint, options);

            // Record usage after successful chat/voice
            if (isChatOrVoice && result && result.response) {
                const estimatedSeconds = Math.min(Math.max(Math.ceil(result.response.length / 8), 10), 60);
                recordUsage(estimatedSeconds);
            }

            return result;
        };
        console.log('meter: apiCall patched');
    }

    // ------------------------------------------------------------------
    // Auto-intercept: monkey-patch fetch for voice/process
    // ------------------------------------------------------------------
    function _patchFetch() {
        if (window._fetchMeterPatched) return;
        const _origFetch = window.fetch;
        window._fetchMeterPatched = true;

        window.fetch = async function(url, options) {
            const urlStr = typeof url === 'string' ? url : url?.url || '';
            const isVoice = urlStr.includes('/api/voice/process');
            const isChat = urlStr.includes('/api/chat');

            if ((isVoice || isChat) && options && options.method === 'POST') {
                const check = await checkCanSend();
                if (!check.can_send) {
                    showFatigueModal(check);
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'METER_BLOCKED',
                        response: check.message || '\u0424\u0440\u0435\u0434\u0438 \u0443\u0441\u0442\u0430\u043b'
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                if (check.warning && !_warningShown) {
                    _warningShown = true;
                    _toast(`\u26A1 \u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${Math.round(check.remaining_minutes || 5)} \u043c\u0438\u043d \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e`, 'info');
                    setTimeout(() => { _warningShown = false; }, 60000);
                }
            }

            const response = await _origFetch.call(window, url, options);

            // Record usage after voice/chat
            if ((isVoice || isChat) && response.ok) {
                recordUsage(30);
            }

            return response;
        };
        console.log('meter: fetch patched');
    }

    // Apply patches when DOM ready
    function _applyPatches() {
        _patchFetch();
        // apiCall may not exist yet, retry
        if (window.apiCall) {
            _patchApiCall();
        } else {
            setTimeout(() => { if (window.apiCall) _patchApiCall(); }, 2000);
            setTimeout(() => { if (window.apiCall) _patchApiCall(); }, 5000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _applyPatches);
    } else {
        _applyPatches();
    }

    window.FrediMeter = {
        checkCanSend,
        recordUsage,
        showFatigueModal,
    };

    console.log('meter.js loaded');
})();
