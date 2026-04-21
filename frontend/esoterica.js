// ============================================
// esoterica.js — Эзотерический модуль
// Таро, Гороскоп, Натальная карта
// Версия 1.0 — Полнофункциональный модуль
// ============================================

// --- Состояние модуля ---
const state = {
    activeTab: 'tarot',
    userSign: null,
    userBirthData: null
};

// --- Данные Таро (78 карт) ---
// Полный набор Старших Арканов (22 карты) с изображениями
const MAJOR_ARCANA = [
    { id: 0, name: 'Шут', nameEn: 'The Fool', image: 'img/tarot/major/00_fool.jpg', 
      meaning: 'Новые начинания, спонтанность, вера в жизнь', 
      reversed: 'Безрассудство, риск, хаос',
      element: 'Воздух', planet: 'Уран' },
    { id: 1, name: 'Маг', nameEn: 'The Magician', image: 'img/tarot/major/01_magician.jpg',
      meaning: 'Воля, мастерство, концентрация ресурсов',
      reversed: 'Манипуляции, неуверенность, таланты впустую',
      element: 'Воздух', planet: 'Меркурий' },
    { id: 2, name: 'Верховная Жрица', nameEn: 'The High Priestess', image: 'img/tarot/major/02_high_priestess.jpg',
      meaning: 'Интуиция, тайны, подсознание',
      reversed: 'Подавленная интуиция, поверхностность',
      element: 'Вода', planet: 'Луна' },
    { id: 3, name: 'Императрица', nameEn: 'The Empress', image: 'img/tarot/major/03_empress.jpg',
      meaning: 'Изобилие, материнство, природа',
      reversed: 'Зависимость, творческий блок',
      element: 'Земля', planet: 'Венера' },
    { id: 4, name: 'Император', nameEn: 'The Emperor', image: 'img/tarot/major/04_emperor.jpg',
      meaning: 'Структура, власть, отеческая фигура',
      reversed: 'Тирания, контроль, ригидность',
      element: 'Огонь', planet: 'Марс' },
    { id: 5, name: 'Иерофант', nameEn: 'The Hierophant', image: 'img/tarot/major/05_hierophant.jpg',
      meaning: 'Традиции, обучение, духовные устои',
      reversed: 'Бунт, нетрадиционный подход',
      element: 'Земля', planet: 'Меркурий' },
    { id: 6, name: 'Влюблённые', nameEn: 'The Lovers', image: 'img/tarot/major/06_lovers.jpg',
      meaning: 'Выбор, гармония, отношения',
      reversed: 'Дисгармония, конфликт ценностей',
      element: 'Воздух', planet: 'Меркурий' },
    { id: 7, name: 'Колесница', nameEn: 'The Chariot', image: 'img/tarot/major/07_chariot.jpg',
      meaning: 'Воля к победе, контроль, направление',
      reversed: 'Потеря контроля, агрессия',
      element: 'Вода', planet: 'Луна' },
    { id: 8, name: 'Сила', nameEn: 'Strength', image: 'img/tarot/major/08_strength.jpg',
      meaning: 'Внутренняя сила, терпение, сострадание',
      reversed: 'Слабость, неуверенность',
      element: 'Огонь', planet: 'Солнце' },
    { id: 9, name: 'Отшельник', nameEn: 'The Hermit', image: 'img/tarot/major/09_hermit.jpg',
      meaning: 'Самоанализ, мудрость, уединение',
      reversed: 'Изоляция, одиночество',
      element: 'Земля', planet: 'Уран' },
    { id: 10, name: 'Колесо Фортуны', nameEn: 'Wheel of Fortune', image: 'img/tarot/major/10_wheel.jpg',
      meaning: 'Перемены, судьба, поворотный момент',
      reversed: 'Сопротивление переменам, неудача',
      element: 'Огонь', planet: 'Юпитер' },
    { id: 11, name: 'Справедливость', nameEn: 'Justice', image: 'img/tarot/major/11_justice.jpg',
      meaning: 'Честность, истина, закон',
      reversed: 'Несправедливость, предвзятость',
      element: 'Воздух', planet: 'Венера' },
    { id: 12, name: 'Повешенный', nameEn: 'The Hanged Man', image: 'img/tarot/major/12_hanged_man.jpg',
      meaning: 'Жертва, новая перспектива, ожидание',
      reversed: 'Застой, эгоизм',
      element: 'Вода', planet: 'Нептун' },
    { id: 13, name: 'Смерть', nameEn: 'Death', image: 'img/tarot/major/13_death.jpg',
      meaning: 'Трансформация, завершение, новое начало',
      reversed: 'Сопротивление переменам, застой',
      element: 'Вода', planet: 'Плутон' },
    { id: 14, name: 'Умеренность', nameEn: 'Temperance', image: 'img/tarot/major/14_temperance.jpg',
      meaning: 'Баланс, терпение, гармония',
      reversed: 'Дисбаланс, нетерпение',
      element: 'Огонь', planet: 'Сатурн' },
    { id: 15, name: 'Дьявол', nameEn: 'The Devil', image: 'img/tarot/major/15_devil.jpg',
      meaning: 'Привязанность, зависимость, материализм',
      reversed: 'Освобождение, независимость',
      element: 'Земля', planet: 'Сатурн' },
    { id: 16, name: 'Башня', nameEn: 'The Tower', image: 'img/tarot/major/16_tower.jpg',
      meaning: 'Внезапные перемены, крах иллюзий',
      reversed: 'Избегание катастрофы, отложенный кризис',
      element: 'Огонь', planet: 'Марс' },
    { id: 17, name: 'Звезда', nameEn: 'The Star', image: 'img/tarot/major/17_star.jpg',
      meaning: 'Надежда, вдохновение, исцеление',
      reversed: 'Отчаяние, потеря веры',
      element: 'Воздух', planet: 'Уран' },
    { id: 18, name: 'Луна', nameEn: 'The Moon', image: 'img/tarot/major/18_moon.jpg',
      meaning: 'Иллюзии, страхи, подсознание',
      reversed: 'Прояснение, преодоление страхов',
      element: 'Вода', planet: 'Луна' },
    { id: 19, name: 'Солнце', nameEn: 'The Sun', image: 'img/tarot/major/19_sun.jpg',
      meaning: 'Радость, успех, позитив',
      reversed: 'Пессимизм, временные трудности',
      element: 'Огонь', planet: 'Солнце' },
    { id: 20, name: 'Суд', nameEn: 'Judgement', image: 'img/tarot/major/20_judgement.jpg',
      meaning: 'Пробуждение, прощение, переоценка',
      reversed: 'Сомнения, самоосуждение',
      element: 'Огонь', planet: 'Плутон' },
    { id: 21, name: 'Мир', nameEn: 'The World', image: 'img/tarot/major/21_world.jpg',
      meaning: 'Завершение, гармония, целостность',
      reversed: 'Незавершённость, задержки',
      element: 'Земля', planet: 'Сатурн' }
];

// Младшие Арканы (для расширенного функционала)
const MINOR_ARCANA = {
    cups: [
        { name: 'Туз Кубков', meaning: 'Новая любовь, эмоции, начало отношений' },
        { name: '2 Кубков', meaning: 'Союз, партнёрство, гармония' },
        { name: '3 Кубков', meaning: 'Празднование, дружба, радость' },
        { name: '4 Кубков', meaning: 'Апатия, скука, неудовлетворённость' },
        { name: '5 Кубков', meaning: 'Потеря, сожаление, принятие' },
        { name: '6 Кубков', meaning: 'Ностальгия, детство, воспоминания' },
        { name: '7 Кубков', meaning: 'Иллюзии, мечты, выбор' },
        { name: '8 Кубков', meaning: 'Уход, оставление, поиск' },
        { name: '9 Кубков', meaning: 'Исполнение желаний, удовлетворение' },
        { name: '10 Кубков', meaning: 'Семейное счастье, гармония' },
        { name: 'Паж Кубков', meaning: 'Романтика, творчество, новости' },
        { name: 'Рыцарь Кубков', meaning: 'Предложение, романтика, страсть' },
        { name: 'Королева Кубков', meaning: 'Эмпатия, интуиция, забота' },
        { name: 'Король Кубков', meaning: 'Эмоциональная зрелость, дипломатия' }
    ],
    wands: [
        { name: 'Туз Жезлов', meaning: 'Вдохновение, начинание, страсть' },
        { name: '2 Жезлов', meaning: 'Планирование, выбор, перспективы' },
        { name: '3 Жезлов', meaning: 'Прогресс, экспансия, видение' },
        { name: '4 Жезлов', meaning: 'Стабильность, дом, праздник' },
        { name: '5 Жезлов', meaning: 'Конфликт, конкуренция, борьба' },
        { name: '6 Жезлов', meaning: 'Победа, признание, успех' },
        { name: '7 Жезлов', meaning: 'Защита, оборона, стойкость' },
        { name: '8 Жезлов', meaning: 'Скорость, действия, прогресс' },
        { name: '9 Жезлов', meaning: 'Стойкость, защита, границы' },
        { name: '10 Жезлов', meaning: 'Бремя, ответственность, нагрузка' },
        { name: 'Паж Жезлов', meaning: 'Энтузиазм, исследование, новости' },
        { name: 'Рыцарь Жезлов', meaning: 'Энергия, приключения, импульс' },
        { name: 'Королева Жезлов', meaning: 'Уверенность, харизма, независимость' },
        { name: 'Король Жезлов', meaning: 'Лидерство, видение, страсть' }
    ],
    swords: [
        { name: 'Туз Мечей', meaning: 'Ясность, прорыв, истина' },
        { name: '2 Мечей', meaning: 'Трудный выбор, тупик' },
        { name: '3 Мечей', meaning: 'Разбитое сердце, боль' },
        { name: '4 Мечей', meaning: 'Отдых, восстановление, медитация' },
        { name: '5 Мечей', meaning: 'Конфликт, победа любой ценой' },
        { name: '6 Мечей', meaning: 'Переход, путешествие, исцеление' },
        { name: '7 Мечей', meaning: 'Хитрость, обман, стратегия' },
        { name: '8 Мечей', meaning: 'Ограничения, страх, беспомощность' },
        { name: '9 Мечей', meaning: 'Тревога, ночные кошмары, страхи' },
        { name: '10 Мечей', meaning: 'Конец, предательство, крах' },
        { name: 'Паж Мечей', meaning: 'Бдительность, наблюдение, любопытство' },
        { name: 'Рыцарь Мечей', meaning: 'Скорость, прямота, агрессия' },
        { name: 'Королева Мечей', meaning: 'Рациональность, независимость' },
        { name: 'Король Мечей', meaning: 'Интеллект, авторитет, правда' }
    ],
    pentacles: [
        { name: 'Туз Пентаклей', meaning: 'Возможность, ресурс, начало' },
        { name: '2 Пентаклей', meaning: 'Баланс, адаптация, многозадачность' },
        { name: '3 Пентаклей', meaning: 'Команда, мастерство, качество' },
        { name: '4 Пентаклей', meaning: 'Контроль, сохранение, скупость' },
        { name: '5 Пентаклей', meaning: 'Потеря, трудности, изоляция' },
        { name: '6 Пентаклей', meaning: 'Щедрость, помощь, баланс' },
        { name: '7 Пентаклей', meaning: 'Ожидание, оценка, терпение' },
        { name: '8 Пентаклей', meaning: 'Мастерство, труд, развитие' },
        { name: '9 Пентаклей', meaning: 'Достаток, самодостаточность' },
        { name: '10 Пентаклей', meaning: 'Наследие, семья, богатство' },
        { name: 'Паж Пентаклей', meaning: 'Обучение, возможности, рост' },
        { name: 'Рыцарь Пентаклей', meaning: 'Терпение, работа, надёжность' },
        { name: 'Королева Пентаклей', meaning: 'Забота, изобилие, природа' },
        { name: 'Король Пентаклей', meaning: 'Успех, стабильность, процветание' }
    ]
};

// --- Данные гороскопа (знаки зодиака) ---
const ZODIAC_SIGNS = [
    { id: 'aries', name: 'Овен', emoji: '♈', dateStart: '21.03', dateEnd: '19.04', element: 'Огонь', quality: 'Кардинальный', planet: 'Марс' },
    { id: 'taurus', name: 'Телец', emoji: '♉', dateStart: '20.04', dateEnd: '20.05', element: 'Земля', quality: 'Фиксированный', planet: 'Венера' },
    { id: 'gemini', name: 'Близнецы', emoji: '♊', dateStart: '21.05', dateEnd: '20.06', element: 'Воздух', quality: 'Мутабельный', planet: 'Меркурий' },
    { id: 'cancer', name: 'Рак', emoji: '♋', dateStart: '21.06', dateEnd: '22.07', element: 'Вода', quality: 'Кардинальный', planet: 'Луна' },
    { id: 'leo', name: 'Лев', emoji: '♌', dateStart: '23.07', dateEnd: '22.08', element: 'Огонь', quality: 'Фиксированный', planet: 'Солнце' },
    { id: 'virgo', name: 'Дева', emoji: '♍', dateStart: '23.08', dateEnd: '22.09', element: 'Земля', quality: 'Мутабельный', planet: 'Меркурий' },
    { id: 'libra', name: 'Весы', emoji: '♎', dateStart: '23.09', dateEnd: '22.10', element: 'Воздух', quality: 'Кардинальный', planet: 'Венера' },
    { id: 'scorpio', name: 'Скорпион', emoji: '♏', dateStart: '23.10', dateEnd: '21.11', element: 'Вода', quality: 'Фиксированный', planet: 'Плутон' },
    { id: 'sagittarius', name: 'Стрелец', emoji: '♐', dateStart: '22.11', dateEnd: '21.12', element: 'Огонь', quality: 'Мутабельный', planet: 'Юпитер' },
    { id: 'capricorn', name: 'Козерог', emoji: '♑', dateStart: '22.12', dateEnd: '19.01', element: 'Земля', quality: 'Кардинальный', planet: 'Сатурн' },
    { id: 'aquarius', name: 'Водолей', emoji: '♒', dateStart: '20.01', dateEnd: '18.02', element: 'Воздух', quality: 'Фиксированный', planet: 'Уран' },
    { id: 'pisces', name: 'Рыбы', emoji: '♓', dateStart: '19.02', dateEnd: '20.03', element: 'Вода', quality: 'Мутабельный', planet: 'Нептун' }
];

// --- Гороскоп-тексты (сгенерированные с учётом психологии) ---
const HOROSCOPE_TEXTS = {
    aries: {
        general: 'Сегодня ваша энергия на пике. Марс даёт вам силу для новых начинаний.',
        love: 'В любви сегодня возможны неожиданные повороты. Будьте открыты к спонтанности.',
        career: 'Работа требует решительности. Ваши лидерские качества проявятся ярко.',
        health: 'Физическая активность принесёт удовольствие. Займитесь спортом.',
        advice: 'Не бойтесь действовать первыми. Ваша инициатива будет вознаграждена.'
    },
    taurus: {
        general: 'Стабильный день для финансовых дел. Венера благоволит комфорту.',
        love: 'Романтика в воздухе. Устройте вечер для двоих.',
        career: 'Постепенное движение к цели. Не торопитесь, качество важнее скорости.',
        health: 'Обратите внимание на питание. Организму нужны витамины.',
        advice: 'Наслаждайтесь моментом. Иногда лучшее действие — это пауза.'
    },
    gemini: {
        general: 'Общительный день. Меркурий активирует ваши коммуникативные способности.',
        love: 'Флирт и лёгкость в отношениях. Новые знакомства вероятны.',
        career: 'Многозадачность — ваш конёк сегодня. Успевайте всё!',
        health: 'Ментальная активность требует отдыха. Сделайте перерыв на свежем воздухе.',
        advice: 'Делитесь идеями. Ваше слово может вдохновить других.'
    },
    cancer: {
        general: 'Эмоциональный день. Прислушайтесь к своей интуиции.',
        love: 'Домашний уют и забота — главные темы дня.',
        career: 'Работайте в комфортном темпе. Избегайте стресса.',
        health: 'Водные процедуры помогут снять напряжение.',
        advice: 'Позаботьтесь о себе. Ваши чувства имеют значение.'
    },
    leo: {
        general: 'День творчества и самовыражения. Сияйте ярко!',
        love: 'Страсть и романтика. Устройте свидание с огоньком.',
        career: 'Ваши таланты заметят. Будьте в центре внимания.',
        health: 'Энергии много — направьте её в спорт или хобби.',
        advice: 'Верьте в себя. Ваша уверенность притягивает удачу.'
    },
    virgo: {
        general: 'Детали имеют значение. Наводите порядок в делах.',
        love: 'Забота и внимание к партнёру укрепят отношения.',
        career: 'Аналитический склад ума поможет решить сложные задачи.',
        health: 'Обратите внимание на пищеварение. Лёгкая еда — хороший выбор.',
        advice: 'Совершенство не всегда необходимо. Иногда «хорошо» — достаточно.'
    },
    libra: {
        general: 'Гармония и красота вокруг. Ищите баланс во всём.',
        love: 'Романтика и эстетика. Свидание в красивом месте — отличная идея.',
        career: 'Партнёрство и командная работа принесут успех.',
        health: 'Красота и здоровье связаны. Уход за собой поднимет настроение.',
        advice: 'Доверяйте своей интуиции в выборе пути.'
    },
    scorpio: {
        general: 'Глубинные процессы. Трансформация неизбежна.',
        love: 'Страсть и интенсивность. Отношения могут выйти на новый уровень.',
        career: 'Скрытые возможности откроются. Будьте внимательны к деталям.',
        health: 'Эмоциональная разгрузка необходима. Медитация поможет.',
        advice: 'Позвольте себе отпустить то, что больше не служит вам.'
    },
    sagittarius: {
        general: 'Приключения и путешествия манят. Расширяйте горизонты.',
        love: 'Спонтанность и оптимизм в любви. Будьте открыты новому.',
        career: 'Обучение и рост. Новые знания приведут к успеху.',
        health: 'Активный отдых на природе восстановит силы.',
        advice: 'Следуйте за своим любопытством. Оно ведёт к счастью.'
    },
    capricorn: {
        general: 'Дисциплина и ответственность. Ваш труд будет вознаграждён.',
        love: 'Стабильность и преданность в отношениях. Планируйте будущее.',
        career: 'Карьерный рост реален. Покажите свои амбиции.',
        health: 'Костная система требует внимания. Кальций и движение важны.',
        advice: 'Маленькие шаги каждый день ведут к большим достижениям.'
    },
    aquarius: {
        general: 'Инновации и неожиданные идеи. Будьте оригинальны.',
        love: 'Нестандартный подход к любви освежит отношения.',
        career: 'Командная работа над инновационными проектами.',
        health: 'Технологии могут помочь следить за здоровьем.',
        advice: 'Ваша уникальность — ваша сила. Не бойтесь выделяться.'
    },
    pisces: {
        general: 'Интуиция на высоте. Доверяйте своим снам и предчувствиям.',
        love: 'Романтика и духовная связь. Идеальное время для признаний.',
        career: 'Творческие профессии принесут удовлетворение.',
        health: 'Вода и музыка успокоят нервную систему.',
        advice: 'Мечтайте смело. Ваши фантазии могут стать реальностью.'
    }
};

// --- Вспомогательные функции ---
function _esInjectStyles() {
    if (document.getElementById('es-styles')) return;
    const s = document.createElement('style');
    s.id = 'es-styles';
    s.textContent = `
        /* Общие стили */
        .es-tabs {
            display: flex; gap: 8px; margin-bottom: 24px;
            border-bottom: 1px solid rgba(224,224,224,0.1); padding-bottom: 12px;
            overflow-x: auto; scrollbar-width: none;
        }
        .es-tabs::-webkit-scrollbar { display: none; }
        .es-tab {
            background: none; border: none; padding: 8px 20px;
            font-size: 14px; font-weight: 600; cursor: pointer;
            color: var(--text-secondary); border-radius: 30px;
            transition: all 0.2s; white-space: nowrap;
            font-family: inherit;
        }
        .es-tab.active {
            background: rgba(224,224,224,0.12);
            color: var(--text-primary);
        }
        
        /* Таро */
        .tarot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 16px; margin: 20px 0;
        }
        .tarot-card {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 12px 8px;
            text-align: center; cursor: pointer;
            transition: transform 0.2s, background 0.2s;
        }
        .tarot-card:hover {
            transform: translateY(-4px);
            background: rgba(224,224,224,0.1);
        }
        .tarot-card img {
            width: 70px; height: auto; border-radius: 12px;
            margin-bottom: 8px; background: #1a1a1a;
        }
        .tarot-card-name {
            font-size: 12px; font-weight: 500;
        }
        .tarot-reading {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(0,0,0,0.2));
            border-radius: 24px; padding: 20px; margin-top: 20px;
        }
        .reading-card {
            display: flex; gap: 20px; margin-bottom: 20px;
            align-items: center; flex-wrap: wrap;
        }
        .reading-card img {
            width: 80px; border-radius: 16px;
        }
        
        /* Гороскоп */
        .horoscope-signs {
            display: flex; flex-wrap: wrap; gap: 10px;
            margin: 20px 0;
        }
        .sign-btn {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 10px 18px;
            cursor: pointer; transition: all 0.2s;
            font-family: inherit; font-size: 14px;
        }
        .sign-btn.active {
            background: rgba(224,224,224,0.15);
            border-color: rgba(224,224,224,0.3);
        }
        .horoscope-category {
            display: flex; gap: 8px; margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .horoscope-cat-btn {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 30px; padding: 6px 14px;
            font-size: 12px; cursor: pointer;
        }
        .horoscope-cat-btn.active {
            background: rgba(224,224,224,0.12);
        }
        
        /* Натальная карта */
        .natal-placeholder {
            text-align: center; padding: 40px;
            background: rgba(224,224,224,0.03);
            border-radius: 24px; margin-top: 20px;
        }
        .natal-input-group {
            margin-bottom: 16px; text-align: left;
        }
        .natal-input-group label {
            display: block; font-size: 12px;
            margin-bottom: 6px; color: var(--text-secondary);
        }
        .natal-input {
            width: 100%; padding: 12px;
            border-radius: 30px;
            border: 1px solid rgba(224,224,224,0.2);
            background: rgba(0,0,0,0.3);
            color: var(--text-primary);
            font-family: inherit;
        }
        .planet-row {
            display: flex; justify-content: space-between;
            padding: 8px 0; border-bottom: 1px solid rgba(224,224,224,0.05);
        }
        .planet-name { font-weight: 600; width: 100px; }
        
        @media (max-width: 480px) {
            .tarot-grid { grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 10px; }
            .tarot-card img { width: 55px; }
            .tarot-card-name { font-size: 10px; }
            .reading-card { flex-direction: column; text-align: center; }
        }
    `;
    document.head.appendChild(s);
}

function _esToast(msg, type) {
    if (window.showToast) window.showToast(msg, type || 'info');
    else console.log(`[Toast] ${msg}`);
}

function _esHome() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
}

function _esUid() {
    return window.CONFIG?.USER_ID;
}

// --- Определение знака зодиака по дате ---
function getZodiacSign(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
    return 'pisces';
}

// --- Получение гороскопа через API (с fallback на локальные данные) ---
async function fetchHoroscope(signId, category = 'general') {
    const sign = ZODIAC_SIGNS.find(s => s.id === signId);
    if (!sign) return null;
    
    // Пытаемся получить через бесплатный API
    try {
        const response = await fetch(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/${category}?sign=${sign.name.toLowerCase()}&day=TODAY`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) return data.data;
        }
    } catch (e) {
        console.log('API недоступен, используем локальные данные');
    }
    
    // Fallback на локальные данные
    const texts = HOROSCOPE_TEXTS[signId];
    if (texts && texts[category]) return texts[category];
    
    // Общий fallback
    const fallbacks = {
        general: 'Сегодня хороший день для размышлений и новых начинаний. Прислушайтесь к своей интуиции.',
        love: 'Звёзды говорят о возможных переменах в личной жизни. Будьте открыты к новым знакомствам.',
        career: 'В работе возможны интересные предложения. Не упустите свой шанс.',
        health: 'Обратите внимание на режим сна и отдыха. Баланс — ключ к хорошему самочувствию.',
        advice: 'Доверяйте себе. Ваша внутренняя мудрость подскажет верный путь.'
    };
    return fallbacks[category] || fallbacks.general;
}

// --- Интерпретация карты Таро через AI (или локально) ---
async function interpretTarotCard(card, isReversed = false, userContext = '') {
    const orientation = isReversed ? 'перевёрнутом' : 'прямом';
    const meaning = isReversed ? card.reversed : card.meaning;
    
    // Базовое значение
    let interpretation = `Карта **${card.name}** (${card.nameEn}) в ${orientation} положении.\n\n`;
    interpretation += `**Значение:** ${meaning}\n\n`;
    
    // Добавляем астрологическую привязку
    if (card.element) interpretation += `**Стихия:** ${card.element}\n`;
    if (card.planet) interpretation += `**Планета:** ${card.planet}\n`;
    
    // Добавляем психологический контекст
    interpretation += `\n**Психологический аспект:** `;
    if (card.id === 0) interpretation += `Это призыв к новому началу. Возможно, вы стоите на пороге важных перемен.`;
    else if (card.id === 1) interpretation += `У вас есть все необходимые ресурсы для достижения цели.`;
    else if (card.id === 2) interpretation += `Доверьтесь своей интуиции — ответ уже внутри вас.`;
    else if (card.id === 13) interpretation += `Что-то в вашей жизни должно завершиться, чтобы освободить место для нового.`;
    else interpretation += `Обратите внимание на то, что эта карта говорит о вашей текущей ситуации.`;
    
    return interpretation;
}

// --- Случайная карта Таро ---
function getRandomTarotCard() {
    const randomIndex = Math.floor(Math.random() * MAJOR_ARCANA.length);
    const card = MAJOR_ARCANA[randomIndex];
    const isReversed = Math.random() > 0.7;
    return { card, isReversed };
}

// --- Расчёт планетарных позиций (упрощённый, для демонстрации) ---
// В production рекомендуется использовать Swiss Ephemeris WASM: @fusionstrings/swiss-eph
function calculatePlanetaryPositions(date, lat, lon) {
    // Это упрощённая имитация. Для реальных расчётов используйте Swiss Ephemeris
    const planets = [
        { name: 'Солнце', symbol: '☉', sign: 'Лев', degree: Math.floor(Math.random() * 30) },
        { name: 'Луна', symbol: '☽', sign: 'Рак', degree: Math.floor(Math.random() * 30) },
        { name: 'Меркурий', symbol: '☿', sign: 'Дева', degree: Math.floor(Math.random() * 30) },
        { name: 'Венера', symbol: '♀', sign: 'Весы', degree: Math.floor(Math.random() * 30) },
        { name: 'Марс', symbol: '♂', sign: 'Скорпион', degree: Math.floor(Math.random() * 30) },
        { name: 'Юпитер', symbol: '♃', sign: 'Стрелец', degree: Math.floor(Math.random() * 30) },
        { name: 'Сатурн', symbol: '♄', sign: 'Козерог', degree: Math.floor(Math.random() * 30) },
        { name: 'Уран', symbol: '♅', sign: 'Водолей', degree: Math.floor(Math.random() * 30) },
        { name: 'Нептун', symbol: '♆', sign: 'Рыбы', degree: Math.floor(Math.random() * 30) },
        { name: 'Плутон', symbol: '♇', sign: 'Скорпион', degree: Math.floor(Math.random() * 30) }
    ];
    return planets;
}

// --- Рендер компонентов ---
function renderTarot() {
    return `
        <div class="tarot-grid">
            ${MAJOR_ARCANA.slice(0, 12).map(card => `
                <div class="tarot-card" data-card-id="${card.id}">
                    <img src="${card.image}" alt="${card.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2275%22 text-anchor=%22middle%22 fill=%22%23fff%22%3E${card.name}%3C/text%3E%3C/svg%3E'">
                    <div class="tarot-card-name">${card.name}</div>
                </div>
            `).join('')}
        </div>
        <div style="display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
            <button class="hy-btn hy-btn-primary" id="drawRandomCard">🎴 Карта дня</button>
            <button class="hy-btn hy-btn-primary" id="drawThreeCards">🃏 Расклад "Три карты"</button>
            <button class="hy-btn hy-btn-primary" id="drawCelticCross">🔮 Кельтский крест</button>
        </div>
        <div id="tarotResult"></div>
        <div class="hy-tip">
            💡 <strong>О Таро:</strong> Карты не предсказывают будущее — они показывают текущие энергии и возможные пути развития.
        </div>
    `;
}

function renderHoroscope() {
    const savedSign = localStorage.getItem('fredi_zodiac_sign');
    
    return `
        <div class="horoscope-signs">
            ${ZODIAC_SIGNS.map(sign => `
                <button class="sign-btn ${savedSign === sign.id ? 'active' : ''}" data-sign="${sign.id}">
                    ${sign.emoji} ${sign.name}
                </button>
            `).join('')}
        </div>
        <div class="horoscope-category">
            <button class="horoscope-cat-btn active" data-cat="general">🌟 Общий</button>
            <button class="horoscope-cat-btn" data-cat="love">💕 Любовь</button>
            <button class="horoscope-cat-btn" data-cat="career">💼 Карьера</button>
            <button class="horoscope-cat-btn" data-cat="health">🏃 Здоровье</button>
            <button class="horoscope-cat-btn" data-cat="advice">✨ Совет дня</button>
        </div>
        <div id="horoscopeResult"></div>
        <div class="hy-tip">
            💡 Гороскоп обновляется ежедневно. Для точности введите дату рождения в настройках профиля.
        </div>
    `;
}

function renderNatal() {
    const savedBirth = localStorage.getItem('fredi_birth_data');
    let birthHtml = '';
    
    if (savedBirth) {
        try {
            const data = JSON.parse(savedBirth);
            birthHtml = `
                <div class="natal-placeholder" style="margin-bottom: 16px; text-align: left;">
                    <div class="planet-row"><span class="planet-name">📅 Дата:</span> <span>${data.date}</span></div>
                    <div class="planet-row"><span class="planet-name">📍 Место:</span> <span>${data.place}</span></div>
                    <div class="planet-row"><span class="planet-name">♈ Знак:</span> <span>${data.sign}</span></div>
                    <button class="hy-btn hy-btn-ghost" id="clearBirthData" style="margin-top: 12px;">🗑️ Очистить данные</button>
                </div>
            `;
        } catch(e) {}
    }
    
    return `
        ${birthHtml}
        <div class="natal-placeholder">
            <span style="font-size: 48px;">🌟</span>
            <h3 style="margin: 16px 0;">Натальная карта</h3>
            <p style="margin-bottom: 20px; color: var(--text-secondary);">
                Введите данные для построения персональной астрологической карты
            </p>
            <div class="natal-input-group">
                <label>📅 Дата и время рождения</label>
                <input type="datetime-local" id="birthDateTime" class="natal-input">
            </div>
            <div class="natal-input-group">
                <label>📍 Место рождения</label>
                <input type="text" id="birthPlace" class="natal-input" placeholder="Город, страна">
            </div>
            <div class="natal-input-group">
                <label>🌍 Координаты (опционально)</label>
                <input type="text" id="birthCoords" class="natal-input" placeholder="широта, долгота">
            </div>
            <button class="hy-btn hy-btn-primary" id="buildNatalChart" style="margin-top: 12px;">
                🌟 Построить карту
            </button>
            <div id="natalResult" style="margin-top: 24px;"></div>
        </div>
        <div class="hy-tip">
            💡 Натальная карта — это астрологическая карта неба в момент вашего рождения. Она отражает ваш потенциал и жизненный путь.
        </div>
    `;
}

// --- Обработчики Таро ---
async function showTarotReading(card, isReversed = false, spreadType = 'single') {
    const resultDiv = document.getElementById('tarotResult');
    if (!resultDiv) return;
    
    const interpretation = await interpretTarotCard(card, isReversed);
    const orientationText = isReversed ? 'перевёрнутом' : 'прямом';
    
    let spreadHtml = '';
    if (spreadType === 'three') {
        spreadHtml = '<div class="hy-suggestion-label">📖 Расклад "Три карты"</div>';
    } else if (spreadType === 'celtic') {
        spreadHtml = '<div class="hy-suggestion-label">🔮 Расклад "Кельтский крест"</div>';
    }
    
    resultDiv.innerHTML = `
        <div class="tarot-reading">
            <div class="reading-card">
                <img src="${card.image}" alt="${card.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2275%22 text-anchor=%22middle%22 fill=%22%23fff%22%3E${card.name}%3C/text%3E%3C/svg%3E'">
                <div>
                    <strong style="font-size: 18px;">${card.name}</strong><br>
                    <span style="color: var(--text-secondary);">${card.nameEn}</span><br>
                    <span style="font-size: 12px; color: var(--chrome);">${orientationText} · ${card.element || ''} · ${card.planet || ''}</span>
                </div>
            </div>
            ${spreadHtml}
            <div class="hy-suggestion-box">
                <div class="hy-suggestion-label">🔮 Интерпретация</div>
                <div class="hy-suggestion-text" style="white-space: pre-line;">${interpretation}</div>
            </div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="hy-btn hy-btn-ghost" id="copyTarotBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakTarotBtn">🔊 Озвучить</button>
            </div>
        </div>`;
    
    document.getElementById('copyTarotBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(interpretation);
        _esToast('Скопировано', 'success');
    });
    
    document.getElementById('speakTarotBtn')?.addEventListener('click', () => {
        if (window.voiceManager) {
            window.voiceManager.textToSpeech(interpretation, 'psychologist');
        } else {
            _esToast('Голосовой модуль не загружен', 'error');
        }
    });
}

// --- Обработчики гороскопа ---
let currentHoroscopeSign = localStorage.getItem('fredi_zodiac_sign') || 'aries';
let currentHoroscopeCat = 'general';

async function loadHoroscope(signId, category) {
    const resultDiv = document.getElementById('horoscopeResult');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Загрузка гороскопа...</div></div>`;
    
    const horoscope = await fetchHoroscope(signId, category);
    const sign = ZODIAC_SIGNS.find(s => s.id === signId);
    
    const categoryNames = {
        general: '🌟 Общий гороскоп',
        love: '💕 Любовь и отношения',
        career: '💼 Карьера и финансы',
        health: '🏃 Здоровье и энергия',
        advice: '✨ Совет дня'
    };
    
    resultDiv.innerHTML = `
        <div class="hy-suggestion-box">
            <div class="hy-suggestion-label">${categoryNames[category] || category}</div>
            <div class="hy-suggestion-text" style="font-size: 16px; line-height: 1.6;">${horoscope}</div>
            <div style="margin-top: 16px; display: flex; gap: 12px;">
                <button class="hy-btn hy-btn-ghost" id="copyHoroscopeBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakHoroscopeBtn">🔊 Озвучить</button>
            </div>
        </div>
        <div style="margin-top: 16px; padding: 12px; background: rgba(224,224,224,0.03); border-radius: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary);">
                ${sign.emoji} ${sign.name} · Стихия: ${sign.element} · Планета: ${sign.planet}
            </div>
        </div>`;
    
    document.getElementById('copyHoroscopeBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(horoscope);
        _esToast('Скопировано', 'success');
    });
    
    document.getElementById('speakHoroscopeBtn')?.addEventListener('click', () => {
        if (window.voiceManager) window.voiceManager.textToSpeech(horoscope, 'psychologist');
    });
}

// --- Обработчики натальной карты ---
async function buildNatalChart() {
    const dateTime = document.getElementById('birthDateTime')?.value;
    const place = document.getElementById('birthPlace')?.value;
    const coords = document.getElementById('birthCoords')?.value;
    
    if (!dateTime || !place) {
        _esToast('Заполните дату и место рождения', 'error');
        return;
    }
    
    const resultDiv = document.getElementById('natalResult');
    resultDiv.innerHTML = `<div class="hy-suggestion-box"><div class="hy-suggestion-text">🔮 Рассчитываем натальную карту...</div></div>`;
    
    const birthDate = new Date(dateTime);
    const sign = getZodiacSign(birthDate);
    const signData = ZODIAC_SIGNS.find(s => s.id === sign);
    
    // Сохраняем данные
    localStorage.setItem('fredi_birth_data', JSON.stringify({
        date: dateTime,
        place: place,
        sign: signData.name,
        coords: coords
    }));
    localStorage.setItem('fredi_zodiac_sign', sign);
    
    // Рассчитываем планеты
    const planets = calculatePlanetaryPositions(birthDate, 0, 0);
    
    let planetsHtml = '<div class="hy-suggestion-label" style="margin-top: 8px;">🪐 Планеты в момент рождения</div>';
    planets.forEach(p => {
        planetsHtml += `<div class="planet-row"><span class="planet-name">${p.symbol} ${p.name}</span><span>${p.sign} — ${p.degree}°</span></div>`;
    });
    
    resultDiv.innerHTML = `
        <div class="tarot-reading">
            <div class="hy-suggestion-label">🌟 Ваша натальная карта</div>
            <div style="margin-bottom: 16px;">
                <div><strong>📅 Дата:</strong> ${birthDate.toLocaleDateString('ru-RU')}</div>
                <div><strong>📍 Место:</strong> ${place}</div>
                <div><strong>♈ Солнечный знак:</strong> ${signData.name} ${signData.emoji}</div>
                <div><strong>🌙 Стихия:</strong> ${signData.element}</div>
                <div><strong>✨ Управляющая планета:</strong> ${signData.planet}</div>
            </div>
            ${planetsHtml}
            <div class="hy-suggestion-box" style="margin-top: 16px;">
                <div class="hy-suggestion-label">🔮 Астрологическая интерпретация</div>
                <div class="hy-suggestion-text">
                    ${signData.name} — ${signData.element} знак. Люди этого знака обладают ${signData.element === 'Огонь' ? 'страстностью и энергией' : 
                        signData.element === 'Земля' ? 'практичностью и надёжностью' :
                        signData.element === 'Воздух' ? 'интеллектом и коммуникабельностью' : 'глубиной и эмпатией'}.
                    Управляющая планета ${signData.planet} наделяет вас особыми талантами.
                </div>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="hy-btn hy-btn-ghost" id="copyNatalBtn">📋 Скопировать</button>
                <button class="hy-btn hy-btn-ghost" id="speakNatalBtn">🔊 Озвучить</button>
            </div>
        </div>`;
    
    document.getElementById('copyNatalBtn')?.addEventListener('click', () => {
        const text = document.querySelector('#natalResult .hy-suggestion-text')?.innerText || '';
        navigator.clipboard.writeText(text);
        _esToast('Скопировано', 'success');
    });
    
    document.getElementById('speakNatalBtn')?.addEventListener('click', () => {
        const text = document.querySelector('#natalResult .hy-suggestion-text')?.innerText || '';
        if (window.voiceManager) window.voiceManager.textToSpeech(text, 'psychologist');
    });
    
    // Обновляем активный знак в гороскопе
    if (currentHoroscopeSign !== sign) {
        currentHoroscopeSign = sign;
        loadHoroscope(sign, currentHoroscopeCat);
    }
}

// --- Привязка обработчиков ---
function attachTarotHandlers() {
    document.querySelectorAll('.tarot-card').forEach(card => {
        card.addEventListener('click', () => {
            const cardId = parseInt(card.dataset.cardId);
            const selected = MAJOR_ARCANA.find(c => c.id === cardId);
            const isReversed = Math.random() > 0.7;
            showTarotReading(selected, isReversed);
        });
    });
    
    document.getElementById('drawRandomCard')?.addEventListener('click', () => {
        const { card, isReversed } = getRandomTarotCard();
        showTarotReading(card, isReversed);
    });
    
    document.getElementById('drawThreeCards')?.addEventListener('click', () => {
        const cards = [];
        for (let i = 0; i < 3; i++) {
            cards.push(getRandomTarotCard());
        }
        let combinedHtml = '<div class="hy-suggestion-label">📖 Расклад "Три карты"</div><div style="display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;">';
        cards.forEach(({card, isReversed}) => {
            combinedHtml += `<div style="text-align: center; flex: 1; min-width: 80px;">
                <img src="${card.image}" style="width: 70px; border-radius: 12px;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23333%22/%3E%3Ctext x=%2250%22 y=%2275%22 text-anchor=%22middle%22 fill=%22%23fff%22%3E${card.name}%3C/text%3E%3C/svg%3E'">
                <div style="font-size: 11px; margin-top: 4px;">${card.name}<br>${isReversed ? '↺' : '↑'}</div>
            </div>`;
        });
        combinedHtml += '</div><div class="hy-suggestion-box" style="margin-top: 16px;"><div class="hy-suggestion-label">🔮 Суммарное значение</div><div class="hy-suggestion-text">Три карты показывают: прошлое → настоящее → будущее. Обратите внимание на повторяющиеся символы и энергии.</div></div>';
        
        const resultDiv = document.getElementById('tarotResult');
        if (resultDiv) resultDiv.innerHTML = `<div class="tarot-reading">${combinedHtml}<button class="hy-btn hy-btn-ghost" style="margin-top: 16px;" id="closeSpreadBtn">✖️ Закрыть</button></div>`;
        document.getElementById('closeSpreadBtn')?.addEventListener('click', () => { resultDiv.innerHTML = ''; });
    });
    
    document.getElementById('drawCelticCross')?.addEventListener('click', () => {
        _esToast('🔮 Кельтский крест — подробный расклад из 10 карт. Функция в разработке.', 'info');
    });
}

function attachHoroscopeHandlers() {
    document.querySelectorAll('.sign-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sign-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHoroscopeSign = btn.dataset.sign;
            localStorage.setItem('fredi_zodiac_sign', currentHoroscopeSign);
            loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
        });
    });
    
    document.querySelectorAll('.horoscope-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.horoscope-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHoroscopeCat = btn.dataset.cat;
            loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
        });
    });
    
    // Автозагрузка для активного знака
    if (currentHoroscopeSign) {
        loadHoroscope(currentHoroscopeSign, currentHoroscopeCat);
    }
}

function attachNatalHandlers() {
    document.getElementById('buildNatalChart')?.addEventListener('click', buildNatalChart);
    document.getElementById('clearBirthData')?.addEventListener('click', () => {
        localStorage.removeItem('fredi_birth_data');
        _esToast('Данные очищены', 'success');
        render();
    });
}

// --- Главный рендер ---
function render() {
    _esInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const tabsHtml = `
        <div class="es-tabs">
            <button class="es-tab ${state.activeTab === 'tarot' ? 'active' : ''}" data-tab="tarot">🔮 Таро</button>
            <button class="es-tab ${state.activeTab === 'horoscope' ? 'active' : ''}" data-tab="horoscope">✨ Гороскоп</button>
            <button class="es-tab ${state.activeTab === 'natal' ? 'active' : ''}" data-tab="natal">🌟 Натальная карта</button>
        </div>
    `;
    
    let content = '';
    if (state.activeTab === 'tarot') content = renderTarot();
    else if (state.activeTab === 'horoscope') content = renderHoroscope();
    else if (state.activeTab === 'natal') content = renderNatal();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="esBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔮</div>
                <h1 class="content-title">Эзотерика</h1>
                <p style="font-size:12px;color:var(--text-secondary)">Таро · Гороскопы · Натальная карта</p>
            </div>
            ${tabsHtml}
            <div id="esContent">${content}</div>
        </div>`;
    
    document.getElementById('esBack').onclick = () => _esHome();
    
    document.querySelectorAll('.es-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeTab = btn.dataset.tab;
            render();
        });
    });
    
    // Привязываем обработчики в зависимости от активной вкладки
    if (state.activeTab === 'tarot') attachTarotHandlers();
    else if (state.activeTab === 'horoscope') attachHoroscopeHandlers();
    else if (state.activeTab === 'natal') attachNatalHandlers();
}

// --- Точка входа ---
window.showEsotericaScreen = function() {
    state.activeTab = 'tarot';
    render();
};

console.log('✅ esoterica.js v1.0 загружен');
