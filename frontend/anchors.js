// ============================================
// МОДУЛЬ: БИБЛИОТЕКА СОСТОЯНИЙ
// Версия: 5.0 — с AI-генерацией, рабочим конструктором и всеми функциями
// ============================================

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const ANCHORS_CONFIG = {
    VECTORS: ['СБ', 'ТФ', 'УБ', 'ЧВ'],
    
    modalities: {
        visual: { name: 'Визуальный', icon: '👁️', desc: 'Жест, символ, образ' },
        auditory: { name: 'Аудиальный', icon: '🔊', desc: 'Слово, звук, фраза' },
        kinesthetic: { name: 'Кинестетический', icon: '🖐️', desc: 'Прикосновение, поза' }
    },

    states: {
        calm: { name: 'Спокойствие', icon: '😌', desc: 'Расслабление, умиротворение', color: '#4caf50', affirmation: 'Я спокоен и уравновешен' },
        confidence: { name: 'Уверенность', icon: '💪', desc: 'Сила, вера в себя', color: '#ff6b3b', affirmation: 'Я уверен в своих силах' },
        focus: { name: 'Фокус', icon: '🎯', desc: 'Концентрация, внимание', color: '#2196f3', affirmation: 'Моё внимание — там, где я хочу' },
        energy: { name: 'Энергия', icon: '⚡', desc: 'Бодрость, активность', color: '#ff9800', affirmation: 'Энергия течёт через меня' },
        love: { name: 'Любовь', icon: '💖', desc: 'Тепло, принятие', color: '#e91e63', affirmation: 'Я открыт любви' },
        gratitude: { name: 'Благодарность', icon: '🙏', desc: 'Ценность жизни', color: '#9c27b0', affirmation: 'Я благодарен за каждый день' },
        safety: { name: 'Безопасность', icon: '🛡️', desc: 'Защищённость', color: '#00bcd4', affirmation: 'Я в безопасности' },
        joy: { name: 'Радость', icon: '😊', desc: 'Лёгкость, счастье', color: '#ffeb3b', affirmation: 'Радость наполняет меня' },
        grounding: { name: 'Заземление', icon: '🌍', desc: 'Связь с телом', color: '#795548', affirmation: 'Я здесь и сейчас' },
        action: { name: 'Действие', icon: '🚀', desc: 'Импульс к началу', color: '#f44336', affirmation: 'Я действую сейчас' }
    },

    techniques: {
        stacking: { name: 'Накладка якорей', icon: '🔗', desc: 'Соединение двух состояний', duration: '5-7 минут' },
        collapse: { name: 'Коллапс якорей', icon: '💥', desc: 'Разрушение негативного якоря', duration: '10-15 минут' },
        chaining: { name: 'Цепочка якорей', icon: '⛓️', desc: 'Последовательная активация', duration: '7-10 минут' },
        reimprinting: { name: 'Реимпринтинг', icon: '🔄', desc: 'Перезапись импринта', duration: '15-20 минут' }
    },

    sources: {
        own: { name: 'Мой опыт', icon: '🧠', desc: 'Из вашей жизни', requiresFile: false },
        movie: { name: 'Из фильма', icon: '🎬', desc: 'Сцена из кино', requiresFile: true, fileType: 'video' },
        music: { name: 'Из музыки', icon: '🎵', desc: 'Трек или звук', requiresFile: true, fileType: 'audio' },
        metaphor: { name: 'Метафора', icon: '📖', desc: 'Образный ряд', requiresFile: false },
        body: { name: 'Через тело', icon: '🧘', desc: 'Дыхание, поза', requiresFile: false },
        other: { name: 'Опыт другого', icon: '👥', desc: 'Эмпатия к герою', requiresFile: false }
    },

    // Типы сохраняемых сущностей
    saveable_types: {
        instruction: { id: 'instruction', name: '📝 Инструкция', description: 'Пошаговое руководство', icon: '📝', color: '#4caf50', badge: 'Пошаговое руководство' },
        guided_audio: { id: 'guided_audio', name: '🎧 Guided-медитация', description: 'С голосовым сопровождением', icon: '🎧', color: '#2196f3', badge: 'С голосовым сопровождением' }
    },

    // Ситуации для персонализации
    situations: {
        work: { name: 'Работа', icon: '💼', scenarios: { meeting: 'Перед важным совещанием', presentation: 'Перед выступлением', conflict: 'В конфликте', deadline: 'В режиме аврала' } },
        relationships: { name: 'Отношения', icon: '💕', scenarios: { date: 'Перед свиданием', family: 'С родителями', partner: 'В ссоре', friends: 'С друзьями' } },
        self: { name: 'Личное состояние', icon: '🧘', scenarios: { morning: 'Утром', evening: 'Вечером', anxiety: 'При тревоге', decision: 'Перед решением' } }
    },

    // Комбинации векторов с actions
    vector_combinations: {
        conflict_avoidance: {
            condition: (v) => v.СБ <= 2 && v.ЧВ <= 2,
            name: 'Страх конфликтов',
            icon: '🛡️',
            description: 'Вы избегаете конфликтов, потому что боитесь испортить отношения',
            recommended_state: 'safety',
            actions: {
                work: { title: 'Пауза перед ответом', trigger: 'сделать паузу и глубокий вдох', phrase: 'Я выбираю свою реакцию' },
                relationships: { title: 'Я-сообщения', trigger: 'начать с "Я чувствую"', phrase: 'Мои чувства имеют значение' },
                self: { title: 'Контейнер эмоций', trigger: 'открыть дневник', phrase: 'Я разрешаю себе чувствовать' }
            }
        },
        financial_chaos: {
            condition: (v) => v.ТФ <= 2 && v.УБ <= 2,
            name: 'Финансовый хаос',
            icon: '💰',
            description: 'Деньги приходят и уходят, вы не понимаете, куда и почему',
            recommended_state: 'grounding',
            actions: {
                work: { title: 'Правило 1%', trigger: 'получить доход → отложить 1%', phrase: 'Каждая копейка — шаг к свободе' },
                self: { title: 'Трекер трат', trigger: 'совершить покупку → записать', phrase: 'Я вижу, куда уходят мои деньги' }
            }
        },
        analytical_coldness: {
            condition: (v) => v.УБ >= 5 && v.ЧВ <= 2,
            name: 'Холодный аналитик',
            icon: '🧊',
            description: 'Вы всё анализируете, но людям с вами может быть неуютно',
            recommended_state: 'love',
            actions: {
                relationships: { title: 'Три вопроса о чувствах', trigger: 'начать разговор', phrase: 'Я учусь замечать эмоции' },
                self: { title: 'Дневник чувств', trigger: 'вечером перед сном', phrase: 'Мои чувства — это тоже данные' }
            }
        },
        burnout: {
            condition: (v) => v.СБ <= 2 && v.ТФ <= 2 && v.УБ <= 2 && v.ЧВ <= 2,
            name: 'Эмоциональное выгорание',
            icon: '🔥',
            description: 'Вы истощены, вам ничего не хочется, силы на исходе',
            recommended_state: 'calm',
            actions: {
                self: { title: 'Правило 5 минут', trigger: 'чувствуешь апатию', phrase: 'Я могу сделать что угодно, если это на 5 минут' }
            }
        },
        leader_empath: {
            condition: (v) => v.СБ >= 5 && v.ЧВ >= 5,
            name: 'Лидер-эмпат',
            icon: '👑',
            description: 'Вы сильны и чувствительны одновременно',
            recommended_state: 'action',
            actions: {
                work: { title: 'Мягкая сила', trigger: 'перед важным решением', phrase: 'Моя сила — в умении слышать и вести' }
            }
        }
    },

    // AI-промпты
    ai_prompts: {
        generate_instruction: (combo, vectors, situation) => {
            return `Ты — психолог-эксперт по якорям и ресурсным состояниям.

У пользователя диагностирована проблема: "${combo.name}"
Описание: ${combo.description}
Его векторы (по шкале 1-6): СБ=${vectors.СБ} (самооценка), ТФ=${vectors.ТФ} (тревожность), УБ=${vectors.УБ} (уверенность), ЧВ=${vectors.ЧВ} (чувствительность)
Актуальная ситуация: ${situation}

Создай ПЕРСОНАЛЬНУЮ инструкцию для работы с этой проблемой.

Требования:
1. Название инструкции: краткое, ёмкое (3-5 слов)
2. Рекомендуемое состояние: ОДНО из [calm, confidence, safety, grounding, action, love]
3. Триггер-фраза: короткая фраза от первого лица (5-8 слов)
4. Аффирмация: вдохновляющая фраза от первого лица (10-15 слов)
5. 6 шагов выполнения (каждый шаг — 1 короткое предложение)
6. Конкретное действие на ЗАВТРА (выполнимое за 5-10 минут)

Верни ТОЛЬКО JSON без пояснений:
{
    "name": "...",
    "state": "...",
    "trigger": "...",
    "affirmation": "...",
    "steps": ["шаг1", "шаг2", "шаг3", "шаг4", "шаг5", "шаг6"],
    "tomorrow_action": "..."
}`;
        },
        generate_guided: (combo, vectors) => {
            return `Создай guided-медитацию (2 минуты) для работы с проблемой "${combo.name}".
Векторы: СБ=${vectors.СБ}, ЧВ=${vectors.ЧВ}.

Верни 6 коротких шагов-команд (каждый до 10 слов), обращение на "ты".
Формат: ["команда1", "команда2", "команда3", "команда4", "команда5", "команда6"]`;
        }
    },

    // Физические стимулы
    physical_stimuli: {
        zippo: { name: 'Зажигалка Zippo', icon: '🔥', description: 'Звук открытия крышки', howToUse: 'Откройте крышку — услышьте металлический клик', anchorPower: 10, bestFor: ['confidence', 'action'], price: '≈1000₽', whereToBuy: 'Wildberries, Ozon' },
        crystal: { name: 'Кристалл', icon: '💎', description: 'Гладкая прохладная поверхность', howToUse: 'Возьмите в руку, почувствуйте прохладу', anchorPower: 8, bestFor: ['calm', 'grounding'], price: '300-1500₽', whereToBuy: 'Магазины камней' },
        stressBall: { name: 'Антистресс-мяч', icon: '🎾', description: 'Мягкое сжатие', howToUse: 'Сожмите — почувствуйте сопротивление', anchorPower: 9, bestFor: ['calm', 'focus'], price: '300-800₽', whereToBuy: 'Канцтовары' },
        teaCup: { name: 'Чашка чая', icon: '🍵', description: 'Тепло в руках', howToUse: 'Обхватите чашку, вдохните аромат', anchorPower: 9, bestFor: ['calm', 'safety'], price: '0-500₽', whereToBuy: 'Дома' },
        pen: { name: 'Ручка', icon: '✒️', description: 'Щелчок кнопки', howToUse: 'Нажмите на кнопку — щелчок', anchorPower: 7, bestFor: ['focus', 'action'], price: '50-300₽', whereToBuy: 'Канцтовары' },
        ring: { name: 'Кольцо', icon: '💍', description: 'Вращение на пальце', howToUse: 'Покрутите кольцо на пальце', anchorPower: 8, bestFor: ['calm', 'confidence'], price: '500-3000₽', whereToBuy: 'Ювелирные' }
    }
};

// ============================================
// КОНФИГУРАЦИЯ ИМПРИНТОВ
// ============================================

const IMPRINTS_CONFIG = {
    types: {
        abandonment: { id: 'abandonment', name: 'Импринт отвержения', icon: '😔', color: '#ff6b6b', shortDesc: 'Страх, что вас бросят', description: 'Глубинное убеждение, что вы не нужны', childhood: 'Потребности игнорировались', adult_manifestations: ['Страх близких', 'Тревога при расставании'], healing_phrase: 'Я ценен сам по себе', recommended_state: 'safety' },
        danger: { id: 'danger', name: 'Импринт опасности', icon: '⚠️', color: '#ff9800', shortDesc: 'Мир опасен', description: 'Убеждение, что мир опасен', childhood: 'Мир казался угрожающим', adult_manifestations: ['Тревожность', 'Избегание'], healing_phrase: 'Сейчас я в безопасности', recommended_state: 'grounding' },
        perfectionism: { id: 'perfectionism', name: 'Импринт перфекционизма', icon: '🎯', color: '#4caf50', shortDesc: 'Надо быть идеальным', description: 'Убеждение, что нужно быть идеальным', childhood: 'Хвалили только за достижения', adult_manifestations: ['Прокрастинация', 'Выгорание'], healing_phrase: 'Я достаточно хорош', recommended_state: 'love' },
        emotional_suppression: { id: 'emotional_suppression', name: 'Подавление эмоций', icon: '🔇', color: '#9c27b0', shortDesc: 'Чувства = слабость', description: 'Эмоции — это слабость', childhood: 'Говорили "не плачь"', adult_manifestations: ['Сложность с чувствами', 'Психосоматика'], healing_phrase: 'Мои чувства имеют значение', recommended_state: 'joy' },
        helplessness: { id: 'helplessness', name: 'Беспомощность', icon: '🪶', color: '#607d8b', shortDesc: 'Я ничего не могу изменить', description: 'Не можете влиять на жизнь', childhood: 'Попытки не давали результата', adult_manifestations: ['Жертвенность', 'Депрессия'], healing_phrase: 'Я могу влиять на свою жизнь', recommended_state: 'action' },
        unworthiness: { id: 'unworthiness', name: 'Недостойность', icon: '💔', color: '#e91e63', shortDesc: 'Я недостаточно хорош', description: 'Недостаточно хороши', childhood: 'Сравнивали не в вашу пользу', adult_manifestations: ['Низкая самооценка'], healing_phrase: 'Я ценен независимо от достижений', recommended_state: 'love' },
        control: { id: 'control', name: 'Импринт контроля', icon: '🎮', color: '#00bcd4', shortDesc: 'Всё должно быть под контролем', description: 'Нужно контролировать всё', childhood: 'Было много хаоса', adult_manifestations: ['Микроменеджмент', 'Тревога'], healing_phrase: 'Я отпускаю контроль', recommended_state: 'calm' }
    },
    questions: [
        { text: "Я боюсь, что близкие люди могут меня бросить", imprint: "abandonment", weight: 2 },
        { text: "Мне трудно доверять новым людям", imprint: "abandonment", weight: 1 },
        { text: "Я постоянно жду подвоха от жизни", imprint: "danger", weight: 2 },
        { text: "Мир кажется мне непредсказуемым", imprint: "danger", weight: 2 },
        { text: "Ошибки для меня катастрофа", imprint: "perfectionism", weight: 2 },
        { text: "Я очень требователен к себе", imprint: "perfectionism", weight: 2 },
        { text: "Мне трудно выражать свои чувства", imprint: "emotional_suppression", weight: 2 },
        { text: "Я считаю, что плакать — это стыдно", imprint: "emotional_suppression", weight: 1 },
        { text: "Я чувствую, что ничего не могу изменить", imprint: "helplessness", weight: 2 },
        { text: "Мне трудно начинать новые дела", imprint: "helplessness", weight: 1 },
        { text: "Я часто чувствую себя недостаточно хорошим", imprint: "unworthiness", weight: 2 },
        { text: "Мне трудно принимать комплименты", imprint: "unworthiness", weight: 1 },
        { text: "Мне нужно всё контролировать", imprint: "control", weight: 2 },
        { text: "Я не могу расслабиться, пока всё не сделаю сам", imprint: "control", weight: 1 }
    ]
};

// ============================================
// ХРАНИЛИЩЕ
// ============================================

let userAnchors = [];
let currentAnchorView = 'list';
let anchorWizardStep = 0;
let anchorWizardData = {
    state: null,
    source: null,
    sourceDetail: null,
    modality: null,
    trigger: null,
    name: null
};
let reimprintingStep = 0;
let reimprintingData = {};
let diagnosticAnswers = {};
let diagnosticResult = null;
let isGuidedMode = false;
let selectedStimuli = [];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function _anEscapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _anShowToast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
    else alert(msg);
}

function _anPlayBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.1;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
        setTimeout(() => audioContext.close(), 500);
    } catch(e) {}
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

async function getUserStatus() {
    try {
        const response = await apiCall(`/api/user/status/${CONFIG.USER_ID}`);
        return {
            has_profile: response.has_profile || false,
            vectors: response.vectors || { СБ: 3, ТФ: 3, УБ: 3, ЧВ: 3 }
        };
    } catch (e) {
        console.warn('Failed to get user status:', e);
        return { has_profile: false, vectors: { СБ: 3, ТФ: 3, УБ: 3, ЧВ: 3 } };
    }
}

async function callAIGenerate(prompt, maxTokens = 800, temperature = 0.8) {
    try {
        const response = await apiCall('/api/ai/generate', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                prompt: prompt,
                max_tokens: maxTokens,
                temperature: temperature
            })
        });
        return response.content;
    } catch (e) {
        console.error('AI generation failed:', e);
        return null;
    }
}

// ============================================
// АНАЛИЗ КОМБИНАЦИЙ ВЕКТОРОВ
// ============================================

function analyzeVectorCombinations(vectors) {
    const combinations = [];
    for (const [key, combo] of Object.entries(ANCHORS_CONFIG.vector_combinations)) {
        if (combo.condition(vectors)) {
            combinations.push({ key, ...combo });
        }
    }
    return combinations;
}

function getSeverityLevel(vectors) {
    const avg = (vectors.СБ + vectors.ТФ + vectors.УБ + vectors.ЧВ) / 4;
    if (avg <= 2) return 'critical';
    if (avg <= 3.5) return 'moderate';
    return 'mild';
}

function detectSituationType(vectors) {
    const hour = new Date().getHours();
    if (hour < 12) return 'Утром после пробуждения';
    if (hour > 21) return 'Вечером перед сном';
    if (vectors.СБ <= 2) return 'На работе';
    if (vectors.ЧВ <= 2) return 'В отношениях';
    return 'В повседневной жизни';
}

// ============================================
// AI-ГЕНЕРАЦИЯ ИНСТРУКЦИИ
// ============================================

async function generatePersonalizedInstruction(combo, vectors, situation) {
    try {
        const prompt = ANCHORS_CONFIG.ai_prompts.generate_instruction(combo, vectors, situation);
        const response = await callAIGenerate(prompt, 800, 0.8);
        
        if (response) {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const instruction = JSON.parse(jsonMatch[0]);
                return {
                    id: combo.key,
                    name: instruction.name,
                    icon: combo.icon,
                    description: combo.description,
                    state: instruction.state,
                    trigger: instruction.trigger,
                    affirmation: instruction.affirmation,
                    steps: instruction.steps,
                    tomorrow_action: instruction.tomorrow_action,
                    severity: getSeverityLevel(vectors)
                };
            }
        }
        throw new Error('No valid JSON in response');
    } catch (error) {
        console.error('AI generation failed, using fallback:', error);
        return getFallbackInstruction(combo, vectors);
    }
}

function getFallbackInstruction(combo, vectors) {
    const fallbacks = {
        'conflict_avoidance': {
            name: 'Безопасное выражение чувств',
            state: 'safety',
            trigger: 'Я в безопасности, могу говорить',
            affirmation: 'Мои чувства имеют значение, я могу их выражать',
            steps: [
                'Заметь напряжение в теле — это сигнал',
                'Сделай глубокий вдох и медленный выдох',
                'Положи руку на сердце',
                'Скажи про себя: «Я в безопасности»',
                'Начни фразу с «Я чувствую...»',
                'После ответа снова положи руку на сердце'
            ],
            tomorrow_action: 'Завтра в разговоре скажи «Мне нужно 10 секунд, чтобы подумать»'
        },
        'burnout': {
            name: '5 минут восстановления',
            state: 'calm',
            trigger: 'Я делаю это всего 5 минут',
            affirmation: 'Я могу сделать что угодно, если это на 5 минут',
            steps: [
                'Признай: «Я устал, это нормально»',
                'Выбери одно маленькое дело',
                'Поставь таймер на 5 минут',
                'Делай это дело ровно 5 минут',
                'Спроси себя: «Хочу ли я продолжать?»',
                'Если нет — отдохни с чистой совестью'
            ],
            tomorrow_action: 'Завтра сделай самое нелюбимое дело на 5 минут'
        },
        'financial_chaos': {
            name: 'Я вижу свои деньги',
            state: 'grounding',
            trigger: 'Я записываю эту трату',
            affirmation: 'Я вижу, куда уходят мои деньги, это первый шаг',
            steps: [
                'Возьми телефон или блокнот',
                'Запиши ВСЕ траты за сегодня',
                'Не оценивай, просто фиксируй',
                'Скажи: «Я вижу свои деньги»',
                'В конце дня посмотри на список',
                'Повтори завтра'
            ],
            tomorrow_action: 'Завтра записывай каждую трату, даже 10 рублей'
        },
        'analytical_coldness': {
            name: 'Тепло к другим',
            state: 'love',
            trigger: 'Я замечаю чувства других',
            affirmation: 'Я учусь замечать эмоции, это делает меня сильнее',
            steps: [
                'В разговоре задай вопрос о чувствах',
                'Спроси: «Как ты себя чувствуешь?»',
                'Просто послушай, не анализируй',
                'Скажи: «Я слышу тебя»',
                'Заметь свои ощущения в теле',
                'Поблагодари собеседника за откровенность'
            ],
            tomorrow_action: 'Завтра задай коллеге или другу вопрос «Как ты?» и просто послушай'
        }
    };
    return fallbacks[combo.key] || fallbacks['conflict_avoidance'];
}

// ============================================
// ПОЛУЧЕНИЕ РЕКОМЕНДАЦИЙ
// ============================================

async function getProfileBasedRecommendations() {
    try {
        const status = await getUserStatus();
        if (!status.has_profile || !status.vectors) {
            return [];
        }
        
        const vectors = status.vectors;
        const combinations = analyzeVectorCombinations(vectors);
        
        if (combinations.length === 0) {
            return [];
        }
        
        const situation = detectSituationType(vectors);
        const recommendations = [];
        
        for (const combo of combinations) {
            const instruction = await generatePersonalizedInstruction(combo, vectors, situation);
            recommendations.push(instruction);
        }
        
        return recommendations;
    } catch (e) {
        console.warn('Failed to get recommendations:', e);
        return [];
    }
}

// ============================================
// GUIDED-АКТИВАЦИЯ
// ============================================

async function startGuidedActivation(anchor) {
    const state = ANCHORS_CONFIG.states[anchor.state];
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    isGuidedMode = true;
    
    container.innerHTML = `
        <div class="full-content-page" style="background: radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%);">
            <button class="back-btn" id="guidedBackBtn" style="position: absolute; top: 20px; left: 20px; z-index: 10;">◀️ ВЫХОД</button>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; padding: 20px;">
                <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 1.5s infinite;">${state?.icon || '⚓'}</div>
                <div style="font-size: 28px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; margin-bottom: 10px; text-align: center;">${anchor.name}</div>
                <div style="font-size: 16px; color: var(--text-secondary); margin-bottom: 30px;">Guided-активация • 2 минуты</div>
                <div style="width: 200px; height: 200px; border-radius: 50%; background: ${state?.color || '#ff6b3b'}20; border: 2px solid ${state?.color || '#ff6b3b'}; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; animation: breathe 8s ease-in-out infinite;">
                    <div style="font-size: 48px;">${state?.icon || '⚓'}</div>
                </div>
                <div id="guidedStep" style="font-size: 18px; font-weight: 500; color: white; text-align: center; margin-bottom: 15px;">🧘 Сядьте удобно, закройте глаза</div>
                <div id="guidedTimer" style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">Шаг 1 из 6</div>
                <div style="width: 80%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div id="guidedProgress" style="width: 0%; height: 100%; background: ${state?.color || '#ff6b3b'}; transition: width 0.3s;"></div>
                </div>
                <div id="guidedAffirmation" style="font-size: 20px; font-weight: 300; color: ${state?.color || '#ff6b3b'}; margin-top: 30px; text-align: center; font-style: italic; opacity: 0.8;">«${state?.affirmation || anchor.phrase || 'Я спокоен'}»</div>
            </div>
        </div>
        <style>
            @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
            @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        </style>
    `;
    
    document.getElementById('guidedBackBtn').onclick = () => {
        isGuidedMode = false;
        showAnchorsScreen();
    };
    
    const steps = [
        { text: '🧘 Сядьте удобно, закройте глаза', duration: 5000 },
        { text: '🌬️ Сделайте глубокий вдох... и медленный выдох', duration: 8000 },
        { text: `💭 Вспомните момент, когда вы чувствовали ${state?.name?.toLowerCase()}`, duration: 10000 },
        { text: `🔊 Скажите про себя: «${anchor.trigger || anchor.phrase}»`, duration: 5000 },
        { text: '🔄 Повторите триггер ещё 3 раза', duration: 8000 },
        { text: '✨ Откройте глаза. Ваш якорь активирован!', duration: 4000 }
    ];
    
    let currentStep = 0;
    const stepDiv = document.getElementById('guidedStep');
    const timerDiv = document.getElementById('guidedTimer');
    const progressDiv = document.getElementById('guidedProgress');
    
    function playStep() {
        if (currentStep >= steps.length || !isGuidedMode) {
            _anShowToast('✅ Якорь активирован!', 'success');
            _anPlayBeep();
            setTimeout(() => showAnchorsScreen(), 2000);
            return;
        }
        const step = steps[currentStep];
        stepDiv.innerHTML = step.text;
        timerDiv.innerHTML = `Шаг ${currentStep + 1} из ${steps.length}`;
        progressDiv.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
        if (window.voiceManager) {
            window.voiceManager.textToSpeech(step.text.replace(/[🔊🧘🌬️💭🔄✨]/g, ''), 'psychologist');
        }
        currentStep++;
        setTimeout(playStep, step.duration);
    }
    setTimeout(playStep, 1000);
}

// ============================================
// PDF ГЕНЕРАЦИЯ
// ============================================

async function generateInstructionPDF(anchor) {
    const state = ANCHORS_CONFIG.states[anchor.state];
    const userName = localStorage.getItem('fredi_user_name') || 'Пользователь';
    const today = new Date().toLocaleDateString('ru-RU');
    
    let steps = [];
    try { steps = JSON.parse(anchor.instruction_steps || '[]'); } catch(e) {}
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Инструкция: ${anchor.name}</title>
        <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid ${state?.color || '#ff6b3b'}; }
            .header-icon { font-size: 64px; display: block; margin-bottom: 10px; }
            .header-title { font-size: 28px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 18px; font-weight: bold; color: ${state?.color || '#333'}; border-left: 3px solid ${state?.color || '#ff6b3b'}; padding-left: 12px; margin-bottom: 15px; }
            .step { margin-bottom: 12px; }
            .step-num { display: inline-block; width: 28px; height: 28px; background: ${state?.color || '#ff6b3b'}; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }
            .trigger-box { background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0; }
            .trigger-text { font-size: 24px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; }
            .affirmation { font-style: italic; color: ${state?.color || '#ff6b3b'}; text-align: center; margin: 20px 0; font-size: 18px; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; }
        </style>
        </head>
        <body>
            <div class="header">
                <div class="header-icon">${state?.icon || '⚓'}</div>
                <div class="header-title">${_anEscapeHtml(anchor.name)}</div>
                <div>Персональная инструкция для ${_anEscapeHtml(userName)}</div>
                <div>${today}</div>
            </div>
            <div class="affirmation">«${state?.affirmation || anchor.phrase || 'Я спокоен'}»</div>
            <div class="section">
                <div class="section-title">🎯 ВАШ ТРИГГЕР</div>
                <div class="trigger-box"><div class="trigger-text">«${_anEscapeHtml(anchor.trigger || anchor.phrase)}»</div></div>
            </div>
            <div class="section">
                <div class="section-title">📋 ПОШАГОВАЯ ИНСТРУКЦИЯ</div>
                ${steps.map((step, i) => `<div class="step"><span class="step-num">${i+1}</span> ${step}</div>`).join('')}
            </div>
            <div class="footer">Сгенерировано Фреди — вашим виртуальным психологом</div>
        </body>
        </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instruction_${anchor.name.replace(/[^a-zа-яё]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    _anShowToast('📄 Инструкция скачана!', 'success');
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================

async function showAnchorsScreen() {
    _anInjectStyles();
    await loadUserAnchors();
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📚</div>
                <h1 class="content-title">Библиотека состояний</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Инструкции, программы и guided-медитации</p>
            </div>
            <div class="an-tabs">
                <button class="an-tab ${currentAnchorView === 'list' ? 'active' : ''}" data-view="list">📚 Мои ресурсы</button>
                <button class="an-tab ${currentAnchorView === 'create' ? 'active' : ''}" data-view="create">➕ Создать</button>
                <button class="an-tab ${currentAnchorView === 'recommend' ? 'active' : ''}" data-view="recommend">🎲 Подбор</button>
                <button class="an-tab ${currentAnchorView === 'techniques' ? 'active' : ''}" data-view="techniques">🔧 Техники</button>
                <button class="an-tab ${currentAnchorView === 'imprints' ? 'active' : ''}" data-view="imprints">📚 Импринты</button>
                <button class="an-tab ${currentAnchorView === 'constructor' ? 'active' : ''}" data-view="constructor">🎬 Конструктор</button>
            </div>
            <div id="anBody">${await renderCurrentView(currentAnchorView)}</div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (typeof window.loadMainScreen === 'function') window.loadMainScreen();
    };
    
    document.querySelectorAll('.an-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            currentAnchorView = tab.dataset.view;
            anchorWizardStep = 0;
            anchorWizardData = { state: null, source: null, sourceDetail: null, modality: null, trigger: null, name: null };
            selectedStimuli = [];
            const bodyDiv = document.getElementById('anBody');
            if (bodyDiv) bodyDiv.innerHTML = await renderCurrentView(currentAnchorView);
            document.querySelectorAll('.an-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

async function renderCurrentView(view) {
    switch(view) {
        case 'list': return renderAnchorsList();
        case 'create': return renderAnchorWizard();
        case 'recommend': return await renderAdvancedRecommendations();
        case 'techniques': return renderTechniques();
        case 'imprints': return renderImprints();
        case 'constructor': return renderConstructor();
        default: return renderAnchorsList();
    }
}

function renderAnchorsList() {
    if (!userAnchors.length) {
        return `<div style="text-align:center;padding:60px 20px;"><div style="font-size:64px;margin-bottom:16px;">📚</div><h3>У вас пока нет инструкций</h3><p style="color:var(--text-secondary);margin-bottom:20px;">Создайте первую инструкцию</p><button class="an-tab" data-view="create" style="padding:12px24px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">➕ Создать</button></div>`;
    }
    
    const stats = [
        { count: userAnchors.length, label: 'всего' },
        { count: userAnchors.filter(a => a.uses > 0).length, label: 'использовано' }
    ];
    
    return `
        <div style="display:flex;gap:8px;margin-bottom:16px;">
            ${stats.map(s => `<div style="flex:1;background:rgba(224,224,224,0.05);border-radius:12px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:700;">${s.count}</div><div style="font-size:10px;color:var(--text-secondary);">${s.label}</div></div>`).join('')}
        </div>
        ${userAnchors.map(anchor => {
            const state = ANCHORS_CONFIG.states[anchor.state];
            return `
            <div class="anchor-card" onclick="showInstructionDetail('${anchor.id}')" style="background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:24px;">${anchor.icon || state?.icon || '📝'}</span>
                    <span style="font-size:18px;font-weight:700;">${_anEscapeHtml(anchor.name)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);">${state?.name || anchor.state}</div>
                ${anchor.trigger ? `<div style="font-size:11px;color:#ff6b3b;margin-top:4px;">🔊 «${_anEscapeHtml(anchor.trigger)}»</div>` : ''}
                <div style="display:flex;gap:12px;margin-top:12px;" onclick="event.stopPropagation()">
                    <button onclick="startGuidedActivationFromAnchor('${anchor.id}')" style="padding:8px16px;border-radius:30px;background:rgba(224,224,224,0.1);border:none;color:white;cursor:pointer;">🎧 Guided</button>
                    <button onclick="exportInstructionToPDF('${anchor.id}')" style="padding:8px16px;border-radius:30px;background:rgba(255,107,59,0.15);border:none;color:#ff6b3b;cursor:pointer;">📄 PDF</button>
                    <button onclick="deleteAnchorConfirm('${anchor.id}')" style="padding:8px16px;border-radius:30px;background:rgba(224,224,224,0.05);border:none;color:var(--text-secondary);cursor:pointer;">🗑️</button>
                </div>
                ${anchor.uses ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:8px;">✅ использовано ${anchor.uses} раз</div>` : ''}
            </div>`;
        }).join('')}
    `;
}

function showInstructionDetail(anchorId) {
    const anchor = userAnchors.find(a => String(a.id) === String(anchorId));
    if (!anchor) return;
    
    const state = ANCHORS_CONFIG.states[anchor.state];
    let steps = [];
    try { steps = JSON.parse(anchor.instruction_steps || '[]'); } catch(e) {}
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="instrBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${anchor.icon || state?.icon || '📝'}</div>
                <h1 class="content-title">${_anEscapeHtml(anchor.name)}</h1>
            </div>
            <div style="background:rgba(224,224,224,0.05);border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;">
                <div style="font-size:12px;color:var(--text-secondary);">ВАШ ТРИГГЕР</div>
                <div style="font-size:24px;font-weight:bold;color:#ff6b3b;">«${_anEscapeHtml(anchor.trigger || anchor.phrase)}»</div>
            </div>
            ${steps.length ? `<div style="background:rgba(224,224,224,0.04);border-radius:16px;padding:20px;"><h3>📝 Инструкция</h3><ol style="margin-left:20px;line-height:1.8;">${steps.map(s => `<li>${_anEscapeHtml(s)}</li>`).join('')}</ol></div>` : ''}
            <div style="display:flex;gap:12px;margin-top:20px;">
                <button onclick="startGuidedActivationFromAnchor('${anchor.id}')" style="flex:1;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">🎧 Guided</button>
                <button onclick="exportInstructionToPDF('${anchor.id}')" style="flex:1;padding:12px;background:rgba(255,107,59,0.15);border:none;border-radius:30px;color:#ff6b3b;cursor:pointer;">📄 PDF</button>
            </div>
        </div>
    `;
    document.getElementById('instrBack').onclick = () => showAnchorsScreen();
}

// ============================================
// РЕНДЕР ПОДБОРА (С AI-ГЕНЕРАЦИЕЙ)
// ============================================

async function renderAdvancedRecommendations() {
    const recommendations = await getProfileBasedRecommendations();
    
    if (!recommendations.length) {
        const status = await getUserStatus();
        if (!status.has_profile) {
            return `<div style="text-align:center;padding:60px 20px;"><div style="font-size:64px;">🎲</div><h3>Нет персональных рекомендаций</h3><p style="color:var(--text-secondary);">Пройдите психологический тест</p><button onclick="window.startTest()" style="padding:12px24px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">📊 Пройти тест</button></div>`;
        }
        return `<div style="text-align:center;padding:60px 20px;"><div style="font-size:64px;">🎯</div><h3>У вас хороший баланс!</h3><p style="color:var(--text-secondary);">Вы можете создавать инструкции самостоятельно</p></div>`;
    }
    
    let html = `<div style="text-align:center;margin-bottom:24px;"><div style="display:inline-block;font-size:10px;background:rgba(255,107,59,0.2);padding:4px12px;border-radius:20px;color:#ff6b3b;">🤖 AI-ГЕНЕРАЦИЯ</div><div style="font-size:22px;font-weight:700;margin-top:8px;">Персональные инструкции</div></div>`;
    
    for (const rec of recommendations) {
        const severityColor = rec.severity === 'critical' ? '#ff4444' : rec.severity === 'moderate' ? '#ffaa44' : '#44aa44';
        const severityText = rec.severity === 'critical' ? '🔴 КРИТИЧЕСКИ ВАЖНО' : rec.severity === 'moderate' ? '🟡 РЕКОМЕНДУЕТСЯ' : '🟢 ДЛЯ РОСТА';
        
        html += `
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${severityColor};border-radius:20px;padding:20px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-size:32px;">${rec.icon || '🎯'}</div>
                    <div style="font-size:10px;padding:4px10px;border-radius:20px;background:${severityColor}20;color:${severityColor};">${severityText}</div>
                </div>
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${rec.name}</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:16px;">${rec.description}</div>
                
                <div style="background:rgba(255,255,255,0.02);border-radius:12px;padding:12px;margin-bottom:12px;">
                    <div style="font-size:10px;color:#ff6b3b;text-transform:uppercase;">🎯 Триггер</div>
                    <div style="font-size:16px;font-weight:500;">«${rec.trigger}»</div>
                </div>
                
                <div style="background:rgba(255,255,255,0.02);border-radius:12px;padding:12px;margin-bottom:12px;">
                    <div style="font-size:10px;color:#ff6b3b;text-transform:uppercase;">💭 Аффирмация</div>
                    <div style="font-size:14px;font-style:italic;">«${rec.affirmation}»</div>
                </div>
                
                <div style="background:rgba(255,255,255,0.02);border-radius:12px;padding:12px;margin-bottom:16px;">
                    <div style="font-size:10px;color:#ff6b3b;text-transform:uppercase;">📅 На завтра</div>
                    <div style="font-size:13px;">${rec.tomorrow_action}</div>
                </div>
                
                <div style="display:flex;gap:10px;">
                    <button onclick='quickCreateFromRecommendation(${JSON.stringify(rec)})' style="flex:1;padding:10px;border-radius:30px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);border:none;color:white;cursor:pointer;">✨ Создать</button>
                    <button onclick='startGuidedFromRecommendation(${JSON.stringify(rec)})' style="flex:1;padding:10px;border-radius:30px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;">🎧 Guided</button>
                </div>
            </div>
        `;
    }
    
    // Кнопка "Создать все инструкции сразу"
    html += `
        <div style="margin-top:20px;text-align:center;">
            <button onclick="createAllRecommendations()" style="width:100%;padding:14px;background:linear-gradient(135deg,rgba(255,107,59,0.2),rgba(255,59,59,0.1));border:1px solid rgba(255,107,59,0.3);border-radius:40px;color:#ff6b3b;font-weight:600;cursor:pointer;">⚡ Создать все инструкции сразу</button>
        </div>
    `;
    
    return html;
}

// ============================================
// КОНСТРУКТОР (ИСПРАВЛЕННЫЙ)
// ============================================

function renderConstructor() {
    if (anchorWizardStep > 0 && anchorWizardData.source) {
        return renderAnchorWizard();
    }
    
    return `
        <div style="margin-bottom:16px;"><p style="font-size:13px;color:var(--text-secondary);">🎬 <strong>Конструктор</strong> — создайте инструкцию из внешнего источника</p></div>
        <div class="wizard-options">
            ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                <div onclick="constructorSelectSource('${key}')" style="background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.1);border-radius:12px;padding:16px;margin-bottom:8px;cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:24px;">${source.icon}</span>
                        <div><div style="font-weight:600;">${source.name}</div><div style="font-size:12px;color:var(--text-secondary);">${source.desc}</div></div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div id="constructorContent"></div>
    `;
}

function renderAnchorWizard() {
    const step = anchorWizardStep;
    const data = anchorWizardData;
    
    // Шаг 0: выбор состояния
    if (step === 0) {
        return `
            <div style="background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;margin-top:20px;">
                <h3>➕ Создание инструкции</h3>
                <p style="color:var(--text-secondary);margin-bottom:20px;">Шаг 1 из 4: Какое состояние?</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    ${Object.entries(ANCHORS_CONFIG.states).map(([key, state]) => `
                        <div onclick="anchorWizardSelectState('${key}')" style="background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.1);border-radius:12px;padding:16px;cursor:pointer;">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <span style="font-size:24px;">${state.icon}</span>
                                <div><div style="font-weight:600;">${state.name}</div><div style="font-size:12px;color:var(--text-secondary);">${state.desc}</div></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Шаг 1: выбор источника
    if (step === 1) {
        return `
            <div style="background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;margin-top:20px;">
                <h3>➕ Создание инструкции</h3>
                <p style="color:var(--text-secondary);margin-bottom:20px;">Шаг 2 из 4: Откуда возьмём состояние?</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                        <div onclick="anchorWizardSelectSource('${key}')" style="background:rgba(224,224,224,0.03);border:1px solid ${data.source === key ? '#ff6b3b' : 'rgba(224,224,224,0.1)'};border-radius:12px;padding:16px;cursor:pointer;">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <span style="font-size:24px;">${source.icon}</span>
                                <div><div style="font-weight:600;">${source.name}</div><div style="font-size:12px;color:var(--text-secondary);">${source.desc}</div></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${data.source ? `
                    <textarea id="sourceDetail" placeholder="Опишите источник..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-top:20px;min-height:80px;">${_anEscapeHtml(data.sourceDetail || '')}</textarea>
                    <button onclick="anchorWizardNext()" style="margin-top:20px;width:100%;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">Далее →</button>
                ` : ''}
            </div>
        `;
    }
    
    // Шаг 2: выбор триггера (ИСПРАВЛЕНО!)
    if (step === 2) {
        return `
            <div style="background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;margin-top:20px;">
                <h3>➕ Создание инструкции</h3>
                <p style="color:var(--text-secondary);margin-bottom:20px;">Шаг 3 из 4: Какой будет триггер?</p>
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                    <div onclick="anchorWizardSelectModality('auditory')" style="background:rgba(224,224,224,0.03);border:1px solid ${data.modality === 'auditory' ? '#ff6b3b' : 'rgba(224,224,224,0.1)'};border-radius:12px;padding:16px;cursor:pointer;">
                        <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:24px;">🔊</span><div><div style="font-weight:600;">Аудиальный</div><div style="font-size:12px;">Ключевая фраза</div></div></div>
                    </div>
                    <div onclick="anchorWizardSelectModality('kinesthetic')" style="background:rgba(224,224,224,0.03);border:1px solid ${data.modality === 'kinesthetic' ? '#ff6b3b' : 'rgba(224,224,224,0.1)'};border-radius:12px;padding:16px;cursor:pointer;">
                        <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:24px;">🖐️</span><div><div style="font-weight:600;">Кинестетический</div><div style="font-size:12px;">Жест, поза</div></div></div>
                    </div>
                    <div onclick="anchorWizardSelectModality('visual')" style="background:rgba(224,224,224,0.03);border:1px solid ${data.modality === 'visual' ? '#ff6b3b' : 'rgba(224,224,224,0.1)'};border-radius:12px;padding:16px;cursor:pointer;">
                        <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:24px;">👁️</span><div><div style="font-weight:600;">Визуальный</div><div style="font-size:12px;">Образ, символ</div></div></div>
                    </div>
                </div>
                <input type="text" id="triggerInput" placeholder="Например: «Я спокоен» или сжать кулак" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;" value="${_anEscapeHtml(data.trigger || '')}">
                <button onclick="anchorWizardSaveTrigger()" style="margin-top:20px;width:100%;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">Далее →</button>
            </div>
        `;
    }
    
    // Шаг 3: название и сохранение
    if (step === 3) {
        return `
            <div style="background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;margin-top:20px;">
                <h3>➕ Создание инструкции</h3>
                <p style="color:var(--text-secondary);margin-bottom:20px;">Шаг 4 из 4: Назовите инструкцию</p>
                <input type="text" id="anchorNameInput" placeholder="Например: «Спокойствие перед выступлением»" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-bottom:20px;" value="${_anEscapeHtml(data.name || '')}">
                
                <div style="background:rgba(76,175,80,0.1);border-radius:12px;padding:16px;margin:20px0;">
                    <p><strong>🎯 Ваш план:</strong></p>
                    <ol style="margin-left:20px;line-height:1.8;">
                        <li>Войдите в состояние ${ANCHORS_CONFIG.states[data.state]?.name || data.state}</li>
                        <li>В момент ПИКА сделайте триггер: <strong>«${data.trigger || '...'}»</strong></li>
                        <li>Сбросьте состояние</li>
                        <li>Повторите 3-5 раз</li>
                    </ol>
                </div>
                
                <div style="display:flex;gap:12px;">
                    <button onclick="anchorWizardComplete()" style="flex:1;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">✅ Сохранить</button>
                    <button onclick="anchorWizardReset()" style="flex:1;padding:12px;background:rgba(224,224,224,0.1);border:1px solid rgba(224,224,224,0.2);border-radius:30px;color:white;cursor:pointer;">↺ Заново</button>
                </div>
            </div>
        `;
    }
    
    return '<div>Загрузка...</div>';
}

// ============================================
// ОБРАБОТЧИКИ КОНСТРУКТОРА (ИСПРАВЛЕННЫЕ)
// ============================================

window.anchorWizardSelectState = (state) => {
    anchorWizardData = { state: state, source: null, sourceDetail: null, modality: null, trigger: null, name: null };
    anchorWizardStep = 1;
    showAnchorsScreen();
};

window.anchorWizardSelectSource = (source) => {
    anchorWizardData.source = source;
    showAnchorsScreen();
};

window.anchorWizardSelectModality = (modality) => {
    anchorWizardData.modality = modality;
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

window.anchorWizardSaveTrigger = () => {
    const triggerInput = document.getElementById('triggerInput');
    console.log('🔍 Сохраняем триггер:', triggerInput?.value);
    
    if (triggerInput && triggerInput.value.trim()) {
        anchorWizardData.trigger = triggerInput.value.trim();
        console.log('✅ Триггер сохранён:', anchorWizardData.trigger);
        anchorWizardStep = 3;
        showAnchorsScreen();
    } else {
        _anShowToast('❌ Пожалуйста, введите триггер', 'error');
    }
};

window.anchorWizardComplete = async () => {
    console.log('🔍 anchorWizardData:', anchorWizardData);
    
    const nameInput = document.getElementById('anchorNameInput');
    if (nameInput && nameInput.value.trim()) {
        anchorWizardData.name = nameInput.value.trim();
    }
    
    if (!anchorWizardData.name) {
        anchorWizardData.name = `${ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state}`;
    }
    
    if (!anchorWizardData.trigger?.trim()) {
        _anShowToast('❌ Не указан триггер', 'error');
        anchorWizardStep = 2;
        showAnchorsScreen();
        return;
    }
    
    const steps = [
        `Найдите спокойное место`,
        `Сделайте 3 глубоких вдоха`,
        `Вспомните ${ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state}`,
        `Доведите ощущение до пика`,
        `Сделайте триггер: "${anchorWizardData.trigger}"`,
        `Сбросьте состояние`,
        `Повторите 4-5 раз`
    ];
    
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: anchorWizardData.name,
        state: anchorWizardData.state,
        source: anchorWizardData.source || 'own',
        source_detail: anchorWizardData.sourceDetail || '',
        modality: anchorWizardData.modality || 'auditory',
        trigger: anchorWizardData.trigger,
        phrase: anchorWizardData.trigger,
        icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '⚓',
        state_icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state,
        instruction_steps: JSON.stringify(steps)
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        _anShowToast('✅ Инструкция создана!', 'success');
        _anPlayBeep();
        anchorWizardStep = 0;
        anchorWizardData = { state: null, source: null, sourceDetail: null, modality: null, trigger: null, name: null };
        currentAnchorView = 'list';
        await loadUserAnchors();
        showAnchorsScreen();
    } else {
        _anShowToast('❌ Ошибка сохранения', 'error');
    }
};

window.anchorWizardReset = () => {
    anchorWizardStep = 0;
    anchorWizardData = { state: null, source: null, sourceDetail: null, modality: null, trigger: null, name: null };
    selectedStimuli = [];
    showAnchorsScreen();
};

window.constructorSelectSource = (source) => {
    const container = document.getElementById('constructorContent');
    if (!container) return;
    
    container.innerHTML = `
        <div style="margin-top:20px;">
            <textarea id="sourceDetailInput" placeholder="Опишите ${ANCHORS_CONFIG.sources[source]?.name}..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;min-height:100px;"></textarea>
            <button onclick="constructorCreateFromSource('${source}')" style="margin-top:16px;width:100%;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">Использовать этот источник</button>
        </div>
    `;
};

window.constructorCreateFromSource = (source) => {
    const detail = document.getElementById('sourceDetailInput')?.value.trim();
    if (!detail) {
        _anShowToast('❌ Опишите источник', 'error');
        return;
    }
    
    anchorWizardData = {
        state: 'calm',
        source: source,
        sourceDetail: detail,
        modality: 'auditory',
        trigger: null,
        name: null
    };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

// ============================================
// ОБРАБОТЧИКИ РЕКОМЕНДАЦИЙ
// ============================================

window.quickCreateFromRecommendation = async (rec) => {
    const steps = rec.steps || [
        `Найдите спокойное место`,
        `Сделайте глубокий вдох`,
        `Скажите: «${rec.trigger}»`,
        `Повторите 3-5 раз`
    ];
    
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: rec.name,
        state: rec.state,
        source: 'ai_recommendation',
        source_detail: rec.id,
        modality: 'auditory',
        trigger: rec.trigger,
        phrase: rec.affirmation,
        icon: ANCHORS_CONFIG.states[rec.state]?.icon || '🎯',
        state_icon: ANCHORS_CONFIG.states[rec.state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[rec.state]?.name || rec.state,
        instruction_steps: JSON.stringify(steps)
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        _anShowToast(`✅ Создана инструкция: ${rec.name}`, 'success');
        _anShowToast(`📅 На завтра: ${rec.tomorrow_action}`, 'info');
        await loadUserAnchors();
        currentAnchorView = 'list';
        showAnchorsScreen();
    } else {
        _anShowToast('❌ Ошибка создания', 'error');
    }
};

window.startGuidedFromRecommendation = (rec) => {
    const fakeAnchor = {
        name: rec.name,
        state: rec.state,
        trigger: rec.trigger,
        phrase: rec.affirmation
    };
    startGuidedActivation(fakeAnchor);
};

window.createAllRecommendations = async () => {
    const recommendations = await getProfileBasedRecommendations();
    let successCount = 0;
    
    for (const rec of recommendations) {
        const steps = rec.steps || [`Скажите: «${rec.trigger}»`, `Повторите 3-5 раз`];
        const anchorToSave = {
            user_id: CONFIG.USER_ID,
            name: rec.name,
            state: rec.state,
            source: 'ai_recommendation',
            source_detail: rec.id,
            modality: 'auditory',
            trigger: rec.trigger,
            phrase: rec.affirmation,
            icon: ANCHORS_CONFIG.states[rec.state]?.icon || '🎯',
            instruction_steps: JSON.stringify(steps)
        };
        const success = await saveAnchor(anchorToSave);
        if (success) successCount++;
    }
    
    _anShowToast(`✅ Создано ${successCount} инструкций`, 'success');
    await loadUserAnchors();
    currentAnchorView = 'list';
    showAnchorsScreen();
};

window.startGuidedActivationFromAnchor = (anchorId) => {
    const anchor = userAnchors.find(a => String(a.id) === String(anchorId));
    if (anchor) startGuidedActivation(anchor);
};

window.exportInstructionToPDF = (anchorId) => {
    const anchor = userAnchors.find(a => String(a.id) === String(anchorId));
    if (anchor) generateInstructionPDF(anchor);
};

window.deleteAnchorConfirm = async (anchorId) => {
    if (confirm('Удалить эту инструкцию?')) {
        const success = await deleteAnchor(anchorId);
        if (success) {
            _anShowToast('🗑️ Инструкция удалена', 'success');
            await loadUserAnchors();
            showAnchorsScreen();
        }
    }
};

window.fireAnchor = async (anchorId, anchorName) => {
    _anShowToast(`🎧 Активирую состояние...`, 'info');
    const phrase = await fireAnchorAPI(anchorId, anchorName);
    if (phrase) {
        _anShowToast(`✅ ${phrase}`, 'success');
        if (window.voiceManager) {
            await window.voiceManager.textToSpeech(phrase, window.currentMode || 'psychologist');
        }
    }
};

window.startTest = () => {
    if (typeof window.showTestScreen === 'function') {
        window.showTestScreen();
    } else {
        _anShowToast('📊 Тест скоро будет доступен', 'info');
    }
};

// ============================================
// ТЕХНИКИ И ИМПРИНТЫ
// ============================================

function renderTechniques() {
    return `
        <div style="margin-bottom:20px;"><p>🔧 Продвинутые техники</p></div>
        ${Object.entries(ANCHORS_CONFIG.techniques).map(([key, tech]) => `
            <div onclick="showTechnique('${key}')" style="background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:32px;">${tech.icon}</span>
                    <div><div style="font-weight:700;">${tech.name}</div><div style="font-size:13px;color:var(--text-secondary);">${tech.desc}</div></div>
                    <span style="margin-left:auto;">→</span>
                </div>
            </div>
        `).join('')}
    `;
}

function renderImprints() {
    return `
        <div style="margin-bottom:20px;"><p>📚 Глубинная работа с импринтами</p></div>
        <div onclick="startImprintDiagnostic()" style="background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:32px;">🔍</span><div><div style="font-weight:700;">Диагностика импринтов</div><div style="font-size:13px;">20 вопросов, 3 минуты</div></div></div>
        </div>
        <div onclick="startReimprinting()" style="background:rgba(224,224,224,0.05);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:12px;"><span style="font-size:32px;">🔄</span><div><div style="font-weight:700;">Реимпринтинг</div><div style="font-size:13px;">Перезапись детских программ</div></div></div>
        </div>
    `;
}

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
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">📚</div><h1 class="content-title">Диагностика импринтов</h1></div>
            <div class="an-progress-bar"><div class="an-progress-fill" style="width:${progress}%"></div></div>
            <div style="background:rgba(224,224,224,0.05);border-radius:24px;padding:32px;margin:24px0;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);">Вопрос ${index+1} из ${questions.length}</div>
                <div style="font-size:20px;font-weight:600;margin:20px0;">${_anEscapeHtml(question.text)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
                    <button class="answer-btn" data-value="0" style="background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.1);border-radius:40px;padding:12px24px;cursor:pointer;">❌ Совсем нет</button>
                    <button class="answer-btn" data-value="1" style="background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.1);border-radius:40px;padding:12px24px;cursor:pointer;">🤔 Иногда</button>
                    <button class="answer-btn" data-value="2" style="background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.1);border-radius:40px;padding:12px24px;cursor:pointer;">😐 Часто</button>
                    <button class="answer-btn" data-value="3" style="background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.1);border-radius:40px;padding:12px24px;cursor:pointer;">✅ Очень точно</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => showAnchorsScreen();
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            diagnosticAnswers[index] = { question: question.text, imprint: question.imprint, weight: question.weight, value: parseInt(btn.dataset.value) };
            showDiagnosticQuestion(index + 1);
        });
    });
}

function finishDiagnostic() {
    const scores = {};
    for (const type of Object.keys(IMPRINTS_CONFIG.types)) scores[type] = 0;
    
    for (let i = 0; i < IMPRINTS_CONFIG.questions.length; i++) {
        const answer = diagnosticAnswers[i];
        if (answer && answer.imprint) {
            scores[answer.imprint] += answer.value * answer.weight;
        }
    }
    
    let maxScore = 0, dominantImprint = null;
    for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; dominantImprint = type; }
    }
    
    diagnosticResult = { dominant: dominantImprint, scores: scores, config: IMPRINTS_CONFIG.types[dominantImprint] };
    showDiagnosticResult();
}

function showDiagnosticResult() {
    const result = diagnosticResult;
    const imprint = result.config;
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">📊</div><h1 class="content-title">Результаты диагностики</h1></div>
            <div style="background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin:16px0;border-left:4px solid ${imprint.color};">
                <div style="font-size:48px;margin-bottom:12px;">${imprint.icon}</div>
                <div style="font-size:24px;font-weight:700;">${imprint.name}</div>
                <div style="margin:16px0;">${imprint.description}</div>
                <div style="background:rgba(76,175,80,0.1);border-radius:16px;padding:16px;margin:16px0;">
                    <div style="font-weight:700;">🌱 Исцеляющая фраза</div>
                    <div style="font-size:18px;font-style:italic;">«${imprint.healing_phrase}»</div>
                    <button onclick="saveHealingPhrase('${imprint.healing_phrase}', '${imprint.recommended_state}')" style="margin-top:12px;padding:10px20px;background:#4caf50;border:none;border-radius:30px;color:white;cursor:pointer;">💾 Сохранить</button>
                </div>
            </div>
            <button onclick="startReimprintingForImprint('${result.dominant}')" style="width:100%;padding:14px;background:#9c27b0;border:none;border-radius:30px;color:white;cursor:pointer;margin-top:16px;">🔄 Начать реимпринтинг</button>
        </div>
    `;
    document.getElementById('backBtn').onclick = () => showAnchorsScreen();
}

async function saveHealingPhrase(phrase, state) {
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: `Исцеление`,
        state: state || 'love',
        source: 'imprint',
        modality: 'auditory',
        trigger: phrase,
        phrase: phrase,
        icon: '💖',
        instruction_steps: JSON.stringify(['Сядьте удобно', 'Сделайте вдох', 'Повторите фразу: "' + phrase + '"', 'Почувствуйте тепло'])
    };
    const success = await saveAnchor(anchorToSave);
    if (success) _anShowToast('✅ Сохранено!', 'success');
}

function startReimprinting() {
    reimprintingStep = 1;
    reimprintingData = { situation: '', decision: '', newMessage: '', newAnchor: '' };
    showReimprintingScreen();
}

function startReimprintingForImprint(imprintType) {
    const imprint = IMPRINTS_CONFIG.types[imprintType];
    reimprintingData = {
        imprintType: imprintType,
        imprintName: imprint.name,
        situation: imprint.childhood,
        decision: `Я решил, что ${imprint.shortDesc.toLowerCase()}`,
        newMessage: imprint.healing_phrase,
        newAnchor: ''
    };
    reimprintingStep = 1;
    showReimprintingScreen();
}

function showReimprintingScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const steps = {
        1: { title: 'Ситуация из детства', content: `<textarea id="situation" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;min-height:100px;">${_anEscapeHtml(reimprintingData.situation || '')}</textarea>` },
        2: { title: 'Какое решение вы приняли?', content: `<textarea id="decision" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;min-height:100px;">${_anEscapeHtml(reimprintingData.decision || '')}</textarea>` },
        3: { title: 'Войдите в ресурс', content: `<p>Сделайте глубокий вдох... Вы стали взрослым, сильным, мудрым.</p><button id="resourceBtn" style="padding:12px;background:#4caf50;border:none;border-radius:30px;color:white;cursor:pointer;">✅ Я в ресурсе</button>` },
        4: { title: 'Новое послание', content: `<textarea id="newMessage" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;min-height:100px;">${_anEscapeHtml(reimprintingData.newMessage || '')}</textarea>` },
        5: { title: 'Закрепите якорем', content: `<input type="text" id="newAnchor" placeholder="Триггер (фраза или жест)" style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;" value="${_anEscapeHtml(reimprintingData.newAnchor || '')}"><button id="completeBtn" style="margin-top:16px;padding:12px;background:#9c27b0;border:none;border-radius:30px;color:white;cursor:pointer;">✅ Завершить</button>` }
    };
    
    const progress = (reimprintingStep / 5) * 100;
    const step = steps[reimprintingStep];
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">🔄</div><h1 class="content-title">Реимпринтинг</h1></div>
            <div class="an-progress-bar"><div class="an-progress-fill" style="width:${progress}%"></div></div>
            <div style="background:rgba(224,224,224,0.05);border-radius:24px;padding:32px;margin:24px0;">
                <div style="font-size:20px;font-weight:600;margin-bottom:20px;">${step.title}</div>
                ${step.content}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => {
        if (reimprintingStep > 1) { reimprintingStep--; showReimprintingScreen(); }
        else showAnchorsScreen();
    };
    
    if (reimprintingStep === 3) {
        document.getElementById('resourceBtn')?.addEventListener('click', () => { reimprintingStep++; showReimprintingScreen(); });
    } else if (reimprintingStep === 5) {
        document.getElementById('completeBtn')?.addEventListener('click', async () => {
            const newAnchor = document.getElementById('newAnchor')?.value || '';
            const steps = [
                'Сядьте удобно, закройте глаза',
                'Вспомните ситуацию из детства',
                'Представьте себя взрослым, мудрым',
                'Скажите себе-ребёнку новое послание',
                `Сделайте триггер: ${newAnchor || 'рука на сердце'}`,
                'Повторите 3 раза'
            ];
            
            const anchorToSave = {
                user_id: CONFIG.USER_ID,
                name: `Реимпринтинг: ${reimprintingData.imprintName || 'Новое решение'}`,
                state: 'love',
                source: 'reimprinting',
                modality: 'auditory',
                trigger: newAnchor || 'Я переписал свой импринт',
                phrase: reimprintingData.newMessage || 'Я свободен',
                instruction_steps: JSON.stringify(steps)
            };
            
            const success = await saveAnchor(anchorToSave);
            if (success) {
                _anShowToast('✅ Импринт переписан!', 'success');
                showAnchorsScreen();
            }
        });
    } else if (reimprintingStep !== 3) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Далее →';
        nextBtn.style.cssText = 'margin-top:20px;width:100%;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;';
        nextBtn.onclick = () => {
            const situation = document.getElementById('situation');
            const decision = document.getElementById('decision');
            const newMessage = document.getElementById('newMessage');
            if (situation) reimprintingData.situation = situation.value;
            if (decision) reimprintingData.decision = decision.value;
            if (newMessage) reimprintingData.newMessage = newMessage.value;
            reimprintingStep++;
            showReimprintingScreen();
        };
        document.querySelector('.full-content-page > div:last-child').appendChild(nextBtn);
    }
}

window.showTechnique = (techniqueKey) => {
    const techniquesContent = {
        stacking: '<h3>🔗 Накладка якорей</h3><p>Соединение двух ресурсных состояний</p><ol><li>Установите якорь на состояние А</li><li>Установите якорь на состояние Б</li><li>Активируйте оба одновременно</li><li>Создайте новый якорь</li></ol>',
        collapse: '<h3>💥 Коллапс якорей</h3><p>Разрушение негативного якоря</p><ol><li>Установите якорь на негатив</li><li>Установите ресурсный якорь</li><li>Активируйте оба одновременно</li></ol>',
        chaining: '<h3>⛓️ Цепочка якорей</h3><p>Последовательная активация состояний</p><ol><li>Состояние А → Якорь А</li><li>Переход к состоянию Б</li><li>Состояние Б → Якорь Б</li></ol>',
        reimprinting: '<h3>🔄 Реимпринтинг</h3><p>Перезапись детских программ</p><button onclick="startReimprinting()" style="margin-top:16px;padding:12px;background:#ff6b3b;border:none;border-radius:30px;color:white;cursor:pointer;">Начать</button>'
    };
    
    const container = document.getElementById('screenContainer');
    if (container) {
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" onclick="showAnchorsScreen()">◀️ НАЗАД</button>
                <div class="content-header"><div class="content-emoji">🔧</div><h1 class="content-title">${ANCHORS_CONFIG.techniques[techniqueKey]?.name || 'Техника'}</h1></div>
                <div style="background:rgba(224,224,224,0.05);border-radius:20px;padding:24px;">${techniquesContent[techniqueKey] || '<p>Техника загружается...</p>'}</div>
            </div>
        `;
    }
};

// ============================================
// СТИЛИ
// ============================================

function _anInjectStyles() {
    if (document.getElementById('an-v5-styles')) return;
    const style = document.createElement('style');
    style.id = 'an-v5-styles';
    style.textContent = `
        .an-tabs { display:flex; flex-wrap:wrap; gap:4px; background:rgba(224,224,224,0.05); border:1px solid rgba(224,224,224,0.1); border-radius:40px; padding:4px; margin-bottom:20px; }
        .an-tab { flex-shrink:0; padding:8px12px; border-radius:30px; border:none; background:transparent; color:var(--text-secondary); font-size:11px; font-weight:600; cursor:pointer; }
        .an-tab.active { background:rgba(224,224,224,0.14); color:var(--text-primary); }
        .an-progress-bar { height:4px; background:rgba(224,224,224,0.1); border-radius:2px; overflow:hidden; margin:8px0; }
        .an-progress-fill { height:100%; background:linear-gradient(90deg,rgba(224,224,224,0.4),rgba(192,192,192,0.3)); transition:width0.3s; }
        .anchor-card { transition:all0.2s; }
        .anchor-card:hover { transform:translateX(4px); background:rgba(224,224,224,0.08) !important; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.1);opacity:0.8;} }
        @keyframes breathe { 0%,100%{transform:scale(1);} 50%{transform:scale(1.2);} }
    `;
    document.head.appendChild(style);
}

// ============================================
// ЭКСПОРТ
// ============================================

window.showAnchorsScreen = showAnchorsScreen;
window.startImprintDiagnostic = startImprintDiagnostic;
window.startReimprinting = startReimprinting;

console.log('✅ Модуль "Библиотека состояний" загружен (v5.0)');
