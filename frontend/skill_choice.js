// ============================================
// skill_choice.js — Выбор навыка + AI-план
// Версия 2.0 — AI генерирует 21-дневный план
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

        .sc-generating {
            text-align: center;
            padding: 40px 20px;
        }
        .sc-generating-icon { font-size: 48px; display: block; margin-bottom: 14px; animation: sc-pulse 1.5s ease-in-out infinite; }
        @keyframes sc-pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        .sc-generating-text { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
        .sc-generating-sub  { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

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
// СОСТОЯНИЕ
// ============================================
if (!window._scState) window._scState = {
    view:      'select',  // 'select' | 'generating' | 'plan'
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
// ЗАГРУЗКА ПРОФИЛЯ
// ============================================
async function _scGetProfile() {
    try {
        const r = await fetch(`${_scApi()}/api/get-profile/${_scUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        return {
            vectors: { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) },
            type:    d.profile?.perception_type || '',
            level:   d.profile?.thinking_level  || 5
        };
    } catch { return { vectors:{СБ:4,ТФ:4,УБ:4,ЧВ:4}, type:'', level:5 }; }
}

// ============================================
// AI ГЕНЕРАЦИЯ 21-ДНЕВНОГО ПЛАНА
// ============================================
async function _scGeneratePlan(skillName, skillDesc, profile) {
    const v = profile.vectors;
    const prompt = `Ты — Фреди, психолог-тренер. Создай персональный 21-дневный план развития навыка.

Пользователь: ${_scName()}
Навык: "${skillName}" — ${skillDesc}
Психологический профиль: СБ-${v.СБ} ТФ-${v.ТФ} УБ-${v.УБ} ЧВ-${v.ЧВ}
Уровень мышления: ${profile.level}/9

Требования:
— 21 упражнение (по одному на день), разбить на 3 недели
— Каждая неделя — своя тема (нарастающая сложность)
— Упражнения конкретные: что делать, как долго, как именно
— Учитывай профиль: для СБ — больше безопасности и опоры, для ТФ — результаты и цифры, для УБ — смыслы и системность, для ЧВ — отношения и эмоции
— Каждое упражнение: 1-15 минут, выполнимо в обычный день

Верни только JSON:
{
  "weeks": [
    {
      "theme": "название темы недели",
      "exercises": [
        { "day": 1, "task": "короткое название задания", "dur": "время", "inst": "подробная инструкция как выполнять" },
        ...7 упражнений...
      ]
    },
    { вторая неделя },
    { третья неделя }
  ]
}`;

    try {
        const r = await fetch(`${_scApi()}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: _scUid(),
                prompt,
                max_tokens: 2000
            })
        });
        const d = await r.json();
        if (d.success && d.content) {
            const clean = d.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            const parsed = JSON.parse(clean);
            // Нумерация дней
            let dayNum = 0;
            parsed.weeks.forEach(week => {
                week.exercises.forEach(ex => {
                    dayNum++;
                    ex.day = dayNum;
                });
            });
            return parsed;
        }
    } catch(e) { console.error('Plan generation error:', e); }
    return null;
}

// ============================================
// РЕНДЕР
// ============================================
function _scRender() {
    _scInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '';
    if (_sc.view === 'select')     body = _scRenderSelect();
    if (_sc.view === 'generating') body = _scRenderGenerating();
    if (_sc.view === 'plan')       body = _scRenderPlan();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="scBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Выбор навыка</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">AI строит план под ваш профиль</p>
            </div>
            <div id="scBody">${body}</div>
        </div>`;

    document.getElementById('scBack').onclick = () => {
        if (_sc.view === 'plan')       { _sc.view = 'select'; _scRender(); return; }
        if (_sc.view === 'generating') return; // нельзя прервать
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
            🤖 Создать AI-план на 21 день
        </button>
        <div class="sc-tip">
            💡 AI учтёт ваш психологический профиль и построит план с нарастающей сложностью. Займёт 15–30 секунд.
        </div>`;
}

// ===== ЭКРАН ГЕНЕРАЦИИ =====
function _scRenderGenerating() {
    return `
        <div class="sc-generating">
            <span class="sc-generating-icon">🤖</span>
            <div class="sc-generating-text">Фреди строит план</div>
            <div class="sc-generating-sub">
                Анализирую профиль и подбираю упражнения под вас...<br>
                <strong>${_sc.skillName}</strong>
            </div>
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

    // Старт
    document.getElementById('scStartBtn')?.addEventListener('click', async () => {
        const custom = (document.getElementById('scCustomInput')?.value || '').trim();
        if (custom) {
            _sc.skillId   = 'custom';
            _sc.skillName = custom;
            _sc.skillDesc = 'персональный навык пользователя';
        }
        if (!_sc.skillId || !_sc.skillName) {
            _scToast('Выберите навык или введите свой', 'error'); return;
        }

        _sc.view = 'generating';
        _scRender();

        const profile = await _scGetProfile();
        const plan    = await _scGeneratePlan(_sc.skillName, _sc.skillDesc || '', profile);

        if (plan) {
            _sc.plan      = plan;
            _sc.daysDone  = [];
            _sc.startDate = new Date().toISOString();
            _scSave();
            _sc.view = 'plan';
            _scToast('✅ План готов!', 'success');
        } else {
            _scToast('Не удалось создать план. Попробуйте позже.', 'error');
            _sc.view = 'select';
        }
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
console.log('✅ skill_choice.js v2.0 загружен');
