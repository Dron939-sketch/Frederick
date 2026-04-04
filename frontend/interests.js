// ============================================
// interests.js — Интересы на основе профиля
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _intInjectStyles() {
    if (document.getElementById('interests-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'interests-v2-styles';
    s.textContent = `
        /* ===== КАРТОЧКА ПРОФИЛЯ ===== */
        .int-profile-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: center;
        }
        .int-profile-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 6px;
        }
        .int-profile-code {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: 600;
            color: var(--chrome);
            margin-bottom: 10px;
        }
        .int-profile-vectors {
            display: flex;
            justify-content: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .int-vector-badge {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 20px;
            padding: 4px 10px;
            font-size: 11px;
            color: var(--text-secondary);
        }

        /* ===== СЕТКА КАТЕГОРИЙ ===== */
        .int-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 24px;
        }
        .int-cat-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 18px 14px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            position: relative;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .int-cat-card:hover {
            background: rgba(224,224,224,0.09);
            border-color: rgba(224,224,224,0.25);
            transform: translateY(-2px);
        }
        .int-cat-card:active { transform: scale(0.98); }
        .int-cat-icon { font-size: 36px; line-height: 1.1; display: block; margin-bottom: 8px; }
        .int-cat-name {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
            color: var(--text-primary);
            margin-bottom: 3px;
        }
        .int-cat-count { font-size: 11px; color: var(--text-secondary); }
        .int-cat-arrow {
            position: absolute;
            bottom: 14px;
            right: 14px;
            font-size: 16px;
            color: var(--silver-brushed);
        }

        /* ===== КНОПКА ОБНОВИТЬ ===== */
        .int-refresh-btn {
            width: 100%;
            padding: 13px;
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 40px;
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
            touch-action: manipulation;
        }
        .int-refresh-btn:hover {
            background: rgba(224,224,224,0.12);
            color: var(--text-primary);
        }

        /* ===== СПИСОК ЭЛЕМЕНТОВ ===== */
        .int-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .int-item {
            display: flex;
            gap: 14px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            transition: background 0.2s;
        }
        .int-item:hover { background: rgba(224,224,224,0.08); }
        .int-item-num {
            font-size: 20px;
            font-weight: 700;
            color: var(--silver-brushed);
            opacity: 0.5;
            min-width: 32px;
            padding-top: 2px;
        }
        .int-item-body { flex: 1; min-width: 0; }
        .int-item-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 5px;
            line-height: 1.4;
        }
        .int-item-desc {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-bottom: 10px;
        }
        .int-item-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 11px;
            color: var(--text-secondary);
        }
        .int-relevance { color: var(--chrome); font-weight: 500; }
        .int-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-bottom: 12px;
        }
        .int-tag {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 20px;
            padding: 2px 8px;
            font-size: 9px;
            color: var(--text-secondary);
        }
        .int-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .int-btn {
            padding: 7px 14px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 36px;
            touch-action: manipulation;
            outline: none;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.17);
            color: var(--text-secondary);
        }
        .int-btn:hover {
            background: rgba(224,224,224,0.14);
            color: var(--text-primary);
        }
        .int-btn:active { transform: scale(0.97); }

        @media (max-width: 480px) {
            .int-grid { gap: 8px; }
            .int-cat-card { padding: 14px 12px; }
            .int-cat-icon { font-size: 28px; }
            .int-item { flex-direction: column; gap: 6px; }
            .int-item-num { min-width: auto; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА ДАННЫХ ИНТЕРЕСОВ
// ============================================
const INTERESTS_DB = {
    books: [
        { id:'book_1', title:'Дэниел Канеман — «Думай медленно... решай быстро»', description:'Как работают две системы мышления и почему мы ошибаемся', vectors:{УБ:5,СБ:3,ТФ:4,ЧВ:2}, rating:4.7, year:2011, tags:['мышление','психология','наука'] },
        { id:'book_2', title:'Роберт Чалдини — «Психология влияния»', description:'Как работают механизмы убеждения и защиты от манипуляций', vectors:{ЧВ:5,СБ:4,УБ:3,ТФ:3}, rating:4.8, year:2009, tags:['влияние','коммуникация','психология'] },
        { id:'book_3', title:'Михай Чиксентмихайи — «Поток»', description:'Состояние оптимального переживания и как его достичь', vectors:{УБ:4,СБ:4,ЧВ:4,ТФ:4}, rating:4.6, year:2014, tags:['счастье','продуктивность','психология'] },
        { id:'book_4', title:'Карл Густав Юнг — «Архетипы и коллективное бессознательное»', description:'Фундаментальная работа о глубинных паттернах психики', vectors:{УБ:5,ЧВ:4,СБ:3,ТФ:2}, rating:4.5, year:1960, tags:['юнг','архетипы','психоанализ'] },
        { id:'book_5', title:'Эрих Фромм — «Искусство любить»', description:'Любовь как искусство, требующее усилий и знаний', vectors:{ЧВ:5,СБ:2,УБ:3,ТФ:2}, rating:4.7, year:1956, tags:['любовь','отношения','психология'] },
        { id:'book_6', title:'Виктор Франкл — «Сказать жизни "Да!"»', description:'Психолог в концлагере и поиск смысла в страдании', vectors:{СБ:5,УБ:4,ЧВ:3,ТФ:2}, rating:4.9, year:1946, tags:['смысл','экзистенциализм','психология'] },
        { id:'book_7', title:'Нассим Талеб — «Чёрный лебедь»', description:'О непредсказуемых событиях и как на них реагировать', vectors:{УБ:5,ТФ:4,СБ:3,ЧВ:2}, rating:4.6, year:2007, tags:['риск','неопределённость','бизнес'] },
        { id:'book_8', title:'Сьюзан Кейн — «Интроверты»', description:'Как использовать свои сильные стороны, если вы интроверт', vectors:{СБ:2,ЧВ:4,УБ:3,ТФ:3}, rating:4.5, year:2012, tags:['интроверсия','личность','психология'] }
    ],
    movies: [
        { id:'movie_1', title:'Начало (Inception)', description:'Фильм о проникновении в сны и изменении убеждений', vectors:{УБ:5,СБ:4,ЧВ:3,ТФ:2}, rating:4.8, year:2010, tags:['триллер','психология','фантастика'] },
        { id:'movie_2', title:'Клиент всегда мёртв (Six Feet Under)', description:'Сериал о семье, управляющей похоронным бюро', vectors:{ЧВ:5,УБ:4,СБ:3,ТФ:2}, rating:4.9, year:2001, tags:['драма','психология','семья'] },
        { id:'movie_3', title:'Мистер Робот', description:'Гениальный хакер с диссоциативным расстройством личности', vectors:{УБ:5,ЧВ:4,СБ:3,ТФ:3}, rating:4.8, year:2015, tags:['триллер','психология','хакеры'] },
        { id:'movie_4', title:'Красивый ум', description:'История Джона Нэша, гения с шизофренией', vectors:{УБ:5,ЧВ:4,СБ:4,ТФ:3}, rating:4.8, year:2001, tags:['драма','биография','психология'] },
        { id:'movie_5', title:'Помаранчевый — хит сезона', description:'Трогательная история о подростках и первой любви', vectors:{ЧВ:5,СБ:2,УБ:2,ТФ:2}, rating:4.7, year:2023, tags:['драма','подростки','любовь'] }
    ],
    practices: [
        { id:'prac_1', title:'Утреннее сканирование тела', duration:5, description:'Настройка на день через осознанность', vectors:{СБ:4,ЧВ:4,УБ:2,ТФ:2}, type:'Медитация' },
        { id:'prac_2', title:'Дневник эмоций', duration:10, description:'Отслеживание эмоциональных паттернов', vectors:{ЧВ:5,УБ:4,СБ:3,ТФ:2}, type:'Журналинг', template:'Что я чувствую? Что вызвало эту эмоцию?' },
        { id:'prac_3', title:'Медитация благодарности', duration:15, description:'Завершение дня с чувством благодарности', vectors:{ЧВ:5,СБ:3,УБ:2,ТФ:2}, type:'Медитация' },
        { id:'prac_4', title:'Дыхательная практика «Квадрат»', duration:3, description:'Быстрое успокоение нервной системы', vectors:{СБ:5,ЧВ:3,УБ:2,ТФ:2}, type:'Дыхание', template:'Вдох 4 сек — задержка 4 сек — выдох 4 сек — задержка 4 сек' },
        { id:'prac_5', title:'Анализ убеждений', duration:20, description:'Выявление и проработка ограничивающих убеждений', vectors:{УБ:5,ЧВ:4,СБ:3,ТФ:2}, type:'Рабочий лист', template:'Какое убеждение меня ограничивает? Откуда оно взялось?' }
    ],
    careers: [
        { id:'car_1', title:'Психолог-консультант', description:'Помощь людям в решении психологических проблем', vectors:{ЧВ:5,УБ:4,СБ:3,ТФ:3}, salary:'80–200k', demand:'high' },
        { id:'car_2', title:'Аналитик данных', description:'Поиск закономерностей в данных и принятие решений', vectors:{УБ:5,ТФ:4,СБ:3,ЧВ:2}, salary:'120–300k', demand:'high' },
        { id:'car_3', title:'HR-специалист', description:'Работа с персоналом, подбор и развитие сотрудников', vectors:{ЧВ:5,СБ:4,ТФ:3,УБ:3}, salary:'70–180k', demand:'medium' },
        { id:'car_4', title:'Product Manager', description:'Управление продуктом, коммуникация с командами', vectors:{СБ:5,УБ:4,ЧВ:4,ТФ:4}, salary:'150–350k', demand:'high' },
        { id:'car_5', title:'Исследователь', description:'Научная работа, поиск новых знаний', vectors:{УБ:5,СБ:3,ТФ:3,ЧВ:3}, salary:'60–150k', demand:'low' }
    ]
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._intState) window._intState = { vectors: {СБ:4,ТФ:4,УБ:4,ЧВ:4} };
const _intState = window._intState;

// ============================================
// УТИЛИТЫ
// ============================================
function _intToast(msg) { if (window.showToast) window.showToast(msg, 'info'); }
function _intHome()    { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _api()        { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _uid()        { return window.CONFIG?.USER_ID; }

// ============================================
// РАСЧЁТ РЕЛЕВАНТНОСТИ
// ============================================
function _relevance(item, v) {
    let score = 0;
    for (const [k, uv] of Object.entries(v)) {
        const iv = item.vectors?.[k] || 3;
        score += 1 - Math.abs(uv - iv) / 5;
    }
    return Math.round((score / Object.keys(v).length) * 100);
}

function _recommend(items, vectors, limit = 8) {
    return items
        .map(item => ({ ...item, relevance: _relevance(item, vectors) }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
}

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _loadVectors() {
    try {
        const r = await fetch(`${_api()}/api/get-profile/${_uid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length - 1] : (x || 4);
        _intState.vectors = { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
    } catch { /* используем дефолт */ }
}

// ============================================
// ГЛАВНЫЙ ЭКРАН
// ============================================
function _renderMain() {
    _intInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const v = _intState.vectors;
    const profileCode = `СБ-${v.СБ} · ТФ-${v.ТФ} · УБ-${v.УБ} · ЧВ-${v.ЧВ}`;

    const cats = [
        { key:'books',     icon:'📚', name:'Книги' },
        { key:'movies',    icon:'🎬', name:'Кино' },
        { key:'practices', icon:'🧘', name:'Практики' },
        { key:'careers',   icon:'💼', name:'Карьера' }
    ];

    const catCards = cats.map(cat => {
        const count = _recommend(INTERESTS_DB[cat.key], v).length;
        return `
            <div class="int-cat-card" data-cat="${cat.key}">
                <span class="int-cat-icon">${cat.icon}</span>
                <div class="int-cat-name">${cat.name.toUpperCase()}</div>
                <div class="int-cat-count">${count} рекомендаций</div>
                <div class="int-cat-arrow">›</div>
            </div>`;
    }).join('');

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="intBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Интересы</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Подобрано на основе вашего профиля</p>
            </div>
            <div class="int-profile-card">
                <div class="int-profile-label">🧬 Ваш профиль</div>
                <div class="int-profile-code">${profileCode}</div>
                <div class="int-profile-vectors">
                    <span class="int-vector-badge">СБ ${v.СБ}/6</span>
                    <span class="int-vector-badge">ТФ ${v.ТФ}/6</span>
                    <span class="int-vector-badge">УБ ${v.УБ}/6</span>
                    <span class="int-vector-badge">ЧВ ${v.ЧВ}/6</span>
                </div>
            </div>
            <div class="int-grid">${catCards}</div>
            <button class="int-refresh-btn" id="intRefresh">🔄 Обновить рекомендации</button>
        </div>`;

    document.getElementById('intBack').onclick = () => _intHome();
    document.getElementById('intRefresh').onclick = () => {
        _intToast('Рекомендации обновлены');
        _renderMain();
    };

    document.querySelectorAll('.int-cat-card').forEach(card => {
        card.addEventListener('click', () => _renderCategory(card.dataset.cat));
    });
}

// ============================================
// ЭКРАН КАТЕГОРИИ
// ============================================
function _renderCategory(category) {
    _intInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const v = _intState.vectors;
    const items = _recommend(INTERESTS_DB[category], v);

    const meta = {
        books:     { icon:'📚', name:'Книги' },
        movies:    { icon:'🎬', name:'Кино' },
        practices: { icon:'🧘', name:'Практики' },
        careers:   { icon:'💼', name:'Карьера' }
    }[category];

    const DEMAND = { high:'🔥 Высокий', medium:'📊 Средний', low:'📉 Низкий' };

    const cards = items.map((item, i) => {
        const rel = item.relevance;
        const relBar = '✦'.repeat(Math.max(1, Math.round(rel / 20)));

        const metaHtml = category === 'books'     ? `<span>⭐ ${item.rating}</span><span>📅 ${item.year}</span>` :
                         category === 'movies'    ? `<span>⭐ ${item.rating}</span><span>📅 ${item.year}</span>` :
                         category === 'practices' ? `<span>⏱ ${item.duration} мин</span><span>${item.type}</span>` :
                         /* careers */              `<span>💰 ${item.salary} ₽</span><span>${DEMAND[item.demand]||''}</span>`;

        const tagsHtml = (item.tags||[]).map(t => `<span class="int-tag">#${t}</span>`).join('');

        const btns = category === 'books'     ? `<button class="int-btn int-detail">📖 Подробнее</button><button class="int-btn int-dl">📥 Скачать</button>` :
                     category === 'movies'    ? `<button class="int-btn int-detail">🎬 Подробнее</button>` :
                     category === 'practices' ? `<button class="int-btn int-start">▶️ Выполнить</button><button class="int-btn int-detail">📋 Инструкция</button>` :
                     /* careers */              `<button class="int-btn int-detail">📊 Подробнее</button><button class="int-btn int-courses">📚 Курсы</button>`;

        return `
            <div class="int-item">
                <div class="int-item-num">${i + 1}</div>
                <div class="int-item-body">
                    <div class="int-item-title">${item.title}</div>
                    <div class="int-item-desc">${item.description}</div>
                    <div class="int-item-meta">
                        ${metaHtml}
                        <span class="int-relevance">${relBar} ${rel}%</span>
                    </div>
                    ${tagsHtml ? `<div class="int-tags">${tagsHtml}</div>` : ''}
                    <div class="int-actions">${btns}</div>
                </div>
            </div>`;
    }).join('');

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="intCatBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${meta.icon}</div>
                <h1 class="content-title">${meta.name}</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Подобрано по вашему профилю</p>
            </div>
            <div class="int-list">${cards}</div>
        </div>`;

    document.getElementById('intCatBack').onclick = () => _renderMain();

    c.querySelectorAll('.int-detail').forEach(b   => b.addEventListener('click', () => _intToast('Подробный анализ — скоро')));
    c.querySelectorAll('.int-dl').forEach(b        => b.addEventListener('click', () => _intToast('Скачивание — скоро')));
    c.querySelectorAll('.int-start').forEach(b     => b.addEventListener('click', () => _intToast('Практика — скоро')));
    c.querySelectorAll('.int-courses').forEach(b   => b.addEventListener('click', () => _intToast('Курсы — скоро')));
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showInterestsScreen() {
    try {
        const r = await fetch(`${_api()}/api/user-status?user_id=${_uid()}`);
        const d = await r.json();
        if (!d.has_profile) {
            if (window.showToast) window.showToast('📊 Сначала пройдите психологический тест', 'info');
            return;
        }
    } catch { /* показываем с дефолтными векторами */ }

    await _loadVectors();
    _renderMain();
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showInterestsScreen = showInterestsScreen;
console.log('✅ interests.js v2.0 загружен');
