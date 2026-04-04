// ============================================
// daily_training.js — Тренировка дня
// Версия 1.0 — Режим ТРЕНЕР
// ============================================

function _dtInjectStyles() {
    if (document.getElementById('dt-v1-styles')) return;
    const s = document.createElement('style');
    s.id = 'dt-v1-styles';
    s.textContent = `
        /* ===== ГЛАВНАЯ КАРТОЧКА ===== */
        .dt-main-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 24px;
            padding: 22px;
            margin-bottom: 20px;
        }
        .dt-skill-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 8px;
        }
        .dt-skill-name {
            font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;
        }
        .dt-day-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.16);
            border-radius: 20px; padding: 4px 12px; font-size: 12px; color: var(--chrome);
            font-weight: 600; margin-bottom: 12px;
        }
        .dt-progress-wrap { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; overflow: hidden; }
        .dt-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); transition: width 0.5s; }

        /* ===== УПРАЖНЕНИЕ ===== */
        .dt-exercise-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .dt-exercise-header {
            display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
        }
        .dt-exercise-icon {
            font-size: 36px; flex-shrink: 0; line-height: 1;
        }
        .dt-exercise-meta { flex: 1; }
        .dt-exercise-task {
            font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; line-height: 1.3;
        }
        .dt-exercise-dur {
            font-size: 12px; color: var(--text-secondary);
        }
        .dt-exercise-divider {
            height: 1px; background: rgba(224,224,224,0.08); margin: 14px 0;
        }
        .dt-exercise-inst {
            font-size: 14px; color: var(--text-secondary); line-height: 1.7;
        }

        /* ===== ТАЙМЕР ===== */
        .dt-timer-wrap {
            text-align: center;
            padding: 20px;
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 16px;
            margin-bottom: 16px;
        }
        .dt-timer-display {
            font-size: 48px; font-weight: 700; color: var(--chrome);
            font-family: 'Courier New', monospace; letter-spacing: 2px;
            margin-bottom: 12px;
        }
        .dt-timer-display.running { color: var(--text-primary); }
        .dt-timer-btn-row { display: flex; gap: 10px; justify-content: center; }
        .dt-timer-btn {
            padding: 10px 24px; border-radius: 30px; font-size: 13px; font-weight: 600;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none; border: none;
        }
        .dt-timer-btn:active { transform: scale(0.97); }
        .dt-timer-start {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3) !important;
            color: var(--text-primary);
        }
        .dt-timer-reset {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14) !important;
            color: var(--text-secondary);
        }

        /* ===== РЕФЛЕКСИЯ ===== */
        .dt-reflection {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .dt-reflection-label {
            font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px;
        }
        .dt-textarea {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 12px;
            padding: 11px 14px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            outline: none;
            resize: vertical;
            box-sizing: border-box;
            -webkit-appearance: none;
            min-height: 80px;
        }
        .dt-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .dt-textarea::placeholder { color: var(--text-secondary); }

        /* ===== СТАТУС DONE ===== */
        .dt-done-banner {
            text-align: center;
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 16px;
        }
        .dt-done-icon  { font-size: 48px; display: block; margin-bottom: 10px; }
        .dt-done-title { font-size: 18px; font-weight: 700; color: var(--chrome); margin-bottom: 6px; }
        .dt-done-sub   { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

        /* ===== НЕТ ПЛАНА ===== */
        .dt-empty {
            text-align: center; padding: 48px 20px;
        }
        .dt-empty-icon  { font-size: 48px; display: block; margin-bottom: 14px; }
        .dt-empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .dt-empty-desc  { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }

        /* ===== КНОПКИ ===== */
        .dt-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .dt-btn:active { transform: scale(0.97); }
        .dt-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            color: var(--text-primary); width: 100%; border-radius: 40px; padding: 13px;
        }
        .dt-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.16)); }
        .dt-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .dt-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .dt-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .dt-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .dt-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .dt-tip strong { color: var(--chrome); }

        /* ===== СТРИК ===== */
        .dt-streak-row {
            display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .dt-streak-dot {
            width: 12px; height: 12px; border-radius: 50%;
            background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.12);
        }
        .dt-streak-dot.done { background: var(--chrome); border-color: var(--chrome); }

        @media (max-width: 480px) {
            .dt-exercise-task { font-size: 15px; }
            .dt-timer-display { font-size: 40px; }
            .dt-exercise-inst { font-size: 13px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ ТАЙМЕРА (в памяти, не в localStorage)
// ============================================
if (!window._dtTimer) window._dtTimer = {
    seconds:   0,
    running:   false,
    interval:  null,
    target:    0   // целевые секунды из упражнения
};
const _dtT = window._dtTimer;

function _dtStopTimer() {
    if (_dtT.interval) { clearInterval(_dtT.interval); _dtT.interval = null; }
    _dtT.running = false;
}

// ============================================
// УТИЛИТЫ
// ============================================
function _dtToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _dtHome()  { _dtStopTimer(); if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _dtUid()   { return window.CONFIG?.USER_ID; }

function _dtLoadPlan() {
    try {
        const raw = localStorage.getItem('trainer_skill_'+_dtUid());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function _dtCurrentDay(startDate) {
    if (!startDate) return 1;
    const diff = Math.floor((Date.now() - new Date(startDate)) / 86400000) + 1;
    return Math.min(21, Math.max(1, diff));
}

function _dtParseDuration(durStr) {
    // Парсим строку типа "5 мин", "2 мин", "25 мин"
    const m = (durStr || '').match(/(\d+)/);
    return m ? parseInt(m[1]) * 60 : 300;
}

function _dtFormatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _dtSaveReflection(text) {
    try {
        const key = 'dt_reflections_' + _dtUid();
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ text, date: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 30)));
    } catch {}
}

function _dtGetReflections() {
    try {
        const raw = localStorage.getItem('dt_reflections_'+_dtUid());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// ============================================
// РЕНДЕР
// ============================================
function _dtRender() {
    _dtInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const plan = _dtLoadPlan();

    if (!plan || !plan.plan || !plan.plan.weeks) {
        c.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="dtBack">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">⚡</div>
                    <h1 class="content-title">Тренировка дня</h1>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Ежедневное задание</p>
                </div>
                <div class="dt-empty">
                    <span class="dt-empty-icon">🎯</span>
                    <div class="dt-empty-title">Нет активного навыка</div>
                    <div class="dt-empty-desc">Сначала выберите навык и создайте план во вкладке «Выбор навыка»</div>
                    <button class="dt-btn dt-btn-primary" id="dtGoChoice">🎯 Выбрать навык</button>
                </div>
            </div>`;
        document.getElementById('dtBack').onclick = () => _dtHome();
        document.getElementById('dtGoChoice')?.addEventListener('click', () => {
            _dtStopTimer();
            if (typeof showSkillChoiceScreen==='function') showSkillChoiceScreen();
            else {
                const s=document.createElement('script'); s.src='skill_choice.js';
                s.onload=()=>{ if(typeof showSkillChoiceScreen==='function') showSkillChoiceScreen(); };
                document.head.appendChild(s);
            }
        });
        return;
    }

    const day       = _dtCurrentDay(plan.startDate);
    const daysDone  = plan.daysDone || [];
    const isDone    = daysDone.includes(day);
    const pct       = Math.round((daysDone.length / 21) * 100);
    const allEx     = plan.plan.weeks.flatMap(w => w.exercises);
    const curEx     = allEx.find(e => e.day === day);

    // Стрейк — 21 точка
    const dotsHtml = Array.from({length:21},(_,i)=>
        `<div class="dt-streak-dot${daysDone.includes(i+1)?' done':''}"></div>`
    ).join('');

    // Иконки по типу задания
    const ICONS = {
        дыхани: '🫁', медита: '🧘', дневни: '📝', зерка: '🪞',
        прогул: '🚶', звон:   '📞', письм:  '✍️', список: '📋',
        разго:  '💬', аффир:  '🔮', упражн: '💪', практ:  '⚡',
        чита:   '📖', таймер: '⏱', помод:  '🎯', дела:   '✅'
    };
    function _guessIcon(task) {
        const t = (task||'').toLowerCase();
        for (const [key, icon] of Object.entries(ICONS)) {
            if (t.includes(key)) return icon;
        }
        return '⚡';
    }

    const targetSec = curEx ? _dtParseDuration(curEx.dur) : 300;
    if (_dtT.target !== targetSec && !_dtT.running) {
        _dtT.target  = targetSec;
        _dtT.seconds = targetSec;
    }

    // Рефлексии
    const reflections = _dtGetReflections().slice(0, 3);
    const reflHtml = reflections.length ? reflections.map(r => `
        <div style="background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.08);border-radius:12px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px">${new Date(r.date).toLocaleDateString('ru-RU')}</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${r.text}</div>
        </div>`).join('') : `<div style="font-size:12px;color:var(--text-secondary)">Записей пока нет</div>`;

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="dtBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">⚡</div>
                <h1 class="content-title">Тренировка дня</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Ежедневное задание</p>
            </div>

            <!-- Шапка плана -->
            <div class="dt-main-card">
                <div class="dt-skill-label">Текущий навык</div>
                <div class="dt-skill-name">${plan.skillName}</div>
                <div class="dt-day-badge">📅 День ${day} из 21 · ${daysDone.length} выполнено</div>
                <div class="dt-progress-wrap">
                    <div class="dt-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>

            <!-- Стрейк -->
            <div class="dt-section-label">21-дневный прогресс</div>
            <div class="dt-streak-row">${dotsHtml}</div>

            ${isDone ? `
            <!-- Уже выполнено -->
            <div class="dt-done-banner">
                <span class="dt-done-icon">✅</span>
                <div class="dt-done-title">День ${day} завершён!</div>
                <div class="dt-done-sub">
                    ${day < 21
                        ? `Отличная работа. Завтра — день ${day+1}.<br>Выполнено ${daysDone.length} из 21 дней.`
                        : '🏆 Вы прошли все 21 день! Навык сформирован.'
                    }
                </div>
            </div>` : curEx ? `
            <!-- Упражнение дня -->
            <div class="dt-section-label">Задание на сегодня</div>
            <div class="dt-exercise-card">
                <div class="dt-exercise-header">
                    <div class="dt-exercise-icon">${_guessIcon(curEx.task)}</div>
                    <div class="dt-exercise-meta">
                        <div class="dt-exercise-task">${curEx.task}</div>
                        <div class="dt-exercise-dur">⏱ ${curEx.dur}</div>
                    </div>
                </div>
                <div class="dt-exercise-divider"></div>
                <div class="dt-exercise-inst">${curEx.inst}</div>
            </div>

            <!-- Таймер -->
            <div class="dt-section-label">Таймер</div>
            <div class="dt-timer-wrap">
                <div class="dt-timer-display${_dtT.running?' running':''}" id="dtTimerDisplay">
                    ${_dtFormatTime(_dtT.seconds > 0 ? _dtT.seconds : targetSec)}
                </div>
                <div class="dt-timer-btn-row">
                    <button class="dt-timer-btn dt-timer-start" id="dtTimerToggle">
                        ${_dtT.running ? '⏸ Пауза' : '▶ Старт'}
                    </button>
                    <button class="dt-timer-btn dt-timer-reset" id="dtTimerReset">↺ Сброс</button>
                </div>
            </div>

            <!-- Отметить -->
            <button class="dt-btn dt-btn-primary" id="dtMarkDone">✅ Отметить выполнение</button>
            ` : `<p style="color:var(--text-secondary);text-align:center;padding:20px">Упражнение не найдено</p>`}

            <!-- Рефлексия -->
            <div class="dt-section-label" style="margin-top:24px">📝 Рефлексия после тренировки</div>
            <div class="dt-reflection">
                <div class="dt-reflection-label">Что получилось? Что было сложно? Что заметили?</div>
                <textarea class="dt-textarea" id="dtReflectionInput" placeholder="Напишите пару строк о сегодняшней тренировке..."></textarea>
            </div>
            <button class="dt-btn dt-btn-ghost" id="dtSaveRefl" style="width:100%;border-radius:40px;padding:12px">💾 Сохранить рефлексию</button>

            <!-- Прошлые рефлексии -->
            ${reflections.length ? `
            <div class="dt-section-label">Прошлые записи</div>
            ${reflHtml}` : ''}

            <!-- Навигация -->
            <div class="dt-btn-row" style="margin-top:20px">
                <button class="dt-btn dt-btn-ghost" id="dtGoChoice">🎯 Сменить навык</button>
                <button class="dt-btn dt-btn-ghost" id="dtGoProgress">📊 Прогресс</button>
            </div>

            <div class="dt-tip">
                💡 <strong>Главное правило:</strong> не пропускайте больше одного дня подряд — это сбивает формирование нейронной связи.
            </div>
        </div>`;

    // Обработчики
    document.getElementById('dtBack').onclick = () => _dtHome();

    // Таймер
    document.getElementById('dtTimerToggle')?.addEventListener('click', () => {
        if (_dtT.running) {
            _dtStopTimer();
        } else {
            if (_dtT.seconds <= 0) _dtT.seconds = targetSec;
            _dtT.running = true;
            _dtT.interval = setInterval(() => {
                _dtT.seconds--;
                const disp = document.getElementById('dtTimerDisplay');
                if (disp) disp.textContent = _dtFormatTime(_dtT.seconds);
                if (_dtT.seconds <= 0) {
                    _dtStopTimer();
                    _dtToast('⏱ Время вышло!', 'info');
                    const btn = document.getElementById('dtTimerToggle');
                    if (btn) btn.textContent = '▶ Старт';
                }
            }, 1000);
            const btn = document.getElementById('dtTimerToggle');
            if (btn) btn.textContent = '⏸ Пауза';
        }
    });

    document.getElementById('dtTimerReset')?.addEventListener('click', () => {
        _dtStopTimer();
        _dtT.seconds = targetSec;
        const disp = document.getElementById('dtTimerDisplay');
        if (disp) { disp.textContent = _dtFormatTime(targetSec); disp.classList.remove('running'); }
        const btn = document.getElementById('dtTimerToggle');
        if (btn) btn.textContent = '▶ Старт';
    });

    // Отметить выполнение
    document.getElementById('dtMarkDone')?.addEventListener('click', () => {
        _dtStopTimer();
        const plan = _dtLoadPlan();
        if (!plan) return;
        const day = _dtCurrentDay(plan.startDate);
        if (!plan.daysDone.includes(day)) {
            plan.daysDone.push(day);
            try {
                localStorage.setItem('trainer_skill_'+_dtUid(), JSON.stringify(plan));
                // Синхронизируем с skill_choice
                localStorage.setItem('sc_plan_'+_dtUid(), JSON.stringify(plan));
            } catch {}
            if (day >= 21) _dtToast('🏆 21 день пройден! Навык сформирован!', 'success');
            else _dtToast(`✅ День ${day} выполнен!`, 'success');
            _dtRender();
        }
    });

    // Сохранить рефлексию
    document.getElementById('dtSaveRefl')?.addEventListener('click', () => {
        const text = (document.getElementById('dtReflectionInput')?.value || '').trim();
        if (!text) { _dtToast('Напишите рефлексию', 'error'); return; }
        _dtSaveReflection(text);
        _dtToast('💾 Сохранено', 'success');
        document.getElementById('dtReflectionInput').value = '';
        _dtRender();
    });

    // Сменить навык
    document.getElementById('dtGoChoice')?.addEventListener('click', () => {
        _dtStopTimer();
        if (typeof showSkillChoiceScreen==='function') showSkillChoiceScreen();
        else {
            const s=document.createElement('script'); s.src='skill_choice.js';
            s.onload=()=>{ if(typeof showSkillChoiceScreen==='function') showSkillChoiceScreen(); };
            document.head.appendChild(s);
        }
    });

    // Прогресс
    document.getElementById('dtGoProgress')?.addEventListener('click', () => {
        _dtStopTimer();
        if (typeof showProgressScreen==='function') showProgressScreen();
        else {
            const s=document.createElement('script'); s.src='progress_tracker.js';
            s.onload=()=>{ if(typeof showProgressScreen==='function') showProgressScreen(); };
            document.head.appendChild(s);
        }
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showDailyTrainingScreen() {
    _dtRender();
}

window.showDailyTrainingScreen = showDailyTrainingScreen;
console.log('✅ daily_training.js v1.0 загружен');
