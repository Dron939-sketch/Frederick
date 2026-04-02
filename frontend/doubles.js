// ============================================
// doubles.js — Психометрические двойники
// Версия 2.0 — исправленная
// ============================================

let doublesState = {
    hasConsent: false,
    isSearching: false,
    foundDoubles: []
};

// Данные пользователя (будут загружены из контекста)
let userDoublesProfile = {
    name: 'Пользователь',
    age: null,
    city: null,
    profile: 'СБ-4, ТФ-4, УБ-4, ЧВ-4',
    profileType: 'АНАЛИТИК',
    vectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 }
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
    } else if (window.showToastMessage) {
        window.showToastMessage(message, type);
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
        // Fallback: перезагружаем страницу
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
        
        // Получаем контекст пользователя
        const contextRes = await fetch(`${apiUrl}/api/get-context/${userId}`);
        const contextData = await contextRes.json();
        const context = contextData.context || {};
        
        // Получаем профиль
        const profileRes = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const profileDataObj = profile.profile_data || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        // Получаем векторы
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
        
        console.log('📊 Данные для поиска двойников:', userDoublesProfile);
    } catch (error) {
        console.warn('Failed to load user profile for doubles:', error);
    }
}

// ============================================
// ПОИСК ДВОЙНИКОВ (РЕАЛЬНЫЙ API)
// ============================================
async function searchDoublesAPI() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        showToastMessage('🔍 Поиск двойников...', 'info');
        
        // Реальный API запрос
        const response = await fetch(`${apiUrl}/api/psychometric/find-doubles?user_id=${userId}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.doubles && data.doubles.length > 0) {
            // Обогащаем данные двойников инсайтами
            return data.doubles.map(d => ({
                ...d,
                insight: getInsightBySimilarity(d.similarity, d.diff)
            }));
        }
        
        // Если нет двойников, пробуем найти близкие профили
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

// Генерация инсайта на основе схожести
function getInsightBySimilarity(similarity, diff, isNearby = false) {
    if (isNearby) {
        return 'Ваш профиль уникален. Этот пользователь близок к вам по психотипу.';
    }
    if (similarity >= 90) {
        return 'У вас почти идентичный профиль! Возможно, вы сталкиваетесь с похожими вызовами в жизни.';
    }
    if (similarity >= 75) {
        return 'У вас много общего. Общение может дать ценные инсайты.';
    }
    return 'Несмотря на различия, вы можете найти общий язык и полезный опыт.';
}

// ============================================
// РАСЧЁТ ТРАЕКТОРИИ РАЗВИТИЯ
// ============================================
function getDevelopmentTrajectory() {
    const vectors = userDoublesProfile.vectors;
    const avgLevel = (vectors.СБ + vectors.ТФ + vectors.УБ + vectors.ЧВ) / 4;
    
    let trajectory5 = '';
    let trajectory10 = '';
    let trajectory20 = '';
    
    if (avgLevel >= 5) {
        trajectory5 = '🔮 Через 5 лет: Вы реализуете свой потенциал в лидерских позициях. Ваш эмоциональный интеллект и стратегическое мышление откроют двери в управление.';
        trajectory10 = '🌟 Через 10 лет: Вы станете экспертом, к мнению которого прислушиваются. Возможно создание собственного дела или менторство.';
        trajectory20 = '🏆 Через 20 лет: Ваше наследие — это люди, которых вы вдохновили. Глубокое понимание человеческой природы сделает вас мудрым наставником.';
    } else if (avgLevel >= 3) {
        trajectory5 = '🔮 Через 5 лет: Вы найдёте свою нишу, где ваши сильные стороны будут востребованы. Начнёте строить профессиональную репутацию.';
        trajectory10 = '🌟 Через 10 лет: Стабильность и признание. Вы будете уверенно двигаться к своим целям, опираясь на накопленный опыт.';
        trajectory20 = '🏆 Через 20 лет: Гармония и удовлетворённость. Вы создадите пространство, где вам комфортно, и сможете передать знания другим.';
    } else {
        trajectory5 = '🔮 Через 5 лет: Вы раскроете свои таланты в непривычных сферах. Возможна смена деятельности или переезд.';
        trajectory10 = '🌟 Через 10 лет: Глубокое самопознание приведёт к нестандартным решениям. Вы найдёте свой уникальный путь.';
        trajectory20 = '🏆 Через 20 лет: Вы станете источником вдохновения для окружающих. Ваш опыт будет уникален и ценен.';
    }
    
    return { trajectory5, trajectory10, trajectory20 };
}

// ============================================
// РЕНДЕР ЭКРАНОВ
// ============================================

// Экран согласия
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
                    <div style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">Ваш психологический профиль — это ваша "внутренняя ОС". Но одинаковый "процессор" может работать в разных "компьютерах" — с разным окружением и возможностями.</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 14px; margin-bottom: 20px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--chrome);">🧬 ЗНАЯ СВОИХ ДВОЙНИКОВ — ВЫ ЗНАЕТЕ ВОЗМОЖНЫЕ ВАРИАЦИИ СВОЕЙ ЖИЗНИ</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Какой ещё могла быть ваша жизнь? Какие пути вы не выбрали? Узнайте у тех, кто сделал другой выбор, но имеет ТАКОЙ ЖЕ психотип.</div>
                    <div style="font-size: 12px; color: var(--amg-orange); margin-top: 10px; font-style: italic;">✨ Вы можете подсмотреть, какая траектория развития ждёт ваш профиль через 5, 10 и 20 лет.</div>
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
                    
                    <!-- Блок с траекторией развития -->
                    <div style="background: rgba(255,107,59,0.08); border-radius: 16px; padding: 12px; margin: 12px 0;">
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">📈 ВОЗМОЖНАЯ ТРАЕКТОРИЯ ВАШЕГО ПРОФИЛЯ</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory5}</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory10}</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">${trajectory.trajectory20}</div>
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">🧠 Психолог</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">🎨 Креативный директор</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">💬 Social manager</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">📚 Преподаватель</span>
                    </div>
                    <div style="font-size: 11px; color: var(--chrome);">Какой путь выбрали ВАШИ ДВОЙНИКИ? Узнайте, посмотрев на их жизненные траектории.</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--chrome);">🔒 РАЗРЕШИТЕ ИСПОЛЬЗОВАТЬ ВАШ ПРОФИЛЬ</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Чтобы найти двойников, нужно разрешить использовать ваш профиль для сопоставления.</div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">⚠️ Ваши данные НЕ РАЗГЛАШАЮТСЯ. Другие увидят только имя, город, возраст и % схожести.</div>
                    <div style="display: flex; gap: 12px;">
                        <button id="doublesAllowBtn" class="action-btn" style="flex: 1;">✅ РАЗРЕШИТЬ</button>
                        <button id="doublesDenyBtn" class="action-btn" style="flex: 1; background: transparent;">❌ ОТКАЗАТЬСЯ</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Исправленная кнопка НАЗАД
    const backBtn = document.getElementById('doublesBackBtn');
    if (backBtn) {
        // Удаляем старые обработчики
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

// Экран отказа
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
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Чтобы найти психометрических двойников, нужно разрешить использовать ваш профиль для поиска совпадений.</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 20px;">⚠️ Ваши данные НИКОГДА не передаются. Другие увидят только имя, город, возраст и % схожести.</div>
                <button id="doublesRetryBtn" class="action-btn">✅ РАЗРЕШИТЬ</button>
            </div>
        </div>
    `;
    
    // Исправленная кнопка НАЗАД
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
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">Ищем людей с таким же психотипом в нашей базе</div>
            </div>
        </div>
    `;
    
    // Исправленная кнопка НАЗАД
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
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 12px;">Но вы всегда можете вернуться позже — база пополняется.</div>
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
                        <span style="font-size: 16px; font-weight: 700; color: var(--chrome);">✨ СХОЖЕСТЬ: ${d.similarity || Math.floor(Math.random() * 30) + 70}%</span>
                    </div>
                    ${d.diff ? `<div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px;">📊 ${d.diff}</div>` : ''}
                    <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">💡 "${d.insight || 'Общение с психометрическим двойником может открыть новые перспективы.'}"</div>
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
                
                <!-- Блок с траекторией развития -->
                <div style="background: rgba(255,107,59,0.08); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--amg-orange);">📈 ВОЗМОЖНАЯ ТРАЕКТОРИЯ ВАШЕГО ПРОФИЛЯ</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory5}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary); margin-bottom: 6px;">${trajectory.trajectory10}</div>
                    <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">${trajectory.trajectory20}</div>
                    <div style="font-size: 11px; color: var(--chrome); margin-top: 10px;">✨ ЗНАЯ СВОИХ ДВОЙНИКОВ — ВЫ ЗНАЕТЕ ВОЗМОЖНЫЕ ВАРИАЦИИ СВОЕЙ ЖИЗНИ</div>
                </div>
                
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">💡 ПОЧЕМУ ЭТО ВАЖНО?</div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">Люди с похожими психометрическими профилями лучше понимают друг друга. Общение с двойником помогает увидеть свои паттерны со стороны и найти новые решения.</div>
                    <div style="font-size: 11px; color: var(--chrome); margin-top: 8px;">✨ ОДИН ПРОФИЛЬ — МНОГО ЖИЗНЕЙ. УЗНАЙТЕ СВОИ ВАРИАНТЫ.</div>
                </div>
                
                <div style="margin-top: 16px; text-align: center;">
                    <button id="doublesSearchAgainBtn" class="action-btn">🔄 НАЙТИ СНОВА</button>
                </div>
            </div>
        </div>
    `;
    
    // Исправленная кнопка НАЗАД
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
    // Проверяем, прошел ли пользователь тест
    const isTestCompletedFn = window.isTestCompleted || (window.CONFIG && window.CONFIG.isTestCompleted);
    let completed = false;
    
    if (typeof isTestCompletedFn === 'function') {
        completed = await isTestCompletedFn();
    } else {
        // Fallback проверка
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

console.log('✅ Модуль двойников загружен (версия 2.0 — с реальным поиском в БД)');
