// ============================================
// freshthought.js — Свежая мысль
// Версия 2.0 — провокация + паттерн под профиль
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _ftInjectStyles() {
    if (document.getElementById('ft-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'ft-v2-styles';
    s.textContent = `
        /* ===== КАРТОЧКА МЫСЛИ ===== */
        .ft-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 28px;
            padding: 28px 22px;
            margin-bottom: 20px;
            position: relative;
            overflow: hidden;
        }
        .ft-card::before {
            content: '"';
            position: absolute;
            top: 12px;
            left: 18px;
            font-size: 72px;
            font-family: Georgia, serif;
            color: rgba(224,224,224,0.08);
            line-height: 1;
            pointer-events: none;
        }
        .ft-type-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.14);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: var(--chrome);
            margin-bottom: 18px;
        }
        .ft-main-text {
            font-size: 17px;
            line-height: 1.65;
            color: var(--text-primary);
            font-style: italic;
            margin-bottom: 16px;
            position: relative;
            z-index: 1;
        }
        .ft-author {
            font-size: 12px;
            color: var(--text-secondary);
            text-align: right;
            margin-bottom: 16px;
        }

        /* ===== ПАТТЕРН-БЛОК ===== */
        .ft-pattern-block {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-top: 16px;
        }
        .ft-pattern-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .ft-pattern-text {
            font-size: 13px;
            line-height: 1.6;
            color: var(--text-secondary);
        }
        .ft-pattern-action {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(224,224,224,0.08);
            font-size: 12px;
            color: var(--silver-brushed);
            font-weight: 500;
        }

        /* ===== КАТЕГОРИЯ ===== */
        .ft-category {
            font-size: 11px;
            color: var(--text-secondary);
            text-align: center;
            margin-bottom: 20px;
        }

        /* ===== КНОПКИ ===== */
        .ft-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
        }
        .ft-btn {
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
        .ft-btn:active { transform: scale(0.97); }
        .ft-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.28);
            color: var(--text-primary);
        }
        .ft-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.26), rgba(192,192,192,0.16)); }
        .ft-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .ft-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }

        /* ===== ПОДСКАЗКА ===== */
        .ft-tip {
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
            .ft-card { padding: 22px 16px; }
            .ft-main-text { font-size: 15px; }
            .ft-card::before { font-size: 54px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА КОНТЕНТА — ПРОВОКАЦИИ + ПАТТЕРНЫ
// ============================================

// Провокационные вопросы под каждый вектор
const FT_PROVOCATIONS = {
    СБ: [
        {
            text: 'Почему ты молчишь, когда хочешь сказать «нет»?',
            pattern: 'Молчание в моменте конфликта — это не вежливость. Это старый способ выжить, который когда-то работал. Тело запомнило: «не возражай — безопаснее». Теперь ты платишь за чужой комфорт своим.',
            action: 'Сегодня скажи одно «нет» — маленькое, безопасное. Просто чтобы вспомнить, что это возможно.'
        },
        {
            text: 'Когда ты последний раз защищал себя, а не уступал?',
            pattern: 'Уступчивость часто выглядит как доброта — и снаружи, и изнутри. Но есть разница между тем, кто уступает из щедрости, и тем, кто уступает из страха. Ты знаешь, из чего ты.',
            action: 'Вспомни одну ситуацию, где ты хотел другого, но промолчал. Что было бы, если бы ты сказал?'
        },
        {
            text: 'Чьё одобрение ты ищешь чаще всего — и зачем?',
            pattern: 'Мы все ищем одобрения. Вопрос не в этом. Вопрос в том, насколько сильно это одобрение управляет твоими решениями. Если без него ты не можешь начать — это уже зависимость.',
            action: 'Сделай сегодня одно маленькое дело для себя — не для одобрения, а просто потому что хочешь.'
        }
    ],
    ТФ: [
        {
            text: 'Сколько раз ты говорил «как-нибудь разберусь с деньгами» — и не разбирался?',
            pattern: '«Как-нибудь» — это не план, это анестезия. Тревога о деньгах заглушается откладыванием: если не смотреть, как будто проблемы нет. Но деньги не исчезают от того, что ты отвернулся.',
            action: 'Открой банковское приложение прямо сейчас. Просто посмотри на цифры — без оценки.'
        },
        {
            text: 'Почему ты работаешь больше, но денег не становится больше?',
            pattern: 'Больше усилий не равно больше результата. Это ловушка «трудовой этики» — идея, что если устал, значит заслужил. Деньги приходят не за усталость, а за ценность. Это разные вещи.',
            action: 'Запиши: что ты умеешь, за что люди готовы платить? Не то, чем занимаешься, а что ценно в тебе.'
        },
        {
            text: 'Если бы деньги не были проблемой — что бы изменилось в твоей жизни прямо сейчас?',
            pattern: 'Ответ на этот вопрос показывает, что ты на самом деле хочешь. Иногда выясняется, что дело не в деньгах — а в разрешении себе жить иначе.',
            action: 'Запиши ответ честно. Посмотри: что из этого можно начать делать уже сейчас, без денег?'
        }
    ],
    УБ: [
        {
            text: 'Ты ищешь информацию — или ищешь подтверждение того, во что уже веришь?',
            pattern: 'Мозг — мастер подтверждения. Мы читаем то, что согласуется с нашей картиной мира, и игнорируем остальное. Это не глупость — это эффективность. Но она делает нас предсказуемыми.',
            action: 'Найди одну точку зрения, с которой ты не согласен. Прочитай её до конца, не возражая мысленно.'
        },
        {
            text: 'Когда ты в последний раз менял своё мнение под влиянием новых фактов?',
            pattern: 'Способность менять мнение — это признак силы ума, а не слабости. Те, кто никогда не меняют точку зрения, не думают — они защищают идентичность.',
            action: 'Вспомни убеждение, которое держишь давно. Спроси себя: а что должно было бы произойти, чтобы ты передумал?'
        },
        {
            text: 'Ты знаешь много — но что ты с этим делаешь?',
            pattern: 'Знание без действия — это коллекция, а не инструмент. Иногда за накоплением информации прячется страх: пока я изучаю, мне не нужно рисковать.',
            action: 'Выбери одно знание, которое у тебя давно есть, но не применяется. Сделай с ним хоть что-то сегодня.'
        }
    ],
    ЧВ: [
        {
            text: 'Кто в твоей жизни знает тебя настоящего — а не ту версию, которую ты показываешь?',
            pattern: 'Близость начинается там, где заканчивается маска. Но маску так удобно носить — она защищает от отвержения. Проблема в том, что когда тебя принимают в маске, ты не чувствуешь принятия.',
            action: 'Сегодня скажи кому-то близкому одну честную вещь, которую обычно не говоришь.'
        },
        {
            text: 'Ты помогаешь другим потому что хочешь — или потому что боишься отказать?',
            pattern: 'Есть два вида помощи: из избытка и из страха. Первая питает. Вторая истощает. Если после помощи ты чувствуешь обиду — скорее всего, это был второй вид.',
            action: 'В следующий раз, когда кто-то попросит о помощи, сначала спроси себя: я хочу помочь или боюсь сказать нет?'
        },
        {
            text: 'Почему тебе легче давать, чем принимать?',
            pattern: 'Те, кому трудно принимать помощь, часто выросли в среде, где получать было стыдно или опасно. Давать — значит контролировать. Принимать — значит быть уязвимым. Уязвимость пугает.',
            action: 'Позволь кому-то сегодня сделать что-то для тебя — и не говори «не надо, я сам».'
        }
    ]
};

// Мудрые мысли — острые, не банальные
const FT_WISDOM = [
    {
        text: 'То, что вы сопротивляетесь — остаётся. То, что принимаете — трансформируется.',
        author: 'Карл Юнг',
        category: 'О принятии',
        pattern: 'Сопротивление — это энергия, направленная против реальности. Чем сильнее ты давишь на то, что уже есть, тем прочнее оно держится. Принятие — не капитуляция. Это первый шаг к изменению.',
        action: 'Назови одну вещь, против которой ты сейчас сражаешься. Что было бы, если бы ты просто признал, что она существует?'
    },
    {
        text: 'Самая большая свобода — это свобода выбирать, как реагировать на любую ситуацию.',
        author: 'Виктор Франкл',
        category: 'О свободе',
        pattern: 'Между стимулом и реакцией есть пространство. В этом пространстве — вся твоя свобода. Большинство живут так, будто этого пространства нет: раздражитель → реакция, автоматически. Но пауза возможна.',
        action: 'В следующей раздражающей ситуации — сделай вдох перед тем, как ответить. Одна секунда паузы меняет всё.'
    },
    {
        text: 'Границы — это не стены. Это место, где заканчиваюсь я и начинаешься ты.',
        author: 'Брене Браун',
        category: 'О границах',
        pattern: 'Люди без границ думают, что они добрее. На самом деле они просто не умеют отказывать. Граница — это не агрессия. Это честность о том, что для тебя возможно, а что нет.',
        action: 'Есть ли сейчас в твоей жизни что-то, на что ты согласился, но не хотел? Как можно это изменить?'
    },
    {
        text: 'Уязвимость — это не слабость. Это точное измерение смелости.',
        author: 'Брене Браун',
        category: 'Об уязвимости',
        pattern: 'Мы живём в культуре, которая награждает броню и наказывает мягкость. Но броня стоит дорого: она защищает и от боли, и от близости одновременно. Нельзя избирательно отключить уязвимость.',
        action: 'Расскажи кому-то о чём-то, что тебя беспокоит. Не для совета — просто вслух.'
    },
    {
        text: 'Вы не можете остановить волны, но можете научиться на них плавать.',
        author: 'Джон Кабат-Зинн',
        category: 'Об устойчивости',
        pattern: 'Контроль над обстоятельствами — иллюзия. Но контроль над отношением к ним — реальность. Устойчивость — не отсутствие падений. Это скорость, с которой ты встаёшь.',
        action: 'Что сейчас в твоей жизни ты пытаешься контролировать, но не можешь? Можешь ли ты отпустить именно это?'
    },
    {
        text: 'То, что ты думаешь о себе в 3 часа ночи — это не правда. Это усталость.',
        author: 'Фреди',
        category: 'О внутреннем критике',
        pattern: 'Внутренний критик умнее нас: он атакует в моменты, когда защита слаба. Усталость, голод, одиночество — его любимое время. Голос, который говорит «ты недостаточно хорош» — не объективность. Это паттерн.',
        action: 'Запомни: мысли в уязвимые моменты — не приговор. Проверяй их в спокойном состоянии.'
    }
];

// Короткие практики — конкретные, не абстрактные
const FT_PRACTICES = [
    {
        text: 'Дыхание 4-7-8',
        category: 'Нервная система',
        pattern: 'Медленный выдох активирует парасимпатическую нервную систему — режим покоя. Это физиология, не эзотерика. Тело успокаивается быстрее, чем разум.',
        action: 'Вдох на 4 счёта → задержка на 7 → выдох на 8. Повторить 4 раза. Делать прямо сейчас.'
    },
    {
        text: 'Пять чувств',
        category: 'Заземление',
        pattern: 'Тревога живёт в будущем. Заземление возвращает в настоящее через тело — самый быстрый способ выйти из головы.',
        action: 'Назови: 5 вещей, которые видишь → 4, которые можешь потрогать → 3, которые слышишь → 2, которые чуешь → 1, которую ощущаешь на вкус.'
    },
    {
        text: 'Выгрузка мыслей',
        category: 'Голова',
        pattern: 'Мозг не предназначен для хранения списков дел и тревог. Когда всё крутится внутри — нарастает фоновое напряжение. Запись освобождает рабочую память.',
        action: 'Возьми лист или телефон. Пиши всё, что в голове — 5 минут без остановки. Не перечитывай. Просто выгрузи.'
    },
    {
        text: 'Поза силы',
        category: 'Тело',
        pattern: 'Тело влияет на состояние быстрее, чем мысли. Сжатая поза снижает уровень тестостерона и повышает кортизол. Открытая поза — наоборот. Это не метафора — это нейробиология.',
        action: 'Встань прямо. Плечи назад. Руки на бёдрах или за голову. Постой так 2 минуты. Почувствуй разницу.'
    },
    {
        text: 'Три благодарности',
        category: 'Фокус',
        pattern: 'Мозг эволюционно настроен на угрозы — плохое замечается быстрее хорошего. Практика благодарности буквально перепрограммирует фокус внимания. Через несколько недель регулярной практики — меняется восприятие.',
        action: 'Прямо сейчас напиши три конкретные вещи, за которые ты благодарен сегодня. Не «семья и здоровье» — а конкретное: что именно сегодня.'
    }
];

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._ftState) window._ftState = { vectors: {СБ:4,ТФ:4,УБ:4,ЧВ:4} };
const _ft = window._ftState;

// ============================================
// УТИЛИТЫ
// ============================================
function _ftHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _ftApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _ftUid()   { return window.CONFIG?.USER_ID; }
function _ftToast(msg, type) { if (window.showToast) window.showToast(msg, type||'info'); }
function _ftShuffle(arr) {
    const a = [...arr];
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
}

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _ftLoadVectors() {
    try {
        const r = await fetch(`${_ftApi()}/api/get-profile/${_ftUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x||4);
        _ft.vectors = { СБ:avg(bl.СБ), ТФ:avg(bl.ТФ), УБ:avg(bl.УБ), ЧВ:avg(bl.ЧВ) };
    } catch {}
}

// ============================================
// ВЫБОР МЫСЛИ
// ============================================
function _ftPickThought() {
    const v = _ft.vectors;

    // Слабый вектор — под него провокация
    const sorted = Object.entries(v).sort((a,b)=>a[1]-b[1]);
    const weakKey = sorted[0][0];
    const weakScore = sorted[0][1];

    // Тип контента — чередуем: 50% провокация, 30% мудрость, 20% практика
    const roll = Math.random();
    let type, item;

    if (roll < 0.50) {
        // Провокация под слабый вектор
        const pool = FT_PROVOCATIONS[weakKey] || FT_PROVOCATIONS.ЧВ;
        item = _ftShuffle(pool)[0];
        type = 'provocation';
    } else if (roll < 0.80) {
        // Мудрость
        item = _ftShuffle(FT_WISDOM)[0];
        type = 'wisdom';
    } else {
        // Практика
        item = _ftShuffle(FT_PRACTICES)[0];
        type = 'practice';
    }

    const levelDesc = weakScore <= 2 ? 'сейчас особенно актуально'
                    : weakScore <= 4 ? 'есть над чем подумать'
                    : 'точка для роста';

    return { type, item, weakKey, weakScore, levelDesc };
}

// ============================================
// РЕНДЕР
// ============================================
function _ftRender(picked) {
    _ftInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const { type, item, weakKey, levelDesc } = picked;

    const TYPES = {
        provocation: { emoji:'🔥', label:'Провокация' },
        wisdom:      { emoji:'🦉', label:'Мудрость' },
        practice:    { emoji:'🧘', label:'Практика' }
    };
    const t = TYPES[type];

    // Основной текст
    const mainText = type === 'provocation'
        ? item.text
        : item.text;

    const authorHtml = item.author
        ? `<div class="ft-author">— ${item.author}</div>`
        : '';

    const categoryHtml = item.category
        ? `<div class="ft-category">${item.category}</div>`
        : '';

    // Паттерн-блок (у всех типов есть pattern + action)
    const patternHtml = item.pattern ? `
        <div class="ft-pattern-block">
            <div class="ft-pattern-label">🧠 Что за этим стоит</div>
            <div class="ft-pattern-text">${item.pattern}</div>
            ${item.action ? `<div class="ft-pattern-action">→ ${item.action}</div>` : ''}
        </div>` : '';

    // Бейдж вектора
    const vectorNames = { СБ:'уверенность', ТФ:'ресурсы', УБ:'смыслы', ЧВ:'отношения' };
    const vectorBadge = type === 'provocation' ? `
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:16px">
            🧬 Для твоего профиля · ${vectorNames[weakKey]} · ${levelDesc}
        </div>` : '';

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="ftBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${t.emoji}</div>
                <h1 class="content-title">${t.label}</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Свежая мысль от Фреди</p>
            </div>

            <div class="ft-card">
                <div class="ft-type-badge">${t.emoji} ${t.label}</div>
                ${vectorBadge}
                <div class="ft-main-text">${mainText}</div>
                ${authorHtml}
                ${categoryHtml}
                ${patternHtml}
            </div>

            <div class="ft-actions">
                <button class="ft-btn ft-btn-primary" id="ftNew">🔄 Новая мысль</button>
                <button class="ft-btn ft-btn-ghost" id="ftShare">📤 Поделиться</button>
            </div>

            <div class="ft-tip">
                💡 Не торопись дальше. Позволь этой мысли побыть с тобой несколько минут.
            </div>
        </div>`;

    document.getElementById('ftBack').onclick = () => _ftHome();

    document.getElementById('ftNew').onclick = async () => {
        await _ftLoadVectors();
        _ftRender(_ftPickThought());
    };

    document.getElementById('ftShare').onclick = () => {
        let text = `${t.emoji} ${t.label}\n\n${mainText}`;
        if (item.author) text += `\n\n— ${item.author}`;
        if (item.action) text += `\n\n→ ${item.action}`;
        text += '\n\n✨ Фреди — виртуальный психолог';
        if (navigator.share) {
            navigator.share({ title:'Свежая мысль от Фреди', text }).catch(() => _ftCopy(text));
        } else {
            _ftCopy(text);
        }
    };
}

function _ftCopy(text) {
    copyToClipboard(text)
        .then(() => _ftToast('📋 Скопировано', 'success'))
        .catch(() => _ftToast('Не удалось скопировать', 'error'));
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showFreshThoughtScreen() {
    const c = document.getElementById('screenContainer');
    if (!c) return;

    // Мгновенный рендер с текущими векторами, потом обновляем
    _ftRender(_ftPickThought());
    await _ftLoadVectors();
    // Перерендерим только если векторы изменились
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showFreshThoughtScreen = showFreshThoughtScreen;
console.log('✅ freshthought.js v2.0 загружен');
