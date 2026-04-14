// ============================================
// МОДУЛЬ: ЯКОРЯ И ИМПРИНТЫ
// Версия: 2.0
// ============================================

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const ANCHORS_CONFIG = {
    modalities: {
        visual: { name: 'Визуальный', icon: '👁️', desc: 'Жест, символ, образ' },
        auditory: { name: 'Аудиальный', icon: '🔊', desc: 'Слово, звук, фраза' },
        kinesthetic: { name: 'Кинестетический', icon: '🖐️', desc: 'Прикосновение, поза' }
    },

    states: {
        calm: { name: 'Спокойствие', icon: '😌', desc: 'Расслабление, умиротворение' },
        confidence: { name: 'Уверенность', icon: '💪', desc: 'Сила, вера в себя' },
        focus: { name: 'Фокус', icon: '🎯', desc: 'Концентрация, внимание' },
        energy: { name: 'Энергия', icon: '⚡', desc: 'Бодрость, активность' },
        love: { name: 'Любовь', icon: '💖', desc: 'Тепло, принятие' },
        gratitude: { name: 'Благодарность', icon: '🙏', desc: 'Ценность жизни' },
        safety: { name: 'Безопасность', icon: '🛡️', desc: 'Защищённость' },
        joy: { name: 'Радость', icon: '😊', desc: 'Лёгкость, счастье' },
        grounding: { name: 'Заземление', icon: '🌍', desc: 'Связь с телом' },
        action: { name: 'Действие', icon: '🚀', desc: 'Импульс к началу' }
    },

    techniques: {
        stacking: { name: 'Накладка якорей', icon: '🔗', desc: 'Соединение двух состояний' },
        collapse: { name: 'Коллапс якорей', icon: '💥', desc: 'Разрушение негативного якоря' },
        chaining: { name: 'Цепочка якорей', icon: '⛓️', desc: 'Последовательная активация' },
        reimprinting: { name: 'Реимпринтинг', icon: '🔄', desc: 'Перезапись импринта' }
    },

    sources: {
        own: { name: 'Мой опыт', icon: '🧠', desc: 'Из вашей жизни' },
        movie: { name: 'Из фильма', icon: '🎬', desc: 'Сцена из кино' },
        music: { name: 'Из музыки', icon: '🎵', desc: 'Трек или звук' },
        metaphor: { name: 'Метафора', icon: '📖', desc: 'Образный ряд' },
        body: { name: 'Через тело', icon: '🧘', desc: 'Дыхание, поза' },
        other: { name: 'Опыт другого', icon: '👥', desc: 'Эмпатия к герою' }
    }
};

// ============================================
// ХРАНИЛИЩЕ
// ============================================

let userAnchors = [];
let currentAnchorView = 'list';
let anchorWizardStep = 0;
let anchorWizardData = {};
let reimprintingStep = 0;
let reimprintingData = {};

// ============================================
// API ВЫЗОВЫ
// ============================================

async function loadUserAnchors() {
    try {
        const response = await apiCall(`/api/anchors/user/${CONFIG.USER_ID}`);
        userAnchors = response.anchors || [];
        return userAnchors;
    } catch (e) {
        console.warn('Failed to load anchors:', e);
        userAnchors = [];
        return [];
    }
}

async function saveAnchor(anchorData) {
    try {
        const response = await apiCall('/api/anchors/save', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, ...anchorData })
        });
        return response.success;
    } catch (e) {
        console.error('Failed to save anchor:', e);
        return false;
    }
}

async function deleteAnchor(anchorId) {
    try {
        const response = await apiCall('/api/anchors/delete', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, anchor_id: anchorId })
        });
        return response.success;
    } catch (e) {
        console.error('Failed to delete anchor:', e);
        return false;
    }
}

async function fireAnchorAPI(anchorId, anchorName) {
    try {
        const response = await apiCall('/api/anchors/fire', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, anchor_id: anchorId, anchor_name: anchorName })
        });
        return response.phrase || anchorName;
    } catch (e) {
        console.error('Failed to fire anchor:', e);
        return null;
    }
}

async function getProfileBasedRecommendations() {
    try {
        const status = await getUserStatus();
        if (!status.has_profile) return [];
        
        const profile = status.profile_code || '';
        const vectors = status.vectors || {};
        
        const recommendations = [];
        
        // На основе векторов
        if (vectors.SB && vectors.SB < 3) {
            recommendations.push({
                state: 'action',
                name: 'Импульс действия',
                trigger: 'хлопок в ладоши',
                phrase: 'Раз! И я начинаю.',
                reason: 'Ваш вектор действия (СБ) нуждается в поддержке'
            });
        }
        if (vectors.TF && vectors.TF < 3) {
            recommendations.push({
                state: 'grounding',
                name: 'Заземление',
                trigger: 'стопы в пол',
                phrase: 'Я здесь. Моё тело — моя опора.',
                reason: 'Ваш телесный вектор (ТФ) нуждается в заземлении'
            });
        }
        if (vectors.UB && vectors.UB < 3) {
            recommendations.push({
                state: 'calm',
                name: 'Гибкость',
                trigger: 'пожать плечами',
                phrase: 'Можно и так.',
                reason: 'Ваш вектор гибкости (УБ) нуждается в расслаблении'
            });
        }
        if (vectors.CV && vectors.CV < 3) {
            recommendations.push({
                state: 'joy',
                name: 'Тепло',
                trigger: 'рука на сердце',
                phrase: 'Я чувствую. Я живу.',
                reason: 'Ваш эмоциональный вектор (ЧВ) нуждается в тепле'
            });
        }
        
        return recommendations;
    } catch (e) {
        console.warn('Failed to get recommendations:', e);
        return [];
    }
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================

async function showAnchors() {
    await loadUserAnchors();
    const recommendations = await getProfileBasedRecommendations();
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="anchors-container">
            <div class="anchors-header">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <h1 class="anchors-title">⚓ Якоря</h1>
            </div>
            
            <div class="anchors-tabs">
                <button class="anchor-tab ${currentAnchorView === 'list' ? 'active' : ''}" data-view="list">🎯 Мои якоря</button>
                <button class="anchor-tab ${currentAnchorView === 'create' ? 'active' : ''}" data-view="create">➕ Создать</button>
                <button class="anchor-tab ${currentAnchorView === 'recommend' ? 'active' : ''}" data-view="recommend">🎲 Подбор</button>
                <button class="anchor-tab ${currentAnchorView === 'techniques' ? 'active' : ''}" data-view="techniques">🔧 Техники</button>
                <button class="anchor-tab ${currentAnchorView === 'imprints' ? 'active' : ''}" data-view="imprints">📚 Импринты</button>
                <button class="anchor-tab ${currentAnchorView === 'constructor' ? 'active' : ''}" data-view="constructor">🎬 Конструктор</button>
            </div>
            
            <div class="anchors-content">
                ${renderCurrentView(currentAnchorView, { recommendations, userAnchors })}
            </div>
        </div>
        
        <style>
            .anchors-container { padding: 20px; max-width: 800px; margin: 0 auto; }
            .anchors-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
            .anchors-title { font-size: 28px; font-weight: 700; margin: 0; }
            .anchors-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid rgba(224,224,224,0.1); padding-bottom: 12px; }
            .anchor-tab { background: transparent; border: none; padding: 8px 16px; border-radius: 30px; color: var(--text-secondary); cursor: pointer; font-size: 14px; transition: all 0.2s; }
            .anchor-tab.active { background: linear-gradient(135deg, #ff6b3b, #ff3b3b); color: white; }
            .anchor-card { background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; border: 1px solid rgba(224,224,224,0.1); transition: all 0.2s; }
            .anchor-card:hover { background: rgba(224,224,224,0.08); transform: translateX(4px); }
            .anchor-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
            .anchor-state { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
            .anchor-trigger { font-size: 14px; color: #ff6b3b; margin-bottom: 12px; font-family: monospace; }
            .anchor-actions { display: flex; gap: 12px; margin-top: 12px; }
            .anchor-btn { padding: 8px 16px; border-radius: 30px; border: none; cursor: pointer; font-size: 13px; transition: all 0.2s; }
            .fire-btn { background: linear-gradient(135deg, #ff6b3b, #ff3b3b); color: white; }
            .delete-btn { background: rgba(224,224,224,0.1); color: var(--text-secondary); }
            .recommend-card { background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05)); border-radius: 16px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #ff6b3b; }
            .wizard-step { background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px; margin-top: 20px; }
            .wizard-options { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }
            .wizard-option { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; }
            .wizard-option:hover { background: rgba(224,224,224,0.08); border-color: #ff6b3b; }
            .wizard-option.selected { background: rgba(255,107,59,0.15); border-color: #ff6b3b; }
            .tech-card { background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer; }
            .tech-card:hover { background: rgba(224,224,224,0.08); }
            .constructor-source { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
            .source-btn { background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1); border-radius: 40px; padding: 12px 20px; cursor: pointer; text-align: center; transition: all 0.2s; }
            .source-btn:hover { background: rgba(255,107,59,0.2); border-color: #ff6b3b; }
            .imprint-card { background: rgba(224,224,224,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
            .progress-bar { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; overflow: hidden; margin: 8px 0; }
            .progress-fill { height: 100%; background: linear-gradient(90deg, #ff6b3b, #ff3b3b); width: 0%; transition: width 0.3s; }
        </style>
    `;
    
    document.getElementById('backBtn').onclick = () => renderDashboard();
    
    document.querySelectorAll('.anchor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentAnchorView = tab.dataset.view;
            showAnchors();
        });
    });
}

// ============================================
// РЕНДЕР ВИДОВ
// ============================================

function renderCurrentView(view, data) {
    switch(view) {
        case 'list': return renderAnchorsList(data.userAnchors);
        case 'create': return renderAnchorWizard();
        case 'recommend': return renderRecommendations(data.recommendations);
        case 'techniques': return renderTechniques();
        case 'imprints': return renderImprints();
        case 'constructor': return renderConstructor();
        default: return renderAnchorsList(data.userAnchors);
    }
}

function renderAnchorsList(anchors) {
    if (!anchors.length) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">⚓</div>
                <h3>У вас пока нет якорей</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Создайте первый якорь — и вы сможете вызывать нужное состояние в любой момент</p>
                <button class="anchor-tab active" data-view="create" style="padding: 12px 24px;">➕ Создать первый якорь</button>
            </div>
        `;
    }
    
    return `
        <div class="anchors-stats" style="margin-bottom: 20px; display: flex; gap: 16px;">
            <div style="background: rgba(224,224,224,0.05); border-radius: 12px; padding: 12px 20px;">
                <div style="font-size: 28px; font-weight: 700;">${anchors.length}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">всего якорей</div>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 12px; padding: 12px 20px;">
                <div style="font-size: 28px; font-weight: 700;">${anchors.filter(a => a.uses > 0).length}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">использованных</div>
            </div>
        </div>
        ${anchors.map(anchor => `
            <div class="anchor-card" data-id="${anchor.id}">
                <div class="anchor-name">
                    <span>${anchor.icon || '⚓'}</span>
                    <span>${anchor.name}</span>
                </div>
                <div class="anchor-state">${anchor.state_icon || '😌'} ${anchor.state_name || anchor.state}</div>
                <div class="anchor-trigger">🔑 Триггер: ${anchor.trigger || anchor.phrase?.substring(0, 50) || '—'}</div>
                <div class="anchor-actions">
                    <button class="anchor-btn fire-btn" onclick="fireAnchor('${anchor.id}', '${anchor.name.replace(/'/g, "\\'")}')">🔥 Активировать</button>
                    <button class="anchor-btn delete-btn" onclick="deleteAnchorConfirm('${anchor.id}')">🗑️ Удалить</button>
                </div>
                ${anchor.uses ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">✅ использовано ${anchor.uses} раз</div>` : ''}
            </div>
        `).join('')}
    `;
}

function renderAnchorWizard() {
    const step = anchorWizardStep;
    const data = anchorWizardData;
    
    if (step === 0) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 1 из 5: Что вы хотите якорить?</p>
                <div class="wizard-options">
                    ${Object.entries(ANCHORS_CONFIG.states).map(([key, state]) => `
                        <div class="wizard-option" onclick="anchorWizardSelectState('${key}')">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">${state.icon}</span>
                                <div>
                                    <div style="font-weight: 600;">${state.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${state.desc}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (step === 1) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 2 из 5: Откуда возьмём состояние «${ANCHORS_CONFIG.states[data.state]?.name || data.state}»?</p>
                <div class="wizard-options">
                    ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                        <div class="wizard-option ${data.source === key ? 'selected' : ''}" onclick="anchorWizardSelectSource('${key}')">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">${source.icon}</span>
                                <div>
                                    <div style="font-weight: 600;">${source.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${source.desc}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${data.source ? `
                    <div style="margin-top: 20px;">
                        ${renderSourceInput(data.source, data)}
                    </div>
                    <button class="anchor-btn fire-btn" style="margin-top: 20px; width: 100%;" onclick="anchorWizardNext()">Далее →</button>
                ` : ''}
            </div>
        `;
    }
    
    if (step === 2) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 3 из 5: Какой будет триггер?</p>
                <div class="wizard-options">
                    <div class="wizard-option ${data.modality === 'auditory' ? 'selected' : ''}" onclick="anchorWizardSelectModality('auditory')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">🔊</span>
                            <div><div style="font-weight: 600;">Аудиальный</div><div style="font-size: 12px;">Ключевая фраза, слово</div></div>
                        </div>
                    </div>
                    <div class="wizard-option ${data.modality === 'kinesthetic' ? 'selected' : ''}" onclick="anchorWizardSelectModality('kinesthetic')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">🖐️</span>
                            <div><div style="font-weight: 600;">Кинестетический</div><div style="font-size: 12px;">Жест, прикосновение, поза</div></div>
                        </div>
                    </div>
                    <div class="wizard-option ${data.modality === 'visual' ? 'selected' : ''}" onclick="anchorWizardSelectModality('visual')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 24px;">👁️</span>
                            <div><div style="font-weight: 600;">Визуальный</div><div style="font-size: 12px;">Образ, символ, мысленная картинка</div></div>
                        </div>
                    </div>
                </div>
                ${data.modality ? `
                    <div style="margin-top: 20px;">
                        <label style="display: block; margin-bottom: 8px;">Введите ваш триггер:</label>
                        <input type="text" id="triggerInput" class="wizard-input" placeholder="Например: «Я спокоен» или сжать кулак" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white;">
                    </div>
                    <button class="anchor-btn fire-btn" style="margin-top: 20px; width: 100%;" onclick="anchorWizardSaveTrigger()">Далее →</button>
                ` : ''}
            </div>
        `;
    }
    
    if (step === 3) {
        return `
            <div class="wizard-step">
                <h3>➕ Создание нового якоря</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Шаг 4 из 5: Назовите ваш якорь</p>
                <input type="text" id="anchorNameInput" class="wizard-input" placeholder="Например: «Спокойствие перед выступлением»" value="${data.name || ''}" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-bottom: 20px;">
                
                <h3 style="margin-top: 20px;">Установка якоря</h3>
                <div style="background: rgba(255,107,59,0.1); border-radius: 12px; padding: 16px; margin: 16px 0;">
                    <p><strong>📖 Инструкция:</strong></p>
                    <ol style="margin-left: 20px; line-height: 1.8;">
                        <li>Войдите в состояние ${ANCHORS_CONFIG.states[data.state]?.name || data.state} (используя ${ANCHORS_CONFIG.sources[data.source]?.name || data.source})</li>
                        <li>В момент ПИКА состояния — сделайте триггер: <strong>«${data.trigger}»</strong></li>
                        <li>Сбросьте состояние (отвлекитесь, встаньте)</li>
                        <li>Повторите шаги 1-3 ещё 3-5 раз</li>
                        <li>Проверьте: активируйте триггер — должно приходить состояние</li>
                    </ol>
                </div>
                
                <div class="anchor-actions" style="margin-top: 20px;">
                    <button class="anchor-btn fire-btn" style="flex: 1;" onclick="anchorWizardComplete()">✅ Сохранить якорь</button>
                    <button class="anchor-btn delete-btn" style="flex: 1;" onclick="anchorWizardReset()">↺ Начать заново</button>
                </div>
            </div>
        `;
    }
    
    return '<div>Загрузка...</div>';
}

function renderSourceInput(source, data) {
    const sources = {
        own: `<textarea id="sourceDetail" placeholder="Опишите ситуацию из вашего опыта, когда вы чувствовали это состояние..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 80px;"></textarea>`,
        movie: `<input type="text" id="sourceDetail" placeholder="Фильм и сцена: например, «Гладиатор — сцена перед битвой»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white;">`,
        music: `<input type="text" id="sourceDetail" placeholder="Трек или композиция: например, «Hans Zimmer — Time»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white;">`,
        metaphor: `<textarea id="sourceDetail" placeholder="Опишите метафору: например, «Я — скала, которую не может сдвинуть ветер»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 80px;"></textarea>`,
        body: `<textarea id="sourceDetail" placeholder="Опишите телесную практику: например, «Глубокий вдох на 4 счета, задержка, выдох на 6»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 80px;"></textarea>`,
        other: `<textarea id="sourceDetail" placeholder="Чей опыт вы берёте? Опишите человека и ситуацию..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 80px;"></textarea>`
    };
    return sources[source] || sources.own;
}

function renderRecommendations(recommendations) {
    if (!recommendations.length) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🎲</div>
                <h3>Нет персональных рекомендаций</h3>
                <p style="color: var(--text-secondary);">Пройдите психологический тест, чтобы получить якоря под ваш профиль</p>
                <button class="anchor-tab active" onclick="startTest()" style="padding: 12px 24px; margin-top: 16px;">📊 Пройти тест</button>
            </div>
        `;
    }
    
    return `
        <div style="margin-bottom: 16px;">
            <p>🎯 На основе вашего психологического профиля:</p>
        </div>
        ${recommendations.map(rec => `
            <div class="recommend-card">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 32px;">${ANCHORS_CONFIG.states[rec.state]?.icon || '⚓'}</span>
                    <div>
                        <div style="font-weight: 700; font-size: 18px;">${rec.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${rec.reason}</div>
                    </div>
                </div>
                <div class="anchor-trigger" style="margin: 12px 0;">🔑 Триггер: ${rec.trigger}</div>
                <div style="font-size: 14px; margin-bottom: 16px;">💬 Фраза: «${rec.phrase}»</div>
                <button class="anchor-btn fire-btn" onclick="quickCreateAnchor('${rec.state}', '${rec.name.replace(/'/g, "\\'")}', '${rec.trigger.replace(/'/g, "\\'")}', '${rec.phrase.replace(/'/g, "\\'")}')">➕ Создать этот якорь</button>
            </div>
        `).join('')}
    `;
}

function renderTechniques() {
    return `
        <div style="margin-bottom: 20px;">
            <p>🔧 Продвинутые техники работы с якорями</p>
        </div>
        ${Object.entries(ANCHORS_CONFIG.techniques).map(([key, tech]) => `
            <div class="tech-card" onclick="showTechnique('${key}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 32px;">${tech.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 18px;">${tech.name}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${tech.desc}</div>
                    </div>
                    <span style="font-size: 20px; color: var(--text-secondary);">→</span>
                </div>
            </div>
        `).join('')}
    `;
}

function renderImprints() {
    return `
        <div style="margin-bottom: 20px;">
            <p>📚 Глубинная работа с импринтами (детскими программами)</p>
        </div>
        
        <div class="imprint-card">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">🔍</span>
                <div>
                    <div style="font-weight: 700;">Диагностика импринтов</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">10 вопросов, 3 минуты</div>
                </div>
            </div>
            <button class="anchor-btn fire-btn" style="width: 100%;" onclick="startImprintDiagnostic()">Начать диагностику</button>
        </div>
        
        <div class="imprint-card">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">🔄</span>
                <div>
                    <div style="font-weight: 700;">Реимпринтинг</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Перезапись детских программ</div>
                </div>
            </div>
            <button class="anchor-btn" style="width: 100%; background: rgba(224,224,224,0.1);" onclick="startReimprinting()">Начать реимпринтинг</button>
        </div>
        
        <div class="imprint-card">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">💡</span>
                <div>
                    <div style="font-weight: 700;">Что такое импринт?</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Бессознательная программа, заложенная в детстве</div>
                </div>
            </div>
            <details style="margin-top: 12px;">
                <summary style="cursor: pointer; color: #ff6b3b;">Подробнее</summary>
                <div style="margin-top: 12px; line-height: 1.6; font-size: 14px;">
                    Импринт (запечатление) — это автоматическая реакция, сформированная в критический период развития (0-7 лет).<br><br>
                    <strong>Примеры импринтов:</strong><br>
                    • «Я не нужен» → страх отвержения<br>
                    • «Мир опасен» → тревожность<br>
                    • «Я должен быть идеальным» → перфекционизм<br><br>
                    <strong>Реимпринтинг</strong> — техника перезаписи этих программ через ресурсного свидетеля (взрослого себя).
                </div>
            </details>
        </div>
    `;
}

function renderConstructor() {
    return `
        <div style="margin-bottom: 20px;">
            <p>🎬 Конструируем состояние, которого нет в опыте</p>
        </div>
        
        <div class="constructor-source">
            ${Object.entries(ANCHORS_CONFIG.sources).map(([key, source]) => `
                <div class="source-btn" onclick="constructorSelectSource('${key}')">
                    <div style="font-size: 28px;">${source.icon}</div>
                    <div style="font-size: 12px; margin-top: 4px;">${source.name}</div>
                </div>
            `).join('')}
        </div>
        
        <div id="constructorContent"></div>
    `;
}

// ============================================
// ОБРАБОТЧИКИ ДЛЯ WIZARD
// ============================================

window.anchorWizardSelectState = (state) => {
    anchorWizardData.state = state;
    anchorWizardStep = 1;
    showAnchors();
};

window.anchorWizardSelectSource = (source) => {
    anchorWizardData.source = source;
    anchorWizardData.sourceDetail = '';
    showAnchors();
};

window.anchorWizardSelectModality = (modality) => {
    anchorWizardData.modality = modality;
    showAnchors();
};

window.anchorWizardSaveTrigger = () => {
    const triggerInput = document.getElementById('triggerInput');
    if (triggerInput) {
        anchorWizardData.trigger = triggerInput.value.trim();
    }
    anchorWizardStep = 3;
    showAnchors();
};

window.anchorWizardNext = () => {
    const sourceDetail = document.getElementById('sourceDetail');
    if (sourceDetail) {
        anchorWizardData.sourceDetail = sourceDetail.value.trim();
    }
    anchorWizardStep = 2;
    showAnchors();
};

window.anchorWizardComplete = async () => {
    const nameInput = document.getElementById('anchorNameInput');
    if (nameInput) {
        anchorWizardData.name = nameInput.value.trim();
    }
    
    if (!anchorWizardData.name) {
        anchorWizardData.name = `${ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state} (${ANCHORS_CONFIG.sources[anchorWizardData.source]?.name || anchorWizardData.source})`;
    }
    
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: anchorWizardData.name,
        state: anchorWizardData.state,
        source: anchorWizardData.source,
        source_detail: anchorWizardData.sourceDetail,
        modality: anchorWizardData.modality,
        trigger: anchorWizardData.trigger,
        phrase: anchorWizardData.trigger,
        icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '⚓',
        state_icon: ANCHORS_CONFIG.states[anchorWizardData.state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[anchorWizardData.state]?.name || anchorWizardData.state
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        showToast('✅ Якорь успешно создан!', 'success');
        anchorWizardStep = 0;
        anchorWizardData = {};
        currentAnchorView = 'list';
        await loadUserAnchors();
        showAnchors();
    } else {
        showToast('❌ Не удалось сохранить якорь', 'error');
    }
};

window.anchorWizardReset = () => {
    anchorWizardStep = 0;
    anchorWizardData = {};
    showAnchors();
};

window.fireAnchor = async (anchorId, anchorName) => {
    showToast(`🔥 Активирую якорь «${anchorName}»...`, 'info');
    const phrase = await fireAnchorAPI(anchorId, anchorName);
    if (phrase) {
        showToast(`✅ ${phrase}`, 'success');
        if (voiceManager) {
            await voiceManager.textToSpeech(phrase, currentMode);
        }
    } else {
        showToast('❌ Не удалось активировать якорь', 'error');
    }
    await loadUserAnchors();
    showAnchors();
};

window.deleteAnchorConfirm = async (anchorId) => {
    if (confirm('Удалить этот якорь?')) {
        const success = await deleteAnchor(anchorId);
        if (success) {
            showToast('🗑️ Якорь удалён', 'success');
            await loadUserAnchors();
            showAnchors();
        } else {
            showToast('❌ Не удалось удалить', 'error');
        }
    }
};

window.quickCreateAnchor = async (state, name, trigger, phrase) => {
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: name,
        state: state,
        source: 'own',
        modality: 'auditory',
        trigger: trigger,
        phrase: phrase,
        icon: ANCHORS_CONFIG.states[state]?.icon || '⚓',
        state_icon: ANCHORS_CONFIG.states[state]?.icon || '😌',
        state_name: ANCHORS_CONFIG.states[state]?.name || state
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        showToast('✅ Якорь создан!', 'success');
        await loadUserAnchors();
        currentAnchorView = 'list';
        showAnchors();
    } else {
        showToast('❌ Ошибка создания', 'error');
    }
};

window.showTechnique = (techniqueKey) => {
    const techniques = {
        stacking: `
            <h3>🔗 Накладка якорей</h3>
            <p>Техника соединения двух ресурсных состояний в один мощный якорь.</p>
            <ol>
                <li>Установите якорь на состояние А (например, спокойствие)</li>
                <li>Установите якорь на состояние Б (например, уверенность)</li>
                <li>Активируйте оба якоря одновременно</li>
                <li>Создайте новый интегрированный якорь</li>
            </ol>
            <button class="anchor-btn fire-btn" onclick="showAnchors()">◀️ Назад</button>
        `,
        collapse: `
            <h3>💥 Коллапс якорей</h3>
            <p>Разрушение негативного якоря через накладку ресурса.</p>
            <ol>
                <li>Установите якорь на негативное состояние</li>
                <li>Установите мощный ресурсный якорь</li>
                <li>Активируйте оба одновременно</li>
                <li>Негатив «схлопывается» ресурсом</li>
            </ol>
            <button class="anchor-btn fire-btn" onclick="showAnchors()">◀️ Назад</button>
        `,
        chaining: `
            <h3>⛓️ Цепочка якорей</h3>
            <p>Последовательная активация состояний для достижения сложной цели.</p>
            <ol>
                <li>Состояние А → Якорь А</li>
                <li>Переход к состоянию Б</li>
                <li>Состояние Б → Якорь Б</li>
                <li>И так далее по цепочке</li>
            </ol>
            <button class="anchor-btn fire-btn" onclick="showAnchors()">◀️ Назад</button>
        `,
        reimprinting: `
            <h3>🔄 Реимпринтинг</h3>
            <p>Перезапись детских программ через ресурсного свидетеля.</p>
            <button class="anchor-btn fire-btn" onclick="startReimprinting()">Начать реимпринтинг</button>
            <button class="anchor-btn delete-btn" onclick="showAnchors()">◀️ Назад</button>
        `
    };
    
    const container = document.getElementById('screenContainer');
    if (container) {
        container.innerHTML = `
            <div class="anchors-container">
                <div class="anchors-header">
                    <button class="back-btn" onclick="showAnchors()">◀️ НАЗАД</button>
                    <h1 class="anchors-title">🔧 Техника</h1>
                </div>
                <div class="technique-content" style="padding: 20px; background: rgba(224,224,224,0.05); border-radius: 20px;">
                    ${techniques[techniqueKey] || '<p>Техника загружается...</p>'}
                </div>
            </div>
        `;
    }
};

window.startReimprinting = () => {
    reimprintingStep = 1;
    reimprintingData = {};
    showReimprintingScreen();
};

function showReimprintingScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const steps = {
        1: `
            <h3>🔄 Реимпринтинг — шаг 1 из 5</h3>
            <p>Какая ситуация из детства до сих пор влияет на вас?</p>
            <textarea id="situation" placeholder="Опишите ситуацию... Например: «Меня наказали за ошибку, и я решил, что ошибаться нельзя»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 100px;"></textarea>
            <button class="anchor-btn fire-btn" style="margin-top: 20px;" onclick="reimprintingNext()">Далее →</button>
        `,
        2: `
            <h3>🔄 Реимпринтинг — шаг 2 из 5</h3>
            <p>Какое решение вы тогда приняли? Какой импринт сформировался?</p>
            <textarea id="decision" placeholder="Например: «Я решил, что должен быть идеальным, чтобы меня любили»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 100px;"></textarea>
            <button class="anchor-btn fire-btn" style="margin-top: 20px;" onclick="reimprintingNext()">Далее →</button>
        `,
        3: `
            <h3>🔄 Реимпринтинг — шаг 3 из 5</h3>
            <p>Представьте, что вы — взрослый, мудрый, ресурсный. Войдите в это состояние.</p>
            <p style="color: var(--text-secondary);">Сделайте глубокий вдох... Почувствуйте свою силу... Теперь вы можете помочь тому ребёнку.</p>
            <button class="anchor-btn fire-btn" style="margin-top: 20px;" onclick="reimprintingNext()">Я вошёл в ресурс →</button>
        `,
        4: `
            <h3>🔄 Реимпринтинг — шаг 4 из 5</h3>
            <p>Что бы вы сказали тому ребёнку? Какую поддержку дали бы?</p>
            <textarea id="newMessage" placeholder="Напишите новое послание себе-ребёнку..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; min-height: 100px;"></textarea>
            <button class="anchor-btn fire-btn" style="margin-top: 20px;" onclick="reimprintingNext()">Переписать импринт →</button>
        `,
        5: `
            <h3>🔄 Реимпринтинг — шаг 5 из 5</h3>
            <p>Закрепите новое состояние якорем.</p>
            <p>Придумайте триггер (жест, фразу), который будет напоминать вам о новом решении.</p>
            <input type="text" id="newAnchor" placeholder="Например: рука на сердце + «Я имею право ошибаться»" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin: 16px 0;">
            <button class="anchor-btn fire-btn" onclick="reimprintingComplete()">✅ Завершить и сохранить якорь</button>
        `
    };
    
    container.innerHTML = `
        <div class="anchors-container">
            <div class="anchors-header">
                <button class="back-btn" onclick="showAnchors()">◀️ НАЗАД</button>
                <h1 class="anchors-title">📚 Реимпринтинг</h1>
            </div>
            <div style="background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px;">
                ${steps[reimprintingStep]}
            </div>
            <div class="progress-bar" style="margin-top: 20px;">
                <div class="progress-fill" style="width: ${(reimprintingStep / 5) * 100}%"></div>
            </div>
        </div>
    `;
}

window.reimprintingNext = () => {
    const situation = document.getElementById('situation');
    const decision = document.getElementById('decision');
    const newMessage = document.getElementById('newMessage');
    
    if (situation) reimprintingData.situation = situation.value;
    if (decision) reimprintingData.decision = decision.value;
    if (newMessage) reimprintingData.newMessage = newMessage.value;
    
    reimprintingStep++;
    showReimprintingScreen();
};

window.reimprintingComplete = async () => {
    const newAnchor = document.getElementById('newAnchor');
    if (newAnchor) reimprintingData.newAnchor = newAnchor.value;
    
    const anchorToSave = {
        user_id: CONFIG.USER_ID,
        name: `Реимпринтинг: ${reimprintingData.newAnchor?.substring(0, 30) || 'Новое решение'}`,
        state: 'love',
        source: 'reimprinting',
        source_detail: JSON.stringify(reimprintingData),
        modality: 'auditory',
        trigger: reimprintingData.newAnchor || 'Я переписал свой импринт',
        phrase: reimprintingData.newAnchor || 'Я переписал свой импринт',
        icon: '🔄',
        state_icon: '💖',
        state_name: 'Реимпринтинг'
    };
    
    const success = await saveAnchor(anchorToSave);
    if (success) {
        showToast('✅ Импринт переписан! Новый якорь создан.', 'success');
        reimprintingStep = 0;
        reimprintingData = {};
        currentAnchorView = 'list';
        await loadUserAnchors();
        showAnchors();
    } else {
        showToast('❌ Ошибка сохранения', 'error');
    }
};

window.constructorSelectSource = (source) => {
    const container = document.getElementById('constructorContent');
    if (!container) return;
    
    const sourceContent = {
        movie: `
            <div style="margin-top: 20px;">
                <h3>🎬 Выберите фильм или сцену</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMovie('gladiator')">
                        <div>🎬 Гладиатор — сцена перед битвой</div>
                        <div style="font-size: 12px;">Уверенность, сила, победа</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMovie('amelie')">
                        <div>🎬 Амели — момент радости</div>
                        <div style="font-size: 12px;">Радость, лёгкость, вдохновение</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMovie('matrix')">
                        <div>🎬 Матрица — «Я знаю кунг-фу»</div>
                        <div style="font-size: 12px;">Фокус, уверенность, спокойствие</div>
                    </div>
                </div>
                <input type="text" id="customMovie" placeholder="Или напишите свой фильм/сцену..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;">
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMovie()">Использовать этот источник</button>
            </div>
        `,
        music: `
            <div style="margin-top: 20px;">
                <h3>🎵 Выберите музыку</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMusic('hans')">
                        <div>🎵 Hans Zimmer — Time</div>
                        <div style="font-size: 12px;">Величие, спокойствие, глубина</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMusic('energetic')">
                        <div>🎵 Epic orchestral</div>
                        <div style="font-size: 12px;">Энергия, подъём, действие</div>
                    </div>
                </div>
                <input type="text" id="customMusic" placeholder="Или напишите свой трек..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;">
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMusic()">Использовать этот источник</button>
            </div>
        `,
        metaphor: `
            <div style="margin-top: 20px;">
                <h3>📖 Выберите метафору</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseMetaphor('rock')">
                        <div>🗻 «Я — скала, которую не может сдвинуть ветер»</div>
                        <div style="font-size: 12px;">Спокойствие, устойчивость</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseMetaphor('ocean')">
                        <div>🌊 «Я — океан, могучий и глубокий»</div>
                        <div style="font-size: 12px;">Сила, спокойствие</div>
                    </div>
                </div>
                <textarea id="customMetaphor" placeholder="Или напишите свою метафору..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;"></textarea>
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromMetaphor()">Использовать эту метафору</button>
            </div>
        `,
        body: `
            <div style="margin-top: 20px;">
                <h3>🧘 Телесная практика</h3>
                <div class="wizard-options">
                    <div class="wizard-option" onclick="constructorUseBody('breath')">
                        <div>🌬️ Дыхание: вдох 4 — задержка 4 — выдох 6</div>
                        <div style="font-size: 12px;">Спокойствие, расслабление</div>
                    </div>
                    <div class="wizard-option" onclick="constructorUseBody('posture')">
                        <div>🧍 Поза супермена: руки в боки, плечи назад</div>
                        <div style="font-size: 12px;">Уверенность, сила</div>
                    </div>
                </div>
                <textarea id="customBody" placeholder="Опишите свою телесную практику..." style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px;"></textarea>
                <button class="anchor-btn fire-btn" style="margin-top: 16px;" onclick="constructorCreateFromBody()">Использовать эту практику</button>
            </div>
        `
    };
    
    container.innerHTML = sourceContent[source] || '<p>Выберите источник</p>';
};

window.constructorCreateFromMovie = () => {
    const custom = document.getElementById('customMovie')?.value;
    const source = custom || 'Гладиатор — сцена перед битвой';
    anchorWizardData = {
        state: 'confidence',
        source: 'movie',
        sourceDetail: source,
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchors();
};

window.constructorCreateFromMusic = () => {
    const custom = document.getElementById('customMusic')?.value;
    const source = custom || 'Hans Zimmer — Time';
    anchorWizardData = {
        state: 'calm',
        source: 'music',
        sourceDetail: source,
        modality: 'auditory'
    };
    anchorWizardStep = 2;
    showAnchors();
};

window.constructorCreateFromMetaphor = () => {
    const custom = document.getElementById('customMetaphor')?.value;
    const source = custom || 'Я — скала';
    anchorWizardData = {
        state: 'calm',
        source: 'metaphor',
        sourceDetail: source,
        modality: 'visual'
    };
    anchorWizardStep = 2;
    showAnchors();
};

window.constructorCreateFromBody = () => {
    const custom = document.getElementById('customBody')?.value;
    const source = custom || 'Дыхание 4-4-6';
    anchorWizardData = {
        state: 'calm',
        source: 'body',
        sourceDetail: source,
        modality: 'kinesthetic'
    };
    anchorWizardStep = 2;
    showAnchors();
};

window.startImprintDiagnostic = () => {
    showToast('🔍 Диагностика импринтов — в разработке', 'info');
};

// ============================================
// ЭКСПОРТ
// ============================================

window.showAnchors = showAnchors;
window.anchorWizardSelectState = anchorWizardSelectState;
window.anchorWizardSelectSource = anchorWizardSelectSource;
window.anchorWizardSelectModality = anchorWizardSelectModality;
window.anchorWizardSaveTrigger = anchorWizardSaveTrigger;
window.anchorWizardNext = anchorWizardNext;
window.anchorWizardComplete = anchorWizardComplete;
window.anchorWizardReset = anchorWizardReset;
window.fireAnchor = fireAnchor;
window.deleteAnchorConfirm = deleteAnchorConfirm;
window.quickCreateAnchor = quickCreateAnchor;
window.showTechnique = showTechnique;
window.startReimprinting = startReimprinting;
window.reimprintingNext = reimprintingNext;
window.reimprintingComplete = reimprintingComplete;
window.constructorSelectSource = constructorSelectSource;
window.startImprintDiagnostic = startImprintDiagnostic;

console.log('✅ Anchors module loaded');
