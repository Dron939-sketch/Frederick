// ============================================
// doubles.js — Психометрический мэтчмейкер
// Версия 4.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — инжектируем один раз
// ============================================
function _doublesInjectStyles() {
    if (document.getElementById('doubles-v4-styles')) return;
    const s = document.createElement('style');
    s.id = 'doubles-v4-styles';
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

        /* ===== ЦЕЛИ (GOAL ITEMS) ===== */
        .db-goal-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 16px;
            padding: 14px 16px;
            margin-bottom: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 14px;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            touch-action: manipulation;
        }
        .db-goal-item:hover {
            background: rgba(224,224,224,0.09);
            border-color: rgba(224,224,224,0.25);
            transform: translateX(4px);
        }
        .db-goal-item:active { transform: scale(0.98); }
        .db-goal-icon { font-size: 32px; line-height: 1; flex-shrink: 0; }
        .db-goal-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .db-goal-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .db-goal-arrow { font-size: 16px; color: var(--silver-brushed); flex-shrink: 0; }

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

        /* ===== КАРТОЧКА РЕЗУЛЬТАТА ===== */
        .db-result-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 14px;
        }
        .db-result-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 12px;
        }
        .db-result-user {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .db-result-avatar {
            font-size: 36px;
            line-height: 1;
        }
        .db-result-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .db-result-city { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .db-result-score { text-align: right; }
        .db-result-pct {
            font-size: 20px;
            font-weight: 700;
            color: var(--chrome);
            line-height: 1;
        }
        .db-result-pct-label { font-size: 10px; color: var(--text-secondary); margin-top: 2px; }

        .db-vectors-compare {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 12px;
            padding: 10px;
            display: flex;
            gap: 4px;
            margin-bottom: 10px;
        }
        .db-vc-item {
            flex: 1;
            text-align: center;
        }
        .db-vc-label { font-size: 9px; color: var(--text-secondary); margin-bottom: 2px; }
        .db-vc-val { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .db-vc-diff { font-size: 9px; margin-top: 1px; }
        .db-vc-plus  { color: var(--success); }
        .db-vc-minus { color: var(--error); }
        .db-vc-eq    { color: var(--text-secondary); }

        .db-result-profile {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            text-align: center;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }

        .db-result-insight {
            background: rgba(224,224,224,0.04);
            border-left: 2px solid rgba(224,224,224,0.2);
            border-radius: 0 10px 10px 0;
            padding: 8px 12px;
            font-size: 12px;
            font-style: italic;
            color: var(--text-secondary);
            margin-bottom: 12px;
            line-height: 1.5;
        }

        .db-result-actions {
            display: flex;
            gap: 8px;
        }
        .db-action-btn {
            flex: 1;
            padding: 9px 12px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 40px;
            touch-action: manipulation;
            outline: none;
        }
        .db-action-btn:active { transform: scale(0.97); }
        .db-action-btn-ghost {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            color: var(--text-secondary);
        }
        .db-action-btn-ghost:hover {
            background: rgba(224,224,224,0.13);
            color: var(--text-primary);
        }
        .db-action-icon-btn {
            width: 40px;
            flex: none;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            color: var(--text-secondary);
        }
        .db-action-icon-btn:hover { background: rgba(224,224,224,0.13); }
        .db-action-icon-btn.saved { color: var(--chrome); border-color: rgba(224,224,224,0.3); }

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
            .db-goal-icon { font-size: 26px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ
// ============================================
let doublesState = {
    searchMode: null,
    searchGoal: null,
    foundDoubles: [],
    filters: { distance: 'any', gender: 'any' }
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
// СПРАВОЧНИКИ
// ============================================
const GOALS = {
    twin:      { emoji: '👥', name: 'Похожий профиль', desc: 'Люди с максимально близким психотипом' },
    lover:     { emoji: '💕', name: 'Любовник',        desc: 'Страсть, романтика, влечение' },
    spouse:    { emoji: '💍', name: 'Муж / Жена',      desc: 'Семья, стабильность, общее будущее' },
    friend:    { emoji: '👥', name: 'Друг',             desc: 'Поддержка, общение, доверие' },
    companion: { emoji: '🤝', name: 'Бизнес-партнёр',  desc: 'Проекты, капитал, синергия' },
    employee:  { emoji: '👔', name: 'Сотрудник',        desc: 'Работа, команда, исполнительность' },
    boss:      { emoji: '👑', name: 'Начальник',        desc: 'Карьера, лидерство, рост' },
    mentor:    { emoji: '🦉', name: 'Ментор',           desc: 'Мудрость, обучение, развитие' },
    travel:    { emoji: '✈️', name: 'Попутчик',         desc: 'Путешествия, приключения' }
};

function _goalInfo(id) { return GOALS[id] || { emoji: '🎯', name: 'Поиск', desc: '' }; }

function _insight(similarity, isTwin) {
    if (isTwin) {
        if (similarity >= 90) return 'Ваш психологический близнец — возможно, у вас похожие жизненные сценарии.';
        if (similarity >= 75) return 'Очень похожий профиль. Общение даст ценные инсайты.';
        return 'Несмотря на различия, у вас много общего в базовых настройках психики.';
    }
    if (similarity >= 90) return 'Идеальное дополнение — ваши профили созданы друг для друга.';
    if (similarity >= 75) return 'Отличная совместимость. Все шансы на гармоничные отношения.';
    return 'Хорошая база для взаимодействия. Стоит присмотреться.';
}

// ============================================
// ШАБЛОНЫ HTML
// ============================================
function _ownCardHtml() {
    const v = userDoublesProfile.vectors;
    const meta = [
        userDoublesProfile.age   ? userDoublesProfile.age + ' лет' : '',
        userDoublesProfile.city  ? '· ' + userDoublesProfile.city  : ''
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

// 1. ВВОДНЫЙ ЭКРАН
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
                <div class="db-info-example">💡 «У кого такой же профиль, но другая профессия?»</div>
            </div>

            <div class="db-info-card">
                <div class="db-info-header">
                    <div class="db-info-icon">🎯</div>
                    <div class="db-info-title">Режим «ПОДБОР ПО ЦЕЛИ»</div>
                </div>
                <div class="db-info-body">
                    AI анализирует, какой профиль идеально подходит для вашей цели —
                    любовник, партнёр, ментор, сотрудник — и находит таких людей в базе.
                </div>
                <div class="db-info-example">💡 «Кто идеально подходит мне в бизнес-партнёры?»</div>
            </div>

            <div class="db-privacy-card">
                <div class="db-info-header">
                    <div class="db-info-icon">🔒</div>
                    <div class="db-info-title">Конфиденциальность</div>
                </div>
                <div class="db-privacy-body">
                    • Ваш профиль используется анонимно<br>
                    • Другие видят только имя, возраст, город и % совместимости<br>
                    • Контакты раскрываются только при взаимном согласии<br>
                    • Удалить профиль из базы можно в любой момент
                </div>
            </div>

            <button class="db-start-btn" id="dbStartBtn">✦ НАЧАТЬ ПОИСК</button>
        </div>
    `);

    document.getElementById('dbBack').onclick  = () => _goHome();
    document.getElementById('dbStartBtn').onclick = () => {
        localStorage.setItem('doubles_intro_seen', 'true');
        _renderModes(container);
    };
}

// 2. ВЫБОР РЕЖИМА
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
                        📊 Альтернативные пути&nbsp; · &nbsp;🔍 Понять паттерны&nbsp; · &nbsp;🤝 Не быть одному
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
                🔒 Анонимно&nbsp;&nbsp;·&nbsp;&nbsp;🎯 Точно&nbsp;&nbsp;·&nbsp;&nbsp;🧠 На основе психометрики
            </div>
        </div>
    `);

    document.getElementById('dbBack').onclick    = () => _goHome();
    document.getElementById('dbTwinBtn').onclick = () => { doublesState.searchMode = 'twin';  _renderGoals(container); };
    document.getElementById('dbMatchBtn').onclick = () => { doublesState.searchMode = 'match'; _renderGoals(container); };
}

// 3. ВЫБОР ЦЕЛИ
function _renderGoals(container) {
    const isTwin = doublesState.searchMode === 'twin';
    const goals  = isTwin ? ['twin'] : ['lover','spouse','friend','companion','employee','boss','mentor','travel'];

    const goalsHtml = goals.map(id => {
        const g = _goalInfo(id);
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

    const filtersHtml = !isTwin ? `
        <div class="db-filters">
            <div class="db-filters-title">⚙️ Фильтры</div>
            <div class="db-filters-row">
                <select class="db-select" id="dbDistFilter">
                    <option value="any">🌍 Любое расстояние</option>
                    <option value="city">🏙️ Мой город</option>
                    <option value="10">📍 До 10 км</option>
                    <option value="50">📍 До 50 км</option>
                    <option value="100">📍 До 100 км</option>
                </select>
                <select class="db-select" id="dbGenderFilter">
                    <option value="any">👤 Любой пол</option>
                    <option value="male">👨 Мужской</option>
                    <option value="female">👩 Женский</option>
                </select>
            </div>
        </div>` : '';

    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header(isTwin ? '👥' : '🎯',
                  isTwin ? 'Поиск двойника' : 'Кого вы ищете?',
                  isTwin ? 'Люди с похожим психотипом'
                         : 'AI подберёт идеальный профиль под вашу цель')}
        <div class="content-body">
            <div style="background:rgba(224,224,224,0.04);border:1px solid rgba(224,224,224,0.1);border-radius:14px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:var(--text-secondary);line-height:1.6;">
                ${isTwin
                    ? '🔍 Двойники — люди с максимально похожим психотипом. Помогут увидеть альтернативные пути и понять свои паттерны со стороны.'
                    : '🎯 AI проанализирует ваш профиль и найдёт людей, чей психотип идеально подходит для вашей цели. Получите % совместимости и инсайты.'}
            </div>
            ${goalsHtml}
            ${filtersHtml}
        </div>
    `);

    document.getElementById('dbBack').onclick = () => _renderModes(container);

    if (!isTwin) {
        document.getElementById('dbDistFilter').onchange   = e => { doublesState.filters.distance = e.target.value; };
        document.getElementById('dbGenderFilter').onchange = e => { doublesState.filters.gender   = e.target.value; };
    }

    document.querySelectorAll('.db-goal-item').forEach(el => {
        el.addEventListener('click', () => {
            doublesState.searchGoal = el.dataset.goal;
            _renderSearching(container);
            _doSearch(container);
        });
    });
}

// 4. ЛОАДЕР
function _renderSearching(container) {
    const isTwin = doublesState.searchMode === 'twin';
    const g = _goalInfo(doublesState.searchGoal);

    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header('🔍', isTwin ? 'Поиск двойников' : `Поиск: ${g.name}`)}
        <div class="content-body">
            <div class="db-loader">
                <div class="db-loader-ring">
                    <div class="db-loader-icon">🧠</div>
                </div>
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);">AI анализирует...</div>
                <div class="db-progress"><div class="db-progress-fill"></div></div>
                <div class="db-status-text" id="dbStatusText">Анализирую ваш профиль...</div>
            </div>
        </div>
    `);

    document.getElementById('dbBack').onclick = () => _renderModes(container);
}

// 5. ПОИСК
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
        await new Promise(r => setTimeout(r, 2500)); // Даём лоадеру "подышать"

        const api = _api(), uid = _userId();
        let url = `${api}/api/psychometric/search?user_id=${uid}&mode=${doublesState.searchMode}`;
        if (doublesState.searchGoal)              url += `&goal=${doublesState.searchGoal}`;
        if (doublesState.filters.distance !== 'any') url += `&distance=${doublesState.filters.distance}`;
        if (doublesState.filters.gender !== 'any')   url += `&gender=${doublesState.filters.gender}`;

        const r    = await fetch(url);
        const data = await r.json();
        clearInterval(tick);
        doublesState.foundDoubles = (data.success && data.results) ? data.results : [];
    } catch (e) {
        clearInterval(tick);
        console.error('Search failed:', e);
        doublesState.foundDoubles = [];
        _showToast('❌ Ошибка поиска. Попробуйте позже.', 'error');
    }

    _renderResults(container);
}

// 6. РЕЗУЛЬТАТЫ
function _renderResults(container) {
    const isTwin  = doublesState.searchMode === 'twin';
    const results = doublesState.foundDoubles;
    const g       = _goalInfo(doublesState.searchGoal);
    const v0      = userDoublesProfile.vectors;

    let cardsHtml = '';

    if (!results.length) {
        cardsHtml = `
            <div class="db-empty">
                <div class="db-empty-icon">🔍</div>
                <div class="db-empty-title">Пока ничего не найдено</div>
                <div class="db-empty-sub">
                    ${isTwin
                        ? 'Ваш профиль уникален в нашей базе.'
                        : `Подходящих кандидатов для "${g.name}" пока нет.`}
                    <br>База пополняется ежедневно — загляните позже!
                </div>
            </div>`;
    } else {
        results.forEach(item => {
            const sim  = item.similarity || (Math.floor(Math.random() * 30) + 65);
            const v    = item.vectors || v0;
            const sign = (n) => n > 0 ? `<span class="db-vc-plus">+${n}</span>`
                               : n < 0 ? `<span class="db-vc-minus">${n}</span>`
                               :         `<span class="db-vc-eq">=</span>`;
            const pctIcon = sim >= 90 ? '🔥' : sim >= 75 ? '✦' : '·';

            cardsHtml += `
                <div class="db-result-card">
                    <div class="db-result-top">
                        <div class="db-result-user">
                            <div class="db-result-avatar">${item.gender === 'female' ? '👩' : '👨'}</div>
                            <div>
                                <div class="db-result-name">${item.name || 'Пользователь'}, ${item.age || '?'}</div>
                                <div class="db-result-city">📍 ${item.city || 'Город не указан'}</div>
                            </div>
                        </div>
                        <div class="db-result-score">
                            <div class="db-result-pct">${pctIcon} ${sim}%</div>
                            <div class="db-result-pct-label">совместимость</div>
                        </div>
                    </div>

                    <div class="db-result-profile">${item.profile || userDoublesProfile.profile} | ${item.profile_type || userDoublesProfile.profileType}</div>

                    <div class="db-vectors-compare">
                        ${['СБ','ТФ','УБ','ЧВ'].map(k => `
                            <div class="db-vc-item">
                                <div class="db-vc-label">${k}</div>
                                <div class="db-vc-val">${v[k] || 4}/6</div>
                                <div class="db-vc-diff">${sign((v[k]||4) - (v0[k]||4))}</div>
                            </div>`).join('')}
                    </div>

                    <div class="db-result-insight">
                        💡 "${item.insight || _insight(sim, isTwin)}"
                    </div>

                    <div class="db-result-actions">
                        <button class="db-action-btn db-action-btn-ghost db-chat-btn" data-id="${item.user_id}">💬 Чат</button>
                        <button class="db-action-btn db-action-btn-ghost db-view-btn" data-id="${item.user_id}">👤 Профиль</button>
                        <button class="db-action-btn db-action-icon-btn db-save-btn" data-id="${item.user_id}">❤️</button>
                    </div>
                </div>`;
        });
    }

    container.innerHTML = _pageWrap(`
        ${_backBtn()}
        ${_header(isTwin ? '👥' : g.emoji,
                  isTwin ? 'Ваши двойники' : `Кандидаты: ${g.name}`,
                  `Найдено ${results.length} человек`)}
        <div class="content-body">
            ${cardsHtml}
            <div class="db-bottom-row">
                <button class="db-bottom-btn db-bottom-btn-primary" id="dbNewSearch">🔄 Новый поиск</button>
                <button class="db-bottom-btn db-bottom-btn-secondary" id="dbChangeGoal">🎯 Другая цель</button>
            </div>
        </div>
    `);

    document.getElementById('dbBack').onclick      = () => _renderModes(container);
    document.getElementById('dbNewSearch').onclick = () => _renderModes(container);
    document.getElementById('dbChangeGoal').onclick = () => _renderGoals(container);

    document.querySelectorAll('.db-chat-btn').forEach(b =>
        b.addEventListener('click', () => _showToast('💬 Чат будет доступен в следующей версии', 'info')));
    document.querySelectorAll('.db-view-btn').forEach(b =>
        b.addEventListener('click', () => _showToast('👤 Полный профиль — скоро', 'info')));
    document.querySelectorAll('.db-save-btn').forEach(b =>
        b.addEventListener('click', () => {
            b.textContent = '✅';
            b.classList.add('saved');
            _showToast('Сохранено в избранное', 'success');
        }));
}

// ============================================
// ГЛАВНАЯ ТОЧКА ВХОДА
// ============================================
async function showDoublesScreen() {
    try {
        const api = _api(), uid = _userId();
        const r = await fetch(`${api}/api/user-status?user_id=${uid}`);
        const d = await r.json();
        if (!d.has_profile) {
            _showToast('📊 Сначала пройдите психологический тест', 'info');
            return;
        }
    } catch {
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

console.log('✅ doubles.js v4.0 загружен');
