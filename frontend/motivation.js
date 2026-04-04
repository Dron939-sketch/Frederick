// ============================================
// motivation.js — Мотивация (режим КОУЧ)
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _motInjectStyles() {
    if (document.getElementById('mot-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'mot-v2-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .mot-tabs {
            display: flex;
            gap: 4px;
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px;
            padding: 4px;
            margin-bottom: 20px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
        }
        .mot-tabs::-webkit-scrollbar { display: none; }
        .mot-tab {
            flex-shrink: 0;
            padding: 8px 14px;
            border-radius: 30px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
            white-space: nowrap;
            min-height: 36px;
            touch-action: manipulation;
            position: relative;
        }
        .mot-tab.active {
            background: rgba(224,224,224,0.14);
            color: var(--text-primary);
        }
        .mot-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--chrome);
            color: #000;
            border-radius: 20px;
            min-width: 16px;
            height: 16px;
            font-size: 9px;
            font-weight: 700;
            padding: 0 4px;
            margin-left: 4px;
        }

        /* ===== КАРТОЧКИ ===== */
        .mot-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px;
            padding: 18px;
            margin-bottom: 12px;
            display: flex;
            gap: 14px;
            align-items: flex-start;
            transition: background 0.2s;
        }
        .mot-card:hover { background: rgba(224,224,224,0.07); }
        .mot-card-icon { font-size: 28px; flex-shrink: 0; line-height: 1.2; }
        .mot-card-body { flex: 1; min-width: 0; }
        .mot-card-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .mot-card-text {
            font-size: 15px;
            line-height: 1.6;
            color: var(--text-primary);
            margin-bottom: 12px;
            font-style: italic;
        }

        /* ===== СТРИК ===== */
        .mot-streak-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px;
            padding: 10px 14px;
            margin-bottom: 16px;
        }
        .mot-streak-num {
            font-size: 22px;
            font-weight: 700;
            color: var(--chrome);
        }
        .mot-streak-label { font-size: 12px; color: var(--text-secondary); }

        /* ===== ТИП ===== */
        .mot-type-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 20px;
            padding: 22px;
            text-align: center;
            margin-bottom: 20px;
        }
        .mot-type-icon { font-size: 44px; margin-bottom: 10px; display: block; }
        .mot-type-name { font-size: 18px; font-weight: 700; color: var(--chrome); margin-bottom: 8px; }
        .mot-type-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* ===== СПИСКИ ===== */
        .mot-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
            margin-top: 18px;
        }
        .mot-list {
            list-style: none;
            padding: 0;
            margin: 0 0 4px;
        }
        .mot-list li {
            padding: 7px 0;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
            border-bottom: 1px solid rgba(224,224,224,0.06);
        }
        .mot-list li:last-child { border-bottom: none; }

        /* ===== МАНТРА ===== */
        .mot-mantra {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            border-radius: 16px;
            padding: 14px 16px;
            margin-top: 16px;
            font-size: 14px;
            font-style: italic;
            color: var(--chrome);
            text-align: center;
            line-height: 1.6;
        }

        /* ===== ТРИГГЕРЫ ===== */
        .mot-trigger-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .mot-trigger-title {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
            color: var(--chrome);
            margin-bottom: 12px;
        }
        .mot-trigger-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 7px 0;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
            border-bottom: 1px solid rgba(224,224,224,0.06);
        }
        .mot-trigger-item:last-child { border-bottom: none; }
        .mot-trigger-num { font-size: 14px; flex-shrink: 0; }

        /* ===== ДОСТИЖЕНИЯ ===== */
        .mot-ach-item {
            display: flex;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .mot-ach-icon { font-size: 26px; flex-shrink: 0; }
        .mot-ach-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
        .mot-ach-desc  { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
        .mot-ach-date  { font-size: 10px; color: var(--text-secondary); margin-top: 4px; }

        /* ===== КНОПКИ ===== */
        .mot-btn {
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 36px;
            touch-action: manipulation;
            outline: none;
        }
        .mot-btn:active { transform: scale(0.97); }
        .mot-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.28);
            color: var(--text-primary);
        }
        .mot-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.26), rgba(192,192,192,0.16)); }
        .mot-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .mot-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .mot-btn-wide {
            width: 100%;
            padding: 13px;
            border-radius: 40px;
            font-size: 13px;
        }

        /* ===== ПУСТО ===== */
        .mot-empty {
            text-align: center;
            padding: 48px 20px;
        }
        .mot-empty-icon { font-size: 48px; display: block; margin-bottom: 14px; }
        .mot-empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .mot-empty-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

        /* ===== TIP ===== */
        .mot-tip {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 16px;
        }
        .mot-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .mot-tab { padding: 7px 10px; font-size: 10px; }
            .mot-card-text { font-size: 14px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА МОТИВАЦИОННЫХ ТИПОВ
// ============================================
const MOT_TYPES = {
    СБ: {
        name: 'Поддерживающий',
        emoji: '🛡️',
        desc: 'Вас мотивирует безопасность, поддержка и признание. Вы чувствительны к критике и давлению.',
        motivates: ['Похвала и признание усилий', 'Безопасная, предсказуемая среда', 'Поддержка близких', 'Чёткие правила и границы'],
        demotivates: ['Критика и давление', 'Конфликты и агрессия', 'Неопределённость и хаос', 'Ощущение несправедливости'],
        mantra: 'Я в безопасности. Мои усилия важны. Я справлюсь.'
    },
    ТФ: {
        name: 'Достиженческий',
        emoji: '🏆',
        desc: 'Вас мотивируют результаты, доход и статус. Вы хотите видеть измеримый прогресс.',
        motivates: ['Конкретные результаты и цифры', 'Финансовое вознаграждение', 'Статус и признание успеха', 'Соревнование и вызовы'],
        demotivates: ['Отсутствие измеримого прогресса', 'Неопределённость в оплате', 'Бессмысленные задачи', 'Отсутствие обратной связи'],
        mantra: 'Я достоин успеха. Каждый шаг приближает меня к цели.'
    },
    УБ: {
        name: 'Смысловой',
        emoji: '🧠',
        desc: 'Вас мотивирует смысл, развитие и понимание. Вы не терпите бессмысленной работы.',
        motivates: ['Понимание «зачем»', 'Возможность учиться и расти', 'Сложные интеллектуальные задачи', 'Вклад в общее дело'],
        demotivates: ['Рутина и бессмысленное повторение', 'Поверхностные объяснения', 'Запрет на вопросы', 'Отсутствие развития'],
        mantra: 'Я расту. Каждый день я узнаю что-то новое о себе и о мире.'
    },
    ЧВ: {
        name: 'Социальный',
        emoji: '💕',
        desc: 'Вас мотивируют отношения, похвала и принятие. В команде вы чувствуете себя лучше.',
        motivates: ['Похвала от значимых людей', 'Тёплые отношения в коллективе', 'Возможность помогать другим', 'Чувство принадлежности'],
        demotivates: ['Одиночество и изоляция', 'Игнорирование заслуг', 'Конфликты и напряжение', 'Несправедливое отношение'],
        mantra: 'Меня ценят. Мои чувства важны. Я не один.'
    }
};

// Локальный fallback — цитаты
const MOT_QUOTES = [
    'Маленькие шаги каждый день ведут к большим результатам.',
    'Вы уже прошли долгий путь. Продолжайте.',
    'То, что вы делаете сегодня, — инвестиция в ваше завтра.',
    'Не сравнивайте свой первый шаг с чужим десятым.',
    'Прогресс — это движение, а не скорость.',
    'Вы сильнее, чем думаете. Способны на большее, чем представляете.',
    'Одна победа не делает чемпиона. Но каждая победа приближает.',
    'Лучшее время начать — сейчас.'
];

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._motState) window._motState = {
    tab: 'today',
    vectors: { СБ:4, ТФ:4, УБ:4, ЧВ:4 },
    todayMot: null,
    todayDate: null,
    streak: 0,
    achievements: []
};
const _mot = window._motState;

// ============================================
// УТИЛИТЫ
// ============================================
function _motToast(msg, type) { if (window.showToast) window.showToast(msg, type||'info'); }
function _motHome() { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _motApi()  { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _motUid()  { return window.CONFIG?.USER_ID; }
function _motName() { return localStorage.getItem('fredi_user_name') || 'друг'; }

function _motSaveLocal() {
    try {
        const uid = _motUid();
        localStorage.setItem('mot_ach_'+uid, JSON.stringify(_mot.achievements));
        localStorage.setItem('mot_streak_'+uid, String(_mot.streak));
    } catch {}
}

function _motLoadLocal() {
    try {
        const uid = _motUid();
        const a = localStorage.getItem('mot_ach_'+uid);
        const s = localStorage.getItem('mot_streak_'+uid);
        if (a) _mot.achievements = JSON.parse(a);
        if (s) _mot.streak = parseInt(s)||0;
    } catch {}
}

function _motWeakVector() {
    return Object.entries(_mot.vectors).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'ЧВ';
}

function _motUpdateStreak() {
    const uid   = _motUid();
    const today = new Date().toDateString();
    const last  = localStorage.getItem('mot_last_'+uid);
    if (last === today) return;
    const yest = new Date(); yest.setDate(yest.getDate()-1);
    _mot.streak = (last === yest.toDateString()) ? _mot.streak + 1 : 1;
    localStorage.setItem('mot_last_'+uid, today);
    _motSaveLocal();
}

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _motLoadVectors() {
    try {
        const r = await fetch(`${_motApi()}/api/get-profile/${_motUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        _mot.vectors = { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch {}
}

// ============================================
// ГЕНЕРАЦИЯ МОТИВАЦИИ
// ============================================
async function _motGenerate() {
    const name   = _motName();
    const type   = MOT_TYPES[_motWeakVector()] || MOT_TYPES.ЧВ;

    try {
        const r = await fetch(`${_motApi()}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: _motUid(),
                prompt: `Ты — Фреди, виртуальный психолог. Создай персональную мотивацию на сегодня.

Пользователь: ${name}
Мотивационный тип: ${type.name} — ${type.desc}

Верни только JSON:
{
  "quote": "вдохновляющая мысль (1 предложение, без кавычек)",
  "affirmation": "персональная аффирмация с обращением по имени ${name}",
  "challenge": "конкретное маленькое действие на сегодня (1-2 минуты)"
}`,
                max_tokens: 300
            })
        });
        const d = await r.json();
        if (d.success && d.content) {
            const clean = d.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            return JSON.parse(clean);
        }
    } catch {}

    // Fallback локальный
    const q = MOT_QUOTES[Math.floor(Math.random()*MOT_QUOTES.length)];
    return {
        quote: q,
        affirmation: `${name}, ты способен на большее, чем думаешь. Каждый шаг важен.`,
        challenge: 'Сделайте одно маленькое дело, которое вы откладывали. Всего 2 минуты.'
    };
}

// ============================================
// РЕНДЕР ГЛАВНОГО ЭКРАНА
// ============================================
function _motRender() {
    _motInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const TABS = [
        { id:'today',        label:'⚡ Сегодня' },
        { id:'type',         label:'🔍 Мой тип' },
        { id:'triggers',     label:'🧠 Триггеры' },
        { id:'achievements', label:'🏆 Победы' + (_mot.achievements.length ? ` <span class="mot-badge">${_mot.achievements.length}</span>` : '') }
    ];

    const tabsHtml = TABS.map(t => `
        <button class="mot-tab${_mot.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>
    `).join('');

    const weak = _motWeakVector();
    const type = MOT_TYPES[weak] || MOT_TYPES.ЧВ;

    let body = '';
    if      (_mot.tab === 'today')        body = _motToday();
    else if (_mot.tab === 'type')         body = _motType(type);
    else if (_mot.tab === 'triggers')     body = _motTriggers();
    else if (_mot.tab === 'achievements') body = _motAchievements();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="motBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔥</div>
                <h1 class="content-title">Мотивация</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">🔥 ${_mot.streak} день подряд</p>
            </div>
            <div class="mot-tabs">${tabsHtml}</div>
            <div id="motBody">${body}</div>
        </div>`;

    document.getElementById('motBack').onclick = () => _motHome();
    document.querySelectorAll('.mot-tab').forEach(btn => {
        btn.addEventListener('click', () => { _mot.tab = btn.dataset.tab; _motRender(); });
    });
    _motBindHandlers();
}

// ============================================
// ВКЛАДКИ
// ============================================
function _motToday() {
    const m = _mot.todayMot || {};
    const quote      = m.quote       || 'Маленькие шаги каждый день ведут к большим результатам.';
    const affirmation= m.affirmation || `${_motName()}, ты способен на большее, чем думаешь.`;
    const challenge  = m.challenge   || 'Сделайте одно маленькое дело, которое вы откладывали. Всего 2 минуты.';

    return `
        <div class="mot-streak-bar">
            <span>🔥</span>
            <span class="mot-streak-num">${_mot.streak}</span>
            <span class="mot-streak-label">день подряд с Фреди</span>
        </div>

        <div class="mot-card">
            <div class="mot-card-icon">💭</div>
            <div class="mot-card-body">
                <div class="mot-card-label">Мудрость дня</div>
                <div class="mot-card-text">${quote}</div>
                <button class="mot-btn mot-btn-ghost mot-copy-btn" data-text="${_esc(quote)}">📋 Скопировать</button>
            </div>
        </div>

        <div class="mot-card">
            <div class="mot-card-icon">✨</div>
            <div class="mot-card-body">
                <div class="mot-card-label">Твоя аффирмация</div>
                <div class="mot-card-text">${affirmation}</div>
                <button class="mot-btn mot-btn-ghost mot-copy-btn" data-text="${_esc(affirmation)}">📋 Скопировать</button>
            </div>
        </div>

        <div class="mot-card">
            <div class="mot-card-icon">⚡</div>
            <div class="mot-card-body">
                <div class="mot-card-label">Вызов на сегодня</div>
                <div class="mot-card-text" id="motChallenge">${challenge}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="mot-btn mot-btn-primary" id="motDone">✅ Выполнил</button>
                    <button class="mot-btn mot-btn-ghost mot-copy-btn" data-text="${_esc(challenge)}">📋</button>
                </div>
            </div>
        </div>

        <button class="mot-btn mot-btn-ghost mot-btn-wide" id="motRefresh" style="margin-top:4px">
            🔄 Новая мотивация
        </button>`;
}

function _motType(type) {
    const motivates   = type.motivates.map(t   => `<li>✅ ${t}</li>`).join('');
    const demotivates = type.demotivates.map(t => `<li>⚠️ ${t}</li>`).join('');

    return `
        <div class="mot-type-card">
            <span class="mot-type-icon">${type.emoji}</span>
            <div class="mot-type-name">${type.name} тип мотивации</div>
            <div class="mot-type-desc">${type.desc}</div>
        </div>

        <div class="mot-section-label">✅ Что вас мотивирует</div>
        <ul class="mot-list">${motivates}</ul>

        <div class="mot-section-label">⚠️ Что вас демотивирует</div>
        <ul class="mot-list">${demotivates}</ul>

        <div class="mot-mantra">${type.mantra}</div>
        <div style="text-align:right;margin-top:8px">
            <button class="mot-btn mot-btn-ghost mot-copy-btn" data-text="${_esc(type.mantra)}">📋 Скопировать мантру</button>
        </div>`;
}

function _motTriggers() {
    const dos = [
        ['1️⃣', 'Создайте ритуал начала дня — 5 минут только на себя'],
        ['2️⃣', 'Разбейте большую цель на микро-шаги по 15 минут'],
        ['3️⃣', 'Отмечайте даже маленькие победы — они формируют стрейк'],
        ['4️⃣', 'Окружите себя людьми, которые верят в вас'],
        ['5️⃣', 'Визуализируйте результат утром, пока ещё не включился внутренний критик']
    ].map(([n,t]) => `<div class="mot-trigger-item"><span class="mot-trigger-num">${n}</span><span>${t}</span></div>`).join('');

    const donts = [
        ['❌', 'Не сравнивайте себя с другими — у вас разные стартовые точки'],
        ['❌', 'Не ждите идеального момента — его не существует'],
        ['❌', 'Не корите себя за пропуски — один день не ломает привычку'],
        ['❌', 'Не держите всё в голове — записывайте, это освобождает ресурс']
    ].map(([n,t]) => `<div class="mot-trigger-item"><span class="mot-trigger-num">${n}</span><span>${t}</span></div>`).join('');

    return `
        <div class="mot-tip" style="margin-bottom:16px">
            🧠 Мотивация — не чувство, которое приходит само. Это <strong>среда и привычки</strong>, которые вы создаёте.
        </div>

        <div class="mot-trigger-card">
            <div class="mot-trigger-title">🔥 КАК СОЗДАТЬ МОТИВАЦИЮ ДЛЯ СЕБЯ</div>
            ${dos}
        </div>

        <div class="mot-trigger-card">
            <div class="mot-trigger-title">🚫 КАК НЕ УБИТЬ СВОЮ МОТИВАЦИЮ</div>
            ${donts}
        </div>`;
}

function _motAchievements() {
    if (!_mot.achievements.length) return `
        <div class="mot-empty">
            <span class="mot-empty-icon">🏆</span>
            <div class="mot-empty-title">Пока нет достижений</div>
            <div class="mot-empty-desc">Выполняйте ежедневные вызовы и нажимайте «Выполнил» — победы будут копиться здесь</div>
        </div>`;

    const items = _mot.achievements.map(a => `
        <div class="mot-ach-item">
            <div class="mot-ach-icon">🏆</div>
            <div>
                <div class="mot-ach-title">${a.title}</div>
                <div class="mot-ach-desc">${a.desc}</div>
                <div class="mot-ach-date">${new Date(a.date).toLocaleDateString('ru-RU')}</div>
            </div>
        </div>`).join('');

    return `
        <div class="mot-streak-bar">
            <span>🔥</span>
            <span class="mot-streak-num">${_mot.streak}</span>
            <span class="mot-streak-label">день подряд · ${_mot.achievements.length} побед</span>
        </div>
        ${items}`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _motBindHandlers() {
    // Копирование
    document.querySelectorAll('.mot-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.text;
            if (!text) return;
            navigator.clipboard.writeText(text)
                .then(() => _motToast('📋 Скопировано', 'success'))
                .catch(() => _motToast('Не удалось скопировать'));
        });
    });

    // Выполнил вызов
    document.getElementById('motDone')?.addEventListener('click', () => {
        const txt = document.getElementById('motChallenge')?.textContent || 'Ежедневное задание';
        _mot.achievements.unshift({ title:'Выполнен вызов дня', desc:txt, date:new Date().toISOString() });
        _motSaveLocal();
        _motToast('🏆 Победа добавлена в копилку!', 'success');
    });

    // Новая мотивация
    document.getElementById('motRefresh')?.addEventListener('click', async () => {
        const btn = document.getElementById('motRefresh');
        if (btn) { btn.textContent = '⏳ Генерирую...'; btn.disabled = true; }
        _mot.todayMot  = await _motGenerate();
        _mot.todayDate = new Date().toDateString();
        _motRender();
    });
}

// ============================================
// ESCAPING (безопасный, без innerHTML)
// ============================================
function _esc(text) {
    return String(text||'')
        .replace(/&/g,'&amp;')
        .replace(/"/g,'&quot;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showMotivationScreen() {
    _motLoadLocal();
    _motUpdateStreak();
    _motRender(); // сразу показываем

    await _motLoadVectors();

    // Генерируем мотивацию если нет или новый день
    const today = new Date().toDateString();
    if (!_mot.todayMot || _mot.todayDate !== today) {
        _mot.todayMot  = await _motGenerate();
        _mot.todayDate = today;
    }

    _motRender(); // перерисовываем с данными
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showMotivationScreen = showMotivationScreen;
console.log('✅ motivation.js v2.0 загружен');
