// ============================================
// habits.js — Привычки (режим КОУЧ)
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _habInjectStyles() {
    if (document.getElementById('hab-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'hab-v2-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .hab-tabs {
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
        .hab-tabs::-webkit-scrollbar { display: none; }
        .hab-tab {
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
            position: relative;
            min-height: 36px;
            touch-action: manipulation;
        }
        .hab-tab.active {
            background: rgba(224,224,224,0.14);
            color: var(--text-primary);
        }
        .hab-badge {
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
            vertical-align: middle;
        }

        /* ===== КАРТОЧКИ ТЕОРИИ ===== */
        .hab-theory-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 18px;
            margin-bottom: 12px;
        }
        .hab-theory-icon { font-size: 30px; margin-bottom: 10px; display: block; }
        .hab-theory-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
        .hab-theory-text { font-size: 13px; line-height: 1.65; color: var(--text-secondary); }
        .hab-theory-text strong { color: var(--chrome); }

        /* ===== ЭЛЕМЕНТЫ ПРИВЫЧЕК ===== */
        .hab-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
            transition: background 0.2s;
        }
        .hab-item:hover { background: rgba(224,224,224,0.07); }
        .hab-item-name { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .hab-item-detail { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
        .hab-item-trigger { color: var(--silver-brushed); }
        .hab-item-old { color: var(--text-secondary); }
        .hab-item-new { color: var(--chrome); }

        /* ===== ПРОГРЕСС ===== */
        .hab-streak {
            font-size: 12px;
            color: var(--chrome);
            font-weight: 600;
        }
        .hab-progress-wrap { margin-top: 10px; }
        .hab-progress-label {
            font-size: 10px;
            color: var(--text-secondary);
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
        }
        .hab-progress-bar {
            height: 4px;
            background: rgba(224,224,224,0.1);
            border-radius: 2px;
            overflow: hidden;
        }
        .hab-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--silver-brushed), var(--chrome));
            border-radius: 2px;
            transition: width 0.4s;
        }

        /* ===== НЕДЕЛЯ ===== */
        .hab-week {
            display: flex;
            gap: 6px;
            margin: 10px 0;
            flex-wrap: wrap;
        }
        .hab-day {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 50%;
            font-size: 10px;
            color: var(--text-secondary);
            font-weight: 600;
        }
        .hab-day.done {
            background: rgba(224,224,224,0.18);
            border-color: rgba(224,224,224,0.3);
            color: var(--chrome);
        }

        /* ===== КНОПКИ ===== */
        .hab-btn {
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
        .hab-btn:active { transform: scale(0.97); }
        .hab-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.28);
            color: var(--text-primary);
        }
        .hab-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.26), rgba(192,192,192,0.16)); }
        .hab-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .hab-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .hab-btn-danger {
            background: rgba(239,68,68,0.08);
            border: 1px solid rgba(239,68,68,0.2);
            color: rgba(239,68,68,0.8);
        }
        .hab-btn-danger:hover { background: rgba(239,68,68,0.14); }
        .hab-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ===== ПУСТО ===== */
        .hab-empty {
            text-align: center;
            padding: 48px 20px;
        }
        .hab-empty-icon { font-size: 48px; margin-bottom: 14px; display: block; }
        .hab-empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .hab-empty-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

        /* ===== ПОЛЕ ВВОДА ===== */
        .hab-textarea, .hab-input {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            outline: none;
            resize: vertical;
            box-sizing: border-box;
            -webkit-appearance: none;
        }
        .hab-textarea:focus, .hab-input:focus { border-color: rgba(224,224,224,0.35); }
        .hab-textarea::placeholder, .hab-input::placeholder { color: var(--text-secondary); }

        /* ===== КАСТОМНЫЙ ДИАЛОГ ===== */
        .hab-dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .hab-dialog {
            background: var(--carbon-fiber, #1a1a1a);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 24px;
            padding: 24px;
            max-width: 380px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
        }
        .hab-dialog-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 16px;
        }
        .hab-dialog-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 6px;
            margin-top: 14px;
        }
        .hab-dialog-hint {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 12px;
            padding: 10px 12px;
            background: rgba(224,224,224,0.04);
            border-radius: 10px;
        }
        .hab-dialog-actions {
            display: flex;
            gap: 10px;
            margin-top: 18px;
        }

        /* ===== ПЛАН ===== */
        .hab-plan-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .hab-plan-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            flex-wrap: wrap;
            gap: 6px;
        }
        .hab-plan-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .hab-plan-days { font-size: 11px; color: var(--text-secondary); }

        /* ===== СЕКЦИЯ-ЛЕЙБЛ ===== */
        .hab-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }

        /* ===== TIP ===== */
        .hab-tip {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 16px;
        }
        .hab-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .hab-tab { padding: 7px 10px; font-size: 10px; }
            .hab-btn { font-size: 11px; padding: 7px 12px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА ПРИВЫЧЕК
// ============================================
const HAB_DB = {
    СБ: {
        common: [
            { name:'Избегание конфликтов',           trigger:'Конфликтная ситуация',      reaction:'Молчу или соглашаюсь' },
            { name:'Прокрастинация важных разговоров',trigger:'Нужно сказать «нет»',       reaction:'Откладываю, придумываю оправдания' },
            { name:'Замирание под давлением',         trigger:'Критика или давление',      reaction:'Теряюсь, не могу ответить' }
        ],
        recommended: [
            { name:'Ежедневное «маленькое нет»',  trigger:'Просьба, которая неудобна',    old:'Соглашаюсь',           new:'Говорю «нет, спасибо»' },
            { name:'Пауза перед ответом',          trigger:'Вопрос или просьба',           old:'Отвечаю сразу',        new:'Беру паузу 3 секунды' },
            { name:'Проговаривание дискомфорта',   trigger:'Чувствую дискомфорт',          old:'Терплю молча',         new:'Говорю о своих чувствах' }
        ]
    },
    ТФ: {
        common: [
            { name:'Импульсивные траты',                    trigger:'Стресс или скука',         reaction:'Покупаю ненужное' },
            { name:'Избегание финансового планирования',    trigger:'Мысли о деньгах',          reaction:'Отвлекаюсь, откладываю' },
            { name:'Чувство вины за траты',                 trigger:'Покупка для себя',          reaction:'Испытываю вину, сомневаюсь' }
        ],
        recommended: [
            { name:'Правило 24 часов',      trigger:'Хочу купить незапланированное',    old:'Покупаю сразу',            new:'Жду 24 часа' },
            { name:'Финансовый трекер',     trigger:'Получение дохода или трата',       old:'Не отслеживаю',            new:'Записываю в трекер' },
            { name:'Откладываю 10%',        trigger:'Получение дохода',                 old:'Трачу всё',                new:'Сразу откладываю 10%' }
        ]
    },
    УБ: {
        common: [
            { name:'Зависание в размышлениях',         trigger:'Сложная задача',        reaction:'Долго думаю, не начинаю' },
            { name:'Прокрастинация',                   trigger:'Неприятная задача',     reaction:'Откладываю на потом' },
            { name:'Поиск идеального решения',         trigger:'Нужно выбрать',         reaction:'Зависаю в анализе' }
        ],
        recommended: [
            { name:'Правило 5 минут',       trigger:'Не хочется начинать',      old:'Откладываю',                   new:'Делаю ровно 5 минут' },
            { name:'Микро-шаги',            trigger:'Большая задача',           old:'Паралич анализа',              new:'Делю на шаги по 15 минут' },
            { name:'Одно действие с утра',  trigger:'Начало дня',               old:'Планирую, но не делаю',        new:'Одно конкретное действие сразу' }
        ]
    },
    ЧВ: {
        common: [
            { name:'Проверка соцсетей',            trigger:'Скука или тревога',      reaction:'Открываю ленту' },
            { name:'Подстройка под других',         trigger:'Разное мнение',          reaction:'Соглашаюсь, даже если нет' },
            { name:'Потребность в одобрении',       trigger:'Сделал что-то',          reaction:'Жду реакции других' }
        ],
        recommended: [
            { name:'Цифровой детокс-час',       trigger:'Вечернее время',               old:'Листаю ленту',          new:'Читаю книгу или слушаю музыку' },
            { name:'Время для себя',            trigger:'Чувство усталости',            old:'Продолжаю общаться',    new:'15 минут наедине с собой' },
            { name:'Своё мнение вслух',         trigger:'Не согласен с мнением',        old:'Молчу',                 new:'Мягко выражаю свою точку зрения' }
        ]
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._habState) window._habState = {
    tab: 'theory',
    vectors: { СБ:4, ТФ:4, УБ:4, ЧВ:4 },
    habits: [],
    streak: {}
};
const _hab = window._habState;

// ============================================
// УТИЛИТЫ
// ============================================
function _habToast(msg, type) { if (window.showToast) window.showToast(msg, type||'info'); }
function _habHome() { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _habApi()  { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _habUid()  { return window.CONFIG?.USER_ID; }
function _habSave() {
    try {
        localStorage.setItem('hab_habits_' + _habUid(), JSON.stringify(_hab.habits));
        localStorage.setItem('hab_streak_' + _habUid(), JSON.stringify(_hab.streak));
    } catch {}
}
function _habLoad() {
    try {
        const h = localStorage.getItem('hab_habits_' + _habUid());
        const s = localStorage.getItem('hab_streak_' + _habUid());
        if (h) _hab.habits = JSON.parse(h);
        if (s) _hab.streak = JSON.parse(s);
    } catch {}
}
function _habWeakVector() {
    return Object.entries(_hab.vectors).sort((a,b)=>a[1]-b[1])[0]?.[0] || 'ЧВ';
}

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _habLoadVectors() {
    try {
        const r = await fetch(`${_habApi()}/api/get-profile/${_habUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        _hab.vectors = { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch {}
}

// ============================================
// ДИАЛОГ — универсальный (вместо prompt/confirm)
// ============================================
function _habDialog(config) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'hab-dialog-overlay';

        const fieldsHtml = (config.fields || []).map(f => `
            <div class="hab-dialog-label">${f.label}</div>
            ${f.type === 'textarea'
                ? `<textarea class="hab-textarea" id="habf_${f.id}" placeholder="${f.placeholder||''}" rows="${f.rows||2}"></textarea>`
                : `<input class="hab-input" id="habf_${f.id}" placeholder="${f.placeholder||''}" type="text">`
            }`).join('');

        const hintHtml = config.hint ? `<div class="hab-dialog-hint">💡 ${config.hint}</div>` : '';

        overlay.innerHTML = `
            <div class="hab-dialog">
                <div class="hab-dialog-title">${config.title}</div>
                ${config.subtitle ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">${config.subtitle}</div>` : ''}
                ${fieldsHtml}
                ${hintHtml}
                <div class="hab-dialog-actions">
                    <button class="hab-btn hab-btn-ghost" id="habDlgCancel" style="flex:1">Отмена</button>
                    <button class="hab-btn hab-btn-primary" id="habDlgOk" style="flex:1">${config.okText||'Сохранить'}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        const firstInput = overlay.querySelector('textarea, input');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);

        overlay.querySelector('#habDlgCancel').onclick = () => { overlay.remove(); resolve(null); };
        overlay.querySelector('#habDlgOk').onclick = () => {
            const result = {};
            (config.fields||[]).forEach(f => {
                result[f.id] = (overlay.querySelector('#habf_'+f.id)?.value||'').trim();
            });
            const empty = (config.fields||[]).find(f => f.required && !result[f.id]);
            if (empty) { _habToast('Заполните все обязательные поля', 'error'); return; }
            overlay.remove();
            resolve(result);
        };
    });
}

function _habConfirm(text) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'hab-dialog-overlay';
        overlay.innerHTML = `
            <div class="hab-dialog">
                <div class="hab-dialog-title" style="font-size:14px;font-weight:500;margin-bottom:20px">${text}</div>
                <div class="hab-dialog-actions">
                    <button class="hab-btn hab-btn-ghost" id="habCfNo" style="flex:1">Нет</button>
                    <button class="hab-btn hab-btn-primary" id="habCfYes" style="flex:1">Да</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#habCfNo').onclick  = () => { overlay.remove(); resolve(false); };
        overlay.querySelector('#habCfYes').onclick = () => { overlay.remove(); resolve(true); };
    });
}

// ============================================
// РЕНДЕР ГЛАВНОГО ЭКРАНА
// ============================================
function _habRender() {
    _habInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const weak = _habWeakVector();
    const db   = HAB_DB[weak] || HAB_DB.ЧВ;

    const TABS = [
        { id:'theory',   label:'🧠 Теория' },
        { id:'analyze',  label:'🔍 Анализ' },
        { id:'my',       label:'✏️ Мои' + (_hab.habits.length ? ` <span class="hab-badge">${_hab.habits.length}</span>` : '') },
        { id:'plan',     label:'🌱 План' },
        { id:'menu',     label:'📋 Меню' }
    ];

    const tabsHtml = TABS.map(t => `
        <button class="hab-tab${_hab.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>
    `).join('');

    let body = '';
    if      (_hab.tab === 'theory')  body = _habTheory();
    else if (_hab.tab === 'analyze') body = _habAnalyze(db, weak);
    else if (_hab.tab === 'my')      body = _habMy();
    else if (_hab.tab === 'plan')    body = _habPlan();
    else if (_hab.tab === 'menu')    body = _habMenu(db, weak);

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="habBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1 class="content-title">Привычки</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Триггер → Реакция → Новая привычка</p>
            </div>
            <div class="hab-tabs">${tabsHtml}</div>
            <div id="habBody">${body}</div>
        </div>`;

    document.getElementById('habBack').onclick = () => _habHome();
    document.querySelectorAll('.hab-tab').forEach(btn => {
        btn.addEventListener('click', () => { _hab.tab = btn.dataset.tab; _habRender(); });
    });
    _habBindHandlers(db);
}

// ============================================
// ВКЛАДКА: ТЕОРИЯ
// ============================================
function _habTheory() {
    return `
        <div class="hab-theory-card">
            <span class="hab-theory-icon">🧠</span>
            <div class="hab-theory-title">Почему привычки нельзя просто отменить</div>
            <div class="hab-theory-text">
                Привычка — это нейронная связь. Она не исчезает, потому что мозг автоматизирует повторяющиеся действия, экономя энергию. Старая связь не удаляется — она <strong>зарастает новой</strong>.
                <br><br>
                Поэтому бесполезно говорить себе «перестань». Нужно <strong>заменить реакцию</strong> на тот же триггер.
            </div>
        </div>

        <div class="hab-theory-card">
            <span class="hab-theory-icon">🔄</span>
            <div class="hab-theory-title">Схема изменения</div>
            <div class="hab-theory-text">
                <strong>ТРИГГЕР</strong> — то, что запускает привычку<br>
                <em style="color:var(--text-secondary)">«Вижу уведомление»</em>
                <br><br>↓<br><br>
                <strong>СТАРАЯ РЕАКЦИЯ</strong> — автоматическое действие<br>
                <em style="color:var(--text-secondary)">«Открываю ленту»</em>
                <br><br>↓<br><br>
                <strong>НОВАЯ РЕАКЦИЯ</strong> — осознанный выбор<br>
                <em style="color:var(--text-secondary)">«Делаю 3 глубоких вдоха»</em>
            </div>
        </div>

        <div class="hab-theory-card">
            <span class="hab-theory-icon">💡</span>
            <div class="hab-theory-title">Золотое правило</div>
            <div class="hab-theory-text">
                <strong>Не меняйте привычку — замените реакцию на триггер.</strong>
                <br><br>
                Найдите триггер → подготовьте новую реакцию → практикуйте 21 день подряд.
                <br><br>
                Пропуск одного дня допустим. Пропуск двух — начинайте сначала.
            </div>
        </div>`;
}

// ============================================
// ВКЛАДКА: АНАЛИЗ (типичные привычки по профилю)
// ============================================
function _habAnalyze(db, weak) {
    const VEC_NAMES = { СБ:'уверенность и границы', ТФ:'финансы и ресурсы', УБ:'смыслы и системность', ЧВ:'отношения' };
    const items = db.common.map(h => `
        <div class="hab-item">
            <div class="hab-item-name">${h.name}</div>
            <div class="hab-item-detail">
                <div class="hab-item-trigger">🎯 Триггер: ${h.trigger}</div>
                <div class="hab-item-old">⚡ Реакция: ${h.reaction}</div>
            </div>
            <div class="hab-actions">
                <button class="hab-btn hab-btn-primary hab-work-btn"
                    data-name="${h.name}" data-trigger="${h.trigger}" data-old="${h.reaction}">
                    ✏️ Проработать
                </button>
            </div>
        </div>`).join('');

    return `
        <div class="hab-section-label">🧬 Профиль · ${weak} · ${VEC_NAMES[weak]||''}</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
            Привычки, которые часто встречаются при вашем психотипе. Выберите ту, которую хотите изменить.
        </p>
        ${items}`;
}

// ============================================
// ВКЛАДКА: МОИ ПРИВЫЧКИ
// ============================================
function _habMy() {
    if (!_hab.habits.length) return `
        <div class="hab-empty">
            <span class="hab-empty-icon">📭</span>
            <div class="hab-empty-title">Нет активных привычек</div>
            <div class="hab-empty-desc">Перейдите во вкладку «Анализ» или «Меню» и добавьте первую привычку</div>
        </div>`;

    const total = _hab.habits.reduce((s,h) => s + (_hab.streak[h.id]||0), 0);
    const items = _hab.habits.map((h,i) => {
        const str  = _hab.streak[h.id] || 0;
        const pct  = Math.min(100, Math.round((str/21)*100));
        return `
        <div class="hab-item">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
                <div class="hab-item-name" style="flex:1">${h.name}</div>
                <div class="hab-streak">🔥 ${str}/21</div>
            </div>
            <div class="hab-item-detail">
                <div class="hab-item-trigger">🎯 ${h.trigger}</div>
                <div class="hab-item-old">❌ ${h.old}</div>
                <div class="hab-item-new">✅ ${h.new}</div>
            </div>
            <div class="hab-progress-wrap">
                <div class="hab-progress-label">
                    <span>Прогресс</span><span>${pct}%</span>
                </div>
                <div class="hab-progress-bar">
                    <div class="hab-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
            <div class="hab-actions" style="margin-top:10px">
                <button class="hab-btn hab-btn-primary hab-mark-btn" data-idx="${i}">✅ Выполнил</button>
                <button class="hab-btn hab-btn-danger hab-del-btn" data-idx="${i}">🗑 Удалить</button>
            </div>
        </div>`; }).join('');

    return `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;color:var(--text-secondary)">
            <span>Активных: <strong style="color:var(--chrome)">${_hab.habits.length}</strong></span>
            <span>Всего дней: <strong style="color:var(--chrome)">🔥 ${total}</strong></span>
        </div>
        ${items}`;
}

// ============================================
// ВКЛАДКА: ПЛАН
// ============================================
function _habPlan() {
    if (!_hab.habits.length) return `
        <div class="hab-empty">
            <span class="hab-empty-icon">🌱</span>
            <div class="hab-empty-title">Нет активных привычек</div>
            <div class="hab-empty-desc">Добавьте привычку во вкладке «Анализ» или «Меню»</div>
        </div>`;

    const DAYS = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
    const today = (new Date().getDay() + 6) % 7; // 0=ПН

    const cards = _hab.habits.map(h => {
        const str   = _hab.streak[h.id] || 0;
        const left  = Math.max(0, 21 - str);
        const week  = DAYS.map((d,i) => `
            <div class="hab-day${i < today ? ' done' : ''}">${d}</div>`).join('');
        return `
        <div class="hab-plan-card">
            <div class="hab-plan-header">
                <div class="hab-plan-name">${h.name}</div>
                <div class="hab-plan-days">День ${str} · осталось ${left}</div>
            </div>
            <div class="hab-week">${week}</div>
            <div style="font-size:12px;color:var(--text-secondary)">
                🎯 ${h.trigger} → ✅ ${h.new}
            </div>
        </div>`; }).join('');

    return `
        <div class="hab-section-label">📅 21-дневный план внедрения</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
            Привычка становится автоматической после 21 дня регулярного повторения.
        </p>
        ${cards}
        <div class="hab-tip">
            💡 <strong>Не пропускайте больше одного дня подряд</strong> — это сбивает формирование нейронной связи.
        </div>`;
}

// ============================================
// ВКЛАДКА: МЕНЮ (рекомендованные привычки)
// ============================================
function _habMenu(db, weak) {
    const VEC_NAMES = { СБ:'уверенность', ТФ:'финансы', УБ:'смыслы', ЧВ:'отношения' };
    const items = db.recommended.map(h => `
        <div class="hab-item">
            <div class="hab-item-name">🌱 ${h.name}</div>
            <div class="hab-item-detail">
                <div class="hab-item-trigger">🎯 Триггер: ${h.trigger}</div>
                <div class="hab-item-old">❌ Старая: ${h.old}</div>
                <div class="hab-item-new">✅ Новая: ${h.new}</div>
            </div>
            <div class="hab-actions">
                <button class="hab-btn hab-btn-primary hab-add-btn"
                    data-name="${h.name}" data-trigger="${h.trigger}"
                    data-old="${h.old}" data-new="${h.new}">
                    + Добавить
                </button>
            </div>
        </div>`).join('');

    return `
        <div class="hab-section-label">🧬 Рекомендовано · ${weak} · ${VEC_NAMES[weak]||''}</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
            Привычки, которые помогут именно вам. Выберите одну-две и начните.
        </p>
        ${items}

        <div class="hab-section-label" style="margin-top:20px">✏️ Создать свою привычку</div>
        <textarea class="hab-textarea" id="habCustomDesc" rows="2"
            placeholder="Например: «Хочу перестать откладывать дела на потом»"></textarea>
        <div style="margin-top:10px">
            <button class="hab-btn hab-btn-primary" id="habCustomBtn" style="width:100%">
                ➕ Создать привычку
            </button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _habBindHandlers(db) {
    // Кнопки "Проработать" (из анализа)
    document.querySelectorAll('.hab-work-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await _habDialog({
                title: `Проработка: ${btn.dataset.name}`,
                subtitle: `🎯 Триггер: ${btn.dataset.trigger}<br>❌ Старая реакция: ${btn.dataset.old}`,
                fields: [{ id:'new', label:'✅ Что сделаю вместо этого?', type:'textarea', rows:2,
                           placeholder:'Например: «Сделаю 3 вдоха и скажу "нет, спасибо"»', required:true }],
                hint: 'Новая реакция должна быть конкретной и выполнимой прямо сейчас',
                okText: 'Сохранить привычку'
            });
            if (!res) return;
            _habAddHabit(btn.dataset.name, btn.dataset.trigger, btn.dataset.old, res.new);
        });
    });

    // Кнопки "Добавить" (из меню)
    document.querySelectorAll('.hab-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _habAddHabit(btn.dataset.name, btn.dataset.trigger, btn.dataset.old, btn.dataset.new);
        });
    });

    // Кнопка "Выполнил"
    document.querySelectorAll('.hab-mark-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const i     = parseInt(btn.dataset.idx);
            const h     = _hab.habits[i];
            if (!h) return;
            const today = new Date().toDateString();
            const last  = localStorage.getItem('hab_last_' + h.id);
            if (last === today) { _habToast('Уже отмечено сегодня', 'info'); return; }
            _hab.streak[h.id] = (_hab.streak[h.id] || 0) + 1;
            localStorage.setItem('hab_last_' + h.id, today);
            _habSave();
            const str = _hab.streak[h.id];
            if (str >= 21) _habToast(`🎉 Привычка «${h.name}» сформирована!`, 'success');
            else _habToast(`✅ День ${str} из 21`, 'success');
            _habRender();
        });
    });

    // Кнопка "Удалить"
    document.querySelectorAll('.hab-del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const i = parseInt(btn.dataset.idx);
            const h = _hab.habits[i];
            if (!h) return;
            const ok = await _habConfirm(`Удалить привычку «${h.name}»?`);
            if (!ok) return;
            _hab.habits.splice(i, 1);
            _habSave();
            _habToast('Привычка удалена');
            _habRender();
        });
    });

    // Кнопка "Создать свою"
    document.getElementById('habCustomBtn')?.addEventListener('click', async () => {
        const desc = (document.getElementById('habCustomDesc')?.value || '').trim();
        if (!desc) { _habToast('Опишите привычку', 'error'); return; }
        const res = await _habDialog({
            title: 'Создание привычки',
            subtitle: desc,
            fields: [
                { id:'trigger', label:'🎯 Что запускает эту привычку?', type:'input', placeholder:'Например: «Чувствую скуку»', required:true },
                { id:'old',     label:'❌ Что делаете сейчас?',          type:'input', placeholder:'Например: «Открываю соцсети»', required:true },
                { id:'new',     label:'✅ Что будете делать вместо?',    type:'textarea', rows:2, placeholder:'Например: «Делаю 5 приседаний»', required:true }
            ],
            okText: 'Создать'
        });
        if (!res) return;
        const name = desc.length > 50 ? desc.slice(0,50)+'…' : desc;
        _habAddHabit(name, res.trigger, res.old, res.new);
    });
}

function _habAddHabit(name, trigger, old, newR) {
    if (_hab.habits.some(h => h.name === name)) {
        _habToast(`Привычка «${name}» уже добавлена`, 'info');
        return;
    }
    const id = Date.now().toString();
    _hab.habits.push({ id, name, trigger, old, new: newR });
    _hab.streak[id] = 0;
    _habSave();
    _habToast(`✅ «${name}» добавлена`, 'success');
    _hab.tab = 'my';
    _habRender();
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showHabitsScreen() {
    _habLoad();
    _habRender(); // сразу показываем
    await _habLoadVectors();
    _habRender(); // перерисовываем с актуальными векторами
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showHabitsScreen = showHabitsScreen;
console.log('✅ habits.js v2.0 загружен');
