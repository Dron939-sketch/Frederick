// ============================================
// login.js — модалка «Вход / Регистрация» по email+password
// Подключается ПОСЛЕ auth.js. Не блокирует UI.
// Публичный API:
//   window.FrediAuth.openLogin()     — открыть модалку на табе «Вход»
//   window.FrediAuth.openRegister()  — открыть на табе «Регистрация»
//   window.FrediAuth.logout()        — выйти из аккаунта
//   window.FrediAuth.isAuthed()      — boolean
// ============================================
(function () {
    if (window._loginLoaded) return;
    window._loginLoaded = true;

    var API_BASE = window.API_BASE_URL || (window.CONFIG && window.CONFIG.API_BASE_URL) || 'https://fredi-backend-flz2.onrender.com';
    var LS_LAST_EMAIL = 'fredi_last_email';

    function _safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function _safeSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
    function _toast(msg, t) { if (window.showToast) window.showToast(msg, t || 'info'); }

    function _injectStyles() {
        if (document.getElementById('fa-auth-styles')) return;
        var s = document.createElement('style');
        s.id = 'fa-auth-styles';
        s.textContent = [
            // Нейтральные стили (работают на dark-теме по умолчанию).
            '.fa-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)}',
            '.fa-modal{background:#171717;border:1px solid rgba(224,224,224,0.1);border-radius:18px;max-width:420px;width:100%;padding:24px;color:#e0e0e0;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto}',
            '.fa-title{font-size:18px;font-weight:700;margin-bottom:4px}',
            '.fa-subtitle{font-size:12px;color:#8a8a8e;margin-bottom:18px}',
            '.fa-tabs{display:flex;gap:8px;margin-bottom:18px;background:rgba(224,224,224,0.04);border-radius:10px;padding:4px}',
            '.fa-tab{flex:1;text-align:center;padding:8px;font-size:13px;font-weight:500;cursor:pointer;border-radius:8px;color:#8a8a8e;transition:background 0.15s,color 0.15s;-webkit-tap-highlight-color:transparent}',
            '.fa-tab.active{background:rgba(224,224,224,0.1);color:#e0e0e0}',
            '.fa-field{margin-bottom:12px}',
            '.fa-label{display:block;font-size:11px;color:#8a8a8e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px}',
            '.fa-input{width:100%;box-sizing:border-box;padding:10px 12px;background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);border-radius:10px;color:#e0e0e0;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s}',
            '.fa-input:focus{border-color:rgba(224,224,224,0.35)}',
            '.fa-input.err{border-color:rgba(255,100,100,0.6)}',
            '.fa-err{font-size:11px;color:#ff7a7a;margin-top:4px;min-height:14px}',
            '.fa-check{display:flex;align-items:center;gap:8px;margin:12px 0 18px;font-size:13px;color:#a8a8ac;cursor:pointer;user-select:none}',
            '.fa-check input{width:16px;height:16px;cursor:pointer}',
            '.fa-actions{display:flex;flex-direction:column;gap:8px}',
            '.fa-btn{padding:12px;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid transparent;transition:background 0.15s,opacity 0.15s;-webkit-tap-highlight-color:transparent}',
            '.fa-btn-primary{background:linear-gradient(135deg,#d4d4d4,#a8a8a8);color:#0a0a0a}',
            '.fa-btn-primary:hover{opacity:0.9}',
            '.fa-btn-primary:disabled{opacity:0.5;cursor:wait}',
            '.fa-btn-ghost{background:transparent;color:#8a8a8e;font-size:12px;padding:6px}',
            '.fa-btn-ghost:hover{color:#e0e0e0}',
            '.fa-close{position:absolute;top:10px;right:10px;background:none;border:none;color:#8a8a8e;font-size:18px;cursor:pointer;padding:6px 10px;border-radius:8px}',
            '.fa-close:hover{background:rgba(224,224,224,0.06);color:#fff}',
            '.fa-modal-inner{position:relative}',
            '.fa-info{font-size:11px;color:#8a8a8e;text-align:center;margin-top:10px;line-height:1.45}',
            // Light-theme overrides.
            '[data-theme="light"] .fa-modal{background:#ffffff;color:#1c1c1e;border-color:rgba(0,0,0,0.08);box-shadow:0 20px 60px rgba(0,0,0,0.15)}',
            '[data-theme="light"] .fa-subtitle{color:#6c6c70}',
            '[data-theme="light"] .fa-tabs{background:rgba(0,0,0,0.04)}',
            '[data-theme="light"] .fa-tab{color:#6c6c70}',
            '[data-theme="light"] .fa-tab.active{background:rgba(0,0,0,0.08);color:#1c1c1e}',
            '[data-theme="light"] .fa-label{color:#6c6c70}',
            '[data-theme="light"] .fa-input{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.12);color:#1c1c1e}',
            '[data-theme="light"] .fa-input:focus{border-color:rgba(0,0,0,0.4)}',
            '[data-theme="light"] .fa-err{color:#c53030}',
            '[data-theme="light"] .fa-check{color:#6c6c70}',
            '[data-theme="light"] .fa-btn-primary{background:linear-gradient(135deg,#4a4a4a,#2a2a2a);color:#ffffff}',
            '[data-theme="light"] .fa-btn-ghost{color:#6c6c70}',
            '[data-theme="light"] .fa-btn-ghost:hover{color:#1c1c1e}',
            '[data-theme="light"] .fa-close{color:#6c6c70}',
            '[data-theme="light"] .fa-close:hover{background:rgba(0,0,0,0.06);color:#1c1c1e}',
            '[data-theme="light"] .fa-info{color:#6c6c70}'
        ].join('');
        document.head.appendChild(s);
    }

    function _isEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
    }

    function _closeModal() {
        var m = document.getElementById('faAuthModal');
        if (m && m.parentNode) m.parentNode.removeChild(m);
    }

    function _buildHtml(mode) {
        var lastEmail = _safeGet(LS_LAST_EMAIL) || '';
        var isRegister = (mode === 'register');
        var title = isRegister ? 'Создать аккаунт' : 'Вход';
        var subtitle = isRegister
            ? 'Email станет вашим логином. Придумайте пин-код из 4 цифр.'
            : 'Войдите, чтобы работать с Фреди с любого устройства.';

        var nameField = isRegister
            ? '<div class="fa-field"><label class="fa-label" for="faName">Имя</label>' +
              '<input id="faName" class="fa-input" type="text" autocomplete="name" maxlength="100" />' +
              '<div class="fa-err" id="faErrName"></div></div>'
            : '';

        var passCheckField = isRegister
            ? '<div class="fa-field"><label class="fa-label" for="faPass2">Повторите пин-код</label>' +
              '<input id="faPass2" class="fa-input" type="password" autocomplete="new-password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" />' +
              '<div class="fa-err" id="faErrPass2"></div></div>'
            : '';

        var primaryLabel = isRegister ? 'Создать аккаунт' : 'Войти';

        return '' +
            '<div class="fa-modal-overlay" id="faAuthModal">' +
              '<div class="fa-modal"><div class="fa-modal-inner">' +
                '<button class="fa-close" id="faClose" aria-label="Закрыть">\u2715</button>' +
                '<div class="fa-title">' + title + '</div>' +
                '<div class="fa-subtitle">' + subtitle + '</div>' +
                '<div class="fa-tabs">' +
                  '<div class="fa-tab ' + (isRegister ? '' : 'active') + '" data-tab="login">Вход</div>' +
                  '<div class="fa-tab ' + (isRegister ? 'active' : '') + '" data-tab="register">Регистрация</div>' +
                '</div>' +
                nameField +
                '<div class="fa-field"><label class="fa-label" for="faEmail">Email</label>' +
                  '<input id="faEmail" class="fa-input" type="email" autocomplete="email" value="' + lastEmail.replace(/"/g, '&quot;') + '" maxlength="254" />' +
                  '<div class="fa-err" id="faErrEmail"></div>' +
                '</div>' +
                '<div class="fa-field"><label class="fa-label" for="faPass">Пин-код (4 цифры)</label>' +
                  '<input id="faPass" class="fa-input" type="password" autocomplete="' + (isRegister ? 'new-password' : 'current-password') + '" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" />' +
                  '<div class="fa-err" id="faErrPass"></div>' +
                '</div>' +
                passCheckField +
                '<label class="fa-check"><input id="faRemember" type="checkbox" checked>Запомнить меня на этом устройстве</label>' +
                '<div class="fa-actions">' +
                  '<button class="fa-btn fa-btn-primary" id="faSubmit">' + primaryLabel + '</button>' +
                  (isRegister
                    ? ''
                    : '<button class="fa-btn fa-btn-ghost" id="faForgot">Забыли пин-код?</button>') +
                  '<button class="fa-btn fa-btn-ghost" id="faSkip">Пропустить — продолжить без входа</button>' +
                '</div>' +
                '<div class="fa-info">Пин-код хранится в виде необратимого хеша (Argon2). Сессия защищена HttpOnly-cookie и живёт до 1 года.</div>' +
              '</div></div>' +
            '</div>';
    }

    function _setErr(id, msg) {
        var el = document.getElementById(id);
        if (el) el.textContent = msg || '';
        var field = id.replace('faErr', 'fa').toLowerCase();
        // Подсветим инпут
        var ids = { faerremail: 'faEmail', faerrpass: 'faPass', faerrpass2: 'faPass2', faerrname: 'faName' };
        var inp = document.getElementById(ids[id.toLowerCase()]);
        if (inp) inp.classList.toggle('err', !!msg);
    }

    function _clearErrors() {
        ['faErrEmail', 'faErrPass', 'faErrPass2', 'faErrName'].forEach(function (id) { _setErr(id, ''); });
    }

    async function _submit(mode) {
        _clearErrors();
        var email = (document.getElementById('faEmail').value || '').trim();
        var password = document.getElementById('faPass').value || '';
        var remember = !!document.getElementById('faRemember').checked;

        var ok = true;
        if (!_isEmail(email)) { _setErr('faErrEmail', 'Неверный формат email'); ok = false; }
        if (mode === 'register') {
            if (!/^\d{4}$/.test(password)) { _setErr('faErrPass', 'Пин-код — 4 цифры'); ok = false; }
        } else {
            if (!password) { _setErr('faErrPass', 'Введите пин-код'); ok = false; }
        }

        if (mode === 'register') {
            var name = (document.getElementById('faName').value || '').trim();
            var pass2 = document.getElementById('faPass2').value || '';
            if (!name) { _setErr('faErrName', 'Введите имя'); ok = false; }
            if (pass2 !== password) { _setErr('faErrPass2', 'Пин-коды не совпадают'); ok = false; }
            if (!ok) return;

            await _doRegister(name, email, password, remember);
        } else {
            if (!ok) return;
            await _doLogin(email, password, remember);
        }
    }

    async function _doRegister(name, email, password, remember) {
        var btn = document.getElementById('faSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Создаём...'; }
        try {
            var res = await fetch(API_BASE + '/api/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, email: email, password: password, remember: remember })
            });
            var data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                _handleAuthError(data, 'register');
                return;
            }
            _safeSet(LS_LAST_EMAIL, email);
            try { localStorage.setItem('fredi_user_id', data.user_id); } catch (e) {}
            _toast('Аккаунт создан ✓', 'success');
            _closeModal();
            // Перечитаем серверную сессию и перезагрузим экран под новым user_id.
            if (typeof window.refreshAuth === 'function') await window.refreshAuth();
            _reloadApp();
        } catch (e) {
            _setErr('faErrEmail', 'Нет связи с сервером. Попробуйте позже.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Создать аккаунт'; }
        }
    }

    async function _doLogin(email, password, remember) {
        var btn = document.getElementById('faSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Входим...'; }
        try {
            var res = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password, remember: remember })
            });
            var data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                _handleAuthError(data, 'login');
                return;
            }
            _safeSet(LS_LAST_EMAIL, email);
            try { localStorage.setItem('fredi_user_id', data.user_id); } catch (e) {}
            _toast('Добро пожаловать, ' + (data.name || email) + '!', 'success');
            _closeModal();

            if (data.has_anon_data && data.anon_user_id) {
                _askMergeAnon(data.anon_user_id);
            } else {
                if (typeof window.refreshAuth === 'function') await window.refreshAuth();
                _reloadApp();
            }
        } catch (e) {
            _setErr('faErrEmail', 'Нет связи с сервером. Попробуйте позже.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Войти'; }
        }
    }

    function _handleAuthError(data, mode) {
        var err = (data && data.detail && data.detail.error) || (data && data.error) || '';
        var msg = (data && data.detail && data.detail.message) || '';
        if (err === 'email_exists') {
            _setErr('faErrEmail', 'Email уже зарегистрирован. Попробуйте войти.');
        } else if (err === 'invalid_email') {
            _setErr('faErrEmail', msg || 'Неверный формат email');
        } else if (err === 'weak_password') {
            _setErr('faErrPass', msg || 'Пин-код — ровно 4 цифры');
        } else if (err === 'invalid_credentials') {
            _setErr('faErrPass', 'Неверный email или пин-код');
        } else if (err === 'rate_limited' || (data && data.detail && /rate/i.test(String(data.detail)))) {
            _setErr('faErrEmail', 'Слишком много попыток. Подождите минуту.');
        } else {
            _setErr('faErrEmail', msg || 'Что-то пошло не так. Попробуйте ещё раз.');
        }
    }

    function _askMergeAnon(anonUid) {
        var ok = window.confirm('На этом устройстве сохранены анонимные данные. Объединить их с вашим аккаунтом?');
        if (!ok) {
            if (typeof window.refreshAuth === 'function') window.refreshAuth().then(_reloadApp);
            else _reloadApp();
            return;
        }
        fetch(API_BASE + '/api/auth/merge-anon', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anon_user_id: anonUid })
        }).then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (d) {
              _toast('Данные объединены (' + (d.merged || 0) + ' записей)', 'success');
              if (typeof window.refreshAuth === 'function') return window.refreshAuth();
          })
          .catch(function () {})
          .finally(_reloadApp);
    }

    function _reloadApp() {
        // Пытаемся мягко перерисовать экран приложения; если функции нет — полный reload.
        try {
            if (typeof window.renderDashboard === 'function') {
                window.renderDashboard();
                return;
            }
        } catch (e) {}
        window.location.reload();
    }

    function _open(mode) {
        _injectStyles();
        _closeModal();
        var wrap = document.createElement('div');
        wrap.innerHTML = _buildHtml(mode);
        document.body.appendChild(wrap.firstChild);

        document.getElementById('faClose').addEventListener('click', _closeModal);
        document.getElementById('faSkip').addEventListener('click', _closeModal);
        var forgotBtn = document.getElementById('faForgot');
        if (forgotBtn) forgotBtn.addEventListener('click', function () {
            var prefill = (document.getElementById('faEmail') && document.getElementById('faEmail').value) || '';
            _openForgot(prefill);
        });
        document.getElementById('faAuthModal').addEventListener('click', function (e) {
            if (e.target.id === 'faAuthModal') _closeModal();
        });
        document.querySelectorAll('.fa-tab').forEach(function (t) {
            t.addEventListener('click', function () { _open(t.dataset.tab); });
        });
        var form = document.getElementById('faAuthModal');
        form.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submit(mode); }
            if (e.key === 'Escape') { e.preventDefault(); _closeModal(); }
        });
        document.getElementById('faSubmit').addEventListener('click', function () { _submit(mode); });

        // Курсор — туда, где пусто
        setTimeout(function () {
            var email = document.getElementById('faEmail');
            var pass = document.getElementById('faPass');
            var name = document.getElementById('faName');
            if (name && !name.value) name.focus();
            else if (email && !email.value) email.focus();
            else if (pass) pass.focus();
        }, 50);
    }

    async function _logout() {
        try {
            await fetch(API_BASE + '/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {}
        try { window.IS_AUTHENTICATED = false; } catch (e) {}
        try { window.CURRENT_USER_EMAIL = ''; } catch (e) {}
        try { window.CURRENT_USER_NAME = ''; } catch (e) {}
        _toast('Вы вышли из аккаунта', 'info');
        _reloadApp();
    }

    // ===== Забыли пин-код =====

    function _openForgot(prefillEmail) {
        _injectStyles();
        _closeModal();
        var lastEmail = (prefillEmail || _safeGet(LS_LAST_EMAIL) || '').replace(/"/g, '&quot;');
        var html = '' +
            '<div class="fa-modal-overlay" id="faAuthModal">' +
              '<div class="fa-modal"><div class="fa-modal-inner">' +
                '<button class="fa-close" id="faClose" aria-label="Закрыть">\u2715</button>' +
                '<div class="fa-title">Забыли пин-код?</div>' +
                '<div class="fa-subtitle">Укажите email, который вы использовали при регистрации. Мы пришлём ссылку для установки нового пин-кода.</div>' +
                '<div class="fa-field"><label class="fa-label" for="faEmail">Email</label>' +
                  '<input id="faEmail" class="fa-input" type="email" autocomplete="email" value="' + lastEmail + '" maxlength="254" />' +
                  '<div class="fa-err" id="faErrEmail"></div>' +
                '</div>' +
                '<div class="fa-actions">' +
                  '<button class="fa-btn fa-btn-primary" id="faForgotSubmit">Отправить ссылку</button>' +
                  '<button class="fa-btn fa-btn-ghost" id="faForgotBack">Назад ко входу</button>' +
                '</div>' +
                '<div class="fa-info">Если email зарегистрирован, на него придёт письмо с ссылкой. Ссылка действует 1 час.</div>' +
              '</div></div>' +
            '</div>';
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstChild);

        document.getElementById('faClose').addEventListener('click', _closeModal);
        document.getElementById('faForgotBack').addEventListener('click', function () { _open('login'); });
        document.getElementById('faAuthModal').addEventListener('click', function (e) {
            if (e.target.id === 'faAuthModal') _closeModal();
        });
        document.getElementById('faAuthModal').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _doForgot(); }
            if (e.key === 'Escape') { e.preventDefault(); _closeModal(); }
        });
        document.getElementById('faForgotSubmit').addEventListener('click', _doForgot);
        setTimeout(function () {
            var em = document.getElementById('faEmail');
            if (em) em.focus();
        }, 50);
    }

    async function _doForgot() {
        _setErr('faErrEmail', '');
        var email = (document.getElementById('faEmail').value || '').trim();
        if (!_isEmail(email)) { _setErr('faErrEmail', 'Неверный формат email'); return; }
        var btn = document.getElementById('faForgotSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }
        try {
            var res = await fetch(API_BASE + '/api/auth/forgot-pin', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            // Сервер всегда отвечает 200, чтобы не палить наличие email.
            // Если 429 — слишком частые запросы.
            if (res.status === 429) {
                _setErr('faErrEmail', 'Слишком много запросов. Попробуйте через час.');
                return;
            }
            _safeSet(LS_LAST_EMAIL, email);
            _toast('Если email зарегистрирован, на него отправлена ссылка ✓', 'success');
            _closeModal();
        } catch (e) {
            _setErr('faErrEmail', 'Нет связи с сервером. Попробуйте позже.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Отправить ссылку'; }
        }
    }

    // ===== Установка нового пин-кода по ссылке =====

    function _openReset(token) {
        _injectStyles();
        _closeModal();
        var html = '' +
            '<div class="fa-modal-overlay" id="faAuthModal">' +
              '<div class="fa-modal"><div class="fa-modal-inner">' +
                '<button class="fa-close" id="faClose" aria-label="Закрыть">\u2715</button>' +
                '<div class="fa-title">Новый пин-код</div>' +
                '<div class="fa-subtitle">Придумайте новый пин-код из 4 цифр. После сохранения вы будете автоматически разлогинены на всех устройствах.</div>' +
                '<div class="fa-field"><label class="fa-label" for="faNewPin">Новый пин-код</label>' +
                  '<input id="faNewPin" class="fa-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" />' +
                  '<div class="fa-err" id="faErrNewPin"></div>' +
                '</div>' +
                '<div class="fa-field"><label class="fa-label" for="faNewPin2">Повторите пин-код</label>' +
                  '<input id="faNewPin2" class="fa-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" />' +
                  '<div class="fa-err" id="faErrNewPin2"></div>' +
                '</div>' +
                '<div class="fa-actions">' +
                  '<button class="fa-btn fa-btn-primary" id="faResetSubmit">Сохранить пин-код</button>' +
                  '<button class="fa-btn fa-btn-ghost" id="faResetSkip">Отмена</button>' +
                '</div>' +
              '</div></div>' +
            '</div>';
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstChild);

        document.getElementById('faClose').addEventListener('click', _closeReset);
        document.getElementById('faResetSkip').addEventListener('click', _closeReset);
        document.getElementById('faAuthModal').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _doReset(token); }
            if (e.key === 'Escape') { e.preventDefault(); _closeReset(); }
        });
        document.getElementById('faResetSubmit').addEventListener('click', function () { _doReset(token); });
        setTimeout(function () {
            var p = document.getElementById('faNewPin');
            if (p) p.focus();
        }, 50);
    }

    function _closeReset() {
        _closeModal();
        // Чистим query-параметр ?reset_pin=... чтобы при перезагрузке модалка не открывалась снова.
        try {
            var url = new URL(window.location.href);
            if (url.searchParams.has('reset_pin')) {
                url.searchParams.delete('reset_pin');
                window.history.replaceState({}, '', url.toString());
            }
        } catch (e) {}
    }

    async function _doReset(token) {
        _setErr('faErrNewPin', '');
        _setErr('faErrNewPin2', '');
        var p1 = document.getElementById('faNewPin').value || '';
        var p2 = document.getElementById('faNewPin2').value || '';
        if (!/^\d{4}$/.test(p1)) { _setErr('faErrNewPin', 'Пин-код — 4 цифры'); return; }
        if (p1 !== p2) { _setErr('faErrNewPin2', 'Пин-коды не совпадают'); return; }

        var btn = document.getElementById('faResetSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Сохраняем...'; }
        try {
            var res = await fetch(API_BASE + '/api/auth/reset-pin', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, new_pin: p1 })
            });
            var data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                var err = (data && data.detail && data.detail.error) || '';
                var msg = (data && data.detail && data.detail.message) || '';
                if (err === 'expired_token' || err === 'invalid_token' || err === 'used_token') {
                    _setErr('faErrNewPin', msg || 'Ссылка недействительна или истекла. Запросите новую.');
                } else if (err === 'weak_password') {
                    _setErr('faErrNewPin', msg || 'Пин-код — 4 цифры');
                } else {
                    _setErr('faErrNewPin', msg || 'Не удалось сохранить пин-код');
                }
                return;
            }
            _toast('Пин-код обновлён ✓ Войдите с новым пин-кодом.', 'success');
            _closeReset();
            setTimeout(function () { _open('login'); }, 300);
        } catch (e) {
            _setErr('faErrNewPin', 'Нет связи с сервером. Попробуйте позже.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Сохранить пин-код'; }
        }
    }

    // Авто-открытие модалки сброса, если пришли по ссылке ?reset_pin=...
    function _checkResetParam() {
        try {
            var params = new URLSearchParams(window.location.search);
            var token = params.get('reset_pin');
            if (token && token.length >= 10) {
                // Дожидаемся загрузки DOM, потом показываем модалку.
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function () { _openReset(token); });
                } else {
                    setTimeout(function () { _openReset(token); }, 100);
                }
            }
        } catch (e) {}
    }
    _checkResetParam();

    window.FrediAuth = {
        openLogin: function () { _open('login'); },
        openRegister: function () { _open('register'); },
        openForgot: function () { _openForgot(); },
        openReset: function (token) { _openReset(token); },
        logout: _logout,
        isAuthed: function () { return !!window.IS_AUTHENTICATED; }
    };

    console.log('✅ login.js loaded (FrediAuth ready)');
})();
