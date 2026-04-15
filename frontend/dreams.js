// ============================================
// dreams.js — Интерпретация снов через AI
// Версия: 2.0
// ============================================

let currentDreamText = '';
let dreamHistory = [];
let needsClarification = false;
let clarificationSessionId = null;

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================

async function showDreamsScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const completed = await isTestCompleted();
    await loadDreamHistory();

    container.innerHTML = `
        <div class="dreams-container">
            <div class="dreams-header">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <h1 class="dreams-title">🌙 Толкование снов</h1>
            </div>
            
            <div class="dreams-tabs">
                <button class="dreams-tab active" data-tab="record">🎙️ Рассказать сон</button>
                <button class="dreams-tab" data-tab="history">📜 История</button>
            </div>
            
            <div class="dreams-content">
                ${renderDreamsTab(completed)}
            </div>
        </div>
        
        <style>
            .dreams-container { padding: 20px; max-width: 700px; margin: 0 auto; }
            .dreams-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
            .dreams-title { font-size: 28px; font-weight: 700; margin: 0; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .dreams-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid rgba(224,224,224,0.1); padding-bottom: 12px; }
            .dreams-tab { background: transparent; border: none; padding: 8px 20px; border-radius: 30px; color: var(--text-secondary); cursor: pointer; font-size: 14px; transition: all 0.2s; }
            .dreams-tab.active { background: linear-gradient(135deg, #6366f1, #a855f7); color: white; }
            
            .dream-record-card { background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.05)); border-radius: 24px; padding: 32px; text-align: center; }
            .dream-voice-btn { width: 100px; height: 100px; border-radius: 50px; background: linear-gradient(135deg, #6366f1, #a855f7); border: none; cursor: pointer; margin: 20px auto; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
            .dream-voice-btn:active { transform: scale(0.95); }
            .dream-voice-btn.recording { animation: dreamPulse 1.5s infinite; background: linear-gradient(135deg, #ef4444, #f97316); }
            @keyframes dreamPulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
            .dream-textarea { width: 100%; padding: 16px; border-radius: 20px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; font-family: inherit; font-size: 15px; min-height: 150px; resize: vertical; margin: 20px 0; }
            .dream-btn { padding: 14px 28px; border-radius: 40px; border: none; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: linear-gradient(135deg, #6366f1, #a855f7); color: white; }
            .dream-btn-secondary { background: rgba(224,224,224,0.1); color: var(--text-primary); }
            
            .interpretation-card { background: rgba(224,224,224,0.05); border-radius: 20px; padding: 24px; margin-top: 24px; border-left: 4px solid #a855f7; }
            .interpretation-text { line-height: 1.7; color: var(--text-secondary); margin-bottom: 20px; font-size: 15px; white-space: pre-wrap; }
            .interpretation-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
            .interpretation-btn { background: rgba(168,85,247,0.2); border: none; padding: 8px 16px; border-radius: 30px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
            .interpretation-btn:hover { background: rgba(168,85,247,0.4); }
            
            .clarification-card { background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.08)); border-radius: 20px; padding: 24px; margin-top: 20px; text-align: left; }
            .clarification-question { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #a855f7; }
            .clarification-buttons { display: flex; gap: 12px; margin-top: 16px; }
            .clarification-btn { background: rgba(168,85,247,0.3); border: 1px solid rgba(168,85,247,0.5); padding: 10px 20px; border-radius: 30px; cursor: pointer; }
            .clarification-textarea { width: 100%; padding: 12px; border-radius: 16px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); color: white; margin-top: 12px; font-family: inherit; resize: vertical; }
            
            .dream-history-item { background: rgba(224,224,224,0.03); border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
            .dream-history-item:hover { background: rgba(224,224,224,0.08); transform: translateX(4px); }
            .dream-date { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
            .dream-preview { font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            
            .dream-loading { text-align: center; padding: 40px; }
            .dream-spinner { font-size: 48px; animation: dreamSpin 1s linear infinite; display: inline-block; }
            @keyframes dreamSpin { to { transform: rotate(360deg); } }
        </style>
    `;

    document.getElementById('backBtn').onclick = () => renderDashboard();
    
    document.querySelectorAll('.dreams-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.dreams-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const contentDiv = document.querySelector('.dreams-content');
            if (contentDiv) {
                if (tabName === 'record') {
                    contentDiv.innerHTML = renderDreamsTab(completed);
                    initDreamVoiceButton();
                    initDreamButtons();
                } else if (tabName === 'history') {
                    contentDiv.innerHTML = renderDreamHistoryTab();
                }
            }
        });
    });
    
    if (completed) {
        initDreamVoiceButton();
        initDreamButtons();
    }
}

function renderDreamsTab(completed) {
    if (!completed) {
        return `
            <div class="dream-record-card">
                <div style="font-size: 64px; margin-bottom: 16px;">🌙</div>
                <h3>Для толкования снов нужен ваш психологический профиль</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Пройдите тест, чтобы Фреди мог давать персонализированные толкования</p>
                <button class="dream-btn" onclick="startTest()">📊 Пройти тест</button>
            </div>
        `;
    }
    
    if (needsClarification) {
        return `
            <div class="dream-record-card">
                <div style="font-size: 48px; margin-bottom: 8px;">🤔</div>
                <h2>Уточняющий вопрос</h2>
                <div class="clarification-card">
                    <div class="clarification-question" id="clarificationQuestion">Загрузка...</div>
                    <textarea id="clarificationAnswer" class="clarification-textarea" rows="3" placeholder="Напишите свой ответ здесь..."></textarea>
                    <div class="clarification-buttons">
                        <button class="dream-btn" id="submitClarificationBtn">📤 Ответить</button>
                        <button class="dream-btn dream-btn-secondary" id="skipClarificationBtn">⏭️ Пропустить</button>
                    </div>
                </div>
            </div>
            <div id="interpretationResult"></div>
        `;
    }
    
    return `
        <div class="dream-record-card">
            <div style="font-size: 48px; margin-bottom: 8px;">🌙</div>
            <h2>Расскажите свой сон</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Нажмите и удерживайте кнопку, чтобы надиктовать сон голосом, или напишите его ниже</p>
            
            <button class="dream-voice-btn" id="dreamVoiceBtn">
                <span class="dream-voice-icon" style="font-size: 48px;">🎤</span>
            </button>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">Нажмите и удерживайте для записи</div>
            
            <textarea id="dreamTextInput" class="dream-textarea" placeholder="Опишите ваш сон максимально подробно...&#10;&#10;Что происходило?&#10;Кто был во сне?&#10;Какие были эмоции?&#10;Какие цвета, звуки, запахи?">${currentDreamText || ''}</textarea>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="dream-btn" id="interpretDreamBtn">🔮 Толковать сон</button>
                <button class="dream-btn dream-btn-secondary" id="clearDreamBtn">🗑️ Очистить</button>
            </div>
        </div>
        <div id="interpretationResult"></div>
    `;
}

function renderDreamHistoryTab() {
    if (dreamHistory.length === 0) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📜</div>
                <h3>У вас пока нет сохранённых снов</h3>
                <p style="color: var(--text-secondary);">Расскажите свой первый сон на вкладке «Рассказать сон»</p>
            </div>
        `;
    }
    
    return `
        <div class="dream-history-list">
            ${dreamHistory.map((dream, index) => `
                <div class="dream-history-item" onclick="viewDreamDetails(${index})">
                    <div class="dream-date">${dream.date}</div>
                    <div class="dream-preview">${dream.text.substring(0, 100)}${dream.text.length > 100 ? '...' : ''}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// ГОЛОСОВАЯ ЗАПИСЬ
// ============================================

function initDreamVoiceButton() {
    const voiceBtn = document.getElementById('dreamVoiceBtn');
    if (!voiceBtn) return;
    if (voiceBtn._dreamVoiceInited) return;
    voiceBtn._dreamVoiceInited = true;
    
    let pressTimer = null;
    let isRecording = false;
    let activeTouchId = null;
    
    const getIcon = () => voiceBtn.querySelector('.dream-voice-icon');
    
    const resetBtn = () => {
        voiceBtn.style.transform = '';
        voiceBtn.style.opacity = '';
        voiceBtn.classList.remove('recording');
        const icon = getIcon();
        if (icon) icon.textContent = '🎤';
    };
    
    const onPressStart = (e) => {
        e.preventDefault();
        if (pressTimer || isRecording) return;
        activeTouchId = e.touches ? e.touches[0].identifier : -1;
        voiceBtn.style.transform = 'scale(0.97)';
        voiceBtn.style.opacity = '0.75';
        
        pressTimer = setTimeout(async () => {
            pressTimer = null;
            resetBtn();
            voiceBtn.classList.add('recording');
            const icon = getIcon();
            if (icon) icon.textContent = '⏹️';
            isRecording = true;
            
            if (window.voiceManager) {
                const oldOnTranscript = window.voiceManager.onTranscript;
                window.voiceManager.onTranscript = (text) => {
                    const input = document.getElementById('dreamTextInput');
                    if (input) {
                        const current = input.value;
                        input.value = current ? current + '\n' + text : text;
                        currentDreamText = input.value;
                    }
                    if (oldOnTranscript) oldOnTranscript(text);
                };
                
                await window.voiceManager.startRecording();
                
                setTimeout(() => {
                    if (window.voiceManager) {
                        window.voiceManager.onTranscript = oldOnTranscript;
                    }
                }, 1000);
            }
        }, 400);
    };
    
    const onPressEnd = (e) => {
        if (e.changedTouches) {
            const ours = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId);
            if (!ours && activeTouchId !== -1) return;
        }
        activeTouchId = null;
        
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            resetBtn();
            return;
        }
        
        if (isRecording && window.voiceManager) {
            window.voiceManager.stopRecording();
        }
        isRecording = false;
        resetBtn();
    };
    
    voiceBtn.addEventListener('mousedown', onPressStart);
    voiceBtn.addEventListener('mouseup', onPressEnd);
    voiceBtn.addEventListener('mouseleave', onPressEnd);
    voiceBtn.addEventListener('touchstart', onPressStart, { passive: false });
    voiceBtn.addEventListener('touchend', onPressEnd, { passive: false });
    voiceBtn.addEventListener('touchcancel', onPressEnd);
}

function initDreamButtons() {
    document.getElementById('interpretDreamBtn')?.addEventListener('click', () => interpretDream());
    document.getElementById('clearDreamBtn')?.addEventListener('click', () => {
        const input = document.getElementById('dreamTextInput');
        if (input) {
            input.value = '';
            currentDreamText = '';
        }
    });
    document.getElementById('submitClarificationBtn')?.addEventListener('click', () => submitClarification());
    document.getElementById('skipClarificationBtn')?.addEventListener('click', () => {
        needsClarification = false;
        showDreamsScreen();
    });
}

// ============================================
// ОСНОВНАЯ ЛОГИКА ИНТЕРПРЕТАЦИИ
// ============================================

async function interpretDream() {
    const input = document.getElementById('dreamTextInput');
    const dreamText = input?.value.trim();
    
    if (!dreamText) {
        showToast('🌙 Расскажите свой сон сначала', 'error');
        return;
    }
    
    currentDreamText = dreamText;
    
    const resultDiv = document.getElementById('interpretationResult');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="dream-loading">
                <div class="dream-spinner">🌙</div>
                <div>Фреди анализирует ваш сон...</div>
            </div>
        `;
    }
    
    try {
        // Получаем полный профиль пользователя
        const status = await getUserStatus();
        const profileData = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        
        // Отправляем запрос на интерпретацию с полным контекстом
        const response = await apiCall('/api/dreams/interpret', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                dream_text: dreamText,
                user_name: CONFIG.USER_NAME,
                profile_code: status.profile_code,
                perception_type: profileData.profile?.perception_type,
                thinking_level: profileData.profile?.thinking_level,
                vectors: status.vectors,
                key_characteristic: profileData.profile?.key_characteristic,
                main_trap: profileData.profile?.main_trap
            })
        });
        
        if (response.needs_clarification) {
            needsClarification = true;
            clarificationSessionId = response.session_id;
            showDreamsScreen();
            
            const questionDiv = document.getElementById('clarificationQuestion');
            if (questionDiv) {
                questionDiv.textContent = response.question;
            }
        } else {
            if (resultDiv) {
                resultDiv.innerHTML = renderInterpretation(response.interpretation);
                
                // 🎙️ АВТОМАТИЧЕСКОЕ ОЗВУЧИВАНИЕ
                if (window.voiceManager && response.interpretation) {
                    await window.voiceManager.textToSpeech(response.interpretation, 'psychologist');
                }
            }
            
            // Сохраняем в историю
            await saveDreamToHistory(dreamText, response.interpretation);
        }
        
    } catch (error) {
        console.error('Interpretation error:', error);
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="interpretation-card">
                    <div class="interpretation-text">😔 Не удалось получить толкование. Попробуйте ещё раз.</div>
                </div>
            `;
        }
        showToast('Ошибка получения толкования', 'error');
    }
}

async function submitClarification() {
    const answer = document.getElementById('clarificationAnswer')?.value.trim();
    
    if (!answer) {
        showToast('Напишите ответ на вопрос', 'error');
        return;
    }
    
    const resultDiv = document.getElementById('interpretationResult');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="dream-loading">
                <div class="dream-spinner">🌙</div>
                <div>Фреди уточняет толкование...</div>
            </div>
        `;
    }
    
    try {
        const status = await getUserStatus();
        const profileData = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        
        const response = await apiCall('/api/dreams/clarify', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                session_id: clarificationSessionId,
                answer: answer,
                user_name: CONFIG.USER_NAME,
                profile_code: status.profile_code,
                vectors: status.vectors
            })
        });
        
        needsClarification = false;
        
        if (resultDiv) {
            resultDiv.innerHTML = renderInterpretation(response.interpretation);
            
            if (window.voiceManager && response.interpretation) {
                await window.voiceManager.textToSpeech(response.interpretation, 'psychologist');
            }
        }
        
        await saveDreamToHistory(currentDreamText, response.interpretation);
        
    } catch (error) {
        console.error('Clarification error:', error);
        showToast('Ошибка при уточнении', 'error');
    }
}

function renderInterpretation(text) {
    // Форматируем текст — заменяем переносы на <br>
    const formatted = text.replace(/\n/g, '<br>');
    
    return `
        <div class="interpretation-card">
            <div class="interpretation-text">${formatted}</div>
            <div class="interpretation-actions">
                <button class="interpretation-btn" onclick="speakInterpretation()">🔊 Озвучить ещё раз</button>
                <button class="interpretation-btn" onclick="saveDreamToJournal()">💾 Сохранить</button>
            </div>
        </div>
    `;
}

async function speakInterpretation() {
    const resultDiv = document.getElementById('interpretationResult');
    const textDiv = resultDiv?.querySelector('.interpretation-text');
    if (textDiv && window.voiceManager) {
        const plainText = textDiv.textContent || textDiv.innerText;
        await window.voiceManager.textToSpeech(plainText, 'psychologist');
    }
}

// ============================================
// ИСТОРИЯ
// ============================================

async function loadDreamHistory() {
    try {
        const data = await apiCall(`/api/dreams/history/${CONFIG.USER_ID}`);
        dreamHistory = data.dreams || [];
    } catch {
        const saved = localStorage.getItem(`dreams_history_${CONFIG.USER_ID}`);
        dreamHistory = saved ? JSON.parse(saved) : [];
    }
}

async function saveDreamToHistory(dreamText, interpretation) {
    const newDream = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        time: new Date().toLocaleTimeString('ru-RU'),
        text: dreamText,
        interpretation: interpretation
    };
    
    dreamHistory.unshift(newDream);
    if (dreamHistory.length > 20) dreamHistory.pop();
    
    localStorage.setItem(`dreams_history_${CONFIG.USER_ID}`, JSON.stringify(dreamHistory));
    
    try {
        await apiCall('/api/dreams/save', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                dream: newDream
            })
        });
    } catch (e) {
        console.warn('Failed to save to backend:', e);
    }
}

function viewDreamDetails(index) {
    const dream = dreamHistory[index];
    if (!dream) return;
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    const formattedInterpretation = dream.interpretation.replace(/\n/g, '<br>');
    
    container.innerHTML = `
        <div class="dreams-container">
            <div class="dreams-header">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <h1 class="dreams-title">🌙 ${dream.date}</h1>
            </div>
            
            <div class="dream-record-card" style="text-align: left;">
                <h3>Ваш сон:</h3>
                <div class="dream-textarea" style="background: rgba(224,224,224,0.03); min-height: auto;">${dream.text}</div>
                
                <h3 style="margin-top: 20px;">Толкование Фреди:</h3>
                <div class="interpretation-card" style="margin-top: 0;">
                    <div class="interpretation-text">${formattedInterpretation}</div>
                    <div class="interpretation-actions">
                        <button class="interpretation-btn" onclick="speakText('${dream.interpretation.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">🔊 Озвучить</button>
                    </div>
                </div>
                
                <button class="dream-btn" style="margin-top: 20px; width: 100%;" onclick="showDreamsScreen()">← К списку снов</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => showDreamsScreen();
}

function speakText(text) {
    if (window.voiceManager) {
        window.voiceManager.textToSpeech(text, 'psychologist');
    }
}

function saveDreamToJournal() {
    showToast('💾 Сон сохранён в дневник', 'success');
}

// ============================================
// ЭКСПОРТ
// ============================================

window.showDreamsScreen = showDreamsScreen;
window.interpretDream = interpretDream;
window.speakInterpretation = speakInterpretation;
window.viewDreamDetails = viewDreamDetails;
window.speakText = speakText;
window.saveDreamToJournal = saveDreamToJournal;

console.log('✅ dreams.js loaded');
