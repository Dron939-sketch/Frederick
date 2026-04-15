// ============================================
// doubles.js — Психометрический мэтчмейкер
// Версия 6.1 — универсальный (поддерживает оба API)
// ============================================

// ============================================
// CSS — инжектируем один раз
// ============================================
function _doublesInjectStyles() {
    if (document.getElementById('doubles-v6-styles')) return;
    const s = document.createElement('style');
    s.id = 'doubles-v6-styles';
    s.textContent = `
        /* ===== КАРТОЧКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ===== */
        .db-own-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .db-own-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 10px;
        }
        .db-own-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .db-own-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .db-own-code {
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 30px;
            padding: 4px 12px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            color: var(--silver-brushed);
        }
        .db-vectors {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .db-vector-tag {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 10px;
            color: var(--text-secondary);
        }

        /* ===== ВОПРОСЫ ===== */
        .db-question-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .db-question-text {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 20px;
            line-height: 1.4;
        }
        .db-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .db-option-btn {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 16px;
            padding: 14px 16px;
            text-align: left;
            font-size: 14px;
            font-family: inherit;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s;
            touch-action: manipulation;
        }
        .db-option-btn:hover {
            background: rgba(224,224,224,0.1);
            border-color: rgba(224,224,224,0.3);
            transform: translateX(4px);
        }
        .db-question-progress {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 16px;
            text-align: center;
        }

        /* ===== РЕЖИМЫ (MODE CARDS) ===== */
        .db-mode-card {
            border-radius: 20px;
            padding: 18px;
            margin-bottom: 14px;
            cursor: pointer;
            border: 1px solid rgba(224,224,224,0.12);
            background: rgba(224,224,224,0.04);
            transition: border-color 0.2s, background 0.2s, transform 0.15s;
            display: flex;
            align-items: center;
            gap: 16px;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .db-mode-card:hover {
            background: rgba(224,224,224,0.08);
            border-color: rgba(224,224,224,0.25);
            transform: translateY(-2px);
        }
        .db-mode-card:active { transform: scale(0.98); }
        .db-mode-icon { font-size: 40px; line-height: 1; flex-shrink: 0; }
        .db-mode-body { flex: 1; min-width: 0; }
        .db-mode-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
        .db-mode-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
        .db-mode-tags { font-size: 10px; color: var(--text-secondary); margin-top: 8px; line-height: 1.6; }
        .db-mode-arrow { font-size: 18px; color: var(--silver-brushed); flex-shrink: 0; }

        /* ===== ЦЕЛИ (GOALS) ===== */
        .db-goal-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            margin-bottom: 10px;
            border-radius: 16px;
            border: 1px solid rgba(224,224,224,0.12);
            background: rgba(224,224,224,0.04);
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .db-goal-item:hover {
            background: rgba(224,224,224,0.08);
            border-color: rgba(224,224,224,0.25);
            transform: translateX(4px);
        }
        .db-goal-item:active { transform: scale(0.98); }
        .db-goal-icon { font-size: 28px; line-height: 1; flex-shrink: 0; }
        .db-goal-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .db-goal-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .db-goal-arrow { font-size: 18px; color: var(--silver-brushed); flex-shrink: 0; }

        /* ===== ФИЛЬТРЫ ===== */
        .db-filters {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-top: 16px;
        }
        .db-filters-title {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .db-filters-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .db-select {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 30px;
            padding: 8px 14px;
            color: var(--text-primary);
            font-size: 12px;
            font-family: inherit;
            outline: none;
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
        }
        .db-select:focus { border-color: rgba(224,224,224,0.35); }

        /* ===== ЛОАДЕР ===== */
        .db-loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            gap: 16px;
            text-align: center;
        }
        .db-loader-ring {
            position: relative;
            width: 64px;
            height: 64px;
        }
        .db-loader-ring::before {
            content: '';
            position: absolute;
            inset: 0;
            border: 3px solid rgba(224,224,224,0.1);
            border-radius: 50%;
        }
        .db-loader-ring::after {
            content: '';
            position: absolute;
            inset: 0;
            border: 3px solid transparent;
            border-top-color: var(--chrome);
            border-radius: 50%;
            animation: dbSpinRing 1s linear infinite;
        }
        .db-loader-icon {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        .db-progress {
            width: 100%;
            max-width: 280px;
            height: 3px;
            background: rgba(224,224,224,0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        .db-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--silver-brushed), var(--chrome));
            border-radius: 3px;
            animation: dbProgress 2.5s ease-in-out infinite;
        }
        .db-status-text {
            font-size: 12px;
            color: var(--text-secondary);
        }

        @keyframes dbSpinRing { to { transform: rotate(360deg); } }
        @keyframes dbProgress {
            0%   { width: 0%;   }
            50%  { width: 75%;  }
            100% { width: 100%; }
        }

        /* ===== КАРТОЧКА РЕЗУЛЬТАТА v2 ===== */
        .db-result-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.10);
            border-radius: 20px;
            padding: 0;
            margin-bottom: 14px;
            overflow: hidden;
            transition: transform 0.2s, border-color 0.2s;
        }
        .db-result-card:hover { border-color: rgba(224,224,224,0.2); }
        .db-card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 16px 0;
        }
        .db-card-avatar {
            width: 48px; height: 48px; border-radius: 14px;
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; flex-shrink: 0;
            background: linear-gradient(135deg, rgba(224,224,224,0.1), rgba(192,192,192,0.05));
            border: 1px solid rgba(224,224,224,0.15);
        }
        .db-card-info { flex: 1; min-width: 0; }
        .db-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-card-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap; }
        .db-card-score {
            width: 52px; height: 52px; border-radius: 50%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            flex-shrink: 0;
            background: rgba(224,224,224,0.06);
            border: 2px solid rgba(224,224,224,0.15);
        }
        .db-card-score-val { font-size: 16px; font-weight: 800; color: var(--text-primary); line-height: 1; }
        .db-card-score-pct { font-size: 8px; color: var(--text-secondary); }
        .db-card-score.high { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.08); }
        .db-card-score.mid  { border-color: rgba(224,224,224,0.25); }

        .db-card-tags {
            display: flex; gap: 5px; flex-wrap: wrap;
            padding: 10px 16px;
        }
        .db-card-tag {
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 10px;
            color: var(--text-secondary);
            white-space: nowrap;
        }

        .db-card-vectors {
            display: flex; gap: 0;
            padding: 0 16px;
            margin-bottom: 10px;
        }
        .db-card-vec {
            flex: 1; text-align: center;
            padding: 8px 0;
            border-right: 1px solid rgba(224,224,224,0.06);
        }
        .db-card-vec:last-child { border-right: none; }
        .db-card-vec-label { font-size: 9px; color: var(--text-secondary); letter-spacing: 0.5px; }
        .db-card-vec-val { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 2px 0; }
        .db-card-vec-bar { height: 3px; background: rgba(224,224,224,0.08); border-radius: 2px; margin: 0 8px; overflow: hidden; }
        .db-card-vec-fill { height: 100%; border-radius: 2px; background: rgba(224,224,224,0.3); transition: width 0.4s; }

        .db-card-insight {
            padding: 10px 16px;
            font-size: 12px; font-style: italic; color: var(--text-secondary);
            line-height: 1.5; border-top: 1px solid rgba(224,224,224,0.06);
        }

        .db-card-actions {
            display: flex; gap: 0;
            border-top: 1px solid rgba(224,224,224,0.06);
        }
        .db-card-action {
            flex: 1; padding: 12px;
            background: none; border: none; border-right: 1px solid rgba(224,224,224,0.06);
            color: var(--text-secondary); font-size: 12px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.15s;
            display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .db-card-action:last-child { border-right: none; }
        .db-card-action:hover { background: rgba(224,224,224,0.06); color: var(--text-primary); }
        .db-card-action:active { transform: scale(0.97); }
        .db-card-action.saved { color: var(--chrome); }

        /* ===== ПУСТОЕ СОСТОЯНИЕ ===== */
        .db-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 50px 20px;
            text-align: center;
            gap: 10px;
        }
        .db-empty-icon { font-size: 52px; }
        .db-empty-title { font-size: 17px; font-weight: 600; color: var(--text-primary); }
        .db-empty-sub { font-size: 13px; color: var(--text-secondary); max-width: 260px; line-height: 1.5; }

        /* ===== ИНФО-БЛОКИ ===== */
        .db-info-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 14px;
        }
        .db-info-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }
        .db-info-icon { font-size: 30px; line-height: 1; }
        .db-info-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .db-info-body {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
        }
        .db-info-example {
            background: rgba(224,224,224,0.06);
            border-radius: 10px;
            padding: 8px 12px;
            margin-top: 10px;
            font-size: 11px;
            color: var(--text-secondary);
        }

        /* ===== КОНФИ-БЛОК ===== */
        .db-privacy-card {
            background: rgba(16,185,129,0.06);
            border: 1px solid rgba(16,185,129,0.15);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 20px;
        }
        .db-privacy-card .db-info-icon { font-size: 24px; }
        .db-privacy-body {
            font-size: 11px;
            color: var(--text-secondary);
            line-height: 1.7;
        }

        /* ===== КНОПКИ ВНИЗУ ===== */
        .db-bottom-row {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .db-bottom-btn {
            flex: 1;
            padding: 13px 16px;
            border-radius: 40px;
            font-size: 13px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 44px;
            touch-action: manipulation;
            outline: none;
            text-align: center;
        }
        .db-bottom-btn:active { transform: scale(0.97); }
        .db-bottom-btn-primary {
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.25);
            color: var(--text-primary);
        }
        .db-bottom-btn-primary:hover { background: rgba(224,224,224,0.16); }
        .db-bottom-btn-secondary {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.12);
            color: var(--text-secondary);
        }
        .db-bottom-btn-secondary:hover {
            background: rgba(224,224,224,0.1);
            color: var(--text-primary);
        }

        /* ===== БОЛЬШАЯ КНОПКА СТАРТА ===== */
        .db-start-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            border-radius: 50px;
            color: var(--text-primary);
            font-weight: 700;
            font-size: 16px;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            letter-spacing: 0.3px;
            min-height: 52px;
            touch-action: manipulation;
        }
        .db-start-btn:hover { background: linear-gradient(135deg, rgba(224,224,224,0.24), rgba(192,192,192,0.16)); }
        .db-start-btn:active { transform: scale(0.98); }

        @media (max-width: 480px) {
            .db-mode-icon { font-size: 32px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ
// ============================================
let doublesState = {
    searchMode: null,      // 'twin' или 'match'
    searchGoal: null,      // 'lover', 'employee' и т.д.
    searchParams: {},      // ответы на уточняющие вопросы
    foundDoubles: [],
    filters: { distance: 'any', gender: 'any', ageFrom: null, ageTo: null }
};

let userDoublesProfile = {
    name: 'Пользователь',
    age: null, city: null, gender: null,
    profile: 'СБ-4, ТФ-4, УБ-4, ЧВ-4',
    profileType: 'АНАЛИТИК',
    vectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    thinkingLevel: 5
};

// ============================================
// УТИЛИТЫ
// ============================================
function _showToast(msg, type = 'info') {
    if (window.showToast) window.showToast(msg, type);
    else console.log(`[${type}] ${msg}`);
}

function _goHome() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
}

function _getContainer() {
    return document.getElementById('screenContainer');
}

function _api() {
    return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
}

function _userId() {
    return window.CONFIG?.USER_ID;
}

// ============================================
// ЗАГРУЗКА ПРОФИЛЯ
// ============================================
async function _loadProfile() {
    try {
        const api = _api(), uid = _userId();
        const [ctx, prof] = await Promise.all([
            fetch(`${api}/api/get-context/${uid}`).then(r => r.json()),
            fetch(`${api}/api/get-profile/${uid}`).then(r => r.json())
        ]);

        const context = ctx.context || {};
        const profile = prof.profile || {};
        const bl = profile.behavioral_levels || {};

        const avg = (arr) => Array.isArray(arr) ? arr[arr.length - 1] : (arr || 4);

        userDoublesProfile = {
            name:         localStorage.getItem('fredi_user_name') || context.name || 'Пользователь',
            age:          context.age   || null,
            city:         context.city  || null,
            gender:       context.gender || null,
            profile:      profile.display_name || `СБ-${avg(bl.СБ)}, ТФ-${avg(bl.ТФ)}, УБ-${avg(bl.УБ)}, ЧВ-${avg(bl.ЧВ)}`,
            profileType:  profile.perception_type || 'АНАЛИТИК',
            vectors:      { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) },
            thinkingLevel: profile.thinking_level || 5
        };
    } catch (e) {
        console.warn('Profile load failed:', e);
    }
}

// ============================================
// УТОЧНЯЮЩИЕ ВОПРОСЫ (ДИНАМИЧЕСКИЕ) — ПОЛНАЯ ВЕРСИЯ
// ============================================

const CLARIFYING_QUESTIONS = {
    twin: {
        getQuestions: (userProfile, currentParams) => {
            return [
                {
                    id: 'gender_preference',
                    text: 'Кого вы хотите найти?',
                    options: [
                        { value: 'any', text: '👤 Любой пол' },
                        { value: 'male', text: '👨 Мужчин' },
                        { value: 'female', text: '👩 Женщин' }
                    ]
                }
            ];
        },
        buildSearchParams: (answers) => {
            return { gender: answers.gender_preference || 'any' };
        }
    },

    lover: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            const chv = userProfile.vectors.ЧВ;
            
            if (chv >= 5) {
                questions.push({
                    id: 'intensity',
                    text: 'Какой тип страсти вы ищете?',
                    options: [
                        { value: 'extreme', text: '🔥 Экстрим, драйв, приключения' },
                        { value: 'romantic', text: '🌹 Романтика, нежность, забота' },
                        { value: 'balanced', text: '⚖️ Гармоничное сочетание' }
                    ]
                });
            } else if (chv <= 2) {
                questions.push({
                    id: 'intensity',
                    text: 'Вам нужен кто-то, кто разбудит чувства, или спокойный партнёр?',
                    options: [
                        { value: 'awaken', text: '🔥 Разбудить эмоции и страсть' },
                        { value: 'calm', text: '🌊 Спокойный и нежный' }
                    ]
                });
            } else {
                questions.push({
                    id: 'intensity',
                    text: 'Какая атмосфера вам ближе?',
                    options: [
                        { value: 'passionate', text: '🔥 Страстная и яркая' },
                        { value: 'tender', text: '💕 Нежная и романтичная' },
                        { value: 'playful', text: '🎭 Игривая и лёгкая' }
                    ]
                });
            }
            
            questions.push({
                id: 'format',
                text: 'Какой формат отношений вам подходит?',
                options: [
                    { value: 'regular', text: '📅 Регулярные встречи (1-2 раза в неделю)' },
                    { value: 'rare', text: '✨ Редко, но ярко (раз в месяц)' },
                    { value: 'open', text: '🕊️ Свободные, без обязательств' },
                    { value: 'serious', text: '💍 С перспективой серьёзных отношений' }
                ]
            });
            
            if (!currentParams.age_range) {
                questions.push({
                    id: 'age_range',
                    text: 'Какой возраст партнёра вам интересен?',
                    options: [
                        { value: 'younger', text: '🪶 Моложе меня' },
                        { value: 'same', text: '👥 Мой возраст (±3 года)' },
                        { value: 'older', text: '🦉 Старше меня' },
                        { value: 'any', text: '🌍 Не важно' }
                    ]
                });
            }
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                intensity: answers.intensity || 'balanced',
                format: answers.format || 'regular',
                age_range: answers.age_range || 'any'
            };
        }
    },

    spouse: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            const weakSpots = [];
            if (userProfile.vectors.СБ < 3) weakSpots.push('стратегическое мышление');
            if (userProfile.vectors.ТФ < 3) weakSpots.push('гибкость и адаптивность');
            if (userProfile.vectors.УБ < 3) weakSpots.push('надёжность и безопасность');
            if (userProfile.vectors.ЧВ < 3) weakSpots.push('эмоциональный интеллект');
            
            if (weakSpots.length > 0) {
                questions.push({
                    id: 'compensation',
                    text: `Что для вас важнее всего в партнёре? (у вас развито ${weakSpots.join(', ')})`,
                    options: [
                        { value: 'balance', text: '⚖️ Чтобы дополнял мои слабые стороны' },
                        { value: 'similar', text: '👥 Чтобы был похож на меня' },
                        { value: 'support', text: '🤝 Чтобы поддерживал и вдохновлял' }
                    ]
                });
            }
            
            questions.push({
                id: 'family_values',
                text: 'Какие семейные ценности для вас приоритет?',
                options: [
                    { value: 'traditional', text: '🏠 Традиционные (дети, дом, уют)' },
                    { value: 'modern', text: '💼 Современные (карьера + семья)' },
                    { value: 'free', text: '🕊️ Свободные (партнёрство без рамок)' }
                ]
            });
            
            questions.push({
                id: 'children',
                text: 'Отношение к детям?',
                options: [
                    { value: 'want', text: '👶 Хочу детей' },
                    { value: 'maybe', text: '🤔 Пока не решил(а)' },
                    { value: 'no', text: '🚫 Не хочу детей' },
                    { value: 'have', text: '👨‍👩‍👧 Уже есть дети' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                compensation: answers.compensation || 'balance',
                family_values: answers.family_values || 'modern',
                children: answers.children || 'maybe'
            };
        }
    },

    friend: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            
            questions.push({
                id: 'interests',
                text: 'Какие интересы должны быть общими?',
                options: [
                    { value: 'hobbies', text: '🎨 Хобби и увлечения' },
                    { value: 'work', text: '💼 Работа и карьера' },
                    { value: 'philosophy', text: '🧠 Мировоззрение и ценности' },
                    { value: 'all', text: '🌟 Всё перечисленное' }
                ]
            });
            
            questions.push({
                id: 'communication',
                text: 'Как часто вы хотите общаться?',
                options: [
                    { value: 'daily', text: '💬 Ежедневно' },
                    { value: 'weekly', text: '📅 Пару раз в неделю' },
                    { value: 'rare', text: '🌙 Изредка, но душевно' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                interests: answers.interests || 'all',
                communication: answers.communication || 'weekly'
            };
        }
    },

    companion: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            const sb = userProfile.vectors.СБ;
            
            if (sb >= 4) {
                questions.push({
                    id: 'role',
                    text: 'Какую роль должен закрыть партнёр?',
                    options: [
                        { value: 'executor', text: '📋 Исполнитель (реализовывать идеи)' },
                        { value: 'finance', text: '💰 Финансист (деньги и риски)' },
                        { value: 'operations', text: '⚙️ Операционный директор (процессы)' },
                        { value: 'equal', text: '🤝 Равный партнёр (разделять всё)' }
                    ]
                });
            } else {
                questions.push({
                    id: 'role',
                    text: 'Какой тип партнёра вам нужен?',
                    options: [
                        { value: 'strategist', text: '🎯 Стратег (видеть цель и пути)' },
                        { value: 'executor', text: '📋 Надёжный исполнитель' },
                        { value: 'mentor', text: '🦉 Наставник и инвестор' }
                    ]
                });
            }
            
            questions.push({
                id: 'risk',
                text: 'Ваше отношение к риску в бизнесе?',
                options: [
                    { value: 'low', text: '🛡️ Низкий (стабильность и предсказуемость)' },
                    { value: 'medium', text: '⚖️ Средний (просчитанные риски)' },
                    { value: 'high', text: '🚀 Высокий (быстрый рост, стартап)' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                role: answers.role || 'equal',
                risk_tolerance: answers.risk || 'medium'
            };
        }
    },

    employee: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            
            questions.push({
                id: 'position',
                text: 'На какую роль ищете сотрудника?',
                options: [
                    { value: 'junior', text: '🌱 Junior (обучаемый, недорогой)' },
                    { value: 'middle', text: '📈 Middle (самодостаточный)' },
                    { value: 'senior', text: '🏆 Senior (эксперт, дорогой)' },
                    { value: 'lead', text: '👑 Team Lead (управлять людьми)' }
                ]
            });
            
            questions.push({
                id: 'qualities',
                text: 'Какие качества важнее всего?',
                options: [
                    { value: 'discipline', text: '⏰ Дисциплина и исполнительность' },
                    { value: 'initiative', text: '💡 Инициативность и креатив' },
                    { value: 'loyalty', text: '🤝 Лояльность и надёжность' },
                    { value: 'growth', text: '📚 Готовность расти' }
                ]
            });
            
            questions.push({
                id: 'format',
                text: 'Формат работы?',
                options: [
                    { value: 'office', text: '🏢 Офис' },
                    { value: 'remote', text: '🏠 Удалённо' },
                    { value: 'hybrid', text: '🔄 Гибрид' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                position: answers.position || 'middle',
                qualities: answers.qualities || 'discipline',
                work_format: answers.format || 'remote'
            };
        }
    },

    boss: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            
            questions.push({
                id: 'style',
                text: 'Какой стиль управления вам подходит?',
                options: [
                    { value: 'democratic', text: '🗳️ Демократичный (обсуждать решения)' },
                    { value: 'autocratic', text: '👑 Авторитарный (чёткие указания)' },
                    { value: 'mentor', text: '🦉 Менторский (учить и развивать)' },
                    { value: 'laissez', text: '🌊 Либеральный (давать свободу)' }
                ]
            });
            
            questions.push({
                id: 'expectations',
                text: 'Что вы ждёте от начальника?',
                options: [
                    { value: 'growth', text: '📈 Карьерный рост и развитие' },
                    { value: 'stability', text: '🛡️ Стабильность и защиту' },
                    { value: 'freedom', text: '🕊️ Свободу и доверие' },
                    { value: 'money', text: '💰 Высокий доход' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                management_style: answers.style || 'democratic',
                expectations: answers.expectations || 'growth'
            };
        }
    },

    mentor: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            const weakVectors = [];
            if (userProfile.vectors.СБ < 4) weakVectors.push('стратегия и видение');
            if (userProfile.vectors.ТФ < 4) weakVectors.push('гибкость и адаптивность');
            if (userProfile.vectors.ЧВ < 4) weakVectors.push('эмоциональный интеллект');
            
            const areaText = weakVectors.length > 0 
                ? `В какой области нужен ментор? (ваши зоны роста: ${weakVectors.join(', ')})`
                : 'В какой области нужен ментор?';
            
            questions.push({
                id: 'area',
                text: areaText,
                options: [
                    { value: 'career', text: '💼 Карьера и бизнес' },
                    { value: 'personal', text: '🧠 Личностный рост' },
                    { value: 'emotional', text: '💖 Эмоциональный интеллект' },
                    { value: 'spiritual', text: '🕯️ Духовное развитие' }
                ]
            });
            
            questions.push({
                id: 'format',
                text: 'Какой формат менторства предпочитаете?',
                options: [
                    { value: 'regular', text: '📅 Регулярные сессии (раз в неделю)' },
                    { value: 'project', text: '🎯 Проектный (под конкретную задачу)' },
                    { value: 'crisis', text: '🆘 Кризисный (когда нужна помощь)' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                mentor_area: answers.area || 'career',
                mentor_format: answers.format || 'regular'
            };
        }
    },

    travel: {
        getQuestions: (userProfile, currentParams) => {
            const questions = [];
            
            questions.push({
                id: 'travel_type',
                text: 'Какой тип путешествий предпочитаете?',
                options: [
                    { value: 'adventure', text: '🏔️ Активный (горы, походы, экстрим)' },
                    { value: 'cultural', text: '🏛️ Культурный (музеи, экскурсии)' },
                    { value: 'relax', text: '🏖️ Расслабленный (пляж, спа)' },
                    { value: 'spontaneous', text: '🎲 Спонтанный (куда глаза глядят)' }
                ]
            });
            
            questions.push({
                id: 'budget',
                text: 'Какой бюджет на поездки?',
                options: [
                    { value: 'budget', text: '🎒 Бюджетный (хостелы, автобусы)' },
                    { value: 'comfort', text: '🏨 Комфортный (отели, рестораны)' },
                    { value: 'luxury', text: '💎 Люкс (5 звёзд, бизнес-класс)' }
                ]
            });
            
            return questions;
        },
        buildSearchParams: (answers) => {
            return {
                travel_type: answers.travel_type || 'adventure',
                budget: answers.budget || 'comfort'
            };
        }
    }
};

// ============================================
// РАСЧЁТ СОВМЕСТИМОСТИ (ДЕФИЦИТ-ОРИЕНТИРОВАННЫЙ) — ПОЛНАЯ ВЕРСИЯ
// ============================================

function _calculateCompatibility(user, candidate, goal, params) {
    const u = user.vectors;
    const c = candidate.vectors;
    
    switch(goal) {
        case 'twin':
            return Math.round(100 - (
                Math.abs(u.СБ - c.СБ) * 10 +
                Math.abs(u.ТФ - c.ТФ) * 10 +
                Math.abs(u.УБ - c.УБ) * 10 +
                Math.abs(u.ЧВ - c.ЧВ) * 10
            ));
            
        case 'lover':
            let score = 0;
            if (params.intensity === 'extreme') score += Math.min(35, c.ЧВ * 7);
            else if (params.intensity === 'romantic') score += Math.min(30, (6 - Math.abs(u.ЧВ - c.ЧВ)) * 6);
            else if (params.intensity === 'awaken') score += Math.min(40, c.ЧВ * 8);
            else if (params.intensity === 'calm') score += 30 - Math.abs(u.ЧВ - c.ЧВ) * 5;
            else score += 25 - Math.abs(u.ЧВ - c.ЧВ) * 4;
            
            if (u.ЧВ < 3 && c.ЧВ > 4) score += 15;
            if (u.ТФ < 3 && c.ТФ > 4) score += 10;
            
            score += 30 - Math.abs(u.УБ - c.УБ) * 6;
            score += 20 - Math.abs(u.СБ - c.СБ) * 5;
            
            return Math.min(98, Math.max(0, Math.round(score)));
            
        case 'spouse':
            let spouseScore = 0;
            if (Math.abs(u.УБ - c.УБ) <= 1) spouseScore += 40;
            else if (Math.abs(u.УБ - c.УБ) <= 2) spouseScore += 20;
            else spouseScore += 5;
            
            if (params.compensation === 'balance') {
                if (u.СБ < 3 && c.СБ > 4) spouseScore += 10;
                if (u.ТФ < 3 && c.ТФ > 4) spouseScore += 10;
                if (u.УБ < 3 && c.УБ > 4) spouseScore += 15;
                if (u.ЧВ < 3 && c.ЧВ > 4) spouseScore += 10;
            } else if (params.compensation === 'similar') {
                spouseScore += 30 - (Math.abs(u.СБ - c.СБ) + Math.abs(u.ТФ - c.ТФ) + 
                                     Math.abs(u.УБ - c.УБ) + Math.abs(u.ЧВ - c.ЧВ)) * 3;
            }
            
            if (params.family_values === 'traditional') spouseScore += 10;
            if (params.children === 'want') spouseScore += 5;
            
            return Math.min(98, Math.max(0, Math.round(spouseScore)));
            
        case 'employee':
            let empScore = 0;
            if (params.position === 'junior') empScore += c.УБ * 5;
            else empScore += c.УБ * 8;
            
            if (params.qualities === 'discipline') empScore += c.ТФ * 8;
            else empScore += c.ТФ * 5;
            
            if (u.СБ > 4 && c.ТФ > 4) empScore += 15;
            if (u.ТФ > 4 && c.УБ > 4) empScore += 10;
            
            return Math.min(98, Math.round(empScore));
            
        case 'companion':
            let compScore = 0;
            if (params.role === 'strategist' && c.СБ > 4) compScore += 40;
            else if (params.role === 'executor' && c.ТФ > 4) compScore += 40;
            else if (params.role === 'equal') {
                compScore += 30 - Math.abs(u.СБ - c.СБ) * 5;
                compScore += 30 - Math.abs(u.ТФ - c.ТФ) * 5;
            } else if (params.role === 'finance' && c.УБ > 4) compScore += 35;
            else if (params.role === 'operations' && c.ТФ > 4 && c.УБ > 4) compScore += 40;
            
            if (params.risk_tolerance === 'low' && c.УБ > 4) compScore += 20;
            else if (params.risk_tolerance === 'high' && c.УБ < 3) compScore += 20;
            else compScore += 10;
            
            return Math.min(98, Math.round(compScore));
            
        case 'friend':
            let friendScore = 50;
            friendScore += 25 - (Math.abs(u.СБ - c.СБ) + Math.abs(u.ТФ - c.ТФ)) * 3;
            friendScore += 25 - (Math.abs(u.УБ - c.УБ) + Math.abs(u.ЧВ - c.ЧВ)) * 2;
            return Math.min(98, Math.max(0, Math.round(friendScore)));
            
        case 'mentor':
            let mentorScore = 0;
            if (params.mentor_area === 'career') {
                mentorScore += c.СБ > u.СБ ? 40 : 20;
                mentorScore += c.УБ > u.УБ ? 20 : 10;
            } else if (params.mentor_area === 'emotional') {
                mentorScore += c.ЧВ > u.ЧВ ? 50 : 25;
            } else {
                mentorScore += c.СБ > u.СБ ? 30 : 15;
                mentorScore += c.ЧВ > u.ЧВ ? 30 : 15;
            }
            
            mentorScore += c.ТФ * 5;
            
            return Math.min(98, Math.round(mentorScore));
            
        case 'boss':
            let bossScore = 0;
            if (params.management_style === 'autocratic') {
                bossScore += c.СБ * 8;
                bossScore += c.ЧВ * 6;
            } else if (params.management_style === 'democratic') {
                bossScore += c.СБ * 6;
                bossScore += c.ТФ * 6;
            } else if (params.management_style === 'mentor') {
                bossScore += c.СБ * 7;
                bossScore += c.ЧВ * 7;
            } else {
                bossScore += c.ЧВ * 8;
                bossScore += c.ТФ * 6;
            }
            
            bossScore += c.УБ * 5;
            
            return Math.min(98, Math.round(bossScore));
            
        case 'travel':
            let travelScore = 60;
            travelScore += c.ТФ * 8;
            travelScore += c.ЧВ * 5;
            if (params.travel_type === 'adventure') travelScore += c.УБ * 3;
            else travelScore += c.УБ * 6;
            
            return Math.min(98, Math.round(travelScore));
            
        default:
            return 50;
    }
}

function _generateInsight(similarity, goal, params, candidate) {
    if (similarity >= 90) {
        if (goal === 'lover') return 'Искра 💥 Идеальная химия! У вас все шансы на яркий роман.';
        if (goal === 'spouse') return '🏆 Идеальный партнёр для семьи. Высокая совместимость по всем параметрам.';
        if (goal === 'employee') return '⭐ Идеальный кандидат! Рекомендуем пригласить на собеседование.';
        if (goal === 'mentor') return '🎓 Этот ментор может стать вашим наставником на годы вперёд.';
        if (goal === 'companion') return '🤝 Идеальная бизнес-синергия. Пора обсуждать合作!';
        return 'Идеальное совпадение! Рекомендуем начать общение.';
    }
    
    if (similarity >= 75) {
        if (goal === 'lover') return '💕 Отличная совместимость. Стоит присмотреться, потенциал высок.';
        if (goal === 'companion') return '🤝 Хорошая бизнес-синергия. Есть смысл обсудить сотрудничество.';
        if (goal === 'employee') return '📊 Хороший кандидат. Рекомендуется собеседование.';
        return 'Очень хороший вариант. Рекомендуем познакомиться ближе.';
    }
    
    if (similarity >= 60) {
        if (goal === 'lover') return '🌱 Неплохая основа. Возможно, стоит узнать человека лучше.';
        if (goal === 'spouse') return '🏠 Есть потенциал для семьи. Стоит присмотреться.';
        return 'Неплохая база для отношений. Возможно, стоит узнать человека лучше.';
    }
    
    if (goal === 'lover') return '🎭 Разные темпераменты, но иногда противоположности притягиваются.';
    if (goal === 'employee') return '📋 Кандидат требует дополнительного обучения.';
    return 'Есть некоторые различия, но иногда это даёт интересный опыт.';
}

// ============================================
// ШАБЛОНЫ HTML
// ============================================

function _ownCardHtml() {
    const v = userDoublesProfile.vectors;
    const meta = [
        userDoublesProfile.age ? userDoublesProfile.age + ' лет' : '',
        userDoublesProfile.city ? '· ' + userDoublesProfile.city : ''
    ].filter(Boolean).join(' ');

    return `
        <div class="db-own-card">
            <div class="db-own-top">
                <div>
                    <div class="db-own-name">${userDoublesProfile.name}</div>
                    ${meta ? `<div class="db-own-meta">${meta}</div>` : ''}
                </div>
                <div class="db-own-code">${userDoublesProfile.profile}</div>
            </div>
            <div class="db-vectors">
                <span class="db-vector-tag">СБ ${v.СБ}/6</span>
                <span class="db-vector-tag">ТФ ${v.ТФ}/6</span>
                <span class="db-vector-tag">УБ ${v.УБ}/6</span>
                <span class="db-vector-tag">ЧВ ${v.ЧВ}/6</span>
            </div>
        </div>`;
}

function _pageWrap(content) {
    return `<div class="full-content-page">${content}</div>`;
}

function _backBtn(id = 'dbBack') {
    return `<button class="back-btn" id="${id}">◀️ НАЗАД</button>`;
}

function _header(emoji, title, sub = '') {
    return `
        <div class="content-header">
            <div class="content-emoji">${emoji}</div>
            <h1 class="content-title">${title}</h1>
            ${sub ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px">${sub}</p>` : ''}
        </div>`;
}

// ============================================
// ЭКРАНЫ
// ============================================

function _renderIntro(container) {
    if (localStorage.getItem('doubles_intro_seen')) {
        _renderModes(container);
        return;
    }

    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header('🔮', 'Психометрический поиск', 'Что это и зачем нужно')}
        <div class="content-body">
            <div class="db-info-card">
                <div class="db-info-header">
                    <div class="db-info-icon">🧬</div>
                    <div class="db-info-title">Ваш психометрический профиль</div>
                </div>
                <div class="db-info-body">
                    Это ваша «внутренняя ОС» — набор поведенческих векторов (СБ, ТФ, УБ, ЧВ),
                    который определяет, как вы мыслите, чувствуете и действуете.
                </div>
                <div class="db-info-example">
                    ${userDoublesProfile.profile} &nbsp;|&nbsp; ${userDoublesProfile.profileType}
                </div>
            </div>

            <div class="db-info-card">
                <div class="db-info-header">
                    <div class="db-info-icon">👥</div>
                    <div class="db-info-title">Режим «ДВОЙНИК»</div>
                </div>
                <div class="db-info-body">
                    Находит людей с максимально похожим профилем. Помогает увидеть альтернативные
                    пути развития, понять паттерны со стороны, почувствовать родство.
                </div>
            </div>

            <div class="db-info-card">
                <div class="db-info-header">
                    <div class="db-info-icon">🎯</div>
                    <div class="db-info-title">Режим «ПОДБОР ПО ЦЕЛИ»</div>
                </div>
                <div class="db-info-body">
                    AI задаст уточняющие вопросы, проанализирует ваш профиль и найдёт людей,
                    чей психотип идеально подходит для вашей цели.
                </div>
            </div>

            <div class="db-privacy-card">
                <div class="db-info-header">
                    <div class="db-info-icon">🔒</div>
                    <div class="db-info-title">Конфиденциальность</div>
                </div>
                <div class="db-privacy-body">
                    • Ваш профиль используется анонимно<br>
                    • Другие видят только имя, возраст, город и % совместимости<br>
                    • Контакты раскрываются только при взаимном согласии
                </div>
            </div>

            <button class="db-start-btn" id="dbStartBtn">✦ НАЧАТЬ ПОИСК</button>
        </div>
    `);

    document.getElementById('dbBack').onclick = () => _goHome();
    document.getElementById('dbStartBtn').onclick = () => {
        localStorage.setItem('doubles_intro_seen', 'true');
        _renderModes(container);
    };
}

function _renderModes(container) {
    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header('🔮', 'Психометрический поиск')}
        <div class="content-body">
            ${_ownCardHtml()}

            <div class="db-mode-card" id="dbTwinBtn">
                <div class="db-mode-icon">👥</div>
                <div class="db-mode-body">
                    <div class="db-mode-name">ДВОЙНИК</div>
                    <div class="db-mode-desc">Найти людей с похожим профилем</div>
                    <div class="db-mode-tags">
                        📊 Альтернативные пути · 🔍 Понять паттерны · 🤝 Не быть одному
                    </div>
                </div>
                <div class="db-mode-arrow">›</div>
            </div>

            <div class="db-mode-card" id="dbMatchBtn">
                <div class="db-mode-icon">🎯</div>
                <div class="db-mode-body">
                    <div class="db-mode-name">ПОДБОР ПО ЦЕЛИ</div>
                    <div class="db-mode-desc">Найти идеального кандидата под задачу</div>
                    <div class="db-mode-tags">
                        💕 Любовник · 💍 Муж/жена · 👥 Друг · 🤝 Партнёр · 👔 Сотрудник · 🦉 Ментор
                    </div>
                </div>
                <div class="db-mode-arrow">›</div>
            </div>

            <div style="background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.08);border-radius:14px;padding:10px 14px;margin-top:8px;text-align:center;font-size:11px;color:var(--text-secondary);">
                🔒 Анонимно · 🎯 Точно · 🧠 На основе психометрики
            </div>
        </div>
    `);

    document.getElementById('dbBack').onclick = () => _goHome();
    document.getElementById('dbTwinBtn').onclick = () => {
        doublesState.searchMode = 'twin';
        _renderGoals(container);
    };
    document.getElementById('dbMatchBtn').onclick = () => {
        doublesState.searchMode = 'match';
        _renderGoals(container);
    };
}

function _renderGoals(container) {
    const isTwin = doublesState.searchMode === 'twin';
    const goals = isTwin ? ['twin'] : ['lover', 'spouse', 'friend', 'companion', 'employee', 'boss', 'mentor', 'travel'];
    
    const goalNames = {
        lover: { emoji: '💕', name: 'Любовник / Любовница', desc: 'Страсть, романтика, влечение' },
        spouse: { emoji: '💍', name: 'Муж / Жена', desc: 'Семья, стабильность, общее будущее' },
        friend: { emoji: '👥', name: 'Друг', desc: 'Поддержка, общение, доверие' },
        companion: { emoji: '🤝', name: 'Бизнес-партнёр', desc: 'Проекты, капитал, синергия' },
        employee: { emoji: '👔', name: 'Сотрудник', desc: 'Работа, команда, исполнительность' },
        boss: { emoji: '👑', name: 'Начальник', desc: 'Карьера, лидерство, рост' },
        mentor: { emoji: '🦉', name: 'Ментор', desc: 'Мудрость, обучение, развитие' },
        travel: { emoji: '✈️', name: 'Попутчик', desc: 'Путешествия, приключения' },
        twin: { emoji: '👥', name: 'Двойник', desc: 'Похожий психотип' }
    };
    
    const goalsHtml = goals.map(id => {
        const g = goalNames[id];
        return `
            <div class="db-goal-item" data-goal="${id}">
                <div class="db-goal-icon">${g.emoji}</div>
                <div style="flex:1;min-width:0">
                    <div class="db-goal-name">${g.name}</div>
                    <div class="db-goal-desc">${g.desc}</div>
                </div>
                <div class="db-goal-arrow">›</div>
            </div>`;
    }).join('');
    
    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header(isTwin ? '👥' : '🎯',
                  isTwin ? 'Поиск двойника' : 'Кого вы ищете?',
                  isTwin ? 'Люди с похожим психотипом'
                         : 'Выберите цель, затем ответьте на вопросы для точного подбора')}
        <div class="content-body">
            ${goalsHtml}
        </div>
    `);
    
    document.getElementById('dbBack').onclick = () => _renderModes(container);
    
    document.querySelectorAll('.db-goal-item').forEach(el => {
        el.addEventListener('click', () => {
            doublesState.searchGoal = el.dataset.goal;
            doublesState.searchParams = {};
            _startQuestions(container);
        });
    });
}

function _startQuestions(container) {
    const goal = doublesState.searchGoal;
    const questionDef = CLARIFYING_QUESTIONS[goal];
    
    if (!questionDef) {
        _renderSearching(container);
        _doSearch(container);
        return;
    }
    
    const questions = questionDef.getQuestions(userDoublesProfile, doublesState.searchParams);
    
    if (!questions.length) {
        _renderSearching(container);
        _doSearch(container);
        return;
    }
    
    _renderQuestion(container, 0, questions);
}

function _renderQuestion(container, questionIndex, questions) {
    if (questionIndex >= questions.length) {
        _renderSearching(container);
        _doSearch(container);
        return;
    }
    
    const currentQ = questions[questionIndex];
    const progress = `${questionIndex + 1}/${questions.length}`;
    
    const optionsHtml = currentQ.options.map(opt => `
        <button class="db-option-btn" data-value="${opt.value}">
            ${opt.text}
        </button>
    `).join('');
    
    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header('❓', 'Уточняющие вопросы')}
        <div class="content-body">
            <div class="db-question-card">
                <div class="db-question-text">${currentQ.text}</div>
                <div class="db-options" id="dbOptions">
                    ${optionsHtml}
                </div>
                <div class="db-question-progress">Вопрос ${progress}</div>
            </div>
        </div>
    `);
    
    document.getElementById('dbBack').onclick = () => {
        if (questionIndex === 0) {
            _renderGoals(container);
        } else {
            _renderQuestion(container, questionIndex - 1, questions);
        }
    };
    
    document.querySelectorAll('.db-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            doublesState.searchParams[currentQ.id] = btn.dataset.value;
            
            btn.style.transform = 'scale(0.98)';
            setTimeout(() => { btn.style.transform = ''; }, 150);
            
            _renderQuestion(container, questionIndex + 1, questions);
        });
    });
}

function _renderSearching(container) {
    const goalNames = {
        lover: 'Любовника', spouse: 'Муж/Жену', friend: 'Друга',
        companion: 'Партнёра', employee: 'Сотрудника', boss: 'Начальника',
        mentor: 'Ментора', travel: 'Попутчика', twin: 'Двойника'
    };
    const goalName = goalNames[doublesState.searchGoal] || 'кандидата';
    
    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header('🔍', `Поиск: ${goalName}`)}
        <div class="content-body">
            <div class="db-loader">
                <div class="db-loader-ring">
                    <div class="db-loader-icon">🧠</div>
                </div>
                <div class="db-progress"><div class="db-progress-fill"></div></div>
                <div class="db-status-text" id="dbStatusText">Анализирую ваш профиль...</div>
            </div>
        </div>
    `);
    
    document.getElementById('dbBack').onclick = () => _startQuestions(container);
}

// ============================================
// УНИВЕРСАЛЬНЫЙ ПОИСК (поддерживает оба API)
// ============================================
async function _doSearch(container) {
    const steps = [
        'Анализирую ваш профиль...',
        'Рассчитываю параметры поиска...',
        'Ищу совпадения в базе...',
        'Сортирую по совместимости...',
        'Генерирую инсайты...'
    ];
    let step = 0;
    const tick = setInterval(() => {
        const el = document.getElementById('dbStatusText');
        if (el && step < steps.length) el.textContent = steps[step++];
    }, 700);

    try {
        const api = _api();
        const uid = _userId();
        const goal = doublesState.searchGoal;
        const questionDef = CLARIFYING_QUESTIONS[goal];
        const params = questionDef ? questionDef.buildSearchParams(doublesState.searchParams) : {};
        
        // Пробуем сначала использовать специализированный эндпоинт
        let url = `${api}/api/psychometric/find-doubles?user_id=${uid}&mode=${doublesState.searchMode}`;
        if (doublesState.searchGoal) url += `&goal=${doublesState.searchGoal}`;
        if (doublesState.filters.distance !== 'any') url += `&distance=${doublesState.filters.distance}`;
        if (doublesState.filters.gender !== 'any') url += `&gender=${doublesState.filters.gender}`;
        
        let response = await fetch(url);
        let data = await response.json();
        
        let candidates = [];
        
        // Если специализированный эндпоинт вернул успех
        if (data.success) {
            // Объединяем doubles + nearby (как в патче)
            candidates = [].concat(data.results || [], data.doubles || [], data.nearby || []);
            
            // Сохраняем векторы профиля из ответа
            if (data.your_profile && data.your_profile.vectors) {
                userDoublesProfile.vectors = data.your_profile.vectors;
            }
        } else {
            // Fallback: используем общий список пользователей
            console.log('Falling back to /api/users/list');
            const usersResponse = await fetch(`${api}/api/users/list?limit=200`);
            const usersData = await usersResponse.json();
            const allUsers = usersData.users || [];
            
            candidates = allUsers.filter(u => u.user_id !== uid && u.vectors);
        }
        
        // Рассчитываем совместимость для каждого кандидата
        const results = candidates.map(candidate => {
            const similarity = _calculateCompatibility(
                userDoublesProfile, 
                candidate, 
                goal, 
                params
            );
            const insight = _generateInsight(similarity, goal, params, candidate);
            
            return {
                user_id: candidate.user_id,
                name: candidate.name || 'Пользователь',
                age: candidate.age,
                city: candidate.city,
                gender: candidate.gender,
                vectors: candidate.vectors,
                profile: candidate.profile || userDoublesProfile.profile,
                profile_type: candidate.profile_type,
                similarity: similarity,
                insight: insight
            };
        });
        
        // Сортируем и берем топ-30
        doublesState.foundDoubles = results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 30);
        
        clearInterval(tick);
        
    } catch (e) {
        clearInterval(tick);
        console.error('Search failed:', e);
        doublesState.foundDoubles = [];
        _showToast('❌ Ошибка поиска. Попробуйте позже.', 'error');
    }
    
    _renderResults(container);
}

function _renderResults(container) {
    const isTwin = doublesState.searchMode === 'twin';
    const results = doublesState.foundDoubles;
    const goalNames = {
        lover: '💕 Любовник', spouse: '💍 Муж/Жена', friend: '👥 Друг',
        companion: '🤝 Партнёр', employee: '👔 Сотрудник', boss: '👑 Начальник',
        mentor: '🦉 Ментор', travel: '✈️ Попутчик', twin: '👥 Двойник'
    };
    const goalName = goalNames[doublesState.searchGoal] || 'Кандидаты';
    const v0 = userDoublesProfile.vectors;
    
    let cardsHtml = '';
    
    if (!results.length) {
        cardsHtml = `
            <div class="db-empty">
                <div class="db-empty-icon">🔍</div>
                <div class="db-empty-title">Пока ничего не найдено</div>
                <div class="db-empty-sub">
                    ${isTwin
                        ? 'Ваш профиль уникален в нашей базе.'
                        : `Подходящих кандидатов для "${goalName}" пока нет.`}
                    <br>База пополняется ежедневно — загляните позже!
                </div>
            </div>`;
    } else {
        results.forEach((item, idx) => {
            const sim = item.similarity;
            const v = item.vectors || v0;
            const scoreClass = sim >= 75 ? 'high' : sim >= 40 ? 'mid' : '';
            const avatarEmoji = item.gender === 'female' ? '👩' : (item.gender === 'male' ? '👨' : '👤');
            const initial = (item.name && item.name !== 'Пользователь') ? item.name.charAt(0).toUpperCase() : avatarEmoji;
            const age = item.age ? `${item.age} лет` : '';
            const city = item.city || '';
            const metaParts = [age, city].filter(Boolean).join(' · ');

            // Tags: profile type, thinking level, attachment
            const tags = [];
            if (item.profile_type) tags.push(item.profile_type);
            if (item.thinking_level) tags.push(`Мышление ${item.thinking_level}/9`);
            if (item.attachment) tags.push(item.attachment);
            if (item.profile_code) tags.push(item.profile_code);

            cardsHtml += `
                <div class="db-result-card" style="animation:mirrorFadeIn ${0.2 + idx * 0.05}s ease">
                    <div class="db-card-header">
                        <div class="db-card-avatar">${initial}</div>
                        <div class="db-card-info">
                            <div class="db-card-name">${item.name || 'Пользователь'}</div>
                            ${metaParts ? `<div class="db-card-meta"><span>📍 ${metaParts}</span></div>` : ''}
                        </div>
                        <div class="db-card-score ${scoreClass}">
                            <div class="db-card-score-val">${sim}</div>
                            <div class="db-card-score-pct">%</div>
                        </div>
                    </div>

                    ${tags.length ? `<div class="db-card-tags">${tags.map(t => `<span class="db-card-tag">${t}</span>`).join('')}</div>` : ''}

                    <div class="db-card-vectors">
                        ${['СБ', 'ТФ', 'УБ', 'ЧВ'].map(k => {
                            const val = v[k] || 4;
                            return `<div class="db-card-vec">
                                <div class="db-card-vec-label">${k}</div>
                                <div class="db-card-vec-val">${val}</div>
                                <div class="db-card-vec-bar"><div class="db-card-vec-fill" style="width:${(val / 6) * 100}%"></div></div>
                            </div>`;
                        }).join('')}
                    </div>

                    <div class="db-card-insight">💡 ${item.insight}</div>

                    <div class="db-card-actions">
                        <button class="db-card-action db-msg-btn" data-id="${item.user_id}" data-name="${(item.name || 'Пользователь').replace(/"/g, '&quot;')}">💬 Написать</button>
                        <button class="db-card-action db-view-btn" data-id="${item.user_id}">👤 Профиль</button>
                    </div>
                </div>`;
        });
    }
    
    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header(isTwin ? '👥' : '🎯',
                  isTwin ? 'Ваши двойники' : `Результаты: ${goalName}`,
                  `Найдено ${results.length} человек`)}
        <div class="content-body">
            ${cardsHtml}
            <div class="db-bottom-row" style="padding-bottom:max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))">
                <button class="db-bottom-btn db-bottom-btn-primary" id="dbNewSearch">🔄 Новый поиск</button>
                <button class="db-bottom-btn db-bottom-btn-secondary" id="dbChangeGoal">🎯 Другая цель</button>
            </div>
        </div>
    `);
    
    document.getElementById('dbBack').onclick = () => _renderModes(container);
    document.getElementById('dbNewSearch').onclick = () => _renderModes(container);
    document.getElementById('dbChangeGoal').onclick = () => _renderGoals(container);
    
    document.querySelectorAll('.db-view-btn').forEach(b =>
        b.addEventListener('click', () => _showToast('👤 Полный профиль — скоро', 'info')));
    document.querySelectorAll('.db-msg-btn').forEach(b =>
        b.addEventListener('click', async function() {
            const partnerId = parseInt(this.dataset.id);
            const partnerName = this.dataset.name;
            const uid = _userId();
            this.innerHTML = '⏳...';
            this.disabled = true;
            try {
                const api = _api();
                const res = await fetch(`${api}/api/chats/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id_1: uid, user_id_2: partnerId })
                });
                const data = await res.json();
                if (data.success && data.chat_id) {
                    if (typeof window.openChat === 'function') {
                        window.openChat(data.chat_id);
                    } else if (typeof window.showMessagesScreen === 'function') {
                        window.showMessagesScreen();
                    }
                    _showToast(`💬 Чат с ${partnerName} открыт`, 'success');
                } else {
                    _showToast('❌ Не удалось создать чат', 'error');
                    this.innerHTML = '💬 Написать';
                    this.disabled = false;
                }
            } catch(e) {
                console.error('Chat create error:', e);
                _showToast('❌ Ошибка создания чата', 'error');
                this.innerHTML = '💬 Написать';
                this.disabled = false;
            }
        }));
}

// ============================================
// ГЛАВНАЯ ТОЧКА ВХОДА
// ============================================
async function showDoublesScreen() {
    try {
        const api = _api(), uid = _userId();
        if (!uid) {
            _showToast('⚠️ Ошибка авторизации', 'error');
            return;
        }
        
        const r = await fetch(`${api}/api/user-status?user_id=${uid}`);
        const d = await r.json();
        if (!d.has_profile) {
            _showToast('📊 Сначала пройдите психологический тест', 'info');
            return;
        }
    } catch (e) {
        _showToast('⚠️ Не удалось проверить статус теста', 'error');
        return;
    }
    
    _doublesInjectStyles();
    const container = _getContainer();
    if (!container) return;
    
    await _loadProfile();
    _renderIntro(container);
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showDoublesScreen = showDoublesScreen;
window.goBackToDashboard = () => _goHome();

console.log('✅ doubles.js v6.1 загружен — универсальный (поддерживает оба API)');
