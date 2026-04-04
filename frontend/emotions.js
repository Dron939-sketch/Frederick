// ============================================
// emotions.js — Работа с чувствами
// Версия 2.0 — три способа (голос, профиль, сам)
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let emotionsState = {
    isLoading: false,
    activeTab: 'voice', // 'voice', 'profile', 'manual'
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    suggestedEmotions: [],
    analysis: null
};

// ============================================
// 2. БАЗА ЭМОЦИЙ (для ручного выбора)
// ============================================
const BASE_EMOTIONS = [
    { id: "anger", emoji: "😠", name: "Гнев", description: "Злость, раздражение, ярость" },
    { id: "sadness", emoji: "😢", name: "Печаль", description: "Грусть, тоска, уныние" },
    { id: "fear", emoji: "😨", name: "Страх", description: "Испуг, паника, ужас" },
    { id: "anxiety", emoji: "😟", name: "Тревога", description: "Беспокойство, напряжение" },
    { id: "guilt", emoji: "😞", name: "Вина", description: "Чувство вины, самообвинение" },
    { id: "shame", emoji: "😳", name: "Стыд", description: "Неловкость, унижение" },
    { id: "loneliness", emoji: "🫂", name: "Одиночество", description: "Покинутость, изоляция" },
    { id: "overwhelm", emoji: "😵", name: "Перегрузка", description: "Усталость, истощение" },
    { id: "jealousy", emoji: "😒", name: "Ревность", description: "Зависть, сравнение" },
    { id: "hopelessness", emoji: "🌑", name: "Безнадёжность", description: "Отчаяние, апатия" }
];

// ============================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else if (window.showToastMessage) window.showToastMessage(message, type);
    else console.log(`[${type}] ${message}`);
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
    else if (typeof window.goToDashboard === 'function') window.goToDashboard();
    else location.reload();
}

// ============================================
// 4. ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ============================================
async function loadUserProfileForEmotions() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        const contextRes = await fetch(`${apiUrl}/api/get-context/${userId}`);
        const contextData = await contextRes.json();
        const context = contextData.context || {};
        
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        emotionsState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        emotionsState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        emotionsState.userGender = context.gender || 'other';
        
        console.log('📊 Данные для работы с эмоциями:', emotionsState.userVectors);
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 5. AI-ПОДБОР ЭМОЦИЙ ПО ПРОФИЛЮ
// ============================================
async function getSuggestedEmotionsByProfile() {
    const v = emotionsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const prompt = `Ты — Фреди, виртуальный психолог. На основе профиля пользователя определи, какие 4 эмоции ему наиболее свойственны.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- СБ (страх конфликтов): ${v.СБ}/6
- ТФ (денежные блоки): ${v.ТФ}/6
- УБ (поиск смысла): ${v.УБ}/6
- ЧВ (отношения): ${v.ЧВ}/6

ДОСТУПНЫЕ ЭМОЦИИ:
- Гнев, Печаль, Страх, Тревога, Вина, Стыд, Одиночество, Перегрузка, Ревность, Безнадёжность

Верни JSON массив из 4 объектов, каждый с полями: id, emoji, name.
Пример: [{"id":"anxiety","emoji":"😟","name":"Тревога"}, ...]

Верни только JSON, без пояснений.`;

    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                prompt: prompt,
                model: 'deepseek',
                max_tokens: 300,
                temperature: 0.5
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            let jsonStr = data.content;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const suggestions = JSON.parse(jsonStr);
            emotionsState.suggestedEmotions = suggestions;
            return suggestions;
        }
    } catch (error) {
        console.error('Error getting suggested emotions:', error);
    }
    
    // Fallback
    return [
        { id: "anxiety", emoji: "😟", name: "Тревога" },
        { id: "sadness", emoji: "😢", name: "Печаль" },
        { id: "guilt", emoji: "😞", name: "Вина" },
        { id: "loneliness", emoji: "🫂", name: "Одиночество" }
    ];
}

// ============================================
// 6. AI-АНАЛИЗ ЭМОЦИИ (общий для всех способов)
// ============================================
async function analyzeEmotion(emotionId, emotionName, customText = null) {
    const v = emotionsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const address = emotionsState.userGender === 'male' ? 'брат' : 
                    emotionsState.userGender === 'female' ? 'сестрёнка' : 'друг';
    
    const customContext = customText ? `\nПользователь описал своё состояние: "${customText}"` : '';
    
    const prompt = `Ты — Фреди, виртуальный психолог. Помоги пользователю справиться с эмоцией.

ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
- Имя: ${emotionsState.userName}
- Обращение: ${address}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Эмоция: ${emotionName}${customContext}

ЗАДАНИЕ:
Создай персонализированный разбор эмоции.

ТРЕБОВАНИЯ К ОТВЕТУ:
1. Формат — JSON строго по схеме ниже
2. Используй обращение "${address}"
3. Будь тёплым, поддерживающим
4. Не используй markdown

СХЕМА ОТВЕТА:
{
    "validation": "Текст, который нормализует эмоцию (1-2 предложения)",
    "explanation": "Почему эта эмоция могла возникнуть (с учётом профиля)",
    "technique": {
        "name": "Название техники",
        "instruction": "Пошаговая инструкция (3-5 шагов)",
        "duration": "время в минутах"
    },
    "affirmation": "Одна поддерживающая фраза"
}

Верни только JSON.`;

    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                prompt: prompt,
                model: 'deepseek',
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            let jsonStr = data.content;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) {
        console.error('Error analyzing emotion:', error);
    }
    
    // Fallback
    return {
        validation: `${address}, ${emotionName.toLowerCase()} — это нормальная человеческая реакция. Ты не один такой.`,
        explanation: "Эта эмоция — сигнал от твоей психики. Она хочет сказать тебе что-то важное.",
        technique: {
            name: "Дыхание 4-7-8",
            instruction: "1. Вдохни на 4 счёта\n2. Задержи дыхание на 7 счётов\n3. Выдохни на 8 счётов\n4. Повтори 4 раза",
            duration: "2 минуты"
        },
        affirmation: "Эта эмоция пришла, чтобы уйти. Я позволяю ей быть и отпускаю."
    };
}

// ============================================
// 7. ОСНОВНОЙ ЭКРАН (ТРИ ВКЛАДКИ)
// ============================================
async function showEmotionsScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForEmotions();
    await getSuggestedEmotionsByProfile();
    
    renderEmotionsMainScreen(container);
}

async function checkTestCompleted() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
        const data = await response.json();
        return data.has_profile === true;
    } catch (e) {
        return false;
    }
}

function renderEmotionsMainScreen(container) {
    const suggestions = emotionsState.suggestedEmotions;
    
    let suggestedHtml = '';
    if (suggestions && suggestions.length > 0) {
        suggestedHtml = `
            <div class="emotions-suggested">
                <div class="emotions-suggested-title">🧠 AI-ПОДБОР ДЛЯ ВАС</div>
                <div class="emotions-suggested-grid">
                    ${suggestions.map(emo => `
                        <div class="emotion-card" data-emotion-id="${emo.id}" data-emotion-name="${emo.name}">
                            <div class="emotion-emoji">${emo.emoji}</div>
                            <div class="emotion-name">${emo.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page" id="emotionsScreen">
            <button class="back-btn" id="emotionsBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">💖</div>
                <h1>Работа с чувствами</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Три способа разобраться в своих эмоциях
                </div>
            </div>
            
            ${suggestedHtml}
            
            <!-- Способ 1: Голос -->
            <div class="emotions-method">
                <div class="emotions-method-header">
                    <span class="emotions-method-icon">🎤</span>
                    <span class="emotions-method-title">По голосу</span>
                </div>
                <div class="emotions-method-desc">
                    Расскажите, что вы чувствуете, и Фреди поможет разобраться
                </div>
                <button id="voiceRecordBtn" class="emotions-voice-btn">
                    🎤 НАЧАТЬ ЗАПИСЬ
                </button>
            </div>
            
            <!-- Способ 2: На основе профиля -->
            <div class="emotions-method">
                <div class="emotions-method-header">
                    <span class="emotions-method-icon">🧠</span>
                    <span class="emotions-method-title">На основе профиля</span>
                </div>
                <div class="emotions-method-desc">
                    Выберите эмоцию, которую хотите проработать
                </div>
                <div class="emotions-profile-grid" id="profileEmotionsGrid">
                    ${BASE_EMOTIONS.slice(0, 8).map(emo => `
                        <div class="emotion-card" data-emotion-id="${emo.id}" data-emotion-name="${emo.name}">
                            <div class="emotion-emoji">${emo.emoji}</div>
                            <div class="emotion-name">${emo.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Способ 3: Указать самому -->
            <div class="emotions-method">
                <div class="emotions-method-header">
                    <span class="emotions-method-icon">✏️</span>
                    <span class="emotions-method-title">Указать самостоятельно</span>
                </div>
                <div class="emotions-method-desc">
                    Напишите словами, что вы чувствуете
                </div>
                <div class="emotions-manual">
                    <textarea id="manualEmotionInput" class="emotions-manual-input" 
                        placeholder="Например: «Меня всё бесит» или «Чувствую пустоту внутри»"
                        rows="2"></textarea>
                    <button id="manualSubmitBtn" class="emotions-manual-btn">
                        🔍 РАЗОБРАТЬ
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addEmotionsStyles();
    
    document.getElementById('emotionsBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.querySelectorAll('.emotion-card').forEach(card => {
        card.addEventListener('click', () => {
            const emotionId = card.dataset.emotionId;
            const emotionName = card.dataset.emotionName;
            handleEmotionSelect(container, emotionId, emotionName);
        });
    });
    
    document.getElementById('voiceRecordBtn')?.addEventListener('click', () => {
        if (window.VoiceManager && window.VoiceManager.startRecording) {
            window.VoiceManager.startRecording((transcript) => {
                handleVoiceEmotion(container, transcript);
            });
        } else {
            showToastMessage('🎤 Голосовой ввод будет доступен в следующей версии', 'info');
            setTimeout(() => {
                handleVoiceEmotion(container, "чувствую тревогу и беспокойство");
            }, 1500);
        }
    });
    
    document.getElementById('manualSubmitBtn')?.addEventListener('click', () => {
        const text = document.getElementById('manualEmotionInput')?.value.trim();
        if (text) {
            handleManualEmotion(container, text);
        } else {
            showToastMessage('📝 Напишите, что вы чувствуете', 'warning');
        }
    });
}

// ============================================
// 8. ОБРАБОТЧИКИ
// ============================================
async function handleEmotionSelect(container, emotionId, emotionName) {
    showEmotionLoading(container, emotionName);
    const analysis = await analyzeEmotion(emotionId, emotionName);
    renderEmotionResult(container, emotionName, analysis);
}

async function handleVoiceEmotion(container, transcript) {
    showEmotionLoading(container, 'распознанной эмоции');
    
    let emotionName = 'эмоция';
    if (transcript.includes('тревог')) emotionName = 'Тревога';
    else if (transcript.includes('груст')) emotionName = 'Печаль';
    else if (transcript.includes('зл') || transcript.includes('бесит')) emotionName = 'Гнев';
    else if (transcript.includes('страх') || transcript.includes('боюсь')) emotionName = 'Страх';
    else if (transcript.includes('вин')) emotionName = 'Вина';
    else if (transcript.includes('одиночеств')) emotionName = 'Одиночество';
    
    const analysis = await analyzeEmotion(emotionName.toLowerCase(), emotionName, transcript);
    renderEmotionResult(container, emotionName, analysis, transcript);
}

async function handleManualEmotion(container, text) {
    showEmotionLoading(container, 'указанной эмоции');
    
    let emotionName = 'эмоция';
    if (text.includes('тревог')) emotionName = 'Тревога';
    else if (text.includes('груст')) emotionName = 'Печаль';
    else if (text.includes('зл') || text.includes('бесит')) emotionName = 'Гнев';
    else if (text.includes('страх') || text.includes('боюсь')) emotionName = 'Страх';
    else if (text.includes('вин')) emotionName = 'Вина';
    else if (text.includes('одиночеств')) emotionName = 'Одиночество';
    else if (text.includes('стыд')) emotionName = 'Стыд';
    
    const analysis = await analyzeEmotion(emotionName.toLowerCase(), emotionName, text);
    renderEmotionResult(container, emotionName, analysis, text);
}

// ============================================
// 9. ЭКРАН РЕЗУЛЬТАТА
// ============================================
function showEmotionLoading(container, emotionDesc) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="loadingBackBtn">◀️ НАЗАД</button>
            <div class="emotions-loading">
                <div class="emotions-loading-spinner">💖</div>
                <div class="emotions-loading-text">Фреди анализирует ${emotionDesc}...</div>
                <div class="emotions-loading-sub">Это займёт 15-20 секунд</div>
            </div>
        </div>
    `;
    document.getElementById('loadingBackBtn')?.addEventListener('click', () => showEmotionsScreen());
}

function renderEmotionResult(container, emotionName, analysis, userText = null) {
    const technique = analysis.technique || {};
    
    let userTextHtml = '';
    if (userText) {
        userTextHtml = `
            <div class="emotion-user-text">
                <div class="emotion-user-text-label">Вы сказали:</div>
                <div class="emotion-user-text-value">"${escapeHtml(userText)}"</div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="resultBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">💖</div>
                <h1>${emotionName}</h1>
            </div>
            ${userTextHtml}
            <div class="emotion-result-card">
                <div class="emotion-validation">
                    <span class="emotion-validation-icon">💭</span>
                    <div class="emotion-validation-text">${analysis.validation || ''}</div>
                </div>
                <div class="emotion-explanation">
                    <div class="emotion-explanation-title">🔍 Почему это возникает</div>
                    <div class="emotion-explanation-text">${analysis.explanation || ''}</div>
                </div>
                <div class="emotion-technique">
                    <div class="emotion-technique-title">🛠️ ${technique.name || 'Техника'}</div>
                    <div class="emotion-technique-duration">⏱️ ${technique.duration || '2-3 минуты'}</div>
                    <div class="emotion-technique-instruction">
                        ${formatInstruction(technique.instruction || '')}
                    </div>
                </div>
                <div class="emotion-affirmation">
                    <div class="emotion-affirmation-icon">✨</div>
                    <div class="emotion-affirmation-text">${analysis.affirmation || ''}</div>
                    <button class="emotion-copy-btn" data-text="${escapeHtml(analysis.affirmation || '')}">📋</button>
                </div>
            </div>
            <div class="emotion-actions">
                <button id="anotherEmotionBtn" class="emotion-another-btn">🔄 ДРУГАЯ ЭМОЦИЯ</button>
                <button id="shareResultBtn" class="emotion-share-btn">📤 ПОДЕЛИТЬСЯ</button>
            </div>
        </div>
    `;
    
    document.getElementById('resultBackBtn')?.addEventListener('click', () => showEmotionsScreen());
    document.getElementById('anotherEmotionBtn')?.addEventListener('click', () => showEmotionsScreen());
    document.getElementById('shareResultBtn')?.addEventListener('click', () => {
        const text = `${analysis.validation}\n\n${analysis.affirmation}`;
        if (navigator.share) {
            navigator.share({ title: 'Фреди: работа с эмоциями', text: text });
        } else {
            navigator.clipboard.writeText(text);
            showToastMessage('📋 Результат скопирован', 'success');
        }
    });
    document.querySelector('.emotion-copy-btn')?.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.text;
        if (text) {
            navigator.clipboard.writeText(text);
            showToastMessage('📋 Аффирмация скопирована', 'success');
        }
    });
}

// ============================================
// 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function formatInstruction(instruction) {
    if (!instruction) return '';
    let formatted = instruction.replace(/\n/g, '<br>');
    formatted = formatted.replace(/(\d+\.)/g, '<strong>$1</strong>');
    return `<div class="emotion-instruction-content">${formatted}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 11. СТИЛИ
// ============================================
function addEmotionsStyles() {
    if (document.getElementById('emotions-styles')) return;
    const style = document.createElement('style');
    style.id = 'emotions-styles';
    style.textContent = `
        .emotions-suggested { margin-bottom: 24px; }
        .emotions-suggested-title { font-size: 12px; font-weight: 600; color: var(--chrome); margin-bottom: 12px; }
        .emotions-suggested-grid, .emotions-profile-grid {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
        }
        .emotion-card {
            background: rgba(224,224,224,0.08); border-radius: 16px; padding: 12px;
            text-align: center; cursor: pointer; transition: all 0.2s;
            border: 1px solid transparent;
        }
        .emotion-card:hover { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.3); transform: translateY(-2px); }
        .emotion-emoji { font-size: 28px; margin-bottom: 6px; }
        .emotion-name { font-size: 12px; font-weight: 500; }
        .emotions-method { background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px; margin-bottom: 16px; }
        .emotions-method-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .emotions-method-icon { font-size: 24px; }
        .emotions-method-title { font-size: 16px; font-weight: 600; }
        .emotions-method-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
        .emotions-voice-btn {
            width: 100%; padding: 12px;
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); border-radius: 50px;
            color: var(--text-primary); font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .emotions-manual { display: flex; flex-direction: column; gap: 10px; }
        .emotions-manual-input {
            width: 100%; background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px; padding: 12px; color: var(--text-primary); font-size: 14px;
            resize: vertical; font-family: inherit; box-sizing: border-box;
        }
        .emotions-manual-btn {
            padding: 12px; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 50px; color: var(--text-primary); font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .emotions-loading { text-align: center; padding: 60px 20px; }
        .emotions-loading-spinner { font-size: 56px; animation: emotionPulse 1.5s ease-in-out infinite; }
        @keyframes emotionPulse { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } }
        .emotions-loading-text { font-size: 16px; font-weight: 600; margin-top: 16px; }
        .emotions-loading-sub { font-size: 12px; color: var(--text-secondary); margin-top: 8px; }
        .emotion-user-text { background: rgba(224,224,224,0.06); border-radius: 16px; padding: 12px; margin-bottom: 16px; }
        .emotion-user-text-label { font-size: 10px; color: var(--chrome); margin-bottom: 4px; }
        .emotion-user-text-value { font-size: 14px; font-style: italic; }
        .emotion-result-card { background: rgba(224,224,224,0.05); border-radius: 20px; padding: 20px; margin-bottom: 20px; }
        .emotion-validation { display: flex; gap: 12px; background: rgba(224,224,224,0.08); border-radius: 16px; padding: 14px; margin-bottom: 16px; }
        .emotion-validation-icon { font-size: 24px; }
        .emotion-validation-text { flex: 1; font-size: 14px; line-height: 1.5; }
        .emotion-explanation { margin-bottom: 16px; }
        .emotion-explanation-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--chrome); }
        .emotion-explanation-text { font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
        .emotion-technique { background: rgba(224,224,224,0.06); border-radius: 16px; padding: 14px; margin-bottom: 16px; }
        .emotion-technique-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .emotion-technique-duration { font-size: 11px; color: var(--text-secondary); margin-bottom: 10px; }
        .emotion-technique-instruction { font-size: 13px; line-height: 1.5; }
        .emotion-affirmation { display: flex; align-items: center; gap: 10px; background: rgba(224,224,224,0.06); border-radius: 50px; padding: 12px 16px; }
        .emotion-affirmation-icon { font-size: 20px; }
        .emotion-affirmation-text { flex: 1; font-size: 13px; font-style: italic; }
        .emotion-copy-btn { background: transparent; border: none; font-size: 18px; cursor: pointer; opacity: 0.5; }
        .emotion-actions { display: flex; gap: 12px; }
        .emotion-another-btn, .emotion-share-btn {
            flex: 1; padding: 12px; border-radius: 50px; font-size: 13px;
            font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .emotion-another-btn { background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); color: var(--text-primary); }
        .emotion-share-btn   { background: rgba(224,224,224,0.06); border: 1px solid rgba(224,224,224,0.14); color: var(--text-secondary); }
        @media (max-width: 480px) {
            .emotions-suggested-grid, .emotions-profile-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
            .emotion-emoji { font-size: 24px; }
            .emotion-name { font-size: 10px; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 12. ЭКСПОРТ
// ============================================
window.showEmotionsScreen = showEmotionsScreen;
console.log('✅ Модуль "Эмоции" загружен (emotions.js v2.0)');
