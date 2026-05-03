// ============================================
// skill_choice.js — Выбор навыка + план
// Версия 3.0 — план по дням + промис + превью пути
// ============================================

function _scInjectStyles() {
    if (document.getElementById('sc-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'sc-v2-styles';
    s.textContent = `
        .sc-skill-card {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.18s, border-color 0.18s, transform 0.12s;
            display: flex;
            align-items: center;
            gap: 12px;
            touch-action: manipulation;
        }
        .sc-skill-card:hover  { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.22); }
        .sc-skill-card:active { transform: scale(0.98); }
        .sc-skill-card.active { background: rgba(224,224,224,0.15); border-color: rgba(224,224,224,0.38); }
        .sc-skill-body  { flex: 1; min-width: 0; }
        .sc-skill-name  { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
        .sc-skill-sub   { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
        .sc-skill-score {
            font-size: 11px; font-weight: 700; color: var(--text-secondary);
            flex-shrink: 0; background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.14); border-radius: 20px;
            padding: 3px 9px;
        }
        .sc-skill-bar-wrap { height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .sc-skill-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); }

        .sc-input {
            width: 100%;
            background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
            -webkit-appearance: none;
        }
        .sc-input:focus { border-color: rgba(224,224,224,0.35); }
        .sc-input::placeholder { color: var(--text-secondary); }

        .sc-btn {
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
        }
        .sc-btn:active { transform: scale(0.97); }
        .sc-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3);
            color: var(--text-primary);
            width: 100%;
            border-radius: 40px;
            padding: 13px;
        }
        .sc-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.16)); }
        .sc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .sc-btn-ghost {
            background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .sc-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .sc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .sc-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .sc-custom-block {
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px;
            padding: 14px;
            margin-top: 8px;
        }
        .sc-custom-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

        /* ===== ПРЕВЬЮ ПУТИ (после клика по навыку) ===== */
        .sc-preview {
            background: linear-gradient(135deg, rgba(224,224,224,0.09), rgba(192,192,192,0.03));
            border: 1px solid rgba(224,224,224,0.22);
            border-radius: 18px;
            padding: 16px;
            margin: 12px 0 4px;
            animation: scFade .25s ease;
        }
        @keyframes scFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .sc-preview-promise-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--chrome); margin-bottom: 6px;
        }
        .sc-preview-promise {
            font-size: 14px; line-height: 1.5; color: var(--text-primary); font-weight: 500;
            margin-bottom: 14px;
        }
        .sc-phases { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .sc-phase {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 10px 12px;
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.1);
            border-radius: 12px;
        }
        .sc-phase-num {
            width: 22px; height: 22px; border-radius: 50%;
            background: rgba(224,224,224,0.15); color: var(--chrome);
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px;
        }
        .sc-phase-body { min-width: 0; }
        .sc-phase-theme  { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .sc-phase-mean   { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }

        .sc-preview-toggle {
            font-size: 12px; color: var(--text-secondary); cursor: pointer;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 0; user-select: none;
        }
        .sc-preview-toggle:hover { color: var(--chrome); }
        .sc-preview-toggle .arr { transition: transform 0.2s; display: inline-block; }
        .sc-preview-toggle.open .arr { transform: rotate(90deg); }

        .sc-preview-days {
            margin-top: 8px;
            border-top: 1px solid rgba(224,224,224,0.1); padding-top: 10px;
            display: none;
        }
        .sc-preview-days.open { display: block; }
        .sc-preview-week { margin-bottom: 10px; }
        .sc-preview-week:last-child { margin-bottom: 0; }
        .sc-preview-week-title {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 4px;
        }
        .sc-preview-day-row {
            display: flex; gap: 8px; padding: 4px 0;
            font-size: 12px; color: var(--text-secondary); line-height: 1.4;
        }
        .sc-preview-day-row .n {
            color: var(--chrome); font-weight: 700; min-width: 22px;
        }
        .sc-preview-day-row .t { flex: 1; }
        .sc-preview-day-row .d { font-size: 11px; opacity: 0.7; flex-shrink: 0; }

        /* ===== АКТИВНЫЙ ПЛАН ===== */
        .sc-plan-header {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 18px;
            padding: 16px 18px;
            margin-bottom: 18px;
        }
        .sc-plan-skill { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .sc-plan-promise { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; }
        .sc-plan-meta  { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .sc-plan-progress { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 10px; overflow: hidden; }
        .sc-plan-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); transition: width 0.4s; }

        /* СЕГОДНЯ — крупная карточка */
        .sc-today-card {
            background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.18);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .sc-today-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
        .sc-today-num {
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(224,224,224,0.18); display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; color: var(--chrome); flex-shrink: 0;
        }
        .sc-today-task { font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.4; }
        .sc-today-dur  { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
        .sc-today-inst { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; }

        /* ЗАВТРА — короткая полоса */
        .sc-tomorrow {
            display: flex; gap: 10px; align-items: center;
            background: rgba(224,224,224,0.03);
            border: 1px dashed rgba(224,224,224,0.15);
            border-radius: 12px; padding: 10px 14px;
            margin-bottom: 22px;
        }
        .sc-tomorrow-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); }
        .sc-tomorrow-task  { font-size: 12px; color: var(--text-primary); flex: 1; }
        .sc-tomorrow-dur   { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }

        /* ВСЯ ДОРОГА — таймлайн по неделям */
        .sc-week { margin-bottom: 14px; }
        .sc-week-head {
            display: flex; align-items: center; justify-content: space-between;
            cursor: pointer; padding: 10px 0; user-select: none;
            border-bottom: 1px solid rgba(224,224,224,0.08);
            margin-bottom: 8px;
        }
        .sc-week-head:hover .sc-week-theme { color: var(--chrome); }
        .sc-week-info { min-width: 0; flex: 1; }
        .sc-week-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 2px;
        }
        .sc-week-theme { font-size: 13px; font-weight: 600; color: var(--text-primary); transition: color 0.15s; }
        .sc-week-mean  { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
        .sc-week-stats {
            font-size: 11px; font-weight: 700; color: var(--text-secondary);
            background: rgba(224,224,224,0.08); border-radius: 20px; padding: 3px 10px;
            flex-shrink: 0; margin-left: 10px;
        }
        .sc-week-toggle {
            color: var(--text-secondary); font-size: 14px; margin-left: 8px;
            transition: transform 0.2s; display: inline-block;
        }
        .sc-week-head.open .sc-week-toggle { transform: rotate(90deg); }

        .sc-week-list { display: none; flex-direction: column; gap: 4px; }
        .sc-week-list.open { display: flex; }

        .sc-day-row {
            display: flex; gap: 10px; align-items: center;
            padding: 10px 12px;
            background: rgba(224,224,224,0.03);
            border: 1px solid rgba(224,224,224,0.08);
            border-radius: 12px;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }
        .sc-day-row:hover { background: rgba(224,224,224,0.07); }
        .sc-day-row.done {
            background: rgba(224,224,224,0.05);
            border-color: rgba(224,224,224,0.12);
        }
        .sc-day-row.current {
            background: rgba(224,224,224,0.1);
            border-color: rgba(224,224,224,0.3);
        }
        .sc-day-row.locked { opacity: 0.55; }

        .sc-day-num-pill {
            width: 26px; height: 26px; border-radius: 50%;
            background: rgba(224,224,224,0.1); color: var(--text-secondary);
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; flex-shrink: 0;
        }
        .sc-day-row.done .sc-day-num-pill    { background: rgba(224,224,224,0.18); color: var(--chrome); }
        .sc-day-row.current .sc-day-num-pill { background: var(--chrome); color: #000; }

        .sc-day-info { flex: 1; min-width: 0; }
        .sc-day-task { font-size: 13px; font-weight: 500; color: var(--text-primary); line-height: 1.35; }
        .sc-day-row.done .sc-day-task { text-decoration: line-through; opacity: 0.7; }
        .sc-day-dur { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .sc-day-status {
            flex-shrink: 0; font-size: 14px; color: var(--text-secondary);
            min-width: 18px; text-align: right;
        }
        .sc-day-row.done .sc-day-status { color: var(--chrome); }

        .sc-day-detail {
            grid-column: 1 / -1;
            font-size: 12px; line-height: 1.55; color: var(--text-secondary);
            padding: 10px 12px 4px;
            border-top: 1px dashed rgba(224,224,224,0.12);
            margin-top: 8px;
            display: none;
        }
        .sc-day-row.expanded { flex-wrap: wrap; }
        .sc-day-row.expanded .sc-day-detail { display: block; width: 100%; }
        .sc-day-detail-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }

        .sc-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 14px;
        }
        .sc-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .sc-skill-name { font-size: 13px; }
            .sc-today-task { font-size: 13px; }
            .sc-day-task   { font-size: 12px; }
            .sc-week-theme { font-size: 12px; }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ПРЕДОПРЕДЕЛЁННЫЕ НАВЫКИ
// ============================================
const SC_SKILLS = {
    personal: [
        { id:'confidence',    name:'Уверенность в себе',    desc:'Действовать без одобрения извне, верить в свои силы',
          promise:'Через 21 день вы будете действовать в важных ситуациях, не дожидаясь одобрения и не оглядываясь на оценку.' },
        { id:'discipline',    name:'Дисциплина',             desc:'Выполнять намеченное независимо от настроения',
          promise:'Через 21 день вы будете делать намеченное даже когда не хочется — без внутреннего торга и «соберусь завтра».' },
        { id:'boundaries',    name:'Личные границы',         desc:'Говорить «нет» без чувства вины',
          promise:'Через 21 день вы будете отказывать спокойно и без оправданий — и при этом сохранять отношения.' },
        { id:'emotions',      name:'Эмоциональный интеллект',desc:'Распознавать и управлять своими эмоциями',
          promise:'Через 21 день вы будете замечать эмоцию до того, как она возьмёт верх, и выбирать реакцию, а не «прорываться».' },
        { id:'communication', name:'Коммуникация',           desc:'Ясно и честно выражать мысли и чувства',
          promise:'Через 21 день вы будете говорить о важном напрямую — без намёков, обиняков и страха быть неправильно понятым.' },
        { id:'resilience',    name:'Стрессоустойчивость',    desc:'Восстанавливаться после трудностей',
          promise:'Через 21 день вы будете быстрее возвращаться в строй после ударов и не залипать в плохом настроении на дни.' },
        { id:'focus',         name:'Фокус и концентрация',   desc:'Удерживать внимание на важном',
          promise:'Через 21 день вы будете удерживать внимание на главном по 60–90 минут без скатывания в соцсети и переключения.' },
        { id:'growth',        name:'Установка на рост',      desc:'Воспринимать трудности как возможности',
          promise:'Через 21 день вы будете воспринимать неудачи как данные, а не как приговор себе — и быстрее идти дальше.' }
    ],
    professional: [
        { id:'planning',    name:'Планирование',         desc:'Ставить цели и разбивать на конкретные шаги',
          promise:'Через 21 день вы будете превращать любую большую цель в конкретный недельный план и идти по нему.' },
        { id:'decision',    name:'Принятие решений',     desc:'Действовать при неполной информации',
          promise:'Через 21 день вы будете решать быстро даже без полной картины — и переставать зависать в раздумьях.' },
        { id:'delegation',  name:'Делегирование',        desc:'Передавать задачи и доверять другим',
          promise:'Через 21 день вы будете отпускать задачи команде без чувства «лучше сам» — и освобождать время на главное.' },
        { id:'leadership',  name:'Лидерство',            desc:'Вести за собой и вдохновлять людей',
          promise:'Через 21 день вы будете говорить так, что за вами хочется идти — и направлять других без давления.' },
        { id:'timemanage',  name:'Управление временем',  desc:'Расставлять приоритеты и не прокрастинировать',
          promise:'Через 21 день вы будете успевать важное за день — без переработок и чувства «снова ничего не сделал».' },
        { id:'feedback',    name:'Обратная связь',       desc:'Давать и принимать критику конструктивно',
          promise:'Через 21 день вы будете говорить и слышать критику без напряжения — и превращать её в реальные изменения.' },
        { id:'networking',  name:'Нетворкинг',           desc:'Строить и поддерживать профессиональные связи',
          promise:'Через 21 день вы будете заводить полезные контакты без неловкости и поддерживать связи без выгорания.' },
        { id:'creativity',  name:'Креативность',         desc:'Находить нестандартные решения',
          promise:'Через 21 день вы будете находить решения там, где другие видят тупик — за счёт устойчивых техник, а не вдохновения.' }
    ]
};

const _SC_CUSTOM_PROMISE = 'Через 21 день у вас будет рабочий навык, который вы тренировали ежедневно — устойчивая привычка, а не разовая попытка.';

// ============================================
// ХАРДКОДНЫЙ ШАБЛОН 21-ДНЕВНОГО ПЛАНА
// ============================================
const DEFAULT_TEMPLATE_PLAN = {
    weeks: [
        {
            theme: 'Знакомство и калибровка',
            meaning: 'Поймёте, где именно вас «ловит», и сделаете первый осторожный шаг по-другому.',
            exercises: [
                { day:1, task:'Зачем вам этот навык',     dur:'5 мин',  inst:'Запишите 3 конкретные ситуации, где этот навык изменил бы исход.' },
                { day:2, task:'Замечание',                 dur:'10 мин', inst:'В течение дня замечайте моменты, где навык бы понадобился. Записывайте 1–3 ситуации без оценки.' },
                { day:3, task:'Триггеры',                  dur:'7 мин',  inst:'Какие 3 ситуации запускают вашу старую реакцию? Конкретно: место, человек, время, ваша мысль.' },
                { day:4, task:'Микро-эксперимент',         dur:'15 мин', inst:'В одной безопасной ситуации попробуйте действовать по-новому. Зафиксируйте, что произошло.' },
                { day:5, task:'Рефлексия',                 dur:'5 мин',  inst:'Что было неудобно вчера? Назовите чувство одним словом — это точка роста.' },
                { day:6, task:'Повтор с поправкой',        dur:'15 мин', inst:'Похожая ситуация, что и в день 4 — но с поправкой на вчерашнюю рефлексию.' },
                { day:7, task:'Итог недели',               dur:'10 мин', inst:'Один главный инсайт за неделю. На сколько процентов продвинулись?' }
            ]
        },
        {
            theme: 'Активная тренировка',
            meaning: 'Начнёте действовать по-новому даже там, где раньше избегали — и заметите, что получается.',
            exercises: [
                { day:8,  task:'Усложнение',           dur:'15 мин', inst:'Та же техника, но в более сложной ситуации. Где раньше избегали.' },
                { day:9,  task:'Постановка якоря',     dur:'7 мин',  inst:'Когда сегодня получится — запомните телесное состояние и сожмите большой и указательный пальцы на 5 секунд.' },
                { day:10, task:'Препятствие',          dur:'10 мин', inst:'Что в окружении мешает практике? Один конкретный фактор и один шаг по его устранению.' },
                { day:11, task:'Поддержка',            dur:'5 мин',  inst:'Расскажите близкому, что проходите 21 день навыка. Попросите не оценивать прогресс.' },
                { day:12, task:'Худший момент',        dur:'10 мин', inst:'Что было самым трудным? Опишите 3 предложениями. Что бы посоветовали другу?' },
                { day:13, task:'Маленькая победа',     dur:'15 мин', inst:'Найдите ситуацию, где точно получится. Зафиксируйте успех — текстом, голосом, в дневнике.' },
                { day:14, task:'Полу-итог',            dur:'10 мин', inst:'На сколько процентов продвинулись? Что главное изменилось? Что осталось на третью неделю?' }
            ]
        },
        {
            theme: 'Закрепление и интеграция',
            meaning: 'Новое поведение перестаёт требовать усилий и становится тем, как вы действуете по умолчанию.',
            exercises: [
                { day:15, task:'Естественная среда',  dur:'12 мин', inst:'Применяйте навык без специальных условий — в обычном дне.' },
                { day:16, task:'Без напоминаний',     dur:'10 мин', inst:'Сделайте без подсказки. К вечеру отметьте, удалось ли.' },
                { day:17, task:'Перенос',             dur:'15 мин', inst:'Новая ситуация, где раньше не пробовали. Что переносится, что нет?' },
                { day:18, task:'Глубже',              dur:'15 мин', inst:'Усложните: больше людей, выше ставки, дольше время.' },
                { day:19, task:'Помощь другому',      dur:'10 мин', inst:'Объясните принцип кому-то ещё в 2–3 предложениях. Это закрепляет понимание.' },
                { day:20, task:'Письмо себе',         dur:'15 мин', inst:'Напишите себе через год — что хотите помнить из этого 21 дня.' },
                { day:21, task:'Итог цикла',          dur:'15 мин', inst:'Сравните: где были в день 1 и где сегодня. Что точно изменилось? Что дальше?' }
            ]
        }
    ]
};

function _scLocalPlan() {
    return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_PLAN));
}

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._scState) window._scState = {
    view:        'select',
    skillId:     null,
    skillName:   null,
    skillDesc:   null,
    skillPromise:null,
    plan:        null,
    daysDone:    [],
    startDate:   null,
    // UI-состояние — не сохраняется
    expandedDay: null,
    openWeeks:   null,
    previewDays: false
};
const _sc = window._scState;

// ============================================
// УТИЛИТЫ
// ============================================
function _scToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _scHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _scUid()   { return window.CONFIG?.USER_ID; }

function _scSave() {
    try {
        const data = {
            skillId: _sc.skillId, skillName: _sc.skillName, skillDesc: _sc.skillDesc,
            skillPromise: _sc.skillPromise,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate
        };
        localStorage.setItem('sc_plan_'+_scUid(), JSON.stringify(data));
        localStorage.setItem('trainer_skill_'+_scUid(), JSON.stringify({
            skillId: _sc.skillId, skillName: _sc.skillName,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate
        }));
    } catch {}
}

function _scLoad() {
    try {
        const d = localStorage.getItem('sc_plan_'+_scUid());
        if (d) Object.assign(_sc, JSON.parse(d));
    } catch {}
}

function _scCurrentDay() {
    if (!_sc.startDate) return 1;
    const diff = Math.floor((Date.now() - new Date(_sc.startDate)) / 86400000) + 1;
    return Math.min(21, Math.max(1, diff));
}

function _scFindSkill(id) {
    if (!id) return null;
    return SC_SKILLS.personal.find(s => s.id === id)
        || SC_SKILLS.professional.find(s => s.id === id)
        || null;
}

function _scAllExercises() {
    return (_sc.plan?.weeks || []).flatMap(w => w.exercises);
}

function _scWeekOf(day) {
    if (day <= 7)  return 0;
    if (day <= 14) return 1;
    return 2;
}

// ============================================
// РЕНДЕР
// ============================================
function _scRender() {
    _scInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '';
    if (_sc.view === 'select') body = _scRenderSelect();
    if (_sc.view === 'plan')   body = _scRenderPlan();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="scBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Выбор навыка</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">21-дневный план развития</p>
            </div>
            <div id="scBody">${body}</div>
        </div>`;

    document.getElementById('scBack').onclick = () => {
        if (_sc.view === 'plan') { _sc.view = 'select'; _scRender(); return; }
        _scHome();
    };

    _scBindHandlers();
}

// ===== ЭКРАН ВЫБОРА =====
function _scRenderSelect() {
    // Превью (промис + 3 фазы + опционально 21 день)
    const previewBlock = _sc.skillId ? _scRenderPreview() : '';

    // Активный план — баннер
    let activePlan = '';
    if (_sc.plan) {
        activePlan = `
        <div style="background:rgba(224,224,224,0.06);border:1px solid rgba(224,224,224,0.18);border-radius:14px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-size:13px;font-weight:600;color:var(--chrome)">${_sc.skillName}</div>
                <div style="font-size:11px;color:var(--text-secondary)">День ${_scCurrentDay()} из 21 · выполнено ${_sc.daysDone.length}</div>
            </div>
            <button class="sc-btn sc-btn-ghost" id="scOpenPlan" style="flex-shrink:0">Открыть план →</button>
        </div>`;
    }

    // Навыки из диагностики
    let diagBlock = '';
    try {
        const sdRaw = localStorage.getItem('sd_result_'+_scUid());
        if (sdRaw) {
            const sd = JSON.parse(sdRaw);
            const sphere = sd.sphere || 'personal';
            const skills = SC_SKILLS[sphere] || SC_SKILLS.personal;
            const entries = Object.entries(sd.scores || {});
            if (entries.length > 0) {
                const sorted = entries
                    .map(([qi, score]) => ({ qi: parseInt(qi), score }))
                    .sort((a,b) => a.score - b.score)
                    .slice(0, 3);
                const cards = sorted.map(({qi, score}) => {
                    const skill = skills[qi];
                    if (!skill) return '';
                    const pct = Math.round(score/4*100);
                    return `
                    <div class="sc-skill-card${_sc.skillId===skill.id?' active':''}" data-id="${skill.id}">
                        <div class="sc-skill-body">
                            <div class="sc-skill-name">${skill.name}</div>
                            <div class="sc-skill-sub">${skill.desc}</div>
                            <div class="sc-skill-bar-wrap">
                                <div class="sc-skill-bar-fill" style="width:${pct}%"></div>
                            </div>
                        </div>
                        <div class="sc-skill-score">${score}/4</div>
                    </div>`;
                }).filter(Boolean).join('');
                if (cards) diagBlock = `
                    <div class="sc-section-label">📊 Из диагностики — слабые места</div>
                    ${cards}`;
            }
        }
    } catch {}

    const renderList = (arr) => arr.map(sk => `
        <div class="sc-skill-card${_sc.skillId===sk.id?' active':''}" data-id="${sk.id}">
            <div class="sc-skill-body">
                <div class="sc-skill-name">${sk.name}</div>
                <div class="sc-skill-sub">${sk.desc}</div>
            </div>
        </div>`).join('');

    return `
        ${activePlan}
        ${diagBlock}
        <div class="sc-section-label" style="margin-top:${diagBlock?'18px':'0'}">🧠 Личностные навыки</div>
        ${renderList(SC_SKILLS.personal)}
        <div class="sc-section-label">💼 Профессиональные навыки</div>
        ${renderList(SC_SKILLS.professional)}

        <div class="sc-custom-block">
            <div class="sc-custom-label">✏️ Или введите свой навык:</div>
            <input class="sc-input" id="scCustomInput" placeholder="Например: публичные выступления, управление гневом..." value="${_sc.skillId==='custom'?(_sc.skillName||''):''}">
        </div>

        ${previewBlock}

        <button class="sc-btn sc-btn-primary" id="scStartBtn" style="margin-top:14px"${_sc.skillId?'':' disabled'}>
            🚀 Начать 21 день
        </button>
        <div class="sc-tip">
            💡 Выберите навык — увидите, что вас ждёт каждый из 21 дня. Можно начать сразу.
        </div>`;
}

function _scRenderPreview() {
    const sk = _scFindSkill(_sc.skillId);
    const promise = sk?.promise || _sc.skillPromise || _SC_CUSTOM_PROMISE;
    const name    = sk?.name    || _sc.skillName    || 'свой навык';

    const phases = DEFAULT_TEMPLATE_PLAN.weeks.map((w, i) => `
        <div class="sc-phase">
            <div class="sc-phase-num">${i+1}</div>
            <div class="sc-phase-body">
                <div class="sc-phase-theme">Неделя ${i+1}: ${w.theme}</div>
                <div class="sc-phase-mean">${w.meaning}</div>
            </div>
        </div>`).join('');

    const daysOpen = _sc.previewDays ? ' open' : '';
    const daysHtml = DEFAULT_TEMPLATE_PLAN.weeks.map((w, i) => `
        <div class="sc-preview-week">
            <div class="sc-preview-week-title">Неделя ${i+1} · ${w.theme}</div>
            ${w.exercises.map(e => `
                <div class="sc-preview-day-row">
                    <span class="n">${e.day}</span>
                    <span class="t">${e.task}</span>
                    <span class="d">${e.dur}</span>
                </div>`).join('')}
        </div>`).join('');

    return `
        <div class="sc-preview">
            <div class="sc-preview-promise-label">Что вы получите · ${name}</div>
            <div class="sc-preview-promise">${promise}</div>
            <div class="sc-phases">${phases}</div>
            <div class="sc-preview-toggle${daysOpen}" id="scPreviewToggle">
                <span class="arr">▸</span> ${_sc.previewDays?'Скрыть план по дням':'Посмотреть план по дням'}
            </div>
            <div class="sc-preview-days${daysOpen}" id="scPreviewDays">${daysHtml}</div>
        </div>`;
}

// ===== ЭКРАН ПЛАНА =====
function _scRenderPlan() {
    if (!_sc.plan) return '<p style="color:var(--text-secondary)">Ошибка загрузки плана</p>';

    const day     = _scCurrentDay();
    const done    = _sc.daysDone;
    const pct     = Math.round((done.length / 21) * 100);
    const all     = _scAllExercises();
    const promise = _sc.skillPromise || _scFindSkill(_sc.skillId)?.promise || _SC_CUSTOM_PROMISE;

    // По умолчанию — раскрыта только текущая неделя
    if (!_sc.openWeeks) {
        _sc.openWeeks = [false, false, false];
        _sc.openWeeks[_scWeekOf(day)] = true;
    }

    // СЕГОДНЯ
    const curEx = all.find(e => e.day === day);
    const isDoneToday = done.includes(day);
    const todayHtml = curEx ? `
        <div class="sc-section-label">⚡ Сегодня</div>
        <div class="sc-today-card">
            <div class="sc-today-header">
                <div class="sc-today-num">${day}</div>
                <div class="sc-today-task">${curEx.task}</div>
            </div>
            <div class="sc-today-dur">⏱ ${curEx.dur}</div>
            <div class="sc-today-inst">${curEx.inst}</div>
            ${!isDoneToday
                ? `<button class="sc-btn sc-btn-primary" id="scMarkDone">✅ Отметить выполнение</button>`
                : `<div style="font-size:12px;color:var(--text-secondary);text-align:center">✅ Выполнено сегодня — до завтра!</div>`}
        </div>` : '';

    // ЗАВТРА
    const tomEx = all.find(e => e.day === day + 1);
    const tomorrowHtml = tomEx ? `
        <div class="sc-tomorrow">
            <div>
                <div class="sc-tomorrow-label">Завтра</div>
                <div class="sc-tomorrow-task">${tomEx.task}</div>
            </div>
            <div style="flex:1"></div>
            <div class="sc-tomorrow-dur">⏱ ${tomEx.dur}</div>
        </div>` : '';

    // ВЕСЬ ПУТЬ — таймлайн
    const weeksHtml = _sc.plan.weeks.map((week, wi) => {
        const isOpen     = _sc.openWeeks[wi];
        const weekDone   = week.exercises.filter(e => done.includes(e.day)).length;
        const total      = week.exercises.length;

        const rowsHtml = week.exercises.map(ex => {
            const d         = ex.day;
            const isDone    = done.includes(d);
            const isCurrent = d === day && !isDone;
            const isFuture  = d > day && !isDone;
            const expanded  = _sc.expandedDay === d;
            const status    = isDone ? '✓' : (isCurrent ? '●' : (isFuture ? '·' : ''));
            const cls = [
                'sc-day-row',
                isDone    ? 'done'     : '',
                isCurrent ? 'current'  : '',
                expanded  ? 'expanded' : ''
            ].filter(Boolean).join(' ');
            const detail = expanded ? `
                <div class="sc-day-detail">
                    ${ex.inst}
                    <div class="sc-day-detail-actions">
                        <button class="sc-btn sc-btn-ghost sc-day-toggle-done" data-day="${d}">
                            ${isDone ? '↩️ Снять отметку' : '✅ Отметить выполнение'}
                        </button>
                    </div>
                </div>` : '';
            return `
                <div class="${cls}" data-day="${d}">
                    <div class="sc-day-num-pill">${d}</div>
                    <div class="sc-day-info">
                        <div class="sc-day-task">${ex.task}</div>
                        <div class="sc-day-dur">⏱ ${ex.dur}</div>
                    </div>
                    <div class="sc-day-status">${status}</div>
                    ${detail}
                </div>`;
        }).join('');

        return `
        <div class="sc-week">
            <div class="sc-week-head${isOpen?' open':''}" data-week="${wi}">
                <div class="sc-week-info">
                    <div class="sc-week-label">Неделя ${wi+1}</div>
                    <div class="sc-week-theme">${week.theme}</div>
                    <div class="sc-week-mean">${week.meaning || ''}</div>
                </div>
                <div class="sc-week-stats">${weekDone}/${total}</div>
                <div class="sc-week-toggle">▸</div>
            </div>
            <div class="sc-week-list${isOpen?' open':''}">${rowsHtml}</div>
        </div>`;
    }).join('');

    return `
        <div class="sc-plan-header">
            <div class="sc-plan-skill">🎯 ${_sc.skillName}</div>
            <div class="sc-plan-promise">${promise}</div>
            <div class="sc-plan-meta">
                День ${day} из 21 · выполнено ${done.length} упражнений · прогресс ${pct}%
            </div>
            <div class="sc-plan-progress">
                <div class="sc-plan-progress-fill" style="width:${pct}%"></div>
            </div>
        </div>

        ${todayHtml}
        ${tomorrowHtml}

        <div class="sc-section-label">🗺 Весь путь</div>
        ${weeksHtml}

        <div class="sc-btn-row" style="margin-top:20px">
            <button class="sc-btn sc-btn-ghost" id="scResetBtn">🔄 Новый навык</button>
            <button class="sc-btn sc-btn-ghost" id="scGoTraining">⚡ Тренировка дня</button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _scBindHandlers() {
    // Выбор карточки навыка
    document.querySelectorAll('.sc-skill-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const sk = _scFindSkill(id);
            if (!sk) return;
            _sc.skillId      = sk.id;
            _sc.skillName    = sk.name;
            _sc.skillDesc    = sk.desc;
            _sc.skillPromise = sk.promise;
            _sc.previewDays  = false;
            _scRender();
            // Прокрутить к превью
            setTimeout(() => {
                document.querySelector('.sc-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
        });
    });

    // Кастомный навык — отслеживаем ввод, чтобы активировать кнопку Старт
    const customInput = document.getElementById('scCustomInput');
    if (customInput) {
        customInput.addEventListener('input', () => {
            const v = customInput.value.trim();
            if (v) {
                _sc.skillId      = 'custom';
                _sc.skillName    = v;
                _sc.skillDesc    = 'персональный навык';
                _sc.skillPromise = _SC_CUSTOM_PROMISE;
                document.querySelectorAll('.sc-skill-card').forEach(c => c.classList.remove('active'));
                document.getElementById('scStartBtn')?.removeAttribute('disabled');
            }
        });
    }

    // Тоггл «План по дням» в превью
    document.getElementById('scPreviewToggle')?.addEventListener('click', () => {
        _sc.previewDays = !_sc.previewDays;
        document.getElementById('scPreviewToggle').classList.toggle('open', _sc.previewDays);
        document.getElementById('scPreviewDays').classList.toggle('open', _sc.previewDays);
        document.querySelector('#scPreviewToggle').innerHTML =
            `<span class="arr">▸</span> ${_sc.previewDays?'Скрыть план по дням':'Посмотреть план по дням'}`;
    });

    // Открыть существующий план
    document.getElementById('scOpenPlan')?.addEventListener('click', () => {
        _sc.view = 'plan';
        _sc.openWeeks   = null;
        _sc.expandedDay = null;
        _scRender();
    });

    // Старт
    document.getElementById('scStartBtn')?.addEventListener('click', () => {
        const custom = (document.getElementById('scCustomInput')?.value || '').trim();
        if (custom) {
            _sc.skillId      = 'custom';
            _sc.skillName    = custom;
            _sc.skillDesc    = 'персональный навык';
            _sc.skillPromise = _SC_CUSTOM_PROMISE;
        }
        if (!_sc.skillId || !_sc.skillName) {
            _scToast('Выберите навык или введите свой', 'error');
            return;
        }

        _sc.plan        = _scLocalPlan();
        _sc.daysDone    = [];
        _sc.startDate   = new Date().toISOString();
        _sc.openWeeks   = null;
        _sc.expandedDay = null;
        _scSave();
        _sc.view = 'plan';
        _scRender();
    });

    // СЕГОДНЯ — отметить выполнение
    document.getElementById('scMarkDone')?.addEventListener('click', () => {
        const day = _scCurrentDay();
        if (!_sc.daysDone.includes(day)) {
            _sc.daysDone.push(day);
            _scSave();
            if (day >= 21) _scToast('🏆 Навык сформирован! 21 день пройден.', 'success');
            else _scToast(`✅ День ${day} выполнен!`, 'success');
            _scRender();
        }
    });

    // Тоггл недели
    document.querySelectorAll('.sc-week-head').forEach(h => {
        h.addEventListener('click', () => {
            const wi = parseInt(h.dataset.week);
            if (!_sc.openWeeks) _sc.openWeeks = [false, false, false];
            _sc.openWeeks[wi] = !_sc.openWeeks[wi];
            _scRender();
        });
    });

    // Раскрыть день в таймлайне
    document.querySelectorAll('.sc-day-row').forEach(row => {
        row.addEventListener('click', (ev) => {
            // Не реагируем, если кликнули по кнопке внутри
            if (ev.target.closest('.sc-day-toggle-done')) return;
            const d = parseInt(row.dataset.day);
            _sc.expandedDay = (_sc.expandedDay === d) ? null : d;
            _scRender();
        });
    });

    // Кнопка отметки внутри развёрнутого дня
    document.querySelectorAll('.sc-day-toggle-done').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const d = parseInt(btn.dataset.day);
            if (_sc.daysDone.includes(d)) _sc.daysDone = _sc.daysDone.filter(x => x !== d);
            else                          _sc.daysDone.push(d);
            _scSave();
            _scRender();
        });
    });

    // Новый навык (с подтверждением)
    document.getElementById('scResetBtn')?.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:320px;width:100%">
            <div style="font-size:14px;color:var(--text-primary);margin-bottom:6px;font-weight:600">Начать новый навык?</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px">Текущий прогресс будет сброшен.</div>
            <div style="display:flex;gap:10px">
                <button id="cfNo"  style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Нет</button>
                <button id="cfYes" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Да</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#cfNo').onclick  = () => overlay.remove();
        overlay.querySelector('#cfYes').onclick = () => {
            overlay.remove();
            _sc.skillId = _sc.skillName = _sc.skillDesc = _sc.skillPromise = _sc.plan = _sc.startDate = null;
            _sc.daysDone    = [];
            _sc.openWeeks   = null;
            _sc.expandedDay = null;
            _sc.view = 'select';
            _scSave();
            _scRender();
        };
    });

    // К тренировке дня
    document.getElementById('scGoTraining')?.addEventListener('click', () => {
        if (typeof showDailyTrainingScreen === 'function') {
            showDailyTrainingScreen();
        } else {
            const s = document.createElement('script');
            s.src = 'daily_training.js';
            s.onload = () => { if (typeof showDailyTrainingScreen==='function') showDailyTrainingScreen(); };
            document.head.appendChild(s);
        }
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showSkillChoiceScreen() {
    _scLoad();
    _sc.view        = 'select';
    _sc.openWeeks   = null;
    _sc.expandedDay = null;
    _sc.previewDays = false;
    _scRender();
}

window.showSkillChoiceScreen = showSkillChoiceScreen;
console.log('✅ skill_choice.js v3.0 загружен (план по дням + промис + превью пути)');
