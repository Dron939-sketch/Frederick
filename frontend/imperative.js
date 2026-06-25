// imperative.js — игра «ИМПЕРАТИВ» в модуле «Игры» Фреди.
// Развитие высших навыков СБ-масти по канону «Вариатики» А. Мейстера.
// 9 уровней пути СБ (Замри → ... → Создавай правила насилия). Для каждого
// уровня — теория + кейс из жизни + AI-наставник. Premium.
(function () {
  'use strict';
  function api() { return (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io'; }
  function uid() { return (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID || 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t, k) { if (typeof window.showToast === 'function') window.showToast(t, k || 'info'); }
  function track(ev, d) { try { if (window.FrediTracker) window.FrediTracker.track(ev, d || {}); } catch (e) {} }
  async function aiGenerate(prompt, opts) {
    opts = opts || {};
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 460, temperature: opts.temperature == null ? 0.7 : opts.temperature };
    try {
      if (typeof window.apiCall === 'function') return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
      var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { success: false };
      return await r.json();
    } catch (e) { return { success: false }; }
  }
  function clean(s) { return String(s || '').replace(/\|\|[^|]*\|\|/g, '').trim(); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  // ---------- 9 УРОВНЕЙ ПУТИ СБ ----------
  // Канон: книга «Вариатика», глава 3 «От шестёрки до туза — путь роста».
  // Уровни 1–4 — теневые (страх/реактивность), 5–9 — светлые (мастерство, влияние).
  var LEVELS = [
    { n: 1, name: 'Замри (жертва)', icon: '🥶', core: 'Сила пугает — тело отключается.',
      cap: 'предметное · вчера → завтра',
      theory: 'Видишь угрозу — оцепенение, ступор. Тело не слушается. Не можешь защитить себя или интересы. Терпишь.',
      example: 'Сторож на складе: грабители требуют открыть ворота. Сторож замер, не позвонил, не нажал тревогу. Просто стоял и смотрел.',
      task: 'Опиши реальный (или гипотетический) момент, когда ты НА ЭТОМ УРОВНЕ — замираешь от угрозы, статусной фигуры или ответственности. Что включается в теле, что не получается сказать/сделать?',
      check: 'Игрок описывает свой опыт «замри». Проверь: называет ли он телесные сигналы (а не только мысли); видит ли паттерн (это не «слабость», это включается древняя реакция freeze). Скажи, что это нормально, и какой первый шаг наружу (обычно — выдох + одно слово вслух).' },
    { n: 2, name: 'Беги (избегание)', icon: '🏃', core: '«Не видел, не слышал, ничего не знаю».',
      cap: 'предметное · 2–3 дня',
      theory: 'Избегаешь конфликта. Уходишь, прячешься, делаешь вид, что не видел. Противник сильнее, но есть путь к отступлению.',
      example: 'Охранник в ТЦ видит хулиганов и идёт в другое крыло. Потом говорит директору: «я был в другом конце».',
      task: 'В какой ситуации ты сейчас избегаешь? Где формально «не заметил», уклонился, не подошёл к разговору? Что ты теряешь, оставаясь в этом режиме?',
      check: 'Игрок честно называет уклонение. Проверь: признаёт ли он, что это его выбор (а не «обстоятельства»); видит ли цену (что копится, теряется, не делается). Дай одну точную правку: какой минимальный шаг превратит уход в «остался и сказал одно слово».' },
    { n: 3, name: 'Провоцируй (тестирование границ)', icon: '⚡', core: 'Чувствуешь силу — ищешь, где применить.',
      cap: 'конкретное · неделя → месяц',
      theory: 'Появилась сила (физическая, статусная, ресурсная) — ищешь, где доминировать. Толкаешь в коридоре, грубишь, проверяешь, кто даст отпор. Учишься через агрессию.',
      example: 'Подросток-боксёр провоцирует в школе, ищет «кто слабее». Закономерный финал — нарвался, перелом носа.',
      task: 'Где ты сейчас провоцируешь — даже мелко? (Резкость с подчинёнными, давление в споре, проверка чужой реакции). Что эта проба силы говорит о тебе?',
      check: 'Игрок называет провокацию. Проверь: не оправдывает ли он её («все так делают»); видит ли цикл — провокация → отпор/тюрьма → опять. Дай вывод: провокация заканчивается только когда нарвался; короче — научиться защищаться, а не нападать.' },
    { n: 4, name: 'Защищайся (бывает вооружён)', icon: '🛡️', core: 'Не провоцируешь, но готов.',
      cap: 'конкретное · тактическое · неделя–месяц',
      theory: 'Можешь защитить себя сам. Вооружён (оружие, навыки, физическая форма). Не лезешь, но готов. Начинаешь понимать ответственность за силу.',
      example: 'Таксист с травматом. Пьяный пассажир угрожает — спокойно показал оружие, сказал «выходи». Не применил, но был готов.',
      task: 'В чём твоя реальная «защита» сейчас — навык, ресурс, статус, физика, договорённости? Если завтра придётся защищать своё / своих — чем и как?',
      check: 'Игрок инвентаризует свою защиту. Проверь: реалистична ли она (а не «авось»); знает ли он, КАК активирует (а не только что «есть»); готов ли применить (это вопрос воли, не средств). Дай одну точную дыру.' },
    { n: 5, name: 'Используй силу (оперативник)', icon: '👮', core: 'Применяешь силу для работодателя — по приказу, в рамках.',
      cap: 'тактическое · квартал–полгода',
      theory: 'Применяешь силу для работодателя (государства/системы). Работаешь в команде, выполняешь приказы. Не выбираешь задачи — делаешь то, что поручают. Силу применяешь в рамках инструкций.',
      example: 'Оперативник уголовного розыска. ЗП 65к + премии. Расследует то, что спустили сверху. Если нужно задержать — действует, но решение принимает не он.',
      task: 'Где ты сейчас «оперативник» — действуешь силой / влиянием в чьих-то рамках? Это твоя система или чужая? Что в этом «оперативничестве» тебя устраивает и где предел?',
      check: 'Игрок описывает свою роль в чужой системе. Проверь: понимает ли разницу между «инициатива моя» и «инструкции чужие»; видит ли предел роста на этом уровне. Дай вектор: следующий шаг — продавать силу как УСЛУГУ, а не как зарплату.' },
    { n: 6, name: 'Зарабатывай на силе (независимый профи)', icon: '💼', core: 'Сила — твоя услуга. Берёшь контракты на своих условиях.',
      cap: 'тактическо-стратегическое · полгода–год',
      theory: 'Применяешь силу как независимый профессионал. Боевые/тактические навыки. Берёшь контракты по своему выбору, можешь отказаться. Работаешь на репутацию — каждый контракт повышает стоимость.',
      example: 'Телохранитель-бывший спецназ. 400–600к/мес. Сам выбирает клиентов, отказывается от рискованных или неадекватных. Репутация = капитал.',
      task: 'Какую «силу» ты можешь продать как УСЛУГУ — навык, экспертизу, защиту, влияние? Каким клиентам / в каких ситуациях? От каких контрактов будешь отказываться, чтобы не разрушить репутацию?',
      check: 'Игрок формулирует «свою услугу силы». Проверь: понимает ли он, что репутация важнее одного контракта; есть ли у него критерий «откажусь, если…». Дай одну сильную сторону его предложения, одну дыру.' },
    { n: 7, name: 'Владей силовым активом', icon: '🏛️', core: 'Не применяешь сам — управляешь системой.',
      cap: 'системное · 1–3 года',
      theory: 'Управляешь системой безопасности (ЧОП/ЧВК). Сам не применяешь — нанимаешь, обучаешь, распределяешь, контролируешь. Получаешь разницу с услуги.',
      example: 'Владелец ЧОП на 200 охранников. Не охраняет лично — управляет процессом. 10М/мес оборот, 2М прибыли. Зависит от лицензий и доступа к территориям клиентов.',
      task: 'Что у тебя сейчас может быть собрано в АКТИВ (не отдельные навыки/проекты, а система, которая работает руками других)? Кого нанимаешь, кого обучаешь, как контролируешь качество? Где у тебя «нет лицензии» — формальной или негласной?',
      check: 'Игрок проектирует свой силовой/влиятельный актив. Проверь: разделяет ли он «делать» и «организовывать»; назвал ли реальное препятствие (часто это его привычка делать самому). Один точный следующий шаг.' },
    { n: 8, name: 'Командуй силовиками (создатель иерархии)', icon: '👑', core: 'Не контракт — присяга. Не услуга — устав.',
      cap: 'системно-архитектурное · 3–5 лет',
      theory: 'Командуешь через иерархию. Система работает без тебя. Люди связаны присягой, уставом, понятиями и идеологией — не деньгами. Связь — клятва. Имеешь монополию на применение силы внутри своей системы.',
      example: 'Начальник СИЗО / лидер ОПГ / командующий военным округом. Уходит в отпуск — система работает. Дисциплина через наказания/поощрения. Подчинённые связаны не контрактом, а присягой и кодексом.',
      task: 'Какую «иерархию» ты бы построил, если бы вырос до этого уровня — в работе / в семье / в сообществе? Кто в твоей иерархии? На чём держится их связь с тобой — деньги или нечто большее? Какой твой устав?',
      check: 'Игрок описывает иерархию. Проверь: понимает ли разницу контракт vs присяга (это ключевое отличие от уровня 7); назвал ли он явный устав/принципы (без них иерархия — фикция). Заметь зрелость или незрелость замысла.' },
    { n: 9, name: 'Создавай правила насилия (законодатель)', icon: '⚖️', core: 'Не применяешь силу. Решаешь, кто и когда может.',
      cap: 'мастерское адаптивное · 10+ лет',
      theory: 'Создаёшь правила применения силы. Делегируешь и определяешь, к кому, когда и за что её применять. Пишешь устав, определяешь меру возмездия. Монополия на насилие в твоей системе. Не для доминирования — для порядка.',
      example: 'Министр обороны / директор ФСИН / «дед Хасан» как создатель «понятий». Сам не воюет — пишет доктрину. Назначает Королей, отзывает мандаты.',
      task: 'Какие правила «применения силы/влияния» ты бы написал для своей сферы? Что разрешено, что запрещено? Кому ты бы делегировал право решать? Где сила = порядок, а где = разрушение?',
      check: 'Игрок формулирует свою «доктрину». Проверь: видит ли он баланс силы и справедливости (это ядро уровня Туз — не доминирование, а защита порядка); готов ли отказаться от ЛИЧНОГО применения силы. Финал курса: какое одно правило стоит ввести в свою жизнь уже сегодня.' }
  ];

  // ---------- сквозной счёт серии «Вариатика» ----------
  function loadSeries() { try { return JSON.parse(localStorage.getItem('variatika_series') || 'null') || { score: 0, byGame: {} }; } catch (e) { return { score: 0, byGame: {} }; } }
  function saveSeries(s) { try { localStorage.setItem('variatika_series', JSON.stringify(s)); } catch (e) {} }
  function seriesAdd(game, pts) { if (!pts) return; var s = loadSeries(); s.score = (s.score || 0) + pts; s.byGame = s.byGame || {}; s.byGame[game] = (s.byGame[game] || 0) + pts; saveSeries(s); }
  function seriesRank() {
    var s = loadSeries(), sc = s.score || 0;
    var R = [{m:120,n:'Мастер Вариатики'},{m:60,n:'Читатель людей'},{m:25,n:'Практик серии'},{m:10,n:'Наблюдатель'},{m:0,n:'Новичок серии'}];
    for (var i = 0; i < R.length; i++) if (sc >= R[i].m) return { name: R[i].n, score: sc, next: R[i - 1] ? { min: R[i - 1].m, name: R[i - 1].n } : null };
    return { name: R[R.length - 1].n, score: sc, next: { min: R[R.length - 2].m, name: R[R.length - 2].n } };
  }
  function seriesCardHtml() {
    var r = seriesRank();
    var bar = r.next ? '<div style="margin-top:8px;height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.min(100, Math.round(r.score / r.next.min * 100)) + '%;background:linear-gradient(90deg,#ef4444,#f97316)"></i></div><div style="font-size:.78rem;color:#9aa0ad;margin-top:5px">До «' + r.next.name + '» — ещё ' + (r.next.min - r.score) + ' очков</div>' : '<div style="font-size:.78rem;color:#fcd34d;margin-top:5px">🏆 Высший разряд серии</div>';
    return '<div class="im-card" style="font-size:.9rem"><b>🏵️ Серия «Вариатика»:</b> звание <b style="color:#fda4af">' + r.name + '</b> · <b>' + r.score + '</b> очков' + bar + '</div>';
  }

  // ---------- состояние ----------
  function loadProg() {
    var d = { done: {}, notes: {} };
    try { var p = JSON.parse(localStorage.getItem('imperative_prog') || 'null'); if (!p) return d; p.done = p.done || {}; p.notes = p.notes || {}; return p; } catch (e) { return d; }
  }
  function saveProg(p) { try { localStorage.setItem('imperative_prog', JSON.stringify(p)); } catch (e) {} }
  var ST = { busy: false, recording: false };
  function container() { return document.getElementById('screenContainer'); }

  // ---------- premium ----------
  async function ensurePremium() {
    if (window.IS_PREMIUM === true) return true;
    if (window.IS_PREMIUM == null && typeof window.loadPremiumStatus === 'function') { try { await window.loadPremiumStatus(); } catch (e) {} }
    return window.IS_PREMIUM === true;
  }
  function openPremium() {
    if (typeof window.showPremiumLockPopup === 'function') { window.showPremiumLockPopup('Императив'); return; }
    if (typeof window.showSettingsScreen === 'function') { try { window.showSettingsScreen(); return; } catch (e) {} }
    toast('Открой раздел «Подписка» в настройках', 'info');
  }
  function renderLocked() {
    injectCSS();
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="im-wrap">' +
        '<button class="im-ghost" onclick="IMPERATIVE.exit()">← К списку игр</button>' +
        '<div class="im-h1">🛡️ Императив</div>' +
        '<div class="im-card" style="text-align:center;border-color:rgba(239,68,68,.45)">' +
          '<div style="font-size:2.4rem;margin-bottom:6px">💎</div>' +
          '<div style="font-weight:700;font-size:1.12rem;color:#fff;margin-bottom:8px">Игра в 9 уровней — с подпиской</div>' +
          '<div style="color:#aeb1bd;line-height:1.55">«Императив» — высшие навыки СБ-масти: лидерство как «право имеющий», доминирование в общении, владение силой как ресурсом. 9 уровней пути от жертвы до законодателя. Доступна в <b>Фреди Premium</b>.</div>' +
        '</div>' +
        '<button class="im-btn im-primary" onclick="IMPERATIVE.openPremium()">💎 Открыть Premium</button>' +
        '<button class="im-btn" onclick="IMPERATIVE.exit()">← Вернуться к играм</button>' +
      '</div>';
    track('feature_opened', { feature: 'imperative_locked' });
  }

  // ---------- стили ----------
  function injectCSS() {
    if (document.getElementById('imCSS')) return;
    var s = document.createElement('style'); s.id = 'imCSS';
    s.textContent = [
      '.im-wrap{max-width:720px;margin:0 auto;padding:18px 16px 90px;color:#f2f3f5}',
      '.im-h1{font-size:1.5rem;font-weight:800;margin:6px 0 10px;line-height:1.18;color:#fff}',
      '.im-h2{font-size:1.1rem;font-weight:700;margin:14px 0 8px;color:#fff}',
      '.im-lead{font-size:1.02rem;color:#aeb1bd;line-height:1.6;margin-bottom:14px}',
      '.im-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px;color:#dfe2e8;line-height:1.6;font-size:.95rem}',
      '.im-card b{color:#fff;font-weight:600}',
      '.im-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px 18px;margin-bottom:10px;color:#fff;font:inherit;font-size:.98rem;cursor:pointer;transition:.18s}',
      '.im-btn:hover{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.5)}',
      '.im-btn small{display:block;color:#9aa0ad;font-size:.82rem;margin-top:4px;font-weight:400}',
      '.im-btn.done{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.07)}',
      '.im-btn.locked{opacity:.45;cursor:not-allowed}',
      '.im-primary{background:linear-gradient(135deg,#ef4444,#f97316);border:none;color:#fff;text-align:center;font-weight:700}',
      '.im-primary:hover{filter:brightness(1.07)}',
      '.im-ghost{display:inline-block;background:none;border:none;color:#9aa0ad;font:inherit;font-size:.9rem;cursor:pointer;padding:6px 0;margin-bottom:6px}',
      '.im-ghost:hover{color:#fff}',
      '.im-prog{height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;margin:8px 0 14px}',
      '.im-prog i{display:block;height:100%;background:linear-gradient(90deg,#ef4444,#f97316);transition:width .3s}',
      '.im-core{background:linear-gradient(135deg,rgba(239,68,68,.13),rgba(249,115,22,.04));border:1px solid rgba(239,68,68,.35);border-radius:14px;padding:14px 16px;margin:10px 0;font-style:italic;color:#fda4af;line-height:1.5}',
      '.im-theory{background:rgba(255,255,255,.04);border-left:3px solid #ef4444;border-radius:8px;padding:12px 14px;margin-bottom:10px;line-height:1.6;font-size:.93rem}',
      '.im-task{background:linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.42);border-radius:14px;padding:14px 16px;margin:12px 0;line-height:1.55}',
      '.im-task .lab{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#fcd34d;margin-bottom:6px}',
      '.im-ta{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 14px;color:#fff;font:inherit;font-size:.96rem;resize:vertical;min-height:110px;line-height:1.5}',
      '.im-ta:focus{outline:none;border-color:rgba(239,68,68,.6)}',
      '.im-fb{background:linear-gradient(135deg,rgba(34,197,94,.13),rgba(34,197,94,.04));border:1px solid rgba(34,197,94,.45);border-radius:14px;padding:13px 16px;margin:10px 0;line-height:1.55;white-space:pre-wrap}',
      '.im-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.im-typing{color:#8b90a0;font-size:.85rem;font-style:italic;padding:6px 0}',
      '.im-field{display:block;font-size:.82rem;color:#9aa0ad;margin:8px 0 4px}',
      '.im-step{display:inline-block;padding:4px 9px;border-radius:999px;background:rgba(239,68,68,.13);border:1px solid rgba(239,68,68,.4);color:#fda4af;font-size:.8rem;margin-bottom:8px}',
      '[data-theme="light"] .im-wrap{color:#1a1a2e}',
      '[data-theme="light"] .im-h1{color:#0f1020}',
      '[data-theme="light"] .im-lead{color:#555}',
      '[data-theme="light"] .im-card{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#222}',
      '[data-theme="light"] .im-card b{color:#000}',
      '[data-theme="light"] .im-btn{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#111}',
      '[data-theme="light"] .im-btn small{color:#666}',
      '[data-theme="light"] .im-theory{background:rgba(0,0,0,.03)}',
      '[data-theme="light"] .im-ta{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- хаб ----------
  async function home() {
    injectCSS();
    var c = container(); if (!c) return;
    if (!(await ensurePremium())) { renderLocked(); return; }
    track('feature_opened', { feature: 'imperative' });
    var p = loadProg();
    var done = Object.keys(p.done).filter(function (k) { return p.done[k]; }).length;
    var pct = Math.round(done / 9 * 100);
    var ranks = ['Жертва', 'Уклонист', 'Задира', 'Защитник', 'Оперативник', 'Профи силы', 'Хозяин актива', 'Командир', 'Законодатель', '🏆 Архитектор порядка'];
    var rank = ranks[done] || ranks[ranks.length - 1];
    var rows = LEVELS.map(function (L) {
      var isDone = !!p.done[L.n];
      var isUnlocked = L.n === 1 || p.done[L.n - 1];
      var cls = isDone ? 'im-btn done' : (isUnlocked ? 'im-btn' : 'im-btn locked');
      var onclick = isUnlocked ? 'onclick="IMPERATIVE.level(' + L.n + ')"' : '';
      return '<button class="' + cls + '" ' + onclick + '><b>' + (isDone ? '✓' : (isUnlocked ? '▶' : '🔒')) + ' Уровень ' + L.n + '. ' + L.icon + ' ' + esc(L.name) + '</b><small>' + esc(L.core) + '</small></button>';
    }).join('');
    c.innerHTML =
      '<div class="im-wrap">' +
        '<button class="im-ghost" onclick="IMPERATIVE.exit()">← К списку игр</button>' +
        '<div class="im-h1">🛡️ Императив</div>' +
        '<div class="im-lead"><b>Игра в 9 уровней пути СБ-масти.</b> От «замри» в страхе — до «законодателя», который пишет правила применения силы. Каждый уровень: канон + кейс из жизни → разбор Фреди-наставника. Уровни открываются по порядку — сила не перепрыгивает ступени.</div>' +
        '<div class="im-card" style="font-size:.9rem">Звание Императива: <b style="color:#fda4af">' + esc(rank) + '</b> · открыто этажей: <b>' + done + '/9</b><div class="im-prog"><i style="width:' + pct + '%"></i></div></div>' +
        seriesCardHtml() +
        '<div class="im-h2">Уровни пути</div>' + rows +
        (done > 0 ? '<button class="im-btn" onclick="IMPERATIVE.reset()" style="border-color:rgba(239,68,68,.3);color:#fca5a5">↺ Сбросить прогресс</button>' : '') +
        '<div class="im-card" style="font-size:.82rem;color:#8b90a0">⚖️ Игра не учит «бить» — она учит понимать СОБСТВЕННЫЕ отношения с силой/властью/иерархией. Реальная сила там, где она нужна для защиты порядка, а не для доминирования.</div>' +
      '</div>';
  }
  function exit() { if (typeof window.showKonturScreen === 'function') window.showKonturScreen(); else home(); }
  function reset() { if (!confirm('Сбросить прогресс «Императива»? Очки серии останутся.')) return; saveProg({ done: {}, notes: {} }); home(); }

  // ---------- уровень ----------
  function level(n) {
    var L = LEVELS[n - 1]; if (!L) return;
    var p = loadProg();
    if (n > 1 && !p.done[n - 1]) { toast('Сначала пройди уровень ' + (n - 1), 'info'); return; }
    var savedNote = p.notes[n] || '';
    var savedFb = (p.done[n] && p.notes[n + '_fb']) || '';
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="im-wrap">' +
        '<button class="im-ghost" onclick="IMPERATIVE.home()">← К уровням</button>' +
        '<div class="im-step">Уровень ' + L.n + ' / 9 · ' + esc(L.cap) + '</div>' +
        '<div class="im-h1">' + L.icon + ' ' + esc(L.name) + '</div>' +
        '<div class="im-core">«' + esc(L.core) + '»</div>' +
        '<div class="im-h2">📖 Что это за уровень</div>' +
        '<div class="im-theory">' + esc(L.theory) + '</div>' +
        '<div class="im-theory"><b>Пример (канон):</b> ' + esc(L.example) + '</div>' +
        '<div class="im-h2">🎯 Кейс уровня</div>' +
        '<div class="im-task"><div class="lab">Задание</div>' + esc(L.task) + '</div>' +
        '<label class="im-field">Опиши свой ответ (можно подробно — это база для разбора):</label>' +
        '<textarea class="im-ta" id="imNote" placeholder="Что у тебя на этом уровне / что собираешься / что замечаешь…">' + esc(savedNote) + '</textarea>' +
        '<div class="im-row">' +
          '<button class="im-btn" id="imMic" style="width:auto;margin:0;padding:13px 16px;flex:0" onclick="IMPERATIVE.mic()" aria-label="Голосом">🎤</button>' +
          '<button class="im-btn im-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="IMPERATIVE.submit(' + n + ')">▶ Сдать уровень Фреди</button>' +
        '</div>' +
        '<div id="imOut">' + (savedFb ? ('<div class="im-fb">' + nl2br(savedFb) + '</div>') : '') + '</div>' +
        (p.done[n] ? (n < 9 ? '<button class="im-btn im-primary" style="margin-top:12px" onclick="IMPERATIVE.level(' + (n + 1) + ')">▶ Перейти на уровень ' + (n + 1) + '</button>' : '<div class="im-card" style="margin-top:12px;text-align:center;background:linear-gradient(135deg,rgba(239,68,68,.16),rgba(249,115,22,.04));border-color:rgba(239,68,68,.5)"><b>🏆 Путь СБ пройден.</b><br>Ты прошёл все 9 уровней — от Замри до Законодателя. Теперь сила — твой инструмент, а не реактивная защита.</div>') : '') +
      '</div>';
  }

  async function submit(n) {
    if (ST.busy) return;
    var L = LEVELS[n - 1]; if (!L) return;
    var inp = document.getElementById('imNote'); if (!inp) return;
    var note = inp.value.trim();
    if (note.length < 30) { toast('Опиши подробнее — хотя бы 2–3 предложения', 'info'); return; }
    ST.busy = true;
    var out = document.getElementById('imOut');
    if (out) out.innerHTML = '<div class="im-typing">⚖️ Фреди-наставник читает твой ответ…</div>';
    var prompt = 'Ты — Фреди-наставник игры «Императив» (по канону «Вариатики» А. Мейстера, путь СБ-масти). Игрок сдаёт уровень ' + n + ' из 9: «' + L.name + '». Стержень: «' + L.core + '». Канон уровня: ' + L.theory + '\n\nЗадание было: ' + L.task + '\n\nОТВЕТ ИГРОКА:\n"""\n' + note + '\n"""\n\n' +
      'Дай разбор: ' + L.check + ' Тон: на «ты», прямой, по делу, без воды и без «молодец/плохо». 5–7 предложений связной речью. Без нумерации и заголовков. Без служебных тегов.';
    var r = await aiGenerate(prompt, { temperature: 0.6, max_tokens: 400 });
    var fb = (r && r.success && r.content) ? clean(r.content) : 'Ты сделал шаг — это уже движение. Прочитай свой ответ через час спокойно: часто после паузы видно, где ты обошёл правду. Один следующий шаг — назвать её одним словом.';
    var p = loadProg();
    var wasDone = !!p.done[n];
    p.notes[n] = note; p.notes[n + '_fb'] = fb; p.done[n] = true; saveProg(p);
    if (!wasDone) seriesAdd('imperative', 5); // +5 очков серии за новый уровень
    if (out) out.innerHTML = '<div class="im-fb">' + nl2br(fb) + '</div>' +
      '<div class="im-row">' +
        (n < 9 ? '<button class="im-btn im-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="IMPERATIVE.level(' + (n + 1) + ')">▶ Перейти на уровень ' + (n + 1) + '</button>'
              : '<button class="im-btn im-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="IMPERATIVE.home()">🏆 К итогам пути</button>') +
        '<button class="im-btn" style="width:auto;margin:0;padding:13px" onclick="IMPERATIVE.home()">К уровням</button>' +
      '</div>';
    ST.busy = false;
    track('feature_opened', { feature: 'imperative_done', lvl: n });
  }

  // голосовой ввод
  function mic() {
    var inp = document.getElementById('imNote'); var btn = document.getElementById('imMic');
    var vm = window.voiceManager;
    if (!vm || typeof vm.startRecording !== 'function') { toast('Голосовой ввод недоступен', 'info'); return; }
    if (ST.recording) { try { vm.stopRecording(); } catch (e) {} ST.recording = false; if (btn) btn.textContent = '🎤'; return; }
    try {
      vm.sttOnly = true;
      vm.onTranscript = function (t) { if (inp) { inp.value = (inp.value ? inp.value + ' ' : '') + String(t || '').trim(); inp.focus(); } };
      vm.startRecording(); ST.recording = true; if (btn) btn.textContent = '⏹';
    } catch (e) { toast('Микрофон недоступен', 'error'); ST.recording = false; }
  }

  window.IMPERATIVE = { home: home, exit: exit, openPremium: openPremium, level: level, submit: submit, mic: mic, reset: reset };
  window.showImperativeGame = home;
  console.log('✅ imperative.js loaded (игра «Императив»: путь СБ-масти)');
})();
