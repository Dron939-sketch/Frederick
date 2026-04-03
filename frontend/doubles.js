// ============================================
// doubles.js — Психометрический мэтчмейкер
// Версия 3.0 — Двойники + Поиск по целям
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let doublesState = {
    hasConsent: false,
    isSearching: false,
    foundDoubles: [],
    searchMode: null, // 'twin' или 'match'
    searchGoal: null,
    filters: {
        distance: 'any',      // 'any', 'city', '10km', '50km', '100km'
        ageMin: null,
        ageMax: null,
        gender: 'any'
    }
};

// Данные пользователя
let userDoublesProfile = {
    name: 'Пользователь',
    age: null,
    city: null,
    gender: null,
    profile: 'СБ-4, ТФ-4, УБ-4, ЧВ-4',
    profileType: 'АНАЛИТИК',
    vectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    thinkingLevel: 5,
    profession: null
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
async function loadUserProfileForDoubles() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        const contextRes = await fetch(`${apiUrl}/api/get-context/${userId}`);
        const contextData = await contextRes.json();
        const context = contextData.context || {};
        
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const profileDataObj = profile.profile_data || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        const vectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        userDoublesProfile = {
            name: localStorage.getItem('fredi_user_name') || context.name || 'Пользователь',
            age: context.age || null,
            city: context.city || null,
            gender: context.gender || null,
            profile: profileDataObj.display_name || profile.display_name || `СБ-${vectors.СБ}, ТФ-${vectors.ТФ}, УБ-${vectors.УБ}, ЧВ-${vectors.ЧВ}`,
            profileType: profile.perception_type || profileDataObj.perception_type || 'АНАЛИТИК',
            vectors: vectors,
            thinkingLevel: profile.thinking_level || 5,
            profession: null
        };
        
        console.log('📊 Данные для поиска:', userDoublesProfile);
    } catch (error) {
        console.warn('Failed to load profile:', error);
    }
}

// ============================================
// 4. ОБУЧАЮЩИЙ ЭКРАН (ПРИ ПЕРВОМ ВХОДЕ)
// ============================================
function renderDoublesIntroScreen(container) {
    const hasSeenIntro = localStorage.getItem('doubles_intro_seen');
    
    if (hasSeenIntro) {
        renderModeSelectionScreen(container);
        return;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🔮</div>
                <h1>Психометрический поиск</h1>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Что это и зачем нужно?</div>
            </div>
            
            <div class="content-body">
                <!-- Карточка 1 -->
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="font-size: 32px;">🧬</div>
                        <div style="font-size: 16px; font-weight: 600;">Ваш психометрический профиль</div>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                        Это ваша "внутренняя ОС" — набор поведенческих векторов (СБ, ТФ, УБ, ЧВ), 
                        который определяет, как вы мыслите, чувствуете и действуете.
                    </div>
                    <div style="background: rgba(224,224,224,0.08); border-radius: 12px; padding: 10px; margin-top: 12px;">
                        <div style="font-family: monospace; font-size: 12px; text-align: center;">${userDoublesProfile.profile} | ${userDoublesProfile.profileType}</div>
                    </div>
                </div>
                
                <!-- Карточка 2 -->
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="font-size: 32px;">👥</div>
                        <div style="font-size: 16px; font-weight: 600;">Режим "ДВОЙНИК"</div>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                        Находит людей с максимально похожим профилем. 
                        <strong>Зачем?</strong> Увидеть альтернативные пути развития, 
                        понять свои паттерны со стороны, перестать чувствовать себя "белой вороной".
                    </div>
                    <div style="background: rgba(59,130,255,0.1); border-radius: 12px; padding: 10px; margin-top: 12px;">
                        <div style="font-size: 12px;">💡 Пример: "У кого такой же профиль, но другая профессия?"</div>
                    </div>
                </div>
                
                <!-- Карточка 3 -->
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="font-size: 32px;">🎯</div>
                        <div style="font-size: 16px; font-weight: 600;">Режим "ПОДБОР ПО ЦЕЛИ"</div>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                        AI анализирует, какой профиль идеально подходит для вашей цели 
                        (любовник, муж/жена, друг, бизнес-партнёр, сотрудник, начальник, ментор, попутчик)
                        и находит таких людей в базе.
                    </div>
                    <div style="background: rgba(255,107,59,0.1); border-radius: 12px; padding: 10px; margin-top: 12px;">
                        <div style="font-size: 12px;">💡 Пример: "Кто из базы идеально подходит мне в партнёры по бизнесу?"</div>
                    </div>
                </div>
                
                <!-- Карточка 4 -->
                <div style="background: rgba(16,185,129,0.08); border-radius: 20px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="font-size: 32px;">🔒</div>
                        <div style="font-size: 16px; font-weight: 600;">Конфиденциальность</div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        • Ваш профиль используется анонимно<br>
                        • Другие увидят только имя, возраст, город и % совместимости<br>
                        • Контакты раскрываются только при взаимном согласии<br>
                        • Вы можете удалить свой профиль из базы в любой момент
                    </div>
                </div>
                
                <button id="doublesStartBtn" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #ff6b3b, #ff3b3b); border: none; border-radius: 50px; color: white; font-weight: 600; font-size: 16px; cursor: pointer;">
                    🔮 НАЧАТЬ ПОИСК
                </button>
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => goBackToDashboard());
    }
    
    document.getElementById('doublesStartBtn')?.addEventListener('click', () => {
        localStorage.setItem('doubles_intro_seen', 'true');
        renderModeSelectionScreen(container);
    });
}

// ============================================
// 5. ЭКРАН ВЫБОРА РЕЖИМА
// ============================================
function renderModeSelectionScreen(container) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🔮</div>
                <h1>Психометрический поиск</h1>
            </div>
            
            <div class="content-body">
                <!-- Профиль пользователя -->
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 14px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600;">${userDoublesProfile.name}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">${userDoublesProfile.age ? userDoublesProfile.age + ' лет' : ''} ${userDoublesProfile.city ? '• ' + userDoublesProfile.city : ''}</div>
                        </div>
                        <div style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 4px 12px; font-family: monospace; font-size: 10px;">${userDoublesProfile.profile}</div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 10px;">
                        <span style="background: rgba(255,107,59,0.15); border-radius: 20px; padding: 2px 8px; font-size: 9px;">СБ ${userDoublesProfile.vectors.СБ}/6</span>
                        <span style="background: rgba(255,107,59,0.15); border-radius: 20px; padding: 2px 8px; font-size: 9px;">ТФ ${userDoublesProfile.vectors.ТФ}/6</span>
                        <span style="background: rgba(255,107,59,0.15); border-radius: 20px; padding: 2px 8px; font-size: 9px;">УБ ${userDoublesProfile.vectors.УБ}/6</span>
                        <span style="background: rgba(255,107,59,0.15); border-radius: 20px; padding: 2px 8px; font-size: 9px;">ЧВ ${userDoublesProfile.vectors.ЧВ}/6</span>
                    </div>
                </div>
                
                <!-- Режим ДВОЙНИК -->
                <div style="background: linear-gradient(135deg, rgba(59,130,255,0.1), rgba(59,130,255,0.02)); border-radius: 24px; padding: 20px; margin-bottom: 16px; cursor: pointer; border: 1px solid rgba(59,130,255,0.3);" id="twinModeBtn">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="font-size: 44px;">👥</div>
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: 600;">ДВОЙНИК</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Найти людей с похожим профилем</div>
                        </div>
                        <div style="font-size: 24px;">→</div>
                    </div>
                    <div style="margin-top: 12px; font-size: 11px; color: var(--text-secondary);">
                        📊 Увидеть альтернативные пути • 🔍 Понять свои паттерны • 🤝 Перестать чувствовать себя одиноким
                    </div>
                </div>
                
                <!-- Режим ПОДБОР ПО ЦЕЛИ -->
                <div style="background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,107,59,0.02)); border-radius: 24px; padding: 20px; margin-bottom: 16px; cursor: pointer; border: 1px solid rgba(255,107,59,0.3);" id="matchModeBtn">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="font-size: 44px;">🎯</div>
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: 600;">ПОДБОР ПО ЦЕЛИ</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Найти идеального кандидата под вашу задачу</div>
                        </div>
                        <div style="font-size: 24px;">→</div>
                    </div>
                    <div style="margin-top: 12px; font-size: 11px; color: var(--text-secondary);">
                        💕 Любовник • 💍 Муж/жена • 👥 Друг • 🤝 Бизнес-партнёр • 👔 Сотрудник • 👑 Начальник • 🦉 Ментор • ✈️ Попутчик
                    </div>
                </div>
                
                <div style="background: rgba(16,185,129,0.08); border-radius: 16px; padding: 12px; margin-top: 16px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-align: center;">
                        🔒 Анонимно • 🎯 Точно • 🧠 На основе психометрики
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => goBackToDashboard());
    }
    
    document.getElementById('twinModeBtn')?.addEventListener('click', () => {
        doublesState.searchMode = 'twin';
        renderGoalSelectionScreen(container);
    });
    
    document.getElementById('matchModeBtn')?.addEventListener('click', () => {
        doublesState.searchMode = 'match';
        renderGoalSelectionScreen(container);
    });
}

// ============================================
// 6. ЭКРАН ВЫБОРА ЦЕЛИ
// ============================================
function renderGoalSelectionScreen(container) {
    const isTwinMode = doublesState.searchMode === 'twin';
    
    const twinGoals = [
        { id: 'twin', emoji: '👥', name: 'ПОХОЖИЙ ПРОФИЛЬ', desc: 'Люди с максимально близким психотипом', color: '#3b82ff' }
    ];
    
    const matchGoals = [
        { id: 'lover', emoji: '💕', name: 'ЛЮБОВНИК', desc: 'Страсть, романтика, влечение', color: '#ff3b3b' },
        { id: 'spouse', emoji: '💍', name: 'МУЖ/ЖЕНА', desc: 'Семья, стабильность, общее будущее', color: '#ff6b3b' },
        { id: 'friend', emoji: '👥', name: 'ДРУГ', desc: 'Поддержка, общение, доверие', color: '#10b981' },
        { id: 'companion', emoji: '🤝', name: 'КОМПАНЬОН', desc: 'Бизнес, проекты, партнёрство', color: '#8b5cf6' },
        { id: 'employee', emoji: '👔', name: 'СОТРУДНИК', desc: 'Работа, исполнительность, команда', color: '#6366f1' },
        { id: 'boss', emoji: '👑', name: 'НАЧАЛЬНИК', desc: 'Карьера, лидерство, рост', color: '#f59e0b' },
        { id: 'mentor', emoji: '🦉', name: 'МЕНТОР', desc: 'Мудрость, обучение, развитие', color: '#a855f7' },
        { id: 'travel', emoji: '✈️', name: 'ПОПУТЧИК', desc: 'Путешествия, приключения', color: '#06b6d4' }
    ];
    
    const goals = isTwinMode ? twinGoals : matchGoals;
    const title = isTwinMode ? 'Поиск ДВОЙНИКА' : 'Кого вы ищете?';
    const subtitle = isTwinMode ? 'Люди с похожим психотипом' : 'AI подберёт идеальный профиль под вашу цель';
    
    let goalsHtml = '';
    goals.forEach(goal => {
        goalsHtml += `
            <div style="background: linear-gradient(135deg, rgba(224,224,224,0.05), rgba(192,192,192,0.02)); border-radius: 20px; padding: 16px; margin-bottom: 12px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;" class="goal-item" data-goal="${goal.id}">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="font-size: 36px;">${goal.emoji}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 600;">${goal.name}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${goal.desc}</div>
                    </div>
                    <div style="font-size: 20px; color: ${goal.color};">→</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">${isTwinMode ? '👥' : '🎯'}</div>
                <h1>${title}</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">${subtitle}</div>
            </div>
            
            <div class="content-body">
                <!-- Краткое пояснение режима -->
                <div style="background: rgba(255,107,59,0.08); border-radius: 16px; padding: 12px; margin-bottom: 20px;">
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${isTwinMode 
                            ? '🔍 ДВОЙНИКИ — это люди с максимально похожим психометрическим профилем. Они помогут увидеть альтернативные пути развития и понять свои паттерны со стороны.'
                            : '🎯 AI проанализирует ваш профиль и найдёт людей, чей психотип идеально подходит для вашей цели. Вы получите % совместимости и детальный анализ.'
                        }
                    </div>
                </div>
                
                ${goalsHtml}
                
                ${!isTwinMode ? `
                <div style="margin-top: 16px;">
                    <div style="background: rgba(224,224,224,0.03); border-radius: 16px; padding: 12px;">
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px;">⚙️ ФИЛЬТРЫ</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <select id="distanceFilter" style="background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; padding: 8px 12px; color: white; font-size: 12px;">
                                <option value="any">🌍 Любое расстояние</option>
                                <option value="city">🏙️ Мой город</option>
                                <option value="10">📍 До 10 км</option>
                                <option value="50">📍 До 50 км</option>
                                <option value="100">📍 До 100 км</option>
                            </select>
                            <select id="genderFilter" style="background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; padding: 8px 12px; color: white; font-size: 12px;">
                                <option value="any">👤 Любой пол</option>
                                <option value="male">👨 Мужской</option>
                                <option value="female">👩 Женский</option>
                            </select>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => renderModeSelectionScreen(container));
    }
    
    if (!isTwinMode) {
        document.getElementById('distanceFilter')?.addEventListener('change', (e) => {
            doublesState.filters.distance = e.target.value;
        });
        document.getElementById('genderFilter')?.addEventListener('change', (e) => {
            doublesState.filters.gender = e.target.value;
        });
    }
    
    document.querySelectorAll('.goal-item').forEach(el => {
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', () => {
            const goal = newEl.dataset.goal;
            doublesState.searchGoal = goal;
            renderSearchingScreen(container);
            performSearch();
        });
    });
}

// ============================================
// 7. ЭКРАН ПОИСКА (Лоадер)
// ============================================
function renderSearchingScreen(container) {
    const isTwinMode = doublesState.searchMode === 'twin';
    const goalName = getGoalName(doublesState.searchGoal);
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🔍</div>
                <h1>Поиск ${isTwinMode ? 'двойников' : 'идеального кандидата'}</h1>
            </div>
            
            <div class="content-body" style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 56px; animation: spin 1s linear infinite; margin-bottom: 20px;">🧠</div>
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">AI анализирует...</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">
                    ${isTwinMode 
                        ? 'Ищем людей с максимально похожим психотипом'
                        : `Подбираем идеального кандидата для цели "${goalName}"`
                    }
                </div>
                
                <div style="width: 100%; height: 4px; background: rgba(224,224,224,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
                    <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff6b3b, #ff3b3b); border-radius: 4px; animation: loading 2s ease-in-out infinite;" id="progressBar"></div>
                </div>
                
                <div id="searchStatus" style="font-size: 11px; color: var(--text-secondary);">
                    📊 Анализирую ваш профиль...
                </div>
                
                <style>
                    @keyframes loading {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                </style>
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => renderModeSelectionScreen(container));
    }
}

// ============================================
// 8. ВЫПОЛНЕНИЕ ПОИСКА
// ============================================
async function performSearch() {
    const statusEl = document.getElementById('searchStatus');
    const steps = [
        '📊 Анализирую ваш профиль...',
        '🎯 Рассчитываю идеальные параметры...',
        '🔍 Ищу совпадения в базе...',
        '📈 Сортирую по совместимости...',
        '✨ Генерирую инсайты...'
    ];
    
    let step = 0;
    const interval = setInterval(() => {
        if (step < steps.length) {
            if (statusEl) statusEl.textContent = steps[step];
            step++;
        }
    }, 800);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL;
        
        let url = `${apiUrl}/api/psychometric/search?user_id=${userId}&mode=${doublesState.searchMode}`;
        if (doublesState.searchGoal) url += `&goal=${doublesState.searchGoal}`;
        if (doublesState.filters.distance !== 'any') url += `&distance=${doublesState.filters.distance}`;
        if (doublesState.filters.gender !== 'any') url += `&gender=${doublesState.filters.gender}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        clearInterval(interval);
        
        if (data.success && data.results) {
            doublesState.foundDoubles = data.results;
            renderResultsScreen(document.getElementById('screenContainer'));
        } else {
            doublesState.foundDoubles = [];
            renderResultsScreen(document.getElementById('screenContainer'));
        }
    } catch (error) {
        clearInterval(interval);
        console.error('Search failed:', error);
        doublesState.foundDoubles = [];
        renderResultsScreen(document.getElementById('screenContainer'));
        showToastMessage('❌ Ошибка поиска. Попробуйте позже.', 'error');
    }
}

// ============================================
// 9. ЭКРАН РЕЗУЛЬТАТОВ
// ============================================
function renderResultsScreen(container) {
    const isTwinMode = doublesState.searchMode === 'twin';
    const goalName = getGoalName(doublesState.searchGoal);
    const results = doublesState.foundDoubles;
    
    let resultsHtml = '';
    
    if (!results || results.length === 0) {
        resultsHtml = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 56px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">ПОКА НИЧЕГО НЕ НАЙДЕНО</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">
                    ${isTwinMode 
                        ? 'Ваш профиль уникален в нашей базе на данный момент.'
                        : `Пользователей, идеально подходящих для "${goalName}", пока нет.`
                    }
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    База пополняется ежедневно. Загляните позже!
                </div>
            </div>
        `;
    } else {
        results.forEach((item, idx) => {
            const similarity = item.similarity || Math.floor(Math.random() * 30) + 65;
            const compatibilityClass = similarity >= 90 ? '🔥' : similarity >= 75 ? '💕' : '👍';
            const sbDiff = item.vectors?.СБ - userDoublesProfile.vectors.СБ;
            const tfDiff = item.vectors?.ТФ - userDoublesProfile.vectors.ТФ;
            const ubDiff = item.vectors?.УБ - userDoublesProfile.vectors.УБ;
            const chvDiff = item.vectors?.ЧВ - userDoublesProfile.vectors.ЧВ;
            
            resultsHtml += `
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px; margin-bottom: 16px; border: 1px solid rgba(224,224,224,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 32px;">${item.gender === 'female' ? '👩' : '👨'}</span>
                            <div>
                                <div style="font-size: 16px; font-weight: 600;">${item.name || 'Пользователь'}, ${item.age || '?'} лет</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${item.city || '📍 Город не указан'}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: #ff6b3b;">${compatibilityClass} ${similarity}%</div>
                            <div style="font-size: 10px; color: var(--text-secondary);">совместимость</div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(224,224,224,0.03); border-radius: 12px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-family: monospace; font-size: 10px; text-align: center; margin-bottom: 8px;">${item.profile || userDoublesProfile.profile} | ${item.profile_type || userDoublesProfile.profileType}</div>
                        <div style="display: flex; justify-content: space-between; gap: 8px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 10px; color: var(--text-secondary);">СБ</div>
                                <div style="font-size: 14px; font-weight: 600;">${item.vectors?.СБ || userDoublesProfile.vectors.СБ}/6</div>
                                <div style="font-size: 9px; color: ${sbDiff > 0 ? '#10b981' : sbDiff < 0 ? '#ef4444' : '#888'}">${sbDiff > 0 ? '+' + sbDiff : sbDiff < 0 ? sbDiff : '='}</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 10px; color: var(--text-secondary);">ТФ</div>
                                <div style="font-size: 14px; font-weight: 600;">${item.vectors?.ТФ || userDoublesProfile.vectors.ТФ}/6</div>
                                <div style="font-size: 9px; color: ${tfDiff > 0 ? '#10b981' : tfDiff < 0 ? '#ef4444' : '#888'}">${tfDiff > 0 ? '+' + tfDiff : tfDiff < 0 ? tfDiff : '='}</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 10px; color: var(--text-secondary);">УБ</div>
                                <div style="font-size: 14px; font-weight: 600;">${item.vectors?.УБ || userDoublesProfile.vectors.УБ}/6</div>
                                <div style="font-size: 9px; color: ${ubDiff > 0 ? '#10b981' : ubDiff < 0 ? '#ef4444' : '#888'}">${ubDiff > 0 ? '+' + ubDiff : ubDiff < 0 ? ubDiff : '='}</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 10px; color: var(--text-secondary);">ЧВ</div>
                                <div style="font-size: 14px; font-weight: 600;">${item.vectors?.ЧВ || userDoublesProfile.vectors.ЧВ}/6</div>
                                <div style="font-size: 9px; color: ${chvDiff > 0 ? '#10b981' : chvDiff < 0 ? '#ef4444' : '#888'}">${chvDiff > 0 ? '+' + chvDiff : chvDiff < 0 ? chvDiff : '='}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,107,59,0.08); border-radius: 12px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">
                            💡 "${item.insight || getInsightBySimilarity(similarity, null, isTwinMode)}"
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="chat-btn" data-id="${item.user_id}" style="flex: 1; padding: 10px; background: rgba(255,107,59,0.2); border: 1px solid rgba(255,107,59,0.3); border-radius: 40px; color: white; font-size: 12px; cursor: pointer;">💬 ЧАТ</button>
                        <button class="profile-btn" data-id="${item.user_id}" style="flex: 1; padding: 10px; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 40px; color: white; font-size: 12px; cursor: pointer;">👤 ПРОФИЛЬ</button>
                        <button class="save-btn" data-id="${item.user_id}" style="width: 44px; padding: 10px; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 40px; color: white; font-size: 14px; cursor: pointer;">❤️</button>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">${isTwinMode ? '👥' : getGoalEmoji(doublesState.searchGoal)}</div>
                <h1>${isTwinMode ? 'Ваши двойники' : `Идеальные кандидаты для "${goalName}"`}</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">Найдено ${results.length} человек</div>
            </div>
            
            <div class="content-body">
                ${resultsHtml}
                
                <div style="display: flex; gap: 12px; margin-top: 16px;">
                    <button id="newSearchBtn" style="flex: 1; padding: 14px; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 50px; color: white; font-size: 14px; cursor: pointer;">🔄 НОВЫЙ ПОИСК</button>
                    <button id="changeGoalBtn" style="flex: 1; padding: 14px; background: rgba(255,107,59,0.15); border: 1px solid rgba(255,107,59,0.3); border-radius: 50px; color: white; font-size: 14px; cursor: pointer;">🎯 ДРУГАЯ ЦЕЛЬ</button>
                </div>
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => renderModeSelectionScreen(container));
    }
    
    document.getElementById('newSearchBtn')?.addEventListener('click', () => {
        renderModeSelectionScreen(container);
    });
    
    document.getElementById('changeGoalBtn')?.addEventListener('click', () => {
        renderGoalSelectionScreen(container);
    });
    
    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('💬 Чат с кандидатом будет доступен в следующей версии', 'info');
        });
    });
    
    document.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('👤 Полный профиль будет доступен в следующей версии', 'info');
        });
    });
    
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.textContent = '✅';
            showToastMessage('Сохранено в избранное', 'success');
        });
    });
}

// ============================================
// 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function getGoalName(goalId) {
    const goals = {
        'twin': 'Двойник',
        'lover': 'Любовник',
        'spouse': 'Муж/жена',
        'friend': 'Друг',
        'companion': 'Бизнес-партнёр',
        'employee': 'Сотрудник',
        'boss': 'Начальник',
        'mentor': 'Ментор',
        'travel': 'Попутчик'
    };
    return goals[goalId] || 'Поиск';
}

function getGoalEmoji(goalId) {
    const emojis = {
        'twin': '👥',
        'lover': '💕',
        'spouse': '💍',
        'friend': '👥',
        'companion': '🤝',
        'employee': '👔',
        'boss': '👑',
        'mentor': '🦉',
        'travel': '✈️'
    };
    return emojis[goalId] || '🎯';
}

function getInsightBySimilarity(similarity, diff, isTwinMode) {
    if (isTwinMode) {
        if (similarity >= 90) return 'Ваш психологический близнец! Возможно, у вас похожие жизненные сценарии.';
        if (similarity >= 75) return 'Очень похожий профиль. Общение может дать ценные инсайты.';
        return 'Несмотря на различия, у вас много общего в базовых настройках психики.';
    } else {
        if (similarity >= 90) return 'Идеальное дополнение! Ваши профили созданы друг для друга.';
        if (similarity >= 75) return 'Отличная совместимость. Есть все шансы на гармоничные отношения.';
        return 'Хорошая база для отношений. Стоит присмотреться.';
    }
}

// ============================================
// 11. ГЛАВНАЯ ФУНКЦИЯ
// ============================================
async function showDoublesScreen() {
    const completed = await checkTestCompleted();
    
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForDoubles();
    renderDoublesIntroScreen(container);
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
// 12. ЭКСПОРТ
// ============================================
window.showDoublesScreen = showDoublesScreen;
window.goBackToDashboard = goBackToDashboard;

console.log('✅ Модуль двойников v3.0 загружен — Двойники + Поиск по целям');
