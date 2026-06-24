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

    function _injectBadgeStyles() {
        if (document.getElementById('meter-badge-styles')) return;
        var s = document.createElement('style');
        s.id = 'meter-badge-styles';
        s.textContent = [
            // Бадж-таймер в правом верхнем углу. Видим всегда для free-юзеров.
            // На мобильных — чуть меньше и ниже от safe-area, чтобы не перекрыть статус-бар.
            '.meter-badge{position:fixed;top:max(12px,env(safe-area-inset-top,12px));right:14px;z-index:9000;display:flex;align-items:center;gap:6px;padding:7px 11px;background:rgba(20,20,22,0.85);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(224,224,224,0.18);border-radius:14px;font-size:12px;font-weight:600;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e0e0e0;cursor:pointer;font-variant-numeric:tabular-nums;box-shadow:0 2px 8px rgba(0,0,0,0.25);transition:transform 0.15s,border-color 0.2s,background 0.2s}',
            '.meter-badge:hover{transform:translateY(-1px);border-color:rgba(224,224,224,0.32)}',
            '.meter-badge:active{transform:scale(0.97)}',
            '.meter-badge-icon{font-size:14px;line-height:1}',
            '.meter-badge-time{min-width:34px;text-align:center}',
            '.meter-badge-day{font-size:10px;font-weight:600;color:#9b9b9d;letter-spacing:0.3px;border-left:1px solid rgba(224,224,224,0.18);padding-left:8px;margin-left:2px}',
            '.meter-badge.warn{border-color:rgba(252,206,40,0.45);background:rgba(70,55,15,0.7)}',
            '.meter-badge.danger{border-color:rgba(239,68,68,0.55);background:rgba(70,20,20,0.78);color:#ffcccc}',
            '@media (max-width:480px){.meter-badge{font-size:11px;padding:6px 10px}.meter-badge-day{font-size:9px}}'
        ].join('\n');
        document.head.appendChild(s);
    }

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
            '.meter-btn-primary{background:linear-gradient(135deg,#3b82ff 0%,#6366f1 100%);color:#fff;display:flex;flex-direction:column;gap:2px;align-items:center;line-height:1.25}',
            '.meter-btn-sub{font-size:11px;font-weight:500;opacity:0.85}',
            '.meter-btn-secondary{background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.18);color:var(--text-secondary)}',
            '.meter-context{display:flex;gap:10px;align-items:flex-start;background:rgba(59,130,255,0.06);border:1px solid rgba(59,130,255,0.14);border-radius:14px;padding:12px 14px;margin-bottom:18px}',
            '.meter-context-icon{font-size:18px;line-height:1.3;flex-shrink:0}',
            '.meter-context-text{font-size:13px;color:var(--text-primary);line-height:1.5}'
        ].join('\n');
        document.head.appendChild(s);
    }

    var _lastCheck = null;
    var _lastCheckTime = 0;
    var _warningShown = false;       // 70% использовано
    var _criticalShown = false;      // 90% использовано
    var CHECK_CACHE_MS = 5000;
    // Пороги предупреждений по доле использованного лимита.
    // Раньше были фиксированные 5/2 мин — это игнорировало размер лимита
    // и стреляло «слишком рано» (за 50% до блока). В аналитике meter_warning
    // показывало 0: фронт слал имя 'meter_warning', а SQL ищет
    // 'meter_warning_shown'/'meter_warning_server'. Здесь и фикс порога,
    // и фикс имени события.
    var WARN_USED_PCT = 0.70;        // soft: пора задуматься
    var CRIT_USED_PCT = 0.90;        // critical: последний шанс

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

    // Двухступенчатое предупреждение об исчерпании дневного лимита.
    // Цель — подготовить юзера к paywall ДО самой блокировки, чтобы он
    // успел задуматься о ценности. Раньше paywall падал внезапно (по
    // аналитике meter_warning=0, meter_blocked_shown=11) — отсюда низкий
    // conversion blocked→clicked (≈18%).
    //
    // Триггер — по доле использованного лимита, не по фиксированным минутам:
    //   used < 70%       → тишина
    //   70% ≤ used < 90% → soft: «остаётся ~N мин» (info-toast)
    //   used ≥ 90%       → critical: «последняя минута» (warn-toast)
    //
    // Каждый уровень показывается 1 раз за окно 2 мин (защита от спама).
    // Имя события — `meter_warning_shown`, чтобы попасть в SQL-воронку.
    function _trackWarning(level, rem, used, limit) {
        try {
            if (window.FrediTracker && window.FrediTracker.track) {
                window.FrediTracker.track('meter_warning_shown', {
                    level: level,                  // 'soft' | 'critical'
                    remaining_minutes: rem,
                    used_minutes: used,
                    limit_minutes: limit,
                    used_pct: limit ? Math.round((used / limit) * 100) : null,
                });
            }
        } catch (e) {}
    }

    function _showWarningToast(check) {
        if (!check || check.is_premium) return;
        var rem = check.remaining_minutes;
        var used = check.used_minutes_today;
        var limit = check.limit_minutes;
        if (rem == null || limit == null || limit <= 0) return;
        if (used == null) used = Math.max(0, limit - rem);

        var usedPct = used / limit;
        var remRound = Math.max(1, Math.round(rem));

        // Critical: ≥90% использовано — последний шанс предложить Premium.
        if (usedPct >= CRIT_USED_PCT && !_criticalShown) {
            _criticalShown = true;
            _toast('⏱ Остаётся около минуты. С Premium — без перерыва.', 'warn');
            _trackWarning('critical', rem, used, limit);
            setTimeout(function() { _criticalShown = false; }, 120000);
            return;
        }
        // Soft: ≥70% использовано — мягкая подготовка.
        if (usedPct >= WARN_USED_PCT && !_warningShown) {
            _warningShown = true;
            _toast('⏱ Осталось ~' + remRound + ' мин на сегодня', 'info');
            _trackWarning('soft', rem, used, limit);
            setTimeout(function() { _warningShown = false; }, 120000);
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
            // После каждой записи — синхронизируем статус и показываем
            // warning если осталось ≤5 мин. Это покрывает голосовой
            // чат через WebSocket, который не идёт через apiCall/fetch
            // patch и иначе никогда не получает warning-toast.
            try {
                var check = await checkCanSend();
                if (check && !check.is_premium) {
                    _showWarningToast(check);
                    // Если бэк вернул блок — показываем modal
                    if (check.can_send === false) {
                        showFatigueModal(check);
                    }
                }
            } catch (e) {}
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
        var limit = data.limit_minutes || 10;
        var usedToday = data.used_minutes_today;
        if (usedToday == null) usedToday = limit;
        var trialExhausted = !!data.trial_exhausted;
        var daysUsed = data.free_days_used || 0;

        _track('meter_blocked_shown', {
            limit_minutes: limit,
            minutes_until_reset: minutesUntilReset,
            trial_exhausted: trialExhausted,
            free_days_used: daysUsed,
        });

        var emoji, title, mainText, timerHtml;
        // \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442-\u044F\u043A\u043E\u0440\u044C: \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u043C, \u0447\u0442\u043E \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u043D\u0435 \u043F\u043E\u0442\u0435\u0440\u044F\u043D, \u0424\u0440\u0435\u0434\u0434\u0438 \u043F\u043E\u043C\u043D\u0438\u0442.
        // \u0426\u0435\u043B\u044C \u2014 \u0441\u043D\u044F\u0442\u044C \u0443 \u044E\u0437\u0435\u0440\u0430 \u043E\u0449\u0443\u0449\u0435\u043D\u0438\u0435 \u00AB\u0441\u0442\u0435\u043D\u044B\u00BB \u0438 \u0441\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0444\u0440\u0435\u0439\u043C \u043D\u0430 \u00AB\u043F\u0430\u0443\u0437\u0430\u00BB.
        var contextHtml =
            '<div class="meter-context">' +
                '<span class="meter-context-icon">\uD83D\uDCAC</span>' +
                '<span class="meter-context-text">' +
                    '\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0431\u0435\u0441\u0435\u0434\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u2014 \u0424\u0440\u0435\u0434\u0438 \u0432\u0441\u043F\u043E\u043C\u043D\u0438\u0442, \u043E \u0447\u0451\u043C \u0432\u044B \u0433\u043E\u0432\u043E\u0440\u0438\u043B\u0438.' +
                '</span>' +
            '</div>';

        if (trialExhausted) {
            // \u0424\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 paywall: 3 free-\u0434\u043D\u044F \u043F\u0440\u043E\u0448\u043B\u0438, \u0434\u0430\u043B\u044C\u0448\u0435 \u0442\u043E\u043B\u044C\u043A\u043E Premium.
            emoji = '\uD83D\uDCAC'; // \uD83D\uDCAC
            title = '\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440?';
            mainText =
                '\u0412\u044B \u043F\u0440\u043E\u0432\u0435\u043B\u0438 \u0441 \u0424\u0440\u0435\u0434\u0438 ' + daysUsed + ' \u0434\u043D\u044F \u2014 \u0441\u043F\u0430\u0441\u0438\u0431\u043E, \u0447\u0442\u043E \u043F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u043B\u0438.<br>' +
                '\u0427\u0442\u043E\u0431\u044B \u043D\u0435 \u0442\u0435\u0440\u044F\u0442\u044C \u043D\u0438\u0442\u044C \u0431\u0435\u0441\u0435\u0434\u044B \u2014 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 Premium, \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043C \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0440\u044B\u0432\u043E\u0432.';
            timerHtml = '';
        } else {
            // \u0414\u043D\u0435\u0432\u043D\u043E\u0439 \u043B\u0438\u043C\u0438\u0442 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D, \u043D\u043E trial-\u0434\u043D\u0438 \u0435\u0449\u0451 \u0435\u0441\u0442\u044C.
            emoji = '\uD83D\uDCAC'; // \uD83D\uDCAC
            title = '\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440?';
            mainText =
                '\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u0432\u044B \u0443\u0436\u0435 \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u043B\u0438 \u0441 \u0424\u0440\u0435\u0434\u0438 ~' + Math.round(usedToday) + ' \u043C\u0438\u043D \u0438\u0437 ' + limit + '.<br>' +
                '\u041C\u043E\u0436\u043D\u043E \u0432\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u0437\u0430\u0432\u0442\u0440\u0430 \u2014 \u0438\u043B\u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0440\u044F\u043C\u043E \u0441\u0435\u0439\u0447\u0430\u0441 \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0440\u044B\u0432\u0430.';
            timerHtml = minutesUntilReset > 0
                ? '<div class="meter-timer" id="meterTimer">\u041D\u043E\u0432\u044B\u0439 \u0434\u0435\u043D\u044C \u0447\u0435\u0440\u0435\u0437 ' + _formatResetCountdown(minutesUntilReset) + '</div>'
                : '';
        }

        var overlay = document.createElement('div');
        overlay.className = 'meter-overlay';
        overlay.id = 'meterOverlay';
        overlay.innerHTML =
            '<div class="meter-modal">' +
                '<div class="meter-emoji">' + emoji + '</div>' +
                '<div class="meter-title">' + title + '</div>' +
                timerHtml +
                '<div class="meter-text">' + mainText + '</div>' +
                contextHtml +
                '<div class="meter-features-title">\u0427\u0442\u043E \u0434\u0430\u0451\u0442 Premium:</div>' +
                PREMIUM_FEATURES +
                '<button class="meter-btn meter-btn-primary" id="meterSubscribeBtn">' +
                    '\u2728 \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440' +
                    '<span class="meter-btn-sub">Premium \u2014 690 \u20BD / \u043C\u0435\u0441, \u0431\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u043E\u0432</span>' +
                '</button>' +
                (trialExhausted
                    ? '<button class="meter-btn meter-btn-secondary" id="meterCloseBtn">\u041F\u043E\u0434\u0443\u043C\u0430\u044E \u043F\u043E\u0437\u0436\u0435</button>'
                    : '<button class="meter-btn meter-btn-secondary" id="meterCloseBtn">\u0412\u0435\u0440\u043D\u0443\u0441\u044C \u0437\u0430\u0432\u0442\u0440\u0430</button>') +
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
                _showWarningToast(check);
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
                _showWarningToast(check);
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
            // 15 сек на запрос — компромисс. При 10-мин/день это даёт
            // примерно 40 сообщений. Реальное чтение длинного ответа
            // часто занимает больше, но мы не хотим съедать лимит
            // быстрее, чем юзер реально читает.
            if (isAi && response.ok) recordUsage(15);
            return response;
        };
        console.log('meter: fetch patched');
    }

    // ============================================
    // PERSISTENT TIMER BADGE — правый верхний угол
    // ============================================
    // Идея: в trial юзер видит бадж «⏱ 7:32 · День 2/3» постоянно.
    // Полный функционал работает, но лимит виден → создаёт ясное
    // ощущение «free trial идёт» без агрессивного pull-в-подписку.
    //
    // Цвет:
    //   серый    — > 5 мин осталось
    //   жёлтый   — 1–5 мин
    //   красный  — < 1 мин
    // Premium-юзер бадж не видит вообще.

    function _formatTime(minutes) {
        if (minutes == null || minutes < 0) minutes = 0;
        var totalSec = Math.max(0, Math.round(minutes * 60));
        var m = Math.floor(totalSec / 60);
        var s = totalSec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function _ensureBadge() {
        _injectBadgeStyles();
        var badge = document.getElementById('meterBadge');
        if (badge) return badge;
        badge = document.createElement('div');
        badge.id = 'meterBadge';
        badge.className = 'meter-badge';
        badge.title = 'Дневной лимит free-trial';
        badge.innerHTML = '<span class="meter-badge-icon">⏱</span>'
            + '<span class="meter-badge-time" id="meterBadgeTime">--:--</span>'
            + '<span class="meter-badge-day" id="meterBadgeDay"></span>';
        // Клик по баджу — paywall (показываем модалку, как при блоке).
        badge.addEventListener('click', function () {
            if (_lastCheck) {
                showFatigueModal(_lastCheck);
                try {
                    if (window.FrediTracker && window.FrediTracker.track) {
                        window.FrediTracker.track('meter_badge_clicked', {});
                    }
                } catch (e) {}
            }
        });
        document.body.appendChild(badge);
        return badge;
    }

    function _renderBadge(check) {
        // Premium / нет данных / не free-юзер → бадж не показываем.
        if (!check || check.is_premium) {
            var existing = document.getElementById('meterBadge');
            if (existing) existing.remove();
            return;
        }
        var badge = _ensureBadge();
        var rem = check.remaining_minutes;
        var daysUsed = check.free_days_used || 0;
        var daysLeft = check.free_days_left;
        // Если trial исчерпан — показываем без таймера, текстом «Trial исчерпан».
        if (check.trial_exhausted) {
            badge.classList.remove('warn');
            badge.classList.add('danger');
            var t = document.getElementById('meterBadgeTime');
            var d = document.getElementById('meterBadgeDay');
            if (t) t.textContent = 'Trial';
            if (d) d.textContent = 'Купить';
            return;
        }
        // Цвет по остатку минут.
        badge.classList.remove('warn', 'danger');
        if (rem != null) {
            if (rem < 1) badge.classList.add('danger');
            else if (rem <= 5) badge.classList.add('warn');
        }
        var timeEl = document.getElementById('meterBadgeTime');
        var dayEl = document.getElementById('meterBadgeDay');
        if (timeEl) timeEl.textContent = _formatTime(rem);
        if (dayEl) {
            // «День 2/3»: считаем активный день. Если daysUsed=0 (ещё не
            // ничего не записывали) — показываем «День 1/3» как стартовое.
            var active = Math.max(1, Math.min(daysUsed || 1, 3));
            dayEl.textContent = 'День ' + active + '/3';
        }
    }

    // Локально тикаем таймер каждую секунду (без походов на сервер),
    // отталкиваясь от последнего известного remaining_minutes.
    var _tickInterval = null;
    function _startBadgeTicker() {
        if (_tickInterval) return;
        _tickInterval = setInterval(function () {
            // Если есть текущий чек, мы УЖЕ показали бадж.
            // Каждую секунду уменьшаем local-копию remaining_minutes на 1/60.
            // Бэк всё равно — источник правды; периодически (раз в 60 сек)
            // дёргаем checkCanSend, чтобы синхронизироваться.
            if (!_lastCheck || _lastCheck.is_premium) return;
            if (_lastCheck.trial_exhausted) {
                _renderBadge(_lastCheck);
                return;
            }
            // Уменьшаем local remaining только если идёт активный chat?
            // Безопаснее НЕ уменьшать, а просто перерисовывать —
            // обновление пойдёт через recordUsage → invalidate cache → next checkCanSend.
            _renderBadge(_lastCheck);
        }, 1000);

        // Каждые 60 сек — освежаем данные с сервера.
        setInterval(function () {
            _lastCheck = null;
            checkCanSend().then(function (data) { _renderBadge(data); });
        }, 60000);
    }

    // При первой возможности — рисуем бадж.
    function _initBadge() {
        if (!_uid()) {
            // user_id не готов, повторим через 1 сек.
            setTimeout(_initBadge, 1000);
            return;
        }
        checkCanSend().then(function (data) {
            _renderBadge(data);
            _startBadgeTicker();
        });
    }

    function _applyPatches() {
        _patchFetch();
        _initBadge();
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
