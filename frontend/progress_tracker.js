// ============================================
// progress_tracker.js — Прогресс и рефлексия
// Версия 1.0 — Режим ТРЕНЕР
// ============================================

function _ptInjectStyles() {
    if (document.getElementById('pt-v1-styles')) return;
    const s = document.createElement('style');
    s.id = 'pt-v1-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .pt-tabs {
            display: flex; gap: 4px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px; margin-bottom: 20px;
            overflow-x: auto; scrollbar-width: none;
        }
        .pt-tabs::-webkit-scrollbar { display: none; }
        .pt-tab {
            flex-shrink: 0; padding: 8px 16px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s; white-space: nowrap;
            min-height: 36px; touch-action: manipulation;
        }
        .pt-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* ===== КАРТОЧКА НАВЫКА ===== */
        .pt-skill-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 20px; padding: 18px; margin-bottom: 20px;
        }
        .pt-skill-name { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .pt-skill-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; }
        .pt-progress-bar { height: 6px; background: rgba(224,224,224,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
        .pt-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); transition: width 0.5s; }
        .pt-progress-stats { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }

        /* ===== СТРЕЙК СЕТКА ===== */
        .pt-grid {
            display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 20px;
        }
        .pt-grid-cell {
            aspect-ratio: 1; border-radius: 8px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.08);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px; min-height: 36px;
        }
        .pt-grid-cell.done    { background: rgba(224,224,224,0.16); border-color: rgba(224,224,224,0.3); }
        .pt-grid-cell.current { border-color: rgba(224,224,224,0.5); }
        .pt-grid-num  { font-size: 10px; font-weight: 700; color: var(--text-secondary); }
        .pt-grid-dot  { width: 6px; height: 6px; border-radius: 50%; background: rgba(224,224,224,0.15); }
        .pt-grid-cell.done .pt-grid-dot { background: var(--chrome); }

        /* ===== НЕДЕЛИ ===== */
        .pt-week-block { margin-bottom: 18px; }
        .pt-week-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 8px;
        }
        .pt-week-row { display: flex; gap: 4px; }
        .pt-week-day {
            flex: 1; height: 28px; border-radius: 6px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.08);
            display: flex; align-items: center; justify-content: center;
            font-size: 9px; font-weight: 700; color: var(--text-secondary);
            transition: background 0.2s;
        }
        .pt-week-day.done    { background: rgba(224,224,224,0.16); color: var(--chrome); border-color: rgba(224,224,224,0.25); }
        .pt-week-day.current { border-color: rgba(224,224,224,0.45); color: var(--chrome); }
        .pt-week-day.missed  { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.15); }

        /* ===== РЕФЛЕКСИИ ===== */
        .pt-refl-item {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px; padding: 14px; margin-bottom: 10px;
        }
        .pt-refl-date  { font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; }
        .pt-refl-text  { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        .pt-refl-form {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; margin-bottom: 14px;
        }
        .pt-refl-form-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 500; }
        .pt-textarea {
            width: 100%; background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18);
            border-radius: 12px; padding: 11px 14px; color: var(--text-primary);
            font-family: inherit; font-size: 14px; outline: none; resize: vertical;
            box-sizing: border-box; -webkit-appearance: none; min-height: 80px;
        }
        .pt-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .pt-textarea::placeholder { color: var(--text-secondary); }

        /* ===== СТАТИСТИКА ===== */
        .pt-stats-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;
        }
        .pt-stat-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; text-align: center;
        }
        .pt-stat-value { font-size: 28px; font-weight: 700; color: var(--chrome); margin-bottom: 4px; }
        .pt-stat-label { font-size: 11px; color: var(--text-secondary); line-height: 1.3; }

        .pt-insight-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; margin-bottom: 10px;
        }
        .pt-insight-title { font-size: 13px; font-weight: 600; color: var(--chrome); margin-bottom: 5px; }
        .pt-insight-text  { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

        /* ===== ПУСТО ===== */
        .pt-empty { text-align: center; padding: 40px 20px; }
        .pt-empty-icon  { font-size: 44px; display: block; margin-bottom: 12px; }
        .pt-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .pt-empty-desc  { font-size: 12px; color: var(--text-secondary); margin-bottom: 18px; line-height: 1.5; }

        /* ===== КНОПКИ ===== */
        .pt-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .pt-btn:active { transform: scale(0.97); }
        .pt-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .pt-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .pt-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .pt-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .pt-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .pt-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .pt-tip strong { color: var(--chrome); }

        /* ===== КАРТА РОСТА (transitions) ===== */
        .pt-nodes {
            display: flex; flex-direction: column; gap: 12px;
        }
        .pt-node {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.10);
            border-radius: 16px; padding: 14px 16px;
            transition: border-color 0.2s ease, background 0.2s ease;
        }
        .pt-node-done {
            background: rgba(255,140,0,0.06);
            border-color: rgba(255,140,0,0.30);
        }
        .pt-node-in-progress {
            background: rgba(224,224,224,0.06);
            border-color: rgba(224,224,224,0.22);
        }
        .pt-node-next {
            box-shadow: 0 0 0 1px rgba(255,140,0,0.40);
        }
        .pt-node-header {
            display: flex; gap: 12px; align-items: flex-start;
            margin-bottom: 8px;
        }
        .pt-node-num {
            flex: 0 0 28px;
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(224,224,224,0.10);
            color: var(--text-primary);
            font-size: 12px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
        }
        .pt-node-done .pt-node-num {
            background: rgba(255,140,0,0.35); color: #fff;
        }
        .pt-node-title-wrap { flex: 1; min-width: 0; }
        .pt-node-title {
            font-size: 14px; font-weight: 600; color: var(--text-primary);
            line-height: 1.35;
        }
        .pt-node-status {
            font-size: 11px; color: var(--text-secondary);
            margin-top: 2px; letter-spacing: 0.2px;
        }
        .pt-node-explain {
            font-size: 13px; color: var(--text-secondary);
            line-height: 1.6; margin-top: 4px;
        }
        .pt-node-days {
            display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
        }
        .pt-node-day {
            font-size: 11px; font-weight: 600;
            min-width: 24px; height: 22px; padding: 0 6px; border-radius: 11px;
            display: inline-flex; align-items: center; justify-content: center;
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.12);
            color: var(--text-secondary);
        }
        .pt-node-day.done {
            background: rgba(255,140,0,0.20);
            border-color: rgba(255,140,0,0.45);
            color: var(--text-primary);
        }
        [data-theme="light"] .pt-node-done {
            background: rgba(255,140,0,0.10);
            border-color: rgba(255,140,0,0.45);
        }
        [data-theme="light"] .pt-node-day.done {
            background: rgba(255,140,0,0.25);
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._ptState) window._ptState = {
    tab: 'progress',
    transitions: {},   // { [skillId]: { loaded:bool, items:[{key,explain,days}] } }
};
const _pt = window._ptState;

// ============================================
// УТИЛИТЫ
// ============================================
function _ptToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _ptHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _ptUid()   { return window.CONFIG?.USER_ID; }
function _ptApiBase() {
    return (window.API_BASE_URL || window.CONFIG?.API_BASE_URL || '').replace(/\/$/, '');
}

function _ptLoadPlan() {
    try {
        const raw = localStorage.getItem('trainer_skill_'+_ptUid());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// Тянем transitions (узлы перехода) с бэка для текущего навыка.
// Кешируем в _pt.transitions[skillId]; при следующем рендере берём из кеша.
// Если бэк не ответил / навык кастомный без модели — оставляем пустой массив.
async function _ptFetchTransitions(skillId) {
    if (!skillId) return [];
    const cached = _pt.transitions[skillId];
    if (cached && cached.loaded) return cached.items;
    try {
        const r = await fetch(`${_ptApiBase()}/api/skill-plan/details/${encodeURIComponent(skillId)}`,
                              { cache: 'no-store' });
        if (!r.ok) {
            _pt.transitions[skillId] = { loaded: true, items: [] };
            return [];
        }
        const j = await r.json();
        const items = (j && j.success && Array.isArray(j.transitions)) ? j.transitions : [];
        _pt.transitions[skillId] = { loaded: true, items };
        return items;
    } catch (e) {
        _pt.transitions[skillId] = { loaded: true, items: [] };
        return [];
    }
}

function _ptGetReflections() {
    try {
        const raw = localStorage.getItem('dt_reflections_'+_ptUid());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function _ptSaveReflection(text) {
    try {
        const key = 'dt_reflections_' + _ptUid();
        const arr = _ptGetReflections();
        arr.unshift({ text, date: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
    } catch {}
}

function _ptCurrentDay(startDate) {
    if (!startDate) return 1;
    const diff = Math.floor((Date.now() - new Date(startDate)) / 86400000) + 1;
    return Math.min(21, Math.max(1, diff));
}

// ============================================
// РЕНДЕР
// ============================================
function _ptRender() {
    _ptInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const TABS = [
        { id:'progress',   label:'Прогресс' },
        { id:'growth',     label:'Карта роста' },
        { id:'reflection', label:'Дневник' },
        { id:'stats',      label:'Итоги' }
    ];

    const tabsHtml = TABS.map(t => `
        <button class="pt-tab${_pt.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>
    `).join('');

    const plan = _ptLoadPlan();
    let body = '';

    if (!plan || !plan.plan) {
        body = `
            <div class="pt-empty">
                <span class="pt-empty-icon">📊</span>
                <div class="pt-empty-title">Нет активного навыка</div>
                <div class="pt-empty-desc">Выберите навык и создайте план — прогресс будет отображаться здесь</div>
                <button class="pt-btn pt-btn-primary" id="ptGoChoice">🎯 Выбрать навык</button>
            </div>`;
    } else {
        if      (_pt.tab === 'progress')   body = _ptProgress(plan);
        else if (_pt.tab === 'growth')     body = _ptGrowthMap(plan);
        else if (_pt.tab === 'reflection') body = _ptReflection();
        else if (_pt.tab === 'stats')      body = _ptStats(plan);
    }

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="ptBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Прогресс</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Статистика и дневник рефлексии</p>
            </div>
            <div class="pt-tabs">${tabsHtml}</div>
            <div id="ptBody">${body}</div>
        </div>`;

    document.getElementById('ptBack').onclick = () => _ptHome();
    document.querySelectorAll('.pt-tab').forEach(btn => {
        btn.addEventListener('click', () => { _pt.tab = btn.dataset.tab; _ptRender(); });
    });
    _ptBindHandlers(plan);
}

// ============================================
// ВКЛАДКА: ПРОГРЕСС
// ============================================
function _ptProgress(plan) {
    const day      = _ptCurrentDay(plan.startDate);
    const done     = plan.daysDone || [];
    const pct      = Math.round((done.length / 21) * 100);
    const allEx    = plan.plan.weeks.flatMap(w => w.exercises);

    // Три недели — детальная сетка с темой и счётчиком n/7.
    // Раньше сверху была вторая «точечная» 21-сетка, дублировала эту —
    // удалена ради чистоты: одна точка истины о ходе плана.
    const weeksHtml = plan.plan.weeks.map((week, wi) => {
        const daysHtml = week.exercises.map(ex => {
            const d         = ex.day;
            const isDone    = done.includes(d);
            const isCurrent = d === day && !isDone;
            const isMissed  = d < day && !isDone;
            return `
            <div class="pt-week-day${isDone?' done':''}${isCurrent?' current':''}${isMissed?' missed':''}"
                 title="${ex.task}">
                ${d}
            </div>`;
        }).join('');
        const weekDone = week.exercises.filter(e => done.includes(e.day)).length;
        return `
        <div class="pt-week-block">
            <div class="pt-week-label">Неделя ${wi+1} · ${week.theme} · ${weekDone}/7</div>
            <div class="pt-week-row">${daysHtml}</div>
        </div>`;
    }).join('');

    // Текущее упражнение
    const curEx  = allEx.find(e => e.day === day);
    const isDone = done.includes(day);

    const curBlock = curEx ? `
        <div class="pt-section-label" style="margin-top:20px">Сегодня — день ${day}</div>
        <div class="pt-insight-card">
            <div class="pt-insight-title">${curEx.task}</div>
            <div class="pt-insight-text">${curEx.dur} · ${isDone ? 'выполнено' : 'не выполнено'}</div>
        </div>
        ${!isDone ? `<button class="pt-btn pt-btn-primary" id="ptGoTraining">Перейти к тренировке</button>` : ''}
    ` : '';

    return `
        <div class="pt-skill-card">
            <div class="pt-skill-name">${plan.skillName}</div>
            <div class="pt-skill-meta">День ${day} из 21 · выполнено ${done.length} упражнений</div>
            <div class="pt-progress-bar">
                <div class="pt-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="pt-progress-stats">
                <span>${done.length} из 21</span>
                <span>${pct}%</span>
            </div>
        </div>

        <div class="pt-section-label">21-дневный план</div>
        ${weeksHtml}
        ${curBlock}

        <div class="pt-btn-row" style="margin-top:16px">
            <button class="pt-btn pt-btn-ghost" id="ptGoChoice">Сменить навык</button>
        </div>

        <div class="pt-tip">
            Светлые — выполнены. Серые — впереди. Полые с пунктиром — пропущенные (прошли, но не отмечены).
        </div>`;
}

// ============================================
// ВКЛАДКА: ДНЕВНИК РЕФЛЕКСИИ
// ============================================
function _ptReflection() {
    const reflections = _ptGetReflections();

    const reflHtml = reflections.length
        ? reflections.map(r => `
            <div class="pt-refl-item">
                <div class="pt-refl-date">📅 ${new Date(r.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</div>
                <div class="pt-refl-text">${r.text}</div>
            </div>`).join('')
        : `<div class="pt-empty">
            <span class="pt-empty-icon">📝</span>
            <div class="pt-empty-title">Дневник пуст</div>
            <div class="pt-empty-desc">После каждой тренировки записывайте рефлексию — это ускоряет развитие навыка</div>
        </div>`;

    return `
        <div class="pt-refl-form">
            <div class="pt-refl-form-label">Добавить запись</div>
            <textarea class="pt-textarea" id="ptReflInput"
                placeholder="Что получилось сегодня? Что было сложно? Что заметили в себе?"></textarea>
        </div>
        <button class="pt-btn pt-btn-primary" id="ptSaveRefl" style="margin-bottom:max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))">💾 Сохранить</button>

        <div class="pt-section-label">Все записи (${reflections.length})</div>
        ${reflHtml}`;
}

// ============================================
// ВКЛАДКА: КАРТА РОСТА (узлы перехода)
// ============================================
// Главный методологический артефакт навыка. У каждого плана есть
// transitions: 5 ключевых перестроек поведения с привязкой к дням.
// Здесь юзер видит, какие узлы он уже прошёл, какой следующий и почему
// — это и есть структура роста, а не «отметка дней».
function _ptGrowthMap(plan) {
    const skillId = plan.skillId;
    const cached = _pt.transitions[skillId];
    const done = plan.daysDone || [];

    // Загружаем асинхронно — рендер перерисуется по завершении.
    if (!cached || !cached.loaded) {
        _ptFetchTransitions(skillId).then(() => _ptRender()).catch(() => {});
    }

    const items = cached && cached.loaded ? cached.items : null;

    if (items === null) {
        // Идёт загрузка — мягкий placeholder.
        return `
            <div class="pt-section-label">Карта роста</div>
            <div class="pt-insight-card">
                <div class="pt-insight-text">Загружаем карту узлов перехода...</div>
            </div>`;
    }

    if (!items.length) {
        // Кастомный навык или редкий случай без transitions.
        return `
            <div class="pt-section-label">Карта роста</div>
            <div class="pt-insight-card">
                <div class="pt-insight-title">Карта пока недоступна</div>
                <div class="pt-insight-text">
                    У этого навыка ещё нет описанных узлов перехода — это случается
                    у пользовательских навыков, для которых модель не сгенерирована.
                    Прогресс по дням можно смотреть на вкладке «Прогресс».
                </div>
            </div>`;
    }

    // Для каждого узла считаем, сколько привязанных к нему дней выполнено,
    // и определяем статус: done / inProgress / pending.
    const totalDays = items.reduce((acc, t) => acc + (Array.isArray(t.days) ? t.days.length : 0), 0);
    const passedDays = items.reduce((acc, t) => {
        if (!Array.isArray(t.days)) return acc;
        return acc + t.days.filter(d => done.includes(d)).length;
    }, 0);
    const overallPct = totalDays > 0 ? Math.round((passedDays / totalDays) * 100) : 0;

    let nextNode = null;  // первый ещё не пройденный полностью узел
    const nodeStatus = items.map((t, i) => {
        const days = Array.isArray(t.days) ? t.days : [];
        const doneInNode = days.filter(d => done.includes(d)).length;
        const total = days.length;
        let status;
        if (total === 0) status = 'pending';
        else if (doneInNode >= total) status = 'done';
        else if (doneInNode > 0) status = 'in-progress';
        else status = 'pending';
        if (!nextNode && status !== 'done') nextNode = { idx: i, item: t, doneInNode, total };
        return { item: t, days, doneInNode, total, status };
    });

    const nodesHtml = nodeStatus.map((n, i) => {
        const statusLabel = n.status === 'done' ? 'Пройден'
                          : n.status === 'in-progress' ? 'В процессе'
                          : 'Впереди';
        const dayPills = n.days.map(d => {
            const isDone = done.includes(d);
            return `<span class="pt-node-day${isDone?' done':''}">${d}</span>`;
        }).join('');
        const isNext = nextNode && nextNode.idx === i;
        return `
        <div class="pt-node pt-node-${n.status}${isNext?' pt-node-next':''}">
            <div class="pt-node-header">
                <div class="pt-node-num">${i+1}</div>
                <div class="pt-node-title-wrap">
                    <div class="pt-node-title">${n.item.key || ''}</div>
                    <div class="pt-node-status">${statusLabel} · ${n.doneInNode}/${n.total}</div>
                </div>
            </div>
            <div class="pt-node-explain">${n.item.explain || ''}</div>
            ${dayPills ? `<div class="pt-node-days">${dayPills}</div>` : ''}
        </div>`;
    }).join('');

    // Введение — что вообще такое "карта роста".
    const intro = `
        <div class="pt-section-label">Карта роста</div>
        <div class="pt-insight-card">
            <div class="pt-insight-text">
                Это пять ключевых перестроек, через которые навык реально встраивается.
                Дни плана раскиданы по узлам — пройти узел значит закрыть привязанные
                к нему дни. Здесь видно, где вы сейчас и какой узел следующий.
            </div>
        </div>`;

    const overall = `
        <div class="pt-skill-card" style="margin-top:16px">
            <div class="pt-skill-meta">Узлов пройдено: ${nodeStatus.filter(n => n.status === 'done').length} из ${nodeStatus.length}</div>
            <div class="pt-progress-bar">
                <div class="pt-progress-fill" style="width:${overallPct}%"></div>
            </div>
            <div class="pt-progress-stats">
                <span>${passedDays} из ${totalDays} дней-в-узлах</span>
                <span>${overallPct}%</span>
            </div>
        </div>`;

    const nextHint = nextNode ? `
        <div class="pt-section-label" style="margin-top:18px">Следующий узел</div>
        <div class="pt-insight-card">
            <div class="pt-insight-title">${nextNode.item.key || ''}</div>
            <div class="pt-insight-text">${nextNode.item.explain || ''}</div>
        </div>` : `
        <div class="pt-insight-card" style="margin-top:18px;border-color:rgba(224,224,224,0.3)">
            <div class="pt-insight-title">Все узлы пройдены</div>
            <div class="pt-insight-text">
                Базовая интеграция навыка завершена. Чтобы он закрепился глубже,
                можно повторить план через месяц на новой задаче.
            </div>
        </div>`;

    return `
        ${intro}
        ${overall}
        ${nextHint}
        <div class="pt-section-label" style="margin-top:18px">Все узлы</div>
        <div class="pt-nodes">${nodesHtml}</div>
        <div class="pt-tip">
            Каждый узел — это «было до» → «стало после». Узел считается пройденным,
            когда закрыты все привязанные к нему дни плана.
        </div>`;
}


// ============================================
// ВКЛАДКА: ИТОГИ И СТАТИСТИКА
// ============================================
function _ptStats(plan) {
    const done     = plan.daysDone || [];
    const day      = _ptCurrentDay(plan.startDate);
    const pct      = Math.round((done.length / 21) * 100);
    const reflCount = _ptGetReflections().length;

    // Пропущенные дни (прошедшие, но не отмеченные)
    const missed = Array.from({length: Math.min(day-1, 21)}, (_, i) => i+1)
        .filter(d => !done.includes(d)).length;

    // Дней с записью в дневнике (для метрики «глубина», а не «упрямство»):
    // считаем уникальные дни, где есть рефлексия.
    const reflDays = new Set();
    try {
        for (const r of _ptGetReflections()) {
            if (r && r.date) reflDays.add(new Date(r.date).toLocaleDateString('ru-RU'));
        }
    } catch {}
    const reflDaysCount = reflDays.size;

    // Дата завершения — на основе РЕАЛЬНОГО темпа, а не «старт + 20».
    // Если темп 0 (юзер не сделал ни дня) — показываем «зависит от темпа».
    const startDate = plan.startDate ? new Date(plan.startDate) : new Date();
    const startStr = startDate.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
    const todayMs = Date.now();
    const daysFromStart = Math.max(1, Math.floor((todayMs - startDate.getTime()) / 86400000) + 1);
    const remaining = Math.max(0, 21 - done.length);
    let etaBlock;
    if (pct >= 100) {
        etaBlock = `Вы прошли все 21 день. Старт: ${startStr}.`;
    } else if (done.length === 0) {
        etaBlock = `Старт: ${startStr}. Чтобы дать прогноз, нужно отметить хотя бы один день.`;
    } else {
        // Простой прогноз: средний темп = выполнено / прошло_дней; экстраполируем оставшиеся.
        const pace = done.length / daysFromStart; // дней-выполнено в среднем за прошедший календарный день
        const extraDays = pace > 0 ? Math.ceil(remaining / pace) : remaining;
        const eta = new Date(todayMs + extraDays * 86400000);
        const etaStr = eta.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
        etaBlock = `При текущем темпе закончите примерно <strong style="color:var(--chrome)">${etaStr}</strong>. ${missed > 0 ? `Пропущено ${missed} ${_ptDaysWord(missed)} — наверстать можно.` : 'Без пропусков.'}`;
    }

    // Подсказка — без претензии на «📈 Анализ» / «AI-инсайты».
    // Это четыре заранее заготовленные ветки текста, и подача должна
    // соответствовать: спокойная фраза, не метрическая магия.
    const consistency = done.length > 0 ? Math.round((done.length / Math.max(day-1, 1)) * 100) : 0;
    let hintText;
    if (done.length === 0) {
        hintText = 'Начните сегодня — первый шаг самый важный. Пять минут практики лучше нуля.';
    } else if (consistency >= 80) {
        hintText = `Стабильно — выполнено ${consistency}% от прошедших дней. Такой темп даёт устойчивую интеграцию.`;
    } else if (consistency >= 50) {
        hintText = 'Темп умеренный. Чтобы навык закрепился, важна непрерывность — постарайтесь не пропускать больше одного дня подряд.';
    } else {
        hintText = 'Пропусков больше, чем хочется. Попробуйте привязать практику к якорю — например, к утреннему кофе или дороге на работу.';
    }

    return `
        <div class="pt-stats-grid">
            <div class="pt-stat-card">
                <div class="pt-stat-value">${done.length}</div>
                <div class="pt-stat-label">Дней выполнено</div>
            </div>
            <div class="pt-stat-card">
                <div class="pt-stat-value">${pct}%</div>
                <div class="pt-stat-label">Прогресс</div>
            </div>
            <div class="pt-stat-card">
                <div class="pt-stat-value">${reflDaysCount}</div>
                <div class="pt-stat-label">Дней с рефлексией</div>
            </div>
            <div class="pt-stat-card">
                <div class="pt-stat-value">${reflCount}</div>
                <div class="pt-stat-label">Записей в дневнике</div>
            </div>
        </div>

        <div class="pt-section-label">Подсказка</div>
        <div class="pt-insight-card">
            <div class="pt-insight-text">${hintText}</div>
        </div>

        <div class="pt-insight-card">
            <div class="pt-insight-title">Дата завершения</div>
            <div class="pt-insight-text">${etaBlock}</div>
        </div>

        ${pct >= 100 ? `
        <div class="pt-insight-card" style="border-color:rgba(224,224,224,0.3)">
            <div class="pt-insight-title">Базовая интеграция пройдена</div>
            <div class="pt-insight-text">
                Все 21 день закрыты — это первый цикл интеграции навыка.
                Чтобы он закрепился глубже, можно повторить план через
                месяц на новой задаче или углубить текущую через вторую петлю.
            </div>
        </div>` : ''}

        <div class="pt-btn-row" style="margin-top:16px">
            <button class="pt-btn pt-btn-ghost" id="ptGoTraining">К тренировке</button>
            <button class="pt-btn pt-btn-ghost" id="ptGoChoice">Сменить навык</button>
        </div>`;
}

// Маленький хелпер для склонения «1 день / 2 дня / 5 дней».
function _ptDaysWord(n) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return 'дней';
    if (b > 1 && b < 5) return 'дня';
    if (b === 1) return 'день';
    return 'дней';
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _ptBindHandlers(plan) {
    // К выбору навыка
    const goChoice = () => {
        if (typeof showSkillChoiceScreen==='function') showSkillChoiceScreen();
        else { const s=document.createElement('script'); s.src='skill_choice.js';
               s.onload=()=>{ if(typeof showSkillChoiceScreen==='function') showSkillChoiceScreen(); };
               document.head.appendChild(s); }
    };
    document.getElementById('ptGoChoice')?.addEventListener('click', goChoice);

    // К тренировке
    const goTraining = () => {
        if (typeof showDailyTrainingScreen==='function') showDailyTrainingScreen();
        else { const s=document.createElement('script'); s.src='daily_training.js';
               s.onload=()=>{ if(typeof showDailyTrainingScreen==='function') showDailyTrainingScreen(); };
               document.head.appendChild(s); }
    };
    document.getElementById('ptGoTraining')?.addEventListener('click', goTraining);

    // Если нет плана
    document.getElementById('ptGoChoice')?.addEventListener('click', goChoice);

    // Сохранить рефлексию
    document.getElementById('ptSaveRefl')?.addEventListener('click', () => {
        const text = (document.getElementById('ptReflInput')?.value || '').trim();
        if (!text) { _ptToast('Напишите рефлексию', 'error'); return; }
        _ptSaveReflection(text);
        _ptToast('💾 Сохранено', 'success');
        _ptRender();
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showProgressScreen() {
    _ptRender();
}

window.showProgressScreen = showProgressScreen;
console.log('✅ progress_tracker.js v1.0 загружен');
