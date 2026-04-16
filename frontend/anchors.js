// ============================================
// МОДУЛЬ: БИБЛИОТЕКА СОСТОЯНИЙ
// Версия: 3.0 — с guided-активацией, PDF и физическими стимулами
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

    // НОВОЕ: Физические стимулы для вау-эффекта
    physical_stimuli: {
        zippo: {
            name: 'Зажигалка Zippo',
            icon: '🔥',
            description: 'Звук открытия крышки + чирканье колесиком',
            howToUse: 'Достаньте Zippo, откройте крышку — услышьте металлический *клик*. Чиркните колёсиком — почувствуйте искру. Этот звук — якорь мгновенной уверенности.',
            anchorPower: 10,
            bestFor: ['confidence', 'action'],
            price: '≈1000₽',
            whereToBuy: 'Wildberries, Ozon, табачные магазины'
        },
        crystal: {
            name: 'Кристалл (кварц/аметист)',
            icon: '💎',
            description: 'Гладкая прохладная поверхность, вес в руке',
            howToUse: 'Возьмите кристалл в руку. Почувствуйте его прохладу, гладкость, вес. Это физический якорь спокойствия — пока вы держите кристалл, вы в безопасности.',
            anchorPower: 8,
            bestFor: ['calm', 'grounding', 'focus'],
            price: '300-1500₽',
            whereToBuy: 'Магазины камней, сувенирные лавки'
        },
        stressBall: {
            name: 'Антистресс-игрушка (спиннер/куб/мяч)',
            icon: '🎾',
            description: 'Мягкое сжатие, упругость, тактильная стимуляция',
            howToUse: 'Сожмите мяч — почувствуйте сопротивление. Отпустите — расслабьтесь. Это ритм: напряжение → расслабление. Ваше тело запоминает этот паттерн.',
            anchorPower: 9,
            bestFor: ['calm', 'focus', 'grounding'],
            price: '300-800₽',
            whereToBuy: 'Магазины канцтоваров, Ozon'
        },
        teaCup: {
            name: 'Чашка с чаем (ритуал)',
            icon: '🍵',
            description: 'Тепло в руках + аромат + ритуал',
            howToUse: 'Налейте тёплый чай. Обхватите чашку ладонями. Вдохните аромат. Сделайте маленький глоток. Тепло, идущее в руки, — якорь безопасности.',
            anchorPower: 9,
            bestFor: ['calm', 'safety', 'grounding'],
            price: '0-500₽',
            whereToBuy: 'Домашняя кухня'
        },
        pen: {
            name: 'Ручка с кнопкой',
            icon: '✒️',
            description: 'Щелчок кнопки, вращение в пальцах',
            howToUse: 'Возьмите ручку. Нажмите на кнопку — *щелчок*. Этот звук переключает внимание. Сделайте это перед важной задачей — и войдёте в фокус.',
            anchorPower: 7,
            bestFor: ['focus', 'action'],
            price: '50-300₽',
            whereToBuy: 'Любой магазин канцтоваров'
        },
        perfume: {
            name: 'Парфюм (сигнальный аромат)',
            icon: '🌸',
            description: 'Запах, который ассоциируется с вашим состоянием',
            howToUse: 'Выберите аромат для уверенности. Наносите его перед важными встречами. Через неделю запах начнёт автоматически вызывать нужное состояние.',
            anchorPower: 8,
            bestFor: ['confidence', 'calm', 'love'],
            price: '1000-5000₽',
            whereToBuy: 'Парфюмерные магазины'
        },
        ring: {
            name: 'Кольцо/браслет',
            icon: '💍',
            description: 'Вращение на пальце, тактильный контакт',
            howToUse: 'Наденьте кольцо на палец. В моменты тревоги покрутите его. Это движение — якорь спокойствия. Вы носите свою уверенность с собой.',
            anchorPower: 8,
            bestFor: ['calm', 'confidence', 'grounding'],
            price: '500-3000₽',
            whereToBuy: 'Ювелирные магазины, украшения ручной работы'
        },
        keychain: {
            name: 'Брелок (тактильный)',
            icon: '🔑',
            description: 'Звон металла, шершавая поверхность',
            howToUse: 'Повесьте брелок на ключи. В нужный момент позвените им. Этот звук — якорь переключения состояния.',
            anchorPower: 6,
            bestFor: ['action', 'focus'],
            price: '100-500₽',
            whereToBuy: 'Сувенирные магазины'
        }
    },

    // НОВОЕ: Типы сохраняемых сущностей
    saveable_types: {
        instruction: {
            id: 'instruction',
            name: '📝 Инструкция',
            description: 'Пошаговое руководство для создания состояния',
            icon: '📝',
            color: '#4caf50',
            badge: 'Пошаговое руководство'
        },
        guided_audio: {
            id: 'guided_audio',
            name: '🎧 Guided-медитация',
            description: 'Аудио-сопровождение для активации',
            icon: '🎧',
            color: '#2196f3',
            badge: 'С голосовым сопровождением'
        },
        media_order: {
            id: 'media_order',
            name: '🎬 Заказ якоря',
            description: 'Персональная запись под ваш профиль',
            icon: '🎬',
            color: '#ff9800',
            badge: 'Обработка 1-3 дня'
        }
    }
};

// ============================================
// КОНФИГУРАЦИЯ ИМПРИНТОВ
// ============================================

const IMPRINTS_CONFIG = {
    types: {
        abandonment: {
            id: 'abandonment', name: 'Импринт отвержения', icon: '😔', color: '#ff6b6b',
            shortDesc: 'Страх, что вас бросят',
            description: 'Глубинное убеждение, что вы не нужны, что вас отвергнут или покинут.',
            childhood: 'В детстве ваши потребности могли игнорироваться. Родители были эмоционально холодны.',
            adult_manifestations: ['Страх близких отношений', 'Тревога при расставаниях', 'Созависимость'],
            healing_phrase: 'Я ценен сам по себе. Моё присутствие — уже дар.',
            recommended_state: 'safety',
            affirmation: 'Я достоин любви просто потому, что я есть'
        },
        danger: {
            id: 'danger', name: 'Импринт опасности', icon: '⚠️', color: '#ff9800',
            shortDesc: 'Мир опасен',
            description: 'Убеждение, что мир — опасное место, где нельзя расслабляться.',
            childhood: 'Мир казался непредсказуемым и угрожающим.',
            adult_manifestations: ['Генерализованная тревожность', 'Избегание нового', 'Панические атаки'],
            healing_phrase: 'Сейчас я в безопасности. Я справлюсь с любыми вызовами.',
            recommended_state: 'grounding',
            affirmation: 'Мир безопасен, я под защитой'
        },
        perfectionism: {
            id: 'perfectionism', name: 'Импринт перфекционизма', icon: '🎯', color: '#4caf50',
            shortDesc: 'Надо быть идеальным',
            description: 'Убеждение, что нужно быть идеальным, чтобы заслужить любовь.',
            childhood: 'Хвалили только за достижения, ошибки наказывались.',
            adult_manifestations: ['Прокрастинация', 'Эмоциональное выгорание', 'Синдром самозванца'],
            healing_phrase: 'Я достаточно хорош. Мои ошибки — это опыт.',
            recommended_state: 'love',
            affirmation: 'Я имею право ошибаться'
        },
        emotional_suppression: {
            id: 'emotional_suppression', name: 'Импринт подавления эмоций', icon: '🔇', color: '#9c27b0',
            shortDesc: 'Чувства = слабость',
            description: 'Убеждение, что эмоции — это слабость или что-то постыдное.',
            childhood: 'Вам говорили "не плачь", "не злись", "будь хорошим мальчиком".',
            adult_manifestations: ['Сложность в выражении чувств', 'Психосоматика', 'Эмоциональное онемение'],
            healing_phrase: 'Мои чувства имеют значение. Я разрешаю себе чувствовать.',
            recommended_state: 'joy',
            affirmation: 'Мои эмоции — это моя сила'
        },
        helplessness: {
            id: 'helplessness', name: 'Импринт беспомощности', icon: '🪶', color: '#607d8b',
            shortDesc: 'Я ничего не могу изменить',
            description: 'Убеждение, что вы не можете влиять на свою жизнь.',
            childhood: 'Попытки что-то изменить не приводили к результату.',
            adult_manifestations: ['Жертвенная позиция', 'Отсутствие инициативы', 'Депрессия'],
            healing_phrase: 'Я могу влиять на свою жизнь. Мои действия имеют значение.',
            recommended_state: 'action',
            affirmation: 'Я создаю свою реальность'
        },
        unworthiness: {
            id: 'unworthiness', name: 'Импринт недостойности', icon: '💔', color: '#e91e63',
            shortDesc: 'Я недостаточно хорош',
            description: 'Убеждение, что вы недостаточно хороши, умны, красивы.',
            childhood: 'Вас сравнивали с другими не в вашу пользу.',
            adult_manifestations: ['Низкая самооценка', 'Трудности с принятием комплиментов', 'Синдром самозванца'],
            healing_phrase: 'Я ценен независимо от достижений. Я уже достаточно хорош.',
            recommended_state: 'love',
            affirmation: 'Я ценен просто потому, что я есть'
        },
        control: {
            id: 'control', name: 'Импринт контроля', icon: '🎮', color: '#00bcd4',
            shortDesc: 'Всё должно быть под контролем',
            description: 'Убеждение, что нужно контролировать всё вокруг.',
            childhood: 'В детстве было много хаоса. Контроль был способом выжить.',
            adult_manifestations: ['Микроменеджмент', 'Трудности с делегированием', 'Тревога при потере контроля'],
            healing_phrase: 'Я отпускаю контроль. Жизнь течёт, и это безопасно.',
            recommended_state: 'calm',
            affirmation: 'Я доверяю жизни'
        }
    },

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
let isGuidedMode = false;
let guidedAudio = null;

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
// ГЕНЕРАЦИЯ PDF ИНСТРУКЦИИ
// ============================================

async function generateInstructionPDF(anchor) {
    const state = ANCHORS_CONFIG.states[anchor.state];
    const userName = localStorage.getItem('fredi_user_name') || 'Пользователь';
    const today = new Date().toLocaleDateString('ru-RU');
    
    // Получаем рекомендации по стимулам
    let stimuliHtml = '';
    if (anchor.recommended_stimuli) {
        try {
            const stimuli = JSON.parse(anchor.recommended_stimuli);
            stimuliHtml = stimuli.map(s => {
                const stimulus = Object.values(ANCHORS_CONFIG.physical_stimuli).find(p => p.name === s);
                if (stimulus) {
                    return `
                        <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                            <strong>${stimulus.icon} ${stimulus.name}</strong><br>
                            <span style="color: #666; font-size: 12px;">${stimulus.howToUse}</span><br>
                            <span style="color: #999; font-size: 11px;">💰 ${stimulus.price} · 🛒 ${stimulus.whereToBuy}</span>
                        </div>
                    `;
                }
                return `<div style="margin-bottom: 10px;">🔧 ${s}</div>`;
            }).join('');
        } catch(e) {}
    }
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Инструкция: ${anchor.name}</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid ${state?.color || '#ff6b3b'}; }
                .header-icon { font-size: 64px; display: block; margin-bottom: 10px; }
                .header-title { font-size: 28px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; margin-bottom: 5px; }
                .header-subtitle { color: #666; font-size: 14px; }
                .section { margin-bottom: 25px; }
                .section-title { font-size: 18px; font-weight: bold; color: ${state?.color || '#333'}; margin-bottom: 10px; border-left: 3px solid ${state?.color || '#ff6b3b'}; padding-left: 12px; }
                .step { margin-bottom: 12px; }
                .step-num { display: inline-block; width: 28px; height: 28px; background: ${state?.color || '#ff6b3b'}; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }
                .trigger-box { background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0; }
                .trigger-text { font-size: 24px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; font-family: monospace; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
                .qr-code { text-align: center; margin: 20px 0; }
                .qr-placeholder { width: 120px; height: 120px; background: #f0f0f0; margin: 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
                .affirmation { font-style: italic; color: ${state?.color || '#ff6b3b'}; text-align: center; margin: 20px 0; font-size: 18px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-icon">${state?.icon || '⚓'}</div>
                <div class="header-title">${_anEscapeHtml(anchor.name)}</div>
                <div class="header-subtitle">Персональная инструкция для ${_anEscapeHtml(userName)}</div>
                <div class="header-subtitle">Создано: ${today}</div>
            </div>
            
            <div class="affirmation">«${state?.affirmation || anchor.phrase || 'Я спокоен и уверен'}»</div>
            
            <div class="section">
                <div class="section-title">🎯 ВАШ ТРИГГЕР</div>
                <div class="trigger-box">
                    <div class="trigger-text">«${_anEscapeHtml(anchor.trigger || anchor.phrase)}»</div>
                    <div style="margin-top: 8px; font-size: 12px;">${ANCHORS_CONFIG.modalities[anchor.modality]?.name || 'Аудиальный'} якорь</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">📋 ПОШАГОВАЯ ИНСТРУКЦИЯ</div>
                ${anchor.instruction_steps ? (() => {
                    try {
                        const steps = JSON.parse(anchor.instruction_steps);
                        return steps.map((step, i) => `
                            <div class="step">
                                <span class="step-num">${i+1}</span>
                                <span>${step}</span>
                            </div>
                        `).join('');
                    } catch(e) { return ''; }
                })() : `
                    <div class="step"><span class="step-num">1</span> Найдите спокойное место, где вас никто не побеспокоит</div>
                    <div class="step"><span class="step-num">2</span> Вспомните ситуацию, когда вы чувствовали ${state?.name.toLowerCase()}</div>
                    <div class="step"><span class="step-num">3</span> Доведите это ощущение до пика (30-60 секунд)</div>
                    <div class="step"><span class="step-num">4</span> В момент пика скажите/сделайте: <strong>«${anchor.trigger || anchor.phrase}»</strong></div>
                    <div class="step"><span class="step-num">5</span> Сбросьте состояние (встаньте, отвлекитесь)</div>
                    <div class="step"><span class="step-num">6</span> Повторите шаги 2-5 ещё 4-5 раз для закрепления</div>
                `}
            </div>
            
            ${stimuliHtml ? `
            <div class="section">
                <div class="section-title">🔧 РЕКОМЕНДУЕМЫЕ СТИМУЛЫ</div>
                ${stimuliHtml}
            </div>
            ` : ''}
            
            <div class="section">
                <div class="section-title">⚡ СОВЕТ ДЛЯ ЗАКРЕПЛЕНИЯ</div>
                <p>Практикуйте активацию якоря ежедневно в течение 21 дня. Чем чаще вы используете триггер, тем быстрее состояние становится автоматическим.</p>
                <p><strong>Лучшее время для практики:</strong> утром после пробуждения и вечером перед сном.</p>
            </div>
            
            <div class="footer">
                <p>Сгенерировано Фреди — вашим виртуальным психологом</p>
                <p>Фреди помогает создавать ресурсные состояния и менять жизнь к лучшему</p>
            </div>
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
    
    _anShowToast('📄 Инструкция скачана! Откройте в браузере и сохраните как PDF', 'success');
}

// ============================================
// GUIDED-АКТИВАЦИЯ ЯКОРЯ (ВАУ-ЭФФЕКТ!)
// ============================================

async function startGuidedActivation(anchor) {
    const state = ANCHORS_CONFIG.states[anchor.state];
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    isGuidedMode = true;
    
    // Показываем красивый интерфейс guided-медитации
    container.innerHTML = `
        <div class="full-content-page" style="background: radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%);">
            <button class="back-btn" id="guidedBackBtn" style="position: absolute; top: 20px; left: 20px; z-index: 10;">◀️ ВЫХОД</button>
            
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; padding: 20px;">
                <div class="guided-icon" style="font-size: 80px; margin-bottom: 20px; animation: pulse 1.5s infinite;">${state?.icon || '⚓'}</div>
                
                <div style="font-size: 28px; font-weight: bold; color: ${state?.color || '#ff6b3b'}; margin-bottom: 10px; text-align: center;">
                    ${anchor.name}
                </div>
                
                <div style="font-size: 16px; color: var(--text-secondary); margin-bottom: 30px; text-align: center;">
                    Guided-активация • 3 минуты
                </div>
                
                <div class="breathing-circle" style="width: 200px; height: 200px; border-radius: 50%; background: ${state?.color || '#ff6b3b'}20; border: 2px solid ${state?.color || '#ff6b3b'}; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; transition: all 0.1s ease;">
                    <div style="font-size: 48px;">${state?.icon || '⚓'}</div>
                </div>
                
                <div id="guidedStep" style="font-size: 18px; font-weight: 500; color: white; text-align: center; margin-bottom: 15px;">
                    🧘 Сядьте удобно, закройте глаза
                </div>
                
                <div id="guidedTimer" style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">
                    Шаг 1 из 6
                </div>
                
                <div class="progress-bar" style="width: 80%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div id="guidedProgress" style="width: 0%; height: 100%; background: ${state?.color || '#ff6b3b'}; transition: width 0.3s;"></div>
                </div>
                
                <div id="guidedAffirmation" style="font-size: 20px; font-weight: 300; color: ${state?.color || '#ff6b3b'}; margin-top: 30px; text-align: center; font-style: italic; opacity: 0.8;">
                    «${state?.affirmation || anchor.phrase || 'Я спокоен и уверен'}»
                </div>
            </div>
        </div>
        
        <style>
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            @keyframes breathe {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            .breathing-circle {
                animation: breathe 8s ease-in-out infinite;
            }
        </style>
    `;
    
    document.getElementById('guidedBackBtn').onclick = () => {
        isGuidedMode = false;
        if (guidedAudio) guidedAudio.pause();
        showAnchorsScreen();
    };
    
    // Guided-шаги
    const steps = [
        { text: '🧘 Сядьте удобно, закройте глаза', duration: 5000, subtext: 'Почувствуйте опору под собой' },
        { text: '🌬️ Сделайте глубокий вдох... и медленный выдох', duration: 8000, subtext: 'Вдох — 4 секунды, выдох — 6 секунд' },
        { text: '💭 Вспомните момент, когда вы чувствовали себя ${state?.name.toLowerCase()}', duration: 10000, subtext: 'Представьте эту ситуацию в деталях' },
        { text: `🔊 Скажите про себя: «${anchor.trigger || anchor.phrase}»`, duration: 5000, subtext: 'Почувствуйте, как состояние усиливается' },
        { text: '🔄 Повторите триггер ещё 3 раза', duration: 8000, subtext: 'С каждым разом состояние становится ярче' },
        { text: '✨ Откройте глаза. Ваш якорь активирован!', duration: 4000, subtext: 'Теперь вы можете использовать его в любой момент' }
    ];
    
    let currentStep = 0;
    const stepDiv = document.getElementById('guidedStep');
    const timerDiv = document.getElementById('guidedTimer');
    const progressDiv = document.getElementById('guidedProgress');
    const affirmationDiv = document.getElementById('guidedAffirmation');
    
    function playStep() {
        if (currentStep >= steps.length || !isGuidedMode) {
            // Завершение
            if (typeof showToast === 'function') {
                showToast('✅ Якорь активирован! Теперь вы можете использовать его в любой момент', 'success');
            }
            _anPlayBeep();
            setTimeout(() => showAnchorsScreen(), 2000);
            return;
        }
        
        const step = steps[currentStep];
        stepDiv.innerHTML = step.text;
        timerDiv.innerHTML = `Шаг ${currentStep + 1} из ${steps.length}`;
        progressDiv.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
        
        // Озвучиваем шаг
        if (window.voiceManager) {
            const cleanText = step.text.replace(/[🔊🧘🌬️💭🔄✨]/g, '');
            window.voiceManager.textToSpeech(cleanText, 'psychologist');
        }
        
        // Анимируем аффирмацию
        if (affirmationDiv) {
            affirmationDiv.style.opacity = '0';
            setTimeout(() => {
                affirmationDiv.style.opacity = '0.8';
            }, 300);
        }
        
        currentStep++;
        setTimeout(playStep, step.duration);
    }
    
    // Небольшая задержка перед началом
    setTimeout(playStep, 1000);
}

// ============================================
// СТИЛИ
// ============================================

function _anInjectStyles() {
    if (document.getElementById('an-v3-styles')) return;
    const style = document.createElement('style');
    style.id = 'an-v3-styles';
    style.textContent = `
        .an-tabs {
            display: flex; flex-wrap: wrap; gap: 4px; background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.1); border-radius: 40px; padding: 4px;
            margin-bottom: 20px; overflow-x: auto; scrollbar-width: none;
        }
        .an-tabs::-webkit-scrollbar { display: none; }
        .an-tab {
            flex-shrink: 0; padding: 8px 12px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary); font-size: 11px;
            font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.2s;
            min-height: 36px; white-space: nowrap;
        }
        .an-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }
        
        .anchor-card {
            background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px;
            margin-bottom: 12px; border: 1px solid rgba(224,224,224,0.1);
            transition: all 0.2s; cursor: pointer;
        }
        .anchor-card:hover { background: rgba(224,224,224,0.08); transform: translateX(4px); }
        .anchor-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .anchor-actions { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
        .anchor-btn {
            padding: 8px 16px; border-radius: 30px; border: none; cursor: pointer;
            font-size: 13px; transition: all 0.2s; font-family: inherit;
        }
        .fire-btn {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
        }
        .pdf-btn {
            background: rgba(255,107,59,0.15); border: 1px solid rgba(255,107,59,0.3);
            color: #ff6b3b;
        }
        .delete-btn {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        
        .type-badge {
            font-size: 9px; padding: 2px 8px; border-radius: 20px;
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.1);
            color: var(--text-secondary); margin-left: 8px;
        }
        
        .wizard-step { background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px; margin-top: 20px; }
        .wizard-options { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }
        .wizard-option {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s;
        }
        .wizard-option:hover { background: rgba(224,224,224,0.08); border-color: rgba(224,224,224,0.3); }
        
        .stimuli-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px; margin: 16px 0;
        }
        .stimulus-card {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 12px; padding: 12px; text-align: center; cursor: pointer;
            transition: all 0.2s;
        }
        .stimulus-card:hover { background: rgba(224,224,224,0.1); transform: translateY(-2px); }
        .stimulus-card.selected { border-color: #ff6b3b; background: rgba(255,107,59,0.1); }
        .stimulus-icon { font-size: 32px; display: block; margin-bottom: 8px; }
        .stimulus-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .stimulus-desc { font-size: 10px; color: var(--text-secondary); }
        
        .an-progress-bar { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; overflow: hidden; margin: 8px 0; }
        .an-progress-fill { height: 100%; background: linear-gradient(90deg, rgba(224,224,224,0.4), rgba(192,192,192,0.3)); width: 0%; transition: width 0.3s; }
        
        .imprint-card {
            background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px;
            margin-bottom: 12px; cursor: pointer; transition: all 0.2s;
        }
        .imprint-card:hover { background: rgba(224,224,224,0.08); transform: translateX(4px); }
        
        .diagnostic-card { background: rgba(224,224,224,0.05); border-radius: 24px; padding: 32px; margin: 24px 0; text-align: center; }
        .question-counter { font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; }
        .question-text { font-size: 20px; font-weight: 600; margin-bottom: 32px; line-height: 1.4; }
        .answer-options { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .answer-btn {
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 12px 24px; cursor: pointer; font-size: 14px;
            transition: all 0.2s; font-family: inherit; color: var(--text-primary);
        }
        .answer-btn:hover { background: rgba(224,224,224,0.16); border-color: rgba(224,224,224,0.3); transform: scale(1.02); }
        
        .result-card {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px; padding: 24px; margin: 16px 0;
            border-left: 4px solid var(--imprint-color, rgba(224,224,224,0.3));
        }
        .result-icon { font-size: 48px; margin-bottom: 12px; }
        .result-name { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        
        .reimprinting-card { background: rgba(224,224,224,0.05); border-radius: 24px; padding: 32px; margin: 24px 0; }
        .step-title { font-size: 18px; font-weight: 600; margin-bottom: 24px; }
        .reimprinting-textarea {
            width: 100%; padding: 16px; border-radius: 16px; background: rgba(224,224,224,0.05);
            border: 1px solid rgba(224,224,224,0.2); color: var(--text-primary);
            font-family: inherit; font-size: 14px; min-height: 120px; resize: vertical;
            box-sizing: border-box;
        }
        .an-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); padding: 14px 24px; border-radius: 40px;
            color: var(--text-primary); font-weight: 600; cursor: pointer; width: 100%;
            margin-top: 16px; font-family: inherit; font-size: 13px;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
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
        
        // Используем русские буквы: СБ, ТФ, УБ, ЧВ
        if (vectors.СБ !== undefined && vectors.СБ < 3) {
            recommendations.push({
                state: 'action',
                name: 'Импульс действия',
                trigger: 'хлопок в ладоши',
                phrase: 'Раз! И я начинаю.',
                reason: `Ваш вектор СБ = ${vectors.СБ}/6 — нуждается в поддержке`,
                stimuli: ['pen', 'keychain']
            });
        }
        if (vectors.ТФ !== undefined && vectors.ТФ < 3) {
            recommendations.push({
                state: 'grounding',
                name: 'Заземление',
                trigger: 'стопы в пол',
                phrase: 'Я здесь. Моё тело — моя опора.',
                reason: `Ваш вектор ТФ = ${vectors.ТФ}/6 — нуждается в заземлении`,
                stimuli: ['crystal', 'teaCup']
            });
        }
        if (vectors.УБ !== undefined && vectors.УБ < 3) {
            recommendations.push({
                state: 'calm',
                name: 'Гибкость',
                trigger: 'пожать плечами',
                phrase: 'Можно и так.',
                reason: `Ваш вектор УБ = ${vectors.УБ}/6 — нуждается в расслаблении`,
                stimuli: ['stressBall', 'teaCup']
            });
        }
        if (vectors.ЧВ !== undefined && vectors.ЧВ < 3) {
            recommendations.push({
                state: 'joy',
                name: 'Тепло',
                trigger: 'рука на сердце',
                phrase: 'Я чувствую. Я живу.',
                reason: `Ваш вектор ЧВ = ${vectors.ЧВ}/6 — нуждается в тепле`,
                stimuli: ['perfume', 'ring']
            });
        }
        
        return recommendations;
    } catch (e) {
        console.warn('Failed to get recommendations:', e);
        return [];
    }
}
// ============================================
// ДИАГНОСТИКА ИМПРИНТОВ (ИСПРАВЛЕНА)
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
            <div class="an-progress-bar"><div class="an-progress-fill" style="width: ${progress}%"></div></div>
            <div class="diagnostic-card">
                <div class="question-counter">Вопрос ${index + 1} из ${questions.length}</div>
                <div class="question-text">${_anEscapeHtml(question.text)}</div>
                <div class="answer-options">
                    <button class="answer-btn" data-value="0">❌ Совсем нет</button>
                    <button class="answer-btn" data-value="1">🤔 Иногда</button>
                    <button class="answer-btn" data-value="2">😐 Часто</button>
                    <button class="answer-btn" data-value="3">✅ Очень точно</button>
                </div>
            </div>
            <div class="diagnostic-note">💡 Честные ответы помогут точнее определить ваши глубинные программы</div>
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
            // ИСПРАВЛЕНО: сохраняем raw value и вес отдельно
            diagnosticAnswers[index] = { 
                question: question.text, 
                imprint: question.imprint, 
                weight: question.weight, 
                value: value  // raw 0-3, без умножения!
            };
            showDiagnosticQuestion(index + 1);
        });
    });
}

function finishDiagnostic() {
    const scores = {};
    for (const [type] of Object.entries(IMPRINTS_CONFIG.types)) {
        scores[type] = 0;
    }
    
    let maxPossibleScore = 0;
    
    for (let i = 0; i < IMPRINTS_CONFIG.questions.length; i++) {
        const answer = diagnosticAnswers[i];
        if (answer && answer.imprint) {
            // ИСПРАВЛЕНО: умножаем weight ТОЛЬКО здесь, один раз
            scores[answer.imprint] += answer.value * answer.weight;
            maxPossibleScore += 3 * answer.weight;
        }
    }
    
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
        config: IMPRINTS_CONFIG.types[dominantImprint],
        maxPossibleScore: maxPossibleScore
    };
    
    showDiagnosticResult();
}

function showDiagnosticResult() {
    const result = diagnosticResult;
    const imprint = result.config;
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
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
            <div class="healing-box" style="background: rgba(76,175,80,0.1); border-radius: 16px; padding: 16px; margin: 16px 0;">
                <div style="font-weight: 700; margin-bottom: 8px;">🌱 Исцеляющая фраза</div>
                <div style="font-size: 18px; font-style: italic;">«${imprint.healing_phrase}»</div>
                <button class="action-btn" id="saveHealingPhraseBtn" style="margin-top: 12px; padding: 10px 20px; background: #4caf50; border: none; border-radius: 30px; color: white; cursor: pointer;">💾 Сохранить как инструкцию</button>
            </div>
            <div class="manifestations-list" style="background: rgba(224,224,224,0.03); border-radius: 16px; padding: 16px; margin: 16px 0;">
                <div style="font-weight: 700; margin-bottom: 8px;">📌 Как это проявляется во взрослой жизни:</div>
                <ul style="margin-left: 20px;">${imprint.adult_manifestations.map(m => `<li style="margin: 8px 0;">${_anEscapeHtml(m)}</li>`).join('')}</ul>
            </div>
            <div style="background: rgba(33,150,243,0.1); border-radius: 16px; padding: 16px; margin: 16px 0;">
                <div style="font-weight: 700; margin-bottom: 8px;">👶 Откуда это взялось:</div>
                <div style="color: var(--text-secondary);">${imprint.childhood}</div>
            </div>
            <div class="result-card" style="background: rgba(255,193,7,0.1);">
                <div style="font-weight: 700; margin-bottom: 8px;">🔑 Рекомендуемое состояние</div>
                <div>${ANCHORS_CONFIG.states[imprint.recommended_state]?.name || imprint.recommended_anchor || 'Безопасность'}</div>
                <button class="action-btn" id="createRecommendedAnchorBtn" style="margin-top: 12px; padding: 10px 20px; background: #ff9800; border: none; border-radius: 30px; color: white; cursor: pointer;">➕ Создать инструкцию</button>
            </div>
            <div class="result-card">
                <div style="font-weight: 700; margin-bottom: 12px;">📈 Все импринты (по степени выраженности)</div>
                ${sortedScores.map(s => {
                    const percent = result.maxPossibleScore > 0 ? Math.round((s.score / result.maxPossibleScore) * 100) : 0;
                    return `
                    <div style="margin: 12px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>${s.config.icon} ${s.config.name}</span>
                            <span>${percent}%</span>
                        </div>
                        <div class="an-progress-bar" style="height: 6px;">
                            <div class="an-progress-fill" style="width: ${percent}%; background: ${s.config.color};"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap;">
                <button class="action-btn" id="startReimprintingBtn" style="padding: 12px 24px; background: #9c27b0; border: none; border-radius: 30px; color: white; cursor: pointer;">🔄 Начать реимпринтинг</button>
                <button class="action-btn" id="saveResultsBtn" style="padding: 12px 24px; background: #607d8b; border: none; border-radius: 30px; color: white; cursor: pointer;">💾 Сохранить результаты</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => showAnchorsScreen();
    
    document.getElementById('saveHealingPhraseBtn')?.addEventListener('click', async () => {
        const anchorData = {
            name: `Исцеление: ${imprint.name}`,
            state: imprint.recommended_state || 'love',
            source: 'imprint',
            source_detail: imprint.healing_phrase,
            modality: 'auditory',
            trigger: imprint.healing_phrase,
            phrase: imprint.healing_phrase,
            icon: imprint.icon,
            state_icon: '💖',
            state_name: 'Исцеление',
            instruction_steps: JSON.stringify([
                'Сядьте удобно, закройте глаза',
                'Сделайте 3 глубоких вдоха',
                'Повторите про себя исцеляющую фразу: "' + imprint.healing_phrase + '"',
                'Почувствуйте, как тепло разливается по телу',
                'Откройте глаза и улыбнитесь'
            ]),
            recommended_stimuli: JSON.stringify(['teaCup', 'crystal'])
        };
        const success = await saveAnchor(anchorData);
        if (success) {
            _anShowToast('✅ Исцеляющая фраза сохранена как инструкция!', 'success');
            await loadUserAnchors();
        } else {
            _anShowToast('❌ Ошибка сохранения', 'error');
        }
    });
    
    document.getElementById('createRecommendedAnchorBtn')?.addEventListener('click', async () => {
        anchorWizardData = {
            state: imprint.recommended_state || 'safety',
            source: 'own',
            source_detail: imprint.recommended_anchor || 'Безопасность',
            modality: 'auditory',
            trigger: imprint.healing_phrase,
            name: imprint.recommended_anchor || 'Безопасность в себе'
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
        _anShowToast('✅ Результаты сохранены', 'success');
    });
}

// ============================================
// РЕИМПРИНТИНГ
// ============================================

function startReimprinting() {
    reimprintingStep = 1;
    if (!reimprintingData.situation) {
        reimprintingData = { situation: '', decision: '', newMessage: '', newAnchor: '' };
    }
    showReimprintingScreen();
}

function showReimprintingScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const steps = {
        1: { title: 'Шаг 1 из 5: Найдите ситуацию', icon: '🔍',
            content: `<textarea id="situation" placeholder="Например: «Меня наказали за ошибку, и я решил, что ошибаться нельзя»" class="reimprinting-textarea">${_anEscapeHtml(reimprintingData.situation || '')}</textarea>
                      <div class="step-hint">💡 Вспомните конкретный момент. Кто был рядом? Что вы чувствовали?</div>` },
        2: { title: 'Шаг 2 из 5: Распознайте решение', icon: '💭',
            content: `<textarea id="decision" placeholder="Например: «Я решил, что должен быть идеальным, чтобы меня любили»" class="reimprinting-textarea">${_anEscapeHtml(reimprintingData.decision || '')}</textarea>
                      <div class="step-hint">💡 Это было лучшее решение, которое вы могли принять в той ситуации.</div>` },
        3: { title: 'Шаг 3 из 5: Войдите в ресурс', icon: '🧘',
            content: `<div class="step-instruction"><p>Сделайте глубокий вдох... Почувствуйте свою силу...</p><p>Вы прошли через многое. У вас есть опыт, знания, мудрость.</p></div>
                      <button class="an-btn-primary" id="enterResourceBtn">✅ Я вошёл в ресурсное состояние</button>` },
        4: { title: 'Шаг 4 из 5: Перепишите импринт', icon: '💌',
            content: `<textarea id="newMessage" placeholder="Напишите новое послание себе-ребёнку..." class="reimprinting-textarea">${_anEscapeHtml(reimprintingData.newMessage || '')}</textarea>
                      <div class="step-hint">💡 Скажите то, что вам самому нужно было услышать в детстве.</div>` },
        5: { title: 'Шаг 5 из 5: Закрепите якорем', icon: '⚓',
            content: `<input type="text" id="newAnchor" placeholder="Придумайте триггер (жест, фразу)" class="reimprinting-input" value="${_anEscapeHtml(reimprintingData.newAnchor || '')}">
                      <div class="step-hint">💡 Например: рука на сердце + «Я имею право ошибаться»</div>
                      <button class="an-btn-primary" id="completeReimprintingBtn">✅ Завершить и сохранить инструкцию</button>` }
    };
    
    const currentStep = steps[reimprintingStep];
    const progress = (reimprintingStep / 5) * 100;
    
    _anInjectStyles();
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header"><div class="content-emoji">🔄</div><h1 class="content-title">Реимпринтинг</h1></div>
            <div class="an-progress-bar"><div class="an-progress-fill" style="width: ${progress}%"></div></div>
            <div class="reimprinting-card">
                <div class="step-title">${currentStep.title}</div>
                <div class="step-icon" style="font-size: 48px; text-align: center;">${currentStep.icon}</div>
                ${currentStep.content}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => {
        if (reimprintingStep > 1) { reimprintingStep--; showReimprintingScreen(); }
        else showAnchorsScreen();
    };
    
    if (reimprintingStep === 3) {
        document.getElementById('enterResourceBtn')?.addEventListener('click', () => {
            reimprintingStep++; showReimprintingScreen();
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
                state_name: 'Реимпринтинг',
                instruction_steps: JSON.stringify([
                    'Сядьте удобно, закройте глаза',
                    'Вспомните ситуацию из детства, которая повлияла на вас',
                    'Представьте себя взрослым, мудрым, ресурсным',
                    'Скажите себе-ребёнку новое поддерживающее послание',
                    'Сделайте триггер: ' + (newAnchor || 'рука на сердце'),
                    'Повторите 3-5 раз для закрепления'
                ])
            };
            
            const success = await saveAnchor(anchorToSave);
            if (success) {
                _anShowToast('✅ Импринт переписан! Новая инструкция создана.', 'success');
                reimprintingStep = 0;
                reimprintingData = {};
                showAnchorsScreen();
            } else {
                _anShowToast('❌ Ошибка сохранения', 'error');
            }
        });
    } else {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'an-btn-primary';
        nextBtn.textContent = 'Далее →';
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
        const containerContent = document.querySelector('.reimprinting-card');
        if (containerContent && reimprintingStep !== 3) {
            containerContent.appendChild(nextBtn);
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
            <div id="anBody">${renderCurrentView(currentAnchorView, { recommendations, userAnchors })}</div>
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
                <div style="font-size: 64px; margin-bottom: 16px;">📚</div>
                <h3>У вас пока нет инструкций</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Создайте первую инструкцию — и вы сможете вызывать нужное состояние в любой момент</p>
                <button class="an-tab active" data-view="create" style="padding: 12px 24px;">➕ Создать инструкцию</button>
            </div>
        `;
    }
    
    const stats = [
        { count: anchors.length, label: 'всего' },
        { count: anchors.filter(a => a.uses > 0).length, label: 'использовано' }
    ];
    
    return `
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            ${stats.map(s => `
                <div style="background: rgba(224,224,224,0.05); border-radius: 12px; padding: 10px 16px; flex: 1; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700;">${s.count}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${s.label}</div>
                </div>
            `).join('')}
        </div>
        ${anchors.map(anchor => {
            const state = ANCHORS_CONFIG.states[anchor.state];
            const hasSteps = anchor.instruction_steps && anchor.instruction_steps !== '[]';
            return `
            <div class="anchor-card" data-id="${anchor.id}" onclick="showInstructionDetail('${anchor.id}')">
                <div class="anchor-name">
                    <span>${anchor.icon || state?.icon || '📝'}</span>
                    <span>${_anEscapeHtml(anchor.name)}</span>
                    <span class="type-badge">${hasSteps ? '📝 Инструкция' : '📄 Заметка'}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin: 4px 0;">
                    ${state?.name || anchor.state} · ${ANCHORS_CONFIG.modalities[anchor.modality]?.name || anchor.modality || 'аудиальный'}
                </div>
                ${anchor.trigger ? `<div style="font-size: 11px; color: var(--chrome); margin: 4px 0;">🔊 Триггер: «${_anEscapeHtml(anchor.trigger)}»</div>` : ''}
                <div class="anchor-actions" onclick="event.stopPropagation()">
                    <button class="anchor-btn fire-btn" onclick="startGuidedActivationFromAnchor('${anchor.id}')">🎧 Guided-активация</button>
                    <button class="anchor-btn pdf-btn" onclick="exportInstructionToPDF('${anchor.id}')">📄 PDF</button>
                    <button class="anchor-btn delete-btn" onclick="deleteAnchorConfirm('${anchor.id}')">🗑️</button>
                </div>
                ${anchor.uses ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px;">✅ использовано ${anchor.uses} раз</div>` : ''}
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
    let stimuli = [];
    try { stimuli = JSON.parse(anchor.recommended_stimuli || '[]'); } catch(e) {}
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    _anInjectStyles();
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="instrBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${anchor.icon || state?.icon || '📝'}</div>
                <h1 class="content-title">${_anEscapeHtml(anchor.name)}</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">${state?.name || anchor.state} · ${anchor.trigger || 'без триггера'}</p>
            </div>
            
            ${steps.length ? `
            <div style="background: rgba(224,224,224,0.04); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                <h3 style="margin-bottom: 12px;">📝 Пошаговая инструкция</h3>
                <ol style="margin-left: 20px; line-height: 1.8;">
                    ${steps.map(s => `<li>${_anEscapeHtml(s)}</li>`).join('')}
                </ol>
            </div>` : ''}
            
            ${stimuli.length ? `
            <div style="background: rgba(224,224,224,0.04); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                <h3 style="margin-bottom: 12px;">🔧 Рекомендуемые стимулы</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${stimuli.map(s => {
                        const stimulus = ANCHORS_CONFIG.physical_stimuli[s];
                        if (stimulus) {
                            return `<div style="background: rgba(224,224,224,0.06); border-radius: 12px; padding: 12px; flex: 1; min-width: 150px;">
                                <div style="font-size: 24px;">${stimulus.icon}</div>
                                <div style="font-weight: 600; margin: 8px 0 4px;">${stimulus.name}</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${stimulus.howToUse.substring(0, 80)}...</div>
                            </div>`;
                        }
                        return `<div style="background: rgba(224,224,224,0.06); border-radius: 12px; padding: 12px;">🔧 ${_anEscapeHtml(s)}</div>`;
                    }).join('')}
                </div>
            </div>` : ''}
            
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="anchor-btn fire-btn" style="flex: 1;" onclick="startGuidedActivationFromAnchor('${anchor.id}')">🎧 Guided-активация</button>
                <button class="anchor-btn pdf-btn" style="flex: 1;" onclick="exportInstructionToPDF('${anchor.id}')">📄 Скачать PDF</button>
                <button class="anchor-btn delete-btn" style="flex: 1;" onclick="deleteAnchorConfirm('${anchor.id}')">🗑️ Удалить</button>
            </div>
        </div>
    `;
    document.getElementById('instrBack').onclick = () => showAnchorsScreen();
}

function exportInstructionToPDF(anchorId) {
    const anchor = userAnchors.find(a => String(a.id) === String(anchorId));
    if (anchor) generateInstructionPDF(anchor);
}

function startGuidedActivationFromAnchor(anchorId) {
    const anchor = userAnchors.find(a => String(a.id) === String(anchorId));
    if (anchor) startGuidedActivation(anchor);
}

function renderAnchorWizard() {
    const step = anchorWizardStep;
    const data = anchorWizardData;
    
    if (step === 0) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание инструкции</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 1 из 5: Какое состояние вы хотите научиться вызывать?</p>
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
                <h3>➕ Создание инструкции</h3>
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
                <h3>➕ Создание инструкции</h3>
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
        // Рекомендации стимулов для вау-эффекта
        const stateKey = data.state;
        let recommendedStimuli = [];
        if (stateKey === 'calm') recommendedStimuli = ['teaCup', 'crystal', 'stressBall'];
        else if (stateKey === 'confidence') recommendedStimuli = ['zippo', 'pen', 'ring'];
        else if (stateKey === 'focus') recommendedStimuli = ['pen', 'crystal', 'stressBall'];
        else if (stateKey === 'energy') recommendedStimuli = ['zippo', 'keychain'];
        else if (stateKey === 'grounding') recommendedStimuli = ['crystal', 'teaCup', 'ring'];
        else recommendedStimuli = ['teaCup', 'stressBall', 'pen'];
        
        const stimuliHtml = recommendedStimuli.map(key => {
            const s = ANCHORS_CONFIG.physical_stimuli[key];
            if (!s) return '';
            return `
                <div class="stimulus-card" data-stimulus="${key}" onclick="toggleStimulus('${key}')">
                    <div class="stimulus-icon">${s.icon}</div>
                    <div class="stimulus-name">${s.name}</div>
                    <div class="stimulus-desc">${s.description.substring(0, 40)}...</div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="wizard-step">
                <h3>➕ Создание инструкции</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 4 из 5: Назовите вашу инструкцию</p>
                <input type="text" id="anchorNameInput" placeholder="Например: «Спокойствие перед выступлением»" value="${_anEscapeHtml(data.name || '')}" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-bottom: 20px;">
                
                <h3 style="margin-top: 20px;">🔧 Рекомендуемые стимулы (для усиления)</h3>
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Выберите физические предметы, которые усилят ваш якорь:</p>
                <div class="stimuli-grid" id="stimuliGrid">
                    ${stimuliHtml}
                </div>
                <input type="text" id="customStimulus" placeholder="Или введите свой стимул..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;">
                
                <div style="background: linear-gradient(135deg, rgba(76,175,80,0.1), rgba(76,175,80,0.05)); border-radius: 12px; padding: 16px; margin: 20px 0;">
                    <p><strong>🎯 Ваш персональный план:</strong></p>
                    <ol style="margin-left: 20px; line-height: 1.8;">
                        <li>Войдите в состояние ${ANCHORS_CONFIG.states[data.state]?.name || data.state}</li>
                        <li>В момент ПИКА состояния — сделайте триггер: <strong>«${data.trigger || '...'}»</strong></li>
                        <li>Сбросьте состояние (отвлекитесь, встаньте)</li>
                        <li>Повторите шаги 1-3 ещё 3-5 раз</li>
                        <li>Проверьте: активируйте триггер — должно приходить состояние</li>
                    </ol>
                </div>
                
                <div class="anchor-actions" style="margin-top: 20px;">
                    <button class="anchor-btn fire-btn" style="flex: 1;" onclick="anchorWizardComplete()">✅ Сохранить инструкцию</button>
                    <button class="anchor-btn delete-btn" style="flex: 1;" onclick="anchorWizardReset()">↺ Начать заново</button>
                </div>
            </div>
        `;
    }
    
    return '<div>Загрузка...</div>';
}

// Глобальная переменная для выбранных стимулов
let selectedStimuli = [];

function toggleStimulus(key) {
    const card = document.querySelector(`.stimulus-card[data-stimulus="${key}"]`);
    if (selectedStimuli.includes(key)) {
        selectedStimuli = selectedStimuli.filter(s => s !== key);
        card?.classList.remove('selected');
    } else {
        selectedStimuli.push(key);
        card?.classList.add('selected');
    }
}

function renderRecommendations(recommendations) {
    if (!recommendations.length) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🎲</div>
                <h3>Нет персональных рекомендаций</h3>
                <p style="color: var(--text-secondary);">Пройдите психологический тест, чтобы получить инструкции под ваш профиль</p>
                <button class="an-tab active" onclick="startTest()" style="padding: 12px 24px; margin-top: 16px;">📊 Пройти тест</button>
            </div>
        `;
    }
    
    return `
        <div style="margin-bottom: 16px;"><p>🎯 На основе вашего психологического профиля:</p></div>
        ${recommendations.map(rec => `
            <div class="recommend-card" style="background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; border-left: 3px solid ${ANCHORS_CONFIG.states[rec.state]?.color || '#ff6b3b'};">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 32px;">${ANCHORS_CONFIG.states[rec.state]?.icon || '⚓'}</span>
                    <div>
                        <div style="font-weight: 700; font-size: 18px;">${rec.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${rec.reason}</div>
                    </div>
                </div>
                <div style="font-size: 14px; margin-bottom: 16px;">💬 Фраза: «${rec.phrase}»</div>
                <button class="anchor-btn fire-btn" onclick="quickCreateAnchor('${rec.state}', '${rec.name.replace(/'/g, "\\'")}', '${rec.trigger.replace(/'/g, "\\'")}', '${rec.phrase.replace(/'/g, "\\'")}')">➕ Создать инструкцию</button>
            </div>
        `).join('')}
    `;
}

function renderTechniques() {
    return `
        <div style="margin-bottom: 20px;"><p>🔧 Продвинутые техники работы с состояниями</p></div>
        ${Object.entries(ANCHORS_CONFIG.techniques).map(([key, tech]) => `
            <div class="imprint-card" onclick="showTechnique('${key}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 32px;">${tech.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 18px;">${tech.name}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${tech.desc}</div>
                        <div style="font-size: 11px; color: var(--chrome); margin-top: 4px;">⏱ ${tech.duration}</div>
                    </div>
                    <span style="font-size: 20px; color: var(--text-secondary);">→</span>
                </div>
            </div>
        `).join('')}
    `;
}

function renderImprints() {
    return `
        <div style="margin-bottom: 20px;"><p>📚 Глубинная работа с импринтами (детскими программами)</p></div>
        <div class="imprint-card" onclick="startImprintDiagnostic()">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">🔍</span>
                <div><div style="font-weight: 700;">Диагностика импринтов</div><div style="font-size: 13px; color: var(--text-secondary);">20 вопросов, 3 минуты</div></div>
            </div>
        </div>
        <div class="imprint-card" onclick="startReimprinting()">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">🔄</span>
                <div><div style="font-weight: 700;">Реимпринтинг</div><div style="font-size: 13px; color: var(--text-secondary);">Перезапись детских программ</div></div>
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
    if (anchorWizardStep > 0 && anchorWizardData.source) {
        return renderAnchorWizard();
    }
    
    const externalSources = ['movie', 'music', 'metaphor', 'body', 'other'];
    
    return `
        <div style="margin-bottom: 16px;">
            <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
                🎬 <strong>Конструктор</strong> — создайте инструкцию из внешнего источника, когда у вас нет собственного опыта нужного состояния.
            </p>
        </div>
        <div class="wizard-options">
            ${externalSources.map(key => {
                const source = ANCHORS_CONFIG.sources[key];
                return `<div class="wizard-option" onclick="constructorSelectSource('${key}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px;">${source.icon}</span>
                        <div>
                            <div style="font-weight: 600;">${source.name}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${source.desc}</div>
                            ${source.requiresFile ? '<div style="font-size: 10px; color: #ff9800; margin-top: 4px;">📁 Требуется файл</div>' : ''}
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        <div id="constructorContent"></div>
        <div style="margin-top:20px;padding:12px;background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.06);border-radius:12px;">
            <p style="font-size:11px;color:var(--text-secondary);line-height:1.6;">
                💡 <strong>Совет:</strong> Если у вас есть собственный опыт нужного состояния — используйте вкладку «Создать» для создания инструкции из вашей памяти.
            </p>
        </div>
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
    
    if (!anchorWizardData.trigger?.trim()) {
        _anShowToast('❌ Не указан триггер', 'error');
        return;
    }
    
    // Собираем выбранные стимулы
    const customStimulus = document.getElementById('customStimulus')?.value.trim();
    if (customStimulus) {
        selectedStimuli.push(customStimulus);
    }
    
    // Генерируем пошаговую инструкцию
    const steps = [
        `Найдите спокойное место, где вас никто не побеспокоит`,
        `Сделайте 3 глубоких вдоха и выдоха`,
        `Вспомните ситуацию, когда вы чувствовали ${ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state}`,
        `Доведите это ощущение до пика (30-60 секунд)`,
        `В момент пика сделайте триггер: "${anchorWizardData.trigger}"`,
        `Сбросьте состояние (встаньте, отвлекитесь)`,
        `Повторите шаги 3-6 ещё 4-5 раз для закрепления`,
        `Проверьте: активируйте триггер — должно приходить состояние`
    ];
    
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
        state_name: ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state,
        instruction_steps: JSON.stringify(steps),
        recommended_stimuli: JSON.stringify(selectedStimuli)
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        _anShowToast('✅ Инструкция успешно создана!', 'success');
        _anPlayBeep();
        anchorWizardStep = 0;
        anchorWizardData = {};
        selectedStimuli = [];
        currentAnchorView = 'list';
        await loadUserAnchors();
        showAnchorsScreen();
    } else {
        _anShowToast('❌ Не удалось сохранить инструкцию', 'error');
    }
};

window.anchorWizardReset = () => {
    anchorWizardStep = 0;
    anchorWizardData = {};
    selectedStimuli = [];
    showAnchorsScreen();
};

window.fireAnchor = async (anchorId, anchorName) => {
    _anShowToast(`🎧 Активирую состояние «${anchorName}»...`, 'info');
    const phrase = await fireAnchorAPI(anchorId, anchorName);
    if (phrase) {
        _anShowToast(`✅ ${phrase}`, 'success');
        if (window.voiceManager) {
            await window.voiceManager.textToSpeech(phrase, window.currentMode || 'psychologist');
        }
    } else {
        _anShowToast('❌ Не удалось активировать', 'error');
    }
    await loadUserAnchors();
    showAnchorsScreen();
};

window.deleteAnchorConfirm = async (anchorId) => {
    if (confirm('Удалить эту инструкцию?')) {
        const success = await deleteAnchor(anchorId);
        if (success) {
            _anShowToast('🗑️ Инструкция удалена', 'success');
            await loadUserAnchors();
            showAnchorsScreen();
        } else {
            _anShowToast('❌ Не удалось удалить', 'error');
        }
    }
};

window.quickCreateAnchor = async (state, name, trigger, phrase) => {
    const steps = [
        `Найдите спокойное место`,
        `Сделайте глубокий вдох`,
        `Вспомните момент, когда вы чувствовали ${ANCHORS_CONFIG.states[state]?.name || state}`,
        `В пике состояния скажите: "${trigger}"`,
        `Повторите 5 раз`
    ];
    
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
        state_name: ANCHORS_CONFIG.states[state]?.name || state,
        instruction_steps: JSON.stringify(steps)
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        _anShowToast('✅ Инструкция создана!', 'success');
        await loadUserAnchors();
        currentAnchorView = 'list';
        showAnchorsScreen();
    } else {
        _anShowToast('❌ Ошибка создания', 'error');
    }
};

window.showTechnique = (techniqueKey) => {
    const techniquesContent = {
        stacking: `<h3>🔗 Накладка якорей</h3><p>Техника соединения двух ресурсных состояний в один мощный якорь.</p><ol style="margin: 16px 0 16px 20px;"><li>Установите якорь на состояние А</li><li>Установите якорь на состояние Б</li><li>Активируйте оба якоря одновременно</li><li>Создайте новый интегрированный якорь</li></ol><p><strong>Когда применять:</strong> Когда нужно усилить состояние.</p>`,
        collapse: `<h3>💥 Коллапс якорей</h3><p>Разрушение негативного якоря через накладку ресурса.</p><ol style="margin: 16px 0 16px 20px;"><li>Установите якорь на негативное состояние</li><li>Установите мощный ресурсный якорь</li><li>Активируйте оба одновременно</li><li>Негатив «схлопывается» ресурсом</li></ol><p><strong>Когда применять:</strong> При негативной реакции на триггер.</p>`,
        chaining: `<h3>⛓️ Цепочка якорей</h3><p>Последовательная активация состояний для достижения сложной цели.</p><ol style="margin: 16px 0 16px 20px;"><li>Состояние А → Якорь А</li><li>Переход к состоянию Б</li><li>Состояние Б → Якорь Б</li><li>И так далее по цепочке</li></ol><p><strong>Когда применять:</strong> Когда нужно пройти через несколько состояний.</p>`,
        reimprinting: `<h3>🔄 Реимпринтинг</h3><p>Перезапись детских программ через ресурсного свидетеля.</p><ol style="margin: 16px 0 16px 20px;"><li>Найти ситуацию из детства</li><li>Распознать решение/импринт</li><li>Войти в ресурсное состояние взрослого</li><li>Дать новое послание себе-ребёнку</li><li>Закрепить новое состояние якорем</li></ol><button class="anchor-btn fire-btn" onclick="startReimprinting()">Начать реимпринтинг</button>`
    };
    
    const container = document.getElementById('screenContainer');
    if (container) {
        _anInjectStyles();
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" onclick="showAnchorsScreen()">◀️ НАЗАД</button>
                <div class="content-header"><div class="content-emoji">🔧</div><h1 class="content-title">${ANCHORS_CONFIG.techniques[techniqueKey]?.name || 'Техника'}</h1></div>
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px;">${techniquesContent[techniqueKey] || '<p>Техника загружается...</p>'}</div>
            </div>
        `;
    }
};

window.constructorSelectSource = (source) => {
    const container = document.getElementById('constructorContent');
    if (!container) return;
    
    const sourcesContent = {
        movie: `<div style="margin-top: 20px;"><h3>🎬 Выберите фильм или сцену</h3><div class="wizard-options"><div class="wizard-option" onclick="constructorUseMovie('gladiator')"><div>🎬 Гладиатор — сцена перед битвой</div><div style="font-size: 12px;">Уверенность, сила, победа</div></div><div class="wizard-option" onclick="constructorUseMovie('amelie')"><div>🎬 Амели — момент радости</div><div style="font-size: 12px;">Радость, лёгкость</div></div><div class="wizard-option" onclick="constructorUseMovie('matrix')"><div>🎬 Матрица — «Я знаю кунг-фу»</div><div style="font-size: 12px;">Фокус, уверенность</div></div></div><input type="text" id="customMovie" placeholder="Или напишите свой фильм..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-top:12px;"><button class="anchor-btn fire-btn" style="margin-top:16px;" onclick="constructorCreateFromMovie()">Использовать этот источник</button></div>`,
        music: `<div style="margin-top: 20px;"><h3>🎵 Выберите музыку</h3><div class="wizard-options"><div class="wizard-option" onclick="constructorUseMusic('hans')"><div>🎵 Hans Zimmer — Time</div><div style="font-size: 12px;">Величие, спокойствие</div></div><div class="wizard-option" onclick="constructorUseMusic('energetic')"><div>🎵 Epic orchestral</div><div style="font-size: 12px;">Энергия, подъём</div></div></div><input type="text" id="customMusic" placeholder="Или напишите свой трек..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-top:12px;"><button class="anchor-btn fire-btn" style="margin-top:16px;" onclick="constructorCreateFromMusic()">Использовать этот источник</button></div>`,
        metaphor: `<div style="margin-top: 20px;"><h3>📖 Выберите метафору</h3><div class="wizard-options"><div class="wizard-option" onclick="constructorUseMetaphor('rock')"><div>🗻 «Я — скала, которую не может сдвинуть ветер»</div><div style="font-size: 12px;">Спокойствие, устойчивость</div></div><div class="wizard-option" onclick="constructorUseMetaphor('ocean')"><div>🌊 «Я — океан, могучий и глубокий»</div><div style="font-size: 12px;">Сила, спокойствие</div></div></div><textarea id="customMetaphor" placeholder="Или напишите свою метафору..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-top:12px;"></textarea><button class="anchor-btn fire-btn" style="margin-top:16px;" onclick="constructorCreateFromMetaphor()">Использовать эту метафору</button></div>`,
        body: `<div style="margin-top: 20px;"><h3>🧘 Телесная практика</h3><div class="wizard-options"><div class="wizard-option" onclick="constructorUseBody('breath')"><div>🌬️ Дыхание: вдох 4 — задержка 4 — выдох 6</div><div style="font-size: 12px;">Спокойствие, расслабление</div></div><div class="wizard-option" onclick="constructorUseBody('posture')"><div>🧍 Поза супермена: руки в боки, плечи назад</div><div style="font-size: 12px;">Уверенность, сила</div></div></div><textarea id="customBody" placeholder="Опишите свою телесную практику..." style="width:100%;padding:12px;border-radius:12px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:white;margin-top:12px;"></textarea><button class="anchor-btn fire-btn" style="margin-top:16px;" onclick="constructorCreateFromBody()">Использовать эту практику</button></div>`
    };
    
    container.innerHTML = sourcesContent[source] || '<p>Выберите источник</p>';
};

window.constructorUseMovie = (movie) => {
    anchorWizardData = { state: 'confidence', source: 'movie', sourceDetail: movie === 'gladiator' ? 'Гладиатор — сцена перед битвой' : (movie === 'amelie' ? 'Амели — момент радости' : 'Матрица — «Я знаю кунг-фу»'), modality: 'visual' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMovie = () => {
    const custom = document.getElementById('customMovie')?.value;
    anchorWizardData = { state: 'confidence', source: 'movie', sourceDetail: custom || 'Фильм по выбору пользователя', modality: 'visual' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseMusic = (music) => {
    anchorWizardData = { state: 'calm', source: 'music', sourceDetail: music === 'hans' ? 'Hans Zimmer — Time' : 'Epic orchestral music', modality: 'auditory' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMusic = () => {
    const custom = document.getElementById('customMusic')?.value;
    anchorWizardData = { state: 'calm', source: 'music', sourceDetail: custom || 'Музыка по выбору пользователя', modality: 'auditory' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseMetaphor = (metaphor) => {
    anchorWizardData = { state: 'calm', source: 'metaphor', sourceDetail: metaphor === 'rock' ? 'Я — скала, которую не может сдвинуть ветер' : 'Я — океан, могучий и глубокий', modality: 'visual' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromMetaphor = () => {
    const custom = document.getElementById('customMetaphor')?.value;
    anchorWizardData = { state: 'calm', source: 'metaphor', sourceDetail: custom || 'Метафора пользователя', modality: 'visual' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorUseBody = (practice) => {
    anchorWizardData = { state: 'calm', source: 'body', sourceDetail: practice === 'breath' ? 'Дыхание: вдох 4 — задержка 4 — выдох 6' : 'Поза супермена: руки в боки, плечи назад', modality: 'kinesthetic' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

window.constructorCreateFromBody = () => {
    const custom = document.getElementById('customBody')?.value;
    anchorWizardData = { state: 'calm', source: 'body', sourceDetail: custom || 'Телесная практика пользователя', modality: 'kinesthetic' };
    anchorWizardStep = 2;
    showAnchorsScreen();
};

// ============================================
// ЭКСПОРТ
// ============================================

window.showAnchorsScreen = showAnchorsScreen;
window.startImprintDiagnostic = startImprintDiagnostic;
window.startReimprinting = startReimprinting;
window.exportInstructionToPDF = exportInstructionToPDF;
window.startGuidedActivationFromAnchor = startGuidedActivationFromAnchor;
window.showInstructionDetail = showInstructionDetail;

console.log('✅ Модуль "Библиотека состояний" загружен (anchors.js v3.0)');
