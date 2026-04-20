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

    function _applyUserId(newUid) {
        var num = Number(newUid);
        if (!num) return;
        _safeSet(LS_USER_ID, num);
        try {
            document.cookie = 'fredi_uid=' + num + ';path=/;max-age=315360000;SameSite=Lax';
        } catch (e) {}
        try { window.USER_ID = num; } catch (e) {}
        try { if (window.voiceManager) window.voiceManager.userId = num; } catch (e) {}
    }

    // Пробуем восстановить серверную сессию (email/password логин).
    // credentials:'include' — чтобы HttpOnly cookie fredi_session ушла на бэк.
    async function _tryAuthMe() {
        try {
            var res = await fetch(API_BASE + '/api/auth/me', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            if (res.status === 401 || res.status === 404) return null;
            if (!res.ok) return null;
            var data = await res.json();
            if (data && data.success && data.user_id) {
                return data;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async function _syncByDevice() {
        try {
            var fingerprint = _buildFingerprint();
            var body = { device_id: deviceId, fingerprint: fingerprint };
            var curUid = _parseIntSafe(_safeGet(LS_USER_ID));
            if (curUid) body.existing_user_id = curUid;

            var res = await fetch(API_BASE + '/api/user/by-device', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var data = await res.json();
            if (data && data.success && data.user_id) {
                _applyUserId(data.user_id);
                _safeSet(LS_AUTH_SYNCED, '1');
                console.log('🔐 auth(device): user_id =', data.user_id, '| matched_by =', data.matched_by);
                return Number(data.user_id);
            }
        } catch (e) {
            console.warn('🔐 auth(device): fetch failed, using local ID', e);
        }
        return _parseIntSafe(_safeGet(LS_USER_ID));
    }

    window.authReady = (async function () {
        // Сначала пробуем серверную сессию — если юзер залогинен, он главнее device-ID.
        var me = await _tryAuthMe();
        if (me) {
            _applyUserId(me.user_id);
            try { window.CURRENT_USER_EMAIL = me.email || ''; } catch (e) {}
            try { window.CURRENT_USER_NAME = me.name || ''; } catch (e) {}
            try { window.IS_AUTHENTICATED = true; } catch (e) {}
            _safeSet(LS_AUTH_SYNCED, '1');
            console.log('🔐 auth: signed in as', me.email, 'user_id =', me.user_id);
            // Параллельно обновим last_seen устройства (но user_id НЕ меняем).
            _syncByDevice().catch(function () {});
            return Number(me.user_id);
        }

        // Нет активной сессии — работаем как раньше, через device_id.
        try { window.IS_AUTHENTICATED = false; } catch (e) {}
        return await _syncByDevice();
    })();

    // Публичный API (для диагностики и UI-модулей).
    window.getDeviceId = function () { return _safeGet(LS_DEVICE_ID); };
    window.refreshAuth = async function () {
        var me = await _tryAuthMe();
        if (me) {
            _applyUserId(me.user_id);
            try { window.CURRENT_USER_EMAIL = me.email || ''; } catch (e) {}
            try { window.CURRENT_USER_NAME = me.name || ''; } catch (e) {}
            try { window.IS_AUTHENTICATED = true; } catch (e) {}
            return me;
        }
        try { window.IS_AUTHENTICATED = false; } catch (e) {}
        return null;
    };

    console.log('✅ auth.js v1.0 загружен, device_id =', deviceId);
})();
