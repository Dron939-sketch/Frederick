// ============================================
// doubles.js — Психометрические двойники
// Версия 3.0 — с дополняющими профилями и поиском
// ============================================

let doublesState = {
    hasConsent: false,
    isSearching: false,
    foundDoubles: [],
    complementaryProfiles: [],
    searchMode: 'doubles' // 'doubles', 'complementary', 'hunt'
};

// Данные пользователя
let userDoublesProfile = {
    name: 'Пользователь',
    age: null,
    city: null,
    profile: 'СБ-4, ТФ-4, УБ-4, ЧВ-4',
    profileType: 'АНАЛИТИК',
    vectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 }
};

// Предопределённые цели для поиска
const HUNT_PURPOSES = {
    startup: {
        name: '🚀 СТАРТАП',
        description: 'Ищу кофаундера для запуска проекта',
        targetVectors: { СБ: 5, ТФ: 4, УБ: 5, ЧВ: 4 },
        insight: 'Вам нужен человек с высоким УБ (видение) и СБ (решительность)'
    },
    team: {
        name: '👥 КОМАНДА',
        description: 'Собираю команду для проекта',
        targetVectors: { СБ: 4, ТФ: 3, УБ: 5, ЧВ: 5 },
        insight: 'Идеальный тимлид: высокий УБ + ЧВ'
    },
    campaign: {
        name: '📢 КАМПАНИЯ',
        description: 'Разовая акция или мероприятие',
        targetVectors: { СБ: 5, ТФ: 5, УБ: 3, ЧВ: 3 },
        insight: 'Нужен энергичный исполнитель с высоким СБ и ТФ'
    },
    balance: {
        name: '⚖️ БАЛАНС',
        description: 'Ищу того, кто дополнит мои слабые стороны',
        targetVectors: null, // будет рассчитано автоматически
        insight: 'Кто компенсирует ваши слабые стороны'
    }
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    } else if (window.renderDashboard && typeof window.renderDashboard === 'function') {
        window.renderDashboard();
    } else if (typeof window.goToDashboard === 'function') {
        window.goToDashboard();
    } else {
        location.reload();
    }
}

// ============================================
// ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ
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
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length - 1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length - 1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length - 1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length - 1] : behavioralLevels.ЧВ) : 4
        };
        
        userDoublesProfile = {
            name: localStorage.getItem('fredi_user_name') || context.name || 'Пользователь',
            age: context.age || null,
            city: context.city || null,
            profile: profileDataObj.display_name || profile.display_name || `СБ-${vectors.СБ}, ТФ-${vectors.ТФ}, УБ-${vectors.УБ}, ЧВ-${vectors.ЧВ}`,
            profileType: profile.perception_type || profileDataObj.perception_type || 'АНАЛИТИК',
            vectors: vectors
        };
        
        console.log('📊 Данные для поиска:', userDoublesProfile);
    } catch (error) {
        console.warn('Failed to load user profile for doubles:', error);
    }
}

// ============================================
// РАСЧЁТ ДОПОЛНЯЮЩИХ ВЕКТОРОВ
// ============================================
function getComplementaryVectors() {
    const vectors = userDoublesProfile.vectors;
    // Дополняющий профиль: где у пользователя низко, там нужно высоко, и наоборот
    return {
        СБ: 7 - vectors.СБ,  // 6 - текущий + 1 (макс 6)
        ТФ: 7 - vectors.ТФ,
        УБ: 7 - vectors.УБ,
        ЧВ: 7 - vectors.ЧВ
    };
}

function getComplementaryInsight() {
    const vectors = userDoublesProfile.vectors;
    const weak = [];
    const strong = [];
    
    if (vectors.СБ < 3) weak.push('решительность и реакцию на давление');
    else if (vectors.СБ > 4) strong.push('высокую стрессоустойчивость');
    
    if (vectors.ТФ < 3) weak.push('финансовое мышление');
    else if (vectors.ТФ > 4) strong.push('умение обращаться с ресурсами');
    
    if (vectors.УБ < 3) weak.push('стратегическое видение');
    else if (vectors.УБ > 4) strong.push('глубокое понимание мира');
    
    if (vectors.ЧВ < 3) weak.push('эмоциональный интеллект');
    else if (vectors.ЧВ > 4) strong.push('эмпатию и понимание людей');
    
    let insight = '';
    if (weak.length > 0) {
        insight += `Вам не хватает ${weak.join(', ')}. `;
    }
    if (strong.length > 0) {
        insight += `Вы сильны в ${strong.join(', ')}. `;
    }
    insight += 'Идеальный партнёр дополнит ваши слабые стороны и усилит сильные.';
    
    return insight;
}

// ============================================
// ПОИСК ДВОЙНИКОВ (API)
// ============================================
async function searchDoublesAPI() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        showToastMessage('🔍 Поиск двойников...', 'info');
        
        const response = await fetch(`${apiUrl}/api/psychometric/find-doubles?user_id=${userId}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.doubles && data.doubles.length > 0) {
            return data.doubles.map(d => ({
                ...d,
                insight: getInsightBySimilarity(d.similarity, d.diff)
            }));
        }
        
        if (data.success && data.nearby && data.nearby.length > 0) {
            return data.nearby.map(d => ({
                ...d,
                insight: getInsightBySimilarity(d.similarity, d.diff, true)
            }));
        }
        
        return [];
    } catch (error) {
        console.error('API search failed:', error);
        showToastMessage('❌ Не удалось найти двойников. Попробуйте позже.', 'error');
        return [];
    }
}

// ============================================
// ПОИСК ДОПОЛНЯЮЩИХ ПРОФИЛЕЙ
// ============================================
async function searchComplementaryAPI() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const targetVectors = getComplementaryVectors();
        
        showToastMessage('🤝 Поиск дополняющих профилей...', 'info');
        
        const response = await fetch(`${apiUrl}/api/psychometric/find-complementary?user_id=${userId}&target=${JSON.stringify(targetVectors)}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.profiles && data.profiles.length > 0) {
            return data.profiles.map(p => ({
                ...p,
                insight: getComplementaryInsightForProfile(p, targetVectors)
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Complementary search failed:', error);
        // Мок-данные для демонстрации
        return [
            {
                name: 'Дмитрий',
                age: 35,
                city: 'Москва',
                profile_code: 'СБ-5, ТФ-4, УБ-5, ЧВ-4',
                profile_type: 'СТРАТЕГ',
                vectors: { СБ: 5, ТФ: 4, УБ: 5, ЧВ: 4 },
                compatibility: 85,
                insight: 'Ваше видение + его решительность = отличная команда для стартапа'
            },
            {
                name: 'Анна',
                age: 29,
                city: 'Санкт-Петербург',
                profile_code: 'СБ-3, ТФ-3, УБ-5, ЧВ-5',
                profile_type: 'ЭМПАТ',
                vectors: { СБ: 3, ТФ: 3, УБ: 5, ЧВ: 5 },
                compatibility: 78,
                insight: 'Вы дополняете друг друга: вы — идеи и стратегия, она — эмоциональный интеллект и коммуникация'
            }
        ];
    }
}

function getInsightBySimilarity(similarity, diff, isNearby = false) {
    if (isNearby) {
        return 'Ваш профиль уникален. Этот пользователь близок к вам по психотипу.';
    }
    if (similarity >= 90) {
        return 'У вас почти идентичный профиль! Возможно, вы сталкиваетесь с похожими вызовами.';
    }
    if (similarity >= 75) {
        return 'У вас много общего. Общение может дать ценные инсайты.';
    }
    return 'Несмотря на различия, вы можете найти общий язык и полезный опыт.';
}

function getComplementaryInsightForProfile(profile, targetVectors) {
    const diff = [];
    if (profile.vectors) {
        if (profile.vectors.СБ >= 5) diff.push('высокая решительность');
        if (profile.vectors.ТФ >= 5) diff.push('финансовая грамотность');
        if (profile.vectors.УБ >= 5) diff.push('стратегическое мышление');
        if (profile.vectors.ЧВ >= 5) diff.push('эмоциональный интеллект');
    }
    
    if (diff.length > 0) {
        return `Идеальный партнёр: ${diff.join(', ')}. Ваши навыки дополняют друг друга.`;
    }
    return 'Психометрически совместим. Может стать отличным партнёром для совместных проектов.';
}

// ============================================
// РАСЧЁТ ТРАЕКТОРИИ РАЗВИТИЯ
// ============================================
function getDevelopmentTrajectory() {
    const vectors = userDoublesProfile.vectors;
    const avgLevel = (vectors.СБ + vectors.ТФ + vectors.УБ + vectors.ЧВ) / 4;
    
    if (avgLevel >= 5) {
        return {
            trajectory5: '🔮 Лидерские позиции, управление проектами',
            trajectory10: '🌟 Экспертное признание, менторство',
            trajectory20: '🏆 Наследие и влияние на окружающих'
        };
    } else if (avgLevel >= 3) {
        return {
            trajectory5: '🔮 Поиск своей ниши и профессиональный рост',
            trajectory10: '🌟 Стабильность и профессиональное признание',
            trajectory20: '🏆 Гармония и передача опыта'
        };
    } else {
        return {
            trajectory5: '🔮 Раскрытие талантов в новых сферах',
            trajectory10: '🌟 Уникальный путь и нестандартные решения',
            trajectory20: '🏆 Источник вдохновения для окружающих'
        };
    }
}

// ============================================
// РЕНДЕР ЭКРАНОВ
// ============================================

// Главный экран с вкладками
function renderDoublesMainScreen(container) {
    const trajectory = getDevelopmentTrajectory();
    const complementaryVectors = getComplementaryVectors();
    const complementaryInsight = getComplementaryInsight();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">👥</div>
                <h1>Психометрические двойники</h1>
            </div>
            
            <div class="content-body">
                <!-- Вкладки -->
                <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid rgba(224,224,224,0.2); padding-bottom: 12px;">
                    <button id="tabDoublesBtn" class="analysis-tab active" data-tab="doubles">👥 ДВОЙНИКИ</button>
                    <button id="tabComplementaryBtn" class="analysis-tab" data-tab="complementary">🤝 ДОПОЛНЯЮЩИЕ</button>
                    <button id="TabHuntBtn" class="analysis-tab" data-tab="hunt">🎯 ОХОТА</button>
                </div>
                
                <!-- Блок с профилем пользователя -->
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 4px 12px; font-family: monospace; font-size: 10px;">${userDoublesProfile.profile} | ${userDoublesProfile.profileType}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">${userDoublesProfile.age ? userDoublesProfile.age + ' лет, ' : ''}${userDoublesProfile.city || ''}</div>
                        </div>
                        <div style="font-size: 11px; color: var(--chrome);">✨ ВАШ ПРОФИЛЬ</div>
                    </div>
                </div>
                
                <!-- Контент вкладок -->
                <div id="tabContent">
                    <!-- Двойники (загрузятся позже) -->
                    <div style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
                        <div style="font-size: 13px; color: var(--chrome);">Загрузка...</div>
                    </div>
                </div>
                
                <!-- Блок с траекторией развития -->
                <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">📈 ВОЗМОЖНАЯ ТРАЕКТОРИЯ</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">${trajectory.trajectory5}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-top: 6px;">${trajectory.trajectory10}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-top: 6px;">${trajectory.trajectory20}</div>
                </div>
            </div>
        </div>
    `;
    
    // Обработчики вкладок
    document.getElementById('tabDoublesBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.analysis-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tabDoublesBtn').classList.add('active');
        doublesState.searchMode = 'doubles';
        loadDoublesContent(container);
    });
    
    document.getElementById('tabComplementaryBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.analysis-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tabComplementaryBtn').classList.add('active');
        doublesState.searchMode = 'complementary';
        loadComplementaryContent(container);
    });
    
    document.getElementById('TabHuntBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.analysis-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById('TabHuntBtn').classList.add('active');
        doublesState.searchMode = 'hunt';
        loadHuntContent(container);
    });
    
    // Кнопка НАЗАД
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            goBackToDashboard();
        });
    }
    
    // Загружаем начальный контент
    loadDoublesContent(container);
}

// Загрузка двойников
async function loadDoublesContent(container) {
    const tabContent = document.getElementById('tabContent');
    if (!tabContent) return;
    
    tabContent.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 48px; animation: spin 1s linear infinite; margin-bottom: 16px;">🔄</div>
            <div style="font-size: 13px; color: var(--chrome);">ИЩЕМ ДВОЙНИКОВ...</div>
        </div>
    `;
    
    const doubles = await searchDoublesAPI();
    
    if (doubles.length === 0) {
        tabContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">ПОКА НЕТ ТОЧНЫХ СОВПАДЕНИЙ</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Ваш профиль уникален. Попробуйте позже.</div>
            </div>
        `;
        return;
    }
    
    let doublesHtml = '';
    doubles.forEach(d => {
        doublesHtml += `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                    <span style="font-size: 14px; font-weight: 600; color: var(--chrome);">🧠 ${d.name || 'Пользователь'}</span>
                    <span style="font-size: 10px; color: var(--text-secondary);">${d.age ? d.age + ' лет' : ''} ${d.city ? '| ' + d.city : ''}</span>
                </div>
                <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-family: monospace; font-size: 9px; margin-bottom: 8px;">${d.profile_code || userDoublesProfile.profile} | ${d.profile_type || userDoublesProfile.profileType}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 16px; font-weight: 700; color: var(--chrome);">✨ СХОЖЕСТЬ: ${d.similarity}%</span>
                </div>
                ${d.diff ? `<div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px;">📊 ${d.diff}</div>` : ''}
                <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">💡 "${d.insight}"</div>
                <button class="connect-btn" data-user="${d.name}" style="margin-top: 10px; background: rgba(255,107,59,0.15); border: none; border-radius: 20px; padding: 6px 12px; font-size: 10px; color: var(--amg-orange); cursor: pointer;">💬 СВЯЗАТЬСЯ</button>
            </div>
        `;
    });
    
    tabContent.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--chrome);">🎯 НАЙДЕНО ${doubles.length} ДВОЙНИКОВ</div>
        </div>
        ${doublesHtml}
        <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-top: 16px;">
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">💡 Люди с похожими психометрическими профилями лучше понимают друг друга. Общение с двойником помогает увидеть свои паттерны со стороны.</div>
        </div>
    `;
    
    document.querySelectorAll('.connect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage(`💬 Функция связи с "${btn.dataset.user}" будет доступна в следующем обновлении`, 'info');
        });
    });
}

// Загрузка дополняющих профилей
async function loadComplementaryContent(container) {
    const tabContent = document.getElementById('tabContent');
    if (!tabContent) return;
    
    const complementaryInsight = getComplementaryInsight();
    const complementaryVectors = getComplementaryVectors();
    
    tabContent.innerHTML = `
        <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">🤝 КТО ВАС ДОПОЛНЯЕТ?</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">${complementaryInsight}</div>
            <div style="font-size: 11px; color: var(--chrome); margin-top: 8px;">🎯 Идеальный партнёр: СБ-${complementaryVectors.СБ}, ТФ-${complementaryVectors.ТФ}, УБ-${complementaryVectors.УБ}, ЧВ-${complementaryVectors.ЧВ}</div>
        </div>
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; animation: spin 1s linear infinite; margin-bottom: 16px;">🔄</div>
            <div style="font-size: 13px; color: var(--chrome);">ИЩЕМ ДОПОЛНЯЮЩИЕ ПРОФИЛИ...</div>
        </div>
    `;
    
    const profiles = await searchComplementaryAPI();
    
    if (profiles.length === 0) {
        tabContent.innerHTML = `
            <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">🤝 КТО ВАС ДОПОЛНЯЕТ?</div>
                <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">${complementaryInsight}</div>
                <div style="font-size: 11px; color: var(--chrome); margin-top: 8px;">🎯 Идеальный партнёр: СБ-${complementaryVectors.СБ}, ТФ-${complementaryVectors.ТФ}, УБ-${complementaryVectors.УБ}, ЧВ-${complementaryVectors.ЧВ}</div>
            </div>
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">ПОКА НЕТ ПОДХОДЯЩИХ КАНДИДАТОВ</div>
                <div style="font-size: 12px; color: var(--text-secondary);">База пополняется. Загляните позже.</div>
            </div>
        `;
        return;
    }
    
    let profilesHtml = '';
    profiles.forEach(p => {
        profilesHtml += `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 10px; border-left: 3px solid var(--amg-orange);">
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                    <span style="font-size: 14px; font-weight: 600; color: var(--chrome);">🤝 ${p.name || 'Пользователь'}</span>
                    <span style="font-size: 10px; color: var(--text-secondary);">${p.age ? p.age + ' лет' : ''} ${p.city ? '| ' + p.city : ''}</span>
                </div>
                <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-family: monospace; font-size: 9px; margin-bottom: 8px;">${p.profile_code || 'СБ-?, ТФ-?, УБ-?, ЧВ-?'}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 16px; font-weight: 700; color: var(--amg-orange);">🤝 СОВМЕСТИМОСТЬ: ${p.compatibility || 80}%</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">💡 "${p.insight}"</div>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="partner-btn" data-user="${p.name}" style="background: rgba(255,107,59,0.15); border: none; border-radius: 20px; padding: 6px 12px; font-size: 10px; color: var(--amg-orange); cursor: pointer;">💬 ПРЕДЛОЖИТЬ ПАРТНЁРСТВО</button>
                </div>
            </div>
        `;
    });
    
    tabContent.innerHTML = `
        <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">🤝 КТО ВАС ДОПОЛНЯЕТ?</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">${complementaryInsight}</div>
            <div style="font-size: 11px; color: var(--chrome); margin-top: 8px;">🎯 Идеальный партнёр: СБ-${complementaryVectors.СБ}, ТФ-${complementaryVectors.ТФ}, УБ-${complementaryVectors.УБ}, ЧВ-${complementaryVectors.ЧВ}</div>
        </div>
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--chrome);">🎯 НАЙДЕНО ${profiles.length} ПОТЕНЦИАЛЬНЫХ ПАРТНЁРОВ</div>
        </div>
        ${profilesHtml}
    `;
    
    document.querySelectorAll('.partner-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage(`💼 Запрос на партнёрство отправлен "${btn.dataset.user}"`, 'success');
        });
    });
}

// Загрузка "Охоты" - поиск по целям
function loadHuntContent(container) {
    const tabContent = document.getElementById('tabContent');
    if (!tabContent) return;
    
    tabContent.innerHTML = `
        <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">🎯 ОХОТА ЗА ПРОФИЛЯМИ</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">Найдите человека с нужным психотипом для вашей цели. Создайте сильную команду, запустите проект или найдите идеального партнёра.</div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🎯 ВЫБЕРИТЕ ЦЕЛЬ:</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="huntStartupBtn" class="action-btn" style="text-align: left;">🚀 Стартап — ищу кофаундера</button>
                <button id="huntTeamBtn" class="action-btn" style="text-align: left;">👥 Команда — собираю проектную группу</button>
                <button id="huntCampaignBtn" class="action-btn" style="text-align: left;">📢 Кампания — нужен исполнитель на проект</button>
                <button id="huntBalanceBtn" class="action-btn" style="text-align: left;">⚖️ Баланс — кто дополнит мои слабые стороны</button>
            </div>
        </div>
        
        <div id="huntCustomSection" style="display: none;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🔧 ИЛИ СОЗДАЙТЕ СВОЙ ЗАПРОС:</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;">
                <div><label style="font-size: 10px; color: var(--text-secondary);">СБ (решительность)</label><input type="range" id="huntSB" min="1" max="6" value="4" style="width: 100%;"><span id="sbVal" style="font-size: 10px;">4</span></div>
                <div><label style="font-size: 10px; color: var(--text-secondary);">ТФ (ресурсы)</label><input type="range" id="huntTF" min="1" max="6" value="4" style="width: 100%;"><span id="tfVal" style="font-size: 10px;">4</span></div>
                <div><label style="font-size: 10px; color: var(--text-secondary);">УБ (видение)</label><input type="range" id="huntUB" min="1" max="6" value="4" style="width: 100%;"><span id="ubVal" style="font-size: 10px;">4</span></div>
                <div><label style="font-size: 10px; color: var(--text-secondary);">ЧВ (эмпатия)</label><input type="range" id="huntChV" min="1" max="6" value="4" style="width: 100%;"><span id="chvVal" style="font-size: 10px;">4</span></div>
            </div>
            <button id="huntCustomSearchBtn" class="action-btn" style="width: 100%;">🔍 НАЙТИ ПО ЭТИМ ПАРАМЕТРАМ</button>
        </div>
        
        <div id="huntResults" style="margin-top: 16px;"></div>
    `;
    
    // Обновление значений слайдеров
    document.getElementById('huntSB')?.addEventListener('input', (e) => document.getElementById('sbVal').textContent = e.target.value);
    document.getElementById('huntTF')?.addEventListener('input', (e) => document.getElementById('tfVal').textContent = e.target.value);
    document.getElementById('huntUB')?.addEventListener('input', (e) => document.getElementById('ubVal').textContent = e.target.value);
    document.getElementById('huntChV')?.addEventListener('input', (e) => document.getElementById('chvVal').textContent = e.target.value);
    
    document.getElementById('huntStartupBtn')?.addEventListener('click', () => {
        showToastMessage('🚀 Поиск кофаундеров для стартапа...', 'info');
        document.getElementById('huntResults').innerHTML = `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">🚀</div>
                <div style="font-size: 13px; color: var(--chrome);">Функция поиска по целям будет доступна в следующем обновлении</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">Скоро вы сможете находить идеальных партнёров под любую задачу!</div>
            </div>
        `;
    });
    
    document.getElementById('huntTeamBtn')?.addEventListener('click', () => {
        showToastMessage('👥 Поиск участников команды...', 'info');
        document.getElementById('huntResults').innerHTML = `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">👥</div>
                <div style="font-size: 13px; color: var(--chrome);">Функция поиска по целям будет доступна в следующем обновлении</div>
            </div>
        `;
    });
    
    document.getElementById('huntCampaignBtn')?.addEventListener('click', () => {
        showToastMessage('📢 Поиск исполнителей для кампании...', 'info');
        document.getElementById('huntResults').innerHTML = `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">📢</div>
                <div style="font-size: 13px; color: var(--chrome);">Функция поиска по целям будет доступна в следующем обновлении</div>
            </div>
        `;
    });
    
    document.getElementById('huntBalanceBtn')?.addEventListener('click', () => {
        const complementaryVectors = getComplementaryVectors();
        document.getElementById('huntSB').value = complementaryVectors.СБ;
        document.getElementById('huntTF').value = complementaryVectors.ТФ;
        document.getElementById('huntUB').value = complementaryVectors.УБ;
        document.getElementById('huntChV').value = complementaryVectors.ЧВ;
        document.getElementById('sbVal').textContent = complementaryVectors.СБ;
        document.getElementById('tfVal').textContent = complementaryVectors.ТФ;
        document.getElementById('ubVal').textContent = complementaryVectors.УБ;
        document.getElementById('chvVal').textContent = complementaryVectors.ЧВ;
        document.getElementById('huntCustomSection').style.display = 'block';
        showToastMessage('⚖️ Подобраны параметры для дополнения вашего профиля', 'info');
    });
    
    document.getElementById('huntCustomSearchBtn')?.addEventListener('click', () => {
        const target = {
            СБ: parseInt(document.getElementById('huntSB').value),
            ТФ: parseInt(document.getElementById('huntTF').value),
            УБ: parseInt(document.getElementById('huntUB').value),
            ЧВ: parseInt(document.getElementById('huntChV').value)
        };
        showToastMessage(`🔍 Поиск профилей: СБ-${target.СБ}, ТФ-${target.ТФ}, УБ-${target.УБ}, ЧВ-${target.ЧВ}`, 'info');
        document.getElementById('huntResults').innerHTML = `
            <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">🔍</div>
                <div style="font-size: 13px; color: var(--chrome);">Поиск по заданным параметрам</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">Ищем: СБ-${target.СБ}, ТФ-${target.ТФ}, УБ-${target.УБ}, ЧВ-${target.ЧВ}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">Скоро вы сможете находить людей с нужным психотипом!</div>
            </div>
        `;
    });
    
    // Показать секцию кастомного поиска
    const showCustomBtn = document.createElement('button');
    showCustomBtn.textContent = '🔧 РУЧНОЙ ПОДБОР';
    showCustomBtn.className = 'action-btn';
    showCustomBtn.style.marginTop = '12px';
    showCustomBtn.style.width = '100%';
    showCustomBtn.addEventListener('click', () => {
        const section = document.getElementById('huntCustomSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    document.querySelector('#huntCustomSection')?.parentNode?.insertBefore(showCustomBtn, document.getElementById('huntCustomSection'));
}

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================
async function showDoublesScreen() {
    const isTestCompletedFn = window.isTestCompleted || (window.CONFIG && window.CONFIG.isTestCompleted);
    let completed = false;
    
    if (typeof isTestCompletedFn === 'function') {
        completed = await isTestCompletedFn();
    } else {
        try {
            const userId = window.CONFIG?.USER_ID || window.USER_ID;
            const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
            const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
            const data = await response.json();
            completed = data.has_profile === true;
        } catch (e) {
            completed = false;
        }
    }
    
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForDoubles();
    doublesState.hasConsent = false;
    doublesState.searchMode = 'doubles';
    renderDoublesMainScreen(container);
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showDoublesScreen = showDoublesScreen;
window.goBackToDashboard = goBackToDashboard;

console.log('✅ Модуль двойников загружен (версия 3.0 — с дополняющими профилями и охотой)');
