// ============================================
// skill_diagnosis.js — Диагностика навыков
// Версия 2.0 — Вопросы → Профиль навыков
// ============================================

function _sdInjectStyles() {
    if (document.getElementById('sd-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-v2-styles';
    s.textContent = `
        /* ===== ВОПРОС ===== */
        .sd-question-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .sd-q-num {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        .sd-q-text {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            line-height: 1.5;
            margin-bottom: 18px;
        }
        .sd-answers {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sd-answer-btn {
            width: 100%;
            padding: 13px 16px;
            border-radius: 14px;
            border: 1px solid rgba(224,224,224,0.12);
            background: rgba(224,224,224,0.04);
            color: var(--text-secondary);
            font-size: 14px;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
            transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.12s;
            line-height: 1.45;
            touch-action: manipulation;
        }
        .sd-answer-btn:hover  { background: rgba(224,224,224,0.1); border-color: rgba(224,224,224,0.22); color: var(--text-primary); }
        .sd-answer-btn:active { transform: scale(0.98); }
        .sd-answer-btn.sel {
            background: rgba(224,224,224,0.18);
            border-color: rgba(224,224,224,0.4);
            color: var(--text-primary);
        }

        /* ===== ПРОГРЕСС ===== */
        .sd-progress-bar-wrap {
            background: rgba(224,224,224,0.08);
            border-radius: 3px;
            height: 3px;
            margin-bottom: 20px;
            overflow: hidden;
        }
        .sd-progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--silver-brushed), var(--chrome));
            border-radius: 3px;
            transition: width 0.4s;
        }
        .sd-progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        /* ===== НАВИГАЦИЯ ===== */
        .sd-nav {
            display: flex;
            gap: 10px;
            margin-top: 14px;
        }

        /* ===== КАРТА НАВЫКОВ ===== */
        .sd-radar-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }
        .sd-radar-wrap svg { max-width: 300px; width: 100%; }
        .sd-radar-poly     { fill: rgba(200,200,200,0.12); stroke: rgba(200,200,200,0.55); stroke-width: 1.5; }
        .sd-radar-grid     { fill: none; stroke: rgba(224,224,224,0.09); stroke-width: 1; }
        .sd-radar-axis     { stroke: rgba(224,224,224,0.11); stroke-width: 1; }
        .sd-radar-label    { font-size: 10px; fill: #a0a3b0; font-family: inherit; }

        /* ===== НАВЫКИ ===== */
        .sd-skill-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 9px;
        }
        .sd-skill-row-name  { font-size: 13px; color: var(--text-secondary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sd-skill-row-track { width: 80px; height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; flex-shrink: 0; overflow: hidden; }
        .sd-skill-row-fill  { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); }
        .sd-skill-row-score { font-size: 12px; font-weight: 700; color: var(--chrome); min-width: 26px; text-align: right; }

        /* ===== СЛАБЫЕ МЕСТА ===== */
        .sd-weak-item {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .sd-weak-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .sd-weak-name   { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .sd-weak-score  { font-size: 12px; color: var(--text-secondary); }
        .sd-weak-tip    { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

        /* ===== ОПИСАНИЕ ТИПА ===== */
        .sd-type-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 18px;
            padding: 18px;
            margin-bottom: 20px;
        }
        .sd-type-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .sd-type-icon   { font-size: 36px; }
        .sd-type-name   { font-size: 16px; font-weight: 700; color: var(--chrome); }
        .sd-type-desc   { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* ===== КНОПКИ ===== */
        .sd-btn {
            padding: 11px 20px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            min-height: 42px;
            touch-action: manipulation;
            outline: none;
            border: none;
        }
        .sd-btn:active { transform: scale(0.97); }
        .sd-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3) !important;
            color: var(--text-primary);
            width: 100%;
            border-radius: 40px !important;
            padding: 13px !important;
        }
        .sd-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14) !important;
            color: var(--text-secondary);
        }
        .sd-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .sd-btn-row { display: flex; gap: 10px; }

        /* ===== СЕКЦИЯ ===== */
        .sd-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
            margin-top: 18px;
        }
        .sd-tip {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 14px;
        }
        .sd-tip strong { color: var(--chrome); }

        /* ===== ВЫБОР СФЕРЫ ===== */
        .sd-sphere-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
        }
        .sd-sphere-card {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 18px;
            padding: 18px 12px;
            text-align: center;
            cursor: pointer;
            transition: background 0.18s, border-color 0.18s, transform 0.12s;
            touch-action: manipulation;
        }
        .sd-sphere-card:hover  { background: rgba(224,224,224,0.1); border-color: rgba(224,224,224,0.25); }
        .sd-sphere-card:active { transform: scale(0.97); }
        .sd-sphere-card.active { background: rgba(224,224,224,0.16); border-color: rgba(224,224,224,0.4); }
        .sd-sphere-icon { font-size: 34px; display: block; margin-bottom: 8px; }
        .sd-sphere-name { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .sd-sphere-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.35; }

        @media (max-width: 480px) {
            .sd-q-text { font-size: 15px; }
            .sd-answer-btn { font-size: 13px; padding: 11px 14px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ВОПРОСЫ ПО СФЕРАМ
// Каждый вопрос измеряет конкретный навык (skill).
// Ответы: 4 варианта с весами 1-4 (1=слабо, 4=сильно).
// ============================================
const SD_QUESTIONS = {
    personal: [
        {
            skill: 'confidence',
            name: 'Уверенность в себе',
            q: 'Вам предлагают взяться за важный проект, в котором вы не уверены. Что происходит?',
            answers: [
                { text: 'Сразу отказываюсь — лучше не рисковать', w: 1 },
                { text: 'Соглашаюсь, но внутри паника. Долго сомневаюсь в себе', w: 2 },
                { text: 'Берусь, хотя тревожно. Справляюсь с беспокойством по ходу', w: 3 },
                { text: 'Воспринимаю как вызов. Мне интересно попробовать', w: 4 }
            ]
        },
        {
            skill: 'discipline',
            name: 'Дисциплина',
            q: 'Вы запланировали важное дело на утро. Встаёте — и совершенно не хочется его делать. Что происходит?',
            answers: [
                { text: 'Откладываю. Потом ещё раз. В итоге не делаю', w: 1 },
                { text: 'Делаю через силу, но часто сдаюсь на полпути', w: 2 },
                { text: 'Стараюсь держаться. Иногда получается, иногда нет', w: 3 },
                { text: 'Делаю в любом случае — это моя система, не зависит от настроения', w: 4 }
            ]
        },
        {
            skill: 'boundaries',
            name: 'Личные границы',
            q: 'Коллега или друг просит вас о помощи, которая для вас неудобна. Как вы реагируете?',
            answers: [
                { text: 'Соглашаюсь, даже если это мне в ущерб', w: 1 },
                { text: 'Соглашаюсь, но злюсь на себя потом', w: 2 },
                { text: 'Иногда отказываю, но с долгим объяснением и чувством вины', w: 3 },
                { text: 'Спокойно говорю «нет» или предлагаю альтернативу', w: 4 }
            ]
        },
        {
            skill: 'emotions',
            name: 'Эмоциональный интеллект',
            q: 'Вы сильно расстроены или злитесь. Что происходит дальше?',
            answers: [
                { text: 'Взрываюсь или полностью замыкаюсь — сам не понимаю почему', w: 1 },
                { text: 'Понимаю, что злюсь, но управлять этим не получается', w: 2 },
                { text: 'Замечаю эмоцию, даю себе время, стараюсь не навредить другим', w: 3 },
                { text: 'Умею назвать точно что чувствую и сознательно выбрать реакцию', w: 4 }
            ]
        },
        {
            skill: 'communication',
            name: 'Коммуникация',
            q: 'Вам нужно сказать человеку что-то важное, но неприятное. Что вы делаете?',
            answers: [
                { text: 'Молчу и не говорю вообще — избегаю конфликта', w: 1 },
                { text: 'Говорю, но так размыто, что человек не понимает', w: 2 },
                { text: 'Говорю прямо, хотя это даётся с усилием', w: 3 },
                { text: 'Говорю честно и тактично. Умею донести сложное', w: 4 }
            ]
        },
        {
            skill: 'resilience',
            name: 'Стрессоустойчивость',
            q: 'Что-то пошло не по плану: провал, отказ, потеря. Как вы с этим справляетесь?',
            answers: [
                { text: 'Долго не могу прийти в себя. Это надолго выбивает меня из колеи', w: 1 },
                { text: 'Тяжело, но со временем прохожу. Требует много сил', w: 2 },
                { text: 'Расстраиваюсь, но достаточно быстро нахожу выход', w: 3 },
                { text: 'Воспринимаю как часть процесса. Анализирую и двигаюсь дальше', w: 4 }
            ]
        },
        {
            skill: 'focus',
            name: 'Фокус и концентрация',
            q: 'Вам нужно сосредоточиться на важной задаче. Как это обычно происходит?',
            answers: [
                { text: 'Постоянно отвлекаюсь. За час делаю 10 минут работы', w: 1 },
                { text: 'С трудом включаюсь, часто теряю нить', w: 2 },
                { text: 'Могу сосредоточиться, если убрать явные отвлекающие факторы', w: 3 },
                { text: 'Легко вхожу в поток. Время за работой пролетает', w: 4 }
            ]
        },
        {
            skill: 'growth',
            name: 'Установка на рост',
            q: 'Вы сделали ошибку на виду у других. Что происходит внутри?',
            answers: [
                { text: 'Стыд и желание провалиться сквозь землю. Долго не отпускает', w: 1 },
                { text: 'Злюсь на себя. Тяжело принять, что ошибся', w: 2 },
                { text: 'Неприятно, но стараюсь разобрать что пошло не так', w: 3 },
                { text: 'Ошибка — это информация. Делаю выводы и двигаюсь дальше', w: 4 }
            ]
        }
    ],
    professional: [
        {
            skill: 'planning',
            name: 'Планирование',
            q: 'У вас много задач на день. Как вы с этим работаете?',
            answers: [
                { text: 'Хватаюсь за всё сразу. В итоге ничего не доделываю', w: 1 },
                { text: 'Делаю что приходит в голову. Планы почти не составляю', w: 2 },
                { text: 'Есть список, но приоритеты часто съезжают', w: 3 },
                { text: 'Чётко расставляю приоритеты. Знаю что главное прямо сейчас', w: 4 }
            ]
        },
        {
            skill: 'decision',
            name: 'Принятие решений',
            q: 'Нужно принять важное решение, но информации недостаточно. Что вы делаете?',
            answers: [
                { text: 'Жду, пока ситуация разрешится сама', w: 1 },
                { text: 'Долго собираю данные. Решение откладывается', w: 2 },
                { text: 'Принимаю решение, но потом долго сомневаюсь', w: 3 },
                { text: 'Принимаю лучшее решение на основе того, что есть сейчас', w: 4 }
            ]
        },
        {
            skill: 'delegation',
            name: 'Делегирование',
            q: 'У вас больше дел, чем вы успеваете. Есть человек, которому можно передать часть. Что происходит?',
            answers: [
                { text: 'Делаю всё сам. Проще, чем объяснять', w: 1 },
                { text: 'Передаю, но потом переделываю за человеком', w: 2 },
                { text: 'Делегирую, хотя беспокоюсь о качестве', w: 3 },
                { text: 'Спокойно передаю и даю человеку сделать по-своему', w: 4 }
            ]
        },
        {
            skill: 'leadership',
            name: 'Лидерство',
            q: 'В группе нет чёткого руководства, и нужно принять инициативу. Что вы делаете?',
            answers: [
                { text: 'Жду, пока кто-то другой возьмёт управление', w: 1 },
                { text: 'Хотел бы, но боюсь что меня не послушают', w: 2 },
                { text: 'Берусь, если совсем нет другого выхода', w: 3 },
                { text: 'Беру инициативу естественно — это мне близко', w: 4 }
            ]
        },
        {
            skill: 'timemanage',
            name: 'Управление временем',
            q: 'Как часто вы сдаёте задачи в срок и не выгораете при этом?',
            answers: [
                { text: 'Почти никогда — либо опаздываю, либо в стрессе', w: 1 },
                { text: 'Успеваю, но всегда впритык и на износе', w: 2 },
                { text: 'В основном успеваю, хотя иногда сдвигаются сроки', w: 3 },
                { text: 'Стабильно. У меня есть система, она работает', w: 4 }
            ]
        },
        {
            skill: 'feedback',
            name: 'Обратная связь',
            q: 'Вам говорят: «Вот что в твоей работе не так». Что происходит внутри?',
            answers: [
                { text: 'Защищаюсь или обижаюсь. Потом долго переживаю', w: 1 },
                { text: 'Трудно принять. Соглашаюсь кивком, но внутри не согласен', w: 2 },
                { text: 'Слушаю. Иногда сложно, но стараюсь извлечь пользу', w: 3 },
                { text: 'Воспринимаю как ресурс. Уточняю, что именно можно улучшить', w: 4 }
            ]
        },
        {
            skill: 'networking',
            name: 'Нетворкинг',
            q: 'Вы на мероприятии, вокруг новые люди. Как вы себя ведёте?',
            answers: [
                { text: 'Держусь в стороне. Знакомиться — это стресс', w: 1 },
                { text: 'Жду, пока кто-то подойдёт сам', w: 2 },
                { text: 'Могу завести разговор, если есть повод', w: 3 },
                { text: 'Легко знакомлюсь и поддерживаю контакты', w: 4 }
            ]
        },
        {
            skill: 'creativity',
            name: 'Креативность',
            q: 'Стандартный подход не работает. Нужно придумать что-то новое. Как это для вас?',
            answers: [
                { text: 'Теряюсь — не знаю с чего начать', w: 1 },
                { text: 'Трудно. Пытаюсь, но идеи кажутся банальными', w: 2 },
                { text: 'Могу придумать что-то интересное, если дать время', w: 3 },
                { text: 'Нестандартные решения — это моя сильная сторона', w: 4 }
            ]
        }
    ]
};

// Профили результата по среднему баллу
const SD_PROFILES = {
    personal: {
        low:  { icon:'🌱', name:'Новичок',       desc:'Много точек роста, и это нормально. Личностные навыки формируются опытом — у вас впереди ощутимый прогресс при регулярной практике.' },
        mid:  { icon:'📈', name:'В развитии',    desc:'Крепкая база. Часть навыков уже работает — теперь важно точечно усилить слабые звенья, чтобы выйти на новый уровень.' },
        high: { icon:'🏆', name:'Уверенный',     desc:'Сильный личностный фундамент. Навыки работают системно. Фокус теперь — тонкая настройка и поддержание в стрессовых условиях.' }
    },
    professional: {
        low:  { icon:'🌱', name:'Новичок',       desc:'Профессиональные навыки требуют практики. Хорошая новость — они хорошо поддаются целенаправленному развитию.' },
        mid:  { icon:'📈', name:'В развитии',    desc:'Есть рабочие инструменты, но есть и явные пробелы. Укрепление слабых мест даст ощутимый карьерный результат.' },
        high: { icon:'🏆', name:'Профессионал',  desc:'Профессиональный арсенал зрелый. Ваш уровень позволяет брать более сложные задачи и масштабировать влияние.' }
    }
};

// Советы под каждый навык
const SD_TIPS = {
    confidence:   'Делайте одно пугающее дело в день — маленькое. Уверенность строится через действие, а не через размышления о нём.',
    discipline:   'Создайте якорный ритуал: 5 минут в начале дня. Дисциплина — это система, а не сила воли.',
    boundaries:   'Начните с отказа в малом. Граница — это честность о том, что для вас возможно, а не агрессия.',
    emotions:     '3 минуты вечером: «Что я чувствовал сегодня и почему?» Называние эмоции снижает её интенсивность.',
    communication:'Практика «я-высказываний»: «Я чувствую X, когда Y» вместо «ты делаешь Z». 10 минут в день.',
    resilience:   'После любого падения задайте себе: «Что я могу взять из этого?» — это перестраивает нейронную реакцию.',
    focus:        'Техника Помодоро: 25 минут без отвлечений, 5 отдыха. Телефон — в другую комнату.',
    growth:       'Заменяйте «у меня не получается» на «у меня пока не получается». Маленькое слово — большая разница в мышлении.',
    planning:     'Правило 3 задач: каждый день 3 приоритета, не больше. Всё остальное — бонус.',
    decision:     'Правило 10/10/10: как вы будете чувствовать через 10 минут, 10 месяцев, 10 лет? Снимает паралич.',
    delegation:   'Делегируйте результат, а не процесс. Скажите «что» нужно сделать, а не «как».',
    leadership:   'Лидерство начинается с личного примера. Что вы делаете первым — то и транслируете.',
    timemanage:   'Матрица Эйзенхауэра: важное/срочное. Большинство «срочных» дел окажутся не такими важными.',
    networking:   'Одно значимое сообщение в неделю человеку из профессионального круга. Без просьбы — просто интерес.',
    feedback:     'При критике: сначала «спасибо», потом обдумайте. Защитная реакция закрывает рост.',
    creativity:   'Метод «А что если»: 5 безумных вопросов к любой проблеме. Один из них окажется нужным.'
};

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._sdState) window._sdState = {
    step:     'sphere',
    sphere:   null,
    qIndex:   0,
    answers:  {},   // { questionIndex: answerWeight }
    result:   null
};
const _sd = window._sdState;

// ============================================
// УТИЛИТЫ
// ============================================
function _sdToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _sdHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _sdUid()   { return window.CONFIG?.USER_ID; }
function _sdSave()  { try { localStorage.setItem('sd_result_'+_sdUid(), JSON.stringify(_sd.result)); } catch {} }
function _sdLoad()  { try { const d = localStorage.getItem('sd_result_'+_sdUid()); if (d) _sd.result = JSON.parse(d); } catch {} }
function _sdQList() { return SD_QUESTIONS[_sd.sphere] || []; }

// ============================================
// РЕНДЕР
// ============================================
function _sdRender() {
    _sdInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '', backLabel = '◀️ НАЗАД';
    if (_sd.step === 'sphere') {
        body = _sdRenderSphere();
    } else if (_sd.step === 'quiz') {
        body = _sdRenderQuiz();
        backLabel = _sd.qIndex > 0 ? '◀️ НАЗАД' : '◀️ НАЗАД';
    } else if (_sd.step === 'result') {
        body = _sdRenderResult();
    }

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="sdBack">${backLabel}</button>
            <div class="content-header">
                <div class="content-emoji">🧠</div>
                <h1 class="content-title">Диагностика навыков</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Анализ текущего уровня</p>
            </div>
            <div id="sdBody">${body}</div>
        </div>`;

    document.getElementById('sdBack').onclick = () => {
        if (_sd.step === 'sphere') { _sdHome(); return; }
        if (_sd.step === 'quiz') {
            if (_sd.qIndex > 0) { _sd.qIndex--; _sdRender(); }
            else { _sd.step = 'sphere'; _sdRender(); }
            return;
        }
        if (_sd.step === 'result') { _sd.step = 'sphere'; _sdRender(); }
    };

    _sdBindHandlers();
}

// ===== ШАГ 1: ВЫБОР СФЕРЫ =====
function _sdRenderSphere() {
    const prevHtml = _sd.result ? `
        <div style="margin-bottom:16px">
            <button class="sd-btn sd-btn-ghost" id="sdShowPrev" style="width:100%;border-radius:40px;padding:12px">
                📊 Посмотреть результат предыдущей диагностики
            </button>
        </div>` : '';

    const cards = Object.entries(SD_QUESTIONS).map(([key]) => {
        const SPHERE_INFO = {
            personal:     { emoji:'🧠', name:'Личностные навыки',       desc:'Уверенность, дисциплина,\nэмоции, коммуникация' },
            professional: { emoji:'💼', name:'Профессиональные навыки', desc:'Планирование, лидерство,\nделегирование, решения' }
        };
        const info = SPHERE_INFO[key];
        return `
        <div class="sd-sphere-card${_sd.sphere===key?' active':''}" data-sphere="${key}">
            <span class="sd-sphere-icon">${info.emoji}</span>
            <div class="sd-sphere-name">${info.name}</div>
            <div class="sd-sphere-desc">${info.desc}</div>
        </div>`;
    }).join('');

    return `
        ${prevHtml}
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.65">
            8 вопросов — конкретные ситуации, честные ответы. На выходе: карта навыков, ваш тип и зоны роста с советами.
        </p>
        <div class="sd-sphere-grid">${cards}</div>
        <button class="sd-btn sd-btn-primary" id="sdStartBtn">Начать диагностику →</button>`;
}

// ===== ШАГ 2: ВОПРОС =====
function _sdRenderQuiz() {
    const questions = _sdQList();
    const q         = questions[_sd.qIndex];
    if (!q) return '';

    const total    = questions.length;
    const progress = Math.round((_sd.qIndex / total) * 100);
    const cur      = _sd.answers[_sd.qIndex];

    const answersHtml = q.answers.map((a, i) => `
        <button class="sd-answer-btn${cur===a.w?' sel':''}" data-qi="${_sd.qIndex}" data-w="${a.w}">${a.text}</button>
    `).join('');

    const isLast = _sd.qIndex === total - 1;
    const nextBtn = cur !== undefined
        ? `<button class="sd-btn sd-btn-primary" id="sdNextBtn" style="margin-top:16px">${isLast ? '📊 Посмотреть результат' : 'Следующий вопрос →'}</button>`
        : '';

    return `
        <div class="sd-progress-label">
            <span>Вопрос ${_sd.qIndex + 1} из ${total}</span>
            <span>${progress}%</span>
        </div>
        <div class="sd-progress-bar-wrap">
            <div class="sd-progress-bar-fill" style="width:${progress}%"></div>
        </div>
        <div class="sd-question-card">
            <div class="sd-q-num">📍 ${q.name}</div>
            <div class="sd-q-text">${q.q}</div>
            <div class="sd-answers">${answersHtml}</div>
        </div>
        ${nextBtn}`;
}

// ===== ШАГ 3: РЕЗУЛЬТАТ =====
function _sdRenderResult() {
    if (!_sd.result) return '';
    const r       = _sd.result;
    const sp      = r.sphere;
    const qs      = SD_QUESTIONS[sp];
    const SPHERE_NAME = sp === 'personal' ? 'Личностные навыки' : 'Профессиональные навыки';

    // Данные навыков
    const skills = qs.map((q, i) => ({
        id:    q.skill,
        name:  q.name,
        score: r.scores[i] || 1
    }));

    // Средний балл
    const avg     = skills.reduce((s, sk) => s + sk.score, 0) / skills.length;
    const avgPct  = Math.round((avg / 4) * 100);

    // Профиль
    const profiles = SD_PROFILES[sp];
    const profile  = avg < 2 ? profiles.low : avg < 3 ? profiles.mid : profiles.high;

    // Радар SVG
    const N = skills.length;
    const cx = 140, cy = 140, R = 96;
    const step = (2 * Math.PI) / N;
    let gridPaths = '';
    for (let ring = 1; ring <= 4; ring++) {
        const rr  = (R / 4) * ring;
        const pts = skills.map((_, i) => {
            const ang = -Math.PI/2 + i * step;
            return `${(cx + rr*Math.cos(ang)).toFixed(1)},${(cy + rr*Math.sin(ang)).toFixed(1)}`;
        }).join(' ');
        gridPaths += `<polygon points="${pts}" class="sd-radar-grid"/>`;
    }
    const axes = skills.map((_, i) => {
        const ang = -Math.PI/2 + i * step;
        return `<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(ang)).toFixed(1)}" y2="${(cy+R*Math.sin(ang)).toFixed(1)}" class="sd-radar-axis"/>`;
    }).join('');
    const dataPts = skills.map((sk, i) => {
        const rr  = (R / 4) * sk.score;
        const ang = -Math.PI/2 + i * step;
        return `${(cx + rr*Math.cos(ang)).toFixed(1)},${(cy + rr*Math.sin(ang)).toFixed(1)}`;
    }).join(' ');
    const labelOffset = 26;
    const labelsSvg = skills.map((sk, i) => {
        const ang    = -Math.PI/2 + i * step;
        const lx     = cx + (R + labelOffset) * Math.cos(ang);
        const ly     = cy + (R + labelOffset) * Math.sin(ang);
        const anchor = Math.abs(Math.cos(ang)) < 0.15 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
        const short  = sk.name.length > 13 ? sk.name.slice(0,12)+'…' : sk.name;
        return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="sd-radar-label" text-anchor="${anchor}" dominant-baseline="middle">${short}</text>`;
    }).join('');

    const radar = `<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
        ${gridPaths}${axes}
        <polygon points="${dataPts}" class="sd-radar-poly"/>
        ${labelsSvg}
    </svg>`;

    // Все навыки
    const sorted = [...skills].sort((a,b) => b.score - a.score);
    const allBars = sorted.map(sk => `
        <div class="sd-skill-row">
            <div class="sd-skill-row-name">${sk.name}</div>
            <div class="sd-skill-row-track">
                <div class="sd-skill-row-fill" style="width:${Math.round(sk.score/4*100)}%"></div>
            </div>
            <div class="sd-skill-row-score">${sk.score}/4</div>
        </div>`).join('');

    // Топ-3 слабых
    const weak3 = [...skills].sort((a,b) => a.score - b.score).slice(0, 3);
    const weakHtml = weak3.map(sk => `
        <div class="sd-weak-item">
            <div class="sd-weak-header">
                <div class="sd-weak-name">${sk.name}</div>
                <div class="sd-weak-score">${sk.score}/4</div>
            </div>
            <div class="sd-weak-tip">💡 ${SD_TIPS[sk.id] || 'Уделите этому навыку 15 минут в день.'}</div>
        </div>`).join('');

    return `
        <div class="sd-type-card">
            <div class="sd-type-header">
                <span class="sd-type-icon">${profile.icon}</span>
                <div>
                    <div class="sd-type-name">${profile.name} · ${avgPct}%</div>
                    <div style="font-size:11px;color:var(--text-secondary)">${SPHERE_NAME}</div>
                </div>
            </div>
            <div class="sd-type-desc">${profile.desc}</div>
        </div>

        <div class="sd-radar-wrap">${radar}</div>

        <div class="sd-section-label">📊 Все навыки</div>
        ${allBars}

        <div class="sd-section-label">🎯 Топ-3 зоны роста</div>
        ${weakHtml}

        <div class="sd-tip" style="margin-bottom:16px">
            <strong>Следующий шаг:</strong> перейдите в «Выбор навыка» и начните 21-дневный план по самому слабому — <em>${weak3[0]?.name || '...'}</em>.
        </div>

        <div class="sd-btn-row">
            <button class="sd-btn sd-btn-ghost" id="sdRedoBtn">🔄 Пройти снова</button>
            <button class="sd-btn sd-btn-ghost" id="sdCopyBtn">📋 Скопировать</button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _sdBindHandlers() {
    // Выбор сферы
    document.querySelectorAll('.sd-sphere-card').forEach(card => {
        card.addEventListener('click', () => {
            _sd.sphere = card.dataset.sphere;
            document.querySelectorAll('.sd-sphere-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });

    // Посмотреть предыдущий
    document.getElementById('sdShowPrev')?.addEventListener('click', () => {
        if (_sd.result) {
            _sd.sphere = _sd.result.sphere;
            _sd.step   = 'result';
            _sdRender();
        }
    });

    // Начать
    document.getElementById('sdStartBtn')?.addEventListener('click', () => {
        if (!_sd.sphere) { _sdToast('Выберите сферу', 'error'); return; }
        _sd.qIndex  = 0;
        _sd.answers = {};
        _sd.step    = 'quiz';
        _sdRender();
    });

    // Ответ на вопрос
    document.querySelectorAll('.sd-answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const qi = parseInt(btn.dataset.qi);
            const w  = parseInt(btn.dataset.w);
            _sd.answers[qi] = w;

            // Подсветка
            document.querySelectorAll(`.sd-answer-btn[data-qi="${qi}"]`).forEach(b => {
                b.classList.toggle('sel', parseInt(b.dataset.w) === w);
            });

            // Автопереход через небольшую задержку
            const total = _sdQList().length;
            const isLast = qi === total - 1;
            if (!isLast) {
                setTimeout(() => {
                    _sd.qIndex = qi + 1;
                    _sdRender();
                }, 350);
            } else {
                // Показать кнопку "Результат"
                if (!document.getElementById('sdNextBtn')) {
                    const btn2 = document.createElement('button');
                    btn2.className  = 'sd-btn sd-btn-primary';
                    btn2.id         = 'sdNextBtn';
                    btn2.textContent = '📊 Посмотреть результат';
                    btn2.style.marginTop = '16px';
                    document.getElementById('sdBody')?.appendChild(btn2);
                    btn2.addEventListener('click', _sdCalc);
                }
            }

            // Если кнопка "Следующий" уже есть — обновляем её состояние
            const nextBtn = document.getElementById('sdNextBtn');
            if (nextBtn && isLast) nextBtn.onclick = _sdCalc;
        });
    });

    // Следующий вопрос
    document.getElementById('sdNextBtn')?.addEventListener('click', () => {
        const cur = _sd.answers[_sd.qIndex];
        if (cur === undefined) { _sdToast('Выберите ответ', 'error'); return; }
        const total = _sdQList().length;
        if (_sd.qIndex < total - 1) {
            _sd.qIndex++;
            _sdRender();
        } else {
            _sdCalc();
        }
    });

    // Пройти снова
    document.getElementById('sdRedoBtn')?.addEventListener('click', () => {
        _sd.step    = 'sphere';
        _sd.sphere  = null;
        _sd.qIndex  = 0;
        _sd.answers = {};
        _sdRender();
    });

    // Скопировать
    document.getElementById('sdCopyBtn')?.addEventListener('click', () => {
        if (!_sd.result) return;
        const qs  = SD_QUESTIONS[_sd.result.sphere];
        const avg = (Object.values(_sd.result.scores).reduce((a,b)=>a+b,0) / qs.length / 4 * 100).toFixed(0);
        let txt   = `🧠 Диагностика навыков\nСредний уровень: ${avg}%\n\n`;
        qs.forEach((q, i) => { txt += `${q.name}: ${_sd.result.scores[i]||0}/4\n`; });
        navigator.clipboard.writeText(txt)
            .then(() => _sdToast('📋 Скопировано', 'success'))
            .catch(() => _sdToast('Не удалось скопировать'));
    });
}

// ============================================
// РАСЧЁТ РЕЗУЛЬТАТА
// ============================================
function _sdCalc() {
    const qs = _sdQList();
    const unanswered = qs.filter((_, i) => _sd.answers[i] === undefined);
    if (unanswered.length > 0) {
        _sdToast(`Ответьте на все вопросы (осталось ${unanswered.length})`, 'error');
        return;
    }
    _sd.result = {
        sphere: _sd.sphere,
        scores: { ..._sd.answers },
        date:   new Date().toISOString()
    };
    _sdSave();
    _sd.step = 'result';
    _sdRender();
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showSkillDiagnosisScreen() {
    _sdLoad();
    _sd.step   = 'sphere';
    _sd.sphere = _sd.result?.sphere || null;
    _sdRender();
}

window.showSkillDiagnosisScreen = showSkillDiagnosisScreen;
console.log('✅ skill_diagnosis.js v2.0 загружен');
