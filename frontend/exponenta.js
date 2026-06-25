// exponenta.js — игра «ЭКСПОНЕНТА» в модуле «Игры» Фреди.
// Развитие высших навыков ТФ-масти по канону «Вариатики» А. Мейстера.
// 9 уровней пути ТФ (Работай рядом с домом → ... → Создавай новый рынок). Premium.
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

  // ---------- 9 УРОВНЕЙ ПУТИ ТФ ----------
  // Канон: книга «Вариатика», глава 3.
  var LEVELS = [
    { n: 1, name: 'Работай рядом с домом', icon: '🏠', core: 'География — потолок. Дальше двора не лезу.',
      cap: 'предметное · вчера → завтра',
      theory: 'Работаешь только в радиусе пешей доступности. Страх отойти от дома. Минимальная мобильность. Зарплата минимальна — но и не двигаешься.',
      example: 'Дворник во дворе своего дома. 12к в месяц. Соседка зовёт в соседний район за 25к — отказ: «далеко, я тут привык».',
      task: 'Где у тебя сейчас есть «свой двор» — географический или психологический круг, дальше которого ты не идёшь? Сколько ты теряешь, оставаясь в нём? Что мешает выйти — реальные риски или привычка?',
      check: 'Игрок называет свой «двор». Проверь: видит ли он, что это его ВЫБОР, а не «обстоятельства»; назвал ли цену оседлости. Один точный следующий шаг — как сделать первую вылазку за привычный круг.' },
    { n: 2, name: 'Работай куда направили', icon: '➡️', core: 'Куда послали — туда и иду. Не я выбираю.',
      cap: 'конкретное · 2–3 дня → неделя',
      theory: 'Работаешь там, куда направили (начальник решает). Сам не выбираешь работу или задачи. Следуешь за системой. Зарплата фиксированная.',
      example: 'Светлана на заводе. Начальник: «иди на участок №3» — идёт. Через неделю «иди на №5» — идёт. О карьере не думает: «куда пошлют, там и работаю».',
      task: 'Где у тебя «куда пошлют — туда и иду»? В какой роли ты сейчас плывёшь по течению чужих решений? Что в этом тебя устраивает, а где ты уже понимаешь — пора выбирать самому?',
      check: 'Игрок описывает свою «направленность». Проверь: оправдывает ли он пассивность («так удобнее»); видит ли разницу «удобно сейчас» / «закрыто навсегда». Один шаг к собственному выбору — даже мелкому.' },
    { n: 3, name: 'Работай там, где платят', icon: '💸', core: 'Только зарплата. Прыгаю с места на место.',
      cap: 'конкретное · неделя → месяц',
      theory: 'Выбираешь работу по зарплате. Анализируешь рынок труда. Готов менять работу ради денег. Не думаешь о карьере и навыках — главное «больше прямо сейчас».',
      example: 'Пётр-грузчик. Склад 30к → стройка 35к → порт 40к. Каждый месяц новая работа. «Зато зарплата растёт».',
      task: 'Где ты сейчас гоняешься за «больше прямо сейчас» — в работе, в проектах, в клиентах? Что ты теряешь, прыгая ради короткой выгоды? Какая «капитализация» закрылась, потому что ты не остался?',
      check: 'Игрок видит свой «прыжковый» паттерн. Проверь: понимает ли цену скачков (репутация / навык / связи не копятся); есть ли у него критерий «остаться, потому что…». Дай переход — следующий уровень об оседлости на СЕБЯ, а не на новое место.' },
    { n: 4, name: 'Работай на себя (фриланс/своё дело)', icon: '🔧', core: 'Сам себе начальник. Зависишь от клиентов.',
      cap: 'конкретное · неделя → месяц',
      theory: 'Работаешь на себя — фрилансер, самозанятый. Сам находишь клиентов. Зависишь от потока. Начинаешь понимать ценность своего труда.',
      example: 'Анна-швея уходит с фабрики, ставит машинку дома. Первый месяц 10к, второй — 25к, через полгода — 50к стабильно. «Теперь сама себе начальник». НО: летом много, зимой мало; в отпуск страшно — клиенты уйдут.',
      task: 'Если бы ты завтра уволился — какую СВОЮ услугу/продукт ты бы предложил клиентам напрямую? За какие деньги? Сколько уйдёт месяцев, прежде чем выйдешь на стабильный поток? Где сейчас твоё «не могу уехать в отпуск»?',
      check: 'Игрок проектирует «уход на себя». Проверь: реалистичны ли цифры (не «миллион через месяц»); видит ли он зависимость от клиентов как новую цену свободы. Один точный шаг — как сделать первого реального клиента без увольнения.' },
    { n: 5, name: 'Организуй (ИП с командой)', icon: '👷', core: '24 часа в сутках — мой потолок. Нанимаю людей.',
      cap: 'тактическое · 2–3 месяца → полгода',
      theory: 'Понимаешь: «мои 24 часа — потолок, но 10 человек × 24 часа = масштаб». Создаёшь команду, организуешь работу других. Сам берёшь сложное + контроль качества + поиск клиентов.',
      example: 'Андрей-плиточник. Один — 15 м² в день, 22к/день. Нанял двоих по 800₽/м². Теперь бригада делает 29 м²/день. Доход 24к/день — но работает легче.',
      task: 'Если ты вырос в технике сам — кому из неопытных мог бы делегировать рутину, оставив себе сложное и поиск клиентов? Какую разницу заберёшь с каждого работника? Где боишься «они халтурят» и как это решить?',
      check: 'Игрок проектирует свою «бригаду». Проверь: разделяет ли «делать» и «организовывать»; назвал ли механику контроля качества (без неё команда — лотерея). Один точный страх и как его обезвредить.' },
    { n: 6, name: 'Продавай товары, а не процессы', icon: '📦', core: 'Часы — устают. Товар — продаётся сам.',
      cap: 'тактическое · полгода',
      theory: 'Продаёшь товары для бизнеса/профи — они знают, что им нужно, товар сам себя продаёт. Понимаешь: продавать товары выгоднее, чем работать. Быстрый оборот, наценка 10–40%.',
      example: 'Денис-сантехник. За установку счётчика берёт 2,5к/час. Видит: магазин на счётчике делает 1,4к за минуту продажи. Открыл точку оптовой сантехники для коллег. Месяц: оборот 800к, прибыль 240к. Зарабатывает в 3× больше при меньшей усталости.',
      task: 'Какие ТОВАРЫ внутри твоей сферы продаются «сами», потому что профи знает, что ему нужно? Кто твой клиент-профессионал? Какая наценка реальна на твоём рынке? Где у тебя возможность встать между производителем и потребителем?',
      check: 'Игрок ищет «свой товар» вместо услуги. Проверь: разделяет ли «продаю время» / «продаю товар»; назвал ли реального профи-клиента; реалистична ли наценка. Один сильный ход, одна дыра.' },
    { n: 7, name: 'Сдавай доступ к ресурсу', icon: '🏢', core: 'Владей тем, без чего нельзя.',
      cap: 'системное · 1–3 года',
      theory: 'Владеешь критическим ресурсом (недвижимость, лицензия, оборудование), без которого нельзя вести бизнес. Сдаёшь доступ — арендой, лизингом, франшизой. Пассивный доход. Оптимизируешь вложение/отдачу.',
      example: 'Сергей. За 20 лет накопил 10 помещений в ТЦ. Сдаёт — 300к/мес пассивного дохода. Ремонт раз в 5 лет, надёжные арендаторы. Через 2 года планирует ещё 5 помещений.',
      task: 'Какой РЕСУРС в твоей сфере критически нужен другим — а ты можешь им владеть? (Помещение, лицензия, оборудование, площадка, права, бренд, база данных.) Сколько потребуется лет накопления? Что начнёшь покупать с первой свободной суммы?',
      check: 'Игрок ищет «свой ресурс». Проверь: понимает ли разницу между активом (генерирует доход) и тратой (просто есть); назвал ли честный горизонт (это не «через год»). Один реальный первый ресурс на покупку.' },
    { n: 8, name: 'Производи товары (владей фабрикой)', icon: '🏭', core: 'Не я делаю — система делает.',
      cap: 'системно-архитектурное · 2–3 года',
      theory: 'Владеешь средствами производства. Создаёшь линию: от закупки сырья до продажи продукции. Система работает без тебя — директор, начальники цехов. Контролируешь через отчёты раз в неделю/месяц.',
      example: 'Иван — мебельная фабрика на 200 сотрудников. Создал производственную линию. Не пилит и не продаёт лично — управляет через отчёты. Может уехать на месяц, фабрика работает.',
      task: 'Если бы ты выходил на уровень производства — что бы ты ПРОИЗВОДИЛ? Какие звенья нужны от сырья до продажи? Кого бы ты нанял первым, чтобы система начала работать без тебя? Где ты сейчас «не отпускаешь руки» и почему?',
      check: 'Игрок проектирует фабрику-в-метафоре. Проверь: видит ли цепочку (а не отдельные функции); назвал ли точку, где может «уйти на месяц» (это критерий уровня). Один точный шаг к делегированию.' },
    { n: 9, name: 'Создавай новый рынок', icon: '🌐', core: 'Не побеждаю в игре — меняю игру.',
      cap: 'мастерское адаптивное · 5+ лет',
      theory: 'Создаёшь новый продукт/рынок. Меняешь правила игры в отрасли. Видишь фундаментальную проблему или неудовлетворённую потребность. Тратишь годы на разработку. Встречаешь сопротивление, продолжаешь развивать. Конкуренты потом копируют.',
      example: 'Стив Джобс — iPhone. До него кнопочные телефоны, после все перешли на сенсорные. Илон Маск — Tesla. До него электромобиль был игрушкой, после все автоконцерны строят электрокары.',
      task: 'Какая проблема в твоей сфере НИКЕМ толком не решена — и ты бы решил её радикально по-новому, если бы было 5+ лет? Какие нынешние решения устарели или неэффективны? Что было бы твоим «iPhone» — продукт, после которого старые решения становятся ненужными?',
      check: 'Игрок формулирует свой «новый рынок». Проверь: видит ли он фундаментальное неудовлетворение (а не просто «улучшим существующее»); готов ли к долгой работе и сопротивлению. Финал пути: какое одно действие приближает «новый рынок» уже сегодня.' }
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
    var bar = r.next ? '<div style="margin-top:8px;height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.min(100, Math.round(r.score / r.next.min * 100)) + '%;background:linear-gradient(90deg,#22c55e,#84cc16)"></i></div><div style="font-size:.78rem;color:#9aa0ad;margin-top:5px">До «' + r.next.name + '» — ещё ' + (r.next.min - r.score) + ' очков</div>' : '<div style="font-size:.78rem;color:#fcd34d;margin-top:5px">🏆 Высший разряд серии</div>';
    return '<div class="ex-card" style="font-size:.9rem"><b>🏵️ Серия «Вариатика»:</b> звание <b style="color:#86efac">' + r.name + '</b> · <b>' + r.score + '</b> очков' + bar + '</div>';
  }

  function loadProg() {
    var d = { done: {}, notes: {} };
    try { var p = JSON.parse(localStorage.getItem('exponenta_prog') || 'null'); if (!p) return d; p.done = p.done || {}; p.notes = p.notes || {}; return p; } catch (e) { return d; }
  }
  function saveProg(p) { try { localStorage.setItem('exponenta_prog', JSON.stringify(p)); } catch (e) {} }
  var ST = { busy: false, recording: false };
  function container() { return document.getElementById('screenContainer'); }

  async function ensurePremium() {
    if (window.IS_PREMIUM === true) return true;
    if (window.IS_PREMIUM == null && typeof window.loadPremiumStatus === 'function') { try { await window.loadPremiumStatus(); } catch (e) {} }
    return window.IS_PREMIUM === true;
  }
  function openPremium() {
    if (typeof window.showPremiumLockPopup === 'function') { window.showPremiumLockPopup('Экспонента'); return; }
    if (typeof window.showSettingsScreen === 'function') { try { window.showSettingsScreen(); return; } catch (e) {} }
    toast('Открой раздел «Подписка» в настройках', 'info');
  }
  function renderLocked() {
    injectCSS();
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="ex-wrap">' +
        '<button class="ex-ghost" onclick="EXPONENTA.exit()">← К списку игр</button>' +
        '<div class="ex-h1">📈 Экспонента</div>' +
        '<div class="ex-card" style="text-align:center;border-color:rgba(34,197,94,.45)">' +
          '<div style="font-size:2.4rem;margin-bottom:6px">💎</div>' +
          '<div style="font-weight:700;font-size:1.12rem;color:#fff;margin-bottom:8px">Игра в 9 уровней — с подпиской</div>' +
          '<div style="color:#aeb1bd;line-height:1.55">«Экспонента» — высшие навыки ТФ-масти: бизнес как война за клиентов, рост от ремесла к производству и созданию рынков. 9 уровней пути от «работай рядом с домом» до «создавай новый рынок». Доступна в <b>Фреди Premium</b>.</div>' +
        '</div>' +
        '<button class="ex-btn ex-primary" onclick="EXPONENTA.openPremium()">💎 Открыть Premium</button>' +
        '<button class="ex-btn" onclick="EXPONENTA.exit()">← Вернуться к играм</button>' +
      '</div>';
    track('feature_opened', { feature: 'exponenta_locked' });
  }

  function injectCSS() {
    if (document.getElementById('exCSS')) return;
    var s = document.createElement('style'); s.id = 'exCSS';
    s.textContent = [
      '.ex-wrap{max-width:720px;margin:0 auto;padding:18px 16px 90px;color:#f2f3f5}',
      '.ex-h1{font-size:1.5rem;font-weight:800;margin:6px 0 10px;line-height:1.18;color:#fff}',
      '.ex-h2{font-size:1.1rem;font-weight:700;margin:14px 0 8px;color:#fff}',
      '.ex-lead{font-size:1.02rem;color:#aeb1bd;line-height:1.6;margin-bottom:14px}',
      '.ex-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px;color:#dfe2e8;line-height:1.6;font-size:.95rem}',
      '.ex-card b{color:#fff;font-weight:600}',
      '.ex-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px 18px;margin-bottom:10px;color:#fff;font:inherit;font-size:.98rem;cursor:pointer;transition:.18s}',
      '.ex-btn:hover{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.5)}',
      '.ex-btn small{display:block;color:#9aa0ad;font-size:.82rem;margin-top:4px;font-weight:400}',
      '.ex-btn.done{border-color:rgba(34,197,94,.55);background:rgba(34,197,94,.12)}',
      '.ex-btn.locked{opacity:.45;cursor:not-allowed}',
      '.ex-primary{background:linear-gradient(135deg,#22c55e,#84cc16);border:none;color:#fff;text-align:center;font-weight:700}',
      '.ex-primary:hover{filter:brightness(1.07)}',
      '.ex-ghost{display:inline-block;background:none;border:none;color:#9aa0ad;font:inherit;font-size:.9rem;cursor:pointer;padding:6px 0;margin-bottom:6px}',
      '.ex-ghost:hover{color:#fff}',
      '.ex-prog{height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;margin:8px 0 14px}',
      '.ex-prog i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#84cc16);transition:width .3s}',
      '.ex-core{background:linear-gradient(135deg,rgba(34,197,94,.13),rgba(132,204,22,.04));border:1px solid rgba(34,197,94,.35);border-radius:14px;padding:14px 16px;margin:10px 0;font-style:italic;color:#86efac;line-height:1.5}',
      '.ex-theory{background:rgba(255,255,255,.04);border-left:3px solid #22c55e;border-radius:8px;padding:12px 14px;margin-bottom:10px;line-height:1.6;font-size:.93rem}',
      '.ex-task{background:linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.42);border-radius:14px;padding:14px 16px;margin:12px 0;line-height:1.55}',
      '.ex-task .lab{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#fcd34d;margin-bottom:6px}',
      '.ex-ta{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 14px;color:#fff;font:inherit;font-size:.96rem;resize:vertical;min-height:110px;line-height:1.5}',
      '.ex-ta:focus{outline:none;border-color:rgba(34,197,94,.6)}',
      '.ex-fb{background:linear-gradient(135deg,rgba(34,197,94,.16),rgba(34,197,94,.04));border:1px solid rgba(34,197,94,.5);border-radius:14px;padding:13px 16px;margin:10px 0;line-height:1.55;white-space:pre-wrap}',
      '.ex-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.ex-typing{color:#8b90a0;font-size:.85rem;font-style:italic;padding:6px 0}',
      '.ex-field{display:block;font-size:.82rem;color:#9aa0ad;margin:8px 0 4px}',
      '.ex-step{display:inline-block;padding:4px 9px;border-radius:999px;background:rgba(34,197,94,.13);border:1px solid rgba(34,197,94,.4);color:#86efac;font-size:.8rem;margin-bottom:8px}',
      '[data-theme="light"] .ex-wrap{color:#1a1a2e}',
      '[data-theme="light"] .ex-h1{color:#0f1020}',
      '[data-theme="light"] .ex-lead{color:#555}',
      '[data-theme="light"] .ex-card{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#222}',
      '[data-theme="light"] .ex-card b{color:#000}',
      '[data-theme="light"] .ex-btn{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#111}',
      '[data-theme="light"] .ex-btn small{color:#666}',
      '[data-theme="light"] .ex-theory{background:rgba(0,0,0,.03)}',
      '[data-theme="light"] .ex-ta{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.15);color:#111}'
    ].join('\n');
    document.head.appendChild(s);
  }

  async function home() {
    injectCSS();
    var c = container(); if (!c) return;
    if (!(await ensurePremium())) { renderLocked(); return; }
    track('feature_opened', { feature: 'exponenta' });
    var p = loadProg();
    var done = Object.keys(p.done).filter(function (k) { return p.done[k]; }).length;
    var pct = Math.round(done / 9 * 100);
    var ranks = ['Оседлый', 'Направленный', 'Скиталец', 'Самозанятый', 'Бригадир', 'Торговец', 'Рантье', 'Производитель', 'Архитектор рынка', '🏆 Создатель индустрии'];
    var rank = ranks[done] || ranks[ranks.length - 1];
    var rows = LEVELS.map(function (L) {
      var isDone = !!p.done[L.n];
      var isUnlocked = L.n === 1 || p.done[L.n - 1];
      var cls = isDone ? 'ex-btn done' : (isUnlocked ? 'ex-btn' : 'ex-btn locked');
      var onclick = isUnlocked ? 'onclick="EXPONENTA.level(' + L.n + ')"' : '';
      return '<button class="' + cls + '" ' + onclick + '><b>' + (isDone ? '✓' : (isUnlocked ? '▶' : '🔒')) + ' Уровень ' + L.n + '. ' + L.icon + ' ' + esc(L.name) + '</b><small>' + esc(L.core) + '</small></button>';
    }).join('');
    c.innerHTML =
      '<div class="ex-wrap">' +
        '<button class="ex-ghost" onclick="EXPONENTA.exit()">← К списку игр</button>' +
        '<div class="ex-h1">📈 Экспонента</div>' +
        '<div class="ex-lead"><b>Игра в 9 уровней пути ТФ-масти.</b> От «работаю рядом с домом» до «создаю новый рынок». На каждом — канон + кейс из жизни → разбор Фреди-наставника. Уровни открываются по порядку: бизнес не перепрыгивает ступени.</div>' +
        '<div class="ex-card" style="font-size:.9rem">Звание Экспоненты: <b style="color:#86efac">' + esc(rank) + '</b> · открыто этажей: <b>' + done + '/9</b><div class="ex-prog"><i style="width:' + pct + '%"></i></div></div>' +
        seriesCardHtml() +
        '<div class="ex-h2">Уровни пути</div>' + rows +
        (done > 0 ? '<button class="ex-btn" onclick="EXPONENTA.reset()" style="border-color:rgba(239,68,68,.3);color:#fca5a5">↺ Сбросить прогресс</button>' : '') +
        '<div class="ex-card" style="font-size:.82rem;color:#8b90a0">💼 «Бизнес — это война за клиентов. Здесь побеждают либо силой, либо хитростью» — превью автора. Игра тренирует именно вашу версию пути.</div>' +
      '</div>';
  }
  function exit() { if (typeof window.showKonturScreen === 'function') window.showKonturScreen(); else home(); }
  function reset() { if (!confirm('Сбросить прогресс «Экспоненты»? Очки серии останутся.')) return; saveProg({ done: {}, notes: {} }); home(); }

  function level(n) {
    var L = LEVELS[n - 1]; if (!L) return;
    var p = loadProg();
    if (n > 1 && !p.done[n - 1]) { toast('Сначала пройди уровень ' + (n - 1), 'info'); return; }
    var savedNote = p.notes[n] || '';
    var savedFb = (p.done[n] && p.notes[n + '_fb']) || '';
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="ex-wrap">' +
        '<button class="ex-ghost" onclick="EXPONENTA.home()">← К уровням</button>' +
        '<div class="ex-step">Уровень ' + L.n + ' / 9 · ' + esc(L.cap) + '</div>' +
        '<div class="ex-h1">' + L.icon + ' ' + esc(L.name) + '</div>' +
        '<div class="ex-core">«' + esc(L.core) + '»</div>' +
        '<div class="ex-h2">📖 Что это за уровень</div>' +
        '<div class="ex-theory">' + esc(L.theory) + '</div>' +
        '<div class="ex-theory"><b>Пример (канон):</b> ' + esc(L.example) + '</div>' +
        '<div class="ex-h2">🎯 Кейс уровня</div>' +
        '<div class="ex-task"><div class="lab">Задание</div>' + esc(L.task) + '</div>' +
        '<label class="ex-field">Опиши свой ответ (можно подробно):</label>' +
        '<textarea class="ex-ta" id="exNote" placeholder="Что у тебя на этом уровне / что собираешься / что замечаешь…">' + esc(savedNote) + '</textarea>' +
        '<div class="ex-row">' +
          '<button class="ex-btn" id="exMic" style="width:auto;margin:0;padding:13px 16px;flex:0" onclick="EXPONENTA.mic()" aria-label="Голосом">🎤</button>' +
          '<button class="ex-btn ex-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="EXPONENTA.submit(' + n + ')">▶ Сдать уровень Фреди</button>' +
        '</div>' +
        '<div id="exOut">' + (savedFb ? ('<div class="ex-fb">' + nl2br(savedFb) + '</div>') : '') + '</div>' +
        (p.done[n] ? (n < 9 ? '<button class="ex-btn ex-primary" style="margin-top:12px" onclick="EXPONENTA.level(' + (n + 1) + ')">▶ Перейти на уровень ' + (n + 1) + '</button>' : '<div class="ex-card" style="margin-top:12px;text-align:center;background:linear-gradient(135deg,rgba(34,197,94,.16),rgba(132,204,22,.04));border-color:rgba(34,197,94,.5)"><b>🏆 Путь ТФ пройден.</b><br>Все 9 уровней — от рядом с домом до создателя рынка. Теперь труд — это твой капитал, а не время в обмен на деньги.</div>') : '') +
      '</div>';
  }

  async function submit(n) {
    if (ST.busy) return;
    var L = LEVELS[n - 1]; if (!L) return;
    var inp = document.getElementById('exNote'); if (!inp) return;
    var note = inp.value.trim();
    if (note.length < 30) { toast('Опиши подробнее — хотя бы 2–3 предложения', 'info'); return; }
    ST.busy = true;
    var out = document.getElementById('exOut');
    if (out) out.innerHTML = '<div class="ex-typing">📊 Фреди-наставник читает твой ответ…</div>';
    var prompt = 'Ты — Фреди-наставник игры «Экспонента» (по канону «Вариатики» А. Мейстера, путь ТФ-масти). Игрок сдаёт уровень ' + n + ' из 9: «' + L.name + '». Стержень: «' + L.core + '». Канон уровня: ' + L.theory + '\n\nЗадание было: ' + L.task + '\n\nОТВЕТ ИГРОКА:\n"""\n' + note + '\n"""\n\n' +
      'Дай разбор: ' + L.check + ' Тон: на «ты», прямой, по делу, без воды и без «молодец/плохо». 5–7 предложений связной речью. Без нумерации и заголовков. Без служебных тегов.';
    var r = await aiGenerate(prompt, { temperature: 0.6, max_tokens: 400 });
    var fb = (r && r.success && r.content) ? clean(r.content) : 'Ты сделал шаг — это уже движение. Перечитай свой ответ через час: часто видно, где обошёл главное. Один следующий шаг — назвать его прямо.';
    var p = loadProg();
    var wasDone = !!p.done[n];
    p.notes[n] = note; p.notes[n + '_fb'] = fb; p.done[n] = true; saveProg(p);
    if (!wasDone) seriesAdd('exponenta', 5);
    if (out) out.innerHTML = '<div class="ex-fb">' + nl2br(fb) + '</div>' +
      '<div class="ex-row">' +
        (n < 9 ? '<button class="ex-btn ex-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="EXPONENTA.level(' + (n + 1) + ')">▶ Перейти на уровень ' + (n + 1) + '</button>'
              : '<button class="ex-btn ex-primary" style="flex:1;width:auto;margin:0;padding:13px" onclick="EXPONENTA.home()">🏆 К итогам пути</button>') +
        '<button class="ex-btn" style="width:auto;margin:0;padding:13px" onclick="EXPONENTA.home()">К уровням</button>' +
      '</div>';
    ST.busy = false;
    track('feature_opened', { feature: 'exponenta_done', lvl: n });
  }

  function mic() {
    var inp = document.getElementById('exNote'); var btn = document.getElementById('exMic');
    var vm = window.voiceManager;
    if (!vm || typeof vm.startRecording !== 'function') { toast('Голосовой ввод недоступен', 'info'); return; }
    if (ST.recording) { try { vm.stopRecording(); } catch (e) {} ST.recording = false; if (btn) btn.textContent = '🎤'; return; }
    try {
      vm.sttOnly = true;
      vm.onTranscript = function (t) { if (inp) { inp.value = (inp.value ? inp.value + ' ' : '') + String(t || '').trim(); inp.focus(); } };
      vm.startRecording(); ST.recording = true; if (btn) btn.textContent = '⏹';
    } catch (e) { toast('Микрофон недоступен', 'error'); ST.recording = false; }
  }

  window.EXPONENTA = { home: home, exit: exit, openPremium: openPremium, level: level, submit: submit, mic: mic, reset: reset };
  window.showExponentaGame = home;
  console.log('✅ exponenta.js loaded (игра «Экспонента»: путь ТФ-масти)');
})();
