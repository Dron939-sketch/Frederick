// ============================================
// hormones.js — Провокативная гормональная терапия
// Версия 2.0 — AI-генерация заданий
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let hormonesState = {
    isLoading: false,
    activeTab: 'diagnostic', // 'diagnostic', 'task', 'result', 'history'
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    thinkingLevel: 5,
    profileType: 'АНАЛИТИК',
    userName: 'Пользователь',
    userGender: 'other',
    userAge: null,
    selectedSymptoms: [],
    currentTask: null,
    taskHistory: [],
    lastTaskResult: null
};

// ============================================
// 2. БАЗА СИМПТОМОВ
// ============================================
const SYMPTOMS = [
    { id: "anxiety", emoji: "😰", name: "Тревога", description: "Беспокойство, напряжение, чувство, что что-то пойдёт не так" },
    { id: "apathy", emoji: "😴", name: "Апатия", description: "Безразличие, отсутствие желания что-либо делать" },
    { id: "no_motivation", emoji: "⚡", name: "Нет мотивации", description: "Не хватает энергии и желания действовать" },
    { id: "insomnia", emoji: "🌙", name: "Бессонница", description: "Трудности с засыпанием или частые пробуждения" },
    { id: "sadness", emoji: "😢", name: "Печаль", description: "Грусть, тоска, чувство пустоты" },
    { id: "irritation", emoji: "🔥", name: "Раздражение", description: "Всё бесит, хочется взорваться" },
    { id: "sugar_craving", emoji: "🍫", name: "Тяга к сладкому", description: "Постоянное желание съесть что-то сладкое" },
    { id: "loneliness", emoji: "💔", name: "Одиночество", description: "Чувство, что ты один и никто не понимает" },
    { id: "procrastination", emoji: "⏰", name: "Прокрастинация", description: "Откладываю дела на потом, не могу начать" },
    { id: "bad_mood", emoji: "😞", name: "Плохое настроение", description: "Всё валится из рук, ничего не радует" },
    { id: "fear_decision", emoji: "🤔", name: "Страх решения", description: "Боюсь сделать неправильный выбор" },
    { id: "fatigue", emoji: "🫠", name: "Хроническая усталость", description: "Постоянно чувствую себя выжатым" }
];

// ============================================
// 3. БАЗА ТИПОВ ПРОВОКАЦИЙ (для fallback)
// ============================================
const PROVOCATION_TYPES = {
    anxiety: {
        hormone: "Кортизол ↑, Дофамин ↓",
        mechanism: "Кратковременный социальный стресс → преодоление → дофамин",
        examples: [
            { text: "прочитать стих вслух в общественном месте", duration: "30 сек", risk: "medium" },
            { text: "сказать 'Привет' незнакомцу", duration: "5 сек", risk: "low" },
            { text: "громко спеть 2 строчки из песни в лифте", duration: "10 сек", risk: "medium" }
        ]
    },
    apathy: {
        hormone: "Дофамин ↓, Серотонин ↓",
        mechanism: "Физическая активность + маленькая победа → дофамин",
        examples: [
            { text: "сделать 10 приседаний в любом месте", duration: "20 сек", risk: "low" },
            { text: "написать кому-то 'Ты классный'", duration: "10 сек", risk: "low" },
            { text: "убрать одну вещь на место", duration: "1 мин", risk: "low" }
        ]
    },
    irritation: {
        hormone: "Кортизол ↑, Тестостерон ↑",
        mechanism: "Физическая разрядка → снижение кортизола",
        examples: [
            { text: "громко сказать 'Хватит!' в пустой комнате", duration: "5 сек", risk: "low" },
            { text: "порычать как лев", duration: "10 сек", risk: "low" },
            { text: "сжать и разжать кулаки 20 раз", duration: "15 сек", risk: "low" }
        ]
    },
    insomnia: {
        hormone: "Мелатонин ↓, Кортизол ↑",
        mechanism: "Сенсорная стимуляция + снижение света",
        examples: [
            { text: "выпить тёплое молоко с мёдом", duration: "2 мин", risk: "low" },
            { text: "помассировать мочки ушей 1 минуту", duration: "1 мин", risk: "low" },
            { text: "посмотреть на темное небо", duration: "1 мин", risk: "low" }
        ]
    },
    sugar_craving: {
        hormone: "Серотонин ↓, Инсулин ↑",
        mechanism: "Вкусовая провокация (горечь/кислота) → переключение",
        examples: [
            { text: "съесть ломтик лимона", duration: "30 сек", risk: "low" },
            { text: "выпить стакан воды с лимоном", duration: "1 мин", risk: "low" },
            { text: "съесть кусочек тёмного шоколада (70%+)", duration: "30 сек", risk: "low" }
        ]
    },
    procrastination: {
        hormone: "Дофамин ↓",
        mechanism: "Прорыв через сопротивление → дофамин",
        examples: [
            { text: "сделать самое страшное дело 2 минуты", duration: "2 мин", risk: "low" },
            { text: "написать первый абзац того, что откладываете", duration: "2 мин", risk: "low" },
            { text: "установить таймер на 5 минут и начать", duration: "5 мин", risk: "low" }
        ]
    },
    loneliness: {
        hormone: "Окситоцин ↓",
        mechanism: "Социальный контакт → окситоцин",
        examples: [
            { text: "улыбнуться незнакомцу", duration: "2 сек", risk: "low" },
            { text: "написать 'Как ты?' кому-то из друзей", duration: "1 мин", risk: "low" },
            { text: "обнять себя (самообъятие) на 30 секунд", duration: "30 сек", risk: "low" }
        ]
    },
    default: {
        hormone: "Дисбаланс нейромедиаторов",
        mechanism: "Действие через тело → изменение состояния",
        examples: [
            { text: "сделать 5 глубоких вдохов", duration: "30 сек", risk: "low" },
            { text: "выйти на свежий воздух на 2 минуты", duration: "2 мин", risk: "low" },
            { text: "выпить стакан воды комнатной температуры", duration: "1 мин", risk: "low" }
        ]
    }
};

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
// 5. ЗАГРУЗКА ПРОФИЛЯ
// ============================================
async function loadUserProfileForHormones() {
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
        
        hormonesState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        hormonesState.thinkingLevel = profile.thinking_level || 5;
        hormonesState.profileType = profile.perception_type || 'АНАЛИТИК';
        hormonesState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        hormonesState.userGender = context.gender || 'other';
        hormonesState.userAge = context.age || null;
        
        // Загружаем историю
        const savedHistory = localStorage.getItem(`hormones_history_${userId}`);
        if (savedHistory) {
            hormonesState.taskHistory = JSON.parse(savedHistory);
        }
        
        console.log('📊 Данные для гормонального модуля:', hormonesState);
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 6. ОПРЕДЕЛЕНИЕ ДОМИНАНТНОГО ВЕКТОРА
// ============================================
function getDominantVector() {
    const v = hormonesState.userVectors;
    const entries = Object.entries(v);
    const maxVector = entries.reduce((max, current) => 
        current[1] > max[1] ? current : max, entries[0]);
    return maxVector[0];
}

// ============================================
// 7. AI-ГЕНЕРАЦИЯ ПРОВОКАТИВНОГО ЗАДАНИЯ
// ============================================
async function generateProvocativeTask(symptoms) {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    const dominantVector = getDominantVector();
    const v = hormonesState.userVectors;
    
    const symptomNames = symptoms.map(s => s.name).join(', ');
    const symptomIds = symptoms.map(s => s.id);
    
    // Определяем основной гормональный паттерн
    let hormonePattern = "";
    if (symptomIds.includes('anxiety') || symptomIds.includes('insomnia')) {
        hormonePattern = "Кортизол ↑, Дофамин ↓";
    } else if (symptomIds.includes('apathy') || symptomIds.includes('no_motivation') || symptomIds.includes('procrastination')) {
        hormonePattern = "Дофамин ↓, Серотонин ↓";
    } else if (symptomIds.includes('irritation')) {
        hormonePattern = "Кортизол ↑, Тестостерон ↑";
    } else if (symptomIds.includes('sugar_craving')) {
        hormonePattern = "Серотонин ↓, Инсулин ↑";
    } else if (symptomIds.includes('loneliness')) {
        hormonePattern = "Окситоцин ↓";
    } else {
        hormonePattern = "Дисбаланс нейромедиаторов";
    }
    
    const prompt = `Ты — Фреди, виртуальный психолог, специалист по провокативной терапии и гормональной регуляции.

ПОЛЬЗОВАТЕЛЬ:
- Имя: ${hormonesState.userName}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Доминантный вектор: ${dominantVector}
- Уровень мышления: ${hormonesState.thinkingLevel}/9

СИМПТОМЫ: ${symptomNames}
ГОРМОНАЛЬНЫЙ ПАТТЕРН: ${hormonePattern}

ЗАДАНИЕ:
Создай ПРОВОКАТИВНОЕ задание, которое поможет пользователю:
1. Кратковременно повысить уровень стресса (для последующего снижения)
2. Получить выброс дофамина/эндорфинов после выполнения
3. Разорвать порочный круг симптом → избегание

ТРЕБОВАНИЯ К ЗАДАНИЮ:
- Конкретное, выполнимое за 1-2 минуты
- Безопасное, но слегка выходящее из зоны комфорта
- Учитывай профиль пользователя (для СБ — не слишком социально рискованное, для ЧВ — с акцентом на контакт)
- Не используй сложные реквизиты

СХЕМА ОТВЕТА (JSON):
{
    "task": "Конкретное задание (например: 'съесть ломтик лимона')",
    "duration": "время в секундах/минутах",
    "hormone_mechanism": "Краткое объяснение гормонального механизма (1 предложение)",
    "why_it_works": "Развёрнутое объяснение, почему это работает (2-3 предложения)",
    "instruction": "Пошаговая инструкция выполнения",
    "risk_level": "low/medium"
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
                temperature: 0.8
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            let jsonStr = data.content;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const task = JSON.parse(jsonStr);
            return task;
        }
    } catch (error) {
        console.error('Error generating task:', error);
    }
    
    // Fallback
    return getFallbackTask(symptomIds);
}

function getFallbackTask(symptomIds) {
    if (symptomIds.includes('anxiety')) {
        return {
            task: "прочитать стихотворение вслух в общественном месте",
            duration: "30 секунд",
            hormone_mechanism: "Кратковременный стресс → преодоление → дофамин",
            why_it_works: "Когда вы делаете то, что вызывает страх, кортизол сначала повышается, а затем резко падает. На смену приходит дофамин — гормон награды за смелость.",
            instruction: "Выберите короткое стихотворение (2-4 строки). Найдите место, где есть люди (автобус, очередь, лифт). Громко и чётко прочитайте стих. Не ждите реакции, просто сделайте и идите дальше.",
            risk_level: "medium"
        };
    } else if (symptomIds.includes('sugar_craving')) {
        return {
            task: "съесть ломтик лимона",
            duration: "30 секунд",
            hormone_mechanism: "Кислота → кратковременный стресс → эндорфины",
            why_it_works: "Кислый вкус вызывает мгновенную реакцию нервной системы — кратковременный стресс. Организм компенсирует его выбросом эндорфинов. Тяга к сладкому снижается, так как мозг получает награду из другого источника.",
            instruction: "Возьмите ломтик лимона. Положите в рот. Ничем не заедайте. Почувствуйте кислый вкус. Сделайте глотательное движение. Поздравьте себя.",
            risk_level: "low"
        };
    } else if (symptomIds.includes('apathy') || symptomIds.includes('no_motivation')) {
        return {
            task: "сделать 10 приседаний",
            duration: "20 секунд",
            hormone_mechanism: "Физическая активность → дофамин + эндорфины",
            why_it_works: "Движение запускает выработку дофамина (мотивация) и эндорфинов (легкость). После 10 приседаний кровь разгоняется, мозг получает сигнал 'я жив и активен'.",
            instruction: "Встаньте прямо. Сделайте 10 приседаний в любом темпе. После последнего глубоко вдохните и скажите про себя 'Я сделал это'.",
            risk_level: "low"
        };
    } else if (symptomIds.includes('loneliness')) {
        return {
            task: "улыбнуться незнакомцу",
            duration: "2 секунды",
            hormone_mechanism: "Социальный контакт → окситоцин",
            why_it_works: "Улыбка — это социальный сигнал, который запускает зеркальные нейроны. Даже если человек не улыбнётся в ответ, ваша собственная улыбка уже стимулирует выработку окситоцина.",
            instruction: "Выйдите на улицу или в общественное место. Выберите случайного прохожего. Поймайте его взгляд. Тепло улыбнитесь. Отведите взгляд. Не ждите реакции.",
            risk_level: "low"
        };
    } else {
        return {
            task: "сделать 5 глубоких вдохов",
            duration: "30 секунд",
            hormone_mechanism: "Глубокое дыхание → снижение кортизола",
            why_it_works: "Медленное глубокое дыхание активирует парасимпатическую нервную систему, которая отвечает за расслабление. Кортизол снижается, появляется ясность.",
            instruction: "Сядьте удобно. Вдох на 4 счёта. Задержка на 4. Выдох на 6. Повторите 5 раз. После последнего выдоха отметьте, как изменилось состояние.",
            risk_level: "low"
        };
    }
}

// ============================================
// 8. ОСНОВНОЙ ЭКРАН
// ============================================
async function showHormonesScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForHormones();
    renderDiagnosticScreen(container);
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

function renderDiagnosticScreen(container) {
    let symptomsHtml = '';
    SYMPTOMS.forEach(symptom => {
        symptomsHtml += `
            <div class="hormone-symptom" data-symptom-id="${symptom.id}">
                <span class="hormone-symptom-emoji">${symptom.emoji}</span>
                <span class="hormone-symptom-name">${symptom.name}</span>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="full-content-page" id="hormonesScreen">
            <button class="back-btn" id="hormonesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🧬</div>
                <h1>Гормоны</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Биохимический детокс через действие
                </div>
            </div>
            
            <div class="hormones-tabs">
                <button class="hormones-tab ${hormonesState.activeTab === 'diagnostic' ? 'active' : ''}" data-tab="diagnostic">
                    🔍 ДИАГНОСТИКА
                </button>
                <button class="hormones-tab ${hormonesState.activeTab === 'task' ? 'active' : ''}" data-tab="task">
                    ⚡ ЗАДАНИЕ
                </button>
                <button class="hormones-tab ${hormonesState.activeTab === 'history' ? 'active' : ''}" data-tab="history">
                    📜 ИСТОРИЯ
                </button>
                <button class="hormones-tab ${hormonesState.activeTab === 'info' ? 'active' : ''}" data-tab="info">
                    🧠 ПРИНЦИП
                </button>
            </div>
            
            <div class="hormones-content" id="hormonesContent">
                ${hormonesState.activeTab === 'diagnostic' ? renderSymptomsSelection(symptomsHtml) : ''}
                ${hormonesState.activeTab === 'task' ? renderTaskScreen() : ''}
                ${hormonesState.activeTab === 'history' ? renderHistoryScreen() : ''}
                ${hormonesState.activeTab === 'info' ? renderInfoScreen() : ''}
            </div>
        </div>
    `;
    
    addHormonesStyles();
    
    document.getElementById('hormonesBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.querySelectorAll('.hormones-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            hormonesState.activeTab = tab.dataset.tab;
            renderDiagnosticScreen(container);
        });
    });
    
    // Обработчики выбора симптомов
    document.querySelectorAll('.hormone-symptom').forEach(symptom => {
        symptom.addEventListener('click', () => {
            symptom.classList.toggle('selected');
            const symptomId = symptom.dataset.symptomId;
            const symptomData = SYMPTOMS.find(s => s.id === symptomId);
            
            if (symptom.classList.contains('selected')) {
                if (!hormonesState.selectedSymptoms.some(s => s.id === symptomId)) {
                    hormonesState.selectedSymptoms.push(symptomData);
                }
            } else {
                hormonesState.selectedSymptoms = hormonesState.selectedSymptoms.filter(s => s.id !== symptomId);
            }
            
            const nextBtn = document.getElementById('nextToTaskBtn');
            if (nextBtn && hormonesState.selectedSymptoms.length > 0) {
                nextBtn.style.display = 'block';
            } else if (nextBtn) {
                nextBtn.style.display = 'none';
            }
        });
    });
}

function renderSymptomsSelection(symptomsHtml) {
    return `
        <div class="hormones-diagnostic">
            <div class="hormones-diagnostic-title">🎯 Что вы чувствуете сейчас?</div>
            <div class="hormones-diagnostic-desc">Выберите все симптомы, которые актуальны в данный момент</div>
            <div class="hormones-symptoms-grid">
                ${symptomsHtml}
            </div>
            <button id="nextToTaskBtn" class="hormones-next-btn" style="display: none;">
                🎯 ПОЛУЧИТЬ ЗАДАНИЕ
            </button>
        </div>
    `;
}

function renderTaskScreen() {
    if (!hormonesState.currentTask) {
        return `
            <div class="hormones-empty">
                <div class="hormones-empty-emoji">⚡</div>
                <div class="hormones-empty-title">Нет активного задания</div>
                <div class="hormones-empty-desc">Сначала выберите симптомы во вкладке "ДИАГНОСТИКА"</div>
                <button class="hormones-empty-btn" data-tab="diagnostic">🔍 ПЕРЕЙТИ К ДИАГНОСТИКЕ</button>
            </div>
        `;
    }
    
    const task = hormonesState.currentTask;
    
    return `
        <div class="hormones-task">
            <div class="hormones-task-card">
                <div class="hormones-task-icon">🎯</div>
                <div class="hormones-task-title">ВАШЕ ПРОВОКАТИВНОЕ ЗАДАНИЕ</div>
                <div class="hormones-task-text">${task.task}</div>
                <div class="hormones-task-duration">⏱️ Длительность: ${task.duration}</div>
                <div class="hormones-task-risk ${task.risk_level === 'medium' ? 'risk-medium' : 'risk-low'}">
                    ${task.risk_level === 'medium' ? '⚠️ Требуется немного смелости' : '🟢 Безопасно, можно выполнить прямо сейчас'}
                </div>
            </div>
            
            <div class="hormones-mechanism">
                <div class="hormones-mechanism-title">🧠 ГОРМОНАЛЬНЫЙ МЕХАНИЗМ</div>
                <div class="hormones-mechanism-text">${task.hormone_mechanism}</div>
                <div class="hormones-mechanism-explanation">${task.why_it_works}</div>
            </div>
            
            <div class="hormones-instruction">
                <div class="hormones-instruction-title">📋 ИНСТРУКЦИЯ</div>
                <div class="hormones-instruction-text">${task.instruction}</div>
            </div>
            
            <div class="hormones-task-actions">
                <button id="completeTaskBtn" class="hormones-complete-btn">
                    ✅ ВЫПОЛНИЛ
                </button>
                <button id="skipTaskBtn" class="hormones-skip-btn">
                    🔄 ДРУГОЕ ЗАДАНИЕ
                </button>
            </div>
        </div>
    `;
}

function renderHistoryScreen() {
    if (hormonesState.taskHistory.length === 0) {
        return `
            <div class="hormones-empty">
                <div class="hormones-empty-emoji">📜</div>
                <div class="hormones-empty-title">История пуста</div>
                <div class="hormones-empty-desc">Выполните задания, и они появятся здесь</div>
            </div>
        `;
    }
    
    let historyHtml = '';
    hormonesState.taskHistory.slice().reverse().forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString('ru-RU');
        const resultEmoji = entry.result === 'better' ? '😊' : entry.result === 'much_better' ? '🎉' : '🤔';
        historyHtml += `
            <div class="hormones-history-item">
                <div class="hormones-history-date">📅 ${date}</div>
                <div class="hormones-history-task">${entry.task}</div>
                <div class="hormones-history-result">${resultEmoji} ${entry.result_text}</div>
            </div>
        `;
    });
    
    return `
        <div class="hormones-history">
            <div class="hormones-history-title">📜 ВАШИ ПРОВОКАЦИИ</div>
            <div class="hormones-history-list">
                ${historyHtml}
            </div>
            <button id="clearHistoryBtn" class="hormones-clear-btn">
                🗑️ ОЧИСТИТЬ ИСТОРИЮ
            </button>
        </div>
    `;
}

function renderInfoScreen() {
    return `
        <div class="hormones-info">
            <div class="hormones-info-card">
                <div class="hormones-info-icon">🧠</div>
                <div class="hormones-info-title">ПРИНЦИП "ТОТ, КТО МЕШАЕТ — ПОМОЖЕТ"</div>
                <div class="hormones-info-text">
                    Когда вы избегаете того, что вызывает страх или дискомфорт, кортизол (гормон стресса) 
                    остаётся повышенным, а дофамин (гормон мотивации) — пониженным.
                    <br><br>
                    <strong>Парадоксальный эффект:</strong> если вы намеренно делаете то, чего боитесь 
                    (в безопасном формате), вы запускаете каскад:
                    <br><br>
                    1️⃣ Короткий всплеск кортизола (стресс от действия)<br>
                    2️⃣ Преодоление сопротивления (активация префронтальной коры)<br>
                    3️⃣ Выброс дофамина (награда за смелость)<br>
                    4️⃣ Снижение базового уровня кортизола (эффект "я справился")<br>
                    5️⃣ Формирование новой нейронной связи (смелость → награда)
                </div>
            </div>
            
            <div class="hormones-info-card">
                <div class="hormones-info-icon">⚡</div>
                <div class="hormones-info-title">ПОЧЕМУ ЭТО РАБОТАЕТ БЫСТРЕЕ, ЧЕМ ОБЫЧНЫЕ СОВЕТЫ?</div>
                <div class="hormones-info-text">
                    Обычные советы ("расслабься", "не переживай") работают через сознание — медленно и слабо.
                    <br><br>
                    Провокативные задания работают через тело и действие — быстро и мощно. 
                    Вы не думаете о том, как перестать тревожиться. Вы делаете то, что тревожно, 
                    и тревога отступает сама.
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 9. ОБРАБОТЧИКИ
// ============================================
function setupHormonesHandlers() {
    // Кнопка "Получить задание"
    document.getElementById('nextToTaskBtn')?.addEventListener('click', async () => {
        if (hormonesState.selectedSymptoms.length === 0) {
            showToastMessage('Выберите хотя бы один симптом', 'warning');
            return;
        }
        
        const btn = document.getElementById('nextToTaskBtn');
        btn.disabled = true;
        btn.textContent = '⏳ ГЕНЕРИРУЮ ЗАДАНИЕ...';
        
        showToastMessage('🧠 Анализирую ваше состояние...', 'info');
        
        const task = await generateProvocativeTask(hormonesState.selectedSymptoms);
        hormonesState.currentTask = task;
        hormonesState.activeTab = 'task';
        
        renderDiagnosticScreen(document.getElementById('screenContainer'));
    });
    
    // Выполнение задания
    document.getElementById('completeTaskBtn')?.addEventListener('click', () => {
        // Сохраняем в историю
        hormonesState.taskHistory.push({
            date: new Date().toISOString(),
            task: hormonesState.currentTask.task,
            symptoms: hormonesState.selectedSymptoms.map(s => s.name),
            result: null,
            result_text: null
        });
        
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        localStorage.setItem(`hormones_history_${userId}`, JSON.stringify(hormonesState.taskHistory));
        
        // Очищаем текущее задание и симптомы
        hormonesState.currentTask = null;
        hormonesState.selectedSymptoms = [];
        
        showToastMessage('✅ Отлично! Как изменилось состояние?', 'success');
        
        // Показываем форму оценки
        showResultModal();
    });
    
    // Пропуск / новое задание
    document.getElementById('skipTaskBtn')?.addEventListener('click', async () => {
        showToastMessage('🔄 Генерирую другое задание...', 'info');
        
        const task = await generateProvocativeTask(hormonesState.selectedSymptoms);
        hormonesState.currentTask = task;
        renderDiagnosticScreen(document.getElementById('screenContainer'));
    });
    
    // Очистка истории
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
        if (confirm('Очистить всю историю заданий?')) {
            hormonesState.taskHistory = [];
            const userId = window.CONFIG?.USER_ID || window.USER_ID;
            localStorage.setItem(`hormones_history_${userId}`, JSON.stringify([]));
            renderDiagnosticScreen(document.getElementById('screenContainer'));
            showToastMessage('🗑️ История очищена', 'info');
        }
    });
    
    // Переключение по кнопкам в пустых состояниях
    document.querySelectorAll('.hormones-empty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) {
                hormonesState.activeTab = tab;
                renderDiagnosticScreen(document.getElementById('screenContainer'));
            }
        });
    });
}

function showResultModal() {
    const modal = document.createElement('div');
    modal.className = 'hormones-modal';
    modal.innerHTML = `
        <div class="hormones-modal-content">
            <div class="hormones-modal-header">
                <span>📊 Как вы себя чувствуете?</span>
                <button class="hormones-modal-close">✕</button>
            </div>
            <div class="hormones-modal-body">
                <div class="hormones-modal-question">После выполнения задания:</div>
                <div class="hormones-modal-options">
                    <button class="hormones-result-btn" data-result="much_better">🎉 Стало намного лучше</button>
                    <button class="hormones-result-btn" data-result="better">😊 Стало немного лучше</button>
                    <button class="hormones-result-btn" data-result="same">🤔 Ничего не изменилось</button>
                    <button class="hormones-result-btn" data-result="worse">😟 Стало хуже</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.hormones-modal-close').onclick = () => modal.remove();
    
    modal.querySelectorAll('.hormones-result-btn').forEach(btn => {
        btn.onclick = () => {
            const result = btn.dataset.result;
            const resultText = btn.textContent;
            
            // Обновляем последнюю запись в истории
            if (hormonesState.taskHistory.length > 0) {
                hormonesState.taskHistory[hormonesState.taskHistory.length - 1].result = result;
                hormonesState.taskHistory[hormonesState.taskHistory.length - 1].result_text = resultText;
                const userId = window.CONFIG?.USER_ID || window.USER_ID;
                localStorage.setItem(`hormones_history_${userId}`, JSON.stringify(hormonesState.taskHistory));
            }
            
            modal.remove();
            hormonesState.activeTab = 'history';
            renderDiagnosticScreen(document.getElementById('screenContainer'));
            
            if (result === 'much_better' || result === 'better') {
                showToastMessage('🎉 Отлично! Вы использовали свой страх как топливо!', 'success');
            } else if (result === 'worse') {
                showToastMessage('🤔 Спасибо за честность. Попробуйте другое задание.', 'info');
            }
        };
    });
}

// ============================================
// 10. СТИЛИ
// ============================================
function addHormonesStyles() {
    if (document.getElementById('hormones-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hormones-styles';
    style.textContent = `
        .hormones-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
        }
        .hormones-tab {
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
        .hormones-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        
        .hormones-diagnostic-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .hormones-diagnostic-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }
        .hormones-symptoms-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 24px;
        }
        .hormone-symptom {
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        .hormone-symptom:hover {
            background: rgba(255,107,59,0.1);
        }
        .hormone-symptom.selected {
            background: rgba(255,107,59,0.25);
            border-color: rgba(255,107,59,0.5);
        }
        .hormone-symptom-emoji {
            font-size: 18px;
        }
        .hormone-symptom-name {
            font-size: 12px;
        }
        .hormones-next-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            border-radius: 50px;
            color: white;
            font-weight: 600;
            cursor: pointer;
        }
        
        .hormones-task-card {
            background: linear-gradient(135deg, rgba(255,107,59,0.15), rgba(255,59,59,0.05));
            border-radius: 28px;
            padding: 24px;
            text-align: center;
            margin-bottom: 20px;
        }
        .hormones-task-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }
        .hormones-task-title {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 2px;
            color: #ff6b3b;
            margin-bottom: 12px;
        }
        .hormones-task-text {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .hormones-task-duration {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        .hormones-task-risk {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 30px;
            font-size: 11px;
        }
        .risk-low {
            background: rgba(16,185,129,0.15);
            color: #10b981;
        }
        .risk-medium {
            background: rgba(245,158,11,0.15);
            color: #f59e0b;
        }
        
        .hormones-mechanism, .hormones-instruction {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 18px;
            margin-bottom: 16px;
        }
        .hormones-mechanism-title, .hormones-instruction-title {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1px;
            color: #ff6b3b;
            margin-bottom: 10px;
        }
        .hormones-mechanism-text {
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 10px;
        }
        .hormones-mechanism-explanation {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
        }
        .hormones-instruction-text {
            font-size: 13px;
            line-height: 1.5;
        }
        
        .hormones-task-actions {
            display: flex;
            gap: 12px;
        }
        .hormones-complete-btn, .hormones-skip-btn {
            flex: 1;
            padding: 14px;
            border-radius: 50px;
            font-weight: 600;
            cursor: pointer;
        }
        .hormones-complete-btn {
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            color: white;
        }
        .hormones-skip-btn {
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            color: white;
        }
        
        .hormones-history-item {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .hormones-history-date {
            font-size: 10px;
            color: var(--text-secondary);
            margin-bottom: 6px;
        }
        .hormones-history-task {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        .hormones-history-result {
            font-size: 12px;
        }
        .hormones-clear-btn {
            width: 100%;
            padding: 12px;
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 50px;
            color: #ef4444;
            cursor: pointer;
        }
        
        .hormones-info-card {
            background: rgba(224,224,224,0.05);
            border-radius: 24px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .hormones-info-icon {
            font-size: 40px;
            margin-bottom: 12px;
        }
        .hormones-info-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        .hormones-info-text {
            font-size: 13px;
            line-height: 1.6;
            color: var(--text-secondary);
        }
        
        .hormones-empty {
            text-align: center;
            padding: 60px 20px;
        }
        .hormones-empty-emoji {
            font-size: 56px;
            margin-bottom: 16px;
        }
        .hormones-empty-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .hormones-empty-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }
        .hormones-empty-btn {
            padding: 12px 24px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            border-radius: 50px;
            color: white;
            font-weight: 600;
            cursor: pointer;
        }
        
        .hormones-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }
        .hormones-modal-content {
            background: #1a1a1a;
            border-radius: 28px;
            max-width: 400px;
            width: 90%;
            border: 1px solid rgba(224,224,224,0.2);
        }
        .hormones-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(224,224,224,0.1);
            font-weight: 600;
        }
        .hormones-modal-body {
            padding: 20px;
        }
        .hormones-modal-question {
            font-size: 14px;
            margin-bottom: 16px;
        }
        .hormones-modal-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .hormones-result-btn {
            padding: 12px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 50px;
            color: white;
            font-size: 14px;
            cursor: pointer;
        }
        .hormones-modal-close {
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
        }
        
        @media (max-width: 768px) {
            .hormones-symptoms-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .hormones-task-text {
                font-size: 16px;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 11. ЗАПУСК ОБРАБОТЧИКОВ
// ============================================
function setupHormonesHandlersDelayed() {
    setTimeout(setupHormonesHandlers, 100);
}

const originalHormonesRender = renderDiagnosticScreen;
window.renderDiagnosticScreen = function(container) {
    originalHormonesRender(container);
    setupHormonesHandlersDelayed();
};

// ============================================
// 12. ЭКСПОРТ
// ============================================
window.showHormonesScreen = showHormonesScreen;

console.log('✅ Модуль "Гормоны" загружен (hormones.js v2.0)');
