// ============================================
// stage3.js - КОНФИГУРАЦИЯ ПОВЕДЕНИЯ
// ============================================

const Stage3Questions = [
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
];

const Stage3Intro = {
    name: 'КОНФИГУРАЦИЯ ПОВЕДЕНИЯ',
    shortDesc: 'Ваши автоматические реакции',
    detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Ваши автоматические реакции
• Как вы действуете в разных ситуациях
• Какие стратегии поведения закреплены

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`
};

class Stage3Manager {
    constructor(core) {
        this.core = core;
        this.questions = Stage3Questions;
        this.intro = Stage3Intro;
    }
    
    getQuestions() {
        return this.questions;
    }
    
    getIntro() {
        return this.intro;
    }
    
    handleAnswer(opt) {
        if (opt.level) {
            this.core.stage3Scores.push(opt.level);
            if (opt.strategy) {
                this.core.behavioralLevels[opt.strategy].push(opt.level);
            }
        }
    }
    
    complete() {
        const interpretation = this.core.getStage3Interpretation();
        const finalLevel = this.core.calculateFinalLevel();
        
        const sbAvg = this.core.behavioralLevels["СБ"].length 
            ? Math.round(this.core.behavioralLevels["СБ"].reduce((a, b) => a + b, 0) / this.core.behavioralLevels["СБ"].length) 
            : 3;
        const tfAvg = this.core.behavioralLevels["ТФ"].length 
            ? Math.round(this.core.behavioralLevels["ТФ"].reduce((a, b) => a + b, 0) / this.core.behavioralLevels["ТФ"].length) 
            : 3;
        const ubAvg = this.core.behavioralLevels["УБ"].length 
            ? Math.round(this.core.behavioralLevels["УБ"].reduce((a, b) => a + b, 0) / this.core.behavioralLevels["УБ"].length) 
            : 3;
        const chvAvg = this.core.behavioralLevels["ЧВ"].length 
            ? Math.round(this.core.behavioralLevels["ЧВ"].reduce((a, b) => a + b, 0) / this.core.behavioralLevels["ЧВ"].length) 
            : 3;
        
        return {
            interpretation,
            finalLevel,
            averages: { sbAvg, tfAvg, ubAvg, chvAvg }
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Stage3Questions, Stage3Intro, Stage3Manager };
}
