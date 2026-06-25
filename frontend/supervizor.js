// supervizor.js — модуль «Супервизор»
// Гибрид: профессиональная супервизия (Hawkins-Shohet 7-eyed) + самосупервизия.
// Премиум-only. AI ведёт диалог: 4-5 уточняющих вопросов → развёрнутый разбор.
(function () {
  'use strict';

  // -------- утилиты --------
  function api() { return (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io'; }
  function uid() { return (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID || 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function toast(t, k) { if (typeof window.showToast === 'function') window.showToast(t, k || 'info'); }
  function track(ev, d) { try { if (window.FrediTracker) window.FrediTracker.track(ev, d || {}); } catch (e) {} }
  async function aiGenerate(prompt, opts) {
    opts = opts || {};
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 700, temperature: opts.temperature == null ? 0.55 : opts.temperature };
    try {
      if (typeof window.apiCall === 'function') return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
      var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { success: false };
      return await r.json();
    } catch (e) { return { success: false }; }
  }
  function clean(s) { return String(s || '').replace(/\|\|[^|]*\|\|/g, '').trim(); }

  // -------- состояние --------
  var ST = null;        // активный разбор
  var HISTORY = [];     // история разборов
  var CONTAINER = null;
  var VIEW = 'menu';    // menu | session | history | report

  function loadHistory() {
    try { HISTORY = JSON.parse(localStorage.getItem('supervizor_log') || '[]'); } catch (e) { HISTORY = []; }
  }
  function saveHistory() {
    try { localStorage.setItem('supervizor_log', JSON.stringify(HISTORY.slice(0, 50))); } catch (e) {}
  }

  // -------- премиум-гейт --------
  function isPremium() { return !!window.IS_PREMIUM; }
  async function ensurePremium() {
    if (typeof window.loadPremiumStatus === 'function' && !isPremium()) {
      try { await window.loadPremiumStatus(); } catch (e) {}
    }
    return isPremium();
  }

  // -------- стили --------
  function injectStyles() {
    if (document.getElementById('sv-styles')) return;
    var css = ''
      + '.sv-wrap{max-width:780px;margin:0 auto;padding:18px 16px 80px;font-family:inherit;color:var(--text,#e7e7e7)}'
      + '.sv-back{background:transparent;border:1px solid #2c2f36;color:#aab1bb;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;margin-bottom:14px}'
      + '.sv-h1{font-size:22px;font-weight:700;margin:8px 0 4px}'
      + '.sv-sub{font-size:13px;color:#9aa3ad;margin-bottom:18px;line-height:1.5}'
      + '.sv-card{background:#1a1d23;border:1px solid #2c2f36;border-radius:14px;padding:16px;margin-bottom:12px}'
      + '.sv-card-h{font-size:15px;font-weight:600;margin-bottom:6px;color:#e7e7e7}'
      + '.sv-card-d{font-size:13px;color:#9aa3ad;line-height:1.5}'
      + '.sv-btn{display:block;width:100%;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;border:0;padding:13px 14px;border-radius:11px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px}'
      + '.sv-btn:hover{filter:brightness(1.07)}'
      + '.sv-btn.ghost{background:transparent;border:1px solid #2c2f36;color:#cfd5dd;font-weight:500}'
      + '.sv-btn.warn{background:linear-gradient(135deg,#f59e0b,#ef4444)}'
      + '.sv-input,.sv-text{width:100%;background:#0f1116;border:1px solid #2c2f36;border-radius:10px;padding:11px 12px;color:#e7e7e7;font-size:14px;font-family:inherit;line-height:1.5;box-sizing:border-box}'
      + '.sv-text{min-height:110px;resize:vertical}'
      + '.sv-text:focus,.sv-input:focus{outline:0;border-color:#6366f1}'
      + '.sv-row{display:flex;gap:8px}'
      + '.sv-row .sv-btn{flex:1;margin-top:0}'
      + '.sv-mic{background:#6366f1;border:0;color:#fff;width:42px;height:42px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0}'
      + '.sv-mic.rec{background:#ef4444;animation:svPulse 1.2s infinite}'
      + '@keyframes svPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.55)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}'
      + '.sv-msg{margin:10px 0;padding:12px 14px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}'
      + '.sv-msg.fredi{background:#1f2127;border-left:3px solid #6366f1}'
      + '.sv-msg.user{background:#0f1116;border-left:3px solid #0ea5e9;color:#cfd5dd}'
      + '.sv-msg.sys{background:transparent;border:1px dashed #2c2f36;color:#8a93a0;font-size:12px;font-style:italic;text-align:center}'
      + '.sv-step{font-size:11px;color:#8a93a0;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px}'
      + '.sv-report{background:#13161c;border:1px solid #2c2f36;border-radius:14px;padding:18px;margin-top:14px;font-size:14px;line-height:1.65;color:#dde2e8;white-space:pre-wrap}'
      + '.sv-report b,.sv-report strong{color:#fff}'
      + '.sv-hist-item{background:#1a1d23;border:1px solid #2c2f36;border-radius:10px;padding:11px 13px;margin-bottom:8px;cursor:pointer}'
      + '.sv-hist-item:hover{border-color:#6366f1}'
      + '.sv-hist-h{font-weight:600;font-size:14px;color:#e7e7e7}'
      + '.sv-hist-d{font-size:12px;color:#8a93a0;margin-top:3px}'
      + '.sv-lock{background:linear-gradient(135deg,#f59e0b22,#ef444422);border:1px solid #f59e0b66;border-radius:14px;padding:22px;text-align:center}'
      + '.sv-lock h2{font-size:18px;margin:8px 0}'
      + '.sv-lock p{color:#cfd5dd;line-height:1.55;font-size:14px;margin:10px 0 16px}'
      + '.sv-tip{font-size:12px;color:#8a93a0;margin-top:6px;text-align:right}'
      ;
    var s = document.createElement('style'); s.id = 'sv-styles'; s.textContent = css; document.head.appendChild(s);
  }

  // -------- голос --------
  function attachMic(btnId, taId) {
    var btn = document.getElementById(btnId);
    var ta = document.getElementById(taId);
    if (!btn || !ta) return;
    var rec = false;
    btn.onclick = async function () {
      if (!window.voiceManager || typeof window.voiceManager.startRecording !== 'function') {
        toast('Голосовой ввод недоступен', 'warning'); return;
      }
      if (rec) { try { window.voiceManager.stopRecording(); } catch (e) {} return; }
      try {
        rec = true; btn.classList.add('rec');
        await window.voiceManager.startRecording({
          sttOnly: true,
          onTranscript: function (text) {
            if (!text) return;
            var prev = ta.value || '';
            ta.value = prev ? (prev + ' ' + text) : text;
            ta.dispatchEvent(new Event('input'));
          },
          onStop: function () { rec = false; btn.classList.remove('rec'); }
        });
      } catch (e) { rec = false; btn.classList.remove('rec'); }
    };
  }

  // -------- меню --------
  function home() {
    VIEW = 'menu';
    injectStyles();
    var c = document.getElementById('screenContainer');
    if (!c) return;
    CONTAINER = c;
    if (!isPremium()) { renderLocked(); return; }
    ensurePremium().then(function (ok) {
      if (!ok) { renderLocked(); return; }
      loadHistory();
      c.innerHTML = ''
        + '<div class="sv-wrap">'
        +   '<button class="sv-back" onclick="SUPERVIZOR.exit()">◀️ Назад</button>'
        +   '<div class="sv-h1">🧭 Супервизор</div>'
        +   '<div class="sv-sub">Принесите кейс на разбор — клиента или собственную сложную ситуацию. Фреди задаст уточняющие вопросы и даст структурированный разбор. Конфиденциально: всё хранится только у вас в браузере.</div>'
        +   '<div class="sv-card" onclick="SUPERVIZOR.start(\'pro\')" style="cursor:pointer">'
        +     '<div class="sv-card-h">🩺 Я психолог — разбираю клиента</div>'
        +     '<div class="sv-card-d">Профессиональная супервизия по 6 фокусам Hawkins-Shohet: клиент → ваши интервенции → отношения → ваш контрперенос → параллельный процесс → контекст. С этическим разбором и гипотезами для следующей сессии.</div>'
        +   '</div>'
        +   '<div class="sv-card" onclick="SUPERVIZOR.start(\'self\')" style="cursor:pointer">'
        +     '<div class="sv-card-h">👤 Я разбираю свою ситуацию</div>'
        +     '<div class="sv-card-d">Самосупервизия: трудный разговор, конфликт, переговоры, отношения. Фреди поможет разделить «что трогает меня» и «что есть на самом деле», увидеть альтернативные мотивы другой стороны и найти очевидный шаг.</div>'
        +   '</div>'
        +   (HISTORY.length ? '<div class="sv-card" onclick="SUPERVIZOR.openHistory()" style="cursor:pointer"><div class="sv-card-h">📜 История разборов (' + HISTORY.length + ')</div><div class="sv-card-d">Вернуться к прежним супервизиям, посмотреть свои отчёты.</div></div>' : '')
        + '</div>';
      track('feature_opened', { feature: 'supervizor_menu' });
    });
  }

  function renderLocked() {
    var c = document.getElementById('screenContainer');
    if (!c) return;
    c.innerHTML = ''
      + '<div class="sv-wrap">'
      +   '<button class="sv-back" onclick="SUPERVIZOR.exit()">◀️ Назад</button>'
      +   '<div class="sv-h1">🧭 Супервизор</div>'
      +   '<div class="sv-lock">'
      +     '<div style="font-size:38px">🔒</div>'
      +     '<h2>Доступно по подписке Premium</h2>'
      +     '<p>«Супервизор» — это рабочий инструмент для разбора сложных ситуаций по протоколу профессиональной супервизии. Доступен только в Premium.</p>'
      +     '<button class="sv-btn" onclick="SUPERVIZOR.openPremium()">Открыть Premium</button>'
      +   '</div>'
      + '</div>';
  }

  function openPremium() {
    if (typeof window.showPremiumLockPopup === 'function') return window.showPremiumLockPopup('Супервизор');
    if (typeof window.openPremium === 'function') return window.openPremium();
    toast('Откройте раздел «Подписка» в настройках', 'info');
  }

  function exit() {
    if (typeof window.renderDashboard === 'function') return window.renderDashboard();
    document.querySelectorAll('.chat-item').forEach(function (i) { i.classList.remove('active'); });
    var fb = document.querySelector('[data-chat="fredi"]'); if (fb) fb.classList.add('active');
    location.reload();
  }

  // -------- сессия --------
  function start(mode) {
    ST = {
      mode: mode,
      messages: [],
      askCount: 0,
      askLimit: 5,
      done: false,
      report: null,
      startedAt: Date.now()
    };
    VIEW = 'session';
    renderSession();
    track('feature_opened', { feature: 'supervizor_start', mode: mode });
  }

  function renderSession() {
    var c = CONTAINER || document.getElementById('screenContainer');
    if (!c) return;
    var modeLabel = ST.mode === 'pro' ? '🩺 Проф. супервизия' : '👤 Самосупервизия';
    var head = ST.mode === 'pro'
      ? 'Опишите кейс одним сообщением: пол и примерный возраст клиента (анонимно), запрос, длительность работы, что произошло на последней или ключевой сессии, ваша рабочая гипотеза, в каком месте вы зависаете.'
      : 'Опишите ситуацию одним сообщением: что произошло, с кем, что именно вас зацепило, что вы пытались сделать и где встали.';
    var msgsHtml = ST.messages.map(function (m) {
      if (m.role === 'sys') return '<div class="sv-msg sys">' + esc(m.text) + '</div>';
      if (m.role === 'fredi') return '<div class="sv-msg fredi"><b style="color:#a5b4fc">Фреди</b><br>' + nl2br(m.text) + '</div>';
      return '<div class="sv-msg user"><b style="color:#7dd3fc">Вы</b><br>' + nl2br(m.text) + '</div>';
    }).join('');

    var input = '';
    if (!ST.done) {
      var ph = ST.messages.length === 0 ? head : 'Ваш ответ…';
      input = ''
        + '<div class="sv-row" style="margin-top:14px">'
        +   '<button class="sv-mic" id="svMic" title="Голосовой ввод">🎤</button>'
        +   '<textarea class="sv-text" id="svInput" placeholder="' + esc(ph) + '"></textarea>'
        + '</div>'
        + '<div class="sv-tip">Уточняющих вопросов: ' + ST.askCount + ' / ' + ST.askLimit + (ST.messages.length >= 2 ? ' · можно прямо сейчас попросить разбор' : '') + '</div>'
        + '<div class="sv-row" style="margin-top:10px">'
        +   '<button class="sv-btn" onclick="SUPERVIZOR.send()">Отправить</button>'
        +   (ST.messages.length >= 2 ? '<button class="sv-btn warn" onclick="SUPERVIZOR.finish()">Готово, давай разбор</button>' : '')
        + '</div>';
    } else if (ST.report) {
      input = ''
        + '<div class="sv-report">' + nl2br(ST.report) + '</div>'
        + '<div class="sv-row" style="margin-top:14px">'
        +   '<button class="sv-btn ghost" onclick="SUPERVIZOR.home()">◀️ В меню</button>'
        +   '<button class="sv-btn" onclick="SUPERVIZOR.start(\'' + ST.mode + '\')">🆕 Новый разбор</button>'
        + '</div>';
    }

    c.innerHTML = ''
      + '<div class="sv-wrap">'
      +   '<button class="sv-back" onclick="SUPERVIZOR.home()">◀️ В меню</button>'
      +   '<div class="sv-step">' + modeLabel + (ST.done ? ' · разбор' : ' · сбор кейса') + '</div>'
      +   '<div class="sv-h1">' + (ST.done ? '📋 Разбор готов' : '🧭 Супервизия') + '</div>'
      +   (ST.messages.length === 0 && !ST.done ? '<div class="sv-sub">' + esc(head) + '</div>' : '')
      +   msgsHtml
      +   input
      + '</div>';

    if (!ST.done) attachMic('svMic', 'svInput');
  }

  async function send() {
    var ta = document.getElementById('svInput');
    if (!ta) return;
    var text = (ta.value || '').trim();
    if (text.length < 5) { toast('Слишком коротко — опишите подробнее', 'warning'); return; }
    ST.messages.push({ role: 'user', text: text, ts: Date.now() });
    ta.value = '';
    ST.messages.push({ role: 'sys', text: 'Фреди думает…' });
    renderSession();

    var resp = await aiGenerate(buildAskPrompt(), { max_tokens: 350, temperature: 0.6 });
    ST.messages.pop(); // убираем "думает"
    var ans = clean((resp && resp.response) || (resp && resp.text) || '');
    if (!ans) {
      toast('Не удалось получить ответ. Попробуйте ещё раз.', 'error');
      renderSession(); return;
    }
    ST.messages.push({ role: 'fredi', text: ans, ts: Date.now() });
    ST.askCount += 1;
    if (ST.askCount >= ST.askLimit) {
      ST.messages.push({ role: 'sys', text: 'Достаточно вводных. Делаем разбор.' });
      renderSession();
      await doReport();
    } else {
      renderSession();
    }
  }

  async function finish() {
    if (!ST || ST.done) return;
    ST.messages.push({ role: 'sys', text: 'Делаем разбор по вашему запросу.' });
    renderSession();
    await doReport();
  }

  async function doReport() {
    var resp = await aiGenerate(buildReportPrompt(), { max_tokens: 1200, temperature: 0.5 });
    var txt = clean((resp && resp.response) || (resp && resp.text) || '');
    if (!txt) {
      toast('Не удалось сформировать разбор. Попробуйте ещё раз.', 'error');
      ST.messages.pop();
      renderSession(); return;
    }
    ST.report = txt;
    ST.done = true;
    var title = ST.messages.length && ST.messages[0].role === 'user'
      ? ST.messages[0].text.slice(0, 60) + (ST.messages[0].text.length > 60 ? '…' : '')
      : 'Разбор';
    HISTORY.unshift({
      mode: ST.mode,
      title: title,
      report: txt,
      messages: ST.messages.filter(function (m) { return m.role !== 'sys'; }),
      ts: ST.startedAt,
      finishedAt: Date.now()
    });
    saveHistory();
    track('feature_opened', { feature: 'supervizor_report', mode: ST.mode });
    renderSession();
  }

  // -------- промты --------
  function transcript() {
    return ST.messages.filter(function (m) { return m.role !== 'sys'; }).map(function (m) {
      return (m.role === 'user' ? 'СУПЕРВИЗИРУЕМЫЙ' : 'СУПЕРВИЗОР') + ': ' + m.text;
    }).join('\n\n');
  }

  function buildAskPrompt() {
    var base, rules;
    if (ST.mode === 'pro') {
      base = 'Ты — опытный супервизор-психотерапевт. Работаешь по модели Hawkins-Shohet (7-глазая модель). К тебе пришёл коллега-психолог с клиентским кейсом. Твоя задача сейчас — задать ОДИН уточняющий вопрос, который поможет лучше увидеть кейс по одному из фокусов: клиент и его система, интервенции терапевта, отношения терапевт↔клиент, контрперенос, параллельный процесс, контекст и этика.';
      rules = 'Правила: ты задаёшь ровно ОДИН короткий вопрос (1-2 предложения), без преамбулы и без анализа. Тон — уважительный, профессиональный, на «вы». Если коллега уже отвечал на похожий фокус — выбирай другой угол. Никаких списков, никаких заголовков — только сам вопрос.';
    } else {
      base = 'Ты — тёплый, опытный супервизор/коуч. К тебе пришёл человек со своей сложной ситуацией и хочет разобраться. Твоя задача — задать ОДИН уточняющий вопрос, который помогает увидеть: что именно трогает его, какие у него предположения о других, какие альтернативные гипотезы возможны, какой исход он хочет, какое действие очевидно без эмоции.';
      rules = 'Правила: ровно ОДИН короткий вопрос (1-2 предложения), на «ты», без морализаторства, без советов. Не спрашивай дважды о том же. Никаких списков и заголовков — только вопрос.';
    }
    return base + '\n\n' + rules + '\n\nИстория диалога:\n' + transcript() + '\n\nТвой следующий вопрос:';
  }

  function buildReportPrompt() {
    var head, structure;
    if (ST.mode === 'pro') {
      head = 'Ты — опытный супервизор-психотерапевт (модель Hawkins-Shohet). Тебе принесли кейс. Сейчас сделай развёрнутый структурированный разбор.';
      structure = ''
        + 'Структура ответа (используй ровно эти заголовки, жирным через ** **):\n'
        + '**1. Клиент и его система.** Что видно про клиента, его жизненный контекст, паттерн запроса.\n'
        + '**2. Интервенции терапевта.** Какие действия терапевта помогали, какие — нет, что пропущено.\n'
        + '**3. Отношения терапевт↔клиент.** Что происходит между ними как процесс. Альянс, сопротивление, проективная идентификация.\n'
        + '**4. Контрперенос.** Что в этом кейсе цепляет лично терапевта. Откуда это может быть. Что важно осознать.\n'
        + '**5. Параллельный процесс.** Что в самом запросе терапевта на супервизию повторяет динамику с клиентом.\n'
        + '**6. Контекст и этика.** Организационные, культурные, этические факторы. Двойные роли, границы.\n'
        + '**Гипотезы и рекомендации.** 2-3 альтернативные гипотезы. Что попробовать на следующей сессии. Что стоит отнести в личную терапию терапевта.\n'
        + 'Тон — уважительный, профессиональный, на «вы». Без воды и общих фраз — только конкретное по этому кейсу.';
    } else {
      head = 'Ты — тёплый, опытный супервизор/коуч. К тебе пришёл человек со своей сложной ситуацией. Сейчас сделай развёрнутый разбор.';
      structure = ''
        + 'Структура ответа (используй ровно эти заголовки, жирным через ** **):\n'
        + '**1. Что трогает именно тебя.** Какая твоя реакция, какие чувства, какая твоя боль/нерешённое в этом отзывается.\n'
        + '**2. Твои предположения о другой стороне.** Какую картину ты построил(а), на чём она держится, насколько она проверена.\n'
        + '**3. Альтернативные гипотезы.** 2-3 другие возможные причины поведения другой стороны, кроме твоей основной.\n'
        + '**4. Желаемый исход.** Чего ты хочешь от этой ситуации в реальности. Это исход про себя или про другого.\n'
        + '**5. Очевидный шаг без эмоции.** Если убрать обиду/злость/тревогу — какое действие просто напрашивается.\n'
        + '**Что делать.** 1-2 конкретных следующих шага. И 1 наблюдение за собой, которое стоит вести ближайшие дни.\n'
        + 'Тон — тёплый, без морализаторства, на «ты». Без воды — только конкретное.';
    }
    return head + '\n\n' + structure + '\n\nЗапись супервизии:\n' + transcript() + '\n\nРазбор:';
  }

  // -------- история --------
  function openHistory() {
    VIEW = 'history';
    loadHistory();
    var c = CONTAINER || document.getElementById('screenContainer');
    if (!c) return;
    var items = HISTORY.map(function (h, i) {
      var d = new Date(h.ts);
      var dt = d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
      var modeLabel = h.mode === 'pro' ? '🩺 Проф' : '👤 Сам';
      return '<div class="sv-hist-item" onclick="SUPERVIZOR.openReport(' + i + ')">'
        + '<div class="sv-hist-h">' + esc(h.title) + '</div>'
        + '<div class="sv-hist-d">' + modeLabel + ' · ' + dt + '</div>'
        + '</div>';
    }).join('');
    c.innerHTML = ''
      + '<div class="sv-wrap">'
      +   '<button class="sv-back" onclick="SUPERVIZOR.home()">◀️ В меню</button>'
      +   '<div class="sv-h1">📜 История разборов</div>'
      +   '<div class="sv-sub">Все ваши супервизии хранятся локально, в этом браузере.</div>'
      +   (items || '<div class="sv-sub">Пока пусто.</div>')
      + '</div>';
  }

  function openReport(i) {
    var h = HISTORY[i]; if (!h) return;
    VIEW = 'report';
    var c = CONTAINER || document.getElementById('screenContainer');
    if (!c) return;
    var msgs = (h.messages || []).map(function (m) {
      if (m.role === 'fredi') return '<div class="sv-msg fredi"><b style="color:#a5b4fc">Фреди</b><br>' + nl2br(m.text) + '</div>';
      return '<div class="sv-msg user"><b style="color:#7dd3fc">Вы</b><br>' + nl2br(m.text) + '</div>';
    }).join('');
    c.innerHTML = ''
      + '<div class="sv-wrap">'
      +   '<button class="sv-back" onclick="SUPERVIZOR.openHistory()">◀️ К истории</button>'
      +   '<div class="sv-step">' + (h.mode === 'pro' ? '🩺 Проф. супервизия' : '👤 Самосупервизия') + '</div>'
      +   '<div class="sv-h1">' + esc(h.title) + '</div>'
      +   '<div class="sv-card-d" style="margin:8px 0 14px">Диалог:</div>'
      +   msgs
      +   '<div class="sv-card-d" style="margin:14px 0 6px">Разбор:</div>'
      +   '<div class="sv-report">' + nl2br(h.report || '') + '</div>'
      +   '<div class="sv-row" style="margin-top:14px">'
      +     '<button class="sv-btn ghost" onclick="SUPERVIZOR.openHistory()">◀️ К истории</button>'
      +     '<button class="sv-btn warn" onclick="SUPERVIZOR.deleteReport(' + i + ')">🗑 Удалить</button>'
      +   '</div>'
      + '</div>';
  }

  function deleteReport(i) {
    if (!confirm('Удалить этот разбор?')) return;
    HISTORY.splice(i, 1);
    saveHistory();
    openHistory();
  }

  // экспорт
  window.SUPERVIZOR = {
    home: home, exit: exit, openPremium: openPremium,
    start: start, send: send, finish: finish,
    openHistory: openHistory, openReport: openReport, deleteReport: deleteReport
  };
  window.showSupervizorScreen = home;
  console.log('✅ supervizor.js loaded (модуль «Супервизор»)');
})();
