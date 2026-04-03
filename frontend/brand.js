// ============================================
// brand.js — Личный бренд, стиль и архетип
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _brandInjectStyles() {
    if (document.getElementById('brand-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'brand-v2-styles';
    s.textContent = `
        /* ===== ТАБЫ ===== */
        .brand-tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 24px;
            background: rgba(10,10,10,0.5);
            border-radius: 50px;
            padding: 4px;
            border: 1px solid rgba(224,224,224,0.12);
        }
        .brand-tab {
            flex: 1;
            padding: 9px 6px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
            min-height: 40px;
            touch-action: manipulation;
            outline: none;
            white-space: nowrap;
        }
        .brand-tab.active {
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.08));
            color: var(--text-primary);
        }
        .brand-tab:hover:not(.active) {
            background: rgba(224,224,224,0.08);
            color: var(--text-primary);
        }

        /* ===== КАРТОЧКА АРХЕТИПА ===== */
        .brand-hero-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 24px;
            padding: 28px 20px;
            text-align: center;
            margin-bottom: 20px;
        }
        .brand-hero-icon {
            font-size: 60px;
            line-height: 1.1;
            display: block;
            margin-bottom: 12px;
        }
        .brand-hero-name {
            font-size: 22px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .brand-hero-desc {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            max-width: 280px;
            margin: 0 auto;
        }

        /* ===== СЕКЦИИ ===== */
        .brand-section {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .brand-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.7px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        .brand-section-body {
            font-size: 13px;
            line-height: 1.7;
            color: var(--text-secondary);
        }

        /* ===== ТЕГИ ===== */
        .brand-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
        }
        .brand-tag {
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 20px;
            padding: 5px 12px;
            font-size: 12px;
            color: var(--silver-brushed);
        }

        /* ===== ЦВЕТОВЫЕ ЧИПЫ ===== */
        .brand-color-chip {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 20px;
            padding: 5px 12px 5px 6px;
            font-size: 12px;
            color: var(--text-secondary);
        }
        .brand-color-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* ===== НИЖНИЕ КНОПКИ ===== */
        .brand-footer-row {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .brand-footer-btn {
            flex: 1;
            padding: 12px 16px;
            border-radius: 40px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            min-height: 44px;
            touch-action: manipulation;
            outline: none;
            transition: background 0.2s, transform 0.15s;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            color: var(--text-secondary);
            text-align: center;
        }
        .brand-footer-btn:hover {
            background: rgba(224,224,224,0.13);
            color: var(--text-primary);
        }
        .brand-footer-btn:active { transform: scale(0.97); }

        @media (max-width: 480px) {
            .brand-hero-icon { font-size: 48px; }
            .brand-hero-name { font-size: 18px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ДАННЫЕ АРХЕТИПОВ
// ============================================
const ARCHETYPES = {
    INNOCENT:  { name:'ПРОСТОДУШНЫЙ', emoji:'😇', description:'Оптимист, который верит в лучшее и ищет гармонию', style:'Естественный, светлые тона, натуральные ткани', brand:'Эксперт по позитиву, доверию и простоте', careers:['Психолог','Учитель','Воспитатель','Бренд-амбассадор'], brands:['Coca-Cola','Dove','Johnson & Johnson'] },
    EVERYMAN:  { name:'СЛАВНЫЙ МАЛЫЙ', emoji:'👥', description:'Свой парень, который ценит принадлежность и связь', style:'Демократичный, доступный, без излишеств', brand:'Народный эксперт, близкий к аудитории', careers:['HR','Менеджер','Политик','Лидер сообщества'], brands:['IKEA','Volkswagen','ВкусВилл'] },
    HERO:      { name:'ГЕРОЙ', emoji:'🦸', description:'Смелый боец, который доказывает ценность через действие', style:'Спортивный, динамичный, яркие акценты', brand:'Эксперт по преодолению и достижениям', careers:['Спортсмен','Военный','Спасатель','CEO'], brands:['Nike','Red Bull','Under Armour'] },
    CAREGIVER: { name:'ЗАБОТЛИВЫЙ', emoji:'🤱', description:'Альтруист, который защищает и заботится о других', style:'Мягкий, уютный, пастельные тона', brand:'Эксперт по заботе, помощи и поддержке', careers:['Врач','Социальный работник','Волонтёр','Коуч'], brands:['Pampers','Dove','Добро.Mail.ru'] },
    EXPLORER:  { name:'ИСКАТЕЛЬ', emoji:'🧭', description:'Авантюрист, который ищет свободу и новые горизонты', style:'Походный, практичный, землистые тона', brand:'Эксперт по путешествиям и открытиям', careers:['Фотограф','Журналист','Гид','Исследователь'], brands:['Jeep','The North Face','GoPro'] },
    REBEL:     { name:'БУНТАРЬ', emoji:'🤘', description:'Разрушитель шаблонов, который меняет правила игры', style:'Авангардный, чёрный, кожа, металл', brand:'Эксперт по переменам и инновациям', careers:['Предприниматель','Художник','Активист','Стартапер'], brands:['Harley-Davidson','Diesel','Supreme'] },
    LOVER:     { name:'ЛЮБОВНИК', emoji:'💕', description:'Страстный ценитель красоты, близости и удовольствий', style:'Чувственный, элегантный, шёлк и бархат', brand:'Эксперт по отношениям, красоте и наслаждению', careers:['Дизайнер','Визажист','Шеф-повар','Стилист'], brands:['Chanel','Victoria Secret','Godiva'] },
    CREATOR:   { name:'ТВОРЕЦ', emoji:'🎨', description:'Новатор, который создаёт уникальное и новое', style:'Креативный, нестандартный, яркие детали', brand:'Эксперт по созданию и инновациям', careers:['Дизайнер','Архитектор','Писатель','Музыкант'], brands:['Apple','LEGO','Adobe'] },
    JESTER:    { name:'ШУТ', emoji:'🃏', description:'Весельчак, который приносит радость и лёгкость', style:'Яркий, эксцентричный, смелые сочетания', brand:'Эксперт по юмору, развлечениям и позитиву', careers:['Комедиант','Аниматор','SMM','Тик-токер'], brands:["M&M's",'Skittles','Old Spice'] },
    SAGE:      { name:'МУДРЕЦ', emoji:'🦉', description:'Искатель истины, который передаёт знания', style:'Академичный, консервативный, тёмные тона', brand:'Эксперт по знаниям, аналитике и обучению', careers:['Учёный','Преподаватель','Аналитик','Ментор'], brands:['Google','Harvard','The Economist'] },
    MAGICIAN:  { name:'МАГ', emoji:'🔮', description:'Визионер, который превращает мечты в реальность', style:'Мистический, элегантный, глубокие цвета', brand:'Эксперт по трансформации и чудесам', careers:['Психолог','Коуч','Инноватор','Стратег'], brands:['Tesla','Disney','MasterClass'] },
    RULER:     { name:'ПРАВИТЕЛЬ', emoji:'👑', description:'Лидер, который создаёт порядок и процветание', style:'Статусный, дорогой, классический', brand:'Эксперт по лидерству, управлению и власти', careers:['Директор','Политик','Судья','Банкир'], brands:['Mercedes-Benz','Rolex','Microsoft'] }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._brandState) {
    window._brandState = { tab: 'archetype', archetypeKey: null };
}
const _brandState = window._brandState;

// ============================================
// УТИЛИТЫ
// ============================================
function _brandToast(msg) { if (window.showToast) window.showToast(msg, 'info'); }
function _brandHome()     { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }

// ============================================
// ОПРЕДЕЛЕНИЕ АРХЕТИПА ПО ВЕКТОРАМ
// ============================================
function _detectArchetype() {
    // Пробуем взять векторы из профиля двойников или из сохранённых результатов теста
    let v = { СБ:4, ТФ:4, УБ:4, ЧВ:4 };

    try {
        const uid = window.CONFIG?.USER_ID;
        const stored = localStorage.getItem(`test_results_${uid}`);
        if (stored) {
            const d = JSON.parse(stored);
            const bl = d.profile?.behavioral_levels || d.behavioralLevels || {};
            const avg = arr => Array.isArray(arr) ? (arr.reduce((a,b)=>a+b,0)/arr.length||4) : (arr||4);
            v = { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
        }
    } catch {}

    const { СБ: sb, ТФ: tf, УБ: ub, ЧВ: chv } = v;

    if (sb >= 5 && tf >= 5 && ub >= 5) return 'RULER';
    if (chv >= 5 && sb >= 4)           return 'LOVER';
    if (ub >= 5 && sb >= 4)            return 'SAGE';
    if (chv >= 5 && ub <= 3)           return 'CAREGIVER';
    if (sb >= 5 && tf >= 4)            return 'HERO';
    if (ub >= 4 && chv >= 4)           return 'CREATOR';
    if (chv >= 5)                      return 'CAREGIVER';
    if (sb >= 5)                       return 'HERO';
    if (tf >= 5)                       return 'RULER';
    if (ub >= 5)                       return 'SAGE';
    return 'EXPLORER';
}

// ============================================
// КОНТЕНТ ДЛЯ ВКЛАДОК
// ============================================
const _SUPERPOWERS = {
    'ТВОРЕЦ':      'Вы видите то, чего ещё нет, и создаёте это. Воображение и инновации — ваши главные инструменты.',
    'МУДРЕЦ':      'Видите закономерности там, где другие — хаос. Ваши знания экономят людям годы ошибок.',
    'ГЕРОЙ':       'Действуете там, где другие боятся. Ваша смелость становится ресурсом для окружающих.',
    'ЗАБОТЛИВЫЙ':  'Создаёте пространство, где люди могут расти и быть уязвимыми без страха.',
    'ПРАВИТЕЛЬ':   'Создаёте порядок из хаоса и умеете вести за собой людей к результату.',
    'ИСКАТЕЛЬ':    'Находите пути там, где их не видят. Адаптивность — ваша суперсила.',
    'БУНТАРЬ':     'Ломаете устаревшие системы и создаёте новые правила игры.',
    'ЛЮБОВНИК':    'Создаёте красоту и гармонию, притягиваете людей своей энергетикой.',
    'ПРОСТОДУШНЫЙ':'Вселяете доверие и оптимизм. Ваша искренность — главный актив.',
    'СЛАВНЫЙ МАЛЫЙ':'Люди вам доверяют, потому что вы один из них. Близость без барьеров.',
    'ШУТ':         'Делаете жизнь легче и веселее. Юмор и лёгкость — ваш особый дар.',
    'МАГ':         'Превращаете мечты в реальность. Трансформация — ваш главный процесс.'
};

const _GROWTH = {
    'ТВОРЕЦ':      'Доводить проекты до конца, не распыляться. Принимать критику как ресурс.',
    'МУДРЕЦ':      'Больше действовать, меньше анализировать. Не застревать в теории.',
    'ГЕРОЙ':       'Научиться отдыхать и просить о помощи. Не брать всё на себя.',
    'ЗАБОТЛИВЫЙ':  'Ставить себя на первое место. Говорить «нет» без чувства вины.',
    'ПРАВИТЕЛЬ':   'Делегировать и доверять. Не пытаться контролировать всё.',
    'ИСКАТЕЛЬ':    'Сфокусироваться на одном направлении. Не прыгать с места на место.',
    'БУНТАРЬ':     'Научиться работать внутри системы, не разрушая её полностью.',
    'ЛЮБОВНИК':    'Не терять себя в других. Сохранять личные границы и ориентиры.',
    'ПРОСТОДУШНЫЙ':'Говорить правду, даже если она неудобна. Укреплять устойчивость.',
    'СЛАВНЫЙ МАЛЫЙ':'Заявить о себе. Не бояться выделяться и быть заметным.',
    'ШУТ':         'Показывать серьёзность там, где это важно. Не обесценивать глубину.',
    'МАГ':         'Соблюдать обещания. Быть предсказуемым для тех, кто на вас рассчитывает.'
};

const _COLORS = {
    'ТВОРЕЦ':      [{n:'Фиолетовый',c:'#9b59b6'},{n:'Оранжевый',c:'#e67e22'},{n:'Бирюзовый',c:'#1abc9c'}],
    'МУДРЕЦ':      [{n:'Тёмно-синий',c:'#2c3e50'},{n:'Стальной',c:'#5d7d9a'},{n:'Серый',c:'#95a5a6'}],
    'ГЕРОЙ':       [{n:'Красный',c:'#c0392b'},{n:'Чёрный',c:'#1c1c1c'},{n:'Золотой',c:'#f39c12'}],
    'ЗАБОТЛИВЫЙ':  [{n:'Мятный',c:'#27ae60'},{n:'Пастельный',c:'#f8c8d4'},{n:'Бежевый',c:'#f5e6d3'}],
    'ПРАВИТЕЛЬ':   [{n:'Тёмно-синий',c:'#1a252f'},{n:'Золотой',c:'#f1c40f'},{n:'Бордовый',c:'#922b21'}],
    'ИСКАТЕЛЬ':    [{n:'Оливковый',c:'#7a8c6e'},{n:'Терракотовый',c:'#c0392b'},{n:'Хаки',c:'#8d9b6b'}],
    'БУНТАРЬ':     [{n:'Чёрный',c:'#1c1c1c'},{n:'Красный',c:'#e74c3c'},{n:'Серебро',c:'#bdc3c7'}],
    'ЛЮБОВНИК':    [{n:'Пудровый',c:'#d4a5a5'},{n:'Бордо',c:'#7b241c'},{n:'Золото',c:'#c9a84c'}],
    'ПРОСТОДУШНЫЙ':[{n:'Белый',c:'#f5f5f5'},{n:'Небесный',c:'#aed6f1'},{n:'Лимонный',c:'#fdebd0'}],
    'СЛАВНЫЙ МАЛЫЙ':[{n:'Синий деним',c:'#2980b9'},{n:'Серый',c:'#808b96'},{n:'Белый',c:'#f5f5f5'}],
    'ШУТ':         [{n:'Жёлтый',c:'#f1c40f'},{n:'Оранжевый',c:'#e67e22'},{n:'Красный',c:'#e74c3c'}],
    'МАГ':         [{n:'Пурпурный',c:'#6c3483'},{n:'Индиго',c:'#1a1a6e'},{n:'Серебро',c:'#bdc3c7'}]
};

const _PHOTO = {
    'ТВОРЕЦ':      'Нестандартные ракурсы, фото в процессе создания. Яркие цветовые акценты, студийный свет.',
    'МУДРЕЦ':      'С книгами или у доски. Классические портреты, нейтральный фон, деловая обстановка.',
    'ГЕРОЙ':       'Динамика и движение, с достижениями. Спортивный стиль, чёткие линии, высокий контраст.',
    'ЗАБОТЛИВЫЙ':  'Тёплые, уютные кадры. С людьми, детьми, природой. Мягкий рассеянный свет.',
    'ПРАВИТЕЛЬ':   'В офисе или деловой обстановке. Строгий стиль, уверенная поза, атрибуты статуса.',
    'ИСКАТЕЛЬ':    'В путешествиях и на природе. Естественные кадры, натуральный свет, горизонт.',
    'БУНТАРЬ':     'Городская среда, граффити, андеграунд. Чёрно-белые акценты, дерзкие ракурсы.',
    'ЛЮБОВНИК':    'Чувственные, элегантные портреты. Мягкий свет, красивый фон, стилизованная одежда.',
    'ПРОСТОДУШНЫЙ':'Естественные, улыбчивые фото на природе. Солнечный свет, простая одежда.',
    'СЛАВНЫЙ МАЛЫЙ':'Жизненные, неформальные кадры. Среди людей, на мероприятиях.',
    'ШУТ':         'Яркие, веселые, с юмором. Неожиданные ракурсы, гримасы, комедийные сценки.',
    'МАГ':         'Загадочные, с интересным светом. Символика, глубина, мистическая атмосфера.'
};

const _COMM = {
    'ТВОРЕЦ':      'Образно и метафорично, с воодушевлением. «Представьте, если бы...» — ваш фирменный старт.',
    'МУДРЕЦ':      'Структурированно, с фактами и данными. Ссылки на исследования, логика и схемы.',
    'ГЕРОЙ':       'Коротко, по делу, с призывами к действию. «Давай сделаем — сейчас!»',
    'ЗАБОТЛИВЫЙ':  'Мягко, поддерживающе. «Как ты себя чувствуешь?» — и искренний интерес к ответу.',
    'ПРАВИТЕЛЬ':   'Уверенно и авторитетно, с цифрами и стратегией. Без лишних слов.',
    'ИСКАТЕЛЬ':    'Открыто и любопытно, с историями. «А ты знал, что...» — провокация к размышлению.',
    'БУНТАРЬ':     'Провокационно и прямолинейно. Говорите то, о чём другие молчат.',
    'ЛЮБОВНИК':    'Тепло, чувственно, с вниманием к деталям. Создаёте атмосферу разговора.',
    'ПРОСТОДУШНЫЙ':'Искренне и просто. Без сложных слов — как будто разговариваете с другом.',
    'СЛАВНЫЙ МАЛЫЙ':'Разговорно, с юмором, по-свойски. Люди должны чувствовать: «он такой же, как я».',
    'ШУТ':         'С юмором и лёгкостью. Не боитесь быть смешным — это ваша сила.',
    'МАГ':         'С интригой и глубиной. Задаёте вопросы, которые заставляют думать иначе.'
};

const _UTP = {
    'ТВОРЕЦ':      'Я создаю то, чего ещё нет. Мои решения нестандартны и работают там, где шаблоны бессильны.',
    'МУДРЕЦ':      'Я вижу систему там, где другие видят хаос. Мои знания экономят вам годы ошибок.',
    'ГЕРОЙ':       'Я делаю то, что другие боятся. Моя смелость становится вашим ресурсом.',
    'ЗАБОТЛИВЫЙ':  'Создаю безопасное пространство для роста. С вами не страшно меняться.',
    'ПРАВИТЕЛЬ':   'Создаю порядок и систему. Со мной хаос превращается в измеримый результат.',
    'ИСКАТЕЛЬ':    'Нахожу пути там, где их не видят. Открываю новые горизонты для людей и бизнеса.',
    'БУНТАРЬ':     'Разрушаю то, что мешает расти. Создаю правила для тех, кому тесно в старых.',
    'ЛЮБОВНИК':    'Создаю красоту и близость. Там, где я, — теплее и интереснее.',
    'ПРОСТОДУШНЫЙ':'Возвращаю доверие и радость. В мире сложностей я — якорь простоты.',
    'СЛАВНЫЙ МАЛЫЙ':'Говорю то, что думают все, но боятся сказать. Я — голос своей аудитории.',
    'ШУТ':         'Делаю серьёзные вещи весело. Там, где скучно, — я включаю жизнь.',
    'МАГ':         'Трансформирую невозможное в реальное. Показываю путь туда, куда другие боятся смотреть.'
};

const _CONTENT = {
    'ТВОРЕЦ':      'Кейсы «до/после», процесс создания в Reels, инсайты о творчестве. Блог о нестандартных решениях.',
    'МУДРЕЦ':      'Длинные аналитические посты, видео-лекции, чек-листы, схемы. Подкасты и экспертные статьи.',
    'ГЕРОЙ':       'Мотивационные видео, истории преодоления, трансляции тренировок. Stories с победами.',
    'ЗАБОТЛИВЫЙ':  'Посты-поддержки, ответы на вопросы, прямые эфиры. Сообщество и «разговоры по душам».',
    'ПРАВИТЕЛЬ':   'Экспертные разборы, бизнес-кейсы, стратегии. LinkedIn-контент, вебинары, белые книги.',
    'ИСКАТЕЛЬ':    'Фото из путешествий, лайфхаки, открытия. Лёгкий вдохновляющий контент.',
    'БУНТАРЬ':     'Провокационные тезисы, разоблачения мифов, дискуссии. Контент «против течения».',
    'ЛЮБОВНИК':    'Эстетичные образы, обзоры, атмосферные видео. Контент о красоте и качестве жизни.',
    'ПРОСТОДУШНЫЙ':'Простые советы для жизни, добрые истории, вдохновляющие цитаты. Позитив без пафоса.',
    'СЛАВНЫЙ МАЛЫЙ':'Честные мнения, народные советы, опросы. «Такой же, как ты» — главный посыл.',
    'ШУТ':         'Смешные ролики, мемы, неожиданные ракурсы на серьёзные темы. Развлечение с пользой.',
    'МАГ':         'Трансформационные истории, методологии, загадочные тизеры. Контент, меняющий взгляды.'
};

const _AUDIENCE = {
    'ТВОРЕЦ':      ['Дизайнеры','Стартаперы','Фрилансеры','Арт-директора'],
    'МУДРЕЦ':      ['Аналитики','Исследователи','Преподаватели','Менеджеры'],
    'ГЕРОЙ':       ['Спортсмены','Предприниматели','Амбициозные','Люди в кризисе'],
    'ЗАБОТЛИВЫЙ':  ['Родители','Психологи','Волонтёры','HR-специалисты'],
    'ПРАВИТЕЛЬ':   ['Руководители','Предприниматели','Управленцы','Инвесторы'],
    'ИСКАТЕЛЬ':    ['Путешественники','Фотографы','Искатели смысла','Авантюристы'],
    'БУНТАРЬ':     ['Предприниматели','Активисты','Художники','Дерзкие стартаперы'],
    'ЛЮБОВНИК':    ['Ценители красоты','Романтики','Стилисты','Организаторы событий'],
    'ПРОСТОДУШНЫЙ':['Семьи','Позитивные люди','Аудитория lifestyle','Мамы'],
    'СЛАВНЫЙ МАЛЫЙ':['Рабочая аудитория','Комьюнити','Широкая ЦА','Соседи'],
    'ШУТ':         ['Молодёжь','Геймеры','Офисные работники','Все, кто хочет смеяться'],
    'МАГ':         ['Коучинговая аудитория','Духовно ищущие','Предприниматели-визионеры','Трансформаторы']
};

// ============================================
// РЕНДЕР ВКЛАДОК
// ============================================
function _tabArchetype(a, name) {
    const colors = (_COLORS[name] || []).map(c =>
        `<div class="brand-color-chip"><div class="brand-color-dot" style="background:${c.c}"></div>${c.n}</div>`
    ).join('');

    return `
        <div class="brand-hero-card">
            <span class="brand-hero-icon">${a.emoji}</span>
            <div class="brand-hero-name">${a.name}</div>
            <div class="brand-hero-desc">${a.description}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">💼 Карьерный трек</div>
            <div class="brand-tags">${a.careers.map(c=>`<span class="brand-tag">${c}</span>`).join('')}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">🏢 Бренды-примеры</div>
            <div class="brand-tags">${a.brands.map(b=>`<span class="brand-tag">${b}</span>`).join('')}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">⚡ Ваша суперсила</div>
            <div class="brand-section-body">${_SUPERPOWERS[name]||''}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">🎯 Зона роста</div>
            <div class="brand-section-body">${_GROWTH[name]||''}</div>
        </div>
        ${colors ? `
        <div class="brand-section">
            <div class="brand-section-label">🎨 Цветовая гамма</div>
            <div class="brand-tags">${colors}</div>
        </div>` : ''}`;
}

function _tabStyle(a, name) {
    return `
        <div class="brand-section">
            <div class="brand-section-label">👔 Рекомендуемый стиль</div>
            <div class="brand-section-body">${a.style}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">📸 Стиль фотографий</div>
            <div class="brand-section-body">${_PHOTO[name]||''}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">💬 Стиль общения</div>
            <div class="brand-section-body">${_COMM[name]||''}</div>
        </div>`;
}

function _tabBrand(a, name) {
    const audience = (_AUDIENCE[name]||[]).map(x=>`<span class="brand-tag">${x}</span>`).join('');
    return `
        <div class="brand-section">
            <div class="brand-section-label">📊 Позиционирование</div>
            <div class="brand-section-body">${a.brand}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">✦ Уникальное предложение</div>
            <div class="brand-section-body">${_UTP[name]||''}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">📱 Контент-стратегия</div>
            <div class="brand-section-body">${_CONTENT[name]||''}</div>
        </div>
        <div class="brand-section">
            <div class="brand-section-label">🎯 Целевая аудитория</div>
            <div class="brand-tags">${audience}</div>
        </div>`;
}

// ============================================
// ГЛАВНЫЙ РЕНДЕР
// ============================================
function _renderBrand() {
    _brandInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const key  = _brandState.archetypeKey || 'EXPLORER';
    const arch = ARCHETYPES[key];
    const name = arch.name;
    const tab  = _brandState.tab;

    let tabContent = '';
    if (tab === 'archetype') tabContent = _tabArchetype(arch, name);
    else if (tab === 'style') tabContent = _tabStyle(arch, name);
    else if (tab === 'brand') tabContent = _tabBrand(arch, name);

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brandBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🏆</div>
                <h1 class="content-title">Личный бренд</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Ваш архетип, стиль и позиционирование</p>
            </div>
            <div class="brand-tabs">
                <button class="brand-tab ${tab==='archetype'?'active':''}" data-tab="archetype">🎭 Архетип</button>
                <button class="brand-tab ${tab==='style'?'active':''}" data-tab="style">👔 Стиль</button>
                <button class="brand-tab ${tab==='brand'?'active':''}" data-tab="brand">📊 Бренд</button>
            </div>
            <div id="brandContent">${tabContent}</div>
            <div class="brand-footer-row">
                <button class="brand-footer-btn" id="brandPdf">📥 Скачать PDF</button>
                <button class="brand-footer-btn" id="brandShare">📤 Поделиться</button>
            </div>
        </div>`;

    document.getElementById('brandBack').onclick = () => _brandHome();

    document.querySelectorAll('.brand-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _brandState.tab = btn.dataset.tab;
            _renderBrand();
        });
    });

    document.getElementById('brandPdf').addEventListener('click',   () => _brandToast('📥 PDF будет доступен в следующей версии'));
    document.getElementById('brandShare').addEventListener('click',  () => _brandToast('📤 Поделиться — скоро'));
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showPersonalBrandScreen() {
    // Проверка теста
    try {
        const uid = window.CONFIG?.USER_ID;
        const api = window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const r   = await fetch(`${api}/api/user-status?user_id=${uid}`);
        const d   = await r.json();
        if (!d.has_profile) {
            if (window.showToast) window.showToast('📊 Сначала пройдите психологический тест', 'info');
            return;
        }
    } catch {
        // Если не смогли проверить — показываем всё равно (офлайн-режим)
    }

    _brandState.archetypeKey = _detectArchetype();
    _brandState.tab = 'archetype';
    _renderBrand();
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showPersonalBrandScreen = showPersonalBrandScreen;
console.log('✅ brand.js v2.0 загружен');
