// ============================================
// berne.js — Роли и игры по Берну (ТА)
// Версия 2.0 — Тест 12 вопросов по ситуациям
// ============================================

function _brInjectStyles() {
    if (document.getElementById('br-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'br-v2-styles';
    s.textContent = `
        /* ===== ТЕСТ ===== */
        .br-question-wrap {
            margin-bottom: 8px;
        }
        .br-question-num {
            font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px;
        }
        .br-question-text {
            font-size: 16px; font-weight: 600; color: var(--text-primary);
            line-height: 1.45; margin-bottom: 18px;
        }
        .br-answer {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px; padding: 14px 16px; margin-bottom: 8px;
            cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.1s;
            touch-action: manipulation;
        }
        .br-answer:hover  { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.22); }
        .br-answer:active { transform: scale(0.98); }
        .br-answer.selected {
            background: rgba(224,224,224,0.16); border-color: rgba(224,224,224,0.4);
        }
        .br-answer-text { font-size: 14px; color: var(--text-primary); line-height: 1.45; }

        /* Прогресс теста */
        .br-test-progress {
            height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px;
            margin-bottom: 20px; overflow: hidden;
        }
        .br-test-progress-fill {
            height: 100%; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome));
            border-radius: 2px; transition: width 0.4s;
        }

        /* ===== ТАБЫ ===== */
        .br-tabs {
            display: flex; gap: 4px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px; margin-bottom: 20px;
            overflow-x: auto; scrollbar-width: none;
        }
        .br-tabs::-webkit-scrollbar { display: none; }
        .br-tab {
            flex-shrink: 0; padding: 8px 14px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s; min-height: 36px; touch-action: manipulation;
        }
        .br-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* ===== ЭГО-СОСТОЯНИЯ ===== */
        .br-ego-grid {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;
        }
        .br-ego-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; text-align: center;
        }
        .br-ego-card.dominant {
            background: rgba(224,224,224,0.12); border-color: rgba(224,224,224,0.35);
        }
        .br-ego-icon  { font-size: 28px; display: block; margin-bottom: 6px; }
        .br-ego-name  { font-size: 11px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .br-ego-pct   { font-size: 20px; font-weight: 700; color: var(--chrome); }
        .br-ego-bar   { height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .br-ego-fill  { height: 100%; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); border-radius: 2px; }

        .br-result-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; padding: 20px;
            margin-bottom: 20px;
        }
        .br-result-header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .br-result-icon   { font-size: 40px; }
        .br-result-title  { font-size: 17px; font-weight: 700; color: var(--chrome); margin-bottom: 4px; }
        .br-result-sub    { font-size: 12px; color: var(--text-secondary); }
        .br-result-desc   { font-size: 14px; color: var(--text-secondary); line-height: 1.7; }

        /* ===== ИГРЫ ===== */
        .br-game-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .br-game-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
        .br-game-name   { font-size: 14px; font-weight: 700; color: var(--text-primary); flex: 1; }
        .br-game-freq   {
            font-size: 10px; font-weight: 700; color: var(--chrome);
            background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.18);
            border-radius: 20px; padding: 3px 9px; flex-shrink: 0; margin-left: 10px;
        }
        .br-game-formula { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; font-style: italic; }
        .br-game-desc   { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
        .br-game-exit   { font-size: 12px; color: var(--chrome); line-height: 1.5; }

        /* ===== СЦЕНАРИЙ ===== */
        .br-scenario-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .br-scenario-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .br-scenario-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
        .br-scenario-sign { font-size: 12px; color: var(--chrome); margin-top: 8px; font-style: italic; }

        .br-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .br-btn:active { transform: scale(0.97); }
        .br-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .br-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .br-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .br-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .br-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .br-tip strong { color: var(--chrome); }
    `;
    document.head.appendChild(s);
}

// ============================================
// ТЕСТ — 12 ВОПРОСОВ ПО СИТУАЦИЯМ
// Каждый ответ: {text, ego: 'Р'|'В'|'Д'}
// ============================================
const BR_QUESTIONS = [
    {
        q: 'Коллега опоздал на важную встречу. Ваша первая реакция:',
        answers: [
            { text: 'Делаю замечание — такое нельзя допускать', ego: 'Р' },
            { text: 'Спрашиваю что случилось и как это можно решить', ego: 'В' },
            { text: 'Обижаюсь — я всегда жду, а обо мне не думают', ego: 'Д' },
            { text: 'Ничего не говорю, но внутри раздражаюсь', ego: 'Р' }
        ]
    },
    {
        q: 'Вам нужно принять сложное решение. Как вы действуете?',
        answers: [
            { text: 'Делаю как «правильно» — так принято', ego: 'Р' },
            { text: 'Собираю информацию и взвешиваю варианты', ego: 'В' },
            { text: 'Долго сомневаюсь — боюсь ошибиться', ego: 'Д' },
            { text: 'Слушаю интуицию и делаю как чувствую', ego: 'Д' }
        ]
    },
    {
        q: 'Вас критикуют несправедливо. Что происходит внутри?',
        answers: [
            { text: 'Объясняю свою позицию чётко и аргументированно', ego: 'В' },
            { text: 'Злюсь — кто они такие, чтобы меня осуждать', ego: 'Р' },
            { text: 'Обижаюсь и замыкаюсь', ego: 'Д' },
            { text: 'Начинаю сомневаться: может, они правы?', ego: 'Д' }
        ]
    },
    {
        q: 'Близкий человек рассказывает о своей проблеме. Вы:',
        answers: [
            { text: 'Даю совет — сразу вижу что нужно сделать', ego: 'Р' },
            { text: 'Слушаю, задаю уточняющие вопросы', ego: 'В' },
            { text: 'Сочувствую и поддерживаю эмоционально', ego: 'Д' },
            { text: 'Говорю что думаю честно, даже если неприятно', ego: 'В' }
        ]
    },
    {
        q: 'Вы сделали ошибку в работе. Ваша реакция:',
        answers: [
            { text: 'Анализирую что пошло не так и как исправить', ego: 'В' },
            { text: 'Очень расстраиваюсь и виню себя', ego: 'Д' },
            { text: 'Ищу причины — обстоятельства или другие люди', ego: 'Р' },
            { text: 'Стараюсь быстро исправить и двигаться дальше', ego: 'В' }
        ]
    },
    {
        q: 'Вас просят о помощи, но вы сейчас заняты. Вы:',
        answers: [
            { text: 'Помогаю несмотря на усталость — так надо', ego: 'Р' },
            { text: 'Объясняю ситуацию и предлагаю конкретное время', ego: 'В' },
            { text: 'Не могу отказать — потом буду жалеть', ego: 'Д' },
            { text: 'Говорю «нет» без лишних объяснений', ego: 'В' }
        ]
    },
    {
        q: 'В конфликте с партнёром или другом вы чаще:',
        answers: [
            { text: 'Объясняю что именно не так и почему', ego: 'Р' },
            { text: 'Ищу что не устраивает нас обоих и как это решить', ego: 'В' },
            { text: 'Замолкаю и жду пока всё само уладится', ego: 'Д' },
            { text: 'Выплёскиваю эмоции, а потом жалею', ego: 'Д' }
        ]
    },
    {
        q: 'Вы взяли на себя слишком много. Что происходит?',
        answers: [
            { text: 'Терплю до последнего — нельзя подвести', ego: 'Р' },
            { text: 'Пересматриваю список и от чего-то отказываюсь', ego: 'В' },
            { text: 'Жалуюсь близким на перегрузку', ego: 'Д' },
            { text: 'Злюсь что снова оказался в такой ситуации', ego: 'Р' }
        ]
    },
    {
        q: 'Вам предлагают что-то новое и рискованное. Вы:',
        answers: [
            { text: 'Осторожно — сначала нужно всё взвесить', ego: 'В' },
            { text: 'Отказываюсь — лучше стабильность', ego: 'Р' },
            { text: 'Хочу попробовать, но боюсь и сомневаюсь', ego: 'Д' },
            { text: 'С интересом ввязываюсь — потом разберёмся', ego: 'Д' }
        ]
    },
    {
        q: 'Кто-то нарушил договорённость. Ваша реакция:',
        answers: [
            { text: 'Прямо говорю что это неприемлемо', ego: 'Р' },
            { text: 'Выясняю причины и обсуждаю как не повторить', ego: 'В' },
            { text: 'Расстраиваюсь и думаю «как всегда»', ego: 'Д' },
            { text: 'Говорю что чувствую и чего хочу вместо этого', ego: 'В' }
        ]
    },
    {
        q: 'Когда вас хвалят, вы обычно:',
        answers: [
            { text: 'Принимаю спокойно — заслужил', ego: 'В' },
            { text: 'Смущаюсь и обесцениваю: «да ничего особенного»', ego: 'Д' },
            { text: 'Жду конкретики — за что именно?', ego: 'В' },
            { text: 'Радуюсь искренне и открыто', ego: 'Д' }
        ]
    },
    {
        q: 'Как вы обычно принимаете помощь от других?',
        answers: [
            { text: 'С трудом — привык делать сам', ego: 'Р' },
            { text: 'Благодарю и принимаю когда действительно нужна', ego: 'В' },
            { text: 'Легко — мне нравится когда обо мне заботятся', ego: 'Д' },
            { text: 'Принимаю, но потом чувствую себя обязанным', ego: 'Д' }
        ]
    }
];

// ============================================
// ИГРЫ ПО БЕРНУ
// ============================================
const BR_GAMES = {
    'Видишь как ты меня подвёл': {
        freq: 'очень часто',
        formula: 'Р→Д: жертва → обвинение',
        desc: 'Человек берёт на себя больше, чем нужно, ждёт провала и использует его как доказательство неблагодарности или своей жертвенности.',
        exit: 'Прямо говорить что нужно, вместо того чтобы делать «всё сам» и обижаться.'
    },
    'Да, но...': {
        freq: 'очень часто',
        formula: 'Д→Р: запрос совета с отказом от каждого',
        desc: 'Просит совет, а на каждый вариант находит возражение. Цель — не решение, а доказательство что выхода нет, или что советчик бесполезен.',
        exit: 'Честно ответить себе: я хочу решить проблему или хочу чтобы меня пожалели?'
    },
    'Деревянная нога': {
        freq: 'часто',
        formula: 'Д→Р: слабость как освобождение',
        desc: 'Использование реальной или воображаемой «слабости» как универсального объяснения и освобождения от ответственности. «Что с меня взять с моим...»',
        exit: 'Разделить реальные ограничения и выбор. Спросить: что я могу сделать несмотря на это?'
    },
    'Гляди как я стараюсь': {
        freq: 'часто',
        formula: 'Д→Р: демонстрация усилий без результата',
        desc: 'Активная демонстрация усилий как самоцель — чтобы получить признание, а не результат. Жалобы на перегрузку при нежелании что-то изменить.',
        exit: 'Сосредоточиться на результате, а не на демонстрации процесса.'
    },
    'Всё из-за тебя': {
        freq: 'часто',
        formula: 'Д→Р: перекладывание ответственности',
        desc: 'Собственные неудачи или плохое настроение объясняются действиями другого. «Если бы не ты, я бы...»',
        exit: 'Принять ответственность за свои реакции и решения.'
    },
    'Попался, мерзавец': {
        freq: 'часто',
        formula: 'Р→Д: провокация ошибки',
        desc: 'Провоцирует другого на ошибку или нарушение, чтобы получить моральное превосходство и право на обвинение.',
        exit: 'Спросить себя: зачем мне доказательства того, что человек плохой?'
    },
    'Меня все обижают': {
        freq: 'часто',
        formula: 'Д→Р: коллекция обид',
        desc: 'Накопление мелких обид для обоснования крупного взрыва или отстранения. «Я терпел-терпел, и вот...»',
        exit: 'Говорить о том, что не устраивает, в момент когда это происходит.'
    },
    'Кляча': {
        freq: 'часто',
        formula: 'Д→Р: перегрузка → жалобы',
        desc: 'Берёт на себя больше чем может, жалуется на перегрузку, ждёт что другие заметят и помогут. Помощь не принимается или обесценивается.',
        exit: 'Просить о помощи напрямую до, а не после перегрузки.'
    },
    'Изъян': {
        freq: 'редко',
        formula: 'Р→В: поиск скрытого дефекта',
        desc: 'В новых отношениях активно ищет «изъян» который позволит уйти. «Я так и знал, что за этим что-то скрыто».',
        exit: 'Замечать реальные проблемы отдельно от поиска «подвоха».'
    },
    'Ударь меня': {
        freq: 'редко',
        formula: 'Д→Р: провокация наказания',
        desc: 'Провоцирующее поведение, которое вызывает гнев окружающих — как подтверждение убеждения «я плохой».',
        exit: 'Осознать что критика — это не любовь. Искать позитивные поглаживания.'
    },
    'Загнанная домохозяйка': {
        freq: 'часто',
        formula: 'Р→Д: жертвенность → взрыв',
        desc: 'Берёт на себя всю заботу, отказывает себе в отдыхе, копит усталость до точки взрыва, затем обвиняет тех, ради кого жертвовал.',
        exit: 'Заботиться о себе системно, а не ждать «когда всё сделаю».'
    },
    'Судебное заседание': {
        freq: 'редко',
        formula: 'Р→В: привлечение арбитров',
        desc: 'В споре с партнёром привлекает третьих лиц как «свидетелей». Конфликт разрастается вместо разрешения.',
        exit: 'Решать отношения напрямую, без привлечения публики.'
    }
};

// ============================================
// ПРОФИЛИ ПО РЕЗУЛЬТАТУ ТЕСТА
// ============================================
const BR_PROFILES = {
    Р: {
        dominant: 'Контролирующий Родитель',
        icon: '👔',
        desc: 'Вы часто действуете из позиции Контролирующего Родителя — устанавливаете правила, ориентируетесь на «как правильно», требовательны к себе и другим. Это даёт структуру и надёжность, но иногда мешает гибкости и близости.',
        games: ['Видишь как ты меня подвёл', 'Попался, мерзавец', 'Всё из-за тебя', 'Судебное заседание'],
        scenario: {
            name: 'Сценарий «Пока не»',
            desc: 'Нельзя расслабиться, пока не сделаю всё идеально. Отдых воспринимается как слабость. Достижения быстро обесцениваются — нужно следующее.',
            signs: 'Признаки: трудно получать удовольствие от процесса, хроническое «недостаточно», сложность в делегировании.'
        }
    },
    В: {
        dominant: 'Взрослый',
        icon: '🧠',
        desc: 'Ваше ведущее эго-состояние — Взрослый. Вы ориентируетесь на анализ, факты и взвешенные решения. Это сила. Но иногда Взрослый вытесняет спонтанность Ребёнка — жизнь становится «правильной», но немного холодной.',
        games: ['Да, но...', 'Изъян', 'Деревянная нога'],
        scenario: {
            name: 'Сценарий «Никогда»',
            desc: 'Убеждение: «Я никогда не получу того, чего по-настоящему хочу». Желания замещаются анализом желаний. Риск — эмоциональная дистанция от собственной жизни.',
            signs: 'Признаки: рационализация вместо переживания, трудность «просто радоваться», ощущение наблюдателя собственной жизни.'
        }
    },
    Д: {
        dominant: 'Адаптивный Ребёнок',
        icon: '🧸',
        desc: 'Вы часто действуете из позиции Адаптивного Ребёнка — подстраиваетесь под ожидания, избегаете конфликтов, ищете одобрения. Вы чутки и эмпатичны, но иногда теряете контакт с собственными желаниями.',
        games: ['Меня все обижают', 'Да, но...', 'Деревянная нога', 'Кляча', 'Ударь меня'],
        scenario: {
            name: 'Сценарий «До тех пор»',
            desc: 'Убеждение: «Я буду счастлив, когда...» — когда заслужу, когда получу разрешение, когда докажу. Счастье откладывается и никогда не наступает в полной мере.',
            signs: 'Признаки: откладывание собственных желаний, ощущение что «ещё не готов», сильная зависимость от оценки других.'
        }
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._brState) window._brState = {
    view:     'intro',   // 'intro' | 'test' | 'result'
    tab:      'profile',
    question: 0,
    answers:  [],        // [{ego: 'Р'|'В'|'Д'}]
    result:   null
};
const _br = window._brState;

// ============================================
// УТИЛИТЫ
// ============================================
function _brToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _brHome() { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _brUid()  { return window.CONFIG?.USER_ID; }
function _brSave() {
    try { localStorage.setItem('br_result_'+_brUid(), JSON.stringify(_br.result)); } catch {}
}
function _brLoad() {
    try { const r = localStorage.getItem('br_result_'+_brUid()); return r ? JSON.parse(r) : null; } catch { return null; }
}

function _brCalcResult(answers) {
    const counts = { Р:0, В:0, Д:0 };
    answers.forEach(a => { if (counts[a.ego] !== undefined) counts[a.ego]++; });
    const total = answers.length;
    const pcts  = { Р: Math.round(counts.Р/total*100), В: Math.round(counts.В/total*100), Д: Math.round(counts.Д/total*100) };
    const dom   = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    return { counts, pcts, dominant: dom, profile: BR_PROFILES[dom] };
}

// ============================================
// РЕНДЕР
// ============================================
function _brRender() {
    _brInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '';
    if (_br.view === 'intro')  body = _brIntro();
    if (_br.view === 'test')   body = _brTest();
    if (_br.view === 'result') body = _brResult();

    const TABS = [
        { id:'profile',   label:'🎭 Роль' },
        { id:'games',     label:'♟️ Игры' },
        { id:'scenarios', label:'📜 Сценарий' }
    ];
    const tabsHtml = _br.view === 'result'
        ? `<div class="br-tabs">${TABS.map(t=>`<button class="br-tab${_br.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>`
        : '';

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎭</div>
                <h1 class="content-title">Роли и игры</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Транзактный анализ по Эрику Берну</p>
            </div>
            ${tabsHtml}
            <div id="brBody">${body}</div>
        </div>`;

    document.getElementById('brBack').onclick = () => {
        if (_br.view === 'test') { _br.view = 'intro'; _brRender(); }
        else _brHome();
    };
    document.querySelectorAll('.br-tab').forEach(btn => {
        btn.addEventListener('click', () => { _br.tab = btn.dataset.tab; _brRender(); });
    });
    _brBindHandlers();
}

// ===== ИНТРО =====
function _brIntro() {
    const saved = _brLoad();
    const savedBlock = saved ? `
        <div style="background:rgba(224,224,224,0.06);border:1px solid rgba(224,224,224,0.18);border-radius:14px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-size:13px;font-weight:600;color:var(--chrome)">${saved.profile.dominant}</div>
                <div style="font-size:11px;color:var(--text-secondary)">${new Date(saved.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</div>
            </div>
            <button class="br-btn br-btn-ghost" id="brOpenResult" style="flex-shrink:0">Открыть →</button>
        </div>` : '';

    return `
        ${savedBlock}
        <div style="text-align:center;padding:16px 0 24px">
            <span style="font-size:56px;display:block;margin-bottom:16px">🎭</span>
            <div style="font-size:16px;font-weight:600;margin-bottom:10px">Тест по транзактному анализу</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:24px">
                12 вопросов по реальным ситуациям.<br>
                Определим ваше доминирующее эго-состояние,<br>вероятные психологические игры и жизненный сценарий.
            </div>
            <button class="br-btn br-btn-primary" id="brStartBtn">🎭 Пройти тест</button>
        </div>
        <div class="br-tip">
            🎭 <strong>Транзактный анализ</strong> — метод Эрика Берна. Каждый человек действует из трёх эго-состояний: <strong>Родитель</strong> (нормы, правила), <strong>Взрослый</strong> (факты, логика), <strong>Ребёнок</strong> (эмоции, желания). Проблемы возникают когда одно состояние доминирует в ущерб другим.
        </div>`;
}

// ===== ТЕСТ =====
function _brTest() {
    const qi   = _br.question;
    const q    = BR_QUESTIONS[qi];
    const pct  = Math.round((qi / BR_QUESTIONS.length) * 100);

    const answersHtml = q.answers.map((a, ai) => `
        <div class="br-answer" data-ai="${ai}" data-ego="${a.ego}">
            <div class="br-answer-text">${a.text}</div>
        </div>`).join('');

    return `
        <div class="br-test-progress">
            <div class="br-test-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="br-question-wrap">
            <div class="br-question-num">Вопрос ${qi+1} из ${BR_QUESTIONS.length}</div>
            <div class="br-question-text">${q.q}</div>
            ${answersHtml}
        </div>`;
}

// ===== РЕЗУЛЬТАТ =====
function _brResult() {
    const res = _br.result;
    if (!res) return '';

    const p   = res.profile;
    const pct = res.pcts;
    const maxPct = Math.max(pct.Р, pct.В, pct.Д);

    if (_br.tab === 'profile') {
        return `
            <div class="br-result-card">
                <div class="br-result-header">
                    <span class="br-result-icon">${p.icon}</span>
                    <div>
                        <div class="br-result-title">${p.dominant}</div>
                        <div class="br-result-sub">Доминирующее эго-состояние</div>
                    </div>
                </div>
                <div class="br-result-desc">${p.desc}</div>
            </div>

            <div class="br-section-label">Баланс эго-состояний</div>
            <div class="br-ego-grid">
                <div class="br-ego-card${pct.Р===maxPct?' dominant':''}">
                    <span class="br-ego-icon">👔</span>
                    <div class="br-ego-name">Родитель</div>
                    <div class="br-ego-pct">${pct.Р}%</div>
                    <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pct.Р}%"></div></div>
                </div>
                <div class="br-ego-card${pct.В===maxPct?' dominant':''}">
                    <span class="br-ego-icon">🧠</span>
                    <div class="br-ego-name">Взрослый</div>
                    <div class="br-ego-pct">${pct.В}%</div>
                    <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pct.В}%"></div></div>
                </div>
                <div class="br-ego-card${pct.Д===maxPct?' dominant':''}">
                    <span class="br-ego-icon">🧸</span>
                    <div class="br-ego-name">Ребёнок</div>
                    <div class="br-ego-pct">${pct.Д}%</div>
                    <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pct.Д}%"></div></div>
                </div>
            </div>

            <div class="br-tip">
                💡 Здоровый баланс: <strong>Взрослый</strong> координирует, <strong>Родитель</strong> даёт ценности, <strong>Ребёнок</strong> — энергию и творчество.
            </div>
            <div style="margin-top:14px">
                <button class="br-btn br-btn-ghost" id="brRetestBtn" style="width:100%;border-radius:40px;padding:12px">🔄 Пройти тест заново</button>
            </div>`;
    }

    if (_br.tab === 'games') {
        const gamesHtml = p.games.map(name => {
            const g = BR_GAMES[name];
            if (!g) return '';
            return `
            <div class="br-game-card">
                <div class="br-game-header">
                    <div class="br-game-name">«${name}»</div>
                    <div class="br-game-freq">${g.freq}</div>
                </div>
                <div class="br-game-formula">${g.formula}</div>
                <div class="br-game-desc">${g.desc}</div>
                <div class="br-game-exit">💡 Выход: ${g.exit}</div>
            </div>`;
        }).join('');

        return `
            <div class="br-section-label">Вероятные игры — ${p.games.length}</div>
            ${gamesHtml}
            <div class="br-tip">
                💡 <strong>Игра по Берну</strong> — повторяющийся паттерн взаимодействия с предсказуемым негативным финалом. Осознание игры — первый шаг к выходу.
            </div>`;
    }

    if (_br.tab === 'scenarios') {
        const sc = p.scenario;
        return `
            <div class="br-section-label">Ваш жизненный сценарий</div>
            <div class="br-scenario-card">
                <div class="br-scenario-name">${sc.name}</div>
                <div class="br-scenario-desc">${sc.desc}</div>
                <div class="br-scenario-sign">${sc.signs}</div>
            </div>

            <div class="br-section-label">Как работать с этим</div>
            <div class="br-scenario-card">
                <div class="br-scenario-name">Шаг 1 — Заметить</div>
                <div class="br-scenario-desc">Когда замечаете паттерн в действии — назовите его. «Кажется, это снова моя игра. Что я сейчас чувствую под этим?»</div>
            </div>
            <div class="br-scenario-card">
                <div class="br-scenario-name">Шаг 2 — Пауза</div>
                <div class="br-scenario-desc">Игры разворачиваются автоматически. Пауза в 3 секунды перед реакцией даёт Взрослому возможность вмешаться.</div>
            </div>
            <div class="br-scenario-card">
                <div class="br-scenario-name">Шаг 3 — Прямая транзакция</div>
                <div class="br-scenario-desc">Замените игровую реакцию на прямую — скажите что чувствуете и что хотите, без скрытых манипуляций.</div>
            </div>

            <div class="br-tip">
                💡 Сценарий — это решение принятое в детстве. Оно было адаптивным тогда. Сейчас у вас есть выбор действовать иначе.
            </div>`;
    }

    return '';
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _brBindHandlers() {
    document.getElementById('brOpenResult')?.addEventListener('click', () => {
        _br.result = _brLoad();
        _br.view   = 'result';
        _br.tab    = 'profile';
        _brRender();
    });

    document.getElementById('brStartBtn')?.addEventListener('click', () => {
        _br.view     = 'test';
        _br.question = 0;
        _br.answers  = [];
        _brRender();
    });

    document.getElementById('brRetestBtn')?.addEventListener('click', () => {
        _br.view     = 'intro';
        _br.result   = null;
        _brRender();
    });

    // Ответ на вопрос
    document.querySelectorAll('.br-answer').forEach(ans => {
        ans.addEventListener('click', () => {
            if (ans.classList.contains('selected')) return;
            ans.classList.add('selected');
            const ego = ans.dataset.ego;
            _br.answers.push({ ego });

            setTimeout(() => {
                if (_br.question < BR_QUESTIONS.length - 1) {
                    _br.question++;
                    _brRender();
                } else {
                    // Тест завершён
                    const calc = _brCalcResult(_br.answers);
                    _br.result = { ...calc, date: new Date().toISOString() };
                    _brSave();
                    _br.view = 'result';
                    _br.tab  = 'profile';
                    _brRender();
                    window.showToast?.('✅ Тест завершён', 'success');
                }
            }, 350);
        });
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showBerneScreen() {
    const saved = _brLoad();
    if (saved) {
        _br.result = saved;
        _br.view   = 'result';
        _br.tab    = 'profile';
    } else {
        _br.view = 'intro';
    }
    _brRender();
}

window.showBerneScreen = showBerneScreen;
console.log('✅ berne.js v2.0 загружен');
