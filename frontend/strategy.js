// ============================================
// strategy.js — Стратегия (режим КОУЧ)
// Версия 1.0 — AI-генерация с учётом мышления
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let strategyState = {
    isLoading: false,
    activeTab: 'thinking', // 'thinking', 'strategy', 'traps', 'tracking'
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    thinkingLevel: 5,
    userName: 'Пользователь',
    userGender: 'other',
    currentGoal: null,
    currentStrategy: null,
    strategyProgress: [],
    strategySteps: []
};

// ============================================
// 2. ТИПЫ МЫШЛЕНИЯ ПО ВЕКТОРАМ
// ============================================
const THINKING_TYPES = {
    "СБ": {
        name: "Осторожный стратег",
        emoji: "🛡️",
        description: "Вы тщательно взвешиваете риски, прежде чем действовать. Это помогает избегать ошибок, но иногда парализует.",
        strengths: [
            "Вы видите риски, которые другие упускают",
            "Вы редко принимаете поспешных решений",
            "Вы надёжны и предсказуемы"
        ],
        weaknesses: [
            "Можете застревать в анализе вместо действия",
            "Склонны к катастрофизации",
            "Боитесь ошибиться"
        ],
        decision_making: "Взвешивание всех 'за' и 'против', консультации с доверенными людьми",
        planning_style: "Детальное, с запасными планами и учётом рисков",
        cognitive_traps: [
            { name: "Анализ паралич", description: "Собираете слишком много данных вместо действия" },
            { name: "Катастрофизация", description: "Представляете худший сценарий вместо реального" },
            { name: "Синдром самозванца", description: "Сомневаетесь в своей компетентности" }
        ]
    },
    "ТФ": {
        name: "Прагматик",
        emoji: "📊",
        description: "Вы ориентированы на результат и эффективность. Быстро считаете выгоду и действуете.",
        strengths: [
            "Быстро принимаете решения",
            "Фокусируетесь на измеримых результатах",
            "Эффективно распределяете ресурсы"
        ],
        weaknesses: [
            "Можете недооценивать человеческий фактор",
            "Склонны к туннельному видению",
            "Иногда жертвуете качеством ради скорости"
        ],
        decision_making: "Анализ выгоды и затрат, приоритет быстрых побед",
        planning_style: "По этапам с чёткими KPI и дедлайнами",
        cognitive_traps: [
            { name: "Туннельное видение", description: "Видите только цифры, упуская контекст" },
            { name: "Гиперфокус на результате", description: "Игнорируете процесс и людей" },
            { name: "Ложная срочность", description: "Торопитесь там, где можно подождать" }
        ]
    },
    "УБ": {
        name: "Системный мыслитель",
        emoji: "🧠",
        description: "Вы видите взаимосвязи и долгосрочные тренды. Строите сложные модели и стратегии.",
        strengths: [
            "Видите системные причины проблем",
            "Строите долгосрочные стратегии",
            "Находите неочевидные решения"
        ],
        weaknesses: [
            "Склонны к переусложнению",
            "Можете застревать в анализе",
            "Трудно переключаться между задачами"
        ],
        decision_making: "Анализ системных связей, поиск корневых причин",
        planning_style: "Многоуровневое, с учётом взаимовлияний",
        cognitive_traps: [
            { name: "Анализ паралич", description: "Бесконечное исследование вместо действия" },
            { name: "Перфекционизм", description: "Ожидание идеального плана" },
            { name: "Сложностная перегрузка", description: "Усложняете там, где можно проще" }
        ]
    },
    "ЧВ": {
        name: "Интуитивный стратег",
        emoji: "💕",
        description: "Вы чувствуете людей и контекст. Принимаете решения сердцем, но иногда теряете фокус.",
        strengths: [
            "Учитываете человеческий фактор",
            "Гибко реагируете на изменения",
            "Создаёте доверительные отношения"
        ],
        weaknesses: [
            "Можете принимать эмоциональные решения",
            "Размываете границы и сроки",
            "Трудно говорить 'нет'"
        ],
        decision_making: "Интуиция, учёт чувств всех участников",
        planning_style: "Гибкое, с возможностью корректировки",
        cognitive_traps: [
            { name: "Эмоциональное заражение", description: "Принимаете чужие эмоции за свои" },
            { name: "Созависимость", description: "Ставите чужие интересы выше своих" },
            { name: "Иллюзия контроля", description: "Думаете, что можете влиять на всё" }
        ]
    }
};

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
async function loadUserProfileForStrategy() {
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
        
        strategyState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        strategyState.thinkingLevel = profile.thinking_level || 5;
        strategyState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        strategyState.userGender = context.gender || 'other';
        
        // Загружаем сохранённую стратегию
        const savedStrategy = localStorage.getItem(`strategy_${userId}`);
        if (savedStrategy) {
            const data = JSON.parse(savedStrategy);
            strategyState.currentStrategy = data.strategy;
            strategyState.strategyProgress = data.progress || [];
        }
        
        console.log('📊 Данные для стратегии:', strategyState);
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 5. ОПРЕДЕЛЕНИЕ ТИПА МЫШЛЕНИЯ
// ============================================
function getThinkingType() {
    const v = strategyState.userVectors;
    // Находим доминирующий вектор (максимальное значение)
    const entries = Object.entries(v);
    const maxVector = entries.reduce((max, current) => 
        current[1] > max[1] ? current : max, entries[0]);
    return maxVector[0];
}

// ============================================
// 6. AI-ГЕНЕРАЦИЯ СТРАТЕГИИ
// ============================================
async function generateStrategy(goalText) {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    const thinkingType = getThinkingType();
    const thinkingInfo = THINKING_TYPES[thinkingType] || THINKING_TYPES["УБ"];
    const userName = strategyState.userName;
    const v = strategyState.userVectors;
    
    const prompt = `Ты — Фреди, виртуальный психолог. Создай персональную стратегию для пользователя.

ПОЛЬЗОВАТЕЛЬ:
- Имя: ${userName}
- Тип мышления: ${thinkingInfo.name} (${thinkingInfo.description})
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Уровень мышления: ${strategyState.thinkingLevel}/9

ЦЕЛЬ: "${goalText}"

ЗАДАНИЕ:
Создай стратегию достижения цели с учётом типа мышления пользователя.

ТРЕБОВАНИЯ:
1. Учитывайте сильные стороны и компенсируйте слабые
2. Адаптируйте формат под тип мышления
3. Разбейте на 5-7 конкретных шагов

СХЕМА ОТВЕТА (JSON):
{
    "strategy_name": "Название стратегии (коротко)",
    "description": "Краткое описание подхода (2-3 предложения)",
    "steps": [
        {
            "number": 1,
            "title": "Название шага",
            "description": "Что сделать",
            "duration": "Срок выполнения (дни/недели)"
        }
    ],
    "timeline": "Общий срок реализации",
    "success_criteria": "Как понять, что стратегия работает"
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
                max_tokens: 1500,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            let jsonStr = data.content;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const strategy = JSON.parse(jsonStr);
            
            // Добавляем ID шагам
            strategy.steps = strategy.steps.map((step, idx) => ({
                ...step,
                id: idx,
                completed: false
            }));
            
            return strategy;
        }
    } catch (error) {
        console.error('Error generating strategy:', error);
    }
    
    return null;
}

// ============================================
// 7. СОХРАНЕНИЕ СТРАТЕГИИ
// ============================================
function saveStrategy() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    localStorage.setItem(`strategy_${userId}`, JSON.stringify({
        strategy: strategyState.currentStrategy,
        progress: strategyState.strategyProgress
    }));
}

// ============================================
// 8. ОСНОВНОЙ ЭКРАН
// ============================================
async function showStrategyScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForStrategy();
    renderStrategyMainScreen(container);
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

function renderStrategyMainScreen(container) {
    const thinkingType = getThinkingType();
    const thinkingInfo = THINKING_TYPES[thinkingType] || THINKING_TYPES["УБ"];
    
    container.innerHTML = `
        <div class="full-content-page" id="strategyScreen">
            <button class="back-btn" id="strategyBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1>Стратегия</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Персональный план действий
                </div>
            </div>
            
            <div class="strategy-tabs">
                <button class="strategy-tab ${strategyState.activeTab === 'thinking' ? 'active' : ''}" data-tab="thinking">
                    🧠 МЫШЛЕНИЕ
                </button>
                <button class="strategy-tab ${strategyState.activeTab === 'strategy' ? 'active' : ''}" data-tab="strategy">
                    🎯 СТРАТЕГИЯ
                </button>
                <button class="strategy-tab ${strategyState.activeTab === 'traps' ? 'active' : ''}" data-tab="traps">
                    ⚠️ ЛОВУШКИ
                </button>
                <button class="strategy-tab ${strategyState.activeTab === 'tracking' ? 'active' : ''}" data-tab="tracking">
                    📊 ТРЕКИНГ
                </button>
            </div>
            
            <div class="strategy-content" id="strategyContent">
                ${strategyState.activeTab === 'thinking' ? renderThinkingTab(thinkingInfo) : ''}
                ${strategyState.activeTab === 'strategy' ? renderStrategyTab() : ''}
                ${strategyState.activeTab === 'traps' ? renderTrapsTab(thinkingInfo) : ''}
                ${strategyState.activeTab === 'tracking' ? renderTrackingTab() : ''}
            </div>
        </div>
    `;
    
    addStrategyStyles();
    
    document.getElementById('strategyBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.querySelectorAll('.strategy-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            strategyState.activeTab = tab.dataset.tab;
            renderStrategyMainScreen(container);
        });
    });
}

// ============================================
// 9. ВКЛАДКА "МЫШЛЕНИЕ"
// ============================================
function renderThinkingTab(thinkingInfo) {
    let strengthsHtml = '';
    thinkingInfo.strengths.forEach(s => {
        strengthsHtml += `<li>✅ ${s}</li>`;
    });
    
    let weaknessesHtml = '';
    thinkingInfo.weaknesses.forEach(w => {
        weaknessesHtml += `<li>⚠️ ${w}</li>`;
    });
    
    return `
        <div class="strategy-thinking">
            <div class="strategy-thinking-card">
                <div class="strategy-thinking-emoji">${thinkingInfo.emoji}</div>
                <div class="strategy-thinking-name">${thinkingInfo.name}</div>
                <div class="strategy-thinking-level">🧠 Уровень мышления: ${strategyState.thinkingLevel}/9</div>
                <div class="strategy-thinking-desc">${thinkingInfo.description}</div>
            </div>
            
            <div class="strategy-section">
                <div class="strategy-section-title">💪 СИЛЬНЫЕ СТОРОНЫ</div>
                <ul class="strategy-list">${strengthsHtml}</ul>
            </div>
            
            <div class="strategy-section">
                <div class="strategy-section-title">📉 ЗОНЫ РОСТА</div>
                <ul class="strategy-list">${weaknessesHtml}</ul>
            </div>
            
            <div class="strategy-section">
                <div class="strategy-section-title">🤔 КАК ВЫ ПРИНИМАЕТЕ РЕШЕНИЯ</div>
                <div class="strategy-text">${thinkingInfo.decision_making}</div>
            </div>
            
            <div class="strategy-section">
                <div class="strategy-section-title">📋 СТИЛЬ ПЛАНИРОВАНИЯ</div>
                <div class="strategy-text">${thinkingInfo.planning_style}</div>
            </div>
        </div>
    `;
}

// ============================================
// 10. ВКЛАДКА "СТРАТЕГИЯ"
// ============================================
function renderStrategyTab() {
    if (!strategyState.currentStrategy) {
        return `
            <div class="strategy-empty">
                <div class="strategy-empty-emoji">🎯</div>
                <div class="strategy-empty-title">Стратегия не создана</div>
                <div class="strategy-empty-desc">Опишите вашу цель, и Фреди построит персональную стратегию</div>
                
                <textarea id="goalInput" class="strategy-goal-input" 
                    placeholder="Например: «Хочу открыть свой бизнес через 6 месяцев» или «Хочу сменить профессию на аналитика данных»"
                    rows="3"></textarea>
                
                <button id="generateStrategyBtn" class="strategy-generate-btn">
                    🎯 СОЗДАТЬ СТРАТЕГИЮ
                </button>
            </div>
        `;
    }
    
    const strategy = strategyState.currentStrategy;
    let stepsHtml = '';
    strategy.steps.forEach(step => {
        const isCompleted = strategyState.strategyProgress.includes(step.number);
        stepsHtml += `
            <div class="strategy-step">
                <div class="strategy-step-number">${step.number}</div>
                <div class="strategy-step-content">
                    <div class="strategy-step-title">${step.title}</div>
                    <div class="strategy-step-desc">${step.description}</div>
                    <div class="strategy-step-duration">⏱️ ${step.duration}</div>
                    <button class="strategy-step-complete ${isCompleted ? 'completed' : ''}" data-step="${step.number}">
                        ${isCompleted ? '✅ ВЫПОЛНЕНО' : '📌 ОТМЕТИТЬ ВЫПОЛНЕННЫМ'}
                    </button>
                </div>
            </div>
        `;
    });
    
    return `
        <div class="strategy-plan">
            <div class="strategy-plan-header">
                <div class="strategy-plan-name">🎯 ${strategy.strategy_name}</div>
                <div class="strategy-plan-desc">${strategy.description}</div>
                <div class="strategy-plan-meta">
                    <span>📅 ${strategy.timeline}</span>
                    <span>🏆 ${strategy.success_criteria}</span>
                </div>
            </div>
            
            <div class="strategy-steps">
                <div class="strategy-steps-title">📋 ПЛАН ДЕЙСТВИЙ</div>
                ${stepsHtml}
            </div>
            
            <div class="strategy-actions">
                <button id="newStrategyBtn" class="strategy-new-btn">
                    🔄 НОВАЯ СТРАТЕГИЯ
                </button>
                <button id="exportStrategyBtn" class="strategy-export-btn">
                    📥 ЭКСПОРТ
                </button>
            </div>
        </div>
    `;
}

// ============================================
// 11. ВКЛАДКА "КОГНИТИВНЫЕ ЛОВУШКИ"
// ============================================
function renderTrapsTab(thinkingInfo) {
    let trapsHtml = '';
    thinkingInfo.cognitive_traps.forEach(trap => {
        trapsHtml += `
            <div class="strategy-trap">
                <div class="strategy-trap-name">⚠️ ${trap.name}</div>
                <div class="strategy-trap-desc">${trap.description}</div>
                <div class="strategy-trap-solution">💡 Как обойти: ${getTrapSolution(trap.name, thinkingInfo.name)}</div>
            </div>
        `;
    });
    
    return `
        <div class="strategy-traps">
            <div class="strategy-traps-intro">
                <div class="strategy-traps-icon">🧠</div>
                <div class="strategy-traps-text">
                    Когнитивные ловушки — это автоматические ошибки мышления. 
                    Они свойственны вашему типу. Осознание — первый шаг к их преодолению.
                </div>
            </div>
            
            <div class="strategy-traps-list">
                ${trapsHtml}
            </div>
            
            <div class="strategy-traps-tip">
                💡 <strong>Совет:</strong> Когда замечаете одну из этих ловушек, сделайте паузу и спросите себя: 
                "Это факты или мои предположения? Есть ли альтернативные объяснения?"
            </div>
        </div>
    `;
}

function getTrapSolution(trapName, thinkingTypeName) {
    const solutions = {
        "Анализ паралич": "Установите таймер на принятие решения. Идеального плана не существует.",
        "Катастрофизация": "Запишите худший, лучший и наиболее вероятный сценарии. Оцените реальные риски.",
        "Синдром самозванца": "Вспомните 3 своих прошлых успеха. Вы заслуживаете того, что имеете.",
        "Туннельное видение": "Сознательно ищите информацию, которая противоречит вашей гипотезе.",
        "Гиперфокус на результате": "Запланируйте время на процесс и на людей. Результат не единственная цель.",
        "Ложная срочность": "Спросите себя: 'Что изменится, если я сделаю это завтра?'",
        "Перфекционизм": "Цель — 'хорошо', не 'идеально'. Идеал — враг готового.",
        "Сложностная перегрузка": "Правило Парето: 20% действий дают 80% результата. Начните с них.",
        "Эмоциональное заражение": "Сделайте паузу и спросите: 'Это моё чувство или чужое?'",
        "Созависимость": "Напоминайте себе: 'Их чувства — не моя ответственность'.",
        "Иллюзия контроля": "Сосредоточьтесь на том, что действительно в вашей власти."
    };
    
    return solutions[trapName] || "Осознайте ловушку и сделайте паузу перед решением.";
}

// ============================================
// 12. ВКЛАДКА "ТРЕКИНГ"
// ============================================
function renderTrackingTab() {
    if (!strategyState.currentStrategy || strategyState.currentStrategy.steps.length === 0) {
        return `
            <div class="strategy-empty">
                <div class="strategy-empty-emoji">📊</div>
                <div class="strategy-empty-title">Нет активной стратегии</div>
                <div class="strategy-empty-desc">Создайте стратегию во вкладке "СТРАТЕГИЯ"</div>
            </div>
        `;
    }
    
    const totalSteps = strategyState.currentStrategy.steps.length;
    const completedSteps = strategyState.strategyProgress.length;
    const progressPercent = (completedSteps / totalSteps) * 100;
    
    let stepsHtml = '';
    strategyState.currentStrategy.steps.forEach(step => {
        const isCompleted = strategyState.strategyProgress.includes(step.number);
        stepsHtml += `
            <div class="strategy-tracking-step ${isCompleted ? 'completed' : ''}">
                <div class="strategy-tracking-step-num">${step.number}</div>
                <div class="strategy-tracking-step-name">${step.title}</div>
                <div class="strategy-tracking-step-status">${isCompleted ? '✅' : '⏳'}</div>
            </div>
        `;
    });
    
    return `
        <div class="strategy-tracking">
            <div class="strategy-progress-card">
                <div class="strategy-progress-label">ОБЩИЙ ПРОГРЕСС</div>
                <div class="strategy-progress-bar">
                    <div class="strategy-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="strategy-progress-stats">
                    <span>✅ ${completedSteps}/${totalSteps} шагов</span>
                    <span>📊 ${Math.round(progressPercent)}%</span>
                </div>
            </div>
            
            <div class="strategy-tracking-list">
                <div class="strategy-tracking-title">ПОШАГОВЫЙ ПРОГРЕСС</div>
                ${stepsHtml}
            </div>
            
            <div class="strategy-tracking-actions">
                <button id="resetStrategyBtn" class="strategy-reset-btn">
                    🔄 СБРОСИТЬ ПРОГРЕСС
                </button>
            </div>
        </div>
    `;
}

// ============================================
// 13. ОБРАБОТЧИКИ
// ============================================
function setupStrategyHandlers() {
    // Генерация стратегии
    document.getElementById('generateStrategyBtn')?.addEventListener('click', async () => {
        const goalInput = document.getElementById('goalInput');
        const goal = goalInput?.value.trim();
        
        if (!goal) {
            showToastMessage('📝 Опишите вашу цель', 'warning');
            return;
        }
        
        const btn = document.getElementById('generateStrategyBtn');
        btn.disabled = true;
        btn.textContent = '⏳ ГЕНЕРИРУЮ СТРАТЕГИЮ...';
        
        showToastMessage('🧠 Фреди строит персональную стратегию...', 'info');
        
        const strategy = await generateStrategy(goal);
        
        if (strategy) {
            strategyState.currentStrategy = strategy;
            strategyState.strategyProgress = [];
            saveStrategy();
            showToastMessage('✅ Стратегия готова!', 'success');
            renderStrategyMainScreen(document.getElementById('screenContainer'));
        } else {
            showToastMessage('❌ Не удалось создать стратегию. Попробуйте позже.', 'error');
            btn.disabled = false;
            btn.textContent = '🎯 СОЗДАТЬ СТРАТЕГИЮ';
        }
    });
    
    // Отметка выполнения шага
    document.querySelectorAll('.strategy-step-complete').forEach(btn => {
        btn.addEventListener('click', () => {
            const stepNum = parseInt(btn.dataset.step);
            if (strategyState.strategyProgress.includes(stepNum)) {
                showToastMessage('⚠️ Этот шаг уже отмечен', 'warning');
                return;
            }
            
            strategyState.strategyProgress.push(stepNum);
            saveStrategy();
            showToastMessage(`✅ Шаг ${stepNum} выполнен!`, 'success');
            renderStrategyMainScreen(document.getElementById('screenContainer'));
        });
    });
    
    // Новая стратегия
    document.getElementById('newStrategyBtn')?.addEventListener('click', () => {
        strategyState.currentStrategy = null;
        strategyState.strategyProgress = [];
        saveStrategy();
        renderStrategyMainScreen(document.getElementById('screenContainer'));
    });
    
    // Экспорт стратегии
    document.getElementById('exportStrategyBtn')?.addEventListener('click', () => {
        if (!strategyState.currentStrategy) return;
        
        const strategy = strategyState.currentStrategy;
        let text = `🎯 СТРАТЕГИЯ: ${strategy.strategy_name}\n\n`;
        text += `${strategy.description}\n\n`;
        text += `📅 Срок: ${strategy.timeline}\n`;
        text += `🏆 Критерий успеха: ${strategy.success_criteria}\n\n`;
        text += `📋 ПЛАН ДЕЙСТВИЙ:\n`;
        strategy.steps.forEach(step => {
            const status = strategyState.strategyProgress.includes(step.number) ? '✅' : '⏳';
            text += `${status} Шаг ${step.number}: ${step.title}\n`;
            text += `   ${step.description}\n`;
            text += `   ⏱️ ${step.duration}\n\n`;
        });
        
        navigator.clipboard.writeText(text);
        showToastMessage('📋 Стратегия скопирована', 'success');
    });
    
    // Сброс прогресса
    document.getElementById('resetStrategyBtn')?.addEventListener('click', () => {
        if (confirm('Сбросить весь прогресс по стратегии?')) {
            strategyState.strategyProgress = [];
            saveStrategy();
            showToastMessage('🔄 Прогресс сброшен', 'info');
            renderStrategyMainScreen(document.getElementById('screenContainer'));
        }
    });
}

// ============================================
// 14. СТИЛИ
// ============================================
function addStrategyStyles() {
    if (document.getElementById('strategy-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'strategy-styles';
    style.textContent = `
        .strategy-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
        }
        .strategy-tab {
            flex: 1;
            padding: 10px 12px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
        }
        .strategy-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        
        .strategy-thinking-card {
            text-align: center;
            background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05));
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .strategy-thinking-emoji {
            font-size: 48px;
            margin-bottom: 12px;
        }
        .strategy-thinking-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .strategy-thinking-level {
            font-size: 12px;
            color: #ff6b3b;
            margin-bottom: 12px;
        }
        
        .strategy-section {
            margin-bottom: 20px;
        }
        .strategy-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .strategy-list {
            list-style: none;
            padding: 0;
        }
        .strategy-list li {
            padding: 6px 0;
            font-size: 13px;
        }
        .strategy-text {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
        }
        
        .strategy-empty {
            text-align: center;
            padding: 40px 20px;
        }
        .strategy-empty-emoji {
            font-size: 56px;
            margin-bottom: 16px;
        }
        .strategy-empty-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .strategy-empty-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }
        .strategy-goal-input {
            width: 100%;
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px;
            padding: 12px;
            color: white;
            font-size: 14px;
            margin-bottom: 16px;
            resize: vertical;
        }
        .strategy-generate-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            border-radius: 50px;
            color: white;
            font-weight: 600;
            cursor: pointer;
        }
        
        .strategy-plan-header {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .strategy-plan-name {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .strategy-plan-desc {
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        .strategy-plan-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 12px;
            color: #ff6b3b;
        }
        
        .strategy-steps {
            margin-bottom: 20px;
        }
        .strategy-steps-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .strategy-step {
            display: flex;
            gap: 12px;
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .strategy-step-number {
            width: 32px;
            height: 32px;
            background: rgba(255,107,59,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }
        .strategy-step-content {
            flex: 1;
        }
        .strategy-step-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .strategy-step-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 6px;
        }
        .strategy-step-duration {
            font-size: 10px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .strategy-step-complete {
            background: rgba(16,185,129,0.15);
            border: 1px solid rgba(16,185,129,0.3);
            border-radius: 30px;
            padding: 6px 12px;
            font-size: 11px;
            cursor: pointer;
        }
        .strategy-step-complete.completed {
            opacity: 0.5;
            cursor: default;
        }
        
        .strategy-trap {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .strategy-trap-name {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .strategy-trap-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .strategy-trap-solution {
            font-size: 11px;
            color: #10b981;
        }
        
        .strategy-progress-card {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .strategy-progress-label {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .strategy-progress-bar {
            height: 8px;
            background: rgba(224,224,224,0.1);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .strategy-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            border-radius: 4px;
            transition: width 0.3s;
        }
        .strategy-progress-stats {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        }
        
        .strategy-tracking-step {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            border-bottom: 1px solid rgba(224,224,224,0.05);
        }
        .strategy-tracking-step.completed {
            opacity: 0.6;
        }
        .strategy-tracking-step-num {
            width: 28px;
            height: 28px;
            background: rgba(224,224,224,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        .strategy-tracking-step-name {
            flex: 1;
            font-size: 13px;
        }
        
        .strategy-actions {
            display: flex;
            gap: 12px;
        }
        .strategy-new-btn, .strategy-export-btn, .strategy-reset-btn {
            flex: 1;
            padding: 12px;
            border-radius: 50px;
            font-size: 13px;
            cursor: pointer;
        }
        .strategy-new-btn, .strategy-export-btn {
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            color: white;
        }
        .strategy-reset-btn {
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.3);
            color: #ef4444;
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 15. ЗАПУСК ОБРАБОТЧИКОВ
// ============================================
function setupStrategyHandlersDelayed() {
    setTimeout(setupStrategyHandlers, 100);
}

const originalStrategyRender = renderStrategyMainScreen;
window.renderStrategyMainScreen = function(container) {
    originalStrategyRender(container);
    setupStrategyHandlersDelayed();
};

// ============================================
// 16. ЭКСПОРТ
// ============================================
window.showStrategyScreen = showStrategyScreen;

console.log('✅ Модуль "Стратегия" загружен (strategy.js v1.0)');
