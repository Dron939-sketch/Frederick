// ============================================
// strategy.js — Стратегия (режим КОУЧ)
// Версия 2.0 — единый стиль с проектом
// ============================================

function _strInjectStyles() {
    if (document.getElementById('str-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'str-v2-styles';
    s.textContent = `
        .str-tabs {
            display: flex;
            gap: 4px;
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px;
            padding: 4px;
            margin-bottom: 20px;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .str-tabs::-webkit-scrollbar { display: none; }
        .str-tab {
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
        }
        .str-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* TYPE CARD */
        .str-type-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 20px;
            padding: 22px;
            text-align: center;
            margin-bottom: 20px;
        }
        .str-type-icon  { font-size: 44px; display: block; margin-bottom: 10px; }
        .str-type-name  { font-size: 18px; font-weight: 700; color: var(--chrome); margin-bottom: 6px; }
        .str-type-level { font-size: 11px; color: var(--text-secondary); margin-bottom: 10px; }
        .str-type-desc  { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* SECTION */
        .str-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
            margin-top: 18px;
        }
        .str-list { list-style: none; padding: 0; margin: 0; }
        .str-list li {
            padding: 7px 0;
            font-size: 13px;
            color: var(--text-secondary);
            border-bottom: 1px solid rgba(224,224,224,0.06);
            line-height: 1.5;
        }
        .str-list li:last-child { border-bottom: none; }
        .str-text { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* EMPTY */
        .str-empty { text-align: center; padding: 40px 20px; }
        .str-empty-icon  { font-size: 48px; display: block; margin-bottom: 14px; }
        .str-empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .str-empty-desc  { font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }

        /* INPUTS */
        .str-textarea {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            outline: none;
            box-sizing: border-box;
            margin-bottom: 12px;
            -webkit-appearance: none;
        }
        .str-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .str-textarea::placeholder { color: var(--text-secondary); }

        /* BUTTONS */
        .str-btn {
            padding: 9px 18px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 40px;
            touch-action: manipulation;
            outline: none;
        }
        .str-btn:active { transform: scale(0.97); }
        .str-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            color: var(--text-primary);
            width: 100%;
            padding: 13px;
            border-radius: 40px;
        }
        .str-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.16)); }
        .str-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .str-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .str-btn-danger {
            background: rgba(239,68,68,0.07);
            border: 1px solid rgba(239,68,68,0.2);
            color: rgba(239,68,68,0.8);
        }
        .str-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        /* STRATEGY PLAN */
        .str-plan-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .str-plan-name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
        .str-plan-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
        .str-plan-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--text-secondary); }

        /* STEPS */
        .str-step {
            display: flex;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 8px;
        }
        .str-step.done { opacity: 0.55; }
        .str-step-num {
            width: 28px;
            height: 28px;
            background: rgba(224,224,224,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: var(--chrome);
            flex-shrink: 0;
            margin-top: 1px;
        }
        .str-step-body { flex: 1; min-width: 0; }
        .str-step-title { font-size: 13px; font-weight: 600; margin-bottom: 3px; color: var(--text-primary); }
        .str-step-desc  { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; line-height: 1.5; }
        .str-step-dur   { font-size: 10px; color: var(--text-secondary); margin-bottom: 8px; }

        /* TRAPS */
        .str-trap {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .str-trap-name { font-size: 14px; font-weight: 600; margin-bottom: 5px; color: var(--text-primary); }
        .str-trap-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.5; }
        .str-trap-fix  { font-size: 12px; color: var(--chrome); line-height: 1.5; }

        /* PROGRESS */
        .str-progress-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .str-progress-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px; }
        .str-progress-bar { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
        .str-progress-fill { height: 100%; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); border-radius: 2px; transition: width 0.4s; }
        .str-progress-stats { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }

        .str-track-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 9px 0;
            border-bottom: 1px solid rgba(224,224,224,0.06);
            font-size: 13px;
            color: var(--text-secondary);
        }
        .str-track-item:last-child { border-bottom: none; }
        .str-track-item.done { opacity: 0.5; }
        .str-track-num {
            width: 24px;
            height: 24px;
            background: rgba(224,224,224,0.08);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            flex-shrink: 0;
        }

        /* TIP */
        .str-tip {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 14px;
        }
        .str-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .str-tab { padding: 7px 10px; font-size: 10px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА ТИПОВ МЫШЛЕНИЯ
// ============================================
const STR_TYPES = {
    СБ: {
        name: 'Осторожный стратег', emoji: '🛡️',
        desc: 'Вы тщательно взвешиваете риски. Это помогает избегать ошибок, но иногда парализует.',
        strengths:    ['Видите риски, которые другие упускают', 'Редко принимаете поспешных решений', 'Надёжны и предсказуемы'],
        weaknesses:   ['Можете застревать в анализе вместо действия', 'Склонны к катастрофизации', 'Боитесь ошибиться'],
        decisions:    'Взвешивание всех «за» и «против», консультации с доверенными людьми',
        planning:     'Детальное, с запасными планами и учётом рисков',
        traps: [
            { name:'Анализ-паралич',     desc:'Собираете слишком много данных вместо действия',        fix:'Установите таймер. Идеального плана не существует.' },
            { name:'Катастрофизация',    desc:'Представляете худший сценарий вместо реального',        fix:'Запишите худший, лучший и наиболее вероятный сценарии.' },
            { name:'Синдром самозванца', desc:'Сомневаетесь в своей компетентности',                   fix:'Вспомните 3 прошлых успеха. Вы заслуживаете того, что имеете.' }
        ]
    },
    ТФ: {
        name: 'Прагматик', emoji: '📊',
        desc: 'Вы ориентированы на результат. Быстро считаете выгоду и действуете.',
        strengths:    ['Быстро принимаете решения', 'Фокусируетесь на измеримых результатах', 'Эффективно распределяете ресурсы'],
        weaknesses:   ['Можете недооценивать человеческий фактор', 'Склонны к туннельному видению', 'Иногда жертвуете качеством ради скорости'],
        decisions:    'Анализ выгоды и затрат, приоритет быстрых побед',
        planning:     'По этапам с чёткими KPI и дедлайнами',
        traps: [
            { name:'Туннельное видение',       desc:'Видите только цифры, упуская контекст',      fix:'Сознательно ищите информацию, противоречащую вашей гипотезе.' },
            { name:'Гиперфокус на результате', desc:'Игнорируете процесс и людей',                fix:'Запланируйте время на процесс и на людей.' },
            { name:'Ложная срочность',         desc:'Торопитесь там, где можно подождать',        fix:'Спросите себя: что изменится, если сделаю это завтра?' }
        ]
    },
    УБ: {
        name: 'Системный мыслитель', emoji: '🧠',
        desc: 'Вы видите взаимосвязи и долгосрочные тренды. Строите сложные модели.',
        strengths:    ['Видите системные причины проблем', 'Строите долгосрочные стратегии', 'Находите неочевидные решения'],
        weaknesses:   ['Склонны к переусложнению', 'Можете застревать в анализе', 'Трудно переключаться между задачами'],
        decisions:    'Анализ системных связей, поиск корневых причин',
        planning:     'Многоуровневое, с учётом взаимовлияний',
        traps: [
            { name:'Анализ-паралич',         desc:'Бесконечное исследование вместо действия',    fix:'Правило 80/20: начните с ключевых 20% действий.' },
            { name:'Перфекционизм',           desc:'Ожидание идеального плана',                  fix:'Цель — «хорошо», не «идеально». Идеал — враг готового.' },
            { name:'Сложностная перегрузка',  desc:'Усложняете там, где можно проще',            fix:'Правило Парето: 20% действий дают 80% результата.' }
        ]
    },
    ЧВ: {
        name: 'Интуитивный стратег', emoji: '💕',
        desc: 'Вы чувствуете людей и контекст. Принимаете решения сердцем.',
        strengths:    ['Учитываете человеческий фактор', 'Гибко реагируете на изменения', 'Создаёте доверительные отношения'],
        weaknesses:   ['Можете принимать эмоциональные решения', 'Размываете границы и сроки', 'Трудно говорить «нет»'],
        decisions:    'Интуиция, учёт чувств всех участников',
        planning:     'Гибкое, с возможностью корректировки',
        traps: [
            { name:'Эмоциональное заражение', desc:'Принимаете чужие эмоции за свои',            fix:'Пауза и вопрос: «Это моё чувство или чужое?»' },
            { name:'Созависимость',           desc:'Ставите чужие интересы выше своих',          fix:'Напоминайте себе: чужие чувства — не ваша ответственность.' },
            { name:'Иллюзия контроля',        desc:'Думаете, что можете влиять на всё',          fix:'Сосредоточьтесь на том, что действительно в вашей власти.' }
        ]
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._strState) window._strState = {
    tab: 'thinking',
    vectors: { СБ:4, ТФ:4, УБ:4, ЧВ:4 },
    thinkingLevel: 5,
    strategy: null,
    progress: []
};
const _str = window._strState;

// ============================================
// УТИЛИТЫ
// ============================================
function _strToast(msg, type) { if (window.showToast) window.showToast(msg, type||'info'); }
function _strHome() { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _strApi() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _strUid() { return window.CONFIG?.USER_ID; }
function _strName() { return localStorage.getItem('fredi_user_name') || 'друг'; }
function _strDomType() {
    return Object.entries(_str.vectors).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'УБ';
}
function _strSave() {
    try { localStorage.setItem('str_data_'+_strUid(), JSON.stringify({ strategy:_str.strategy, progress:_str.progress })); } catch {}
}
function _strLoad() {
    try {
        const d = localStorage.getItem('str_data_'+_strUid());
        if (d) { const p = JSON.parse(d); _str.strategy = p.strategy; _str.progress = p.progress||[]; }
    } catch {}
}

// ============================================
// ЗАГРУЗКА ПРОФИЛЯ
// ============================================
async function _strLoadProfile() {
    try {
        const r = await fetch(`${_strApi()}/api/get-profile/${_strUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        _str.vectors = { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
        _str.thinkingLevel = d.profile?.thinking_level || 5;
    } catch {}
}

// ============================================
// AI ГЕНЕРАЦИЯ СТРАТЕГИИ
// ============================================
async function _strGenerate(goal) {
    const type = STR_TYPES[_strDomType()] || STR_TYPES.УБ;
    const v    = _str.vectors;

    try {
        const r = await fetch(`${_strApi()}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: _strUid(),
                prompt: `Ты — Фреди, виртуальный психолог-коуч. Создай персональную стратегию.

Пользователь: ${_strName()}
Тип мышления: ${type.name} — ${type.desc}
Профиль: СБ-${v.СБ} ТФ-${v.ТФ} УБ-${v.УБ} ЧВ-${v.ЧВ}
Уровень мышления: ${_str.thinkingLevel}/9

Цель: "${goal}"

Верни только JSON:
{
  "strategy_name": "короткое название",
  "description": "2-3 предложения об общем подходе",
  "steps": [
    { "number": 1, "title": "название шага", "description": "что конкретно делать", "duration": "срок" }
  ],
  "timeline": "общий срок",
  "success_criteria": "как понять что работает"
}`,
                max_tokens: 1200
            })
        });
        const d = await r.json();
        if (d.success && d.content) {
            const clean = d.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            const parsed = JSON.parse(clean);
            parsed.steps = parsed.steps.map((s,i) => ({ ...s, number: s.number||i+1 }));
            return parsed;
        }
    } catch {}
    return null;
}

// ============================================
// РЕНДЕР
// ============================================
function _strRender() {
    _strInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const type = STR_TYPES[_strDomType()] || STR_TYPES.УБ;
    const TABS = [
        { id:'thinking', label:'🧠 Мышление' },
        { id:'strategy', label:'🎯 Стратегия' },
        { id:'traps',    label:'⚠️ Ловушки' },
        { id:'tracking', label:'📊 Трекинг' }
    ];

    const tabsHtml = TABS.map(t => `
        <button class="str-tab${_str.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>
    `).join('');

    let body = '';
    if      (_str.tab === 'thinking') body = _strThinking(type);
    else if (_str.tab === 'strategy') body = _strStrategy();
    else if (_str.tab === 'traps')    body = _strTraps(type);
    else if (_str.tab === 'tracking') body = _strTracking();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="strBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Стратегия</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Персональный план действий</p>
            </div>
            <div class="str-tabs">${tabsHtml}</div>
            <div id="strBody">${body}</div>
        </div>`;

    document.getElementById('strBack').onclick = () => _strHome();
    document.querySelectorAll('.str-tab').forEach(btn => {
        btn.addEventListener('click', () => { _str.tab = btn.dataset.tab; _strRender(); });
    });
    _strBindHandlers();
}

// ============================================
// ВКЛАДКИ
// ============================================
function _strThinking(type) {
    const str = type.strengths.map(s => `<li>✅ ${s}</li>`).join('');
    const weak = type.weaknesses.map(w => `<li>⚠️ ${w}</li>`).join('');
    return `
        <div class="str-type-card">
            <span class="str-type-icon">${type.emoji}</span>
            <div class="str-type-name">${type.name}</div>
            <div class="str-type-level">Уровень мышления: ${_str.thinkingLevel}/9</div>
            <div class="str-type-desc">${type.desc}</div>
        </div>
        <div class="str-section-label">💪 Сильные стороны</div>
        <ul class="str-list">${str}</ul>
        <div class="str-section-label">📉 Зоны роста</div>
        <ul class="str-list">${weak}</ul>
        <div class="str-section-label">🤔 Как вы принимаете решения</div>
        <div class="str-text">${type.decisions}</div>
        <div class="str-section-label">📋 Стиль планирования</div>
        <div class="str-text" style="margin-bottom:8px">${type.planning}</div>`;
}

function _strStrategy() {
    if (!_str.strategy) return `
        <div class="str-empty">
            <span class="str-empty-icon">🎯</span>
            <div class="str-empty-title">Стратегия не создана</div>
            <div class="str-empty-desc">Опишите вашу цель — Фреди построит персональный план с учётом вашего типа мышления</div>
            <textarea class="str-textarea" id="strGoalInput" rows="3"
                placeholder="Например: «Хочу открыть свой бизнес через 6 месяцев»"></textarea>
            <button class="str-btn str-btn-primary" id="strGenBtn">🎯 Создать стратегию</button>
        </div>`;

    const s   = _str.strategy;
    const tot = s.steps.length;
    const don = _str.progress.length;

    const stepsHtml = s.steps.map(step => {
        const done = _str.progress.includes(step.number);
        return `
        <div class="str-step${done?' done':''}">
            <div class="str-step-num">${done ? '✓' : step.number}</div>
            <div class="str-step-body">
                <div class="str-step-title">${step.title}</div>
                <div class="str-step-desc">${step.description}</div>
                <div class="str-step-dur">⏱ ${step.duration}</div>
                ${done
                    ? '<span style="font-size:11px;color:var(--text-secondary)">Выполнено</span>'
                    : `<button class="str-btn str-btn-ghost" style="font-size:11px;padding:5px 12px;min-height:32px" data-step="${step.number}">📌 Отметить</button>`
                }
            </div>
        </div>`;
    }).join('');

    return `
        <div class="str-progress-card">
            <div class="str-progress-label">Прогресс</div>
            <div class="str-progress-bar">
                <div class="str-progress-fill" style="width:${Math.round((don/tot)*100)}%"></div>
            </div>
            <div class="str-progress-stats">
                <span>✅ ${don}/${tot} шагов</span>
                <span>${Math.round((don/tot)*100)}%</span>
            </div>
        </div>
        <div class="str-plan-card">
            <div class="str-plan-name">🎯 ${s.strategy_name}</div>
            <div class="str-plan-desc">${s.description}</div>
            <div class="str-plan-meta">
                <span>📅 ${s.timeline}</span>
                <span>🏆 ${s.success_criteria}</span>
            </div>
        </div>
        <div class="str-section-label">📋 План действий</div>
        ${stepsHtml}
        <div class="str-btn-row" style="margin-top:14px">
            <button class="str-btn str-btn-ghost" id="strNewBtn">🔄 Новая цель</button>
            <button class="str-btn str-btn-ghost" id="strCopyBtn">📋 Скопировать</button>
        </div>`;
}

function _strTraps(type) {
    const items = type.traps.map(t => `
        <div class="str-trap">
            <div class="str-trap-name">⚠️ ${t.name}</div>
            <div class="str-trap-desc">${t.desc}</div>
            <div class="str-trap-fix">💡 ${t.fix}</div>
        </div>`).join('');

    return `
        <div class="str-tip" style="margin-bottom:16px">
            🧠 Когнитивные ловушки — автоматические ошибки мышления, <strong>свойственные вашему типу</strong>. Осознание — первый шаг к преодолению.
        </div>
        ${items}
        <div class="str-tip">
            <strong>Универсальный приём:</strong> когда замечаете ловушку — сделайте паузу и спросите: «Это факты или мои предположения?»
        </div>`;
}

function _strTracking() {
    if (!_str.strategy) return `
        <div class="str-empty">
            <span class="str-empty-icon">📊</span>
            <div class="str-empty-title">Нет активной стратегии</div>
            <div class="str-empty-desc">Создайте стратегию во вкладке «Стратегия»</div>
        </div>`;

    const tot = _str.strategy.steps.length;
    const don = _str.progress.length;
    const items = _str.strategy.steps.map(step => {
        const done = _str.progress.includes(step.number);
        return `
        <div class="str-track-item${done?' done':''}">
            <div class="str-track-num">${done ? '✓' : step.number}</div>
            <span style="flex:1">${step.title}</span>
            <span>${done ? '✅' : '⏳'}</span>
        </div>`;
    }).join('');

    return `
        <div class="str-progress-card">
            <div class="str-progress-label">Общий прогресс</div>
            <div class="str-progress-bar">
                <div class="str-progress-fill" style="width:${Math.round((don/tot)*100)}%"></div>
            </div>
            <div class="str-progress-stats">
                <span>✅ ${don} из ${tot} шагов</span>
                <span>${Math.round((don/tot)*100)}%</span>
            </div>
        </div>
        <div class="str-section-label">Пошаговый прогресс</div>
        <div>${items}</div>
        <div style="margin-top:14px">
            <button class="str-btn str-btn-danger" id="strResetBtn" style="width:100%;border-radius:40px;padding:12px">
                🔄 Сбросить прогресс
            </button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _strBindHandlers() {
    // Генерация
    document.getElementById('strGenBtn')?.addEventListener('click', async () => {
        const val = (document.getElementById('strGoalInput')?.value || '').trim();
        if (!val) { _strToast('Опишите вашу цель', 'error'); return; }
        const btn = document.getElementById('strGenBtn');
        if (btn) { btn.textContent = '⏳ Строю стратегию...'; btn.disabled = true; }
        _strToast('Фреди анализирует ваш профиль...', 'info');
        const result = await _strGenerate(val);
        if (result) {
            _str.strategy = result;
            _str.progress = [];
            _strSave();
            _strToast('✅ Стратегия готова!', 'success');
            _str.tab = 'strategy';
            _strRender();
        } else {
            _strToast('Не удалось создать стратегию. Попробуйте позже.', 'error');
            if (btn) { btn.textContent = '🎯 Создать стратегию'; btn.disabled = false; }
        }
    });

    // Отметка шага
    document.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            const n = parseInt(btn.dataset.step);
            if (!_str.progress.includes(n)) {
                _str.progress.push(n);
                _strSave();
                _strToast(`✅ Шаг ${n} выполнен!`, 'success');
                _strRender();
            }
        });
    });

    // Новая цель
    document.getElementById('strNewBtn')?.addEventListener('click', () => {
        _str.strategy = null;
        _str.progress = [];
        _strSave();
        _strRender();
    });

    // Копировать
    document.getElementById('strCopyBtn')?.addEventListener('click', () => {
        if (!_str.strategy) return;
        const s = _str.strategy;
        let txt = `🎯 ${s.strategy_name}\n\n${s.description}\n\n📅 ${s.timeline}\n🏆 ${s.success_criteria}\n\n`;
        s.steps.forEach(step => {
            const done = _str.progress.includes(step.number);
            txt += `${done?'✅':'⏳'} Шаг ${step.number}: ${step.title}\n${step.description}\n⏱ ${step.duration}\n\n`;
        });
        copyToClipboard(txt)
            .then(() => _strToast('📋 Стратегия скопирована', 'success'))
            .catch(() => _strToast('Не удалось скопировать'));
    });

    // Сброс
    document.getElementById('strResetBtn')?.addEventListener('click', async () => {
        // Кастомный confirm
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:320px;width:100%">
            <div style="font-size:14px;color:var(--text-primary);margin-bottom:20px">Сбросить прогресс стратегии?</div>
            <div style="display:flex;gap:10px">
                <button id="strCfNo" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Нет</button>
                <button id="strCfYes" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Да</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#strCfNo').onclick  = () => overlay.remove();
        overlay.querySelector('#strCfYes').onclick = () => {
            overlay.remove();
            _str.progress = [];
            _strSave();
            _strToast('Прогресс сброшен');
            _strRender();
        };
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showStrategyScreen() {
    _strLoad();
    _strRender(); // мгновенно
    await _strLoadProfile();
    _strRender(); // с актуальными данными
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showStrategyScreen = showStrategyScreen;
console.log('✅ strategy.js v2.0 загружен');
