// ============================================
// ПОЛНЫЙ ТЕСТ ИЗ 5 ЭТАПОВ
// Версия 4.0 - ОБЪЕДИНЕНИЕ ЛУЧШЕГО ИЗ ВСЕХ ПРОЕКТОВ
// Диалоговый интерфейс + сбор контекста + жирный текст HTML + кнопки ДЕТАЛИ
// ============================================

const Test = {
    // ============================================
    // СОСТОЯНИЕ ТЕСТА
    // ============================================
    currentStage: 0,
    currentQuestionIndex: 0,
    userId: null,
    answers: [],
    showIntro: true,
    
    // Контекст пользователя (город, пол, возраст, погода)
    context: {
        city: null,
        gender: null,
        age: null,
        weather: null,
        timezone: null,
        isComplete: false,
        name: null
    },
    
    // Данные для расчетов (этап 1)
    perceptionScores: {
        EXTERNAL: 0,
        INTERNAL: 0,
        SYMBOLIC: 0,
        MATERIAL: 0
    },
    perceptionType: null,
    
    // Данные для расчетов (этап 2)
    thinkingLevel: null,
    thinkingScores: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 },
    strategyLevels: { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] },
    
    // Данные для расчетов (этап 3)
    behavioralLevels: { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] },
    stage3Scores: [],
    
    // Данные для расчетов (этап 4)
    diltsCounts: { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 },
    
    // Данные для расчетов (этап 5)
    deepAnswers: [],
    deepPatterns: null,
    profileData: null,
    
    // Уточнения
    clarificationIteration: 0,
    discrepancies: [],
    clarifyingAnswers: [],
    clarifyingQuestions: [],
    clarifyingCurrent: 0,
    
    // API ключ для погоды (нужно заменить на свой)
    weatherApiKey: 'YOUR_OPENWEATHER_API_KEY',
    
    // ============================================
    // СТРУКТУРА ЭТАПОВ С ДЕТАЛЬНЫМИ ОПИСАНИЯМИ
    // ============================================
    stages: [
        { 
            id: 'perception', 
            number: 1,
            name: 'КОНФИГУРАЦИЯ ВОСПРИЯТИЯ',
            shortDesc: 'Линза, через которую вы смотрите на мир',
            longDesc: `🔍 <b>ЧТО МЫ ИССЛЕДУЕМ:</b>\n\n• Куда направлено ваше внимание — вовне или внутрь\n• Какая тревога доминирует — страх отвержения или страх потери контроля\n\n<b>📊 Вопросов:</b> 8\n<b>⏱ Время:</b> ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8,
            questions: null
        },
        { 
            id: 'thinking', 
            number: 2,
            name: 'КОНФИГУРАЦИЯ МЫШЛЕНИЯ',
            shortDesc: 'Как вы обрабатываете информацию',
            longDesc: `🎯 <b>САМОЕ ВАЖНОЕ:</b>\n\nКонфигурация мышления — это траектория с чётким пунктом назначения: результат, к которому вы придёте. Если ничего не менять — вы попадёте именно туда.\n\n<b>📊 Вопросов:</b> 4-5\n<b>⏱ Время:</b> ~3-4 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: null,
            questions: null
        },
        { 
            id: 'behavior', 
            number: 3,
            name: 'КОНФИГУРАЦИЯ ПОВЕДЕНИЯ',
            shortDesc: 'Ваши автоматические реакции',
            longDesc: `🔍 <b>ЗДЕСЬ МЫ ИССЛЕДУЕМ:</b>\n\n• Ваши автоматические реакции\n• Как вы действуете в разных ситуациях\n• Какие стратегии поведения закреплены\n\n<b>📊 Вопросов:</b> 8\n<b>⏱ Время:</b> ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8,
            questions: null
        },
        { 
            id: 'growth', 
            number: 4,
            name: 'ТОЧКА РОСТА',
            shortDesc: 'Где находится рычаг изменений',
            longDesc: `⚡ <b>ЧТО МЫ НАЙДЁМ:</b>\n\nГде именно находится рычаг — место, где минимальное усилие даёт максимальные изменения.\n\n<b>📊 Вопросов:</b> 8\n<b>⏱ Время:</b> ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8,
            questions: null
        },
        { 
            id: 'deep', 
            number: 5,
            name: 'ГЛУБИННЫЕ ПАТТЕРНЫ',
            shortDesc: 'Тип привязанности, защитные механизмы',
            longDesc: `🔍 <b>ЗДЕСЬ МЫ ИССЛЕДУЕМ:</b>\n\n• Какой у вас тип привязанности (из детства)\n• Какие защитные механизмы вы используете\n• Какие глубинные убеждения управляют вами\n• Чего вы боитесь на самом деле\n\n<b>📊 Вопросов:</b> 10\n<b>⏱ Время:</b> ~5 минут\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 10,
            questions: null
        }
    ],
    
    // ============================================
    // ВОПРОСЫ ЭТАПА 1 (8 вопросов)
    // ============================================
    perception_questions: [
        {
            id: 'p0',
            text: 'Когда принимаешь важное решение, опираешься на:',
            options: [
                { text: '👥 Мнение и опыт других', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 } },
                { text: '💭 Внутренние ощущения, интуицию', scores: { EXTERNAL: 0, INTERNAL: 2, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '📊 Факты, цифры, данные', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '🤝 Советуюсь с близкими, но решаю сам', scores: { EXTERNAL: 1, INTERNAL: 1, SYMBOLIC: 0, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p1',
            text: 'Что вызывает тревогу?',
            options: [
                { text: '😟 Что не поймут, отвергнут', scores: { EXTERNAL: 1, INTERNAL: 0, SYMBOLIC: 2, MATERIAL: 0 } },
                { text: '⚠️ Потеряю контроль над ситуацией', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '💰 Не будет денег, стабильности', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '🤔 Сделаю неправильный выбор', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 1, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p2',
            text: 'В компании незнакомых людей ты:',
            options: [
                { text: '👀 Наблюдаю, изучаю правила', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 } },
                { text: '🎧 Прислушиваюсь к себе', scores: { EXTERNAL: 0, INTERNAL: 2, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '🎯 Ищу чем заняться', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 1 } },
                { text: '💫 Стараюсь понравиться', scores: { EXTERNAL: 1, INTERNAL: 0, SYMBOLIC: 1, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p3',
            text: 'Что важнее в работе?',
            options: [
                { text: '🎯 Смысл, предназначение', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 2, MATERIAL: 0 } },
                { text: '📈 Конкретный результат', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '🏆 Признание, статус', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '🌱 Процесс, развитие', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 0, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p4',
            text: 'Когда устал, восстанавливаешься:',
            options: [
                { text: '👥 Иду к людям за поддержкой', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 } },
                { text: '🏠 Уединяюсь с собой', scores: { EXTERNAL: 0, INTERNAL: 2, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '📋 Занимаюсь делами, рутиной', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 1 } },
                { text: '📚 Ухожу в фильмы/книги', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 1, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p5',
            text: 'Реакция на критику:',
            options: [
                { text: '😔 Обижаюсь, переживаю', scores: { EXTERNAL: 1, INTERNAL: 0, SYMBOLIC: 2, MATERIAL: 0 } },
                { text: '🔍 Анализирую, исправляю', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 0, MATERIAL: 1 } },
                { text: '🛡️ Защищаюсь, объясняю', scores: { EXTERNAL: 1, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 } },
                { text: '🤷 Обесцениваю критикующего', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 1, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p6',
            text: 'Что замечаешь в новом помещении?',
            options: [
                { text: '👥 Людей, кто где находится', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 } },
                { text: '✨ Атмосферу, освещение', scores: { EXTERNAL: 0, INTERNAL: 1, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '🏠 Предметы, структуру', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '💭 Свои ощущения', scores: { EXTERNAL: 0, INTERNAL: 2, SYMBOLIC: 0, MATERIAL: 0 } }
            ]
        },
        {
            id: 'p7',
            text: 'Что для тебя успех?',
            options: [
                { text: '🏆 Признание, уважение других', scores: { EXTERNAL: 2, INTERNAL: 0, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '😌 Внутренняя гармония', scores: { EXTERNAL: 0, INTERNAL: 2, SYMBOLIC: 1, MATERIAL: 0 } },
                { text: '💰 Достижения, статус, блага', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 2 } },
                { text: '🎯 Реализовать предназначение', scores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 2, MATERIAL: 0 } }
            ]
        }
    ],
    
    // ============================================
    // ВОПРОСЫ ЭТАПА 2 (4-5 вопросов)
    // ============================================
    thinking_questions: {
        external: [
            {
                text: 'Когда в группе возникает конфликт, вы скорее:',
                options: [
                    { text: '🔍 Замечаю только то, что касается меня', level: 2, measures: 'ЧВ' },
                    { text: '👥 Вижу кто на чьей стороне', level: 3, measures: 'ЧВ' },
                    { text: '📋 Понимаю явные причины', level: 4, measures: 'ЧВ' },
                    { text: '🎯 Анализирую позиции и интересы', level: 5, measures: 'ЧВ' },
                    { text: '🔗 Вижу систему отношений', level: 6, measures: 'ЧВ' },
                    { text: '📜 Понимаю связь с историей группы', level: 7, measures: 'ЧВ' },
                    { text: '🔮 Могу предсказать развитие', level: 8, measures: 'ЧВ' },
                    { text: '🔄 Вижу повторяющиеся паттерны', level: 9, measures: 'ЧВ' }
                ]
            },
            {
                text: 'Как вы понимаете, почему люди поступают так, а не иначе?',
                options: [
                    { text: '🤷 Они просто такие', level: 1, measures: 'ЧВ' },
                    { text: '🌍 Так сложились обстоятельства', level: 2, measures: 'ЧВ' },
                    { text: '💭 У них явные мотивы', level: 3, measures: 'ЧВ' },
                    { text: '📚 Анализирую их прошлый опыт', level: 4, measures: 'ЧВ' },
                    { text: '💎 Понимаю их ценности', level: 5, measures: 'ЧВ' },
                    { text: '🏠 Вижу связь с окружением', level: 6, measures: 'ЧВ' },
                    { text: '🔮 Могу предсказать реакции', level: 7, measures: 'ЧВ' },
                    { text: '🎭 Замечаю архетипы', level: 8, measures: 'ЧВ' },
                    { text: '📜 Понимаю универсальные законы', level: 9, measures: 'ЧВ' }
                ]
            },
            {
                text: 'Когда вас критикуют, ваша мысль:',
                options: [
                    { text: '😤 Они ко мне придираются', level: 1, measures: 'СБ' },
                    { text: '😞 Я что-то сделал не так', level: 2, measures: 'СБ' },
                    { text: '🤔 В этот раз я ошибся', level: 3, measures: 'СБ' },
                    { text: '🔄 У меня повторяется паттерн ошибок', level: 4, measures: 'СБ' },
                    { text: '💭 Это связано с моими убеждениями', level: 5, measures: 'СБ' },
                    { text: '🎭 Это часть моей роли', level: 6, measures: 'СБ' },
                    { text: '📚 Это жизненный урок', level: 7, measures: 'СБ' },
                    { text: '🌍 Универсальный паттерн', level: 8, measures: 'СБ' },
                    { text: '📜 Законы развития', level: 9, measures: 'СБ' }
                ]
            },
            {
                text: 'Как вы относитесь к деньгам?',
                options: [
                    { text: '🌊 Приходят и уходят', level: 1, measures: 'ТФ' },
                    { text: '🔍 Нужно искать возможности', level: 2, measures: 'ТФ' },
                    { text: '💪 Результат действий', level: 3, measures: 'ТФ' },
                    { text: '📊 Система, которую можно выстроить', level: 4, measures: 'ТФ' },
                    { text: '⚡ Энергия и свобода', level: 5, measures: 'ТФ' },
                    { text: '🎯 Инструмент для целей', level: 6, measures: 'ТФ' },
                    { text: '📈 Часть экономики', level: 7, measures: 'ТФ' },
                    { text: '💎 Отражение ценности', level: 8, measures: 'ТФ' },
                    { text: '🔄 Универсальный эквивалент', level: 9, measures: 'ТФ' }
                ]
            },
            {
                text: 'Когда происходит что-то непонятное:',
                options: [
                    { text: '😴 Стараюсь не думать', level: 1, measures: 'УБ' },
                    { text: '🔮 Ищу знаки', level: 2, measures: 'УБ' },
                    { text: '📚 Обращаюсь к эксперту', level: 3, measures: 'УБ' },
                    { text: '🔍 Ищу заговор', level: 4, measures: 'УБ' },
                    { text: '📊 Анализирую факты', level: 5, measures: 'УБ' },
                    { text: '🏛️ Смотрю в контексте системы', level: 6, measures: 'УБ' },
                    { text: '📜 Ищу аналогии в истории', level: 7, measures: 'УБ' },
                    { text: '🧠 Строю модели', level: 8, measures: 'УБ' },
                    { text: '🔗 Ищу закономерности', level: 9, measures: 'УБ' }
                ]
            }
        ],
        internal: [
            {
                text: 'Как ищешь смысл в происходящем?',
                options: [
                    { text: '😴 Не ищу', level: 1, measures: 'УБ' },
                    { text: '💭 Чувствую, есть или нет', level: 2, measures: 'УБ' },
                    { text: '📚 Спрашиваю у знающих', level: 3, measures: 'УБ' },
                    { text: '💖 Анализирую свои чувства', level: 4, measures: 'УБ' },
                    { text: '🔍 Ищу глубинные причины', level: 5, measures: 'УБ' },
                    { text: '💎 Вижу связи с ценностями', level: 6, measures: 'УБ' },
                    { text: '📖 Понимаю жизненные уроки', level: 7, measures: 'УБ' },
                    { text: '🎭 Вижу архетипические сюжеты', level: 8, measures: 'УБ' },
                    { text: '🌌 Понимаю универсальные смыслы', level: 9, measures: 'УБ' }
                ]
            },
            {
                text: 'Как выбираешь, чем заниматься?',
                options: [
                    { text: '🍃 Как получится', level: 1, measures: 'ТФ' },
                    { text: '😊 По настроению', level: 2, measures: 'ТФ' },
                    { text: '👥 По совету', level: 3, measures: 'ТФ' },
                    { text: '🔍 Анализирую интересы', level: 4, measures: 'ТФ' },
                    { text: '🎯 Ищу призвание', level: 5, measures: 'ТФ' },
                    { text: '💎 Связываю с ценностями', level: 6, measures: 'ТФ' },
                    { text: '📜 Понимаю предназначение', level: 7, measures: 'ТФ' },
                    { text: '🛤️ Вижу свой путь', level: 8, measures: 'ТФ' },
                    { text: '🌟 Следую миссии', level: 9, measures: 'ТФ' }
                ]
            },
            {
                text: 'В конфликте с близким по духу:',
                options: [
                    { text: '😰 Теряюсь', level: 1, measures: 'СБ' },
                    { text: '🚶 Ухожу', level: 2, measures: 'СБ' },
                    { text: '👍 Соглашаюсь', level: 3, measures: 'СБ' },
                    { text: '🔍 Анализирую', level: 4, measures: 'СБ' },
                    { text: '🤝 Ищу компромисс', level: 5, measures: 'СБ' },
                    { text: '💎 Понимаю его ценности', level: 6, measures: 'СБ' },
                    { text: '📚 Вижу урок', level: 7, measures: 'СБ' },
                    { text: '🎭 Понимаю архетип', level: 8, measures: 'СБ' },
                    { text: '📜 Вижу закономерность', level: 9, measures: 'СБ' }
                ]
            },
            {
                text: 'В отношениях с единомышленниками:',
                options: [
                    { text: '🪢 Привязываюсь', level: 1, measures: 'ЧВ' },
                    { text: '🔄 Подстраиваюсь', level: 2, measures: 'ЧВ' },
                    { text: '✨ Показываю себя', level: 3, measures: 'ЧВ' },
                    { text: '💭 Понимаю их', level: 4, measures: 'ЧВ' },
                    { text: '🤝 Строю партнерство', level: 5, measures: 'ЧВ' },
                    { text: '🏛️ Создаю сообщество', level: 6, measures: 'ЧВ' },
                    { text: '💫 Вдохновляю', level: 7, measures: 'ЧВ' },
                    { text: '🎭 Вижу архетипы', level: 8, measures: 'ЧВ' },
                    { text: '📜 Понимаю законы', level: 9, measures: 'ЧВ' }
                ]
            }
        ]
    },
    
    // ============================================
    // ВОПРОСЫ ЭТАПА 3 (8 вопросов)
    // ============================================
    behavior_questions: [
        {
            text: 'Начальник кричит несправедливо. Реакция:',
            options: [
                { text: '😶 Теряюсь, слова не идут', level: 1, strategy: 'СБ' },
                { text: '🚶 Придумываю причину уйти', level: 2, strategy: 'СБ' },
                { text: '😤 Соглашаюсь внешне, внутри кипит', level: 3, strategy: 'СБ' },
                { text: '😌 Сохраняю спокойствие, молчу', level: 4, strategy: 'СБ' },
                { text: '😄 Пытаюсь перевести в шутку', level: 5, strategy: 'СБ' },
                { text: '🗣️ Спокойно говорю, что не согласен', level: 6, strategy: 'СБ' }
            ]
        },
        {
            text: 'Срочно нужны деньги. Первое действие:',
            options: [
                { text: '🙏 Попрошу в долг', level: 1, strategy: 'ТФ' },
                { text: '💼 Найду разовую подработку', level: 2, strategy: 'ТФ' },
                { text: '🏪 Продам что-то из вещей', level: 3, strategy: 'ТФ' },
                { text: '🎨 Предложу свои услуги', level: 4, strategy: 'ТФ' },
                { text: '💰 Использую накопления', level: 5, strategy: 'ТФ' },
                { text: '📊 Создам системный доход', level: 6, strategy: 'ТФ' }
            ]
        },
        {
            text: 'Экономический кризис. Твое объяснение:',
            options: [
                { text: '😴 Стараюсь не думать', level: 1, strategy: 'УБ' },
                { text: '🔮 Судьба, знак, карма', level: 2, strategy: 'УБ' },
                { text: '📚 Верю экспертам', level: 3, strategy: 'УБ' },
                { text: '🎭 Кто-то специально устроил', level: 4, strategy: 'УБ' },
                { text: '📊 Анализирую факты сам', level: 5, strategy: 'УБ' },
                { text: '🔄 Понимаю экономические циклы', level: 6, strategy: 'УБ' }
            ]
        },
        {
            text: 'В новом коллективе в первые дни:',
            options: [
                { text: '🤝 Держусь с тем, кто принял', level: 1, strategy: 'ЧВ' },
                { text: '👀 Наблюдаю и копирую', level: 2, strategy: 'ЧВ' },
                { text: '✨ Стараюсь запомниться', level: 3, strategy: 'ЧВ' },
                { text: '🎯 Смотрю, кто на что влияет', level: 4, strategy: 'ЧВ' },
                { text: '🤝 Ищу общие интересы', level: 5, strategy: 'ЧВ' },
                { text: '🌱 Выстраиваю отношения постепенно', level: 6, strategy: 'ЧВ' }
            ]
        },
        {
            text: 'Близкий снова раздражает. Ты:',
            options: [
                { text: '😔 Терплю, не знаю как начать', level: 1, strategy: 'СБ' },
                { text: '🚶 Незаметно дистанцируюсь', level: 2, strategy: 'СБ' },
                { text: '💬 Намекаю, прямо не говорю', level: 3, strategy: 'СБ' },
                { text: '🌋 Коплю и потом взрываюсь', level: 4, strategy: 'СБ' },
                { text: '🤔 Пытаюсь понять причину', level: 5, strategy: 'СБ' },
                { text: '🗣️ Говорю прямо о чувствах', level: 6, strategy: 'СБ' }
            ]
        },
        {
            text: 'Возможность заработать, но нужно вложиться:',
            options: [
                { text: '🔍 Ищу вариант без вложений', level: 1, strategy: 'ТФ' },
                { text: '🎲 Пробую на минимуме', level: 2, strategy: 'ТФ' },
                { text: '🧮 Считаю, сколько заработаю', level: 3, strategy: 'ТФ' },
                { text: '📊 Оцениваю вложения и доход', level: 4, strategy: 'ТФ' },
                { text: '⚙️ Думаю, как встроить в процессы', level: 5, strategy: 'ТФ' },
                { text: '📈 Анализирую, как масштабировать', level: 6, strategy: 'ТФ' }
            ]
        },
        {
            text: 'Коллега поступил странно, не понимаю зачем:',
            options: [
                { text: '😐 Не придаю значения', level: 1, strategy: 'УБ' },
                { text: '🤷 Он просто такой человек', level: 2, strategy: 'УБ' },
                { text: '📞 Спрашиваю у других', level: 3, strategy: 'УБ' },
                { text: '🎭 Он что-то замышляет', level: 4, strategy: 'УБ' },
                { text: '🔄 Ищу паттерн в поведении', level: 5, strategy: 'УБ' },
                { text: '🧠 Анализирую его мотивы', level: 6, strategy: 'УБ' }
            ]
        },
        {
            text: 'Нужна помощь от того, с кем сложные отношения:',
            options: [
                { text: '😟 Не прошу, боюсь отказа', level: 1, strategy: 'ЧВ' },
                { text: '🎁 Сначала сделаю для него', level: 2, strategy: 'ЧВ' },
                { text: '🎭 Создам ситуацию, где сам предложит', level: 3, strategy: 'ЧВ' },
                { text: '💬 Объясню, почему мне важно', level: 4, strategy: 'ЧВ' },
                { text: '🤝 Говорю прямо, предлагаю обмен', level: 5, strategy: 'ЧВ' },
                { text: '🌱 Строю долгосрочные отношения', level: 6, strategy: 'ЧВ' }
            ]
        }
    ],
    
    // ============================================
    // ВОПРОСЫ ЭТАПА 4 (8 вопросов)
    // ============================================
    growth_questions: [
        { text: 'Если что-то не получается, причина в:', options: [
            { text: '🌍 Обстоятельствах, людях вокруг', dilts: 'ENVIRONMENT' },
            { text: '🛠️ Моих действиях', dilts: 'BEHAVIOR' },
            { text: '📚 Нехватке навыков, опыта', dilts: 'CAPABILITIES' },
            { text: '💎 Моих убеждениях, ценностях', dilts: 'VALUES' },
            { text: '🧠 Моей личности, характере', dilts: 'IDENTITY' }
        ]},
        { text: 'Самый ценный результат работы с психологом:', options: [
            { text: '🤝 Научиться взаимодействовать с людьми', dilts: 'ENVIRONMENT' },
            { text: '🔄 Изменить привычки и реакции', dilts: 'BEHAVIOR' },
            { text: '🎓 Развить новые навыки', dilts: 'CAPABILITIES' },
            { text: '💎 Понять свои ценности', dilts: 'VALUES' },
            { text: '🔍 Найти себя', dilts: 'IDENTITY' }
        ]},
        { text: 'Когда злишься на себя, чаще всего за что?', options: [
            { text: '🌍 Не смог повлиять на ситуацию', dilts: 'ENVIRONMENT' },
            { text: '🛠️ Сделал не то, поступил неправильно', dilts: 'BEHAVIOR' },
            { text: '📚 Не справился, не хватило умения', dilts: 'CAPABILITIES' },
            { text: '💎 Предал свои принципы', dilts: 'VALUES' },
            { text: '😞 Что я такой бестолковый', dilts: 'IDENTITY' }
        ]},
        { text: 'Что труднее всего в отношениях с близкими?', options: [
            { text: '🌍 Они меня не понимают', dilts: 'ENVIRONMENT' },
            { text: '🔄 Мое собственное поведение', dilts: 'BEHAVIOR' },
            { text: '📚 Не умею донести', dilts: 'CAPABILITIES' },
            { text: '💎 У нас разные ценности', dilts: 'VALUES' },
            { text: '😔 Теряю себя', dilts: 'IDENTITY' }
        ]},
        { text: 'Что останавливает от больших целей?', options: [
            { text: '🌍 Внешние обстоятельства', dilts: 'ENVIRONMENT' },
            { text: '🔄 Не знаю с чего начать', dilts: 'BEHAVIOR' },
            { text: '📚 Не хватает знаний, навыков', dilts: 'CAPABILITIES' },
            { text: '💎 Не уверен, что важно для меня', dilts: 'VALUES' },
            { text: '😔 Не верю, что способен', dilts: 'IDENTITY' }
        ]},
        { text: 'Как объясняешь свои успехи?', options: [
            { text: '🍀 Повезло, оказался в нужном месте', dilts: 'ENVIRONMENT' },
            { text: '💪 Сделал правильно, приложил усилия', dilts: 'BEHAVIOR' },
            { text: '🎯 Смог, справился', dilts: 'CAPABILITIES' },
            { text: '💎 Был верен принципам', dilts: 'VALUES' },
            { text: '🧠 Я такой человек', dilts: 'IDENTITY' }
        ]},
        { text: 'Что хочешь изменить в себе в первую очередь?', options: [
            { text: '🌍 Свою жизнь, окружение', dilts: 'ENVIRONMENT' },
            { text: '🔄 Привычки, реакции', dilts: 'BEHAVIOR' },
            { text: '📚 Способности, навыки', dilts: 'CAPABILITIES' },
            { text: '💎 Ценности, убеждения', dilts: 'VALUES' },
            { text: '🧠 Личность, характер', dilts: 'IDENTITY' }
        ]},
        { text: 'О чем чаще всего жалеешь?', options: [
            { text: '🌍 Что не сложились обстоятельства', dilts: 'ENVIRONMENT' },
            { text: '🔄 О том, что сделал или не сделал', dilts: 'BEHAVIOR' },
            { text: '📚 Что не умел, не знал', dilts: 'CAPABILITIES' },
            { text: '💎 Что предал свои принципы', dilts: 'VALUES' },
            { text: '😔 Что был не собой', dilts: 'IDENTITY' }
        ]}
    ],
    
    // ============================================
    // ВОПРОСЫ ЭТАПА 5 (10 вопросов)
    // ============================================
    deep_questions: [
        { text: 'В детстве, когда расстраивался, родители:', options: [
            { text: '🤗 Утешали, обнимали', pattern: 'secure', target: 'attachment' },
            { text: '💪 Говорили "не плачь, будь сильным"', pattern: 'avoidant', target: 'attachment' },
            { text: '🎭 Реагировали по-разному', pattern: 'anxious', target: 'attachment' },
            { text: '🚶 Оставляли одного остыть', pattern: 'dismissive', target: 'attachment' }
        ]},
        { text: 'Когда случается плохое, я обычно:', options: [
            { text: '🔍 Ищу виноватого', pattern: 'projection', target: 'defense' },
            { text: '🧠 Объясняю логически', pattern: 'rationalization', target: 'defense' },
            { text: '😴 Стараюсь не думать', pattern: 'denial', target: 'defense' },
            { text: '😤 Злюсь и раздражаюсь', pattern: 'regression', target: 'defense' }
        ]},
        { text: 'В отношениях чаще всего боюсь, что:', options: [
            { text: '😢 Меня бросят', pattern: 'abandonment', target: 'fear' },
            { text: '🎮 Будут управлять мной', pattern: 'control', target: 'fear' },
            { text: '🙅 Не поймут', pattern: 'misunderstanding', target: 'fear' },
            { text: '😔 Не справлюсь', pattern: 'inadequacy', target: 'fear' }
        ]},
        { text: 'Какое утверждение ближе всего?', options: [
            { text: '😞 Я недостаточно хорош', pattern: 'not_good_enough', target: 'belief' },
            { text: '🤔 Людям нельзя доверять', pattern: 'no_trust', target: 'belief' },
            { text: '🌍 Мир опасен', pattern: 'world_dangerous', target: 'belief' },
            { text: '⭐ Я должен быть идеальным', pattern: 'perfectionism', target: 'belief' }
        ]},
        { text: 'Когда злюсь, я обычно:', options: [
            { text: '💥 Выплёскиваю на других', pattern: 'externalize', target: 'anger_style' },
            { text: '🤐 Подавляю и молчу', pattern: 'suppress', target: 'anger_style' },
            { text: '🏠 Ухожу в себя', pattern: 'withdraw', target: 'anger_style' },
            { text: '🔧 Ищу решение', pattern: 'constructive', target: 'anger_style' }
        ]},
        { text: 'Мои друзья сказали бы, что я:', options: [
            { text: '😭 Слишком эмоциональный', pattern: 'emotional', target: 'social_role' },
            { text: '🧠 Слишком рациональный', pattern: 'rational', target: 'social_role' },
            { text: '🤝 Надёжный, но закрытый', pattern: 'reliable_closed', target: 'social_role' },
            { text: '🎉 Душа компании', pattern: 'soul_company', target: 'social_role' }
        ]},
        { text: 'В стрессе я:', options: [
            { text: '😰 Суечусь и паникую', pattern: 'panic', target: 'stress_response' },
            { text: '😶 Замираю и тупею', pattern: 'freeze', target: 'stress_response' },
            { text: '🎯 Становлюсь сверхсобранным', pattern: 'hyperfocus', target: 'stress_response' },
            { text: '🤝 Ищу поддержку', pattern: 'seek_support', target: 'stress_response' }
        ]},
        { text: 'Что для тебя самое важное в жизни?', options: [
            { text: '🛡️ Безопасность, стабильность', pattern: 'security', target: 'core_value' },
            { text: '🕊️ Свобода, независимость', pattern: 'freedom', target: 'core_value' },
            { text: '❤️ Любовь, близость', pattern: 'love', target: 'core_value' },
            { text: '🏆 Достижения, успех', pattern: 'achievement', target: 'core_value' }
        ]},
        { text: 'Когда меня критикуют, я:', options: [
            { text: '😢 Обижаюсь и закрываюсь', pattern: 'shutdown', target: 'criticism_response' },
            { text: '⚔️ Атакую в ответ', pattern: 'counterattack', target: 'criticism_response' },
            { text: '🔍 Анализирую, правы ли они', pattern: 'analyze', target: 'criticism_response' },
            { text: '👍 Соглашаюсь, чтобы не спорить', pattern: 'appease', target: 'criticism_response' }
        ]},
        { text: 'Моя главная внутренняя проблема:', options: [
            { text: '😔 Страх быть покинутым', pattern: 'abandonment_fear', target: 'core_issue' },
            { text: '😰 Страх неудачи', pattern: 'failure_fear', target: 'core_issue' },
            { text: '🎭 Страх быть собой', pattern: 'authenticity_fear', target: 'core_issue' },
            { text: '⚔️ Страх конфликтов', pattern: 'conflict_fear', target: 'core_issue' }
        ]}
    ],
    
    // ============================================
    // РАСЧЕТНЫЕ ФУНКЦИИ
    // ============================================
    
    determinePerceptionType() {
        const external = this.perceptionScores.EXTERNAL;
        const internal = this.perceptionScores.INTERNAL;
        const symbolic = this.perceptionScores.SYMBOLIC;
        const material = this.perceptionScores.MATERIAL;
        
        const attention = external > internal ? "EXTERNAL" : "INTERNAL";
        const anxiety = symbolic > material ? "SYMBOLIC" : "MATERIAL";
        
        if (attention === "EXTERNAL" && anxiety === "SYMBOLIC") {
            return "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ";
        } else if (attention === "EXTERNAL" && anxiety === "MATERIAL") {
            return "СТАТУСНО-ОРИЕНТИРОВАННЫЙ";
        } else if (attention === "INTERNAL" && anxiety === "SYMBOLIC") {
            return "СМЫСЛО-ОРИЕНТИРОВАННЫЙ";
        } else {
            return "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ";
        }
    },
    
    calculateThinkingLevel() {
        let totalScore = 0;
        for (let level in this.thinkingScores) {
            totalScore += this.thinkingScores[level];
        }
        
        if (totalScore <= 10) return 1;
        else if (totalScore <= 20) return 2;
        else if (totalScore <= 30) return 3;
        else if (totalScore <= 40) return 4;
        else if (totalScore <= 50) return 5;
        else if (totalScore <= 60) return 6;
        else if (totalScore <= 70) return 7;
        else if (totalScore <= 80) return 8;
        else return 9;
    },
    
    getLevelGroup(level) {
        if (level <= 3) return "1-3";
        if (level <= 6) return "4-6";
        return "7-9";
    },
    
    calculateFinalLevel() {
        const stage2Level = this.thinkingLevel;
        const stage3Avg = this.stage3Scores.length > 0 
            ? this.stage3Scores.reduce((a, b) => a + b, 0) / this.stage3Scores.length 
            : stage2Level;
        return Math.round((stage2Level + stage3Avg) / 2);
    },
    
    determineDominantDilts() {
        let max = 0;
        let dominant = "BEHAVIOR";
        for (let level in this.diltsCounts) {
            if (this.diltsCounts[level] > max) {
                max = this.diltsCounts[level];
                dominant = level;
            }
        }
        return dominant;
    },
    
    calculateFinalProfile() {
        const sbAvg = this.behavioralLevels["СБ"].length 
            ? this.behavioralLevels["СБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["СБ"].length 
            : 3;
        const tfAvg = this.behavioralLevels["ТФ"].length 
            ? this.behavioralLevels["ТФ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ТФ"].length 
            : 3;
        const ubAvg = this.behavioralLevels["УБ"].length 
            ? this.behavioralLevels["УБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["УБ"].length 
            : 3;
        const chvAvg = this.behavioralLevels["ЧВ"].length 
            ? this.behavioralLevels["ЧВ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ЧВ"].length 
            : 3;
        
        return {
            displayName: `СБ-${Math.round(sbAvg)}_ТФ-${Math.round(tfAvg)}_УБ-${Math.round(ubAvg)}_ЧВ-${Math.round(chvAvg)}`,
            perceptionType: this.perceptionType,
            thinkingLevel: this.thinkingLevel,
            sbLevel: Math.round(sbAvg),
            tfLevel: Math.round(tfAvg),
            ubLevel: Math.round(ubAvg),
            chvLevel: Math.round(chvAvg),
            dominantDilts: this.determineDominantDilts(),
            diltsCounts: this.diltsCounts
        };
    },
    
    analyzeDeepPatterns() {
        const patterns = { secure: 0, anxious: 0, avoidant: 0, dismissive: 0 };
        (this.deepAnswers || []).forEach(a => {
            if (a.pattern && patterns[a.pattern] !== undefined) {
                patterns[a.pattern] = (patterns[a.pattern] || 0) + 1;
            }
        });
        
        let max = 0, dominant = "secure";
        for (let p in patterns) {
            if (patterns[p] > max) { max = patterns[p]; dominant = p; }
        }
        
        const map = {
            secure: "🤗 Надежный",
            anxious: "😥 Тревожный",
            avoidant: "🛡️ Избегающий",
            dismissive: "🏔️ Отстраненный"
        };
        
        return { attachment: map[dominant] || "🤗 Надежный", patterns };
    },
    
    // ============================================
    // ИНТЕРПРЕТАЦИИ
    // ============================================
    
    getStage1Interpretation() {
        const interpretations = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на других, чутко считываете настроение и ожидания окружающих. Ваше внимание направлено вовне, а тревога связана с отвержением.",
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": "Для вас важны статус, положение и материальные достижения. Вы ориентированы на внешние атрибуты успеха, а тревожитесь о потере контроля.",
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": "Вы ищете глубинные смыслы и ориентируетесь на внутренние ощущения. Ваша тревога связана с отвержением и непониманием.",
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на практические результаты и конкретные действия. Ваше внимание направлено внутрь, а тревога — о потере контроля."
        };
        return interpretations[this.perceptionType] || interpretations["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"];
    },
    
    getStage2Interpretation() {
        const levelGroup = this.getLevelGroup(this.thinkingLevel);
        
        const interpretations = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и привязано к социальным ситуациям. Вы хорошо понимаете сиюминутные взаимодействия, но не всегда видите общие закономерности.",
                "4-6": "Вы замечаете социальные закономерности и тренды. Видите, как складываются отношения и почему люди ведут себя определенным образом.",
                "7-9": "Вы видите глубинные социальные механизмы и законы. Можете предсказывать развитие социальных ситуаций."
            },
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление направлено на достижение статуса. Вы хорошо понимаете иерархию и позиции, но не всегда видите скрытые механизмы.",
                "4-6": "Вы стратегически мыслите в категориях статуса. Видите, как меняются позиции и что нужно для продвижения.",
                "7-9": "Вы видите иерархические закономерности. Понимаете законы власти и влияния."
            },
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Вы ищете смыслы в отдельных событиях. Вам важно понять 'почему' в конкретных ситуациях.",
                "4-6": "Вы находите закономерности в жизненных историях. Видите связь событий и их глубинный смысл.",
                "7-9": "Вы постигаете глубинные смыслы бытия. Видите универсальные законы, управляющие жизнью."
            },
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и практично. Вы хорошо решаете текущие задачи, но не всегда видите перспективу.",
                "4-6": "Вы видите практические закономерности. Понимаете, как устроены процессы и системы.",
                "7-9": "Вы создаёте эффективные практические модели. Можете оптимизировать любые процессы."
            }
        };
        
        return interpretations[this.perceptionType]?.[levelGroup] || interpretations["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"]["4-6"];
    },
    
    getStage3Interpretation() {
        const finalLevel = this.calculateFinalLevel();
        const feedback = {
            1: "Ваше поведение реактивно — вы скорее отвечаете на стимулы, чем действуете осознанно.",
            2: "Вы начинаете осознавать свои автоматические реакции.",
            3: "Вы можете выбирать реакции, но не всегда.",
            4: "Вы управляете своим поведением в большинстве ситуаций.",
            5: "Поведение становится инструментом для достижения целей.",
            6: "Вы мастерски владеете своим поведением."
        };
        
        let level = finalLevel <= 2 ? 1 : finalLevel <= 4 ? 2 : finalLevel <= 6 ? 3 : finalLevel <= 8 ? 4 : 5;
        if (finalLevel >= 9) level = 6;
        
        return feedback[level] || feedback[3];
    },
    
    getStage5Interpretation() {
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        
        const attachmentDesc = {
            "🤗 Надежный": "✅ У тебя надёжный тип привязанности — ты уверен в отношениях и не боишься близости.",
            "😥 Тревожный": "⚠️ Тревожный тип привязанности: ты часто боишься, что тебя бросят, нуждаешься в подтверждениях любви.",
            "🛡️ Избегающий": "⚠️ Избегающий тип привязанности: ты держишь дистанцию, боишься близости, надеясь только на себя.",
            "🏔️ Отстраненный": "⚠️ Отстранённый тип: ты обесцениваешь отношения, считая, что лучше быть одному."
        };
        
        return `🔗 <b>Тип привязанности:</b>\n${attachmentDesc[deep.attachment] || attachmentDesc["🤗 Надежный"]}`;
    },
    
    // ============================================
    // ПОЛУЧЕНИЕ USER_ID
    // ============================================
    
    getUserId() {
        if (window.maxContext?.user_id && window.maxContext.user_id !== 'null' && window.maxContext.user_id !== 'undefined') {
            return window.maxContext.user_id;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        if (urlUserId && urlUserId !== 'null' && urlUserId !== 'undefined') {
            return urlUserId;
        }
        const stored = localStorage.getItem('fredi_user_id');
        if (stored && stored !== 'null' && stored !== 'undefined') {
            return stored;
        }
        console.warn('⚠️ userId не найден!');
        return null;
    },
    
    // ============================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================
    
    init(userId) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        
        this.userId = userId || this.getUserId() || urlUserId;
        
        if (!this.userId || this.userId === 'null' || this.userId === 'undefined') {
            console.warn('⚠️ userId не найден! Тест будет работать в локальном режиме');
            this.userId = null;
        } else {
            console.log('✅ userId найден:', this.userId);
            localStorage.setItem('fredi_user_id', this.userId);
        }
        
        this.reset();
        this.loadProgress();
        console.log('📝 Тест инициализирован для пользователя:', this.userId);
    },
    
    reset() {
        this.currentStage = 0;
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.perceptionScores = { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
        this.perceptionType = null;
        this.thinkingLevel = null;
        this.thinkingScores = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
        this.strategyLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.behavioralLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.stage3Scores = [];
        this.diltsCounts = { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
        this.deepAnswers = [];
        this.deepPatterns = null;
        this.profileData = null;
        this.discrepancies = [];
        this.clarifyingAnswers = [];
        this.clarifyingQuestions = [];
        this.clarifyingCurrent = 0;
        this.context = {
            city: null,
            gender: null,
            age: null,
            weather: null,
            timezone: null,
            isComplete: false,
            name: null
        };
    },
    
    loadProgress() {
        if (!this.userId) return;
        
        const saved = localStorage.getItem(`test_${this.userId}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.currentStage = data.currentStage || 0;
                this.currentQuestionIndex = data.currentQuestionIndex || 0;
                this.answers = data.answers || [];
                this.perceptionScores = data.perceptionScores || { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
                this.perceptionType = data.perceptionType || null;
                this.thinkingLevel = data.thinkingLevel || null;
                this.thinkingScores = data.thinkingScores || { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
                this.strategyLevels = data.strategyLevels || { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
                this.behavioralLevels = data.behavioralLevels || { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
                this.stage3Scores = data.stage3Scores || [];
                this.diltsCounts = data.diltsCounts || { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
                this.deepAnswers = data.deepAnswers || [];
                this.deepPatterns = data.deepPatterns || null;
                this.profileData = data.profileData || null;
                this.context = data.context || { city: null, gender: null, age: null, weather: null, timezone: null, isComplete: false, name: null };
                
                if (this.perceptionType) {
                    const isExternal = this.perceptionType.includes("СОЦИАЛЬНО") || this.perceptionType.includes("СТАТУСНО");
                    const questions = isExternal ? this.thinking_questions.external : this.thinking_questions.internal;
                    this.stages[1].total = questions.length;
                }
            } catch (e) { console.warn('❌ Ошибка загрузки прогресса:', e); }
        }
    },
    
    saveProgress() {
        if (!this.userId) return;
        
        const data = {
            currentStage: this.currentStage,
            currentQuestionIndex: this.currentQuestionIndex,
            answers: this.answers,
            perceptionScores: this.perceptionScores,
            perceptionType: this.perceptionType,
            thinkingLevel: this.thinkingLevel,
            thinkingScores: this.thinkingScores,
            strategyLevels: this.strategyLevels,
            behavioralLevels: this.behavioralLevels,
            stage3Scores: this.stage3Scores,
            diltsCounts: this.diltsCounts,
            deepAnswers: this.deepAnswers,
            deepPatterns: this.deepPatterns,
            profileData: this.profileData,
            context: this.context,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(`test_${this.userId}`, JSON.stringify(data));
        console.log('💾 Прогресс сохранен');
    },
    
    // ============================================
    // ЗАПУСК ТЕСТА
    // ============================================
    
    start() {
        this.init();
        this.reset();
        this.saveProgress();
        this.showTestScreen();
        
        setTimeout(() => {
            // Проверяем, есть ли контекст
            if (this.context.isComplete) {
                this.addBotMessage('🧠 <b>ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ</b>\n\nПривет! Я помню тебя. Хочешь пройти тест заново?');
                this.addMessageWithButtons("", [
                    { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
                    { text: "🔄 ОБНОВИТЬ КОНТЕКСТ", callback: () => this.startContextCollection() }
                ]);
            } else {
                this.showIntroScreen();
            }
        }, 100);
    },
    
    showTestScreen() {
        const container = document.getElementById('screenContainer');
        if (!container) return;
        container.innerHTML = `
            <div class="test-chat-container" id="testChatContainer">
                <div class="test-chat-messages" id="testChatMessages">
                    <div class="test-chat-placeholder"></div>
                </div>
            </div>
        `;
        this.scrollToBottom();
    },
    
    // ============================================
    // ЭКРАН ЗНАКОМСТВА
    // ============================================
    
    showIntroScreen() {
        const text = `
🧠 <b>ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ</b>

Привет! 👋

Я — Фреди, виртуальный психолог.
Оцифрованная версия Андрея Мейстера.

🕒 Нам нужно познакомиться, чтобы я понимал,
   с кем имею дело и чем могу быть полезен.

<b>📊 5 ЭТАПОВ ТЕСТИРОВАНИЯ:</b>

┌─────────────────────────────────────────────────┐
│ 1️⃣ <b>ВОСПРИЯТИЕ</b>              [📖 ДЕТАЛИ]   │
│    Линза, через которую вы смотрите на мир     │
├─────────────────────────────────────────────────┤
│ 2️⃣ <b>МЫШЛЕНИЕ</b>                [📖 ДЕТАЛИ]   │
│    Как вы обрабатываете информацию              │
├─────────────────────────────────────────────────┤
│ 3️⃣ <b>ПОВЕДЕНИЕ</b>               [📖 ДЕТАЛИ]   │
│    Ваши автоматические реакции                  │
├─────────────────────────────────────────────────┤
│ 4️⃣ <b>ТОЧКА РОСТА</b>             [📖 ДЕТАЛИ]   │
│    Где находится рычаг изменений                │
├─────────────────────────────────────────────────┤
│ 5️⃣ <b>ГЛУБИННЫЕ ПАТТЕРНЫ</b>      [📖 ДЕТАЛИ]   │
│    Тип привязанности, защитные механизмы        │
└─────────────────────────────────────────────────┘

⏱ <b>15 минут</b> — и я буду знать о вас больше,
   чем вы думаете.

👇 <b>СНАЧАЛА НУЖНО НЕМНОГО УЗНАТЬ О ВАС:</b>

📍 Город     👤 Пол     📅 Возраст
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ЗНАКОМСТВО", callback: () => this.startContextCollection() },
            { text: "🤨 А ТЫ ВООБЩЕ КТО ТАКОЙ?", callback: () => this.showBotInfo() }
        ]);
    },
    
    // ============================================
    // ДЕТАЛИ ЭТАПА
    // ============================================
    
    showStageDetails(stageIndex) {
        const stage = this.stages[stageIndex];
        
        const text = `
🔍 <b>ЭТАП ${stage.number}: ${stage.name}</b>

${stage.longDesc}

👇 <b>НАЧИНАЕМ?</b>
`;
        
        this.addMessageWithButtons(text, [
            { text: "▶️ НАЧАТЬ ЭТАП", callback: () => this.startStageFromDetails(stageIndex) },
            { text: "◀️ НАЗАД К СПИСКУ", callback: () => this.showIntroScreen() }
        ]);
    },
    
    startStageFromDetails(stageIndex) {
        this.currentStage = stageIndex;
        this.currentQuestionIndex = 0;
        this.sendStageIntro();
    },
    
    // ============================================
    // ИНФОРМАЦИЯ О БОТЕ
    // ============================================
    
    showBotInfo() {
        const text = `
🎭 <b>Ну, вопрос хороший. Давайте по существу.</b>

Видите ли, дорогой человек, я — экспериментальная модель.
Андрей Мейстер однажды подумал: "А что, если я создам свою цифровую копию?
Пусть работает, пока я сплю, ем или просто ленюсь".

Так я и появился. 🧠

🧐 <b>Что я умею:</b>

• Вижу паттерны там, где вы видите просто день сурка
• Нахожу систему в ваших "случайных" решениях
• Понимаю, почему вы выбираете одних и тех же "не тех" людей
• Я реально беспристрастен — у меня нет плохого настроения

🎯 <b>Конкретно по тесту:</b>

1️⃣ Восприятие — поймём, какую линзу вы носите
2️⃣ Мышление — узнаем, как вы пережёвываете реальность
3️⃣ Поведение — посмотрим, что вы делаете "на автомате"
4️⃣ Точка роста — я скажу, куда вам двигаться
5️⃣ Глубинные паттерны — заглянем в детство и подсознание

⏱ <b>15 минут</b> — и я составлю ваш профиль.

👌 Погнали?
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "👌 ПОГНАЛИ!", callback: () => this.startContextCollection() }
        ]);
    },
    
    // ============================================
    // СБОР КОНТЕКСТА
    // ============================================
    
    startContextCollection() {
        this.askCity();
    },
    
    askCity() {
        const text = `
📝 <b>ДАВАЙТЕ ПОЗНАКОМИМСЯ</b>

🏙️ <b>В каком городе вы живете?</b>
(Это нужно для погоды и часового пояса)

👇 Напишите название города:
`;
        
        this.addBotMessage(text, true);
        this.showTextInput("city");
    },
    
    askGender() {
        const text = `
👤 <b>Теперь скажите, ваш пол:</b>
`;
        
        this.addMessageWithButtons(text, [
            { text: "👨 МУЖСКОЙ", callback: () => this.setGender("male") },
            { text: "👩 ЖЕНСКИЙ", callback: () => this.setGender("female") },
            { text: "🧑 ДРУГОЕ", callback: () => this.setGender("other") },
            { text: "⏭ ПРОПУСТИТЬ", callback: () => this.skipGender() }
        ]);
    },
    
    askAge() {
        const text = `
📅 <b>Сколько вам лет?</b>

Напишите число от 1 до 120
`;
        
        this.addBotMessage(text, true);
        this.showTextInput("age");
    },
    
    setGender(gender) {
        this.context.gender = gender;
        this.askAge();
    },
    
    skipGender() {
        this.context.gender = "other";
        this.askAge();
    },
    
    async setCity(city) {
        this.context.city = city;
        
        this.addBotMessage(`📍 Город сохранен: <b>${city}</b>`, true);
        
        // Получаем погоду
        const weather = await this.fetchWeather(city);
        if (weather) {
            this.context.weather = weather;
            this.addBotMessage(`${weather.icon} Погода: ${weather.description}, ${weather.temp}°C`, true);
        }
        
        this.askGender();
    },
    
    async fetchWeather(city) {
        try {
            if (!this.weatherApiKey || this.weatherApiKey === 'YOUR_OPENWEATHER_API_KEY') {
                console.warn('⚠️ API ключ для погоды не настроен');
                return null;
            }
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.weatherApiKey}&units=metric&lang=ru`
            );
            const data = await response.json();
            
            if (data.cod === 200) {
                return {
                    temp: Math.round(data.main.temp),
                    description: data.weather[0].description,
                    icon: this.getWeatherIcon(data.weather[0].icon)
                };
            } else {
                console.warn('Погода не найдена:', data.message);
                return null;
            }
        } catch (error) {
            console.error('Ошибка получения погоды:', error);
            return null;
        }
    },
    
    getWeatherIcon(iconCode) {
        const icons = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return icons[iconCode] || '🌡️';
    },
    
    setAge(age) {
        const ageNum = parseInt(age);
        if (ageNum >= 1 && ageNum <= 120) {
            this.context.age = ageNum;
            this.showContextComplete();
        } else {
            this.addBotMessage("❌ Возраст должен быть от 1 до 120 лет. Попробуйте еще раз:", true);
            this.showTextInput("age");
        }
    },
    
    showContextComplete() {
        this.context.isComplete = true;
        this.saveProgress();
        
        const text = `
✅ <b>ОТЛИЧНО! ТЕПЕРЬ Я ЗНАЮ О ВАС</b>

📍 Город: <b>${this.context.city || 'не указан'}</b>
👤 Пол: <b>${this.getGenderText()}</b>
📅 Возраст: <b>${this.context.age || 'не указан'}</b>
${this.context.weather ? `${this.context.weather.icon} Погода: <b>${this.context.weather.description}, ${this.context.weather.temp}°C</b>` : ''}

🎯 Теперь я буду учитывать это в наших разговорах!

🧠 <b>ЧТО ДАЛЬШЕ?</b>

Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).
Он определит ваш психологический профиль по 4 векторам и глубинным паттернам.

👇 <b>НАЧИНАЕМ?</b>
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
            { text: "📖 ЧТО ДАЕТ ТЕСТ", callback: () => this.showTestBenefits() }
        ]);
    },
    
    getGenderText() {
        const map = {
            'male': 'Мужчина',
            'female': 'Женщина',
            'other': 'Другое'
        };
        return map[this.context.gender] || 'не указан';
    },
    
    showTestBenefits() {
        const text = `
🔍 <b>ЧТО ВЫ УЗНАЕТЕ О СЕБЕ:</b>

🧠 <b>ЭТАП 1: КОНФИГУРАЦИЯ ВОСПРИЯТИЯ</b>
Линза, через которую вы смотрите на мир.

🧠 <b>ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ</b>
Как вы обрабатываете информацию.

🧠 <b>ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ</b>
Ваши автоматические реакции.

🧠 <b>ЭТАП 4: ТОЧКА РОСТА</b>
Где находится рычаг изменений.

🧠 <b>ЭТАП 5: ГЛУБИННЫЕ ПАТТЕРНЫ</b>
Тип привязанности, защитные механизмы, базовые убеждения.

⚡ <b>ПОСЛЕ ТЕСТА ВЫ ПОЛУЧИТЕ:</b>

✅ Полный психологический портрет
✅ Глубинный анализ подсознательных паттернов
✅ Выбор стиля общения: 🔮 КОУЧ | 🧠 ПСИХОЛОГ | ⚡ ТРЕНЕР
✅ Индивидуальный навигатор по целям

⏱ <b>Всего 15 минут</b>
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
            { text: "◀️ НАЗАД", callback: () => this.showContextComplete() }
        ]);
    },
    
    startTest() {
        this.currentStage = 0;
        this.currentQuestionIndex = 0;
        this.reset();
        this.saveProgress();
        this.showTestScreen();
        
        setTimeout(() => {
            this.sendStageIntro();
        }, 500);
    },
    
    // ============================================
    // ОТРИСОВКА СООБЩЕНИЙ
    // ============================================
    
    addBotMessage(text, isHtml = true) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        if (isHtml) {
            textDiv.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            textDiv.textContent = text;
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        bubble.appendChild(textDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },
    
    addUserMessage(text) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-user';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-user';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.textContent = text;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        bubble.appendChild(textDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },
    
    addQuestionMessage(text, options, callback, current, total) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.innerHTML = `<b>Вопрос ${current}/${total}</b><br><br>${text}`;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.flexWrap = 'wrap';
        buttonsDiv.style.gap = '8px';
        buttonsDiv.style.marginTop = '12px';
        
        options.forEach((opt, idx) => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            const btn = document.createElement('button');
            btn.className = 'test-message-button';
            btn.textContent = optText;
            btn.style.background = 'rgba(255, 107, 59, 0.15)';
            btn.style.border = '1px solid rgba(255, 107, 59, 0.3)';
            btn.style.borderRadius = '30px';
            btn.style.padding = '10px 20px';
            btn.style.fontSize = '14px';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.2s';
            btn.style.fontFamily = 'inherit';
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255, 107, 59, 0.3)';
                btn.style.transform = 'scale(1.02)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255, 107, 59, 0.15)';
                btn.style.transform = 'scale(1)';
            });
            btn.addEventListener('click', () => {
                buttonsDiv.remove();
                this.addUserMessage(optText);
                callback(idx, opt);
            });
            buttonsDiv.appendChild(btn);
        });
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = `📊 Прогресс: ${Math.round((current / total) * 100)}%`;
        timeDiv.style.fontSize = '10px';
        timeDiv.style.opacity = '0.6';
        timeDiv.style.marginTop = '8px';
        
        bubble.appendChild(textDiv);
        bubble.appendChild(buttonsDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
    },
    
    addMessageWithButtons(text, buttons) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        if (text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'test-message-text';
            textDiv.innerHTML = text.replace(/\n/g, '<br>');
            bubble.appendChild(textDiv);
        }
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.flexWrap = 'wrap';
        buttonsDiv.style.gap = '8px';
        buttonsDiv.style.marginTop = '12px';
        
        buttons.forEach((btn, i) => {
            const button = document.createElement('button');
            button.className = 'test-message-button';
            button.textContent = btn.text;
            button.style.background = 'rgba(255, 107, 59, 0.15)';
            button.style.border = '1px solid rgba(255, 107, 59, 0.3)';
            button.style.borderRadius = '30px';
            button.style.padding = '10px 20px';
            button.style.fontSize = '14px';
            button.style.color = 'white';
            button.style.cursor = 'pointer';
            button.style.transition = 'all 0.2s';
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255, 107, 59, 0.3)';
                button.style.transform = 'scale(1.02)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'rgba(255, 107, 59, 0.15)';
                button.style.transform = 'scale(1)';
            });
            button.addEventListener('click', () => {
                buttonsDiv.remove();
                btn.callback();
            });
            buttonsDiv.appendChild(button);
        });
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = 'только что';
        timeDiv.style.fontSize = '10px';
        timeDiv.style.opacity = '0.6';
        timeDiv.style.marginTop = '8px';
        
        bubble.appendChild(buttonsDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },
    
    showTextInput(field) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const inputDiv = document.createElement('div');
        inputDiv.className = 'test-message test-message-input';
        inputDiv.style.display = 'flex';
        inputDiv.style.gap = '8px';
        inputDiv.style.marginTop = '8px';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = field === 'city' ? 'Напишите город...' : 'Напишите возраст...';
        input.style.flex = '1';
        input.style.padding = '10px';
        input.style.borderRadius = '20px';
        input.style.border = '1px solid rgba(255,107,59,0.3)';
        input.style.background = 'rgba(255,255,255,0.1)';
        input.style.color = 'white';
        
        const button = document.createElement('button');
        button.textContent = '📤';
        button.style.padding = '10px 15px';
        button.style.borderRadius = '20px';
        button.style.border = '1px solid rgba(255,107,59,0.3)';
        button.style.background = 'rgba(255,107,59,0.15)';
        button.style.color = 'white';
        button.style.cursor = 'pointer';
        
        button.onclick = () => {
            const value = input.value.trim();
            if (value) {
                this.addUserMessage(value);
                inputDiv.remove();
                if (field === 'city') {
                    this.setCity(value);
                } else if (field === 'age') {
                    this.setAge(value);
                }
            }
        };
        
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                button.click();
            }
        };
        
        inputDiv.appendChild(input);
        inputDiv.appendChild(button);
        messagesContainer.appendChild(inputDiv);
        input.focus();
        this.scrollToBottom();
    },
    
    scrollToBottom() {
        setTimeout(() => {
            const container = document.getElementById('testChatMessages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    },
    
    // ============================================
    // ЛОГИКА ТЕСТА
    // ============================================
    
    getCurrentQuestions() {
        const stage = this.stages[this.currentStage];
        
        if (stage.id === 'perception') return this.perception_questions;
        if (stage.id === 'thinking') {
            const isExternal = this.perceptionType === "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ" || 
                               this.perceptionType === "СТАТУСНО-ОРИЕНТИРОВАННЫЙ";
            return isExternal ? this.thinking_questions.external : this.thinking_questions.internal;
        }
        if (stage.id === 'behavior') return this.behavior_questions;
        if (stage.id === 'growth') return this.growth_questions;
        if (stage.id === 'deep') return this.deep_questions;
        return [];
    },
    
    sendStageIntro() {
        if (this.currentStage >= this.stages.length) {
            this.showFinalProfile();
            return;
        }
        
        const stage = this.stages[this.currentStage];
        
        let text = `
🧠 <b>${stage.name}</b>

${stage.shortDesc}

<b>🔍 ЧТО МЫ ИССЛЕДУЕМ:</b><br>
${stage.longDesc}

<b>📊 Вопросов:</b> ${stage.total}
<b>⏱ Время:</b> ~${stage.id === 'thinking' ? '3-4' : '3'} минуты

👇 <b>НАЧИНАЕМ?</b>
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "▶️ НАЧАТЬ ЭТАП", callback: () => this.sendNextQuestion() },
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(this.currentStage) }
        ]);
    },
    
    sendNextQuestion() {
        if (this.currentStage >= this.stages.length) {
            this.showFinalProfile();
            return;
        }
        
        const stage = this.stages[this.currentStage];
        const questions = this.getCurrentQuestions();
        
        if (this.currentQuestionIndex >= stage.total) {
            this.completeCurrentStage();
            return;
        }
        
        const q = questions[this.currentQuestionIndex];
        this.addQuestionMessage(
            q.text,
            q.options,
            (idx, opt) => this.handleAnswer(stage.id, q, idx, opt),
            this.currentQuestionIndex + 1,
            stage.total
        );
    },
    
    handleAnswer(stageId, q, idx, opt) {
        this.answers.push({
            stage: stageId,
            questionIndex: this.currentQuestionIndex,
            questionId: q.id,
            question: q.text,
            answer: opt.text,
            option: idx,
            scores: opt.scores,
            level: opt.level,
            strategy: opt.strategy,
            dilts: opt.dilts,
            pattern: opt.pattern,
            target: q.target
        });
        
        // Этап 1: Восприятие
        if (stageId === 'perception' && opt.scores) {
            for (let axis in opt.scores) {
                this.perceptionScores[axis] += opt.scores[axis];
            }
        }
        
        // Этап 2: Мышление
        if (stageId === 'thinking' && opt.level) {
            this.thinkingScores[opt.level] = (this.thinkingScores[opt.level] || 0) + 1;
            if (q.measures && q.measures !== 'thinking') {
                this.strategyLevels[q.measures].push(opt.level);
            }
        }
        
        // Этап 3: Поведение
        if (stageId === 'behavior' && opt.level) {
            this.stage3Scores.push(opt.level);
            if (opt.strategy) {
                this.behavioralLevels[opt.strategy].push(opt.level);
            }
        }
        
        // Этап 4: Точка роста
        if (stageId === 'growth' && opt.dilts) {
            this.diltsCounts[opt.dilts] = (this.diltsCounts[opt.dilts] || 0) + 1;
        }
        
        // Этап 5: Глубинные паттерны
        if (stageId === 'deep') {
            this.deepAnswers.push({
                questionId: q.id,
                pattern: opt.pattern,
                target: q.target
            });
        }
        
        this.saveProgress();
        this.currentQuestionIndex++;
        setTimeout(() => this.sendNextQuestion(), 800);
    },
    
    completeCurrentStage() {
        const stage = this.stages[this.currentStage];
        
        if (stage.id === 'perception') {
            this.perceptionType = this.determinePerceptionType();
            const isExternal = this.perceptionType.includes("СОЦИАЛЬНО") || this.perceptionType.includes("СТАТУСНО");
            const questions = isExternal ? this.thinking_questions.external : this.thinking_questions.internal;
            this.stages[1].total = questions.length;
            this.showStage1Result();
            
        } else if (stage.id === 'thinking') {
            this.thinkingLevel = this.calculateThinkingLevel();
            this.showStage2Result();
            
        } else if (stage.id === 'behavior') {
            this.showStage3Result();
            
        } else if (stage.id === 'growth') {
            this.profileData = this.calculateFinalProfile();
            this.showStage4Result();
            
        } else if (stage.id === 'deep') {
            this.deepPatterns = this.analyzeDeepPatterns();
            this.showStage5Result();
        }
    },
    
    showStage1Result() {
        const interpretation = this.getStage1Interpretation();
        
        const text = `
✨ <b>РЕЗУЛЬТАТ ЭТАПА 1</b>

Ваш тип восприятия: <b>${this.perceptionType}</b>

${interpretation}

<b>▶️ ЧТО ДАЛЬШЕ?</b>

<b>Этап 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ</b>

Мы узнали, как вы воспринимаете мир. Теперь исследуем, как вы обрабатываете информацию.

<b>📊 Вопросов:</b> ${this.stages[1].total}
<b>⏱ Время:</b> ~3-4 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(0) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 2", callback: () => this.goToNextStage() }
        ]);
    },
    
    showStage2Result() {
        const interpretation = this.getStage2Interpretation();
        
        const text = `
✨ <b>РЕЗУЛЬТАТ ЭТАПА 2</b>

Уровень мышления: <b>${this.thinkingLevel}/9</b>

${interpretation}

<b>▶️ ЧТО ДАЛЬШЕ?</b>

<b>Этап 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ</b>

Теперь посмотрим, как вы действуете на автомате.

<b>📊 Вопросов:</b> 8
<b>⏱ Время:</b> ~3 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(1) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 3", callback: () => this.goToNextStage() }
        ]);
    },
    
    showStage3Result() {
        const interpretation = this.getStage3Interpretation();
        const finalLevel = this.calculateFinalLevel();
        
        const sbAvg = this.behavioralLevels["СБ"].length 
            ? Math.round(this.behavioralLevels["СБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["СБ"].length) 
            : 3;
        const tfAvg = this.behavioralLevels["ТФ"].length 
            ? Math.round(this.behavioralLevels["ТФ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ТФ"].length) 
            : 3;
        const ubAvg = this.behavioralLevels["УБ"].length 
            ? Math.round(this.behavioralLevels["УБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["УБ"].length) 
            : 3;
        const chvAvg = this.behavioralLevels["ЧВ"].length 
            ? Math.round(this.behavioralLevels["ЧВ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ЧВ"].length) 
            : 3;
        
        const text = `
✨ <b>РЕЗУЛЬТАТ ЭТАПА 3</b>

Ваши поведенческие уровни:
• Реакция на давление (СБ): <b>${sbAvg}/6</b>
• Отношение к деньгам (ТФ): <b>${tfAvg}/6</b>
• Понимание мира (УБ): <b>${ubAvg}/6</b>
• Отношения с людьми (ЧВ): <b>${chvAvg}/6</b>

Финальный уровень: <b>${finalLevel}/9</b>

${interpretation}

<b>▶️ ЧТО ДАЛЬШЕ?</b>

<b>Этап 4: ТОЧКА РОСТА</b>

Найдем, где находится рычаг изменений.

<b>📊 Вопросов:</b> 8
<b>⏱ Время:</b> ~3 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(2) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 4", callback: () => this.goToNextStage() }
        ]);
    },
    
    showStage4Result() {
        const profile = this.calculateFinalProfile();
        
        const sbDesc = {
            1: "Под давлением замираете", 2: "Избегаете конфликтов", 3: "Внешне соглашаетесь",
            4: "Внешне спокойны", 5: "Умеете защищать", 6: "Защищаете и используете силу"
        }[profile.sbLevel] || "Информация уточняется";
        
        const tfDesc = {
            1: "Деньги как повезёт", 2: "Ищете возможности с нуля", 3: "Зарабатываете трудом",
            4: "Хорошо зарабатываете", 5: "Создаёте системы дохода", 6: "Управляете капиталом"
        }[profile.tfLevel] || "Информация уточняется";
        
        const ubDesc = {
            1: "Не думаете о сложном", 2: "Верите в знаки", 3: "Доверяете экспертам",
            4: "Ищете заговоры", 5: "Анализируете факты", 6: "Строите теории"
        }[profile.ubLevel] || "Информация уточняется";
        
        const chvDesc = {
            1: "Сильно привязываетесь", 2: "Подстраиваетесь", 3: "Хотите нравиться",
            4: "Умеете влиять", 5: "Строите равные отношения", 6: "Создаёте сообщества"
        }[profile.chvLevel] || "Информация уточняется";
        
        const attentionDesc = profile.perceptionType.includes("СОЦИАЛЬНО") || profile.perceptionType.includes("СТАТУСНО")
            ? "Для вас важно, что думают другие, вы чутко считываете настроение и ожидания окружающих."
            : "Для вас важнее ваши внутренние ощущения и чувства, чем мнение других.";
        
        const thinkingDesc = profile.thinkingLevel <= 3 
            ? "Вы хорошо видите отдельные ситуации, но не всегда замечаете общие закономерности."
            : profile.thinkingLevel <= 6
            ? "Вы замечаете закономерности, но не всегда видите, к чему они приведут в будущем."
            : "Вы видите общие законы и можете предсказывать развитие ситуаций.";
        
        const growthMap = {
            "ENVIRONMENT": "Посмотрите вокруг — может, дело в обстоятельствах?",
            "BEHAVIOR": "Попробуйте делать хоть что-то по-другому — маленькие шаги многое меняют.",
            "CAPABILITIES": "Развивайте новые навыки — они откроют новые возможности.",
            "VALUES": "Поймите, что для вас действительно важно — это изменит всё.",
            "IDENTITY": "Ответьте себе на вопрос «кто я?» — в этом ключ к изменениям."
        };
        
        const confidence = 0.7;
        const confidenceBar = "█".repeat(Math.floor(confidence * 10)) + "░".repeat(10 - Math.floor(confidence * 10));
        
        const text = `
🧠 <b>ПРЕДВАРИТЕЛЬНЫЙ ПОРТРЕТ</b>

${attentionDesc}

${thinkingDesc}

📊 <b>ТВОИ ВЕКТОРЫ:</b>

• <b>Реакция на давление (СБ ${profile.sbLevel}/6):</b> ${sbDesc}

• <b>Отношение к деньгам (ТФ ${profile.tfLevel}/6):</b> ${tfDesc}

• <b>Понимание мира (УБ ${profile.ubLevel}/6):</b> ${ubDesc}

• <b>Отношения с людьми (ЧВ ${profile.chvLevel}/6):</b> ${chvDesc}

🎯 <b>Точка роста:</b> ${growthMap[profile.dominantDilts] || "Начните с малого — и увидите, куда приведёт."}

📊 <b>Уверенность:</b> ${confidenceBar} ${Math.floor(confidence * 100)}%

👇 <b>ЭТО ПОХОЖЕ НА ВАС?</b>
`;
        
        this.addMessageWithButtons(text, [
            { text: "✅ ДА", callback: () => this.profileConfirm() },
            { text: "❓ ЕСТЬ СОМНЕНИЯ", callback: () => this.profileDoubt() },
            { text: "🔄 НЕТ", callback: () => this.profileReject() }
        ]);
    },
    
    profileConfirm() {
        this.addBotMessage("✅ Отлично! Тогда исследуем глубину...", true);
        setTimeout(() => this.goToNextStage(), 1500);
    },
    
    profileDoubt() {
        const text = `
🔍 <b>ДАВАЙ УТОЧНИМ</b>

Что именно вам не подходит?
(можно выбрать несколько)

🎭 Про людей — я не так сильно завишу от чужого мнения
💰 Про деньги — у меня с ними по-другому
🔍 Про знаки — я вполне себе анализирую
🤝 Про отношения — я знаю, чего хочу
🛡 Про давление — я реагирую иначе

👇 Выберите и нажмите ДАЛЬШЕ
`;
        
        this.addMessageWithButtons(text, [
            { text: "🎭 Про людей", callback: () => this.toggleDiscrepancy("people") },
            { text: "💰 Про деньги", callback: () => this.toggleDiscrepancy("money") },
            { text: "🔍 Про знаки", callback: () => this.toggleDiscrepancy("signs") },
            { text: "🤝 Про отношения", callback: () => this.toggleDiscrepancy("relations") },
            { text: "🛡 Про давление", callback: () => this.toggleDiscrepancy("sb") },
            { text: "➡️ ДАЛЬШЕ", callback: () => this.clarifyNext() }
        ]);
    },
    
    toggleDiscrepancy(type) {
        if (this.discrepancies.includes(type)) {
            this.discrepancies = this.discrepancies.filter(d => d !== type);
        } else {
            this.discrepancies.push(type);
        }
        this.saveProgress();
    },
    
    clarifyNext() {
        if (this.discrepancies.length === 0) {
            alert("Выберите хотя бы одно расхождение!");
            return;
        }
        
        const questions = [
            { text: "Расскажите подробнее, что именно не так с описанием?", options: ["Я спокойнее", "Я агрессивнее", "Я вообще не такой"] }
        ];
        
        this.clarifyingQuestions = questions;
        this.clarifyingCurrent = 0;
        this.askClarifyingQuestion();
    },
    
    askClarifyingQuestion() {
        if (this.clarifyingCurrent >= this.clarifyingQuestions.length) {
            this.updateProfileWithClarifications();
            return;
        }
        
        const q = this.clarifyingQuestions[this.clarifyingCurrent];
        const text = `
🔍 <b>УТОЧНЯЮЩИЙ ВОПРОС ${this.clarifyingCurrent + 1}/${this.clarifyingQuestions.length}</b>

${q.text}
`;
        
        this.addMessageWithButtons(text, q.options.map((opt, i) => ({
            text: opt,
            callback: () => {
                this.clarifyingAnswers.push({ question: q.text, answer: opt });
                this.clarifyingCurrent++;
                this.askClarifyingQuestion();
            }
        })));
    },
    
    updateProfileWithClarifications() {
        this.clarificationIteration++;
        this.saveProgress();
        this.showStage4Result();
    },
    
    profileReject() {
        const anecdote = `
🧠 <b>ЧЕСТНОСТЬ - ЛУЧШАЯ ПОЛИТИКА</b>

Две подруги решили сходить на ипподром. Приходят, а там скачки, все ставки делают. Решили и они ставку сделать — вдруг повезёт? Одна другой и говорит: «Слушай, у тебя какой размер груди?». Вторая: «Второй… а у тебя?». Первая: «Третий… ну давай на пятую поставим — чтоб сумма была…».

Поставили на пятую, лошадь приходит первая, они счастливые прибегают домой с деньгами и мужьям рассказывают, как было дело.

На следующий день мужики тоже решили сходить на скачки — а вдруг им повезёт? Когда решали, на какую ставить, один говорит: «Ты сколько раз за ночь свою жену можешь удовлетворить?». Другой говорит: «Ну, три…». Первый: «А я четыре… ну давай на седьмую поставим».

Поставили на седьмую, первой пришла вторая.

Мужики переглянулись: «Не напиздили бы — выиграли…».

<b>Мораль:</b> Если врать в тесте — результат будет как у мужиков на скачках. Хотите попробовать еще раз?
`;
        
        this.addMessageWithButtons(anecdote, [
            { text: "🔄 ПРОЙТИ ТЕСТ ЕЩЕ РАЗ", callback: () => this.restartTest() },
            { text: "👋 ДОСВИДУЛИ", callback: () => this.goToChat() }
        ]);
        
        this.currentStage = 0;
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.perceptionScores = { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
        this.perceptionType = null;
        this.thinkingLevel = null;
        this.thinkingScores = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
        this.strategyLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.behavioralLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.stage3Scores = [];
        this.diltsCounts = { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
        this.deepAnswers = [];
        this.saveProgress();
    },
    
    restartTest() {
        this.start();
    },
    
    goToChat() {
        this.addBotMessage('👋 До свидания!\n\nБуду рад помочь, если решите вернуться.', true);
        setTimeout(() => {
            if (window.dashboard && window.dashboard.renderDashboard) {
                window.dashboard.renderDashboard();
            }
        }, 2000);
    },
    
    showStage5Result() {
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        const interpretation = this.getStage5Interpretation();
        
        const text = `
✨ <b>РЕЗУЛЬТАТ ЭТАПА 5</b>

${interpretation}

✅ <b>ТЕСТ ЗАВЕРШЕН!</b>

🧠 Собираю воедино результаты 5 этапов...
`;
        
        this.addBotMessage(text, true);
        this.sendTestResultsToServer();
    },
    
    async sendTestResultsToServer() {
        if (!this.userId) {
            console.warn('⚠️ Нет user_id, результаты сохранены локально');
            this.showFinalProfileButtons();
            return;
        }
        
        const profile = this.calculateFinalProfile();
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        
        const results = {
            user_id: parseInt(this.userId),
            context: this.context,
            results: {
                perception_type: this.perceptionType,
                thinking_level: this.thinkingLevel,
                behavioral_levels: this.behavioralLevels,
                dilts_counts: this.diltsCounts,
                deep_patterns: deep,
                profile_data: profile,
                all_answers: this.answers,
                test_completed: true,
                test_completed_at: new Date().toISOString()
            }
        };
        
        console.log('📤 Отправка результатов на сервер...', { userId: parseInt(this.userId) });
        
        try {
            const response = await fetch('/api/save-test-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Результаты теста успешно отправлены на сервер');
            } else {
                console.error('❌ Ошибка при отправке:', data.error);
            }
        } catch (error) {
            console.error('❌ Ошибка сети:', error);
        }
        
        this.showFinalProfileButtons();
    },
    
    showFinalProfileButtons() {
        const profile = this.calculateFinalProfile();
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        
        const sbDesc = {
            1: "Под давлением замираете", 2: "Избегаете конфликтов", 3: "Внешне соглашаетесь",
            4: "Внешне спокойны", 5: "Умеете защищать", 6: "Защищаете и используете силу"
        }[profile.sbLevel] || "Информация уточняется";
        
        const tfDesc = {
            1: "Деньги как повезёт", 2: "Ищете возможности с нуля", 3: "Зарабатываете трудом",
            4: "Хорошо зарабатываете", 5: "Создаёте системы дохода", 6: "Управляете капиталом"
        }[profile.tfLevel] || "Информация уточняется";
        
        const ubDesc = {
            1: "Не думаете о сложном", 2: "Верите в знаки", 3: "Доверяете экспертам",
            4: "Ищете заговоры", 5: "Анализируете факты", 6: "Строите теории"
        }[profile.ubLevel] || "Информация уточняется";
        
        const chvDesc = {
            1: "Сильно привязываетесь", 2: "Подстраиваетесь", 3: "Хотите нравиться",
            4: "Умеете влиять", 5: "Строите равные отношения", 6: "Создаёте сообщества"
        }[profile.chvLevel] || "Информация уточняется";
        
        const text = `
🧠 <b>ВАШ ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ</b>

<b>Профиль:</b> ${profile.displayName}
<b>Тип восприятия:</b> ${profile.perceptionType}
<b>Уровень мышления:</b> ${profile.thinkingLevel}/9

📊 <b>ТВОИ ВЕКТОРЫ:</b>

• <b>Реакция на давление (СБ ${profile.sbLevel}/6):</b> ${sbDesc}

• <b>Отношение к деньгам (ТФ ${profile.tfLevel}/6):</b> ${tfDesc}

• <b>Понимание мира (УБ ${profile.ubLevel}/6):</b> ${ubDesc}

• <b>Отношения с людьми (ЧВ ${profile.chvLevel}/6):</b> ${chvDesc}

🧠 <b>Глубинный паттерн:</b> ${deep.attachment}

👇 <b>Что дальше?</b>
`;
        
        this.addMessageWithButtons(text, [
            { text: "🧠 МЫСЛИ ПСИХОЛОГА", callback: () => this.showPsychologistThought() },
            { text: "🎯 ВЫБРАТЬ ЦЕЛЬ", callback: () => this.showGoals() },
            { text: "⚙️ ВЫБРАТЬ РЕЖИМ", callback: () => this.showModes() }
        ]);
        
        if (this.userId) {
            localStorage.setItem(`test_results_${this.userId}`, JSON.stringify({
                profile,
                deepPatterns: deep,
                perceptionType: this.perceptionType,
                thinkingLevel: this.thinkingLevel,
                context: this.context
            }));
        }
    },
    
    goToNextStage() {
        this.currentStage++;
        this.currentQuestionIndex = 0;
        this.sendStageIntro();
    },
    
    showFinalProfile() {
        this.showFinalProfileButtons();
    },
    
    showPsychologistThought() {
        if (window.dashboard && window.dashboard.renderPsychologistThoughtScreen) {
            window.dashboard.renderPsychologistThoughtScreen();
        } else if (App && App.showPsychologistThought) {
            App.showPsychologistThought();
        } else {
            this.addBotMessage("🧠 Мысли психолога будут доступны в личном кабинете.", true);
        }
    },
    
    showGoals() {
        if (window.dashboard && window.dashboard.renderGoalsScreen) {
            window.dashboard.renderGoalsScreen();
        } else if (App && App.showDynamicDestinations) {
            App.showDynamicDestinations();
        } else {
            this.addBotMessage("🎯 Выбор целей будет доступен в личном кабинете.", true);
        }
    },
    
    showModes() {
        if (window.dashboard && window.dashboard.renderModeSelectionScreen) {
            window.dashboard.renderModeSelectionScreen();
        } else if (App && App.showModeSelection) {
            App.showModeSelection();
        } else {
            this.addBotMessage("⚙️ Выбор режима будет доступен в личном кабинете.", true);
        }
    }
};

// Глобальный экспорт
window.Test = Test;

console.log('✅ Модуль теста загружен (версия 4.0 - с контекстом, деталями и жирным текстом)');
