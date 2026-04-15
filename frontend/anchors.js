// ============================================
// МОДУЛЬ: ЯКОРЯ И ИМПРИНТЫ
// Версия: 2.1 (с полной диагностикой импринтов)
// ============================================

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const ANCHORS_CONFIG = {
    modalities: {
        visual: { name: 'Визуальный', icon: '👁️', desc: 'Жест, символ, образ' },
        auditory: { name: 'Аудиальный', icon: '🔊', desc: 'Слово, звук, фраза' },
        kinesthetic: { name: 'Кинестетический', icon: '🖐️', desc: 'Прикосновение, поза' }
    },

    states: {
        calm: { name: 'Спокойствие', icon: '😌', desc: 'Расслабление, умиротворение' },
        confidence: { name: 'Уверенность', icon: '💪', desc: 'Сила, вера в себя' },
        focus: { name: 'Фокус', icon: '🎯', desc: 'Концентрация, внимание' },
        energy: { name: 'Энергия', icon: '⚡', desc: 'Бодрость, активность' },
        love: { name: 'Любовь', icon: '💖', desc: 'Тепло, принятие' },
        gratitude: { name: 'Благодарность', icon: '🙏', desc: 'Ценность жизни' },
        safety: { name: 'Безопасность', icon: '🛡️', desc: 'Защищённость' },
        joy: { name: 'Радость', icon: '😊', desc: 'Лёгкость, счастье' },
        grounding: { name: 'Заземление', icon: '🌍', desc: 'Связь с телом' },
        action: { name: 'Действие', icon: '🚀', desc: 'Импульс к началу' }
    },

    techniques: {
        stacking: { name: 'Накладка якорей', icon: '🔗', desc: 'Соединение двух состояний' },
        collapse: { name: 'Коллапс якорей', icon: '💥', desc: 'Разрушение негативного якоря' },
        chaining: { name: 'Цепочка якорей', icon: '⛓️', desc: 'Последовательная активация' },
        reimprinting: { name: 'Реимпринтинг', icon: '🔄', desc: 'Перезапись импринта' }
    },

    sources: {
        own: { name: 'Мой опыт', icon: '🧠', desc: 'Из вашей жизни' },
        movie: { name: 'Из фильма', icon: '🎬', desc: 'Сцена из кино' },
        music: { name: 'Из музыки', icon: '🎵', desc: 'Трек или звук' },
        metaphor: { name: 'Метафора', icon: '📖', desc: 'Образный ряд' },
        body: { name: 'Через тело', icon: '🧘', desc: 'Дыхание, поза' },
        other: { name: 'Опыт другого', icon: '👥', desc: 'Эмпатия к герою' }
    }
};

// ============================================
// КОНФИГУРАЦИЯ ИМПРИНТОВ
// ============================================

const IMPRINTS_CONFIG = {
    types: {
        abandonment: {
            id: 'abandonment',
            name: 'Импринт отвержения',
            icon: '😔',
            color: '#ff6b6b',
            shortDesc: 'Страх, что вас бросят',
            description: 'Глубинное убеждение, что вы не нужны, что вас отвергнут или покинут. Часто формируется в возрасте 0-3 лет.',
            childhood: 'В детстве вы могли чувствовать, что ваши потребности не важны. Возможно, родители были эмоционально холодны или непредсказуемы.',
            adult_manifestations: [
                'Страх близких отношений',
                'Тревога при расставаниях',
                'Потребность в постоянных подтверждениях любви',
                'Созависимость в отношениях',
                'Ревность без повода'
            ],
            healing_phrase: 'Я ценен сам по себе. Моё присутствие — уже дар.',
            recommended_anchor: 'Безопасность в себе',
            affirmation: 'Я достоин любви просто потому, что я есть'
        },
        danger: {
            id: 'danger',
            name: 'Импринт опасности',
            icon: '⚠️',
            color: '#ff9800',
            shortDesc: 'Мир опасен',
            description: 'Глубинное убеждение, что мир — опасное место, где нельзя расслабляться. Формируется в возрасте 0-3 лет.',
            childhood: 'В детстве мир казался непредсказуемым и угрожающим. Возможно, были травмирующие события или гиперопека.',
            adult_manifestations: [
                'Генерализованная тревожность',
                'Избегание нового и неизвестного',
                'Гиперконтроль всего вокруг',
                'Панические атаки',
                'Потребность в безопасности'
            ],
            healing_phrase: 'Сейчас я в безопасности. Я справлюсь с любыми вызовами.',
            recommended_anchor: 'Безопасное место',
            affirmation: 'Мир безопасен, я под защитой'
        },
        perfectionism: {
            id: 'perfectionism',
            name: 'Импринт перфекционизма',
            icon: '🎯',
            color: '#4caf50',
            shortDesc: 'Надо быть идеальным',
            description: 'Убеждение, что нужно быть идеальным, чтобы заслужить любовь и принятие. Формируется в возрасте 3-7 лет.',
            childhood: 'Вас хвалили только за достижения, а не за сам факт существования. Ошибки наказывались.',
            adult_manifestations: [
                'Прокрастинация из-за страха ошибки',
                'Эмоциональное выгорание',
                'Неспособность радоваться результатам',
                'Жёсткая самокритика',
                'Синдром самозванца'
            ],
            healing_phrase: 'Я достаточно хорош. Мои ошибки — это опыт, а не приговор.',
            recommended_anchor: 'Принятие несовершенства',
            affirmation: 'Я имею право ошибаться'
        },
        emotional_suppression: {
            id: 'emotional_suppression',
            name: 'Импринт подавления эмоций',
            icon: '🔇',
            color: '#9c27b0',
            shortDesc: 'Чувства = слабость',
            description: 'Убеждение, что эмоции — это слабость, опасность или что-то постыдное. Формируется в возрасте 3-7 лет.',
            childhood: 'Вам говорили "не плачь", "не злись", "будь хорошим мальчиком/девочкой". Эмоции не принимались.',
            adult_manifestations: [
                'Сложность в выражении чувств',
                'Психосоматические заболевания',
                'Эмоциональное онемение',
                'Внезапные эмоциональные взрывы',
                'Трудности в эмпатии'
            ],
            healing_phrase: 'Мои чувства имеют значение. Я разрешаю себе чувствовать.',
            recommended_anchor: 'Разрешение на эмоции',
            affirmation: 'Мои эмоции — это моя сила'
        },
        helplessness: {
            id: 'helplessness',
            name: 'Импринт беспомощности',
            icon: '🪶',
            color: '#607d8b',
            shortDesc: 'Я ничего не могу изменить',
            description: 'Убеждение, что вы не можете влиять на свою жизнь и обстоятельства. Формируется в возрасте 0-7 лет.',
            childhood: 'Ваши попытки что-то изменить не приводили к результату. Возможно, были травмирующие события вне вашего контроля.',
            adult_manifestations: [
                'Жертвенная позиция',
                'Отсутствие инициативы',
                'Депрессивные эпизоды',
                'Выученная беспомощность',
                'Прокрастинация'
            ],
            healing_phrase: 'Я могу влиять на свою жизнь. Мои действия имеют значение.',
            recommended_anchor: 'Агентность и сила',
            affirmation: 'Я создаю свою реальность'
        },
        unworthiness: {
            id: 'unworthiness',
            name: 'Импринт недостойности',
            icon: '💔',
            color: '#e91e63',
            shortDesc: 'Я недостаточно хорош',
            description: 'Убеждение, что вы недостаточно хороши, умны, красивы, успешны. Формируется в возрасте 3-7 лет.',
            childhood: 'Вас сравнивали с другими не в вашу пользу. Критика преобладала над похвалой.',
            adult_manifestations: [
                'Низкая самооценка',
                'Трудности с принятием комплиментов',
                'Сравнение себя с другими',
                'Заниженные ожидания от жизни',
                'Синдром самозванца'
            ],
            healing_phrase: 'Я ценен независимо от достижений. Я уже достаточно хорош.',
            recommended_anchor: 'Самоценность',
            affirmation: 'Я ценен просто потому, что я есть'
        },
        control: {
            id: 'control',
            name: 'Импринт контроля',
            icon: '🎮',
            color: '#00bcd4',
            shortDesc: 'Всё должно быть под контролем',
            description: 'Убеждение, что нужно контролировать всё вокруг, чтобы избежать катастрофы. Формируется в возрасте 3-7 лет.',
            childhood: 'В детстве было много хаоса или непредсказуемости. Контроль был способом выжить.',
            adult_manifestations: [
                'Микроменеджмент',
                'Трудности с делегированием',
                'Тревога при потере контроля',
                'Ригидность мышления',
                'Конфликты в команде'
            ],
            healing_phrase: 'Я отпускаю контроль. Жизнь течёт, и это безопасно.',
            recommended_anchor: 'Доверие процессу',
            affirmation: 'Я доверяю жизни'
        }
    },

    // Вопросы для диагностики
    questions: [
        { text: "Я боюсь, что близкие люди могут меня бросить", imprint: "abandonment", weight: 2 },
        { text: "Мне трудно доверять новым людям", imprint: "abandonment", weight: 1 },
        { text: "Я постоянно жду подвоха от жизни", imprint: "danger", weight: 2 },
        { text: "Мир кажется мне непредсказуемым и пугающим", imprint: "danger", weight: 2 },
        { text: "Ошибки для меня катастрофа", imprint: "perfectionism", weight: 2 },
        { text: "Я очень требователен к себе", imprint: "perfectionism", weight: 2 },
        { text: "Мне трудно выражать свои чувства", imprint: "emotional_suppression", weight: 2 },
        { text: "Я считаю, что плакать — это стыдно", imprint: "emotional_suppression", weight: 1 },
        { text: "Я чувствую, что ничего не могу изменить", imprint: "helplessness", weight: 2 },
        { text: "Мне трудно начинать новые дела", imprint: "helplessness", weight: 1 },
        { text: "Я часто чувствую себя недостаточно хорошим", imprint: "unworthiness", weight: 2 },
        { text: "Мне трудно принимать комплименты", imprint: "unworthiness", weight: 1 },
        { text: "Мне нужно всё контролировать", imprint: "control", weight: 2 },
        { text: "Я не могу расслабиться, пока всё не сделаю сам", imprint: "control", weight: 1 },
        { text: "Я боюсь, что буду один", imprint: "abandonment", weight: 1 },
        { text: "Я часто тревожусь без видимой причины", imprint: "danger", weight: 1 },
        { text: "Мне стыдно за свои ошибки", imprint: "perfectionism", weight: 1 },
        { text: "Я часто злюсь, но не могу это выразить", imprint: "emotional_suppression", weight: 1 },
        { text: "Я чувствую себя жертвой обстоятельств", imprint: "helplessness", weight: 1 },
        { text: "Я постоянно сравниваю себя с другими", imprint: "unworthiness", weight: 1 }
    ]
};

// ============================================
// ХРАНИЛИЩЕ
// ============================================

let userAnchors = [];
let currentAnchorView = 'list';
let anchorWizardStep = 0;
let anchorWizardData = {};
let reimprintingStep = 0;
let reimprintingData = {};
let diagnosticAnswers = {};
let diagnosticResult = null;
let currentImprint = null;

// ============================================
// СТИЛИ
// ============================================

function _anInjectStyles() {
    if (document.getElementById('an-v2-styles')) return;
    const style = document.createElement('style');
    style.id = 'an-v2-styles';
    style.textContent = `
        .an-tabs {
            display:flex;flex-wrap:wrap;gap:4px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);
            border-radius:40px;padding:4px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none;
        }
        .an-tabs::-webkit-scrollbar{display:none}
        .an-tab {
            flex-shrink:0;padding:8px 12px;border-radius:30px;border:none;
            background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;
            font-family:inherit;cursor:pointer;transition:background 0.2s;min-height:36px;white-space:nowrap;
        }
        .an-tab.active{background:rgba(224,224,224,0.14);color:var(--text-primary)}

        .anchor-card{background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid rgba(224,224,224,0.1);transition:all 0.2s}
        .anchor-card:hover{background:rgba(224,224,224,0.08);transform:translateX(4px)}
        .anchor-name{font-size:18px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}
        .anchor-actions{display:flex;gap:12px;margin-top:12px}
        .anchor-btn{padding:8px 16px;border-radius:30px;border:none;cursor:pointer;font-size:13px;transition:all 0.2s;font-family:inherit}
        .fire-btn{background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);color:var(--text-primary)}
        .delete-btn{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.14);color:var(--text-secondary)}
        .recommend-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:16px;padding:16px;margin-bottom:12px;border-left:3px solid rgba(224,224,224,0.3)}
        .wizard-step{background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;margin-top:20px}
        .wizard-options{display:flex;flex-direction:column;gap:12px;margin:20px 0}
        .wizard-option{background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.1);border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s}
        .wizard-option:hover{background:rgba(224,224,224,0.08);border-color:rgba(224,224,224,0.3)}
        .an-progress-bar{height:4px;background:rgba(224,224,224,0.1);border-radius:2px;overflow:hidden;margin:8px 0}
        .an-progress-fill{height:100%;background:linear-gradient(90deg,rgba(224,224,224,0.4),rgba(192,192,192,0.3));width:0%;transition:width 0.3s}
        .imprint-card{background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.2s}
        .imprint-card:hover{background:rgba(224,224,224,0.08);transform:translateX(4px)}

        .diagnostic-card{background:rgba(224,224,224,0.05);border-radius:24px;padding:32px;margin:24px 0;text-align:center}
        .question-counter{font-size:12px;color:var(--text-secondary);margin-bottom:16px}
        .question-text{font-size:20px;font-weight:600;margin-bottom:32px;line-height:1.4}
        .answer-options{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
        .answer-btn{background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.1);border-radius:40px;padding:12px 24px;cursor:pointer;font-size:14px;transition:all 0.2s;font-family:inherit;color:var(--text-primary)}
        .answer-btn:hover{background:rgba(224,224,224,0.16);border-color:rgba(224,224,224,0.3);transform:scale(1.02)}
        .diagnostic-note{text-align:center;font-size:12px;color:var(--text-secondary);margin-top:20px}
        .result-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin:16px 0;border-left:4px solid var(--imprint-color,rgba(224,224,224,0.3))}
        .result-icon{font-size:48px;margin-bottom:12px}
        .result-name{font-size:24px;font-weight:700;margin-bottom:8px}
        .result-desc{color:var(--text-secondary);line-height:1.6;margin-bottom:20px}
        .manifestations-list{background:rgba(224,224,224,0.03);border-radius:16px;padding:16px;margin:16px 0}
        .manifestations-list li{margin:8px 0;margin-left:20px}
        .healing-box{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:16px;padding:16px;margin:16px 0}

        .reimprinting-card{background:rgba(224,224,224,0.05);border-radius:24px;padding:32px;margin:24px 0}
        .step-title{font-size:18px;font-weight:600;margin-bottom:24px;color:var(--text-primary)}
        .step-icon{font-size:48px;text-align:center;margin-bottom:16px}
        .step-question{font-size:18px;font-weight:500;margin-bottom:20px;line-height:1.4}
        .reimprinting-textarea{width:100%;padding:16px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);font-family:inherit;font-size:14px;min-height:120px;resize:vertical;box-sizing:border-box}
        .reimprinting-textarea:focus{outline:none;border-color:rgba(224,224,224,0.35)}
        .reimprinting-input{width:100%;padding:16px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);font-size:16px;box-sizing:border-box;font-family:inherit}
        .reimprinting-input:focus{outline:none;border-color:rgba(224,224,224,0.35)}
        .step-instruction{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:16px;padding:20px;margin:20px 0;line-height:1.6;text-align:center}
        .step-hint{font-size:12px;color:var(--text-secondary);margin-top:16px;padding:12px;background:rgba(224,224,224,0.03);border-radius:12px}
        .an-btn-primary{background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);padding:14px 24px;border-radius:40px;color:var(--text-primary);font-weight:600;cursor:pointer;width:100%;margin-top:16px;font-family:inherit;font-size:13px}
    `;
    document.head.appendChild(style);
}

// ============================================
// API ВЫЗОВЫ
// ============================================

async function loadUserAnchors() {
    try {
        const response = await apiCall(`/api/anchors/user/${CONFIG.USER_ID}`);
        userAnchors = response.anchors || [];
        return userAnchors;
    } catch (e) {
        console.warn('Failed to load anchors:', e);
        userAnchors = [];
        return [];
    }
}

async function saveAnchor(anchorData) {
    try {
        const response = await apiCall('/api/anchors/save', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, ...anchorData })
        });
        return response.success;
    } catch (e) {
        console.error('Failed to save anchor:', e);
        return false;
    }
}

async function deleteAnchor(anchorId) {
    try {
        const response = await apiCall('/api/anchors/delete', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, anchor_id: anchorId })
        });
        return response.success;
    } catch (e) {
        console.error('Failed to delete anchor:', e);
        return false;
    }
}

async function fireAnchorAPI(anchorId, anchorName) {
    try {
        const response = await apiCall('/api/anchors/fire', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, anchor_id: anchorId, anchor_name: anchorName })
        });
        return response.phrase || anchorName;
    } catch (e) {
        console.error('Failed to fire anchor:', e);
        return null;
    }
}

async function getProfileBasedRecommendations() {
    try {
        const status = await getUserStatus();
        if (!status.has_profile) return [];
        
        const vectors = status.vectors || {};
        const recommendations = [];
        
        if (vectors.SB && vectors.SB < 3) {
            recommendations.push({
                state: 'action',
                name: 'Импульс действия',
                trigger: 'хлопок в ладоши',
                phrase: 'Раз! И я начинаю.',
                reason: 'Ваш вектор действия (СБ) нуждается в поддержке'
            });
        }
        if (vectors.TF && vectors.TF < 3) {
            recommendations.push({
                state: 'grounding',
                name: 'Заземление',
                trigger: 'стопы в пол',
                phrase: 'Я здесь. Моё тело — моя опора.',
                reason: 'Ваш телесный вектор (ТФ) нуждается в заземлении'
            });
        }
        if (vectors.UB && vectors.UB < 3) {
            recommendations.push({
                state: 'calm',
                name: 'Гибкость',
                trigger: 'пожать плечами',
                phrase: 'Можно и так.',
                reason: 'Ваш вектор гибкости (УБ) нуждается в расслаблении'
            });
        }
        if (vectors.CV && vectors.CV < 3) {
            recommendations.push({
                state: 'joy',
                name: 'Тепло',
                trigger: 'рука на сердце',
                phrase: 'Я чувствую. Я живу.',
                reason: 'Ваш эмоциональный вектор (ЧВ) нуждается в тепле'
            });
        }
        
        return recommendations;
    } catch (e) {
        console.warn('Failed to get recommendations:', e);
        return [];
    }
}

// ============================================
// ДИАГНОСТИКА ИМПРИНТОВ
// ============================================

function startImprintDiagnostic() {
    diagnosticAnswers = {};
    diagnosticResult = null;
    showDiagnosticQuestion(0);
}

function showDiagnosticQuestion(index) {
    const questions = IMPRINTS_CONFIG.questions;
    if (index >= questions.length) {
        finishDiagnostic();
        return;
    }
    
    const question = questions[index];
    const progress = Math.round((index / questions.length) * 100);
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    _anInjectStyles();
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📚</div>
                <h1 class="content-title">Диагностика импринтов</h1>
            </div>

            <div class="an-progress-bar">
                <div class="an-progress-fill" style="width: ${progress}%"></div>
            </div>

            <div class="diagnostic-card">
                <div class="question-counter">Вопрос ${index + 1} из ${questions.length}</div>
                <div class="question-text">${question.text}</div>
                <div class="answer-options">
                    <button class="answer-btn" data-value="0">❌ Совсем нет</button>
                    <button class="answer-btn" data-value="1">🤔 Иногда</button>
                    <button class="answer-btn" data-value="2">😐 Часто</button>
                    <button class="answer-btn" data-value="3">✅ Очень точно</button>
                </div>
            </div>

            <div class="diagnostic-note">
                💡 Честные ответы помогут точнее определить ваши глубинные программы
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => {
        if (confirm('Вы уверены? Прогресс диагностики будет потерян.')) {
            showAnchorsScreen();
        }
    };
    
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.value);
            diagnosticAnswers[index] = { question: question.text, imprint: question.imprint, weight: question.weight, value: value * question.weight };
            showDiagnosticQuestion(index + 1);
        });
    });
}

function finishDiagnostic() {
    // Подсчёт баллов по типам импринтов
    const scores = {};
    
    for (const [type, config] of Object.entries(IMPRINTS_CONFIG.types)) {
        scores[type] = 0;
    }
    
    for (let i = 0; i < IMPRINTS_CONFIG.questions.length; i++) {
        const answer = diagnosticAnswers[i];
        if (answer && answer.imprint) {
            scores[answer.imprint] += answer.value;
        }
    }
    
    // Находим максимальный балл
    let maxScore = 0;
    let dominantImprint = null;
    
    for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            dominantImprint = type;
        }
    }
    
    diagnosticResult = {
        dominant: dominantImprint,
        scores: scores,
        config: IMPRINTS_CONFIG.types[dominantImprint]
    };
    
    showDiagnosticResult();
}

function showDiagnosticResult() {
    const result = diagnosticResult;
    const imprint = result.config;
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    // Сортируем импринты по убыванию баллов
    const sortedScores = Object.entries(result.scores)
        .map(([id, score]) => ({ id, score, config: IMPRINTS_CONFIG.types[id] }))
        .sort((a, b) => b.score - a.score)
        .filter(s => s.score > 0);
    
    _anInjectStyles();
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Результаты диагностики</h1>
            </div>
            
            <div class="result-card" style="--imprint-color: ${imprint.color}">
                <div class="result-icon">${imprint.icon}</div>
                <div class="result-name">${imprint.name}</div>
                <div class="result-desc">${imprint.description}</div>
            </div>
            
            <div class="healing-box">
                <div style="font-weight: 700; margin-bottom: 8px;">🌱 Исцеляющая фраза</div>
                <div style="font-size: 18px; font-style: italic;">«${imprint.healing_phrase}»</div>
                <button class="action-btn" id="saveHealingPhraseBtn" style="margin-top: 12px;">💾 Сохранить как якорь</button>
            </div>
            
            <div class="manifestations-list">
                <div style="font-weight: 700; margin-bottom: 8px;">📌 Как это проявляется во взрослой жизни:</div>
                <ul>
                    ${imprint.adult_manifestations.map(m => `<li>${m}</li>`).join('')}
                </ul>
            </div>
            
            <div style="background: rgba(33,150,243,0.1); border-radius: 16px; padding: 16px; margin: 16px 0;">
                <div style="font-weight: 700; margin-bottom: 8px;">👶 Откуда это взялось:</div>
                <div style="color: var(--text-secondary);">${imprint.childhood}</div>
            </div>
            
            <div class="result-card" style="background: rgba(255,193,7,0.1);">
                <div style="font-weight: 700; margin-bottom: 8px;">🔑 Рекомендуемый якорь</div>
                <div>${imprint.recommended_anchor}</div>
                <button class="action-btn" id="createRecommendedAnchorBtn" style="margin-top: 12px;">➕ Создать этот якорь</button>
            </div>
            
            <div class="result-card">
                <div style="font-weight: 700; margin-bottom: 12px;">📈 Все импринты (по степени выраженности)</div>
                ${sortedScores.map(s => `
                    <div style="margin: 12px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>${s.config.icon} ${s.config.name}</span>
                            <span>${Math.round((s.score / (IMPRINTS_CONFIG.questions.length * 3)) * 100)}%</span>
                        </div>
                        <div class="an-progress-bar" style="height: 6px;">
                            <div class="an-progress-fill" style="width: ${(s.score / (IMPRINTS_CONFIG.questions.length * 3)) * 100}%; background: ${s.config.color};"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="action-btn" id="startReimprintingBtn">🔄 Начать реимпринтинг</button>
                <button class="action-btn" id="saveResultsBtn">💾 Сохранить результаты</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => showAnchorsScreen();
    
    document.getElementById('saveHealingPhraseBtn')?.addEventListener('click', async () => {
        const anchorData = {
            name: `Исцеление: ${imprint.name}`,
            state: 'love',
            source: 'imprint',
            source_detail: imprint.healing_phrase,
            modality: 'auditory',
            trigger: imprint.healing_phrase,
            phrase: imprint.healing_phrase,
            icon: imprint.icon,
            state_icon: '💖',
            state_name: 'Исцеление'
        };
        const success = await saveAnchor(anchorData);
        if (success) {
            showToast('✅ Исцеляющая фраза сохранена как якорь!', 'success');
            await loadUserAnchors();
        } else {
            showToast('❌ Ошибка сохранения', 'error');
        }
    });
    
    document.getElementById('createRecommendedAnchorBtn')?.addEventListener('click', async () => {
        anchorWizardData = {
            state: 'safety',
            source: 'own',
            source_detail: imprint.recommended_anchor,
            modality: 'auditory',
            trigger: imprint.healing_phrase,
            name: imprint.recommended_anchor
        };
        anchorWizardStep = 3;
        showAnchorsScreen();
    });
    
    document.getElementById('startReimprintingBtn')?.addEventListener('click', () => {
        reimprintingData = {
            imprintType: result.dominant,
            imprintName: imprint.name,
            situation: imprint.childhood,
            decision: `Я решил, что ${imprint.shortDesc.toLowerCase()}`,
            newMessage: imprint.healing_phrase
        };
        startReimprinting();
    });
    
    document.getElementById('saveResultsBtn')?.addEventListener('click', () => {
        localStorage.setItem('fredi_imprint_results', JSON.stringify({
            dominant: result.dominant,
            scores: result.scores,
            date: new Date().toISOString()
        }));
        showToast('✅ Результаты сохранены', 'success');
    });
}

// ============================================
// РЕИМПРИНТИНГ (ПОЛНАЯ ВЕРСИЯ)
// ============================================

function startReimprinting() {
    reimprintingStep = 1;
    if (!reimprintingData.situation) {
        reimprintingData = {
            situation: '',
            decision: '',
            newMessage: '',
            newAnchor: ''
        };
    }
    showReimprintingScreen();
}

function showReimprintingScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const steps = {
        1: {
            title: 'Шаг 1 из 5: Найдите ситуацию',
            content: `
                <div class="reimprinting-step">
                    <div class="step-icon">🔍</div>
                    <div class="step-question">Какая ситуация из детства до сих пор влияет на вас?</div>
                    <textarea id="situation" placeholder="Например: «Меня наказали за ошибку, и я решил, что ошибаться нельзя»" class="reimprinting-textarea">${reimprintingData.situation || ''}</textarea>
                    <div class="step-hint">💡 Вспомните конкретный момент. Кто был рядом? Что вы чувствовали?</div>
                </div>
            `
        },
        2: {
            title: 'Шаг 2 из 5: Распознайте решение',
            content: `
                <div class="reimprinting-step">
                    <div class="step-icon">💭</div>
                    <div class="step-question">Какое решение вы тогда приняли? Какой импринт сформировался?</div>
                    <textarea id="decision" placeholder="Например: «Я решил, что должен быть идеальным, чтобы меня любили»" class="reimprinting-textarea">${reimprintingData.decision || ''}</textarea>
                    <div class="step-hint">💡 Это было лучшее решение, которое вы могли принять в той ситуации. Оно помогало вам выжить.</div>
                </div>
            `
        },
        3: {
            title: 'Шаг 3 из 5: Войдите в ресурс',
            content: `
                <div class="reimprinting-step">
                    <div class="step-icon">🧘</div>
                    <div class="step-question">Представьте, что вы — взрослый, мудрый, ресурсный.</div>
                    <div class="step-instruction">
                        <p>Сделайте глубокий вдох... Почувствуйте свою силу...</p>
                        <p>Вы прошли через многое. У вас есть опыт, знания, мудрость.</p>
                        <p>Теперь вы можете помочь тому ребёнку.</p>
                    </div>
                    <button class="an-btn-primary" id="enterResourceBtn">✅ Я вошёл в ресурсное состояние</button>
                </div>
            `
        },
        4: {
            title: 'Шаг 4 из 5: Перепишите импринт',
            content: `
                <div class="reimprinting-step">
                    <div class="step-icon">💌</div>
                    <div class="step-question">Что бы вы сказали тому ребёнку? Какую поддержку дали бы?</div>
                    <textarea id="newMessage" placeholder="Напишите новое послание себе-ребёнку..." class="reimprinting-textarea">${reimprintingData.newMessage || ''}</textarea>
                    <div class="step-hint">💡 Скажите то, что вам самому нужно было услышать в детстве.</div>
                </div>
            `
        },
        5: {
            title: 'Шаг 5 из 5: Закрепите якорем',
            content: `
                <div class="reimprinting-step">
                    <div class="step-icon">⚓</div>
                    <div class="step-question">Закрепите новое состояние якорем.</div>
                    <input type="text" id="newAnchor" placeholder="Придумайте триггер (жест, фразу)" class="reimprinting-input" value="${reimprintingData.newAnchor || ''}">
                    <div class="step-hint">💡 Например: рука на сердце + «Я имею право ошибаться»</div>
                    <button class="an-btn-primary" id="completeReimprintingBtn">✅ Завершить и сохранить якорь</button>
                </div>
            `
        }
    };
    
    const currentStep = steps[reimprintingStep];
    const progress = (reimprintingStep / 5) * 100;
    
    _anInjectStyles();
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1 class="content-title">Реимпринтинг</h1>
            </div>

            <div class="an-progress-bar">
                <div class="an-progress-fill" style="width: ${progress}%"></div>
            </div>

            <div class="reimprinting-card">
                <div class="step-title">${currentStep.title}</div>
                ${currentStep.content}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => {
        if (reimprintingStep > 1) {
            reimprintingStep--;
            showReimprintingScreen();
        } else {
            showAnchorsScreen();
        }
    };
    
    if (reimprintingStep === 3) {
        document.getElementById('enterResourceBtn')?.addEventListener('click', () => {
            reimprintingStep++;
            showReimprintingScreen();
        });
    } else if (reimprintingStep === 5) {
        document.getElementById('completeReimprintingBtn')?.addEventListener('click', async () => {
            const newAnchor = document.getElementById('newAnchor')?.value || '';
            reimprintingData.newAnchor = newAnchor;
            
            const anchorToSave = {
                user_id: CONFIG.USER_ID,
                name: `Реимпринтинг: ${reimprintingData.imprintName || 'Новое решение'}`,
                state: 'love',
                source: 'reimprinting',
                source_detail: JSON.stringify(reimprintingData),
                modality: 'auditory',
                trigger: newAnchor || reimprintingData.newMessage?.substring(0, 50) || 'Я переписал свой импринт',
                phrase: reimprintingData.newMessage || 'Я переписал свой импринт',
                icon: '🔄',
                state_icon: '💖',
                state_name: 'Реимпринтинг'
            };
            
            const success = await saveAnchor(anchorToSave);
            if (success) {
                showToast('✅ Импринт переписан! Новый якорь создан.', 'success');
                reimprintingStep = 0;
                reimprintingData = {};
                showAnchorsScreen();
            } else {
                showToast('❌ Ошибка сохранения', 'error');
            }
        });
    } else {
        const situation = document.getElementById('situation');
        const decision = document.getElementById('decision');
        const newMessage = document.getElementById('newMessage');
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'an-btn-primary';
        nextBtn.textContent = 'Далее →';
        nextBtn.onclick = () => {
            if (situation) reimprintingData.situation = situation.value;
            if (decision) reimprintingData.decision = decision.value;
            if (newMessage) reimprintingData.newMessage = newMessage.value;
            reimprintingStep++;
            showReimprintingScreen();
        };
        
        const container_content = document.querySelector('.reimprinting-card');
        if (container_content && reimprintingStep !== 3) {
            container_content.appendChild(nextBtn);
        }
    }
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================

async function showAnchorsScreen() {
    _anInjectStyles();
    await loadUserAnchors();
    const recommendations = await getProfileBasedRecommendations();
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">⚓</div>
                <h1 class="content-title">Якоря</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Ресурсные состояния и импринты</p>
            </div>
            <div class="an-tabs">
                <button class="an-tab ${currentAnchorView === 'list' ? 'active' : ''}" data-view="list">🎯 Мои якоря</button>
                <button class="an-tab ${currentAnchorView === 'create' ? 'active' : ''}" data-view="create">➕ Создать</button>
                <button class="an-tab ${currentAnchorView === 'recommend' ? 'active' : ''}" data-view="recommend">🎲 Подбор</button>
                <button class="an-tab ${currentAnchorView === 'techniques' ? 'active' : ''}" data-view="techniques">🔧 Техники</button>
                <button class="an-tab ${currentAnchorView === 'imprints' ? 'active' : ''}" data-view="imprints">📚 Импринты</button>
                <button class="an-tab ${currentAnchorView === 'constructor' ? 'active' : ''}" data-view="constructor">🎬 Конструктор</button>
            </div>
            <div id="anBody">
                ${renderCurrentView(currentAnchorView, { recommendations, userAnchors })}
            </div>
        </div>
    `;

    document.getElementById('backBtn').onclick = () => renderDashboard();

    document.querySelectorAll('.an-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentAnchorView = tab.dataset.view;
            showAnchorsScreen();
        });
    });
}

// ============================================
// РЕНДЕР ВИДОВ
// ============================================

function renderCurrentView(view, data) {
    switch(view) {
        case 'list': return renderAnchorsList(data.userAnchors);
        case 'create': return renderAnchorWizard();
        case 'recommend': return renderRecommendations(data.recommendations);
        case 'techniques': return renderTechniques();
        case 'imprints': return renderImprints();
        case 'constructor': return renderConstructor();
        default: return renderAnchorsList(data.userAnchors);
    }
}

function renderAnchorsList(anchors) {
    if (!anchors.length) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">⚓</div>
                <h3>У вас пока нет якорей</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Создайте первый якорь — и вы сможете вызывать нужное состояние в любой момент</p>
                <button class="an-tab active" data-view="create" style="padding: 12px 24px;">➕ Создать первый якорь</button>
            </div>
        `;
    }
    
    return `
        <div class="anchors-stats" style="margin-bottom: 20px; display: flex; gap: 16px;">
            <div style="background: rgba(224,224,224,0.05); border-radius: 12px; padding: 12px 20px;">
                <div style="font-size: 28px; font-weight: 700;">${anchors.length}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">всего якорей</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 12px; padding: 12px 20px;">
                <div style="font-size: 28px; font-weight: 700;">${anchors.filter(a => a.uses > 0).length}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">использованных</div>
            </div>
        </div>
        ${anchors.map(anchor => `
            <div class="anchor-card" data-id="${anchor.id}">
                <div class="anchor-name">
                    <span>${anchor.icon || '⚓'}</span>
                    <span>${anchor.name}</span>
                </div>
                <div class="anchor-actions">
                    <button class="anchor-btn fire-btn" onclick="fireAnchor('${anchor.id}', '${anchor.name.replace(/'/g, "\\'")}')">🔥 Активировать</button>
                    <button class="anchor-btn delete-btn" onclick="deleteAnchorConfirm('${anchor.id}')">🗑️ Удалить</button>
                </div>
                ${anchor.uses ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">✅ использовано ${anchor.uses} раз</div>` : ''}
            </div>
        `).join('')}
    `;
}

function renderAnchorWizard() {
    const step = anchorWizardStep;
    const data = anchorWizardData;
    
    if (step === 0) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 1 из 5: Что вы хотите якорить?</p>
                <div class="wizard-options">
                    ${Object.entries(ANCHORS_CONFIG.states).map(([key, state]) => `
                        <div class="wizard-option" onclick="anchorWizardSelectState('${key}')">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">${state.icon}</span>
                                <div>
                                    <div style="font-weight: 600;">${state.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${state.desc}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (step === 1) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 2 из 5: Откуда возьмём состояние «${ANCHORS_CONFIG.states[data.state]?.name || data.state}»?</p>
                <div class="wizard-options">
                    ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                        <div class="wizard-option ${data.source === key ? 'selected' : ''}" onclick="anchorWizardSelectSource('${key}')">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">${source.icon}</span>
                                <div>
                                    <div style="font-weight: 600;">${source.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${source.desc}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${data.source ? `
                    <div style="margin-top: 20px;">
                        <label style="display: block; margin-bottom: 8px;">Опишите источник:</label>
                        <textarea id="sourceDetail" placeholder="Опишите ситуацию, фильм, музыку или метафору..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 80px;"></textarea>
                    </div>
                    <button class="anchor-btn fire-btn" style="margin-top: 20px; width: 100%;" onclick="anchorWizardNext()">Далее →</button>
                ` : ''}
            </div>
        `;
    }
    
    if (step === 2) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 3 из 5: Какой будет триггер?</p>
                <div class="wizard-options">
                    <div class="wizard-option ${data.modality === 'auditory' ? 'selected' : ''}" onclick="anchorWizardSelectModality('auditory')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">🔊</span>
                            <div><div style="font-weight: 600;">Аудиальный</div><div style="font-size: 12px;">Ключевая фраза, слово</div></div>
                        </div>
                    </div>
                    <div class="wizard-option ${data.modality === 'kinesthetic' ? 'selected' : ''}" onclick="anchorWizardSelectModality('kinesthetic')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">🖐️</span>
                            <div><div style="font-weight: 600;">Кинестетический</div><div style="font-size: 12px;">Жест, прикосновение, поза</div></div>
                        </div>
                    </div>
                    <div class="wizard-option ${data.modality === 'visual' ? 'selected' : ''}" onclick="anchorWizardSelectModality('visual')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">👁️</span>
                            <div><div style="font-weight: 600;">Визуальный</div><div style="font-size: 12px;">Образ, символ, мысленная картинка</div></div>
                        </div>
                    </div>
                </div>
                ${data.modality ? `
                    <div style="margin-top: 20px;">
                        <label style="display: block; margin-bottom: 8px;">Введите ваш триггер:</label>
                        <input type="text" id="triggerInput" class="wizard-input" placeholder="Например: «Я спокоен» или сжать кулак" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white;">
                    </div>
                    <button class="anchor-btn fire-btn" style="margin-top: 20px; width: 100%;" onclick="anchorWizardSaveTrigger()">Далее →</button>
                ` : ''}
            </div>
        `;
    }
    
    if (step === 3) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 4 из 5: Назовите ваш якорь</p>
                <input type="text" id="anchorNameInput" class="wizard-input" placeholder="Например: «Спокойствие перед выступлением»" value="${data.name || ''}" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-bottom: 20px;">
                
                <h3 style="margin-top: 20px;">Установка якоря</h3>
                <div style="background: rgba(255,107,59,0.1); border-radius: 12px; padding: 16px; margin: 16px 0;">
                    <p><strong>📖 Инструкция:</strong></p>
                    <ol style="margin-left: 20px; line-height: 1.8;">
                        <li>Войдите в состояние ${ANCHORS_CONFIG.states[data.state]?.name || data.state}</li>
                        <li>В момент ПИКА состояния — сделайте триггер: <strong>«${data.trigger}»</strong></li>
                        <li>Сбросьте состояние (отвлекитесь, встаньте)</li>
                        <li>Повторите шаги 1-3 ещё 3-5 раз</li>
                        <li>Проверьте: активируйте триггер — должно приходить состояние</li>
                    </ol>
                </div>
                
                <div class="anchor-actions" style="margin-top: 20px;">
                    <button class="anchor-btn fire-btn" style="flex: 1;" onclick="anchorWizardComplete()">✅ Сохранить якорь</button>
                    <button class="anchor-btn delete-btn" style="flex: 1;" onclick="anchorWizardReset()">↺ Начать заново</button>
                </div>
            </div>
        `;
    }
    
    return '<div>Загрузка...</div>';
}

function renderRecommendations(recommendations) {
    if (!recommendations.length) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🎲</div>
                <h3>Нет персональных рекомендаций</h3>
                <p style="color: var(--text-secondary);">Пройдите психологический тест, чтобы получить якоря под ваш профиль</p>
                <button class="an-tab active" onclick="startTest()" style="padding: 12px 24px; margin-top: 16px;">📊 Пройти тест</button>
            </div>
        `;
    }
    
    return `
        <div style="margin-bottom: 16px;">
            <p>🎯 На основе вашего психологического профиля:</p>
        </div>
        ${recommendations.map(rec => `
            <div class="recommend-card">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 32px;">${ANCHORS_CONFIG.states[rec.state]?.icon || '⚓'}</span>
                    <div>
                        <div style="font-weight: 700; font-size: 18px;">${rec.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${rec.reason}</div>
                    </div>
                </div>
                <div style="font-size: 14px; margin-bottom: 16px;">💬 Фраза: «${rec.phrase}»</div>
                <button class="anchor-btn fire-btn" onclick="quickCreateAnchor('${rec.state}', '${rec.name.replace(/'/g, "\\'")}', '${rec.trigger.replace(/'/g, "\\'")}', '${rec.phrase.replace(/'/g, "\\'")}')">➕ Создать этот якорь</button>
            </div>
        `).join('')}
    `;
}

function renderTechniques() {
    return `
        <div style="margin-bottom: 20px;">
            <p>🔧 Продвинутые техники работы с якорями</p>
        </div>
        ${Object.entries(ANCHORS_CONFIG.techniques).map(([key, tech]) => `
            <div class="imprint-card" onclick="showTechnique('${key}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 32px;">${tech.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 18px;">${tech.name}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${tech.desc}</div>
                    </div>
                    <span style="font-size: 20px; color: var(--text-secondary);">→</span>
                </div>
            </div>
        `).join('')}
    `;
}

function renderImprints() {
    return `
        <div style="margin-bottom: 20px;">
            <p>📚 Глубинная работа с импринтами (детскими программами)</p>
        </div>
        
        <div class="imprint-card" onclick="startImprintDiagnostic()">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">🔍</span>
                <div>
                    <div style="font-weight: 700;">Диагностика импринтов</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">20 вопросов, 3 минуты</div>
                </div>
            </div>
        </div>
        
        <div class="imprint-card" onclick="startReimprinting()">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">🔄</span>
                <div>
                    <div style="font-weight: 700;">Реимпринтинг</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Перезапись детских программ</div>
                </div>
            </div>
        </div>
        
        <details style="background: rgba(224,224,224,0.03); border-radius: 16px; padding: 16px; margin-top: 16px;">
            <summary style="cursor: pointer; color: #ff6b3b; font-weight: 500;">📖 Что такое импринты?</summary>
            <div style="margin-top: 12px; line-height: 1.6; font-size: 14px;">
                <p>Импринт (запечатление) — это бессознательная программа, сформированная в критический период развития (0-7 лет).</p>
                <p><strong>Основные типы импринтов:</strong></p>
                <ul style="margin-left: 20px; margin-top: 8px;">
                    <li>😔 <strong>Отвержения</strong> — «Я не нужен»</li>
                    <li>⚠️ <strong>Опасности</strong> — «Мир опасен»</li>
                    <li>🎯 <strong>Перфекционизма</strong> — «Надо быть идеальным»</li>
                    <li>🔇 <strong>Подавления эмоций</strong> — «Чувства = слабость»</li>
                    <li>🪶 <strong>Беспомощности</strong> — «Я ничего не могу изменить»</li>
                    <li>💔 <strong>Недостойности</strong> — «Я недостаточно хорош»</li>
                    <li>🎮 <strong>Контроля</strong> — «Всё должно быть под контролем»</li>
                </ul>
                <p style="margin-top: 12px;"><strong>Реимпринтинг</strong> — техника перезаписи этих программ через ресурсного свидетеля (взрослого себя).</p>
            </div>
        </details>
    `;
}

function renderConstructor() {
    return `
        <div style="margin-bottom: 20px;">
            <p>🎬 Конструируем состояние, которого нет в опыте</p>
        </div>
        
        <div class="wizard-options">
            ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                <div class="wizard-option" onclick="constructorSelectSource('${key}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px;">${source.icon}</span>
                        <div>
                            <div style="font-weight: 600;">${source.name}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${source.desc}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div id="constructorContent"></div>
    `;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================

window.anchorWizardSelectState = (state) => {
    anchorWizardData.state = state;
    anchorWizardStep = 1;
    showAnchorsScreen();
};

window.anchorWizardSelectSource = (source) => {
    anchorWizardData.source = source;
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.anchorWizardSelectModality = (modality) => {
    anchorWizardData.modality = modality;
    showAnchorsScreen();
};

window.anchorWizardSaveTrigger = () => {
    const triggerInput = document.getElementById('triggerInput');
    if (triggerInput) {
        anchorWizardData.trigger = triggerInput.value.trim();
    }
    anchorWizardStep = 3;
    showAnchorsScreen();
};

window.anchorWizardNext = () => {
    const sourceDetail = document.getElementById('sourceDetail');
    if (sourceDetail) {
        anchorWizardData.sourceDetail = sourceDetail.value.trim();
    }
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.anchorWizardComplete = async () => {
    const nameInput = document.getElementById('anchorNameInput');
    if (nameInput) {
        anchorWizardData.name = nameInput.value.trim();
    }
    
    if (!anchorWizardData.name) {
        anchorWizardData.name = `${ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state} (${ANCHORS_CONFIG.sources[anchorWizardData.source]?.name || anchorWizardData.source})`;
    }
    
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: anchorWizardData.name,
        state: anchorWizardData.state,
        source: anchorWizardData.source,
        source_detail: anchorWizardData.sourceDetail,
        modality: anchorWizardData.modality,
        trigger: anchorWizardData.trigger,
        phrase: anchorWizardData.trigger,
        icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '⚓',
        state_icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        showToast('✅ Якорь успешно создан!', 'success');
        anchorWizardStep = 0;
        anchorWizardData = {};
        currentAnchorView = 'list';
        await loadUserAnchors();
        showAnchorsScreen();
    } else {
        showToast('❌ Не удалось сохранить якорь', 'error');
    }
};

window.anchorWizardReset = () => {
    anchorWizardStep = 0;
    anchorWizardData = {};
    showAnchorsScreen();
};

window.fireAnchor = async (anchorId, anchorName) => {
    showToast(`🔥 Активирую якорь «${anchorName}»...`, 'info');
    const phrase = await fireAnchorAPI(anchorId, anchorName);
    if (phrase) {
        showToast(`✅ ${phrase}`, 'success');
        if (window.voiceManager) {
            await window.voiceManager.textToSpeech(phrase, window.currentMode || 'psychologist');
        }
    } else {
        showToast('❌ Не удалось активировать якорь', 'error');
    }
    await loadUserAnchors();
    showAnchorsScreen();
};

window.deleteAnchorConfirm = async (anchorId) => {
    if (confirm('Удалить этот якорь?')) {
        const success = await deleteAnchor(anchorId);
        if (success) {
            showToast('🗑️ Якорь удалён', 'success');
            await loadUserAnchors();
            showAnchorsScreen();
        } else {
            showToast('❌ Не удалось удалить', 'error');
        }
    }
};

window.quickCreateAnchor = async (state, name, trigger, phrase) => {
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: name,
        state: state,
        source: 'own',
        modality: 'auditory',
        trigger: trigger,
        phrase: phrase,
        icon: ANCHORS_CONFIG.states[state]?.icon || '⚓',
        state_icon: ANCHORS_CONFIG.states[state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[state]?.name || state
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        showToast('✅ Якорь создан!', 'success');
        await loadUserAnchors();
        currentAnchorView = 'list';
        showAnchorsScreen();
    } else {
        showToast('❌ Ошибка создания', 'error');
    }
};

window.showTechnique = (techniqueKey) => {
    const techniquesContent = {
        stacking: `
            <h3>🔗 Накладка якорей</h3>
            <p>Техника соединения двух ресурсных состояний в один мощный якорь.</p>
            <ol style="margin: 16px 0 16px 20px; line-height: 1.8;">
                <li>Установите якорь на состояние А (например, спокойствие)</li>
                <li>Установите якорь на состояние Б (например, уверенность)</li>
                <li>Активируйте оба якоря одновременно</li>
                <li>Создайте новый интегрированный якорь</li>
            </ol>
            <p><strong>Когда применять:</strong> Когда нужно усилить состояние или добавить ресурс к нейтральному.</p>
        `,
        collapse: `
            <h3>💥 Коллапс якорей</h3>
            <p>Разрушение негативного якоря через накладку ресурса.</p>
            <ol style="margin: 16px 0 16px 20px; line-height: 1.8;">
                <li>Установите якорь на негативное состояние</li>
                <li>Установите мощный ресурсный якорь</li>
                <li>Активируйте оба одновременно</li>
                <li>Негатив «схлопывается» ресурсом</li>
            </ol>
            <p><strong>Когда применять:</strong> Когда есть негативная реакция на триггер (страх, тревога, паника).</p>
        `,
        chaining: `
            <h3>⛓️ Цепочка якорей</h3>
            <p>Последовательная активация состояний для достижения сложной цели.</p>
            <ol style="margin: 16px 0 16px 20px; line-height: 1.8;">
                <li>Состояние А → Якорь А</li>
                <li>Переход к состоянию Б</li>
                <li>Состояние Б → Якорь Б</li>
                <li>И так далее по цепочке</li>
            </ol>
            <p><strong>Когда применять:</strong> Когда нужно пройти через несколько состояний (например, страх → спокойствие → уверенность → действие).</p>
        `,
        reimprinting: `
            <h3>🔄 Реимпринтинг</h3>
            <p>Перезапись детских программ через ресурсного свидетеля.</p>
            <p style="margin: 16px 0;">Полная 5-шаговая техника:</p>
            <ol style="margin: 0 0 16px 20px; line-height: 1.8;">
                <li>Найти ситуацию из детства</li>
                <li>Распознать решение/импринт</li>
                <li>Войти в ресурсное состояние взрослого</li>
                <li>Дать новое послание себе-ребёнку</li>
                <li>Закрепить новое состояние якорем</li>
            </ol>
            <button class="anchor-btn fire-btn" onclick="startReimprinting()">Начать реимпринтинг</button>
        `
    };
    
    const container = document.getElementById('screenContainer');
    if (container) {
        _anInjectStyles();
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" onclick="showAnchorsScreen()">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">🔧</div>
                    <h1 class="content-title">${ANCHORS_CONFIG.techniques[techniqueKey]?.name || 'Техника'}</h1>
                </div>
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px;">
                    ${techniquesContent[techniqueKey] || '<p>Техника загружается...</p>'}
                </div>
            </div>
        `;
    }
};

window.constructorSelectSource = (source) => {
    const container = document.getElementById('constructorContent');
    if (!container) return;
    
    const sourcesContent = {
        movie: `
            <div style="margin-top: 20px;">
                <h3>🎬 Выберите фильм или сцену</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMovie('gladiator')">
                        <div>🎬 Гладиатор — сцена перед битвой</div>
                        <div style="font-size: 12px;">Уверенность, сила, победа</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMovie('amelie')">
                        <div>🎬 Амели — момент радости</div>
                        <div style="font-size: 12px;">Радость, лёгкость, вдохновение</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMovie('matrix')">
                        <div>🎬 Матрица — «Я знаю кунг-фу»</div>
                        <div style="font-size: 12px;">Фокус, уверенность, спокойствие</div>
                    </div>
                </div>
                <input type="text" id="customMovie" placeholder="Или напишите свой фильм/сцену..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;">
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMovie()">Использовать этот источник</button>
            </div>
        `,
        music: `
            <div style="margin-top: 20px;">
                <h3>🎵 Выберите музыку</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMusic('hans')">
                        <div>🎵 Hans Zimmer — Time</div>
                        <div style="font-size: 12px;">Величие, спокойствие, глубина</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMusic('energetic')">
                        <div>🎵 Epic orchestral</div>
                        <div style="font-size: 12px;">Энергия, подъём, действие</div>
                    </div>
                </div>
                <input type="text" id="customMusic" placeholder="Или напишите свой трек..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;">
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMusic()">Использовать этот источник</button>
            </div>
        `,
        metaphor: `
            <div style="margin-top: 20px;">
                <h3>📖 Выберите метафору</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMetaphor('rock')">
                        <div>🗻 «Я — скала, которую не может сдвинуть ветер»</div>
                        <div style="font-size: 12px;">Спокойствие, устойчивость</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMetaphor('ocean')">
                        <div>🌊 «Я — океан, могучий и глубокий»</div>
                        <div style="font-size: 12px;">Сила, спокойствие</div>
                    </div>
                </div>
                <textarea id="customMetaphor" placeholder="Или напишите свою метафору..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;"></textarea>
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMetaphor()">Использовать эту метафору</button>
            </div>
        `,
        body: `
            <div style="margin-top: 20px;">
                <h3>🧘 Телесная практика</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseBody('breath')">
                        <div>🌬️ Дыхание: вдох 4 — задержка 4 — выдох 6</div>
                        <div style="font-size: 12px;">Спокойствие, расслабление</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseBody('posture')">
                        <div>🧍 Поза супермена: руки в боки, плечи назад</div>
                        <div style="font-size: 12px;">Уверенность, сила</div>
                    </div>
                </div>
                <textarea id="customBody" placeholder="Опишите свою телесную практику..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;"></textarea>
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromBody()">Использовать эту практику</button>
            </div>
        `
    };
    
    container.innerHTML = sourcesContent[source] || '<p>Выберите источник</p>';
};

window.constructorUseMovie = (movie) => {
    anchorWizardData = {
        state: 'confidence',
        source: 'movie',
        sourceDetail: movie === 'gladiator' ? 'Гладиатор — сцена перед битвой' : (movie === 'amelie' ? 'Амели — момент радости' : 'Матрица — «Я знаю кунг-фу»'),
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMovie = () => {
    const custom = document.getElementById('customMovie')?.value;
    anchorWizardData = {
        state: 'confidence',
        source: 'movie',
        sourceDetail: custom || 'Фильм по выбору пользователя',
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseMusic = (music) => {
    anchorWizardData = {
        state: 'calm',
        source: 'music',
        sourceDetail: music === 'hans' ? 'Hans Zimmer — Time' : 'Epic orchestral music',
        modality: 'auditory'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMusic = () => {
    const custom = document.getElementById('customMusic')?.value;
    anchorWizardData = {
        state: 'calm',
        source: 'music',
        sourceDetail: custom || 'Музыка по выбору пользователя',
        modality: 'auditory'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseMetaphor = (metaphor) => {
    anchorWizardData = {
        state: 'calm',
        source: 'metaphor',
        sourceDetail: metaphor === 'rock' ? 'Я — скала, которую не может сдвинуть ветер' : 'Я — океан, могучий и глубокий',
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMetaphor = () => {
    const custom = document.getElementById('customMetaphor')?.value;
    anchorWizardData = {
        state: 'calm',
        source: 'metaphor',
        sourceDetail: custom || 'Метафора пользователя',
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseBody = (practice) => {
    anchorWizardData = {
        state: 'calm',
        source: 'body',
        sourceDetail: practice === 'breath' ? 'Дыхание: вдох 4 — задержка 4 — выдох 6' : 'Поза супермена: руки в боки, плечи назад',
        modality: 'kinesthetic'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromBody = () => {
    const custom = document.getElementById('customBody')?.value;
    anchorWizardData = {
        state: 'calm',
        source: 'body',
        sourceDetail: custom || 'Телесная практика пользователя',
        modality: 'kinesthetic'
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

// ============================================
// ЭКСПОРТ
// ============================================

window.showAnchorsScreen = showAnchorsScreen;
window.startImprintDiagnostic = startImprintDiagnostic;
window.startReimprinting = startReimprinting;

console.log('✅ Модуль "Якоря" загружен (anchors.js v2.1)');
