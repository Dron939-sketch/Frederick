// ============================================
// hormones.js — Гормональный баланс
// Версия 1.0 — Диагностика + Питание + Цикл
// ============================================

function _hmInjectStyles() {
    if (document.getElementById('hm-v1-styles')) return;
    const s = document.createElement('style');
    s.id = 'hm-v1-styles';
    s.textContent = `
        /* ===== TABS ===== */
        .hm-tabs {
            display: flex; gap: 4px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px; margin-bottom: 20px;
            overflow-x: auto; scrollbar-width: none;
        }
        .hm-tabs::-webkit-scrollbar { display: none; }
        .hm-tab {
            flex-shrink: 0; padding: 8px 14px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s; min-height: 36px; touch-action: manipulation;
            white-space: nowrap;
        }
        .hm-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* ===== СИМПТОМЫ ===== */
        .hm-symptoms-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;
        }
        .hm-symptom {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px; padding: 12px 14px; cursor: pointer;
            transition: background 0.18s, border-color 0.18s; touch-action: manipulation;
            display: flex; align-items: center; gap: 8px;
        }
        .hm-symptom:active { transform: scale(0.97); }
        .hm-symptom.sel { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.35); }
        .hm-symptom-icon { font-size: 20px; flex-shrink: 0; }
        .hm-symptom-text { font-size: 12px; font-weight: 500; color: var(--text-secondary); line-height: 1.3; }
        .hm-symptom.sel .hm-symptom-text { color: var(--text-primary); }

        /* ===== ПРОФИЛЬ ГОРМОНОВ ===== */
        .hm-profile-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px; padding: 18px; margin-bottom: 14px;
        }
        .hm-profile-title { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 14px; }
        .hm-hormone-row { margin-bottom: 12px; }
        .hm-hormone-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .hm-hormone-name  { font-size: 13px; color: var(--text-secondary); }
        .hm-hormone-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: rgba(224,224,224,0.08); }
        .hm-hormone-bar   { height: 6px; background: rgba(224,224,224,0.1); border-radius: 3px; overflow: hidden; }
        .hm-hormone-fill  { height: 100%; border-radius: 3px; transition: width 0.5s; }

        /* ===== РЕКОМЕНДАЦИИ ===== */
        .hm-rec-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .hm-rec-title { font-size: 13px; font-weight: 700; color: var(--chrome); margin-bottom: 8px; }
        .hm-rec-item  { font-size: 13px; color: var(--text-secondary); line-height: 1.7; padding: 3px 0; }

        /* ===== ПИТАНИЕ ===== */
        .hm-nutrition-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .hm-food-item {
            display: flex; align-items: center; gap: 12px; padding: 8px 0;
            border-bottom: 1px solid rgba(224,224,224,0.06);
        }
        .hm-food-item:last-child { border-bottom: none; }
        .hm-food-icon   { font-size: 24px; flex-shrink: 0; }
        .hm-food-name   { font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px; }
        .hm-food-effect { font-size: 11px; color: var(--text-secondary); }
        .hm-avoid-row   { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(224,224,224,0.08); font-size: 12px; color: var(--text-secondary); }

        /* ===== ЦИКЛ ===== */
        .hm-cycle-phases {
            display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;
        }
        .hm-phase-btn {
            padding: 12px; border-radius: 14px; border: 1px solid rgba(224,224,224,0.1);
            background: rgba(224,224,224,0.04); cursor: pointer;
            transition: background 0.2s, border-color 0.2s; text-align: center; touch-action: manipulation;
        }
        .hm-phase-btn:active { transform: scale(0.97); }
        .hm-phase-btn.sel { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.35); }
        .hm-phase-emoji { font-size: 24px; display: block; margin-bottom: 4px; }
        .hm-phase-name  { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
        .hm-phase-btn.sel .hm-phase-name { color: var(--text-primary); }

        .hm-cycle-info {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 10px;
        }
        .hm-cycle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .hm-cycle-cell { background: rgba(224,224,224,0.05); border-radius: 10px; padding: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
        .hm-cycle-cell strong { display: block; color: var(--text-primary); margin-bottom: 2px; }

        /* ===== ОБЩЕЕ ===== */
        .hm-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .hm-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .hm-btn:active { transform: scale(0.97); }
        .hm-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .hm-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .hm-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .hm-btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
        .hm-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .hm-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .hm-symptoms-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
            .hm-symptom-text  { font-size: 11px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// СИМПТОМЫ
// ============================================
const HM_SYMPTOMS = [
    { id:'anxiety',        icon:'😰', text:'Тревога' },
    { id:'irritation',     icon:'😤', text:'Раздражение' },
    { id:'apathy',         icon:'😶', text:'Апатия' },
    { id:'sadness',        icon:'😔', text:'Грусть' },
    { id:'no_motivation',  icon:'😴', text:'Нет мотивации' },
    { id:'insomnia',       icon:'🌙', text:'Плохой сон' },
    { id:'procrastination',icon:'⏳', text:'Прокрастинация' },
    { id:'loneliness',     icon:'🫂', text:'Одиночество' },
    { id:'sugar_craving',  icon:'🍬', text:'Тяга к сладкому' },
    { id:'low_energy',     icon:'🔋', text:'Мало энергии' }
];

// ============================================
// БАЗЫ ДАННЫХ
// ============================================
const HM_NUTRITION = {
    cortisol: {
        hormone: 'Кортизол (стресс)',
        foods: [
            { emoji:'🥜', name:'Магний (орехи, семена, зелень)',    effect:'снижает кортизол' },
            { emoji:'🐟', name:'Омега-3 (жирная рыба)',             effect:'уменьшает воспаление' },
            { emoji:'🍊', name:'Витамин С (цитрусы, киви)',         effect:'снижает кортизол' },
            { emoji:'🍫', name:'Тёмный шоколад 70%+',              effect:'успокаивает нервную систему' }
        ],
        avoid: ['Кофеин', 'Сахар', 'Алкоголь', 'Фастфуд']
    },
    dopamine: {
        hormone: 'Дофамин (мотивация)',
        foods: [
            { emoji:'🥑', name:'Тирозин (миндаль, авокадо, бобовые)', effect:'предшественник дофамина' },
            { emoji:'🥛', name:'Пробиотики (йогурт, кефир)',           effect:'ось кишечник-мозг' },
            { emoji:'🍵', name:'Зелёный чай',                          effect:'L-теанин + кофеин' },
            { emoji:'🍫', name:'Тёмный шоколад',                       effect:'фенилэтиламин' }
        ],
        avoid: ['Избыток сахара', 'Обработанные продукты']
    },
    serotonin: {
        hormone: 'Серотонин (настроение)',
        foods: [
            { emoji:'🍌', name:'Триптофан (индейка, бананы, финики)', effect:'предшественник серотонина' },
            { emoji:'🥣', name:'Сложные углеводы (овсянка, гречка)',  effect:'помогает усвоению триптофана' },
            { emoji:'🥚', name:'Яйца',                                effect:'богаты триптофаном' },
            { emoji:'🧀', name:'Сыр, творог',                        effect:'источник триптофана' }
        ],
        avoid: ['Алкоголь', 'Рафинированный сахар']
    },
    oxytocin: {
        hormone: 'Окситоцин (привязанность)',
        foods: [
            { emoji:'🍫', name:'Тёмный шоколад',          effect:'стимулирует окситоцин' },
            { emoji:'☕', name:'Тёплый чай с молоком',     effect:'ритуал + тепло' },
            { emoji:'🍯', name:'Мёд',                      effect:'сладкий вкус успокаивает' }
        ],
        avoid: []
    },
    melatonin: {
        hormone: 'Мелатонин (сон)',
        foods: [
            { emoji:'🍒', name:'Вишня',                       effect:'природный источник мелатонина' },
            { emoji:'🌰', name:'Орехи (грецкие, миндаль)',    effect:'содержат мелатонин' },
            { emoji:'🍌', name:'Бананы',                      effect:'магний + триптофан' },
            { emoji:'🥛', name:'Тёплое молоко',               effect:'триптофан + ритуал' }
        ],
        avoid: ['Кофеин вечером', 'Синий свет', 'Тяжёлая еда']
    }
};

const HM_CYCLE_PHASES = {
    follicular: {
        name:'Фолликулярная', emoji:'🌱', days:'дни 1-14',
        energy:'Высокая', mood:'Энергичное, творческое',
        focus:'Новые проекты, общение', hormones:'Эстроген ↑',
        tips:['⚡ Начинайте новые проекты', '🎨 Творческие задачи', '👥 Социализация', '🏃 Интенсивные тренировки'],
        food:['Овощи', 'Цельнозерновые', 'Бобовые', 'Фрукты']
    },
    ovulatory: {
        name:'Овуляторная', emoji:'🔥', days:'дни 14-16',
        energy:'Пик энергии', mood:'Уверенное, общительное',
        focus:'Переговоры, публичность', hormones:'Эстроген пик, Тестостерон ↑',
        tips:['💬 Важные переговоры', '🎤 Публичные выступления', '💕 Социализация', '🏋️ Пик физической формы'],
        food:['Постное мясо', 'Рыба', 'Яйца', 'Ферментированные продукты']
    },
    luteal: {
        name:'Лютеиновая', emoji:'🌙', days:'дни 16-28',
        energy:'Снижается', mood:'Перепады, интроверсия',
        focus:'Завершение дел, рефлексия', hormones:'Прогестерон ↑',
        tips:['📝 Завершайте начатое', '🧘 Йога, домашние практики', '📖 Саморазвитие', '🛁 Забота о себе'],
        food:['Сложные углеводы', 'Орехи', 'Семена', 'Тёмный шоколад']
    },
    menstrual: {
        name:'Менструальная', emoji:'🩸', days:'дни 1-5',
        energy:'Низкая', mood:'Чувствительность, интроверсия',
        focus:'Восстановление, отдых', hormones:'Эстроген ↓, Прогестерон ↓',
        tips:['😴 Больше отдыхайте', '🍲 Тёплая сытная еда', '📓 Дневник, рефлексия', '🚶 Лёгкие прогулки'],
        food:['Железо (мясо, гречка)', 'Тёплые супы', 'Имбирный чай', 'Магний']
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._hmState) window._hmState = {
    tab:      'check',
    selected: [],   // выбранные симптомы
    result:   null, // { hormones, recs, nutrition }
    phase:    null  // фаза цикла
};
const _hm = window._hmState;

// ============================================
// УТИЛИТЫ
// ============================================
function _hmToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _hmHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _hmUid()   { return window.CONFIG?.USER_ID; }

function _hmCalc(selected) {
    const ids = selected.map(s => s.id);
    let cortisol = 50, dopamine = 50, serotonin = 50, oxytocin = 50, melatonin = 50;

    if (ids.includes('anxiety') || ids.includes('irritation'))    { cortisol = 78; melatonin -= 15; }
    if (ids.includes('insomnia'))                                  { cortisol += 10; melatonin = Math.max(20, melatonin - 20); }
    if (ids.includes('apathy') || ids.includes('no_motivation'))  { dopamine = 28; serotonin -= 10; }
    if (ids.includes('procrastination'))                          { dopamine = Math.min(dopamine, 35); }
    if (ids.includes('sadness'))                                  { serotonin = 30; dopamine -= 8; }
    if (ids.includes('loneliness'))                               { oxytocin = 30; }
    if (ids.includes('sugar_craving'))                            { serotonin = Math.min(serotonin, 38); }
    if (ids.includes('low_energy'))                               { dopamine -= 10; cortisol += 8; }

    cortisol  = Math.min(95, Math.max(10, cortisol));
    dopamine  = Math.min(95, Math.max(10, dopamine));
    serotonin = Math.min(95, Math.max(10, serotonin));
    oxytocin  = Math.min(95, Math.max(10, oxytocin));
    melatonin = Math.min(95, Math.max(10, melatonin));

    // Определяем главный гормон для питания
    let mainHormone = 'cortisol';
    if (ids.includes('apathy') || ids.includes('no_motivation') || ids.includes('procrastination')) mainHormone = 'dopamine';
    else if (ids.includes('sadness') || ids.includes('sugar_craving')) mainHormone = 'serotonin';
    else if (ids.includes('loneliness')) mainHormone = 'oxytocin';
    else if (ids.includes('insomnia')) mainHormone = 'melatonin';

    // Рекомендации
    const recs = [];
    if (cortisol > 65)  recs.push({ title:'😰 Снизить кортизол', items:['Дыхание 4-7-8 (3 раза)', 'Прогулка 15 мин без телефона', 'Магний вечером', 'Ограничить кофеин после 14:00'] });
    if (dopamine < 40)  recs.push({ title:'⚡ Повысить дофамин', items:['Маленькая выполненная задача прямо сейчас', 'Физическая активность 10 мин', 'Холодный душ (30 сек)', 'Список 3 достижений за день'] });
    if (serotonin < 40) recs.push({ title:'😊 Поднять серотонин', items:['Солнечный свет или яркий свет утром', 'Бананы или финики', 'Контакт с людьми (даже короткий)', 'Прогулка на свежем воздухе'] });
    if (oxytocin < 40)  recs.push({ title:'💕 Повысить окситоцин', items:['Обнять кого-то (или питомца)', 'Позвонить близкому человеку', 'Тёплый душ или ванна', 'Написать кому-то тёплое сообщение'] });
    if (melatonin < 35) recs.push({ title:'🌙 Улучшить сон', items:['За 1 час до сна — без экранов', 'Тёмная прохладная комната', 'Тёплое молоко или вишнёвый сок', 'Одинаковое время отхода ко сну'] });

    return { cortisol, dopamine, serotonin, oxytocin, melatonin, mainHormone, recs };
}

// ============================================
// РЕНДЕР
// ============================================
function _hmRender() {
    _hmInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const TABS = [
        { id:'check',     label:'🔬 Диагностика' },
        { id:'nutrition', label:'🍽️ Питание' },
        { id:'cycle',     label:'🔄 Цикл' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="hm-tab${_hm.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (_hm.tab === 'check')     body = _hmCheck();
    if (_hm.tab === 'nutrition') body = _hmNutrition();
    if (_hm.tab === 'cycle')     body = _hmCycle();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="hmBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🧬</div>
                <h1 class="content-title">Гормоны</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Баланс и самочувствие</p>
            </div>
            <div class="hm-tabs">${tabsHtml}</div>
            <div id="hmBody">${body}</div>
        </div>`;

    document.getElementById('hmBack').onclick = () => _hmHome();
    document.querySelectorAll('.hm-tab').forEach(btn => {
        btn.addEventListener('click', () => { _hm.tab = btn.dataset.tab; _hmRender(); });
    });
    _hmBindHandlers();
}

// ===== ДИАГНОСТИКА =====
function _hmCheck() {
    const sympHtml = HM_SYMPTOMS.map(s => `
        <div class="hm-symptom${_hm.selected.find(x=>x.id===s.id)?' sel':''}" data-id="${s.id}">
            <span class="hm-symptom-icon">${s.icon}</span>
            <span class="hm-symptom-text">${s.text}</span>
        </div>`).join('');

    const hasSelected = _hm.selected.length > 0;
    const r = _hm.result;

    const profileHtml = r ? `
        <div class="hm-section-label">🔬 Ваш гормональный профиль</div>
        <div class="hm-profile-card">
            <div class="hm-profile-title">Оценка по симптомам</div>
            ${[
                { name:'😰 Кортизол (стресс)',      val:r.cortisol,  inv:true,  grad:'#f59e0b, #d97706' },
                { name:'⚡ Дофамин (мотивация)',    val:r.dopamine,  inv:false, grad:'#8b5cf6, #6d28d9' },
                { name:'😊 Серотонин (настроение)', val:r.serotonin, inv:false, grad:'#10b981, #059669' },
                { name:'💕 Окситоцин (привязанность)',val:r.oxytocin,inv:false, grad:'#ec4899, #be185d' },
                { name:'🌙 Мелатонин (сон)',         val:r.melatonin,inv:false, grad:'#3b82ff, #1e3a5f' }
            ].map(h => {
                const isHigh = h.inv ? h.val > 65 : h.val > 65;
                const isLow  = h.inv ? h.val < 40 : h.val < 40;
                const label  = h.inv
                    ? (h.val > 65 ? '⚠️ повышен' : (h.val < 35 ? '📉 понижен' : '✅ норма'))
                    : (h.val < 40 ? '📉 понижен' : (h.val > 75 ? '🎉 отлично' : '✅ норма'));
                return `
                <div class="hm-hormone-row">
                    <div class="hm-hormone-header">
                        <span class="hm-hormone-name">${h.name}</span>
                        <span class="hm-hormone-status">${label} ${h.val}%</span>
                    </div>
                    <div class="hm-hormone-bar">
                        <div class="hm-hormone-fill" style="width:${h.val}%;background:linear-gradient(90deg,${h.grad})"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>

        ${r.recs.length ? `
        <div class="hm-section-label">💊 Что делать прямо сейчас</div>
        ${r.recs.map(rec => `
        <div class="hm-rec-card">
            <div class="hm-rec-title">${rec.title}</div>
            ${rec.items.map(it => `<div class="hm-rec-item">• ${it}</div>`).join('')}
        </div>`).join('')}` : ''}
    ` : '';

    return `
        <div class="hm-section-label">Что сейчас беспокоит?</div>
        <div class="hm-symptoms-grid">${sympHtml}</div>

        ${hasSelected
            ? `<button class="hm-btn hm-btn-primary" id="hmAnalyzeBtn">🔬 Показать гормональный профиль</button>`
            : `<div class="hm-tip">👆 Выберите один или несколько симптомов чтобы увидеть что происходит с гормонами</div>`
        }

        ${profileHtml}

        ${r ? `<div class="hm-btn-row">
            <button class="hm-btn hm-btn-ghost" id="hmResetBtn">🔄 Выбрать снова</button>
        </div>` : ''}`;
}

// ===== ПИТАНИЕ =====
function _hmNutrition() {
    const mainHormone = _hm.result?.mainHormone || 'cortisol';
    const nutrition   = HM_NUTRITION[mainHormone];

    const allHtml = Object.entries(HM_NUTRITION).map(([key, n]) => `
        <div class="hm-nutrition-card">
            <div class="hm-rec-title">🍽️ При ${n.hormone}</div>
            ${n.foods.map(f => `
            <div class="hm-food-item">
                <span class="hm-food-icon">${f.emoji}</span>
                <div>
                    <div class="hm-food-name">${f.name}</div>
                    <div class="hm-food-effect">✨ ${f.effect}</div>
                </div>
            </div>`).join('')}
            ${n.avoid.length ? `<div class="hm-avoid-row">🚫 Избегать: ${n.avoid.join(' · ')}</div>` : ''}
        </div>`).join('');

    const personalBlock = _hm.result ? `
        <div class="hm-section-label">🎯 По вашим симптомам — приоритет</div>
        <div class="hm-nutrition-card" style="border-color:rgba(224,224,224,0.25)">
            <div class="hm-rec-title">🍽️ ${HM_NUTRITION[mainHormone].hormone}</div>
            ${HM_NUTRITION[mainHormone].foods.map(f => `
            <div class="hm-food-item">
                <span class="hm-food-icon">${f.emoji}</span>
                <div>
                    <div class="hm-food-name">${f.name}</div>
                    <div class="hm-food-effect">✨ ${f.effect}</div>
                </div>
            </div>`).join('')}
        </div>
        <div class="hm-section-label" style="margin-top:20px">Полная база питания</div>` : `
        <div class="hm-tip">💡 Пройдите диагностику во вкладке «Диагностика» — увидите персональные рекомендации по питанию</div>
        <div class="hm-section-label" style="margin-top:16px">База питания по гормонам</div>`;

    return personalBlock + allHtml;
}

// ===== ЦИКЛ =====
function _hmCycle() {
    const phasesHtml = Object.entries(HM_CYCLE_PHASES).map(([key, ph]) => `
        <div class="hm-phase-btn${_hm.phase===key?' sel':''}" data-phase="${key}">
            <span class="hm-phase-emoji">${ph.emoji}</span>
            <span class="hm-phase-name">${ph.name}</span>
            <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${ph.days}</div>
        </div>`).join('');

    const ph = _hm.phase ? HM_CYCLE_PHASES[_hm.phase] : null;
    const phInfo = ph ? `
        <div class="hm-section-label">${ph.emoji} ${ph.name} — рекомендации</div>
        <div class="hm-cycle-info">
            <div class="hm-cycle-grid">
                <div class="hm-cycle-cell"><strong>Энергия</strong>${ph.energy}</div>
                <div class="hm-cycle-cell"><strong>Настроение</strong>${ph.mood}</div>
                <div class="hm-cycle-cell"><strong>Фокус</strong>${ph.focus}</div>
                <div class="hm-cycle-cell"><strong>Гормоны</strong>${ph.hormones}</div>
            </div>
            <div class="hm-rec-card" style="margin:0">
                <div class="hm-rec-title">Что делать в эту фазу</div>
                ${ph.tips.map(t => `<div class="hm-rec-item">• ${t}</div>`).join('')}
            </div>
        </div>
        <div class="hm-nutrition-card">
            <div class="hm-rec-title">🍽️ Питание в эту фазу</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.8">
                ${ph.food.join(' · ')}
            </div>
        </div>` : '';

    return `
        <div class="hm-section-label">Выберите текущую фазу цикла</div>
        <div class="hm-cycle-phases">${phasesHtml}</div>
        ${phInfo}
        <div class="hm-tip">
            💡 <strong>Каждая фаза цикла</strong> — это разная нейрохимия. Синхронизация деятельности с фазой повышает продуктивность и снижает стресс.
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _hmBindHandlers() {
    // Выбор симптомов
    document.querySelectorAll('.hm-symptom').forEach(el => {
        el.addEventListener('click', () => {
            const id  = el.dataset.id;
            const sym = HM_SYMPTOMS.find(s => s.id === id);
            const idx = _hm.selected.findIndex(s => s.id === id);
            if (idx >= 0) _hm.selected.splice(idx, 1);
            else _hm.selected.push(sym);
            el.classList.toggle('sel');
            // Показать кнопку если выбрано
            const hasSelected = _hm.selected.length > 0;
            const btn = document.getElementById('hmAnalyzeBtn');
            if (!btn && hasSelected) _hmRender();
        });
    });

    // Анализ
    document.getElementById('hmAnalyzeBtn')?.addEventListener('click', () => {
        if (!_hm.selected.length) { _hmToast('Выберите симптомы', 'error'); return; }
        _hm.result = _hmCalc(_hm.selected);
        _hmRender();
    });

    // Сброс
    document.getElementById('hmResetBtn')?.addEventListener('click', () => {
        _hm.selected = []; _hm.result = null; _hmRender();
    });

    // Фазы цикла
    document.querySelectorAll('.hm-phase-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _hm.phase = _hm.phase === btn.dataset.phase ? null : btn.dataset.phase;
            _hmRender();
        });
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showHormonesScreen() {
    _hm.tab = 'check';
    _hmRender();
}

window.showHormonesScreen = showHormonesScreen;
console.log('✅ hormones.js v1.0 загружен');
