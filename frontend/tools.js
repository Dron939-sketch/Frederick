// ============================================
// tools.js — Инструменты достижения целей
// Версия 1.0
// ============================================

// ============================================
// 1. БАЗА ИНСТРУМЕНТОВ ПО ЦЕЛЯМ
// ============================================

const TOOLS_DB = {
    business: {
        name: 'БИЗНЕС',
        emoji: '💼',
        description: 'Продвижение, узнаваемость, продажи',
        tools: [
            {
                id: 'reputation_analysis',
                name: 'Анализ общественного мнения',
                description: 'Узнайте, что на самом деле говорят о вашем бизнесе',
                type: 'analyzer',
                actions: [
                    'Сканирование упоминаний в интернете',
                    'Анализ тональности отзывов',
                    'Выявление ассоциаций с брендом',
                    'Составление карты восприятия'
                ],
                output: 'PDF-отчёт "Как меня видят клиенты"'
            },
            {
                id: 'reputation_strategy',
                name: 'Стратегия формирования мнения',
                description: 'Пошаговый план из 10 шагов',
                type: 'plan_generator',
                steps: [
                    { day: 1, task: 'Анализ текущего позиционирования', duration: '3 часа' },
                    { day: 2, task: 'Определение УТП', duration: '2 часа' },
                    { day: 3, task: 'Анализ конкурентов', duration: '4 часа' },
                    { day: 4, task: 'Выбор каналов коммуникации', duration: '2 часа' },
                    { day: 5, task: 'Создание контент-плана', duration: '3 часа' },
                    { day: 6, task: 'Настройка мониторинга', duration: '2 часа' },
                    { day: 7, task: 'Запуск пилотного поста', duration: '1 час' },
                    { day: 8, task: 'Анализ первых результатов', duration: '2 часа' },
                    { day: 9, task: 'Корректировка стратегии', duration: '2 часа' },
                    { day: 10, task: 'Масштабирование', duration: '3 часа' }
                ]
            },
            {
                id: 'ai_content_assistant',
                name: 'ИИ-ассистент по контенту',
                description: 'Генерирует посты, отвечает на отзывы',
                type: 'generator',
                features: [
                    'Генерация постов для соцсетей',
                    'Ответы на отзывы',
                    'Поиск инфоповодов',
                    'Анализ конкурентов'
                ]
            }
        ]
    },

    career: {
        name: 'КАРЬЕРА',
        emoji: '📈',
        description: 'Рост, развитие, переход',
        tools: [
            {
                id: 'profession_matcher',
                name: 'Карта профессий',
                description: '10+ профессий под ваш психотип',
                type: 'analyzer'
            },
            {
                id: 'skill_gap_analyzer',
                name: 'Анализ навыков',
                description: 'Чего не хватает для желаемой должности',
                type: 'analyzer'
            },
            {
                id: 'resume_builder',
                name: 'Конструктор резюме',
                description: 'С учётом ваших сильных сторон',
                type: 'generator'
            }
        ]
    },

    relationships: {
        name: 'ОТНОШЕНИЯ',
        emoji: '👥',
        description: 'Поиск, укрепление, гармония',
        tools: [
            {
                id: 'compatibility_analyzer',
                name: 'Анализ совместимости',
                description: 'С кем вам комфортно',
                type: 'analyzer'
            },
            {
                id: 'communication_plan',
                name: 'План коммуникации',
                description: 'Как улучшить общение с партнёром',
                type: 'plan_generator'
            }
        ]
    },

    personality: {
        name: 'ЛИЧНОСТЬ',
        emoji: '🎨',
        description: 'Саморазвитие, призвание, счастье',
        tools: [
            {
                id: 'purpose_finder',
                name: 'Поиск призвания',
                description: 'Квест из 10 шагов',
                type: 'quest'
            },
            {
                id: 'habit_builder',
                name: 'Конструктор привычек',
                description: 'Под ваш психотип',
                type: 'plan_generator'
            },
            {
                id: 'self_analysis',
                name: 'Чек-лист самоанализа',
                description: '10 вопросов для понимания себя',
                type: 'worksheet'
            }
        ]
    }
};

// ============================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
        return true; // не блокируем при ошибке сети
    }
}

async function loadUserVectors() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const res = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const data = await res.json();
        const bl = data.profile?.behavioral_levels || {};
        const avg = x => Array.isArray(x) ? x[x.length-1] : (x || 4);
        return { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
    } catch {
        return { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 };
    }
}

// ============================================
// 3. ГЛАВНЫЙ ЭКРАН
// ============================================

async function showToolsScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }

    const container = document.getElementById('screenContainer');
    if (!container) return;

    const vectors = await loadUserVectors();
    renderToolsMainScreen(container, vectors);
}

function renderToolsMainScreen(container, vectors) {
    const profileType = getProfileType(vectors);

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="toolsBackBtn">◀️ НАЗАД</button>

            <div class="content-header">
                <div class="content-emoji">🛠️</div>
                <h1>Инструменты достижения</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Подберите инструмент под вашу цель
                </div>
            </div>

            <div class="tools-profile-card">
                <div class="tools-profile-badge">🧬 ВАШ ПРОФИЛЬ: ${profileType.name}</div>
                <div class="tools-profile-vectors">
                    СБ-${vectors.СБ} · ТФ-${vectors.ТФ} · УБ-${vectors.УБ} · ЧВ-${vectors.ЧВ}
                </div>
                <div class="tools-profile-strength">💪 Сильная сторона: ${profileType.strength}</div>
                <div class="tools-profile-growth">⚠️ Зона роста: ${profileType.growth}</div>
            </div>

            <div class="tools-grid">
                ${Object.entries(TOOLS_DB).map(([key, tool]) => `
                    <div class="tools-category" data-category="${key}">
                        <div class="tools-category-emoji">${tool.emoji}</div>
                        <div class="tools-category-name">${tool.name}</div>
                        <div class="tools-category-desc">${tool.description}</div>
                        <div class="tools-category-arrow">→</div>
                    </div>
                `).join('')}
            </div>

            <div class="tools-custom-goal">
                <div class="tools-custom-label">🎯 ИЛИ ОПИШИТЕ СВОЮ ЦЕЛЬ</div>
                <textarea id="customGoalInput" class="tools-custom-input"
                    placeholder="Например: «Хочу, чтобы мой бизнес узнавали» или «Найти своё призвание»"
                    rows="2"></textarea>
                <button id="customGoalBtn" class="tools-custom-submit">
                    🔍 ПОДОБРАТЬ ИНСТРУМЕНТЫ
                </button>
            </div>
        </div>
    `;

    addToolsStyles();

    document.getElementById('toolsBackBtn')?.addEventListener('click', () => goBackToDashboard());

    document.querySelectorAll('.tools-category').forEach(card => {
        card.addEventListener('click', () => {
            renderCategoryScreen(container, card.dataset.category, null, vectors);
        });
    });

    document.getElementById('customGoalBtn')?.addEventListener('click', () => {
        const goal = document.getElementById('customGoalInput')?.value.trim();
        if (goal) {
            renderCategoryScreen(container, detectCategoryByGoal(goal), goal, vectors);
        } else {
            showToastMessage('📝 Пожалуйста, опишите вашу цель', 'warning');
        }
    });
}

// ============================================
// 4. ЭКРАН КАТЕГОРИИ
// ============================================

function renderCategoryScreen(container, category, customGoal = null, vectors = { СБ:4, ТФ:4, УБ:4, ЧВ:4 }) {
    const tool = TOOLS_DB[category];
    const profileType = getProfileType(vectors);
    const goalText = customGoal || getDefaultGoalForCategory(category);

    let toolsHtml = '';
    for (const t of tool.tools) {
        toolsHtml += `
            <div class="tools-item">
                <div class="tools-item-header">
                    <span class="tools-item-emoji">🛠️</span>
                    <span class="tools-item-name">${t.name}</span>
                </div>
                <div class="tools-item-desc">${t.description}</div>
                <div class="tools-item-actions">
                    <button class="tools-item-btn" data-tool="${t.id}" data-category="${category}">
                        ▶️ ИСПОЛЬЗОВАТЬ
                    </button>
                    <button class="tools-item-preview" data-tool="${t.id}">
                        📋 ПРИМЕР
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="categoryBackBtn">◀️ НАЗАД</button>

            <div class="content-header">
                <div class="content-emoji">${tool.emoji}</div>
                <h1>${tool.name}</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">${tool.description}</div>
            </div>

            <div class="tools-goal-banner">
                <div class="tools-goal-label">🎯 ВАША ЦЕЛЬ</div>
                <div class="tools-goal-text">"${goalText}"</div>
            </div>

            <div class="tools-profile-adapt">
                <div class="tools-adapt-icon">🧬</div>
                <div class="tools-adapt-text">
                    Инструменты адаптированы под ваш профиль <strong>${profileType.name}</strong><br>
                    <span style="font-size: 11px; color: var(--text-secondary);">
                        ${getAdaptationMessage(profileType, category)}
                    </span>
                </div>
            </div>

            <div class="tools-list">${toolsHtml}</div>
        </div>
    `;

    document.getElementById('categoryBackBtn')?.addEventListener('click', () => renderToolsMainScreen(container, vectors));

    document.querySelectorAll('.tools-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToolDetail(container, btn.dataset.category, btn.dataset.tool, goalText, vectors);
        });
    });

    document.querySelectorAll('.tools-item-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('📋 Пример будет доступен в следующей версии', 'info');
        });
    });
}

// ============================================
// 5. ДЕТАЛЬНЫЙ ЭКРАН ИНСТРУМЕНТА
// ============================================

function showToolDetail(container, category, toolId, goalText, vectors) {
    const profileType = getProfileType(vectors);

    if (toolId === 'reputation_strategy') {
        renderStrategyTool(container, category, toolId, goalText, vectors, profileType);
    } else if (toolId === 'ai_content_assistant') {
        renderAIAssistantTool(container, category, toolId, goalText, vectors, profileType);
    } else {
        renderGenericTool(container, category, toolId, goalText, vectors, profileType);
    }
}

function renderGenericTool(container, category, toolId, goalText, vectors, profileType) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="toolBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🛠️</div>
                <h1>Инструмент</h1>
            </div>
            <div style="text-align:center;padding:40px 20px">
                <div style="font-size:44px;margin-bottom:14px">🔧</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:8px">Скоро будет доступно</div>
                <div style="font-size:13px;color:var(--text-secondary)">Этот инструмент находится в разработке</div>
            </div>
        </div>
    `;
    document.getElementById('toolBackBtn')?.addEventListener('click', () => renderCategoryScreen(container, category, goalText, vectors));
}

// ============================================
// 6. СТРАТЕГИЯ ФОРМИРОВАНИЯ МНЕНИЯ
// ============================================

function renderStrategyTool(container, category, toolId, goalText, vectors, profileType) {
    const adaptedSteps = getAdaptedSteps(profileType);

    let stepsHtml = adaptedSteps.map((step, idx) => `
        <div class="strategy-step">
            <div class="strategy-step-num">${idx + 1}</div>
            <div class="strategy-step-content">
                <div class="strategy-step-title">${step.title}</div>
                <div class="strategy-step-desc">${step.desc}</div>
                <div class="strategy-step-duration">⏱️ ${step.duration}</div>
                <div class="strategy-step-action">
                    <button class="step-complete-btn" data-step="${idx}">✅ Отметить выполненным</button>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="toolBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📋</div>
                <h1>Стратегия формирования мнения</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Пошаговый план из ${adaptedSteps.length} шагов
                </div>
            </div>
            <div class="strategy-goal">🎯 Цель: "${goalText}"</div>
            <div class="strategy-adapt-note">
                🧬 План адаптирован под ваш профиль <strong>${profileType.name}</strong><br>
                ${getStrategyAdaptNote(profileType)}
            </div>
            <div class="strategy-steps">${stepsHtml}</div>
            <div class="strategy-footer">
                <button id="downloadPlanBtn" class="strategy-download-btn">📥 СКАЧАТЬ ПЛАН (PDF)</button>
                <button id="aiAdaptBtn" class="strategy-ai-btn">🤖 АДАПТИРОВАТЬ ПОД СЕБЯ</button>
            </div>
            <div class="strategy-progress">
                <div class="strategy-progress-label">Прогресс: 0/${adaptedSteps.length} шагов</div>
                <div class="strategy-progress-bar">
                    <div class="strategy-progress-fill" style="width: 0%"></div>
                </div>
            </div>
        </div>
    `;

    addStrategyStyles();

    document.getElementById('toolBackBtn')?.addEventListener('click', () => renderCategoryScreen(container, category, goalText, vectors));

    let completedSteps = JSON.parse(localStorage.getItem(`strategy_${toolId}_progress`) || '[]');
    updateStrategyProgress(completedSteps.length, adaptedSteps.length);

    document.querySelectorAll('.step-complete-btn').forEach(btn => {
        const stepIdx = parseInt(btn.dataset.step);
        if (completedSteps.includes(stepIdx)) {
            btn.textContent = '✅ Выполнено';
            btn.disabled = true;
            btn.style.opacity = '0.5';
        }
        btn.addEventListener('click', () => {
            if (!completedSteps.includes(stepIdx)) {
                completedSteps.push(stepIdx);
                localStorage.setItem(`strategy_${toolId}_progress`, JSON.stringify(completedSteps));
                btn.textContent = '✅ Выполнено';
                btn.disabled = true;
                btn.style.opacity = '0.5';
                updateStrategyProgress(completedSteps.length, adaptedSteps.length);
                showToastMessage(`✅ Шаг ${stepIdx + 1} выполнен!`, 'success');
            }
        });
    });

    document.getElementById('downloadPlanBtn')?.addEventListener('click', () => {
        showToastMessage('📥 PDF будет доступен в следующей версии', 'info');
    });
    document.getElementById('aiAdaptBtn')?.addEventListener('click', () => {
        showToastMessage('🤖 ИИ-адаптация будет доступна в следующей версии', 'info');
    });
}

// ============================================
// 7. ИИ-АССИСТЕНТ ПО КОНТЕНТУ
// ============================================

function renderAIAssistantTool(container, category, toolId, goalText, vectors, profileType) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="toolBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🤖</div>
                <h1>ИИ-ассистент по контенту</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">Генерирует посты, отвечает на отзывы</div>
            </div>
            <div class="ai-assistant-card">
                <div class="ai-tabs">
                    <button class="ai-tab active" data-tab="post">📝 ПОСТЫ</button>
                    <button class="ai-tab" data-tab="response">💬 ОТЗЫВЫ</button>
                    <button class="ai-tab" data-tab="ideas">💡 ИДЕИ</button>
                </div>
                <div class="ai-content" id="aiContent">
                    ${renderPostForm()}
                </div>
            </div>
        </div>
    `;

    addAIStyles();

    document.getElementById('toolBackBtn')?.addEventListener('click', () => renderCategoryScreen(container, category, goalText, vectors));

    document.querySelectorAll('.ai-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const content = document.getElementById('aiContent');
            if (content) {
                content.innerHTML = renderPostForm();
                bindPostForm(profileType);
            }
        });
    });

    bindPostForm(profileType);
}

function renderPostForm() {
    return `
        <div class="ai-form">
            <label>Тема поста:</label>
            <input type="text" id="postTopic" class="ai-input"
                placeholder="Например: Почему бизнесу нужен личный бренд">
            <label>Тон:</label>
            <select id="postTone" class="ai-select">
                <option value="expert">🎓 Экспертный</option>
                <option value="friendly">🤝 Дружелюбный</option>
                <option value="energetic">⚡ Энергичный</option>
                <option value="calm">🧘 Спокойный</option>
            </select>
            <label>Формат:</label>
            <select id="postFormat" class="ai-select">
                <option value="telegram">Telegram</option>
                <option value="vk">ВКонтакте</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
            </select>
            <button id="generatePostBtn" class="ai-generate-btn">✨ СГЕНЕРИРОВАТЬ ПОСТ</button>
        </div>
        <div class="ai-result" id="aiResult" style="display: none;">
            <div class="ai-result-header">
                <span>📝 Ваш пост готов</span>
                <button id="copyResultBtn" class="ai-copy-btn">📋 Копировать</button>
            </div>
            <div class="ai-result-content" id="aiResultContent"></div>
        </div>
    `;
}

function bindPostForm(profileType) {
    document.getElementById('generatePostBtn')?.addEventListener('click', () => {
        const topic = document.getElementById('postTopic')?.value;
        const tone  = document.getElementById('postTone')?.value;
        const format = document.getElementById('postFormat')?.value;
        if (!topic) { showToastMessage('📝 Введите тему поста', 'warning'); return; }
        showToastMessage('🤖 Генерирую пост...', 'info');
        setTimeout(() => {
            const resultDiv = document.getElementById('aiResult');
            const resultContent = document.getElementById('aiResultContent');
            if (resultContent) resultContent.innerHTML = generateMockPost(topic, tone, format, profileType);
            if (resultDiv) resultDiv.style.display = 'block';
        }, 1500);
    });
    document.getElementById('copyResultBtn')?.addEventListener('click', () => {
        const content = document.getElementById('aiResultContent')?.innerText;
        if (content) {
            navigator.clipboard.writeText(content);
            showToastMessage('📋 Пост скопирован', 'success');
        }
    });
}

// ============================================
// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function getProfileType(vectors) {
    const { СБ: sb, ТФ: tf, УБ: ub, ЧВ: chv } = vectors;
    if (ub >= 5 && sb >= 4)  return { name: 'СТРАТЕГ',       strength: 'стратегическое мышление',    growth: 'эмоциональный интеллект' };
    if (chv >= 5 && sb >= 3) return { name: 'ЭМПАТ',         strength: 'понимание людей',             growth: 'структурирование' };
    if (sb >= 5 && tf >= 4)  return { name: 'ЛИДЕР',         strength: 'уверенность и решительность', growth: 'гибкость' };
    if (ub >= 5)             return { name: 'АНАЛИТИК',      strength: 'системное мышление',          growth: 'действие' };
    if (chv >= 5)            return { name: 'КОММУНИКАТОР',  strength: 'эмпатия и контактность',      growth: 'аналитика' };
    return                          { name: 'ИССЛЕДОВАТЕЛЬ', strength: 'любопытство и адаптивность',  growth: 'фокус' };
}

function getAdaptationMessage(profileType, category) {
    const m = {
        СТРАТЕГ:       'Вам нужны чёткие алгоритмы и инструменты, а не общие советы',
        ЭМПАТ:         'Вам важны человеческие истории и примеры из жизни',
        ЛИДЕР:         'Вам подходят амбициозные планы и быстрые результаты',
        АНАЛИТИК:      'Вам нужны цифры, факты и проверенные методы',
        КОММУНИКАТОР:  'Вам важна обратная связь и обсуждение',
        ИССЛЕДОВАТЕЛЬ: 'Вам подходят эксперименты и разные варианты'
    };
    return m[profileType.name] || 'Инструменты адаптированы под ваш психотип';
}

function getAdaptedSteps(profileType) {
    const base = [
        { title: 'Анализ текущего позиционирования', desc: 'Изучите, как вас воспринимают сейчас', duration: '3 часа' },
        { title: 'Определение УТП', desc: 'Сформулируйте, в чём ваша уникальность', duration: '2 часа' },
        { title: 'Анализ конкурентов', desc: 'Изучите, как продвигаются другие', duration: '4 часа' },
        { title: 'Выбор каналов коммуникации', desc: 'Где ваша аудитория', duration: '2 часа' },
        { title: 'Создание контент-плана', desc: 'Что, когда и где публиковать', duration: '3 часа' }
    ];
    const suffix = profileType.name === 'ЭМПАТ'
        ? ' — спросите у клиентов, что им важно'
        : profileType.name === 'СТРАТЕГ'
            ? ' — используйте аналитику и структурированный подход'
            : '';
    return base.map(s => ({ ...s, desc: s.desc + suffix }));
}

function getStrategyAdaptNote(profileType) {
    const n = {
        СТРАТЕГ:       '✅ Шаги разбиты на чёткие этапы с конкретными сроками',
        ЭМПАТ:         '✅ Добавлены пункты про сбор обратной связи от клиентов',
        ЛИДЕР:         '✅ Акцент на быстрые победы и измеримые результаты',
        АНАЛИТИК:      '✅ Добавлены метрики для отслеживания прогресса',
        КОММУНИКАТОР:  '✅ Включены шаги по обсуждению с командой',
        ИССЛЕДОВАТЕЛЬ: '✅ Предложены разные варианты стратегий'
    };
    return n[profileType.name] || 'План адаптирован под ваш психотип';
}

function detectCategoryByGoal(goal) {
    const g = goal.toLowerCase();
    if (g.includes('бизнес') || g.includes('клиент') || g.includes('продаж') || g.includes('узнава')) return 'business';
    if (g.includes('карьер') || g.includes('работа') || g.includes('должност') || g.includes('повышен')) return 'career';
    if (g.includes('отношен') || g.includes('любов') || g.includes('друг') || g.includes('семья')) return 'relationships';
    return 'personality';
}

function getDefaultGoalForCategory(category) {
    const d = {
        business:      'Повысить узнаваемость бизнеса',
        career:        'Найти работу мечты',
        relationships: 'Улучшить отношения с близкими',
        personality:   'Найти своё призвание'
    };
    return d[category] || 'Достичь поставленной цели';
}

function updateStrategyProgress(completed, total) {
    const percent = (completed / total) * 100;
    const fillBar = document.querySelector('.strategy-progress-fill');
    const label   = document.querySelector('.strategy-progress-label');
    if (fillBar) fillBar.style.width = `${percent}%`;
    if (label)   label.textContent = `Прогресс: ${completed}/${total} шагов`;
}

function generateMockPost(topic, tone, format, profileType) {
    return `<strong>📢 ${topic}</strong><br><br>
Задумывались, почему одни предприниматели становятся медийными личностями, а другие остаются в тени?<br><br>
<strong>Ключевые выводы:</strong><br>
• Личный бренд работает 24/7, даже когда вы спите<br>
• Доверие к личности выше, чем доверие к компании<br>
• Ваша экспертность — это актив, который растёт в цене<br><br>
<strong>Что делать прямо сейчас:</strong><br>
1. Определите свою уникальную экспертизу<br>
2. Начните регулярно публиковать полезный контент<br>
3. Взаимодействуйте с аудиторией<br><br>
🔥 <em>А вы уже работаете над личным брендом?</em><br><br>
#личныйбренд #экспертность #бизнес`;
}

// ============================================
// 9. СТИЛИ
// ============================================

function addToolsStyles() {
    if (document.getElementById('tools-styles')) return;
    const style = document.createElement('style');
    style.id = 'tools-styles';
    style.textContent = `
        .tools-profile-card {
            background: rgba(224,224,224,0.06); border: 1px solid rgba(224,224,224,0.14);
            border-radius: 20px; padding: 16px; margin-bottom: 24px; text-align: center;
        }
        .tools-profile-badge   { font-size: 14px; font-weight: 600; margin-bottom: 6px; color: var(--chrome); }
        .tools-profile-vectors { font-family: monospace; font-size: 12px; margin-bottom: 8px; color: var(--text-secondary); }
        .tools-profile-strength, .tools-profile-growth { font-size: 11px; margin-top: 4px; color: var(--text-secondary); }
        .tools-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        .tools-category {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 20px; padding: 20px 16px; cursor: pointer;
            transition: background 0.2s, transform 0.15s; position: relative;
        }
        .tools-category:hover  { background: rgba(224,224,224,0.1); transform: translateY(-2px); }
        .tools-category:active { transform: scale(0.97); }
        .tools-category-emoji  { font-size: 36px; margin-bottom: 8px; }
        .tools-category-name   { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .tools-category-desc   { font-size: 11px; color: var(--text-secondary); }
        .tools-category-arrow  { position: absolute; bottom: 16px; right: 16px; font-size: 18px; opacity: 0.4; }
        .tools-custom-goal { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1); border-radius: 20px; padding: 16px; }
        .tools-custom-label { font-size: 12px; margin-bottom: 8px; color: var(--text-secondary); font-weight: 600; }
        .tools-custom-input {
            width: 100%; background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 16px; padding: 12px; color: var(--text-primary); font-size: 14px;
            margin-bottom: 12px; resize: vertical; font-family: inherit; box-sizing: border-box;
        }
        .tools-custom-submit {
            width: 100%; padding: 12px;
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); border-radius: 50px;
            color: var(--text-primary); font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .tools-goal-banner { background: rgba(224,224,224,0.06); border-radius: 16px; padding: 12px; margin-bottom: 20px; text-align: center; }
        .tools-goal-label  { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px; }
        .tools-goal-text   { font-size: 14px; font-weight: 500; }
        .tools-profile-adapt  { display: flex; gap: 12px; background: rgba(224,224,224,0.05); border-radius: 16px; padding: 12px; margin-bottom: 20px; }
        .tools-adapt-icon { font-size: 28px; }
        .tools-adapt-text { font-size: 12px; line-height: 1.4; }
        .tools-list { display: flex; flex-direction: column; gap: 16px; }
        .tools-item { background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1); border-radius: 20px; padding: 16px; }
        .tools-item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .tools-item-emoji  { font-size: 24px; }
        .tools-item-name   { font-size: 16px; font-weight: 600; }
        .tools-item-desc   { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
        .tools-item-actions { display: flex; gap: 10px; }
        .tools-item-btn, .tools-item-preview { padding: 8px 16px; border-radius: 30px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .tools-item-btn     { background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); color: var(--text-primary); }
        .tools-item-preview { background: rgba(224,224,224,0.06); border: 1px solid rgba(224,224,224,0.12); color: var(--text-secondary); }
    `;
    document.head.appendChild(style);
}

function addStrategyStyles() {
    if (document.getElementById('strategy-styles')) return;
    const style = document.createElement('style');
    style.id = 'strategy-styles';
    style.textContent = `
        .strategy-goal { background: rgba(224,224,224,0.06); border-radius: 16px; padding: 12px; margin-bottom: 16px; text-align: center; font-size: 14px; font-weight: 500; }
        .strategy-adapt-note { background: rgba(224,224,224,0.05); border-radius: 12px; padding: 10px; margin-bottom: 20px; font-size: 12px; text-align: center; }
        .strategy-steps { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
        .strategy-step { display: flex; gap: 16px; background: rgba(224,224,224,0.05); border-radius: 16px; padding: 14px; }
        .strategy-step-num { width: 32px; height: 32px; background: rgba(224,224,224,0.14); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .strategy-step-content { flex: 1; }
        .strategy-step-title    { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .strategy-step-desc     { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
        .strategy-step-duration { font-size: 10px; color: var(--text-secondary); margin-bottom: 8px; }
        .step-complete-btn { padding: 6px 12px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; font-size: 11px; cursor: pointer; color: var(--text-primary); font-family: inherit; }
        .strategy-footer { display: flex; gap: 12px; margin-bottom: 20px; }
        .strategy-download-btn, .strategy-ai-btn { flex: 1; padding: 12px; border-radius: 50px; font-size: 13px; cursor: pointer; font-family: inherit; }
        .strategy-download-btn { background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.18); color: var(--text-primary); }
        .strategy-ai-btn       { background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14); color: var(--text-secondary); }
        .strategy-progress { background: rgba(224,224,224,0.05); border-radius: 12px; padding: 12px; }
        .strategy-progress-label { font-size: 11px; margin-bottom: 6px; color: var(--text-secondary); }
        .strategy-progress-bar  { height: 6px; background: rgba(224,224,224,0.1); border-radius: 3px; overflow: hidden; }
        .strategy-progress-fill { height: 100%; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); border-radius: 3px; transition: width 0.3s; }
    `;
    document.head.appendChild(style);
}

function addAIStyles() {
    if (document.getElementById('ai-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-styles';
    style.textContent = `
        .ai-assistant-card { background: rgba(224,224,224,0.05); border-radius: 24px; overflow: hidden; }
        .ai-tabs { display: flex; background: rgba(224,224,224,0.03); border-bottom: 1px solid rgba(224,224,224,0.1); }
        .ai-tab { flex: 1; padding: 14px; background: transparent; border: none; color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .ai-tab.active { color: var(--chrome); border-bottom: 2px solid var(--chrome); }
        .ai-content { padding: 20px; }
        .ai-form { display: flex; flex-direction: column; gap: 12px; }
        .ai-form label { font-size: 12px; font-weight: 600; }
        .ai-input, .ai-select {
            background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.2);
            border-radius: 12px; padding: 12px; color: var(--text-primary); font-size: 14px; font-family: inherit;
        }
        .ai-generate-btn {
            padding: 14px; background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); border-radius: 50px;
            color: var(--text-primary); font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px;
        }
        .ai-result { margin-top: 20px; background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; }
        .ai-result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ai-copy-btn { padding: 6px 12px; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; font-size: 11px; cursor: pointer; color: var(--text-primary); font-family: inherit; }
        .ai-result-content { font-size: 13px; line-height: 1.5; }
    `;
    document.head.appendChild(style);
}

// ============================================
// 10. ЭКСПОРТ
// ============================================
window.showToolsScreen = showToolsScreen;
window.showPracticesScreen = showToolsScreen; // алиас

console.log('✅ Модуль инструментов загружен (tools.js v1.0)');
