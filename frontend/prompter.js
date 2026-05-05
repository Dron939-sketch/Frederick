/* prompter.js — ИИ Суфлёр (PRO-фича, в разработке)
 *
 * Кнопка «🎙️ ИИ Суфлёр» на дашборде → этот экран.
 * UX:
 *   1. Краткое описание что это.
 *   2. Поле «Контекст» (с кем и о чём разговор).
 *   3. Поле «Задача» (чего хочешь добиться).
 *   4. Подсказка про наушники.
 *   5. Кнопка «Активировать» — premium-gate.
 *
 * Premium-gate:
 *   - Список тестеров (PROMPTER_TESTERS) — пропускаем без проверки подписки.
 *   - Иначе: window.IS_PREMIUM ? показываем «фича в разработке» : premium-lock popup.
 *
 * Реальной активации live-суфлёра пока нет — это шаг 1 в roadmap.
 * После «Активировать» юзер получает информационное окно («функция запущена
 * у тестера / появится в подписке»). На этом MVP — собираем интерес и
 * количество кликов, проверяем гипотезу до полной разработки.
 */

(function () {
    if (typeof window === 'undefined') return;

    // ============================================
    // КОНФИГ
    // ============================================
    // Whitelist тестеров — для них «Активировать» работает несмотря
    // на отсутствие подписки. Сюда добавляются user_id ручно.
    const PROMPTER_TESTERS = [1775006346315];

    function _ppApi()  { return window.CONFIG?.API_BASE_URL || window.API_BASE_URL || ''; }
    function _ppUid()  { return window.CONFIG?.USER_ID || window.USER_ID; }
    function _ppHome() { if (typeof window.renderDashboard === 'function') window.renderDashboard(); }
    function _ppToast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }

    function _ppIsTester() {
        const uid = _ppUid();
        if (!uid) return false;
        return PROMPTER_TESTERS.includes(parseInt(uid, 10));
    }

    function _ppIsPremium() {
        // Глобал из app.js (loadPremiumStatus).
        return window.IS_PREMIUM === true;
    }

    // ============================================
    // СТИЛИ
    // ============================================
    function _ppInjectStyles() {
        if (document.getElementById('prompter-styles')) return;
        const s = document.createElement('style');
        s.id = 'prompter-styles';
        s.textContent = `
            .pp-page {
                max-width: 760px; margin: 0 auto; padding: 22px 18px 100px;
            }
            .pp-back-btn {
                background: transparent; border: 1px solid rgba(224,224,224,0.18);
                color: var(--text-secondary); padding: 8px 14px; border-radius: 24px;
                font-family: inherit; font-size: 12px; cursor: pointer;
                margin-bottom: 18px;
            }
            .pp-header {
                text-align: center; margin-bottom: 28px;
            }
            .pp-title {
                font-size: 28px; font-weight: 600; color: var(--text-primary);
                margin-bottom: 6px; letter-spacing: -0.01em;
            }
            .pp-subtitle {
                font-size: 13px; color: var(--text-secondary); line-height: 1.5;
            }
            .pp-intro {
                background: rgba(255,140,0,0.06);
                border: 1px solid rgba(255,140,0,0.22);
                border-radius: 16px; padding: 16px 18px;
                margin-bottom: 24px;
            }
            .pp-intro-title {
                font-size: 13px; font-weight: 600; color: var(--text-primary);
                margin-bottom: 6px;
            }
            .pp-intro-text {
                font-size: 13px; color: var(--text-secondary); line-height: 1.6;
            }
            .pp-section-label {
                font-size: 11px; font-weight: 600; letter-spacing: 0.4px;
                color: var(--text-secondary); text-transform: uppercase;
                margin: 18px 0 8px;
            }
            .pp-textarea {
                width: 100%; min-height: 90px; padding: 12px 14px;
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.12);
                border-radius: 14px; color: var(--text-primary);
                font-family: inherit; font-size: 14px; line-height: 1.5;
                resize: vertical;
                box-sizing: border-box;
            }
            .pp-textarea:focus {
                outline: none;
                border-color: rgba(255,140,0,0.45);
                background: rgba(224,224,224,0.06);
            }
            .pp-hint {
                font-size: 11.5px; color: var(--text-secondary);
                margin-top: 5px; line-height: 1.5;
                opacity: 0.85;
            }
            .pp-tip {
                background: rgba(224,224,224,0.04);
                border: 1px solid rgba(224,224,224,0.10);
                border-radius: 14px; padding: 12px 14px;
                font-size: 12px; color: var(--text-secondary);
                line-height: 1.55; margin-top: 22px;
                display: flex; gap: 10px;
            }
            .pp-tip-icon { flex: 0 0 auto; opacity: 0.85; }
            .pp-activate-btn {
                width: 100%; padding: 14px;
                background: linear-gradient(135deg, #FF8C00, #FF6B00);
                color: #fff; border: none; border-radius: 30px;
                font-family: inherit; font-size: 14px; font-weight: 600;
                cursor: pointer; margin-top: 22px;
                transition: transform 0.15s ease, opacity 0.15s ease;
            }
            .pp-activate-btn:hover { transform: translateY(-1px); }
            .pp-activate-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

            .pp-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.55);
                -webkit-backdrop-filter: blur(6px);
                backdrop-filter: blur(6px);
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
            .pp-modal-btn {
                display: inline-block; padding: 11px 22px; border-radius: 28px;
                background: rgba(224,224,224,0.18); color: var(--text-primary);
                border: 1px solid rgba(224,224,224,0.3);
                font-family: inherit; font-weight: 600; font-size: 13px;
                cursor: pointer;
            }
            .pp-modal-btn-primary {
                background: linear-gradient(135deg, #FF8C00, #FF6B00);
                color: #fff; border-color: transparent;
            }
            .pp-modal-actions { display: flex; gap: 10px; flex-direction: column; }
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

        // Восстанавливаем сохранённый ввод (если был).
        const saved = _ppLoadDraft();

        c.innerHTML = `
            <div class="pp-page">
                <button class="pp-back-btn" id="ppBack">← Назад</button>

                <div class="pp-header">
                    <div style="font-size:48px;line-height:1;margin-bottom:8px">🎙️</div>
                    <div class="pp-title">ИИ Суфлёр</div>
                    <div class="pp-subtitle">Подсказчик для важного разговора онлайн</div>
                </div>

                <div class="pp-intro">
                    <div class="pp-intro-title">Что это</div>
                    <div class="pp-intro-text">
                        ИИ Суфлёр слушает голосовой звонок (Zoom, Telegram, телефон)
                        и в реальном времени подсказывает вам реплики через наушник.
                        Подходит для собеседований, переговоров о ставке, сложных
                        клиентских звонков. Не для свиданий и скрытой записи —
                        только когда вы сами участник встречи.
                    </div>
                </div>

                <div class="pp-section-label">Контекст разговора</div>
                <textarea class="pp-textarea" id="ppContext"
                    placeholder="С кем разговор и о чём. Например: «Собеседование на роль продакт-менеджера в финтех-стартапе, второй раунд, говорю с CTO — техлидом команды на 8 человек».">${saved.context || ''}</textarea>
                <div class="pp-hint">Чем точнее контекст, тем точнее подсказки. 1-3 предложения.</div>

                <div class="pp-section-label">Ваша задача</div>
                <textarea class="pp-textarea" id="ppTask"
                    placeholder="Чего хотите добиться. Например: «Договориться о ставке от 320 тыс. ₽, понять реальный объём работы, не слиться на технических вопросах про архитектуру».">${saved.task || ''}</textarea>
                <div class="pp-hint">Конкретная цель работает лучше, чем «пройти хорошо».</div>

                <div class="pp-tip">
                    <span class="pp-tip-icon">🎧</span>
                    <span>
                        Используйте <strong>наушники с костной проводимостью</strong>
                        или закрытые AirPods — чтобы подсказки слышали только вы,
                        а не ваш собеседник через микрофон.
                        Для работы нужно разрешение на микрофон и системный звук
                        (Zoom / Meet).
                    </span>
                </div>

                <button class="pp-activate-btn" id="ppActivate">Активировать ИИ Суфлёр</button>
            </div>
        `;

        document.getElementById('ppBack').onclick = () => {
            _ppSaveDraft(); _ppHome();
        };
        document.getElementById('ppActivate').onclick = _ppOnActivate;

        // Автосохранение черновика по blur и input.
        ['ppContext','ppTask'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('blur', _ppSaveDraft);
                el.addEventListener('input', _ppDebouncedSave);
            }
        });
    }

    // ============================================
    // ЧЕРНОВИК — сохраняем введённое в localStorage
    // ============================================
    let _saveT = null;
    function _ppDebouncedSave() {
        clearTimeout(_saveT);
        _saveT = setTimeout(_ppSaveDraft, 700);
    }
    function _ppSaveDraft() {
        try {
            const data = {
                context: (document.getElementById('ppContext')?.value || '').trim(),
                task:    (document.getElementById('ppTask')?.value || '').trim(),
                ts:      Date.now()
            };
            localStorage.setItem('pp_draft_' + _ppUid(), JSON.stringify(data));
        } catch {}
    }
    function _ppLoadDraft() {
        try {
            const raw = localStorage.getItem('pp_draft_' + _ppUid());
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    // ============================================
    // АКТИВАЦИЯ — гейт + информационное окно
    // ============================================
    function _ppOnActivate() {
        const ctx = (document.getElementById('ppContext')?.value || '').trim();
        const task = (document.getElementById('ppTask')?.value || '').trim();
        if (!ctx || !task) {
            _ppToast('Заполните оба поля — контекст и задачу', 'error');
            return;
        }
        _ppSaveDraft();

        // Логируем интерес — это нужно для гипотезы спроса.
        try {
            fetch(`${_ppApi()}/api/log-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: _ppUid(),
                    event: 'prompter_activate_clicked',
                    payload: { ctx_len: ctx.length, task_len: task.length, is_tester: _ppIsTester() }
                })
            }).catch(() => {});
        } catch {}

        // Тестер → пропускаем гейт, показываем «функция в разработке у тебя».
        if (_ppIsTester()) {
            _ppShowTesterModal();
            return;
        }
        // Не премиум → premium-lock.
        if (!_ppIsPremium()) {
            _ppShowPremiumLockModal();
            return;
        }
        // Премиум-юзер (не тестер) — пока тоже информационное окно «скоро».
        _ppShowComingSoonModal();
    }

    function _ppShowTesterModal() {
        _ppShowModal({
            icon: '🛠',
            title: 'Запускаем тестовую сборку',
            text: 'Активация для тестера записана. Live-режим суфлёра ещё в разработке — подключу к вашему контексту и задаче, как только будет готов первый билд.',
            buttons: [{ label: 'Понятно', primary: true }]
        });
    }

    function _ppShowPremiumLockModal() {
        _ppShowModal({
            icon: '💎',
            title: 'ИИ Суфлёр — функция Premium',
            text: 'Live-подсказчик для важных разговоров доступен в подписке. Сейчас он в закрытой бете у тестеров; в публичный Premium выйдет следующим релизом.',
            buttons: [
                { label: 'Открыть Premium', primary: true, action: 'upgrade' },
                { label: 'Понятно', action: 'close' }
            ]
        });
    }

    function _ppShowComingSoonModal() {
        _ppShowModal({
            icon: '⏳',
            title: 'Скоро будет доступен',
            text: 'Спасибо за интерес. Live-режим суфлёра в разработке — мы запишем ваш контекст и задачу и подключим вас к закрытой бете в момент запуска.',
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
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
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
