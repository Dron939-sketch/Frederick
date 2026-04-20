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
            '.fa-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)}',
            '.fa-modal{background:var(--bg-secondary,#171717);border:1px solid rgba(224,224,224,0.1);border-radius:18px;max-width:420px;width:100%;padding:24px;color:var(--text-primary,#e0e0e0);box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto}',
            '.fa-title{font-size:18px;font-weight:700;margin-bottom:4px}',
            '.fa-subtitle{font-size:12px;color:var(--text-secondary,#888);margin-bottom:18px}',
            '.fa-tabs{display:flex;gap:8px;margin-bottom:18px;background:rgba(224,224,224,0.04);border-radius:10px;padding:4px}',
            '.fa-tab{flex:1;text-align:center;padding:8px;font-size:13px;font-weight:500;cursor:pointer;border-radius:8px;color:var(--text-secondary,#888);transition:background 0.15s,color 0.15s;-webkit-tap-highlight-color:transparent}',
            '.fa-tab.active{background:rgba(224,224,224,0.1);color:var(--text-primary,#e0e0e0)}',
            '.fa-field{margin-bottom:12px}',
            '.fa-label{display:block;font-size:11px;color:var(--text-secondary,#888);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px}',
            '.fa-input{width:100%;box-sizing:border-box;padding:10px 12px;background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);border-radius:10px;color:var(--text-primary,#e0e0e0);font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s}',
            '.fa-input:focus{border-color:rgba(224,224,224,0.3)}',
            '.fa-input.err{border-color:rgba(255,100,100,0.6)}',
            '.fa-err{font-size:11px;color:rgba(255,120,120,0.95);margin-top:4px;min-height:14px}',
            '.fa-check{display:flex;align-items:center;gap:8px;margin:12px 0 18px;font-size:13px;color:var(--text-secondary,#aaa);cursor:pointer;user-select:none}',
            '.fa-check input{width:16px;height:16px;accent-color:var(--chrome,#888);cursor:pointer}',
            '.fa-actions{display:flex;flex-direction:column;gap:8px}',
            '.fa-btn{padding:12px;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid transparent;transition:background 0.15s,opacity 0.15s;-webkit-tap-highlight-color:transparent}',
            '.fa-btn-primary{background:linear-gradient(135deg,#d4d4d4,#a8a8a8);color:#0a0a0a}',
            '.fa-btn-primary:hover{opacity:0.9}',
            '.fa-btn-primary:disabled{opacity:0.5;cursor:wait}',
            '.fa-btn-ghost{background:transparent;color:var(--text-secondary,#888);font-size:12px;padding:6px}',
            '.fa-btn-ghost:hover{color:var(--text-primary,#e0e0e0)}',
            '.fa-close{position:absolute;top:10px;right:10px;background:none;border:none;color:var(--text-secondary,#888);font-size:18px;cursor:pointer;padding:6px 10px;border-radius:8px}',
            '.fa-close:hover{background:rgba(224,224,224,0.06);color:#fff}',
            '.fa-modal-inner{position:relative}',
            '.fa-info{font-size:11px;color:var(--text-secondary,#888);text-align:center;margin-top:10px;line-height:1.45}'
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

    window.FrediAuth = {
        openLogin: function () { _open('login'); },
        openRegister: function () { _open('register'); },
        logout: _logout,
        isAuthed: function () { return !!window.IS_AUTHENTICATED; }
    };

    console.log('✅ login.js loaded (FrediAuth ready)');
})();
