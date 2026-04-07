// ============================================
// hypnosis.js — Гипноз и внушение
// Версия 2.0 — Переработан под FREDI-стиль
// ============================================

function _hyInjectStyles() {
    if (document.getElementById('hy-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'hy-v2-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .hy-tabs {
            display: flex; gap: 4px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px; margin-bottom: 20px;
            overflow-x: auto; scrollbar-width: none;
        }
        .hy-tabs::-webkit-scrollbar { display: none; }
        .hy-tab {
            flex-shrink: 0; padding: 8px 14px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s; min-height: 36px; touch-action: manipulation;
            white-space: nowrap;
        }
        .hy-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* ===== ТИПЫ ВОЗДЕЙСТВИЯ ===== */
        .hy-types-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .hy-types-grid > * { min-width: 0; }
        .hy-type-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; cursor: pointer;
            transition: background 0.18s, border-color 0.18s; touch-action: manipulation;
        }
        .hy-type-card:active { transform: scale(0.98); }
        .hy-type-card.sel { background: rgba(224,224,224,0.13); border-color: rgba(224,224,224,0.35); }
        .hy-type-card.recommended { border-color: rgba(224,224,224,0.3); }
        .hy-type-emoji { font-size: 26px; margin-bottom: 6px; display: block; }
        .hy-type-name  { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .hy-type-desc  { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
        .hy-type-badge {
            display: inline-block; margin-top: 6px;
            font-size: 9px; font-weight: 700; letter-spacing: 0.3px;
            color: var(--chrome); background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.15); border-radius: 20px; padding: 2px 7px;
        }

        /* ===== ЦЕЛИ ===== */
        .hy-goals-grid {
            display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px;
        }
        .hy-goal-btn {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px; padding: 9px 10px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            transition: background 0.18s, border-color 0.18s; touch-action: manipulation;
            font-family: inherit; min-width: 0;
        }
        .hy-goal-btn:active { transform: scale(0.97); }
        .hy-goal-btn.sel { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.35); }
        .hy-goal-emoji { font-size: 15px; flex-shrink: 0; }
        .hy-goal-name  { font-size: 12px; font-weight: 500; color: var(--text-secondary); min-width: 0; overflow-wrap: anywhere; text-align: center; line-height: 1.2; }
        .hy-goal-btn.sel .hy-goal-name { color: var(--text-primary); }

        /* ===== СВОЁ ВНУШЕНИЕ ===== */
        .hy-custom-block {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; margin-bottom: 14px;
        }
        .hy-custom-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
        .hy-textarea {
            width: 100%; background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18);
            border-radius: 12px; padding: 11px 14px; color: var(--text-primary); font-family: inherit;
            font-size: 14px; outline: none; resize: none; box-sizing: border-box;
            -webkit-appearance: none; min-height: 70px; line-height: 1.55;
        }
        .hy-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .hy-textarea::placeholder { color: var(--text-secondary); }

        /* ===== РЕЗУЛЬТАТ ===== */
        .hy-result-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; padding: 20px;
            margin-bottom: 14px;
        }
        .hy-result-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .hy-result-tag {
            font-size: 11px; padding: 3px 10px; border-radius: 30px;
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .hy-suggestion-box {
            background: rgba(224,224,224,0.06); border-radius: 14px; padding: 16px;
            margin-bottom: 14px;
        }
        .hy-suggestion-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
        .hy-suggestion-text  { font-size: 15px; font-style: italic; line-height: 1.7; color: var(--text-primary); }

        .hy-trigger-box {
            background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.15);
            border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;
            display: flex; gap: 10px; align-items: flex-start;
        }
        .hy-trigger-icon  { font-size: 18px; flex-shrink: 0; }
        .hy-trigger-label { font-size: 10px; font-weight: 700; color: rgba(16,185,129,0.8); margin-bottom: 3px; }
        .hy-trigger-text  { font-size: 13px; color: var(--text-secondary); }

        .hy-instruction-box {
            background: rgba(224,224,224,0.04); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;
        }
        .hy-instruction-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px; }
        .hy-instruction-text  { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        .hy-frequency { font-size: 11px; color: var(--text-secondary); margin-bottom: 14px; }
        .hy-frequency strong { color: var(--chrome); }

        /* ===== ИСТОРИЯ ===== */
        .hy-history-item {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px; padding: 14px; margin-bottom: 8px;
        }
        .hy-history-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; }
        .hy-history-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; font-style: italic; }

        /* ===== ПРОФИЛЬ-ПОДСКАЗКА ===== */
        .hy-profile-tip {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            border-radius: 14px; padding: 11px 14px; margin-bottom: 16px;
            display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-secondary);
        }

        /* ===== КНОПКИ ===== */
        .hy-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .hy-btn:active { transform: scale(0.97); }
        .hy-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .hy-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .hy-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .hy-btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }

        .hy-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .hy-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .hy-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .hy-types-grid  { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
            .hy-goals-grid  { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .hy-suggestion-text { font-size: 14px; }
            .hy-result-card { padding: 16px; }
            .hy-suggestion-box { padding: 14px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ТИПЫ ВНУШЕНИЙ
// ============================================
const HY_TYPES = {
    direct: {
        name: 'Прямое',
        emoji: '📢',
        desc: 'Чёткие императивные формулы. Работает через авторитет и прямое указание. Хорошо для логического ума.',
        technique: 'Императивный тон, отсутствие альтернатив',
        instruction: 'Читайте вслух или про себя чётким уверенным голосом. Повторяйте 2-3 раза. Лучшее время — утром после пробуждения и вечером перед сном.'
    },
    indirect: {
        name: 'Косвенное',
        emoji: '🔄',
        desc: 'Скрытые внушения через пресуппозиции. Обходит сознательную критику. Мягкое, ненавязчивое.',
        technique: 'Пресуппозиции, трюизмы, yes-set',
        instruction: 'Читайте спокойно, без напряжения. Не старайтесь «поверить» — просто позвольте словам проходить через сознание. Эффект накопительный.'
    },
    emotional: {
        name: 'Образное',
        emoji: '🌀',
        desc: 'Через яркие образы и метафоры. Работает через воображение и правое полушарие.',
        technique: 'Метафоры, сенсорные образы, эмоциональная зараза',
        instruction: 'Перед чтением закройте глаза, сделайте 3 глубоких вдоха. Представляйте образы максимально ярко. Включайте воображение.'
    },
    posthypnotic: {
        name: 'Постгипнотическое',
        emoji: '🧬',
        desc: 'Программирование на будущее. Автоматически срабатывает при триггере.',
        technique: 'Привязка к триггеру, отложенное действие',
        instruction: 'Прочитайте текст и запомните триггер. Первые 7 дней повторяйте ежедневно. Затем триггер начнёт срабатывать автоматически.'
    }
};

// Рекомендация по векторам
function _hyRecommendedType(vectors) {
    if (!vectors) return 'indirect';
    if (vectors.СБ >= 5) return 'indirect';      // чувствительные — косвенное
    if (vectors.ТФ >= 5) return 'direct';         // прагматики — прямое
    if (vectors.ЧВ >= 5) return 'emotional';      // эмпаты — образное
    if (vectors.УБ >= 5) return 'posthypnotic';   // мыслители — постгипнотическое
    return 'indirect';
}

// ============================================
// ЦЕЛИ И ТЕКСТЫ
// ============================================
const HY_GOALS = [
    {
        id: 'calm', emoji: '😊', name: 'Спокойствие',
        direct:        'Я спокоен и расслаблен. Моё дыхание ровное и глубокое. Внутри меня тишина и покой.',
        indirect:      'Нет необходимости волноваться, когда внутри так спокойно. Удивительно, как легко приходит расслабление, когда просто позволяешь ему случиться.',
        emotional:     'Представьте, что вы лежите на тёплом песке у океана. Волны накатывают и уходят, унося всё напряжение. Внутри — глубокая, всеобъемлющая тишина.',
        posthypnotic:  'Когда вы почувствуете напряжение, сделайте глубокий вдох — и спокойствие автоматически заполнит вас.',
        trigger: 'глубокий вдох'
    },
    {
        id: 'confidence', emoji: '💪', name: 'Уверенность',
        direct:        'Я уверен в себе. Мои решения верны. Я знаю, что справлюсь с любой задачей.',
        indirect:      'И когда вы почувствуете эту уверенность, вы удивитесь, насколько легко принимать решения. Согласитесь, приятно ощущать внутреннюю силу.',
        emotional:     'Вспомните момент, когда вы были на пике формы. Ту лёгкость, с которой решали задачи. Это чувство возвращается сейчас, наполняя вас энергией.',
        posthypnotic:  'Каждый раз, когда вы смотрите в зеркало, волна уверенности проходит через всё тело.',
        trigger: 'взгляд в зеркало'
    },
    {
        id: 'sleep', emoji: '😴', name: 'Сон',
        direct:        'Мои глаза тяжелеют. Веки смыкаются. Я погружаюсь в глубокий, восстанавливающий сон.',
        indirect:      'Нет необходимости бороться со сном, когда он приходит сам. И когда вы заснете, ваш мозг продолжит работу, восстанавливая ресурсы.',
        emotional:     'Представьте, что вы падаете в мягкое, тёплое облако. Оно обволакивает вас, убаюкивает. Каждая клеточка расслабляется, отпускает.',
        posthypnotic:  'Когда ваша голова касается подушки, тело автоматически расслабляется, и вы засыпаете в течение 2 минут.',
        trigger: 'голова касается подушки'
    },
    {
        id: 'motivation', emoji: '🔥', name: 'Мотивация',
        direct:        'Я полон энергии и желания действовать. Мои цели достижимы. Я начинаю прямо сейчас.',
        indirect:      'И когда вы почувствуете этот прилив энергии, вы удивитесь, сколько всего можно успеть. Почему бы не начать прямо сейчас?',
        emotional:     'Вспомните чувство, когда вы сделали что-то важное. Ту гордость и подъём. Это чувство возвращается, наполняя вас желанием действовать.',
        posthypnotic:  'Каждое утро, когда вы открываете глаза, вы чувствуете мощный прилив энергии и желание действовать.',
        trigger: 'открывание глаз утром'
    },
    {
        id: 'focus', emoji: '🧠', name: 'Фокус',
        direct:        'Моё внимание сфокусировано. Я легко удерживаю концентрацию. Всё лишнее уходит на второй план.',
        indirect:      'Нет необходимости отвлекаться, когда так легко сосредоточиться. И чем больше вы фокусируетесь, тем глубже становится концентрация.',
        emotional:     'Представьте, что вы — прожектор. Луч освещает только то, что важно прямо сейчас. Всё остальное — в мягкой тени, не отвлекает.',
        posthypnotic:  'Когда вы садитесь за работу, ваше внимание автоматически фокусируется на задаче на 45 минут.',
        trigger: 'начало работы'
    },
    {
        id: 'self_love', emoji: '💕', name: 'Принятие себя',
        direct:        'Я принимаю и люблю себя таким, какой я есть. Я достоин счастья и уважения.',
        indirect:      'Нет необходимости критиковать себя, когда можно просто принять. И когда принимаете себя, удивительно, как меняется жизнь вокруг.',
        emotional:     'Представьте, что вы обнимаете себя. Почувствуйте тепло, нежность, полное принятие. Вы достойны этой любви.',
        posthypnotic:  'Каждый раз, когда возникает самокритика, внутренний голос автоматически говорит: «Я принимаю себя».',
        trigger: 'момент самокритики'
    },
    {
        id: 'habits', emoji: '🚫', name: 'Отказ от привычки',
        direct:        'Мне больше не нужны вредные привычки. Они уходят из моей жизни естественно и легко.',
        indirect:      'Нет необходимости в том, что вредит, когда есть столько полезного. И когда вы понимаете это, привычка теряет силу сама.',
        emotional:     'Представьте, что вредная привычка — это старый ненужный груз. Вы просто снимаете его с плеч и оставляете на дороге. Лёгкость!',
        posthypnotic:  'Когда возникает желание сделать что-то вредное, тело автоматически говорит: «Нет, спасибо».',
        trigger: 'желание сделать вредное действие'
    },
    {
        id: 'goals', emoji: '🎯', name: 'Цели',
        direct:        'Я достигаю своих целей. Каждый день я делаю шаг к своему успеху.',
        indirect:      'И когда вы достигаете очередной цели, вы удивляетесь, как легко это было. Почему бы не поставить следующую?',
        emotional:     'Представьте, что вы уже достигли цели. Почувствуйте радость, гордость, удовлетворение. Это чувство ведёт вас вперёд.',
        posthypnotic:  'Каждый вечер, когда ложитесь спать, вы автоматически мысленно намечаете 3 шага к цели на завтра.',
        trigger: 'вечерний ритуал'
    },
    {
        id: 'anxiety', emoji: '🌿', name: 'От тревоги',
        direct:        'Тревога отступает. Мой ум ясен. Я справляюсь с любой ситуацией спокойно и уверенно.',
        indirect:      'Нет необходимости удерживать тревогу, когда она может просто уйти. Тело само умеет успокаиваться — когда позволяешь.',
        emotional:     'Представьте, что тревога — это туман. Подул тёплый ветер — и туман начал рассеиваться. За ним — ясное небо и простор.',
        posthypnotic:  'Когда вы замечаете тревогу, вы автоматически делаете три медленных выдоха — и напряжение уходит.',
        trigger: 'момент тревоги'
    }
];

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._hyState) window._hyState = {
    tab:     'create',
    type:    'indirect',
    goalId:  null,
    result:  null,
    vectors: null
};
const _hy = window._hyState;

// ============================================
// УТИЛИТЫ
// ============================================
function _hyToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _hyHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _hyApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _hyUid()   { return window.CONFIG?.USER_ID; }
function _hyName()  { return localStorage.getItem('fredi_user_name') || ''; }

function _hyLoadHistory() {
    try { const r = localStorage.getItem('hy_history_'+_hyUid()); return r ? JSON.parse(r) : []; } catch { return []; }
}
function _hySaveHistory(entry) {
    try {
        const arr = _hyLoadHistory();
        arr.unshift(entry);
        localStorage.setItem('hy_history_'+_hyUid(), JSON.stringify(arr.slice(0, 20)));
    } catch {}
}

async function _hyLoadVectors() {
    try {
        const r = await fetch(`${_hyApi()}/api/get-profile/${_hyUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        return { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch { return null; }
}

// ============================================
// РЕНДЕР
// ============================================
function _hyRender() {
    _hyInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const TABS = [
        { id:'create',  label:'🔮 Создать' },
        { id:'history', label:'📜 История' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="hy-tab${_hy.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = _hy.tab === 'create' ? _hyCreate() : _hyHistory();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="hyBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Гипноз и внушение</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Суггестивное воздействие под ваш профиль</p>
            </div>
            <div class="hy-tabs">${tabsHtml}</div>
            <div id="hyBody">${body}</div>
        </div>`;

    document.getElementById('hyBack').onclick = () => _hyHome();
    document.querySelectorAll('.hy-tab').forEach(btn => {
        btn.addEventListener('click', () => { _hy.tab = btn.dataset.tab; _hyRender(); });
    });
    _hyBindHandlers();
}

// ===== СОЗДАТЬ =====
function _hyCreate() {
    const rec = _hyRecommendedType(_hy.vectors);

    // Типы
    const typesHtml = Object.entries(HY_TYPES).map(([key, t]) => `
        <div class="hy-type-card${_hy.type===key?' sel':''}${key===rec?' recommended':''}" data-type="${key}">
            <span class="hy-type-emoji">${t.emoji}</span>
            <div class="hy-type-name">${t.name}</div>
            <div class="hy-type-desc">${t.desc}</div>
            ${key===rec ? `<span class="hy-type-badge">⭐ для вашего профиля</span>` : ''}
        </div>`).join('');

    // Цели
    const goalsHtml = HY_GOALS.map(g => `
        <button class="hy-goal-btn${_hy.goalId===g.id?' sel':''}" data-goal="${g.id}">
            <span class="hy-goal-emoji">${g.emoji}</span>
            <span class="hy-goal-name">${g.name}</span>
        </button>`).join('');

    const resultHtml = _hy.result ? _hyResultBlock(_hy.result) : '';

    return `
        <div class="hy-section-label">Тип воздействия</div>
        <div class="hy-types-grid">${typesHtml}</div>

        <div class="hy-section-label">Цель внушения</div>
        <div class="hy-goals-grid">${goalsHtml}</div>

        <div class="hy-custom-block">
            <div class="hy-custom-label">✏️ Или напишите своё внушение:</div>
            <textarea class="hy-textarea" id="hyCustomInput"
                placeholder="Например: «Я легко просыпаюсь утром и полон энергии»"
                rows="3"></textarea>
            <button class="hy-btn hy-btn-primary" id="hyCustomBtn" style="margin-top:10px">
                🔮 Создать внушение
            </button>
        </div>

        ${resultHtml}

        <div class="hy-tip">
            💡 <strong>Суггестия</strong> — это воздействие при котором информация принимается без критического осмысления. Эффект накапливается при регулярном повторении.
        </div>`;
}

function _hyResultBlock(r) {
    const triggerHtml = r.trigger ? `
        <div class="hy-trigger-box">
            <span class="hy-trigger-icon">🔘</span>
            <div>
                <div class="hy-trigger-label">ТРИГГЕР</div>
                <div class="hy-trigger-text">${r.trigger}</div>
            </div>
        </div>` : '';

    return `
        <div class="hy-section-label" style="margin-top:24px">Ваше внушение</div>
        <div class="hy-result-card">
            <div class="hy-result-meta">
                <span class="hy-result-tag">${HY_TYPES[r.type]?.emoji} ${HY_TYPES[r.type]?.name}</span>
                <span class="hy-result-tag">${r.goalEmoji} ${r.goalName}</span>
            </div>
            <div class="hy-suggestion-box">
                <div class="hy-suggestion-label">🔮 Текст внушения</div>
                <div class="hy-suggestion-text">${r.text}</div>
            </div>
            ${triggerHtml}
            <div class="hy-instruction-box">
                <div class="hy-instruction-label">📖 Как применять</div>
                <div class="hy-instruction-text">${r.instruction}</div>
            </div>
            <div class="hy-frequency">⏱ <strong>Режим:</strong> ежедневно 1-2 раза, 21 день для закрепления</div>
            <div class="hy-btn-row">
                <button class="hy-btn hy-btn-ghost" id="hyCopyBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="hyNewBtn">🔄 Новое</button>
            </div>
        </div>`;
}

// ===== ИСТОРИЯ =====
function _hyHistory() {
    const history = _hyLoadHistory();
    if (!history.length) return `
        <div style="text-align:center;padding:48px 20px">
            <span style="font-size:44px;display:block;margin-bottom:12px">📜</span>
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">История пуста</div>
            <div style="font-size:12px;color:var(--text-secondary)">Создайте первое внушение во вкладке «Создать»</div>
        </div>`;

    return `
        <div class="hy-section-label">Сохранённые внушения — ${history.length}</div>
        ${history.map(h => `
        <div class="hy-history-item">
            <div class="hy-history-meta">
                <span>${HY_TYPES[h.type]?.emoji} ${HY_TYPES[h.type]?.name} · ${h.goalEmoji} ${h.goalName}</span>
                <span>${new Date(h.date).toLocaleDateString('ru-RU')}</span>
            </div>
            <div class="hy-history-text">${h.text.slice(0, 120)}${h.text.length > 120 ? '...' : ''}</div>
        </div>`).join('')}`;
}

// ============================================
// СОЗДАНИЕ ВНУШЕНИЯ
// ============================================
function _hyMakeSuggestion(type, goalId, customText) {
    const typeData = HY_TYPES[type];
    const goal     = HY_GOALS.find(g => g.id === goalId);

    let text, trigger, goalName, goalEmoji;

    if (customText) {
        text      = customText;
        goalName  = 'Своё внушение';
        goalEmoji = '✨';
        trigger   = null;
    } else if (goal) {
        text      = goal[type] || goal.direct;
        trigger   = type === 'posthypnotic' ? goal.trigger : null;
        goalName  = goal.name;
        goalEmoji = goal.emoji;
    } else {
        return null;
    }

    // Добавляем имя в начало если известно (не ломаем текст)
    const name = _hyName();
    if (name && type === 'direct') {
        text = `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }

    return {
        text, trigger, goalName, goalEmoji,
        type, instruction: typeData.instruction,
        date: new Date().toISOString()
    };
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _hyBindHandlers() {
    // Выбор типа
    document.querySelectorAll('.hy-type-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.hy-type-card').forEach(c => c.classList.remove('sel'));
            card.classList.add('sel');
            _hy.type = card.dataset.type;
            // Если уже выбрана цель — пересоздать
            if (_hy.goalId) {
                _hy.result = _hyMakeSuggestion(_hy.type, _hy.goalId, null);
                document.getElementById('hyBody').innerHTML = _hyCreate();
                _hyBindHandlers();
            }
        });
    });

    // Выбор цели — сразу генерирует
    document.querySelectorAll('.hy-goal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.hy-goal-btn').forEach(b => b.classList.remove('sel'));
            btn.classList.add('sel');
            _hy.goalId = btn.dataset.goal;
            _hy.result = _hyMakeSuggestion(_hy.type, _hy.goalId, null);
            _hySaveHistory(_hy.result);
            // Показать результат без перерендера
            const existing = document.querySelector('.hy-result-card')?.closest('.hy-section-label');
            if (existing) existing.remove();
            const body = document.getElementById('hyBody');
            const html = _hyResultBlock(_hy.result);
            // Убираем старый результат
            const old = body.querySelector('.hy-section-label:last-of-type');
            body.insertAdjacentHTML('beforeend', `<div class="hy-section-label" style="margin-top:24px">Ваше внушение</div>${_hyResultBlock(_hy.result)}`);
            _hyBindResultHandlers();
        });
    });

    // Кастомное внушение
    document.getElementById('hyCustomBtn')?.addEventListener('click', () => {
        const text = (document.getElementById('hyCustomInput')?.value || '').trim();
        if (!text) { _hyToast('Напишите текст внушения', 'error'); return; }
        _hy.result = _hyMakeSuggestion(_hy.type, null, text);
        _hy.goalId = null;
        _hySaveHistory(_hy.result);
        _hyRender();
    });

    _hyBindResultHandlers();
}

function _hyBindResultHandlers() {
    document.getElementById('hyCopyBtn')?.addEventListener('click', () => {
        if (!_hy.result) return;
        copyToClipboard(_hy.result.text)
            .then(() => _hyToast('📋 Скопировано', 'success'))
            .catch(() => _hyToast('Не удалось скопировать'));
    });

    document.getElementById('hyNewBtn')?.addEventListener('click', () => {
        _hy.result = null; _hy.goalId = null; _hyRender();
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showHypnosisScreen() {
    _hy.tab = 'create';
    // Загружаем векторы для рекомендации типа
    if (!_hy.vectors) {
        _hy.vectors = await _hyLoadVectors();
        if (_hy.vectors) _hy.type = _hyRecommendedType(_hy.vectors);
    }
    _hyRender();
}

window.showHypnosisScreen = showHypnosisScreen;
console.log('✅ hypnosis.js v2.0 загружен');
