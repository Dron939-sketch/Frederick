// ============================================
// berne.js — Роли и игры по Берну (ТА)
// Версия 1.0
// ============================================

function _brInjectStyles() {
    if (document.getElementById('br-v1-styles')) return;
    const s = document.createElement('style');
    s.id = 'br-v1-styles';
    s.textContent = `
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
            white-space: nowrap;
        }
        .br-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* ЭГО-СОСТОЯНИЯ */
        .br-ego-grid {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;
        }
        .br-ego-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; text-align: center;
            transition: background 0.2s;
        }
        .br-ego-card.dominant {
            background: rgba(224,224,224,0.12); border-color: rgba(224,224,224,0.35);
        }
        .br-ego-icon  { font-size: 28px; display: block; margin-bottom: 6px; }
        .br-ego-name  { font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .br-ego-pct   { font-size: 18px; font-weight: 700; color: var(--chrome); }
        .br-ego-bar   { height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .br-ego-fill  { height: 100%; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); border-radius: 2px; }

        /* КАРТОЧКА РЕЗУЛЬТАТА */
        .br-result-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; padding: 20px;
            margin-bottom: 20px;
        }
        .br-result-header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .br-result-icon   { font-size: 40px; }
        .br-result-title  { font-size: 18px; font-weight: 700; color: var(--chrome); margin-bottom: 4px; }
        .br-result-sub    { font-size: 12px; color: var(--text-secondary); }
        .br-result-desc   { font-size: 14px; color: var(--text-secondary); line-height: 1.7; }

        /* ИГРЫ */
        .br-game-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .br-game-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .br-game-name   { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .br-game-freq   {
            font-size: 10px; font-weight: 700; color: var(--chrome);
            background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.18);
            border-radius: 20px; padding: 2px 8px; flex-shrink: 0; margin-left: 8px;
        }
        .br-game-formula { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; font-style: italic; }
        .br-game-desc   { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
        .br-game-exit   { font-size: 12px; color: var(--chrome); line-height: 1.5; }
        .br-game-exit::before { content: '💡 Выход: '; }

        /* СЦЕНАРИИ */
        .br-scenario-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .br-scenario-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .br-scenario-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
        .br-scenario-sign { font-size: 12px; color: var(--text-secondary); margin-top: 8px; font-style: italic; }

        /* ПУСТО / ЗАГРУЗКА */
        .br-loading { text-align: center; padding: 48px 20px; }
        .br-loading-icon { font-size: 44px; display: block; margin-bottom: 12px;
            animation: br-pulse 1.6s ease-in-out infinite; }
        @keyframes br-pulse { 0%,100%{opacity:0.5;transform:scale(0.97)} 50%{opacity:1;transform:scale(1.03)} }
        .br-loading-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .br-loading-sub   { font-size: 12px; color: var(--text-secondary); }

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
// БАЗА ИГРЫ ПО БЕРНУ (наиболее частые)
// ============================================
const BR_GAMES = {
    // Игры Родителя
    'Видишь как ты меня подвёл': {
        ego: 'Р', freq: 'очень часто',
        formula: 'Р→Р: «Я стараюсь для тебя, а ты...»',
        desc: 'Человек берёт на себя больше, чем нужно, ждёт провала и использует его как доказательство неблагодарности или своей жертвенности.',
        exit: 'Прямо спросить что нужно, вместо того чтобы делать «всё сам» и обижаться.'
    },
    'Гляди как я стараюсь': {
        ego: 'Р', freq: 'часто',
        formula: 'Р→В: демонстрация усилий без результата',
        desc: 'Активная демонстрация усилий как самоцель — чтобы получить признание, а не результат. Жалобы на перегрузку при нежелании что-то изменить.',
        exit: 'Сосредоточиться на результате, а не на демонстрации процесса.'
    },
    'Всё из-за тебя': {
        ego: 'Р', freq: 'часто',
        formula: 'Р→В: перекладывание ответственности',
        desc: 'Собственные неудачи или плохое настроение объясняются действиями другого человека. «Если бы не ты, я бы...»',
        exit: 'Принять ответственность за свои реакции и решения.'
    },

    // Игры Ребёнка
    'Деревянная нога': {
        ego: 'Д', freq: 'очень часто',
        formula: 'Д→Р: «Что с меня взять с моими особенностями»',
        desc: 'Использование реальной или воображаемой «слабости» (болезнь, прошлое, характер) как универсального объяснения и освобождения от ответственности.',
        exit: 'Разделить реальные ограничения и выбор. «Это есть — и что я могу сделать несмотря на это?»'
    },
    'Кляча': {
        ego: 'Д', freq: 'часто',
        formula: 'Д→Р: перегрузка → жалобы',
        desc: 'Берёт на себя больше, чем может, жалуется на перегрузку, ждёт что другие заметят и помогут. Помощь не принимается или обесценивается.',
        exit: 'Напрямую просить о помощи до, а не после перегрузки.'
    },
    'Меня все обижают': {
        ego: 'Д', freq: 'часто',
        formula: 'Д→Р: сбор «марок» обид',
        desc: 'Коллекционирование мелких обид для обоснования крупного эмоционального взрыва или отстранения. «Я терпел-терпел, и вот...»',
        exit: 'Говорить о том, что не устраивает, в момент когда это происходит — маленькими дозами.'
    },
    'Попался, мерзавец': {
        ego: 'Д', freq: 'часто',
        formula: 'Д→Р: провоцирование ошибки',
        desc: 'Провоцирует другого на ошибку или нарушение, чтобы получить моральное превосходство и право на обвинение или месть.',
        exit: 'Спросить себя: зачем мне доказательства того, что человек плохой?'
    },
    'Ударь меня': {
        ego: 'Д', freq: 'часто',
        formula: 'Д→Р: провокация наказания',
        desc: 'Провоцирующее поведение, которое вызывает критику или гнев окружающих — как подтверждение убеждения «я плохой, меня надо наказывать».',
        exit: 'Осознать что критика и гнев — это не признание и не любовь. Искать позитивные поглаживания.'
    },

    // Игры Взрослого и смешанные
    'Да, но...': {
        ego: 'В', freq: 'очень часто',
        formula: 'Д→Р: запрос совета с отказом от каждого',
        desc: 'Просит совет и на каждый вариант находит возражение. Цель не в решении проблемы, а в доказательстве что выхода нет (или что советчик бесполезен).',
        exit: 'Честно ответить себе: я хочу решить проблему или хочу, чтобы меня пожалели?'
    },
    'Почему это всегда со мной': {
        ego: 'Д', freq: 'часто',
        formula: 'Д→Р: поиск подтверждения сценария жертвы',
        desc: 'Сбор «доказательств» что жизнь несправедлива именно к этому человеку. Схожие ситуации у других не замечаются или обесцениваются.',
        exit: 'Спросить: что я мог сделать иначе? Что от меня зависело?'
    },
    'Изъян': {
        ego: 'Р', freq: 'часто',
        formula: 'Р→В: поиск скрытого дефекта',
        desc: 'В новых отношениях или ситуациях активно ищет «изъян» который всё объяснит и позволит уйти. «Я так и знал, что за этим что-то скрыто».',
        exit: 'Замечать реальные проблемы отдельно от поиска «подвоха».'
    },
    'Алкоголик': {
        ego: 'Д', freq: 'часто',
        formula: 'Д/Р/В: система ролей вокруг зависимости',
        desc: 'Классическая система из пяти ролей (Алкоголик, Преследователь, Спаситель, Простак, Связной) где каждый получает свой выигрыш. Работает с любой зависимостью.',
        exit: 'Выйти из роли Спасителя. Не брать ответственность за чужие решения.'
    },
    'Загнанная домохозяйка': {
        ego: 'Р', freq: 'часто',
        formula: 'Р→Д: самопожертвование → взрыв',
        desc: 'Берёт на себя всю заботу, отказывает себе в отдыхе, копит усталость до точки взрыва. Затем обвиняет тех, ради кого жертвовал собой.',
        exit: 'Брать паузы и заботиться о себе системно, а не ждать «когда всё сделаю».'
    },
    'Судебное заседание': {
        ego: 'Р', freq: 'редко',
        formula: 'Р→В→Д: поиск союзников в конфликте',
        desc: 'В споре с партнёром привлекает третьих лиц как «свидетелей» или «арбитров». Конфликт разрастается вместо разрешения.',
        exit: 'Решать отношения напрямую, без привлечения публики.'
    }
};

// ============================================
// МАППИНГ ПРОФИЛЯ НА РОЛЬ И ИГРЫ
// ============================================
const BR_PROFILES = {
    // СБ доминирует → Адаптивный Ребёнок, много игр Ребёнка
    СБ: {
        dominant: 'Ребёнок (Адаптивный)',
        icon: '🧸',
        ego: { Р: 25, В: 35, Д: 40 },
        desc: 'Вы часто действуете из позиции Адаптивного Ребёнка — подстраиваетесь под ожидания, избегаете конфликтов, ищете одобрения. Внутренний Взрослый есть, но нередко уступает место Ребёнку под давлением.',
        games: ['Меня все обижают', 'Да, но...', 'Деревянная нога', 'Кляча'],
        scenario: {
            name: 'Сценарий «До тех пор»',
            desc: 'Установка: «Я буду счастлив, когда...» — когда заслужу, когда получу разрешение, когда докажу. Счастье откладывается в будущее и никогда не наступает в полной мере.',
            signs: 'Признаки: хроническое откладывание собственных желаний, ощущение что «ещё не готов», сильная зависимость от оценки других.'
        }
    },
    // ТФ доминирует → Контролирующий Родитель
    ТФ: {
        dominant: 'Родитель (Контролирующий)',
        icon: '👔',
        ego: { Р: 45, В: 40, Д: 15 },
        desc: 'Вы действуете преимущественно из позиции Контролирующего Родителя — ставите высокую планку, ориентируетесь на результат, требовательны к себе и другим. Ребёнок внутри редко получает «эфирное время».',
        games: ['Видишь как ты меня подвёл', 'Всё из-за тебя', 'Попался, мерзавец', 'Гляди как я стараюсь'],
        scenario: {
            name: 'Сценарий «Пока не»',
            desc: 'Установка: «Нельзя расслабиться, пока не сделаю всё идеально». Отдых воспринимается как слабость. Достижения быстро обесцениваются — нужно следующее.',
            signs: 'Признаки: трудно получать удовольствие от процесса, хроническое «недостаточно», сложность в делегировании.'
        }
    },
    // УБ доминирует → Взрослый
    УБ: {
        dominant: 'Взрослый',
        icon: '🧠',
        ego: { Р: 20, В: 55, Д: 25 },
        desc: 'Ваше ведущее эго-состояние — Взрослый. Вы ориентируетесь на анализ, факты и логику. Это сила. Но иногда Взрослый вытесняет эмоции Ребёнка или интуицию Родителя — жизнь становится «правильной», но немного холодной.',
        games: ['Да, но...', 'Изъян', 'Почему это всегда со мной'],
        scenario: {
            name: 'Сценарий «Никогда»',
            desc: 'Установка: «Я никогда не получу того, чего по-настоящему хочу». Желания замещаются анализом желаний. Риск — эмоциональная дистанция от собственной жизни.',
            signs: 'Признаки: рационализация вместо переживания, трудность с «просто радоваться», ощущение наблюдателя собственной жизни.'
        }
    },
    // ЧВ доминирует → Свободный Ребёнок / Нянчащий Родитель
    ЧВ: {
        dominant: 'Ребёнок (Свободный) / Нянчащий Родитель',
        icon: '💕',
        ego: { Р: 30, В: 25, Д: 45 },
        desc: 'Вы живёте в основном из Свободного Ребёнка или Нянчащего Родителя — эмоционально богаты, чутки, хорошо считываете людей. Но Взрослый иногда «перегружается» эмоциями и теряет способность к чёткому решению.',
        games: ['Ударь меня', 'Загнанная домохозяйка', 'Кляча', 'Меня все обижают'],
        scenario: {
            name: 'Сценарий «Всегда»',
            desc: 'Установка: «Со мной всегда случается одно и то же». Повторяющиеся паттерны в отношениях, убеждённость в неизбежности определённых исходов.',
            signs: 'Признаки: похожие конфликты с разными людьми, ощущение что история повторяется, трудность с установкой границ.'
        }
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._brState) window._brState = { tab: 'profile', result: null, loading: false };
const _br = window._brState;

// ============================================
// УТИЛИТЫ
// ============================================
function _brToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _brHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _brApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _brUid()   { return window.CONFIG?.USER_ID; }
function _brName()  { return localStorage.getItem('fredi_user_name') || 'друг'; }

function _brLoadResult() {
    try { const r = localStorage.getItem('br_result_'+_brUid()); return r ? JSON.parse(r) : null; } catch { return null; }
}
function _brSaveResult(r) {
    try { localStorage.setItem('br_result_'+_brUid(), JSON.stringify(r)); } catch {}
}

async function _brLoadVectors() {
    try {
        const r = await fetch(`${_brApi()}/api/get-profile/${_brUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        return { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch { return null; }
}

function _brDomVec(vectors) {
    return Object.entries(vectors).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'УБ';
}

// ============================================
// РЕНДЕР
// ============================================
function _brRender() {
    _brInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const result = _br.result || _brLoadResult();

    const TABS = [
        { id:'profile',   label:'🎭 Роль' },
        { id:'games',     label:'♟️ Игры' },
        { id:'scenarios', label:'📜 Сценарий' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="br-tab${_br.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (_br.loading) {
        body = `<div class="br-loading">
            <span class="br-loading-icon">🎭</span>
            <div class="br-loading-title">Анализирую ваш профиль</div>
            <div class="br-loading-sub">Определяю доминирующее эго-состояние и паттерны...</div>
        </div>`;
    } else if (!result) {
        body = _brNoProfile();
    } else {
        if (_br.tab === 'profile')   body = _brProfile(result);
        if (_br.tab === 'games')     body = _brGames(result);
        if (_br.tab === 'scenarios') body = _brScenario(result);
    }

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎭</div>
                <h1 class="content-title">Роли и игры</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Транзактный анализ по Эрику Берну</p>
            </div>
            ${result && !_br.loading ? `<div class="br-tabs">${tabsHtml}</div>` : ''}
            <div id="brBody">${body}</div>
        </div>`;

    document.getElementById('brBack').onclick = () => _brHome();
    document.querySelectorAll('.br-tab').forEach(btn => {
        btn.addEventListener('click', () => { _br.tab = btn.dataset.tab; _brRender(); });
    });
    _brBindHandlers(result);
}

// ===== НЕТ ПРОФИЛЯ =====
function _brNoProfile() {
    return `
        <div style="text-align:center;padding:32px 20px">
            <span style="font-size:48px;display:block;margin-bottom:14px">🎭</span>
            <div style="font-size:16px;font-weight:600;margin-bottom:8px">Нужен психологический профиль</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:20px">
                Фреди определит ваше доминирующее эго-состояние (Родитель/Взрослый/Ребёнок) и наиболее частые психологические игры по Берну на основе вашего профиля
            </div>
            <button class="br-btn br-btn-primary" id="brAnalyzeBtn">🎭 Определить мою роль</button>
        </div>
        <div class="br-tip">
            🎭 <strong>Транзактный анализ</strong> — метод Эрика Берна. Каждый человек действует из трёх эго-состояний: Родитель (нормы, правила), Взрослый (факты, логика), Ребёнок (эмоции, желания). Баланс между ними определяет качество жизни и отношений.
        </div>`;
}

// ===== ПРОФИЛЬ =====
function _brProfile(result) {
    const p = result.profile;
    const ego = p.ego;
    const total = ego.Р + ego.В + ego.Д;
    const pR = Math.round(ego.Р/total*100);
    const pW = Math.round(ego.В/total*100);
    const pC = Math.round(ego.Д/total*100);
    const maxPct = Math.max(pR, pW, pC);

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
            <div class="br-ego-card${pR===maxPct?' dominant':''}">
                <span class="br-ego-icon">👔</span>
                <div class="br-ego-name">Родитель</div>
                <div class="br-ego-pct">${pR}%</div>
                <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pR}%"></div></div>
            </div>
            <div class="br-ego-card${pW===maxPct?' dominant':''}">
                <span class="br-ego-icon">🧠</span>
                <div class="br-ego-name">Взрослый</div>
                <div class="br-ego-pct">${pW}%</div>
                <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pW}%"></div></div>
            </div>
            <div class="br-ego-card${pC===maxPct?' dominant':''}">
                <span class="br-ego-icon">🧸</span>
                <div class="br-ego-name">Ребёнок</div>
                <div class="br-ego-pct">${pC}%</div>
                <div class="br-ego-bar"><div class="br-ego-fill" style="width:${pC}%"></div></div>
            </div>
        </div>

        <div class="br-tip">
            💡 Здоровый баланс: Взрослый координирует, Родитель даёт ценности, Ребёнок — энергию и творчество. Проблемы возникают когда одно состояние подавляет другие.
        </div>
        <div style="margin-top:14px">
            <button class="br-btn br-btn-ghost" id="brResetBtn" style="width:100%;border-radius:40px;padding:12px">
                🔄 Пересчитать по профилю
            </button>
        </div>`;
}

// ===== ИГРЫ =====
function _brGames(result) {
    const gameNames = result.profile.games;
    const html = gameNames.map(name => {
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
            <div class="br-game-exit">${g.exit}</div>
        </div>`;
    }).join('');

    return `
        <div class="br-section-label">Ваши вероятные игры — ${gameNames.length}</div>
        ${html}
        <div class="br-tip">
            💡 <strong>Игра по Берну</strong> — это повторяющийся паттерн взаимодействия с предсказуемым негативным финалом. Осознание игры — первый шаг к выходу из неё.
        </div>`;
}

// ===== СЦЕНАРИЙ =====
function _brScenario(result) {
    const sc = result.profile.scenario;
    return `
        <div class="br-section-label">Ваш жизненный сценарий</div>
        <div class="br-scenario-card">
            <div class="br-scenario-name">${sc.name}</div>
            <div class="br-scenario-desc">${sc.desc}</div>
            <div class="br-scenario-sign">${sc.signs}</div>
        </div>

        <div class="br-section-label">Что делать с этим знанием</div>
        <div class="br-scenario-card">
            <div class="br-scenario-name">Шаг 1: Заметить</div>
            <div class="br-scenario-desc">Когда замечаете паттерн в действии — просто назовите его. «Кажется, это снова моя игра. Что я сейчас чувствую под этим?»</div>
        </div>
        <div class="br-scenario-card">
            <div class="br-scenario-name">Шаг 2: Пауза</div>
            <div class="br-scenario-desc">Игры разворачиваются автоматически. Пауза в 3 секунды перед реакцией даёт Взрослому возможность вмешаться.</div>
        </div>
        <div class="br-scenario-card">
            <div class="br-scenario-name">Шаг 3: Прямая транзакция</div>
            <div class="br-scenario-desc">Замените игровую реакцию на прямую — скажите что чувствуете и что хотите, без скрытых манипуляций.</div>
        </div>

        <div class="br-tip">
            💡 Сценарий — это решение, принятое в детстве. Оно было адаптивным тогда. Сейчас у вас есть выбор действовать иначе.
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _brBindHandlers(result) {
    document.getElementById('brAnalyzeBtn')?.addEventListener('click', async () => {
        _br.loading = true; _brRender();

        const vectors = await _brLoadVectors();
        if (!vectors) {
            _brToast('Сначала пройдите психологический тест', 'error');
            _br.loading = false; _brRender(); return;
        }

        const dom = _brDomVec(vectors);
        const profile = BR_PROFILES[dom] || BR_PROFILES['УБ'];

        // Скорректировать % по реальным значениям
        const total = vectors.СБ + vectors.ТФ + vectors.УБ + vectors.ЧВ;
        const profileCopy = JSON.parse(JSON.stringify(profile));
        // Тонкая настройка: высокий УБ добавляет Взрослому, высокий ЧВ — Ребёнку, высокий ТФ — Родителю
        profileCopy.ego.В = Math.round(profileCopy.ego.В * (0.6 + 0.4 * vectors['УБ']/6));
        profileCopy.ego.Д = Math.round(profileCopy.ego.Д * (0.6 + 0.4 * vectors['ЧВ']/6));
        profileCopy.ego.Р = Math.round(profileCopy.ego.Р * (0.6 + 0.4 * vectors['ТФ']/6));

        const result = { profile: profileCopy, vectors, dominant: dom, date: new Date().toISOString() };
        _brSaveResult(result);
        _br.result  = result;
        _br.loading = false;
        _br.tab     = 'profile';
        _brRender();
    });

    document.getElementById('brResetBtn')?.addEventListener('click', () => {
        localStorage.removeItem('br_result_'+_brUid());
        _br.result = null;
        _brRender();
        setTimeout(() => document.getElementById('brAnalyzeBtn')?.click(), 50);
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showBerneScreen() {
    _br.result = _brLoadResult();
    _br.tab    = 'profile';
    _br.loading = false;
    _brRender();
    // Если нет результата и есть профиль — автоанализ
    if (!_br.result) {
        const v = await _brLoadVectors();
        if (v) setTimeout(() => document.getElementById('brAnalyzeBtn')?.click(), 100);
    }
}

window.showBerneScreen = showBerneScreen;
console.log('✅ berne.js v1.0 загружен');
