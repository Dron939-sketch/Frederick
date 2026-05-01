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
        var s = document.createElement('style');
        s.id = 'meter-styles';
        s.textContent = [
            '.meter-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:16px}',
            '.meter-modal{background:var(--black-matte,#111);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:28px;max-width:400px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,0.6);color:var(--text-primary);max-height:90vh;overflow-y:auto}',
            '.meter-emoji{font-size:48px;text-align:center;margin-bottom:16px}',
            '.meter-title{font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:8px;text-align:center}',
            '.meter-text{font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:18px}',
            '.meter-timer{font-size:28px;font-weight:700;color:#3b82ff;text-align:center;margin-bottom:16px;font-variant-numeric:tabular-nums}',
            '.meter-hint{background:rgba(59,130,255,0.08);border:1px solid rgba(59,130,255,0.15);border-radius:14px;padding:14px;margin-bottom:18px;font-size:13px;color:var(--text-primary);line-height:1.5}',
            '.meter-hint-path{font-weight:600;color:#3b82ff}',
            '.meter-features{list-style:none;padding:0;margin:0 0 18px 0}',
            '.meter-features li{font-size:12px;color:var(--text-secondary);padding:4px 0;display:flex;align-items:center;gap:8px}',
            '.meter-features li span{flex-shrink:0;width:18px;text-align:center;font-size:14px}',
            '.meter-features-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-secondary);margin-bottom:8px}',
            '.meter-btn{display:block;width:100%;padding:14px;border:none;border-radius:14px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;text-align:center;margin-bottom:10px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform 0.15s}',
            '.meter-btn:active{transform:scale(0.98)}',
            '.meter-btn-primary{background:linear-gradient(135deg,#3b82ff 0%,#6366f1 100%);color:#fff}',
            '.meter-btn-secondary{background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.18);color:var(--text-secondary)}'
        ].join('\n');
        document.head.appendChild(s);
    }

    var _lastCheck = null;
    var _lastCheckTime = 0;
    var _warningShown = false;
    var CHECK_CACHE_MS = 5000;

    async function checkCanSend() {
        var uid = _uid();
        if (!uid) return { can_send: true };
        var now = Date.now();
        if (_lastCheck && (now - _lastCheckTime) < CHECK_CACHE_MS) return _lastCheck;
        try {
            var r = await fetch(_api() + '/api/meter/can-send/' + uid);
            var data = await r.json();
            _lastCheck = data;
            _lastCheckTime = now;
            return data;
        } catch (e) {
            return { can_send: true };
        }
    }

    async function recordUsage(seconds) {
        var uid = _uid();
        if (!uid) return;
        try {
            await fetch(_api() + '/api/meter/record-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, seconds: seconds || 30 })
            });
            _lastCheck = null;
        } catch (e) {}
    }

    var PREMIUM_FEATURES =
        '<ul class="meter-features">' +
        '<li><span>\u2728</span> \u0411\u0435\u0437\u043B\u0438\u043C\u0438\u0442\u043D\u043E\u0435 \u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0441 \u0424\u0440\u0435\u0434\u0438 24/7</li>' +
        '<li><span>\uD83C\uDFAF</span> \u041F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0446\u0435\u043B\u0435\u0439 \u0438 \u0440\u0430\u0441\u0447\u0451\u0442 \u0448\u0430\u0433\u043E\u0432</li>' +
        '<li><span>\uD83D\uDCC8</span> \u041F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435 \u043B\u0438\u0447\u043D\u044B\u0445 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0439</li>' +
        '<li><span>\uD83E\uDDE0</span> \u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0435 \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0438 \u043D\u0430\u0432\u044B\u043A\u043E\u0432</li>' +
        '<li><span>\uD83D\uDCCA</span> \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0430 \u0438 \u043F\u0440\u0438\u0432\u044B\u0447\u0435\u043A</li>' +
        '<li><span>\uD83C\uDFA4</span> \u0413\u043E\u043B\u043E\u0441\u043E\u0432\u044B\u0435 \u0441\u0435\u0430\u043D\u0441\u044B \u0441 AI-\u043F\u0441\u0438\u0445\u043E\u043B\u043E\u0433\u043E\u043C</li>' +
        '<li><span>\uD83E\uDE9E</span> \u0417\u0435\u0440\u043A\u0430\u043B\u043E \u2014 \u0433\u043B\u0443\u0431\u043E\u043A\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0439</li>' +
        '<li><span>\uD83C\uDFAD</span> \u0422\u0440\u0430\u043D\u0437\u0430\u043A\u0442\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u043F\u043E \u0411\u0435\u0440\u043D\u0443</li>' +
        '<li><span>\uD83C\uDF19</span> \u0413\u0438\u043F\u043D\u043E\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0441\u0435\u0441\u0441\u0438\u0438</li>' +
        '<li><span>\uD83D\uDCD3</span> AI-\u0434\u043D\u0435\u0432\u043D\u0438\u043A \u0441 \u0440\u0435\u0444\u043B\u0435\u043A\u0441\u0438\u0435\u0439</li>' +
        '<li><span>\uD83E\uDDD8</span> \u0423\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0438 \u0432\u0435\u0447\u0435\u0440\u043D\u0438\u0435 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0438</li>' +
        '<li><span>\uD83C\uDF05</span> \u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043F\u043E\u0441\u043B\u0430\u043D\u0438\u044F \u0438 \u0438\u0434\u0435\u0438 \u043D\u0430 \u0432\u044B\u0445\u043E\u0434\u043D\u044B\u0435</li>' +
        '</ul>';

    function _track(event, data) {
        try {
            if (window.FrediTracker && window.FrediTracker.track) {
                window.FrediTracker.track(event, data || {});
            }
        } catch (e) {}
    }

    function _formatResetCountdown(minutesUntil) {
        if (!minutesUntil || minutesUntil <= 0) return '00:00';
        var h = Math.floor(minutesUntil / 60);
        var m = minutesUntil % 60;
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }

    function showFatigueModal(data) {
        _injectMeterStyles();
        var existing = document.getElementById('meterOverlay');
        if (existing) existing.remove();

        var minutesUntilReset = data.minutes_until_reset || 0;
        var limit = data.limit_minutes || 15;

        _track('meter_blocked_shown', {
            limit_minutes: limit,
            minutes_until_reset: minutesUntilReset
        });

        var emoji = '\uD83D\uDE34';
        var title = '\u0424\u0440\u0435\u0434\u0438 \u043E\u0442\u0434\u044B\u0445\u0430\u0435\u0442';
        var mainText =
            '\u041C\u044B \u043E\u0431\u0449\u0430\u043B\u0438\u0441\u044C ' + limit + ' \u043C\u0438\u043D\u0443\u0442 \u2014 \u044D\u0442\u043E \u0432\u0435\u0441\u044C \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u043B\u0438\u043C\u0438\u0442 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F.<br>' +
            '\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0441\u044F \u0432 \u043F\u043E\u043B\u043D\u043E\u0447\u044C \u2014 \u0424\u0440\u0435\u0434\u0438 \u043E\u0442\u0434\u043E\u0445\u043D\u0451\u0442 \u0438 \u0441\u043D\u043E\u0432\u0430 \u0431\u0443\u0434\u0435\u0442 \u0440\u044F\u0434\u043E\u043C.';

        var timerHtml = minutesUntilReset > 0
            ? '<div class="meter-timer" id="meterTimer">\u0421\u0438\u043B\u044B \u0432\u0435\u0440\u043D\u0443\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ' + _formatResetCountdown(minutesUntilReset) + '</div>'
            : '';

        var overlay = document.createElement('div');
        overlay.className = 'meter-overlay';
        overlay.id = 'meterOverlay';
        overlay.innerHTML =
            '<div class="meter-modal">' +
                '<div class="meter-emoji">' + emoji + '</div>' +
                '<div class="meter-title">' + title + '</div>' +
                timerHtml +
                '<div class="meter-text">' + mainText + '</div>' +
                '<div class="meter-features-title">\u0421 Premium \u0424\u0440\u0435\u0434\u0438 \u043D\u0435 \u0443\u0441\u0442\u0430\u0451\u0442:</div>' +
                PREMIUM_FEATURES +
                '<button class="meter-btn meter-btn-primary" id="meterSubscribeBtn">\u2728 Premium \u2014 690 \u20BD/\u043C\u0435\u0441, \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0440\u044B\u0432\u043E\u0432</button>' +
                '<button class="meter-btn meter-btn-secondary" id="meterCloseBtn">\u041F\u043E\u043D\u044F\u0442\u043D\u043E, \u0434\u043E \u0437\u0430\u0432\u0442\u0440\u0430</button>' +
            '</div>';
        document.body.appendChild(overlay);

        document.getElementById('meterCloseBtn').onclick = function() {
            _track('meter_closed', { reason: 'continue_tomorrow' });
            overlay.remove();
        };
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                _track('meter_dismissed_outside', {});
                overlay.remove();
            }
        };
        document.getElementById('meterSubscribeBtn').onclick = function() {
            _track('meter_subscribe_clicked', {});
            overlay.remove();
            if (typeof showSettingsScreen === 'function') showSettingsScreen();
        };

        // \u0422\u0438\u043A\u0430\u044E\u0449\u0438\u0439 \u043E\u0431\u0440\u0430\u0442\u043D\u044B\u0439 \u043E\u0442\u0441\u0447\u0451\u0442 \u0434\u043E 00:00 UTC.
        if (minutesUntilReset > 0) {
            var timerEl = document.getElementById('meterTimer');
            var secsLeft = minutesUntilReset * 60;
            var iv = setInterval(function() {
                secsLeft--;
                if (secsLeft <= 0) {
                    clearInterval(iv);
                    overlay.remove();
                    _lastCheck = null;
                    _toast('\u0424\u0440\u0435\u0434\u0438 \u043E\u0442\u0434\u043E\u0445\u043D\u0443\u043B! \u041C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C.', 'success');
                    return;
                }
                var h = Math.floor(secsLeft / 3600);
                var m = Math.floor((secsLeft % 3600) / 60);
                var s = secsLeft % 60;
                if (timerEl) {
                    timerEl.textContent = '\u0421\u0438\u043B\u044B \u0432\u0435\u0440\u043D\u0443\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ' +
                        (h < 10 ? '0' : '') + h + ':' +
                        (m < 10 ? '0' : '') + m + ':' +
                        (s < 10 ? '0' : '') + s;
                }
            }, 1000);
        }
    }

    function _patchApiCall() {
        if (!window.apiCall || window._apiCallPatched) return;
        var _origApiCall = window.apiCall;
        window._apiCallPatched = true;
        window.apiCall = async function(endpoint, options) {
            var isAi = _isAiRequest(endpoint);
            if (isAi && options && (options.method === 'POST' || options.body)) {
                var check = await checkCanSend();
                if (!check.can_send) { showFatigueModal(check); throw new Error('METER_BLOCKED'); }
                if (check.warning && !_warningShown) {
                    _warningShown = true;
                    _toast('\uD83D\uDC9B \u0424\u0440\u0435\u0434\u0438 \u0441\u043A\u043E\u0440\u043E \u0443\u0441\u0442\u0430\u043D\u0435\u0442 \u2014 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ' + Math.round(check.remaining_minutes || 5) + ' \u043C\u0438\u043D', 'info');
                    setTimeout(function() { _warningShown = false; }, 60000);
                }
            }
            var result = await _origApiCall(endpoint, options);
            if (result && result.error === 'METER_BLOCKED') {
                _lastCheck = null;
                showFatigueModal(result);
            }
            if (isAi && result && result.response) {
                recordUsage(Math.min(Math.max(Math.ceil(result.response.length / 8), 10), 60));
            }
            return result;
        };
        console.log('meter: apiCall patched');
    }

    // Список AI-эндпоинтов, которые должен предварять meter-чек.
    // Держим в синхроне с _METER_AI_REGEX в backend/main.py.
    var AI_URL_REGEX = /\/api\/(?:chat|voice\/process|ai\/generate|deep-analysis|hypno\/support|psychologist-thoughts\/generate|dreams\/(?:interpret|clarify)|reality\/(?:check|parse\/[^/]+)|brand\/transformation|mirrors\/(?:complete|[^/]+\/complete)|morning\/send-now)(?:\/|$|\?)/;

    function _isAiRequest(urlStr) {
        return AI_URL_REGEX.test(urlStr || '');
    }

    function _patchFetch() {
        if (window._fetchMeterPatched) return;
        var _origFetch = window.fetch;
        window._fetchMeterPatched = true;
        window.fetch = async function(url, options) {
            var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
            var isAi = _isAiRequest(urlStr);
            var method = (options && options.method) || 'GET';
            if (isAi && method === 'POST') {
                var check = await checkCanSend();
                if (!check.can_send) {
                    showFatigueModal(check);
                    return new Response(JSON.stringify({ success: false, error: 'METER_BLOCKED', response: check.message || '\u0424\u0440\u0435\u0434\u0438 \u0443\u0441\u0442\u0430\u043B' }), { status: 402, headers: { 'Content-Type': 'application/json' } });
                }
                if (check.warning && !_warningShown) {
                    _warningShown = true;
                    _toast('\uD83D\uDC9B \u0424\u0440\u0435\u0434\u0438 \u0441\u043A\u043E\u0440\u043E \u0443\u0441\u0442\u0430\u043D\u0435\u0442 \u2014 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ' + Math.round(check.remaining_minutes || 5) + ' \u043C\u0438\u043D', 'info');
                    setTimeout(function() { _warningShown = false; }, 60000);
                }
            }
            var response = await _origFetch.call(window, url, options);
            // Если бэк сам заблокировал (402) — достаём данные и показываем модалку.
            if (isAi && response.status === 402) {
                try {
                    var cloned = response.clone();
                    var blocked = await cloned.json();
                    if (blocked && blocked.error === 'METER_BLOCKED') {
                        _lastCheck = null;
                        showFatigueModal(blocked);
                    }
                } catch (e) {}
            }
            if (isAi && response.ok) recordUsage(30);
            return response;
        };
        console.log('meter: fetch patched');
    }

    function _applyPatches() {
        _patchFetch();
        if (window.apiCall) { _patchApiCall(); }
        else {
            setTimeout(function() { if (window.apiCall) _patchApiCall(); }, 2000);
            setTimeout(function() { if (window.apiCall) _patchApiCall(); }, 5000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _applyPatches);
    } else {
        _applyPatches();
    }

    window.FrediMeter = { checkCanSend: checkCanSend, recordUsage: recordUsage, showFatigueModal: showFatigueModal };
    console.log('meter.js loaded');
})();
