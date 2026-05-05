/* prompter.js — ИИ Суфлёр (PRO-фича, в разработке)
 *
 * v2 UX (chips вместо textarea):
 *   1. Короткое интро.
 *   2. Шаг 1 — выбор КОНТЕКСТА из 8 пресет-чипов + «Свой вариант».
 *   3. Шаг 2 — выбор ЦЕЛИ из 4 пресет-чипов под выбранный контекст
 *      + «Своя цель». Появляется только после выбора контекста.
 *   4. Подсказка про наушники.
 *   5. Кнопка «Активировать» — premium-gate.
 *
 * Premium-gate (без изменений):
 *   - Тестер (PROMPTER_TESTERS) → модал «запускаем тестовую сборку»
 *   - Не премиум → premium-lock
 *   - Премиум, но не тестер → «скоро будет доступен»
 *
 * Логирование интереса в /api/log-event (event=prompter_activate_clicked)
 * с payload { context_id, goal_id, has_custom_context, has_custom_goal,
 * is_tester } — это даст аналитику какие сценарии чаще выбирают.
 */

(function () {
    if (typeof window === 'undefined') return;

    // ============================================
    // КОНФИГ: тестеры
    // ============================================
    const PROMPTER_TESTERS = [1775006346315];

    // ============================================
    // КОНФИГ: контексты + цели
    // ============================================
    const CONTEXTS = [
        {
            id: 'interview',
            icon: '💼',
            label: 'Собеседование',
            goals: [
                { id: 'tech_questions',  text: 'Не сесть в лужу на технических вопросах' },
                { id: 'real_conditions', text: 'Узнать реальные условия и команду' },
                { id: 'rate_anchor',     text: 'Договориться о ставке от Х' },
                { id: 'expert_impression', text: 'Произвести впечатление эксперта' }
            ]
        },
        {
            id: 'salary',
            icon: '💰',
            label: 'Переговоры о ЗП',
            goals: [
                { id: 'first_number',  text: 'Назвать цифру первым, не извиняясь' },
                { id: 'justify_raise', text: 'Обосновать повышение результатами' },
                { id: 'counter_offer', text: 'Получить контр-оффер' },
                { id: 'no_conflict',   text: 'Не сорваться в конфликт' }
            ]
        },
        {
            id: 'sales',
            icon: '📞',
            label: 'Клиент / продажа',
            goals: [
                { id: 'close_deal',    text: 'Закрыть сделку' },
                { id: 'objections',    text: 'Снять основные возражения' },
                { id: 'next_step',     text: 'Назначить следующий шаг' },
                { id: 'no_discounts',  text: 'Не уйти в скидки сразу' }
            ]
        },
        {
            id: 'contractor',
            icon: '🤝',
            label: 'Заказчик / ТЗ',
            goals: [
                { id: 'protect_terms',  text: 'Защитить ставку и сроки' },
                { id: 'clarify_brief',  text: 'Прояснить непонятный ТЗ' },
                { id: 'prepay',         text: 'Добиться предоплаты' },
                { id: 'graceful_exit',  text: 'Уйти красиво, если не сложилось' }
            ]
        },
        {
            id: 'family',
            icon: '👨‍👧',
            label: 'Близкий человек',
            goals: [
                { id: 'say_no',         text: 'Сказать «нет» без вины' },
                { id: 'clear_air',      text: 'Прояснить накопившееся' },
                { id: 'no_blame',       text: 'Не скатиться в обвинения' },
                { id: 'hear_them',      text: 'Услышать его сторону' }
            ]
        },
        {
            id: 'pitch',
            icon: '🎤',
            label: 'Презентация / питч',
            goals: [
                { id: 'hold_structure', text: 'Удержать структуру, не растекаться' },
                { id: 'close_qa',       text: 'Закрыть вопросы инвесторов / комитета' },
                { id: 'sound_confident',text: 'Звучать уверенно при волнении' },
                { id: 'commitment',     text: 'Получить commitment в финале' }
            ]
        },
        {
            id: 'conflict',
            icon: '😬',
            label: 'Конфликт',
            goals: [
                { id: 'deescalate',     text: 'Деэскалировать без подчинения' },
                { id: 'hard_truth',     text: 'Сказать неприятную правду' },
                { id: 'set_boundaries', text: 'Расставить границы' },
                { id: 'close_no_break', text: 'Закрыть тему, не разорвав отношения' }
            ]
        },
        {
            id: 'custom',
            icon: '✏️',
            label: 'Свой вариант',
            goals: []  // в свободной форме — только textarea для цели
        }
    ];

    function _ppApi()  { return window.CONFIG?.API_BASE_URL || window.API_BASE_URL || ''; }
    function _ppUid()  { return window.CONFIG?.USER_ID || window.USER_ID; }
    function _ppHome() { if (typeof window.renderDashboard === 'function') window.renderDashboard(); }
    function _ppToast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
    function _ppFindContext(id) { return CONTEXTS.find(c => c.id === id) || null; }

    function _ppIsTester() {
        const uid = _ppUid();
        return uid && PROMPTER_TESTERS.includes(parseInt(uid, 10));
    }
    function _ppIsPremium() { return window.IS_PREMIUM === true; }

    // ============================================
    // СОСТОЯНИЕ ЭКРАНА
    // ============================================
    if (!window._ppState) window._ppState = {
        contextId: null,    // id выбранного контекста
        customContext: '',  // текст если contextId === 'custom'
        goalId: null,       // id выбранной цели (или 'custom')
        customGoal: ''      // текст если goalId === 'custom'
    };
    const _pp = window._ppState;

    // ============================================
    // СТИЛИ
    // ============================================
    function _ppInjectStyles() {
        if (document.getElementById('prompter-styles')) return;
        const s = document.createElement('style');
        s.id = 'prompter-styles';
        s.textContent = `
            .pp-page { max-width: 760px; margin: 0 auto; padding: 22px 18px 100px; }
            .pp-back-btn {
                background: transparent; border: 1px solid rgba(224,224,224,0.18);
                color: var(--text-secondary); padding: 8px 14px; border-radius: 24px;
                font-family: inherit; font-size: 12px; cursor: pointer; margin-bottom: 18px;
            }
            .pp-header { text-align: center; margin-bottom: 24px; }
            .pp-title {
                font-size: 28px; font-weight: 600; color: var(--text-primary);
                margin-bottom: 4px; letter-spacing: -0.01em;
            }
            .pp-subtitle {
                font-size: 12px; color: var(--text-secondary); line-height: 1.4;
            }
            .pp-section {
                margin-top: 22px;
            }
            .pp-section-label {
                font-size: 11px; font-weight: 600; letter-spacing: 0.4px;
                color: var(--text-secondary); text-transform: uppercase;
                margin-bottom: 10px;
                display: flex; align-items: center; gap: 8px;
            }
            .pp-section-label .pp-step-num {
                display: inline-flex; align-items: center; justify-content: center;
                width: 18px; height: 18px; border-radius: 50%;
                background: rgba(255,140,0,0.20); color: var(--text-primary);
                font-size: 10px; font-weight: 700; letter-spacing: 0;
            }

            /* ===== ЧИПЫ ===== */
            .pp-chips {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
            }
            @media (min-width: 640px) {
                .pp-chips { grid-template-columns: repeat(3, 1fr); }
            }
            .pp-chip {
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.12);
                border-radius: 14px;
                padding: 12px 14px;
                font-family: inherit; font-size: 13px;
                color: var(--text-primary); text-align: left;
                cursor: pointer;
                transition: border-color 0.15s ease, background 0.15s ease;
                display: flex; align-items: center; gap: 8px;
                line-height: 1.35;
            }
            .pp-chip:hover {
                border-color: rgba(224,224,224,0.22);
                background: rgba(224,224,224,0.06);
            }
            .pp-chip.selected {
                border-color: rgba(255,140,0,0.45);
                background: rgba(255,140,0,0.10);
            }
            .pp-chip-icon { flex: 0 0 auto; font-size: 16px; }
            .pp-chip-text { flex: 1; }

            /* ===== ЦЕЛИ — чипы пошире, в одну колонку, ===== */
            .pp-goals { display: flex; flex-direction: column; gap: 8px; }
            .pp-goal-chip {
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.12);
                border-radius: 12px;
                padding: 11px 14px;
                font-family: inherit; font-size: 13px;
                color: var(--text-primary); text-align: left;
                cursor: pointer;
                transition: border-color 0.15s ease, background 0.15s ease;
                line-height: 1.4;
                display: flex; align-items: center; gap: 10px;
            }
            .pp-goal-chip:hover {
                border-color: rgba(224,224,224,0.22);
                background: rgba(224,224,224,0.06);
            }
            .pp-goal-chip.selected {
                border-color: rgba(255,140,0,0.45);
                background: rgba(255,140,0,0.10);
            }
            .pp-goal-chip-mark {
                flex: 0 0 14px;
                width: 14px; height: 14px; border-radius: 50%;
                border: 1.5px solid rgba(224,224,224,0.30);
            }
            .pp-goal-chip.selected .pp-goal-chip-mark {
                border-color: rgba(255,140,0,0.80);
                background: rgba(255,140,0,0.80);
            }
            .pp-goal-chip-text { flex: 1; }

            /* ===== TEXTAREA (custom) ===== */
            .pp-custom-area {
                margin-top: 8px;
                animation: ppFadeIn 0.18s ease;
            }
            @keyframes ppFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .pp-textarea {
                width: 100%; min-height: 70px; padding: 11px 13px;
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(255,140,0,0.30);
                border-radius: 12px; color: var(--text-primary);
                font-family: inherit; font-size: 13px; line-height: 1.5;
                resize: vertical; box-sizing: border-box;
            }
            .pp-textarea:focus {
                outline: none;
                border-color: rgba(255,140,0,0.55);
                background: rgba(224,224,224,0.06);
            }

            /* ===== ИНТРО + ПОДСКАЗКА ===== */
            .pp-intro {
                font-size: 13px; color: var(--text-secondary);
                line-height: 1.55; text-align: center; padding: 0 8px;
                margin-bottom: 10px;
            }
            .pp-tip {
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.10);
                border-radius: 12px; padding: 11px 13px;
                font-size: 12px; color: var(--text-secondary);
                line-height: 1.5; margin-top: 22px;
                display: flex; gap: 9px;
            }
            .pp-tip-icon { flex: 0 0 auto; opacity: 0.85; }

            /* ===== КНОПКА ===== */
            .pp-activate-btn {
                width: 100%; padding: 14px;
                background: linear-gradient(135deg, #FF8C00, #FF6B00);
                color: #fff; border: none; border-radius: 30px;
                font-family: inherit; font-size: 14px; font-weight: 600;
                cursor: pointer; margin-top: 18px;
                transition: transform 0.15s ease, opacity 0.15s ease;
            }
            .pp-activate-btn:hover { transform: translateY(-1px); }
            .pp-activate-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

            /* ===== МОДАЛЫ ===== */
            .pp-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.55);
                -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
                z-index: 9100;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
            }
            .pp-modal {
                background: var(--carbon-fiber, #1a1a1a);
                border: 1px solid rgba(224,224,224,0.18);
                border-radius: 20px;
                padding: 26px;
                max-width: 360px; width: 100%;
                text-align: center;
            }
            .pp-modal-icon { font-size: 38px; margin-bottom: 10px; }
            .pp-modal-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
            .pp-modal-text { font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 18px; }
            .pp-modal-actions { display: flex; gap: 10px; flex-direction: column; }
            .pp-modal-btn {
                padding: 11px 22px; border-radius: 28px;
                background: rgba(224,224,224,0.18); color: var(--text-primary);
                border: 1px solid rgba(224,224,224,0.3);
                font-family: inherit; font-weight: 600; font-size: 13px;
                cursor: pointer;
            }
            .pp-modal-btn-primary {
                background: linear-gradient(135deg, #FF8C00, #FF6B00);
                color: #fff; border-color: transparent;
            }
        `;
        document.head.appendChild(s);
    }

    // ============================================
    // РЕНДЕР
    // ============================================
    function _ppRender() {
        _ppInjectStyles();
        const c = document.getElementById('screenContainer');
        if (!c) return;

        // Восстанавливаем черновик при первом рендере экрана.
        if (_pp.contextId === null) _ppLoadDraft();

        const ctx = _ppFindContext(_pp.contextId);
        const isCustomCtx = _pp.contextId === 'custom';

        // Чипы контекста
        const ctxChipsHtml = CONTEXTS.map(c => `
            <button class="pp-chip${_pp.contextId === c.id ? ' selected' : ''}"
                    data-ctx="${c.id}">
                <span class="pp-chip-icon">${c.icon}</span>
                <span class="pp-chip-text">${c.label}</span>
            </button>
        `).join('');

        // Кастомный контекст — textarea появляется только если выбран custom
        const customCtxHtml = isCustomCtx ? `
            <div class="pp-custom-area">
                <textarea class="pp-textarea" id="ppCustomCtx"
                    placeholder="Опишите свой контекст: с кем разговор, о чём, какая обстановка."
                    >${_escapeHtml(_pp.customContext)}</textarea>
            </div>
        ` : '';

        // Секция целей появляется только после выбора контекста
        let goalsSectionHtml = '';
        if (_pp.contextId) {
            const isCustomGoal = _pp.goalId === 'custom';
            // Свободный контекст → только «своя цель» (без пресетов)
            const goals = isCustomCtx ? [] : (ctx?.goals || []);

            const presetGoalsHtml = goals.map(g => `
                <button class="pp-goal-chip${_pp.goalId === g.id ? ' selected' : ''}"
                        data-goal="${g.id}">
                    <span class="pp-goal-chip-mark"></span>
                    <span class="pp-goal-chip-text">${g.text}</span>
                </button>
            `).join('');

            const customGoalChipHtml = `
                <button class="pp-goal-chip${isCustomGoal ? ' selected' : ''}"
                        data-goal="custom">
                    <span class="pp-goal-chip-mark"></span>
                    <span class="pp-goal-chip-text">✏️ Своя цель</span>
                </button>
            `;

            const customGoalAreaHtml = isCustomGoal ? `
                <div class="pp-custom-area">
                    <textarea class="pp-textarea" id="ppCustomGoal"
                        placeholder="Опишите свою цель: чего хотите добиться от разговора."
                        >${_escapeHtml(_pp.customGoal)}</textarea>
                </div>
            ` : '';

            goalsSectionHtml = `
                <div class="pp-section">
                    <div class="pp-section-label">
                        <span class="pp-step-num">2</span>
                        Цель${isCustomCtx ? '' : ' разговора'}
                    </div>
                    <div class="pp-goals">
                        ${presetGoalsHtml}
                        ${customGoalChipHtml}
                    </div>
                    ${customGoalAreaHtml}
                </div>
            `;
        }

        c.innerHTML = `
            <div class="pp-page">
                <button class="pp-back-btn" id="ppBack">← Назад</button>

                <div class="pp-header">
                    <div style="font-size:42px;line-height:1;margin-bottom:6px">🎙️</div>
                    <div class="pp-title">ИИ Суфлёр</div>
                    <div class="pp-subtitle">Подсказчик для важного разговора онлайн</div>
                </div>

                <div class="pp-intro">
                    Слушает звонок (Zoom, Telegram, телефон) и подсказывает реплики через наушник в реальном времени.
                </div>

                <div class="pp-section">
                    <div class="pp-section-label">
                        <span class="pp-step-num">1</span>
                        Что у вас за разговор
                    </div>
                    <div class="pp-chips">${ctxChipsHtml}</div>
                    ${customCtxHtml}
                </div>

                ${goalsSectionHtml}

                <div class="pp-tip">
                    <span class="pp-tip-icon">🎧</span>
                    <span>Используйте наушники с костной проводимостью или закрытые AirPods — чтобы подсказки слышали только вы.</span>
                </div>

                <button class="pp-activate-btn" id="ppActivate">Активировать ИИ Суфлёр</button>
            </div>
        `;

        // ===== ОБРАБОТЧИКИ =====
        document.getElementById('ppBack').onclick = () => {
            _ppSaveDraft();
            _ppHome();
        };

        document.querySelectorAll('.pp-chip').forEach(btn => {
            btn.onclick = () => {
                const newCtxId = btn.dataset.ctx;
                if (_pp.contextId !== newCtxId) {
                    _pp.contextId = newCtxId;
                    // При смене контекста сбрасываем выбранную цель — пресеты другие.
                    _pp.goalId = null;
                    _pp.customGoal = '';
                    _ppSaveDraft();
                    _ppRender();
                }
            };
        });

        document.querySelectorAll('.pp-goal-chip').forEach(btn => {
            btn.onclick = () => {
                _pp.goalId = btn.dataset.goal;
                _ppSaveDraft();
                _ppRender();
            };
        });

        // Кастомные textarea — автосохранение
        ['ppCustomCtx','ppCustomGoal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', _ppDebouncedSave);
                el.addEventListener('blur', _ppSyncCustomFromInputs);
                // Автофокус на только что развернувшийся textarea
                if ((id === 'ppCustomCtx' && _pp.contextId === 'custom' && !_pp.customContext) ||
                    (id === 'ppCustomGoal' && _pp.goalId === 'custom' && !_pp.customGoal)) {
                    setTimeout(() => el.focus(), 30);
                }
            }
        });

        document.getElementById('ppActivate').onclick = _ppOnActivate;
    }

    function _escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ============================================
    // ЧЕРНОВИК
    // ============================================
    let _saveT = null;
    function _ppDebouncedSave() {
        clearTimeout(_saveT);
        _saveT = setTimeout(() => {
            _ppSyncCustomFromInputs();
            _ppSaveDraft();
        }, 600);
    }
    function _ppSyncCustomFromInputs() {
        const cc = document.getElementById('ppCustomCtx');
        if (cc) _pp.customContext = cc.value;
        const cg = document.getElementById('ppCustomGoal');
        if (cg) _pp.customGoal = cg.value;
    }
    function _ppSaveDraft() {
        try {
            localStorage.setItem('pp_draft_' + _ppUid(), JSON.stringify({
                contextId: _pp.contextId,
                customContext: _pp.customContext || '',
                goalId: _pp.goalId,
                customGoal: _pp.customGoal || '',
                ts: Date.now()
            }));
        } catch {}
    }
    function _ppLoadDraft() {
        try {
            const raw = localStorage.getItem('pp_draft_' + _ppUid());
            if (!raw) return;
            const d = JSON.parse(raw);
            _pp.contextId = d.contextId || null;
            _pp.customContext = d.customContext || '';
            _pp.goalId = d.goalId || null;
            _pp.customGoal = d.customGoal || '';
        } catch {}
    }

    // ============================================
    // АКТИВАЦИЯ — гейт
    // ============================================
    function _ppOnActivate() {
        _ppSyncCustomFromInputs();

        // Валидация
        if (!_pp.contextId) {
            _ppToast('Выберите контекст разговора', 'error');
            return;
        }
        if (_pp.contextId === 'custom' && !_pp.customContext.trim()) {
            _ppToast('Опишите свой контекст в поле ниже', 'error');
            return;
        }
        if (!_pp.goalId) {
            _ppToast('Выберите цель разговора', 'error');
            return;
        }
        if (_pp.goalId === 'custom' && !_pp.customGoal.trim()) {
            _ppToast('Опишите свою цель в поле ниже', 'error');
            return;
        }
        _ppSaveDraft();

        // Логирование интереса — для аналитики гипотезы спроса.
        try {
            fetch(`${_ppApi()}/api/log-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: _ppUid(),
                    event: 'prompter_activate_clicked',
                    payload: {
                        context_id: _pp.contextId,
                        goal_id: _pp.goalId,
                        has_custom_context: _pp.contextId === 'custom',
                        has_custom_goal:    _pp.goalId === 'custom',
                        is_tester: _ppIsTester()
                    }
                })
            }).catch(() => {});
        } catch {}

        if (_ppIsTester()) {
            _ppShowModal({
                icon: '🛠',
                title: 'Запускаем тестовую сборку',
                text: 'Активация для тестера записана. Live-режим суфлёра ещё в разработке — подключу к вашему контексту и цели, как только будет готов первый билд.',
                buttons: [{ label: 'Понятно', primary: true }]
            });
            return;
        }
        if (!_ppIsPremium()) {
            _ppShowModal({
                icon: '💎',
                title: 'ИИ Суфлёр — функция Premium',
                text: 'Live-подсказчик для важных разговоров доступен в подписке. Сейчас он в закрытой бете у тестеров; в публичный Premium выйдет следующим релизом.',
                buttons: [
                    { label: 'Открыть Premium', primary: true, action: 'upgrade' },
                    { label: 'Понятно', action: 'close' }
                ]
            });
            return;
        }
        _ppShowModal({
            icon: '⏳',
            title: 'Скоро будет доступен',
            text: 'Спасибо за интерес. Live-режим в разработке — мы запишем ваш контекст и цель, и подключим вас к закрытой бете в момент запуска.',
            buttons: [{ label: 'Понятно', primary: true }]
        });
    }

    function _ppShowModal({ icon, title, text, buttons }) {
        const overlay = document.createElement('div');
        overlay.className = 'pp-modal-overlay';
        const btnsHtml = buttons.map((b, i) => `
            <button class="pp-modal-btn ${b.primary ? 'pp-modal-btn-primary' : ''}"
                    data-i="${i}" data-action="${b.action || 'close'}">${b.label}</button>
        `).join('');
        overlay.innerHTML = `
            <div class="pp-modal">
                <div class="pp-modal-icon">${icon}</div>
                <div class="pp-modal-title">${title}</div>
                <div class="pp-modal-text">${text}</div>
                <div class="pp-modal-actions">${btnsHtml}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelectorAll('.pp-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                close();
                if (action === 'upgrade') {
                    if (typeof window.showSubscriptionScreen === 'function') {
                        window.showSubscriptionScreen();
                    } else {
                        _ppToast('Раздел подписки временно недоступен', 'error');
                    }
                }
            });
        });
    }

    // ============================================
    // ТОЧКА ВХОДА
    // ============================================
    async function showPrompterScreen() {
        _ppRender();
    }

    window.showPrompterScreen = showPrompterScreen;
})();
