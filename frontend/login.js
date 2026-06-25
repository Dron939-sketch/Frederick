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

    var API_BASE = window.API_BASE_URL || (window.CONFIG && window.CONFIG.API_BASE_URL) || 'https://ffred-ddd989.amvera.io';
    var LS_LAST_EMAIL = 'fredi_last_email';

    function _safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function _safeSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
    function _toast(msg, t) { if (window.showToast) window.showToast(msg, t || 'info'); }
    function _track(ev, data) {
        try { if (window.FrediTracker && window.FrediTracker.track) window.FrediTracker.track(ev, data || {}); } catch (e) {}
    }

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
        // Если автопоказ при входе закрылся без авторизации — запоминаем
        // и в sessionStorage (не докучаем в этой же сессии), и в localStorage
        // на 24 часа (не докучаем при каждом новом визите). По аналитике
        // юзер с visits=14 получал auth_modal_auto_shown 12 раз подряд —
        // это убивает retention и взвинчивает auth_modal_opened без конверсии.
        if (_lastSource === 'app_start' && !window.IS_AUTHENTICATED) {
            try { sessionStorage.setItem('fredi_auth_skipped', '1'); } catch (e) {}
            try { localStorage.setItem('fredi_auth_dismissed_at', String(Date.now())); } catch (e) {}
        }
    }

    // fetch с таймаутом — критично для mandatory-модалки. Если сервер
    // на Render заснул и регистрация висит >15с, юзер заперт без X
    // и без Escape. Таймаут даёт ему хотя бы понятную ошибку и кнопку
    // «Попробовать ещё раз». Сигнализатор: ошибка с .name === 'AbortError'.
    async function _fetchWithTimeout(url, opts, timeoutMs) {
        timeoutMs = timeoutMs || 15000;
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, timeoutMs);
        try {
            opts = opts || {};
            if (ctrl) opts.signal = ctrl.signal;
            return await fetch(url, opts);
        } finally {
            clearTimeout(timer);
        }
    }

    function _isTimeoutErr(e) {
        if (!e) return false;
        return e.name === 'AbortError' || /aborted|timeout/i.test(String(e.message || ''));
    }

    function _buildHtml(mode) {
        var lastEmail = _safeGet(LS_LAST_EMAIL) || '';
        var isRegister = (mode === 'register');
        var fromAppStart = (_lastSource === 'app_start');

        // Возвращающийся anon: в localStorage есть fredi_user_id и есть
        // признаки активности (хоть какие-то локальные данные — например,
        // результат теста). Им показываем другую копию: акцент на «не
        // потерять накопленное», а не на «начать пользоваться».
        var hasAnonData = (function () {
            try {
                if (!localStorage.getItem('fredi_user_id')) return false;
                var keys = Object.keys(localStorage);
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    // Маркеры активности: тест, навыки, дневник, рефлексии.
                    if (k.indexOf('test_results_') === 0) return true;
                    if (k.indexOf('trainer_skill_') === 0) return true;
                    if (k.indexOf('dt_reflections_') === 0) return true;
                    if (k.indexOf('sc_plan_') === 0) return true;
                }
                return false;
            } catch (e) { return false; }
        })();

        var title = isRegister
            ? (hasAnonData ? 'Сохраните прогресс' : 'Добро пожаловать')
            : 'Вход';
        // Сабтайтл подстраиваем под контекст: при автопоказе на старте
        // и наличии данных — акцент на «не потерять». Просто новичкам —
        // объяснение «зачем». В обычных вызовах из settings — короче.
        var subtitle;
        if (isRegister) {
            if (fromAppStart && hasAnonData) {
                subtitle = 'У вас уже есть данные на этом устройстве — давайте привяжем их к аккаунту, чтобы они не терялись и были доступны с любого устройства. Email + 4-значный пин-код.';
            } else if (fromAppStart) {
                subtitle = 'Чтобы прогресс, тесты и переписка с Фреди не терялись и были доступны с любого устройства. Email + 4-значный пин-код — больше ничего не нужно.';
            } else {
                subtitle = 'Email станет вашим логином. Придумайте пин-код из 4 цифр.';
            }
        } else {
            subtitle = 'Войдите, чтобы работать с Фреди с любого устройства.';
        }

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
        // На app_start модалка обязательная — без X-крестика, без overlay-
        // close, без Escape, без «Пропустить». Из settings/иначе X
        // отображается как обычно.
        var isMandatory = fromAppStart;
        var closeBtnHtml = isMandatory
            ? ''
            : '<button class="fa-close" id="faClose" aria-label="Закрыть">✕</button>';

        return '' +
            '<div class="fa-modal-overlay" id="faAuthModal" data-mandatory="' + (isMandatory ? '1' : '0') + '">' +
              '<div class="fa-modal"><div class="fa-modal-inner">' +
                closeBtnHtml +
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
                '<div class="fa-field"><label class="fa-label" for="faPass">' +
                  (isRegister ? 'Пин-код (4 цифры)' : 'Пин-код') +
                '</label>' +
                  // На вкладке Вход НЕ ограничиваем длину пина: legacy-юзеры
                  // зарегистрировались с 8-значным пином до смены правила.
                  // Backend принимает password длиной 1-72 и argon2.verify
                  // проверяет хеш любой длины корректно. На вкладке Регистрация
                  // и при сбросе — оставляем строгое 4-значное правило.
                  '<input id="faPass" class="fa-input" type="password"' +
                    ' autocomplete="' + (isRegister ? 'new-password' : 'current-password') + '"' +
                    ' inputmode="numeric"' +
                    (isRegister ? ' pattern="[0-9]{4}" maxlength="4"' : ' maxlength="20"') +
                  ' />' +
                  '<div class="fa-err" id="faErrPass"></div>' +
                '</div>' +
                passCheckField +
                '<label class="fa-check"><input id="faRemember" type="checkbox" checked>Запомнить меня на этом устройстве</label>' +
                (isRegister
                  ? '<label class="fa-check"><input id="faOptIn" type="checkbox" checked>Согласен(на) получать редкие сообщения от Фреди (≤ 1 в неделю, отписаться — 1 клик)</label>'
                  : '') +
                '<div class="fa-actions">' +
                  '<button class="fa-btn fa-btn-primary" id="faSubmit">' + primaryLabel + '</button>' +
                  (isRegister
                    ? ''
                    : '<button class="fa-btn fa-btn-ghost" id="faForgot">Забыли пин-код?</button>') +
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
        var errs = [];
        if (!_isEmail(email)) { _setErr('faErrEmail', 'Неверный формат email'); ok = false; errs.push('email'); }
        if (mode === 'register') {
            if (!/^\d{4}$/.test(password)) { _setErr('faErrPass', 'Пин-код — 4 цифры'); ok = false; errs.push('pass_format'); }
        } else {
            if (!password) { _setErr('faErrPass', 'Введите пин-код'); ok = false; errs.push('pass_empty'); }
        }

        if (mode === 'register') {
            var name = (document.getElementById('faName').value || '').trim();
            var pass2 = document.getElementById('faPass2').value || '';
            if (!name) { _setErr('faErrName', 'Введите имя'); ok = false; errs.push('name'); }
            if (pass2 !== password) { _setErr('faErrPass2', 'Пин-коды не совпадают'); ok = false; errs.push('pass2_mismatch'); }
            if (!ok) {
                _track('auth_validation_error', { mode: mode, source: _lastSource, fields: errs.join(',') });
                return;
            }

            // Чекбокс opt-in: если элемента нет (старая разметка) —
            // считаем true (мягкий дефолт, как в БД).
            var optInEl = document.getElementById('faOptIn');
            var optIn = optInEl ? !!optInEl.checked : true;
            _track('auth_register_started', { source: _lastSource, opt_in: optIn });
            await _doRegister(name, email, password, remember, optIn);
        } else {
            if (!ok) {
                _track('auth_validation_error', { mode: mode, source: _lastSource, fields: errs.join(',') });
                return;
            }
            _track('auth_login_started', { source: _lastSource });
            await _doLogin(email, password, remember);
        }
    }

    async function _doRegister(name, email, password, remember, optIn) {
        var btn = document.getElementById('faSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Создаём...'; }
        // Захватываем anon user_id ДО перезаписи. Возвращающийся anon
        // имел data, привязанные к этому id — после register их нужно
        // смержить на новый authed-id, иначе тест/дневник/диалоги
        // «потеряются» на сервере (orphan-записи). Раньше merge был
        // только в _doLogin, на register — нет.
        var anonUidBefore = (function () {
            try {
                var v = localStorage.getItem('fredi_user_id');
                return v ? Number(v) : null;
            } catch (e) { return null; }
        })();
        try {
            var res = await _fetchWithTimeout(API_BASE + '/api/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name, email: email, password: password,
                    remember: remember, email_opted_in: optIn !== false
                })
            }, 15000);
            var data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                _track('auth_register_failed', {
                    source: _lastSource,
                    reason: (data && data.detail && data.detail.error) || (data && data.error) || 'unknown',
                    status: res.status
                });
                _handleAuthError(data, 'register', res.status);
                return;
            }
            _safeSet(LS_LAST_EMAIL, email);
            var newUid = Number(data.user_id);
            // had_anon считаем ДО перезаписи — в существующей версии было
            // обратное (читали уже после localStorage.setItem), что давало
            // had_anon=true всегда. Теперь видим реальное соотношение.
            var hadAnon = !!(anonUidBefore && anonUidBefore !== newUid);
            try { localStorage.setItem('fredi_user_id', String(newUid)); } catch (e) {}
            try { localStorage.removeItem('fredi_auth_dismissed_at'); } catch (e) {}
            _track('register_success', { had_anon: hadAnon, source: _lastSource });
            // Welcome voice: первый раз после регистрации играем
            // голосовое приветствие Фреди через 3 сек после reload.
            // Триггер срабатывает ОДИН раз — флаг played в app.js.
            try { localStorage.setItem('fredi_welcome_pending', '1'); } catch (e) {}
            _toast('Аккаунт создан ✓', 'success');

            // Если был возвращающийся anon — мержим его данные на новый
            // authed-id. Confirm-диалог (как в _askMergeAnon при login)
            // здесь не нужен: юзер только что сам нажал «Создать аккаунт»,
            // намерение однозначное. Лишний шаг = friction, отвалятся
            // чувствительные к простоте флоу.
            if (hadAnon) {
                try {
                    var mr = await fetch(API_BASE + '/api/auth/merge-anon', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ anon_user_id: anonUidBefore })
                    });
                    var md = null;
                    try { md = await mr.json(); } catch (e) {}
                    _track('register_anon_merged', {
                        success: !!(md && (md.success || md.merged !== undefined)),
                        merged_records: (md && md.merged) || 0,
                        anon_uid: anonUidBefore
                    });
                    if (md && md.merged) {
                        _toast('Объединили ' + md.merged + ' записей с устройства', 'info');
                    }
                } catch (e) {
                    _track('register_anon_merge_failed', { anon_uid: anonUidBefore });
                }
            }

            _closeModal();
            // Перечитаем серверную сессию и перезагрузим экран под новым user_id.
            if (typeof window.refreshAuth === 'function') await window.refreshAuth();
            _reloadApp();
        } catch (e) {
            var isTimeout = _isTimeoutErr(e);
            _track('auth_register_failed', {
                source: _lastSource,
                reason: isTimeout ? 'timeout' : 'network',
                status: 0
            });
            _setErr('faErrEmail', isTimeout
                ? 'Сервер не отвечает. Это бывает на первом старте — попробуйте ещё раз.'
                : 'Нет связи с сервером. Попробуйте ещё раз.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Создать аккаунт';
            }
        }
    }

    async function _doLogin(email, password, remember) {
        var btn = document.getElementById('faSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Входим...'; }
        try {
            var res = await _fetchWithTimeout(API_BASE + '/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password, remember: remember })
            }, 15000);
            var data = null;
            try { data = await res.json(); } catch (e) {}
            if (!res.ok) {
                _handleAuthError(data, 'login', res.status);
                return;
            }
            _safeSet(LS_LAST_EMAIL, email);
            try { localStorage.setItem('fredi_user_id', data.user_id); } catch (e) {}
            try { localStorage.removeItem('fredi_auth_dismissed_at'); } catch (e) {}
            _track('login_success', { remember: !!remember, has_anon_data: !!data.has_anon_data });
            _toast('Добро пожаловать, ' + (data.name || email) + '!', 'success');
            _closeModal();

            if (data.has_anon_data && data.anon_user_id) {
                _askMergeAnon(data.anon_user_id);
            } else {
                if (typeof window.refreshAuth === 'function') await window.refreshAuth();
                _reloadApp();
            }
        } catch (e) {
            var isTimeout = _isTimeoutErr(e);
            _track('auth_login_failed', { reason: isTimeout ? 'timeout' : 'network' });
            _setErr('faErrEmail', isTimeout
                ? 'Сервер не отвечает. Это бывает на первом старте — попробуйте ещё раз.'
                : 'Нет связи с сервером. Попробуйте ещё раз.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Войти'; }
        }
    }

    function _handleAuthError(data, mode, status) {
        // detail у FastAPI — это либо dict (наши кастомные ошибки),
        // либо строка (slowapi отдаёт "Rate limit exceeded: ..."),
        // либо null (если ответ совсем без body). Защищаемся от всех.
        var detail = data && data.detail;
        var err = (detail && typeof detail === 'object' && detail.error)
            || (data && data.error) || '';
        var msg = (detail && typeof detail === 'object' && detail.message) || '';

        // Rate-limit — всегда HTTP 429. Ловим по статусу: это надёжнее,
        // чем парсить строку detail. Раньше юзер видел «Что-то пошло
        // не так» вместо понятного «подождите минуту».
        if (status === 429 || err === 'rate_limited') {
            _setErr('faErrEmail', 'Слишком много попыток. Подождите минуту и попробуйте снова.');
            return;
        }
        if (err === 'email_exists') {
            _setErr('faErrEmail', 'Email уже зарегистрирован. Переключитесь на вкладку «Вход».');
            return;
        }
        if (err === 'invalid_email') {
            _setErr('faErrEmail', msg || 'Неверный формат email');
            return;
        }
        if (err === 'weak_password') {
            _setErr('faErrPass', msg || 'Пин-код — ровно 4 цифры');
            return;
        }
        if (err === 'invalid_credentials') {
            _setErr('faErrPass', 'Неверный email или пин-код');
            return;
        }
        if (status >= 500) {
            _setErr('faErrEmail', 'Сервер сейчас недоступен. Попробуйте через минуту.');
            return;
        }
        _setErr('faErrEmail', msg || 'Что-то пошло не так. Попробуйте ещё раз.');
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

    // Источник последнего открытия модалки. Прокидывается во ВСЕ
    // вороночные события, чтобы видеть, откуда пришёл юзер
    // (test_complete / settings / dashboard / иначе).
    var _lastSource = null;

    function _open(mode, opts) {
        opts = opts || {};
        if (opts.source) _lastSource = opts.source;
        _injectStyles();
        _closeModal();
        var wrap = document.createElement('div');
        wrap.innerHTML = _buildHtml(mode);
        document.body.appendChild(wrap.firstChild);

        var isMandatory = (_lastSource === 'app_start');

        // Кнопка X и Skip существуют только в опциональном режиме.
        var faCloseBtn = document.getElementById('faClose');
        if (faCloseBtn) {
            faCloseBtn.addEventListener('click', function () {
                _track('auth_modal_closed', { mode: mode, source: _lastSource, reason: 'close_btn' });
                _closeModal();
            });
        }

        var forgotBtn = document.getElementById('faForgot');
        if (forgotBtn) forgotBtn.addEventListener('click', function () {
            var prefill = (document.getElementById('faEmail') && document.getElementById('faEmail').value) || '';
            _openForgot(prefill);
        });

        // Overlay-click и Escape закрывают модалку только в опциональном
        // режиме. Mandatory (app_start) — без выхода до успешной авторизации
        // или регистрации. Реальный «выход» = закрыть вкладку браузера.
        document.getElementById('faAuthModal').addEventListener('click', function (e) {
            if (e.target.id !== 'faAuthModal') return;
            if (isMandatory) return;
            _track('auth_modal_closed', { mode: mode, source: _lastSource, reason: 'overlay' });
            _closeModal();
        });
        document.querySelectorAll('.fa-tab').forEach(function (t) {
            t.addEventListener('click', function () {
                _track('auth_modal_tab_switched', {
                    from: mode, to: t.dataset.tab, source: _lastSource
                });
                _open(t.dataset.tab, { source: _lastSource });
            });
        });
        var form = document.getElementById('faAuthModal');
        form.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submit(mode); }
            if (e.key === 'Escape') {
                if (isMandatory) { e.preventDefault(); return; }
                _track('auth_modal_closed', { mode: mode, source: _lastSource, reason: 'escape' });
                e.preventDefault();
                _closeModal();
            }
        });
        document.getElementById('faSubmit').addEventListener('click', function () { _submit(mode); });

        // Префилл для регистрации после теста: имя из контекста теста,
        // email — если уже сохранён в localStorage (LS_LAST_EMAIL).
        if (mode === 'register' && opts.prefillName) {
            var nameInput = document.getElementById('faName');
            if (nameInput) nameInput.value = String(opts.prefillName).slice(0, 100);
        }
        if (opts.prefillEmail) {
            var emailInput = document.getElementById('faEmail');
            if (emailInput && !emailInput.value) emailInput.value = String(opts.prefillEmail).slice(0, 254);
        }

        // Курсор — туда, где пусто
        setTimeout(function () {
            var email = document.getElementById('faEmail');
            var pass = document.getElementById('faPass');
            var name = document.getElementById('faName');
            if (name && !name.value) name.focus();
            else if (email && !email.value) email.focus();
            else if (pass) pass.focus();
        }, 50);

        _track('auth_modal_opened', {
            mode: mode,
            source: _lastSource,
            prefilled_name: !!(opts.prefillName),
            prefilled_email: !!(opts.prefillEmail)
        });
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

        // В forgot-модалке кнопки #faClose нет (закрытие — через
        // «Назад ко входу», клик по оверлею или Escape). Защищаемся
        // от null на случай, если в будущем шаблон поменяется.
        var faClose = document.getElementById('faClose');
        if (faClose) faClose.addEventListener('click', _closeModal);
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
            _track('forgot_pin_requested', {});
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

        // В reset-pin модалке кнопки #faClose нет (закрытие — через
        // «Отмена», Escape или _closeReset). Без null-check это
        // ломало весь forgot-pin flow — юзер не мог сохранить новый пин.
        var faCloseR = document.getElementById('faClose');
        if (faCloseR) faCloseR.addEventListener('click', _closeReset);
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
            _track('pin_reset_success', {});
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
        // openLogin/openRegister теперь принимают opts: { prefillName,
        // prefillEmail, source }. Старые вызовы без аргументов работают
        // как раньше — opts получает {} и трекинг просто пишет source=null.
        openLogin: function (opts) { _open('login', opts || {}); },
        openRegister: function (opts) { _open('register', opts || {}); },
        openForgot: function () { _openForgot(); },
        openReset: function (token) { _openReset(token); },
        logout: _logout,
        isAuthed: function () { return !!window.IS_AUTHENTICATED; }
    };

    // Авто-показ при входе. Раньше регистрация была размазана: post-test
    // CTA, ссылка в settings, ничего на дашборде. Теперь — единая точка:
    // при первом заходе в сессию anon-юзеру показываем модалку (по дефолту
    // вкладка «Регистрация», переключаемая на «Вход»).
    //
    // НЕ показываем если:
    //   - уже авторизован (IS_AUTHENTICATED после authReady = true)
    //   - в этой сессии уже скипнул (sessionStorage.fredi_auth_skipped)
    //   - в URL есть reset_token (откроет _checkResetParam)
    // Reengagement return handler: если юзер пришёл по ссылке из
    // win-back сообщения (?ref=reeng&cid=<token>), пишем событие
    // в трекер, чтобы посчитать конверсию «отправлено → клик → сессия».
    // Просто событие, без UI-эффектов — UX дальше обычный.
    (function () {
        try {
            var p = new URLSearchParams(window.location.search);
            if (p.get('ref') === 'reeng') {
                _track('reengagement_return_open', {
                    cid: (p.get('cid') || '').slice(0, 32),
                    campaign: 'd3_first'
                });
                // Чистим query, чтобы reload не дублировал событие.
                try {
                    var clean = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, '', clean);
                } catch (e) {}
            }
        } catch (e) {}
    })();

    function _incrementVisit() {
        // Инкрементируем счётчик визитов. Новый визит = прошло >30 мин с прошлого.
        try {
            var now = Date.now();
            var lastAt = parseInt(localStorage.getItem('fredi_last_visit_at') || '0', 10);
            var visits = parseInt(localStorage.getItem('fredi_visits_count') || '0', 10);
            if (!lastAt || (now - lastAt) > 30 * 60 * 1000) {
                visits++;
                localStorage.setItem('fredi_visits_count', String(visits));
            }
            localStorage.setItem('fredi_last_visit_at', String(now));
            return visits;
        } catch (e) { return 1; }
    }

    function _showNamePrompt() {
        // Минимальная onboarding-модалка для 1-го визита: одно поле «Имя».
        // Можно пропустить — не блокируем юзера. Цель: снизить friction
        // с 90% bounce (см. аналитику auth_modal_auto_shown vs register_success).
        if (document.getElementById('fredi-name-prompt')) return;
        var overlay = document.createElement('div');
        overlay.id = 'fredi-name-prompt';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
        overlay.innerHTML = ''
            + '<div style="background:var(--surface,#1a1a1a);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px;max-width:380px;width:100%;text-align:center;font-family:inherit">'
            + '  <div style="font-size:36px;margin-bottom:6px">⭐</div>'
            + '  <div style="font-size:18px;font-weight:700;color:var(--text-primary,#fff);margin-bottom:8px">Привет, я Фреди.</div>'
            + '  <div style="font-size:13px;color:var(--text-secondary,rgba(255,255,255,0.6));line-height:1.5;margin-bottom:20px">Виртуальный психолог. Без обид и без памяти.<br>Как тебя называть?</div>'
            + '  <input id="fredi-name-input" type="text" maxlength="40" autocomplete="given-name" placeholder="Твоё имя" style="width:100%;padding:13px 15px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:var(--text-primary,#fff);font:15px inherit;box-sizing:border-box;outline:none;text-align:center;margin-bottom:14px">'
            + '  <button id="fredi-name-continue" style="display:block;width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#3b82ff,#6366f1);color:#fff;font:700 14px inherit;cursor:pointer;margin-bottom:8px">Продолжить →</button>'
            + '  <button id="fredi-name-skip" style="display:block;width:100%;padding:9px;border:none;border-radius:8px;background:transparent;color:var(--text-secondary,rgba(255,255,255,0.4));font:13px inherit;cursor:pointer">Пропустить</button>'
            + '</div>';
        document.body.appendChild(overlay);
        var input = document.getElementById('fredi-name-input');
        try { input.focus(); } catch (e) {}

        async function _saveAndClose(name) {
            var uid = (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID;
            var trimmed = (name || '').trim();
            if (trimmed && uid) {
                try {
                    var apiBase = (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io';
                    await fetch(apiBase + '/api/save-context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: uid, context: { name: trimmed } })
                    });
                    try { window.CONFIG.USER_NAME = trimmed; window.CURRENT_USER_NAME = trimmed; } catch (e) {}
                } catch (e) { console.warn('save name failed', e); }
            }
            try { sessionStorage.setItem('fredi_name_prompt_seen', '1'); } catch (e) {}
            _track('name_prompt_completed', { skipped: !trimmed });
            overlay.remove();
            // Перерисуем дашборд, если он уже на экране — чтобы подставилось имя в hero.
            if (typeof window.renderDashboard === 'function') {
                try { window.renderDashboard(); } catch (e) {}
            }
        }

        document.getElementById('fredi-name-continue').addEventListener('click', function () {
            _saveAndClose(input.value);
        });
        document.getElementById('fredi-name-skip').addEventListener('click', function () {
            _saveAndClose('');
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _saveAndClose(input.value); }
        });

        _track('name_prompt_shown', {});
    }

    function _maybeShowOnLoad() {
        if (window.IS_AUTHENTICATED) return;
        try {
            if (sessionStorage.getItem('fredi_auth_skipped') === '1') return;
        } catch (e) {}
        try {
            var p = new URLSearchParams(window.location.search);
            if (p.get('reset_token')) return;
        } catch (e) {}

        var hasUid = false;
        var hasData = false;
        try {
            hasUid = !!localStorage.getItem('fredi_user_id');
            var keys = Object.keys(localStorage);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (k.indexOf('test_results_') === 0
                    || k.indexOf('trainer_skill_') === 0
                    || k.indexOf('dt_reflections_') === 0
                    || k.indexOf('sc_plan_') === 0) { hasData = true; break; }
            }
        } catch (e) {}

        var visits = _incrementVisit();

        // 1-й визит — мягкий onboarding: спрашиваем только имя (или пропускаем).
        // Полноценную auth-модалку показываем только начиная со 2-го визита,
        // когда юзер уже немного знаком с Фреди и есть смысл сохранить прогресс.
        if (visits <= 1) {
            // Если в этой же сессии уже показывали (например ребут страницы) — не дёргаем повторно.
            try { if (sessionStorage.getItem('fredi_name_prompt_seen') === '1') return; } catch (e) {}
            _track('name_prompt_auto_shown', { visit: visits, user_kind: hasData ? 'returning_anon' : (hasUid ? 'returning_no_data' : 'fresh') });
            _showNamePrompt();
            return;
        }

        // 24-часовой snooze после dismiss. Если юзер недавно закрыл модал —
        // не показываем его снова при каждом следующем визите.
        try {
            var dismissedAt = parseInt(localStorage.getItem('fredi_auth_dismissed_at') || '0', 10);
            if (dismissedAt && (Date.now() - dismissedAt) < 24 * 60 * 60 * 1000) {
                _track('auth_modal_auto_skipped', {
                    reason: 'recent_dismiss',
                    hours_since: Math.round((Date.now() - dismissedAt) / 3600000),
                    visits: visits,
                    user_kind: hasData ? 'returning_anon' : (hasUid ? 'returning_no_data' : 'fresh')
                });
                return;
            }
        } catch (e) {}

        // Экспоненциальная каденция: показываем модал на визитах 2, 5, 10, 20, 40, 80…
        // Вместо «каждый визит начиная со 2-го». У того же анона мы можем
        // встретиться с просьбой о регистрации не 12 раз, а 3-4 за месяц.
        // Анонам без какой-либо активности (hasData=false) — каденцию ещё реже:
        // им продукт ещё не доказал ценность, мы не имеем права требовать аккаунт.
        var cadenceFull   = [2, 5, 10, 20, 40, 80, 160];
        var cadenceSilent = [5, 20, 80];
        var cadence = hasData ? cadenceFull : cadenceSilent;
        if (cadence.indexOf(visits) === -1) {
            _track('auth_modal_auto_skipped', {
                reason: 'off_cadence',
                visits: visits,
                user_kind: hasData ? 'returning_anon' : (hasUid ? 'returning_no_data' : 'fresh')
            });
            return;
        }

        _track('auth_modal_auto_shown', {
            source: 'app_start',
            user_kind: hasData ? 'returning_anon' : (hasUid ? 'returning_no_data' : 'fresh'),
            visits: visits
        });
        _open('register', { source: 'app_start' });
    }

    if (window.authReady && typeof window.authReady.then === 'function') {
        // Главный путь: ждём, пока auth.js сходит на /api/auth/me и
        // выставит IS_AUTHENTICATED. Только потом решаем — показывать
        // модалку или нет. Без этого ожидания мы открыли бы модалку
        // даже залогиненным юзерам.
        window.authReady.then(_maybeShowOnLoad).catch(function () { _maybeShowOnLoad(); });
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(_maybeShowOnLoad, 200);
        });
    } else {
        setTimeout(_maybeShowOnLoad, 200);
    }

    console.log('✅ login.js loaded (FrediAuth ready)');
})();
