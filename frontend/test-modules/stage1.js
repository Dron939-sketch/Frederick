// ============================================
// stage1.js - КОНФИГУРАЦИЯ ВОСПРИЯТИЯ
// ============================================

const Stage1Questions = [
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
];

const Stage1Intro = {
    name: 'КОНФИГУРАЦИЯ ВОСПРИЯТИЯ',
    shortDesc: 'Линза, через которую вы смотрите на мир',
    detailedDesc: `🔍 ЧТО МЫ ИССЛЕДУЕМ:

• Куда направлено ваше внимание — вовне или внутрь
• Какая тревога доминирует — страх отвержения или страх потери контроля

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`
};

class Stage1Manager {
    constructor(core) {
        this.core = core;
        this.questions = Stage1Questions;
        this.intro = Stage1Intro;
    }
    
    getQuestions() {
        return this.questions;
    }
    
    getIntro() {
        return this.intro;
    }
    
    handleAnswer(opt) {
        if (opt.scores) {
            for (let axis in opt.scores) {
                this.core.perceptionScores[axis] += opt.scores[axis];
            }
        }
    }
    
    complete() {
        this.core.perceptionType = this.core.determinePerceptionType();
        const isExternal = this.core.perceptionType.includes("СОЦИАЛЬНО") || 
                           this.core.perceptionType.includes("СТАТУСНО");
        
        // Обновляем количество вопросов для 2 этапа
        if (this.core.stages[1]) {
            const questions = isExternal ? Stage2Questions.external : Stage2Questions.internal;
            this.core.stages[1].total = questions.length;
        }
        
        return this.core.getStage1Interpretation();
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Stage1Questions, Stage1Intro, Stage1Manager };
}
