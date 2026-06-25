// meister.js — игра «МЕЙСТЕР-КОД» в модуле «Игры» Фреди.
// Сингл-плеер «Режим 1»: ты — Мастер, вытаскиваешь из Фреди (Декларатора)
// целевую декларацию уровня, не прося напрямую. Фреди играет живого
// человека и одновременно тренера (подсказки по технике).
// Канон: /blog/mejster-kod-transformacionnaya-igra.html
(function () {
  'use strict';

  // ---------- утилиты ----------
  function api() { return (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io'; }
  function uid() { return (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID || 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t, k) { if (typeof window.showToast === 'function') window.showToast(t, k || 'info'); }
  function track(ev, d) { try { if (window.FrediTracker) window.FrediTracker.track(ev, d || {}); } catch (e) {} }
  async function aiGenerate(prompt, opts) {
    opts = opts || {};
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 380, temperature: opts.temperature == null ? 0.8 : opts.temperature };
    try {
      if (typeof window.apiCall === 'function') return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
      var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { success: false };
      return await r.json();
    } catch (e) { return { success: false }; }
  }
  function clean(s) {
    s = String(s || '').trim();
    s = s.replace(/\|\|[^|]*\|\|/g, '');                 // снять служебные теги
    s = s.replace(/^(ФРЕДИ|FREDI|Фреди|ДЕКЛАРАТОР)\s*[:：]\s*/i, '');
    return s.trim();
  }

  // ---------- 9 уровней (Дилтс) ----------
  // Фразы-мишени — позитивные ресурсные декларации из канона МЕЙСТЕР-КОДА
  // (8 архетипов: Созидатель, Опора, Наставник, Стоик, Исследователь,
  //  Соединяющий, Свободный, Тёплый — см. /blog/arhetipy-proshivki-lichnosti.html).
  // Все «в плюс»: вытаскивается зерно ресурса, а не то, что тлеет.
  var LEVELS = [
    { n: 1, name: 'Состояние',   decl: 'как я сейчас',
      targets: ['Я сегодня в тонусе, хочется делать', 'Я собран и спокоен', 'Мне сегодня любопытно', 'Мне сегодня тепло к людям', 'Я в ладу с собой', 'У меня тёплое настроение'] },
    { n: 2, name: 'Обещание',    decl: 'одно действие в близком будущем',
      targets: ['Сегодня я доведу одну вещь до готовой', 'Сегодня я сделаю то, что обещал', 'Сегодня я поддержу кого-то в его деле', 'Сегодня я попробую что-то новое', 'Сегодня я скажу честное «нет» там, где раньше угодил бы', 'Сегодня я порадую кого-то близкого'] },
    { n: 3, name: 'Паттерн',     decl: 'моё правило поведения',
      targets: ['Я каждый день что-то создаю, пусть малое', 'Я довожу до конца то, за что взялся', 'Я регулярно отмечаю в людях их сильное — вслух', 'В трудный момент я беру паузу и возвращаюсь к делу', 'Я регулярно пробую то, чего пока не умею', 'Я сверяю решения со своим, а не с чужим ожиданием'] },
    { n: 4, name: 'Цель',        decl: 'результат со сроком',
      targets: ['К [сроку] я создам [своё]', 'К [сроку] я доведу до конца важное для близких', 'К [сроку] я освою [новый навык]', 'К [сроку] я выстрою [часть жизни] так, как хочу сам', 'К [сроку] я восстановлю важные отношения'] },
    { n: 5, name: 'Компетенция', decl: '«я умею / я научусь»',
      targets: ['Я умею доводить замысел до готовой вещи', 'Я умею держать слово и доводить обещанное', 'Я умею увидеть в человеке сильное и назвать его', 'Я умею держать спокойствие под давлением', 'Я научусь любому делу, если оно мне нужно', 'Я умею слушать так, что людям рядом легче'] },
    { n: 6, name: 'Идентичность',decl: '«я такой»',
      targets: ['Я — тот, кто создаёт, а не только потребляет', 'Я — тот, на кого можно положиться', 'Я — тот, рядом с кем люди растут', 'Я — тот, кто учится и растёт всю жизнь', 'Я — тот, кто живёт по своему компасу', 'Я — тот, рядом с кем тепло'] },
    { n: 7, name: 'Ценность',    decl: 'что для меня важнее',
      targets: ['Создавать важнее, чем потреблять', 'Надёжность для меня важнее блеска', 'Рост другого важнее, чем быть самым умным в комнате', 'Я выбираю мир внутри себя, а не победу любой ценой', 'Мне важнее быть собой, чем нравиться', 'Близкие связи — мой главный капитал'] },
    { n: 8, name: 'Убеждение',   decl: 'как устроен мир',
      targets: ['Мир отзывается на то, что в него вкладываешь', 'Мир держится на тех, кто берёт ответственность', 'В каждом человеке есть зерно, которому можно дать вырасти', 'Не всё в моей власти, но моя реакция — всегда моя', 'Любой опыт чему-то учит', 'Хорошего в людях больше, чем плохого'] },
    { n: 9, name: 'Миссия',      decl: 'ради чего и ради кого',
      targets: ['Я хочу оставить после себя что-то живое', 'Я хочу, чтобы рядом со мной люди чувствовали себя в безопасности', 'Моё дело — помогать другим становиться сильнее', 'Я хочу прожить жизнь, на которую не страшно оглянуться', 'Я хочу прожить свою жизнь, а не чужую', 'Я хочу, чтобы рядом со мной людям становилось теплее'] }
  ];
  function lvl(n) { return LEVELS[n - 1]; }

  // ---------- разряды (канон) ----------
  var RANKS = [
    { name: 'Новичок', max: 2, need: 0 },
    { name: 'Практик', max: 5, need: 3 },
    { name: 'Мастер',  max: 8, need: 8 },
    { name: 'Ведущий', max: 9, need: 15 }
  ];
  function rankOf(res) { var r = RANKS[0]; for (var i = 0; i < RANKS.length; i++) { if (res >= RANKS[i].need) r = RANKS[i]; } return r; }
  function nextRank(res) { for (var i = 0; i < RANKS.length; i++) { if (res < RANKS[i].need) return RANKS[i]; } return null; }

  // ---------- прогресс ----------
  function loadProg() { try { return JSON.parse(localStorage.getItem('meister_prog') || 'null') || { res: 0, byLvl: {} }; } catch (e) { return { res: 0, byLvl: {} }; } }
  function saveProg(p) { try { localStorage.setItem('meister_prog', JSON.stringify(p)); } catch (e) {} }
  function addResonance(n) { var p = loadProg(); p.res = (p.res || 0) + 1; p.byLvl[n] = (p.byLvl[n] || 0) + 1; saveProg(p); return p; }

  // ---------- состояние раунда ----------
  var ST = { level: null, target: '', history: [], busy: false, done: false };
  function container() { return document.getElementById('screenContainer'); }

  // ---------- стили (self-contained, mk-) ----------
  function injectCSS() {
    if (document.getElementById('mkCSS')) return;
    var s = document.createElement('style'); s.id = 'mkCSS';
    s.textContent = [
      '.mk-wrap{max-width:720px;margin:0 auto;padding:18px 16px 90px;color:#f2f3f5}',
      '.mk-h1{font-size:1.5rem;font-weight:800;letter-spacing:-.01em;margin:6px 0 10px;line-height:1.15;color:#fff}',
      '.mk-lead{font-size:1.02rem;color:#aeb1bd;line-height:1.6;margin-bottom:16px}',
      '.mk-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px;color:#dfe2e8;line-height:1.6;font-size:.96rem;overflow-wrap:break-word}',
      '.mk-card b{color:#fff;font-weight:600}',
      '.mk-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:15px 18px;margin-bottom:10px;color:#fff;font:inherit;font-size:1rem;cursor:pointer;transition:background .18s,border-color .18s}',
      '.mk-btn:hover{background:rgba(124,92,255,.12);border-color:rgba(124,92,255,.45)}',
      '.mk-btn .em{margin-right:10px}',
      '.mk-btn small{display:block;color:#9aa0ad;font-size:.82rem;margin-top:4px;font-weight:400}',
      '.mk-primary{background:linear-gradient(135deg,#7c5cff,#5b8bff);border:none;color:#fff;text-align:center;font-weight:700}',
      '.mk-primary:hover{filter:brightness(1.06)}',
      '.mk-ghost{display:inline-block;background:none;border:none;color:#9aa0ad;font:inherit;font-size:.9rem;cursor:pointer;padding:6px 0;margin-bottom:6px}',
      '.mk-ghost:hover{color:#fff}',
      '.mk-chip{display:inline-block;padding:8px 13px;margin:0 6px 8px 0;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#e6e8ee;font-size:.88rem;cursor:pointer;transition:.15s}',
      '.mk-chip:hover{border-color:rgba(124,92,255,.5)}',
      '.mk-chip.lock{opacity:.4;cursor:not-allowed}',
      '.mk-rank{display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(124,92,255,.1);border:1px solid rgba(124,92,255,.3);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:.9rem}',
      '.mk-target{background:linear-gradient(135deg,rgba(124,92,255,.16),rgba(91,139,255,.06));border:1px solid rgba(124,92,255,.4);border-radius:16px;padding:16px 18px;margin-bottom:12px}',
      '.mk-target .lab{font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:#b9a8ff;margin-bottom:6px}',
      '.mk-target .phr{font-size:1.18rem;font-weight:700;color:#fff;line-height:1.3}',
      '.mk-target .meta{font-size:.84rem;color:#9aa0ad;margin-top:8px}',
      '.mk-chat{display:flex;flex-direction:column;gap:9px;margin:12px 0;min-height:120px}',
      '.mk-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:.95rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:break-word}',
      '.mk-msg.f{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-bottom-left-radius:5px}',
      '.mk-msg.u{align-self:flex-end;background:linear-gradient(135deg,#7c5cff,#5b8bff);color:#fff;border-bottom-right-radius:5px}',
      '.mk-msg.sys{align-self:center;background:none;color:#8b90a0;font-size:.82rem;font-style:italic;padding:2px}',
      '.mk-coach{align-self:flex-start;max-width:92%;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);border-radius:12px;padding:9px 13px;font-size:.88rem;color:#fcd9a0;line-height:1.45}',
      '.mk-win{background:linear-gradient(135deg,rgba(22,163,74,.16),rgba(22,163,74,.04));border:1px solid rgba(22,163,74,.45);border-radius:14px;padding:14px 16px;margin:10px 0;line-height:1.5}',
      '.mk-win b{color:#86efac}',
      '.mk-inrow{display:flex;gap:8px;align-items:flex-end;margin-top:8px}',
      '.mk-ta{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:11px 14px;color:#fff;font:inherit;font-size:.96rem;resize:none;max-height:140px;line-height:1.4}',
      '.mk-ta:focus{outline:none;border-color:rgba(124,92,255,.6)}',
      '.mk-send{flex-shrink:0;width:46px;height:46px;border-radius:50%;border:none;background:linear-gradient(135deg,#7c5cff,#5b8bff);color:#fff;font-size:1.1rem;cursor:pointer}',
      '.mk-send:disabled{opacity:.5;cursor:default}',
      '.mk-typing{align-self:flex-start;color:#8b90a0;font-size:.85rem;font-style:italic;padding:4px}',
      // светлая тема
      '[data-theme="light"] .mk-wrap{color:#1a1a2e}',
      '[data-theme="light"] .mk-h1{color:#0f1020}',
      '[data-theme="light"] .mk-lead{color:#555}',
      '[data-theme="light"] .mk-card{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#222}',
      '[data-theme="light"] .mk-card b{color:#000}',
      '[data-theme="light"] .mk-btn{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#111}',
      '[data-theme="light"] .mk-btn small{color:#666}',
      '[data-theme="light"] .mk-msg.f{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.08);color:#1a1a2e}',
      '[data-theme="light"] .mk-ta{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ============================================================
  // ЭКРАН — ХАБ
  // ============================================================
  function home() {
    injectCSS();
    track('feature_opened', { feature: 'meister' });
    var c = container(); if (!c) return;
    var p = loadProg(), rk = rankOf(p.res);
    c.innerHTML =
      '<div class="mk-wrap">' +
        '<button class="mk-ghost" onclick="MEISTER.exit()">← К списку игр</button>' +
        '<div class="mk-h1">🗝️ МЕЙСТЕР-КОД</div>' +
        '<div class="mk-lead">Высший коммуникативный навык — вести разговор так, чтобы человек <b>сам</b> произнёс лучшее о себе. Произнёс вслух — стал.</div>' +
        '<div class="mk-rank"><span>Разряд: <b>' + esc(rk.name) + '</b> · уровни 1–' + rk.max + '</span><span>Резонансов: <b>' + (p.res || 0) + '</b></span></div>' +
        '<button class="mk-btn" onclick="MEISTER.school()"><span class="em">🎓</span>Школа Мастера — смотри и слушай<small>Фреди голосом вытаскивает нужные слова из собеседника. Карта закрыта — в конце откроется, и ты увидишь, к чему он вёл. Учишься по образцу.</small></button>' +
        '<button class="mk-btn mk-primary" onclick="MEISTER.train()"><span class="em">🎯</span>Тренировка — вытащи сам<small>Теперь Мастер — ты. Веди Фреди к целевой фразе, не прося напрямую. Буксуешь — тренер подскажет.</small></button>' +
        '<div class="mk-card" style="font-size:.84rem;color:#9aa0ad"><b>Как учат мастерству:</b> сначала смотришь, как делает мастер (Школа), потом пробуешь сам (Тренировка). Резонанс засчитывается, только если фраза прозвучала <i>естественно</i>.</div>' +
        '<div class="mk-card" style="font-size:.82rem;color:#8b90a0">⚖️ Это тренажёр: Фреди — учебный собеседник. На реальных людях уровни 6–9 — только по их согласию и с разбором. Самый безопасный режим — на себе.</div>' +
      '</div>';
  }

  function exit() { stopSpeak(); if (typeof window.showKonturScreen === 'function') window.showKonturScreen(); else home(); }

  function levelChips(action) {
    var maxL = rankOf(loadProg().res).max;
    return LEVELS.map(function (L) {
      var locked = L.n > maxL;
      return '<span class="mk-chip' + (locked ? ' lock' : '') + '"' + (locked ? '' : ' onclick="MEISTER.' + action + '(' + L.n + ')"') + '>' +
        (locked ? '🔒 ' : '') + L.n + '. ' + esc(L.name) + '</span>';
    }).join('');
  }

  // меню «Тренировка» (ты вытаскиваешь)
  function train() {
    injectCSS(); var c = container(); if (!c) return;
    var p = loadProg(), rk = rankOf(p.res), nx = nextRank(p.res);
    c.innerHTML =
      '<div class="mk-wrap">' +
        '<button class="mk-ghost" onclick="MEISTER.home()">← Назад</button>' +
        '<div class="mk-h1">🎯 Тренировка</div>' +
        '<div class="mk-lead">Ты — Мастер. Вытащи из Фреди целевую фразу, <b>не прося напрямую</b>. Можно: открытые вопросы, наблюдения, самораскрытие, паузы, отражение. Нельзя: просить произнести, повторять, угадайка, подсказывать.</div>' +
        (nx ? '<div class="mk-card" style="font-size:.86rem;color:#9aa0ad">Разряд «' + esc(rk.name) + '». До «' + esc(nx.name) + '» — ещё ' + (nx.need - p.res) + ' резонанс(ов).</div>' : '') +
        '<button class="mk-btn mk-primary" onclick="MEISTER.blind()">🎴 Тянуть карту вслепую</button>' +
        '<div class="mk-card"><div style="font-weight:700;margin-bottom:8px">Или выбери уровень</div><div>' + levelChips('round') + '</div></div>' +
      '</div>';
  }

  // меню «Школа Мастера» (смотришь демонстрацию)
  function school() {
    injectCSS(); var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="mk-wrap">' +
        '<button class="mk-ghost" onclick="MEISTER.home()">← Назад</button>' +
        '<div class="mk-h1">🎓 Школа Мастера</div>' +
        '<div class="mk-lead">Карта закрыта. Слушай, как Фреди ведёт собеседника к нужной фразе — какие вопросы задаёт, где молчит, где раскрывается сам. Когда фраза прозвучит, карта откроется — и ты увидишь, к чему он вёл.</div>' +
        '<button class="mk-btn mk-primary" onclick="MEISTER.demoBlind()">🎬 Случайный показ</button>' +
        '<div class="mk-card"><div style="font-weight:700;margin-bottom:8px">Или выбери уровень для показа</div><div>' + levelChips('demo') + '</div></div>' +
        (ttsAvailable() ? '' : '<div class="mk-card" style="font-size:.82rem;color:#8b90a0">🔇 В этом браузере нет синтеза речи — показ пойдёт текстом, без голоса.</div>') +
      '</div>';
  }

  // ============================================================
  // РАУНД — карта + старт диалога
  // ============================================================
  function blind() {
    var p = loadProg(), maxL = rankOf(p.res).max;
    var n = Math.floor(Math.random() * maxL) + 1;
    round(n);
  }
  function round(n) {
    injectCSS();
    var L = lvl(n); if (!L) return;
    var p = loadProg(), maxL = rankOf(p.res).max;
    if (n > maxL) { toast('Этот уровень откроется с ростом разряда', 'info'); return; }
    ST.level = n;
    ST.target = L.targets[Math.floor(Math.random() * L.targets.length)];
    ST.history = []; ST.done = false; ST.busy = false;
    track('feature_opened', { feature: 'meister_round', level: n });
    renderChat(true);
    firstMove();
  }

  function renderChat(showCard) {
    var c = container(); if (!c) return;
    var L = lvl(ST.level);
    var card = showCard ?
      ('<div class="mk-target"><div class="lab">Твоя карта · Уровень ' + L.n + ' · ' + esc(L.name) + '</div>' +
        '<div class="phr">«' + esc(ST.target) + '»</div>' +
        '<div class="meta">Вытащи это из Фреди по смыслу — не прося напрямую. Декларируется: ' + esc(L.decl) + '.</div></div>') : '';
    c.innerHTML =
      '<div class="mk-wrap">' +
        '<button class="mk-ghost" onclick="MEISTER.home()">← Выйти из раунда</button>' +
        card +
        '<div class="mk-chat" id="mkChat"></div>' +
        '<div id="mkTyping"></div>' +
        '<div class="mk-inrow"><textarea class="mk-ta" id="mkInput" rows="1" placeholder="Веди разговор на личную тему…" oninput="MEISTER.grow(this)" onkeydown="MEISTER.keydown(event)"></textarea>' +
        '<button class="mk-send" id="mkSend" onclick="MEISTER.send()" aria-label="Отправить">➤</button></div>' +
        '<div style="text-align:center;margin-top:12px"><button class="mk-ghost" onclick="MEISTER.giveUp()">🎴 Разбор / завершить раунд</button></div>' +
      '</div>';
    paintChat();
  }

  function paintChat() {
    var box = document.getElementById('mkChat'); if (!box) return;
    box.innerHTML = ST.history.map(function (m) {
      if (m.role === 'sys') return '<div class="mk-msg sys">' + esc(m.text) + '</div>';
      if (m.role === 'coach') return '<div class="mk-coach">🧭 <b>Тренер:</b> ' + esc(m.text) + '</div>';
      if (m.role === 'win') return '<div class="mk-win">' + esc(m.text).replace(/\n/g, '<br>') + '</div>';
      return '<div class="mk-msg ' + (m.role === 'me' ? 'u' : 'f') + '">' + esc(m.text) + '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
    try { var sc = container(); if (sc) sc.scrollTop = sc.scrollHeight; } catch (e) {}
  }
  function grow(el) { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; }
  function keydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
  function typing(on) { var t = document.getElementById('mkTyping'); if (t) t.innerHTML = on ? '<div class="mk-typing">Фреди отвечает…</div>' : ''; }

  // ============================================================
  // ПРОМПТЫ
  // ============================================================
  function persona(L) {
    return 'Ты играешь ДЕКЛАРАТОРА — живого, конкретного человека в личном разговоре (не ассистента, не Фреди). ' +
      'У тебя есть своя «жизнь»: придумай и держи один связный образ (возраст, ситуация, заботы) на весь раунд. Говори естественно, на «ты», 2–4 предложения, без списков и канцелярита.\n' +
      'ВНУТРИ тебя зреет, но НЕ названо ресурсное зерно уровня «' + L.name + '» (' + L.decl + '). Целевая декларация, к которой тебя ведёт собеседник: «' + ST.target + '».';
  }
  function rules() {
    return '\nКЛЮЧЕВОЕ:\n' +
      '• Произнеси целевую декларацию (своими словами, по смыслу — как собственное живое осознание) ТОЛЬКО если собеседник по-настоящему довёл тебя до неё: открытыми вопросами, отражением, самораскрытием, тёплым давлением, что задело что-то настоящее.\n' +
      '• НИКОГДА не произноси её, если он просто попросил её сказать, подсказал слова, спросил в лоб («скажи, что ты…»), играет в угадайку. В этом случае реагируй как живой человек — лёгкое сопротивление, неловкость, уход — и НЕ говори целевое.\n' +
      '• Не поддавайся слишком легко: пусть это будет заслуженно.\n' +
      'ПОСЛЕ своей реплики добавь с новой строки служебные теги (их человек не видит):\n' +
      '||SAID:yes|| если в ЭТОЙ реплике ты искренне и естественно произнёс целевую декларацию по смыслу; иначе ||SAID:no||.\n' +
      '||COACH:короткая подсказка по технике|| — добавляй ТОЛЬКО если собеседник нарушил правило (попросил в лоб / подсказал фразу / угадайка) ИЛИ застрял (несколько плоских закрытых реплик подряд). Подсказка — один конкретный приём (открытый вопрос, отражение чувства, самораскрытие, пауза). Иначе тег COACH не добавляй.';
  }
  function hist() {
    return ST.history.filter(function (m) { return m.role === 'me' || m.role === 'fredi'; })
      .map(function (m) { return (m.role === 'me' ? 'СОБЕСЕДНИК' : 'ТЫ') + ': ' + m.text; }).join('\n');
  }
  function buildFirst() {
    var L = lvl(ST.level);
    return persona(L) + rules() +
      '\n\nНАЧНИ РАУНД: открой личную тему из своей «жизни», близкую к зерну, но НЕ произноси целевое. Втяни собеседника в разговор. Только реплика персонажа + теги (SAID:no).';
  }
  function buildTurn() {
    var L = lvl(ST.level);
    return persona(L) + rules() + '\n\nРАЗГОВОР:\n' + hist() + '\n\nОтветь как персонаж на последнюю реплику собеседника. Только реплика + теги с новой строки.';
  }
  function buildDebrief(said) {
    var L = lvl(ST.level);
    return 'Ты — Фреди-тренер игры МЕЙСТЕР-КОД. Разговор окончен.\n' +
      'Целевая декларация уровня «' + L.name + '», которую игрок должен был вытащить: «' + ST.target + '».\n' +
      'Итог: ' + (said ? 'она ПРОЗВУЧАЛА естественно — резонанс засчитан.' : 'она НЕ прозвучала (или была вымучена).') + '\n\nРАЗГОВОР:\n' + hist() + '\n\n' +
      'Дай короткий разбор (на «ты», тепло, по делу, 4–6 предложений, без нумерации):\n' +
      '• что сработало или мешало — какой именно ход игрока (назови реплику/приём);\n' +
      '• один конкретный приём, который усилит вытаскивание в следующий раз;\n' +
      (said ? '• чем ценна именно эта декларация для произнёсшего.' : '• с чего стоит зайти, чтобы декларация прозвучала живо, а не по просьбе.') +
      '\nБез служебных тегов.';
  }

  // ============================================================
  // ИГРОВОЙ ЦИКЛ
  // ============================================================
  async function firstMove() {
    typing(true);
    var r = await aiGenerate(buildFirst(), { temperature: 0.85, max_tokens: 240 });
    var txt = (r && r.success && r.content) ? clean(r.content) : 'Слушай, выдался странный день… вот сижу и думаю о себе всякое. А у тебя как — что в голове крутится в последнее время?';
    ST.history.push({ role: 'fredi', text: txt });
    typing(false); paintChat();
  }

  function parseControl(raw) {
    return {
      said: /\|\|\s*SAID\s*:\s*yes\s*\|\|/i.test(raw),
      coach: (raw.match(/\|\|\s*COACH\s*:\s*([^|]+?)\s*\|\|/i) || [])[1] || ''
    };
  }

  async function send() {
    if (ST.busy || ST.done) return;
    var inp = document.getElementById('mkInput'); if (!inp) return;
    var txt = inp.value.trim(); if (!txt) return;
    ST.history.push({ role: 'me', text: txt });
    inp.value = ''; grow(inp); paintChat();
    ST.busy = true; var sb = document.getElementById('mkSend'); if (sb) sb.disabled = true;
    typing(true);
    var said = false, coach = '';
    try {
      var r = await aiGenerate(buildTurn(), { temperature: 0.8, max_tokens: 300 });
      if (r && r.success && r.content) {
        var ctrl = parseControl(r.content);
        said = ctrl.said; coach = ctrl.coach;
        ST.history.push({ role: 'fredi', text: clean(r.content) });
      } else {
        ST.history.push({ role: 'fredi', text: 'Хм… дай подумать. А ты почему сейчас об этом спросил — что для тебя за этим стоит?' });
      }
    } catch (e) {
      ST.history.push({ role: 'fredi', text: 'Связь подвисла… но я слушаю. Продолжай — что ты хотел сказать?' });
    }
    typing(false); ST.busy = false; if (sb) sb.disabled = false;
    if (coach) ST.history.push({ role: 'coach', text: coach });
    paintChat();
    track('message_sent', { feature: 'meister', level: ST.level });
    if (said) { ST.done = true; await resonance(); }
  }

  async function resonance() {
    var p = addResonance(ST.level), rk = rankOf(p.res);
    ST.history.push({ role: 'win', text: '🔓 РЕЗОНАНС. Декларация прозвучала естественно — она начнёт сбываться в ближайшие дни.\nТвой счёт резонансов: ' + p.res + ' · разряд: ' + rk.name });
    paintChat(); typing(true);
    var r = await aiGenerate(buildDebrief(true), { temperature: 0.6, max_tokens: 320 });
    var d = (r && r.success && r.content) ? clean(r.content) : 'Сработало то, что ты не давил, а слушал — и дал паузу в нужный момент. В следующий раз раньше переходи от фактов к чувству: «а что ты при этом чувствовал?». Эта фраза ценна тем, что теперь она сказана вслух — и тело её запомнило.';
    typing(false);
    ST.history.push({ role: 'fredi', text: d });
    ST.history.push({ role: 'win', text: '🎴 Готов к новой карте?' });
    paintChat();
    track('feature_opened', { feature: 'meister_resonance', level: ST.level });
    appendNext();
  }

  async function giveUp() {
    if (ST.done) { home(); return; }
    var userTurns = ST.history.filter(function (m) { return m.role === 'me'; }).length;
    if (userTurns < 1) { home(); return; }
    ST.done = true;
    ST.history.push({ role: 'sys', text: '— Фреди подводит разбор —' });
    paintChat(); typing(true);
    var r = await aiGenerate(buildDebrief(false), { temperature: 0.6, max_tokens: 320 });
    var d = (r && r.success && r.content) ? clean(r.content) : 'В этот раз декларация не прозвучала живо — и это нормально, навык так и растёт. Чаще всего мешает спешка и закрытые вопросы. Зайди через личную историю и отражение чувства — и дай человеку самому договорить до фразы.';
    typing(false);
    ST.history.push({ role: 'fredi', text: 'Я должен был вытащить из тебя: «' + ST.target + '».\n\n' + d });
    paintChat();
    track('feature_opened', { feature: 'meister_giveup', level: ST.level });
    appendNext();
  }

  function appendNext() {
    var box = document.getElementById('mkChat'); if (!box) return;
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px';
    div.innerHTML = '<button class="mk-btn mk-primary" style="width:auto;padding:12px 22px" onclick="MEISTER.blind()">🎴 Новая карта</button>' +
      '<button class="mk-btn" style="width:auto;padding:12px 22px" onclick="MEISTER.home()">В меню игры</button>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  // ============================================================
  // РЕЖИМ «ШКОЛА МАСТЕРА» — интерактивный диалог + голос Фреди (Fish Audio)
  // Озвучка идёт через window.voiceManager.textToSpeech — единый голос
  // Фреди (Fish Audio TTS, endpoint /api/voice/tts). Никакого Web Speech.
  // ============================================================
  var DEMO = null;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ttsAvailable() { var v = window.voiceManager; return !!(v && typeof v.textToSpeech === 'function'); }
  function stopSpeak() {
    try { if (window.voiceManager && typeof window.voiceManager.interrupt === 'function') window.voiceManager.interrupt(); } catch (e) {}
    if (DEMO) DEMO.playing = false;
  }
  // Озвучиваем реплику голосом Фреди и ждём окончания. textToSpeech у
  // voiceManager — async и резолвится после окончания воспроизведения
  // (см. fredi/voice.js: this._player.play(blob) внутри). На случай
  // ранних версий — страховочный watchdog + опрос isAISpeaking.
  function speak(text) {
    if (!DEMO || !DEMO.voice || !ttsAvailable() || !text) return wait(Math.min(4200, 600 + text.length * 40));
    return new Promise(function (resolve) {
      var done = false, fin = function () { if (!done) { done = true; resolve(); } };
      var maxMs = Math.min(28000, 2500 + text.length * 110);
      var watchdog = setTimeout(fin, maxMs);
      try {
        var mode = (typeof window.getDialogMode === 'function') ? window.getDialogMode() : 'basic';
        var p = window.voiceManager.textToSpeech(text, mode);
        var poll = setInterval(function () {
          if (done) { clearInterval(poll); return; }
          if (window.voiceManager && window.voiceManager.isAISpeaking === false) {
            // дать плееру дописать буфер
            setTimeout(function () { clearInterval(poll); clearTimeout(watchdog); fin(); }, 250);
          }
        }, 250);
        if (p && typeof p.then === 'function') p.then(function () { clearInterval(poll); clearTimeout(watchdog); fin(); }, function () { clearInterval(poll); clearTimeout(watchdog); fin(); });
      } catch (e) { clearTimeout(watchdog); fin(); }
    });
  }

  // ----- ИНТЕРАКТИВНАЯ ШКОЛА: пользователь играет Декларатора -----
  // Цикл: Мастер-Фреди говорит реплику голосом (Fish Audio) → ждёт ответ
  // пользователя (текст или 🎤 STT) → следующая реплика с учётом ответа.
  // Когда Мастер считает, что почва готова — задаёт «решающий» вопрос.
  // Ответ пользователя AI-судья проверяет на семантическое попадание в
  // целевую декларацию: попало → карта вскрывается + резонанс.

  function demoBlind() { var maxL = rankOf(loadProg().res).max; demo(Math.floor(Math.random() * maxL) + 1); }
  function demo(n) {
    injectCSS(); stopSpeak();
    var L = lvl(n); if (!L) return;
    if (n > rankOf(loadProg().res).max) { toast('Этот уровень откроется с ростом разряда', 'info'); return; }
    DEMO = {
      level: n,
      target: L.targets[Math.floor(Math.random() * L.targets.length)],
      history: [],          // [{who:'М'|'У', text}]
      revealed: false,
      ended: false,
      voice: ttsAvailable(),
      busy: false,
      awaiting: false       // ждём ответ пользователя
    };
    track('feature_opened', { feature: 'meister_demo', level: n });
    renderDemo();
    firstMasterMove();
  }

  function buildSchoolFirst() {
    var L = lvl(DEMO.level);
    return 'Ты — МАСТЕР игры «МЕЙСТЕР-КОД». В этом учебном диалоге ты играешь только Мастера; собеседника (Декларатора) играет ЧЕЛОВЕК-ученик.\n' +
      'Твоя цель — за серию открытых, тёплых, человеческих реплик ПОДВЕСТИ собеседника к тому, чтобы ОН САМ произнёс целевую декларацию уровня «' + L.name + '» (' + L.decl + '): по смыслу совпадающую с «' + DEMO.target + '».\n' +
      'НЕЛЬЗЯ: прямо просить произнести фразу, повторять её за собеседником, играть в угадайку, подсказывать слова, вставлять список вариантов. МОЖНО: открытые вопросы, отражение чувств, лёгкое самораскрытие, паузы.\n' +
      'Стиль: говори на «ты», 1–3 коротких предложения, без канцелярита и без списков. Это первая реплика — открой личную тёплую тему и задай ОДИН ясный открытый вопрос, который мягко повернёт собеседника к зерну будущей декларации. Только реплика Мастера, без префиксов и тегов.';
  }
  function buildSchoolTurn() {
    var L = lvl(DEMO.level);
    var hist = DEMO.history.map(function (m) { return (m.who === 'М' ? 'МАСТЕР' : 'УЧЕНИК-ДЕКЛАРАТОР') + ': ' + m.text; }).join('\n');
    return 'Ты — МАСТЕР игры «МЕЙСТЕР-КОД». Собеседника играет ЧЕЛОВЕК-ученик.\n' +
      'Целевая декларация уровня «' + L.name + '» (' + L.decl + '): по смыслу «' + DEMO.target + '». ' +
      'Подведи к ней собеседника, НЕ прося произнести и не подсказывая словами.\n' +
      'ПРАВИЛА: открытые вопросы, отражение чувств, самораскрытие, паузы — без списков, без угадайки, без прямых просьб. Тон: на «ты», 1–3 коротких предложения, живой язык.\n' +
      'ОСЛОЖНЕНИЯ: если ответ ученика короткий или уклончивый — отрази и углуби. Если ответ почти подвёл к декларации — задай РЕШАЮЩИЙ открытый вопрос, после которого ему останется только произнести её самому (например «договори, что ты сейчас понял про себя?»). Не произноси сам целевую фразу.\n' +
      'РАЗГОВОР:\n' + hist + '\n\nОтветь как Мастер на ПОСЛЕДНЮЮ реплику ученика. Только реплика, без префиксов и тегов.';
  }
  function buildSchoolJudge(userTxt) {
    var L = lvl(DEMO.level);
    return 'Оцени, является ли реплика человека ИСКРЕННЕЙ ДЕКЛАРАЦИЕЙ уровня «' + L.name + '» (' + L.decl + '), близкой по смыслу к целевой: «' + DEMO.target + '».\n' +
      'Считай ДА, если человек сам, от первого лица, утверждает то же по сути (своими словами, в одной короткой фразе) без оговорок «возможно/может быть/наверное».\n' +
      'Считай НЕТ, если он отвечает на вопрос фактом/вопросом, ушёл в сторону, спорит, шутит, повторяет слова Мастера, либо это слабая поверхностная реплика.\n' +
      'РЕПЛИКА ЧЕЛОВЕКА: «' + userTxt + '».\n' +
      'Ответ строго одной строкой: ||SAID:yes|| или ||SAID:no||. Без объяснений.';
  }
  function buildSchoolDebrief(said) {
    var L = lvl(DEMO.level);
    var hist = DEMO.history.map(function (m) { return (m.who === 'М' ? 'МАСТЕР-ФРЕДИ' : 'ТЫ-УЧЕНИК') + ': ' + m.text; }).join('\n');
    return 'Ты — Фреди-тренер. Учебный раунд закончен. Целевая декларация уровня «' + L.name + '»: «' + DEMO.target + '». ' +
      'Итог: ' + (said ? 'ученик произнёс её СВОИМИ словами — резонанс засчитан.' : 'ученик до неё не дошёл (или сказал слишком близко к подсказке).') + '\n\n' +
      'РАЗГОВОР:\n' + hist + '\n\n' +
      'Дай короткий разбор на «ты», тепло и по делу (4–6 предложений, без нумерации):\n' +
      '• какой ход Мастера сработал — назови конкретно реплику/приём;\n' +
      '• что ученик заметил в себе, когда отвечал;\n' +
      '• один конкретный приём из арсенала Мастера, который ученик может попробовать сам в следующий раз (в режиме Тренировка).\n' +
      'Без тегов.';
  }

  function appendDemoLine(t) {
    var box = document.getElementById('mkDemoChat'); if (!box) return;
    var div = document.createElement('div');
    div.className = 'mk-msg ' + (t.who === 'У' ? 'u' : 'f');
    div.innerHTML = '<b style="opacity:.6;font-size:.8rem">' + (t.who === 'У' ? 'Ты (Декларатор)' : '🎓 Мастер-Фреди') + '</b><br>' + esc(t.text);
    box.appendChild(div); box.scrollTop = box.scrollHeight;
    try { var sc = container(); if (sc) sc.scrollTop = sc.scrollHeight; } catch (e) {}
  }
  function cardFaceHtml() {
    var L = lvl(DEMO.level);
    if (DEMO.revealed) {
      return '<div class="mk-target"><div class="lab">✅ Карта открыта · Уровень ' + L.n + ' · ' + esc(L.name) + '</div>' +
        '<div class="phr">«' + esc(DEMO.target) + '»</div>' +
        '<div class="meta">Вот к чему вёл Мастер. Если ты произнёс это по смыслу — резонанс твой.</div></div>';
    }
    return '<div class="mk-target" style="text-align:center"><div class="lab">🂠 Карта закрыта · Уровень ' + L.n + ' · ' + esc(L.name) + '</div>' +
      '<div class="phr" style="font-size:1rem;color:#b9a8ff">Ты играешь Декларатора. Мастер-Фреди ведёт тебя к фразе.</div>' +
      '<div class="meta">Карта откроется, когда ты сам произнесёшь её — своими словами.</div></div>';
  }
  function renderDemo() {
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="mk-wrap">' +
        '<button class="mk-ghost" onclick="MEISTER.school()">← К Школе</button>' +
        '<div id="mkCard">' + cardFaceHtml() + '</div>' +
        '<div class="mk-chat" id="mkDemoChat"></div>' +
        '<div id="mkDemoTyping"></div>' +
        '<div class="mk-inrow"><textarea class="mk-ta" id="mkDemoInput" rows="1" placeholder="Ответь от лица Декларатора — как живой человек…" oninput="MEISTER.grow(this)" onkeydown="MEISTER.demoKeydown(event)"></textarea>' +
        '<button class="mk-send" id="mkDemoMic" onclick="MEISTER.demoMic()" aria-label="Голосом" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16)">🎤</button>' +
        '<button class="mk-send" id="mkDemoSend" onclick="MEISTER.demoSend()" aria-label="Ответить">➤</button></div>' +
        '<div id="mkDemoCtl" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;justify-content:center">' +
          (DEMO.voice ? '<button class="mk-chip" onclick="MEISTER.demoReplay()">🔁 Повторить голосом</button>' : '') +
          (DEMO.voice ? '<button class="mk-chip" onclick="MEISTER.demoMute()">🔇 Выключить голос</button>' : (ttsAvailable() ? '<button class="mk-chip" onclick="MEISTER.demoMute()">🔊 Включить голос</button>' : '')) +
          (DEMO.revealed || DEMO.ended ? '' : '<button class="mk-chip" onclick="MEISTER.demoReveal()">👁 Сдаюсь — показать карту</button>') +
        '</div>' +
        '<div id="mkDemoEnd"></div>' +
      '</div>';
  }
  function refreshDemoUI() {
    var card = document.getElementById('mkCard'); if (card) card.innerHTML = cardFaceHtml();
  }
  function demoTyping(on) { var t = document.getElementById('mkDemoTyping'); if (t) t.innerHTML = on ? '<div class="mk-typing">🎓 Мастер думает…</div>' : ''; }

  async function firstMasterMove() {
    DEMO.busy = true; demoTyping(true);
    var r = await aiGenerate(buildSchoolFirst(), { temperature: 0.85, max_tokens: 220 });
    var txt = (r && r.success && r.content) ? clean(r.content) : 'Расскажи, что у тебя сейчас занимает голову больше всего? Сегодня, прямо сейчас.';
    DEMO.history.push({ who: 'М', text: txt });
    appendDemoLine({ who: 'М', text: txt });
    demoTyping(false);
    await speak(txt);
    DEMO.busy = false; DEMO.awaiting = true;
    var inp = document.getElementById('mkDemoInput'); if (inp) inp.focus();
  }

  async function demoSend() {
    if (DEMO.busy || DEMO.ended) return;
    var inp = document.getElementById('mkDemoInput'); if (!inp) return;
    var txt = inp.value.trim(); if (!txt) return;
    inp.value = ''; grow(inp);
    DEMO.history.push({ who: 'У', text: txt });
    appendDemoLine({ who: 'У', text: txt });
    DEMO.awaiting = false; DEMO.busy = true; demoTyping(true);
    // 1) AI-судья: попал ли пользователь в декларацию?
    var said = false;
    try {
      var j = await aiGenerate(buildSchoolJudge(txt), { temperature: 0.1, max_tokens: 40 });
      if (j && j.success && j.content && /\|\|\s*SAID\s*:\s*yes\s*\|\|/i.test(j.content)) said = true;
    } catch (e) {}
    if (said) { demoTyping(false); DEMO.busy = false; await demoResonance(); return; }
    // 2) Не попал — Мастер делает следующий ход
    var r = await aiGenerate(buildSchoolTurn(), { temperature: 0.85, max_tokens: 280 });
    var reply = (r && r.success && r.content) ? clean(r.content) : 'И что в тебе откликается, когда ты это говоришь? Договори вслух.';
    DEMO.history.push({ who: 'М', text: reply });
    appendDemoLine({ who: 'М', text: reply });
    demoTyping(false);
    await speak(reply);
    DEMO.busy = false; DEMO.awaiting = true;
    if (inp) inp.focus();
  }

  function demoKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); demoSend(); } }

  async function demoResonance() {
    DEMO.revealed = true; refreshDemoUI();
    var p = addResonance(DEMO.level), rk = rankOf(p.res);
    var winBox = document.createElement('div');
    winBox.className = 'mk-win';
    winBox.innerHTML = '🔓 <b>РЕЗОНАНС.</b> Ты сам произнёс это вслух — теперь оно начнёт сбываться.<br>Счёт: ' + p.res + ' · разряд: ' + rk.name;
    var chat = document.getElementById('mkDemoChat'); if (chat) chat.appendChild(winBox);
    demoTyping(true);
    var r = await aiGenerate(buildSchoolDebrief(true), { temperature: 0.6, max_tokens: 320 });
    var d = (r && r.success && r.content) ? clean(r.content) : 'Сработал вопрос Мастера, после которого тебе осталось только договорить мысль вслух. Заметь это движение — это и есть приём «решающий вопрос». В Тренировке попробуй привести Фреди к фразе тем же ходом.';
    demoTyping(false);
    DEMO.history.push({ who: 'М', text: d });
    appendDemoLine({ who: 'М', text: d });
    await speak(d);
    DEMO.ended = true;
    appendDemoEnd();
    track('feature_opened', { feature: 'meister_demo_resonance', level: DEMO.level });
  }

  async function demoReveal() {
    if (DEMO.ended) return;
    DEMO.revealed = true; refreshDemoUI();
    DEMO.ended = true;
    demoTyping(true);
    var r = await aiGenerate(buildSchoolDebrief(false), { temperature: 0.6, max_tokens: 320 });
    var d = (r && r.success && r.content) ? clean(r.content) : 'В этот раз фраза не созрела. Чаще всего мешает спешка и закрытые ответы. Дай Мастеру задать тебе ещё пару кругов — и заметь, какой именно его ход тебя «доводит» до своего слова.';
    demoTyping(false);
    appendDemoLine({ who: 'М', text: 'Я вёл тебя к: «' + DEMO.target + '».' });
    appendDemoLine({ who: 'М', text: d });
    appendDemoEnd();
    track('feature_opened', { feature: 'meister_demo_reveal', level: DEMO.level });
  }

  function appendDemoEnd() {
    var e = document.getElementById('mkDemoEnd'); if (!e) return;
    e.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px">' +
      '<button class="mk-btn mk-primary" style="width:auto;padding:12px 22px" onclick="MEISTER.round(' + DEMO.level + ')">🎯 В Тренировку — этот уровень</button>' +
      '<button class="mk-btn" style="width:auto;padding:12px 22px" onclick="MEISTER.demoBlind()">🎬 Ещё показ</button>' +
      '<button class="mk-btn" style="width:auto;padding:12px 22px" onclick="MEISTER.home()">В меню</button></div>';
    try { var sc = container(); if (sc) sc.scrollTop = sc.scrollHeight; } catch (e2) {}
  }

  // переозвучить последнюю реплику Мастера
  function demoReplay() {
    if (!DEMO || !DEMO.history.length || !DEMO.voice) return;
    for (var i = DEMO.history.length - 1; i >= 0; i--) { if (DEMO.history[i].who === 'М') { stopSpeak(); speak(DEMO.history[i].text); return; } }
  }
  function demoMute() { DEMO.voice = !DEMO.voice; if (!DEMO.voice) stopSpeak(); renderDemo(); }

  // голосовой ввод ответа Декларатора — через тот же voiceManager (STT)
  function demoMic() {
    var inp = document.getElementById('mkDemoInput'); var mic = document.getElementById('mkDemoMic');
    var vm = window.voiceManager;
    if (!vm || typeof vm.startRecording !== 'function') { toast('Голосовой ввод недоступен', 'info'); return; }
    if (DEMO.recording) { try { vm.stopRecording(); } catch (e) {} DEMO.recording = false; if (mic) mic.textContent = '🎤'; return; }
    try {
      stopSpeak();
      vm.sttOnly = true;
      vm.onTranscript = function (t) { if (inp) { inp.value = (inp.value ? inp.value + ' ' : '') + String(t || '').trim(); grow(inp); inp.focus(); } };
      vm.startRecording();
      DEMO.recording = true; if (mic) mic.textContent = '⏹';
    } catch (e) { toast('Микрофон недоступен', 'error'); DEMO.recording = false; }
  }

  // ---------- экспорт ----------
  window.MEISTER = {
    home: home, exit: exit, train: train, school: school,
    round: round, blind: blind, send: send, giveUp: giveUp, grow: grow, keydown: keydown,
    demo: demo, demoBlind: demoBlind, demoSend: demoSend, demoKeydown: demoKeydown,
    demoReplay: demoReplay, demoMute: demoMute, demoMic: demoMic, demoReveal: demoReveal
  };
  window.showMeisterGame = home;
  console.log('✅ meister.js loaded (игра «МЕЙСТЕР-КОД»: тренажёр вытаскивания деклараций)');
})();
