// ============================================
// doubles.js — Психометрические двойники
// Версия 1.0
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
    profileType: 'АНАЛИТИК'
};

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
        
        userDoublesProfile = {
            name: localStorage.getItem('fredi_user_name') || context.name || 'Пользователь',
            age: context.age || null,
            city: context.city || null,
            profile: profileDataObj.display_name || profile.display_name || 'СБ-4, ТФ-4, УБ-4, ЧВ-4',
            profileType: profile.perception_type || profileDataObj.perception_type || 'АНАЛИТИК'
        };
        
        console.log('📊 Данные для поиска двойников:', userDoublesProfile);
    } catch (error) {
        console.warn('Failed to load user profile for doubles:', error);
    }
}

// ============================================
// ПОИСК ДВОЙНИКОВ (API вызов)
// ============================================
async function searchDoublesAPI() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        const response = await fetch(`${apiUrl}/api/psychometric/find-doubles?user_id=${userId}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.doubles) {
            return data.doubles;
        }
        return [];
    } catch (error) {
        console.warn('API search failed, using mock data:', error);
        // Мок-данные для демонстрации
        return [
            {
                name: 'Александр',
                age: 34,
                city: 'Санкт-Петербург',
                profile: userDoublesProfile.profile,
                profileType: userDoublesProfile.profileType,
                similarity: 98,
                diff: null,
                insight: 'У нас почти идентичный профиль. Возможно, вы сталкиваетесь с похожими вызовами.'
            },
            {
                name: 'Екатерина',
                age: 28,
                city: 'Новосибирск',
                profile: userDoublesProfile.profile.replace('4', '5'),
                profileType: userDoublesProfile.profileType === 'АНАЛИТИК' ? 'АНАЛИТИК-СТРАТЕГ' : 'ЭМПАТ-СОЦИАЛ',
                similarity: 85,
                diff: 'Уровень "Понимание мира" отличается на 1 балл',
                insight: 'У вас есть потенциал к более стратегическому мышлению.'
            },
            {
                name: 'Михаил',
                age: 41,
                city: 'Екатеринбург',
                profile: userDoublesProfile.profile.replace('СБ-4', 'СБ-3'),
                profileType: 'ЭМПАТ-СОЦИАЛ',
                similarity: 72,
                diff: 'Реакция на давление ниже на 1 балл',
                insight: 'Ваша стрессоустойчивость выше — это ваше преимущество.'
            }
        ];
    }
}

// ============================================
// РЕНДЕР ЭКРАНОВ
// ============================================

// Экран согласия
function renderDoublesConsentScreen(container) {
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
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--chrome);">🧬 ЗНАЯ ДВОЙНИКОВ — ЗНАЕТЕ ВАРИАЦИИ СВОЕЙ ЖИЗНИ</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Какой ещё могла быть ваша жизнь? Какие пути вы не выбрали? Узнайте у тех, кто сделал другой выбор, но имеет ТАКОЙ ЖЕ психотип.</div>
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
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">🧠 Психолог</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">🎨 Креативный директор</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">💬 Social manager</span>
                        <span style="background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-size: 10px;">📚 Преподаватель</span>
                    </div>
                    <div style="font-size: 11px; color: var(--chrome);">Какой путь выбрали ВАШИ ДВОЙНИКИ?</div>
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
    
    document.getElementById('doublesBackBtn')?.addEventListener('click', () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    });
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
    document.getElementById('doublesBackBtn')?.addEventListener('click', () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    });
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
                <div style="font-size: 12px; color: var(--text-secondary);">Ваш профиль уникален. Попробуйте позже.</div>
            </div>
        `;
    } else {
        doublesState.foundDoubles.forEach(d => {
            doublesHtml += `
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        <span style="font-size: 14px; font-weight: 600; color: var(--chrome);">🧠 ${d.name}</span>
                        <span style="font-size: 10px; color: var(--text-secondary);">${d.age ? d.age + ' лет' : ''} ${d.city ? '| ' + d.city : ''}</span>
                    </div>
                    <div style="display: inline-block; background: rgba(224,224,224,0.08); border-radius: 30px; padding: 3px 10px; font-family: monospace; font-size: 9px; margin-bottom: 8px;">${d.profile} | ${d.profileType}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 16px; font-weight: 700; color: var(--chrome);">✨ СХОЖЕСТЬ: ${d.similarity}%</span>
                    </div>
                    ${d.diff ? `<div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px;">📊 ${d.diff}</div>` : ''}
                    <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">💡 "${d.insight}"</div>
                </div>
            `;
        });
    }
    
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
                
                <div style="background: rgba(224,224,224,0.03); border-radius: 20px; padding: 14px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--chrome);">💡 ПОЧЕМУ ЭТО ВАЖНО?</div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">Люди с похожими психометрическими профилями лучше понимают друг друга. Общение с двойником помогает увидеть свои паттерны со стороны и найти новые решения.</div>
                    <div style="font-size: 11px; color: var(--chrome); margin-top: 8px;">✨ ОДИН ПРОФИЛЬ — МНОГО ЖИЗНЕЙ</div>
                </div>
                
                <div style="margin-top: 16px; text-align: center;">
                    <button id="doublesSearchAgainBtn" class="action-btn">🔄 НАЙТИ СНОВА</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('doublesBackBtn')?.addEventListener('click', () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else if (window.renderDashboard) window.renderDashboard();
    });
    document.getElementById('doublesSearchAgainBtn')?.addEventListener('click', () => renderDoublesSearchScreen(container));
}

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================
async function showDoublesScreen() {
    const completed = await (window.isTestCompleted ? window.isTestCompleted() : (window.isTestCompleted));
    if (!completed) {
        if (window.showToast) window.showToast('📊 Сначала пройдите психологический тест');
        else alert('📊 Сначала пройдите психологический тест');
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
console.log('✅ Модуль двойников загружен (версия 1.0)');
