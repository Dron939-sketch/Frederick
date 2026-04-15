// ============================================
// dreams.js — Интерпретация снов через AI
// Версия: 2.0
// ============================================

let _drCurrentText = '';
let _drHistory = [];
let _drNeedsClarification = false;
let _drClarificationSessionId = null;
let _drActiveTab = 'record';

// ============================================
// СТИЛИ
// ============================================

function _drInjectStyles() {
    if (document.getElementById('dr-v2-styles')) return;
    const style = document.createElement('style');
    style.id = 'dr-v2-styles';
    style.textContent = `
        .dr-tabs {
            display:flex;gap:4px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);
            border-radius:40px;padding:4px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none;
        }
        .dr-tabs::-webkit-scrollbar{display:none}
        .dr-tab {
            flex-shrink:0;padding:8px 12px;border-radius:30px;border:none;
            background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;
            font-family:inherit;cursor:pointer;transition:background 0.2s;min-height:36px;white-space:nowrap;
        }
        .dr-tab.active{background:rgba(224,224,224,0.14);color:var(--text-primary)}

        .dr-record-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:24px;padding:32px;text-align:center}
        .dr-voice-btn{width:100px;height:100px;border-radius:50px;background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);cursor:pointer;margin:20px auto;display:flex;align-items:center;justify-content:center;transition:transform 0.2s}
        .dr-voice-btn:active{transform:scale(0.95)}
        .dr-voice-btn.recording{animation:drPulse 1.5s infinite;background:rgba(224,224,224,0.25)}
        @keyframes drPulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}

        .dr-textarea{width:100%;padding:16px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);font-family:inherit;font-size:14px;min-height:150px;resize:vertical;margin:20px 0;box-sizing:border-box;line-height:1.6}
        .dr-textarea::placeholder{color:var(--text-secondary)}
        .dr-textarea:focus{outline:none;border-color:rgba(224,224,224,0.35)}

        .dr-btn{padding:13px 24px;border-radius:40px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;
            background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);color:var(--text-primary)}
        .dr-btn-ghost{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.14);color:var(--text-secondary)}

        .dr-interpretation{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin-top:24px}
        .dr-interpretation-text{line-height:1.7;color:var(--text-secondary);margin-bottom:20px;font-size:14px;white-space:pre-wrap}
        .dr-interpretation-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:16px}
        .dr-interpretation-btn{background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.14);padding:8px 16px;border-radius:30px;cursor:pointer;font-size:12px;transition:all 0.2s;font-family:inherit;color:var(--text-secondary)}
        .dr-interpretation-btn:hover{background:rgba(224,224,224,0.16)}

        .dr-clarification{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:24px;margin-top:20px;text-align:left}
        .dr-clarification-q{font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary)}
        .dr-clarification-input{width:100%;padding:12px;border-radius:16px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.2);color:var(--text-primary);margin-top:12px;font-family:inherit;resize:vertical;box-sizing:border-box;font-size:14px}
        .dr-clarification-input:focus{outline:none;border-color:rgba(224,224,224,0.35)}

        .dr-history-item{background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.08);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.2s}
        .dr-history-item:hover{background:rgba(224,224,224,0.08);transform:translateX(4px)}
        .dr-history-date{font-size:11px;color:var(--text-secondary);margin-bottom:8px}
        .dr-history-preview{font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

        .dr-loading{text-align:center;padding:40px}
        .dr-spinner{font-size:48px;animation:drSpin 1s linear infinite;display:inline-block}
        @keyframes drSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================

async function showDreamsScreen() {
    _drInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const completed = await isTestCompleted();
    await _drLoadHistory();

    _drRender(container, completed);
}

function _drRender(container, completed) {
    const TABS = [
        { id: 'record',  label: '🎙️ Рассказать сон' },
        { id: 'history', label: '📜 История' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="dr-tab${_drActiveTab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (_drActiveTab === 'record')  body = _drRenderRecordTab(completed);
    if (_drActiveTab === 'history') body = _drRenderHistoryTab();

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Толкование снов</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Фреди анализирует символику ваших снов</p>
            </div>
            <div class="dr-tabs">${tabsHtml}</div>
            <div id="drBody">${body}</div>
        </div>
    `;

    document.getElementById('drBack').onclick = () => {
        if (typeof renderDashboard === 'function') renderDashboard();
        else location.reload();
    };

    document.querySelectorAll('.dr-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _drActiveTab = btn.dataset.tab;
            _drRender(container, completed);
        });
    });

    if (_drActiveTab === 'record' && completed) {
        _drInitVoiceButton();
        _drInitButtons();
    }
}

// ============================================
// ВКЛАДКИ
// ============================================

function _drRenderRecordTab(completed) {
    if (!completed) {
        return `
            <div class="dr-record-card">
                <div style="font-size: 64px; margin-bottom: 16px;">🌙</div>
                <h3>Для толкования снов нужен ваш психологический профиль</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Пройдите тест, чтобы Фреди мог давать персонализированные толкования</p>
                <button class="dr-btn" onclick="startTest()">📊 Пройти тест</button>
            </div>
        `;
    }

    if (_drNeedsClarification) {
        return `
            <div class="dr-record-card">
                <div style="font-size: 48px; margin-bottom: 8px;">🤔</div>
                <h2>Уточняющий вопрос</h2>
                <div class="dr-clarification">
                    <div class="dr-clarification-q" id="clarificationQuestion">Загрузка...</div>
                    <textarea id="clarificationAnswer" class="dr-clarification-input" rows="3" placeholder="Напишите свой ответ здесь..."></textarea>
                    <div style="display:flex;gap:12px;margin-top:16px">
                        <button class="dr-btn" id="submitClarificationBtn">📤 Ответить</button>
                        <button class="dr-btn dr-btn-ghost" id="skipClarificationBtn">⏭️ Пропустить</button>
                    </div>
                </div>
            </div>
            <div id="interpretationResult"></div>
        `;
    }

    return `
        <div class="dr-record-card">
            <div style="font-size: 48px; margin-bottom: 8px;">🌙</div>
            <h2>Расскажите свой сон</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Нажмите и удерживайте кнопку, чтобы надиктовать сон голосом, или напишите его ниже</p>

            <button class="dr-voice-btn" id="dreamVoiceBtn">
                <span class="dr-voice-icon" style="font-size: 48px;">🎤</span>
            </button>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">Нажмите и удерживайте для записи</div>

            <textarea id="dreamTextInput" class="dr-textarea" placeholder="Опишите ваш сон максимально подробно...&#10;&#10;Что происходило?&#10;Кто был во сне?&#10;Какие были эмоции?&#10;Какие цвета, звуки, запахи?">${_drCurrentText || ''}</textarea>

            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="dr-btn" id="interpretDreamBtn">🔮 Толковать сон</button>
                <button class="dr-btn dr-btn-ghost" id="clearDreamBtn">🗑️ Очистить</button>
            </div>
        </div>
        <div id="interpretationResult"></div>
    `;
}

function _drRenderHistoryTab() {
    if (_drHistory.length === 0) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📜</div>
                <h3>У вас пока нет сохранённых снов</h3>
                <p style="color: var(--text-secondary);">Расскажите свой первый сон на вкладке «Рассказать сон»</p>
            </div>
        `;
    }

    return `
        <div>
            ${_drHistory.map((dream, index) => `
                <div class="dr-history-item" onclick="viewDreamDetails(${index})">
                    <div class="dr-history-date">${dream.date}</div>
                    <div class="dr-history-preview">${dream.text.substring(0, 100)}${dream.text.length > 100 ? '...' : ''}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// ГОЛОСОВАЯ ЗАПИСЬ
// ============================================

function _drInitVoiceButton() {
    const voiceBtn = document.getElementById('dreamVoiceBtn');
    if (!voiceBtn || !window.voiceManager) {
        if (voiceBtn) {
            voiceBtn.style.opacity = '0.4';
            voiceBtn.onclick = () => showToast('🎤 Голосовой ввод недоступен', 'info');
        }
        return;
    }
    if (voiceBtn._dreamVoiceInited) return;
    voiceBtn._dreamVoiceInited = true;

    let pressTimer = null;
    let isRecording = false;
    let activeTouchId = null;
    let watchdog = null;
    let savedOnTranscript = null;
    const DELAY = 400;
    const MAX_RECORD = 65000;

    const getIcon = () => voiceBtn.querySelector('.dr-voice-icon');

    const resetBtn = () => {
        voiceBtn.style.transform = '';
        voiceBtn.style.opacity = '';
        voiceBtn.classList.remove('recording');
        const icon = getIcon();
        if (icon) icon.textContent = '🎤';
    };

    const forceStop = (reason) => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        resetBtn();
        activeTouchId = null;
        if (isRecording && window.voiceManager) {
            try { window.voiceManager.stopRecording(); } catch(e) {}
        }
        isRecording = false;
        // Restore original transcript handler
        if (savedOnTranscript !== null && window.voiceManager) {
            window.voiceManager.onTranscript = savedOnTranscript;
            savedOnTranscript = null;
        }
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
            if (navigator.vibrate) navigator.vibrate(60);

            voiceBtn.classList.add('recording');
            const icon = getIcon();
            if (icon) icon.textContent = '⏹️';
            isRecording = true;

            // Override transcript handler to pipe text into textarea
            savedOnTranscript = window.voiceManager.onTranscript;
            window.voiceManager.onTranscript = (text) => {
                const input = document.getElementById('dreamTextInput');
                if (input) {
                    input.value = input.value ? input.value + '\n' + text : text;
                    _drCurrentText = input.value;
                }
            };

            watchdog = setTimeout(() => forceStop('watchdog'), MAX_RECORD);
            const started = await window.voiceManager.startRecording();
            if (!started) {
                forceStop('mic denied');
                showToast('🎤 Нет доступа к микрофону', 'error');
            }
        }, DELAY);
    };

    const onPressEnd = (e) => {
        if (e.type === 'touchcancel') { forceStop('touchcancel'); return; }
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

        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        if (isRecording && window.voiceManager) {
            window.voiceManager.stopRecording();
            // Restore transcript handler after a short delay (let last transcript arrive)
            setTimeout(() => {
                if (savedOnTranscript !== null && window.voiceManager) {
                    window.voiceManager.onTranscript = savedOnTranscript;
                    savedOnTranscript = null;
                }
            }, 2000);
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

function _drInitButtons() {
    document.getElementById('interpretDreamBtn')?.addEventListener('click', () => _drInterpret());
    document.getElementById('clearDreamBtn')?.addEventListener('click', () => {
        const input = document.getElementById('dreamTextInput');
        if (input) { input.value = ''; _drCurrentText = ''; }
    });
    document.getElementById('submitClarificationBtn')?.addEventListener('click', () => _drSubmitClarification());
    document.getElementById('skipClarificationBtn')?.addEventListener('click', () => {
        _drNeedsClarification = false;
        showDreamsScreen();
    });
}

// ============================================
// ИНТЕРПРЕТАЦИЯ
// ============================================

async function _drInterpret() {
    const input = document.getElementById('dreamTextInput');
    const dreamText = input?.value.trim();

    if (!dreamText) {
        showToast('🌙 Расскажите свой сон сначала', 'error');
        return;
    }

    _drCurrentText = dreamText;

    const resultDiv = document.getElementById('interpretationResult');
    if (resultDiv) {
        resultDiv.innerHTML = `<div class="dr-loading"><div class="dr-spinner">🌙</div><div>Фреди анализирует ваш сон...</div></div>`;
    }

    try {
        const status = await getUserStatus();
        const profileData = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);

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
            _drNeedsClarification = true;
            _drClarificationSessionId = response.session_id;
            showDreamsScreen();

            const questionDiv = document.getElementById('clarificationQuestion');
            if (questionDiv) questionDiv.textContent = response.question;
        } else {
            if (resultDiv) {
                resultDiv.innerHTML = _drRenderInterpretation(response.interpretation);
                if (window.voiceManager && response.interpretation) {
                    await window.voiceManager.textToSpeech(response.interpretation, 'psychologist');
                }
            }
            await _drSaveToHistory(dreamText, response.interpretation);
        }
    } catch (error) {
        console.error('Interpretation error:', error);
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="dr-interpretation"><div class="dr-interpretation-text">😔 Не удалось получить толкование. Попробуйте ещё раз.</div></div>`;
        }
        showToast('Ошибка получения толкования', 'error');
    }
}

async function _drSubmitClarification() {
    const answer = document.getElementById('clarificationAnswer')?.value.trim();
    if (!answer) { showToast('Напишите ответ на вопрос', 'error'); return; }

    const resultDiv = document.getElementById('interpretationResult');
    if (resultDiv) {
        resultDiv.innerHTML = `<div class="dr-loading"><div class="dr-spinner">🌙</div><div>Фреди уточняет толкование...</div></div>`;
    }

    try {
        const status = await getUserStatus();

        const response = await apiCall('/api/dreams/clarify', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                session_id: _drClarificationSessionId,
                dream_text: _drCurrentText,
                answer: answer,
                user_name: CONFIG.USER_NAME,
                profile_code: status.profile_code,
                vectors: status.vectors
            })
        });

        _drNeedsClarification = false;

        if (resultDiv) {
            resultDiv.innerHTML = _drRenderInterpretation(response.interpretation);
            if (window.voiceManager && response.interpretation) {
                await window.voiceManager.textToSpeech(response.interpretation, 'psychologist');
            }
        }
        await _drSaveToHistory(_drCurrentText, response.interpretation);
    } catch (error) {
        console.error('Clarification error:', error);
        showToast('Ошибка при уточнении', 'error');
    }
}

function _drRenderInterpretation(text) {
    const formatted = text.replace(/\n/g, '<br>');
    return `
        <div class="dr-interpretation">
            <div class="dr-interpretation-text">${formatted}</div>
            <div class="dr-interpretation-actions">
                <button class="dr-interpretation-btn" onclick="speakInterpretation()">🔊 Озвучить ещё раз</button>
                <button class="dr-interpretation-btn" onclick="saveDreamToJournal()">💾 Сохранить</button>
            </div>
        </div>
    `;
}

async function speakInterpretation() {
    const resultDiv = document.getElementById('interpretationResult');
    const textDiv = resultDiv?.querySelector('.dr-interpretation-text');
    if (textDiv && window.voiceManager) {
        const plainText = textDiv.textContent || textDiv.innerText;
        await window.voiceManager.textToSpeech(plainText, 'psychologist');
    }
}

// ============================================
// ИСТОРИЯ
// ============================================

async function _drLoadHistory() {
    try {
        const data = await apiCall(`/api/dreams/history/${CONFIG.USER_ID}`);
        _drHistory = data.dreams || [];
    } catch {
        const saved = localStorage.getItem(`dreams_history_${CONFIG.USER_ID}`);
        _drHistory = saved ? JSON.parse(saved) : [];
    }
}

async function _drSaveToHistory(dreamText, interpretation) {
    const newDream = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ru-RU'),
        time: new Date().toLocaleTimeString('ru-RU'),
        text: dreamText,
        interpretation: interpretation
    };

    _drHistory.unshift(newDream);
    if (_drHistory.length > 20) _drHistory.pop();

    localStorage.setItem(`dreams_history_${CONFIG.USER_ID}`, JSON.stringify(_drHistory));

    try {
        await apiCall('/api/dreams/save', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID, dream: newDream })
        });
    } catch (e) {
        console.warn('Failed to save to backend:', e);
    }
}

function viewDreamDetails(index) {
    const dream = _drHistory[index];
    if (!dream) return;

    _drInjectStyles();
    const container = document.getElementById('screenContainer');
    if (!container) return;

    const formatted = dream.interpretation.replace(/\n/g, '<br>');

    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="drDetailBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">${dream.date}</h1>
            </div>

            <div class="dr-record-card" style="text-align: left;">
                <h3>Ваш сон:</h3>
                <div style="background:rgba(224,224,224,0.03);border-radius:16px;padding:16px;margin:12px 0;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${dream.text}</div>

                <h3 style="margin-top: 20px;">Толкование Фреди:</h3>
                <div class="dr-interpretation" style="margin-top: 0;">
                    <div class="dr-interpretation-text">${formatted}</div>
                    <div class="dr-interpretation-actions">
                        <button class="dr-interpretation-btn" onclick="speakText('${dream.interpretation.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">🔊 Озвучить</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('drDetailBack').onclick = () => showDreamsScreen();
}

function speakText(text) {
    if (window.voiceManager) window.voiceManager.textToSpeech(text, 'psychologist');
}

function saveDreamToJournal() {
    showToast('💾 Сон сохранён в дневник', 'success');
}

// ============================================
// ЭКСПОРТ
// ============================================

window.showDreamsScreen = showDreamsScreen;
window.viewDreamDetails = viewDreamDetails;
window.speakInterpretation = speakInterpretation;
window.speakText = speakText;
window.saveDreamToJournal = saveDreamToJournal;

console.log('✅ Модуль "Толкование снов" загружен (dreams.js v2.0)');
