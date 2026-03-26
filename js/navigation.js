// ========== НАВИГАЦИЯ ==========

function navigateBack() {
    if (navigationHistory.length > 0) {
        const last = navigationHistory.pop();
        if (last.screen === 'dashboard') {
            renderDashboard();
        } else {
            navigateTo(last.screen, last.params);
        }
    } else {
        renderDashboard();
    }
}

function navigateTo(screen, params = {}) {
    navigationHistory.push({ screen, params });
    
    switch(screen) {
        case 'confinement-model':
            showConfinementModel();
            break;
        case 'confinement-loops':
            showConfinementLoops(params);
            break;
        case 'intervention':
            showIntervention(params);
            break;
        case 'practices':
            showPractices();
            break;
        case 'hypnosis':
            showHypnosis();
            break;
        case 'tales':
            showTales();
            break;
        case 'anchors':
            showAnchors();
            break;
        case 'statistics':
            showStatistics();
            break;
        case 'profile':
            showFullContentScreen('🧠 Психологический портрет', params.content, 'profile');
            break;
        case 'thoughts':
            showFullContentScreen('💭 Мысли психолога', params.content, 'thoughts');
            break;
        case 'weekend':
            showFullContentScreen('🎨 Идеи на выходные', params.content, 'weekend');
            break;
        case 'goals':
            showFullContentScreen('🎯 Ваши цели', params.content, 'goals');
            break;
        case 'questions':
            showFullContentScreen('❓ Вопросы для размышления', params.content, 'questions');
            break;
        case 'challenges':
            showFullContentScreen('🏆 Челленджи', params.content, 'challenges');
            break;
        case 'doubles':
            showFullContentScreen('👥 Психометрические двойники', params.content, 'doubles');
            break;
        default:
            renderDashboard();
    }
}

function formatContentForDisplay(text) {
    if (!text) return '<p>Нет данных</p>';
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const headerEmojis = '🔑💪🎯🌱⚠️🔐🔄🚪📊🧠💭💕🕊️✨🏆👥🎨';
    const headerRegex = new RegExp(`([${headerEmojis}])\\s*\\*\\*(.*?)\\*\\*`, 'g');
    formatted = formatted.replace(headerRegex, 
        '<div class="section-header"><span class="section-emoji">$1</span><strong class="section-title">$2</strong></div>');
    formatted = formatted.replace(/•\s*(.*?)(?=\n|$)/g, '<li>$1</li>');
    const paragraphs = formatted.split('\n\n');
    formatted = paragraphs.map(p => {
        if (p.trim().startsWith('<li>')) return `<ul class="styled-list">${p}</ul>`;
        if (p.trim().startsWith('<div class="section-header')) return p;
        return `<p>${p}</p>`;
    }).join('');
    return formatted;
}

function showFullContentScreen(title, content, contentType, rawText = null) {
    const container = document.getElementById('screenContainer');
    
    const emojiMap = {
        profile: '🧠',
        thoughts: '💭',
        goals: '🎯',
        questions: '❓',
        challenges: '🏆',
        doubles: '👥',
        weekend: '🎨',
        confinement: '🔐',
        practices: '🧘',
        hypnosis: '🌙',
        tales: '📚',
        anchors: '⚓',
        statistics: '📊'
    };
    
    const formattedContent = typeof content === 'string' ? formatContentForDisplay(content) : content;
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">${emojiMap[contentType] || '📄'}</div>
                <h1 class="content-title">${title}</h1>
            </div>
            <div class="content-body" id="contentBody">
                ${formattedContent}
            </div>
            <button class="action-btn primary-btn" id="speakBtn" style="margin-top: 20px;">🔊 Озвучить</button>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakBtn').onclick = async () => {
        const textToSpeak = rawText || (typeof content === 'string' ? content.replace(/\*\*(.*?)\*\*/g, '$1') : '');
        showToast('Озвучиваю...', 'info');
        const tts = await textToSpeech(textToSpeak, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    };
}

// ========== ДАШБОРД ==========

function renderDashboard() {
    const container = document.getElementById('screenContainer');
    const modeConfig = MODES[currentMode];
    const modules = MODULES[currentMode];
    
    container.innerHTML = `
        <div class="dashboard-container">
            <div class="hero-section">
                <div class="user-greeting">
                    <div class="greeting-text">
                        <h2>${modeConfig.emoji} ${modeConfig.greeting}</h2>
                        <p>${CONFIG.USER_NAME}, я здесь, чтобы помочь</p>
                    </div>
                    <div class="profile-badge">
                        <div class="profile-code" id="profileCode">${CONFIG.PROFILE_CODE}</div>
                        <div style="font-size: 10px;">ваш психотип</div>
                    </div>
                </div>
            </div>
            
            <div class="mode-selector">
                <button class="mode-btn ${currentMode === 'coach' ? 'active coach' : ''}" data-mode="coach">🔮 КОУЧ</button>
                <button class="mode-btn ${currentMode === 'psychologist' ? 'active psychologist' : ''}" data-mode="psychologist">🧠 ПСИХОЛОГ</button>
                <button class="mode-btn ${currentMode === 'trainer' ? 'active trainer' : ''}" data-mode="trainer">⚡ ТРЕНЕР</button>
            </div>
            
            <div class="voice-section">
                <div class="voice-card">
                    <button class="voice-record-btn-premium" id="mainVoiceBtn">
                        <span class="voice-icon">🎤</span>
                        <span class="voice-text">${modeConfig.voicePrompt}</span>
                    </button>
                    <div class="voice-hint" style="text-align: center; font-size: 11px; color: var(--text-secondary); margin-top: 8px;">🎙️ Нажмите и удерживайте для записи (до 60 сек)</div>
                </div>
            </div>
            
            <div class="swipe-indicator" id="swipeIndicator" style="display: none;">
                ↑ Свайпните вверх для просмотра ↑
            </div>
            
            <div class="modules-grid">
                ${modules.map(module => `
                    <div class="module-card" data-module="${module.id}">
                        <div class="module-icon">${module.icon}</div>
                        <div class="module-name">${module.name}</div>
                        <div class="module-desc">${module.desc}</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="quick-actions">
                <div class="quick-actions-title">⚡ Быстрые действия</div>
                <div class="quick-actions-grid">
                    <div class="quick-action" data-action="profile"><div class="action-icon">🧠</div><div class="action-name">Мой портрет</div></div>
                    <div class="quick-action" data-action="thoughts"><div class="action-icon">💭</div><div class="action-name">Мысли психолога</div></div>
                    <div class="quick-action" data-action="newThought"><div class="action-icon">✨</div><div class="action-name">Свежая мысль</div></div>
                    <div class="quick-action" data-action="weekend"><div class="action-icon">🎨</div><div class="action-name">Идеи на выходные</div></div>
                    <div class="quick-action" data-action="goals"><div class="action-icon">🎯</div><div class="action-name">Цели</div></div>
                    <div class="quick-action" data-action="questions"><div class="action-icon">❓</div><div class="action-name">Вопросы</div></div>
                    <div class="quick-action" data-action="challenges"><div class="action-icon">🏆</div><div class="action-name">Челленджи</div></div>
                    <div class="quick-action" data-action="doubles"><div class="action-icon">👥</div><div class="action-name">Двойники</div></div>
                </div>
            </div>
            
            <div class="expandable-section">
                <div class="expandable-header" id="expandableHeader">
                    <span>🔧 РАСШИРЕННЫЕ ФУНКЦИИ</span>
                    <span>▼</span>
                </div>
                <div class="expandable-content" id="expandableContent">
                    <div class="quick-actions-grid" style="margin-top: 12px;">
                        <div class="quick-action" data-action="confinement"><div class="action-icon">🔐</div><div class="action-name">Модель ограничений</div></div>
                        <div class="quick-action" data-action="practices"><div class="action-icon">🧘</div><div class="action-name">Практики</div></div>
                        <div class="quick-action" data-action="hypnosis"><div class="action-icon">🌙</div><div class="action-name">Гипноз</div></div>
                        <div class="quick-action" data-action="tales"><div class="action-icon">📚</div><div class="action-name">Сказки</div></div>
                        <div class="quick-action" data-action="anchors"><div class="action-icon">⚓</div><div class="action-name">Якоря</div></div>
                        <div class="quick-action" data-action="statistics"><div class="action-icon">📊</div><div class="action-name">Статистика</div></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Показываем swipe индикатор только на мобильных
    if (window.innerWidth <= 768) {
        const swipeIndicator = document.getElementById('swipeIndicator');
        if (swipeIndicator) swipeIndicator.style.display = 'block';
    }
    
    initVoiceButton();
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => { const mode = btn.dataset.mode; if (mode) switchMode(mode); });
    });
    
    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => { const name = card.querySelector('.module-name')?.textContent; showToast(`Модуль "${name}" — скоро будет доступен`, 'info'); });
    });
    
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', async () => {
            const actionType = action.dataset.action;
            switch(actionType) {
                case 'profile': await handleShowProfile(); break;
                case 'thoughts': await handleShowThoughts(); break;
                case 'newThought': await handleShowNewThought(); break;
                case 'weekend': await handleShowWeekend(); break;
                case 'goals': await handleShowGoals(); break;
                case 'questions': await handleShowQuestions(); break;
                case 'challenges': await handleShowChallenges(); break;
                case 'doubles': await handleShowDoubles(); break;
                case 'confinement': navigateTo('confinement-model'); break;
                case 'practices': navigateTo('practices'); break;
                case 'hypnosis': navigateTo('hypnosis'); break;
                case 'tales': navigateTo('tales'); break;
                case 'anchors': navigateTo('anchors'); break;
                case 'statistics': navigateTo('statistics'); break;
            }
        });
    });
    
    const expandableHeader = document.getElementById('expandableHeader');
    const expandableContent = document.getElementById('expandableContent');
    if (expandableHeader && expandableContent) {
        expandableHeader.addEventListener('click', () => {
            expandableContent.classList.toggle('open');
            expandableHeader.querySelector('span:last-child').textContent = expandableContent.classList.contains('open') ? '▲' : '▼';
        });
    }
    
    initMobileEnhancements();
}
