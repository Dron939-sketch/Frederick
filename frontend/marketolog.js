// marketolog.js — игра «Маркетолог» в модуле «Игры» Фреди.
// Тренажёр разговорного гипноза через сторителлинг.
// Ты — РАССКАЗЧИК: по 3 картам (🌲 локация-старт · 🔴 предмет-желание ·
// 🔥 тезис-вывод) строишь историю так, чтобы слушатель (Фреди) погрузился,
// стал героем, захотел предмет и САМ пришёл к выводу. Фреди = слушатель +
// судья + тренер. Озвучка реакции — голосом Фреди (Fish Audio).
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
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 520, temperature: opts.temperature == null ? 0.8 : opts.temperature };
    try {
      if (typeof window.apiCall === 'function') return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
      var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { success: false };
      return await r.json();
    } catch (e) { return { success: false }; }
  }
  function clean(s) { return String(s || '').replace(/\|\|[^|]*\|\|/g, '').trim(); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------- стартовая колода (своя; легко заменить на канон) ----------
  var LOCS = [   // 🌲 Пихтовая — экспозиция (старт, вход в транс)
    'Маяк на рассвете, туман стелется над водой', 'Вокзал за минуту до последнего поезда',
    'Кухня старого дома, пахнет свежим хлебом', 'Горная тропа сразу после дождя',
    'Крыша высотки ночью, город горит огнями внизу', 'Деревенская баня зимой, снег за окном',
    'Палуба корабля перед надвигающимся штормом', 'Библиотека за десять минут до закрытия',
    'Пляж на закате, начинается прилив', 'Ночной плацкарт, мерный стук колёс',
    'Двор детства, та самая скамейка у подъезда', 'Маленькое кафе под проливным дождём'
  ];
  var OBJS = [   // 🔴 Алая — образ/предмет (вплести как желанный)
    'Наручные часы', 'Красный велосипед', 'Старая гитара', 'Кожаный блокнот',
    'Чашка горячего кофе', 'Латунный компас', 'Плёночный фотоаппарат', 'Шерстяной плед',
    'Перочинный нож', 'Бутылка вина твоего года рождения', 'Ключ от собственного дома', 'Пара крепких ботинок'
  ];
  var THESES = [ // 🔥 Знойная — вывод-тезис (слушатель приходит сам)
    'Лучше своё несовершенное, чем чужое идеальное', 'Дорогу осилит идущий',
    'Доверие строится годами, а теряется за миг', 'Семь раз отмерь — один раз отрежь',
    'Под лежачий камень вода не течёт', 'Поспешишь — людей насмешишь',
    'Лучше синица в руках, чем журавль в небе', 'Кто не рискует — тот не меняется',
    'Что посеешь, то и пожнёшь', 'Не откладывай на завтра то, что важно сегодня',
    'Дом там, где тебя ждут', 'Своя ноша не тянет'
  ];

  // ---------- прогресс ----------
  function loadProg() { try { return JSON.parse(localStorage.getItem('marketolog_prog') || 'null') || { told: 0, best: 0 }; } catch (e) { return { told: 0, best: 0 }; } }
  function saveProg(p) { try { localStorage.setItem('marketolog_prog', JSON.stringify(p)); } catch (e) {} }

  // ---------- состояние ----------
  var ST = { loc: '', obj: '', thesis: '', busy: false, recording: false, voice: false };
  function container() { return document.getElementById('screenContainer'); }

  // ---------- голос (Fish Audio TTS + STT — через voiceManager) ----------
  function ttsAvailable() { var v = window.voiceManager; return !!(v && typeof v.textToSpeech === 'function'); }
  function stopSpeak() { try { if (window.voiceManager && typeof window.voiceManager.interrupt === 'function') window.voiceManager.interrupt(); } catch (e) {} }
  function speak(text) {
    if (!ttsAvailable() || !text) return;
    try {
      var mode = (typeof window.getDialogMode === 'function') ? window.getDialogMode() : 'basic';
      window.voiceManager.textToSpeech(text, mode);
    } catch (e) {}
  }

  // ---------- стили ----------
  function injectCSS() {
    if (document.getElementById('mrCSS')) return;
    var s = document.createElement('style'); s.id = 'mrCSS';
    s.textContent = [
      '.mr-wrap{max-width:720px;margin:0 auto;padding:18px 16px 90px;color:#f2f3f5}',
      '.mr-h1{font-size:1.5rem;font-weight:800;letter-spacing:-.01em;margin:6px 0 10px;line-height:1.15;color:#fff}',
      '.mr-lead{font-size:1.02rem;color:#aeb1bd;line-height:1.6;margin-bottom:16px}',
      '.mr-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px;color:#dfe2e8;line-height:1.6;font-size:.96rem}',
      '.mr-card b{color:#fff;font-weight:600}',
      '.mr-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:15px 18px;margin-bottom:10px;color:#fff;font:inherit;font-size:1rem;cursor:pointer;transition:.18s}',
      '.mr-btn:hover{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.5)}',
      '.mr-btn .em{margin-right:10px}',
      '.mr-btn small{display:block;color:#9aa0ad;font-size:.82rem;margin-top:4px;font-weight:400}',
      '.mr-primary{background:linear-gradient(135deg,#f59e0b,#ef6c2f);border:none;color:#fff;text-align:center;font-weight:700}',
      '.mr-primary:hover{filter:brightness(1.06)}',
      '.mr-ghost{display:inline-block;background:none;border:none;color:#9aa0ad;font:inherit;font-size:.9rem;cursor:pointer;padding:6px 0;margin-bottom:6px}',
      '.mr-ghost:hover{color:#fff}',
      '.mr-chip{display:inline-block;padding:8px 13px;margin:0 6px 8px 0;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#e6e8ee;font-size:.86rem;cursor:pointer;transition:.15s}',
      '.mr-chip:hover{border-color:rgba(245,158,11,.55)}',
      '.mr-deck{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}',
      '.mr-cardx{flex:1;min-width:150px;border-radius:14px;padding:13px 14px;border:1px solid;line-height:1.4}',
      '.mr-cardx .t{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;opacity:.8;margin-bottom:6px}',
      '.mr-cardx .v{font-size:1rem;font-weight:600;color:#fff}',
      '.mr-loc{background:linear-gradient(160deg,rgba(34,139,87,.22),rgba(34,139,87,.06));border-color:rgba(52,180,110,.5)}',
      '.mr-obj{background:linear-gradient(160deg,rgba(220,38,38,.22),rgba(220,38,38,.06));border-color:rgba(239,68,68,.55)}',
      '.mr-the{background:linear-gradient(160deg,rgba(245,158,11,.22),rgba(245,158,11,.06));border-color:rgba(245,158,11,.6)}',
      '.mr-ta{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:13px 15px;color:#fff;font:inherit;font-size:.98rem;resize:vertical;min-height:120px;max-height:340px;line-height:1.5}',
      '.mr-ta:focus{outline:none;border-color:rgba(245,158,11,.6)}',
      '.mr-row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}',
      '.mr-mic{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font-size:1.1rem;cursor:pointer;flex-shrink:0}',
      '.mr-react{background:linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.04));border:1px solid rgba(245,158,11,.38);border-radius:14px;padding:14px 16px;margin:10px 0;line-height:1.55;white-space:pre-wrap}',
      '.mr-judge{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 16px;margin:10px 0;line-height:1.55;white-space:pre-wrap}',
      '.mr-score{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}',
      '.mr-pill{padding:6px 11px;border-radius:999px;font-size:.82rem;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05)}',
      '.mr-win{background:linear-gradient(135deg,rgba(22,163,74,.16),rgba(22,163,74,.04));border:1px solid rgba(22,163,74,.45);border-radius:14px;padding:13px 16px;margin:10px 0;line-height:1.5}',
      '.mr-win b{color:#86efac}',
      '.mr-typing{color:#8b90a0;font-size:.85rem;font-style:italic;padding:6px 0}',
      '[data-theme="light"] .mr-wrap{color:#1a1a2e}',
      '[data-theme="light"] .mr-h1{color:#0f1020}',
      '[data-theme="light"] .mr-lead{color:#555}',
      '[data-theme="light"] .mr-card{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#222}',
      '[data-theme="light"] .mr-card b{color:#000}',
      '[data-theme="light"] .mr-btn{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#111}',
      '[data-theme="light"] .mr-btn small{color:#666}',
      '[data-theme="light"] .mr-cardx .v{color:#111}',
      '[data-theme="light"] .mr-ta{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- премиум-гейт ----------
  // «Маркетолог» — премиум-игра. Используем общий флаг window.IS_PREMIUM
  // и общий апселл showPremiumLockPopup (app.js), как остальные платные фичи.
  async function ensurePremium() {
    if (window.IS_PREMIUM === true) return true;
    if ((window.IS_PREMIUM === null || window.IS_PREMIUM === undefined) && typeof window.loadPremiumStatus === 'function') {
      try { await window.loadPremiumStatus(); } catch (e) {}
    }
    return window.IS_PREMIUM === true;
  }
  function openPremium() {
    if (typeof window.showPremiumLockPopup === 'function') { window.showPremiumLockPopup('Маркетолог'); return; }
    if (typeof window.showSettingsScreen === 'function') { try { window.showSettingsScreen(); return; } catch (e) {} }
    toast('Открой раздел «Подписка» в настройках', 'info');
  }
  function renderLocked() {
    injectCSS();
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="mr-wrap">' +
        '<button class="mr-ghost" onclick="MARKETOLOG.exit()">← К списку игр</button>' +
        '<div class="mr-h1">📣 Маркетолог</div>' +
        '<div class="mr-card" style="text-align:center;border-color:rgba(245,158,11,.4)">' +
          '<div style="font-size:2.4rem;margin-bottom:6px">💎</div>' +
          '<div style="font-weight:700;font-size:1.12rem;color:#fff;margin-bottom:8px">Игра доступна с подпиской</div>' +
          '<div style="color:#aeb1bd;line-height:1.55">«Маркетолог» — продвинутый тренажёр разговорного гипноза. Он входит в <b>Фреди Premium</b>: безлимит по времени и доступ к сильным играм.</div>' +
        '</div>' +
        '<button class="mr-btn mr-primary" onclick="MARKETOLOG.openPremium()">💎 Открыть Premium</button>' +
        '<button class="mr-btn" onclick="MARKETOLOG.exit()">← Вернуться к играм</button>' +
      '</div>';
    track('feature_opened', { feature: 'marketolog_locked' });
  }

  // ---------- хаб ----------
  async function home() {
    injectCSS(); stopSpeak();
    var c = container(); if (!c) return;
    if (!(await ensurePremium())) { renderLocked(); return; }
    track('feature_opened', { feature: 'marketolog' });
    var p = loadProg();
    c.innerHTML =
      '<div class="mr-wrap">' +
        '<button class="mr-ghost" onclick="MARKETOLOG.exit()">← К списку игр</button>' +
        '<div class="mr-h1">📣 Маркетолог</div>' +
        '<div class="mr-lead">Тренажёр разговорного гипноза через историю. Тянешь 3 карты и рассказываешь так, чтобы слушатель погрузился, стал героем, захотел предмет — и <b>сам</b> пришёл к выводу. Фреди слушает, отражает транс и разбирает как судья.</div>' +
        '<div class="mr-card" style="font-size:.9rem"><b>3 карты:</b><br>🌲 <b>Локация</b> — откуда начать (вход в транс через детали).<br>🔴 <b>Предмет</b> — вплести в историю как желанный.<br>🔥 <b>Тезис</b> — вывод, к которому слушатель придёт сам (не называя в лоб).</div>' +
        '<div class="mr-card" style="font-size:.86rem;color:#9aa0ad">Историй рассказано: <b style="color:#f0b24b">' + (p.told || 0) + '</b> · лучший результат: <b style="color:#f0b24b">' + scoreName(p.best || 0) + '</b></div>' +
        '<button class="mr-btn mr-primary" onclick="MARKETOLOG.deal()">🎴 Тянуть 3 карты</button>' +
        '<div class="mr-card" style="font-size:.86rem;color:#9aa0ad"><b>Техника (коротко).</b> Тезис → образ в голове → антитезис → доведи его до абсурда (или контраст двух героев) → начни с локации, опиши сенсорно (транс) → нативно вплети предмет как желанный → слушатель сам приходит к тезису.</div>' +
        '<div class="mr-card" style="font-size:.82rem;color:#8b90a0">⚖️ Это про навык влияния словом. Тем же приёмом можно и <i>отвращать</i> от вредного (ирония вместо желания). Сила — значит ответственность.</div>' +
      '</div>';
  }
  function exit() { stopSpeak(); if (typeof window.showKonturScreen === 'function') window.showKonturScreen(); else home(); }
  function scoreName(s) { return s >= 3 ? 'искренне зашло' : s >= 2 ? 'крепко' : s >= 1 ? 'формально' : '—'; }

  // ---------- раздача карт ----------
  function deal() {
    if (window.IS_PREMIUM !== true) { renderLocked(); return; }
    injectCSS(); stopSpeak();
    ST.loc = pick(LOCS); ST.obj = pick(OBJS); ST.thesis = pick(THESES); ST.busy = false;
    track('feature_opened', { feature: 'marketolog_deal' });
    renderRound();
  }
  function deckHtml() {
    return '<div class="mr-deck">' +
      '<div class="mr-cardx mr-loc"><div class="t">🌲 Локация · старт</div><div class="v">' + esc(ST.loc) + '</div></div>' +
      '<div class="mr-cardx mr-obj"><div class="t">🔴 Предмет · вплести</div><div class="v">' + esc(ST.obj) + '</div></div>' +
      '<div class="mr-cardx mr-the"><div class="t">🔥 Тезис · вывод</div><div class="v">' + esc(ST.thesis) + '</div></div>' +
      '</div>';
  }
  function renderRound() {
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="mr-wrap">' +
        '<button class="mr-ghost" onclick="MARKETOLOG.home()">← В меню</button>' +
        '<div class="mr-h1">📣 Твоя раздача</div>' +
        deckHtml() +
        '<div class="mr-card" style="font-size:.88rem;color:#aeb1bd">Расскажи историю: начни с <b>🌲 локации</b> (опиши сенсорно — звук, свет, запах), сделай меня (слушателя) <b>героем</b>, нативно вплети <b>🔴 ' + esc(ST.obj) + '</b> как желанный, и подведи меня к выводу <b>🔥 «' + esc(ST.thesis) + '»</b> — но не называй его в лоб.</div>' +
        '<textarea class="mr-ta" id="mrStory" placeholder="Жил-был… (или нажми 🎤 и рассказывай голосом)"></textarea>' +
        '<div class="mr-row">' +
          '<button class="mr-mic" id="mrMic" onclick="MARKETOLOG.mic()" aria-label="Голосом">🎤</button>' +
          '<button class="mr-btn mr-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="MARKETOLOG.tell()">📖 Рассказать Фреди</button>' +
        '</div>' +
        '<div class="mr-row">' +
          '<button class="mr-chip" onclick="MARKETOLOG.deal()">🔄 Другие карты</button>' +
          '<button class="mr-chip" onclick="MARKETOLOG.example()">👁 Пример мастера</button>' +
        '</div>' +
        '<div id="mrOut"></div>' +
      '</div>';
  }

  function buildJudge(story) {
    return 'Ты — Фреди в игре «Маркетолог» (тренажёр разговорного гипноза через историю). Игрок-РАССКАЗЧИК рассказал историю. Ты — одновременно СЛУШАТЕЛЬ (которого он должен был сделать героем и ввести в лёгкий транс) и СУДЬЯ.\n\n' +
      'КАРТЫ ЗАДАНИЯ:\n• 🌲 Локация (старт/вход в транс): «' + ST.loc + '»\n• 🔴 Предмет (вплести как желанный): «' + ST.obj + '»\n• 🔥 Тезис-вывод (слушатель должен прийти к нему САМ, без прямого называния): «' + ST.thesis + '»\n\n' +
      'ИСТОРИЯ:\n"""\n' + story + '\n"""\n\n' +
      'Ответь СТРОГО в таком формате:\n' +
      'СЛУШАТЕЛЬ: <живая реакция от первого лица, 3–5 предложений: что ты ярко увидел и почувствовал; затянуло ли с локации; был ли ты героем; стал ли предмет «' + ST.obj + '» желанным; к какому выводу ты пришёл сам>\n' +
      'СУДЬЯ: <на «ты», коротко: что сработало + ОДИН конкретный приём усилить — вход в транс через сенсорику локации / антитезис до абсурда или контраст двух героев / нативность предмета / вывод приходит сам>\n' +
      '||TRANCE:N|| где N 0–3 — насколько затянуло в образ.\n||OBJECT:N|| где N 0–3 — предмет вплетён нативно и стал желанным.\n||HERO:yes/no|| — был ли слушатель героем.\n||THESIS:yes/no|| — пришёл ли ты к тезису как к собственному выводу, и он НЕ был назван в лоб.';
  }
  function buildExample() {
    return 'Покажи ОБРАЗЦОВЫЙ короткий рассказ мастера разговорного гипноза для игры «Маркетолог».\n' +
      'Карты: старт-локация «' + ST.loc + '»; предмет-желание «' + ST.obj + '»; вывод-тезис «' + ST.thesis + '» (слушатель должен прийти к нему сам, не называя в лоб).\n' +
      'Требования: начни с сенсорного описания локации (вход в транс — свет, звук, запах); слушатель («ты») — герой истории; через антитезис-до-абсурда или контраст двух героев подведи к тезису; нативно вплети предмет, пометив его желанным; 150–220 слов, живая речь, на «ты». Только текст истории, без пояснений.';
  }

  function parseTags(raw) {
    function num(re) { var m = raw.match(re); return m ? Math.max(0, Math.min(3, parseInt(m[1], 10) || 0)) : 0; }
    function yn(re) { var m = raw.match(re); return m ? /yes/i.test(m[1]) : false; }
    return {
      trance: num(/\|\|\s*TRANCE\s*:\s*(\d)/i),
      object: num(/\|\|\s*OBJECT\s*:\s*(\d)/i),
      hero: yn(/\|\|\s*HERO\s*:\s*(yes|no)/i),
      thesis: yn(/\|\|\s*THESIS\s*:\s*(yes|no)/i)
    };
  }
  function splitReaction(txt) {
    var t = clean(txt);
    var lm = t.match(/СЛУШАТЕЛЬ\s*[:：]\s*([\s\S]*?)(?:\n\s*СУДЬЯ\s*[:：]|$)/i);
    var jm = t.match(/СУДЬЯ\s*[:：]\s*([\s\S]*)$/i);
    return { listener: lm ? lm[1].trim() : t, judge: jm ? jm[1].trim() : '' };
  }

  function micStop() { try { if (window.voiceManager && window.voiceManager.stopRecording) window.voiceManager.stopRecording(); } catch (e) {} ST.recording = false; var m = document.getElementById('mrMic'); if (m) m.textContent = '🎤'; }
  function mic() {
    var inp = document.getElementById('mrStory'); var m = document.getElementById('mrMic');
    var vm = window.voiceManager;
    if (!vm || typeof vm.startRecording !== 'function') { toast('Голосовой ввод недоступен', 'info'); return; }
    if (ST.recording) { micStop(); return; }
    try {
      stopSpeak(); vm.sttOnly = true;
      vm.onTranscript = function (t) { if (inp) { inp.value = (inp.value ? inp.value + ' ' : '') + String(t || '').trim(); inp.focus(); } };
      vm.startRecording(); ST.recording = true; if (m) m.textContent = '⏹';
    } catch (e) { toast('Микрофон недоступен', 'error'); ST.recording = false; }
  }

  async function tell() {
    if (window.IS_PREMIUM !== true) { renderLocked(); return; }
    if (ST.busy) return;
    if (ST.recording) micStop();
    var inp = document.getElementById('mrStory'); if (!inp) return;
    var story = inp.value.trim();
    if (story.length < 40) { toast('Расскажи подробнее — хотя бы несколько предложений', 'info'); return; }
    ST.busy = true;
    var out = document.getElementById('mrOut');
    if (out) out.innerHTML = '<div class="mr-typing">🎧 Фреди слушает и погружается…</div>';
    var r = await aiGenerate(buildJudge(story), { temperature: 0.75, max_tokens: 560 });
    if (!r || !r.success || !r.content) {
      if (out) out.innerHTML = '<div class="mr-card">Связь подвисла — попробуй рассказать ещё раз.</div>';
      ST.busy = false; return;
    }
    var parts = splitReaction(r.content), tags = parseTags(r.content);
    var score = (tags.thesis ? 1 : 0) + ((tags.trance >= 2 && tags.object >= 2) ? 1 : 0) + ((tags.thesis && tags.hero && tags.trance >= 2 && tags.object >= 2) ? 1 : 0);
    var p = loadProg(); p.told = (p.told || 0) + 1; if (score > (p.best || 0)) p.best = score; saveProg(p);

    var verdict = score >= 3 ? '🏆 <b>Искренне зашло.</b> Слушатель прожил историю, захотел предмет и сам пришёл к выводу — это высший уровень.'
      : score >= 2 ? '✅ <b>Крепко.</b> История сработала. Ещё чуть-чуть нативности — и будет высший уровень.'
        : tags.thesis ? '🟡 <b>Формально получилось</b> — к выводу подвёл. Но погружения и желания предмета пока мало.'
          : '⚪️ <b>Вывод не сложился сам.</b> Слушатель не пришёл к тезису — попробуй через антитезис-до-абсурда.';

    var html =
      '<div class="mr-react">🎧 <b>Фреди-слушатель:</b>\n' + esc(parts.listener) + '</div>' +
      (parts.judge ? '<div class="mr-judge">⚖️ <b>Разбор:</b>\n' + esc(parts.judge) + '</div>' : '') +
      '<div class="mr-score">' +
        '<span class="mr-pill">🌀 Транс: ' + tags.trance + '/3</span>' +
        '<span class="mr-pill">🔴 Предмет: ' + tags.object + '/3</span>' +
        '<span class="mr-pill">🦸 Герой: ' + (tags.hero ? 'да' : 'нет') + '</span>' +
        '<span class="mr-pill">🔥 Вывод сам: ' + (tags.thesis ? 'да' : 'нет') + '</span>' +
      '</div>' +
      '<div class="mr-win">' + verdict + '</div>' +
      '<div class="mr-row">' +
        '<button class="mr-chip" onclick="MARKETOLOG.example()">👁 Как сделал бы мастер</button>' +
        '<button class="mr-chip" onclick="MARKETOLOG.deal()">🎴 Новые карты</button>' +
        '<button class="mr-chip" onclick="MARKETOLOG.home()">В меню</button>' +
      '</div>';
    if (out) out.innerHTML = html;
    ST.busy = false;
    if (ttsAvailable() && parts.listener) speak(parts.listener);
    track('feature_opened', { feature: 'marketolog_told', score: score });
    try { var sc = container(); if (sc) sc.scrollTop = sc.scrollHeight; } catch (e) {}
  }

  async function example() {
    if (window.IS_PREMIUM !== true) { renderLocked(); return; }
    if (ST.busy) return;
    ST.busy = true;
    var out = document.getElementById('mrOut');
    if (out) out.innerHTML = '<div class="mr-typing">✍️ Мастер сочиняет образец…</div>';
    var r = await aiGenerate(buildExample(), { temperature: 0.9, max_tokens: 600 });
    var txt = (r && r.success && r.content) ? clean(r.content) : 'Связь подвисла — попробуй ещё раз.';
    if (out) out.innerHTML =
      '<div class="mr-react">👁 <b>Пример мастера:</b>\n' + esc(txt) + '</div>' +
      '<div class="mr-row">' +
        '<button class="mr-chip" onclick="MARKETOLOG.speakExample()">🔊 Озвучить</button>' +
        '<button class="mr-chip" onclick="MARKETOLOG.deal()">🎴 Новые карты</button>' +
        '<button class="mr-chip" onclick="MARKETOLOG.home()">В меню</button>' +
      '</div>';
    ST._lastExample = txt;
    ST.busy = false;
    if (ttsAvailable()) speak(txt);
    track('feature_opened', { feature: 'marketolog_example' });
  }
  function speakExample() { if (ST._lastExample) { stopSpeak(); speak(ST._lastExample); } }

  // ---------- экспорт ----------
  window.MARKETOLOG = {
    home: home, exit: exit, deal: deal, tell: tell, mic: mic, example: example, speakExample: speakExample, openPremium: openPremium
  };
  window.showMarketologGame = home;
  console.log('✅ marketolog.js loaded (игра «Маркетолог»: разговорный гипноз через сторителлинг)');
})();
