// ============================================
// kontur.js — Модуль «Игры» (контейнер). Первая игра: «О чём ты умеешь думать».
// Тренажёр мышления: интро + тест-диагностика + игра с Фреди.
// Опора: статья и игра КОНТУР (meysternlp.ru/kontur).
// AI: POST /api/ai/generate {user_id, prompt} -> {success, content} (stateless).
// Экспорт: window.showKonturScreen
// ============================================
(function () {
  "use strict";

  // ---------- утилиты ----------
  function api() { return (window.CONFIG && window.CONFIG.API_BASE_URL) || window.API_BASE_URL || 'https://ffred-ddd989.amvera.io'; }
  function uid() { return (window.CONFIG && window.CONFIG.USER_ID) || window.USER_ID || 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t, k) { if (typeof window.showToast === 'function') window.showToast(t, k || 'info'); }
  function track(ev, d) { try { if (window.FrediTracker) window.FrediTracker.track(ev, d || {}); } catch (e) {} }

  async function aiGenerate(prompt, opts) {
    opts = opts || {};
    var body = { user_id: uid(), prompt: prompt, max_tokens: opts.max_tokens || 420, temperature: opts.temperature == null ? 0.7 : opts.temperature };
    // используем глобальный apiCall, если есть (он добавляет авторизацию/метрики); иначе fetch
    if (typeof window.apiCall === 'function') {
      return await window.apiCall('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) });
    }
    var r = await fetch(api() + '/api/ai/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  }

  // ---------- БАЗА ЗНАНИЙ: 12 областей мышления + инструменты ----------
  var THEMES = {
    TIME:   { name: 'Время и жизнь',        tools: ['главное vs важное', 'необратимость (время не возвращается)', 'чьё время ты тратишь — своё или заёмное', 'фазы жизни, а не календарный возраст'] },
    DECIDE: { name: 'Решения и риск',        tools: ['обратимое vs необратимое', 'три контр-сценария вместо одного', 'вероятность × ущерб', '«достаточно для следующего шага»'] },
    MONEY:  { name: 'Деньги и ресурсы',      tools: ['доход vs капитал vs поток', 'цена за результат, а не за час', 'полная стоимость владения', 'буфер vs инвестиция'] },
    CRAFT:  { name: 'Дело и мастерство',     tools: ['что решено, что открыто в области', 'цепочка ценности', 'моё «легко» = чужое «трудно»', '10% работы, дающие 80% результата'] },
    RELAT:  { name: 'Отношения и близость',  tools: ['факт vs интерпретация', 'круг влияния vs круг забот', 'цикл конфликта: триггер→чувство→реакция', 'что зависит от меня, даже если другой не изменится'] },
    FAMILY: { name: 'Семья и род',           tools: ['что передаётся словами, а что молчанием', 'обязанность vs выбор', 'роль vs идентичность', 'наследуемый паттерн'] },
    SELF:   { name: 'Самопознание',          tools: ['черта vs поведение (наблюдай факт)', 'своё vs заёмное хотение', 'теневая сторона (что не люблю — что-то даёт)', '«должен» vs «хочу»'] },
    POWER:  { name: 'Власть и влияние',      tools: ['5 источников власти', 'власть-над vs власть-к', 'влияние без полномочий', 'объём реальной власти'] },
    IDEAS:  { name: 'Идеи и устройство мира',tools: ['4 причины (из чего, кто, как, зачем)', 'модель vs мнение', 'что бы опровергло мою идею', 'аналогия и её пределы'] },
    SOCIETY:{ name: 'Люди и общество',       tools: ['стимулы, а не намерения', 'системный эффект vs личный выбор', 'кому это выгодно', 'норма vs закон'] },
    MEANING:{ name: 'Смысл и ценности',      tools: ['смысл vs удовольствие', 'ценность как выбор между двумя хорошими', 'memento mori как ясность', 'процесс vs результат'] },
    BEAUTY: { name: 'Красота и форма',       tools: ['вкус как сигнал ценностей', 'форма следует за функцией — или нет', 'усвоенное vs своё', 'деталь, которая всё держит'] }
  };
  var THEME_ORDER = Object.keys(THEMES);

  // ---------- БАЗА ЗНАНИЙ: 12 линз ----------
  var LENSES = {
    PROCESS:  { name: 'Процесс',     q: 'Что в этой теме происходит во времени — фазы, скорость, инерция?' },
    STRUCT:   { name: 'Структура',   q: 'Из чего тема состоит и как части связаны между собой?' },
    LINKS:    { name: 'Связи',       q: 'С чем тема соединена снаружи — что от неё зависит и от чего она?' },
    HIER:     { name: 'Иерархия',    q: 'Что в теме выше, что ниже; что главное, что подчинённое?' },
    CAUSE:    { name: 'Причины',     q: 'Откуда это взялось — глубинная причина, а не поверхностная?' },
    PURPOSE:  { name: 'Назначение',  q: 'Зачем это существует, какую функцию выполняет?' },
    CYCLE:    { name: 'Циклы',       q: 'Что в теме повторяется — ритмы, петли, где ты в цикле сейчас?' },
    BOUND:    { name: 'Границы',     q: 'Где тема начинается и кончается; что в неё НЕ входит?' },
    CONTEXT:  { name: 'Контекст',    q: 'В какой среде тема живёт; что меняется, если контекст другой?' },
    PERSP:    { name: 'Перспективы', q: 'Глазами кого ещё можно посмотреть — минимум три точки зрения?' },
    PARADOX:  { name: 'Парадоксы',   q: 'Где в теме не сходится; какое противоречие ты обходишь?' },
    EVOLVE:   { name: 'Эволюция',    q: 'Во что тема развивается — если не трогать и если заниматься?' }
  };
  // ---------- 4 АРХЕТИПА МЫШЛЕНИЯ (пучки осей) ----------
  // Каждый архетип = единица восприятия + что даёт в жизни + где включать.
  // Через них Фреди вращает тему, чтобы человек увидел её 4 принципиально
  // разными углами, а не одной родной осью своей «масти».
  var ARCHETYPES = {
    ANATOM:    { name: 'Анатом',    emoji: '🔪', lenses: ['BOUND', 'STRUCT', 'HIER'],
                 unit: 'состав · границы · что главное',
                 q: 'Из чего это собрано, где граница, что тут главное, а что — шум?',
                 gain: 'ясность вместо «всё навалилось»',
                 where: 'запутанная задача, большой выбор' },
    KORENWIK:  { name: 'Корневик',  emoji: '🌱', lenses: ['CAUSE', 'PURPOSE', 'PARADOX'],
                 unit: 'причины · назначение · противоречия',
                 q: 'Откуда это взялось на самом деле, зачем существует, где не сходится?',
                 gain: 'лечишь причину, а не симптом',
                 where: '«почему опять?», спор, саботаж' },
    NAVIGATOR: { name: 'Навигатор', emoji: '🧭', lenses: ['PROCESS', 'CYCLE', 'EVOLVE'],
                 unit: 'движение во времени',
                 q: 'Откуда-куда движется, где ты в цикле сейчас, во что развивается?',
                 gain: 'перестаёшь застревать, видишь траекторию',
                 where: 'выгорание, «застрял», долгие решения' },
    CARTOGRAF: { name: 'Картограф', emoji: '🗺️', lenses: ['LINKS', 'CONTEXT', 'PERSP'],
                 unit: 'связи · среда · чужие глаза',
                 q: 'С чем это связано, в какой среде живёт, чьими глазами ещё посмотреть?',
                 gain: 'видишь систему и второй ход',
                 where: 'конфликты, переговоры, чужие решения' }
  };
  var ARCH_ORDER = ['ANATOM', 'KORENWIK', 'NAVIGATOR', 'CARTOGRAF'];

  // ---------- ТЕСТ: вопросы (портирование логики с сайта) ----------
  var Q = [
    { axis: 'T', limit: 3, prompt: 'Вечер, дел нет, никто не дёргает. Куда мысль уходит сама собой?', hint: 'До 3 — куда реально тянет.', opts: [
      { t: 'Сколько у меня времени и на что оно уходит', s: { TIME: 2 } },
      { t: 'Решение, которое давно висит', s: { DECIDE: 2 } },
      { t: 'Деньги: где взять, куда вложить, как не потерять', s: { MONEY: 2 } },
      { t: 'Как сделать своё дело лучше', s: { CRAFT: 2 } },
      { t: 'Конкретные люди и что между нами', s: { RELAT: 2 } },
      { t: 'Родители, дети, семья', s: { FAMILY: 2 } },
      { t: 'Почему я такой, какой есть', s: { SELF: 2 } },
      { t: 'Кто на самом деле решает и как устроена власть', s: { POWER: 2 } },
      { t: 'Как устроена какая-то вещь, идея, система', s: { IDEAS: 2 } },
      { t: 'Почему люди и общество такие', s: { SOCIETY: 2 } },
      { t: 'Зачем всё это, в чём смысл', s: { MEANING: 2 } },
      { t: 'Как сделать красиво — образ, форма, звук', s: { BEAUTY: 2 } } ] },
    { axis: 'T', limit: 1, prompt: 'На что залипаешь в ленте дольше, чем собирался?', hint: 'Один, самый честный.', opts: [
      { t: 'Деньги, бизнес, как люди поднимаются', s: { MONEY: 3 } },
      { t: 'Психология, отношения, разборы людей', s: { RELAT: 2, SELF: 1 } },
      { t: 'Наука, технологии, как всё устроено', s: { IDEAS: 3 } },
      { t: 'Политика, общество, «как на самом деле»', s: { POWER: 2, SOCIETY: 1 } },
      { t: 'Ремесло, мастера за работой', s: { CRAFT: 3 } },
      { t: 'Искусство, дизайн, музыка, кино', s: { BEAUTY: 3 } },
      { t: 'Философия, смысл, духовное', s: { MEANING: 2, SELF: 1 } },
      { t: 'Здоровье, тело, продуктивность', s: { TIME: 2, SELF: 1 } } ] },
    { axis: 'T', limit: 2, prompt: 'О чём заводишься в споре так, что трудно остановиться?', hint: 'До 2.', opts: [
      { t: 'Деньги и кто чего достоин', s: { MONEY: 2, POWER: 1 } },
      { t: 'Как надо жить, что главное', s: { MEANING: 2 } },
      { t: 'Отношения, кто кому что должен', s: { RELAT: 2, FAMILY: 1 } },
      { t: 'Справедливость и устройство общества', s: { SOCIETY: 2, POWER: 1 } },
      { t: 'Как правильно делать дело', s: { CRAFT: 2 } },
      { t: 'Идеи и теории', s: { IDEAS: 2 } },
      { t: 'Воспитание, семья', s: { FAMILY: 2 } },
      { t: 'Вкус: что красиво, что пошло', s: { BEAUTY: 2 } } ] },
    { axis: 'T', limit: 1, prompt: 'О чём думал в последний раз, когда не мог уснуть?', hint: 'Мысль приходит без спроса — самый честный маркер.', opts: [
      { t: 'Прокручивал нерешённое — какой выбор', s: { DECIDE: 3 } },
      { t: 'Деньги, как свести концы или подняться', s: { MONEY: 3 } },
      { t: 'Разговор/конфликт с человеком', s: { RELAT: 3 } },
      { t: 'Тревога за родных или старые обиды', s: { FAMILY: 3 } },
      { t: 'Себя — кто я, туда ли иду', s: { SELF: 3 } },
      { t: 'Работу, проект, как лучше', s: { CRAFT: 3 } },
      { t: 'Время — что уходит, что не успел', s: { TIME: 3 } },
      { t: 'Большое — смысл, зачем всё', s: { MEANING: 3 } },
      { t: 'Не помню / сплю быстро', s: {} } ] },
    { axis: 'O', limit: 2, prompt: 'Где замечаешь чужую ошибку раньше, чем человек договорит?', hint: 'Видеть ошибку = иметь модель. До 2.', opts: [
      { t: 'В разговорах про деньги', s: { MONEY: 2 } },
      { t: 'В рассуждениях о людях и отношениях', s: { RELAT: 2 } },
      { t: 'Когда говорят о моём деле', s: { CRAFT: 2 } },
      { t: 'Про власть и «как всё устроено»', s: { POWER: 2 } },
      { t: 'Про науку, идеи, факты', s: { IDEAS: 2 } },
      { t: 'Про общество и справедливость', s: { SOCIETY: 2 } },
      { t: 'Про смысл, ценности, веру', s: { MEANING: 2 } },
      { t: 'Про вкус, искусство, форму', s: { BEAUTY: 2 } },
      { t: 'О воспитании и семье', s: { FAMILY: 2 } },
      { t: 'О времени, планах, приоритетах', s: { TIME: 2 } } ] },
    { axis: 'O', limit: 2, prompt: 'По какому вопросу к тебе приходят за советом?', hint: 'Внешнее признание компетенции. До 2.', opts: [
      { t: 'Деньги, работа, как поступить', s: { MONEY: 1, CRAFT: 1 } },
      { t: 'Отношения, как быть с человеком', s: { RELAT: 2 } },
      { t: 'Решения — помоги взвесить', s: { DECIDE: 2 } },
      { t: 'Профессиональное в моей области', s: { CRAFT: 2 } },
      { t: 'Семья, дети, родители', s: { FAMILY: 2 } },
      { t: 'Понять себя/другого', s: { SELF: 2 } },
      { t: 'Как что устроено, объясни', s: { IDEAS: 2 } },
      { t: 'Вкус: помоги выбрать красиво', s: { BEAUTY: 2 } },
      { t: 'Ко мне редко приходят за советом', s: {} } ] },
    { axis: 'O', limit: 2, prompt: 'О чём можешь говорить час — углубляясь и не повторяясь?', hint: 'Выносливость мысли. До 2.', opts: [
      { t: 'Время, жизнь, как её проживать', s: { TIME: 2 } },
      { t: 'Деньги и как они работают', s: { MONEY: 2 } },
      { t: 'Моё дело и мастерство', s: { CRAFT: 2 } },
      { t: 'Люди и отношения', s: { RELAT: 2 } },
      { t: 'Власть, влияние, решения', s: { POWER: 2 } },
      { t: 'Идеи, теории, устройство мира', s: { IDEAS: 2 } },
      { t: 'Общество и почему оно такое', s: { SOCIETY: 2 } },
      { t: 'Смысл, ценности, мировоззрение', s: { MEANING: 2 } },
      { t: 'Красота, искусство, форма', s: { BEAUTY: 2 } },
      { t: 'Себя и свою внутреннюю кухню', s: { SELF: 2 } } ] },
    { axis: 'O', limit: 2, prompt: 'В какой теме ты изменил мнение, разобравшись глубже?', hint: 'Мнение менялось от работы мысли — признак думания. До 2.', opts: [
      { t: 'О деньгах и достатке', s: { MONEY: 2 } },
      { t: 'Об отношениях и близости', s: { RELAT: 2 } },
      { t: 'О себе и своих мотивах', s: { SELF: 2 } },
      { t: 'О семье и родителях', s: { FAMILY: 2 } },
      { t: 'О власти и устройстве мира', s: { POWER: 1, SOCIETY: 1 } },
      { t: 'О своём деле', s: { CRAFT: 2 } },
      { t: 'О смысле, вере, ценностях', s: { MEANING: 2 } },
      { t: 'Об идеях, науке, картине мира', s: { IDEAS: 2 } },
      { t: 'Ни в какой — взгляды устойчивы', s: {} } ] }
  ];

  // ---------- состояние ----------
  var ST = { answers: null, result: null, cur: 0, theme: null, arch: '', blind: null, history: [], busy: false };

  function container() { return document.getElementById('screenContainer'); }
  function injectCSS() {
    if (document.getElementById('ktCSS')) return;
    var s = document.createElement('style'); s.id = 'ktCSS';
    // Стили dark-first (приложение по умолчанию тёмное, переменной --surface в нём НЕТ),
    // плюс отдельные оверрайды для светлой темы [data-theme="light"] — как в dreams.js/anchors.js.
    s.textContent = [
      // ---------- БАЗА (тёмная тема) ----------
      '.kt-wrap{max-width:720px;margin:0 auto;padding:18px 16px 80px;color:#f2f3f5}',
      '.kt-h1{font-size:1.5rem;font-weight:800;letter-spacing:-.01em;margin:6px 0 10px;line-height:1.15;color:#fff}',
      '.kt-lead{font-size:1.04rem;color:#aeb1bd;line-height:1.62;margin-bottom:18px}',
      '.kt-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 20px;margin-bottom:12px;color:#dfe2e8;overflow-wrap:break-word;font-size:.98rem;line-height:1.62}',
      '.kt-card b,.kt-card strong{color:#fff;font-weight:600}',
      '.kt-ch{font-size:1.06rem;font-weight:700;color:#fff;letter-spacing:-.005em;margin-bottom:8px;line-height:1.25}',
      '.kt-card .kt-li{margin:7px 0;padding-left:2px}',
      '.kt-btn{display:block;width:100%;text-align:left;padding:16px 18px;border-radius:14px;border:1.5px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#f2f3f5;font:600 1rem Inter,sans-serif;cursor:pointer;margin-bottom:10px;transition:all .15s}',
      '.kt-btn:hover{border-color:#3A86FF;transform:translateY(-1px)}',
      '.kt-btn .em{font-size:1.4rem;margin-right:10px}',
      '.kt-btn small{display:block;font-weight:400;color:#9a9da8;margin-top:3px;font-size:.85rem}',
      '.kt-primary{background:#3A86FF!important;color:#fff!important;border:none!important;text-align:center}',
      '.kt-primary small{color:rgba(255,255,255,.85)!important}',
      '.kt-primary:hover{background:#1d6fed!important}',
      '.kt-ghost{background:transparent;border:none;color:#5fa0ff;font-weight:600;cursor:pointer;padding:10px;font-size:.95rem}',
      '.kt-opt{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1.5px solid rgba(255,255,255,.14);border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:.96rem;line-height:1.4;background:rgba(255,255,255,.05);color:#f2f3f5}',
      '.kt-opt.sel{border-color:#3A86FF;background:rgba(58,134,255,.18)}',
      '.kt-opt .mk{flex:0 0 20px;height:20px;border:2px solid rgba(255,255,255,.35);border-radius:6px;margin-top:1px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px}',
      '.kt-opt.sel .mk{background:#3A86FF;border-color:#3A86FF}',
      '.kt-prog{height:6px;background:rgba(255,255,255,.14);border-radius:99px;overflow:hidden;margin-bottom:6px}',
      '.kt-prog>i{display:block;height:100%;background:linear-gradient(90deg,#3A86FF,#6366f1);width:0;transition:width .3s}',
      '.kt-plabel{font-size:12px;color:#9a9da8;margin-bottom:16px}',
      '.kt-nav{display:flex;justify-content:space-between;gap:10px;margin-top:14px}',
      '.kt-q{font-size:1.2rem;font-weight:700;line-height:1.25;margin-bottom:4px;color:#fff}',
      '.kt-qh{font-size:.85rem;color:#9a9da8;margin-bottom:14px}',
      '.kt-axis{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:6px;margin-bottom:12px}',
      '.kt-axis.t{background:rgba(245,158,11,.2);color:#fcd34d}',
      '.kt-axis.o{background:rgba(58,134,255,.2);color:#93c5fd}',
      '.kt-dom{margin-bottom:11px}',
      '.kt-dom-top{display:flex;justify-content:space-between;font-size:.92rem;margin-bottom:4px}',
      '.kt-dom-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}',
      '.kt-bar{height:6px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden;margin:2px 0}',
      '.kt-bar>i{display:block;height:100%;border-radius:99px}',
      '.kt-decl{background:linear-gradient(135deg,#0B1220,#24305a);color:#fff;border-radius:14px;padding:18px;margin:14px 0;line-height:1.5;border:1px solid rgba(58,134,255,.3)}',
      '.kt-decl b{color:#fff}',
      '.kt-chat{display:flex;flex-direction:column;gap:10px;margin:12px 0}',
      '.kt-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:.96rem;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
      '.kt-msg.f{align-self:flex-start;background:rgba(58,134,255,.18);color:#eaf1ff;border-bottom-left-radius:4px}',
      '.kt-msg.u{align-self:flex-end;background:#3A86FF;color:#fff;border-bottom-right-radius:4px}',
      '.kt-msg.sys{align-self:center;background:transparent;color:#8a8d98;font-size:.82rem;font-style:italic;text-align:center;max-width:95%}',
      '.kt-typing{align-self:flex-start;color:#9a9da8;font-size:.85rem;font-style:italic;padding:6px 4px}',
      '.kt-inrow{display:flex;gap:8px;align-items:flex-end;margin-top:8px}',
      '.kt-ta{flex:1;min-width:0;resize:none;padding:12px 14px;border-radius:14px;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f2f3f5;font:400 1rem Inter,sans-serif;max-height:140px;min-height:46px;line-height:1.4}',
      '.kt-ta::placeholder{color:#7a7d88}',
      '.kt-send{flex:0 0 46px;height:46px;border-radius:50%;border:none;background:#3A86FF;color:#fff;font-size:1.2rem;cursor:pointer}',
      '.kt-send:disabled{opacity:.5;cursor:not-allowed}',
      '.kt-mic{flex:0 0 46px;height:46px;border-radius:50%;border:none;background:linear-gradient(135deg,#10b981,#0e8f6f);color:#fff;font-size:1.25rem;cursor:pointer;line-height:1;box-shadow:0 4px 14px rgba(16,185,129,.45);transition:transform .15s ease,box-shadow .15s ease}',
      '.kt-mic:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(16,185,129,.55)}',
      '.kt-mic:active{transform:scale(.94)}',
      '.kt-mic.rec{background:linear-gradient(135deg,#ef4444,#b91c1c);box-shadow:0 4px 14px rgba(239,68,68,.55);animation:ktPulse 1.1s ease-in-out infinite}',
      '.kt-mic.off{opacity:.4;cursor:default;box-shadow:none}',
      '.kt-hint{font-size:.82rem;color:#a0a3b0;text-align:center;margin-top:8px;line-height:1.45}',
      '.kt-hint b{color:#10b981;font-weight:600}',
      '@keyframes ktPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}',
      '.kt-chip{display:inline-block;padding:6px 12px;border-radius:20px;border:1.5px solid rgba(255,255,255,.18);margin:3px;font-size:.86rem;cursor:pointer;background:rgba(255,255,255,.05);color:#f2f3f5}',
      '.kt-chip.sel{border-color:#3A86FF;background:rgba(58,134,255,.2);color:#bcd5ff;font-weight:600}',
      // ---------- ОВЕРРАЙДЫ СВЕТЛОЙ ТЕМЫ ----------
      '[data-theme="light"] .kt-wrap{color:#1c1c1e}',
      '[data-theme="light"] .kt-h1,[data-theme="light"] .kt-q{color:#0b1220}',
      '[data-theme="light"] .kt-lead,[data-theme="light"] .kt-qh,[data-theme="light"] .kt-plabel{color:#5a5a5e}',
      '[data-theme="light"] .kt-card{background:#fff;border-color:rgba(0,0,0,.1);color:#333}',
      '[data-theme="light"] .kt-card b,[data-theme="light"] .kt-card strong{color:#0b1220}',
      '[data-theme="light"] .kt-ch{color:#0b1220}',
      '[data-theme="light"] .kt-btn{background:#fff;border-color:rgba(0,0,0,.12);color:#1c1c1e}',
      '[data-theme="light"] .kt-btn small{color:#6c6c70}',
      '[data-theme="light"] .kt-primary{background:#3A86FF!important;color:#fff!important}',
      '[data-theme="light"] .kt-ghost{color:#1d6fed}',
      '[data-theme="light"] .kt-opt{background:#fff;border-color:rgba(0,0,0,.12);color:#1c1c1e}',
      '[data-theme="light"] .kt-opt.sel{background:rgba(58,134,255,.08);border-color:#3A86FF}',
      '[data-theme="light"] .kt-opt .mk{border-color:rgba(0,0,0,.25)}',
      '[data-theme="light"] .kt-prog,[data-theme="light"] .kt-bar{background:rgba(0,0,0,.1)}',
      '[data-theme="light"] .kt-axis.t{background:rgba(245,158,11,.14);color:#b45309}',
      '[data-theme="light"] .kt-axis.o{background:rgba(58,134,255,.14);color:#1d6fed}',
      '[data-theme="light"] .kt-msg.f{background:rgba(58,134,255,.1);color:#0b1220}',
      '[data-theme="light"] .kt-msg.sys{color:#8a8a8e}',
      '[data-theme="light"] .kt-typing{color:#8a8a8e}',
      '[data-theme="light"] .kt-ta{background:#fff;border-color:rgba(0,0,0,.15);color:#1c1c1e}',
      '[data-theme="light"] .kt-ta::placeholder{color:#9a9a9e}',
      '[data-theme="light"] .kt-chip{background:#fff;border-color:rgba(0,0,0,.14);color:#1c1c1e}',
      '[data-theme="light"] .kt-chip.sel{background:rgba(58,134,255,.1);color:#1d6fed}',
      '[data-theme="light"] .kt-mic{background:linear-gradient(135deg,#10b981,#0e8f6f);color:#fff;box-shadow:0 3px 10px rgba(16,185,129,.35)}',
      '[data-theme="light"] .kt-mic.rec{background:linear-gradient(135deg,#ef4444,#b91c1c);box-shadow:0 3px 10px rgba(239,68,68,.4)}',
      '[data-theme="light"] .kt-hint{color:#6c6c70}',
      '[data-theme="light"] .kt-hint b{color:#059669}',
      // ---------- МОБИЛЬНАЯ АДАПТАЦИЯ ----------
      '@media(max-width:560px){.kt-wrap{padding:14px 12px 88px}.kt-h1{font-size:1.3rem}.kt-q{font-size:1.1rem}.kt-lead{font-size:.97rem}.kt-msg{max-width:92%}.kt-chip{padding:10px 14px}.kt-btn{padding:14px 15px}.kt-card{padding:16px}}',
      '@media(max-width:380px){.kt-h1{font-size:1.18rem}.kt-lead{font-size:.93rem}.kt-q{font-size:1.04rem}.kt-send,.kt-mic{flex-basis:42px;height:42px;font-size:1.05rem}.kt-btn .em{font-size:1.25rem}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ============================================================
  // ЭКРАН 0 — ХАБ
  // ============================================================
  // ВЕРХНИЙ ХАБ «ИГРЫ» — список игр (пункт левого меню ведёт сюда)
  function showKonturScreen() {
    injectCSS();
    if (_rec.on) stopVoice();
    track('feature_opened', { feature: 'games' });
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="kt-wrap">' +
        '<div class="kt-h1">🎮 Игры</div>' +
        '<div class="kt-lead">Игры, которые помогают думать яснее и жить осознаннее — не «убить время», а потренировать то, что реально меняет жизнь. Каждая новая игра появляется здесь только после того, как доведена до ума и проверена. Качество важнее количества.</div>' +
        '<button class="kt-btn" onclick="KONTUR.gameHome()"><span class="em">🧠</span>О чём ты умеешь думать<small>Тренажёр мышления: тест + игра с Фреди. Учишься думать о конкретных темах вместо «обо всём».</small></button>' +
        '<button class="kt-btn" onclick="window.showMeisterGame&&window.showMeisterGame()"><span class="em">🗝️</span>МЕЙСТЕР-КОД<small>Тренажёр высшего навыка: вытащи из собеседника его сильные слова — не прося напрямую. Произнёс вслух — стал.</small></button>' +
        '<button class="kt-btn" onclick="window.showMarketologGame&&window.showMarketologGame()"><span class="em">📣</span>Маркетолог <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Разговорный гипноз через историю: по 3 картам построй рассказ так, чтобы слушатель погрузился, захотел предмет и сам пришёл к выводу.</small></button>' +
        '<button class="kt-btn" onclick="window.showVariatikaGame&&window.showVariatikaGame()"><span class="em">🔮</span>Вариатика — Basic <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Тренажёр чтения людей: 2 истории одного типа → найди паттерн → предскажи, как поведёт себя третий. 4 масти × уровни 6–10.</small></button>' +
        '<button class="kt-btn" onclick="window.showProgressiveGame&&window.showProgressiveGame()"><span class="em">🚀</span>Вариатика — Progressive <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Игра в 7 уровней по переходу в сектор ЧВ: конвертация ценностей, краники, ЛНСВ, БДК, поддержание связей. От «новичка» до «архитектора связей».</small></button>' +
        '<button class="kt-btn" onclick="window.showIntensiveGame&&window.showIntensiveGame()"><span class="em">💎</span>Вариатика — Intensive <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Перспективное мышление УБ-масти: 3 уровня «Хрустального шара» — анализ, предсказание, формирование событий через канон 9 кружков.</small></button>' +
        '<button class="kt-btn" onclick="window.showImperativeGame&&window.showImperativeGame()"><span class="em">🛡️</span>Императив <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Высшие навыки СБ-масти: 9 уровней пути — от «замри» к «законодателю». Лидерство, доминирование, владение силой как ресурсом.</small></button>' +
        '<button class="kt-btn" onclick="window.showExponentaGame&&window.showExponentaGame()"><span class="em">📈</span>Экспонента <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Высшие навыки ТФ-масти: 9 уровней — от «работай рядом с домом» к «создавай новый рынок». Бизнес как война за клиентов.</small></button>' +
        '<button class="kt-btn" onclick="window.showPatternGame&&window.showPatternGame()"><span class="em">🎯</span>Паттерн: Охота на невидимое <span style="font-size:.8rem;color:#f0b24b">💎 Premium</span><small>Тренажёр главного навыка ЧВ-масти: видение скрытых правил. Фреди играет агента с секретным правилом — ты вычисляешь его. Путь от ЧВ-8 к ЧВ-10.</small></button>' +
        '<div class="kt-card" style="opacity:.65"><div class="kt-ch">Скоро — новые игры</div>Каждую доводим до ума и проверяем, потом добавляем следующую.</div>' +
      '</div>';
  }

  // ХАБ ИГРЫ «О чём ты умеешь думать» (интро / тест / играть)
  function gameHome() {
    injectCSS();
    if (_rec.on) stopVoice();
    track('feature_opened', { feature: 'kontur' });
    var c = container(); if (!c) return;
    var hot = (loadResult() || {}).hotName;
    var axes = loadAxes(), akeys = Object.keys(axes), recap = '';
    if (akeys.length) {
      recap = '<div class="kt-card" style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">🧭 Твои слепые оси</div>';
      akeys.sort(function (a, b) { return (axes[b].ts || 0) - (axes[a].ts || 0); }).slice(0, 6).forEach(function (t) {
        var k = axes[t].blind; if (!THEMES[t] || !ARCHETYPES[k]) return;
        recap += '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.12);font-size:.9rem"><span>' + esc(THEMES[t].name) + '</span><span style="color:var(--text-secondary,#888)">' + ARCHETYPES[k].emoji + ' ' + esc(ARCHETYPES[k].name) + '</span></div>';
      });
      recap += '<div style="font-size:11px;color:var(--text-secondary,#999);margin-top:8px">Угол, который ты в этой теме обходил. Сыграй её снова и начни с него.</div></div>';
    }
    c.innerHTML =
      '<div class="kt-wrap">' +
        '<button class="kt-ghost" onclick="KONTUR.gamesHome()">← К списку игр</button>' +
        '<div class="kt-h1">🧠 О чём ты умеешь думать</div>' +
        '<div class="kt-lead">Большинство на вопрос «о чём ты умеешь думать?» отвечают «обо всём». Это то же самое, что «что умею руками? — Всё»: не широта, а отсутствие различения. Здесь ты узнаешь свой настоящий, короткий список — и научишься его расширять. Думать вместе с Фреди.</div>' +
        '<button class="kt-btn" onclick="KONTUR.intro()"><span class="em">📖</span>Зачем это нужно<small>Коротко и по делу: что не так с «обо всём» и как это чинится</small></button>' +
        '<button class="kt-btn" onclick="KONTUR.test()"><span class="em">🧭</span>Пройти тест-диагностику<small>8 вопросов → честная карта: о чём ты думаешь уже сейчас</small></button>' +
        '<button class="kt-btn" onclick="KONTUR.game()"><span class="em">🎮</span>Играть с Фреди' + (hot ? ('<small>Твоя горячая тема по тесту: ' + esc(hot) + '</small>') : '<small>Выбери тему — и Фреди проведёт тебя через настоящее думание</small>') + '</button>' +
        '<div class="kt-card" style="margin-top:14px;font-size:.9rem;color:var(--text-secondary,#777)">💡 <b>Главная подсказка модуля:</b> человек умеет думать о том, о чём он больше всего думает. Не о прочитанном один раз — о том, куда возвращается сотни раз. Этот модуль даёт повод возвращаться правильно.</div>' +
        recap +
      '</div>';
  }

  // ============================================================
  // ЭКРАН — ИНТРО (зачем)
  // ============================================================
  function intro() {
    var c = container(); if (!c) return;
    c.innerHTML =
      '<div class="kt-wrap">' +
        '<button class="kt-ghost" onclick="KONTUR.gameHome()">← Назад</button>' +
        '<div class="kt-h1">Зачем этот модуль</div>' +
        '<div class="kt-card"><div class="kt-ch">Проблема</div>«Иметь мысли» и «уметь думать» — разные вещи. Мысли есть у всех и обо всём: это быстрая, автоматическая работа мозга (Канеман называл это Системой&nbsp;1). А «уметь думать о&nbsp;Х» — это медленное усилие (Система&nbsp;2): держать одну мысль дольше, чем хочется, и не сваливаться в готовое мнение.</div>' +
        '<div class="kt-card"><div class="kt-ch">4 признака настоящего думания</div>' +
          '<div class="kt-li">1. <b>Конкретная тема</b> — не «жизнь», а «как я принимаю решения о деньгах».</div>' +
          '<div class="kt-li">2. <b>Инструменты</b> — понятия и различения, а не только «нравится / правильно».</div>' +
          '<div class="kt-li">3. <b>Выносливость</b> — не уходишь в готовый ответ через 5&nbsp;секунд.</div>' +
          '<div class="kt-li">4. <b>Видишь то, чего не видит новичок</b> в этой теме.</div></div>' +
        '<div class="kt-card"><div class="kt-ch">Как модуль это развивает</div>' +
          '<div class="kt-li">• <b>Тест</b> показывает, о чём ты думаешь уже сейчас — куда мысль идёт сама и где есть инструменты.</div>' +
          '<div class="kt-li">• <b>Игра с Фреди</b> — тренажёр: Фреди берёт тему и проводит её через 4 угла (оси) мышления, не даёт соскользнуть в мнение, ловит, когда ты застрял в одной мерке, и в конце показывает твою <b>слепую ось</b> + конкретный вопрос для жизни.</div></div>' +
        '<div class="kt-card" style="border-color:rgba(58,134,255,.3)"><div class="kt-ch">Что ты получишь</div>Не «правильные ответы» (их тут нет), а <b>навык</b>: держать мысль, видеть тему с разных сторон, отличать своё думание от чужих мнений в своей голове. Это переносится на деньги, отношения, работу — на любую тему жизни.</div>' +
        '<button class="kt-btn kt-primary" onclick="KONTUR.test()">Начать с теста →</button>' +
        '<button class="kt-ghost" style="width:100%;margin-top:6px" onclick="KONTUR.game()">или сразу играть с Фреди</button>' +
      '</div>';
  }

  // ============================================================
  // ЭКРАН — ТЕСТ
  // ============================================================
  function test() {
    ST.answers = Q.map(function () { return []; });
    ST.cur = 0;
    renderQ();
  }
  function renderQ() {
    var c = container(); if (!c) return;
    var q = Q[ST.cur], sel = ST.answers[ST.cur];
    var pct = (ST.cur / Q.length) * 100;
    var html = '<div class="kt-wrap">' +
      '<div class="kt-prog"><i style="width:' + pct + '%"></i></div>' +
      '<div class="kt-plabel">Вопрос ' + (ST.cur + 1) + ' из ' + Q.length + (q.limit > 1 ? (' · до ' + q.limit) : '') + '</div>' +
      '<span class="kt-axis ' + (q.axis === 'T' ? 't' : 'o') + '">' + (q.axis === 'T' ? 'Куда идёт мысль' : 'Где есть инструменты') + '</span>' +
      '<div class="kt-q">' + esc(q.prompt) + '</div><div class="kt-qh">' + esc(q.hint) + '</div>';
    q.opts.forEach(function (o, i) {
      var on = sel.indexOf(i) > -1;
      html += '<div class="kt-opt' + (on ? ' sel' : '') + '" onclick="KONTUR.pick(' + i + ')"><span class="mk">' + (on ? '✓' : '') + '</span><span>' + esc(o.t) + '</span></div>';
    });
    html += '<div class="kt-nav"><button class="kt-ghost" onclick="KONTUR.qback()">' + (ST.cur === 0 ? '← В меню' : '← Назад') + '</button>' +
      '<button class="kt-btn kt-primary" style="width:auto;margin:0;padding:12px 24px" onclick="KONTUR.qnext()"' + (sel.length === 0 ? ' disabled' : '') + '>' + (ST.cur === Q.length - 1 ? 'Карта →' : 'Далее →') + '</button></div>';
    html += '</div>';
    c.innerHTML = html;
  }
  function pick(i) {
    var q = Q[ST.cur], sel = ST.answers[ST.cur], p = sel.indexOf(i);
    if (p > -1) sel.splice(p, 1);
    else if (q.limit === 1) ST.answers[ST.cur] = [i];
    else if (sel.length < q.limit) sel.push(i);
    else { toast('Можно выбрать до ' + q.limit, 'info'); return; }
    renderQ();
  }
  function qback() { if (ST.cur > 0) { ST.cur--; renderQ(); } else showKonturScreen(); }
  function qnext() { if (ST.answers[ST.cur].length === 0) return; if (ST.cur < Q.length - 1) { ST.cur++; renderQ(); } else showResult(); }

  function compute() {
    var s = {}; THEME_ORDER.forEach(function (d) { s[d] = { t: 0, o: 0 }; });
    Q.forEach(function (q, qi) {
      ST.answers[qi].forEach(function (i) {
        var sc = q.opts[i].s || {};
        for (var k in sc) { s[k][q.axis === 'T' ? 't' : 'o'] += sc[k]; }
      });
    });
    var maxT = 1, maxO = 1;
    THEME_ORDER.forEach(function (d) { if (s[d].t > maxT) maxT = s[d].t; if (s[d].o > maxO) maxO = s[d].o; });
    return THEME_ORDER.map(function (d) {
      var tn = s[d].t / maxT, on = s[d].o / maxO, q;
      if (s[d].t === 0 && s[d].o === 0) q = 'OFF';
      else if (tn >= 0.5 && on >= 0.5) q = 'MASTER';
      else if (tn >= 0.5 && on < 0.5) q = 'HOT';
      else if (tn < 0.5 && on >= 0.5) q = 'SLEEP';
      else q = 'LOW';
      return { d: d, t: s[d].t, o: s[d].o, tn: tn, on: on, q: q, sum: s[d].t + s[d].o };
    });
  }
  var TAG = { MASTER: { c: '#16A34A', t: 'умею думать' }, HOT: { c: '#F59E0B', t: 'горячее' }, SLEEP: { c: '#3A86FF', t: 'спящее' }, LOW: { c: '#94A3B8', t: '' }, OFF: { c: '#94A3B8', t: '' } };

  function showResult() {
    var c = container(); if (!c) return;
    var rows = compute();
    var master = rows.filter(function (r) { return r.q === 'MASTER'; }).sort(function (a, b) { return b.sum - a.sum; });
    var hot = rows.filter(function (r) { return r.q === 'HOT'; }).sort(function (a, b) { return b.t - a.t; });
    var sleep = rows.filter(function (r) { return r.q === 'SLEEP'; }).sort(function (a, b) { return b.o - a.o; });
    var total = ST.answers.reduce(function (a, b) { return a + b.length; }, 0);

    // запоминаем горячую/мастер тему для игры
    var focus = hot[0] || master[0] || null;
    saveResult({ hot: focus ? focus.d : null, hotName: focus ? THEMES[focus.d].name : null, ts: Date.now() });

    var html = '<div class="kt-wrap"><div class="kt-h1">Твоя карта мышления</div>';
    if (total < 4) {
      html += '<div class="kt-card">Ты выбрал слишком мало, чтобы карта была честной. Пройди заново и отвечай смелее — выбирай даже то, в чём не уверен.</div>' +
        '<button class="kt-btn kt-primary" onclick="KONTUR.test()">Пройти заново</button><button class="kt-ghost" style="width:100%" onclick="KONTUR.gameHome()">В меню</button></div>';
      c.innerHTML = html; return;
    }
    if (master.length) {
      var nm = master.slice(0, 3).map(function (r) { return THEMES[r.d].name.toLowerCase(); });
      html += '<div class="kt-decl">Скажи вслух: <b>«Я умею думать о ' + listRu(nm) + '»</b>.<br><span style="font-size:.85rem;color:#9CA3AF">Это твой настоящий список. Он короче, чем «обо всём» — и поэтому в нём есть опора.</span></div>';
    } else if (hot.length) {
      html += '<div class="kt-decl"><b>Ты много думаешь — но пока по кругу.</b><br><span style="font-size:.85rem;color:#9CA3AF">Есть тяга, не хватает инструментов. Это самая удобная стартовая точка: где огонь, навык растёт быстрее.</span></div>';
    } else {
      html += '<div class="kt-card">Сильных контуров пока не видно — и это норма, большинство живёт в Системе 1. Зато ясно, куда направить тренировку.</div>';
    }
    html += groupHtml('О чём ты умеешь думать сейчас', 'Тяга есть, и инструменты есть — здесь ты реально думаешь.', master);
    html += groupHtml('Думаешь много — но по кругу', 'Мысль идёт сама, но крутится без инструментов. Сюда играть в первую очередь.', hot);
    html += groupHtml('Умеешь, но забросил', 'Инструменты есть, тяги мало. Реши: возвращать или отпустить.', sleep);

    if (focus) {
      html += '<button class="kt-btn kt-primary" onclick="KONTUR.gameWith(\'' + focus.d + '\')">🎮 Сыграть с Фреди про «' + esc(THEMES[focus.d].name) + '» →</button>';
    } else {
      html += '<button class="kt-btn kt-primary" onclick="KONTUR.game()">🎮 Выбрать тему и сыграть с Фреди →</button>';
    }
    html += '<button class="kt-ghost" style="width:100%" onclick="KONTUR.test()">Пройти заново</button>';
    html += '<button class="kt-ghost" style="width:100%" onclick="KONTUR.gameHome()">В меню</button></div>';
    c.innerHTML = html;
    track('feature_opened', { feature: 'kontur_test_done' });
  }
  function groupHtml(title, desc, arr) {
    if (!arr.length) return '';
    var h = '<div class="kt-card"><div style="font-weight:700;margin-bottom:3px">' + title + '</div><div style="font-size:.85rem;color:var(--text-secondary,#888);margin-bottom:12px">' + desc + '</div>';
    arr.forEach(function (r) {
      h += '<div class="kt-dom"><div class="kt-dom-top"><span>' + esc(THEMES[r.d].name) + '</span><span class="kt-dom-tag" style="color:' + TAG[r.q].c + '">' + TAG[r.q].t + '</span></div>' +
        '<div class="kt-bar"><i style="width:' + Math.round(r.tn * 100) + '%;background:#F59E0B"></i></div>' +
        '<div class="kt-bar"><i style="width:' + Math.round(r.on * 100) + '%;background:#3A86FF"></i></div></div>';
    });
    h += '<div style="font-size:11px;color:var(--text-secondary,#999);margin-top:4px">оранжевая — тяга · синяя — инструменты</div></div>';
    return h;
  }
  function listRu(a) { if (a.length === 1) return a[0]; if (a.length === 2) return a[0] + ' и ' + a[1]; return a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1]; }

  // ============================================================
  // ЭКРАН — ИГРА С ФРЕДИ
  // ============================================================
  function game() {
    if (_rec.on) stopVoice();
    var c = container(); if (!c) return;
    var html = '<div class="kt-wrap"><button class="kt-ghost" onclick="KONTUR.gameHome()">← Назад</button>' +
      '<div class="kt-h1">🎮 Игра с Фреди</div>' +
      '<div class="kt-lead">Выбери тему — Фреди будет не отвечать за тебя, а заставлять тебя думать: подсовывать инструменты, поворачивать тему гранями и ловить, когда ты соскальзываешь в готовое мнение.</div>' +
      '<div class="kt-card"><div style="font-weight:700;margin-bottom:8px">1. Тема</div><div id="ktThemes">';
    THEME_ORDER.forEach(function (d) { html += '<span class="kt-chip" data-th="' + d + '" onclick="KONTUR.selTheme(\'' + d + '\')">' + esc(THEMES[d].name) + '</span>'; });
    html += '</div></div>' +
      '<div class="kt-card"><div style="font-weight:700;margin-bottom:8px">2. Как будем думать</div><div id="ktArch">';
    html += '<span class="kt-chip sel" data-arch="" onclick="KONTUR.selArch(\'\')">🌀 Все 4 оси · рекомендую</span>';
    ARCH_ORDER.forEach(function (a) { html += '<span class="kt-chip" data-arch="' + a + '" onclick="KONTUR.selArch(\'' + a + '\')">' + ARCHETYPES[a].emoji + ' ' + esc(ARCHETYPES[a].name) + '</span>'; });
    html += '</div><div id="ktArchHint" style="font-size:.82rem;color:var(--text-secondary,#888);margin-top:10px;line-height:1.45">Фреди проведёт тему через все 4 угла и в конце покажет твою <b>слепую ось</b> — угол, который ты сам обходишь.</div></div>' +
      '<button class="kt-btn kt-primary" id="ktStartBtn" onclick="KONTUR.startGame()" disabled>Выбери тему, чтобы начать</button></div>';
    c.innerHTML = html;
    ST.theme = null; ST.arch = '';
  }
  function gameWith(d) { game(); selTheme(d); }
  function selTheme(d) {
    ST.theme = d;
    document.querySelectorAll('#ktThemes .kt-chip').forEach(function (ch) { ch.classList.toggle('sel', ch.getAttribute('data-th') === d); });
    var b = document.getElementById('ktStartBtn'); if (b) { b.disabled = false; b.textContent = 'Думать про «' + THEMES[d].name + '» с Фреди →'; }
  }
  function selArch(a) {
    ST.arch = a;
    document.querySelectorAll('#ktArch .kt-chip').forEach(function (ch) { ch.classList.toggle('sel', ch.getAttribute('data-arch') === a); });
    var h = document.getElementById('ktArchHint');
    if (h) {
      if (a && ARCHETYPES[a]) h.innerHTML = '<b>' + ARCHETYPES[a].emoji + ' ' + esc(ARCHETYPES[a].name) + '</b> — ' + esc(ARCHETYPES[a].unit) + '.<br>Даёт: ' + esc(ARCHETYPES[a].gain) + '. Включать: ' + esc(ARCHETYPES[a].where) + '.';
      else h.innerHTML = 'Фреди проведёт тему через все 4 угла и в конце покажет твою <b>слепую ось</b> — угол, который ты сам обходишь.';
    }
  }

  function startGame() {
    if (!ST.theme) { toast('Сначала выбери тему', 'info'); return; }
    ST.history = [];
    track('feature_opened', { feature: 'kontur_game', theme: ST.theme, arch: ST.arch || 'all' });
    renderChat();
    firstFrediMove();
  }

  function renderChat() {
    var c = container(); if (!c) return;
    var th = THEMES[ST.theme];
    var sub = th.name + (ST.arch ? (' · ' + ARCHETYPES[ST.arch].emoji + ' ' + ARCHETYPES[ST.arch].name) : ' · все 4 оси');
    var html = '<div class="kt-wrap">' +
      '<button class="kt-ghost" onclick="KONTUR.game()">← Сменить тему</button>' +
      '<div style="font-weight:700;font-size:1.05rem">🎮 ' + esc(th.name) + '</div>' +
      '<div style="font-size:.82rem;color:var(--text-secondary,#888);margin-bottom:6px">' + esc(sub) + '</div>' +
      '<div class="kt-chat" id="ktChat"></div>' +
      '<div id="ktTyping"></div>' +
      '<div class="kt-inrow"><textarea class="kt-ta" id="ktInput" rows="1" placeholder="Напиши свою мысль — или нажми 🎤 и думай вслух" oninput="KONTUR.grow(this)"></textarea>' +
      '<button class="kt-mic" id="ktMic" title="Размышлять вслух голосом" aria-label="Включить голосовой ввод">🎤</button>' +
      '<button class="kt-send" id="ktSend" onclick="KONTUR.send()" aria-label="Отправить">➤</button></div>' +
      '<div class="kt-hint" id="ktHint">Нажми зелёную <b>🎤</b>, чтобы думать вслух — Фреди распознает речь и подхватит мысль</div>' +
      '<div style="text-align:center;margin-top:10px"><button class="kt-ghost" onclick="KONTUR.verdict()">Завершить и получить вердикт Фреди</button></div>' +
      '</div>';
    c.innerHTML = html;
    paintChat();
    initVoice();
  }

  // ---------- голосовой ввод (STT через voiceManager приложения) ----------
  var _rec = { on: false, t0: 0, timer: null, savedT: null, savedC: null };
  function initVoice() {
    var mic = document.getElementById('ktMic'), input = document.getElementById('ktInput');
    if (!mic || !input) return;
    if (!window.voiceManager || typeof window.voiceManager.startRecording !== 'function') {
      mic.classList.add('off'); mic.onclick = function () { toast('🎤 Голосовой ввод недоступен в этом браузере', 'info'); };
      return;
    }
    mic.onclick = function () { _rec.on ? stopVoice() : startVoice(); };
  }
  function recHint(sec) {
    var h = document.getElementById('ktHint');
    if (h) h.innerHTML = sec == null
      ? 'Нажми зелёную <b>🎤</b>, чтобы думать вслух — Фреди распознает речь и подхватит мысль'
      : '<span style="color:#ef4444;font-weight:600">🔴 слушаю… ' + sec + ' с</span> <span style="color:#a0a3b0">— нажми ⏹, когда закончишь</span>';
  }
  async function startVoice() {
    var mic = document.getElementById('ktMic'), input = document.getElementById('ktInput');
    if (!window.voiceManager) return;
    _rec.savedT = window.voiceManager.onTranscript;
    _rec.savedC = window.voiceManager.onTranscriptComplete;
    window.voiceManager.sttOnly = true;
    window.voiceManager.onTranscript = function (text) {
      if (!text) return;
      input.value = input.value ? (input.value + ' ' + text) : text;
      grow(input);
    };
    window.voiceManager.onTranscriptComplete = function () {};
    _rec.on = true; _rec.t0 = Date.now();
    if (mic) { mic.classList.add('rec'); mic.textContent = '⏹'; }
    recHint(0);
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    _rec.timer = setInterval(function () {
      var s = Math.floor((Date.now() - _rec.t0) / 1000);
      recHint(s);
      if (s >= 180) { stopVoice(); toast('⏱ Достигнут лимит записи (3 мин)', 'info'); }
    }, 300);
    var ok = await window.voiceManager.startRecording();
    if (!ok) { stopVoice(); toast('🎤 Нет доступа к микрофону', 'error'); }
  }
  function stopVoice() {
    if (!_rec.on) return;
    if (_rec.timer) { clearInterval(_rec.timer); _rec.timer = null; }
    try { if (window.voiceManager && window.voiceManager.stopRecording) window.voiceManager.stopRecording(); } catch (e) {}
    _rec.on = false;
    var mic = document.getElementById('ktMic'); if (mic) { mic.classList.remove('rec'); mic.textContent = '🎤'; }
    recHint(null);
    // даём дойти финальному куску транскрипта, потом возвращаем хендлеры основному чату
    setTimeout(function () {
      if (window.voiceManager) {
        if (_rec.savedT !== null) window.voiceManager.onTranscript = _rec.savedT;
        if (_rec.savedC !== null) window.voiceManager.onTranscriptComplete = _rec.savedC;
        window.voiceManager.sttOnly = false;
        _rec.savedT = null; _rec.savedC = null;
      }
      var input = document.getElementById('ktInput');
      if (input && input.value.trim()) { input.focus(); }
    }, 700);
  }
  function paintChat() {
    var box = document.getElementById('ktChat'); if (!box) return;
    box.innerHTML = ST.history.map(function (m) {
      if (m.role === 'sys') return '<div class="kt-msg sys">' + esc(m.text) + '</div>';
      if (m.role === 'verdict') return '<div style="background:linear-gradient(135deg,rgba(59,130,255,.13),rgba(59,130,255,.04));border:1px solid rgba(59,130,255,.38);border-radius:14px;padding:14px 16px;margin:12px 0;line-height:1.55;font-size:.95rem">' + esc(m.text).replace(/\n/g, '<br>') + '</div>';
      if (m.role === 'cta') return '<div style="text-align:center;margin:6px 0 12px"><button class="kt-btn kt-primary" style="width:auto;margin:0;padding:12px 22px" onclick="KONTUR.playBlind()">' + esc(m.text) + '</button></div>';
      return '<div class="kt-msg ' + (m.role === 'fredi' ? 'f' : 'u') + '">' + esc(m.text) + '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
    try { var sc = document.getElementById('screenContainer'); if (sc) sc.scrollTop = sc.scrollHeight; } catch (e) {}
  }
  function grow(el) { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; }
  function typing(on) {
    var t = document.getElementById('ktTyping');
    if (t) t.innerHTML = on ? '<div class="kt-typing">Фреди думает…</div>' : '';
  }

  // системный промпт-ядро: «загруженные мыслительные алгоритмы»
  function buildPrompt(mode) {
    var th = THEMES[ST.theme];
    function axisLine(k) { var a = ARCHETYPES[k]; return '• ' + a.name + ' (' + a.unit + '): ' + a.q; }
    var focus = ST.arch && ARCHETYPES[ST.arch];
    var axesBlock, journey;
    if (focus) {
      var fa = ARCHETYPES[ST.arch];
      axesBlock = 'ОДНА ОСЬ НА ВСЮ ИГРУ — «' + fa.name + '» (' + fa.unit + '): ' + fa.q + '\n' +
        'Крути тему её гранями по очереди: ' + fa.lenses.map(function (l) { return LENSES[l].name + ' («' + LENSES[l].q + '»)'; }).join('; ') + '.';
      journey = 'Держи человека на этой оси и углубляй — не перескакивай на другие.';
    } else {
      axesBlock = '4 ОСИ МЫШЛЕНИЯ (через них вращай тему):\n' + ARCH_ORDER.map(axisLine).join('\n');
      journey = 'МЕХАНИКА ВРАЩЕНИЯ: начни с одной оси. Когда человек выдал на ней ЖИВУЮ мысль (или дважды соскользнул в мнение) — ЯВНО переведи его на ДРУГУЮ ось: назови её и задай её вопрос к теме («Это была ось состава. Теперь поверни через время — куда это движется?»). За игру проведи через все 4 оси, особенно ту, которую он сам обходит.';
    }
    var rules =
      'Ты — Фреди, ВЕДУЩИЙ тренажёра мышления (сейчас не психолог, а тренер мысли).\n' +
      'Тема игры: «' + th.name + '». Цель — не «правильный ответ», а заставить человека ДУМАТЬ на РАЗНЫХ осях, а не на одной привычной.\n\n' +
      axesBlock + '\n\n' + journey + '\n\n' +
      'ИНСТРУМЕНТЫ ТЕМЫ (подсовывай по одному, когда застрял): ' + th.tools.join('; ') + '.\n\n' +
      'ЖЁСТКИЕ ПРАВИЛА:\n' +
      '1. НИКОГДА не думай за него и не давай готовых выводов — только вопросы и по одному инструменту/оси.\n' +
      '2. После ответа про себя оцени: мысль или мнение (мнение = быстрое, общее, без инструмента)? Если мнение — мягко ткни и удержи на оси.\n' +
      '3. Лови ПОДМЕНУ ОСИ: если он меряет одно через другое («быстро — значит хорошо», «дорого — значит ценно»), назови это: «ты смешал две мерки — это разные оси».\n' +
      '4. Отвечай КОРОТКО: 2–4 предложения, ровно ОДИН вопрос. На «ты», живой язык, без списков и канцелярита.\n' +
      '5. Не хвали автоматически. Хвали только за реальное усилие и точность.\n';
    var hist = ST.history.filter(function (m) { return m.role !== 'sys' && m.role !== 'cta' && m.role !== 'verdict'; }).map(function (m) { return (m.role === 'fredi' ? 'ФРЕДИ' : 'ЧЕЛОВЕК') + ': ' + m.text; }).join('\n');
    if (mode === 'first') {
      return rules + '\nНАЧНИ ИГРУ: задай короткий парадокс-вход или острый вопрос по теме на ПЕРВОЙ оси — такой, чтобы сбить автоматический ответ. Только реплика Фреди, без префиксов.';
    }
    if (mode === 'verdict') {
      var blindSet = focus ? ('{' + ARCHETYPES[ST.arch].name + '}') : '{Анатом, Корневик, Навигатор, Картограф}';
      return rules + '\nДИАЛОГ:\n' + hist + '\n\n' +
        'Игра окончена. Сделай человеку КАРТУ ОСЕЙ по теме «' + th.name + '» — прямо, тепло, на «ты», без лести:\n' +
        '1) На каких осях он думал живо — 1–2 фразы по делу.\n' +
        '2) СЛЕПАЯ ОСЬ: какой угол он обходил или где сваливался в мнение. Назови её и почему это важно именно в теме «' + th.name + '».\n' +
        '3) ИНСТРУМЕНТ В ЖИЗНЬ: один конкретный вопрос, который ему стоит задавать себе в реальной жизни на этой слепой оси (про «' + th.name + '»).\n' +
        'Всего 5–8 предложений связной речью, без нумерации в тексте. Затем С НОВОЙ СТРОКИ добавь строго машинный тег слепой оси из набора ' + blindSet + ' в формате ровно так: ||BLIND:Название||';
    }
    return rules + '\nДИАЛОГ:\n' + hist + '\n\nОтветь как Фреди-ведущий на последнюю реплику человека и веди по механике вращения осей. Только реплика, без префиксов.';
  }

  async function firstFrediMove() {
    typing(true);
    try {
      var r = await aiGenerate(buildPrompt('first'), { temperature: 0.8, max_tokens: 200 });
      var txt = (r && r.success && r.content) ? clean(r.content) : fallbackFirst();
      ST.history.push({ role: 'fredi', text: txt });
    } catch (e) {
      ST.history.push({ role: 'fredi', text: fallbackFirst() });
    }
    typing(false); paintChat();
  }
  function fallbackFirst() {
    var th = THEMES[ST.theme];
    return 'Давай про «' + th.name.toLowerCase() + '». Не торопись с готовым ответом. Скажи: что в этой теме ты на самом деле НЕ понимаешь — то, на что нет лёгкого ответа?';
  }

  async function send() {
    if (_rec.on) stopVoice();
    if (ST.busy) return;
    var inp = document.getElementById('ktInput'); if (!inp) return;
    var txt = inp.value.trim(); if (!txt) return;
    ST.history.push({ role: 'user', text: txt });
    inp.value = ''; grow(inp);
    paintChat();
    ST.busy = true; var sb = document.getElementById('ktSend'); if (sb) sb.disabled = true;
    typing(true);
    try {
      var r = await aiGenerate(buildPrompt('turn'), { temperature: 0.75, max_tokens: 260 });
      var reply = (r && r.success && r.content) ? clean(r.content) : 'Поясни последнюю мысль конкретнее — на примере из своей жизни. Где это у тебя проявляется?';
      ST.history.push({ role: 'fredi', text: reply });
      track('message_sent', { feature: 'kontur_game' });
    } catch (e) {
      ST.history.push({ role: 'fredi', text: 'Связь подвисла. Но ты не жди меня — додумай вслух: что в этом главное и где ты можешь ошибаться?' });
    }
    typing(false); ST.busy = false; if (sb) sb.disabled = false;
    paintChat();
  }

  function archKeyByName(nm) {
    nm = String(nm || '').trim().toLowerCase();
    for (var i = 0; i < ARCH_ORDER.length; i++) { if (ARCHETYPES[ARCH_ORDER[i]].name.toLowerCase() === nm) return ARCH_ORDER[i]; }
    return null;
  }

  async function verdict() {
    var userTurns = ST.history.filter(function (m) { return m.role === 'user'; }).length;
    if (userTurns < 2) { toast('Сначала пройди хотя бы пару кругов с Фреди', 'info'); return; }
    ST.history.push({ role: 'sys', text: '— Фреди читает твою карту осей —' });
    paintChat(); typing(true);
    var v;
    try {
      var r = await aiGenerate(buildPrompt('verdict'), { temperature: 0.6, max_tokens: 460 });
      v = (r && r.success && r.content) ? clean(r.content) : '';
    } catch (e) { v = ''; }
    if (!v) v = 'Главное ты сделал — удержал мысль дольше привычного. Но заметь: почти весь разговор ты мерил тему одной меркой. Слепая ось — та, которую ты так и не включил. В следующий раз начни прямо с неё.';
    // вытащить машинный тег слепой оси и убрать его из текста
    var blindKey = null, mm = v.match(/\|\|\s*BLIND\s*:\s*([^|]+?)\s*\|\|/i);
    if (mm) blindKey = archKeyByName(mm[1]);
    v = v.replace(/\|\|\s*BLIND\s*:[^|]*\|\|/i, '').trim();
    typing(false);
    ST.history.push({ role: 'verdict', text: v });
    if (blindKey && ST.theme) {
      ST.blind = { theme: ST.theme, arch: blindKey };
      saveAxis(ST.theme, blindKey);
      ST.history.push({ role: 'cta', text: '🎯 Сыграть слепую ось: ' + ARCHETYPES[blindKey].emoji + ' ' + ARCHETYPES[blindKey].name });
    }
    paintChat();
    track('feature_opened', { feature: 'kontur_verdict', theme: ST.theme || '', blind: blindKey || '' });
  }

  function playBlind() {
    var b = ST.blind;
    if (!b || !ARCHETYPES[b.arch] || !b.theme) { game(); return; }
    ST.theme = b.theme; ST.arch = b.arch; ST.history = [];
    track('feature_opened', { feature: 'kontur_play_blind', theme: b.theme, arch: b.arch });
    renderChat();
    firstFrediMove();
  }

  function clean(s) {
    s = String(s || '').trim();
    s = s.replace(/^(ФРЕДИ|FREDI|Фреди)\s*[:：]\s*/i, '');
    s = s.replace(/^["«»\s]+|["«»\s]+$/g, function (m) { return m.replace(/[«»"]/g, '').trim() ? m : ''; });
    return s.trim();
  }

  // ---------- хранение результата теста ----------
  function saveResult(o) { try { localStorage.setItem('kontur_result', JSON.stringify(o)); } catch (e) {} ST.result = o; }
  function loadResult() { if (ST.result) return ST.result; try { return JSON.parse(localStorage.getItem('kontur_result') || 'null'); } catch (e) { return null; } }
  // слепые оси по темам — карта растёт от игры к игре
  function saveAxis(theme, archKey) { try { var m = JSON.parse(localStorage.getItem('kontur_axes') || '{}'); m[theme] = { blind: archKey, ts: Date.now() }; localStorage.setItem('kontur_axes', JSON.stringify(m)); } catch (e) {} }
  function loadAxes() { try { return JSON.parse(localStorage.getItem('kontur_axes') || '{}'); } catch (e) { return {}; } }

  // ---------- экспорт ----------
  window.KONTUR = {
    gamesHome: showKonturScreen, gameHome: gameHome, home: gameHome,
    intro: intro, test: test, game: game, gameWith: gameWith,
    pick: pick, qback: qback, qnext: qnext, selTheme: selTheme, selArch: selArch,
    startGame: startGame, send: send, verdict: verdict, grow: grow, playBlind: playBlind
  };
  window.showKonturScreen = showKonturScreen;   // пункт меню «Игры» (список игр)
  window.showKonturGame = gameHome;             // deep-link на саму игру «О чём ты умеешь думать»
  console.log('✅ kontur.js loaded (модуль «Игры»: О чём ты умеешь думать)');
})();
