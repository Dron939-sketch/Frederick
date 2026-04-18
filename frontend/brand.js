// ============================================
// brand.js — Личный бренд, стиль и архетип
// Версия 3.0 — с AI-генерацией плана развития
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _brandInjectStyles() {
    if (document.getElementById('brand-v3-styles')) return;
    const s = document.createElement('style');
    s.id = 'brand-v3-styles';
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

        /* ===== ПЛАН РАЗВИТИЯ ===== */
        .brand-plan-summary {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .brand-plan-stat {
            text-align: center;
            flex: 1;
        }
        .brand-plan-stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #ff6b3b;
        }
        .brand-plan-stat-label {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 4px;
        }
        .brand-week-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .brand-week-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .brand-week-title {
            font-weight: 700;
            color: #ff6b3b;
        }
        .brand-week-time {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .brand-week-focus {
            font-size: 12px;
            color: var(--chrome);
            margin-bottom: 12px;
        }
        .brand-action-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(224,224,224,0.05);
        }
        .brand-action-priority {
            width: 28px;
            text-align: center;
        }
        .brand-action-info {
            flex: 1;
        }
        .brand-action-name {
            font-size: 13px;
            font-weight: 600;
        }
        .brand-action-meta {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .brand-action-detail {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
            color: var(--text-secondary);
        }
        .brand-checklist {
            margin-top: 12px;
        }
        .brand-checklist-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 0;
            cursor: pointer;
        }
        .brand-checklist-item input {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }
        .brand-progress-bar {
            height: 4px;
            background: rgba(224,224,224,0.1);
            border-radius: 2px;
            margin: 16px 0;
            overflow: hidden;
        }
        .brand-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff6b3b, #ff3b3b);
            border-radius: 2px;
            transition: width 0.3s;
        }

        /* ===== СКЕЛЕТОН ===== */
        .brand-skeleton {
            background: linear-gradient(90deg, rgba(224,224,224,0.05) 25%, rgba(224,224,224,0.1) 50%, rgba(224,224,224,0.05) 75%);
            background-size: 200% 100%;
            animation: brandShimmer 1.5s infinite;
            border-radius: 16px;
        }
        @keyframes brandShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        @media (max-width: 480px) {
            .brand-hero-icon { font-size: 48px; }
            .brand-hero-name { font-size: 18px; }
            .brand-plan-stat-value { font-size: 22px; }
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
// БАЗА МЕРОПРИЯТИЙ ДЛЯ ПЛАНА РАЗВИТИЯ
// ============================================
const BRAND_ACTIONS = {
    professional_photo: { id:'professional_photo', name:'📸 Профессиональная фотосессия', impact:'high', time:'3-5 часов', cost:'5000-20000 ₽' },
    video_intro: { id:'video_intro', name:'🎬 Видео-визитка', impact:'high', time:'1 день', cost:'10000-30000 ₽' },
    style_update: { id:'style_update', name:'👔 Обновление гардероба', impact:'medium', time:'1-2 дня', cost:'15000-50000 ₽' },
    visual_branding: { id:'visual_branding', name:'🎨 Визуальный брендинг', impact:'high', time:'3-7 дней', cost:'10000-30000 ₽' },
    voice_training: { id:'voice_training', name:'🎙️ Тренировка голоса', impact:'high', time:'5-10 занятий', cost:'10000-25000 ₽' },
    elevator_pitch: { id:'elevator_pitch', name:'⚡ Elevator pitch', impact:'medium', time:'2-3 часа', cost:'0 ₽' },
    storytelling_course: { id:'storytelling_course', name:'📖 Курс сторителлинга', impact:'high', time:'2-4 недели', cost:'5000-15000 ₽' },
    social_audit: { id:'social_audit', name:'🔍 Аудит соцсетей', impact:'high', time:'1-3 дня', cost:'0 ₽' },
    content_calendar: { id:'content_calendar', name:'📅 Контент-план', impact:'high', time:'2-4 часа', cost:'0-5000 ₽' },
    expert_articles: { id:'expert_articles', name:'✍️ Экспертные статьи', impact:'high', time:'1-2 недели', cost:'0-15000 ₽' },
    telegram_channel: { id:'telegram_channel', name:'📱 Telegram-канал', impact:'high', time:'30 мин/день', cost:'0 ₽' },
    linkedin_profile: { id:'linkedin_profile', name:'💼 LinkedIn профиль', impact:'medium', time:'3-5 часов', cost:'0-10000 ₽' },
    testimonial_collection: { id:'testimonial_collection', name:'⭐ Сбор отзывов', impact:'high', time:'3-5 дней', cost:'0 ₽' },
    expert_interviews: { id:'expert_interviews', name:'🎤 Интервью с экспертами', impact:'high', time:'1-2 недели', cost:'0-20000 ₽' },
    public_speaking: { id:'public_speaking', name:'🎤 Публичное выступление', impact:'high', time:'1-2 недели', cost:'0 ₽' },
    collaboration: { id:'collaboration', name:'🤝 Коллаборация', impact:'medium', time:'1-2 недели', cost:'0-50000 ₽' },
    confidence_training: { id:'confidence_training', name:'💪 Тренинг уверенности', impact:'high', time:'2-4 недели', cost:'10000-30000 ₽' },
    daily_rituals: { id:'daily_rituals', name:'🌅 Ежедневные ритуалы', impact:'medium', time:'10-20 мин/день', cost:'0 ₽' },
    skill_upgrade: { id:'skill_upgrade', name:'📚 Прокачка навыка', impact:'high', time:'1-3 месяца', cost:'10000-100000 ₽' }
};

// ============================================
// РЕКОМЕНДАЦИИ ПО АРХЕТИПАМ
// ============================================
const ARCHETYPE_ACTIONS = {
    'RULER': { priority: ['professional_photo','visual_branding','public_speaking','linkedin_profile'], recommended: ['voice_training','expert_articles','testimonial_collection'] },
    'HERO': { priority: ['video_intro','public_speaking','confidence_training','expert_interviews'], recommended: ['social_audit','elevator_pitch','collaboration'] },
    'CREATOR': { priority: ['visual_branding','content_calendar','expert_articles','telegram_channel'], recommended: ['storytelling_course','skill_upgrade','collaboration'] },
    'SAGE': { priority: ['expert_articles','linkedin_profile','public_speaking','skill_upgrade'], recommended: ['testimonial_collection','content_calendar','telegram_channel'] },
    'LOVER': { priority: ['professional_photo','style_update','video_intro','visual_branding'], recommended: ['storytelling_course','daily_rituals','collaboration'] },
    'CAREGIVER': { priority: ['testimonial_collection','daily_rituals','telegram_channel','social_audit'], recommended: ['confidence_training','storytelling_course','collaboration'] },
    'EXPLORER': { priority: ['video_intro','content_calendar','expert_interviews','telegram_channel'], recommended: ['skill_upgrade','storytelling_course','collaboration'] },
    'REBEL': { priority: ['video_intro','content_calendar','telegram_channel','expert_interviews'], recommended: ['public_speaking','collaboration','confidence_training'] },
    'MAGICIAN': { priority: ['visual_branding','video_intro','storytelling_course','expert_articles'], recommended: ['telegram_channel','collaboration','daily_rituals'] },
    'JESTER': { priority: ['video_intro','content_calendar','telegram_channel','public_speaking'], recommended: ['storytelling_course','collaboration','elevator_pitch'] },
    'INNOCENT': { priority: ['social_audit','daily_rituals','testimonial_collection','telegram_channel'], recommended: ['confidence_training','elevator_pitch','skill_upgrade'] },
    'EVERYMAN': { priority: ['social_audit','testimonial_collection','telegram_channel','collaboration'], recommended: ['content_calendar','elevator_pitch','daily_rituals'] }
};

// ============================================
// ВОПРОСЫ ДЛЯ ПЛАНА
// ============================================
const PLAN_QUESTIONS = [
    { id: 'desired_perception', question: '✨ Каким вы хотите, чтобы вас видели?', placeholder: 'Например: «Как эксперта, которому доверяют»' },
    { id: 'role_model', question: '👤 Кто из известных людей близок к вашему желаемому образу?', placeholder: 'Например: «Стив Джобс — за харизму и видение»' },
    { id: 'key_emotion', question: '💭 Какую эмоцию вы хотите вызывать у людей?', placeholder: 'Например: «Доверие, восхищение, желание сотрудничать»' },
    { id: 'current_obstacle', question: '🚧 Что мешает вам выглядеть так, как вы хотите?', placeholder: 'Например: «Стеснительность, страх публичности»' },
    { id: 'goal', question: '🏆 Какова ваша главная цель в развитии бренда?', placeholder: 'Например: «Привлечь клиентов и стать узнаваемым»' }
];

// ============================================
// ДАННЫЕ ДЛЯ ВКЛАДОК
// ============================================
const _SUPERPOWERS = {
    'ТВОРЕЦ':'Вы видите то, чего ещё нет, и создаёте это. Воображение и инновации — ваши главные инструменты.',
    'МУДРЕЦ':'Видите закономерности там, где другие — хаос. Ваши знания экономят людям годы ошибок.',
    'ГЕРОЙ':'Действуете там, где другие боятся. Ваша смелость становится ресурсом для окружающих.',
    'ЗАБОТЛИВЫЙ':'Создаёте пространство, где люди могут расти и быть уязвимыми без страха.',
    'ПРАВИТЕЛЬ':'Создаёте порядок из хаоса и умеете вести за собой людей к результату.',
    'ИСКАТЕЛЬ':'Находите пути там, где их не видят. Адаптивность — ваша суперсила.',
    'БУНТАРЬ':'Ломаете устаревшие системы и создаёте новые правила игры.',
    'ЛЮБОВНИК':'Создаёте красоту и гармонию, притягиваете людей своей энергетикой.',
    'ПРОСТОДУШНЫЙ':'Вселяете доверие и оптимизм. Ваша искренность — главный актив.',
    'СЛАВНЫЙ МАЛЫЙ':'Люди вам доверяют, потому что вы один из них. Близость без барьеров.',
    'ШУТ':'Делаете жизнь легче и веселее. Юмор и лёгкость — ваш особый дар.',
    'МАГ':'Превращаете мечты в реальность. Трансформация — ваш главный процесс.'
};

const _GROWTH = {
    'ТВОРЕЦ':'Доводить проекты до конца, не распыляться. Принимать критику как ресурс.',
    'МУДРЕЦ':'Больше действовать, меньше анализировать. Не застревать в теории.',
    'ГЕРОЙ':'Научиться отдыхать и просить о помощи. Не брать всё на себя.',
    'ЗАБОТЛИВЫЙ':'Ставить себя на первое место. Говорить «нет» без чувства вины.',
    'ПРАВИТЕЛЬ':'Делегировать и доверять. Не пытаться контролировать всё.',
    'ИСКАТЕЛЬ':'Сфокусироваться на одном направлении. Не прыгать с места на место.',
    'БУНТАРЬ':'Научиться работать внутри системы, не разрушая её полностью.',
    'ЛЮБОВНИК':'Не терять себя в других. Сохранять личные границы и ориентиры.',
    'ПРОСТОДУШНЫЙ':'Говорить правду, даже если она неудобна. Укреплять устойчивость.',
    'СЛАВНЫЙ МАЛЫЙ':'Заявить о себе. Не бояться выделяться и быть заметным.',
    'ШУТ':'Показывать серьёзность там, где это важно. Не обесценивать глубину.',
    'МАГ':'Соблюдать обещания. Быть предсказуемым для тех, кто на вас рассчитывает.'
};

const _COLORS = {
    'ТВОРЕЦ':[{n:'Фиолетовый',c:'#9b59b6'},{n:'Оранжевый',c:'#e67e22'},{n:'Бирюзовый',c:'#1abc9c'}],
    'МУДРЕЦ':[{n:'Тёмно-синий',c:'#2c3e50'},{n:'Стальной',c:'#5d7d9a'},{n:'Серый',c:'#95a5a6'}],
    'ГЕРОЙ':[{n:'Красный',c:'#c0392b'},{n:'Чёрный',c:'#1c1c1c'},{n:'Золотой',c:'#f39c12'}],
    'ЗАБОТЛИВЫЙ':[{n:'Мятный',c:'#27ae60'},{n:'Пастельный',c:'#f8c8d4'},{n:'Бежевый',c:'#f5e6d3'}],
    'ПРАВИТЕЛЬ':[{n:'Тёмно-синий',c:'#1a252f'},{n:'Золотой',c:'#f1c40f'},{n:'Бордовый',c:'#922b21'}],
    'ИСКАТЕЛЬ':[{n:'Оливковый',c:'#7a8c6e'},{n:'Терракотовый',c:'#c0392b'},{n:'Хаки',c:'#8d9b6b'}],
    'БУНТАРЬ':[{n:'Чёрный',c:'#1c1c1c'},{n:'Красный',c:'#e74c3c'},{n:'Серебро',c:'#bdc3c7'}],
    'ЛЮБОВНИК':[{n:'Пудровый',c:'#d4a5a5'},{n:'Бордо',c:'#7b241c'},{n:'Золото',c:'#c9a84c'}],
    'ПРОСТОДУШНЫЙ':[{n:'Белый',c:'#f5f5f5'},{n:'Небесный',c:'#aed6f1'},{n:'Лимонный',c:'#fdebd0'}],
    'СЛАВНЫЙ МАЛЫЙ':[{n:'Синий деним',c:'#2980b9'},{n:'Серый',c:'#808b96'},{n:'Белый',c:'#f5f5f5'}],
    'ШУТ':[{n:'Жёлтый',c:'#f1c40f'},{n:'Оранжевый',c:'#e67e22'},{n:'Красный',c:'#e74c3c'}],
    'МАГ':[{n:'Пурпурный',c:'#6c3483'},{n:'Индиго',c:'#1a1a6e'},{n:'Серебро',c:'#bdc3c7'}]
};

const _PHOTO = {
    'ТВОРЕЦ':'Нестандартные ракурсы, фото в процессе создания. Яркие цветовые акценты, студийный свет.',
    'МУДРЕЦ':'С книгами или у доски. Классические портреты, нейтральный фон, деловая обстановка.',
    'ГЕРОЙ':'Динамика и движение, с достижениями. Спортивный стиль, чёткие линии, высокий контраст.',
    'ЗАБОТЛИВЫЙ':'Тёплые, уютные кадры. С людьми, детьми, природой. Мягкий рассеянный свет.',
    'ПРАВИТЕЛЬ':'В офисе или деловой обстановке. Строгий стиль, уверенная поза, атрибуты статуса.',
    'ИСКАТЕЛЬ':'В путешествиях и на природе. Естественные кадры, натуральный свет, горизонт.',
    'БУНТАРЬ':'Городская среда, граффити, андеграунд. Чёрно-белые акценты, дерзкие ракурсы.',
    'ЛЮБОВНИК':'Чувственные, элегантные портреты. Мягкий свет, красивый фон, стилизованная одежда.',
    'ПРОСТОДУШНЫЙ':'Естественные, улыбчивые фото на природе. Солнечный свет, простая одежда.',
    'СЛАВНЫЙ МАЛЫЙ':'Жизненные, неформальные кадры. Среди людей, на мероприятиях.',
    'ШУТ':'Яркие, веселые, с юмором. Неожиданные ракурсы, гримасы, комедийные сценки.',
    'МАГ':'Загадочные, с интересным светом. Символика, глубина, мистическая атмосфера.'
};

const _COMM = {
    'ТВОРЕЦ':'Образно и метафорично, с воодушевлением. «Представьте, если бы...» — ваш фирменный старт.',
    'МУДРЕЦ':'Структурированно, с фактами и данными. Ссылки на исследования, логика и схемы.',
    'ГЕРОЙ':'Коротко, по делу, с призывами к действию. «Давай сделаем — сейчас!»',
    'ЗАБОТЛИВЫЙ':'Мягко, поддерживающе. «Как ты себя чувствуешь?» — и искренний интерес к ответу.',
    'ПРАВИТЕЛЬ':'Уверенно и авторитетно, с цифрами и стратегией. Без лишних слов.',
    'ИСКАТЕЛЬ':'Открыто и любопытно, с историями. «А ты знал, что...» — провокация к размышлению.',
    'БУНТАРЬ':'Провокационно и прямолинейно. Говорите то, о чём другие молчат.',
    'ЛЮБОВНИК':'Тепло, чувственно, с вниманием к деталям. Создаёте атмосферу разговора.',
    'ПРОСТОДУШНЫЙ':'Искренне и просто. Без сложных слов — как будто разговариваете с другом.',
    'СЛАВНЫЙ МАЛЫЙ':'Разговорно, с юмором, по-свойски. Люди должны чувствовать: «он такой же, как я».',
    'ШУТ':'С юмором и лёгкостью. Не боитесь быть смешным — это ваша сила.',
    'МАГ':'С интригой и глубиной. Задаёте вопросы, которые заставляют думать иначе.'
};

const _UTP = {
    'ТВОРЕЦ':'Я создаю то, чего ещё нет. Мои решения нестандартны и работают там, где шаблоны бессильны.',
    'МУДРЕЦ':'Я вижу систему там, где другие видят хаос. Мои знания экономят вам годы ошибок.',
    'ГЕРОЙ':'Я делаю то, что другие боятся. Моя смелость становится вашим ресурсом.',
    'ЗАБОТЛИВЫЙ':'Создаю безопасное пространство для роста. С вами не страшно меняться.',
    'ПРАВИТЕЛЬ':'Создаю порядок и систему. Со мной хаос превращается в измеримый результат.',
    'ИСКАТЕЛЬ':'Нахожу пути там, где их не видят. Открываю новые горизонты для людей и бизнеса.',
    'БУНТАРЬ':'Разрушаю то, что мешает расти. Создаю правила для тех, кому тесно в старых.',
    'ЛЮБОВНИК':'Создаю красоту и близость. Там, где я, — теплее и интереснее.',
    'ПРОСТОДУШНЫЙ':'Возвращаю доверие и радость. В мире сложностей я — якорь простоты.',
    'СЛАВНЫЙ МАЛЫЙ':'Говорю то, что думают все, но боятся сказать. Я — голос своей аудитории.',
    'ШУТ':'Делаю серьёзные вещи весело. Там, где скучно, — я включаю жизнь.',
    'МАГ':'Трансформирую невозможное в реальное. Показываю путь туда, куда другие боятся смотреть.'
};

const _CONTENT = {
    'ТВОРЕЦ':'Кейсы «до/после», процесс создания в Reels, инсайты о творчестве. Блог о нестандартных решениях.',
    'МУДРЕЦ':'Длинные аналитические посты, видео-лекции, чек-листы, схемы. Подкасты и экспертные статьи.',
    'ГЕРОЙ':'Мотивационные видео, истории преодоления, трансляции тренировок. Stories с победами.',
    'ЗАБОТЛИВЫЙ':'Посты-поддержки, ответы на вопросы, прямые эфиры. Сообщество и «разговоры по душам».',
    'ПРАВИТЕЛЬ':'Экспертные разборы, бизнес-кейсы, стратегии. LinkedIn-контент, вебинары, белые книги.',
    'ИСКАТЕЛЬ':'Фото из путешествий, лайфхаки, открытия. Лёгкий вдохновляющий контент.',
    'БУНТАРЬ':'Провокационные тезисы, разоблачения мифов, дискуссии. Контент «против течения».',
    'ЛЮБОВНИК':'Эстетичные образы, обзоры, атмосферные видео. Контент о красоте и качестве жизни.',
    'ПРОСТОДУШНЫЙ':'Простые советы для жизни, добрые истории, вдохновляющие цитаты. Позитив без пафоса.',
    'СЛАВНЫЙ МАЛЫЙ':'Честные мнения, народные советы, опросы. «Такой же, как ты» — главный посыл.',
    'ШУТ':'Смешные ролики, мемы, неожиданные ракурсы на серьёзные темы. Развлечение с пользой.',
    'МАГ':'Трансформационные истории, методологии, загадочные тизеры. Контент, меняющий взгляды.'
};

const _AUDIENCE = {
    'ТВОРЕЦ':['Дизайнеры','Стартаперы','Фрилансеры','Арт-директора'],
    'МУДРЕЦ':['Аналитики','Исследователи','Преподаватели','Менеджеры'],
    'ГЕРОЙ':['Спортсмены','Предприниматели','Амбициозные','Люди в кризисе'],
    'ЗАБОТЛИВЫЙ':['Родители','Психологи','Волонтёры','HR-специалисты'],
    'ПРАВИТЕЛЬ':['Руководители','Предприниматели','Управленцы','Инвесторы'],
    'ИСКАТЕЛЬ':['Путешественники','Фотографы','Искатели смысла','Авантюристы'],
    'БУНТАРЬ':['Предприниматели','Активисты','Художники','Дерзкие стартаперы'],
    'ЛЮБОВНИК':['Ценители красоты','Романтики','Стилисты','Организаторы событий'],
    'ПРОСТОДУШНЫЙ':['Семьи','Позитивные люди','Аудитория lifestyle','Мамы'],
    'СЛАВНЫЙ МАЛЫЙ':['Рабочая аудитория','Комьюнити','Широкая ЦА','Соседи'],
    'ШУТ':['Молодёжь','Геймеры','Офисные работники','Все, кто хочет смеяться'],
    'МАГ':['Коучинговая аудитория','Духовно ищущие','Предприниматели-визионеры','Трансформаторы']
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._brandState) {
    window._brandState = { 
        tab: 'archetype', 
        archetypeKey: null,
        vectors: { СБ:4, ТФ:4, УБ:4, ЧВ:4 },
        hasProfile: false,
        planAnswers: {},
        planStep: 0,
        plan: null
    };
}
const _brandState = window._brandState;

// ============================================
// УТИЛИТЫ
// ============================================
function _brandToast(msg) { if (window.showToast) window.showToast(msg, 'info'); }
function _brandHome() { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }

function _brandEsc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _brandUserName() {
    try { return localStorage.getItem('fredi_user_name') || window.CONFIG?.USER_NAME || ''; } catch (e) { return ''; }
}

// ============================================
// ЭКСПОРТ В PDF (через браузерный print-диалог)
// ============================================
function _brandExportPdf(arch, archName) {
    const userName = _brandUserName();
    const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

    // Собираем содержимое ВСЕХ разделов независимо от активной вкладки
    const sections = [
        { title: '🎭 Архетип',  html: _tabArchetype(arch, archName) },
        { title: '👔 Стиль',    html: _tabStyle(arch, archName) },
        { title: '📊 Бренд',    html: _tabBrand(arch, archName) },
    ];
    if (_brandState.plan) {
        sections.push({ title: '🚀 План', html: _planResultHtml(_brandState.plan) });
    }

    // Подгружаем существующие стили модуля (чтобы пузырьки, цвета, кнопки и т.п. выглядели знакомо)
    const stylesEl = document.getElementById('brand-v3-styles');
    const appStyles = stylesEl ? stylesEl.textContent : '';

    const printCss = `
        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: #1a1a1a;
            background: #ffffff;
            padding: 32px 28px;
            max-width: 860px;
            margin: 0 auto;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        h1 { font-size: 26px; margin: 0 0 4px; }
        h2 { font-size: 18px; margin: 26px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; page-break-after: avoid; }
        h3, h4 { color: #1a1a1a; }
        .pdf-meta { color: #666; font-size: 12px; margin-bottom: 22px; }
        .pdf-banner {
            background: linear-gradient(135deg, rgba(255,107,59,0.12), rgba(255,107,59,0.04));
            border: 1px solid rgba(255,107,59,0.28);
            border-radius: 14px;
            padding: 18px 20px;
            margin-bottom: 22px;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .pdf-banner-emoji { font-size: 44px; line-height: 1; }
        .pdf-banner-name { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .pdf-banner-desc { font-size: 13px; color: #555; }
        .pdf-section { page-break-inside: auto; margin-bottom: 18px; }
        .pdf-footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #eee; font-size: 11px; color: #888; text-align: center; }
        .no-print, button, .brand-footer-row, .brand-footer-btn { display: none !important; }
        @page { margin: 16mm 12mm; }
        @media print {
            body { padding: 0; }
        }
    `;

    const headerHtml = `
        <h1>Личный бренд</h1>
        <div class="pdf-meta">${_brandEsc(userName || 'Пользователь')} · ${date} · Фреди</div>
        <div class="pdf-banner">
            <div class="pdf-banner-emoji">${arch.emoji || '🎭'}</div>
            <div>
                <div class="pdf-banner-name">${_brandEsc(archName)}</div>
                <div class="pdf-banner-desc">${_brandEsc(arch.description || '')}</div>
            </div>
        </div>
    `;

    const body = sections
        .map(s => `<div class="pdf-section"><h2>${s.title}</h2>${s.html}</div>`)
        .join('');

    const footer = `<div class="pdf-footer">Сгенерировано Фреди — вашим виртуальным психологом</div>`;

    const doc = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Личный бренд — ${_brandEsc(archName)}</title>
<style>${printCss}\n${appStyles}</style>
</head>
<body>${headerHtml}${body}${footer}</body>
</html>`;

    // Открываем во вспомогательном окне и вызываем print
    const win = window.open('', '_blank', 'noopener,width=900,height=1000');
    if (win) {
        win.document.open();
        win.document.write(doc);
        win.document.close();
        // Ждём, чтобы стили подтянулись
        setTimeout(() => {
            try { win.focus(); win.print(); } catch (e) { /* ignore */ }
        }, 400);
        _brandToast('📥 Открыт диалог печати — сохраните как PDF');
        return;
    }

    // Фолбэк: popup заблокирован — отдаём .html файл
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand_${(userName || archName).replace(/\s+/g, '_')}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    _brandToast('💾 PDF-превью скачано как HTML (откройте и сохраните как PDF)');
}

function _brandGetApiUrl() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _brandGetUserId() { return window.CONFIG?.USER_ID; }

// ============================================
// ЗАГРУЗКА ПРОФИЛЯ ИЗ API
// ============================================
async function _brandLoadProfile() {
    try {
        const uid = _brandGetUserId();
        const api = _brandGetApiUrl();
        const response = await fetch(`${api}/api/user-status?user_id=${uid}`);
        const data = await response.json();
        
        _brandState.hasProfile = data.has_profile === true;
        
        if (_brandState.hasProfile && data.vectors) {
            _brandState.vectors = {
                СБ: data.vectors.SB || 4,
                ТФ: data.vectors.TF || 4,
                УБ: data.vectors.UB || 4,
                ЧВ: data.vectors.CV || 4
            };
        }
        
        return _brandState.hasProfile;
    } catch (error) {
        console.error('Failed to load profile:', error);
        return false;
    }
}

// ============================================
// ОПРЕДЕЛЕНИЕ АРХЕТИПА ПО ВЕКТОРАМ
// ============================================
function _detectArchetypeFromVectors() {
    const { СБ: sb, ТФ: tf, УБ: ub, ЧВ: chv } = _brandState.vectors;

    if (sb >= 5 && tf >= 5 && ub >= 5) return 'RULER';
    if (chv >= 5 && sb >= 4) return 'LOVER';
    if (ub >= 5 && sb >= 4) return 'SAGE';
    if (chv >= 5 && ub <= 3) return 'CAREGIVER';
    if (sb >= 5 && tf >= 4) return 'HERO';
    if (ub >= 4 && chv >= 4) return 'CREATOR';
    if (chv >= 5) return 'CAREGIVER';
    if (sb >= 5) return 'HERO';
    if (tf >= 5) return 'RULER';
    if (ub >= 5) return 'SAGE';
    return 'EXPLORER';
}

// ============================================
// РЕНДЕР СКЕЛЕТОНА
// ============================================
function _renderSkeleton(container) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brandSkeletonBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🏆</div>
                <h1 class="content-title">Личный бренд</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Загрузка вашего профиля...</p>
            </div>
            <div style="padding:20px">
                <div class="brand-skeleton" style="height:160px;margin-bottom:16px;"></div>
                <div class="brand-skeleton" style="height:80px;margin-bottom:12px;"></div>
                <div class="brand-skeleton" style="height:100px;margin-bottom:12px;"></div>
                <div class="brand-skeleton" style="height:60px;"></div>
            </div>
        </div>
    `;
    document.getElementById('brandSkeletonBack').onclick = () => _brandHome();
}

// ============================================
// РЕНДЕР ЭКРАНА "ТЕСТ НЕ ПРОЙДЕН"
// ============================================
function _renderNoTestScreen(container) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brandNoTestBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🏆</div>
                <h1 class="content-title">Личный бренд</h1>
            </div>
            <div class="brand-hero-card" style="padding:48px 20px;">
                <span class="brand-hero-icon">📊</span>
                <div class="brand-hero-name">Нужен психологический тест</div>
                <div class="brand-hero-desc" style="max-width:300px;margin:12px auto;">
                    Чтобы определить ваш архетип и построить личный бренд, 
                    нужно сначала пройти психологический тест (15 минут).
                </div>
                <button id="brandStartTestBtn" style="margin-top:24px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);border:none;padding:14px 28px;border-radius:40px;color:white;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;">
                    📊 Пройти тест
                </button>
            </div>
            <div class="brand-section" style="margin-top:16px;text-align:center;">
                <div class="brand-section-label">Что вы получите после теста</div>
                <div class="brand-section-body" style="font-size:12px;">
                    🎭 Ваш архетип<br>
                    👔 Рекомендуемый стиль<br>
                    📊 Стратегия личного бренда<br>
                    🚀 Персональный план развития
                </div>
            </div>
        </div>
    `;
    document.getElementById('brandNoTestBack').onclick = () => _brandHome();
    document.getElementById('brandStartTestBtn').onclick = () => {
        if (typeof startTest === 'function') startTest();
        else if (window.startTest) window.startTest();
    };
}

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
        ${colors ? `<div class="brand-section"><div class="brand-section-label">🎨 Цветовая гамма</div><div class="brand-tags">${colors}</div></div>` : ''}`;
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
// ГЕНЕРАЦИЯ ПЛАНА
// ============================================
function _generateWeeklyPlan(actions) {
    const weeks = {
        1: { focus: '🔍 АУДИТ И ПОДГОТОВКА', actions: [], total_hours: 0 },
        2: { focus: '📸 ВИЗУАЛЬНЫЕ ИЗМЕНЕНИЯ', actions: [], total_hours: 0 },
        3: { focus: '📱 КОНТЕНТ И ПУБЛИЧНОСТЬ', actions: [], total_hours: 0 },
        4: { focus: '🤝 НЕТВОРКИНГ И РЕПУТАЦИЯ', actions: [], total_hours: 0 }
    };
    
    const week1Categories = ['social_audit', 'testimonial_collection', 'elevator_pitch', 'daily_rituals'];
    const week2Categories = ['professional_photo', 'video_intro', 'style_update', 'visual_branding'];
    const week3Categories = ['content_calendar', 'expert_articles', 'telegram_channel', 'linkedin_profile', 'storytelling_course'];
    const week4Categories = ['public_speaking', 'collaboration', 'expert_interviews', 'voice_training', 'confidence_training'];
    
    const highPriority = actions.filter(a => a.priority === 'high');
    
    for (const action of highPriority) {
        if (week1Categories.includes(action.id)) weeks[1].actions.push(action);
        else if (week2Categories.includes(action.id)) weeks[2].actions.push(action);
        else if (week3Categories.includes(action.id)) weeks[3].actions.push(action);
        else if (week4Categories.includes(action.id)) weeks[4].actions.push(action);
    }
    
    const mediumPriority = actions.filter(a => a.priority === 'medium');
    for (let i = 0; i < mediumPriority.length; i++) {
        const weekNum = (i % 4) + 1;
        weeks[weekNum].actions.push(mediumPriority[i]);
    }
    
    for (let i = 1; i <= 4; i++) {
        let total = 0;
        for (const action of weeks[i].actions) {
            const hours = parseInt(action.time.match(/\d+/)?.[0]) || 0;
            total += hours;
        }
        weeks[i].total_hours = total;
    }
    
    return weeks;
}

function _getActionsByArchetype(archetypeKey) {
    return ARCHETYPE_ACTIONS[archetypeKey] || ARCHETYPE_ACTIONS['EXPLORER'];
}

function _getActionsByDesiredImage(answers) {
    const actions = new Set();
    const text = answers.desired_perception?.toLowerCase() || '';
    const obstacle = answers.current_obstacle?.toLowerCase() || '';
    const goal = answers.goal?.toLowerCase() || '';
    
    if (text.includes('эксперт') || text.includes('профессионал')) {
        actions.add('expert_articles'); actions.add('public_speaking'); actions.add('linkedin_profile');
    }
    if (text.includes('вдохнов') || text.includes('лидер')) {
        actions.add('storytelling_course'); actions.add('video_intro'); actions.add('telegram_channel');
    }
    if (text.includes('доверие') || text.includes('надежный')) {
        actions.add('testimonial_collection'); actions.add('social_audit'); actions.add('daily_rituals');
    }
    if (obstacle.includes('стесн') || obstacle.includes('боюсь')) {
        actions.add('confidence_training'); actions.add('elevator_pitch'); actions.add('daily_rituals');
    }
    if (goal.includes('клиент') || goal.includes('продаж')) {
        actions.add('testimonial_collection'); actions.add('linkedin_profile'); actions.add('expert_articles');
    }
    
    return Array.from(actions);
}

async function _generateBrandPlan() {
    const archetypeKey = _brandState.archetypeKey;
    const actionsMap = new Map();
    
    const archetypeActions = _getActionsByArchetype(archetypeKey);
    for (const actionId of archetypeActions.priority) {
        actionsMap.set(actionId, { priority: 'high', source: 'archetype' });
    }
    for (const actionId of archetypeActions.recommended) {
        if (!actionsMap.has(actionId)) {
            actionsMap.set(actionId, { priority: 'medium', source: 'archetype' });
        }
    }
    
    const imageActions = _getActionsByDesiredImage(_brandState.planAnswers);
    for (const actionId of imageActions) {
        if (!actionsMap.has(actionId)) {
            actionsMap.set(actionId, { priority: 'high', source: 'desired_image' });
        } else if (actionsMap.get(actionId).priority === 'medium') {
            actionsMap.get(actionId).priority = 'high';
        }
    }
    
    const selectedActions = [];
    for (const [actionId, meta] of actionsMap) {
        const action = BRAND_ACTIONS[actionId];
        if (action) {
            selectedActions.push({ ...action, priority: meta.priority, source: meta.source });
        }
    }
    
    selectedActions.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    });
    
    const weeklyPlan = _generateWeeklyPlan(selectedActions);
    
    let totalHours = 0, totalCost = 0;
    for (const action of selectedActions) {
        totalHours += parseInt(action.time.match(/\d+/)?.[0]) || 0;
        const costMatch = action.cost.match(/(\d+)/);
        if (costMatch) totalCost += parseInt(costMatch[1]);
    }
    
    return {
        summary: {
            total_actions: selectedActions.length,
            high_priority: selectedActions.filter(a => a.priority === 'high').length,
            estimated_time: totalHours > 40 ? '40+ часов' : `${totalHours} часов`,
            estimated_cost: totalCost > 50000 ? '50000+ ₽' : `${totalCost} ₽`
        },
        actions: selectedActions,
        weekly_plan: weeklyPlan
    };
}

// ============================================
// РЕНДЕР WIZARD ПЛАНА
// ============================================
function _renderPlanWizard() {
    const q = PLAN_QUESTIONS[_brandState.planStep];
    const progress = ((_brandState.planStep + 1) / PLAN_QUESTIONS.length) * 100;
    
    return `
        <div class="brand-section" style="padding: 24px;">
            <div class="brand-progress-bar">
                <div class="brand-progress-fill" style="width: ${progress}%;"></div>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                Вопрос ${_brandState.planStep + 1} из ${PLAN_QUESTIONS.length}
            </div>
            <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 20px;">
                ${q.question}
            </div>
            <textarea id="planAnswerInput" 
                class="gl-custom-textarea" 
                style="width:100%;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.18);border-radius:14px;padding:12px;color:var(--text-primary);font-family:inherit;font-size:14px;min-height:100px;resize:vertical;box-sizing:border-box;"
                placeholder="${q.placeholder}">${_brandState.planAnswers[q.id] || ''}</textarea>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                ${_brandState.planStep > 0 ? '<button id="planPrevBtn" class="brand-footer-btn" style="flex:1;">◀️ Назад</button>' : ''}
                <button id="planNextBtn" class="brand-footer-btn" style="flex:1; background: linear-gradient(135deg, #ff6b3b, #ff3b3b);">
                    ${_brandState.planStep === PLAN_QUESTIONS.length - 1 ? '🚀 Сгенерировать план' : 'Далее →'}
                </button>
            </div>
        </div>
    `;
}

// ============================================
// РЕНДЕР РЕЗУЛЬТАТА ПЛАНА
// ============================================
function _planResultHtml(plan) {
    const { summary, weekly_plan } = plan;

    let html = `
        <div class="brand-plan-summary">
            <div class="brand-plan-stat"><div class="brand-plan-stat-value">${summary.total_actions}</div><div class="brand-plan-stat-label">мероприятий</div></div>
            <div class="brand-plan-stat"><div class="brand-plan-stat-value">${summary.high_priority}</div><div class="brand-plan-stat-label">приоритетных</div></div>
            <div class="brand-plan-stat"><div class="brand-plan-stat-value">${summary.estimated_time}</div><div class="brand-plan-stat-label">времени</div></div>
            <div class="brand-plan-stat"><div class="brand-plan-stat-value">${summary.estimated_cost}</div><div class="brand-plan-stat-label">бюджет</div></div>
        </div>
    `;

    for (let i = 1; i <= 4; i++) {
        const week = weekly_plan[i];
        html += `
            <div class="brand-week-card">
                <div class="brand-week-header">
                    <div class="brand-week-title">НЕДЕЛЯ ${i}</div>
                    <div class="brand-week-time">⏱ ~${week.total_hours} часов</div>
                </div>
                <div class="brand-week-focus">${week.focus}</div>
                ${week.actions.map(action => `
                    <div class="brand-action-item">
                        <div class="brand-action-priority">${action.priority === 'high' ? '🔴' : '🟡'}</div>
                        <div class="brand-action-info">
                            <div class="brand-action-name">${action.name}</div>
                            <div class="brand-action-meta">⏱ ${action.time} | 💰 ${action.cost}</div>
                        </div>
                        <button class="brand-action-detail no-print" onclick="window.showActionDetail && window.showActionDetail('${action.id}')">ℹ️</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += `
        <div class="brand-section">
            <div class="brand-section-label">✅ ЧЕК-ЛИСТ НЕДЕЛИ 1</div>
            <div class="brand-checklist">
                ${weekly_plan[1].actions.map(action => `
                    <label class="brand-checklist-item">
                        <input type="checkbox" id="check_${action.id}"> <span>${action.name}</span>
                    </label>
                `).join('')}
            </div>
            <button id="saveChecklistBtn" class="brand-footer-btn no-print" style="margin-top: 16px;">💾 Сохранить прогресс</button>
        </div>
        <div class="no-print" style="display: flex; gap: 10px; margin-top: 16px;">
            <button id="downloadPlanBtn" class="brand-footer-btn" style="flex:1;">📥 Скачать план</button>
            <button id="sharePlanBtn" class="brand-footer-btn" style="flex:1;">📤 Поделиться</button>
            <button id="regeneratePlanBtn" class="brand-footer-btn" style="flex:1;">🔄 Новый план</button>
        </div>
    `;
    return html;
}

function _bindPlanResultHandlers(plan) {
    const { weekly_plan } = plan;

    document.getElementById('saveChecklistBtn')?.addEventListener('click', () => {
        const completed = [];
        weekly_plan[1].actions.forEach(action => {
            const cb = document.getElementById(`check_${action.id}`);
            if (cb && cb.checked) completed.push(action.id);
        });
        localStorage.setItem(`brand_checklist_${_brandGetUserId()}`, JSON.stringify({ completed, date: new Date().toISOString() }));
        _brandToast('✅ Прогресс сохранён!');
    });

    document.getElementById('downloadPlanBtn')?.addEventListener('click', () => {
        let content = `<html><head><meta charset="UTF-8"><title>План развития бренда</title><style>body{font-family:Arial;padding:40px}</style></head><body>`;
        content += `<h1>🚀 План развития личного бренда</h1>`;
        for (let i = 1; i <= 4; i++) {
            const week = weekly_plan[i];
            content += `<h2>Неделя ${i}: ${week.focus}</h2><ul>`;
            week.actions.forEach(a => content += `<li><strong>${a.name}</strong> — ${a.time}, ${a.cost}</li>`);
            content += `</ul>`;
        }
        content += `<p><em>Сгенерировано Фреди — вашим виртуальным психологом</em></p></body></html>`;
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `brand_plan_${Date.now()}.html`;
        a.click(); URL.revokeObjectURL(url);
        _brandToast('✅ План скачан');
    });

    document.getElementById('sharePlanBtn')?.addEventListener('click', async () => {
        const text = `🚀 Мой план развития личного бренда от Фреди\n\n${weekly_plan[1].actions.map(a => `• ${a.name}`).join('\n')}\n\nСгенерировано персонально для меня.`;
        if (navigator.share) {
            try { await navigator.share({ title: 'План развития бренда', text }); }
            catch(e) { if (e.name !== 'AbortError') _brandToast('❌ Не удалось поделиться'); }
        } else {
            await navigator.clipboard.writeText(text);
            _brandToast('✅ Текст скопирован');
        }
    });

    document.getElementById('regeneratePlanBtn')?.addEventListener('click', () => {
        _brandState.plan = null;
        _brandState.planStep = 0;
        _brandState.planAnswers = {};
        _renderBrand();
    });
}

// Совместимость: старое имя — теперь тонкая обёртка (мутирует DOM и привязывает handlers)
function _renderPlanResult(plan) {
    const el = document.getElementById('brandContent');
    if (el) el.innerHTML = _planResultHtml(plan);
    _bindPlanResultHandlers(plan);
}

// ============================================
// РЕНДЕР ВКЛАДКИ ПЛАНА
// ============================================
function _tabPlan() {
    if (_brandState.plan) {
        return _planResultHtml(_brandState.plan);
    }

    if (_brandState.planStep < PLAN_QUESTIONS.length) {
        return _renderPlanWizard();
    }

    return '<div style="text-align:center;padding:40px;">Загрузка...</div>';
}

// ============================================
// ГЛАВНЫЙ РЕНДЕР
// ============================================
function _renderBrand() {
    _brandInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const key = _brandState.archetypeKey || 'EXPLORER';
    const arch = ARCHETYPES[key];
    const name = arch.name;
    const tab = _brandState.tab;

    let tabContent = '';
    if (tab === 'archetype') tabContent = _tabArchetype(arch, name);
    else if (tab === 'style') tabContent = _tabStyle(arch, name);
    else if (tab === 'brand') tabContent = _tabBrand(arch, name);
    else if (tab === 'plan') tabContent = _tabPlan();

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brandBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🏆</div>
                <h1 class="content-title">Личный бренд</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Ваш архетип, стиль и позиционирование</p>
            </div>
            <div class="brand-tabs">
                <button class="brand-tab ${tab === 'archetype' ? 'active' : ''}" data-tab="archetype">🎭 Архетип</button>
                <button class="brand-tab ${tab === 'style' ? 'active' : ''}" data-tab="style">👔 Стиль</button>
                <button class="brand-tab ${tab === 'brand' ? 'active' : ''}" data-tab="brand">📊 Бренд</button>
                <button class="brand-tab ${tab === 'plan' ? 'active' : ''}" data-tab="plan">🚀 План</button>
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

    // Подвязываем обработчики плана, когда активна вкладка «План» и план готов
    if (tab === 'plan' && _brandState.plan) {
        _bindPlanResultHandlers(_brandState.plan);
    }

    document.getElementById('brandPdf').addEventListener('click', () => _brandExportPdf(arch, name));
    
    document.getElementById('brandShare').addEventListener('click', async () => {
        const text = `🎭 Мой архетип по Фреди: ${name}\n${arch.description}\n\nУзнай свой → в приложении Фреди`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Мой архетип', text }); }
            catch(e) { if (e.name !== 'AbortError') _brandToast('❌ Не удалось поделиться'); }
        } else {
            await navigator.clipboard.writeText(text);
            _brandToast('✅ Текст скопирован');
        }
    });
    
    const planNextBtn = document.getElementById('planNextBtn');
    if (planNextBtn) {
        planNextBtn.onclick = () => {
            const answer = document.getElementById('planAnswerInput')?.value.trim();
            if (answer) {
                _brandState.planAnswers[PLAN_QUESTIONS[_brandState.planStep].id] = answer;
            }
            if (_brandState.planStep === PLAN_QUESTIONS.length - 1) {
                _generateBrandPlan().then(plan => {
                    _brandState.plan = plan;
                    _brandState.planStep = 0;
                    _renderBrand();
                }).catch(() => _brandToast('❌ Ошибка генерации плана'));
            } else {
                _brandState.planStep++;
                _renderBrand();
            }
        };
    }
    
    const planPrevBtn = document.getElementById('planPrevBtn');
    if (planPrevBtn) {
        planPrevBtn.onclick = () => {
            _brandState.planStep--;
            _renderBrand();
        };
    }
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showPersonalBrandScreen() {
    _brandInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    _renderSkeleton(container);
    
    const hasProfile = await _brandLoadProfile();
    
    if (!hasProfile) {
        _renderNoTestScreen(container);
        return;
    }
    
    _brandState.archetypeKey = _detectArchetypeFromVectors();
    _brandState.tab = 'archetype';
    _brandState.plan = null;
    _brandState.planStep = 0;
    _brandState.planAnswers = {};
    _renderBrand();
}

// ============================================
// ПОКАЗ ДЕТАЛЕЙ МЕРОПРИЯТИЯ
// ============================================
window.showActionDetail = function(actionId) {
    const action = BRAND_ACTIONS[actionId];
    if (!action) return;
    _brandToast(`${action.name}: ${action.description || 'Рекомендовано для вашего архетипа'}`);
};

// ============================================
// ЭКСПОРТ
// ============================================
window.showPersonalBrandScreen = showPersonalBrandScreen;
console.log('✅ brand.js v3.0 загружен (с AI-генерацией плана)');
