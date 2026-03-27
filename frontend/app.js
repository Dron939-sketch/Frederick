// frontend/app.js
// Конфигурация
const CONFIG = {
    API_BASE_URL: window.API_URL || 'https://fredi-backend.onrender.com',
    USER_ID: 213102077,
    USER_NAME: 'Пользователь'
};

// Состояние
let currentMode = 'psychologist';
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let mediaStream = null;
let audioContext = null;
let animationFrame = null;

// DOM элементы
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const audioPlayer = document.getElementById('audioPlayer');

// ============================================
// API ВЫЗОВЫ
// ============================================

async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

// Чат
async function sendMessage(message) {
    try {
        const data = await apiCall('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                message: message,
                mode: currentMode
            })
        });
        
        return data.response;
    } catch (error) {
        console.error('Chat error:', error);
        return 'Извините, произошла ошибка. Попробуйте позже.';
    }
}

// Голос
async function sendVoice(audioBlob) {
    const formData = new FormData();
    formData.append('user_id', CONFIG.USER_ID);
    formData.append('voice', audioBlob, 'voice.webm');
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/voice/process`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Voice error:', error);
        return { success: false, error: error.message };
    }
}

// Сохранение контекста
async function saveContext(context) {
    try {
        await apiCall('/api/save-context', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                context: context
            })
        });
    } catch (error) {
        console.error('Save context error:', error);
    }
}

// Получение профиля
async function getProfile() {
    try {
        const data = await apiCall(`/api/get-profile/${CONFIG.USER_ID}`);
        return data.profile;
    } catch (error) {
        console.error('Get profile error:', error);
        return null;
    }
}

// Получение мыслей психолога
async function getPsychologistThought() {
    try {
        const data = await apiCall(`/api/psychologist-thought/${CONFIG.USER_ID}`);
        return data.thought;
    } catch (error) {
        console.error('Get thought error:', error);
        return null;
    }
}

// ============================================
// UI ФУНКЦИИ
// ============================================

function addMessage(text, sender = 'bot') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot loading';
    loadingDiv.textContent = 'Фреди печатает';
    loadingDiv.id = 'loadingMessage';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideLoading() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `message system ${type}`;
    toast.textContent = message;
    messagesContainer.appendChild(toast);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    setTimeout(() => toast.remove(), 3000);
}

function updateModeUI() {
    const modeConfig = {
        coach: { name: 'КОУЧ', emoji: '🔮', color: '#3b82ff' },
        psychologist: { name: 'ПСИХОЛОГ', emoji: '🧠', color: '#ff6b3b' },
        trainer: { name: 'ТРЕНЕР', emoji: '⚡', color: '#ff3b3b' }
    };
    
    const config = modeConfig[currentMode];
    
    // Обновляем активную кнопку
    document.querySelectorAll('.mode-btn').forEach(btn => {
        if (btn.dataset.mode === currentMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Обновляем голосовую кнопку
    const voiceText = voiceBtn.querySelector('.voice-text');
    if (voiceText) {
        voiceText.textContent = `Нажмите и говорите (${config.name})`;
    }
}

// ============================================
// ГОЛОСОВАЯ ЗАПИСЬ
// ============================================

async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        let message = '❌ Нет доступа к микрофону. ';
        if (error.name === 'NotAllowedError') {
            message += 'Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            message += 'Микрофон не найден.';
        } else {
            message += error.message;
        }
        showToast(message, 'error');
        return false;
    }
}

function stopVisualizer() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (audioContext) {
        audioContext.close().catch(console.warn);
        audioContext = null;
    }
}

async function startRecording() {
    if (isRecording) return;
    
    try {
        if (!window.MediaRecorder) {
            showToast('❌ Ваш браузер не поддерживает запись голоса', 'error');
            return;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        mediaStream = stream;
        
        // Визуализация уровня звука
        if (window.AudioContext) {
            audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            function updateVolume() {
                if (!isRecording) return;
                
                analyser.getByteFrequencyData(dataArray);
                let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                let volume = Math.min(100, (average / 255) * 100);
                
                const intensity = volume / 100;
                voiceBtn.style.boxShadow = `0 0 ${20 + intensity * 30}px rgba(255, 59, 59, ${0.3 + intensity * 0.5})`;
                
                animationFrame = requestAnimationFrame(updateVolume);
            }
            
            updateVolume();
        }
        
        // Выбираем поддерживаемый формат
        let mimeType = '';
        const supportedTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4'];
        for (const type of supportedTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }
        
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            stopVisualizer();
            
            const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
            
            if (audioBlob.size > 5000) {
                voiceBtn.querySelector('.voice-text').textContent = '🔄 Распознаю...';
                voiceBtn.disabled = true;
                
                const result = await sendVoice(audioBlob);
                
                if (result.success) {
                    if (result.recognized_text) {
                        addMessage(`🎤 "${result.recognized_text}"`, 'user');
                    }
                    if (result.answer) {
                        addMessage(result.answer, 'bot');
                        if (result.audio_base64) {
                            playAudio(result.audio_base64);
                        }
                    }
                } else {
                    showToast(`❌ ${result.error || 'Ошибка распознавания'}`, 'error');
                }
                
                voiceBtn.querySelector('.voice-text').textContent = 'Нажмите и говорите';
                voiceBtn.disabled = false;
            } else if (audioBlob.size > 0) {
                showToast('Запись слишком короткая. Поговорите хотя бы 2 секунды.', 'warning');
            }
            
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('.voice-icon').textContent = '🎤';
        };
        
        mediaRecorder.start(1000);
        isRecording = true;
        
        voiceBtn.classList.add('recording');
        voiceBtn.querySelector('.voice-icon').textContent = '⏹️';
        voiceBtn.querySelector('.voice-text').textContent = 'Отпустите для отправки';
        
        // Авто-стоп через 60 секунд
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 60000);
        
    } catch (error) {
        console.error('Recording error:', error);
        isRecording = false;
        stopVisualizer();
        
        let message = '❌ Ошибка записи: ';
        if (error.name === 'NotAllowedError') {
            message += 'Нет разрешения на использование микрофона.';
        } else if (error.name === 'NotFoundError') {
            message += 'Микрофон не найден.';
        } else {
            message += error.message;
        }
        showToast(message, 'error');
        
        voiceBtn.classList.remove('recording');
        voiceBtn.querySelector('.voice-icon').textContent = '🎤';
        voiceBtn.querySelector('.voice-text').textContent = 'Нажмите и говорите';
        
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    }
}

function stopRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function playAudio(base64Audio) {
    const audioData = base64ToArrayBuffer(base64Audio);
    const blob = new Blob([audioData], { type: 'audio/ogg' });
    const url = URL.createObjectURL(blob);
    audioPlayer.src = url;
    audioPlayer.play().catch(e => console.warn('Audio play error:', e));
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

async function handleSendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    
    addMessage(text, 'user');
    messageInput.value = '';
    showLoading();
    
    try {
        const response = await sendMessage(text);
        hideLoading();
        addMessage(response, 'bot');
        
        // Озвучиваем ответ
        const voiceResponse = await apiCall('/api/voice/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ text: response, mode: currentMode })
        });
        if (voiceResponse.audio_base64) {
            playAudio(voiceResponse.audio_base64);
        }
    } catch (error) {
        hideLoading();
        addMessage('Извините, произошла ошибка. Попробуйте позже.', 'error');
    }
}

function initVoiceButton() {
    let pressTimer = null;
    let isPressing = false;
    
    const startPress = (e) => {
        if (isPressing || isRecording) return;
        if (e.cancelable) e.preventDefault();
        
        isPressing = true;
        pressTimer = setTimeout(async () => {
            if (isPressing) {
                const hasPermission = await checkMicrophonePermission();
                if (hasPermission) {
                    startRecording();
                } else {
                    isPressing = false;
                }
            }
        }, 100);
    };
    
    const endPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        
        if (isPressing) {
            if (isRecording) {
                stopRecording();
            }
            isPressing = false;
        }
    };
    
    voiceBtn.addEventListener('mousedown', startPress);
    voiceBtn.addEventListener('mouseup', endPress);
    voiceBtn.addEventListener('mouseleave', endPress);
    
    voiceBtn.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        startPress(e);
    }, { passive: false });
    
    voiceBtn.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault();
        endPress(e);
    }, { passive: false });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

async function init() {
    console.log('🚀 Фреди приложение запущено');
    
    // Загружаем сохраненный режим
    const savedMode = localStorage.getItem('fredi_mode');
    if (savedMode && ['coach', 'psychologist', 'trainer'].includes(savedMode)) {
        currentMode = savedMode;
    }
    updateModeUI();
    
    // Инициализация голосовой кнопки
    initVoiceButton();
    
    // Обработчики
    sendBtn.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.mode;
            localStorage.setItem('fredi_mode', currentMode);
            updateModeUI();
            showToast(`Режим ${currentMode.toUpperCase()} активирован`, 'info');
        });
    });
    
    // Загружаем приветственное сообщение
    setTimeout(() => {
        addMessage('Здравствуйте! Я Фреди, ваш виртуальный психолог. Чем могу помочь?', 'bot');
    }, 500);
}

// Запуск
document.addEventListener('DOMContentLoaded', init);
