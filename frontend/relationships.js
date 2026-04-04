// ============================================
// relationships.js — Работа с отношениями
// Версия 1.0 — Анализ + Разбор + Кризис
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let relationshipsState = {
    isLoading: false,
    activeTab: 'analysis', // 'analysis', 'situation', 'crisis'
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    userAge: null,
    attachmentType: null,
    analysis: null,
    partnerProfile: null  // для коллаборации
};

// ============================================
// 2. ТИПЫ ПРИВЯЗАННОСТИ (из теста)
// ============================================
const ATTACHMENT_TYPES = {
    secure: {
        name: "Надёжный",
        emoji: "🛡️",
        description: "Вы уверены в отношениях, не боитесь близости и не боитесь одиночества",
        strength: "Создаёте безопасное пространство для партнёра",
        growth: "Можете иногда быть слишком независимым"
    },
    anxious: {
        name: "Тревожный",
        emoji: "😥",
        description: "Вы боитесь, что вас бросят, нуждаетесь в постоянных подтверждениях любви",
        strength: "Очень чутки и внимательны к партнёру",
        growth: "Учиться доверять и не растворяться в другом"
    },
    avoidant: {
        name: "Избегающий",
        emoji: "🏔️",
        description: "Вы держите дистанцию, боитесь потерять свободу",
        strength: "Самодостаточны и не создаёте зависимостей",
        growth: "Учиться открываться и доверять"
    },
    fearful: {
        name: "Дезорганизованный",
        emoji: "🌪️",
        description: "Вы одновременно хотите близости и боитесь её",
        strength: "Глубоко чувствуете и переживаете",
        growth: "Стабилизация и принятие себя"
    }
};

// ============================================
// 3. КРИЗИСНЫЕ СЦЕНАРИИ
// ============================================
const CRISIS_SCENARIOS = [
    { id: "fight", emoji: "⚡", name: "Ссора", description: "Только что поругались, нужно успокоиться" },
    { id: "breakup", emoji: "💔", name: "Расставание", description: "Только что расстались или думаете об этом" },
    { id: "misunderstanding", emoji: "🤔", name: "Недопонимание", description: "Чувствуете, что вас не слышат" },
    { id: "coldness", emoji: "❄️", name: "Отдаление", description: "Партнёр стал холодным или вы сами" },
    { id: "betrayal", emoji: "🗡️", name: "Предательство", description: "Измена, обман, нарушение доверия" }
];

// ============================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
// 5. ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ============================================
async function loadUserProfileForRelationships() {
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
        const deepPatterns = profile.deep_patterns || {};
        
        relationshipsState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        relationshipsState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        relationshipsState.userGender = context.gender || 'other';
        relationshipsState.userAge = context.age || null;
        
        // Определяем тип привязанности из deep_patterns
        const attachment = deepPatterns.attachment || '🤗 Надежный';
        if (attachment.includes('Надежный')) relationshipsState.attachmentType = 'secure';
        else if (attachment.includes('Тревожный')) relationshipsState.attachmentType = 'anxious';
        else if (attachment.includes('Избегающий')) relationshipsState.attachmentType = 'avoidant';
        else relationshipsState.attachmentType = 'fearful';
        
        console.log('📊 Данные для отношений:', relationshipsState);
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 6. AI-ГЕНЕРАЦИЯ АНАЛИЗА СТИЛЯ ОТНОШЕНИЙ
// ============================================
async function generateRelationshipAnalysis() {
    const v = relationshipsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const attachmentInfo = ATTACHMENT_TYPES[relationshipsState.attachmentType] || ATTACHMENT_TYPES.secure;
    
    const prompt = `Ты — Фреди, виртуальный психолог. Сделай анализ стиля отношений пользователя.

ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
- Имя: ${relationshipsState.userName}
- Пол: ${relationshipsState.userGender}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Тип привязанности: ${attachmentInfo.name} (${attachmentInfo.description})

ЗАДАНИЕ:
Создай персонализированный анализ отношений.

ТРЕБОВАНИЯ К ОТВЕТУ:
1. Формат — JSON строго по схеме ниже
2. Используй обращение к пользователю по имени
3. Будь бережным и профессиональным

СХЕМА ОТВЕТА:
{
    "style": "Краткое название стиля отношений (2-4 слова)",
    "strengths": ["Сильная сторона 1", "Сильная сторона 2", "Сильная сторона 3"],
    "challenges": ["Что может мешать 1", "Что может мешать 2"],
    "recommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"],
    "ideal_partner": "Описание идеального партнёра (1-2 предложения)"
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
                max_tokens: 800,
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
        console.error('Error generating analysis:', error);
    }
    
    // Fallback
    return {
        style: v.ЧВ >= 5 ? "Заботливый партнёр" : v.СБ >= 5 ? "Уверенный лидер" : "Гармоничный исследователь",
        strengths: ["Вы чутки к потребностям других", "Вы цените честность", "Вы умеете поддерживать"],
        challenges: ["Иногда трудно говорить о своих желаниях", "Можете брать слишком много на себя"],
        recommendations: ["Практикуйте говорить 'я хочу' вместо 'ты должен'", "Учитесь просить о помощи"],
        ideal_partner: "Тот, кто ценит вашу глубину и готов к открытому диалогу"
    };
}

// ============================================
// 7. AI-РАЗБОР СИТУАЦИИ (с коллаборацией)
// ============================================
async function analyzeSituation(situationText, partnerProfile = null) {
    const v = relationshipsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    let partnerContext = '';
    if (partnerProfile) {
        partnerContext = `
ПАРТНЁР:
- Предполагаемый профиль: СБ-${partnerProfile.СБ || '?'}, ТФ-${partnerProfile.ТФ || '?'}, УБ-${partnerProfile.УБ || '?'}, ЧВ-${partnerProfile.ЧВ || '?'}
- Роль в ситуации: ${partnerProfile.role || 'участник'}`;
    }
    
    const prompt = `Ты — Фреди, виртуальный психолог. Помоги пользователю разобраться в ситуации в отношениях.

ПОЛЬЗОВАТЕЛЬ:
- Имя: ${relationshipsState.userName}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
${partnerContext}

СИТУАЦИЯ:
"${situationText}"

ЗАДАНИЕ:
Проанализируй ситуацию и дай конкретные советы.

СХЕМА ОТВЕТА (JSON):
{
    "analysis": "Что происходит с точки зрения психологии (2-3 предложения)",
    "what_to_say": ["Фраза 1", "Фраза 2", "Фраза 3"],
    "what_to_do": ["Действие 1", "Действие 2"],
    "what_not_to_do": ["Чего избегать 1", "Чего избегать 2"],
    "calming_technique": "Быстрая техника успокоения прямо сейчас"
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
        console.error('Error analyzing situation:', error);
    }
    
    // Fallback
    return {
        analysis: "В этой ситуации важно сохранять спокойствие и говорить о своих чувствах, а не обвинять.",
        what_to_say: ["Я чувствую...", "Мне важно, чтобы...", "Давай попробуем..."],
        what_to_do: ["Сделайте паузу на 10 минут", "Начните с 'я-сообщений'"],
        what_not_to_do: ["Не перебивайте", "Не используйте обобщения ('ты всегда')"],
        calming_technique: "Сделайте 5 глубоких вдохов, прежде чем ответить"
    };
}

// ============================================
// 8. КРИЗИСНАЯ ПОМОЩЬ (быстрая)
// ============================================
async function getCrisisHelp(scenarioId, scenarioName) {
    const v = relationshipsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const prompt = `Ты — Фреди, виртуальный психолог. Пользователь в кризисной ситуации: ${scenarioName}.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- СБ: ${v.СБ}/6, ТФ: ${v.ТФ}/6, УБ: ${v.УБ}/6, ЧВ: ${v.ЧВ}/6

ЗАДАНИЕ:
Дай быструю, конкретную помощь. Минимум теории, максимум действий.

СХЕМА ОТВЕТА (JSON):
{
    "first_aid": "Что сделать прямо сейчас (30 секунд)",
    "calming": "Техника успокоения (1-2 минуты)",
    "action": "Одно конкретное действие, которое поможет",
    "phrase": "Одна фраза, которую можно сказать себе или партнёру"
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
                max_tokens: 500,
                temperature: 0.6
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            let jsonStr = data.content;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) {
        console.error('Error getting crisis help:', error);
    }
    
    // Fallback
    return {
        first_aid: "Выйдите из комнаты на 5 минут. Сделайте паузу.",
        calming: "Дышите: вдох 4 сек — задержка 4 сек — выдох 4 сек",
        action: "Напишите свои чувства на бумаге, не отправляя партнёру",
        phrase: "Я в порядке. Это пройдёт. Я справлюсь."
    };
}

// ============================================
// 9. ОСНОВНОЙ ЭКРАН
// ============================================
async function showRelationshipsScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForRelationships();
    relationshipsState.analysis = await generateRelationshipAnalysis();
    
    renderRelationshipsMainScreen(container);
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

function renderRelationshipsMainScreen(container) {
    const attachment = ATTACHMENT_TYPES[relationshipsState.attachmentType] || ATTACHMENT_TYPES.secure;
    const analysis = relationshipsState.analysis || {};
    
    container.innerHTML = `
        <div class="full-content-page" id="relationshipsScreen">
            <button class="back-btn" id="relationshipsBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">💕</div>
                <h1>Отношения</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Поймите себя в паре, улучшите коммуникацию
                </div>
            </div>
            
            <div class="relationships-tabs">
                <button class="relationships-tab ${relationshipsState.activeTab === 'analysis' ? 'active' : ''}" data-tab="analysis">
                    📊 АНАЛИЗ
                </button>
                <button class="relationships-tab ${relationshipsState.activeTab === 'situation' ? 'active' : ''}" data-tab="situation">
                    💬 РАЗБОР
                </button>
                <button class="relationships-tab ${relationshipsState.activeTab === 'crisis' ? 'active' : ''}" data-tab="crisis">
                    ⚡ КРИЗИС
                </button>
            </div>
            
            <div class="relationships-content" id="relationshipsContent">
                ${relationshipsState.activeTab === 'analysis' ? renderAnalysisTab(attachment, analysis) : ''}
                ${relationshipsState.activeTab === 'situation' ? renderSituationTab() : ''}
                ${relationshipsState.activeTab === 'crisis' ? renderCrisisTab() : ''}
            </div>
        </div>
    `;
    
    addRelationshipsStyles();
    
    document.getElementById('relationshipsBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.querySelectorAll('.relationships-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            relationshipsState.activeTab = tab.dataset.tab;
            renderRelationshipsMainScreen(container);
        });
    });
}

function renderAnalysisTab(attachment, analysis) {
    let strengthsHtml = '';
    if (analysis.strengths) {
        strengthsHtml = analysis.strengths.map(s => `<li>✅ ${s}</li>`).join('');
    }
    
    let challengesHtml = '';
    if (analysis.challenges) {
        challengesHtml = analysis.challenges.map(c => `<li>⚠️ ${c}</li>`).join('');
    }
    
    let recommendationsHtml = '';
    if (analysis.recommendations) {
        recommendationsHtml = analysis.recommendations.map(r => `<li>💡 ${r}</li>`).join('');
    }
    
    return `
        <div class="relationships-analysis">
            <div class="relationships-attachment">
                <div class="relationships-attachment-emoji">${attachment.emoji}</div>
                <div class="relationships-attachment-info">
                    <div class="relationships-attachment-name">${attachment.name} тип привязанности</div>
                    <div class="relationships-attachment-desc">${attachment.description}</div>
                </div>
            </div>
            
            <div class="relationships-style-card">
                <div class="relationships-style-title">🎭 Ваш стиль: ${analysis.style || 'Гармоничный'}</div>
                <div class="relationships-style-strength">💪 ${attachment.strength}</div>
                <div class="relationships-style-growth">🌱 ${attachment.growth}</div>
            </div>
            
            <div class="relationships-section">
                <div class="relationships-section-title">✅ СИЛЬНЫЕ СТОРОНЫ</div>
                <ul class="relationships-list">${strengthsHtml || '<li>✅ Вы чутки к партнёру</li><li>✅ Вы цените честность</li>'}</ul>
            </div>
            
            <div class="relationships-section">
                <div class="relationships-section-title">⚠️ ЗОНЫ РОСТА</div>
                <ul class="relationships-list">${challengesHtml || '<li>⚠️ Иногда трудно говорить о своих желаниях</li>'}</ul>
            </div>
            
            <div class="relationships-section">
                <div class="relationships-section-title">💡 РЕКОМЕНДАЦИИ</div>
                <ul class="relationships-list">${recommendationsHtml || '<li>💡 Практикуйте говорить "я хочу" вместо "ты должен"</li>'}</ul>
            </div>
            
            <div class="relationships-ideal">
                <div class="relationships-ideal-title">🔍 ИДЕАЛЬНЫЙ ПАРТНЁР</div>
                <div class="relationships-ideal-text">${analysis.ideal_partner || 'Тот, кто ценит вашу глубину и готов к открытому диалогу'}</div>
            </div>
        </div>
    `;
}

function renderSituationTab() {
    return `
        <div class="relationships-situation">
            <div class="relationships-situation-desc">
                Опишите ситуацию, которая вас беспокоит. Фреди проанализирует и даст конкретные советы.
            </div>
            
            <textarea id="situationInput" class="relationships-situation-input" 
                placeholder="Например: «Мы поссорились из-за денег. Он сказал, что я слишком много трачу, а я чувствую, что меня контролируют»"
                rows="4"></textarea>
            
            <div class="relationships-partner-section">
                <div class="relationships-partner-toggle" id="partnerToggle">
                    <input type="checkbox" id="hasPartnerProfile"> 
                    <label for="hasPartnerProfile">У меня есть данные о партнёре (для точного анализа)</label>
                </div>
                
                <div id="partnerProfileFields" style="display: none;">
                    <div class="relationships-partner-fields">
                        <div class="relationships-partner-field">
                            <label>СБ партнёра (1-6)</label>
                            <input type="number" id="partnerSB" min="1" max="6" step="1" placeholder="4">
                        </div>
                        <div class="relationships-partner-field">
                            <label>ТФ партнёра (1-6)</label>
                            <input type="number" id="partnerTF" min="1" max="6" step="1" placeholder="4">
                        </div>
                        <div class="relationships-partner-field">
                            <label>УБ партнёра (1-6)</label>
                            <input type="number" id="partnerUB" min="1" max="6" step="1" placeholder="4">
                        </div>
                        <div class="relationships-partner-field">
                            <label>ЧВ партнёра (1-6)</label>
                            <input type="number" id="partnerCV" min="1" max="6" step="1" placeholder="4">
                        </div>
                    </div>
                </div>
            </div>
            
            <button id="analyzeSituationBtn" class="relationships-analyze-btn">
                🔍 РАЗОБРАТЬ СИТУАЦИЮ
            </button>
            
            <div id="situationResult" class="relationships-situation-result" style="display: none;"></div>
        </div>
    `;
}

function renderCrisisTab() {
    let scenariosHtml = '';
    CRISIS_SCENARIOS.forEach(scenario => {
        scenariosHtml += `
            <div class="crisis-card" data-crisis-id="${scenario.id}" data-crisis-name="${scenario.name}">
                <div class="crisis-emoji">${scenario.emoji}</div>
                <div class="crisis-info">
                    <div class="crisis-name">${scenario.name}</div>
                    <div class="crisis-desc">${scenario.description}</div>
                </div>
                <div class="crisis-arrow">→</div>
            </div>
        `;
    });
    
    return `
        <div class="relationships-crisis">
            <div class="relationships-crisis-desc">
                ⚡ Если вы сейчас в остром состоянии — выберите ситуацию. Фреди даст быструю помощь.
            </div>
            
            <div class="crisis-grid">
                ${scenariosHtml}
            </div>
            
            <div id="crisisResult" class="crisis-result" style="display: none;"></div>
        </div>
    `;
}

// ============================================
// 10. ОБРАБОТЧИКИ ДЛЯ ВКЛАДОК
// ============================================
function setupSituationHandlers() {
    const partnerToggle = document.getElementById('partnerToggle');
    const partnerFields = document.getElementById('partnerProfileFields');
    const analyzeBtn = document.getElementById('analyzeSituationBtn');
    const situationInput = document.getElementById('situationInput');
    const resultDiv = document.getElementById('situationResult');
    
    if (partnerToggle) {
        const checkbox = document.getElementById('hasPartnerProfile');
        checkbox.addEventListener('change', (e) => {
            partnerFields.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const situation = situationInput?.value.trim();
            if (!situation) {
                showToastMessage('📝 Опишите ситуацию', 'warning');
                return;
            }
            
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '⏳ АНАЛИЗИРУЮ...';
            
            let partnerProfile = null;
            const hasPartner = document.getElementById('hasPartnerProfile')?.checked;
            if (hasPartner) {
                partnerProfile = {
                    СБ: parseInt(document.getElementById('partnerSB')?.value) || 4,
                    ТФ: parseInt(document.getElementById('partnerTF')?.value) || 4,
                    УБ: parseInt(document.getElementById('partnerUB')?.value) || 4,
                    ЧВ: parseInt(document.getElementById('partnerCV')?.value) || 4,
                    role: 'партнёр'
                };
            }
            
            const analysis = await analyzeSituation(situation, partnerProfile);
            
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <div class="situation-analysis">
                        <div class="situation-analysis-title">🔍 АНАЛИЗ</div>
                        <div class="situation-analysis-text">${analysis.analysis || ''}</div>
                    </div>
                    
                    <div class="situation-what-to-say">
                        <div class="situation-subtitle">💬 ЧТО СКАЗАТЬ</div>
                        <ul>
                            ${(analysis.what_to_say || []).map(s => `<li>“${s}”</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="situation-what-to-do">
                        <div class="situation-subtitle">🛠️ ЧТО СДЕЛАТЬ</div>
                        <ul>
                            ${(analysis.what_to_do || []).map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="situation-what-not-to-do">
                        <div class="situation-subtitle">🚫 ЧЕГО ИЗБЕГАТЬ</div>
                        <ul>
                            ${(analysis.what_not_to_do || []).map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="situation-calming">
                        <div class="situation-subtitle">🧘 БЫСТРОЕ УСПОКОЕНИЕ</div>
                        <div class="situation-calming-text">${analysis.calming_technique || 'Сделайте 5 глубоких вдохов'}</div>
                    </div>
                `;
            }
            
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 РАЗОБРАТЬ СИТУАЦИЮ';
            showToastMessage('✅ Анализ готов', 'success');
        });
    }
}

function setupCrisisHandlers() {
    document.querySelectorAll('.crisis-card').forEach(card => {
        card.addEventListener('click', async () => {
            const crisisId = card.dataset.crisisId;
            const crisisName = card.dataset.crisisName;
            const resultDiv = document.getElementById('crisisResult');
            
            showToastMessage(`⏳ Анализирую ситуацию "${crisisName}"...`, 'info');
            
            const help = await getCrisisHelp(crisisId, crisisName);
            
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <div class="crisis-help">
                        <div class="crisis-help-title">⚡ КРИЗИСНАЯ ПОМОЩЬ</div>
                        
                        <div class="crisis-help-block">
                            <div class="crisis-help-icon">🆘</div>
                            <div class="crisis-help-content">
                                <div class="crisis-help-label">ПРЯМО СЕЙЧАС (30 сек)</div>
                                <div class="crisis-help-text">${help.first_aid || 'Выйдите из комнаты на 5 минут'}</div>
                            </div>
                        </div>
                        
                        <div class="crisis-help-block">
                            <div class="crisis-help-icon">🧘</div>
                            <div class="crisis-help-content">
                                <div class="crisis-help-label">ТЕХНИКА УСПОКОЕНИЯ (1-2 мин)</div>
                                <div class="crisis-help-text">${help.calming || 'Дыхание: вдох 4 сек — выдох 4 сек'}</div>
                            </div>
                        </div>
                        
                        <div class="crisis-help-block">
                            <div class="crisis-help-icon">🎯</div>
                            <div class="crisis-help-content">
                                <div class="crisis-help-label">ОДНО ДЕЙСТВИЕ</div>
                                <div class="crisis-help-text">${help.action || 'Напишите чувства на бумаге'}</div>
                            </div>
                        </div>
                        
                        <div class="crisis-help-block">
                            <div class="crisis-help-icon">💬</div>
                            <div class="crisis-help-content">
                                <div class="crisis-help-label">ФРАЗА ДЛЯ СЕБЯ</div>
                                <div class="crisis-help-text">“${help.phrase || 'Я справлюсь. Это пройдёт.'}”</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            showToastMessage(`✅ Помощь для "${crisisName}" готова`, 'success');
        });
    });
}

// ============================================
// 11. СТИЛИ
// ============================================
function addRelationshipsStyles() {
    if (document.getElementById('relationships-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'relationships-styles';
    style.textContent = `
        .relationships-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
        }
        .relationships-tab {
            flex: 1;
            padding: 10px 16px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        }
        .relationships-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        
        .relationships-attachment {
            display: flex;
            gap: 16px;
            background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05));
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .relationships-attachment-emoji {
            font-size: 48px;
        }
        .relationships-attachment-name {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .relationships-attachment-desc {
            font-size: 12px;
            color: var(--text-secondary);
        }
        
        .relationships-style-card {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
        }
        .relationships-style-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        .relationships-style-strength, .relationships-style-growth {
            font-size: 13px;
            padding: 8px;
            margin: 4px 0;
            border-radius: 12px;
        }
        .relationships-style-strength {
            background: rgba(16,185,129,0.1);
        }
        .relationships-style-growth {
            background: rgba(245,158,11,0.1);
        }
        
        .relationships-section {
            margin-bottom: 20px;
        }
        .relationships-section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .relationships-list {
            list-style: none;
            padding: 0;
        }
        .relationships-list li {
            padding: 6px 0;
            font-size: 13px;
            color: var(--text-secondary);
        }
        
        .relationships-ideal {
            background: rgba(59,130,255,0.1);
            border-radius: 16px;
            padding: 16px;
            text-align: center;
        }
        .relationships-ideal-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .relationships-ideal-text {
            font-size: 13px;
            font-style: italic;
        }
        
        .relationships-situation-input {
            width: 100%;
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px;
            padding: 14px;
            color: white;
            font-size: 14px;
            margin-bottom: 16px;
            resize: vertical;
        }
        .relationships-partner-section {
            margin-bottom: 16px;
        }
        .relationships-partner-fields {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .relationships-partner-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .relationships-partner-field label {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .relationships-partner-field input {
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 12px;
            padding: 8px;
            color: white;
            text-align: center;
        }
        .relationships-analyze-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            border-radius: 50px;
            color: white;
            font-weight: 600;
            cursor: pointer;
        }
        .relationships-situation-result {
            margin-top: 20px;
        }
        
        .crisis-grid {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .crisis-card {
            display: flex;
            align-items: center;
            gap: 14px;
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .crisis-card:hover {
            background: rgba(255,107,59,0.15);
            transform: translateX(4px);
        }
        .crisis-emoji {
            font-size: 32px;
        }
        .crisis-info {
            flex: 1;
        }
        .crisis-name {
            font-size: 15px;
            font-weight: 600;
        }
        .crisis-desc {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .crisis-arrow {
            font-size: 20px;
            opacity: 0.5;
        }
        
        .situation-analysis, .situation-what-to-say, .situation-what-to-do, .situation-what-not-to-do, .situation-calming {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .situation-subtitle {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #ff6b3b;
        }
        .situation-analysis-text {
            font-size: 13px;
            line-height: 1.5;
        }
        .situation-calming-text {
            font-size: 13px;
            font-style: italic;
        }
        
        .crisis-help {
            margin-top: 16px;
        }
        .crisis-help-title {
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 16px;
            color: #ff6b3b;
        }
        .crisis-help-block {
            display: flex;
            gap: 12px;
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .crisis-help-icon {
            font-size: 28px;
        }
        .crisis-help-content {
            flex: 1;
        }
        .crisis-help-label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 1px;
            margin-bottom: 4px;
            color: #ff6b3b;
        }
        .crisis-help-text {
            font-size: 13px;
            line-height: 1.4;
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 12. ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ВКЛАДКАМИ
// ============================================
// Обработчики навешиваются после рендера через setTimeout
function setupRelationshipsHandlers() {
    setupSituationHandlers();
    setupCrisisHandlers();
}

// Переопределяем рендер с установкой обработчиков
const originalRenderRelationships = renderRelationshipsMainScreen;
window.renderRelationshipsMainScreen = function(container) {
    originalRenderRelationships(container);
    setTimeout(setupRelationshipsHandlers, 100);
};

// ============================================
// 13. ЭКСПОРТ
// ============================================
window.showRelationshipsScreen = showRelationshipsScreen;

console.log('✅ Модуль "Отношения" загружен (relationships.js v1.0)');
