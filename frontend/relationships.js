// ============================================
// relationships.js — Работа с отношениями
// Версия 1.0 — Анализ + Разбор + Кризис
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let relationshipsState = {
    isLoading: false,
    activeTab: 'analysis',
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    userAge: null,
    attachmentType: null,
    analysis: null,
    partnerProfile: null
};

// ============================================
// 2. ТИПЫ ПРИВЯЗАННОСТИ
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
    { id: "fight",             emoji: "⚡", name: "Ссора",           description: "Только что поругались, нужно успокоиться" },
    { id: "breakup",           emoji: "💔", name: "Расставание",      description: "Только что расстались или думаете об этом" },
    { id: "misunderstanding",  emoji: "🤔", name: "Недопонимание",    description: "Чувствуете, что вас не слышат" },
    { id: "coldness",          emoji: "❄️", name: "Отдаление",        description: "Партнёр стал холодным или вы сами" },
    { id: "betrayal",          emoji: "🗡️", name: "Предательство",    description: "Измена, обман, нарушение доверия" }
];

// ============================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else console.log(`[${type}] ${message}`);
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
    else location.reload();
}

async function checkTestCompleted() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
        const data = await response.json();
        return data.has_profile === true;
    } catch (e) {
        return true;
    }
}

// ============================================
// 5. ЗАГРУЗКА ПРОФИЛЯ
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

        const avg = x => Array.isArray(x) ? x[x.length-1] : (x || 4);
        relationshipsState.userVectors = {
            СБ: avg(behavioralLevels.СБ),
            ТФ: avg(behavioralLevels.ТФ),
            УБ: avg(behavioralLevels.УБ),
            ЧВ: avg(behavioralLevels.ЧВ)
        };

        relationshipsState.userName   = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        relationshipsState.userGender = context.gender || 'other';
        relationshipsState.userAge    = context.age || null;

        const attachment = deepPatterns.attachment || '🤗 Надежный';
        if      (attachment.includes('Надежный'))   relationshipsState.attachmentType = 'secure';
        else if (attachment.includes('Тревожный'))  relationshipsState.attachmentType = 'anxious';
        else if (attachment.includes('Избегающий')) relationshipsState.attachmentType = 'avoidant';
        else                                         relationshipsState.attachmentType = 'fearful';

    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 6. AI-ГЕНЕРАЦИЯ АНАЛИЗА
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

СХЕМА ОТВЕТА (JSON):
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, prompt, max_tokens: 800, temperature: 0.7 })
        });
        const data = await response.json();
        if (data.success && data.content) {
            let jsonStr = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) {
        console.error('Error generating analysis:', error);
    }

    return {
        style: v.ЧВ >= 5 ? "Заботливый партнёр" : v.СБ >= 5 ? "Уверенный лидер" : "Гармоничный исследователь",
        strengths: ["Вы чутки к потребностям других", "Вы цените честность", "Вы умеете поддерживать"],
        challenges: ["Иногда трудно говорить о своих желаниях", "Можете брать слишком много на себя"],
        recommendations: ["Практикуйте говорить «я хочу» вместо «ты должен»", "Учитесь просить о помощи", "Выделяйте время только для себя"],
        ideal_partner: "Тот, кто ценит вашу глубину и готов к открытому диалогу"
    };
}

// ============================================
// 7. AI-РАЗБОР СИТУАЦИИ
// ============================================
async function analyzeSituation(situationText, partnerProfile = null) {
    const v = relationshipsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

    let partnerContext = '';
    if (partnerProfile) {
        partnerContext = `\nПАРТНЁР: СБ-${partnerProfile.СБ||'?'}, ТФ-${partnerProfile.ТФ||'?'}, УБ-${partnerProfile.УБ||'?'}, ЧВ-${partnerProfile.ЧВ||'?'}`;
    }

    const prompt = `Ты — Фреди, виртуальный психолог. Помоги разобраться в ситуации в отношениях.

ПОЛЬЗОВАТЕЛЬ: ${relationshipsState.userName}
Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}${partnerContext}

СИТУАЦИЯ: "${situationText}"

СХЕМА ОТВЕТА (JSON):
{
    "analysis": "Что происходит (2-3 предложения)",
    "what_to_say": ["Фраза 1", "Фраза 2", "Фраза 3"],
    "what_to_do": ["Действие 1", "Действие 2"],
    "what_not_to_do": ["Чего избегать 1", "Чего избегать 2"],
    "calming_technique": "Быстрая техника успокоения"
}

Верни только JSON.`;

    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, prompt, max_tokens: 1000, temperature: 0.7 })
        });
        const data = await response.json();
        if (data.success && data.content) {
            let jsonStr = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) { console.error('Error analyzing situation:', error); }

    return {
        analysis: "В этой ситуации важно сохранять спокойствие и говорить о своих чувствах, а не обвинять.",
        what_to_say: ["Я чувствую...", "Мне важно, чтобы...", "Давай попробуем..."],
        what_to_do: ["Сделайте паузу на 10 минут", "Начните с «я-сообщений»"],
        what_not_to_do: ["Не перебивайте", "Не используйте «ты всегда»"],
        calming_technique: "Сделайте 5 глубоких вдохов, прежде чем ответить"
    };
}

// ============================================
// 8. КРИЗИСНАЯ ПОМОЩЬ
// ============================================
async function getCrisisHelp(scenarioId, scenarioName) {
    const v = relationshipsState.userVectors;
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

    const prompt = `Ты — Фреди, виртуальный психолог. Пользователь в кризисной ситуации: ${scenarioName}.

ПРОФИЛЬ: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}

СХЕМА ОТВЕТА (JSON):
{
    "first_aid": "Что сделать прямо сейчас (30 секунд)",
    "calming": "Техника успокоения (1-2 минуты)",
    "action": "Одно конкретное действие",
    "phrase": "Одна фраза для себя или партнёра"
}

Верни только JSON.`;

    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, prompt, max_tokens: 500, temperature: 0.6 })
        });
        const data = await response.json();
        if (data.success && data.content) {
            let jsonStr = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) { console.error('Error getting crisis help:', error); }

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

function renderRelationshipsMainScreen(container) {
    const attachment = ATTACHMENT_TYPES[relationshipsState.attachmentType] || ATTACHMENT_TYPES.secure;
    const analysis   = relationshipsState.analysis || {};

    const tabs = ['analysis','situation','crisis'];
    const tabLabels = { analysis:'📊 АНАЛИЗ', situation:'💬 РАЗБОР', crisis:'⚡ КРИЗИС' };

    const tabsHtml = tabs.map(t =>
        `<button class="relationships-tab${relationshipsState.activeTab===t?' active':''}" data-tab="${t}">${tabLabels[t]}</button>`
    ).join('');

    let contentHtml = '';
    if (relationshipsState.activeTab === 'analysis')  contentHtml = renderAnalysisTab(attachment, analysis);
    if (relationshipsState.activeTab === 'situation') contentHtml = renderSituationTab();
    if (relationshipsState.activeTab === 'crisis')    contentHtml = renderCrisisTab();

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
            <div class="relationships-tabs">${tabsHtml}</div>
            <div class="relationships-content" id="relationshipsContent">${contentHtml}</div>
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

    setTimeout(() => {
        setupSituationHandlers(container);
        setupCrisisHandlers();
    }, 50);
}

// ============================================
// 10. РЕНДЕР ВКЛАДОК
// ============================================
function renderAnalysisTab(attachment, analysis) {
    const strengths       = (analysis.strengths || ['Вы чутки к партнёру','Цените честность']).map(s => `<li>✅ ${s}</li>`).join('');
    const challenges      = (analysis.challenges || ['Иногда трудно говорить о желаниях']).map(c => `<li>⚠️ ${c}</li>`).join('');
    const recommendations = (analysis.recommendations || ['Практикуйте «я-сообщения»']).map(r => `<li>💡 ${r}</li>`).join('');

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
                <ul class="relationships-list">${strengths}</ul>
            </div>
            <div class="relationships-section">
                <div class="relationships-section-title">⚠️ ЗОНЫ РОСТА</div>
                <ul class="relationships-list">${challenges}</ul>
            </div>
            <div class="relationships-section">
                <div class="relationships-section-title">💡 РЕКОМЕНДАЦИИ</div>
                <ul class="relationships-list">${recommendations}</ul>
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
            <div class="relationships-situation-desc" style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
                Опишите ситуацию, которая вас беспокоит. Фреди проанализирует и даст конкретные советы.
            </div>
            <textarea id="situationInput" class="relationships-situation-input"
                placeholder="Например: «Мы поссорились из-за денег. Он сказал, что я слишком много трачу, а я чувствую, что меня контролируют»"
                rows="4"></textarea>
            <div class="relationships-partner-section">
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);cursor:pointer">
                    <input type="checkbox" id="hasPartnerProfile">
                    У меня есть данные о партнёре (для точного анализа)
                </label>
                <div id="partnerProfileFields" style="display:none;margin-top:10px">
                    <div class="relationships-partner-fields">
                        <div class="relationships-partner-field">
                            <label>СБ партнёра (1-6)</label>
                            <input type="number" id="partnerSB" min="1" max="6" placeholder="4" class="relationships-partner-input">
                        </div>
                        <div class="relationships-partner-field">
                            <label>ТФ партнёра (1-6)</label>
                            <input type="number" id="partnerTF" min="1" max="6" placeholder="4" class="relationships-partner-input">
                        </div>
                        <div class="relationships-partner-field">
                            <label>УБ партнёра (1-6)</label>
                            <input type="number" id="partnerUB" min="1" max="6" placeholder="4" class="relationships-partner-input">
                        </div>
                        <div class="relationships-partner-field">
                            <label>ЧВ партнёра (1-6)</label>
                            <input type="number" id="partnerCV" min="1" max="6" placeholder="4" class="relationships-partner-input">
                        </div>
                    </div>
                </div>
            </div>
            <button id="analyzeSituationBtn" class="relationships-analyze-btn">🔍 РАЗОБРАТЬ СИТУАЦИЮ</button>
            <div id="situationResult" class="relationships-situation-result" style="display:none"></div>
        </div>
    `;
}

function renderCrisisTab() {
    const cards = CRISIS_SCENARIOS.map(s => `
        <div class="crisis-card" data-crisis-id="${s.id}" data-crisis-name="${s.name}">
            <div class="crisis-emoji">${s.emoji}</div>
            <div class="crisis-info">
                <div class="crisis-name">${s.name}</div>
                <div class="crisis-desc">${s.description}</div>
            </div>
            <div class="crisis-arrow">→</div>
        </div>`).join('');

    return `
        <div class="relationships-crisis">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
                ⚡ Если вы сейчас в остром состоянии — выберите ситуацию. Фреди даст быструю помощь.
            </div>
            <div class="crisis-grid">${cards}</div>
            <div id="crisisResult" class="crisis-result" style="display:none"></div>
        </div>
    `;
}

// ============================================
// 11. ОБРАБОТЧИКИ
// ============================================
function setupSituationHandlers(container) {
    document.getElementById('hasPartnerProfile')?.addEventListener('change', (e) => {
        const fields = document.getElementById('partnerProfileFields');
        if (fields) fields.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('analyzeSituationBtn')?.addEventListener('click', async () => {
        const situation = document.getElementById('situationInput')?.value.trim();
        if (!situation) { showToastMessage('📝 Опишите ситуацию', 'warning'); return; }

        const btn = document.getElementById('analyzeSituationBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ АНАЛИЗИРУЮ...'; }

        let partnerProfile = null;
        if (document.getElementById('hasPartnerProfile')?.checked) {
            partnerProfile = {
                СБ: parseInt(document.getElementById('partnerSB')?.value) || 4,
                ТФ: parseInt(document.getElementById('partnerTF')?.value) || 4,
                УБ: parseInt(document.getElementById('partnerUB')?.value) || 4,
                ЧВ: parseInt(document.getElementById('partnerCV')?.value) || 4
            };
        }

        const analysis = await analyzeSituation(situation, partnerProfile);
        const resultDiv = document.getElementById('situationResult');

        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="situation-analysis">
                    <div class="situation-subtitle">🔍 АНАЛИЗ</div>
                    <div class="situation-analysis-text">${analysis.analysis || ''}</div>
                </div>
                <div class="situation-what-to-say">
                    <div class="situation-subtitle">💬 ЧТО СКАЗАТЬ</div>
                    <ul>${(analysis.what_to_say||[]).map(s=>`<li>"${s}"</li>`).join('')}</ul>
                </div>
                <div class="situation-what-to-do">
                    <div class="situation-subtitle">🛠️ ЧТО СДЕЛАТЬ</div>
                    <ul>${(analysis.what_to_do||[]).map(a=>`<li>${a}</li>`).join('')}</ul>
                </div>
                <div class="situation-what-not-to-do">
                    <div class="situation-subtitle">🚫 ЧЕГО ИЗБЕГАТЬ</div>
                    <ul>${(analysis.what_not_to_do||[]).map(a=>`<li>${a}</li>`).join('')}</ul>
                </div>
                <div class="situation-calming">
                    <div class="situation-subtitle">🧘 БЫСТРОЕ УСПОКОЕНИЕ</div>
                    <div class="situation-calming-text">${analysis.calming_technique || 'Сделайте 5 глубоких вдохов'}</div>
                </div>`;
        }

        if (btn) { btn.disabled = false; btn.textContent = '🔍 РАЗОБРАТЬ СИТУАЦИЮ'; }
        showToastMessage('✅ Анализ готов', 'success');
    });
}

function setupCrisisHandlers() {
    document.querySelectorAll('.crisis-card').forEach(card => {
        card.addEventListener('click', async () => {
            const crisisId   = card.dataset.crisisId;
            const crisisName = card.dataset.crisisName;
            showToastMessage(`⏳ Анализирую "${crisisName}"...`, 'info');

            const help = await getCrisisHelp(crisisId, crisisName);
            const resultDiv = document.getElementById('crisisResult');

            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <div class="crisis-help">
                        <div class="crisis-help-title">⚡ КРИЗИСНАЯ ПОМОЩЬ</div>
                        ${[
                            { icon:'🆘', label:'ПРЯМО СЕЙЧАС (30 сек)',         text: help.first_aid },
                            { icon:'🧘', label:'ТЕХНИКА УСПОКОЕНИЯ (1-2 мин)',  text: help.calming },
                            { icon:'🎯', label:'ОДНО ДЕЙСТВИЕ',                 text: help.action },
                            { icon:'💬', label:'ФРАЗА ДЛЯ СЕБЯ',               text: `"${help.phrase}"` }
                        ].map(b => `
                        <div class="crisis-help-block">
                            <div class="crisis-help-icon">${b.icon}</div>
                            <div class="crisis-help-content">
                                <div class="crisis-help-label">${b.label}</div>
                                <div class="crisis-help-text">${b.text}</div>
                            </div>
                        </div>`).join('')}
                    </div>`;
                resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            showToastMessage(`✅ Помощь для "${crisisName}" готова`, 'success');
        });
    });
}

// ============================================
// 12. СТИЛИ
// ============================================
function addRelationshipsStyles() {
    if (document.getElementById('relationships-styles')) return;
    const style = document.createElement('style');
    style.id = 'relationships-styles';
    style.textContent = `
        .relationships-tabs {
            display: flex; gap: 4px; margin-bottom: 20px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px;
        }
        .relationships-tab {
            flex: 1; padding: 8px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
            transition: background 0.2s; min-height: 36px;
        }
        .relationships-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        .relationships-attachment {
            display: flex; gap: 16px; background: rgba(224,224,224,0.06);
            border: 1px solid rgba(224,224,224,0.14); border-radius: 20px;
            padding: 16px; margin-bottom: 20px; align-items: center;
        }
        .relationships-attachment-emoji { font-size: 48px; flex-shrink: 0; }
        .relationships-attachment-name  { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .relationships-attachment-desc  { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }

        .relationships-style-card {
            background: rgba(224,224,224,0.05); border-radius: 20px;
            padding: 16px; margin-bottom: 20px; text-align: center;
        }
        .relationships-style-title  { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
        .relationships-style-strength, .relationships-style-growth {
            font-size: 13px; padding: 8px; margin: 4px 0; border-radius: 12px;
            color: var(--text-secondary);
        }
        .relationships-style-strength { background: rgba(16,185,129,0.08); }
        .relationships-style-growth   { background: rgba(224,224,224,0.05); }

        .relationships-section { margin-bottom: 20px; }
        .relationships-section-title { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px; }
        .relationships-list { list-style: none; padding: 0; }
        .relationships-list li { padding: 6px 0; font-size: 13px; color: var(--text-secondary); }

        .relationships-ideal { background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; text-align: center; }
        .relationships-ideal-title { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--chrome); margin-bottom: 8px; }
        .relationships-ideal-text  { font-size: 13px; font-style: italic; color: var(--text-secondary); }

        .relationships-situation-input {
            width: 100%; background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px; padding: 14px; color: var(--text-primary); font-size: 14px;
            margin-bottom: 14px; resize: vertical; font-family: inherit; box-sizing: border-box;
        }
        .relationships-partner-section { margin-bottom: 14px; }
        .relationships-partner-fields  { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .relationships-partner-field   { display: flex; flex-direction: column; gap: 4px; }
        .relationships-partner-field label { font-size: 11px; color: var(--text-secondary); }
        .relationships-partner-input {
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 12px; padding: 8px; color: var(--text-primary); text-align: center;
            font-family: inherit;
        }
        .relationships-analyze-btn {
            width: 100%; padding: 13px;
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); border-radius: 50px;
            color: var(--text-primary); font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .relationships-situation-result { margin-top: 20px; }

        .crisis-grid { display: flex; flex-direction: column; gap: 10px; }
        .crisis-card {
            display: flex; align-items: center; gap: 14px;
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px; cursor: pointer;
            transition: background 0.2s, transform 0.15s;
        }
        .crisis-card:hover  { background: rgba(224,224,224,0.1); transform: translateX(4px); }
        .crisis-card:active { transform: scale(0.97); }
        .crisis-emoji { font-size: 32px; flex-shrink: 0; }
        .crisis-info  { flex: 1; }
        .crisis-name  { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
        .crisis-desc  { font-size: 11px; color: var(--text-secondary); }
        .crisis-arrow { font-size: 20px; opacity: 0.4; }

        .situation-analysis, .situation-what-to-say, .situation-what-to-do,
        .situation-what-not-to-do, .situation-calming {
            background: rgba(224,224,224,0.05); border-radius: 16px; padding: 14px; margin-bottom: 10px;
        }
        .situation-subtitle { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--chrome); margin-bottom: 8px; }
        .situation-analysis-text, .situation-calming-text { font-size: 13px; line-height: 1.6; color: var(--text-secondary); }

        .crisis-help { margin-top: 16px; }
        .crisis-help-title { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 16px; color: var(--chrome); }
        .crisis-help-block { display: flex; gap: 12px; background: rgba(224,224,224,0.05); border-radius: 16px; padding: 14px; margin-bottom: 10px; }
        .crisis-help-icon    { font-size: 28px; flex-shrink: 0; }
        .crisis-help-label   { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--chrome); margin-bottom: 4px; }
        .crisis-help-text    { font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
    `;
    document.head.appendChild(style);
}

// ============================================
// 13. ЭКСПОРТ
// ============================================
window.showRelationshipsScreen = showRelationshipsScreen;
console.log('✅ Модуль "Отношения" загружен (relationships.js v1.0)');
