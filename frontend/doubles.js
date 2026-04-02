// ============================================
// doubles.js — Психометрические двойники
// Версия 3.1 — исправлена передача user_id как строки + стили кнопок
// ============================================

let doublesState = {
    hasConsent: false,
    isSearching: false,
    foundDoubles: [],
    complementaryProfiles: [],
    searchMode: 'doubles'
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
        targetVectors: null,
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
    return {
        СБ: Math.min(6, Math.max(1, 7 - vectors.СБ)),
        ТФ: Math.min(6, Math.max(1, 7 - vectors.ТФ)),
        УБ: Math.min(6, Math.max(1, 7 - vectors.УБ)),
        ЧВ: Math.min(6, Math.max(1, 7 - vectors.ЧВ))
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
    if (weak.length > 0) insight += `Вам не хватает ${weak.join(', ')}. `;
    if (strong.length > 0) insight += `Вы сильны в ${strong.join(', ')}. `;
    insight += 'Идеальный партнёр дополнит ваши слабые стороны и усилит сильные.';
    
    return insight;
}

// ============================================
// ПОИСК ДВОЙНИКОВ (API) — ИСПРАВЛЕННЫЙ
// ============================================
async function searchDoublesAPI() {
    try {
        let userId = window.CONFIG?.USER_ID || window.USER_ID;
        // ПРЕОБРАЗУЕМ В СТРОКУ для бэкенда
        const userIdStr = String(userId);
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        showToastMessage('🔍 Поиск двойников...', 'info');
        
        const response = await fetch(`${apiUrl}/api/psychometric/find-doubles?user_id=${userIdStr}&limit=10`);
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
        let userId = window.CONFIG?.USER_ID || window.USER_ID;
        const userIdStr = String(userId);
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const targetVectors = getComplementaryVectors();
        
        showToastMessage('🤝 Поиск дополняющих профилей...', 'info');
        
        const response = await fetch(`${apiUrl}/api/psychometric/find-complementary?user_id=${userIdStr}&target=${JSON.stringify(targetVectors)}&limit=10`);
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
        return [];
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

// Экран согласия (с исправленными кнопками)
function renderDoublesConsentScreen(container) {
    const trajectory = getDevelopmentTrajectory();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">👥</div>
                <h1>Психометрические двойники</h1>
            </div>
            
            <div class="content-body">
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 15px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🤔 ОДИН ПРОФИЛЬ — МНОГО ЖИЗНЕЙ</div>
                    <div style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">Ваш психологический профиль — это ваша "внутренняя ОС". Но одинаковый "процессор" может работать в разных "компьютерах".</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 14px; margin-bottom: 20px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--chrome);">🧬 ЗНАЯ ДВОЙНИКОВ — ЗНАЕТЕ ВАРИАЦИИ СВОЕЙ ЖИЗНИ</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Какой ещё могла быть ваша жизнь? Узнайте у тех, кто имеет ТАКОЙ ЖЕ психотип.</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🎯 ЧТО ДАЁТ ВСТРЕЧА С ДВОЙНИКОМ?</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">• Увидеть альтернативные пути</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">• Расширить картину мира</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">• Понять свои сильные стороны</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">• Найти готовые решения</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">• Перестать чувствовать себя одиноким</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 20px;">
                    <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 4px 12px; font-family: monospace; font-size: 10px; margin-bottom: 10px;">${userDoublesProfile.profile} | ${userDoublesProfile.profileType}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">${userDoublesProfile.age ? userDoublesProfile.age + ' лет, ' : ''}${userDoublesProfile.city || ''}</div>
                    
                    <div style="background: rgba(255,107,59,0.08); border-radius: 16px; padding: 12px; margin: 12px 0;">
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">📈 ВОЗМОЖНАЯ ТРАЕКТОРИЯ</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory5}</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory10}</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">${trajectory.trajectory20}</div>
                    </div>
                </div>
                
                <!-- Блок согласия с исправленными кнопками -->
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🔒 РАЗРЕШИТЕ ИСПОЛЬЗОВАТЬ ВАШ ПРОФИЛЬ</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Чтобы найти двойников, нужно разрешить использовать ваш профиль для сопоставления.</div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">⚠️ Ваши данные НЕ РАЗГЛАШАЮТСЯ. Другие увидят только имя, город, возраст и % схожести.</div>
                    <div style="display: flex; gap: 12px;">
                        <button id="doublesAllowBtn" style="flex: 1; background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 40px; padding: 12px; color: var(--chrome); font-weight: 500; cursor: pointer;">✅ РАЗРЕШИТЬ</button>
                        <button id="doublesDenyBtn" style="flex: 1; background: transparent; border: 1px solid rgba(224,224,224,0.15); border-radius: 40px; padding: 12px; color: var(--text-secondary); cursor: pointer;">❌ ОТКАЗАТЬСЯ</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
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
    
    document.getElementById('doublesAllowBtn')?.addEventListener('click', () => {
        doublesState.hasConsent = true;
        renderDoublesSearchScreen(container);
    });
    document.getElementById('doublesDenyBtn')?.addEventListener('click', () => renderDoublesNoConsentScreen(container));
}

// Экран отказа (с исправленными кнопками)
function renderDoublesNoConsentScreen(container) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔒</div>
                <h1>Психометрические двойники</h1>
            </div>
            <div class="content-body" style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                <div style="font-size: 15px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">ВЫ НЕ РАЗРЕШИЛИ ИСПОЛЬЗОВАТЬ ПРОФИЛЬ</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Чтобы найти психометрических двойников, нужно разрешить использовать ваш профиль.</div>
                <button id="doublesRetryBtn" style="background: rgba(224,224,224,0.1); border: 1px solid rgba(224,224,224,0.2); border-radius: 40px; padding: 12px 24px; color: var(--chrome); cursor: pointer;">✅ РАЗРЕШИТЬ</button>
            </div>
        </div>
    `;
    
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
    
    document.getElementById('doublesRetryBtn')?.addEventListener('click', () => {
        doublesState.hasConsent = true;
        renderDoublesSearchScreen(container);
    });
}

// Экран поиска
function renderDoublesSearchScreen(container) {
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔍</div>
                <h1>Поиск двойников</h1>
            </div>
            <div class="content-body" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; animation: spin 1s linear infinite; margin-bottom: 16px;">🔄</div>
                <div style="font-size: 13px; color: var(--chrome); margin-bottom: 6px;">ИЩЕМ ВАШИХ ДВОЙНИКОВ...</div>
                <div style="font-size: 11px; color: var(--text-secondary);">Анализируем профиль: ${userDoublesProfile.profile}</div>
            </div>
        </div>
    `;
    
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
    
    searchDoublesAPI().then(doubles => {
        doublesState.foundDoubles = doubles;
        renderDoublesResultsScreen(container);
    });
}

// Экран результатов
function renderDoublesResultsScreen(container) {
    let doublesHtml = '';
    
    if (doublesState.foundDoubles.length === 0) {
        doublesHtml = `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">ПОКА НЕТ ТОЧНЫХ СОВПАДЕНИЙ</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Ваш профиль уникален в нашей базе на данный момент.</div>
            </div>
        `;
    } else {
        doublesState.foundDoubles.forEach(d => {
            doublesHtml += `
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        <span style="font-size: 14px; font-weight: 600; color: var(--chrome);">🧠 ${d.name || 'Пользователь'}</span>
                        <span style="font-size: 10px; color: var(--text-secondary);">${d.age ? d.age + ' лет' : ''} ${d.city ? '| ' + d.city : ''}</span>
                    </div>
                    <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-family: monospace; font-size: 9px; margin-bottom: 8px;">${d.profile_code || d.profile || userDoublesProfile.profile} | ${d.profile_type || userDoublesProfile.profileType}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 16px; font-weight: 700; color: var(--chrome);">✨ СХОЖЕСТЬ: ${d.similarity}%</span>
                    </div>
                    ${d.diff ? `<div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px;">📊 ${d.diff}</div>` : ''}
                    <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">💡 "${d.insight}"</div>
                </div>
            `;
        });
    }
    
    const trajectory = getDevelopmentTrajectory();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="doublesBackBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">👥</div>
                <h1>Психометрические двойники</h1>
            </div>
            <div class="content-body">
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
                    <div><span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 4px 12px; font-family: monospace; font-size: 10px;">${userDoublesProfile.profile} | ${userDoublesProfile.profileType}</span></div>
                    <div style="font-size: 12px; color: var(--chrome);">🎯 НАЙДЕНО ${doublesState.foundDoubles.length} ДВОЙНИКОВ</div>
                </div>
                
                ${doublesHtml}
                
                <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">📈 ВОЗМОЖНАЯ ТРАЕКТОРИЯ</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory5}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory10}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">${trajectory.trajectory20}</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">💡 ПОЧЕМУ ЭТО ВАЖНО?</div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">Люди с похожими психометрическими профилями лучше понимают друг друга. Общение с двойником помогает увидеть свои паттерны со стороны.</div>
                </div>
                
                <div style="margin-top: 16px; text-align: center;">
                    <button id="doublesSearchAgainBtn" style="background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.15); border-radius: 40px; padding: 10px 20px; color: var(--chrome); cursor: pointer;">🔄 НАЙТИ СНОВА</button>
                </div>
            </div>
        </div>
    `;
    
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
    
    document.getElementById('doublesSearchAgainBtn')?.addEventListener('click', () => renderDoublesSearchScreen(container));
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
    renderDoublesConsentScreen(container);
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showDoublesScreen = showDoublesScreen;
window.goBackToDashboard = goBackToDashboard;

console.log('✅ Модуль двойников загружен (версия 3.1 — исправлена передача ID и стили кнопок)');
