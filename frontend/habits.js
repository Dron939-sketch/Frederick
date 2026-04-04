// ============================================
// habits.js — Привычки (режим КОУЧ)
// Версия 1.0 — Триггер → Реакция → Новая привычка
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let habitsState = {
    isLoading: false,
    activeTab: 'theory', // 'theory', 'analyze', 'myHabits', 'plan', 'menu'
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    habits: [],           // список привычек пользователя
    currentHabit: null,   // выбранная привычка для работы
    dailyReminders: [],    // активные напоминания
    streakDays: {}         // дни подряд по привычкам
};

// ============================================
// 2. БАЗА ПРИВЫЧЕК ПО ВЕКТОРАМ
// ============================================
const HABITS_BY_VECTOR = {
    "СБ": {
        common: [
            { name: "Избегание конфликтов", trigger: "Конфликтная ситуация", reaction: "Молчу или соглашаюсь" },
            { name: "Прокрастинация важных разговоров", trigger: "Нужно сказать 'нет'", reaction: "Откладываю, придумываю оправдания" },
            { name: "Замирание под давлением", trigger: "Критика или давление", reaction: "Теряюсь, не могу ответить" }
        ],
        recommended: [
            { name: "Ежедневное 'маленькое нет'", trigger: "Просьба, которая неудобна", oldReaction: "Соглашаюсь", newReaction: "Говорю 'нет, спасибо'" },
            { name: "Пауза перед ответом", trigger: "Вопрос или просьба", oldReaction: "Отвечаю сразу", newReaction: "Беру паузу 3 секунды" },
            { name: "Защита границ", trigger: "Чувствую дискомфорт", oldReaction: "Терплю", newReaction: "Говорю о своих чувствах" }
        ]
    },
    "ТФ": {
        common: [
            { name: "Импульсивные траты", trigger: "Стресс или скука", reaction: "Покупаю ненужное" },
            { name: "Избегание финансового планирования", trigger: "Мысли о деньгах", reaction: "Отвлекаюсь, откладываю" },
            { name: "Чувство вины за траты", trigger: "Покупка для себя", reaction: "Испытываю вину, сомневаюсь" }
        ],
        recommended: [
            { name: "Правило 24 часов", trigger: "Хочу купить что-то не запланированное", oldReaction: "Покупаю сразу", newReaction: "Жду 24 часа" },
            { name: "Финансовый трекер", trigger: "Получение дохода или трата", oldReaction: "Не отслеживаю", newReaction: "Записываю в трекер" },
            { name: "Откладывание 10%", trigger: "Получение дохода", oldReaction: "Трачу всё", newReaction: "Сразу откладываю 10%" }
        ]
    },
    "УБ": {
        common: [
            { name: "Зависание в размышлениях", trigger: "Сложная задача", reaction: "Долго думаю, не начинаю" },
            { name: "Прокрастинация", trigger: "Неприятная задача", reaction: "Откладываю на потом" },
            { name: "Поиск идеального решения", trigger: "Нужно выбрать", reaction: "Зависаю в анализе" }
        ],
        recommended: [
            { name: "Правило 5 минут", trigger: "Не хочется начинать", oldReaction: "Откладываю", newReaction: "Делаю 5 минут" },
            { name: "Микро-шаги", trigger: "Большая задача", oldReaction: "Паралич", newReaction: "Делю на маленькие шаги" },
            { name: "Ежедневное действие", trigger: "Начало дня", oldReaction: "Планирую, но не делаю", newReaction: "Одно действие сразу" }
        ]
    },
    "ЧВ": {
        common: [
            { name: "Проверка соцсетей", trigger: "Скука или тревога", reaction: "Открываю соцсети" },
            { name: "Подстройка под других", trigger: "Разное мнение", reaction: "Соглашаюсь, даже если не согласен" },
            { name: "Потребность в одобрении", trigger: "Сделал что-то", reaction: "Жду реакции других" }
        ],
        recommended: [
            { name: "Цифровой детокс-час", trigger: "Вечернее время", oldReaction: "Листаю ленту", newReaction: "Читаю книгу" },
            { name: "Время для себя", trigger: "Чувство усталости", oldReaction: "Продолжаю общаться", newReaction: "Ухожу в себя на 15 мин" },
            { name: "Своё мнение вслух", trigger: "Не согласен с мнением", oldReaction: "Молчу", newReaction: "Мягко выражаю своё" }
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
async function loadUserProfileForHabits() {
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
        
        habitsState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        habitsState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        habitsState.userGender = context.gender || 'other';
        
        // Загружаем сохранённые привычки
        const savedHabits = localStorage.getItem(`habits_${userId}`);
        if (savedHabits) {
            habitsState.habits = JSON.parse(savedHabits);
        }
        
        // Загружаем streak
        const savedStreak = localStorage.getItem(`habits_streak_${userId}`);
        if (savedStreak) {
            habitsState.streakDays = JSON.parse(savedStreak);
        }
        
        console.log('📊 Данные для привычек:', habitsState);
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 5. ОПРЕДЕЛЕНИЕ СЛАБОГО ВЕКТОРА
// ============================================
function getWeakVector() {
    const v = habitsState.userVectors;
    const entries = Object.entries(v);
    const minVector = entries.reduce((min, current) => 
        current[1] < min[1] ? current : min, entries[0]);
    return minVector[0];
}

// ============================================
// 6. СОХРАНЕНИЕ ПРИВЫЧЕК
// ============================================
function saveHabits() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    localStorage.setItem(`habits_${userId}`, JSON.stringify(habitsState.habits));
}

function saveStreak() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    localStorage.setItem(`habits_streak_${userId}`, JSON.stringify(habitsState.streakDays));
}

// ============================================
// 7. ОСНОВНОЙ ЭКРАН
// ============================================
async function showHabitsScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForHabits();
    renderHabitsMainScreen(container);
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

function renderHabitsMainScreen(container) {
    const weakVector = getWeakVector();
    const vectorHabits = HABITS_BY_VECTOR[weakVector] || HABITS_BY_VECTOR["ЧВ"];
    
    container.innerHTML = `
        <div class="full-content-page" id="habitsScreen">
            <button class="back-btn" id="habitsBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1>Привычки</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Триггер → Реакция → Новая привычка
                </div>
            </div>
            
            <div class="habits-tabs">
                <button class="habits-tab ${habitsState.activeTab === 'theory' ? 'active' : ''}" data-tab="theory">
                    🧠 ТЕОРИЯ
                </button>
                <button class="habits-tab ${habitsState.activeTab === 'analyze' ? 'active' : ''}" data-tab="analyze">
                    🔍 АНАЛИЗ
                </button>
                <button class="habits-tab ${habitsState.activeTab === 'myHabits' ? 'active' : ''}" data-tab="myHabits">
                    ✏️ МОИ ПРИВЫЧКИ
                    ${habitsState.habits.length > 0 ? `<span class="habits-badge">${habitsState.habits.length}</span>` : ''}
                </button>
                <button class="habits-tab ${habitsState.activeTab === 'plan' ? 'active' : ''}" data-tab="plan">
                    🌱 ПЛАН
                </button>
                <button class="habits-tab ${habitsState.activeTab === 'menu' ? 'active' : ''}" data-tab="menu">
                    📋 МЕНЮ
                </button>
            </div>
            
            <div class="habits-content" id="habitsContent">
                ${habitsState.activeTab === 'theory' ? renderTheoryTab() : ''}
                ${habitsState.activeTab === 'analyze' ? renderAnalyzeTab(vectorHabits, weakVector) : ''}
                ${habitsState.activeTab === 'myHabits' ? renderMyHabitsTab() : ''}
                ${habitsState.activeTab === 'plan' ? renderPlanTab() : ''}
                ${habitsState.activeTab === 'menu' ? renderMenuTab(vectorHabits, weakVector) : ''}
            </div>
        </div>
    `;
    
    addHabitsStyles();
    
    document.getElementById('habitsBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    document.querySelectorAll('.habits-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            habitsState.activeTab = tab.dataset.tab;
            renderHabitsMainScreen(container);
        });
    });
}

// ============================================
// 8. ВКЛАДКА "ТЕОРИЯ"
// ============================================
function renderTheoryTab() {
    return `
        <div class="habits-theory">
            <div class="habits-theory-card">
                <div class="habits-theory-icon">🧠</div>
                <div class="habits-theory-title">Почему привычки нельзя отменить?</div>
                <div class="habits-theory-text">
                    Привычка — это нейронная связь в мозге. Она не исчезает, потому что:
                    <br><br>
                    <strong>1. Экономия энергии</strong> — мозг автоматизирует повторяющиеся действия.
                    <br>
                    <strong>2. Триггер → Реакция</strong> — привычка закрепляется через повторение.
                    <br>
                    <strong>3. Нейропластичность</strong> — старая связь не удаляется, а "зарастает" новой.
                </div>
            </div>
            
            <div class="habits-theory-card">
                <div class="habits-theory-icon">🔄</div>
                <div class="habits-theory-title">Что можно изменить?</div>
                <div class="habits-theory-text">
                    <strong>ТРИГГЕР</strong> — то, что запускает привычку<br>
                    <em>Пример: "Я вижу уведомление"</em>
                    <br><br>
                    <strong>↓</strong>
                    <br><br>
                    <strong>РЕАКЦИЯ</strong> — автоматическое действие<br>
                    <em>Пример: "Открываю телефон"</em>
                    <br><br>
                    <strong>↓</strong>
                    <br><br>
                    <strong>НОВАЯ РЕАКЦИЯ</strong> — осознанный выбор<br>
                    <em>Пример: "Делаю 3 глубоких вдоха"</em>
                </div>
            </div>
            
            <div class="habits-theory-card">
                <div class="habits-theory-icon">💡</div>
                <div class="habits-theory-title">Золотое правило</div>
                <div class="habits-theory-text">
                    <strong>Не меняйте привычку — замените реакцию на триггер.</strong>
                    <br><br>
                    Найдите ТРИГГЕР → Подготовьте НОВУЮ РЕАКЦИЮ → Практикуйте 21 день.
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 9. ВКЛАДКА "АНАЛИЗ"
// ============================================
function renderAnalyzeTab(vectorHabits, weakVector) {
    let commonHtml = '';
    vectorHabits.common.forEach(habit => {
        commonHtml += `
            <div class="habits-analyze-item">
                <div class="habits-analyze-name">${habit.name}</div>
                <div class="habits-analyze-detail">
                    <span class="habits-analyze-trigger">🎯 Триггер: ${habit.trigger}</span>
                    <span class="habits-analyze-reaction">⚡ Реакция: ${habit.reaction}</span>
                </div>
                <button class="habits-add-btn" data-name="${habit.name}" data-trigger="${habit.trigger}" data-reaction="${habit.reaction}">
                    ✏️ ПРОРАБОТАТЬ
                </button>
            </div>
        `;
    });
    
    return `
        <div class="habits-analyze">
            <div class="habits-analyze-header">
                <div class="habits-analyze-vector">🧬 Ваш профиль: ${weakVector}</div>
                <div class="habits-analyze-desc">Привычки, которые могут быть вам свойственны:</div>
            </div>
            <div class="habits-analyze-list">
                ${commonHtml}
            </div>
            <div class="habits-analyze-note">
                💡 Выберите привычку, которую хотите изменить, и нажмите "ПРОРАБОТАТЬ"
            </div>
        </div>
    `;
}

// ============================================
// 10. ВКЛАДКА "МОИ ПРИВЫЧКИ"
// ============================================
function renderMyHabitsTab() {
    if (habitsState.habits.length === 0) {
        return `
            <div class="habits-empty">
                <div class="habits-empty-emoji">📭</div>
                <div class="habits-empty-title">Нет активных привычек</div>
                <div class="habits-empty-desc">Перейдите в "АНАЛИЗ" или "МЕНЮ", чтобы добавить привычку для работы</div>
            </div>
        `;
    }
    
    let habitsHtml = '';
    habitsState.habits.forEach((habit, idx) => {
        const streak = habitsState.streakDays[habit.id] || 0;
        habitsHtml += `
            <div class="habits-my-item" data-habit-idx="${idx}">
                <div class="habits-my-header">
                    <div class="habits-my-name">${habit.name}</div>
                    <div class="habits-my-streak">🔥 ${streak} дней</div>
                </div>
                <div class="habits-my-detail">
                    <div class="habits-my-trigger">🎯 Триггер: ${habit.trigger}</div>
                    <div class="habits-my-old-reaction">❌ Старая реакция: ${habit.oldReaction}</div>
                    <div class="habits-my-new-reaction">✅ Новая реакция: ${habit.newReaction}</div>
                </div>
                <div class="habits-my-actions">
                    <button class="habits-mark-btn" data-idx="${idx}">✅ ВЫПОЛНИЛ СЕГОДНЯ</button>
                    <button class="habits-delete-btn" data-idx="${idx}">🗑️ УДАЛИТЬ</button>
                </div>
                <div class="habits-my-progress">
                    <div class="habits-progress-label">Прогресс: ${streak}/21 день</div>
                    <div class="habits-progress-bar">
                        <div class="habits-progress-fill" style="width: ${(streak/21)*100}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    return `
        <div class="habits-my">
            <div class="habits-my-header-info">
                <div class="habits-my-count">Активных привычек: ${habitsState.habits.length}</div>
                <div class="habits-my-total-streak">🔥 Общий стрейк: ${calculateTotalStreak()} дней</div>
            </div>
            <div class="habits-my-list">
                ${habitsHtml}
            </div>
        </div>
    `;
}

function calculateTotalStreak() {
    let total = 0;
    for (const habit of habitsState.habits) {
        total += habitsState.streakDays[habit.id] || 0;
    }
    return total;
}

// ============================================
// 11. ВКЛАДКА "ПЛАН ВНЕДРЕНИЯ"
// ============================================
function renderPlanTab() {
    if (habitsState.habits.length === 0) {
        return `
            <div class="habits-empty">
                <div class="habits-empty-emoji">🌱</div>
                <div class="habits-empty-title">Нет активных привычек</div>
                <div class="habits-empty-desc">Добавьте привычку в "АНАЛИЗ" или "МЕНЮ", чтобы начать 21-дневный план</div>
            </div>
        `;
    }
    
    // План на неделю
    const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const today = new Date().getDay();
    const weekDays = [...days.slice(today - 1), ...days.slice(0, today - 1)];
    
    let planHtml = `
        <div class="habits-plan">
            <div class="habits-plan-title">📅 21-ДНЕВНЫЙ ПЛАН ВНЕДРЕНИЯ</div>
            <div class="habits-plan-subtitle">Привычка формируется за 21 день регулярного повторения</div>
    `;
    
    habitsState.habits.forEach((habit, idx) => {
        const streak = habitsState.streakDays[habit.id] || 0;
        const daysLeft = 21 - streak;
        
        planHtml += `
            <div class="habits-plan-habit">
                <div class="habits-plan-habit-name">${habit.name}</div>
                <div class="habits-plan-habit-progress">
                    <span>День ${streak} из 21</span>
                    <span>Осталось ${daysLeft} дней</span>
                </div>
                <div class="habits-plan-week">
                    ${weekDays.map(day => `
                        <div class="habits-plan-day ${streak > 0 ? 'active' : ''}">${day}</div>
                    `).join('')}
                </div>
                <div class="habits-plan-reminder">
                    <div class="habits-reminder-label">⏰ Напоминание</div>
                    <select class="habits-reminder-time" data-idx="${idx}">
                        <option value="09:00">09:00</option>
                        <option value="10:00">10:00</option>
                        <option value="11:00">11:00</option>
                        <option value="12:00">12:00</option>
                        <option value="13:00">13:00</option>
                        <option value="14:00">14:00</option>
                        <option value="15:00">15:00</option>
                        <option value="16:00">16:00</option>
                        <option value="17:00">17:00</option>
                        <option value="18:00">18:00</option>
                        <option value="19:00">19:00</option>
                        <option value="20:00">20:00</option>
                    </select>
                    <button class="habits-set-reminder-btn" data-idx="${idx}">УСТАНОВИТЬ</button>
                </div>
            </div>
        `;
    });
    
    planHtml += `
            <div class="habits-plan-tip">
                💡 <strong>Совет:</strong> Привычка становится автоматической после 21 дня. 
                Не пропускайте больше одного дня подряд — это сбивает прогресс.
            </div>
        </div>
    `;
    
    return planHtml;
}

// ============================================
// 12. ВКЛАДКА "МЕНЮ ПРИВЫЧЕК"
// ============================================
function renderMenuTab(vectorHabits, weakVector) {
    let recommendedHtml = '';
    vectorHabits.recommended.forEach(habit => {
        recommendedHtml += `
            <div class="habits-menu-item">
                <div class="habits-menu-name">🌱 ${habit.name}</div>
                <div class="habits-menu-detail">
                    <div class="habits-menu-trigger">🎯 Триггер: ${habit.trigger}</div>
                    <div class="habits-menu-old">❌ Старая реакция: ${habit.oldReaction}</div>
                    <div class="habits-menu-new">✅ Новая реакция: ${habit.newReaction}</div>
                </div>
                <button class="habits-menu-add-btn" 
                    data-name="${habit.name}"
                    data-trigger="${habit.trigger}"
                    data-old="${habit.oldReaction}"
                    data-new="${habit.newReaction}">
                    + ДОБАВИТЬ В МОИ ПРИВЫЧКИ
                </button>
            </div>
        `;
    });
    
    return `
        <div class="habits-menu">
            <div class="habits-menu-header">
                <div class="habits-menu-vector">🧬 Рекомендовано для вашего профиля (${weakVector})</div>
                <div class="habits-menu-desc">Выберите привычку, которую хотите внедрить</div>
            </div>
            <div class="habits-menu-list">
                ${recommendedHtml}
            </div>
            <div class="habits-menu-custom">
                <div class="habits-menu-custom-title">✏️ ИЛИ СОЗДАЙТЕ СВОЮ</div>
                <textarea id="customHabitDesc" class="habits-custom-input" 
                    placeholder="Например: «Хочу перестать откладывать дела на потом»"
                    rows="2"></textarea>
                <button id="customHabitBtn" class="habits-custom-btn">➕ ДОБАВИТЬ СВОЮ ПРИВЫЧКУ</button>
            </div>
        </div>
    `;
}

// ============================================
// 13. ОБРАБОТЧИКИ
// ============================================
function setupHabitsHandlers() {
    // Добавление привычки из анализа
    document.querySelectorAll('.habits-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            const trigger = btn.dataset.trigger;
            const reaction = btn.dataset.reaction;
            
            // Открываем модалку для определения новой реакции
            showNewReactionModal(name, trigger, reaction);
        });
    });
    
    // Добавление из меню
    document.querySelectorAll('.habits-menu-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const habit = {
                id: Date.now().toString(),
                name: btn.dataset.name,
                trigger: btn.dataset.trigger,
                oldReaction: btn.dataset.old,
                newReaction: btn.dataset.new,
                createdAt: new Date().toISOString(),
                reminderTime: null
            };
            
            if (!habitsState.habits.some(h => h.name === habit.name)) {
                habitsState.habits.push(habit);
                if (!habitsState.streakDays[habit.id]) {
                    habitsState.streakDays[habit.id] = 0;
                }
                saveHabits();
                saveStreak();
                showToastMessage(`✅ Привычка "${habit.name}" добавлена!`, 'success');
                renderHabitsMainScreen(document.getElementById('screenContainer'));
            } else {
                showToastMessage(`⚠️ Привычка "${habit.name}" уже есть`, 'warning');
            }
        });
    });
    
    // Отметка выполнения
    document.querySelectorAll('.habits-mark-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const habit = habitsState.habits[idx];
            const today = new Date().toDateString();
            
            // Проверяем, отмечал ли уже сегодня
            const lastMarked = localStorage.getItem(`habit_${habit.id}_last_marked`);
            if (lastMarked === today) {
                showToastMessage('⚠️ Вы уже отмечали эту привычку сегодня!', 'warning');
                return;
            }
            
            // Увеличиваем стрейк
            habitsState.streakDays[habit.id] = (habitsState.streakDays[habit.id] || 0) + 1;
            localStorage.setItem(`habit_${habit.id}_last_marked`, today);
            saveStreak();
            
            showToastMessage(`✅ Отлично! День ${habitsState.streakDays[habit.id]} из 21`, 'success');
            
            if (habitsState.streakDays[habit.id] >= 21) {
                showToastMessage(`🎉 ПОЗДРАВЛЯЮ! Вы сформировали привычку "${habit.name}"!`, 'success');
            }
            
            renderHabitsMainScreen(document.getElementById('screenContainer'));
        });
    });
    
    // Удаление привычки
    document.querySelectorAll('.habits-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const habit = habitsState.habits[idx];
            if (confirm(`Удалить привычку "${habit.name}"?`)) {
                habitsState.habits.splice(idx, 1);
                saveHabits();
                showToastMessage(`🗑️ Привычка удалена`, 'info');
                renderHabitsMainScreen(document.getElementById('screenContainer'));
            }
        });
    });
    
    // Установка напоминания
    document.querySelectorAll('.habits-set-reminder-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const timeSelect = document.querySelector(`.habits-reminder-time[data-idx="${idx}"]`);
            const time = timeSelect?.value;
            
            if (time) {
                habitsState.habits[idx].reminderTime = time;
                saveHabits();
                showToastMessage(`⏰ Напоминание установлено на ${time}`, 'success');
                
                // Здесь можно запросить разрешение на push-уведомления
                if (Notification.permission === 'granted') {
                    new Notification('Фреди: Напоминание о привычке', {
                        body: `Не забудьте про привычку "${habitsState.habits[idx].name}" в ${time}`,
                        icon: '/fredi/icon-192x192.png'
                    });
                }
            }
        });
    });
    
    // Кастомная привычка
    document.getElementById('customHabitBtn')?.addEventListener('click', () => {
        const desc = document.getElementById('customHabitDesc')?.value.trim();
        if (!desc) {
            showToastMessage('📝 Опишите привычку', 'warning');
            return;
        }
        
        // Открываем модалку для настройки
        showCustomHabitModal(desc);
    });
}

// ============================================
// 14. МОДАЛЬНЫЕ ОКНА
// ============================================
function showNewReactionModal(name, trigger, oldReaction) {
    const modal = document.createElement('div');
    modal.className = 'habits-modal';
    modal.innerHTML = `
        <div class="habits-modal-content">
            <div class="habits-modal-header">
                <span>✏️ Проработка привычки</span>
                <button class="habits-modal-close">✕</button>
            </div>
            <div class="habits-modal-body">
                <div class="habits-modal-habit">${name}</div>
                <div class="habits-modal-trigger">🎯 Триггер: ${trigger}</div>
                <div class="habits-modal-old">❌ Старая реакция: ${oldReaction}</div>
                
                <div class="habits-modal-new-label">✅ Что вы будете делать вместо этого?</div>
                <textarea id="newReactionInput" class="habits-modal-input" 
                    placeholder="Например: «Сделаю 3 глубоких вдоха и скажу 'нет, спасибо'»"
                    rows="3"></textarea>
                
                <div class="habits-modal-hint">
                    💡 <strong>Совет:</strong> Новая реакция должна быть конкретной и выполнимой.
                </div>
            </div>
            <div class="habits-modal-footer">
                <button id="modalCancelBtn" class="habits-modal-cancel">ОТМЕНА</button>
                <button id="modalSaveBtn" class="habits-modal-save">СОХРАНИТЬ ПРИВЫЧКУ</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.habits-modal-close').onclick = () => modal.remove();
    modal.querySelector('#modalCancelBtn').onclick = () => modal.remove();
    modal.querySelector('#modalSaveBtn').onclick = () => {
        const newReaction = document.getElementById('newReactionInput')?.value.trim();
        if (!newReaction) {
            showToastMessage('📝 Напишите новую реакцию', 'warning');
            return;
        }
        
        const habit = {
            id: Date.now().toString(),
            name: name,
            trigger: trigger,
            oldReaction: oldReaction,
            newReaction: newReaction,
            createdAt: new Date().toISOString(),
            reminderTime: null
        };
        
        if (!habitsState.habits.some(h => h.name === habit.name)) {
            habitsState.habits.push(habit);
            if (!habitsState.streakDays[habit.id]) {
                habitsState.streakDays[habit.id] = 0;
            }
            saveHabits();
            saveStreak();
            showToastMessage(`✅ Привычка "${habit.name}" добавлена!`, 'success');
            modal.remove();
            renderHabitsMainScreen(document.getElementById('screenContainer'));
        } else {
            showToastMessage(`⚠️ Привычка "${habit.name}" уже есть`, 'warning');
            modal.remove();
        }
    };
}

function showCustomHabitModal(description) {
    const modal = document.createElement('div');
    modal.className = 'habits-modal';
    modal.innerHTML = `
        <div class="habits-modal-content">
            <div class="habits-modal-header">
                <span>✏️ Создание привычки</span>
                <button class="habits-modal-close">✕</button>
            </div>
            <div class="habits-modal-body">
                <div class="habits-modal-habit">${escapeHtml(description)}</div>
                
                <div class="habits-modal-new-label">🎯 Что запускает эту привычку? (триггер)</div>
                <input id="customTrigger" class="habits-modal-input" placeholder="Например: «Чувствую скуку»">
                
                <div class="habits-modal-new-label">❌ Что вы делаете сейчас? (старая реакция)</div>
                <input id="customOldReaction" class="habits-modal-input" placeholder="Например: «Открываю соцсети»">
                
                <div class="habits-modal-new-label">✅ Что вы будете делать вместо этого? (новая реакция)</div>
                <textarea id="customNewReaction" class="habits-modal-input" rows="2" 
                    placeholder="Например: «Делаю 5 приседаний»"></textarea>
            </div>
            <div class="habits-modal-footer">
                <button id="modalCancelBtn" class="habits-modal-cancel">ОТМЕНА</button>
                <button id="modalSaveBtn" class="habits-modal-save">СОЗДАТЬ ПРИВЫЧКУ</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.habits-modal-close').onclick = () => modal.remove();
    modal.querySelector('#modalCancelBtn').onclick = () => modal.remove();
    modal.querySelector('#modalSaveBtn').onclick = () => {
        const trigger = document.getElementById('customTrigger')?.value.trim();
        const oldReaction = document.getElementById('customOldReaction')?.value.trim();
        const newReaction = document.getElementById('customNewReaction')?.value.trim();
        
        if (!trigger || !oldReaction || !newReaction) {
            showToastMessage('📝 Заполните все поля', 'warning');
            return;
        }
        
        const habit = {
            id: Date.now().toString(),
            name: description.length > 50 ? description.substring(0, 50) + '...' : description,
            trigger: trigger,
            oldReaction: oldReaction,
            newReaction: newReaction,
            createdAt: new Date().toISOString(),
            reminderTime: null
        };
        
        habitsState.habits.push(habit);
        if (!habitsState.streakDays[habit.id]) {
            habitsState.streakDays[habit.id] = 0;
        }
        saveHabits();
        saveStreak();
        showToastMessage(`✅ Привычка "${habit.name}" добавлена!`, 'success');
        modal.remove();
        renderHabitsMainScreen(document.getElementById('screenContainer'));
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 15. СТИЛИ
// ============================================
function addHabitsStyles() {
    if (document.getElementById('habits-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'habits-styles';
    style.textContent = `
        .habits-tabs {
            display: flex;
            gap: 6px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
            flex-wrap: wrap;
        }
        .habits-tab {
            padding: 8px 14px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            position: relative;
        }
        .habits-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        .habits-badge {
            background: #ff6b3b;
            border-radius: 30px;
            padding: 2px 6px;
            font-size: 9px;
            margin-left: 6px;
        }
        
        .habits-theory-card {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .habits-theory-icon {
            font-size: 36px;
            margin-bottom: 12px;
        }
        .habits-theory-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        .habits-theory-text {
            font-size: 13px;
            line-height: 1.6;
            color: var(--text-secondary);
        }
        
        .habits-analyze-item {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .habits-analyze-name {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .habits-analyze-detail {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 12px;
            font-size: 12px;
        }
        .habits-analyze-trigger {
            color: #3b82ff;
        }
        .habits-analyze-reaction {
            color: #ff6b3b;
        }
        .habits-add-btn {
            background: rgba(255,107,59,0.15);
            border: 1px solid rgba(255,107,59,0.3);
            border-radius: 30px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
        }
        
        .habits-my-item {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .habits-my-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .habits-my-name {
            font-size: 15px;
            font-weight: 600;
        }
        .habits-my-streak {
            font-size: 12px;
            color: #ff6b3b;
        }
        .habits-my-detail {
            font-size: 12px;
            margin-bottom: 12px;
            color: var(--text-secondary);
        }
        .habits-my-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 12px;
        }
        .habits-mark-btn {
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            border-radius: 30px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
        }
        .habits-delete-btn {
            background: rgba(239,68,68,0.2);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 30px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
        }
        .habits-progress-bar {
            height: 6px;
            background: rgba(224,224,224,0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        .habits-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            border-radius: 3px;
            transition: width 0.3s;
        }
        
        .habits-menu-item {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .habits-menu-name {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .habits-menu-detail {
            font-size: 12px;
            margin-bottom: 12px;
            color: var(--text-secondary);
        }
        .habits-menu-add-btn {
            background: rgba(16,185,129,0.15);
            border: 1px solid rgba(16,185,129,0.3);
            border-radius: 30px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
        }
        
        .habits-plan {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 16px;
        }
        .habits-plan-title {
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 8px;
        }
        .habits-plan-habit {
            background: rgba(224,224,224,0.03);
            border-radius: 16px;
            padding: 14px;
            margin-top: 16px;
        }
        .habits-plan-week {
            display: flex;
            gap: 6px;
            margin: 12px 0;
            flex-wrap: wrap;
        }
        .habits-plan-day {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(224,224,224,0.1);
            border-radius: 50%;
            font-size: 11px;
        }
        .habits-plan-day.active {
            background: #10b981;
        }
        
        .habits-modal {
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
        .habits-modal-content {
            background: #1a1a1a;
            border-radius: 28px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: auto;
            border: 1px solid rgba(224,224,224,0.2);
        }
        .habits-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(224,224,224,0.1);
            font-weight: 600;
        }
        .habits-modal-body {
            padding: 20px;
        }
        .habits-modal-footer {
            padding: 16px 20px;
            display: flex;
            gap: 12px;
            border-top: 1px solid rgba(224,224,224,0.1);
        }
        .habits-modal-input {
            width: 100%;
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 12px;
            padding: 10px;
            color: white;
            margin: 8px 0;
        }
        .habits-modal-save {
            flex: 1;
            padding: 10px;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            border-radius: 30px;
            color: white;
            cursor: pointer;
        }
        .habits-modal-cancel {
            flex: 1;
            padding: 10px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 30px;
            color: white;
            cursor: pointer;
        }
        
        .habits-empty {
            text-align: center;
            padding: 60px 20px;
        }
        .habits-empty-emoji {
            font-size: 56px;
            margin-bottom: 16px;
        }
        .habits-empty-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .habits-empty-desc {
            font-size: 12px;
            color: var(--text-secondary);
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 16. ПЕРЕКЛЮЧЕНИЕ ОБРАБОТЧИКОВ
// ============================================
function setupHabitsHandlersDelayed() {
    setTimeout(setupHabitsHandlers, 100);
}

// Переопределяем рендер
const originalRender = renderHabitsMainScreen;
window.renderHabitsMainScreen = function(container) {
    originalRender(container);
    setupHabitsHandlersDelayed();
};

// ============================================
// 17. ЭКСПОРТ
// ============================================
window.showHabitsScreen = showHabitsScreen;

console.log('✅ Модуль "Привычки" загружен (habits.js v1.0)');
