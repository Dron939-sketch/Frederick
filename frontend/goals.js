// ============================================
// goals.js — Цели и маршруты достижения
// Версия 2.0 — единый стиль с проектом
// ============================================

// ============================================
// CSS — один раз
// ============================================
function _goalsInjectStyles() {
    if (document.getElementById('goals-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'goals-v2-styles';
    s.textContent = `
        /* ===== ПРОФИЛЬ ===== */
        .gl-profile-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.06), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.15);
            border-radius: 18px;
            padding: 14px;
            text-align: center;
            margin-bottom: 22px;
        }
        .gl-profile-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 5px;
        }
        .gl-profile-code {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: 600;
            color: var(--chrome);
        }

        /* ===== ДИНАМИЧЕСКИЕ ЦЕЛИ ===== */
        .gl-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        .gl-dynamic-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 24px;
        }
        .gl-dynamic-item {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px;
            padding: 12px 14px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            touch-action: manipulation;
        }
        .gl-dynamic-item:hover {
            background: rgba(224,224,224,0.09);
            border-color: rgba(224,224,224,0.22);
            transform: translateX(3px);
        }
        .gl-dynamic-item:active { transform: scale(0.98); }
        .gl-dynamic-diff { font-size: 14px; flex-shrink: 0; }
        .gl-dynamic-body { flex: 1; min-width: 0; }
        .gl-dynamic-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 2px;
        }
        .gl-dynamic-meta { font-size: 10px; color: var(--text-secondary); }
        .gl-dynamic-arrow { font-size: 16px; color: var(--silver-brushed); flex-shrink: 0; }

        /* ===== КАТЕГОРИИ ===== */
        .gl-cats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 22px;
        }
        .gl-cat-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 16px 14px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            position: relative;
            touch-action: manipulation;
        }
        .gl-cat-card:hover {
            background: rgba(224,224,224,0.09);
            border-color: rgba(224,224,224,0.22);
            transform: translateY(-2px);
        }
        .gl-cat-card:active { transform: scale(0.98); }
        .gl-cat-icon { font-size: 28px; display: block; margin-bottom: 7px; line-height: 1.1; }
        .gl-cat-name { font-size: 13px; font-weight: 700; letter-spacing: 0.2px; color: var(--text-primary); margin-bottom: 3px; }
        .gl-cat-desc { font-size: 10px; color: var(--text-secondary); line-height: 1.4; }
        .gl-cat-arrow {
            position: absolute;
            bottom: 12px;
            right: 12px;
            font-size: 14px;
            color: var(--silver-brushed);
        }

        /* ===== СВОЯ ЦЕЛЬ ===== */
        .gl-custom-block {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 18px;
            padding: 16px;
        }
        .gl-custom-textarea {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--text-primary);
            font-size: 14px;
            font-family: inherit;
            margin-bottom: 10px;
            resize: vertical;
            outline: none;
            box-sizing: border-box;
            -webkit-appearance: none;
            appearance: none;
        }
        .gl-custom-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .gl-custom-textarea::placeholder { color: var(--text-secondary); }
        .gl-custom-btn {
            width: 100%;
            padding: 13px;
            background: linear-gradient(135deg, rgba(224,224,224,0.18), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            border-radius: 40px;
            color: var(--text-primary);
            font-weight: 600;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            touch-action: manipulation;
        }
        .gl-custom-btn:hover { background: linear-gradient(135deg, rgba(224,224,224,0.25), rgba(192,192,192,0.16)); }
        .gl-custom-btn:active { transform: scale(0.98); }

        /* ===== СПИСОК ЦЕЛЕЙ КАТЕГОРИИ ===== */
        .gl-goals-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 16px;
        }
        .gl-goal-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            touch-action: manipulation;
        }
        .gl-goal-item:hover { background: rgba(224,224,224,0.09); }
        .gl-goal-item:active { transform: scale(0.98); }
        .gl-goal-item-top {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 5px;
            flex-wrap: wrap;
        }
        .gl-goal-item-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .gl-goal-item-time { font-size: 10px; color: var(--text-secondary); margin-left: auto; }
        .gl-goal-item-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; }
        .gl-goal-item-cta {
            display: inline-block;
            background: transparent;
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 30px;
            padding: 5px 12px;
            font-size: 11px;
            color: var(--text-secondary);
            font-family: inherit;
            cursor: pointer;
            transition: border-color 0.2s, color 0.2s;
        }
        .gl-goal-item-cta:hover { border-color: rgba(224,224,224,0.35); color: var(--text-primary); }

        /* ===== ДЕТАЛИ ЦЕЛИ ===== */
        .gl-desc-block {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px;
            padding: 14px;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 14px;
        }
        .gl-adapt-note {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.5;
        }

        /* ===== ШАГИ МАРШРУТА ===== */
        .gl-route-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 22px;
        }
        .gl-route-step {
            display: flex;
            gap: 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px;
        }
        .gl-step-num {
            width: 26px;
            height: 26px;
            background: rgba(224,224,224,0.12);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: var(--chrome);
            flex-shrink: 0;
            margin-top: 1px;
        }
        .gl-step-body { flex: 1; min-width: 0; }
        .gl-step-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
        .gl-step-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 4px; }
        .gl-step-dur { font-size: 10px; color: var(--text-secondary); }

        /* ===== КНОПКИ ЦЕЛИ ===== */
        .gl-goal-actions { display: flex; gap: 10px; }
        .gl-btn {
            flex: 1;
            padding: 13px 16px;
            border-radius: 40px;
            font-weight: 600;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 46px;
            touch-action: manipulation;
            outline: none;
        }
        .gl-btn:active { transform: scale(0.97); }
        .gl-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            color: var(--text-primary);
        }
        .gl-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.18)); }
        .gl-btn-ghost {
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.16);
            color: var(--text-secondary);
        }
        .gl-btn-ghost:hover { background: rgba(224,224,224,0.12); color: var(--text-primary); }

        /* ===== АКТИВНЫЙ МАРШРУТ ===== */
        .gl-progress-bar {
            height: 3px;
            background: rgba(224,224,224,0.1);
            border-radius: 2px;
            margin: 12px 0 6px;
            overflow: hidden;
        }
        .gl-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--silver-brushed), var(--chrome));
            border-radius: 2px;
            transition: width 0.4s;
        }
        .gl-progress-text { font-size: 11px; color: var(--text-secondary); }

        .gl-current-step {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.03));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 22px;
            padding: 22px;
            margin: 18px 0;
            text-align: center;
        }
        .gl-step-badge {
            display: inline-block;
            background: rgba(224,224,224,0.12);
            border-radius: 30px;
            padding: 4px 12px;
            font-size: 10px;
            letter-spacing: 0.5px;
            color: var(--chrome);
            margin-bottom: 12px;
        }
        .gl-current-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
        .gl-current-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.5; }
        .gl-current-dur { font-size: 11px; color: var(--text-secondary); }

        .gl-upcoming {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 18px;
            padding: 14px;
            margin-top: 20px;
        }
        .gl-upcoming-title { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; }
        .gl-upcoming-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(224,224,224,0.05);
        }
        .gl-upcoming-item:last-child { border-bottom: none; }
        .gl-upcoming-num {
            width: 20px;
            height: 20px;
            background: rgba(224,224,224,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: var(--text-secondary);
            flex-shrink: 0;
        }
        .gl-upcoming-name { flex: 1; font-size: 12px; color: var(--text-secondary); }
        .gl-upcoming-dur { font-size: 10px; color: var(--text-secondary); }

        /* ===== ЗАВЕРШЕНИЕ ===== */
        .gl-done-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.03));
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 28px;
            padding: 32px;
            text-align: center;
            margin: 20px 0;
        }
        .gl-done-icon { font-size: 60px; margin-bottom: 14px; display: block; }
        .gl-done-title { font-size: 20px; font-weight: 700; color: var(--chrome); margin-bottom: 10px; }
        .gl-done-text { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        @media (max-width: 480px) {
            .gl-cats-grid { gap: 8px; }
            .gl-cat-card { padding: 14px 12px; }
            .gl-cat-icon { font-size: 24px; }
            .gl-btn { font-size: 12px; padding: 12px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// БАЗА ДАННЫХ ЦЕЛЕЙ
// ============================================
const GOALS_DB = {
    categories: {
        business:      { name:'БИЗНЕС',    emoji:'💼', desc:'Продвижение, узнаваемость, продажи' },
        career:        { name:'КАРЬЕРА',   emoji:'📈', desc:'Рост, развитие, переход' },
        relationships: { name:'ОТНОШЕНИЯ', emoji:'👥', desc:'Семья, друзья, партнёр' },
        personality:   { name:'ЛИЧНОСТЬ',  emoji:'🎨', desc:'Саморазвитие, призвание' },
        health:        { name:'ЗДОРОВЬЕ',  emoji:'💪', desc:'Энергия, сон, спорт' },
        money:         { name:'ФИНАНСЫ',   emoji:'💰', desc:'Доход, инвестиции, свобода' }
    },
    goals: {
        business_reputation: { id:'business_reputation', name:'Повысить узнаваемость бизнеса', category:'business', time:'2–3 месяца', difficulty:'medium', desc:'Создать общественное мнение и узнаваемость бренда', steps:[{id:1,title:'Анализ позиционирования',desc:'Изучите, как вас воспринимают сейчас',dur:'3 дня'},{id:2,title:'Определение УТП',desc:'Сформулируйте уникальное торговое предложение',dur:'2 дня'},{id:3,title:'Анализ конкурентов',desc:'Изучите, как продвигаются другие',dur:'4 дня'},{id:4,title:'Выбор каналов',desc:'Определите, где ваша аудитория',dur:'2 дня'},{id:5,title:'Контент-план',desc:'Распланируйте публикации',dur:'3 дня'},{id:6,title:'Пилотный запуск',desc:'Опубликуйте первый материал и оцените отклик',dur:'1 неделя'}] },
        business_clients:    { id:'business_clients', name:'Привлечь новых клиентов', category:'business', time:'1–2 месяца', difficulty:'medium', desc:'Увеличить клиентскую базу', steps:[{id:1,title:'Анализ аудитории',desc:'Кто ваши идеальные клиенты?',dur:'3 дня'},{id:2,title:'Портрет клиента',desc:'Опишите боли и потребности',dur:'2 дня'},{id:3,title:'Разработка оффера',desc:'Предложение, от которого нельзя отказаться',dur:'3 дня'},{id:4,title:'Воронка продаж',desc:'Постройте путь клиента',dur:'5 дней'},{id:5,title:'Запуск рекламы',desc:'Протестируйте каналы привлечения',dur:'7 дней'},{id:6,title:'Оптимизация',desc:'Улучшайте конверсию',dur:'5 дней'}] },
        career_growth:       { id:'career_growth', name:'Повышение в должности', category:'career', time:'3–6 месяцев', difficulty:'hard', desc:'Получить повышение или новую должность', steps:[{id:1,title:'Аудит навыков',desc:'Оцените текущие компетенции',dur:'3 дня'},{id:2,title:'Анализ требований',desc:'Что нужно для желаемой должности?',dur:'2 дня'},{id:3,title:'План развития',desc:'Составьте roadmap обучения',dur:'3 дня'},{id:4,title:'Прокачка навыков',desc:'Начните обучение',dur:'4–8 недель'},{id:5,title:'Демонстрация результатов',desc:'Покажите свою ценность руководству',dur:'2 недели'},{id:6,title:'Разговор с руководством',desc:'Запросите повышение',dur:'1 день'}] },
        career_change:       { id:'career_change', name:'Смена профессии', category:'career', time:'6–12 месяцев', difficulty:'hard', desc:'Начать новую карьеру', steps:[{id:1,title:'Самоанализ',desc:'Что вам действительно нравится?',dur:'1 неделя'},{id:2,title:'Исследование рынка',desc:'Какие профессии востребованы?',dur:'1 неделя'},{id:3,title:'Выбор направления',desc:'Определитесь с новой профессией',dur:'3 дня'},{id:4,title:'Обучение',desc:'Получите необходимые навыки',dur:'3–6 месяцев'},{id:5,title:'Портфолио',desc:'Соберите примеры работ',dur:'1 месяц'},{id:6,title:'Поиск работы',desc:'Активный поиск и собеседования',dur:'1–2 месяца'}] },
        relationships_partner:{ id:'relationships_partner', name:'Найти партнёра', category:'relationships', time:'3–6 месяцев', difficulty:'medium', desc:'Встретить человека для серьёзных отношений', steps:[{id:1,title:'Самоанализ',desc:'Кто вам нужен и что вы готовы дать?',dur:'3 дня'},{id:2,title:'Работа над собой',desc:'Станьте лучшей версией себя',dur:'2–4 недели'},{id:3,title:'Расширение круга',desc:'Новые места и знакомства',dur:'2 недели'},{id:4,title:'Активный поиск',desc:'Дейтинги, мероприятия, приложения',dur:'1–2 месяца'},{id:5,title:'Выстраивание отношений',desc:'От первых свиданий к близости',dur:'1–2 месяца'}] },
        relationships_family: { id:'relationships_family', name:'Улучшить отношения с близкими', category:'relationships', time:'1–2 месяца', difficulty:'medium', desc:'Гармония в семье и с друзьями', steps:[{id:1,title:'Анализ проблем',desc:'Что именно не устраивает?',dur:'3 дня'},{id:2,title:'Открытый разговор',desc:'Обсудите важное с близкими',dur:'1 день'},{id:3,title:'Активное слушание',desc:'Учитесь слышать других',dur:'1–2 недели'},{id:4,title:'Выстраивание границ',desc:'Научитесь говорить «нет»',dur:'2 недели'},{id:5,title:'Совместное время',desc:'Регулярные семейные ритуалы',dur:'2–4 недели'}] },
        personality_purpose:  { id:'personality_purpose', name:'Найти предназначение', category:'personality', time:'2–3 месяца', difficulty:'hard', desc:'Понять своё призвание', steps:[{id:1,title:'Рефлексия прошлого',desc:'Что вам всегда нравилось?',dur:'1 неделя'},{id:2,title:'Тесты на профориентацию',desc:'Пройдите специальные тесты',dur:'3 дня'},{id:3,title:'Интервью с экспертами',desc:'Поговорите с людьми из разных сфер',dur:'2 недели'},{id:4,title:'Пробные погружения',desc:'Попробуйте разные деятельности',dur:'3–4 недели'},{id:5,title:'Выбор направления',desc:'Определитесь с путём',dur:'1 неделя'},{id:6,title:'Plan действий',desc:'Составьте roadmap',dur:'3 дня'}] },
        personality_confidence:{ id:'personality_confidence', name:'Повысить уверенность', category:'personality', time:'1–2 месяца', difficulty:'easy', desc:'Стать увереннее в себе', steps:[{id:1,title:'Дневник достижений',desc:'Записывайте свои победы каждый день',dur:'2 недели'},{id:2,title:'Работа с критикой',desc:'Как принимать обратную связь',dur:'1 неделя'},{id:3,title:'Язык тела',desc:'Уверенные позы и жесты',dur:'1 неделя'},{id:4,title:'Выход из зоны комфорта',desc:'Маленькие шаги каждый день',dur:'2–3 недели'},{id:5,title:'Публичные выступления',desc:'Тренировка речи и презентации себя',dur:'2 недели'}] },
        health_energy:         { id:'health_energy', name:'Повысить энергию', category:'health', time:'3–4 недели', difficulty:'easy', desc:'Чувствовать себя бодрее', steps:[{id:1,title:'Анализ режима сна',desc:'Сколько и как вы спите?',dur:'3 дня'},{id:2,title:'Нормализация сна',desc:'Ложитесь и вставайте в одно время',dur:'1 неделя'},{id:3,title:'Питание для энергии',desc:'Что есть для бодрости',dur:'1 неделя'},{id:4,title:'Физическая активность',desc:'Утренняя зарядка хотя бы 10 минут',dur:'1 неделя'},{id:5,title:'Управление стрессом',desc:'Техники релаксации',dur:'1 неделя'}] },
        health_habit:          { id:'health_habit', name:'Сформировать полезную привычку', category:'health', time:'21 день', difficulty:'easy', desc:'Внедрить новую привычку в жизнь', steps:[{id:1,title:'Выбор привычки',desc:'Что именно вы хотите внедрить?',dur:'1 день'},{id:2,title:'Микро-шаг',desc:'Начните с 2 минут в день',dur:'1 неделя'},{id:3,title:'Наращивание',desc:'Постепенно увеличивайте время и сложность',dur:'1 неделя'},{id:4,title:'Закрепление',desc:'Сделайте привычку автоматической',dur:'1 неделя'},{id:5,title:'Поддержание',desc:'Не сдавайтесь в трудные дни',dur:'ongoing'}] },
        money_income:          { id:'money_income', name:'Увеличить доход', category:'money', time:'3–6 месяцев', difficulty:'hard', desc:'Зарабатывать больше', steps:[{id:1,title:'Анализ расходов',desc:'Куда уходят деньги?',dur:'1 неделя'},{id:2,title:'Аудит навыков',desc:'Что вы умеете и что стоит на рынке?',dur:'3 дня'},{id:3,title:'Поиск возможностей',desc:'Как монетизировать навыки?',dur:'1 неделя'},{id:4,title:'Дополнительный доход',desc:'Подработка или фриланс',dur:'2 недели'},{id:5,title:'Масштабирование',desc:'Увеличивайте доходность',dur:'1–2 месяца'},{id:6,title:'Инвестиции',desc:'Заставьте деньги работать',dur:'1–2 месяца'}] },
        money_savings:         { id:'money_savings', name:'Накопить на цель', category:'money', time:'3–12 месяцев', difficulty:'medium', desc:'Собрать нужную сумму', steps:[{id:1,title:'Постановка цели',desc:'Сколько и на что копим?',dur:'1 день'},{id:2,title:'Анализ бюджета',desc:'Доходы и расходы',dur:'1 неделя'},{id:3,title:'Сокращение трат',desc:'От чего можно отказаться?',dur:'2 недели'},{id:4,title:'План накоплений',desc:'Сколько откладывать ежемесячно',dur:'3 дня'},{id:5,title:'Автоматизация',desc:'Настройте автоплатежи',dur:'1 день'},{id:6,title:'Контроль',desc:'Отслеживайте прогресс каждую неделю',dur:'ongoing'}] }
    }
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._goalsState) window._goalsState = {
    vectors: {СБ:4,ТФ:4,УБ:4,ЧВ:4},
    currentGoal: null,
    currentRoute: null,
    currentStep: 1,
    progress: []
};
const _gs = window._goalsState;

// ============================================
// УТИЛИТЫ
// ============================================
function _glToast(msg) { if (window.showToast) window.showToast(msg, 'info'); }
function _glHome() { if (typeof renderDashboard === 'function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _glApi() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _glUid() { return window.CONFIG?.USER_ID; }

const DIFF_ICON = { easy:'🟢', medium:'🟡', hard:'🔴' };

// ============================================
// ЗАГРУЗКА ВЕКТОРОВ
// ============================================
async function _glLoadVectors() {
    try {
        const r = await fetch(`${_glApi()}/api/get-profile/${_glUid()}`);
        const d = await r.json();
        const bl = d.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x || 4);
        _gs.vectors = { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
    } catch { /* дефолт */ }
}

// ============================================
// ДИНАМИЧЕСКИЙ ПОДБОР ЦЕЛЕЙ
// ============================================
function _glDynamicGoals() {
    const v = _gs.vectors;
    const sorted = Object.entries(v).sort((a,b) => a[1]-b[1]);
    const weakest  = sorted[0]?.[0] || 'СБ';
    const strongest = sorted[3]?.[0] || 'ЧВ';

    const map = {
        'СБ': ['business_reputation','career_growth','personality_confidence'],
        'ТФ': ['money_income','money_savings','business_clients'],
        'УБ': ['career_change','personality_purpose','business_reputation'],
        'ЧВ': ['relationships_partner','relationships_family','personality_confidence']
    };

    const ids = [
        ...(map[weakest] || []),
        ...(map[strongest] || []).slice(0, 2),
        'health_energy', 'health_habit'
    ];

    const seen = new Set();
    return ids
        .map(id => GOALS_DB.goals[id])
        .filter(g => g && !seen.has(g.id) && seen.add(g.id))
        .slice(0, 8);
}

// ============================================
// АДАПТАЦИЯ ШАГОВ
// ============================================
function _glAdapt(steps) {
    const v = _gs.vectors;
    return steps.map(step => {
        const hints = [];
        if (v.УБ >= 5) hints.push('создайте чек-лист для контроля');
        if (v.ЧВ >= 5) hints.push('обсудите с близкими для поддержки');
        if (v.СБ >= 5) hints.push('сделайте это публично — закрепит успех');
        const extra = hints.length ? ` (${hints[0]})` : '';
        return { ...step, desc: step.desc + extra };
    });
}

function _glAdaptNote() {
    const v = _gs.vectors;
    const strong = [];
    if (v.СБ >= 5) strong.push('уверенность');
    if (v.ТФ >= 5) strong.push('финансовое мышление');
    if (v.УБ >= 5) strong.push('системность');
    if (v.ЧВ >= 5) strong.push('эмпатию');
    return strong.length
        ? `🧬 Маршрут учитывает вашу сильную сторону: ${strong.join(', ')}`
        : '🧬 Маршрут адаптирован под ваш психотип';
}

// ============================================
// КАСТОМНЫЙ ДИАЛОГ (вместо prompt)
// ============================================
function _glCustomGoalDialog(container, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
        <div style="background:var(--carbon-fiber);border:1px solid rgba(224,224,224,0.2);border-radius:24px;padding:24px;max-width:340px;width:100%">
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Опишите вашу цель</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px">Например: хочу открыть своё дело через 6 месяцев</div>
            <textarea id="glCustomInput" style="width:100%;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.18);border-radius:12px;padding:12px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none;resize:vertical;box-sizing:border-box;min-height:80px" placeholder="Ваша цель..."></textarea>
            <div style="display:flex;gap:10px;margin-top:14px">
                <button id="glCustomCancel" style="flex:1;padding:12px;border-radius:30px;background:transparent;border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;font-size:13px;cursor:pointer;min-height:44px">Отмена</button>
                <button id="glCustomOk" style="flex:1;padding:12px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:44px">Создать</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('glCustomInput').focus();
    document.getElementById('glCustomCancel').onclick = () => overlay.remove();
    document.getElementById('glCustomOk').onclick = () => {
        const val = document.getElementById('glCustomInput').value.trim();
        if (!val) return;
        overlay.remove();
        onConfirm(val);
    };
}

function _glMakeCustom(text) {
    return {
        id: 'custom_' + Date.now(),
        name: text,
        category: 'custom',
        time: 'индивидуально',
        difficulty: 'medium',
        desc: text,
        isCustom: true,
        steps: [
            {id:1, title:'Анализ цели',    desc:'Разбейте цель на подзадачи', dur:'2 дня'},
            {id:2, title:'Планирование',    desc:'Составьте пошаговый план',   dur:'3 дня'},
            {id:3, title:'Первый шаг',      desc:'Начните прямо сейчас',        dur:'1 день'},
            {id:4, title:'Контроль',        desc:'Отслеживайте прогресс',       dur:'ongoing'}
        ]
    };
}

// ============================================
// ЭКРАНЫ
// ============================================

function _glRenderMain() {
    _goalsInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const v = _gs.vectors;
    const dyn = _glDynamicGoals();

    const dynHtml = dyn.length ? `
        <div class="gl-section-label" style="margin-bottom:10px">🎯 Подобрано для вас</div>
        <div class="gl-dynamic-list">
            ${dyn.map(g => `
                <div class="gl-dynamic-item" data-goal="${g.id}">
                    <div class="gl-dynamic-diff">${DIFF_ICON[g.difficulty]||'⚪'}</div>
                    <div class="gl-dynamic-body">
                        <div class="gl-dynamic-name">${g.name}</div>
                        <div class="gl-dynamic-meta">⏱ ${g.time}</div>
                    </div>
                    <div class="gl-dynamic-arrow">›</div>
                </div>`).join('')}
        </div>` : '';

    const catsHtml = Object.entries(GOALS_DB.categories).map(([key, cat]) => `
        <div class="gl-cat-card" data-cat="${key}">
            <span class="gl-cat-icon">${cat.emoji}</span>
            <div class="gl-cat-name">${cat.name}</div>
            <div class="gl-cat-desc">${cat.desc}</div>
            <div class="gl-cat-arrow">›</div>
        </div>`).join('');

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="glBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Цели</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Выберите цель или опишите свою</p>
            </div>
            <div class="gl-profile-card">
                <div class="gl-profile-label">🧬 Ваш профиль</div>
                <div class="gl-profile-code">СБ-${v.СБ} · ТФ-${v.ТФ} · УБ-${v.УБ} · ЧВ-${v.ЧВ}</div>
            </div>
            ${dynHtml}
            <div class="gl-section-label" style="margin-bottom:10px">📂 Категории</div>
            <div class="gl-cats-grid">${catsHtml}</div>
            <div class="gl-custom-block">
                <div class="gl-section-label" style="margin-bottom:8px">✏️ Своя цель</div>
                <textarea class="gl-custom-textarea" id="glCustomInput" rows="2"
                    placeholder="Например: хочу открыть своё дело через 6 месяцев"></textarea>
                <button class="gl-custom-btn" id="glCustomBtn">🔍 Подобрать маршрут</button>
            </div>
        </div>`;

    document.getElementById('glBack').onclick = () => _glHome();

    document.querySelectorAll('.gl-dynamic-item').forEach(el => {
        el.addEventListener('click', () => {
            const g = GOALS_DB.goals[el.dataset.goal];
            if (g) _glRenderDetail(g);
        });
    });

    document.querySelectorAll('.gl-cat-card').forEach(el => {
        el.addEventListener('click', () => _glRenderCategory(el.dataset.cat));
    });

    document.getElementById('glCustomBtn').onclick = () => {
        const val = document.getElementById('glCustomInput').value.trim();
        if (val) _glRenderDetail(_glMakeCustom(val));
        else _glToast('Введите вашу цель');
    };
}

function _glRenderCategory(catKey) {
    _goalsInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const cat   = GOALS_DB.categories[catKey];
    const goals = Object.values(GOALS_DB.goals).filter(g => g.category === catKey);

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="glCatBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${cat.emoji}</div>
                <h1 class="content-title">${cat.name}</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">${cat.desc}</p>
            </div>
            <div class="gl-goals-list">
                ${goals.map(g => `
                    <div class="gl-goal-item" data-goal="${g.id}">
                        <div class="gl-goal-item-top">
                            <span>${DIFF_ICON[g.difficulty]||'⚪'}</span>
                            <span class="gl-goal-item-name">${g.name}</span>
                            <span class="gl-goal-item-time">⏱ ${g.time}</span>
                        </div>
                        <div class="gl-goal-item-desc">${g.desc}</div>
                        <button class="gl-goal-item-cta">📋 Подробнее →</button>
                    </div>`).join('')}
            </div>
            <div style="margin-top:8px">
                <button class="gl-custom-btn" id="glCatCustomBtn">✏️ Сформулировать свою цель</button>
            </div>
        </div>`;

    document.getElementById('glCatBack').onclick = () => _glRenderMain();

    document.querySelectorAll('.gl-goal-item').forEach(el => {
        el.addEventListener('click', () => {
            const g = GOALS_DB.goals[el.dataset.goal];
            if (g) _glRenderDetail(g);
        });
    });

    document.getElementById('glCatCustomBtn').onclick = () => {
        _glCustomGoalDialog(c, text => _glRenderDetail(_glMakeCustom(text)));
    };
}

function _glRenderDetail(goal) {
    _goalsInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const steps = _glAdapt(goal.steps || []);
    _gs.currentGoal  = goal;
    _gs.currentRoute = steps;

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="glDetailBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${DIFF_ICON[goal.difficulty]||'🎯'}</div>
                <h1 class="content-title">${goal.name}</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">⏱ ${goal.time}</p>
            </div>
            <div class="gl-desc-block">${goal.desc}</div>
            <div class="gl-adapt-note">${_glAdaptNote()}</div>
            <div class="gl-section-label" style="margin-bottom:10px">📋 Маршрут достижения</div>
            <div class="gl-route-list">
                ${steps.map((step,i) => `
                    <div class="gl-route-step">
                        <div class="gl-step-num">${i+1}</div>
                        <div class="gl-step-body">
                            <div class="gl-step-title">${step.title}</div>
                            <div class="gl-step-desc">${step.desc}</div>
                            <div class="gl-step-dur">⏱ ${step.dur||step.duration||''}</div>
                        </div>
                    </div>`).join('')}
            </div>
            <div class="gl-goal-actions">
                <button class="gl-btn gl-btn-primary" id="glStartBtn">🚀 Начать</button>
                <button class="gl-btn gl-btn-ghost" id="glSaveBtn">💾 Сохранить</button>
            </div>
        </div>`;

    document.getElementById('glDetailBack').onclick = () => {
        if (goal.isCustom || !goal.category) _glRenderMain();
        else _glRenderCategory(goal.category);
    };

    document.getElementById('glStartBtn').onclick = () => {
        _gs.currentStep = 1;
        _gs.progress = [];
        _glSaveProgress(goal.id, {step:1, progress:[]});
        _glRenderRoute(goal, steps, 1);
    };

    document.getElementById('glSaveBtn').onclick = () => {
        const saved = JSON.parse(localStorage.getItem('saved_goals')||'[]');
        if (!saved.some(g => g.id === goal.id)) {
            saved.push({id:goal.id, name:goal.name, savedAt:new Date().toISOString()});
            localStorage.setItem('saved_goals', JSON.stringify(saved));
        }
        _glToast(`✅ Цель «${goal.name}» сохранена`);
    };
}

function _glRenderRoute(goal, steps, step) {
    _goalsInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const cur     = steps[step-1];
    const pct     = Math.round(((step-1)/steps.length)*100);
    const upcoming= steps.slice(step, step+3);

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="glRouteBack">◀️ К цели</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">${goal.name}</h1>
                <div class="gl-progress-bar"><div class="gl-progress-fill" style="width:${pct}%"></div></div>
                <div class="gl-progress-text">Шаг ${step} из ${steps.length} · ${pct}%</div>
            </div>
            <div class="gl-current-step">
                <div class="gl-step-badge">ТЕКУЩИЙ ШАГ</div>
                <div class="gl-current-title">${cur.title}</div>
                <div class="gl-current-desc">${cur.desc}</div>
                <div class="gl-current-dur">⏱ ${cur.dur||cur.duration||''}</div>
            </div>
            <div class="gl-goal-actions">
                <button class="gl-btn gl-btn-primary" id="glDoneBtn">✅ Выполнил</button>
                <button class="gl-btn gl-btn-ghost" id="glAskBtn">❓ Спросить Фреди</button>
            </div>
            ${upcoming.length ? `
            <div class="gl-upcoming">
                <div class="gl-upcoming-title">Предстоящие шаги</div>
                ${upcoming.map((s,i) => `
                    <div class="gl-upcoming-item">
                        <div class="gl-upcoming-num">${step+i+1}</div>
                        <div class="gl-upcoming-name">${s.title}</div>
                        <div class="gl-upcoming-dur">${s.dur||s.duration||''}</div>
                    </div>`).join('')}
            </div>` : ''}
        </div>`;

    document.getElementById('glRouteBack').onclick = () => _glRenderDetail(goal);

    document.getElementById('glDoneBtn').onclick = () => {
        _gs.progress.push(step);
        const next = step + 1;
        _gs.currentStep = next;
        _glSaveProgress(goal.id, {step: next, progress: _gs.progress});
        if (next > steps.length) _glRenderDone(goal);
        else {
            _glToast(`✅ Шаг ${step} выполнен!`);
            _glRenderRoute(goal, steps, next);
        }
    };

    document.getElementById('glAskBtn').onclick = () => {
        _glToast('Задайте вопрос Фреди в главном чате');
    };
}

function _glRenderDone(goal) {
    _goalsInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    localStorage.removeItem(`goal_${goal.id}_progress`);

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="glDoneBack">◀️ Цели</button>
            <div class="content-header">
                <div class="content-emoji">🎉</div>
                <h1 class="content-title">Поздравляю!</h1>
            </div>
            <div class="gl-done-card">
                <span class="gl-done-icon">🏆</span>
                <div class="gl-done-title">Маршрут завершён</div>
                <div class="gl-done-text">
                    Вы прошли все шаги и достигли цели<br>«${goal.name}».<br><br>
                    Это важный результат — гордитесь собой.
                </div>
            </div>
            <div class="gl-goal-actions">
                <button class="gl-btn gl-btn-primary" id="glNewGoal">🎯 Новая цель</button>
                <button class="gl-btn gl-btn-ghost" id="glShareDone">📤 Поделиться</button>
            </div>
        </div>`;

    document.getElementById('glDoneBack').onclick  = () => _glRenderMain();
    document.getElementById('glNewGoal').onclick   = () => _glRenderMain();
    document.getElementById('glShareDone').onclick = () => _glToast('Поделиться — скоро');
}

// ============================================
// УТИЛИТА ПРОГРЕССА
// ============================================
function _glSaveProgress(id, data) {
    try { localStorage.setItem(`goal_${id}_progress`, JSON.stringify(data)); } catch {}
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showGoalsScreen() {
    _glRenderMain(); // мгновенно уходим от чата
    try {
        const r = await fetch(`${_glApi()}/api/user-status?user_id=${_glUid()}`);
        const d = await r.json();
        if (!d.has_profile) {
            if (window.showToast) window.showToast('📊 Сначала пройдите психологический тест', 'info');
        }
    } catch {}
    await _glLoadVectors();
    _glRenderMain();
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showGoalsScreen = showGoalsScreen;
console.log('✅ goals.js v2.0 загружен');
