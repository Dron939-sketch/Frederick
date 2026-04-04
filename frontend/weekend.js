// ============================================
// weekend.js — Идеи на выходные с учётом профиля
// Версия 1.0 — адаптировано из MAX бота
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let weekendState = {
    ideas: null,
    lastGenerated: null,
    mainVector: null,
    mainLevel: null,
    isLoading: false,
    currentIdeas: [],
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 }
};

// ============================================
// 2. БАЗА ИДЕЙ ПО ВЕКТОРАМ (FALLBACK)
// ============================================

const FALLBACK_IDEAS = {
    "СБ": {
        name: "ГАРМОНИЯ И СПОКОЙСТВИЕ",
        emoji: "🌿",
        ideas: [
            "🚶 Прогулка в новом месте (парк, район, где вы не были)",
            "📝 Написать список своих границ и подумать, где их нарушают",
            "🧘 Практика заземления: походить босиком по траве/полу",
            "🎬 Посмотреть фильм, где герой преодолевает страх",
            "🤝 Пригласить друга в гости или сходить самому",
            "🕯️ Устроить вечер без соцсетей с книгой или музыкой",
            "🌸 Посетить цветочный магазин и купить себе букет",
            "🧘‍♀️ Попробовать дыхательную гимнастику"
        ]
    },
    "ТФ": {
        name: "РЕСУРСЫ И ИЗОБИЛИЕ",
        emoji: "💰",
        ideas: [
            "💰 Разобрать свои финансы за месяц",
            "📚 Почитать книгу по финансовой грамотности",
            "🛒 Сходить в магазин с конкретным списком (без импульсивных покупок)",
            "💡 Придумать 3 идеи дополнительного дохода",
            "🎁 Сделать подарок себе в рамках бюджета",
            "📊 Составить финансовый план на месяц",
            "🏦 Изучить способы пассивного дохода",
            "📈 Посмотреть лекцию об инвестициях"
        ]
    },
    "УБ": {
        name: "ПОЗНАНИЕ И СМЫСЛЫ",
        emoji: "📚",
        ideas: [
            "📖 Почитать книгу по психологии или философии",
            "🧩 Посмотреть документальный фильм на новую тему",
            "✍️ Написать эссе 'Что для меня важно'",
            "🗣 Поговорить с мудрым человеком",
            "🌌 Посмотреть на звёзды и подумать о вечном",
            "🎓 Пройти бесплатный онлайн-курс",
            "🔬 Посетить научно-популярную лекцию",
            "🧠 Изучить новую тему, которая давно интересовала"
        ]
    },
    "ЧВ": {
        name: "ОТНОШЕНИЯ И ТЕПЛО",
        emoji: "🤝",
        ideas: [
            "👥 Встретиться с друзьями, которых давно не видели",
            "📞 Позвонить родным просто так",
            "🤗 Сделать комплимент незнакомцу",
            "🍵 Пригласить коллегу на чай",
            "💌 Написать письмо благодарности кому-то",
            "🎲 Устроить настольные игры с семьёй",
            "🐱 Сходить в приют для животных",
            "🍰 Испечь что-то и угостить соседей"
        ]
    }
};

// Общие идеи для всех типов
const COMMON_IDEAS = [
    "🛁 Устроить день спа-процедур дома",
    "🎨 Попробовать новое хобби (рисование, лепка, вышивание)",
    "🚲 Отправиться на велопрогулку",
    "🍳 Приготовить новое блюдо по рецепту",
    "🎧 Послушать подкаст на интересную тему",
    "📝 Написать список целей на следующую неделю",
    "🧹 Устроить генеральную уборку и избавиться от лишнего",
    "🎬 Устроить киномарафон с любимыми фильмами"
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
async function loadUserVectorsForWeekend() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        const response = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const data = await response.json();
        
        const profile = data.profile || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        weekendState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        console.log('📊 Векторы для подбора идей:', weekendState.userVectors);
    } catch (error) {
        console.warn('Failed to load user vectors:', error);
        weekendState.userVectors = { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 };
    }
}

// ============================================
// 5. ОПРЕДЕЛЕНИЕ ОСНОВНОГО ВЕКТОРА (СЛАБОГО)
// ============================================
function getMainVectorAndLevel(vectors) {
    // Находим самый слабый вектор (наименьшее значение)
    const entries = Object.entries(vectors);
    const minVector = entries.reduce((min, current) => 
        current[1] < min[1] ? current : min, entries[0]);
    
    const mainVector = minVector[0];
    const score = minVector[1];
    
    // Преобразуем балл 1-6 в уровень 1-6
    let level = Math.round(score);
    if (level < 1) level = 1;
    if (level > 6) level = 6;
    
    return { mainVector, level, score };
}

// ============================================
// 6. ГЕНЕРАЦИЯ ИДЕЙ (ЛОКАЛЬНАЯ, БЕЗ AI)
// ============================================
function generateWeekendIdeas(vectors, userName, gender, weatherInfo = null) {
    const { mainVector, level } = getMainVectorAndLevel(vectors);
    
    // Получаем идеи для основного вектора
    const vectorIdeas = FALLBACK_IDEAS[mainVector] || FALLBACK_IDEAS["ЧВ"];
    
    // Перемешиваем идеи
    const shuffledVectorIdeas = [...vectorIdeas.ideas];
    for (let i = shuffledVectorIdeas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledVectorIdeas[i], shuffledVectorIdeas[j]] = [shuffledVectorIdeas[j], shuffledVectorIdeas[i]];
    }
    
    // Перемешиваем общие идеи
    const shuffledCommonIdeas = [...COMMON_IDEAS];
    for (let i = shuffledCommonIdeas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCommonIdeas[i], shuffledCommonIdeas[j]] = [shuffledCommonIdeas[j], shuffledCommonIdeas[i]];
    }
    
    // Берём топ-3 из векторных и топ-2 из общих
    const selectedVectorIdeas = shuffledVectorIdeas.slice(0, 4);
    const selectedCommonIdeas = shuffledCommonIdeas.slice(0, 2);
    
    // Описание вектора
    const vectorDescriptions = {
        "СБ": "укрепление уверенности и внутренней опоры",
        "ТФ": "гармонизацию с деньгами и ресурсами",
        "УБ": "поиск смыслов и системное мышление",
        "ЧВ": "тёплые отношения и эмоциональные связи"
    };
    
    const vectorDesc = vectorDescriptions[mainVector] || "гармоничное развитие";
    const levelDesc = level <= 2 ? "важно уделить внимание" : 
                      level <= 4 ? "хорошо бы поработать" : 
                      "можно укрепить";
    
    // Пол для обращения
    let address = "друг";
    if (gender === "male") address = "брат";
    else if (gender === "female") address = "сестрёнка";
    
    // Имя пользователя
    const name = userName || "друг";
    
    // Погодный контекст
    let weatherText = "";
    if (weatherInfo) {
        const weatherIcon = weatherInfo.icon || "☁️";
        const weatherDesc = weatherInfo.description || "";
        const weatherTemp = weatherInfo.temp ? `, ${weatherInfo.temp}°C` : "";
        weatherText = `${weatherIcon} Погода: ${weatherDesc}${weatherTemp}. `;
    }
    
    // Формируем текст
    let text = `🧠 **ФРЕДИ: ИДЕИ НА ВЫХОДНЫЕ**\n\n`;
    text += `Привет, ${name}! ${weatherText}Я подобрал идеи с учётом твоего профиля.\n\n`;
    text += `🎯 **Твой фокус:** ${vectorDesc}\n`;
    text += `📊 **Уровень:** ${level}/6 (${levelDesc})\n\n`;
    text += `---\n\n`;
    
    text += `${vectorIdeas.emoji} **${vectorIdeas.name}** (для твоего профиля)\n`;
    for (let i = 0; i < selectedVectorIdeas.length; i++) {
        text += `${selectedVectorIdeas[i]}\n`;
    }
    
    text += `\n🌟 **ОБЩИЕ РЕКОМЕНДАЦИИ**\n`;
    for (let i = 0; i < selectedCommonIdeas.length; i++) {
        text += `${selectedCommonIdeas[i]}\n`;
    }
    
    text += `\n---\n`;
    text += `💡 **Совет:** Выбери 1-2 идеи, которые действительно откликаются. Не нужно делать всё сразу.\n\n`;
    text += `✨ Хороших выходных, ${name}! ✨`;
    
    return {
        text: text,
        mainVector: mainVector,
        mainLevel: level,
        ideas: [...selectedVectorIdeas, ...selectedCommonIdeas]
    };
}

// ============================================
// 7. ПОЛУЧЕНИЕ ПОГОДЫ (из контекста)
// ============================================
function getWeatherFromContext() {
    // Пробуем получить погоду из разных мест
    try {
        // Из глобального контекста
        if (window.userDoublesProfile && window.userDoublesProfile.weather) {
            return window.userDoublesProfile.weather;
        }
        
        // Из localStorage
        const savedWeather = localStorage.getItem('fredi_weather');
        if (savedWeather) {
            return JSON.parse(savedWeather);
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// ============================================
// 8. ПОЛУЧЕНИЕ ИМЕНИ ПОЛЬЗОВАТЕЛЯ
// ============================================
function getUserName() {
    return localStorage.getItem('fredi_user_name') || 'друг';
}

// ============================================
// 9. ПОЛУЧЕНИЕ ПОЛА (из контекста)
// ============================================
function getUserGender() {
    try {
        if (window.userDoublesProfile && window.userDoublesProfile.gender) {
            return window.userDoublesProfile.gender;
        }
        return localStorage.getItem('fredi_user_gender') || 'other';
    } catch (e) {
        return 'other';
    }
}

// ============================================
// 10. ОСНОВНОЙ ЭКРАН
// ============================================
async function showWeekendScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserVectorsForWeekend();
    
    const userName = getUserName();
    const gender = getUserGender();
    const weather = getWeatherFromContext();
    
    // Генерируем идеи
    const result = generateWeekendIdeas(weekendState.userVectors, userName, gender, weather);
    weekendState.currentIdeas = result.ideas;
    weekendState.mainVector = result.mainVector;
    weekendState.mainLevel = result.mainLevel;
    weekendState.lastGenerated = new Date();
    
    renderWeekendScreen(container, result.text, result.mainVector, result.mainLevel);
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

function renderWeekendScreen(container, ideasText, mainVector, mainLevel) {
    const vectorInfo = FALLBACK_IDEAS[mainVector] || FALLBACK_IDEAS["ЧВ"];
    
    container.innerHTML = `
        <div class="full-content-page" id="weekendScreen">
            <button class="back-btn" id="weekendBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🎉</div>
                <h1>Идеи на выходные</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Подобрано специально для вас
                </div>
            </div>
            
            <div class="weekend-profile-badge">
                <span class="weekend-vector">${vectorInfo.emoji} ${vectorInfo.name}</span>
                <span class="weekend-level">Уровень: ${mainLevel}/6</span>
            </div>
            
            <div class="weekend-ideas-card">
                <div class="weekend-ideas-content">
                    ${formatIdeasText(ideasText)}
                </div>
            </div>
            
            <div class="weekend-actions">
                <button id="refreshIdeasBtn" class="weekend-refresh-btn">
                    🔄 ЕЩЁ ИДЕИ
                </button>
                <button id="shareIdeasBtn" class="weekend-share-btn">
                    📤 ПОДЕЛИТЬСЯ
                </button>
            </div>
            
            <div class="weekend-footer">
                <div class="weekend-tip">
                    💡 <strong>Совет:</strong> Выберите 1-2 идеи, которые действительно откликаются. 
                    Не нужно делать всё сразу. Хороших выходных!
                </div>
            </div>
        </div>
    `;
    
    addWeekendStyles();
    
    document.getElementById('weekendBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.getElementById('refreshIdeasBtn')?.addEventListener('click', () => {
        refreshIdeas(container);
    });
    
    document.getElementById('shareIdeasBtn')?.addEventListener('click', () => {
        shareIdeas(ideasText);
    });
}

function formatIdeasText(text) {
    // Конвертируем **текст** в <strong>текст</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

async function refreshIdeas(container) {
    if (weekendState.isLoading) return;
    
    weekendState.isLoading = true;
    const refreshBtn = document.getElementById('refreshIdeasBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '⏳ ГЕНЕРИРУЮ...';
        refreshBtn.disabled = true;
    }
    
    try {
        const userName = getUserName();
        const gender = getUserGender();
        const weather = getWeatherFromContext();
        
        // Генерируем новые идеи
        const result = generateWeekendIdeas(weekendState.userVectors, userName, gender, weather);
        weekendState.currentIdeas = result.ideas;
        weekendState.mainVector = result.mainVector;
        weekendState.mainLevel = result.mainLevel;
        weekendState.lastGenerated = new Date();
        
        // Обновляем экран
        renderWeekendScreen(container, result.text, result.mainVector, result.mainLevel);
    } catch (error) {
        console.error('Error refreshing ideas:', error);
        showToastMessage('❌ Не удалось обновить идеи', 'error');
    } finally {
        weekendState.isLoading = false;
    }
}

function shareIdeas(ideasText) {
    // Убираем HTML-теги для шаринга
    const plainText = ideasText.replace(/\*\*(.*?)\*\*/g, '$1');
    
    if (navigator.share) {
        navigator.share({
            title: 'Идеи на выходные от Фреди',
            text: plainText,
            url: window.location.href
        }).catch(() => {
            copyToClipboard(plainText);
        });
    } else {
        copyToClipboard(plainText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToastMessage('📋 Идеи скопированы в буфер обмена', 'success');
    }).catch(() => {
        showToastMessage('❌ Не удалось скопировать', 'error');
    });
}

// ============================================
// 11. СТИЛИ
// ============================================
function addWeekendStyles() {
    if (document.getElementById('weekend-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'weekend-styles';
    style.textContent = `
        .weekend-profile-badge {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05));
            border-radius: 50px;
            padding: 8px 16px;
            margin-bottom: 20px;
        }
        .weekend-vector {
            font-size: 14px;
            font-weight: 600;
        }
        .weekend-level {
            font-size: 12px;
            color: var(--text-secondary);
        }
        .weekend-ideas-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.05), rgba(192,192,192,0.02));
            border-radius: 24px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(224,224,224,0.1);
        }
        .weekend-ideas-content {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-primary);
        }
        .weekend-ideas-content strong {
            color: #ff6b3b;
        }
        .weekend-ideas-content br {
            margin-bottom: 8px;
        }
        .weekend-actions {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }
        .weekend-refresh-btn, .weekend-share-btn {
            flex: 1;
            padding: 14px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .weekend-refresh-btn {
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            color: white;
        }
        .weekend-refresh-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .weekend-share-btn {
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            color: white;
        }
        .weekend-footer {
            background: rgba(16,185,129,0.08);
            border-radius: 16px;
            padding: 14px;
        }
        .weekend-tip {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.4;
            text-align: center;
        }
        .weekend-tip strong {
            color: #10b981;
        }
        @media (max-width: 768px) {
            .weekend-ideas-card {
                padding: 16px;
            }
            .weekend-ideas-content {
                font-size: 13px;
            }
            .weekend-refresh-btn, .weekend-share-btn {
                padding: 12px;
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 12. ЭКСПОРТ
// ============================================
window.showWeekendScreen = showWeekendScreen;

console.log('✅ Модуль "Идеи на выходные" загружен (weekend.js v1.0)');
