// ============================================
// healing.js — Исцеление (AI-генерируемый контент)
// Версия 1.0 — динамический анализ профиля
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let healingState = {
    isLoading: false,
    currentHealing: null,
    lastGenerated: null,
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    userAge: null,
    userCity: null
};

// ============================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
// 3. ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ============================================
async function loadUserProfileForHealing() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        // Получаем контекст
        const contextRes = await fetch(`${apiUrl}/api/get-context/${userId}`);
        const contextData = await contextRes.json();
        const context = contextData.context || {};
        
        // Получаем профиль
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        // Векторы
        const vectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        // Определяем слабый вектор
        const entries = Object.entries(vectors);
        const minVector = entries.reduce((min, current) => 
            current[1] < min[1] ? current : min, entries[0]);
        
        healingState.userVectors = vectors;
        healingState.weakVector = minVector[0];
        healingState.weakScore = minVector[1];
        healingState.userName = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        healingState.userGender = context.gender || 'other';
        healingState.userAge = context.age || null;
        healingState.userCity = context.city || null;
        healingState.profileType = profile.perception_type || 'АНАЛИТИК';
        
        console.log('📊 Данные для исцеления:', {
            vectors: healingState.userVectors,
            weakVector: healingState.weakVector,
            weakScore: healingState.weakScore,
            profileType: healingState.profileType
        });
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

// ============================================
// 4. ФОРМИРОВАНИЕ ПРОМПТА ДЛЯ AI
// ============================================
function buildHealingPrompt() {
    const v = healingState.userVectors;
    const weakVector = healingState.weakVector;
    const weakScore = healingState.weakScore;
    const profileType = healingState.profileType;
    const userName = healingState.userName;
    const gender = healingState.userGender;
    const age = healingState.userAge;
    const city = healingState.userCity;
    
    // Названия векторов
    const vectorNames = {
        "СБ": "Страх конфликтов и подавление себя",
        "ТФ": "Денежные блоки и чувство недостойности", 
        "УБ": "Экзистенциальная тревога и поиск смысла",
        "ЧВ": "Тревожная привязанность и страх отвержения"
    };
    
    // Пол для обращения
    let address = "друг";
    if (gender === "male") address = "брат";
    else if (gender === "female") address = "сестрёнка";
    
    const weakVectorName = vectorNames[weakVector] || "психологический паттерн";
    const levelDesc = weakScore <= 2 ? "сильно выражен" : weakScore <= 4 ? "умеренно выражен" : "слабо выражен";
    
    return `Ты — Фреди, виртуальный психолог. Твоя задача — помочь пользователю исцелить его психологический паттерн.

ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
- Имя: ${userName}
- Обращение: ${address}
- Пол: ${gender}
- Возраст: ${age || 'не указан'}
- Город: ${city || 'не указан'}
- Психотип: ${profileType}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Основной паттерн для работы: ${weakVectorName} (уровень: ${levelDesc})

ЗАДАНИЕ:
Создай персонализированный раздел "Исцеление" для этого пользователя.

ТРЕБОВАНИЯ К ОТВЕТУ:
1. Формат — JSON строго по схеме ниже
2. Используй обращение "${address}" в тексте
3. Будь тёплым, поддерживающим, без осуждения
4. Не используй markdown (*, **, #) — только чистый текст
5. Практики должны быть безопасными и выполнимыми дома

СХЕМА ОТВЕТА (JSON):
{
    "pattern": {
        "name": "Название паттерна (коротко)",
        "description": "Описание того, как этот паттерн проявляется у пользователя (2-3 предложения, с обращением к нему)",
        "origin": "Как этот паттерн мог сформироваться (1-2 предложения)",
        "manifestation": "Как это проявляется в жизни сейчас (список через запятую)",
        "strength": "Какая сильная сторона скрыта за этим паттерном"
    },
    "practices": [
        {
            "name": "Название практики",
            "duration": "время в минутах",
            "instruction": "Пошаговая инструкция (3-5 шагов)",
            "why_it_helps": "Почему это помогает (1 предложение)"
        }
    ],
    "affirmations": [
        "Аффирмация 1",
        "Аффирмация 2",
        "Аффирмация 3"
    ],
    "daily_ritual": "Короткое ежедневное действие на 2-3 минуты"
}

ВАЖНО:
- practices должно быть ровно 3 штуки
- affirmations — ровно 4 штуки
- Все тексты должны быть на русском
- Обращайся к пользователю на "ты" и используй "${address}"
- Будь бережным и профессиональным
- Не используй звёздочки и другие markdown-символы

Ответь только JSON, без пояснений.`;
}

// ============================================
// 5. ОТПРАВКА ЗАПРОСА К API
// ============================================
async function generateHealingContent() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const prompt = buildHealingPrompt();
    
    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                prompt: prompt,
                model: 'deepseek',
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            // Парсим JSON из ответа AI
            let jsonStr = data.content;
            // Убираем возможные markdown-обёртки
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const healingData = JSON.parse(jsonStr);
            return healingData;
        } else {
            throw new Error(data.error || 'AI generation failed');
        }
    } catch (error) {
        console.error('Error generating healing content:', error);
        // Возвращаем fallback
        return getFallbackHealingContent();
    }
}

// ============================================
// 6. FALLBACK (если AI недоступен)
// ============================================
function getFallbackHealingContent() {
    const weakVector = healingState.weakVector;
    const address = healingState.userGender === 'male' ? 'брат' : 
                    healingState.userGender === 'female' ? 'сестрёнка' : 'друг';
    
    const fallbacks = {
        "СБ": {
            pattern: {
                name: "Страх конфликтов",
                description: `${address}, тебе бывает сложно сказать «нет» и отстоять свои границы. Ты часто соглашаешься, чтобы не обидеть других, даже если внутри не хочешь. Это выматывает.`,
                origin: "Этот паттерн часто формируется в детстве, когда за несогласие следовало наказание или молчаливый холод.",
                manifestation: "трудно отказать, страх обидеть других, внутреннее напряжение после согласия, избегание споров",
                strength: "Ты очень чуткий и эмпатичный человек. Ты умеешь создавать безопасную атмосферу для других."
            },
            practices: [
                {
                    name: "Дыхание для границ",
                    duration: "3 минуты",
                    instruction: "1. Сядь удобно, выпрями спину.\n2. На вдохе представь, как вокруг тебя формируется светящаяся сфера.\n3. На выдохе почувствуй, как сфера становится плотнее.\n4. Повтори 10 раз.",
                    why_it_helps: "Это упражнение помогает ощутить свои границы физически."
                },
                {
                    name: "Упражнение «Твёрдое нет»",
                    duration: "5 минут",
                    instruction: "1. Вспомни ситуацию, где тебе нужно было отказать.\n2. Закрой глаза и прокрути её.\n3. На выдохе мысленно скажи «Нет, спасибо».\n4. Почувствуй облегчение.",
                    why_it_helps: "Тренирует навык отказа в безопасной обстановке."
                },
                {
                    name: "Практика заземления",
                    duration: "5 минут",
                    instruction: "1. Встань босиком на пол.\n2. Почувствуй поверхность под ногами.\n3. Сделай 5 глубоких вдохов.\n4. Скажи про себя «Я здесь, я в безопасности».",
                    why_it_helps: "Возвращает в тело и снижает тревогу."
                }
            ],
            affirmations: [
                "Мои границы имеют значение",
                "Я имею право сказать «нет» без чувства вины",
                "Моя безопасность важнее чужого комфорта",
                "Я могу защищать себя спокойно и уверенно"
            ],
            daily_ritual: "Каждое утро, глядя в зеркало, скажи: «Сегодня я буду честен с собой и с другими»."
        },
        "ТФ": {
            pattern: {
                name: "Денежные блоки",
                description: `${address}, у тебя могут быть сложные отношения с деньгами. Ты можешь чувствовать вину за траты или страх просить повышение.`,
                origin: "Эти установки часто приходят из детства: «деньги — зло», «не хвастайся», «ты не заслужил».",
                manifestation: "стыд просить деньги, страх установить цену, вина после покупок",
                strength: "Ты умеешь ценить нематериальное — отношения, время, заботу."
            },
            practices: [
                {
                    name: "Медитация «Я достоин»",
                    duration: "5 минут",
                    instruction: "1. Сядь удобно, закрой глаза.\n2. Положи руку на сердце.\n3. Повторяй про себя «Я достоин процветания».\n4. Дыши спокойно.",
                    why_it_helps: "Перепрограммирует чувство недостойности."
                },
                {
                    name: "Список своих ценностей",
                    duration: "10 минут",
                    instruction: "1. Возьми лист бумаги.\n2. Напиши 10 своих качеств, за которые ты себя ценишь.\n3. Перечитай вслух.",
                    why_it_helps: "Напоминает о своей внутренней ценности."
                },
                {
                    name: "Дыхание изобилия",
                    duration: "3 минуты",
                    instruction: "1. На вдохе представь золотой свет.\n2. На выдохе — как он наполняет тело.\n3. Почувствуй тепло в груди.",
                    why_it_helps: "Создаёт ощущение внутреннего ресурса."
                }
            ],
            affirmations: [
                "Я достоин процветания",
                "Мой вклад имеет ценность",
                "Я принимаю деньги с радостью",
                "Я открыт для изобилия"
            ],
            daily_ritual: "Каждый вечер благодари себя за один сделанный шаг к финансовой свободе."
        },
        "УБ": {
            pattern: {
                name: "Экзистенциальная тревога",
                description: `${address}, ты часто задаёшься вопросом «зачем?». Бывает чувство пустоты или тревога перед будущим. Это нормально для думающего человека.`,
                origin: "Твой ум ищет глубину и не принимает поверхностных ответов. Это дар, но он может утомлять.",
                manifestation: "поиск смысла, тревога о будущем, чувство пустоты, зависание в выборе",
                strength: "Ты способен видеть глубже других. Твоя душа хочет настоящего — это дар философа."
            },
            practices: [
                {
                    name: "Дыхание «Здесь и сейчас»",
                    duration: "5 минут",
                    instruction: "1. Сосредоточься на дыхании.\n2. Замечай каждое ощущение в теле.\n3. Если мысли улетают — мягко возвращай внимание.\n4. Просто будь.",
                    why_it_helps: "Возвращает из мыслей о будущем в текущий момент."
                },
                {
                    name: "Упражнение «Мои смыслы»",
                    duration: "15 минут",
                    instruction: "1. Напиши, что для тебя важно.\n2. Какие моменты приносят радость?\n3. Что бы ты делал, если бы не нужно было зарабатывать?",
                    why_it_helps: "Проясняет личные ценности и ориентиры."
                },
                {
                    name: "Медитация с неопределённостью",
                    duration: "7 минут",
                    instruction: "1. Сядь и закрой глаза.\n2. Представь, что будущее — это туман.\n3. Вдохни этот туман и выдохни спокойствие.\n4. Скажи «Я в порядке прямо сейчас».",
                    why_it_helps: "Учится принимать неопределённость."
                }
            ],
            affirmations: [
                "Я в безопасности в этом моменте",
                "Мне не нужно знать все ответы сейчас",
                "Смысл рождается в моих действиях",
                "Я доверяю процессу жизни"
            ],
            daily_ritual: "Каждое утро задавай себе вопрос: «Что принесёт мне радость сегодня?»"
        },
        "ЧВ": {
            pattern: {
                name: "Тревожная привязанность",
                description: `${address}, в отношениях тебе бывает тревожно. Ты можешь бояться, что тебя бросят, или слишком сильно привязываться. Это утомляет.`,
                origin: "Этот паттерн формируется из опыта, когда забота была непредсказуемой. Твой организм привык быть начеку.",
                manifestation: "страх отвержения, потребность в постоянных подтверждениях, подстройка под других",
                strength: "Ты очень глубоко чувствуешь людей. Твоя способность к близости — огромная ценность."
            },
            practices: [
                {
                    name: "Встреча с внутренним ребёнком",
                    duration: "10 минут",
                    instruction: "1. Закрой глаза, представь себя в детстве.\n2. Скажи ему/ей: «Ты в безопасности, я с тобой».\n3. Обними себя за плечи.\n4. Побудь в этом состоянии.",
                    why_it_helps: "Исцеляет ранние травмы привязанности."
                },
                {
                    name: "Создание безопасного места",
                    duration: "7 минут",
                    instruction: "1. Представь место, где ты чувствуешь полную безопасность.\n2. Рассмотри детали: что там видно, слышно, чувствуешь?\n3. Запомни это ощущение.\n4. Возвращайся туда мысленно, когда тревожно.",
                    why_it_helps: "Даёт внутреннюю опору."
                },
                {
                    name: "Объятия себя",
                    duration: "3 минуты",
                    instruction: "1. Обхвати себя руками.\n2. Покачайся слегка.\n3. Скажи: «Я с тобой, я люблю тебя».\n4. Почувствуй тепло.",
                    why_it_helps: "Успокаивает нервную систему через телесный контакт."
                }
            ],
            affirmations: [
                "Я целостен сам по себе",
                "Я достоин любви без условий",
                "Моё одиночество — это время встречи с собой",
                "Я могу быть близким, не теряя себя"
            ],
            daily_ritual: "Каждый вечер пиши одну вещь, за которую ты благодарен себе сегодня."
        }
    };
    
    return fallbacks[weakVector] || fallbacks["ЧВ"];
}

// ============================================
// 7. ОСНОВНОЙ ЭКРАН (С ЛОАДЕРОМ)
// ============================================
async function showHealingScreen() {
    // Проверяем, прошёл ли тест
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    // Показываем загрузку
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="healingBackBtn">◀️ НАЗАД</button>
            <div class="healing-loading">
                <div class="healing-loading-spinner">🕯️</div>
                <div class="healing-loading-text">Фреди анализирует ваш профиль...</div>
                <div class="healing-loading-sub">Это займёт 20-30 секунд</div>
            </div>
        </div>
    `;
    
    addHealingStyles();
    
    document.getElementById('healingBackBtn')?.addEventListener('click', () => goBackToDashboard());
    
    // Загружаем профиль
    await loadUserProfileForHealing();
    
    // Обновляем текст загрузки
    const loadingText = document.querySelector('.healing-loading-text');
    if (loadingText) loadingText.textContent = 'Фреди подбирает практики исцеления...';
    
    // Генерируем контент через AI
    const healingContent = await generateHealingContent();
    healingState.currentHealing = healingContent;
    healingState.lastGenerated = new Date();
    
    // Рендерим результат
    renderHealingContent(container, healingContent);
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

// ============================================
// 8. ОТРИСОВКА КОНТЕНТА
// ============================================
function renderHealingContent(container, content) {
    if (!content || !content.pattern) {
        // Если контент невалидный, используем fallback
        content = getFallbackHealingContent();
    }
    
    const pattern = content.pattern;
    const practices = content.practices || [];
    const affirmations = content.affirmations || [];
    const dailyRitual = content.daily_ritual || '';
    
    // Формируем HTML практик
    let practicesHtml = '';
    practices.forEach((practice, idx) => {
        practicesHtml += `
            <div class="healing-practice" data-practice-idx="${idx}">
                <div class="healing-practice-header">
                    <span class="healing-practice-name">${practice.name}</span>
                    <span class="healing-practice-duration">⏱️ ${practice.duration}</span>
                </div>
                <div class="healing-practice-desc">${practice.why_it_helps || ''}</div>
                <div class="healing-practice-instruction" style="display: none;">
                    ${formatInstruction(practice.instruction)}
                </div>
                <button class="healing-practice-btn">📖 ПОКАЗАТЬ ИНСТРУКЦИЮ</button>
            </div>
        `;
    });
    
    // Формируем HTML аффирмаций
    let affirmationsHtml = '';
    affirmations.forEach((aff, idx) => {
        affirmationsHtml += `
            <div class="healing-affirmation" data-aff-idx="${idx}">
                <span class="healing-affirmation-quote">“</span>
                <span class="healing-affirmation-text">${aff}</span>
                <button class="healing-affirmation-copy">📋</button>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="full-content-page" id="healingScreen">
            <button class="back-btn" id="healingBackBtn2">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🕯️</div>
                <h1>Исцеление</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Работа с вашим глубинным паттерном
                </div>
            </div>
            
            <!-- Паттерн -->
            <div class="healing-section">
                <div class="healing-section-title">🧬 ВАШ ПАТТЕРН</div>
                <div class="healing-card">
                    <div class="healing-pattern-name">${pattern.name}</div>
                    <div class="healing-pattern-desc">${pattern.description}</div>
                    <div class="healing-pattern-origin">
                        <strong>📜 Как это формировалось:</strong> ${pattern.origin}
                    </div>
                    <div class="healing-pattern-manifestation">
                        <strong>🔍 Как проявляется:</strong> ${pattern.manifestation}
                    </div>
                    <div class="healing-pattern-strength">
                        <strong>💎 Ваша сила:</strong> ${pattern.strength}
                    </div>
                </div>
            </div>
            
            <!-- Практики -->
            <div class="healing-section">
                <div class="healing-section-title">🛠️ ПРАКТИКИ ИСЦЕЛЕНИЯ</div>
                <div class="healing-practices">
                    ${practicesHtml}
                </div>
            </div>
            
            <!-- Аффирмации -->
            <div class="healing-section">
                <div class="healing-section-title">📖 АФФИРМАЦИИ ДЛЯ КАЖДОГО ДНЯ</div>
                <div class="healing-affirmations">
                    ${affirmationsHtml}
                </div>
            </div>
            
            <!-- Ежедневный ритуал -->
            <div class="healing-section">
                <div class="healing-section-title">🌅 ЕЖЕДНЕВНЫЙ РИТУАЛ</div>
                <div class="healing-ritual">
                    <div class="healing-ritual-icon">✨</div>
                    <div class="healing-ritual-text">${dailyRitual}</div>
                </div>
            </div>
            
            <div class="healing-footer">
                <button id="refreshHealingBtn" class="healing-refresh-btn">
                    🔄 НОВЫЙ АНАЛИЗ
                </button>
            </div>
        </div>
    `;
    
    // Обработчики
    document.getElementById('healingBackBtn2')?.addEventListener('click', () => goBackToDashboard());
    
    document.getElementById('refreshHealingBtn')?.addEventListener('click', async () => {
        // Очищаем кэш и генерируем заново
        healingState.currentHealing = null;
        await showHealingScreen();
    });
    
    // Обработчики для практик
    document.querySelectorAll('.healing-practice-btn').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const instructionDiv = document.querySelector(`.healing-practice[data-practice-idx="${idx}"] .healing-practice-instruction`);
            if (instructionDiv) {
                if (instructionDiv.style.display === 'none') {
                    instructionDiv.style.display = 'block';
                    btn.textContent = '📖 СКРЫТЬ ИНСТРУКЦИЮ';
                } else {
                    instructionDiv.style.display = 'none';
                    btn.textContent = '📖 ПОКАЗАТЬ ИНСТРУКЦИЮ';
                }
            }
        });
    });
    
    // Обработчики для копирования аффирмаций
    document.querySelectorAll('.healing-affirmation-copy').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const text = document.querySelector(`.healing-affirmation[data-aff-idx="${idx}"] .healing-affirmation-text`)?.innerText;
            if (text) {
                navigator.clipboard.writeText(text);
                showToastMessage('📋 Аффирмация скопирована', 'success');
            }
        });
    });
}

function formatInstruction(instruction) {
    if (!instruction) return '';
    // Заменяем переносы строк на <br>
    let formatted = instruction.replace(/\n/g, '<br>');
    // Добавляем жирность для номеров шагов
    formatted = formatted.replace(/(\d+\.)/g, '<strong>$1</strong>');
    return `<div class="healing-instruction-content">${formatted}</div>`;
}

// ============================================
// 9. СТИЛИ
// ============================================
function addHealingStyles() {
    if (document.getElementById('healing-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'healing-styles';
    style.textContent = `
        .healing-loading {
            text-align: center;
            padding: 60px 20px;
        }
        .healing-loading-spinner {
            font-size: 64px;
            animation: healingPulse 2s ease-in-out infinite;
            display: inline-block;
        }
        @keyframes healingPulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.1); }
        }
        .healing-loading-text {
            font-size: 18px;
            font-weight: 600;
            margin-top: 16px;
        }
        .healing-loading-sub {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 8px;
        }
        
        .healing-section {
            margin-bottom: 24px;
        }
        .healing-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #ff6b3b;
            letter-spacing: 1px;
        }
        .healing-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.05), rgba(192,192,192,0.02));
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(224,224,224,0.1);
        }
        .healing-pattern-name {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ff6b3b;
        }
        .healing-pattern-desc {
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 16px;
        }
        .healing-pattern-origin, .healing-pattern-manifestation, .healing-pattern-strength {
            font-size: 13px;
            line-height: 1.5;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(224,224,224,0.1);
        }
        
        .healing-practices {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .healing-practice {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 16px;
        }
        .healing-practice-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .healing-practice-name {
            font-size: 15px;
            font-weight: 600;
        }
        .healing-practice-duration {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .healing-practice-desc {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        .healing-practice-instruction {
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 12px;
            margin: 12px 0;
            font-size: 13px;
            line-height: 1.5;
        }
        .healing-practice-btn {
            background: rgba(255,107,59,0.15);
            border: 1px solid rgba(255,107,59,0.3);
            border-radius: 30px;
            padding: 8px 16px;
            font-size: 12px;
            color: white;
            cursor: pointer;
        }
        
        .healing-affirmations {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .healing-affirmation {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 10px 16px;
        }
        .healing-affirmation-quote {
            font-size: 24px;
            color: #ff6b3b;
            opacity: 0.5;
        }
        .healing-affirmation-text {
            flex: 1;
            font-size: 13px;
            font-style: italic;
        }
        .healing-affirmation-copy {
            background: transparent;
            border: none;
            font-size: 18px;
            cursor: pointer;
            opacity: 0.5;
        }
        
        .healing-ritual {
            background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05));
            border-radius: 20px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .healing-ritual-icon {
            font-size: 32px;
        }
        .healing-ritual-text {
            flex: 1;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .healing-footer {
            margin-top: 24px;
        }
        .healing-refresh-btn {
            width: 100%;
            padding: 14px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 50px;
            color: white;
            font-size: 14px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// 10. ЭКСПОРТ
// ============================================
window.showHealingScreen = showHealingScreen;

console.log('✅ Модуль "Исцеление" загружен (healing.js v1.0)');
