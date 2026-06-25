// variatika.js — игра «Вариатика Basic» в модуле «Игры» Фреди.
// Тренажёр системного мышления через паттерны поведения (по книге
// «Вариатика» и инструкции игры): 2 истории одного типа → определи масть →
// предскажи поведение в 3-й ситуации → узнай этот тип в своих знакомых.
// Матрица: 4 масти (СБ/ТФ/УБ/ЧВ) × уровни 6–10 (литл-версия).
// Копится точность чтения по мастям → подсвечивается «слепая масть».
(function () {
  'use strict';

  function api() { return (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io'; }
  function uid() { return (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID || 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t, k) { if (typeof window.showToast === 'function') window.showToast(t, k || 'info'); }
  function track(ev, d) { try { if (window.FrediTracker) window.FrediTracker.track(ev, d || {}); } catch (e) {} }
  async function aiGenerate(prompt, opts) {
    opts = opts || {};
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 620, temperature: opts.temperature == null ? 0.85 : opts.temperature };
    try {
      if (typeof window.apiCall === 'function') return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
      var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { success: false };
      return await r.json();
    } catch (e) { return { success: false }; }
  }
  function clean(s) { return String(s || '').replace(/\|\|[^|]*\|\|/g, '').trim(); }

  // ---------- 4 масти ----------
  var MASTS = {
    SB: { suit: '♠', name: 'СБ', full: 'Силовик-Беспредельщик', param: 'Сила', q: 'Кто здесь сильнее?',
          short: 'сила · кто сильнее', markers: 'боится / применяет / избегает СИЛЫ. Реакции: бежать, замереть, давить, заискивать, звать сильных.' },
    TF: { suit: '♣', name: 'ТФ', full: 'Трудяга-Фермер',        param: 'Выносливость / материальное', q: 'Сколько это стоит?',
          short: 'труд · сколько это стоит', markers: 'считает деньги / усилия / выгоду. Ключи: «не моё», «зачем тратить», «стабильно», «свои руки».' },
    UB: { suit: '♦', name: 'УБ', full: 'Умный-Бедный',          param: 'Мышление', q: 'Почему это так?',
          short: 'мышление · почему это так', markers: 'хочет понять, верит во что-то «логичное», ищет причины. Ключи: «потому что», «это объясняется», «проверил/доказал».' },
    CV: { suit: '♥', name: 'ЧВ', full: 'Человек-Возможность',   param: 'Расчётливость (интеллектуальное зрение)', q: 'Зачем и как обойти?',
          short: 'расчёт · как обойти', markers: 'видит схему / связи / выгоду через людей. Ключи: «подвернулось», «обошёл», «использовал», «договорился».' }
  };
  var MAST_ORDER = ['SB', 'TF', 'UB', 'CV'];
  var LEVELS = {
    6:  'Реактивность · действует из страха, на автомате',
    7:  'Адаптация · хитрит, ищет обходы',
    8:  'Компетентность · считает, видит детали',
    9:  'Осознанность · понимает причины и систему',
    10: 'Баланс · действует контролируемо, в долгую'
  };
  var LEVEL_ORDER = [6, 7, 8, 9, 10];

  // ---------- каноничная матрица паттернов (масть × уровень) ----------
  var PAT = {
    SB: {
      6: { card: 'Кладбищенский смотритель', p: 'Боится любого конфликта и силы — прячется, убегает, делает вид, что не видит. Не может защитить себя.' },
      7: { card: 'Охранник', p: 'Избегает конфликта, но не прячется, а «не замечает» и ищет формальный компромисс: «не видел, не слышал». Пообещает разобраться — и не сделает.' },
      8: { card: 'Спортивный тренер', p: 'Распознаёт силу и подстраивается под сильных: заискивает, «дружит» с опасными, чтобы поднять статус или получить защиту.' },
      9: { card: 'Грузчик / сотрудник ППС', p: 'При конфликте зовёт тех, кто сильнее (друзья, родня, полиция, авторитеты). Использует чужую силу для своих проблем.' },
      10: { card: 'Спортсмен', p: 'Сила есть и готов применить, но сначала пробует мирно. Силу — только если иначе не работает. Контролирует агрессию.' }
    },
    TF: {
      6: { card: 'Лентяй-попрошайка', p: 'Видит только траты. Отказывается от выгоды, если надо вложить своё: «зачем тратить свои деньги».' },
      7: { card: 'Уборщик', p: 'Считает прямые траты и видит выгоду, но боится скрытых: «а вдруг ещё что-то вылезет?» — и от страха отказывается.' },
      8: { card: 'Продавец', p: 'Считает все издержки — и прямые, и косвенные (время, износ, ответственность, нервы, отпуск). Чаще выбирает стабильность.' },
      9: { card: 'Монтажник', p: 'Работает на себя (фриланс/своё дело), продаёт своё время напрямую, оптимизирует издержки — иногда в ущерб качеству.' },
      10: { card: 'Прораб / бригадир', p: 'Организует труд других (бригада, команда), сам не работает руками. Бережёт качество: репутация = капитал.' }
    },
    UB: {
      6: { card: 'Зритель (киноман)', p: 'Верит всему, что «звучит логично» — псевдонаука, конспирология, эзотерика. Воображение без критических фильтров.' },
      7: { card: 'Читающий', p: 'Фильтрует через авторитет: верит экспертам, степеням, книгам, известным людям — но сам не проверяет.' },
      8: { card: 'Юзер', p: 'Верит только проверяемому: «покажите доказательства». Требует эмпирики, отделяет подтверждённое от сомнительного.' },
      9: { card: 'Психолог', p: 'Не довольствуется поверхностью — ищет скрытые причины и мотивы, критически анализирует, замечает подвох.' },
      10: { card: 'Врач', p: 'Систематически применяет научный метод и готовые протоколы предшественников — тщательно, по алгоритму.' }
    },
    CV: {
      6: { card: 'Клептоман', p: 'Примитивная схема без расчёта последствий — берёт/обманывает «в лоб», попадается сразу.' },
      7: { card: 'Актёр-породист', p: 'Копирует чужие схемы без понимания, действует импульсивно: увидел возможность — взял. Быстро попадается.' },
      8: { card: 'Фальсификатор', p: 'Разбирает систему на части, находит слабое место и системно использует дыру.' },
      9: { card: 'Мошенник-аферист', p: 'Видит причины поведения системы и людей, использует это понимание долгосрочно ради своей выгоды.' },
      10: { card: 'Посредник / риелтор', p: 'Видит систему целиком и усиливает закономерности так, чтобы выигрывали все (win-win).' }
    }
  };

  var WARMUPS = [
    { q: '3, 6, 9, 12, …', a: '15', why: 'шаг +3' },
    { q: '2, 6, 18, 54, …', a: '162', why: '×3' },
    { q: '1, 4, 9, 16, …', a: '25', why: 'квадраты: 5²' },
    { q: '5, 10, 20, 40, …', a: '80', why: '×2' },
    { q: '1, 1, 2, 3, 5, 8, …', a: '13', why: 'Фибоначчи: сумма двух предыдущих' },
    { q: '2, 5, 11, 23, …', a: '47', why: '×2 + 1' }
  ];

  // ---------- прогресс (+ точность чтения по мастям) ----------
  // ---------- СКВОЗНОЙ СЧЁТ СЕРИИ «ВАРИАТИКА» (все 3 игры пишут сюда) ----------
  // Звание игрока серии — общее, видно на хабе каждой игры. Шкала по сумме очков:
  // 0/новичок · 10/наблюдатель · 25/практик · 60/читатель людей · 120/Мастер Вариатики.
  function loadSeries() { try { return JSON.parse(localStorage.getItem('variatika_series') || 'null') || { score: 0, byGame: {} }; } catch (e) { return { score: 0, byGame: {} }; } }
  function saveSeries(s) { try { localStorage.setItem('variatika_series', JSON.stringify(s)); } catch (e) {} }
  function seriesAdd(game, points) { if (!points) return; var s = loadSeries(); s.score = (s.score || 0) + points; s.byGame = s.byGame || {}; s.byGame[game] = (s.byGame[game] || 0) + points; saveSeries(s); }
  function seriesRank() {
    var s = loadSeries(), sc = s.score || 0;
    var R = [
      { min: 120, name: 'Мастер Вариатики' },
      { min: 60,  name: 'Читатель людей' },
      { min: 25,  name: 'Практик серии' },
      { min: 10,  name: 'Наблюдатель' },
      { min: 0,   name: 'Новичок серии' }
    ];
    for (var i = 0; i < R.length; i++) if (sc >= R[i].min) return { name: R[i].name, score: sc, next: R[i - 1] || null };
    return { name: R[R.length - 1].name, score: sc, next: R[R.length - 2] };
  }
  function seriesCardHtml(cls) {
    var r = seriesRank();
    var bar = r.next ? '<div style="margin-top:8px;height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.min(100, Math.round(r.score / r.next.min * 100)) + '%;background:linear-gradient(90deg,#10b981,#0ea5b7)"></i></div><div style="font-size:.78rem;color:#9aa0ad;margin-top:5px">До «' + r.next.name + '» — ещё ' + (r.next.min - r.score) + ' очков</div>' : '<div style="font-size:.78rem;color:#fcd34d;margin-top:5px">🏆 Высший разряд серии</div>';
    return '<div class="' + (cls || 'vr-card') + '" style="font-size:.9rem"><b>🏵️ Серия «Вариатика»:</b> звание <b style="color:#6ee7b7">' + r.name + '</b> · <b>' + r.score + '</b> очков' + bar + '</div>';
  }

  function loadProg() {
    var d = { rounds: 0, predHits: 0, byMast: {} };
    MAST_ORDER.forEach(function (k) { d.byMast[k] = { seen: 0, hit: 0 }; });
    try {
      var p = JSON.parse(localStorage.getItem('variatika_prog') || 'null');
      if (!p) return d;
      p.rounds = p.rounds || 0;
      p.predHits = p.predHits || p.hits || 0;
      p.byMast = p.byMast || {};
      MAST_ORDER.forEach(function (k) { p.byMast[k] = p.byMast[k] || { seen: 0, hit: 0 }; });
      return p;
    } catch (e) { return d; }
  }
  function saveProg(p) { try { localStorage.setItem('variatika_prog', JSON.stringify(p)); } catch (e) {} }

  // ---------- состояние раунда ----------
  // phase: 'pattern' (2 истории, выбери масть) → 'predict' (3-я завязка) → 'result'
  var ST = { mast: null, level: null, round: null, phase: '', busy: false, recording: false, mastGuess: null };
  function container() { return document.getElementById('screenContainer'); }

  function injectCSS() {
    if (document.getElementById('vrCSS')) return;
    var s = document.createElement('style'); s.id = 'vrCSS';
    s.textContent = [
      '.vr-wrap{max-width:720px;margin:0 auto;padding:18px 16px 90px;color:#f2f3f5}',
      '.vr-h1{font-size:1.5rem;font-weight:800;margin:6px 0 10px;line-height:1.15;color:#fff}',
      '.vr-lead{font-size:1.02rem;color:#aeb1bd;line-height:1.6;margin-bottom:16px}',
      '.vr-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px;color:#dfe2e8;line-height:1.6;font-size:.96rem}',
      '.vr-card b{color:#fff;font-weight:600}',
      '.vr-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:15px 18px;margin-bottom:10px;color:#fff;font:inherit;font-size:1rem;cursor:pointer;transition:.18s}',
      '.vr-btn:hover{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.5)}',
      '.vr-btn small{display:block;color:#9aa0ad;font-size:.82rem;margin-top:4px;font-weight:400}',
      '.vr-primary{background:linear-gradient(135deg,#10b981,#0ea5b7);border:none;color:#fff;text-align:center;font-weight:700}',
      '.vr-primary:hover{filter:brightness(1.07)}',
      '.vr-ghost{display:inline-block;background:none;border:none;color:#9aa0ad;font:inherit;font-size:.9rem;cursor:pointer;padding:6px 0;margin-bottom:6px}',
      '.vr-ghost:hover{color:#fff}',
      '.vr-chip{display:inline-block;padding:9px 15px;margin:0 7px 8px 0;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#e6e8ee;font-size:.92rem;cursor:pointer;transition:.15s}',
      '.vr-chip:hover{border-color:rgba(16,185,129,.55)}',
      '.vr-mast{display:inline-flex;align-items:center;gap:7px;padding:11px 16px;margin:0 8px 8px 0;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;font:inherit;font-size:1rem;cursor:pointer;transition:.15s}',
      '.vr-mast:hover{border-color:rgba(16,185,129,.6);background:rgba(16,185,129,.1)}',
      '.vr-mast .s{font-size:1.25rem;line-height:1}',
      '.vr-mrow{display:flex;align-items:center;gap:10px;margin:7px 0;font-size:.9rem}',
      '.vr-mrow .nm{width:58px;flex-shrink:0;color:#e6e8ee}',
      '.vr-bar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}',
      '.vr-bar i{display:block;height:100%;background:linear-gradient(90deg,#10b981,#0ea5b7)}',
      '.vr-story{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-left:3px solid #10b981;border-radius:10px;padding:12px 14px;margin-bottom:10px;line-height:1.55;font-size:.95rem}',
      '.vr-story .lab{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#6ee7b7;margin-bottom:5px}',
      '.vr-reveal{background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(16,185,129,.04));border:1px solid rgba(16,185,129,.4);border-radius:14px;padding:14px 16px;margin:10px 0;line-height:1.55}',
      '.vr-q3{background:linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.04));border:1px solid rgba(245,158,11,.4);border-radius:14px;padding:14px 16px;margin:10px 0;line-height:1.55}',
      '.vr-ta{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 14px;color:#fff;font:inherit;font-size:.96rem;resize:vertical;min-height:80px;line-height:1.5}',
      '.vr-ta:focus{outline:none;border-color:rgba(16,185,129,.6)}',
      '.vr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.vr-mic{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font-size:1.1rem;cursor:pointer;flex-shrink:0}',
      '.vr-ok{background:linear-gradient(135deg,rgba(22,163,74,.18),rgba(22,163,74,.05));border:1px solid rgba(22,163,74,.5);border-radius:14px;padding:13px 16px;margin:10px 0;line-height:1.5}',
      '.vr-no{background:linear-gradient(135deg,rgba(239,68,68,.14),rgba(239,68,68,.04));border:1px solid rgba(239,68,68,.45);border-radius:14px;padding:13px 16px;margin:10px 0;line-height:1.5}',
      '.vr-typing{color:#8b90a0;font-size:.85rem;font-style:italic;padding:6px 0}',
      '.vr-warm{font-size:.86rem;color:#9aa0ad;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.18);border-radius:12px;padding:10px 14px;margin-bottom:12px}',
      '[data-theme="light"] .vr-wrap{color:#1a1a2e}',
      '[data-theme="light"] .vr-h1{color:#0f1020}',
      '[data-theme="light"] .vr-lead{color:#555}',
      '[data-theme="light"] .vr-card{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#222}',
      '[data-theme="light"] .vr-card b{color:#000}',
      '[data-theme="light"] .vr-btn{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#111}',
      '[data-theme="light"] .vr-btn small{color:#666}',
      '[data-theme="light"] .vr-mast{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}',
      '[data-theme="light"] .vr-story{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.08)}',
      '[data-theme="light"] .vr-ta{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- премиум-гейт (как у Progressive/Intensive) ----------
  async function ensurePremium() {
    if (window.IS_PREMIUM === true) return true;
    if (window.IS_PREMIUM == null && typeof window.loadPremiumStatus === 'function') {
      try { await window.loadPremiumStatus(); } catch (e) {}
    }
    return window.IS_PREMIUM === true;
  }
  function openPremium() {
    if (typeof window.showPremiumLockPopup === 'function') { window.showPremiumLockPopup('Вариатика Basic'); return; }
    if (typeof window.showSettingsScreen === 'function') { try { window.showSettingsScreen(); return; } catch (e) {} }
    toast('Открой раздел «Подписка» в настройках', 'info');
  }
  function renderLocked() {
    injectCSS();
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.exit()">← К списку игр</button>' +
        '<div class="vr-h1">🔮 Вариатика — Basic</div>' +
        '<div class="vr-card" style="text-align:center;border-color:rgba(16,185,129,.4)">' +
          '<div style="font-size:2.4rem;margin-bottom:6px">💎</div>' +
          '<div style="font-weight:700;font-size:1.12rem;color:#fff;margin-bottom:8px">Игра доступна с подпиской</div>' +
          '<div style="color:#aeb1bd;line-height:1.55">«Вариатика — Basic» — первая часть серии: тренажёр чтения людей. С подпиской открыты все три «Вариатики» (Basic / Progressive / Intensive) и другие сильные игры.</div>' +
        '</div>' +
        '<button class="vr-btn vr-primary" onclick="VARIATIKA.openPremium()">💎 Открыть Premium</button>' +
        '<button class="vr-btn" onclick="VARIATIKA.exit()">← Вернуться к играм</button>' +
      '</div>';
    track('feature_opened', { feature: 'variatika_locked' });
  }

  // ---------- хаб ----------
  async function home() {
    injectCSS();
    if (!(await ensurePremium())) { renderLocked(); return; }
    track('feature_opened', { feature: 'variatika' });
    var c = container(); if (!c) return;
    var p = loadProg();
    var predAcc = p.rounds ? Math.round(p.predHits / p.rounds * 100) : 0;
    var rows = '', blind = null, blindPct = 101;
    MAST_ORDER.forEach(function (k) {
      var b = p.byMast[k], m = MASTS[k];
      var pct = b.seen ? Math.round(b.hit / b.seen * 100) : null;
      rows += '<div class="vr-mrow"><span class="nm">' + m.suit + ' ' + m.name + '</span>' +
        '<div style="flex:1"><div class="vr-bar"><i style="width:' + (pct == null ? 0 : pct) + '%"></i></div></div>' +
        '<span style="width:58px;text-align:right;color:#9aa0ad">' + (pct == null ? '—' : pct + '%') + '</span></div>';
      if (b.seen >= 2 && pct < blindPct) { blindPct = pct; blind = m; }
    });
    var chips = LEVEL_ORDER.map(function (n) { return '<span class="vr-chip" onclick="VARIATIKA.start(' + n + ')">Ур. ' + n + ' · ' + esc(LEVELS[n]) + '</span>'; }).join('');
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.exit()">← К списку игр</button>' +
        '<div class="vr-h1">🔮 Вариатика — Basic</div>' +
        '<div class="vr-lead"><b>Тренажёр чтения людей.</b> Учишься по поведению определять, <i>что движет человеком</i> — и предсказывать, как он поступит дальше. Без этого приходится «удивляться людям» снова и снова.</div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">🎁 Что ты получишь</div>' +
          '<div style="font-size:.92rem;line-height:1.55"><b>· В работе:</b> понимать, кому какую задачу можно доверить, а кому — нет.<br>' +
          '<b>· В переговорах и продажах:</b> подбирать ключ под человека (один платит за стабильность, другой — за статус, третий — за идею).<br>' +
          '<b>· В отношениях:</b> перестать ждать от человека того, чего он по своей «масти» дать не может.<br>' +
          '<b>· В безопасности:</b> раньше замечать манипулятора и того, кто «обходит систему».</div></div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">🎲 Как играет (3 шага)</div>' +
          '<div style="font-size:.92rem;line-height:1.55"><b>1.</b> Фреди даёт <b>2 истории</b> одного типа — ты ищешь, что общего.<br>' +
          '<b>2.</b> Выбираешь <b>масть</b> (♠♣♦♥) — Фреди говорит, угадал или нет, и раскрывает паттерн.<br>' +
          '<b>3.</b> Даёт <b>3-ю ситуацию (без развязки)</b> — ты предсказываешь поведение → проверка → можешь узнать этот тип в своих знакомых.</div></div>' +
        seriesCardHtml('vr-card') +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">🃏 4 масти — 4 «двигателя»</div>' +
          '<div style="font-size:.92rem;line-height:1.6">' +
          '<div><b>♠ СБ — Сила.</b> Главный вопрос: «кто здесь сильнее?» Реагирует на угрозу.</div>' +
          '<div><b>♣ ТФ — Труд.</b> Главный вопрос: «сколько это стоит?» Считает усилия и деньги.</div>' +
          '<div><b>♦ УБ — Мышление.</b> Главный вопрос: «почему это так?» Хочет понять и объяснить.</div>' +
          '<div><b>♥ ЧВ — Расчёт.</b> Главный вопрос: «зачем и как обойти?» Видит схемы и связи.</div>' +
          '<div style="margin-top:6px;color:#9aa0ad;font-size:.86rem">Уровни 6→10 — от <i>реакции из страха</i> до <i>контролируемого баланса</i>.</div></div></div>' +
        (p.rounds ? ('<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">📊 Твоя точность чтения мастей</div>' + rows +
          '<div style="font-size:.84rem;color:#9aa0ad;margin-top:8px">Прогнозов точно: ' + p.predHits + '/' + p.rounds + ' (' + predAcc + '%)' +
          (blind ? '.<br>Хуже всего читаешь <b style="color:#fca5a5">' + blind.suit + ' ' + blind.name + '</b> — это твоя <b>слепая масть</b>. Часто это тип, противоположный твоему.' : '') + '</div></div>') : '') +
        '<button class="vr-btn vr-primary" onclick="VARIATIKA.start(0)">🎲 Режим «Паттерн»: 2 истории → найди закономерность</button>' +
        '<button class="vr-btn" onclick="VARIATIKA.classify()">🃏 Режим «Определи карту»: 1 история → угадай масть и уровень</button>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">Или выбери уровень</div><div>' + chips + '</div></div>' +
        '<div class="vr-card" style="font-size:.82rem;color:#8b90a0">💡 Цель — не вызубрить систему, а натренировать глаз. Слепая масть появится через пару раундов: это тип, которого ты в жизни узнаёшь хуже всего — и которого тебе важнее всего научиться читать.</div>' +
      '</div>';
  }
  function exit() { if (typeof window.showKonturScreen === 'function') window.showKonturScreen(); else home(); }

  // ---------- РЕЖИМ «ОПРЕДЕЛИ КАРТУ» — одна история → угадай масть+уровень ----------
  var CST = { mast: null, level: null, story: '', busy: false, mastPick: null, lvlPick: null };
  async function classify() {
    if (window.IS_PREMIUM !== true) { renderLocked(); return; }
    injectCSS();
    var mast = MAST_ORDER[Math.floor(Math.random() * MAST_ORDER.length)];
    var level = LEVEL_ORDER[Math.floor(Math.random() * LEVEL_ORDER.length)];
    CST = { mast: mast, level: level, story: '', busy: true, mastPick: null, lvlPick: null };
    track('feature_opened', { feature: 'variatika_classify', mast: mast, level: level });
    var c = container(); if (c) c.innerHTML = '<div class="vr-wrap"><button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
      '<div class="vr-h1">🃏 Определи карту</div><div class="vr-typing">Фреди подбирает историю…</div></div>';
    var pat = PAT[mast][level];
    var prompt = 'Сгенерируй ОДНУ короткую бытовую историю для тренажёра «Вариатика». Тип человека: масть ' + MASTS[mast].full + ' (' + MASTS[mast].param + '), уровень ' + level + '. Паттерн: ' + pat.p + '\n' +
      'На «ты», живым русским, 3–5 предложений, обычная профессия, конкретная ситуация. ЯВНО проявляет паттерн, развязка показана. НЕ называй масть, уровень и слово «паттерн» в тексте. Только текст истории, без вступлений.';
    var r = await aiGenerate(prompt, { temperature: 0.9, max_tokens: 280 });
    CST.story = (r && r.success && r.content) ? clean(r.content) : ('Человек в типичной ситуации проявил поведение «' + pat.card + '». ' + pat.p);
    CST.busy = false;
    renderClassify();
  }
  function renderClassify() {
    var c = container(); if (!c) return;
    var mastBtns = MAST_ORDER.map(function (k) {
      var sel = (CST.mastPick === k);
      return '<button class="vr-mast' + (sel ? '" style="border-color:#10b981;background:rgba(16,185,129,.18)' : '') + '" onclick="VARIATIKA.classMast(\'' + k + '\')"><span class="s">' + MASTS[k].suit + '</span> ' + esc(MASTS[k].name) + '</button>';
    }).join('');
    var lvlBtns = LEVEL_ORDER.map(function (n) {
      var sel = (CST.lvlPick === n);
      return '<span class="vr-chip' + (sel ? ' sel" style="border-color:#10b981;background:rgba(16,185,129,.18)' : '') + '" onclick="VARIATIKA.classLvl(' + n + ')">Ур. ' + n + '</span>';
    }).join('');
    var ready = (CST.mastPick && CST.lvlPick != null);
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-h1">🃏 Определи карту</div>' +
        '<div class="vr-lead">Перед тобой одна история. Угадай <b>масть и уровень</b> — как будто вытаскиваешь карту из колоды.</div>' +
        '<div class="vr-story"><div class="lab">История</div>' + esc(CST.story) + '</div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">Какая масть?</div>' + mastBtns + '</div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:8px">Какой уровень?</div>' + lvlBtns + '</div>' +
        '<button class="vr-btn vr-primary"' + (ready ? '' : ' style="opacity:.5;pointer-events:none"') + ' onclick="VARIATIKA.classCheck()">Проверить</button>' +
      '</div>';
  }
  function classMast(k) { CST.mastPick = k; renderClassify(); }
  function classLvl(n) { CST.lvlPick = n; renderClassify(); }
  function classCheck() {
    if (!CST.mastPick || CST.lvlPick == null) return;
    var okMast = (CST.mastPick === CST.mast);
    var okLvl = (CST.lvlPick === CST.level);
    var pts = (okMast ? 1 : 0) + (okLvl ? 2 : 0); // масть +1, уровень +2 (труднее)
    if (pts) seriesAdd('basic', pts);
    var pat = PAT[CST.mast][CST.level], m = MASTS[CST.mast];
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-h1">' + (okMast && okLvl ? '✅ В точку' : (okMast || okLvl ? '🔄 Наполовину' : '❌ Мимо')) + '</div>' +
        '<div class="' + (okMast && okLvl ? 'vr-ok' : 'vr-no') + '">' +
          '<b>Твой ответ:</b> ' + (CST.mastPick ? MASTS[CST.mastPick].suit + ' ' + MASTS[CST.mastPick].name : '?') + ' · ур. ' + (CST.lvlPick || '?') + '<br>' +
          '<b>Правильно:</b> ' + m.suit + ' ' + esc(m.name) + ' · ур. ' + CST.level + (pts ? '<br><br>+' + pts + ' к серии' : '') +
        '</div>' +
        '<div class="vr-reveal"><b>Карта-архетип:</b> «' + esc(pat.card) + '»<br><span style="color:#aeb1bd">' + esc(pat.p) + '</span></div>' +
        '<button class="vr-btn vr-primary" onclick="VARIATIKA.classify()">🃏 Ещё карта</button>' +
        '<button class="vr-btn" onclick="VARIATIKA.home()">В меню</button>' +
      '</div>';
    track('feature_opened', { feature: 'variatika_classify_done', okMast: okMast ? 1 : 0, okLvl: okLvl ? 1 : 0 });
  }

  // ---------- раунд ----------
  function start(level) {
    if (window.IS_PREMIUM !== true) { renderLocked(); return; }
    injectCSS();
    var lvl = level && LEVELS[level] ? level : LEVEL_ORDER[Math.floor(Math.random() * LEVEL_ORDER.length)];
    var mast = MAST_ORDER[Math.floor(Math.random() * MAST_ORDER.length)];
    ST = { mast: mast, level: lvl, round: null, phase: 'gen', busy: true, recording: false, mastGuess: null };
    track('feature_opened', { feature: 'variatika_round', mast: mast, level: lvl });
    renderGen();
    genRound();
  }
  function renderGen() {
    var c = container(); if (!c) return;
    c.innerHTML = '<div class="vr-wrap"><button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
      '<div class="vr-h1">🔮 Раунд готовится…</div><div class="vr-typing">Фреди подбирает две истории одного типа…</div></div>';
  }

  function buildGen() {
    var m = MASTS[ST.mast], pat = PAT[ST.mast][ST.level];
    return 'Ты — генератор заданий для тренажёра «Вариатика» (чтение паттернов поведения).\n' +
      'Тип человека: масть ' + m.full + ' (' + m.param + '), уровень ' + ST.level + ' (' + LEVELS[ST.level] + ').\n' +
      'ПАТТЕРН этого типа: ' + pat.p + '\n\n' +
      'Сгенерируй РОВНО в таком формате (без вступлений), на «ты», живым русским, бытовые ситуации с обычными профессиями:\n' +
      'ИСТОРИЯ1: <2–4 предложения: человек в ситуации ярко проявляет этот паттерн. Концовка показана.>\n' +
      'ИСТОРИЯ2: <2–4 предложения: ДРУГАЯ профессия/ситуация, тот же паттерн. Концовка показана.>\n' +
      'ЗАВЯЗКА3: <2–4 предложения: ТРЕТЬЯ ситуация, только завязка — БЕЗ развязки, поставь героя перед выбором/угрозой.>\n' +
      'РАЗВЯЗКА3: <1–3 предложения: как герой поведёт себя по этому паттерну — каноничный исход.>\n' +
      'Не называй масть и уровень внутри историй. Истории должны быть про РАЗНЫХ людей.';
  }
  function parseRound(raw) {
    function grab(label, next) {
      var re = new RegExp(label + '\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:' + next + ')\\s*[:：]|$)', 'i');
      var m = String(raw || '').match(re); return m ? m[1].trim() : '';
    }
    return {
      s1: grab('ИСТОРИЯ1', 'ИСТОРИЯ2|ЗАВЯЗКА3|РАЗВЯЗКА3'),
      s2: grab('ИСТОРИЯ2', 'ЗАВЯЗКА3|РАЗВЯЗКА3'),
      setup: grab('ЗАВЯЗКА3', 'РАЗВЯЗКА3'),
      outcome: grab('РАЗВЯЗКА3', '$')
    };
  }
  async function genRound() {
    var r = await aiGenerate(buildGen(), { temperature: 0.9, max_tokens: 640 });
    var parsed = (r && r.success && r.content) ? parseRound(r.content) : null;
    if (!parsed || !parsed.s1 || !parsed.s2 || !parsed.setup || !parsed.outcome) {
      var c = container(); if (c) c.innerHTML = '<div class="vr-wrap"><button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-card">Не удалось собрать раунд. Попробуем ещё раз?</div>' +
        '<button class="vr-btn vr-primary" onclick="VARIATIKA.start(' + ST.level + ')">🔄 Ещё раунд</button></div>';
      ST.busy = false; return;
    }
    ST.round = parsed; ST.phase = 'pattern'; ST.busy = false;
    renderPattern();
  }

  // фаза 1: две истории → определи масть
  function renderPattern() {
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-h1">🔍 Шаг 1 из 3: определи масть</div>' +
        '<div class="vr-lead">Прочитай обе истории. Они про <b>один тип</b> людей. Какой главный «двигатель» у этого типа — сила, труд, мышление или расчёт?</div>' +
        '<div class="vr-story"><div class="lab">История 1</div>' + esc(ST.round.s1) + '</div>' +
        '<div class="vr-story"><div class="lab">История 2</div>' + esc(ST.round.s2) + '</div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:6px">На что смотреть:</div>' +
          '<div style="font-size:.88rem;color:#aeb1bd;line-height:1.55">' +
          '<b>♠ СБ — сила:</b> ' + esc(MASTS.SB.markers) + '<br>' +
          '<b>♣ ТФ — труд:</b> ' + esc(MASTS.TF.markers) + '<br>' +
          '<b>♦ УБ — мышление:</b> ' + esc(MASTS.UB.markers) + '<br>' +
          '<b>♥ ЧВ — расчёт:</b> ' + esc(MASTS.CV.markers) +
          '</div></div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:10px">Твой выбор:</div>' +
          '<button class="vr-mast" onclick="VARIATIKA.guessMast(\'SB\')"><span class="s">♠</span> СБ · сила</button>' +
          '<button class="vr-mast" onclick="VARIATIKA.guessMast(\'TF\')"><span class="s">♣</span> ТФ · труд</button>' +
          '<button class="vr-mast" onclick="VARIATIKA.guessMast(\'UB\')"><span class="s">♦</span> УБ · мышление</button>' +
          '<button class="vr-mast" onclick="VARIATIKA.guessMast(\'CV\')"><span class="s">♥</span> ЧВ · расчёт</button>' +
        '</div>' +
      '</div>';
  }
  function guessMast(key) {
    if (ST.phase !== 'pattern' || !MASTS[key]) return;
    var correct = (key === ST.mast);
    ST.phase = 'predict'; ST.mastGuess = correct;
    var p = loadProg(); p.byMast[ST.mast].seen++; if (correct) p.byMast[ST.mast].hit++; saveProg(p);
    renderPredict(correct, key);
  }
  // фаза 2: показали масть/паттерн → предскажи третьего
  function renderPredict(correct, guessKey) {
    var pat = PAT[ST.mast][ST.level], m = MASTS[ST.mast];
    var banner = correct
      ? '<div class="vr-ok">✅ Масть угадал: <b>' + m.suit + ' ' + esc(m.name) + '</b></div>'
      : '<div class="vr-no">❌ Ты выбрал ' + (MASTS[guessKey] ? MASTS[guessKey].suit + ' ' + MASTS[guessKey].name : '?') + ', а это <b>' + m.suit + ' ' + esc(m.name) + '</b></div>';
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-h1">🎯 Шаг 2 из 3: предскажи третьего</div>' +
        banner +
        '<div class="vr-reveal"><b>' + m.suit + ' ' + esc(m.name) + ' · уровень ' + ST.level + '</b> — «' + esc(pat.card) + '»<br><span style="color:#aeb1bd">Паттерн: ' + esc(pat.p) + '</span></div>' +
        '<div class="vr-q3"><b>Ситуация 3.</b> ' + esc(ST.round.setup) + '</div>' +
        '<div style="font-size:.9rem;color:#aeb1bd;margin:4px 0 6px">Как поведёт себя этот человек? Предскажи:</div>' +
        '<textarea class="vr-ta" id="vrPred" placeholder="Мой прогноз: он…"></textarea>' +
        '<div class="vr-row">' +
          '<button class="vr-mic" id="vrMic" onclick="VARIATIKA.mic()" aria-label="Голосом">🎤</button>' +
          '<button class="vr-btn vr-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="VARIATIKA.predict()">Проверить прогноз</button>' +
        '</div>' +
      '</div>';
    var t = document.getElementById('vrPred'); if (t) t.focus();
  }

  function micStop() { try { if (window.voiceManager && window.voiceManager.stopRecording) window.voiceManager.stopRecording(); } catch (e) {} ST.recording = false; var m = document.getElementById('vrMic'); if (m) m.textContent = '🎤'; }
  function mic() {
    var inp = document.getElementById('vrPred'); var micBtn = document.getElementById('vrMic');
    var vm = window.voiceManager;
    if (!vm || typeof vm.startRecording !== 'function') { toast('Голосовой ввод недоступен', 'info'); return; }
    if (ST.recording) { micStop(); return; }
    try {
      vm.sttOnly = true;
      vm.onTranscript = function (t) { if (inp) { inp.value = (inp.value ? inp.value + ' ' : '') + String(t || '').trim(); inp.focus(); } };
      vm.startRecording(); ST.recording = true; if (micBtn) micBtn.textContent = '⏹';
    } catch (e) { toast('Микрофон недоступен', 'error'); ST.recording = false; }
  }

  function buildJudge(pred) {
    var pat = PAT[ST.mast][ST.level];
    return 'Тренажёр «Вариатика». Паттерн типа: ' + pat.p + '\n' +
      'Каноничная развязка 3-й ситуации: «' + ST.round.outcome + '».\n' +
      'Прогноз игрока: «' + pred + '».\n\n' +
      'Совпал ли прогноз игрока с развязкой ПО СМЫСЛУ (он уловил паттерн)? Ответь СТРОГО:\n' +
      'РАЗБОР: <1–2 предложения, на «ты»: что игрок уловил/упустил в паттерне>\n' +
      '||OK:yes|| или ||OK:no||';
  }
  async function predict() {
    if (ST.busy) return;
    if (ST.recording) micStop();
    var inp = document.getElementById('vrPred'); if (!inp) return;
    var pred = inp.value.trim();
    if (pred.length < 5) { toast('Напиши прогноз — как он поступит?', 'info'); return; }
    ST.busy = true;
    var r = await aiGenerate(buildJudge(pred), { temperature: 0.2, max_tokens: 160 });
    var ok = false, note = '';
    if (r && r.success && r.content) { ok = /\|\|\s*OK\s*:\s*yes\s*\|\|/i.test(r.content); note = clean(r.content); }
    var p = loadProg(); p.rounds = (p.rounds || 0) + 1; if (ok) p.predHits = (p.predHits || 0) + 1; saveProg(p);
    // очки в серию: масть угадал = +1, прогноз попал = +2 (макс. 3 за раунд)
    var seriesPts = (ST.mastGuess ? 1 : 0) + (ok ? 2 : 0); if (seriesPts) seriesAdd('basic', seriesPts);
    var warm = WARMUPS[Math.floor(Math.random() * WARMUPS.length)];
    var m = MASTS[ST.mast], pat = PAT[ST.mast][ST.level];
    var c = container(); if (!c) { ST.busy = false; return; }
    c.innerHTML =
      '<div class="vr-wrap">' +
        '<button class="vr-ghost" onclick="VARIATIKA.home()">← В меню</button>' +
        '<div class="vr-h1">Шаг 3 из 3 · ' + (ok ? '✅ Паттерн пойман' : '🔄 Почти') + '</div>' +
        '<div class="' + (ok ? 'vr-ok' : 'vr-no') + '"><b>Твой прогноз:</b> ' + esc(pred) + (note ? '<br><br>' + esc(note) : '') + '</div>' +
        '<div class="vr-reveal"><b>Как было на самом деле:</b><br>' + esc(ST.round.outcome) + '</div>' +
        '<div class="vr-card"><div style="font-weight:700;margin-bottom:6px">🪞 Узнай в жизни</div>' +
          '<div style="font-size:.9rem;color:#aeb1bd;margin-bottom:8px">Кого из знакомых ты узнаёшь в типе <b>' + m.suit + ' ' + esc(m.name) + '</b> · «' + esc(pat.card) + '»? Как он повёл бы себя?</div>' +
          '<textarea class="vr-ta" id="vrLife" placeholder="Это похоже на… (имя/роль и в чём)"></textarea>' +
          '<button class="vr-btn" style="margin-top:8px" onclick="VARIATIKA.applyTransfer()">Примерить на него →</button>' +
          '<div id="vrLifeOut"></div>' +
        '</div>' +
        '<div class="vr-warm">🔢 Разминка: <b>' + esc(warm.q) + '</b> &nbsp;→&nbsp; <span onclick="this.innerHTML=\'<b style=color:#6ee7b7>' + warm.a + '</b> (' + esc(warm.why) + ')\'" style="cursor:pointer;text-decoration:underline dotted">ответ</span></div>' +
        '<button class="vr-btn vr-primary" onclick="VARIATIKA.start(' + ST.level + ')">🎲 Ещё раунд (ур. ' + ST.level + ')</button>' +
        '<button class="vr-btn" onclick="VARIATIKA.start(0)">🔀 Случайный уровень</button>' +
        '<button class="vr-btn" onclick="VARIATIKA.home()">В меню</button>' +
      '</div>';
    ST.busy = false;
    track('feature_opened', { feature: 'variatika_predict', ok: ok ? 1 : 0, mast: ST.mast, level: ST.level, mastOk: ST.mastGuess ? 1 : 0 });
  }

  // привязка к жизни: примерить тип на реального знакомого
  async function applyTransfer() {
    var inp = document.getElementById('vrLife'), out = document.getElementById('vrLifeOut');
    if (!inp) return;
    var txt = inp.value.trim();
    if (txt.length < 3) { toast('Опиши, кого узнал', 'info'); return; }
    if (ST.busy) return; ST.busy = true;
    if (out) out.innerHTML = '<div class="vr-typing">Фреди примеряет тип…</div>';
    var m = MASTS[ST.mast], pat = PAT[ST.mast][ST.level];
    var prompt = 'Игрок тренажёра «Вариатика» узнал в типе «' + m.full + ' · ' + pat.card + '» (паттерн: ' + pat.p + ') своего знакомого: «' + txt + '».\n' +
      'Ответь коротко, на «ты», по-человечески (3–4 предложения, без диагнозов и ярлыков): похоже ли это на паттерн, и дай ОДИН практичный совет — как с таким человеком эффективнее общаться или чего от него ждать. Без воды.';
    var r = await aiGenerate(prompt, { temperature: 0.7, max_tokens: 240 });
    var d = (r && r.success && r.content) ? clean(r.content) : 'Если поведение совпадает с паттерном — тип ты узнал верно. С таким человеком работает то, что отвечает его главному мотиву, а не давит против него.';
    if (out) out.innerHTML = '<div class="vr-reveal" style="margin-top:10px">🪞 ' + esc(d) + '</div>';
    ST.busy = false;
    track('feature_opened', { feature: 'variatika_transfer', mast: ST.mast });
  }

  // ---------- экспорт ----------
  window.VARIATIKA = {
    home: home, exit: exit, openPremium: openPremium, start: start, guessMast: guessMast, predict: predict, mic: mic, applyTransfer: applyTransfer,
    classify: classify, classMast: classMast, classLvl: classLvl, classCheck: classCheck
  };
  window.showVariatikaGame = home;
  console.log('✅ variatika.js loaded (игра «Вариатика Basic»: паттерны поведения + слепая масть)');
})();
