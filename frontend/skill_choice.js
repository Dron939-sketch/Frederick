// ============================================
// skill_choice.js — Выбор навыка + план
// Версия 2.1 — захардкоренный 21-дневный план (без AI)
// ============================================

function _scInjectStyles() {
    if (document.getElementById('sc-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'sc-v2-styles';
    s.textContent = `
        .sc-skill-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.18s, border-color 0.18s, transform 0.12s;
            display: flex;
            align-items: center;
            gap: 12px;
            touch-action: manipulation;
        }
        .sc-skill-card:hover  { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.22); }
        .sc-skill-card:active { transform: scale(0.98); }
        .sc-skill-card.active { background: rgba(224,224,224,0.15); border-color: rgba(224,224,224,0.38); }
        .sc-skill-body  { flex: 1; min-width: 0; }
        .sc-skill-name  { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
        .sc-skill-sub   { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
        .sc-skill-score {
            font-size: 11px; font-weight: 700; color: var(--text-secondary);
            flex-shrink: 0; background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.14); border-radius: 20px;
            padding: 3px 9px;
        }
        .sc-skill-bar-wrap { height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .sc-skill-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); }

        .sc-input {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
            -webkit-appearance: none;
        }
        .sc-input:focus { border-color: rgba(224,224,224,0.35); }
        .sc-input::placeholder { color: var(--text-secondary); }

        .sc-btn {
            padding: 11px 20px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 42px;
            touch-action: manipulation;
            outline: none;
        }
        .sc-btn:active { transform: scale(0.97); }
        .sc-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            color: var(--text-primary);
            width: 100%;
            border-radius: 40px;
            padding: 13px;
        }
        .sc-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.16)); }
        .sc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .sc-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .sc-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .sc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .sc-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .sc-custom-block {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-top: 8px;
        }
        .sc-custom-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

        /* ПЛАН */
        .sc-plan-header {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 18px;
            padding: 16px 18px;
            margin-bottom: 20px;
        }
        .sc-plan-skill { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .sc-plan-meta  { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .sc-plan-progress { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 10px; overflow: hidden; }
        .sc-plan-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); transition: width 0.4s; }

        .sc-week { margin-bottom: 20px; }
        .sc-week-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 8px;
        }
        .sc-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .sc-day {
            aspect-ratio: 1;
            border-radius: 8px;
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
            cursor: pointer; transition: background 0.15s; touch-action: manipulation; min-height: 38px;
        }
        .sc-day:hover   { background: rgba(224,224,224,0.1); }
        .sc-day.current { border-color: rgba(224,224,224,0.4); background: rgba(224,224,224,0.14); }
        .sc-day.done    { background: rgba(224,224,224,0.12); border-color: rgba(224,224,224,0.25); }
        .sc-day-num     { font-size: 10px; font-weight: 700; color: var(--text-secondary); }
        .sc-day-dot     { width: 5px; height: 5px; border-radius: 50%; background: rgba(224,224,224,0.15); }
        .sc-day.done .sc-day-dot    { background: var(--chrome); }
        .sc-day.current .sc-day-dot { background: var(--chrome); }

        .sc-today-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 14px;
        }
        .sc-today-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
        .sc-today-num {
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(224,224,224,0.12); display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; color: var(--chrome); flex-shrink: 0;
        }
        .sc-today-task { font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.4; }
        .sc-today-dur  { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
        .sc-today-inst { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; }

        .sc-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 14px;
        }
        .sc-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .sc-skill-name { font-size: 13px; }
            .sc-today-task { font-size: 13px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ПРЕДОПРЕДЕЛЁННЫЕ НАВЫКИ (с описаниями для AI)
// ============================================
const SC_SKILLS = {
    personal: [
        { id:'confidence',    name:'Уверенность в себе',    desc:'Действовать без одобрения извне, верить в свои силы' },
        { id:'discipline',    name:'Дисциплина',             desc:'Выполнять намеченное независимо от настроения' },
        { id:'boundaries',    name:'Личные границы',         desc:'Говорить «нет» без чувства вины' },
        { id:'emotions',      name:'Эмоциональный интеллект',desc:'Распознавать и управлять своими эмоциями' },
        { id:'communication', name:'Коммуникация',           desc:'Ясно и честно выражать мысли и чувства' },
        { id:'resilience',    name:'Стрессоустойчивость',    desc:'Восстанавливаться после трудностей' },
        { id:'focus',         name:'Фокус и концентрация',   desc:'Удерживать внимание на важном' },
        { id:'growth',        name:'Установка на рост',      desc:'Воспринимать трудности как возможности' }
    ],
    professional: [
        { id:'planning',    name:'Планирование',         desc:'Ставить цели и разбивать на конкретные шаги' },
        { id:'decision',    name:'Принятие решений',     desc:'Действовать при неполной информации' },
        { id:'delegation',  name:'Делегирование',        desc:'Передавать задачи и доверять другим' },
        { id:'leadership',  name:'Лидерство',            desc:'Вести за собой и вдохновлять людей' },
        { id:'timemanage',  name:'Управление временем',  desc:'Расставлять приоритеты и не прокрастинировать' },
        { id:'feedback',    name:'Обратная связь',       desc:'Давать и принимать критику конструктивно' },
        { id:'networking',  name:'Нетворкинг',           desc:'Строить и поддерживать профессиональные связи' },
        { id:'creativity',  name:'Креативность',         desc:'Находить нестандартные решения' }
    ]
};

// ============================================
// ХАРДКОДНЫЙ ШАБЛОН 21-ДНЕВНОГО ПЛАНА
// ============================================
const DEFAULT_TEMPLATE_PLAN = {
    weeks: [
        {
            theme: 'Знакомство и калибровка',
            exercises: [
                { day:1, task:'Зачем вам этот навык',     dur:'5 мин',  inst:'Запишите 3 конкретные ситуации, где этот навык изменил бы исход.' },
                { day:2, task:'Замечание',                 dur:'10 мин', inst:'В течение дня замечайте моменты, где навык бы понадобился. Записывайте 1–3 ситуации без оценки.' },
                { day:3, task:'Триггеры',                  dur:'7 мин',  inst:'Какие 3 ситуации запускают вашу старую реакцию? Конкретно: место, человек, время, ваша мысль.' },
                { day:4, task:'Микро-эксперимент',         dur:'15 мин', inst:'В одной безопасной ситуации попробуйте действовать по-новому. Зафиксируйте, что произошло.' },
                { day:5, task:'Рефлексия',                 dur:'5 мин',  inst:'Что было неудобно вчера? Назовите чувство одним словом — это точка роста.' },
                { day:6, task:'Повтор с поправкой',        dur:'15 мин', inst:'Похожая ситуация, что и в день 4 — но с поправкой на вчерашнюю рефлексию.' },
                { day:7, task:'Итог недели',               dur:'10 мин', inst:'Один главный инсайт за неделю. На сколько процентов продвинулись?' }
            ]
        },
        {
            theme: 'Активная тренировка',
            exercises: [
                { day:8,  task:'Усложнение',           dur:'15 мин', inst:'Та же техника, но в более сложной ситуации. Где раньше избегали.' },
                { day:9,  task:'Постановка якоря',     dur:'7 мин',  inst:'Когда сегодня получится — запомните телесное состояние и сожмите большой и указательный пальцы на 5 секунд.' },
                { day:10, task:'Препятствие',          dur:'10 мин', inst:'Что в окружении мешает практике? Один конкретный фактор и один шаг по его устранению.' },
                { day:11, task:'Поддержка',            dur:'5 мин',  inst:'Расскажите близкому, что проходите 21 день навыка. Попросите не оценивать прогресс.' },
                { day:12, task:'Худший момент',        dur:'10 мин', inst:'Что было самым трудным? Опишите 3 предложениями. Что бы посоветовали другу?' },
                { day:13, task:'Маленькая победа',     dur:'15 мин', inst:'Найдите ситуацию, где точно получится. Зафиксируйте успех — текстом, голосом, в дневнике.' },
                { day:14, task:'Полу-итог',            dur:'10 мин', inst:'На сколько процентов продвинулись? Что главное изменилось? Что осталось на третью неделю?' }
            ]
        },
        {
            theme: 'Закрепление и интеграция',
            exercises: [
                { day:15, task:'Естественная среда',  dur:'12 мин', inst:'Применяйте навык без специальных условий — в обычном дне.' },
                { day:16, task:'Без напоминаний',     dur:'10 мин', inst:'Сделайте без подсказки. К вечеру отметьте, удалось ли.' },
                { day:17, task:'Перенос',             dur:'15 мин', inst:'Новая ситуация, где раньше не пробовали. Что переносится, что нет?' },
                { day:18, task:'Глубже',              dur:'15 мин', inst:'Усложните: больше людей, выше ставки, дольше время.' },
                { day:19, task:'Помощь другому',      dur:'10 мин', inst:'Объясните принцип кому-то ещё в 2–3 предложениях. Это закрепляет понимание.' },
                { day:20, task:'Письмо себе',         dur:'15 мин', inst:'Напишите себе через год — что хотите помнить из этого 21 дня.' },
                { day:21, task:'Итог цикла',          dur:'15 мин', inst:'Сравните: где были в день 1 и где сегодня. Что точно изменилось? Что дальше?' }
            ]
        }
    ]
};

function _scLocalPlan() {
    return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_PLAN));
}

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._scState) window._scState = {
    view:      'select',  // 'select' | 'plan'
    skillId:   null,
    skillName: null,
    skillDesc: null,
    plan:      null,      // { weeks: [{theme, exercises:[{day,task,dur,inst}]}] }
    daysDone:  [],
    startDate: null
};
const _sc = window._scState;

// ============================================
// УТИЛИТЫ
// ============================================
function _scToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _scHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _scApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _scUid()   { return window.CONFIG?.USER_ID; }
function _scName()  { return localStorage.getItem('fredi_user_name') || 'друг'; }

function _scSave() {
    try {
        const data = {
            skillId: _sc.skillId, skillName: _sc.skillName, skillDesc: _sc.skillDesc,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate
        };
        localStorage.setItem('sc_plan_'+_scUid(), JSON.stringify(data));
        // Синхронизируем с daily_training
        localStorage.setItem('trainer_skill_'+_scUid(), JSON.stringify({
            skillId: _sc.skillId, skillName: _sc.skillName,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate
        }));
    } catch {}
}

function _scLoad() {
    try {
        const d = localStorage.getItem('sc_plan_'+_scUid());
        if (d) Object.assign(_sc, JSON.parse(d));
    } catch {}
}

function _scCurrentDay() {
    if (!_sc.startDate) return 1;
    const diff = Math.floor((Date.now() - new Date(_sc.startDate)) / 86400000) + 1;
    return Math.min(21, Math.max(1, diff));
}

// ============================================
// РЕНДЕР
// ============================================
function _scRender() {
    _scInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '';
    if (_sc.view === 'select') body = _scRenderSelect();
    if (_sc.view === 'plan')   body = _scRenderPlan();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="scBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Выбор навыка</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">21-дневный план развития</p>
            </div>
            <div id="scBody">${body}</div>
        </div>`;

    document.getElementById('scBack').onclick = () => {
        if (_sc.view === 'plan') { _sc.view = 'select'; _scRender(); return; }
        _scHome();
    };

    _scBindHandlers();
}

// ===== ЭКРАН ВЫБОРА =====
function _scRenderSelect() {
    // Навыки из диагностики
    let diagBlock = '';
    try {
        const sdRaw = localStorage.getItem('sd_result_'+_scUid());
        if (sdRaw) {
            const sd = JSON.parse(sdRaw);
            const sphere = sd.sphere || 'personal';
            const skills = SC_SKILLS[sphere] || SC_SKILLS.personal;
            const entries = Object.entries(sd.scores || {});
            if (entries.length > 0) {
                const sorted = entries
                    .map(([qi, score]) => ({ qi: parseInt(qi), score }))
                    .sort((a,b) => a.score - b.score)
                    .slice(0, 3);
                const cards = sorted.map(({qi, score}) => {
                    const skill = skills[qi];
                    if (!skill) return '';
                    const pct = Math.round(score/4*100);
                    return `
                    <div class="sc-skill-card${_sc.skillId===skill.id?' active':''}" data-id="${skill.id}" data-name="${skill.name}" data-desc="${skill.desc}">
                        <div class="sc-skill-body">
                            <div class="sc-skill-name">${skill.name}</div>
                            <div class="sc-skill-sub">${skill.desc}</div>
                            <div class="sc-skill-bar-wrap">
                                <div class="sc-skill-bar-fill" style="width:${pct}%"></div>
                            </div>
                        </div>
                        <div class="sc-skill-score">${score}/4</div>
                    </div>`;
                }).filter(Boolean).join('');
                if (cards) diagBlock = `
                    <div class="sc-section-label">📊 Из диагностики — слабые места</div>
                    ${cards}`;
            }
        }
    } catch {}

    // Активный план
    const activePlan = _sc.plan ? `
        <div style="background:rgba(224,224,224,0.06);border:1px solid rgba(224,224,224,0.18);border-radius:14px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-size:13px;font-weight:600;color:var(--chrome)">${_sc.skillName}</div>
                <div style="font-size:11px;color:var(--text-secondary)">День ${_scCurrentDay()} из 21 · выполнено ${_sc.daysDone.length}</div>
            </div>
            <button class="sc-btn sc-btn-ghost" id="scOpenPlan" style="flex-shrink:0">Открыть план →</button>
        </div>` : '';

    // Все навыки
    const personal = SC_SKILLS.personal.map(sk => `
        <div class="sc-skill-card${_sc.skillId===sk.id?' active':''}" data-id="${sk.id}" data-name="${sk.name}" data-desc="${sk.desc}">
            <div class="sc-skill-body">
                <div class="sc-skill-name">${sk.name}</div>
                <div class="sc-skill-sub">${sk.desc}</div>
            </div>
        </div>`).join('');

    const professional = SC_SKILLS.professional.map(sk => `
        <div class="sc-skill-card${_sc.skillId===sk.id?' active':''}" data-id="${sk.id}" data-name="${sk.name}" data-desc="${sk.desc}">
            <div class="sc-skill-body">
                <div class="sc-skill-name">${sk.name}</div>
                <div class="sc-skill-sub">${sk.desc}</div>
            </div>
        </div>`).join('');

    return `
        ${activePlan}
        ${diagBlock}
        <div class="sc-section-label" style="margin-top:${diagBlock?'18px':'0'}">🧠 Личностные навыки</div>
        ${personal}
        <div class="sc-section-label">💼 Профессиональные навыки</div>
        ${professional}

        <div class="sc-custom-block">
            <div class="sc-custom-label">✏️ Или введите свой навык:</div>
            <input class="sc-input" id="scCustomInput" placeholder="Например: публичные выступления, управление гневом...">
        </div>

        <button class="sc-btn sc-btn-primary" id="scStartBtn" style="margin-top:14px">
            📋 Показать план на 21 день
        </button>
        <div class="sc-tip">
            💡 План открывается мгновенно: 3 недели с нарастающей сложностью, по одному упражнению в день.
        </div>`;
}

// ===== ЭКРАН ПЛАНА =====
function _scRenderPlan() {
    if (!_sc.plan) return '<p style="color:var(--text-secondary)">Ошибка загрузки плана</p>';

    const day     = _scCurrentDay();
    const done    = _sc.daysDone;
    const pct     = Math.round((done.length / 21) * 100);

    // Календарь
    const calHtml = _sc.plan.weeks.map((week, wi) => {
        const daysHtml = week.exercises.map(ex => {
            const d         = ex.day;
            const isDone    = done.includes(d);
            const isCurrent = d === day && !isDone;
            return `<div class="sc-day${isDone?' done':''}${isCurrent?' current':''}" data-day="${d}">
                <div class="sc-day-num">${d}</div>
                <div class="sc-day-dot"></div>
            </div>`;
        }).join('');
        return `
        <div class="sc-week">
            <div class="sc-week-label">Неделя ${wi+1} · ${week.theme}</div>
            <div class="sc-week-grid">${daysHtml}</div>
        </div>`;
    }).join('');

    // Упражнение текущего дня
    const curEx = _sc.plan.weeks
        .flatMap(w => w.exercises)
        .find(e => e.day === day);

    const isDoneToday = done.includes(day);

    const todayHtml = curEx ? `
        <div class="sc-section-label">⚡ День ${day} — сегодня</div>
        <div class="sc-today-card">
            <div class="sc-today-header">
                <div class="sc-today-num">${day}</div>
                <div class="sc-today-task">${curEx.task}</div>
            </div>
            <div class="sc-today-dur">⏱ ${curEx.dur}</div>
            <div class="sc-today-inst">${curEx.inst}</div>
            ${!isDoneToday
                ? `<button class="sc-btn sc-btn-primary" id="scMarkDone">✅ Отметить выполнение</button>`
                : `<div style="font-size:12px;color:var(--text-secondary);text-align:center">✅ Выполнено сегодня — до завтра!</div>`}
        </div>` : '';

    return `
        <div class="sc-plan-header">
            <div class="sc-plan-skill">🎯 ${_sc.skillName}</div>
            <div class="sc-plan-meta">
                День ${day} из 21 · выполнено ${done.length} упражнений · прогресс ${pct}%
            </div>
            <div class="sc-plan-progress">
                <div class="sc-plan-progress-fill" style="width:${pct}%"></div>
            </div>
        </div>

        ${calHtml}
        ${todayHtml}

        <div class="sc-btn-row" style="margin-top:20px">
            <button class="sc-btn sc-btn-ghost" id="scResetBtn">🔄 Новый навык</button>
            <button class="sc-btn sc-btn-ghost" id="scGoTraining">⚡ Тренировка дня</button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _scBindHandlers() {
    // Выбор карточки
    document.querySelectorAll('.sc-skill-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.sc-skill-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            _sc.skillId   = card.dataset.id;
            _sc.skillName = card.dataset.name;
            _sc.skillDesc = card.dataset.desc;
        });
    });

    // Открыть существующий план
    document.getElementById('scOpenPlan')?.addEventListener('click', () => {
        _sc.view = 'plan'; _scRender();
    });

    // Старт — показать захардкоренный план мгновенно
    document.getElementById('scStartBtn')?.addEventListener('click', () => {
        const custom = (document.getElementById('scCustomInput')?.value || '').trim();
        if (custom) {
            _sc.skillId   = 'custom';
            _sc.skillName = custom;
            _sc.skillDesc = 'персональный навык пользователя';
        }
        if (!_sc.skillId || !_sc.skillName) {
            _scToast('Выберите навык или введите свой', 'error'); return;
        }

        _sc.plan      = _scLocalPlan();
        _sc.daysDone  = [];
        _sc.startDate = new Date().toISOString();
        _scSave();
        _sc.view = 'plan';
        _scRender();
    });

    // Отметить день
    document.getElementById('scMarkDone')?.addEventListener('click', () => {
        const day = _scCurrentDay();
        if (!_sc.daysDone.includes(day)) {
            _sc.daysDone.push(day);
            _scSave();
            if (day >= 21) _scToast('🏆 Навык сформирован! 21 день пройден.', 'success');
            else _scToast(`✅ День ${day} выполнен!`, 'success');
            _scRender();
        }
    });

    // Клик по дню в календаре
    document.querySelectorAll('.sc-day').forEach(d => {
        d.addEventListener('click', () => {
            const n = parseInt(d.dataset.day);
            if (_sc.daysDone.includes(n)) _sc.daysDone = _sc.daysDone.filter(x=>x!==n);
            else _sc.daysDone.push(n);
            _scSave();
            _scRender();
        });
    });

    // Новый навык (с подтверждением)
    document.getElementById('scResetBtn')?.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:320px;width:100%">
            <div style="font-size:14px;color:var(--text-primary);margin-bottom:6px;font-weight:600">Начать новый навык?</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px">Текущий прогресс будет сброшен.</div>
            <div style="display:flex;gap:10px">
                <button id="cfNo"  style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Нет</button>
                <button id="cfYes" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Да</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#cfNo').onclick  = () => overlay.remove();
        overlay.querySelector('#cfYes').onclick = () => {
            overlay.remove();
            _sc.skillId = _sc.skillName = _sc.skillDesc = _sc.plan = _sc.startDate = null;
            _sc.daysDone = [];
            _sc.view = 'select';
            _scSave();
            _scRender();
        };
    });

    // К тренировке дня
    document.getElementById('scGoTraining')?.addEventListener('click', () => {
        if (typeof showDailyTrainingScreen === 'function') {
            showDailyTrainingScreen();
        } else {
            const s = document.createElement('script');
            s.src = 'daily_training.js';
            s.onload = () => { if (typeof showDailyTrainingScreen==='function') showDailyTrainingScreen(); };
            document.head.appendChild(s);
        }
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showSkillChoiceScreen() {
    _scLoad();
    _sc.view = 'select';
    _scRender();
}

window.showSkillChoiceScreen = showSkillChoiceScreen;
console.log('✅ skill_choice.js v2.1 загружен (захардкоренный план)');
