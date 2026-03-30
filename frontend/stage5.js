// ============================================
// stage5.js - ГЛУБИННЫЕ ПАТТЕРНЫ
// ============================================

const Stage5Questions = [
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
];

const Stage5Intro = {
    name: 'ГЛУБИННЫЕ ПАТТЕРНЫ',
    shortDesc: 'Тип привязанности, защитные механизмы',
    detailedDesc: `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Какой у вас тип привязанности (из детства)
• Какие защитные механизмы вы используете
• Какие глубинные убеждения управляют вами
• Чего вы боитесь на самом деле

📊 Вопросов: 10
⏱ Время: ~5 минут

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`
};

class Stage5Manager {
    constructor(core) {
        this.core = core;
        this.questions = Stage5Questions;
        this.intro = Stage5Intro;
    }
    
    getQuestions() {
        return this.questions;
    }
    
    getIntro() {
        return this.intro;
    }
    
    handleAnswer(opt, q) {
        this.core.deepAnswers.push({
            questionId: q.id,
            pattern: opt.pattern,
            target: q.target
        });
    }
    
    complete() {
        this.core.deepPatterns = this.core.analyzeDeepPatterns();
        return this.core.getStage5Interpretation();
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Stage5Questions, Stage5Intro, Stage5Manager };
}
