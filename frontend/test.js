// ============================================
// ПОЛНЫЙ ТЕСТ ИЗ 5 ЭТАПОВ
// Версия 4.5 - МОБИЛЬНАЯ ОПТИМИЗАЦИЯ + ИСПРАВЛЕННЫЕ ПРОБЛЕМЫ С ВЫСОТОЙ
// ============================================

// ============================================
// КОНСТАНТЫ API
// ============================================
const TEST_API_BASE_URL = 'https://fredi-backend-flz2.onrender.com';

const Test = {
    // ============================================
    // СОСТОЯНИЕ ТЕСТА
    // ============================================
    currentStage: 0,
    currentQuestionIndex: 0,
    userId: null,
    answers: [],
    showIntro: true,
    
    // Контекст пользователя
    context: {
        city: null,
        gender: null,
        age: null,
        weather: null,
        isComplete: false,
        name: null
    },
    
    // Данные для расчетов
    perceptionScores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 },
    perceptionType: null,
    thinkingLevel: null,
    thinkingScores: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 },
    strategyLevels: { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] },
    behavioralLevels: { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] },
    stage3Scores: [],
    diltsCounts: { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 },
    deepAnswers: [],
    deepPatterns: null,
    profileData: null,
    
    // Уточнения
    clarificationIteration: 0,
    discrepancies: [],
    clarifyingAnswers: [],
    clarifyingQuestions: [],
    clarifyingCurrent: 0,
    
    // Кэш для AI-профиля
    aiGeneratedProfile: null,
    psychologistThought: null,
    
    // ============================================
    // СТРУКТУРА ЭТАПОВ
    // ============================================
    stages: [
        { 
            id: 'perception', 
            number: 1,
            name: 'КОНФИГУРАЦИЯ ВОСПРИЯТИЯ',
            shortDesc: 'Линза, через которую вы смотрите на мир',
            detailedDesc: `🔍 ЧТО МЫ ИССЛЕДУЕМ:

• Куда направлено ваше внимание — вовне или внутрь
• Какая тревога доминирует — страх отвержения или страх потери контроля

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        { 
            id: 'thinking', 
            number: 2,
            name: 'КОНФИГУРАЦИЯ МЫШЛЕНИЯ',
            shortDesc: 'Как вы обрабатываете информацию',
            detailedDesc: `🎯 САМОЕ ВАЖНОЕ:

Конфигурация мышления — это траектория с чётким пунктом назначения: результат, к которому вы придёте. Если ничего не менять — вы попадёте именно туда.

📊 Вопросов: 4-5
⏱ Время: ~3-4 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: null
        },
        { 
            id: 'behavior', 
            number: 3,
            name: 'КОНФИГУРАЦИЯ ПОВЕДЕНИЯ',
            shortDesc: 'Ваши автоматические реакции',
            detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Ваши автоматические реакции
• Как вы действуете в разных ситуациях
• Какие стратегии поведения закреплены

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        { 
            id: 'growth', 
            number: 4,
            name: 'ТОЧКА РОСТА',
            shortDesc: 'Где находится рычаг изменений',
            detailedDesc: `⚡ ЧТО МЫ НАЙДЁМ:

Где именно находится рычаг — место, где минимальное усилие даёт максимальные изменения.

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        { 
            id: 'deep', 
            number: 5,
            name: 'ГЛУБИННЫЕ ПАТТЕРНЫ',
            shortDesc: 'Тип привязанности, защитные механизмы',
            detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Какой у вас тип привязанности (из детства)
• Какие защитные механизмы вы используете
• Какие глубинные убеждения управляют вами
• Чего вы боитесь на самом деле

📊 Вопросов: 10
⏱ Время: ~5 минут

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 10
        }
    ],
    
    // ============================================
    // РАСШИРЕННЫЕ УТОЧНЯЮЩИЕ ВОПРОСЫ
    // ============================================
    clarifyingQuestionsDB: {
        "СБ": [
            { 
                level: 1, 
                text: "Ты сказал, что замираешь под давлением. Что происходит в этот момент?",
                options: { 
                    "1": "Пустота в голове, слова не идут",
                    "2": "Хочется убежать, спрятаться",
                    "3": "Внутри всё кипит, но не могу сказать",
                    "4": "Просто жду, когда всё закончится"
                }
            },
            { 
                level: 2, 
                text: "Ты избегаешь конфликтов. А что было в последний раз?",
                options: { 
                    "1": "Просто ушёл, не стал спорить",
                    "2": "Согласился, хотя не хотел",
                    "3": "Промолчал, сделал вид, что всё нормально",
                    "4": "Нашёл предлог, чтобы уйти"
                }
            },
            { 
                level: 3, 
                text: "Ты соглашаешься внешне, но внутри кипишь. Как часто это происходит?",
                options: { 
                    "1": "Постоянно, каждый день",
                    "2": "Часто, несколько раз в неделю",
                    "3": "Иногда, когда сильно давят",
                    "4": "Редко, стараюсь говорить прямо"
                }
            },
            { 
                level: 4, 
                text: "Ты внешне спокоен в конфликтах. А что ты чувствуешь внутри?",
                options: { 
                    "1": "Пустоту и отстранённость",
                    "2": "Злость и раздражение",
                    "3": "Страх и тревогу",
                    "4": "Ничего особенного, просто жду"
                }
            },
            { 
                level: 5, 
                text: "Ты пытаешься сгладить конфликт шуткой. Как люди реагируют?",
                options: { 
                    "1": "Смеются, напряжение уходит",
                    "2": "Не всегда понимают юмор",
                    "3": "Иногда обижаются",
                    "4": "Продолжают давить"
                }
            },
            { 
                level: 6, 
                text: "Ты умеешь защищать себя. Что помогает тебе сохранять спокойствие?",
                options: { 
                    "1": "Понимание, что конфликт не про меня",
                    "2": "Чёткое знание своих границ",
                    "3": "Уверенность в своей правоте",
                    "4": "Дыхательные техники"
                }
            }
        ],
        
        "ТФ": [
            { 
                level: 1, 
                text: "Ты зависишь от других в финансовых вопросах. Что мешает зарабатывать самому?",
                options: { 
                    "1": "Страх неудачи",
                    "2": "Не знаю, что умею",
                    "3": "Нет возможностей",
                    "4": "Лень и прокрастинация"
                }
            },
            { 
                level: 2, 
                text: "С деньгами 'как повезёт' — это про удачу или про отсутствие плана?",
                options: { 
                    "1": "Про удачу — верю в случай",
                    "2": "Про отсутствие плана — не умею планировать",
                    "3": "Про лень — не хочу заморачиваться",
                    "4": "Про страх — боюсь ошибиться"
                }
            },
            { 
                level: 3, 
                text: "Ты зарабатываешь трудом. Что тебя останавливает от увеличения дохода?",
                options: { 
                    "1": "Нет времени",
                    "2": "Нет энергии",
                    "3": "Не знаю, с чего начать",
                    "4": "Боюсь рисковать"
                }
            },
            { 
                level: 4, 
                text: "Ты хорошо зарабатываешь. Куда уходят деньги?",
                options: { 
                    "1": "На жизнь и базовые нужды",
                    "2": "На развлечения и удовольствия",
                    "3": "Откладываю, но медленно",
                    "4": "Инвестирую в развитие"
                }
            },
            { 
                level: 5, 
                text: "Ты создаёшь системы дохода. Что было самым сложным?",
                options: { 
                    "1": "Начать",
                    "2": "Найти команду",
                    "3": "Доверять другим",
                    "4": "Масштабировать"
                }
            }
        ],
        
        "УБ": [
            { 
                level: 1, 
                text: "Ты стараешься не думать о сложном. Что происходит, когда всё же думаешь?",
                options: { 
                    "1": "Тревога нарастает",
                    "2": "Голова идёт кругом",
                    "3": "Ничего не понимаю",
                    "4": "Становится ещё хуже"
                }
            },
            { 
                level: 2, 
                text: "Ты веришь в знаки и судьбу. А бывало, что твои предсказания не сбывались?",
                options: { 
                    "1": "Да, часто",
                    "2": "Иногда",
                    "3": "Редко",
                    "4": "Всегда сбываются"
                }
            },
            { 
                level: 3, 
                text: "Ты доверяешь экспертам. Что для тебя авторитет?",
                options: { 
                    "1": "Дипломы и регалии",
                    "2": "Опыт и практика",
                    "3": "Популярность и известность",
                    "4": "Своя интуиция"
                }
            },
            { 
                level: 4, 
                text: "Ты ищешь заговоры. Что даёт тебе это чувство?",
                options: { 
                    "1": "Ощущение контроля",
                    "2": "Объяснение хаоса",
                    "3": "Оправдание бездействия",
                    "4": "Чувство превосходства"
                }
            },
            { 
                level: 5, 
                text: "Ты анализируешь факты. Как проверяешь информацию?",
                options: { 
                    "1": "Сравниваю с другими источниками",
                    "2": "Проверяю на практике",
                    "3": "Спрашиваю у экспертов",
                    "4": "Доверяю своей логике"
                }
            }
        ],
        
        "ЧВ": [
            { 
                level: 1, 
                text: "Ты сильно привязываешься к людям. Что происходит, когда человек уходит?",
                options: { 
                    "1": "Мир рушится",
                    "2": "Долго переживаю",
                    "3": "Ищу замену сразу",
                    "4": "Закрываюсь от всех"
                }
            },
            { 
                level: 2, 
                text: "Ты подстраиваешься под других. А помнишь, когда в последний раз делал то, что хотел именно ты?",
                options: { 
                    "1": "Недавно",
                    "2": "Давно",
                    "3": "Очень давно",
                    "4": "Не помню такого"
                }
            },
            { 
                level: 3, 
                text: "Ты хочешь нравиться. Что для тебя важнее: быть собой или быть принятым?",
                options: { 
                    "1": "Быть принятым любой ценой",
                    "2": "Искать компромисс",
                    "3": "Быть собой, но мягко",
                    "4": "Быть собой, несмотря ни на что"
                }
            },
            { 
                level: 4, 
                text: "Ты умеешь влиять на людей. Как ты это делаешь?",
                options: { 
                    "1": "Убеждением",
                    "2": "Примером",
                    "3": "Манипуляцией",
                    "4": "Поддержкой и помощью"
                }
            },
            { 
                level: 5, 
                text: "Ты строишь равные отношения. Что для тебя важно в партнёре?",
                options: { 
                    "1": "Честность",
                    "2": "Взаимность",
                    "3": "Уважение",
                    "4": "Поддержка"
                }
            }
        ]
    },
    
    discrepancyQuestions: {
        "people": {
            text: "Ты сказал, что про людей не совсем точно. Расскажи подробнее:",
            options: {
                "1": "Я вообще не завишу от чужого мнения",
                "2": "Завишу, но меньше, чем описано",
                "3": "Мне всё равно, что думают другие",
                "4": "Другое"
            }
        },
        "money": {
            text: "С деньгами у тебя действительно проблемы? Какие именно?",
            options: {
                "1": "Не хватает на базовые нужды",
                "2": "Не могу накопить",
                "3": "Не знаю, как заработать больше",
                "4": "Боюсь вкладывать и рисковать"
            }
        },
        "signs": {
            text: "Про знаки и судьбу — ты считаешь, что анализируешь достаточно?",
            options: {
                "1": "Да, я всё анализирую",
                "2": "Анализирую, но могу и знаки заметить",
                "3": "Больше анализирую, чем верю в знаки",
                "4": "Другое"
            }
        },
        "relations": {
            text: "В отношениях ты уверен в себе? Расскажи:",
            options: {
                "1": "Знаю, чего хочу, и добиваюсь",
                "2": "Знаю, но боюсь проявлять",
                "3": "Не знаю, чего хочу",
                "4": "Мне всё равно"
            }
        }
    },
    
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
    // МОБИЛЬНАЯ ОПТИМИЗАЦИЯ
    // ============================================
    
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    optimizeMobileView() {
        if (!this.isMobile()) return;
        
        const container = document.getElementById('testChatContainer');
        if (!container) return;
        
        // 1. Добавляем meta viewport если нет
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';
        
        // 2. Фиксируем body для предотвращения скролла
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.bottom = '0';
        
        // 3. Используем visualViewport для динамической высоты
        const updateHeight = () => {
            const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            container.style.height = `${height}px`;
            container.style.minHeight = `${height}px`;
        };
        
        updateHeight();
        
        // 4. Слушаем изменения видимой области
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateHeight);
            window.visualViewport.addEventListener('scroll', updateHeight);
        }
        
        // 5. Принудительный скролл для Android
        setTimeout(() => {
            window.scrollTo(0, 1);
        }, 100);
        
        // 6. Блокируем скролл body, разрешаем только внутри чата
        container.addEventListener('touchmove', (e) => {
            const messages = document.getElementById('testChatMessages');
            if (messages && messages.contains(e.target)) {
                return; // разрешаем скролл внутри чата
            }
            e.preventDefault();
        }, { passive: false });
        
        console.log('📱 Мобильная оптимизация применена');
    },
    
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
            "🤗 Надежный": "У тебя надёжный тип привязанности — ты уверен в отношениях и не боишься близости.",
            "😥 Тревожный": "Тревожный тип привязанности: ты часто боишься, что тебя бросят, нуждаешься в подтверждениях любви.",
            "🛡️ Избегающий": "Избегающий тип привязанности: ты держишь дистанцию, боишься близости, надеясь только на себя.",
            "🏔️ Отстраненный": "Отстранённый тип: ты обесцениваешь отношения, считая, что лучше быть одному."
        };
        
        return `🔗 Тип привязанности:\n${attachmentDesc[deep.attachment] || attachmentDesc["🤗 Надежный"]}`;
    },
    
    // ============================================
    // ФУНКЦИИ ФОРМАТИРОВАНИЯ ПРОФИЛЯ
    // ============================================
    
    cleanTextForDisplay(text) {
        if (!text) return text;
        
        // Удаляем Markdown
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/__(.*?)__/g, '$1');
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/_(.*?)_/g, '$1');
        text = text.replace(/`(.*?)`/g, '$1');
        text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
        text = text.replace(/#{1,6}\s+/g, '');
        
        // Удаляем HTML теги
        text = text.replace(/<[^>]+>/g, '');
        
        // Убираем лишние пробелы
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/\n\s*\n/g, '\n\n');
        
        return text;
    },
    
    formatProfileText(text) {
        if (!text) return text;
        
        // Убираем Markdown
        text = this.cleanTextForDisplay(text);
        
        const headerMap = {
            'БЛОК 1:': '🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА',
            'БЛОК 2:': '💪 СИЛЬНЫЕ СТОРОНЫ',
            'БЛОК 3:': '🎯 ЗОНЫ РОСТА',
            'БЛОК 4:': '🌱 КАК ЭТО СФОРМИРОВАЛОСЬ',
            'БЛОК 5:': '⚠️ ГЛАВНАЯ ЛОВУШКА',
            'БЛОК1:': '🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА',
            'БЛОК2:': '💪 СИЛЬНЫЕ СТОРОНЫ',
            'БЛОК3:': '🎯 ЗОНЫ РОСТА',
            'БЛОК4:': '🌱 КАК ЭТО СФОРМИРОВАЛОСЬ',
            'БЛОК5:': '⚠️ ГЛАВНАЯ ЛОВУШКА'
        };
        
        // Заменяем заголовки на жирные с эмодзи
        for (const [oldHeader, newHeader] of Object.entries(headerMap)) {
            const regex = new RegExp(oldHeader, 'gi');
            text = text.replace(regex, `<b>${newHeader}</b>`);
        }
        
        // Убираем дублирование заголовков
        const headers = Object.values(headerMap);
        for (const header of headers) {
            const pattern = new RegExp(`<b>${header}</b>\\s*\\n\\s*<b>${header}</b>`, 'gi');
            text = text.replace(pattern, `<b>${header}</b>`);
        }
        
        // Форматируем списки
        text = text.replace(/•\s*/g, '<br>• ');
        text = text.replace(/-\s*/g, '<br>• ');
        
        // Добавляем отступы
        text = text.replace(/\n\n/g, '<br><br>');
        text = text.replace(/\n/g, '<br>');
        
        return text;
    },
    
    // ============================================
    // ФУНКЦИИ ДЛЯ УТОЧНЯЮЩИХ ВОПРОСОВ
    // ============================================
    
    getClarifyingQuestions(discrepancies, currentLevels) {
        const questions = [];
        
        // Векторные расхождения (СБ, ТФ, УБ, ЧВ)
        for (const vector of ["СБ", "ТФ", "УБ", "ЧВ"]) {
            if (discrepancies.includes(vector)) {
                const level = Math.round(currentLevels[vector] || 3);
                const vectorQuestions = this.clarifyingQuestionsDB[vector] || [];
                
                // Ищем вопрос для конкретного уровня
                const matchingQuestion = vectorQuestions.find(q => q.level === level);
                if (matchingQuestion) {
                    questions.push({
                        type: "vector",
                        vector: vector,
                        text: matchingQuestion.text,
                        options: matchingQuestion.options
                    });
                } else {
                    // Если нет точного совпадения, берём ближайший
                    const nearest = vectorQuestions.reduce((prev, curr) => {
                        return Math.abs(curr.level - level) < Math.abs(prev.level - level) ? curr : prev;
                    }, vectorQuestions[0]);
                    
                    if (nearest) {
                        questions.push({
                            type: "vector",
                            vector: vector,
                            text: nearest.text,
                            options: nearest.options
                        });
                    }
                }
            }
        }
        
        // Общие расхождения (people, money, signs, relations)
        const generalDiscrepancies = ["people", "money", "signs", "relations"];
        for (const disc of discrepancies) {
            if (generalDiscrepancies.includes(disc) && this.discrepancyQuestions[disc]) {
                questions.push({
                    type: "discrepancy",
                    target: disc,
                    text: this.discrepancyQuestions[disc].text,
                    options: this.discrepancyQuestions[disc].options
                });
            }
        }
        
        // Убираем дубликаты по тексту вопроса
        const uniqueQuestions = [];
        const questionTexts = new Set();
        
        for (const q of questions) {
            if (!questionTexts.has(q.text)) {
                questionTexts.add(q.text);
                uniqueQuestions.push(q);
            }
        }
        
        return uniqueQuestions.slice(0, 5);
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
        this.aiGeneratedProfile = null;
        this.psychologistThought = null;
        this.context = {
            city: null,
            gender: null,
            age: null,
            weather: null,
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
                this.context = data.context || { city: null, gender: null, age: null, weather: null, isComplete: false, name: null };
                
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
            if (this.context.isComplete) {
                this.addBotMessage('🧠 ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ\n\nПривет! Я помню тебя. Хочешь пройти тест заново?');
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
        
        // Мобильная оптимизация
        setTimeout(() => {
            this.optimizeMobileView();
        }, 100);
        
        this.scrollToBottom();
    },
    
    // ============================================
    // ЭКРАН ЗНАКОМСТВА
    // ============================================
    
    showIntroScreen() {
        const text = `
🧠 ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ

Привет! 👋

Я — Фреди, виртуальный психолог.
Оцифрованная версия Андрея Мейстера.

🕒 Нам нужно познакомиться, чтобы я понимал,
   с кем имею дело и чем могу быть полезен.

📊 5 ЭТАПОВ ТЕСТИРОВАНИЯ:

1️⃣ КОНФИГУРАЦИЯ ВОСПРИЯТИЯ
   Линза, через которую вы смотрите на мир

2️⃣ КОНФИГУРАЦИЯ МЫШЛЕНИЯ
   Как вы обрабатываете информацию

3️⃣ КОНФИГУРАЦИЯ ПОВЕДЕНИЯ
   Ваши автоматические реакции

4️⃣ ТОЧКА РОСТА
   Где находится рычаг изменений

5️⃣ ГЛУБИННЫЕ ПАТТЕРНЫ
   Тип привязанности, защитные механизмы

⏱ 15 минут — и я буду знать о вас больше,
   чем вы думаете.

👇 СНАЧАЛА НУЖНО НЕМНОГО УЗНАТЬ О ВАС
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ЗНАКОМСТВО", callback: () => this.startContextCollection() },
            { text: "🤨 А ТЫ ВООБЩЕ КТО ТАКОЙ?", callback: () => this.showBotInfo() }
        ]);
    },
    
    // ============================================
    // ИНФОРМАЦИЯ О БОТЕ
    // ============================================
    
    showBotInfo() {
        const text = `
🎭 Ну, вопрос хороший. Давайте по существу.

Видите ли, дорогой человек, я — экспериментальная модель.
Андрей Мейстер однажды подумал: "А что, если я создам свою цифровую копию?
Пусть работает, пока я сплю, ем или просто ленюсь".

Так я и появился. 🧠

🧐 Что я умею:

• Вижу паттерны там, где вы видите просто день сурка
• Нахожу систему в ваших "случайных" решениях
• Понимаю, почему вы выбираете одних и тех же "не тех" людей
• Я реально беспристрастен — у меня нет плохого настроения

🎯 Конкретно по тесту:

1️⃣ Восприятие — поймём, какую линзу вы носите
2️⃣ Мышление — узнаем, как вы пережёвываете реальность
3️⃣ Поведение — посмотрим, что вы делаете "на автомате"
4️⃣ Точка роста — я скажу, куда вам двигаться
5️⃣ Глубинные паттерны — заглянем в детство и подсознание

⏱ 15 минут — и я составлю ваш профиль.

👌 Погнали?
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "👌 ПОГНАЛИ!", callback: () => this.startContextCollection() }
        ]);
    },
    
    // ============================================
    // ЧТО ДАЕТ ТЕСТ
    // ============================================
    
    showTestBenefits() {
        const text = `
🔍 ЧТО ВЫ УЗНАЕТЕ О СЕБЕ:

🧠 ЭТАП 1: КОНФИГУРАЦИЯ ВОСПРИЯТИЯ
Линза, через которую вы смотрите на мир.

🧠 ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ
Как вы обрабатываете информацию.

🧠 ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ
Ваши автоматические реакции.

🧠 ЭТАП 4: ТОЧКА РОСТА
Где находится рычаг изменений.

🧠 ЭТАП 5: ГЛУБИННЫЕ ПАТТЕРНЫ
Тип привязанности, защитные механизмы, базовые убеждения.

⚡ ПОСЛЕ ТЕСТА ВЫ ПОЛУЧИТЕ:

✅ Полный психологический портрет
✅ Глубинный анализ подсознательных паттернов
✅ Выбор стиля общения: 🔮 КОУЧ | 🧠 ПСИХОЛОГ | ⚡ ТРЕНЕР
✅ Индивидуальный навигатор по целям

⏱ Всего 15 минут
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
            { text: "◀️ НАЗАД", callback: () => this.showContextComplete() }
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
📝 ДАВАЙТЕ ПОЗНАКОМИМСЯ

🏙️ В каком городе вы живете?
`;
        
        this.addBotMessage(text, true);
        this.showTextInput("city", "📍 Напишите город...", true);
    },
    
    askGender() {
        const text = `
📍 Город сохранен: ${this.context.city}

${this.context.weather ? `🌡️ Погода: ${this.context.weather.icon} ${this.context.weather.description}, ${this.context.weather.temp}°C` : ''}

👤 Теперь скажите, ваш пол
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "👨 МУЖСКОЙ", callback: () => this.setGender("male") },
            { text: "👩 ЖЕНСКИЙ", callback: () => this.setGender("female") },
            { text: "⏭ ПРОПУСТИТЬ", callback: () => this.skipGender() }
        ]);
    },
    
    askAge() {
        const text = `
📅 Сколько вам лет?
`;
        
        this.addBotMessage(text, true);
        this.showTextInput("age", "📅 Напишите число от 1 до 120...", true);
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
        
        this.addBotMessage(`📍 Город сохранен: ${city}`, true);
        
        await this.saveContextToServer();
        
        const weather = await this.fetchWeatherFromServer();
        if (weather) {
            this.context.weather = weather;
            this.addBotMessage(`${weather.icon} Погода: ${weather.description}, ${weather.temp}°C`, true);
        }
        
        this.askGender();
    },
    
    async saveContextToServer() {
        if (!this.userId) return;
        
        try {
            await fetch(`${TEST_API_BASE_URL}/api/save-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(this.userId),
                    context: {
                        city: this.context.city,
                        gender: this.context.gender,
                        age: this.context.age
                    }
                })
            });
        } catch (error) {
            console.error('Ошибка сохранения контекста:', error);
        }
    },
    
    async fetchWeatherFromServer() {
        if (!this.userId || !this.context.city) return null;
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/weather/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.weather) {
                return {
                    temp: data.weather.temperature,
                    description: data.weather.description,
                    icon: data.weather.icon
                };
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения погоды:', error);
            return null;
        }
    },
    
    setAge(age) {
        const ageNum = parseInt(age);
        if (ageNum >= 1 && ageNum <= 120) {
            this.context.age = ageNum;
            this.saveContextToServer();
            this.showContextComplete();
        } else {
            this.addBotMessage("❌ Возраст должен быть от 1 до 120 лет. Попробуйте еще раз:", true);
            this.showTextInput("age", "📅 Напишите число от 1 до 120...", true);
        }
    },
    
    showContextComplete() {
        this.context.isComplete = true;
        this.saveProgress();
        
        const text = `
✅ ОТЛИЧНО! ТЕПЕРЬ Я ЗНАЮ О ВАС

📍 Город: ${this.context.city || 'не указан'}
👤 Пол: ${this.getGenderText()}
📅 Возраст: ${this.context.age || 'не указан'}
${this.context.weather ? `${this.context.weather.icon} Погода: ${this.context.weather.description}, ${this.context.weather.temp}°C` : ''}

🎯 Теперь я буду учитывать это в наших разговорах!

🧠 ЧТО ДАЛЬШЕ?

Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).
Он определит ваш психологический профиль по 4 векторам и глубинным паттернам.

👇 НАЧИНАЕМ?
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
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
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
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'default';
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
    
    showTextInput(field, placeholder, showSkip = false) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const inputDiv = document.createElement('div');
        inputDiv.className = 'test-message test-message-input';
        inputDiv.style.display = 'flex';
        inputDiv.style.gap = '8px';
        inputDiv.style.marginTop = '8px';
        inputDiv.style.flexWrap = 'wrap';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.flex = '1';
        input.style.padding = '10px';
        input.style.borderRadius = '20px';
        input.style.border = '1px solid rgba(255,107,59,0.3)';
        input.style.background = 'rgba(255,255,255,0.1)';
        input.style.color = 'white';
        input.style.fontSize = '16px';
        
        const button = document.createElement('button');
        button.textContent = '📤 ОТПРАВИТЬ';
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
        
        if (showSkip) {
            const skipButton = document.createElement('button');
            skipButton.textContent = '⏭ ПРОПУСТИТЬ';
            skipButton.style.padding = '10px 15px';
            skipButton.style.borderRadius = '20px';
            skipButton.style.border = '1px solid rgba(255,107,59,0.3)';
            skipButton.style.background = 'rgba(255,107,59,0.15)';
            skipButton.style.color = 'white';
            skipButton.style.cursor = 'pointer';
            
            skipButton.onclick = () => {
                this.addUserMessage('Пропустить');
                inputDiv.remove();
                if (field === 'city') {
                    this.askGender();
                } else if (field === 'age') {
                    this.showContextComplete();
                }
            };
            
            inputDiv.appendChild(skipButton);
        }
        
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
        
        const text = `
🧠 ${stage.name}

${stage.shortDesc}

${stage.detailedDesc}

👇 НАЧИНАЕМ?
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "▶️ НАЧАТЬ ЭТАП", callback: () => this.sendNextQuestion() },
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(this.currentStage) }
        ]);
    },
    
    showStageDetails(stageIndex) {
        const stage = this.stages[stageIndex];
        
        const text = `
🔍 ЭТАП ${stage.number}: ${stage.name}

${stage.detailedDesc}

👇 НАЧИНАЕМ?
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
        
        if (stageId === 'perception' && opt.scores) {
            for (let axis in opt.scores) {
                this.perceptionScores[axis] += opt.scores[axis];
            }
        }
        
        if (stageId === 'thinking' && opt.level) {
            this.thinkingScores[opt.level] = (this.thinkingScores[opt.level] || 0) + 1;
            if (q.measures && q.measures !== 'thinking') {
                this.strategyLevels[q.measures].push(opt.level);
            }
        }
        
        if (stageId === 'behavior' && opt.level) {
            this.stage3Scores.push(opt.level);
            if (opt.strategy) {
                this.behavioralLevels[opt.strategy].push(opt.level);
            }
        }
        
        if (stageId === 'growth' && opt.dilts) {
            this.diltsCounts[opt.dilts] = (this.diltsCounts[opt.dilts] || 0) + 1;
        }
        
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
✨ РЕЗУЛЬТАТ ЭТАПА 1

Ваш тип восприятия: ${this.perceptionType}

${interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ

Мы узнали, как вы воспринимаете мир. Теперь исследуем, как вы обрабатываете информацию.

📊 Вопросов: ${this.stages[1].total}
⏱ Время: ~3-4 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(0) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 2", callback: () => this.goToNextStage() }
        ]);
    },
    
    showStage2Result() {
        const interpretation = this.getStage2Interpretation();
        
        const text = `
✨ РЕЗУЛЬТАТ ЭТАПА 2

Уровень мышления: ${this.thinkingLevel}/9

${interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ

Теперь посмотрим, как вы действуете на автомате.

📊 Вопросов: 8
⏱ Время: ~3 минуты
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
✨ РЕЗУЛЬТАТ ЭТАПА 3

Ваши поведенческие уровни:
• Реакция на давление (СБ): ${sbAvg}/6
• Отношение к деньгам (ТФ): ${tfAvg}/6
• Понимание мира (УБ): ${ubAvg}/6
• Отношения с людьми (ЧВ): ${chvAvg}/6

Финальный уровень: ${finalLevel}/9

${interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 4: ТОЧКА РОСТА

Найдем, где находится рычаг изменений.

📊 Вопросов: 8
⏱ Время: ~3 минуты
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
🧠 ПРЕДВАРИТЕЛЬНЫЙ ПОРТРЕТ

${attentionDesc}

${thinkingDesc}

📊 ТВОИ ВЕКТОРЫ:

• Реакция на давление (СБ ${profile.sbLevel}/6): ${sbDesc}

• Отношение к деньгам (ТФ ${profile.tfLevel}/6): ${tfDesc}

• Понимание мира (УБ ${profile.ubLevel}/6): ${ubDesc}

• Отношения с людьми (ЧВ ${profile.chvLevel}/6): ${chvDesc}

🎯 Точка роста: ${growthMap[profile.dominantDilts] || "Начните с малого — и увидите, куда приведёт."}

📊 Уверенность: ${confidenceBar} ${Math.floor(confidence * 100)}%

👇 ЭТО ПОХОЖЕ НА ВАС?
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
🔍 ДАВАЙ УТОЧНИМ

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
        
        const currentLevels = {};
        for (const v of ["СБ", "ТФ", "УБ", "ЧВ"]) {
            const levels = this.behavioralLevels[v] || [];
            currentLevels[v] = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
        }
        
        const questions = this.getClarifyingQuestions(this.discrepancies, currentLevels);
        
        if (questions.length === 0) {
            alert("Нет уточняющих вопросов");
            return;
        }
        
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
🔍 УТОЧНЯЮЩИЙ ВОПРОС ${this.clarifyingCurrent + 1}/${this.clarifyingQuestions.length}

${q.text}
`;
        
        const options = Object.entries(q.options).map(([key, value]) => ({
            text: value,
            callback: () => {
                this.clarifyingAnswers.push({ question: q.text, answer: value, key: key, vector: q.vector, type: q.type });
                this.clarifyingCurrent++;
                this.askClarifyingQuestion();
            }
        }));
        
        options.push({
            text: "⏭ ПРОПУСТИТЬ",
            callback: () => {
                this.clarifyingCurrent++;
                this.askClarifyingQuestion();
            }
        });
        
        this.addMessageWithButtons(text, options);
    },
    
    updateProfileWithClarifications() {
        this.clarificationIteration++;
        this.saveProgress();
        this.showStage4Result();
    },
    
    profileReject() {
        const anecdote = `
🧠 ЧЕСТНОСТЬ - ЛУЧШАЯ ПОЛИТИКА

Две подруги решили сходить на ипподром. Приходят, а там скачки, все ставки делают. Решили и они ставку сделать — вдруг повезёт? Одна другой и говорит: «Слушай, у тебя какой размер груди?». Вторая: «Второй… а у тебя?». Первая: «Третий… ну давай на пятую поставим — чтоб сумма была…».

Поставили на пятую, лошадь приходит первая, они счастливые прибегают домой с деньгами и мужьям рассказывают, как было дело.

На следующий день мужики тоже решили сходить на скачки — а вдруг им повезёт? Когда решали, на какую ставить, один говорит: «Ты сколько раз за ночь свою жену можешь удовлетворить?». Другой говорит: «Ну, три…». Первый: «А я четыре… ну давай на седьмую поставим».

Поставили на седьмую, первой пришла вторая.

Мужики переглянулись: «Не напиздили бы — выиграли…».

Мораль: Если врать в тесте — результат будет как у мужиков на скачках. Хотите попробовать еще раз?
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
✨ РЕЗУЛЬТАТ ЭТАПА 5

${interpretation}

✅ ТЕСТ ЗАВЕРШЕН!

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
        const response = await fetch(`${TEST_API_BASE_URL}/api/save-test-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Результаты теста успешно отправлены на сервер');
            
            // Сохраняем полученный AI-профиль
            if (data.ai_profile) {
                this.aiGeneratedProfile = data.ai_profile;
                console.log('✅ AI-профиль получен сразу');
            }
            
            if (data.psychologist_thought) {
                this.psychologistThought = data.psychologist_thought;
                console.log('✅ Мысль психолога получена сразу');
            }
            
            // Показываем финальный экран
            this.showFinalProfileButtons();
            
        } else {
            console.error('❌ Ошибка при отправке:', data.error);
            this.showFinalProfileButtons();
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        this.showFinalProfileButtons();
    }
}
    
    async fetchAIGeneratedProfile() {
    // Этот метод больше не нужен, так как профиль приходит сразу
    // Но оставим как fallback
    if (!this.userId) return;
    
    try {
        console.log('📥 Запрос AI-профиля (fallback)...');
        const response = await fetch(`${TEST_API_BASE_URL}/api/generated-profile/${this.userId}`);
        const data = await response.json();
        
        if (data.success && data.ai_profile) {
            this.aiGeneratedProfile = data.ai_profile;
            console.log('✅ AI-профиль получен');
            this.showFinalProfileButtons();
        }
    } catch (error) {
        console.error('Ошибка получения AI-профиля:', error);
    }
}
    
    async showPsychologistThought() {
        if (this.psychologistThought) {
            const formattedThought = this.formatProfileText(this.psychologistThought);
            this.addBotMessage(`
🧠 МЫСЛИ ПСИХОЛОГА

${formattedThought}
`, true);
            return;
        }
        
        this.addBotMessage("🧠 Генерирую мысли психолога...", true);
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/psychologist-thought/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.thought) {
                this.psychologistThought = data.thought;
                const formattedThought = this.formatProfileText(data.thought);
                this.addBotMessage(`
🧠 МЫСЛИ ПСИХОЛОГА

${formattedThought}
`, true);
            } else {
                this.addBotMessage("🧠 Мысли психолога будут доступны через несколько секунд.", true);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.addBotMessage("🧠 Мысли психолога временно недоступны. Попробуйте позже.", true);
        }
        
        this.addMessageWithButtons("", [
            { text: "🎯 ВЫБРАТЬ ЦЕЛЬ", callback: () => this.showGoals() },
            { text: "⚙️ ВЫБРАТЬ РЕЖИМ", callback: () => this.showModes() }
        ]);
    },
    
    showGoals() {
        const text = `
🎯 ВЫБОР ЦЕЛЕЙ

На основе вашего профиля я подготовил рекомендации:

🔮 ПОДХОДЯЩИЕ НАПРАВЛЕНИЯ:

1️⃣ Работа с реакцией на давление
   • Научиться говорить "нет"
   • Защищать свои границы
   • Сохранять спокойствие в конфликтах

2️⃣ Развитие отношений
   • Строить здоровые партнёрства
   • Создавать поддерживающее окружение
   • Углублять существующие связи

3️⃣ Финансовая стратегия
   • Создать финансовую подушку
   • Найти дополнительные источники дохода
   • Освоить инвестиционные инструменты

👇 Выберите направление или напишите свою цель:
`;
        
        this.addMessageWithButtons(text, [
            { text: "🛡 ДАВЛЕНИЕ", callback: () => this.selectGoal("pressure") },
            { text: "🤝 ОТНОШЕНИЯ", callback: () => this.selectGoal("relations") },
            { text: "💰 ФИНАНСЫ", callback: () => this.selectGoal("money") },
            { text: "✏️ СВОЯ ЦЕЛЬ", callback: () => this.customGoal() },
            { text: "◀️ НАЗАД", callback: () => this.showFinalProfileButtons() }
        ]);
    },
    
    selectGoal(goalType) {
        const goalTexts = {
            "pressure": "Отлично! Работа с давлением — это важный шаг. \n\n📝 Задание на неделю: отслеживайте моменты, когда вы чувствуете давление, и пробуйте не реагировать сразу, а делать паузу на 3 секунды.\n\nЗаписывайте свои наблюдения и возвращайтесь, чтобы обсудить прогресс.",
            "relations": "Отношения — это зеркало. Чтобы улучшить их, начните с себя.\n\n📝 Задание на неделю: уделите внимание своим потребностям в общении. Задайте себе вопрос: 'Что я действительно хочу от этих отношений?'\n\nЗапишите ответы.",
            "money": "Финансы любят порядок.\n\n📝 Задание на неделю: запишите все свои доходы и расходы. Это первый шаг к осознанному управлению.\n\nПопробуйте найти одну статью расходов, которую можно оптимизировать."
        };
        
        this.addBotMessage(goalTexts[goalType], true);
        
        this.addMessageWithButtons("", [
            { text: "🎯 ДРУГАЯ ЦЕЛЬ", callback: () => this.showGoals() },
            { text: "🧠 К ПРОФИЛЮ", callback: () => this.showFinalProfileButtons() }
        ]);
    },
    
    customGoal() {
        this.addBotMessage("✏️ Напишите свою цель текстом или отправьте голосовое сообщение.\n\nЯ помогу разбить её на шаги.", true);
        this.showTextInput("custom_goal", "Напишите вашу цель...", false);
        
        const handleGoal = (value) => {
            this.addUserMessage(value);
            this.addBotMessage(`Отличная цель! 🎯\n\nДавайте разберём её на шаги:\n\n1️⃣ Сформулируйте конкретный результат\n2️⃣ Разбейте на микро-шаги\n3️⃣ Определите первый шаг на сегодня\n\nЧто скажете?`, true);
        };
        
        window._tempGoalHandler = handleGoal;
    },
    
    showModes() {
        const text = `
⚙️ ВЫБОР РЕЖИМА

Я могу общаться в разных стилях:

🔮 КОУЧ
Помогаю самому найти решения. Задаю вопросы, отражаю мысли, направляю.

🧠 ПСИХОЛОГ
Копаю вглубь, исследую паттерны, работаю с причинами.

⚡ ТРЕНЕР
Даю чёткие инструменты, упражнения, ставлю задачи.

👇 Какой режим выбрать?
`;
        
        this.addMessageWithButtons(text, [
            { text: "🔮 КОУЧ", callback: () => this.setMode("coach") },
            { text: "🧠 ПСИХОЛОГ", callback: () => this.setMode("psychologist") },
            { text: "⚡ ТРЕНЕР", callback: () => this.setMode("trainer") },
            { text: "◀️ НАЗАД", callback: () => this.showFinalProfileButtons() }
        ]);
    },
    
    async setMode(mode) {
        const modeTexts = {
            "coach": "Отлично! Теперь я буду работать в режиме КОУЧА. Буду задавать вопросы, помогать тебе самому находить ответы.",
            "psychologist": "Хорошо! Режим ПСИХОЛОГА активирован. Будем исследовать глубинные паттерны и причины.",
            "trainer": "Принято! Режим ТРЕНЕРА включён. Получишь чёткие инструкции и упражнения."
        };
        
        try {
            await fetch(`${TEST_API_BASE_URL}/api/save-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(this.userId),
                    mode: mode
                })
            });
        } catch (error) {
            console.error('Ошибка сохранения режима:', error);
        }
        
        if (this.userId) {
            localStorage.setItem(`mode_${this.userId}`, mode);
        }
        
        this.addBotMessage(modeTexts[mode], true);
        
        this.addMessageWithButtons("", [
            { text: "🎯 ВЫБРАТЬ ЦЕЛЬ", callback: () => this.showGoals() },
            { text: "🧠 К ПРОФИЛЮ", callback: () => this.showFinalProfileButtons() }
        ]);
    }
};

// Глобальный экспорт
window.Test = Test;

console.log('✅ Модуль теста загружен (версия 4.5 - мобильная оптимизация)');
