// ============================================
// weekend.js — Идеи на выходные
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _wiInjectStyles() {
    if (document.getElementById('wi-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'wi-v2-styles';
    s.textContent = `
        /* ===== БЕЙДЖ ФОКУСА ===== */
        .wi-focus-badge {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 40px;
            padding: 8px 16px;
            margin-bottom: 20px;
        }
        .wi-focus-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--chrome);
        }
        .wi-focus-level {
            font-size: 11px;
            color: var(--text-secondary);
        }

        /* ===== СЕКЦИЯ ИДЕЙ ===== */
        .wi-section {
            margin-bottom: 20px;
        }
        .wi-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        .wi-cards {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .wi-card {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            transition: background 0.2s;
        }
        .wi-card:hover { background: rgba(224,224,224,0.08); }
        .wi-card-icon {
            font-size: 22px;
            flex-shrink: 0;
            line-height: 1.2;
        }
        .wi-card-text {
            font-size: 14px;
            line-height: 1.55;
            color: var(--text-secondary);
            padding-top: 2px;
        }

        /* ===== КНОПКИ ===== */
        .wi-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
        }
        .wi-btn {
            flex: 1;
            padding: 13px 16px;
            border-radius: 40px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 46px;
            touch-action: manipulation;
            outline: none;
        }
        .wi-btn:active { transform: scale(0.97); }
        .wi-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.28);
            color: var(--text-primary);
        }
        .wi-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.26), rgba(192,192,192,0.16)); }
        .wi-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .wi-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .wi-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ===== СОВЕТ ===== */
        .wi-tip {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            text-align: center;
        }

        @media (max-width: 480px) {
            .wi-card-icon { font-size: 18px; }
            .wi-card-text { font-size: 13px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА ИДЕЙ ПО ВЕКТОРАМ
// ============================================
const WI_DB = {
    СБ: {
        name: 'Гармония и спокойствие',
        emoji: '🌿',
        ideas: [
            { icon:'🚶', text:'Прогулка в незнакомом месте — парк, район, который вы ещё не исследовали' },
            { icon:'📝', text:'Написать список своих границ и подумать, где их нарушают' },
            { icon:'🧘', text:'Практика заземления: походить босиком по траве или полу, просто чувствуя опору' },
            { icon:'🎬', text:'Посмотреть фильм, где герой преодолевает страх и находит себя' },
            { icon:'🕯️', text:'Вечер без соцсетей: книга, музыка, тишина' },
            { icon:'🌸', text:'Зайти в цветочный и купить себе букет — просто так' },
            { icon:'🫁', text:'Попробовать дыхательную практику «Квадрат»: вдох 4 — задержка 4 — выдох 4 — задержка 4' }
        ]
    },
    ТФ: {
        name: 'Ресурсы и изобилие',
        emoji: '💰',
        ideas: [
            { icon:'📊', text:'Разобрать личный бюджет за месяц: куда ушли деньги, что удивило' },
            { icon:'📚', text:'Почитать книгу по финансовой грамотности — хоть 20 страниц' },
            { icon:'💡', text:'Придумать 3 реалистичные идеи дополнительного дохода — не реализовывать, просто придумать' },
            { icon:'🎁', text:'Сделать себе небольшой подарок в рамках бюджета — вы это заслужили' },
            { icon:'📈', text:'Посмотреть одну лекцию об инвестициях или пассивном доходе' },
            { icon:'🛒', text:'Сходить в магазин со списком и не отклоняться от него — тренировка дисциплины' },
            { icon:'🏦', text:'Открыть накопительный счёт или разобраться с условиями своего банка' }
        ]
    },
    УБ: {
        name: 'Познание и смыслы',
        emoji: '📚',
        ideas: [
            { icon:'📖', text:'Почитать книгу по психологии или философии — то, что давно откладывали' },
            { icon:'🧩', text:'Посмотреть документальный фильм на совершенно новую для вас тему' },
            { icon:'✍️', text:'Написать эссе «Что для меня важно» — без редактирования, просто поток мыслей' },
            { icon:'🌌', text:'Выйти ночью и просто посмотреть на звёзды. Подумать о масштабе' },
            { icon:'🎓', text:'Пройти бесплатный онлайн-курс по интересующей теме — хотя бы первый урок' },
            { icon:'🗣', text:'Найти человека, которого вы считаете мудрым, и задать один важный вопрос' },
            { icon:'🔬', text:'Посетить научно-популярную лекцию или музей' }
        ]
    },
    ЧВ: {
        name: 'Отношения и тепло',
        emoji: '🤝',
        ideas: [
            { icon:'👥', text:'Встретиться с друзьями, которых не видели больше месяца' },
            { icon:'📞', text:'Позвонить родным — не написать, а именно позвонить' },
            { icon:'💌', text:'Написать письмо благодарности кому-то важному в вашей жизни' },
            { icon:'🎲', text:'Устроить настольные игры с семьёй или близкими' },
            { icon:'🍵', text:'Позвать кого-то на кофе или чай — живой разговор, не переписка' },
            { icon:'🐱', text:'Сходить в приют для животных — это трогает и перезагружает' },
            { icon:'🍰', text:'Испечь что-то и угостить соседей или коллег без повода' }
        ]
    }
};

const WI_COMMON = [
    { icon:'🛁', text:'Устроить дома день спа: маски, ванна, ничего не делать' },
    { icon:'🎨', text:'Попробовать новое хобби — рисование, лепка, вышивание. Даже 30 минут' },
    { icon:'🚲', text:'Велопрогулка или долгая пешая прогулка без цели и маршрута' },
    { icon:'🍳', text:'Приготовить блюдо, которое никогда не делали — по рецепту или наугад' },
    { icon:'🎧', text:'Послушать подкаст на новую тему в наушниках, лёжа на диване' },
    { icon:'🧹', text:'Разобрать один ящик или шкаф. Порядок снаружи помогает порядку внутри' },
    { icon:'🎬', text:'Киномарафон с любимыми фильмами — без чувства вины' }
];

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._wiState) window._wiState = {
    vectors: { СБ:4, ТФ:4, УБ:4, ЧВ:4 },
    isLoading: false
};
const _wi = window._wiState;

// ============================================
// УТИЛИТЫ
// ============================================
function _wiToast(msg, type) { if (window.showToast) window.showToast(msg, type||'info'); }
function _wiHome() { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _wiApi() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _wiUid() { return window.CONFIG?.USER_ID; }

// ============================================
// КЭШ
// ============================================
function _wiSaveCache(ideas) {
    try {
        localStorage.setItem('wi_cache_' + _wiUid(), JSON.stringify({
            data: ideas,
            exp: Date.now() + 24*60*60*1000
        }));
    } catch {}
}
function _wiLoadCache() {
    try {
        const raw = localStorage.getItem('wi_cache_' + _wiUid());
        if (!raw) return null;
        const c = JSON.parse(raw);
        return c.exp > Date.now() ? c.data : null;
    } catch { return null; }
}
function _wiClearCache() {
    try { localStorage.removeItem('wi_cache_' + _wiUid()); } catch {}
}

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _wiLoadVectors() {
    try {
        const r = await fetch(`${_wiApi()}/api/get-profile/${_wiUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        _wi.vectors = { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch {}
}

// ============================================
// ГЕНЕРАЦИЯ ИДЕЙ (локально, без AI)
// ============================================
function _wiGenerate() {
    const v = _wi.vectors;

    // Слабый вектор — туда направляем фокус
    const sorted = Object.entries(v).sort((a,b) => a[1]-b[1]);
    const weakKey = sorted[0][0];
    const weakLvl = Math.round(Math.max(1, Math.min(6, sorted[0][1])));

    // Сильный вектор — берём 1 идею как бонус
    const strongKey = sorted[sorted.length-1][0];

    const weakDB  = WI_DB[weakKey]  || WI_DB.ЧВ;
    const strongDB = WI_DB[strongKey] || WI_DB.СБ;

    // Перемешиваем
    const shuffle = arr => {
        const a = [...arr];
        for (let i = a.length-1; i>0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [a[i],a[j]] = [a[j],a[i]];
        }
        return a;
    };

    const weakIdeas   = shuffle(weakDB.ideas).slice(0, 4);
    const commonIdeas = shuffle(WI_COMMON).slice(0, 2);
    const bonusIdea   = weakKey !== strongKey ? shuffle(strongDB.ideas)[0] : null;

    return { weakKey, weakLvl, weakDB, weakIdeas, commonIdeas, bonusIdea };
}

// ============================================
// РЕНДЕР ЭКРАНА
// ============================================
function _wiRender(gen) {
    _wiInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const v = _wi.vectors;
    const { weakKey, weakLvl, weakDB, weakIdeas, commonIdeas, bonusIdea } = gen;

    const levelDesc = weakLvl <= 2 ? 'важно уделить внимание'
                    : weakLvl <= 4 ? 'хорошо бы поработать'
                    : 'можно укрепить';

    const makeCard = (idea) => `
        <div class="wi-card">
            <div class="wi-card-icon">${idea.icon}</div>
            <div class="wi-card-text">${idea.text}</div>
        </div>`;

    const bonusHtml = bonusIdea ? `
        <div class="wi-section">
            <div class="wi-section-label">✦ Бонус — опираясь на вашу силу</div>
            <div class="wi-cards">${makeCard(bonusIdea)}</div>
        </div>` : '';

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="wiBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎨</div>
                <h1 class="content-title">Идеи на выходные</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Подобрано под ваш профиль</p>
            </div>

            <div class="wi-focus-badge">
                <span class="wi-focus-name">${weakDB.emoji} ${weakDB.name}</span>
                <span class="wi-focus-level">${weakLvl}/6 · ${levelDesc}</span>
            </div>

            <div class="wi-section">
                <div class="wi-section-label">🎯 Для вашего профиля</div>
                <div class="wi-cards">${weakIdeas.map(makeCard).join('')}</div>
            </div>

            <div class="wi-section">
                <div class="wi-section-label">🌟 Общие рекомендации</div>
                <div class="wi-cards">${commonIdeas.map(makeCard).join('')}</div>
            </div>

            ${bonusHtml}

            <div class="wi-actions">
                <button class="wi-btn wi-btn-primary" id="wiRefresh">🔄 Новые идеи</button>
                <button class="wi-btn wi-btn-ghost" id="wiShare">📤 Поделиться</button>
            </div>

            <div class="wi-tip">
                💡 Выберите 1–2 идеи, которые действительно откликаются. Не нужно делать всё сразу — хороших выходных!
            </div>
        </div>`;

    document.getElementById('wiBack').onclick = () => _wiHome();

    document.getElementById('wiRefresh').onclick = async () => {
        if (_wi.isLoading) return;
        _wi.isLoading = true;
        const btn = document.getElementById('wiRefresh');
        if (btn) { btn.textContent = '⏳ Генерирую...'; btn.disabled = true; }
        _wiClearCache();
        await _wiLoadVectors();
        const fresh = _wiGenerate();
        _wi.isLoading = false;
        _wiRender(fresh);
    };

    document.getElementById('wiShare').onclick = () => {
        const lines = [weakDB.name, '', ...weakIdeas.map(i => i.icon + ' ' + i.text), '', ...commonIdeas.map(i => i.icon + ' ' + i.text)].join('\n');
        const text = 'Идеи на выходные от Фреди:\n\n' + lines;
        if (navigator.share) {
            navigator.share({ title:'Идеи на выходные', text }).catch(() => _wiCopy(text));
        } else {
            _wiCopy(text);
        }
    };
}

function _wiCopy(text) {
    navigator.clipboard.writeText(text)
        .then(() => _wiToast('📋 Скопировано', 'success'))
        .catch(() => _wiToast('Не удалось скопировать', 'error'));
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showWeekendScreen() {
    // Рендерим сразу с текущими векторами
    _wiRender(_wiGenerate());
    try {
        const r = await fetch(`${_wiApi()}/api/user-status?user_id=${_wiUid()}`);
        const d = await r.json();
        if (!d.has_profile) {
            _wiToast('📊 Сначала пройдите психологический тест');
        }
    } catch {}
    await _wiLoadVectors();
    _wiRender(_wiGenerate()); // перерендер с актуальными векторами
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showWeekendScreen = showWeekendScreen;
console.log('✅ weekend.js v2.0 загружен');
