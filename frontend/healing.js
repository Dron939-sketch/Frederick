// ============================================
// healing.js — Исцеление (AI-генерируемый контент)
// Версия 1.0 — динамический анализ профиля
// ============================================

let healingState = {
    isLoading: false,
    currentHealing: null,
    lastGenerated: null,
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'Пользователь',
    userGender: 'other',
    userAge: null,
    userCity: null,
    weakVector: 'ЧВ',
    weakScore: 4,
    profileType: 'АНАЛИТИК'
};

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

async function loadUserProfileForHealing() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

        const contextRes = await fetch(`${apiUrl}/api/get-context/${userId}`);
        const contextData = await contextRes.json();
        const context = contextData.context || {};

        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const bl = profile.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x || 4);

        const vectors = { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
        const minEntry = Object.entries(vectors).sort((a,b) => a[1]-b[1])[0];

        healingState.userVectors  = vectors;
        healingState.weakVector   = minEntry[0];
        healingState.weakScore    = minEntry[1];
        healingState.userName     = localStorage.getItem('fredi_user_name') || context.name || 'друг';
        healingState.userGender   = context.gender || 'other';
        healingState.userAge      = context.age || null;
        healingState.userCity     = context.city || null;
        healingState.profileType  = profile.perception_type || 'АНАЛИТИК';
    } catch (error) {
        console.warn('Failed to load user profile:', error);
    }
}

function buildHealingPrompt() {
    const v = healingState.userVectors;
    const vectorNames = {
        "СБ": "Страх конфликтов и подавление себя",
        "ТФ": "Денежные блоки и чувство недостойности",
        "УБ": "Экзистенциальная тревога и поиск смысла",
        "ЧВ": "Тревожная привязанность и страх отвержения"
    };
    const address    = healingState.userGender === 'male' ? 'брат' : healingState.userGender === 'female' ? 'сестрёнка' : 'друг';
    const levelDesc  = healingState.weakScore <= 2 ? "сильно выражен" : healingState.weakScore <= 4 ? "умеренно выражен" : "слабо выражен";
    const weakName   = vectorNames[healingState.weakVector] || "психологический паттерн";

    return `Ты — Фреди, виртуальный психолог. Создай персонализированный раздел "Исцеление".

ПОЛЬЗОВАТЕЛЬ:
- Имя: ${healingState.userName}, обращение: ${address}
- Возраст: ${healingState.userAge || 'не указан'}, город: ${healingState.userCity || 'не указан'}
- Психотип: ${healingState.profileType}
- Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}
- Основной паттерн: ${weakName} (уровень: ${levelDesc})

СХЕМА ОТВЕТА (JSON):
{
    "pattern": {
        "name": "Название паттерна",
        "description": "Как проявляется у пользователя (2-3 предложения, обращение на ты)",
        "origin": "Как мог сформироваться (1-2 предложения)",
        "manifestation": "Проявления через запятую",
        "strength": "Сильная сторона за этим паттерном"
    },
    "practices": [
        { "name": "...", "duration": "... минут", "instruction": "1. ... 2. ... 3. ...", "why_it_helps": "..." },
        { "name": "...", "duration": "... минут", "instruction": "1. ... 2. ... 3. ...", "why_it_helps": "..." },
        { "name": "...", "duration": "... минут", "instruction": "1. ... 2. ... 3. ...", "why_it_helps": "..." }
    ],
    "affirmations": ["...", "...", "...", "..."],
    "daily_ritual": "Короткое ежедневное действие на 2-3 минуты"
}

Правила: только JSON, без markdown, тексты на русском, обращение на «ты» и «${address}», 3 практики, 4 аффирмации.`;
}

async function generateHealingContent() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

    try {
        const response = await fetch(`${apiUrl}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                prompt: buildHealingPrompt(),
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (data.success && data.content) {
            let jsonStr = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(jsonStr);
        }
    } catch (error) {
        console.error('Error generating healing content:', error);
    }
    return getFallbackHealingContent();
}

function getFallbackHealingContent() {
    const address = healingState.userGender === 'male' ? 'брат' : healingState.userGender === 'female' ? 'сестрёнка' : 'друг';
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
                { name: "Дыхание для границ", duration: "3 минуты", instruction: "1. Сядь удобно, выпрями спину.\n2. На вдохе представь светящуюся сферу вокруг себя.\n3. На выдохе почувствуй, как она становится плотнее.\n4. Повтори 10 раз.", why_it_helps: "Помогает ощутить свои границы физически." },
                { name: "Упражнение «Твёрдое нет»", duration: "5 минут", instruction: "1. Вспомни ситуацию, где тебе нужно было отказать.\n2. Закрой глаза и прокрути её.\n3. На выдохе мысленно скажи «Нет, спасибо».\n4. Почувствуй облегчение.", why_it_helps: "Тренирует навык отказа в безопасной обстановке." },
                { name: "Практика заземления", duration: "5 минут", instruction: "1. Встань босиком на пол.\n2. Почувствуй поверхность под ногами.\n3. Сделай 5 глубоких вдохов.\n4. Скажи про себя «Я здесь, я в безопасности».", why_it_helps: "Возвращает в тело и снижает тревогу." }
            ],
            affirmations: ["Мои границы имеют значение", "Я имею право сказать «нет» без чувства вины", "Моя безопасность важнее чужого комфорта", "Я могу защищать себя спокойно и уверенно"],
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
                { name: "Медитация «Я достоин»", duration: "5 минут", instruction: "1. Сядь удобно, закрой глаза.\n2. Положи руку на сердце.\n3. Повторяй «Я достоин процветания».\n4. Дыши спокойно.", why_it_helps: "Перепрограммирует чувство недостойности." },
                { name: "Список своих ценностей", duration: "10 минут", instruction: "1. Возьми лист бумаги.\n2. Напиши 10 своих качеств, которые ты ценишь.\n3. Перечитай вслух.", why_it_helps: "Напоминает о своей внутренней ценности." },
                { name: "Дыхание изобилия", duration: "3 минуты", instruction: "1. На вдохе представь золотой свет.\n2. На выдохе он наполняет тело.\n3. Почувствуй тепло в груди.", why_it_helps: "Создаёт ощущение внутреннего ресурса." }
            ],
            affirmations: ["Я достоин процветания", "Мой вклад имеет ценность", "Я принимаю деньги с радостью", "Я открыт для изобилия"],
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
                { name: "Дыхание «Здесь и сейчас»", duration: "5 минут", instruction: "1. Сосредоточься на дыхании.\n2. Замечай каждое ощущение в теле.\n3. Если мысли улетают — мягко возвращай внимание.\n4. Просто будь.", why_it_helps: "Возвращает из мыслей о будущем в текущий момент." },
                { name: "Упражнение «Мои смыслы»", duration: "15 минут", instruction: "1. Напиши, что для тебя важно.\n2. Какие моменты приносят радость?\n3. Что бы ты делал, если бы не нужно было зарабатывать?", why_it_helps: "Проясняет личные ценности и ориентиры." },
                { name: "Медитация с неопределённостью", duration: "7 минут", instruction: "1. Сядь и закрой глаза.\n2. Представь, что будущее — это туман.\n3. Вдохни этот туман и выдохни спокойствие.\n4. Скажи «Я в порядке прямо сейчас».", why_it_helps: "Учит принимать неопределённость." }
            ],
            affirmations: ["Я в безопасности в этом моменте", "Мне не нужно знать все ответы сейчас", "Смысл рождается в моих действиях", "Я доверяю процессу жизни"],
            daily_ritual: "Каждое утро задавай себе вопрос: «Что принесёт мне радость сегодня?»"
        },
        "ЧВ": {
            pattern: {
                name: "Тревожная привязанность",
                description: `${address}, в отношениях тебе бывает тревожно. Ты можешь бояться, что тебя бросят, или слишком сильно привязываться. Это утомляет.`,
                origin: "Этот паттерн формируется из опыта, когда забота была непредсказуемой. Твой организм привык быть начеку.",
                manifestation: "страх отвержения, потребность в подтверждениях, подстройка под других",
                strength: "Ты очень глубоко чувствуешь людей. Твоя способность к близости — огромная ценность."
            },
            practices: [
                { name: "Встреча с внутренним ребёнком", duration: "10 минут", instruction: "1. Закрой глаза, представь себя в детстве.\n2. Скажи ему «Ты в безопасности, я с тобой».\n3. Обними себя за плечи.\n4. Побудь в этом состоянии.", why_it_helps: "Исцеляет ранние травмы привязанности." },
                { name: "Создание безопасного места", duration: "7 минут", instruction: "1. Представь место, где ты в полной безопасности.\n2. Рассмотри детали: что видно, слышно, чувствуешь?\n3. Запомни это ощущение.\n4. Возвращайся туда мысленно, когда тревожно.", why_it_helps: "Даёт внутреннюю опору." },
                { name: "Объятия себя", duration: "3 минуты", instruction: "1. Обхвати себя руками.\n2. Покачайся слегка.\n3. Скажи «Я с тобой, я люблю тебя».\n4. Почувствуй тепло.", why_it_helps: "Успокаивает нервную систему через телесный контакт." }
            ],
            affirmations: ["Я целостен сам по себе", "Я достоин любви без условий", "Моё одиночество — это время встречи с собой", "Я могу быть близким, не теряя себя"],
            daily_ritual: "Каждый вечер пиши одну вещь, за которую ты благодарен себе сегодня."
        }
    };
    return fallbacks[healingState.weakVector] || fallbacks["ЧВ"];
}

async function showHealingScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }

    const container = document.getElementById('screenContainer');
    if (!container) return;

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

    await loadUserProfileForHealing();

    const loadingText = document.querySelector('.healing-loading-text');
    if (loadingText) loadingText.textContent = 'Фреди подбирает практики исцеления...';

    const healingContent = await generateHealingContent();
    healingState.currentHealing = healingContent;
    healingState.lastGenerated  = new Date();

    renderHealingContent(container, healingContent);
}

function renderHealingContent(container, content) {
    if (!content || !content.pattern) content = getFallbackHealingContent();

    const pattern     = content.pattern;
    const practices   = content.practices   || [];
    const affirmations= content.affirmations|| [];
    const dailyRitual = content.daily_ritual|| '';

    const practicesHtml = practices.map((p, idx) => `
        <div class="healing-practice" data-practice-idx="${idx}">
            <div class="healing-practice-header">
                <span class="healing-practice-name">${p.name}</span>
                <span class="healing-practice-duration">⏱️ ${p.duration}</span>
            </div>
            <div class="healing-practice-desc">${p.why_it_helps || ''}</div>
            <div class="healing-practice-instruction" style="display:none">
                ${formatInstruction(p.instruction)}
            </div>
            <button class="healing-practice-btn">📖 ПОКАЗАТЬ ИНСТРУКЦИЮ</button>
        </div>`).join('');

    const affirmationsHtml = affirmations.map((aff, idx) => `
        <div class="healing-affirmation" data-aff-idx="${idx}">
            <span class="healing-affirmation-quote">"</span>
            <span class="healing-affirmation-text">${aff}</span>
            <button class="healing-affirmation-copy">📋</button>
        </div>`).join('');

    container.innerHTML = `
        <div class="full-content-page" id="healingScreen">
            <button class="back-btn" id="healingBackBtn2">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🕯️</div>
                <h1>Исцеление</h1>
                <div style="font-size:12px;color:var(--text-secondary)">Работа с вашим глубинным паттерном</div>
            </div>

            <div class="healing-section">
                <div class="healing-section-title">🧬 ВАШ ПАТТЕРН</div>
                <div class="healing-card">
                    <div class="healing-pattern-name">${pattern.name}</div>
                    <div class="healing-pattern-desc">${pattern.description}</div>
                    <div class="healing-pattern-origin"><strong>📜 Как формировалось:</strong> ${pattern.origin}</div>
                    <div class="healing-pattern-manifestation"><strong>🔍 Как проявляется:</strong> ${pattern.manifestation}</div>
                    <div class="healing-pattern-strength"><strong>💎 Ваша сила:</strong> ${pattern.strength}</div>
                </div>
            </div>

            <div class="healing-section">
                <div class="healing-section-title">🛠️ ПРАКТИКИ ИСЦЕЛЕНИЯ</div>
                <div class="healing-practices">${practicesHtml}</div>
            </div>

            <div class="healing-section">
                <div class="healing-section-title">📖 АФФИРМАЦИИ ДЛЯ КАЖДОГО ДНЯ</div>
                <div class="healing-affirmations">${affirmationsHtml}</div>
            </div>

            <div class="healing-section">
                <div class="healing-section-title">🌅 ЕЖЕДНЕВНЫЙ РИТУАЛ</div>
                <div class="healing-ritual">
                    <div class="healing-ritual-icon">✨</div>
                    <div class="healing-ritual-text">${dailyRitual}</div>
                </div>
            </div>

            <div class="healing-footer">
                <button id="refreshHealingBtn" class="healing-refresh-btn">🔄 НОВЫЙ АНАЛИЗ</button>
            </div>
        </div>
    `;

    document.getElementById('healingBackBtn2')?.addEventListener('click', () => goBackToDashboard());
    document.getElementById('refreshHealingBtn')?.addEventListener('click', async () => {
        healingState.currentHealing = null;
        await showHealingScreen();
    });

    document.querySelectorAll('.healing-practice-btn').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const instrDiv = document.querySelector(`.healing-practice[data-practice-idx="${idx}"] .healing-practice-instruction`);
            if (!instrDiv) return;
            const open = instrDiv.style.display !== 'none';
            instrDiv.style.display = open ? 'none' : 'block';
            btn.textContent = open ? '📖 ПОКАЗАТЬ ИНСТРУКЦИЮ' : '📖 СКРЫТЬ ИНСТРУКЦИЮ';
        });
    });

    document.querySelectorAll('.healing-affirmation-copy').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const text = document.querySelector(`.healing-affirmation[data-aff-idx="${idx}"] .healing-affirmation-text`)?.innerText;
            if (text) {
                copyToClipboard(text);
                showToastMessage('📋 Аффирмация скопирована', 'success');
            }
        });
    });
}

function formatInstruction(instruction) {
    if (!instruction) return '';
    let formatted = instruction.replace(/\n/g, '<br>').replace(/(\d+\.)/g, '<strong>$1</strong>');
    return `<div class="healing-instruction-content">${formatted}</div>`;
}

function addHealingStyles() {
    if (document.getElementById('healing-styles')) return;
    const style = document.createElement('style');
    style.id = 'healing-styles';
    style.textContent = `
        .healing-loading { text-align:center; padding:60px 20px; }
        .healing-loading-spinner { font-size:64px; animation:healingPulse 2s ease-in-out infinite; display:inline-block; }
        @keyframes healingPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.1)} }
        .healing-loading-text { font-size:18px; font-weight:600; margin-top:16px; }
        .healing-loading-sub  { font-size:12px; color:var(--text-secondary); margin-top:8px; }

        .healing-section { margin-bottom:24px; }
        .healing-section-title { font-size:11px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:var(--chrome); margin-bottom:12px; }

        .healing-card {
            background:linear-gradient(135deg,rgba(224,224,224,0.07),rgba(192,192,192,0.02));
            border-radius:20px; padding:20px; border:1px solid rgba(224,224,224,0.15);
        }
        .healing-pattern-name { font-size:18px; font-weight:700; margin-bottom:12px; color:var(--chrome); }
        .healing-pattern-desc { font-size:14px; line-height:1.6; margin-bottom:14px; }
        .healing-pattern-origin, .healing-pattern-manifestation, .healing-pattern-strength {
            font-size:13px; line-height:1.5; color:var(--text-secondary);
            margin-top:12px; padding-top:12px; border-top:1px solid rgba(224,224,224,0.1);
        }

        .healing-practices { display:flex; flex-direction:column; gap:12px; }
        .healing-practice { background:rgba(224,224,224,0.05); border:1px solid rgba(224,224,224,0.1); border-radius:16px; padding:16px; }
        .healing-practice-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .healing-practice-name   { font-size:15px; font-weight:600; }
        .healing-practice-duration { font-size:11px; color:var(--text-secondary); }
        .healing-practice-desc   { font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.5; }
        .healing-practice-instruction {
            background:rgba(224,224,224,0.06); border-radius:12px; padding:12px;
            margin:12px 0; font-size:13px; line-height:1.65;
        }
        .healing-practice-btn {
            background:rgba(224,224,224,0.08); border:1px solid rgba(224,224,224,0.2);
            border-radius:30px; padding:8px 16px; font-size:12px;
            color:var(--text-primary); cursor:pointer; font-family:inherit;
        }

        .healing-affirmations { display:flex; flex-direction:column; gap:10px; }
        .healing-affirmation {
            display:flex; align-items:center; gap:8px;
            background:rgba(224,224,224,0.05); border-radius:50px; padding:10px 16px;
        }
        .healing-affirmation-quote { font-size:22px; color:var(--chrome); opacity:0.5; }
        .healing-affirmation-text  { flex:1; font-size:13px; font-style:italic; color:var(--text-secondary); }
        .healing-affirmation-copy  { background:transparent; border:none; font-size:18px; cursor:pointer; opacity:0.5; }

        .healing-ritual {
            background:rgba(224,224,224,0.06); border:1px solid rgba(224,224,224,0.14);
            border-radius:20px; padding:20px; display:flex; align-items:center; gap:16px;
        }
        .healing-ritual-icon { font-size:32px; flex-shrink:0; }
        .healing-ritual-text { flex:1; font-size:14px; line-height:1.6; color:var(--text-secondary); }

        .healing-footer { margin-top:24px; }
        .healing-refresh-btn {
            width:100%; padding:13px;
            background:rgba(224,224,224,0.07); border:1px solid rgba(224,224,224,0.18);
            border-radius:50px; color:var(--text-secondary); font-size:14px;
            cursor:pointer; font-family:inherit;
        }
        .healing-refresh-btn:hover { background:rgba(224,224,224,0.12); color:var(--text-primary); }
    `;
    document.head.appendChild(style);
}

window.showHealingScreen = showHealingScreen;
console.log('✅ Модуль "Исцеление" загружен (healing.js v1.0)');
