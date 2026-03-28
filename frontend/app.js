// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    API_BASE_URL: 'https://fredi-backend-flz2.onrender.com',
    USER_ID: 213102077,
    USER_NAME: 'Андрей',
    PROFILE_CODE: 'СБ-4_ТФ-4_УБ-4_ЧВ-4'
};

// Режимы (без приветствий)
const MODES = {
    coach: {
        id: 'coach',
        name: 'КОУЧ',
        emoji: '🔮',
        color: '#3b82ff',
        greeting: 'Я твой коуч. Давай найдём ответы внутри тебя.',
        voicePrompt: 'Задай вопрос — я помогу найти решение'
    },
    psychologist: {
        id: 'psychologist',
        name: 'ПСИХОЛОГ',
        emoji: '🧠',
        color: '#ff6b3b',
        greeting: 'Я здесь, чтобы помочь разобраться в глубинных паттернах.',
        voicePrompt: 'Расскажите, что вас беспокоит'
    },
    trainer: {
        id: 'trainer',
        name: 'ТРЕНЕР',
        emoji: '⚡',
        color: '#ff3b3b',
        greeting: 'Давай достигать целей вместе!',
        voicePrompt: 'Сформулируй задачу — получишь чёткий план'
    }
};

// Модули для каждого режима
const MODULES = {
    coach: [
        { id: 'goals', name: 'Цели', icon: '🎯', desc: 'Постановка и достижение' },
        { id: 'strategy', name: 'Стратегия', icon: '📊', desc: 'План действий' },
        { id: 'motivation', name: 'Мотивация', icon: '⚡', desc: 'Энергия для движения' },
        { id: 'habits', name: 'Привычки', icon: '🔄', desc: 'Формирование привычек' }
    ],
    psychologist: [
        { id: 'analysis', name: 'Анализ', icon: '🧠', desc: 'Глубинные паттерны' },
        { id: 'emotions', name: 'Эмоции', icon: '💭', desc: 'Работа с чувствами' },
        { id: 'trauma', name: 'Исцеление', icon: '🕊️', desc: 'Проработка опыта' },
        { id: 'relations', name: 'Отношения', icon: '💕', desc: 'Коммуникация' }
    ],
    trainer: [
        { id: 'workout', name: 'Тренировки', icon: '💪', desc: 'Физическая активность' },
        { id: 'discipline', name: 'Дисциплина', icon: '⏰', desc: 'Режим и порядок' },
        { id: 'results', name: 'Результаты', icon: '🏆', desc: 'Достижения' },
        { id: 'challenges', name: 'Челленджи', icon: '🔥', desc: 'Испытания' }
    ]
};

// Состояние
let currentMode = 'psychologist';
let isRecording = false;
let recordingTimer = null;
let mediaRecorder = null;
let audioChunks = [];
let navigationHistory = [];
let audioContext = null;
let mediaStream = null;
let animationFrame = null;
let liveVoiceWS = null;
let useWebSocket = true;

// ============================================
// WEBSOCKET ДЛЯ ЖИВОГО ГОЛОСОВОГО ДИАЛОГА
// ============================================

class LiveVoiceWebSocket {
    constructor(userId) {
        this.userId = userId;
        this.ws = null;
        this.isConnected = false;
        this.isAISpeaking = false;
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentSource = null;
        this.audioContext = null;
        
        this.pingInterval = null;
        this.PING_INTERVAL_MS = 25000;
        this.lastPongTime = null;
        this.pongTimeout = null;
    }
    
    async connect() {
        const wsUrl = `wss://fredi-backend-flz2.onrender.com/ws/voice/${this.userId}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected for live voice');
                this.isConnected = true;
                this.startHeartbeat();
                if (this.onStatusChange) this.onStatusChange('connected');
                resolve(true);
            };
            
            this.ws.onclose = (event) => {
                console.log(`❌ WebSocket disconnected: code=${event.code}, reason=${event.reason || 'no reason'}`);
                this.isConnected = false;
                this.stopHeartbeat();
                if (this.onStatusChange) this.onStatusChange('disconnected');
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this.onError) this.onError('Connection error');
                reject(error);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
        });
    }
    
    startHeartbeat() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        setTimeout(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendPing();
            }
        }, 5000);
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendPing();
            } else if (this.pingInterval) {
                this.stopHeartbeat();
            }
        }, this.PING_INTERVAL_MS);
        
        console.log(`💓 Heartbeat started: ping every ${this.PING_INTERVAL_MS / 1000} seconds`);
    }
    
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log('💓 Heartbeat stopped');
        }
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }
    
    sendPing() {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const pingTime = Date.now();
        console.log(`💓 Sending heartbeat ping at ${pingTime}`);
        
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: pingTime }));
        
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
        
        this.pongTimeout = setTimeout(() => {
            console.warn('⚠️ No pong received from server, connection may be dead');
            if (this.isConnected) this.reconnect();
        }, 5000);
    }
    
    handlePong(data) {
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
        const latency = data.timestamp ? Date.now() - data.timestamp : null;
        if (latency) console.log(`💓 Pong received, latency: ${latency}ms`);
        else console.log('💓 Pong received');
    }
    
    async reconnect() {
        console.log('🔄 Attempting to reconnect WebSocket...');
        this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            await this.connect();
            console.log('✅ WebSocket reconnected successfully');
        } catch (error) {
            console.error('❌ WebSocket reconnection failed:', error);
        }
    }
    
    handleMessage(data) {
        if (data.type === 'pong') {
            this.handlePong(data);
            return;
        }
        
        switch (data.type) {
            case 'audio':
                if (data.data) this.playAudioChunk(data.data);
                if (data.is_final) console.log('Audio stream ended');
                break;
            case 'text':
                console.log('📝 Transcript:', data.data);
                if (this.onTranscript) this.onTranscript(data.data);
                break;
            case 'status':
                console.log('📊 Status:', data.status);
                if (data.status === 'speaking') {
                    this.isAISpeaking = true;
                    if (this.onStatusChange) this.onStatusChange('ai_speaking');
                } else if (data.status === 'processing') {
                    if (this.onStatusChange) this.onStatusChange('processing');
                } else if (data.status === 'idle') {
                    this.isAISpeaking = false;
                    if (this.onStatusChange) this.onStatusChange('idle');
                } else if (data.status === 'listening') {
                    if (this.onStatusChange) this.onStatusChange('listening');
                } else if (data.status === 'connected') {
                    if (this.onStatusChange) this.onStatusChange('connected');
                }
                break;
            case 'error':
                console.error('Server error:', data.error);
                if (this.onError) this.onError(data.error);
                break;
            case 'audio_end':
                console.log('Audio playback ended');
                this.isAISpeaking = false;
                if (this.onStatusChange) this.onStatusChange('idle');
                break;
        }
    }
    
    async playAudioChunk(base64Data) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioContext.state === 'suspended') await this.audioContext.resume();
            }
            
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            if (this.currentSource) {
                try { this.currentSource.stop(); } catch (e) {}
                this.currentSource = null;
            }
            
            this.currentSource = source;
            source.start();
            source.onended = () => { if (this.currentSource === source) this.currentSource = null; };
        } catch (error) {
            console.error('Error playing audio chunk:', error);
        }
    }
    
    interrupt() {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) {}
            this.currentSource = null;
        }
        this.ws.send(JSON.stringify({ type: 'interrupt' }));
        console.log('🛑 Interrupt sent to server');
    }
    
    disconnect() {
        this.stopHeartbeat();
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) {}
            this.currentSource = null;
        }
        if (this.ws) { this.ws.close(); this.ws = null; }
        if (this.audioContext) { this.audioContext.close().catch(console.warn); this.audioContext = null; }
        this.isConnected = false;
        console.log('🔌 WebSocket disconnected manually');
    }
}

// ============================================
// ГОЛОСОВАЯ КНОПКА С УДЕРЖАНИЕМ (PUSH-TO-TALK)
// ============================================

class VoiceButtonHandler {
    constructor() {
        this.isPressing = false;
        this.isRecording = false;
        this.longPressTimer = null;
        this.LONG_PRESS_DURATION = 150;
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.audioChunks = [];
        this.useWebSocket = true;
        this.visualizerAnimation = null;
        this.visualizerContext = null;
        this.analyser = null;
        this.wavData = [];
        this.processor = null;
        this.recordingTimeout = null;
    }
    
    setupButton(buttonElement) {
        if (!buttonElement) return;
        
        buttonElement.addEventListener('mousedown', (e) => this.onPressStart(e));
        buttonElement.addEventListener('mouseup', (e) => this.onPressEnd(e));
        buttonElement.addEventListener('mouseleave', (e) => this.onPressEnd(e));
        
        buttonElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onPressStart(e);
        }, { passive: false });
        
        buttonElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.onPressEnd(e);
        }, { passive: false });
        
        buttonElement.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.onPressEnd(e);
        }, { passive: false });
        
        buttonElement.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('Voice button handler initialized');
    }
    
    async onPressStart(event) {
        if (this.isPressing || this.isRecording) return;
        
        this.isPressing = true;
        
        this.longPressTimer = setTimeout(async () => {
            if (this.isPressing) {
                await this.startRecording();
                this.isRecording = true;
                this.updateButtonUI(true);
            }
        }, this.LONG_PRESS_DURATION);
    }
    
    onPressEnd(event) {
        clearTimeout(this.longPressTimer);
        
        if (this.isRecording) {
            this.stopRecording();
            this.isRecording = false;
            this.updateButtonUI(false);
        }
        
        this.isPressing = false;
    }
    
    async startRecording() {
        try {
            if (liveVoiceWS && liveVoiceWS.isAISpeaking) {
                liveVoiceWS.interrupt();
                await new Promise(r => setTimeout(r, 300));
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 8000,
                    channelCount: 1
                }
            });
            
            this.mediaStream = stream;
            this.audioChunks = [];
            this.wavData = [];
            
            this.initVisualizer(stream);
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.processor.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, inputData[i]));
                    int16Data[i] = Math.floor(sample * 32767);
                }
                this.wavData.push(int16Data);
                
                if (this.analyser) {
                    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                    this.analyser.getByteFrequencyData(dataArray);
                    let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    let volume = Math.min(100, (average / 255) * 100);
                    const voiceBtn = document.getElementById('mainVoiceBtn');
                    if (voiceBtn) {
                        const intensity = volume / 100;
                        voiceBtn.style.boxShadow = `0 0 ${20 + intensity * 30}px rgba(255, 59, 59, ${0.3 + intensity * 0.5})`;
                    }
                }
            };
            
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            if (this.audioContext.state === 'suspended') await this.audioContext.resume();
            
            this.isRecording = true;
            
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) this.stopRecording();
            }, 30000);
            
            showToast('🎙️ Говорите... Отпустите для отправки', 'info');
            
        } catch (error) {
            console.error('Start recording error:', error);
            showToast('❌ Не удалось получить доступ к микрофону', 'error');
            this.isRecording = false;
        }
    }
    
    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        
        this.stopVisualizer();
        
        if (this.wavData && this.wavData.length > 0) {
            const wavBlob = this.createWavBlob(this.wavData);
            
            if (liveVoiceWS && liveVoiceWS.isConnected && useWebSocket) {
                this.sendAudioInChunks(wavBlob);
            } else {
                this.sendViaHTTPWithBlob(wavBlob);
            }
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        this.wavData = [];
        this.audioChunks = [];
        
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
            const iconSpan = voiceBtn.querySelector('.voice-icon');
            const textSpan = voiceBtn.querySelector('.voice-text');
            if (iconSpan) iconSpan.textContent = '🎤';
            if (textSpan) textSpan.textContent = MODES[currentMode].voicePrompt;
            voiceBtn.style.boxShadow = '';
        }
    }
    
    async sendAudioInChunks(audioBlob) {
        const CHUNK_SIZE = 32000;
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            const totalLength = base64Data.length;
            
            console.log(`📤 Sending audio in chunks: ${totalLength} bytes total`);
            
            for (let i = 0; i < totalLength; i += CHUNK_SIZE) {
                const chunk = base64Data.slice(i, i + CHUNK_SIZE);
                const isFinal = i + CHUNK_SIZE >= totalLength;
                
                liveVoiceWS.ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    data: chunk,
                    is_final: isFinal
                }));
                
                console.log(`📦 Sent chunk ${Math.floor(i/CHUNK_SIZE)+1}: ${chunk.length} chars, is_final=${isFinal}`);
                
                if (!isFinal) {
                    const start = Date.now();
                    while (Date.now() - start < 10) {}
                }
            }
            
            console.log(`✅ All ${Math.ceil(totalLength/CHUNK_SIZE)} chunks sent`);
        };
        reader.readAsDataURL(audioBlob);
    }
    
    createWavBlob(audioData) {
        let totalLength = 0;
        for (const chunk of audioData) totalLength += chunk.length;
        
        const MAX_SAMPLES = 480000;
        if (totalLength > MAX_SAMPLES) {
            console.warn(`Audio too long (${totalLength} samples), truncating to ${MAX_SAMPLES}`);
            totalLength = MAX_SAMPLES;
        }
        
        const combined = new Int16Array(totalLength);
        let offset = 0;
        for (const chunk of audioData) {
            if (offset + chunk.length > totalLength) {
                const remaining = totalLength - offset;
                combined.set(chunk.slice(0, remaining), offset);
                break;
            }
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        
        const buffer = new ArrayBuffer(44 + combined.length * 2);
        const view = new DataView(buffer);
        
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + combined.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        
        this.writeString(view, 36, 'data');
        view.setUint32(40, combined.length * 2, true);
        
        for (let i = 0; i < combined.length; i++) {
            view.setInt16(44 + i * 2, combined[i], true);
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    sendViaHTTPWithBlob(audioBlob) {
        const formData = new FormData();
        formData.append('user_id', CONFIG.USER_ID);
        formData.append('voice', audioBlob, 'audio.wav');
        formData.append('mode', currentMode);
        
        fetch(`${CONFIG.API_BASE_URL}/api/voice/process`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                if (result.recognized_text) addMessage(`🎤 "${result.recognized_text}"`, 'system');
                if (result.answer) addMessage(result.answer, 'bot');
                if (result.audio_base64) playAudioResponse(result.audio_base64);
            } else {
                showToast(`❌ ${result.error || 'Ошибка распознавания'}`, 'error');
            }
        })
        .catch(error => {
            console.error('HTTP voice error:', error);
            showToast('❌ Ошибка соединения', 'error');
        });
    }
    
    // ========== МЕТОДЫ UI ==========
    
    updateButtonUI(isRecording) {
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (!voiceBtn) return;
        
        if (isRecording) {
            voiceBtn.classList.add('recording');
            const iconSpan = voiceBtn.querySelector('.voice-icon');
            const textSpan = voiceBtn.querySelector('.voice-text');
            if (iconSpan) iconSpan.textContent = '⏹️';
            if (textSpan) textSpan.textContent = 'Отпустите для отправки';
        } else {
            voiceBtn.classList.remove('recording');
            const iconSpan = voiceBtn.querySelector('.voice-icon');
            const textSpan = voiceBtn.querySelector('.voice-text');
            if (iconSpan) iconSpan.textContent = '🎤';
            if (textSpan) textSpan.textContent = MODES[currentMode].voicePrompt;
            voiceBtn.style.boxShadow = '';
        }
    }
    
    initVisualizer(stream) {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        
        this.visualizerContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.visualizerContext.createMediaStreamSource(stream);
        this.analyser = this.visualizerContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const updateVolume = () => {
            if (!this.isRecording) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            let volume = Math.min(100, (average / 255) * 100);
            
            const voiceBtn = document.getElementById('mainVoiceBtn');
            if (voiceBtn) {
                const intensity = volume / 100;
                voiceBtn.style.boxShadow = `0 0 ${20 + intensity * 30}px rgba(255, 59, 59, ${0.3 + intensity * 0.5})`;
            }
            
            this.visualizerAnimation = requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
    }
    
    stopVisualizer() {
        if (this.visualizerAnimation) {
            cancelAnimationFrame(this.visualizerAnimation);
            this.visualizerAnimation = null;
        }
        if (this.visualizerContext) {
            this.visualizerContext.close().catch(console.warn);
            this.visualizerContext = null;
        }
        this.analyser = null;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function showToast(message, type = 'info') {
    const toast = document.getElementById('toastMessage');
    const textEl = document.getElementById('toastText');
    if (!toast || !textEl) return;
    textEl.textContent = message;
    toast.className = `floating-message ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
    const closeBtn = document.getElementById('toastClose');
    if (closeBtn) closeBtn.onclick = () => toast.style.display = 'none';
}

function addMessage(text, sender = 'bot', audioUrl = null) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    if (container.querySelector('.loading-screen')) container.innerHTML = '';
    let messagesContainer = container.querySelector('.chat-messages');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'chat-messages';
        container.appendChild(messagesContainer);
    }
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    const textSpan = document.createElement('div');
    textSpan.textContent = text;
    messageDiv.appendChild(textSpan);
    if (audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = audioUrl;
        messageDiv.appendChild(audio);
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function playAudioResponse(audioData) {
    if (!audioData) return;
    const audio = document.getElementById('hiddenAudioPlayer');
    if (!audio) return;
    
    try {
        let audioUrl = audioData;
        if (audioData.startsWith('data:audio/')) {
            const matches = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                const blob = new Blob([bytes], { type: mimeType });
                audioUrl = URL.createObjectURL(blob);
            }
        }
        
        audio.pause();
        audio.currentTime = 0;
        audio.src = audioUrl;
        audio.load();
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => console.error('Play failed:', error));
        }
        
        audio.onended = () => {
            if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        };
    } catch (error) {
        console.error('Playback error:', error);
    }
}

async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && audioTrack.enabled) {
            console.log('✅ Microphone access granted:', audioTrack.label);
            stream.getTracks().forEach(track => track.stop());
            return true;
        }
        return false;
    } catch (error) {
        console.error('Microphone permission error:', error);
        return false;
    }
}

async function textToSpeech(text, mode) {
    try {
        const formData = new URLSearchParams();
        formData.append('text', text);
        formData.append('mode', mode);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const audioBlob = await response.blob();
        return { audio_url: URL.createObjectURL(audioBlob) };
    } catch (error) {
        console.error('TTS error:', error);
        return null;
    }
}

async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    
    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

async function getUserStatus() {
    try {
        return await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
    } catch (error) {
        return { has_profile: true, test_completed: true, profile_code: CONFIG.PROFILE_CODE };
    }
}

async function initWebSocket() {
    liveVoiceWS = new LiveVoiceWebSocket(CONFIG.USER_ID);
    
    liveVoiceWS.onStatusChange = (status) => {
        console.log('WebSocket status:', status);
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (voiceBtn) {
            if (status === 'connected') voiceBtn.style.border = '2px solid #4caf50';
            else if (status === 'ai_speaking') {
                voiceBtn.style.border = '2px solid #ff6b3b';
                voiceBtn.querySelector('.voice-icon').textContent = '🔊';
            } else if (status === 'processing') {
                voiceBtn.querySelector('.voice-icon').textContent = '🔄';
            } else if (status === 'idle') {
                voiceBtn.style.border = '';
                voiceBtn.querySelector('.voice-icon').textContent = '🎤';
            }
        }
    };
    
    liveVoiceWS.onTranscript = (text) => addMessage(`🎤 ${text}`, 'system');
    liveVoiceWS.onError = (error) => showToast(`❌ ${error}`, 'error');
    
    try {
        await liveVoiceWS.connect();
        console.log('✅ Live voice WebSocket connected');
        return true;
    } catch (error) {
        console.warn('WebSocket failed, falling back to HTTP', error);
        useWebSocket = false;
        return false;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

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
        </div>
    `;
    
    const voiceBtnElement = document.getElementById('mainVoiceBtn');
    if (voiceBtnElement) {
        const voiceHandler = new VoiceButtonHandler();
        voiceHandler.setupButton(voiceBtnElement);
    }
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode) switchMode(mode);
        });
    });
    
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', async () => {
            const actionType = action.dataset.action;
            if (actionType === 'profile') handleShowProfile();
            else if (actionType === 'thoughts') handleShowThoughts();
            else if (actionType === 'newThought') handleShowNewThought();
            else if (actionType === 'weekend') handleShowWeekend();
            else if (actionType === 'goals') handleShowGoals();
            else if (actionType === 'questions') handleShowQuestions();
            else if (actionType === 'challenges') handleShowChallenges();
            else if (actionType === 'doubles') handleShowDoubles();
        });
    });
}

async function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    const config = MODES[mode];
    showToast(`Режим "${config.name}" активирован`, 'success');
    await apiCall('/api/save-mode', { method: 'POST', body: JSON.stringify({ user_id: CONFIG.USER_ID, mode }) });
    renderDashboard();
}

async function handleShowProfile() {
    try {
        const data = await apiCall(`/api/get-profile?user_id=${CONFIG.USER_ID}`);
        const profile = data.ai_generated_profile || 'Психологический портрет формируется.';
        showFullContentScreen('🧠 Психологический портрет', profile);
    } catch (e) { showToast('Не удалось загрузить профиль', 'error'); }
}

async function handleShowThoughts() {
    try {
        const data = await apiCall(`/api/thought?user_id=${CONFIG.USER_ID}`);
        if (data.thought) showFullContentScreen('💭 Мысли психолога', data.thought);
        else showToast('Мысли психолога появятся после прохождения теста', 'info');
    } catch (e) { showToast('Не удалось загрузить мысли', 'error'); }
}

async function handleShowNewThought() {
    try {
        const data = await apiCall('/api/psychologist-thoughts/generate', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID })
        });
        if (data.thought) showFullContentScreen('💭 Свежая мысль', data.thought);
        else showToast('Не удалось сгенерировать мысль', 'error');
    } catch (e) { showToast('Ошибка', 'error'); }
}

async function handleShowWeekend() {
    try {
        const data = await apiCall(`/api/ideas?user_id=${CONFIG.USER_ID}`);
        const ideas = data.ideas || [];
        if (ideas.length) showFullContentScreen('🎨 Идеи на выходные', ideas.map(i => i.description || i).join('\n\n'));
        else showToast('Идеи скоро появятся', 'info');
    } catch (e) { showToast('Не удалось загрузить идеи', 'error'); }
}

async function handleShowGoals() {
    try {
        const data = await apiCall(`/api/goals/with-confinement?user_id=${CONFIG.USER_ID}&mode=${currentMode}`);
        const goals = data.goals || [];
        if (goals.length) showFullContentScreen('🎯 Ваши цели', goals.map(g => `**${g.name}**\n⏱ ${g.time || '?'} | 🎯 ${g.difficulty || 'medium'}`).join('\n\n'));
        else showToast('Цели появятся после прохождения теста', 'info');
    } catch (e) { showToast('Не удалось загрузить цели', 'error'); }
}

async function handleShowQuestions() {
    try {
        const data = await apiCall(`/api/smart-questions?user_id=${CONFIG.USER_ID}`);
        const questions = data.questions || [];
        if (questions.length) showFullContentScreen('❓ Вопросы для размышления', questions.map((q, i) => `${i+1}. ${q}`).join('\n\n'));
        else showToast('Вопросы появятся после прохождения теста', 'info');
    } catch (e) { showToast('Не удалось загрузить вопросы', 'error'); }
}

async function handleShowChallenges() {
    try {
        const data = await apiCall(`/api/challenges?user_id=${CONFIG.USER_ID}`);
        const challenges = data.challenges || [];
        if (challenges.length) showFullContentScreen('🏆 Челленджи', challenges.map(c => `**${c.name}**\n${c.description}\n🎁 Награда: ${c.reward} очков`).join('\n\n'));
        else showToast('Челленджи появятся после прохождения теста', 'info');
    } catch (e) { showToast('Не удалось загрузить челленджи', 'error'); }
}

async function handleShowDoubles() {
    try {
        const data = await apiCall(`/api/psychometric/find-doubles?user_id=${CONFIG.USER_ID}&limit=5`);
        const doubles = data.doubles || [];
        if (doubles.length) showFullContentScreen('👥 Психометрические двойники', doubles.map(d => `**${d.name}**\nПрофиль: ${d.profile_code}\nСхожесть: ${Math.round(d.similarity * 100)}%`).join('\n\n'));
        else showToast('Двойники появятся после прохождения теста', 'info');
    } catch (e) { showToast('Не удалось найти двойников', 'error'); }
}

function showFullContentScreen(title, content) {
    const container = document.getElementById('screenContainer');
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <h1 class="content-title">${title}</h1>
            </div>
            <div class="content-body">
                ${typeof content === 'string' ? content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') : content}
            </div>
            <button class="action-btn primary-btn" id="speakBtn" style="margin-top: 20px;">🔊 Озвучить</button>
        </div>
    `;
    document.getElementById('backBtn').onclick = () => renderDashboard();
    document.getElementById('speakBtn').onclick = async () => {
        const text = typeof content === 'string' ? content.replace(/\*\*(.*?)\*\*/g, '$1') : '';
        const tts = await textToSpeech(text, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    };
}

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const chatsPanel = document.getElementById('chatsPanel');
    if (!mobileMenuBtn || !chatsPanel) return;
    
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatsPanel.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (chatsPanel.classList.contains('open')) {
            if (!chatsPanel.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                chatsPanel.classList.remove('open');
            }
        }
    });
}

async function init() {
    console.log('🚀 FREDI PREMIUM — полная версия с живым голосом');
    initMobileMenu();
    
    try {
        const status = await getUserStatus();
        if (status.profile_code) {
            const profileCodeEl = document.getElementById('profileCode');
            if (profileCodeEl) profileCodeEl.textContent = status.profile_code;
        }
    } catch (e) {}
    
    renderDashboard();
    
    document.getElementById('userName').textContent = CONFIG.USER_NAME;
    document.getElementById('userMiniAvatar').textContent = CONFIG.USER_NAME.charAt(0);
    
    await initWebSocket();
    
    setTimeout(async () => {
        const hasMic = await checkMicrophonePermission();
        if (!hasMic) console.log('Microphone permission not granted yet');
    }, 1000);
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chat = item.dataset.chat;
            if (chat === 'fredi') renderDashboard();
            else if (chat === 'test') {
                if (window.Test && window.Test.start) {
                    window.Test.init(CONFIG.USER_ID);
                    window.Test.start();
                } else {
                    showToast('Тест загружается...', 'info');
                    const script = document.createElement('script');
                    script.src = '/test.js';
                    script.onload = () => {
                        window.Test.init(CONFIG.USER_ID);
                        window.Test.start();
                    };
                    document.head.appendChild(script);
                }
            }
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (window.innerWidth <= 768) {
                const chatsPanel = document.getElementById('chatsPanel');
                if (chatsPanel) chatsPanel.classList.remove('open');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
