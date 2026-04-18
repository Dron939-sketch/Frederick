// ============================================
// auth.js — кросс-браузерная идентификация через device_id + fingerprint
// Версия 1.0
// Загружается ДО app.js. Не блокирует UI, запускает асинхронный /api/user/by-device
// и (если нужно) обновляет localStorage.fredi_user_id без ломания существующего потока.
// ============================================

(function () {
    if (window._authLoaded) return;
    window._authLoaded = true;

    var API_BASE = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    var LS_USER_ID = 'fredi_user_id';
    var LS_DEVICE_ID = 'fredi_device_id';
    var LS_AUTH_SYNCED = 'fredi_auth_synced_v1';

    function _safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function _safeSet(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (e) {}
    }

    function _genDeviceId() {
        // Стабильный случайный идентификатор устройства (per-browser).
        var arr;
        try {
            arr = new Uint8Array(16);
            (window.crypto || window.msCrypto).getRandomValues(arr);
        } catch (e) {
            arr = Array.from({ length: 16 }, function () { return Math.floor(Math.random() * 256); });
        }
        return 'd_' + Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    function _getWebGLInfo() {
        try {
            var c = document.createElement('canvas');
            var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            if (!gl) return null;
            var info = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : null,
                renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null
            };
        } catch (e) { return null; }
    }

    function _buildFingerprint() {
        // Только СТАБИЛЬНЫЕ характеристики (без Date.now / timestamp / scroll position).
        var webgl = _getWebGLInfo();
        return {
            userAgent: navigator.userAgent || '',
            platform: navigator.platform || '',
            language: navigator.language || '',
            languages: (navigator.languages || []).slice(0, 5),
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            screenWidth: (screen && screen.width) || 0,
            screenHeight: (screen && screen.height) || 0,
            screenColorDepth: (screen && screen.colorDepth) || 0,
            pixelRatio: window.devicePixelRatio || 1,
            timezone: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
            timezoneOffset: new Date().getTimezoneOffset(),
            cookieEnabled: !!navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack || '',
            webgl: webgl,
            plugins: Array.prototype.slice.call(navigator.plugins || [], 0, 10).map(function (p) { return p.name; })
        };
    }

    function _parseIntSafe(v) {
        if (v == null) return null;
        var s = String(v).trim();
        if (!s || s === 'null' || s === 'undefined') return null;
        var n = parseInt(s, 10);
        return isNaN(n) ? null : n;
    }

    // Гарантируем device_id (локально стабильный маркер браузера).
    var deviceId = _safeGet(LS_DEVICE_ID);
    if (!deviceId || !deviceId.startsWith('d_')) {
        deviceId = _genDeviceId();
        _safeSet(LS_DEVICE_ID, deviceId);
    }

    var existingUid = _parseIntSafe(_safeGet(LS_USER_ID));

    // Если уже синхронизировались с этим device_id ранее — можно просто обновить last_seen,
    // но не блокируем основной поток. Модули всё равно будут читать localStorage.fredi_user_id.
    window.authReady = (async function () {
        try {
            var fingerprint = _buildFingerprint();
            var body = { device_id: deviceId, fingerprint: fingerprint };
            if (existingUid) body.existing_user_id = existingUid;

            var res = await fetch(API_BASE + '/api/user/by-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var data = await res.json();

            if (data && data.success && data.user_id) {
                var newUid = Number(data.user_id);
                // Пишем в localStorage, только если он реально изменился (или был пуст).
                if (!existingUid || existingUid !== newUid) {
                    _safeSet(LS_USER_ID, newUid);
                    // Также синхронизируем cookie (использует app.js CONFIG getter).
                    try {
                        document.cookie = 'fredi_uid=' + newUid + ';path=/;max-age=315360000;SameSite=Lax';
                    } catch (e) {}
                    // Если voiceManager уже создан — мягко переобновляем ему userId.
                    try {
                        if (window.voiceManager) window.voiceManager.userId = newUid;
                    } catch (e) {}
                }
                _safeSet(LS_AUTH_SYNCED, '1');
                console.log('🔐 auth: user_id =', newUid, '| matched_by =', data.matched_by, '| is_new =', !!data.is_new);
                return newUid;
            }
            console.warn('🔐 auth: нестандартный ответ, продолжаем с локальным ID', data);
            return existingUid;
        } catch (e) {
            // Сеть упала / бэк недоступен — не ломаем flow, работаем на локальном ID.
            console.warn('🔐 auth: fetch failed, fallback to local ID', e);
            return existingUid;
        }
    })();

    // Публичный API (для диагностики).
    window.getDeviceId = function () { return _safeGet(LS_DEVICE_ID); };

    console.log('✅ auth.js v1.0 загружен, device_id =', deviceId);
})();
