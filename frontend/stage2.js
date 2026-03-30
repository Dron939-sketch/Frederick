// ============================================
// stage2.js - КОНФИГУРАЦИЯ МЫШЛЕНИЯ
// ============================================

const Stage2Questions = {
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
};

const Stage2Intro = {
    name: 'КОНФИГУРАЦИЯ МЫШЛЕНИЯ',
    shortDesc: 'Как вы обрабатываете информацию',
    detailedDesc: `🎯 САМОЕ ВАЖНОЕ:

Конфигурация мышления — это траектория с чётким пунктом назначения: результат, к которому вы придёте. Если ничего не менять — вы попадёте именно туда.

📊 Вопросов: 4-5
⏱ Время: ~3-4 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`
};

class Stage2Manager {
    constructor(core) {
        this.core = core;
        this.intro = Stage2Intro;
    }
    
    getQuestions() {
        const isExternal = this.core.perceptionType === "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ" || 
                           this.core.perceptionType === "СТАТУСНО-ОРИЕНТИРОВАННЫЙ";
        return isExternal ? Stage2Questions.external : Stage2Questions.internal;
    }
    
    getIntro() {
        return this.intro;
    }
    
    handleAnswer(opt, q) {
        if (opt.level) {
            this.core.thinkingScores[opt.level] = (this.core.thinkingScores[opt.level] || 0) + 1;
            if (q.measures && q.measures !== 'thinking') {
                this.core.strategyLevels[q.measures].push(opt.level);
            }
        }
    }
    
    complete() {
        this.core.thinkingLevel = this.core.calculateThinkingLevel();
        return this.core.getStage2Interpretation();
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Stage2Questions, Stage2Intro, Stage2Manager };
}
