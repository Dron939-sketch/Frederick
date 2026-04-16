// ============================================
// ПОЛНЫЙ ТЕСТ ИЗ 5 ЭТАПОВ
// Версия 5.1 - С ПОГОДОЙ В КОНТЕКСТЕ
// ============================================

const TEST_API_BASE_URL = 'https://fredi-backend-flz2.onrender.com';

const Test = {

    // ============================================
    // СОСТОЯНИЕ
    // ============================================
    currentStage: 0,
    currentQuestionIndex: 0,
    userId: null,
    answers: [],
    showIntro: true,

    context: {
        city: null, gender: null, age: null,
        weather: null, isComplete: false, name: null
    },

    perceptionScores: { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 },
    perceptionType: null,
    thinkingLevel: null,
    thinkingScores: { "1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0 },
    strategyLevels: { "СБ":[],"ТФ":[],"УБ":[],"ЧВ":[] },
    behavioralLevels: { "СБ":[],"ТФ":[],"УБ":[],"ЧВ":[] },
    stage3Scores: [],
    diltsCounts: { "ENVIRONMENT":0,"BEHAVIOR":0,"CAPABILITIES":0,"VALUES":0,"IDENTITY":0 },
    deepAnswers: [],
    deepPatterns: null,
    profileData: null,

    clarificationIteration: 0,
    discrepancies: [],
    clarifyingAnswers: [],
    clarifyingQuestions: [],
    clarifyingCurrent: 0,

    aiGeneratedProfile: null,
    psychologistThought: null,

    // ============================================
    // ЭТАПЫ
    // ============================================
    stages: [
        {
            id: 'perception', number: 1,
            name: 'КОНФИГУРАЦИЯ ВОСПРИЯТИЯ',
            shortDesc: 'Линза, через которую вы смотрите на мир',
            detailedDesc: `🔍 ЧТО МЫ ИССЛЕДУЕМ:\n\n• Куда направлено ваше внимание — вовне или внутрь\n• Какая тревога доминирует — страх отвержения или страх потери контроля\n\n📊 Вопросов: 8\n⏱ Время: ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            extendedDesc: `🔬 **ПОЧЕМУ ЭТО ВАЖНО?**\n\nВосприятие — это базовая настройка вашей психики. Оно работает как фильтр:\n• **Внешнее внимание** — вы ориентируетесь на других, считываете настроение, ожидания\n• **Внутреннее внимание** — вы ориентируетесь на свои ощущения, чувства, интуицию\n\n**Доминирующая тревога** показывает, чего вы боитесь на глубинном уровне:\n• Страх отвержения — боитесь, что вас не примут, осудят, покинут\n• Страх потери контроля — боитесь хаоса, неопределённости, ошибок\n\n📊 **Вопросов:** 8\n⏱ **Время:** ~3 минуты\n\n💡 **Совет:** Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        {
            id: 'thinking', number: 2,
            name: 'КОНФИГУРАЦИЯ МЫШЛЕНИЯ',
            shortDesc: 'Как вы обрабатываете информацию',
            detailedDesc: `🎯 САМОЕ ВАЖНОЕ:\n\nКонфигурация мышления — это траектория с чётким пунктом назначения: результат, к которому вы придёте. Если ничего не менять — вы попадёте именно туда.\n\n📊 Вопросов: 4-5\n⏱ Время: ~3-4 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            extendedDesc: `🔬 **ПОЧЕМУ ЭТО ВАЖНО?**\n\nМышление определяет, какие решения вы принимаете и к каким результатам приходите.\n\n**Уровни мышления (от 1 до 9):**\n• **Уровни 1-3:** Конкретное мышление — вы видите отдельные ситуации\n• **Уровни 4-6:** Системное мышление — вы замечаете закономерности\n• **Уровни 7-9:** Стратегическое мышление — вы видите общие законы и прогнозируете\n\n📊 **Вопросов:** зависит от вашего типа восприятия (4-5)\n⏱ **Время:** ~3-4 минуты\n\n💡 **Совет:** Отвечайте честно — это поможет мне лучше понять вас.`,
            total: null
        },
        {
            id: 'behavior', number: 3,
            name: 'КОНФИГУРАЦИЯ ПОВЕДЕНИЯ',
            shortDesc: 'Ваши автоматические реакции',
            detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:\n\n• Ваши автоматические реакции\n• Как вы действуете в разных ситуациях\n• Какие стратегии поведения закреплены\n\n📊 Вопросов: 8\n⏱ Время: ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            extendedDesc: `🔬 **ПОЧЕМУ ЭТО ВАЖНО?**\n\nПоведение — это то, что видят другие люди. Это ваши автоматические реакции на разные ситуации.\n\n**Что мы измеряем:**\n\n**СБ (Реакция на давление):** от замирания до активной защиты\n**ТФ (Отношение к деньгам):** от «как повезёт» до управления капиталом\n**УБ (Понимание мира):** от суеверий до научного анализа\n**ЧВ (Отношения с людьми):** от сильной привязанности до равного партнёрства\n\n📊 **Вопросов:** 8\n⏱ **Время:** ~3 минуты\n\n💡 **Совет:** Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        {
            id: 'growth', number: 4,
            name: 'ТОЧКА РОСТА',
            shortDesc: 'Где находится рычаг изменений',
            detailedDesc: `⚡ ЧТО МЫ НАЙДЁМ:\n\nГде именно находится рычаг — место, где минимальное усилие даёт максимальные изменения.\n\n📊 Вопросов: 8\n⏱ Время: ~3 минуты\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            extendedDesc: `🔬 **ПОЧЕМУ ЭТО ВАЖНО?**\n\nПо пирамиде Роберта Дилтса, изменения на разных уровнях дают разный эффект:\n\n1. **Окружение** — где и с кем вы находитесь (самый слабый рычаг)\n2. **Поведение** — что вы делаете\n3. **Способности** — что вы умеете\n4. **Ценности и убеждения** — что для вас важно\n5. **Идентичность** — кто вы (самый сильный рычаг)\n\n📊 **Вопросов:** 8\n⏱ **Время:** ~3 минуты\n\n💡 **Совет:** Отвечайте честно — это поможет мне лучше понять вас.`,
            total: 8
        },
        {
            id: 'deep', number: 5,
            name: 'ГЛУБИННЫЕ ПАТТЕРНЫ',
            shortDesc: 'Тип привязанности, защитные механизмы',
            detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:\n\n• Какой у вас тип привязанности (из детства)\n• Какие защитные механизмы вы используете\n• Какие глубинные убеждения управляют вами\n• Чего вы боитесь на самом деле\n\n📊 Вопросов: 10\n⏱ Время: ~5 минут\n\n💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`,
            extendedDesc: `🔬 **ПОЧЕМУ ЭТО ВАЖНО?**\n\nГлубинные паттерны формируются в детстве и продолжают влиять на вас во взрослой жизни.\n\n**Тип привязанности:**\n• Надёжный — вы уверены в отношениях\n• Тревожный — боитесь, что вас бросят\n• Избегающий — держите дистанцию\n• Отстранённый — обесцениваете отношения\n\n**Защитные механизмы:**\n• Проекция, Рационализация, Отрицание, Регрессия\n\n**Глубинные убеждения:**\n• «Я недостаточно хорош», «Людям нельзя доверять», «Мир опасен», «Я должен быть идеальным»\n\n📊 **Вопросов:** 10\n⏱ **Время:** ~5 минут\n\n💡 **Совет:** Отвечайте честно — чем глубже вы готовы заглянуть, тем точнее будет результат.`,
            total: 10
        }
    ],

    // ============================================
    // УТОЧНЯЮЩИЕ ВОПРОСЫ
    // ============================================
    clarifyingQuestionsDB: {
        "СБ": [
            { level:1, text:"Ты сказал, что замираешь под давлением. Что происходит в этот момент?", options:{"1":"Пустота в голове, слова не идут","2":"Хочется убежать, спрятаться","3":"Внутри всё кипит, но не могу сказать","4":"Просто жду, когда всё закончится"} },
            { level:2, text:"Ты избегаешь конфликтов. А что было в последний раз?", options:{"1":"Просто ушёл, не стал спорить","2":"Согласился, хотя не хотел","3":"Промолчал, сделал вид, что всё нормально","4":"Нашёл предлог, чтобы уйти"} },
            { level:3, text:"Ты соглашаешься внешне, но внутри кипишь. Как часто это происходит?", options:{"1":"Постоянно, каждый день","2":"Часто, несколько раз в неделю","3":"Иногда, когда сильно давят","4":"Редко, стараюсь говорить прямо"} },
            { level:4, text:"Ты внешне спокоен в конфликтах. А что ты чувствуешь внутри?", options:{"1":"Пустоту и отстранённость","2":"Злость и раздражение","3":"Страх и тревогу","4":"Ничего особенного, просто жду"} },
            { level:5, text:"Ты пытаешься сгладить конфликт шуткой. Как люди реагируют?", options:{"1":"Смеются, напряжение уходит","2":"Не всегда понимают юмор","3":"Иногда обижаются","4":"Продолжают давить"} },
            { level:6, text:"Ты умеешь защищать себя. Что помогает тебе сохранять спокойствие?", options:{"1":"Понимание, что конфликт не про меня","2":"Чёткое знание своих границ","3":"Уверенность в своей правоте","4":"Дыхательные техники"} }
        ],
        "ТФ": [
            { level:1, text:"Ты зависишь от других в финансовых вопросах. Что мешает зарабатывать самому?", options:{"1":"Страх неудачи","2":"Не знаю, что умею","3":"Нет возможностей","4":"Лень и прокрастинация"} },
            { level:2, text:"С деньгами 'как повезёт' — это про удачу или про отсутствие плана?", options:{"1":"Про удачу — верю в случай","2":"Про отсутствие плана — не умею планировать","3":"Про лень — не хочу заморачиваться","4":"Про страх — боюсь ошибиться"} },
            { level:3, text:"Ты зарабатываешь трудом. Что тебя останавливает от увеличения дохода?", options:{"1":"Нет времени","2":"Нет энергии","3":"Не знаю, с чего начать","4":"Боюсь рисковать"} },
            { level:4, text:"Ты хорошо зарабатываешь. Куда уходят деньги?", options:{"1":"На жизнь и базовые нужды","2":"На развлечения и удовольствия","3":"Откладываю, но медленно","4":"Инвестирую в развитие"} },
            { level:5, text:"Ты создаёшь системы дохода. Что было самым сложным?", options:{"1":"Начать","2":"Найти команду","3":"Доверять другим","4":"Масштабировать"} }
        ],
        "УБ": [
            { level:1, text:"Ты стараешься не думать о сложном. Что происходит, когда всё же думаешь?", options:{"1":"Тревога нарастает","2":"Голова идёт кругом","3":"Ничего не понимаю","4":"Становится ещё хуже"} },
            { level:2, text:"Ты веришь в знаки и судьбу. А бывало, что твои предсказания не сбывались?", options:{"1":"Да, часто","2":"Иногда","3":"Редко","4":"Всегда сбываются"} },
            { level:3, text:"Ты доверяешь экспертам. Что для тебя авторитет?", options:{"1":"Дипломы и регалии","2":"Опыт и практика","3":"Популярность и известность","4":"Своя интуиция"} },
            { level:4, text:"Ты ищешь заговоры. Что даёт тебе это чувство?", options:{"1":"Ощущение контроля","2":"Объяснение хаоса","3":"Оправдание бездействия","4":"Чувство превосходства"} },
            { level:5, text:"Ты анализируешь факты. Как проверяешь информацию?", options:{"1":"Сравниваю с другими источниками","2":"Проверяю на практике","3":"Спрашиваю у экспертов","4":"Доверяю своей логике"} }
        ],
        "ЧВ": [
            { level:1, text:"Ты сильно привязываешься к людям. Что происходит, когда человек уходит?", options:{"1":"Мир рушится","2":"Долго переживаю","3":"Ищу замену сразу","4":"Закрываюсь от всех"} },
            { level:2, text:"Ты подстраиваешься под других. А помнишь, когда в последний раз делал то, что хотел именно ты?", options:{"1":"Недавно","2":"Давно","3":"Очень давно","4":"Не помню такого"} },
            { level:3, text:"Ты хочешь нравиться. Что для тебя важнее: быть собой или быть принятым?", options:{"1":"Быть принятым любой ценой","2":"Искать компромисс","3":"Быть собой, но мягко","4":"Быть собой, несмотря ни на что"} },
            { level:4, text:"Ты умеешь влиять на людей. Как ты это делаешь?", options:{"1":"Убеждением","2":"Примером","3":"Манипуляцией","4":"Поддержкой и помощью"} },
            { level:5, text:"Ты строишь равные отношения. Что для тебя важно в партнёре?", options:{"1":"Честность","2":"Взаимность","3":"Уважение","4":"Поддержка"} }
        ]
    },

    discrepancyQuestions: {
        "people":    { text:"Ты сказал, что про людей не совсем точно. Расскажи подробнее:", options:{"1":"Я вообще не завишу от чужого мнения","2":"Завишу, но меньше, чем описано","3":"Мне всё равно, что думают другие","4":"Другое"} },
        "money":     { text:"С деньгами у тебя действительно проблемы? Какие именно?", options:{"1":"Не хватает на базовые нужды","2":"Не могу накопить","3":"Не знаю, как заработать больше","4":"Боюсь вкладывать и рисковать"} },
        "signs":     { text:"Про знаки и судьбу — ты считаешь, что анализируешь достаточно?", options:{"1":"Да, я всё анализирую","2":"Анализирую, но могу и знаки заметить","3":"Больше анализирую, чем верю в знаки","4":"Другое"} },
        "relations": { text:"В отношениях ты уверен в себе? Расскажи:", options:{"1":"Знаю, чего хочу, и добиваюсь","2":"Знаю, но боюсь проявлять","3":"Не знаю, чего хочу","4":"Мне всё равно"} }
    },

    // ============================================
    // ВОПРОСЫ ЭТАПА 1
    // ============================================
    perception_questions: [
        { id:'p0', text:'Когда принимаешь важное решение, опираешься на:', options:[
            { text:'👥 Мнение и опыт других', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:0,MATERIAL:0} },
            { text:'💭 Внутренние ощущения, интуицию', scores:{EXTERNAL:0,INTERNAL:2,SYMBOLIC:1,MATERIAL:0} },
            { text:'📊 Факты, цифры, данные', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:2} },
            { text:'🤝 Советуюсь с близкими, но решаю сам', scores:{EXTERNAL:1,INTERNAL:1,SYMBOLIC:0,MATERIAL:0} }
        ]},
        { id:'p1', text:'Что вызывает тревогу?', options:[
            { text:'😟 Что не поймут, отвергнут', scores:{EXTERNAL:1,INTERNAL:0,SYMBOLIC:2,MATERIAL:0} },
            { text:'⚠️ Потеряю контроль над ситуацией', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:0,MATERIAL:2} },
            { text:'💰 Не будет денег, стабильности', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:2} },
            { text:'🤔 Сделаю неправильный выбор', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:1,MATERIAL:0} }
        ]},
        { id:'p2', text:'В компании незнакомых людей ты:', options:[
            { text:'👀 Наблюдаю, изучаю правила', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:0,MATERIAL:0} },
            { text:'🎧 Прислушиваюсь к себе', scores:{EXTERNAL:0,INTERNAL:2,SYMBOLIC:1,MATERIAL:0} },
            { text:'🎯 Ищу чем заняться', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:1} },
            { text:'💫 Стараюсь понравиться', scores:{EXTERNAL:1,INTERNAL:0,SYMBOLIC:1,MATERIAL:0} }
        ]},
        { id:'p3', text:'Что важнее в работе?', options:[
            { text:'🎯 Смысл, предназначение', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:2,MATERIAL:0} },
            { text:'📈 Конкретный результат', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:2} },
            { text:'🏆 Признание, статус', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:1,MATERIAL:0} },
            { text:'🌱 Процесс, развитие', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:0,MATERIAL:0} }
        ]},
        { id:'p4', text:'Когда устал, восстанавливаешься:', options:[
            { text:'👥 Иду к людям за поддержкой', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:0,MATERIAL:0} },
            { text:'🏠 Уединяюсь с собой', scores:{EXTERNAL:0,INTERNAL:2,SYMBOLIC:1,MATERIAL:0} },
            { text:'📋 Занимаюсь делами, рутиной', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:1} },
            { text:'📚 Ухожу в фильмы/книги', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:1,MATERIAL:0} }
        ]},
        { id:'p5', text:'Реакция на критику:', options:[
            { text:'😔 Обижаюсь, переживаю', scores:{EXTERNAL:1,INTERNAL:0,SYMBOLIC:2,MATERIAL:0} },
            { text:'🔍 Анализирую, исправляю', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:0,MATERIAL:1} },
            { text:'🛡️ Защищаюсь, объясняю', scores:{EXTERNAL:1,INTERNAL:0,SYMBOLIC:0,MATERIAL:0} },
            { text:'🤷 Обесцениваю критикующего', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:1,MATERIAL:0} }
        ]},
        { id:'p6', text:'Что замечаешь в новом помещении?', options:[
            { text:'👥 Людей, кто где находится', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:0,MATERIAL:0} },
            { text:'✨ Атмосферу, освещение', scores:{EXTERNAL:0,INTERNAL:1,SYMBOLIC:1,MATERIAL:0} },
            { text:'🏠 Предметы, структуру', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:2} },
            { text:'💭 Свои ощущения', scores:{EXTERNAL:0,INTERNAL:2,SYMBOLIC:0,MATERIAL:0} }
        ]},
        { id:'p7', text:'Что для тебя успех?', options:[
            { text:'🏆 Признание, уважение других', scores:{EXTERNAL:2,INTERNAL:0,SYMBOLIC:1,MATERIAL:0} },
            { text:'😌 Внутренняя гармония', scores:{EXTERNAL:0,INTERNAL:2,SYMBOLIC:1,MATERIAL:0} },
            { text:'💰 Достижения, статус, блага', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:2} },
            { text:'🎯 Реализовать предназначение', scores:{EXTERNAL:0,INTERNAL:0,SYMBOLIC:2,MATERIAL:0} }
        ]}
    ],

    // ============================================
    // ВОПРОСЫ ЭТАПА 2
    // ============================================
    thinking_questions: {
        external: [
            { text:'Когда в группе возникает конфликт, вы скорее:', options:[
                {text:'🔍 Замечаю только то, что касается меня',level:2,measures:'ЧВ'},
                {text:'👥 Вижу кто на чьей стороне',level:3,measures:'ЧВ'},
                {text:'📋 Понимаю явные причины',level:4,measures:'ЧВ'},
                {text:'🎯 Анализирую позиции и интересы',level:5,measures:'ЧВ'},
                {text:'🔗 Вижу систему отношений',level:6,measures:'ЧВ'},
                {text:'📜 Понимаю связь с историей группы',level:7,measures:'ЧВ'},
                {text:'🔮 Могу предсказать развитие',level:8,measures:'ЧВ'},
                {text:'🔄 Вижу повторяющиеся паттерны',level:9,measures:'ЧВ'}
            ]},
            { text:'Как вы понимаете, почему люди поступают так, а не иначе?', options:[
                {text:'🤷 Они просто такие',level:1,measures:'ЧВ'},
                {text:'🌍 Так сложились обстоятельства',level:2,measures:'ЧВ'},
                {text:'💭 У них явные мотивы',level:3,measures:'ЧВ'},
                {text:'📚 Анализирую их прошлый опыт',level:4,measures:'ЧВ'},
                {text:'💎 Понимаю их ценности',level:5,measures:'ЧВ'},
                {text:'🏠 Вижу связь с окружением',level:6,measures:'ЧВ'},
                {text:'🔮 Могу предсказать реакции',level:7,measures:'ЧВ'},
                {text:'🎭 Замечаю архетипы',level:8,measures:'ЧВ'},
                {text:'📜 Понимаю универсальные законы',level:9,measures:'ЧВ'}
            ]},
            { text:'Когда вас критикуют, ваша мысль:', options:[
                {text:'😤 Они ко мне придираются',level:1,measures:'СБ'},
                {text:'😞 Я что-то сделал не так',level:2,measures:'СБ'},
                {text:'🤔 В этот раз я ошибся',level:3,measures:'СБ'},
                {text:'🔄 У меня повторяется паттерн ошибок',level:4,measures:'СБ'},
                {text:'💭 Это связано с моими убеждениями',level:5,measures:'СБ'},
                {text:'🎭 Это часть моей роли',level:6,measures:'СБ'},
                {text:'📚 Это жизненный урок',level:7,measures:'СБ'},
                {text:'🌍 Универсальный паттерн',level:8,measures:'СБ'},
                {text:'📜 Законы развития',level:9,measures:'СБ'}
            ]},
            { text:'Как вы относитесь к деньгам?', options:[
                {text:'🌊 Приходят и уходят',level:1,measures:'ТФ'},
                {text:'🔍 Нужно искать возможности',level:2,measures:'ТФ'},
                {text:'💪 Результат действий',level:3,measures:'ТФ'},
                {text:'📊 Система, которую можно выстроить',level:4,measures:'ТФ'},
                {text:'⚡ Энергия и свобода',level:5,measures:'ТФ'},
                {text:'🎯 Инструмент для целей',level:6,measures:'ТФ'},
                {text:'📈 Часть экономики',level:7,measures:'ТФ'},
                {text:'💎 Отражение ценности',level:8,measures:'ТФ'},
                {text:'🔄 Универсальный эквивалент',level:9,measures:'ТФ'}
            ]},
            { text:'Когда происходит что-то непонятное:', options:[
                {text:'😴 Стараюсь не думать',level:1,measures:'УБ'},
                {text:'🔮 Ищу знаки',level:2,measures:'УБ'},
                {text:'📚 Обращаюсь к эксперту',level:3,measures:'УБ'},
                {text:'🔍 Ищу заговор',level:4,measures:'УБ'},
                {text:'📊 Анализирую факты',level:5,measures:'УБ'},
                {text:'🏛️ Смотрю в контексте системы',level:6,measures:'УБ'},
                {text:'📜 Ищу аналогии в истории',level:7,measures:'УБ'},
                {text:'🧠 Строю модели',level:8,measures:'УБ'},
                {text:'🔗 Ищу закономерности',level:9,measures:'УБ'}
            ]}
        ],
        internal: [
            { text:'Как ищешь смысл в происходящем?', options:[
                {text:'😴 Не ищу',level:1,measures:'УБ'},
                {text:'💭 Чувствую, есть или нет',level:2,measures:'УБ'},
                {text:'📚 Спрашиваю у знающих',level:3,measures:'УБ'},
                {text:'💖 Анализирую свои чувства',level:4,measures:'УБ'},
                {text:'🔍 Ищу глубинные причины',level:5,measures:'УБ'},
                {text:'💎 Вижу связи с ценностями',level:6,measures:'УБ'},
                {text:'📖 Понимаю жизненные уроки',level:7,measures:'УБ'},
                {text:'🎭 Вижу архетипические сюжеты',level:8,measures:'УБ'},
                {text:'🌌 Понимаю универсальные смыслы',level:9,measures:'УБ'}
            ]},
            { text:'Как выбираешь, чем заниматься?', options:[
                {text:'🍃 Как получится',level:1,measures:'ТФ'},
                {text:'😊 По настроению',level:2,measures:'ТФ'},
                {text:'👥 По совету',level:3,measures:'ТФ'},
                {text:'🔍 Анализирую интересы',level:4,measures:'ТФ'},
                {text:'🎯 Ищу призвание',level:5,measures:'ТФ'},
                {text:'💎 Связываю с ценностями',level:6,measures:'ТФ'},
                {text:'📜 Понимаю предназначение',level:7,measures:'ТФ'},
                {text:'🛤️ Вижу свой путь',level:8,measures:'ТФ'},
                {text:'🌟 Следую миссии',level:9,measures:'ТФ'}
            ]},
            { text:'В конфликте с близким по духу:', options:[
                {text:'😰 Теряюсь',level:1,measures:'СБ'},
                {text:'🚶 Ухожу',level:2,measures:'СБ'},
                {text:'👍 Соглашаюсь',level:3,measures:'СБ'},
                {text:'🔍 Анализирую',level:4,measures:'СБ'},
                {text:'🤝 Ищу компромисс',level:5,measures:'СБ'},
                {text:'💎 Понимаю его ценности',level:6,measures:'СБ'},
                {text:'📚 Вижу урок',level:7,measures:'СБ'},
                {text:'🎭 Понимаю архетип',level:8,measures:'СБ'},
                {text:'📜 Вижу закономерность',level:9,measures:'СБ'}
            ]},
            { text:'В отношениях с единомышленниками:', options:[
                {text:'🪢 Привязываюсь',level:1,measures:'ЧВ'},
                {text:'🔄 Подстраиваюсь',level:2,measures:'ЧВ'},
                {text:'✨ Показываю себя',level:3,measures:'ЧВ'},
                {text:'💭 Понимаю их',level:4,measures:'ЧВ'},
                {text:'🤝 Строю партнерство',level:5,measures:'ЧВ'},
                {text:'🏛️ Создаю сообщество',level:6,measures:'ЧВ'},
                {text:'💫 Вдохновляю',level:7,measures:'ЧВ'},
                {text:'🎭 Вижу архетипы',level:8,measures:'ЧВ'},
                {text:'📜 Понимаю законы',level:9,measures:'ЧВ'}
            ]}
        ]
    },

    // ============================================
    // ВОПРОСЫ ЭТАПА 3
    // ============================================
    behavior_questions: [
        { text:'Начальник кричит несправедливо. Реакция:', options:[
            {text:'😶 Теряюсь, слова не идут',level:1,strategy:'СБ'},
            {text:'🚶 Придумываю причину уйти',level:2,strategy:'СБ'},
            {text:'😤 Соглашаюсь внешне, внутри кипит',level:3,strategy:'СБ'},
            {text:'😌 Сохраняю спокойствие, молчу',level:4,strategy:'СБ'},
            {text:'😄 Пытаюсь перевести в шутку',level:5,strategy:'СБ'},
            {text:'🗣️ Спокойно говорю, что не согласен',level:6,strategy:'СБ'}
        ]},
        { text:'Срочно нужны деньги. Первое действие:', options:[
            {text:'🙏 Попрошу в долг',level:1,strategy:'ТФ'},
            {text:'💼 Найду разовую подработку',level:2,strategy:'ТФ'},
            {text:'🏪 Продам что-то из вещей',level:3,strategy:'ТФ'},
            {text:'🎨 Предложу свои услуги',level:4,strategy:'ТФ'},
            {text:'💰 Использую накопления',level:5,strategy:'ТФ'},
            {text:'📊 Создам системный доход',level:6,strategy:'ТФ'}
        ]},
        { text:'Экономический кризис. Твое объяснение:', options:[
            {text:'😴 Стараюсь не думать',level:1,strategy:'УБ'},
            {text:'🔮 Судьба, знак, карма',level:2,strategy:'УБ'},
            {text:'📚 Верю экспертам',level:3,strategy:'УБ'},
            {text:'🎭 Кто-то специально устроил',level:4,strategy:'УБ'},
            {text:'📊 Анализирую факты сам',level:5,strategy:'УБ'},
            {text:'🔄 Понимаю экономические циклы',level:6,strategy:'УБ'}
        ]},
        { text:'В новом коллективе в первые дни:', options:[
            {text:'🤝 Держусь с тем, кто принял',level:1,strategy:'ЧВ'},
            {text:'👀 Наблюдаю и копирую',level:2,strategy:'ЧВ'},
            {text:'✨ Стараюсь запомниться',level:3,strategy:'ЧВ'},
            {text:'🎯 Смотрю, кто на что влияет',level:4,strategy:'ЧВ'},
            {text:'🤝 Ищу общие интересы',level:5,strategy:'ЧВ'},
            {text:'🌱 Выстраиваю отношения постепенно',level:6,strategy:'ЧВ'}
        ]},
        { text:'Близкий снова раздражает. Ты:', options:[
            {text:'😔 Терплю, не знаю как начать',level:1,strategy:'СБ'},
            {text:'🚶 Незаметно дистанцируюсь',level:2,strategy:'СБ'},
            {text:'💬 Намекаю, прямо не говорю',level:3,strategy:'СБ'},
            {text:'🌋 Коплю и потом взрываюсь',level:4,strategy:'СБ'},
            {text:'🤔 Пытаюсь понять причину',level:5,strategy:'СБ'},
            {text:'🗣️ Говорю прямо о чувствах',level:6,strategy:'СБ'}
        ]},
        { text:'Возможность заработать, но нужно вложиться:', options:[
            {text:'🔍 Ищу вариант без вложений',level:1,strategy:'ТФ'},
            {text:'🎲 Пробую на минимуме',level:2,strategy:'ТФ'},
            {text:'🧮 Считаю, сколько заработаю',level:3,strategy:'ТФ'},
            {text:'📊 Оцениваю вложения и доход',level:4,strategy:'ТФ'},
            {text:'⚙️ Думаю, как встроить в процессы',level:5,strategy:'ТФ'},
            {text:'📈 Анализирую, как масштабировать',level:6,strategy:'ТФ'}
        ]},
        { text:'Коллега поступил странно, не понимаю зачем:', options:[
            {text:'😐 Не придаю значения',level:1,strategy:'УБ'},
            {text:'🤷 Он просто такой человек',level:2,strategy:'УБ'},
            {text:'📞 Спрашиваю у других',level:3,strategy:'УБ'},
            {text:'🎭 Он что-то замышляет',level:4,strategy:'УБ'},
            {text:'🔄 Ищу паттерн в поведении',level:5,strategy:'УБ'},
            {text:'🧠 Анализирую его мотивы',level:6,strategy:'УБ'}
        ]},
        { text:'Нужна помощь от того, с кем сложные отношения:', options:[
            {text:'😟 Не прошу, боюсь отказа',level:1,strategy:'ЧВ'},
            {text:'🎁 Сначала сделаю для него',level:2,strategy:'ЧВ'},
            {text:'🎭 Создам ситуацию, где сам предложит',level:3,strategy:'ЧВ'},
            {text:'💬 Объясню, почему мне важно',level:4,strategy:'ЧВ'},
            {text:'🤝 Говорю прямо, предлагаю обмен',level:5,strategy:'ЧВ'},
            {text:'🌱 Строю долгосрочные отношения',level:6,strategy:'ЧВ'}
        ]}
    ],

    // ============================================
    // ВОПРОСЫ ЭТАПА 4
    // ============================================
    growth_questions: [
        { text:'Если что-то не получается, причина в:', options:[
            {text:'🌍 Обстоятельствах, людях вокруг',dilts:'ENVIRONMENT'},
            {text:'🛠️ Моих действиях',dilts:'BEHAVIOR'},
            {text:'📚 Нехватке навыков, опыта',dilts:'CAPABILITIES'},
            {text:'💎 Моих убеждениях, ценностях',dilts:'VALUES'},
            {text:'🧠 Моей личности, характере',dilts:'IDENTITY'}
        ]},
        { text:'Самый ценный результат работы с психологом:', options:[
            {text:'🤝 Научиться взаимодействовать с людьми',dilts:'ENVIRONMENT'},
            {text:'🔄 Изменить привычки и реакции',dilts:'BEHAVIOR'},
            {text:'🎓 Развить новые навыки',dilts:'CAPABILITIES'},
            {text:'💎 Понять свои ценности',dilts:'VALUES'},
            {text:'🔍 Найти себя',dilts:'IDENTITY'}
        ]},
        { text:'Когда злишься на себя, чаще всего за что?', options:[
            {text:'🌍 Не смог повлиять на ситуацию',dilts:'ENVIRONMENT'},
            {text:'🛠️ Сделал не то, поступил неправильно',dilts:'BEHAVIOR'},
            {text:'📚 Не справился, не хватило умения',dilts:'CAPABILITIES'},
            {text:'💎 Предал свои принципы',dilts:'VALUES'},
            {text:'😞 Что я такой бестолковый',dilts:'IDENTITY'}
        ]},
        { text:'Что труднее всего в отношениях с близкими?', options:[
            {text:'🌍 Они меня не понимают',dilts:'ENVIRONMENT'},
            {text:'🔄 Мое собственное поведение',dilts:'BEHAVIOR'},
            {text:'📚 Не умею донести',dilts:'CAPABILITIES'},
            {text:'💎 У нас разные ценности',dilts:'VALUES'},
            {text:'😔 Теряю себя',dilts:'IDENTITY'}
        ]},
        { text:'Что останавливает от больших целей?', options:[
            {text:'🌍 Внешние обстоятельства',dilts:'ENVIRONMENT'},
            {text:'🔄 Не знаю с чего начать',dilts:'BEHAVIOR'},
            {text:'📚 Не хватает знаний, навыков',dilts:'CAPABILITIES'},
            {text:'💎 Не уверен, что важно для меня',dilts:'VALUES'},
            {text:'😔 Не верю, что способен',dilts:'IDENTITY'}
        ]},
        { text:'Как объясняешь свои успехи?', options:[
            {text:'🍀 Повезло, оказался в нужном месте',dilts:'ENVIRONMENT'},
            {text:'💪 Сделал правильно, приложил усилия',dilts:'BEHAVIOR'},
            {text:'🎯 Смог, справился',dilts:'CAPABILITIES'},
            {text:'💎 Был верен принципам',dilts:'VALUES'},
            {text:'🧠 Я такой человек',dilts:'IDENTITY'}
        ]},
        { text:'Что хочешь изменить в себе в первую очередь?', options:[
            {text:'🌍 Свою жизнь, окружение',dilts:'ENVIRONMENT'},
            {text:'🔄 Привычки, реакции',dilts:'BEHAVIOR'},
            {text:'📚 Способности, навыки',dilts:'CAPABILITIES'},
            {text:'💎 Ценности, убеждения',dilts:'VALUES'},
            {text:'🧠 Личность, характер',dilts:'IDENTITY'}
        ]},
        { text:'О чем чаще всего жалеешь?', options:[
            {text:'🌍 Что не сложились обстоятельства',dilts:'ENVIRONMENT'},
            {text:'🔄 О том, что сделал или не сделал',dilts:'BEHAVIOR'},
            {text:'📚 Что не умел, не знал',dilts:'CAPABILITIES'},
            {text:'💎 Что предал свои принципы',dilts:'VALUES'},
            {text:'😔 Что был не собой',dilts:'IDENTITY'}
        ]}
    ],

    // ============================================
    // ВОПРОСЫ ЭТАПА 5
    // ============================================
    deep_questions: [
        { text:'В детстве, когда расстраивался, родители:', options:[
            {text:'🤗 Утешали, обнимали',pattern:'secure',target:'attachment'},
            {text:'💪 Говорили "не плачь, будь сильным"',pattern:'avoidant',target:'attachment'},
            {text:'🎭 Реагировали по-разному',pattern:'anxious',target:'attachment'},
            {text:'🚶 Оставляли одного остыть',pattern:'dismissive',target:'attachment'}
        ]},
        { text:'Когда случается плохое, я обычно:', options:[
            {text:'🔍 Ищу виноватого',pattern:'projection',target:'defense'},
            {text:'🧠 Объясняю логически',pattern:'rationalization',target:'defense'},
            {text:'😴 Стараюсь не думать',pattern:'denial',target:'defense'},
            {text:'😤 Злюсь и раздражаюсь',pattern:'regression',target:'defense'}
        ]},
        { text:'В отношениях чаще всего боюсь, что:', options:[
            {text:'😢 Меня бросят',pattern:'abandonment',target:'fear'},
            {text:'🎮 Будут управлять мной',pattern:'control',target:'fear'},
            {text:'🙅 Не поймут',pattern:'misunderstanding',target:'fear'},
            {text:'😔 Не справлюсь',pattern:'inadequacy',target:'fear'}
        ]},
        { text:'Какое утверждение ближе всего?', options:[
            {text:'😞 Я недостаточно хорош',pattern:'not_good_enough',target:'belief'},
            {text:'🤔 Людям нельзя доверять',pattern:'no_trust',target:'belief'},
            {text:'🌍 Мир опасен',pattern:'world_dangerous',target:'belief'},
            {text:'⭐ Я должен быть идеальным',pattern:'perfectionism',target:'belief'}
        ]},
        { text:'Когда злюсь, я обычно:', options:[
            {text:'💥 Выплёскиваю на других',pattern:'externalize',target:'anger_style'},
            {text:'🤐 Подавляю и молчу',pattern:'suppress',target:'anger_style'},
            {text:'🏠 Ухожу в себя',pattern:'withdraw',target:'anger_style'},
            {text:'🔧 Ищу решение',pattern:'constructive',target:'anger_style'}
        ]},
        { text:'Мои друзья сказали бы, что я:', options:[
            {text:'😭 Слишком эмоциональный',pattern:'emotional',target:'social_role'},
            {text:'🧠 Слишком рациональный',pattern:'rational',target:'social_role'},
            {text:'🤝 Надёжный, но закрытый',pattern:'reliable_closed',target:'social_role'},
            {text:'🎉 Душа компании',pattern:'soul_company',target:'social_role'}
        ]},
        { text:'В стрессе я:', options:[
            {text:'😰 Суечусь и паникую',pattern:'panic',target:'stress_response'},
            {text:'😶 Замираю и тупею',pattern:'freeze',target:'stress_response'},
            {text:'🎯 Становлюсь сверхсобранным',pattern:'hyperfocus',target:'stress_response'},
            {text:'🤝 Ищу поддержку',pattern:'seek_support',target:'stress_response'}
        ]},
        { text:'Что для тебя самое важное в жизни?', options:[
            {text:'🛡️ Безопасность, стабильность',pattern:'security',target:'core_value'},
            {text:'🕊️ Свобода, независимость',pattern:'freedom',target:'core_value'},
            {text:'❤️ Любовь, близость',pattern:'love',target:'core_value'},
            {text:'🏆 Достижения, успех',pattern:'achievement',target:'core_value'}
        ]},
        { text:'Когда меня критикуют, я:', options:[
            {text:'😢 Обижаюсь и закрываюсь',pattern:'shutdown',target:'criticism_response'},
            {text:'⚔️ Атакую в ответ',pattern:'counterattack',target:'criticism_response'},
            {text:'🔍 Анализирую, правы ли они',pattern:'analyze',target:'criticism_response'},
            {text:'👍 Соглашаюсь, чтобы не спорить',pattern:'appease',target:'criticism_response'}
        ]},
        { text:'Моя главная внутренняя проблема:', options:[
            {text:'😔 Страх быть покинутым',pattern:'abandonment_fear',target:'core_issue'},
            {text:'😰 Страх неудачи',pattern:'failure_fear',target:'core_issue'},
            {text:'🎭 Страх быть собой',pattern:'authenticity_fear',target:'core_issue'},
            {text:'⚔️ Страх конфликтов',pattern:'conflict_fear',target:'core_issue'}
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

        let vp = document.querySelector('meta[name="viewport"]');
        if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
        vp.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';

        Object.assign(document.body.style, { overflow:'hidden', position:'fixed', top:'0', left:'0', right:'0', bottom:'0' });

        const updateHeight = () => {
            const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            container.style.height = h + 'px';
            container.style.minHeight = h + 'px';
        };
        updateHeight();
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateHeight);
            window.visualViewport.addEventListener('scroll', updateHeight);
        }
        setTimeout(() => window.scrollTo(0, 1), 100);
        container.addEventListener('touchmove', (e) => {
            const msg = document.getElementById('testChatMessages');
            if (msg && msg.contains(e.target)) return;
            e.preventDefault();
        }, { passive: false });
    },

    // ============================================
    // РАСЧЁТЫ
    // ============================================
    determinePerceptionType() {
        const {EXTERNAL, INTERNAL, SYMBOLIC, MATERIAL} = this.perceptionScores;
        const attention = EXTERNAL > INTERNAL ? 'EXTERNAL' : 'INTERNAL';
        const anxiety   = SYMBOLIC > MATERIAL ? 'SYMBOLIC' : 'MATERIAL';
        if (attention==='EXTERNAL' && anxiety==='SYMBOLIC') return 'СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ';
        if (attention==='EXTERNAL' && anxiety==='MATERIAL') return 'СТАТУСНО-ОРИЕНТИРОВАННЫЙ';
        if (attention==='INTERNAL' && anxiety==='SYMBOLIC') return 'СМЫСЛО-ОРИЕНТИРОВАННЫЙ';
        return 'ПРАКТИКО-ОРИЕНТИРОВАННЫЙ';
    },

    calculateThinkingLevel() {
        const total = Object.values(this.thinkingScores).reduce((a,b)=>a+b,0);
        if (total<=10) return 1; if (total<=20) return 2; if (total<=30) return 3;
        if (total<=40) return 4; if (total<=50) return 5; if (total<=60) return 6;
        if (total<=70) return 7; if (total<=80) return 8; return 9;
    },

    getLevelGroup(l) { return l<=3?'1-3':l<=6?'4-6':'7-9'; },

    calculateFinalLevel() {
        const s2 = this.thinkingLevel;
        const s3 = this.stage3Scores.length ? this.stage3Scores.reduce((a,b)=>a+b,0)/this.stage3Scores.length : s2;
        return Math.round((s2+s3)/2);
    },

    determineDominantDilts() {
        let max=0, dominant='BEHAVIOR';
        for (const [k,v] of Object.entries(this.diltsCounts)) { if (v>max) {max=v; dominant=k;} }
        return dominant;
    },

    calculateFinalProfile() {
        const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 3;
        const sb=avg(this.behavioralLevels['СБ']), tf=avg(this.behavioralLevels['ТФ']),
              ub=avg(this.behavioralLevels['УБ']), cv=avg(this.behavioralLevels['ЧВ']);
        return {
            displayName: `СБ-${Math.round(sb)}_ТФ-${Math.round(tf)}_УБ-${Math.round(ub)}_ЧВ-${Math.round(cv)}`,
            perceptionType: this.perceptionType, thinkingLevel: this.thinkingLevel,
            sbLevel:Math.round(sb), tfLevel:Math.round(tf), ubLevel:Math.round(ub), chvLevel:Math.round(cv),
            dominantDilts: this.determineDominantDilts(), diltsCounts: this.diltsCounts
        };
    },

    analyzeDeepPatterns() {
        const p = {secure:0,anxious:0,avoidant:0,dismissive:0};
        (this.deepAnswers||[]).forEach(a => { if (a.pattern && p[a.pattern]!==undefined) p[a.pattern]++; });
        let max=0, dominant='secure';
        for (const [k,v] of Object.entries(p)) { if (v>max) {max=v; dominant=k;} }
        const map = {secure:'🤗 Надежный',anxious:'😥 Тревожный',avoidant:'🛡️ Избегающий',dismissive:'🏔️ Отстраненный'};
        return { attachment: map[dominant]||'🤗 Надежный', patterns: p };
    },

    // ============================================
    // ИНТЕРПРЕТАЦИИ
    // ============================================
    getStage1Interpretation() {
        const map = {
            'СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ': `🔍 Что это значит:
Твоё внимание направлено на людей, отношения, социальные связи. Ты чувствителен к тому, как тебя воспринимают другие. Твоя глубинная тревога — быть отвергнутым, непонятым.

📌 Как это проявляется:
• Ты хорошо считываешь настроение и ожидания других
• Для тебя важно быть принятым в группе
• Критика воспринимается болезненно, особенно публичная

⚡ Сильная сторона: Эмпатия, социальный интеллект, умение строить связи.
⚠️ Слепая зона: Собственные потребности могут оставаться за кадром.`,

            'СТАТУСНО-ОРИЕНТИРОВАННЫЙ': `🔍 Что это значит:
Твоё внимание направлено на положение, статус, иерархию. Ты чувствителен к тому, кто есть кто в системе. Твоя глубинная тревога — потерять контроль, упустить возможности.

📌 Как это проявляется:
• Ты хорошо ориентируешься в иерархиях и структурах
• Для тебя важно твоё положение относительно других
• Неопределённость и хаос вызывают напряжение

⚡ Сильная сторона: Стратегическое мышление, ориентация на результат.
⚠️ Слепая зона: То, что нельзя измерить, может обесцениваться.`,

            'СМЫСЛО-ОРИЕНТИРОВАННЫЙ': `🔍 Что это значит:
Твоё внимание направлено на смыслы, ценности, идеи. Ты чувствителен к тому, насколько происходящее согласуется с твоим внутренним миром. Твоя глубинная тревога — жить бессмысленно.

📌 Как это проявляется:
• Для тебя важно «зачем» — смысл любого действия
• Ты ищешь глубину, подтекст, скрытые значения
• Поверхностность утомляет

⚡ Сильная сторона: Глубина мышления, способность к рефлексии.
⚠️ Слепая зона: Конкретика и детали могут казаться неважными.`,

            'ПРАКТИКО-ОРИЕНТИРОВАННЫЙ': `🔍 Что это значит:
Твоё внимание направлено на ощущения, комфорт, практичность. Ты чувствителен к тому, как вещи работают. Твоя глубинная тревога — нестабильность, хаос.

📌 Как это проявляется:
• Ты ценишь конкретные, работающие решения
• Для тебя важны стабильность и порядок
• Новое воспринимаешь через «как применить на практике?»

⚡ Сильная сторона: Практичность, надёжность, умение создавать стабильность.
⚠️ Слепая зона: Абстрактные идеи могут казаться неважными.`
        };
        return map[this.perceptionType] || '';
    },

    getStage2Interpretation() {
        const g = this.getLevelGroup(this.thinkingLevel);
        const map = {
            'СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ': {
                '1-3': `🔍 Как это проявляется:
В рамках твоего социально-ориентированного восприятия ты мыслишь конкретно и ситуативно. Ты хорошо ориентируешься в конкретных ситуациях общения, понимаешь явные причины и следствия.

📌 Точка роста:
Начни замечать повторяющиеся паттерны в отношениях, а не только отдельные ситуации.`,

                '4-6': `🔍 Как это проявляется:
В рамках твоего социально-ориентированного восприятия ты мыслишь системно. Ты видишь паттерны в отношениях, понимаешь роли и позиции людей в группе.

📌 Точка роста:
От анализа к предсказанию — научись видеть, как текущие паттерны приведут к будущим результатам.`,

                '7-9': `🔍 Как это проявляется:
В рамках твоего социально-ориентированного восприятия ты мыслишь универсальными категориями. Ты видишь законы человеческих отношений, понимаешь архетипические паттерны.

📌 Риск:
Теория может отрываться от практики — важно проверять модели в реальном общении.`
            },
            'СТАТУСНО-ОРИЕНТИРОВАННЫЙ': {
                '1-3': `🔍 Как это проявляется:
В рамках твоего статусно-ориентированного восприятия ты мыслишь конкретно и ситуативно. Ты хорошо ориентируешься в текущих статусах и положениях, но не видишь их динамики.

📌 Точка роста:
Начни замечать, как статусы меняются в зависимости от контекста и действий.`,

                '4-6': `🔍 Как это проявляется:
В рамках твоего статусно-ориентированного восприятия ты мыслишь системно. Ты видишь иерархии и понимаешь, как распределяется влияние.

📌 Точка роста:
От анализа к предсказанию — научись видеть, как текущая конфигурация приведёт к будущим изменениям.`,

                '7-9': `🔍 Как это проявляется:
В рамках твоего статусно-ориентированного восприятия ты мыслишь универсальными категориями. Ты видишь законы иерархий и понимаешь универсальные паттерны борьбы за влияние.

📌 Риск:
Теория может отрываться от практики — важно помнить, что за статусами стоят живые люди.`
            },
            'СМЫСЛО-ОРИЕНТИРОВАННЫЙ': {
                '1-3': `🔍 Как это проявляется:
В рамках твоего смысло-ориентированного восприятия ты мыслишь конкретно и ситуативно. Ты хорошо чувствуешь, есть ли в происходящем смысл лично для тебя.

📌 Точка роста:
Начни замечать, как твои личные смыслы связаны с ценностями других людей.`,

                '4-6': `🔍 Как это проявляется:
В рамках твоего смысло-ориентированного восприятия ты мыслишь системно. Ты видишь, как смыслы и ценности образуют системы.

📌 Точка роста:
От понимания ценностей к их реализации в конкретных действиях.`,

                '7-9': `🔍 Как это проявляется:
В рамках твоего смысло-ориентированного восприятия ты мыслишь универсальными категориями. Ты видишь архетипические сюжеты и законы, по которым разворачивается жизнь.

📌 Риск:
Теория может отрываться от практики — важно проверять высокие смыслы в конкретных действиях.`
            },
            'ПРАКТИКО-ОРИЕНТИРОВАННЫЙ': {
                '1-3': `🔍 Как это проявляется:
В рамках твоего практико-ориентированного восприятия ты мыслишь конкретно и ситуативно. Ты хорошо решаешь текущие практические задачи.

📌 Точка роста:
Начни замечать, как отдельные задачи складываются в системы.`,

                '4-6': `🔍 Как это проявляется:
В рамках твоего практико-ориентированного восприятия ты мыслишь системно. Ты видишь, как процессы организованы в системы.

📌 Точка роста:
От оптимизации систем к пониманию законов, по которым они работают.`,

                '7-9': `🔍 Как это проявляется:
В рамках твоего практико-ориентированного восприятия ты мыслишь универсальными категориями. Ты понимаешь законы функционирования систем.

📌 Риск:
Теория может отрываться от практики — важно помнить, что за системами стоят люди и их потребности.`
            }
        };
        const pt = map[this.perceptionType] || map['СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ'];
        return pt[g] || pt['4-6'];
    },

    getStage3Interpretation() {
        const l = this.calculateFinalLevel();
        if (l <= 3) return `🔍 Как это проявляется:
Твоё поведение реактивно — ты отвечаешь на внешние стимулы, но редко инициируешь сам.

📌 В разных сферах:
• Под давлением — замираешь или уходишь
• В ресурсах — зависишь от других
• В понимании мира — ищешь простые объяснения
• В отношениях — привязываешься или подстраиваешься

⚡ Точка роста:
Начни замечать момент выбора — между стимулом и реакцией есть пауза.`;

        if (l <= 6) return `🔍 Как это проявляется:
Твоё поведение активно и осознанно — ты умеешь выбирать реакции и стратегии.

📌 В разных сферах:
• Под давлением — можешь защищаться или искать компромисс
• В ресурсах — зарабатываешь трудом, создаёшь резервы
• В понимании мира — анализируешь и проверяешь
• В отношениях — строишь партнёрства

⚡ Точка роста:
Системность — научись видеть, как отдельные реакции складываются в долгосрочные стратегии.`;

        return `🔍 Как это проявляется:
Твоё поведение стратегично и системно — ты выстраиваешь долгосрочные конструкции.

📌 В разных сферах:
• Под давлением — точно выбираешь, когда защищаться, а когда договариваться
• В ресурсах — управляешь системами и капиталом
• В понимании мира — строишь модели и теории
• В отношениях — создаёшь сети и сообщества

⚠️ Риск:
Системы могут отрываться от реальности — важно сохранять контакт с живыми людьми.`;
    },

    getStage5Interpretation() {
        const d = (this.deepPatterns||{attachment:'🤗 Надежный'}).attachment;
        const map = {
            '🤗 Надежный': `🔗 Тип привязанности: Надёжный

🔍 Что это значит:
У тебя сформировалась здоровая база — ты доверяешь себе и другим. Умеешь быть близким, не теряя себя.

📌 Как это проявляется:
• Ты спокойно переносишь временное одиночество
• Не паникуешь, когда партнёр или друг недоступен
• Конфликты воспринимаешь как рабочий момент, а не катастрофу

⚡ Сильная сторона: Устойчивость, способность к глубоким и долгим связям.
⚠️ Слепая зона: Можешь не замечать, когда другим нужна особая поддержка.`,

            '😥 Тревожный': `🔗 Тип привязанности: Тревожный

🔍 Что это значит:
Ты глубоко нуждаешься в близости, но боишься её потерять. Это формирует гиперчувствительность к сигналам отвержения.

📌 Как это проявляется:
• Часто проверяешь, всё ли в порядке с отношениями
• Болезненно реагируешь на холодность или дистанцию
• Склонен додумывать негативные сценарии

⚡ Сильная сторона: Глубокая эмпатия, искренняя вовлечённость в отношения.
⚠️ Слепая зона: Тревога может отталкивать именно тех, кого хочется удержать.`,

            '🛡️ Избегающий': `🔗 Тип привязанности: Избегающий

🔍 Что это значит:
Ты ценишь независимость и держишь дистанцию. Близость ощущается как угроза автономии.

📌 Как это проявляется:
• Трудно просить о помощи или показывать уязвимость
• При сближении возникает импульс отступить
• Самостоятельность — высшая ценность

⚡ Сильная сторона: Надёжность, самодостаточность, умение держать голову холодной.
⚠️ Слепая зона: Люди рядом могут чувствовать себя ненужными.`,

            '🏔️ Отстраненный': `🔗 Тип привязанности: Отстранённый

🔍 Что это значит:
Ты обесцениваешь важность близких отношений — как защитный механизм от боли.

📌 Как это проявляется:
• Отношения воспринимаются как необязательные или обременительные
• Эмоциональные запросы других кажутся чрезмерными
• Предпочитаешь рациональное эмоциональному

⚡ Сильная сторона: Высокая функциональность, способность действовать без эмоционального хаоса.
⚠️ Слепая зона: Внутреннее одиночество, которое трудно признать даже себе.`
        };
        return map[d] || map['🤗 Надежный'];
    },

    // ============================================
    // ФОРМАТИРОВАНИЕ
    // ============================================
    cleanTextForDisplay(text) {
        if (!text) return text;
        return text
            .replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1')
            .replace(/\*(.*?)\*/g,'$1').replace(/_(.*?)_/g,'$1')
            .replace(/`(.*?)`/g,'$1').replace(/\[(.*?)\]\(.*?\)/g,'$1')
            .replace(/#{1,6}\s+/g,'').replace(/<[^>]+>/g,'')
            .replace(/\s+/g,' ').trim().replace(/\n\s*\n/g,'\n\n');
    },

    getClarifyingQuestions(discrepancies, currentLevels) {
        const questions = [];
        for (const vector of ['СБ','ТФ','УБ','ЧВ']) {
            if (!discrepancies.includes(vector)) continue;
            const lvl = Math.round(currentLevels[vector]||3);
            const vq = this.clarifyingQuestionsDB[vector]||[];
            const q = vq.find(q=>q.level===lvl) || vq.reduce((prev,curr)=>Math.abs(curr.level-lvl)<Math.abs(prev.level-lvl)?curr:prev, vq[0]);
            if (q) questions.push({type:'vector',vector,text:q.text,options:q.options});
        }
        for (const disc of discrepancies) {
            if (['people','money','signs','relations'].includes(disc) && this.discrepancyQuestions[disc]) {
                const dq = this.discrepancyQuestions[disc];
                questions.push({type:'discrepancy',target:disc,text:dq.text,options:dq.options});
            }
        }
        const seen = new Set();
        return questions.filter(q=>{ if(seen.has(q.text)) return false; seen.add(q.text); return true; }).slice(0,5);
    },

    // ============================================
    // USER ID
    // ============================================
    getUserId() {
        if (window.maxContext?.user_id && window.maxContext.user_id!=='null') return window.maxContext.user_id;
        const urlId = new URLSearchParams(window.location.search).get('user_id');
        if (urlId && urlId!=='null') return urlId;
        const stored = localStorage.getItem('fredi_user_id');
        if (stored && stored!=='null') return stored;
        return null;
    },

        getMirrorCode() {
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref && ref.startsWith('mirror_')) {
            const cleanCode = ref.replace(/^mirror_/, '');
            localStorage.setItem('fredi_mirror_ref', cleanCode);
            return cleanCode;
        }
        const stored = localStorage.getItem('fredi_mirror_ref');
        if (stored) {
            return stored.replace(/^mirror_/, '');
        }
        return null;
    },

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================
    init(userId) {
        this.userId = userId || this.getUserId();
        if (!this.userId || this.userId==='null') { console.warn('⚠️ userId не найден'); this.userId=null; }
        else localStorage.setItem('fredi_user_id', this.userId);
        this.reset();
        this.loadProgress();
        console.log('📝 Тест инициализирован, userId:', this.userId);
    },

    reset() {
        this.currentStage=0; this.currentQuestionIndex=0; this.answers=[];
        this.perceptionScores={EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:0};
        this.perceptionType=null; this.thinkingLevel=null;
        this.thinkingScores={"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0};
        this.strategyLevels={"СБ":[],"ТФ":[],"УБ":[],"ЧВ":[]};
        this.behavioralLevels={"СБ":[],"ТФ":[],"УБ":[],"ЧВ":[]};
        this.stage3Scores=[]; this.diltsCounts={ENVIRONMENT:0,BEHAVIOR:0,CAPABILITIES:0,VALUES:0,IDENTITY:0};
        this.deepAnswers=[]; this.deepPatterns=null; this.profileData=null;
        this.discrepancies=[]; this.clarifyingAnswers=[]; this.clarifyingQuestions=[]; this.clarifyingCurrent=0;
        this.aiGeneratedProfile=null; this.psychologistThought=null;
        this.context={city:null,gender:null,age:null,weather:null,isComplete:false,name:null};
    },

    loadProgress() {
        if (!this.userId) return;
        const saved = localStorage.getItem('test_'+this.userId);
        if (!saved) return;
        try {
            const d = JSON.parse(saved);
            Object.assign(this, {
                currentStage:d.currentStage||0, currentQuestionIndex:d.currentQuestionIndex||0,
                answers:d.answers||[], perceptionScores:d.perceptionScores||{EXTERNAL:0,INTERNAL:0,SYMBOLIC:0,MATERIAL:0},
                perceptionType:d.perceptionType||null, thinkingLevel:d.thinkingLevel||null,
                thinkingScores:d.thinkingScores||{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0},
                strategyLevels:d.strategyLevels||{"СБ":[],"ТФ":[],"УБ":[],"ЧВ":[]},
                behavioralLevels:d.behavioralLevels||{"СБ":[],"ТФ":[],"УБ":[],"ЧВ":[]},
                stage3Scores:d.stage3Scores||[], diltsCounts:d.diltsCounts||{ENVIRONMENT:0,BEHAVIOR:0,CAPABILITIES:0,VALUES:0,IDENTITY:0},
                deepAnswers:d.deepAnswers||[], deepPatterns:d.deepPatterns||null,
                profileData:d.profileData||null,
                context:d.context||{city:null,gender:null,age:null,weather:null,isComplete:false,name:null}
            });
            if (this.perceptionType) {
                const isExt = this.perceptionType.includes('СОЦИАЛЬНО')||this.perceptionType.includes('СТАТУСНО');
                this.stages[1].total = (isExt?this.thinking_questions.external:this.thinking_questions.internal).length;
            }
        } catch(e) { console.warn('❌ Ошибка загрузки прогресса:', e); }
    },

    saveProgress() {
        if (!this.userId) return;
        localStorage.setItem('test_'+this.userId, JSON.stringify({
            currentStage:this.currentStage, currentQuestionIndex:this.currentQuestionIndex,
            answers:this.answers, perceptionScores:this.perceptionScores, perceptionType:this.perceptionType,
            thinkingLevel:this.thinkingLevel, thinkingScores:this.thinkingScores,
            strategyLevels:this.strategyLevels, behavioralLevels:this.behavioralLevels,
            stage3Scores:this.stage3Scores, diltsCounts:this.diltsCounts,
            deepAnswers:this.deepAnswers, deepPatterns:this.deepPatterns,
            profileData:this.profileData, context:this.context, updatedAt:new Date().toISOString()
        }));
    },

    // ============================================
    // ЗАПУСК
    // ============================================
    start() {
        this.init();
        this.reset();
        this.saveProgress();
        this.showTestScreen();
        setTimeout(() => {
            if (this.context.isComplete) {
                this.addBotMessage('🧠 ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ\n\nПривет! Я помню тебя. Хочешь пройти тест заново?');
                this.addMessageWithButtons('', [
                    {text:'🚀 НАЧАТЬ ТЕСТ',callback:()=>this.startTest()},
                    {text:'🔄 ОБНОВИТЬ КОНТЕКСТ',callback:()=>this.startContextCollection()}
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
            </div>`;
        setTimeout(()=>this.optimizeMobileView(), 100);
        this.scrollToBottom();
    },

    // ============================================
    // ЭКРАНЫ ЗНАКОМСТВА
    // ============================================
    showIntroScreen() {
        var name = (this.context && this.context.name) || (window.CONFIG && window.CONFIG.USER_NAME !== 'друг' ? window.CONFIG.USER_NAME : '') || '';
        var greeting = name ? name + ', привет!' : 'Привет!';
        this.addBotMessage(greeting + '\n\nНу, здравствуйте, дорогой человек! 👋\n\n🧠 Я — Фреди, виртуальный психолог.\n\n🕒 Нам нужно познакомиться, потому что я пока не экстрасенс.\n\n🧐 Чтобы я понимал, с кем имею дело и чем могу быть полезен —\nдавайте-ка пройдём небольшой тест.\n\n📊 Всего 5 этапов:\n\n1️⃣ Конфигурация восприятия — как вы фильтруете реальность\n2️⃣ Конфигурация мышления — как ваш мозг перерабатывает информацию\n3️⃣ Конфигурация поведения — что вы делаете на автопилоте\n4️⃣ Точка роста — куда двигаться, чтобы не топтаться на месте\n5️⃣ Глубинные паттерны — что сформировало вас как личность\n\n⏱ 15 минут — и я буду знать о вас больше, чем вы думаете.\n\n🚀 Ну что, начнём наше знакомство?', true);
        this.addMessageWithButtons('', [
            {text:'🚀 НАЧАТЬ ЗНАКОМСТВО',callback:()=>this.startContextCollection()},
            {text:'🤨 А ТЫ ВООБЩЕ КТО ТАКОЙ?',callback:()=>this.showBotInfo()}
        ]);
    },

    showBotInfo() {
        this.addBotMessage('🎭 Ну, вопрос хороший. Давайте по существу.\n\nЯ — Фреди, AI-психолог. Мой мозг обучен на тысячах психологических моделей и реальных кейсов. 🧠\n\n🧐 Что я умею:\n\n• Вижу паттерны там, где вы видите просто день сурка\n• Нахожу систему в ваших "случайных" решениях\n• Понимаю, почему вы выбираете одних и тех же "не тех" людей\n• Я реально беспристрастен — у меня нет плохого настроения\n\n⏱ 15 минут — и я составлю ваш профиль.\n\n👌 Погнали?', true);
        this.addMessageWithButtons('', [{text:'🚀 НАЧАТЬ ЗНАКОМСТВО',callback:()=>this.startContextCollection()}]);
    },

    showTestBenefits() {
        this.addBotMessage(`🔍 ЧТО ВЫ УЗНАЕТЕ О СЕБЕ:\n\n🧠 Восприятие → Мышление → Поведение → Точка роста → Глубинные паттерны\n\n⚡ ПОСЛЕ ТЕСТА ВЫ ПОЛУЧИТЕ:\n\n✅ Полный психологический портрет\n✅ Глубинный анализ подсознательных паттернов\n✅ Индивидуальные рекомендации\n\n⏱ Всего 15 минут`, true);
        this.addMessageWithButtons('', [
            {text:'🚀 НАЧАТЬ ТЕСТ',callback:()=>this.startTest()},
            {text:'◀️ НАЗАД',callback:()=>this.showIntroScreen()}
        ]);
    },

    // ============================================
    // СБОР КОНТЕКСТА
    // ============================================
    startContextCollection() { this.showContextCollectionScreen(); },

    showContextCollectionScreen() {
        this.addBotMessage('📝 ДАВАЙТЕ ПОЗНАКОМИМСЯ\n\nЗаполните небольшую анкету — это займёт меньше минуты.', true);

        const container = document.getElementById('testChatMessages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        msgDiv.style.maxWidth = '100%';

        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        bubble.style.cssText = 'background:rgba(224,224,224,0.05);border-radius:24px;padding:0;overflow:hidden;';

        bubble.innerHTML = `
            <div class="test-context-form">
                <div style="margin-bottom:18px;">
                    <label>🏙️ Город</label>
                    <input type="text" id="contextCity" placeholder="Например: Москва">
                </div>
                <div style="margin-bottom:18px;">
                    <label>👤 Пол</label>
                    <div class="test-context-radio-group">
                        <label class="test-context-radio-label">
                            <input type="radio" name="gender" value="male"> Мужской
                        </label>
                        <label class="test-context-radio-label">
                            <input type="radio" name="gender" value="female"> Женский
                        </label>
                        <label class="test-context-radio-label">
                            <input type="radio" name="gender" value="other"> Другое
                        </label>
                    </div>
                </div>
                <div style="margin-bottom:20px;">
                    <label>📅 Возраст</label>
                    <input type="number" id="contextAge" placeholder="Например: 28" min="1" max="120">
                </div>
                <button id="saveContextBtn" class="test-context-submit">
                    ✦ СОХРАНИТЬ И ПРОДОЛЖИТЬ
                </button>
            </div>`;

        msgDiv.appendChild(bubble);
        container.appendChild(msgDiv);

        setTimeout(() => {
            const btn = document.getElementById('saveContextBtn');
            if (btn) btn.onclick = () => this.saveContextFromForm();
        }, 100);

        this.scrollToBottom();
    },

    // *** ИСПРАВЛЕНО: сначала погода, потом сводка ***
    saveContextFromForm() {
        const city   = (document.getElementById('contextCity')?.value||'').trim();
        const age    = (document.getElementById('contextAge')?.value||'').trim();
        const gender = document.querySelector('input[name="gender"]:checked')?.value||null;

        const errors = [];
        if (!city)   errors.push('🏙️ Укажите город');
        if (!gender) errors.push('👤 Укажите пол');
        if (!age)    errors.push('📅 Укажите возраст');
        else if (parseInt(age)<1||parseInt(age)>120) errors.push('📅 Возраст должен быть от 1 до 120 лет');

        if (errors.length) {
            this.addBotMessage('❌ Пожалуйста, заполните все поля:\n\n'+errors.join('\n'), true);
            return;
        }

        this.context.city = city;
        this.context.gender = gender;
        this.context.age = parseInt(age);
        this.context.isComplete = true;
        this.saveProgress();

        // Промежуточное сообщение пока грузится погода
        this.addBotMessage('⏳ Сохраняю данные и узнаю погоду...', true);

        // Ждём сервер + погоду, только потом показываем сводку
        this.saveContextToServer().then(() => {
            this.showContextSummary();
        });
    },

    async saveContextToServer() {
        if (!this.userId) return;
        try {
            await fetch(TEST_API_BASE_URL+'/api/save-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(this.userId),
                    context: { name:this.context.name, city:this.context.city, gender:this.context.gender, age:this.context.age }
                })
            });
            // Ждём погоду ВНУТРИ этого метода
            const weather = await this.fetchWeatherFromServer();
            if (weather) {
                this.context.weather = weather;
                this.saveProgress();
            }
        } catch(error) {
            console.error('Ошибка сохранения контекста:', error);
        }
    },

    async fetchWeatherFromServer() {
        if (!this.userId || !this.context.city) return null;
        try {
            const response = await fetch(TEST_API_BASE_URL+'/api/weather/'+this.userId);
            const data = await response.json();
            if (data.success && data.weather) {
                return { temp:data.weather.temperature, description:data.weather.description, icon:data.weather.icon };
            }
            return null;
        } catch(error) {
            console.error('Ошибка получения погоды:', error);
            return null;
        }
    },

    // Погода гарантированно уже в this.context.weather к этому моменту
    showContextSummary() {
        const genderText = {male:'Мужчина',female:'Женщина',other:'Другое'}[this.context.gender]||'не указан';
        const weatherLine = this.context.weather
            ? '\n\n🌡️ **Погода в '+this.context.city+':** '+this.context.weather.icon+' '+this.context.weather.description+', '+this.context.weather.temp+'°C'
            : '';

        this.addBotMessage(`✅ Отлично! Теперь я знаю о вас:\n\n📍 Город: ${this.context.city}\n👤 Пол: ${genderText}\n📅 Возраст: ${this.context.age} лет${weatherLine}\n\n🎯 Теперь я буду учитывать это в наших разговорах!\n\n🧠 Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).\nОн определит ваш психологический профиль по 4 векторам и глубинным паттернам.\n\n👇 Начинаем?`, true);

        this.addMessageWithButtons('', [
            {text:'🚀 НАЧАТЬ ТЕСТ',callback:()=>this.startTest()},
            {text:'📖 ЧТО ДАЁТ ТЕСТ',callback:()=>this.showTestBenefits()}
        ]);
    },

    // ============================================
    // ЗАПУСК ТЕСТА
    // ============================================
    startTest() {
        this.currentStage=0; this.currentQuestionIndex=0;
        this.reset(); this.saveProgress();
        this.showTestScreen();
        setTimeout(()=>this.sendStageIntro(), 500);
    },

    // ============================================
    // ОТРИСОВКА СООБЩЕНИЙ
    // ============================================
    addBotMessage(text, isHtml=true) {
        const c = document.getElementById('testChatMessages');
        if (!c) return;

        let processed = text;
        if (isHtml && typeof text==='string') {
            processed = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';

        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        if (isHtml) textDiv.innerHTML = processed.replace(/\n/g,'<br>');
        else textDiv.textContent = text;
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        bubble.appendChild(textDiv); bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        c.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },

    addUserMessage(text) {
        const c = document.getElementById('testChatMessages');
        if (!c) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-user';
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-user';
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.textContent = text;
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        bubble.appendChild(textDiv); bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble); c.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },

    addQuestionMessage(text, options, callback, current, total) {
        const c = document.getElementById('testChatMessages');
        if (!c) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.innerHTML = '<b>Вопрос '+current+'/'+total+'</b><br><br>'+text;
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        options.forEach((opt, idx) => {
            const optText = typeof opt==='object' ? opt.text : opt;
            const btn = document.createElement('button');
            btn.className = 'test-message-button';
            btn.textContent = optText;
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                btn.disabled = true; btn.style.opacity='0.4';
                this.addUserMessage(optText);
                callback(idx, opt);
            });
            buttonsDiv.appendChild(btn);
        });
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = '📊 '+Math.round((current/total)*100)+'%';
        bubble.appendChild(textDiv); bubble.appendChild(buttonsDiv); bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble); c.appendChild(msgDiv);
        this.scrollToBottom();
    },

    addMessageWithButtons(text, buttons) {
        const c = document.getElementById('testChatMessages');
        if (!c) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        if (text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'test-message-text';
            textDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
            bubble.appendChild(textDiv);
        }
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = 'test-message-button';
            button.textContent = btn.text;
            button.addEventListener('click', () => {
                if (button.disabled) return;
                button.disabled=true; button.style.opacity='0.4';
                btn.callback();
            });
            buttonsDiv.appendChild(button);
        });
        const timeDiv = document.createElement('div');
        timeDiv.className='test-message-time'; timeDiv.textContent='только что';
        bubble.appendChild(buttonsDiv); bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble); c.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    },

    scrollToBottom() {
        setTimeout(() => {
            const c = document.getElementById('testChatMessages');
            if (c) c.scrollTop = c.scrollHeight;
        }, 50);
    },

    // ============================================
    // ЛОГИКА ТЕСТА
    // ============================================
    getCurrentQuestions() {
        const stage = this.stages[this.currentStage];
        if (stage.id==='perception') return this.perception_questions;
        if (stage.id==='thinking') {
            const isExt = this.perceptionType==='СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ'||this.perceptionType==='СТАТУСНО-ОРИЕНТИРОВАННЫЙ';
            return isExt ? this.thinking_questions.external : this.thinking_questions.internal;
        }
        if (stage.id==='behavior') return this.behavior_questions;
        if (stage.id==='growth')   return this.growth_questions;
        if (stage.id==='deep')     return this.deep_questions;
        return [];
    },

    sendStageIntro() {
        if (this.currentStage>=this.stages.length) { this.showFinalProfile(); return; }
        const stage = this.stages[this.currentStage];
        this.addBotMessage('🧠 '+stage.name+'\n\n'+stage.shortDesc+'\n\n'+stage.detailedDesc+'\n\n👇 НАЧИНАЕМ?', true);
        this.addMessageWithButtons('', [
            {text:'▶️ НАЧАТЬ ЭТАП',callback:()=>this.sendNextQuestion()},
            {text:'📖 ПОДРОБНЕЕ',callback:()=>this.showStageDetails(this.currentStage)}
        ]);
    },

    showStageDetails(idx) {
        const stage = this.stages[idx];
        this.addMessageWithButtons('🔬 **ЭТАП '+stage.number+': '+stage.name+' — ПОДРОБНО**\n\n'+(stage.extendedDesc||stage.detailedDesc)+'\n\n👇 **НАЧИНАЕМ?**', [
            {text:'▶️ НАЧАТЬ ЭТАП',callback:()=>{ this.currentStage=idx; this.currentQuestionIndex=0; this.sendStageIntro(); }},
            {text:'◀️ НАЗАД',callback:()=>this.goToPreviousStage()}
        ]);
    },

    goToPreviousStage() {
        if (this.currentStage>0) { this.currentStage--; this.sendStageIntro(); }
        else this.showIntroScreen();
    },

    sendNextQuestion() {
        if (this.currentStage>=this.stages.length) { this.showFinalProfile(); return; }
        const stage = this.stages[this.currentStage];
        const questions = this.getCurrentQuestions();
        if (this.currentQuestionIndex>=stage.total) { this.completeCurrentStage(); return; }
        const q = questions[this.currentQuestionIndex];
        this.addQuestionMessage(q.text, q.options, (idx,opt)=>this.handleAnswer(stage.id,q,idx,opt), this.currentQuestionIndex+1, stage.total);
    },

    handleAnswer(stageId, q, idx, opt) {
        this.answers.push({ stage:stageId, questionIndex:this.currentQuestionIndex, question:q.text, answer:opt.text, option:idx, scores:opt.scores, level:opt.level, strategy:opt.strategy, dilts:opt.dilts, pattern:opt.pattern, target:q.target });

        if (stageId==='perception' && opt.scores) { for (const [k,v] of Object.entries(opt.scores)) this.perceptionScores[k]+=v; }
        if (stageId==='thinking' && opt.level) { this.thinkingScores[opt.level]=(this.thinkingScores[opt.level]||0)+1; if(q.measures&&q.measures!=='thinking') this.strategyLevels[q.measures].push(opt.level); }
        if (stageId==='behavior' && opt.level) { this.stage3Scores.push(opt.level); if(opt.strategy) this.behavioralLevels[opt.strategy].push(opt.level); }
        if (stageId==='growth' && opt.dilts) { this.diltsCounts[opt.dilts]=(this.diltsCounts[opt.dilts]||0)+1; }
        if (stageId==='deep') { this.deepAnswers.push({questionId:q.id,pattern:opt.pattern,target:q.target}); }

        this.saveProgress();
        this.currentQuestionIndex++;
        setTimeout(()=>this.sendNextQuestion(), 800);
    },

    completeCurrentStage() {
        const stage = this.stages[this.currentStage];
        if (stage.id==='perception') {
            this.perceptionType = this.determinePerceptionType();
            const isExt = this.perceptionType.includes('СОЦИАЛЬНО')||this.perceptionType.includes('СТАТУСНО');
            this.stages[1].total = (isExt?this.thinking_questions.external:this.thinking_questions.internal).length;
            this.showStage1Result();
        } else if (stage.id==='thinking') {
            this.thinkingLevel = this.calculateThinkingLevel();
            this.showStage2Result();
        } else if (stage.id==='behavior') {
            this.showStage3Result();
        } else if (stage.id==='growth') {
            this.profileData = this.calculateFinalProfile();
            this.showStage4Result();
        } else if (stage.id==='deep') {
            this.deepPatterns = this.analyzeDeepPatterns();
            this.showStage5Result();
        }
    },

    showStage1Result() {
        const type = this.perceptionType;
        const text = `🧠 ЭТАП 1: КОНФИГУРАЦИЯ ВОСПРИЯТИЯ

Твой тип: ${type}

${this.getStage1Interpretation()}

⬇️ Переходим к этапу 2 — исследуем, как ты мыслишь внутри этой конфигурации.`;
        this.addMessageWithButtons(text, [
            {text:'▶️ К ЭТАПУ 2',callback:()=>this.goToNextStage()},
            {text:'◀️ НАЗАД',callback:()=>this.goToPreviousStage()}
        ]);
    },

    showStage2Result() {
        const g = this.getLevelGroup(this.thinkingLevel);
        const levelName = {'1-3':'Конкретно-ситуативный','4-6':'Системный','7-9':'Мета-системный'}[g]||'';
        const text = `🧠 ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ

Уровень: ${levelName} (${this.thinkingLevel}/9)

${this.getStage2Interpretation()}

⬇️ Переходим к этапу 3 — исследуем твоё поведение.`;
        this.addMessageWithButtons(text, [
            {text:'▶️ К ЭТАПУ 3',callback:()=>this.goToNextStage()},
            {text:'◀️ НАЗАД',callback:()=>this.goToPreviousStage()}
        ]);
    },

    showStage3Result() {
        const avg = arr => arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):3;
        const sb=avg(this.behavioralLevels['СБ']),tf=avg(this.behavioralLevels['ТФ']),ub=avg(this.behavioralLevels['УБ']),cv=avg(this.behavioralLevels['ЧВ']);
        const l = this.calculateFinalLevel();
        const levelName = l<=3?'Реактивный':l<=6?'Активный':'Стратегический';
        const text = `🧠 ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ

Уровень: ${levelName} (${l}/9)

📊 Твои векторы:
• 🛡 СБ (реакция на угрозу): ${sb}/6
• 💰 ТФ (добыча ресурсов): ${tf}/6
• 🔍 УБ (понимание мира): ${ub}/6
• 🤝 ЧВ (отношения): ${cv}/6

${this.getStage3Interpretation()}

⬇️ Переходим к завершающему этапу.`;
        this.addMessageWithButtons(text, [
            {text:'▶️ К ЭТАПУ 4',callback:()=>this.goToNextStage()},
            {text:'◀️ НАЗАД',callback:()=>this.goToPreviousStage()}
        ]);
    },

    showStage4Result() {
        const p = this.calculateFinalProfile();
        const sbD = {1:'Под давлением замираете',2:'Избегаете конфликтов',3:'Внешне соглашаетесь',4:'Внешне спокойны',5:'Умеете защищать',6:'Защищаете и используете силу'}[p.sbLevel]||'—';
        const tfD = {1:'Деньги как повезёт',2:'Ищете возможности',3:'Зарабатываете трудом',4:'Хорошо зарабатываете',5:'Создаёте системы дохода',6:'Управляете капиталом'}[p.tfLevel]||'—';
        const ubD = {1:'Не думаете о сложном',2:'Верите в знаки',3:'Доверяете экспертам',4:'Ищете заговоры',5:'Анализируете факты',6:'Строите теории'}[p.ubLevel]||'—';
        const cvD = {1:'Сильно привязываетесь',2:'Подстраиваетесь',3:'Хотите нравиться',4:'Умеете влиять',5:'Строите равные отношения',6:'Создаёте сообщества'}[p.chvLevel]||'—';
        const gr  = {ENVIRONMENT:'Посмотрите вокруг — может, дело в обстоятельствах?',BEHAVIOR:'Попробуйте делать хоть что-то по-другому.',CAPABILITIES:'Развивайте новые навыки.',VALUES:'Поймите, что для вас действительно важно.',IDENTITY:'Ответьте себе на вопрос «кто я?»'}[p.dominantDilts]||'Начните с малого.';
        this.addMessageWithButtons('🧠 ПРЕДВАРИТЕЛЬНЫЙ ПОРТРЕТ\n\n📊 ТВОИ ВЕКТОРЫ:\n\n• СБ '+p.sbLevel+'/6: '+sbD+'\n• ТФ '+p.tfLevel+'/6: '+tfD+'\n• УБ '+p.ubLevel+'/6: '+ubD+'\n• ЧВ '+p.chvLevel+'/6: '+cvD+'\n\n🎯 Точка роста: '+gr+'\n\n👇 ЭТО ПОХОЖЕ НА ВАС?', [
            {text:'✅ ДА',callback:()=>this.profileConfirm()},
            {text:'❓ ЕСТЬ СОМНЕНИЯ',callback:()=>this.profileDoubt()},
            {text:'◀️ НАЗАД',callback:()=>this.goToPreviousStage()}
        ]);
    },

    profileConfirm() {
        this.addBotMessage('✅ Отлично! Тогда исследуем глубину...', true);
        setTimeout(()=>this.goToNextStage(), 1500);
    },

    profileDoubt() {
        this.addMessageWithButtons('🔍 ДАВАЙ УТОЧНИМ\n\nЧто именно вам не подходит?\n\n👇 Выберите и нажмите ДАЛЬШЕ', [
            {text:'🎭 Про людей',callback:()=>this.toggleDiscrepancy('people')},
            {text:'💰 Про деньги',callback:()=>this.toggleDiscrepancy('money')},
            {text:'🔍 Про знаки',callback:()=>this.toggleDiscrepancy('signs')},
            {text:'🤝 Про отношения',callback:()=>this.toggleDiscrepancy('relations')},
            {text:'🛡 Про давление',callback:()=>this.toggleDiscrepancy('sb')},
            {text:'➡️ ДАЛЬШЕ',callback:()=>this.clarifyNext()}
        ]);
    },

    toggleDiscrepancy(type) {
        if (this.discrepancies.includes(type)) this.discrepancies=this.discrepancies.filter(d=>d!==type);
        else this.discrepancies.push(type);
        this.saveProgress();
    },

    clarifyNext() {
        if (!this.discrepancies.length) { this.addBotMessage('⚠️ Выберите хотя бы одно расхождение!', true); return; }
        const lvls = {};
        for (const v of ['СБ','ТФ','УБ','ЧВ']) { const a=this.behavioralLevels[v]||[]; lvls[v]=a.length?a.reduce((a,b)=>a+b,0)/a.length:3; }
        const questions = this.getClarifyingQuestions(this.discrepancies, lvls);
        if (!questions.length) { this.addBotMessage('⚠️ Нет уточняющих вопросов', true); return; }
        this.clarifyingQuestions=questions; this.clarifyingCurrent=0;
        this.askClarifyingQuestion();
    },

    askClarifyingQuestion() {
        if (this.clarifyingCurrent>=this.clarifyingQuestions.length) {
            this.clarificationIteration++; this.saveProgress(); this.showStage4Result(); return;
        }
        const q = this.clarifyingQuestions[this.clarifyingCurrent];
        const options = Object.entries(q.options).map(([key,value])=>({
            text:value,
            callback:()=>{ this.clarifyingAnswers.push({question:q.text,answer:value,key,vector:q.vector,type:q.type}); this.clarifyingCurrent++; this.askClarifyingQuestion(); }
        }));
        options.push({text:'⏭ ПРОПУСТИТЬ',callback:()=>{ this.clarifyingCurrent++; this.askClarifyingQuestion(); }});
        this.addMessageWithButtons('🔍 УТОЧНЯЮЩИЙ ВОПРОС '+(this.clarifyingCurrent+1)+'/'+this.clarifyingQuestions.length+'\n\n'+q.text, options);
    },

    restartTest() { this.start(); },

    goToChat() {
        this.addBotMessage('👋 До свидания!\n\nБуду рад помочь, если решите вернуться.', true);
        setTimeout(()=>{ if(typeof renderDashboard==='function') renderDashboard(); else if(window.dashboard?.renderDashboard) window.dashboard.renderDashboard(); }, 2000);
    },

    showStage5Result() {
        const text = `🧠 ЭТАП 5: ГЛУБИННЫЕ ПАТТЕРНЫ

${this.getStage5Interpretation()}

✅ Тест завершён! Собираю воедино результаты 5 этапов...`;
        this.addBotMessage(text, true);
        this.sendTestResultsToServer();
    },

    goToNextStage() { this.currentStage++; this.currentQuestionIndex=0; this.sendStageIntro(); },

    // ============================================
    // СЕРВЕР / ФИНАЛ
    // ============================================
    async sendTestResultsToServer() {
        if (!this.userId) { this.showFinalProfileButtons(); return; }
        const profile = this.calculateFinalProfile();
        const deep = this.deepPatterns||{attachment:'🤗 Надежный'};
        try {
            const r = await fetch(TEST_API_BASE_URL+'/api/save-test-results', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    user_id:parseInt(this.userId), context:this.context,
                    results:{ perception_type:this.perceptionType, thinking_level:this.thinkingLevel, behavioral_levels:this.behavioralLevels, dilts_counts:this.diltsCounts, deep_patterns:deep, profile_data:profile, all_answers:this.answers, test_completed:true, test_completed_at:new Date().toISOString() }
                })
            });
            let data; try { data=await r.json(); } catch { data={success:r.ok}; }
            if (data.success) {
                await this.fetchAIGeneratedProfile();
                await this.completeMirrorIfReferred(profile, deep);
            } else { this.showFinalProfileButtons(); }
        } catch(error) { console.error('❌ Ошибка сети:', error); this.showFinalProfileButtons(); }
    },

    async completeMirrorIfReferred(profile, deep) {
    const mirrorCode = this.getMirrorCode();
    if (!mirrorCode) return;
    
    // ✅ Убираем префикс 'mirror_' если есть
    const cleanCode = mirrorCode.replace(/^mirror_/, '');
    
    try {
        const vectors = {
            'СБ': profile.sbLevel || 3,
            'ТФ': profile.tfLevel || 3,
            'УБ': profile.ubLevel || 3,
            'ЧВ': profile.chvLevel || 3
        };
        
        // ✅ Отправляем cleanCode (БЕЗ префикса mirror_)
        const response = await fetch(TEST_API_BASE_URL + '/api/mirrors/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mirror_code: cleanCode,  // ← БЕЗ mirror_!
                friend_user_id: this.userId,
                friend_name: this.context?.name || localStorage.getItem('fredi_user_name') || 'Друг',
                friend_profile_code: profile?.displayName || null,
                friend_vectors: vectors,
                friend_deep_patterns: deep || {},
                friend_ai_profile: this.aiGeneratedProfile || '',
                friend_perception_type: this.perceptionType,
                friend_thinking_level: this.thinkingLevel
            })
        });
        
        const result = await response.json();
        console.log('🪞 Mirror complete response:', result);
        
        if (result.success && result.activated) {
            localStorage.removeItem('fredi_mirror_ref');
            console.log('🪞 Зеркало активировано:', cleanCode);
        } else {
            console.warn('🪞 Зеркало не активировано:', result);
        }
    } catch(e) {
        console.error('⚠️ Ошибка активации зеркала:', e);
    }
}

    async fetchAIGeneratedProfile() {
        if (!this.userId) { this.showFinalProfileButtons(); return; }

        // Show loading animation on first call
        if (this._aiProfileRetries === 0) {
            this.addBotMessage('🧠 Генерирую ваш персональный AI-профиль...\n\n⏳ Это займёт 15-30 секунд. Анализирую ответы всех 5 этапов...', true);
        }

        try {
            const r = await fetch(TEST_API_BASE_URL+'/api/generated-profile/'+this.userId);
            const data = await r.json();
            if (data.success && data.ai_profile) {
                this.aiGeneratedProfile = data.ai_profile;
                this._aiProfileRetries = 0;
                this.showFinalProfileButtons();
                return;
            }
            if (data.status === 'generating' && this._aiProfileRetries < 15) {
                this._aiProfileRetries++;
                const dots = '.'.repeat(Math.min(this._aiProfileRetries, 5));
                const msgs = ['Анализирую ваши паттерны', 'Строю карту личности', 'Формирую инсайты', 'Почти готово'];
                const hint = msgs[Math.min(this._aiProfileRetries - 1, msgs.length - 1)];
                // Update last bot message text
                const allMsgs = document.querySelectorAll('.test-message-bot .test-message-text');
                const lastMsg = allMsgs[allMsgs.length - 1];
                if (lastMsg) lastMsg.innerHTML = `🧠 ${hint}${dots}<br><br>⏳ Осталось совсем немного...`;
                setTimeout(() => this.fetchAIGeneratedProfile(), 3000);
                return;
            }
        } catch(e) { console.error('Ошибка AI-профиля:', e); }
        this._aiProfileRetries = 0;
        this.showFinalProfileButtons();
    },

    showFinalProfileButtons() {
        const p = this.calculateFinalProfile();
        const deep = this.deepPatterns||{attachment:'🤗 Надежный'};
        const sbD = {1:'Под давлением замираете',2:'Избегаете конфликтов',3:'Внешне соглашаетесь',4:'Внешне спокойны',5:'Умеете защищать',6:'Защищаете и используете силу'}[p.sbLevel]||'—';
        const tfD = {1:'Деньги как повезёт',2:'Ищете возможности',3:'Зарабатываете трудом',4:'Хорошо зарабатываете',5:'Создаёте системы дохода',6:'Управляете капиталом'}[p.tfLevel]||'—';
        const ubD = {1:'Не думаете о сложном',2:'Верите в знаки',3:'Доверяете экспертам',4:'Ищете заговоры',5:'Анализируете факты',6:'Строите теории'}[p.ubLevel]||'—';
        const cvD = {1:'Сильно привязываетесь',2:'Подстраиваетесь',3:'Хотите нравиться',4:'Умеете влиять',5:'Строите равные отношения',6:'Создаёте сообщества'}[p.chvLevel]||'—';

        let text = `🧠 **ВАШ ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ**\n\n**Профиль:** ${p.displayName}\n**Тип восприятия:** ${p.perceptionType}\n**Уровень мышления:** ${p.thinkingLevel}/9\n\n**📊 ВАШИ ВЕКТОРЫ:**\n\n**СБ ${p.sbLevel}/6:** ${sbD}\n**ТФ ${p.tfLevel}/6:** ${tfD}\n**УБ ${p.ubLevel}/6:** ${ubD}\n**ЧВ ${p.chvLevel}/6:** ${cvD}\n\n**🧠 Глубинный паттерн:** ${deep.attachment}`;

        if (this.aiGeneratedProfile) {
            text += '\n\n**🧠 AI-СГЕНЕРИРОВАННЫЙ ПРОФИЛЬ:**\n\n' + this.aiGeneratedProfile.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        }

        this.addBotMessage(text, true);
        this.addMessageWithButtons('👇 **ЧТО ДАЛЬШЕ?**', [
            {text:'🧠 МЫСЛИ ПСИХОЛОГА',callback:()=>this.showPsychologistThought()},
            {text:'🏠 НА ГЛАВНУЮ',callback:()=>this.goToDashboard()}
        ]);

        if (this.userId) {
            try {
                localStorage.setItem('test_results_'+this.userId, JSON.stringify({
                    profile: p, deepPatterns:deep, perceptionType:this.perceptionType,
                    thinkingLevel:this.thinkingLevel, context:this.context, aiProfile:this.aiGeneratedProfile
                }));
            } catch(e) { console.warn('Failed to save test results to localStorage:', e); }
        }
    },

    goToDashboard() {
        const c = document.getElementById('screenContainer');
        if (c) c.innerHTML='';
        if (typeof renderDashboard==='function') renderDashboard();
        else if (window.dashboard?.renderDashboard) window.dashboard.renderDashboard();
    },

    async showPsychologistThought() {
        if (this.psychologistThought) {
            const t = this.psychologistThought.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
            this.addBotMessage('🧠 <strong>МЫСЛИ ПСИХОЛОГА</strong><br><br>'+t, true);
            this.addMessageWithButtons('', [{text:'🏠 НА ГЛАВНУЮ',callback:()=>this.goToDashboard()}]);
            return;
        }
        this.addBotMessage('🧠 Генерирую мысли психолога...', true);
        try {
            const r = await fetch(TEST_API_BASE_URL+'/api/psychologist-thought/'+this.userId);
            const data = await r.json();
            if (data.success && data.thought) {
                this.psychologistThought = data.thought;
                const t = data.thought.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
                this.addBotMessage('🧠 <strong>МЫСЛИ ПСИХОЛОГА</strong><br><br>'+t, true);
            } else {
                this.addBotMessage('🧠 Мысли психолога будут доступны через несколько секунд.', true);
            }
        } catch(e) {
            this.addBotMessage('🧠 Мысли психолога временно недоступны. Попробуйте позже.', true);
        }
        this.addMessageWithButtons('', [
            {text:'🧠 К ПРОФИЛЮ',callback:()=>this.showFinalProfileButtons()},
            {text:'🏠 НА ГЛАВНУЮ',callback:()=>this.goToDashboard()}
        ]);
    }
};

window.Test = Test;

// Автозапуск теста при ?ref=mirror_
(function checkMirrorRef() {
    var ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && ref.startsWith('mirror_')) {
        localStorage.setItem('fredi_mirror_ref', ref);
        console.log('🪞 Mirror ref detected in URL:', ref);
        function waitAndStart() {
            if (typeof startTest === 'function') {
                startTest();
            } else if (typeof window.startTest === 'function') {
                window.startTest();
            } else {
                var testItem = document.querySelector('[data-chat="test"]');
                if (testItem) testItem.click();
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(waitAndStart, 300); });
        } else {
            setTimeout(waitAndStart, 300);
        }
    }
})();

console.log('✅ Модуль теста загружен (версия 5.2 - патчи влиты)');
