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
let useWebSocket = true; // Переключатель между WebSocket и HTTP

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
        
        // ========== HEARTBEAT ДЛЯ ПОДДЕРЖАНИЯ СОЕДИНЕНИЯ ==========
        this.pingInterval = null;
        this.PING_INTERVAL_MS = 25000; // 25 секунд (меньше чем 30 сек таймаут Render)
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
                
                // ЗАПУСКАЕМ HEARTBEAT
                this.startHeartbeat();
                
                if (this.onStatusChange) this.onStatusChange('connected');
                resolve(true);
            };
            
            this.ws.onclose = (event) => {
                console.log(`❌ WebSocket disconnected: code=${event.code}, reason=${event.reason || 'no reason'}`);
                this.isConnected = false;
                
                // ОСТАНАВЛИВАЕМ HEARTBEAT
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
    
    // ========== HEARTBEAT МЕТОДЫ ==========
    
    startHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // Отправляем первый ping через 5 секунд
        setTimeout(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendPing();
            }
        }, 5000);
        
        // Запускаем периодический ping
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendPing();
            } else if (this.pingInterval) {
                // Если соединение закрыто, останавливаем интервал
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
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const pingTime = Date.now();
        console.log(`💓 Sending heartbeat ping at ${pingTime}`);
        
        this.ws.send(JSON.stringify({ 
            type: 'ping',
            timestamp: pingTime 
        }));
        
        // Таймаут на получение pong (5 секунд)
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
        }
        
        this.pongTimeout = setTimeout(() => {
            console.warn('⚠️ No pong received from server, connection may be dead');
            if (this.isConnected) {
                // Пытаемся переподключиться
                this.reconnect();
            }
        }, 5000);
    }
    
    handlePong(data) {
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
        
        const latency = data.timestamp ? Date.now() - data.timestamp : null;
        if (latency) {
            console.log(`💓 Pong received, latency: ${latency}ms`);
        } else {
            console.log('💓 Pong received');
        }
    }
    
    async reconnect() {
        console.log('🔄 Attempting to reconnect WebSocket...');
        this.disconnect();
        
        // Ждём 2 секунды перед переподключением
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            await this.connect();
            console.log('✅ WebSocket reconnected successfully');
        } catch (error) {
            console.error('❌ WebSocket reconnection failed:', error);
        }
    }
    
    handleMessage(data) {
        // Обработка pong
        if (data.type === 'pong') {
            this.handlePong(data);
            return;
        }
        
        switch (data.type) {
            case 'audio':
                if (data.data) {
                    this.playAudioChunk(data.data);
                }
                if (data.is_final) {
                    console.log('Audio stream ended');
                }
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
                // Включаем AudioContext после взаимодействия пользователя
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            }
            
            // Декодируем base64 в ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            // Останавливаем предыдущее воспроизведение если есть
            if (this.currentSource) {
                try {
                    this.currentSource.stop();
                } catch (e) {
                    // Игнорируем ошибки остановки
                }
                this.currentSource = null;
            }
            
            this.currentSource = source;
            source.start();
            
            source.onended = () => {
                if (this.currentSource === source) {
                    this.currentSource = null;
                }
            };
            
        } catch (error) {
            console.error('Error playing audio chunk:', error);
        }
    }
    
    sendAudioChunk(chunk, isFinal) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send audio: WebSocket not connected');
            return;
        }
        
        let base64Data = '';
        if (chunk) {
            const reader = new FileReader();
            reader.onload = () => {
                base64Data = reader.result.split(',')[1];
                this.ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    data: base64Data,
                    is_final: isFinal
                }));
            };
            reader.readAsDataURL(chunk);
        } else {
            this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: '',
                is_final: isFinal
            }));
        }
    }

    // ========== НОВЫЙ МЕТОД sendFullAudio (ДОБАВИТЬ СЮДА) ==========
    sendFullAudio(audioBlob) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send audio: WebSocket not connected');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64Data,
                is_final: true
            }));
            console.log(`📤 Sent full audio: ${audioBlob.size} bytes as WAV`);
        };
        reader.readAsDataURL(audioBlob);
    }
    
    interrupt() {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Останавливаем текущее воспроизведение
        if (this.currentSource) {
            try {
                this.currentSource.stop();
                this.currentSource = null;
            } catch (e) {
                // Игнорируем
            }
        }
        
        // Отправляем сигнал прерывания на сервер
        this.ws.send(JSON.stringify({
            type: 'interrupt'
        }));
        
        console.log('🛑 Interrupt sent to server');
    }
    
    ping() {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendPing();
        }
    }
    
    disconnect() {
        this.stopHeartbeat();
        
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {}
            this.currentSource = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        
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
        this.audioContext = null;
        this.analyser = null;
    }
    
    setupButton(buttonElement) {
        if (!buttonElement) return;
        
        // События для мыши
        buttonElement.addEventListener('mousedown', (e) => this.onPressStart(e));
        buttonElement.addEventListener('mouseup', (e) => this.onPressEnd(e));
        buttonElement.addEventListener('mouseleave', (e) => this.onPressEnd(e));
        
        // События для касания (мобильные)
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
        // Проверяем, не говорит ли ИИ
        if (liveVoiceWS && liveVoiceWS.isAISpeaking) {
            liveVoiceWS.interrupt();
            await new Promise(r => setTimeout(r, 300));
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 8000,   // 8kHz вместо 16kHz
                channelCount: 1          // моно
            }
        });
        
        this.mediaStream = stream;
        this.audioChunks = [];
        this.wavData = [];               // для WAV данных
        
        // Инициализируем визуализатор
        this.initVisualizer(stream);
        
        // Создаём AudioContext для записи в WAV
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // Создаём ScriptProcessorNode для захвата аудиоданных
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.processor.onaudioprocess = (event) => {
            if (!this.isRecording) return;
            
            const inputData = event.inputBuffer.getChannelData(0);
            // Конвертируем float32 (-1..1) в int16 (-32768..32767)
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                int16Data[i] = Math.floor(sample * 32767);
            }
            this.wavData.push(int16Data);
            
            // Обновляем визуализатор
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
        
        // Запускаем AudioContext
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        this.isRecording = true;
        
        // Таймаут на 60 секунд
        this.recordingTimeout = setTimeout(() => {
            if (this.isRecording) {
                this.stopRecording();
            }
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
    
    // Останавливаем визуализатор
    this.stopVisualizer();
    
    // Создаём WAV файл из собранных данных
    if (this.wavData && this.wavData.length > 0) {
        const wavBlob = this.createWavBlob(this.wavData);
        
        if (liveVoiceWS && liveVoiceWS.isConnected && useWebSocket) {
            // ✅ ИСПРАВЛЕНО: Отправляем через WebSocket чанками
            this.sendAudioInChunks(wavBlob);
        } else {
            // Fallback на HTTP
            this.sendViaHTTPWithBlob(wavBlob);
        }
    }
    
    // Закрываем медиа-поток
    if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
    }
    
    this.wavData = [];
    this.audioChunks = [];
    
    // Обновляем UI кнопки
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

// ✅ НОВЫЙ МЕТОД: Отправка аудио чанками (ДОБАВИТЬ!)
async sendAudioInChunks(audioBlob) {
    const CHUNK_SIZE = 32000; // 32KB чанки
    
    // Конвертируем Blob в base64
    const reader = new FileReader();
    reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        const totalLength = base64Data.length;
        
        console.log(`📤 Sending audio in chunks: ${totalLength} bytes total`);
        
        // Отправляем чанками
        for (let i = 0; i < totalLength; i += CHUNK_SIZE) {
            const chunk = base64Data.slice(i, i + CHUNK_SIZE);
            const isFinal = i + CHUNK_SIZE >= totalLength;
            
            liveVoiceWS.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: chunk,
                is_final: isFinal
            }));
            
            console.log(`📦 Sent chunk ${Math.floor(i/CHUNK_SIZE)+1}: ${chunk.length} chars, is_final=${isFinal}`);
            
            // Небольшая задержка между чанками (10ms)
            if (!isFinal) {
                const start = Date.now();
                while (Date.now() - start < 10) {
                    // Синхронная задержка
                }
            }
        }
        
        console.log(`✅ All ${Math.ceil(totalLength/CHUNK_SIZE)} chunks sent`);
    };
    reader.readAsDataURL(audioBlob);
}

createWavBlob(audioData) {
    // Объединяем все чанки
    let totalLength = 0;
    for (const chunk of audioData) {
        totalLength += chunk.length;
    }
    
    // ✅ Ограничиваем максимальную длину (30 секунд при 16kHz = 480,000 сэмплов)
    const MAX_SAMPLES = 480000; // 30 секунд при 16kHz
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
    
    const sampleRate = 16000; // ✅ Уменьшено с 44100 до 16000 для меньшего размера
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    
    const buffer = new ArrayBuffer(44 + combined.length * 2);
    const view = new DataView(buffer);
    
    // RIFF chunk
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + combined.length * 2, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt subchunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data subchunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, combined.length * 2, true);
    
    // записываем данные
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
            if (result.recognized_text) {
                addMessage(`🎤 "${result.recognized_text}"`, 'system');
            }
            if (result.answer) {
                addMessage(result.answer, 'bot');
            }
            if (result.audio_base64) {
                playAudioResponse(result.audio_base64);
            }
        } else {
            showToast(`❌ ${result.error || 'Ошибка распознавания'}`, 'error');
        }
    })
    .catch(error => {
        console.error('HTTP voice error:', error);
        showToast('❌ Ошибка соединения', 'error');
    });
}
// ========== API ВЫЗОВЫ ==========

async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
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

// ========== КОНФАЙНТМЕНТ-МОДЕЛЬ API ==========

async function getConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement-model?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get confinement model', error);
        return null;
    }
}

async function getConfinementLoops() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/loops`);
        return data;
    } catch (error) {
        console.warn('Failed to get loops', error);
        return null;
    }
}

async function getKeyConfinement() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/key-confinement`);
        return data;
    } catch (error) {
        console.warn('Failed to get key confinement', error);
        return null;
    }
}

async function getIntervention(elementId) {
    try {
        const data = await apiCall(`/api/intervention/${elementId}?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get intervention', error);
        return null;
    }
}

async function rebuildConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/rebuild`, {
            method: 'POST'
        });
        return data;
    } catch (error) {
        console.warn('Failed to rebuild model', error);
        return null;
    }
}

// ========== ПРАКТИКИ API ==========

async function getMorningPractice() {
    try {
        const data = await apiCall('/api/practice/morning');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get morning practice', error);
        return 'Утренняя практика: начните день с намерения. Сделайте 3 глубоких вдоха и скажите себе: "Я выбираю, как мне относиться к этому дню".';
    }
}

async function getEveningPractice() {
    try {
        const data = await apiCall('/api/practice/evening');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get evening practice', error);
        return 'Вечерняя практика: вспомните три хороших события сегодня. За что вы благодарны? Что было важным?';
    }
}

async function getRandomExercise() {
    try {
        const data = await apiCall('/api/practice/random-exercise');
        return data.exercise;
    } catch (error) {
        console.warn('Failed to get exercise', error);
        return 'Сделайте паузу. Обратите внимание на своё дыхание. Вдох... выдох... Повторите 5 раз.';
    }
}

async function getRandomQuote() {
    try {
        const data = await apiCall('/api/practice/random-quote');
        return data.quote;
    } catch (error) {
        console.warn('Failed to get quote', error);
        return '«Не в силе, а в правде. Не в деньгах, а в душевном покое.» — Андрей Мейстер';
    }
}

// ========== ГИПНОЗ API ==========

async function processHypno(text, mode = currentMode) {
    try {
        const data = await apiCall('/api/hypno/process', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                text: text,
                mode: mode
            })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to process hypno', error);
        return 'Сделайте глубокий вдох... Представьте, что с каждым выдохом вы отпускаете напряжение... Вы в безопасности... Дышите...';
    }
}

async function getHypnoSupport(text = '') {
    try {
        const data = await apiCall('/api/hypno/support', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to get support', error);
        return 'Я здесь. Ты справляешься. Дыши спокойно.';
    }
}

// ========== СКАЗКИ API ==========

async function getTales() {
    try {
        const data = await apiCall('/api/tale');
        return data;
    } catch (error) {
        console.warn('Failed to get tales', error);
        return { success: false, available_tales: [] };
    }
}

async function getTaleById(taleId) {
    try {
        const data = await apiCall(`/api/tale/${taleId}`);
        return data.tale;
    } catch (error) {
        console.warn('Failed to get tale', error);
        return null;
    }
}

// ========== ЯКОРЯ API ==========

async function getUserAnchors() {
    try {
        const data = await apiCall(`/api/anchor/user/${CONFIG.USER_ID}`);
        return data.anchors;
    } catch (error) {
        console.warn('Failed to get anchors', error);
        return [];
    }
}

async function setAnchor(anchorName, state, phrase) {
    try {
        const data = await apiCall('/api/anchor/set', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName,
                state: state,
                phrase: phrase
            })
        });
        return data;
    } catch (error) {
        console.warn('Failed to set anchor', error);
        return null;
    }
}

async function fireAnchor(anchorName) {
    try {
        const data = await apiCall('/api/anchor/fire', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName
            })
        });
        return data.phrase;
    } catch (error) {
        console.warn('Failed to fire anchor', error);
        return null;
    }
}

async function getAnchor(state) {
    try {
        const data = await apiCall(`/api/anchor/${state}`);
        return data.phrase;
    } catch (error) {
        console.warn('Failed to get anchor', error);
        return `Я спокоен. Я дышу. Я здесь и сейчас.`;
    }
}

// ========== СТАТИСТИКА API ==========

async function getConfinementStatistics() {
    try {
        const data = await apiCall(`/api/confinement/statistics/${CONFIG.USER_ID}`);
        return data.statistics;
    } catch (error) {
        console.warn('Failed to get statistics', error);
        return {
            total_elements: 0,
            active_elements: 0,
            total_loops: 0,
            is_system_closed: false,
            closure_score: 0
        };
    }
}

// ========== НОВЫЕ API ДЛЯ ПРОВЕРКИ РЕАЛЬНОСТИ ==========

async function getRealityPath(goalId, mode = 'coach') {
    try {
        const data = await apiCall(`/api/reality/path/${goalId}?mode=${mode}`);
        return data.path;
    } catch (error) {
        console.warn('Failed to get reality path', error);
        return null;
    }
}

async function checkReality(goalId, mode = 'coach', lifeContext = {}, goalContext = {}, profile = {}) {
    try {
        const data = await apiCall('/api/reality/check', {
            method: 'POST',
            body: JSON.stringify({
                goal_id: goalId,
                mode: mode,
                life_context: lifeContext,
                goal_context: goalContext,
                profile: profile
            })
        });
        return data.result;
    } catch (error) {
        console.warn('Failed to check reality', error);
        return null;
    }
}

async function getLifeContextQuestions() {
    try {
        const data = await apiCall('/api/reality/questions/life');
        return data.questions;
    } catch (error) {
        console.warn('Failed to get life questions', error);
        return null;
    }
}

async function parseLifeAnswers(text) {
    try {
        const data = await apiCall('/api/reality/parse/life', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.parsed;
    } catch (error) {
        console.warn('Failed to parse life answers', error);
        return null;
    }
}

async function parseGoalAnswers(text) {
    try {
        const data = await apiCall('/api/reality/parse/goal', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.parsed;
    } catch (error) {
        console.warn('Failed to parse goal answers', error);
        return null;
    }
}

// ========== ДРУГИЕ API ==========

async function getUserStatus() {
    try {
        return await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
    } catch (error) {
        return { has_profile: true, test_completed: true, profile_code: CONFIG.PROFILE_CODE };
    }
}

async function getPsychologistThought() {
    try {
        const data = await apiCall(`/api/thought?user_id=${CONFIG.USER_ID}`);
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function generateNewThought() {
    try {
        const data = await apiCall('/api/psychologist-thoughts/generate', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID })
        });
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function getWeekendIdeas() {
    try {
        const data = await apiCall(`/api/ideas?user_id=${CONFIG.USER_ID}`);
        return data.ideas || [];
    } catch (error) {
        return [];
    }
}

async function getUserProfile() {
    try {
        const data = await apiCall(`/api/get-profile?user_id=${CONFIG.USER_ID}`);
        return data.ai_generated_profile || 'Психологический портрет формируется.';
    } catch (error) {
        return 'Профиль временно недоступен.';
    }
}

async function getUserGoals() {
    try {
        const data = await apiCall(`/api/goals/with-confinement?user_id=${CONFIG.USER_ID}&mode=${currentMode}`);
        return data.goals || [];
    } catch (error) {
        return [];
    }
}

async function getSmartQuestions() {
    try {
        const data = await apiCall(`/api/smart-questions?user_id=${CONFIG.USER_ID}`);
        return data.questions || [];
    } catch (error) {
        return [];
    }
}

async function getChallenges() {
    try {
        const data = await apiCall(`/api/challenges?user_id=${CONFIG.USER_ID}`);
        return data.challenges || [];
    } catch (error) {
        return [];
    }
}

async function findPsychometricDoubles() {
    try {
        const data = await apiCall(`/api/psychometric/find-doubles?user_id=${CONFIG.USER_ID}&limit=5`);
        return data.doubles || [];
    } catch (error) {
        return [];
    }
}

// ========== ГОЛОСОВЫЕ ФУНКЦИИ ==========

async function checkMicrophonePermission() {
    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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

function playAudioResponse(audioData) {
    if (!audioData) {
        console.warn('No audio data');
        return;
    }
    
    const audio = document.getElementById('hiddenAudioPlayer');
    if (!audio) {
        console.warn('Audio element not found');
        return;
    }
    
    try {
        let audioUrl = audioData;
        
        if (audioData.startsWith('data:audio/')) {
            const matches = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
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
            playPromise.catch(error => {
                console.error('Play failed:', error);
            });
        }
        
        audio.onended = () => {
            if (audioUrl && audioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(audioUrl);
            }
        };
        
    } catch (error) {
        console.error('Playback error:', error);
    }
}

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
        const ttsResponse = await textToSpeech(textToSpeak, currentMode);
        if (ttsResponse?.audio_url) playAudioResponse(ttsResponse.audio_url);
    };
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

// ========== ОТОБРАЖЕНИЕ РАЗДЕЛОВ ==========

async function showConfinementModel() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю модель ограничений...', 'info');
    
    const model = await getConfinementModel();
    if (!model) {
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">🔐</div>
                    <h1 class="content-title">Модель ограничений</h1>
                </div>
                <div class="content-body">
                    <p>Не удалось загрузить модель. Попробуйте позже.</p>
                </div>
            </div>
        `;
        document.getElementById('backBtn').onclick = () => navigateBack();
        return;
    }
    
    let elementsHtml = '';
    if (model.elements) {
        for (let i = 1; i <= 9; i++) {
            const elem = model.elements[i];
            if (elem) {
                elementsHtml += `
                    <div class="confinement-element" data-element="${i}">
                        <div class="element-number">${i}</div>
                        <div class="element-name">${elem.name || `Элемент ${i}`}</div>
                        <div class="element-desc">${(elem.description || '').substring(0, 60)}...</div>
                        <div class="element-meta">
                            <span class="element-strength">💪 ${Math.round((elem.strength || 0.5) * 100)}%</span>
                            <span class="element-vak">🎭 ${elem.vak || 'digital'}</span>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    let loopsHtml = '';
    if (model.loops && model.loops.length) {
        loopsHtml = '<h3>🔄 Петли</h3>';
        model.loops.forEach(loop => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">${loop.type || 'Петля'}</div>
                    <div class="loop-desc">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                </div>
            `;
        });
    }
    
    let keyHtml = '';
    if (model.key_confinement) {
        keyHtml = `
            <div class="key-confinement">
                <div class="key-icon">🔐</div>
                <div class="key-title">КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ</div>
                <div class="key-desc">${model.key_confinement.description || 'Анализ в процессе...'}</div>
                <div class="key-desc" style="margin-top: 8px;">Важность: ${Math.round((model.key_confinement.importance || 0.7) * 100)}%</div>
                <button class="action-btn" id="keyConfinementInterventionBtn" style="margin-top: 12px;">💡 Получить интервенцию</button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔐</div>
                <h1 class="content-title">Модель ограничений</h1>
            </div>
            <div class="content-body">
                <div class="key-confinement" style="background: rgba(224,224,224,0.05); margin-bottom: 20px;">
                    <div class="key-title">📊 СТЕПЕНЬ ЗАМЫКАНИЯ</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--chrome);">${Math.round((model.closure_score || 0) * 100)}%</div>
                    <div>${model.is_closed ? '🔒 Система замкнута' : '🔓 Система открыта'}</div>
                </div>
                
                ${keyHtml}
                
                <h3>📊 ЭЛЕМЕНТЫ МОДЕЛИ</h3>
                <div class="elements-grid" id="elementsGrid">
                    ${elementsHtml || '<p>Нет данных об элементах</p>'}
                </div>
                
                ${loopsHtml}
                
                <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="action-btn" id="loopsBtn">🔄 Все петли</button>
                    <button class="action-btn" id="rebuildModelBtn">🔄 Перестроить модель</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('loopsBtn')?.addEventListener('click', () => navigateTo('confinement-loops', { model: model }));
    document.getElementById('rebuildModelBtn')?.addEventListener('click', async () => {
        showToast('Перестраиваю модель...', 'info');
        const result = await rebuildConfinementModel();
        if (result && result.success) {
            showToast('Модель перестроена', 'success');
            navigateTo('confinement-model');
        } else {
            showToast('Не удалось перестроить модель', 'error');
        }
    });
    document.getElementById('keyConfinementInterventionBtn')?.addEventListener('click', () => {
        if (model.key_confinement && model.key_confinement.element) {
            navigateTo('intervention', { elementId: model.key_confinement.element.id });
        }
    });
    
    document.querySelectorAll('.confinement-element').forEach(el => {
        el.addEventListener('click', () => {
            const elementId = el.dataset.element;
            navigateTo('intervention', { elementId: parseInt(elementId) });
        });
    });
}

async function showConfinementLoops(params) {
    const container = document.getElementById('screenContainer');
    showToast('Анализирую петли...', 'info');
    
    const loopsData = await getConfinementLoops();
    
    let loopsHtml = '';
    if (loopsData && loopsData.loops && loopsData.loops.length) {
        loopsData.loops.forEach((loop, idx) => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">🔄 ПЕТЛЯ ${idx + 1}: ${loop.type || 'Цикл'}</div>
                    <div class="loop-desc" style="margin: 8px 0;">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                    ${loop.elements ? `<div class="loop-strength">Элементы: ${loop.elements.join(' → ')}</div>` : ''}
                </div>
            `;
        });
    } else {
        loopsHtml = '<p>Петли не обнаружены</p>';
    }
    
    let statsHtml = '';
    if (loopsData && loopsData.statistics) {
        statsHtml = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card"><div class="stat-value">${loopsData.statistics.total_loops || 0}</div><div class="stat-label">Всего петель</div></div>
                <div class="stat-card"><div class="stat-value">${Math.round((loopsData.statistics.avg_loop_strength || 0) * 100)}%</div><div class="stat-label">Ср. сила петель</div></div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1 class="content-title">Петли системы</h1>
            </div>
            <div class="content-body">
                ${statsHtml}
                <h3>Обнаруженные петли</h3>
                ${loopsHtml}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}

async function showIntervention(params) {
    const elementId = params.elementId;
    const container = document.getElementById('screenContainer');
    showToast('Загружаю интервенцию...', 'info');
    
    const intervention = await getIntervention(elementId);
    
    let elementHtml = '';
    if (intervention && intervention.element) {
        elementHtml = `
            <div class="key-confinement" style="margin-bottom: 20px;">
                <div class="key-title">🧠 ЭЛЕМЕНТ ${intervention.element.id}: ${intervention.element.name || 'Неизвестно'}</div>
                <div class="key-desc">${intervention.element.description || 'Нет описания'}</div>
                <div class="key-desc">Уровень: ${intervention.element.level || 3}/6 | Сила: ${Math.round((intervention.element.strength || 0.5) * 100)}%</div>
            </div>
        `;
    }
    
    let interventionHtml = '';
    if (intervention && intervention.intervention) {
        interventionHtml = `
            <div class="intervention-card">
                <h3>💡 ЧТО ДЕЛАТЬ</h3>
                <div class="intervention-text">${intervention.intervention.description || intervention.intervention}</div>
            </div>
        `;
    }
    
    let dailyHtml = '';
    if (intervention && intervention.daily_practice) {
        dailyHtml = `
            <div class="daily-practice">
                <h3>📝 ЕЖЕДНЕВНАЯ ПРАКТИКА</h3>
                <div class="intervention-text">${intervention.daily_practice}</div>
            </div>
        `;
    }
    
    let weekHtml = '';
    if (intervention && intervention.week_program) {
        weekHtml = `
            <div class="daily-practice">
                <h3>📅 НЕДЕЛЬНАЯ ПРОГРАММА</h3>
                <div class="intervention-text">${intervention.week_program}</div>
            </div>
        `;
    }
    
    let quoteHtml = '';
    if (intervention && intervention.random_quote) {
        quoteHtml = `
            <div class="quote-card">
                <div>${intervention.random_quote}</div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">💡</div>
                <h1 class="content-title">Интервенция</h1>
            </div>
            <div class="content-body">
                ${elementHtml}
                ${interventionHtml}
                ${dailyHtml}
                ${weekHtml}
                ${quoteHtml}
                <button class="action-btn primary-btn" id="speakInterventionBtn" style="margin-top: 16px;">🔊 Озвучить</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakInterventionBtn')?.addEventListener('click', async () => {
        const text = (intervention?.intervention?.description || '') + ' ' + (intervention?.daily_practice || '');
        const tts = await textToSpeech(text, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
}

async function showPractices() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю практики...', 'info');
    
    const [morning, evening, exercise, quote] = await Promise.all([
        getMorningPractice(),
        getEveningPractice(),
        getRandomExercise(),
        getRandomQuote()
    ]);
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🧘</div>
                <h1 class="content-title">Практики</h1>
            </div>
            <div class="content-body">
                <div class="practice-card">
                    <h3>🌅 УТРЕННЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${morning}</div>
                    <button class="action-btn" id="speakMorningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🌙 ВЕЧЕРНЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${evening}</div>
                    <button class="action-btn" id="speakEveningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🎲 СЛУЧАЙНОЕ УПРАЖНЕНИЕ</h3>
                    <div class="intervention-text">${exercise}</div>
                    <button class="action-btn" id="newExerciseBtn" style="margin-top: 12px;">🔄 Другое упражнение</button>
                    <button class="action-btn" id="speakExerciseBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="quote-card">
                    <h3>📖 ЦИТАТА ДНЯ</h3>
                    <div class="intervention-text" style="font-style: italic;">${quote}</div>
                    <button class="action-btn" id="newQuoteBtn" style="margin-top: 12px;">🔄 Другая цитата</button>
                    <button class="action-btn" id="speakQuoteBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakMorningBtn')?.addEventListener('click', async () => {
        const tts = await textToSpeech(morning, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    document.getElementById('speakEveningBtn')?.addEventListener('click', async () => {
        const tts = await textToSpeech(evening, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    document.getElementById('newExerciseBtn')?.addEventListener('click', async () => {
        const newExercise = await getRandomExercise();
        const exerciseDiv = document.querySelector('.practice-card:nth-child(3) .intervention-text');
        if (exerciseDiv) exerciseDiv.textContent = newExercise;
    });
    document.getElementById('newQuoteBtn')?.addEventListener('click', async () => {
        const newQuote = await getRandomQuote();
        const quoteDiv = document.querySelector('.quote-card .intervention-text');
        if (quoteDiv) quoteDiv.textContent = newQuote;
    });
}

async function showHypnosis() {
    const container = document.getElementById('screenContainer');
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Гипноз</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics">
                    <button class="topic-btn" data-topic="тревога">Тревога</button>
                    <button class="topic-btn" data-topic="уверенность">Уверенность</button>
                    <button class="topic-btn" data-topic="спокойствие">Спокойствие</button>
                    <button class="topic-btn" data-topic="сон">Сон</button>
                    <button class="topic-btn" data-topic="вдохновение">Вдохновение</button>
                </div>
                <textarea class="hypno-input" id="hypnoInput" rows="3" placeholder="Напишите, что вас беспокоит..."></textarea>
                <button class="action-btn primary-btn" id="processHypnoBtn">🌙 Получить гипнотический ответ</button>
                
                <div id="hypnoResponse" style="margin-top: 20px;"></div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>🎧 ПОДДЕРЖКА</h3>
                    <button class="action-btn" id="supportBtn">Получить поддерживающий ответ</button>
                    <div id="supportResponse" style="margin-top: 12px;"></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const topic = btn.dataset.topic;
            const input = document.getElementById('hypnoInput');
            input.value = `Я чувствую ${topic}`;
            const response = await processHypno(input.value);
            document.getElementById('hypnoResponse').innerHTML = `
                <div class="intervention-card">
                    <div class="intervention-text">${response}</div>
                    <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
                </div>
            `;
            document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
                const tts = await textToSpeech(response, currentMode);
                if (tts?.audio_url) playAudioResponse(tts.audio_url);
            });
        });
    });
    
    document.getElementById('processHypnoBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('hypnoInput').value;
        if (!input.trim()) {
            showToast('Напишите, что вас беспокоит', 'info');
            return;
        }
        showToast('Формирую гипнотический ответ...', 'info');
        const response = await processHypno(input);
        document.getElementById('hypnoResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${response}</div>
                <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
            const tts = await textToSpeech(response, currentMode);
            if (tts?.audio_url) playAudioResponse(tts.audio_url);
        });
    });
    
    document.getElementById('supportBtn')?.addEventListener('click', async () => {
        const support = await getHypnoSupport();
        document.getElementById('supportResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${support}</div>
                <button class="action-btn" id="speakSupportBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakSupportBtn')?.addEventListener('click', async () => {
            const tts = await textToSpeech(support, currentMode);
            if (tts?.audio_url) playAudioResponse(tts.audio_url);
        });
    });
}

async function showTales() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю библиотеку сказок...', 'info');
    
    const talesData = await getTales();
    const talesList = talesData.available_tales || [];
    
    let talesHtml = '';
    if (talesList.length) {
        talesList.forEach(tale => {
            talesHtml += `
                <div class="tale-card" data-tale-id="${tale}">
                    <div class="loop-type">📖 ${tale}</div>
                    <div class="loop-desc">Терапевтическая сказка</div>
                </div>
            `;
        });
    } else {
        talesHtml = '<p>Сказки загружаются...</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📚</div>
                <h1 class="content-title">Терапевтические сказки</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics" style="margin-bottom: 20px;">
                    <button class="topic-btn" data-issue="страх">Страх</button>
                    <button class="topic-btn" data-issue="одиночество">Одиночество</button>
                    <button class="topic-btn" data-issue="уверенность">Уверенность</button>
                    <button class="topic-btn" data-issue="потеря">Потеря</button>
                    <button class="topic-btn" data-issue="любовь">Любовь</button>
                </div>
                <div id="taleContent"></div>
                <h3>📚 БИБЛИОТЕКА СКАЗОК</h3>
                <div id="talesList">
                    ${talesHtml}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const issue = btn.dataset.issue;
            showToast(`Ищу сказку на тему "${issue}"...`, 'info');
            const data = await apiCall(`/api/tale?issue=${issue}`);
            if (data.tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 Сказка</h3>
                        <div class="intervention-text">${data.tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    const tts = await textToSpeech(data.tale, currentMode);
                    if (tts?.audio_url) playAudioResponse(tts.audio_url);
                });
            }
        });
    });
    
    document.querySelectorAll('.tale-card').forEach(card => {
        card.addEventListener('click', async () => {
            const taleId = card.dataset.taleId;
            const tale = await getTaleById(taleId);
            if (tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 ${taleId}</h3>
                        <div class="intervention-text">${tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    const tts = await textToSpeech(tale, currentMode);
                    if (tts?.audio_url) playAudioResponse(tts.audio_url);
                });
            }
        });
    });
}

async function showAnchors() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю якоря...', 'info');
    
    const anchors = await getUserAnchors();
    
    let anchorsHtml = '';
    if (anchors && anchors.length) {
        anchors.forEach(anchor => {
            anchorsHtml += `
                <div class="anchor-card">
                    <div>
                        <div class="loop-type">${anchor.name}</div>
                        <div class="anchor-phrase">${anchor.phrase}</div>
                        <div class="loop-strength">Состояние: ${anchor.state}</div>
                    </div>
                    <button class="action-btn fire-anchor" data-name="${anchor.name}" style="padding: 6px 12px;">🔥 Активировать</button>
                </div>
            `;
        });
    } else {
        anchorsHtml = '<p>У вас пока нет якорей. Создайте свой первый якорь.</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">⚓</div>
                <h1 class="content-title">Мои якоря</h1>
            </div>
            <div class="content-body">
                <h3>📋 АКТИВНЫЕ ЯКОРЯ</h3>
                <div id="anchorsList">
                    ${anchorsHtml}
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>➕ СОЗДАТЬ НОВЫЙ ЯКОРЬ</h3>
                    <input type="text" id="anchorName" placeholder="Название якоря" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <input type="text" id="anchorState" placeholder="Состояние (например: спокойствие)" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <textarea id="anchorPhrase" placeholder="Фраза-якорь" rows="2" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; color: white;"></textarea>
                    <button class="action-btn primary-btn" id="createAnchorBtn">✨ СОЗДАТЬ</button>
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>💡 ПРЕДЛОЖЕННЫЕ ЯКОРЯ</h3>
                    <button class="action-btn" id="anchorCalmBtn" style="margin: 5px;">😌 Спокойствие</button>
                    <button class="action-btn" id="anchorConfidenceBtn" style="margin: 5px;">💪 Уверенность</button>
                    <button class="action-btn" id="anchorHereBtn" style="margin: 5px;">🧘 Здесь и сейчас</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.fire-anchor').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name;
            const phrase = await fireAnchor(name);
            if (phrase) {
                showToast(`Активирован якорь: ${phrase}`, 'success');
                const tts = await textToSpeech(phrase, currentMode);
                if (tts?.audio_url) playAudioResponse(tts.audio_url);
            }
        });
    });
    
    document.getElementById('createAnchorBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('anchorName').value;
        const state = document.getElementById('anchorState').value;
        const phrase = document.getElementById('anchorPhrase').value;
        if (!name || !state || !phrase) {
            showToast('Заполните все поля', 'error');
            return;
        }
        const result = await setAnchor(name, state, phrase);
        if (result && result.success) {
            showToast('Якорь создан!', 'success');
            showAnchors();
        } else {
            showToast('Не удалось создать якорь', 'error');
        }
    });
    
    document.getElementById('anchorCalmBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('calm');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    
    document.getElementById('anchorConfidenceBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('confidence');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    
    document.getElementById('anchorHereBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('here');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
}

async function showStatistics() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю статистику...', 'info');
    
    const stats = await getConfinementStatistics();
    const status = await getUserStatus();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Статистика</h1>
            </div>
            <div class="content-body">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_elements || 0}</div><div class="stat-label">Всего элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.active_elements || 0}</div><div class="stat-label">Активных элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.total_loops || 0}</div><div class="stat-label">Найдено петель</div></div>
                    <div class="stat-card"><div class="stat-value">${Math.round((stats.closure_score || 0) * 100)}%</div><div class="stat-label">Степень замыкания</div></div>
                </div>
                
                <div class="key-confinement" style="margin-top: 20px;">
                    <div class="key-title">${stats.is_system_closed ? '🔒 СИСТЕМА ЗАМКНУТА' : '🔓 СИСТЕМА ОТКРЫТА'}</div>
                    <div class="key-desc">${stats.is_system_closed ? 'Требуется работа с ключевыми элементами для разрыва петель' : 'Система готова к изменениям'}</div>
                </div>
                
                <div class="practice-card">
                    <h3>🧠 ПРОФИЛЬ</h3>
                    <div class="intervention-text">Код: ${status.profile_code || CONFIG.PROFILE_CODE}</div>
                    <div class="intervention-text">Тест: ${status.test_completed ? '✅ Пройден' : '⏳ Не пройден'}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}

// ========== UI ФУНКЦИИ ==========

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

// ========== ОБРАБОТЧИКИ БЫСТРЫХ ДЕЙСТВИЙ ==========

async function handleShowProfile() {
    const profile = await getUserProfile();
    navigateTo('profile', { content: profile });
}

async function handleShowThoughts() {
    const thought = await getPsychologistThought();
    if (thought) navigateTo('thoughts', { content: thought });
    else showToast('Мысли психолога появятся после прохождения теста', 'info');
}

async function handleShowNewThought() {
    const newThought = await generateNewThought();
    if (newThought) navigateTo('thoughts', { content: newThought });
    else showToast('Не удалось сгенерировать мысль', 'error');
}

async function handleShowWeekend() {
    const ideas = await getWeekendIdeas();
    if (ideas.length) navigateTo('weekend', { content: ideas.map(i => i.description || i).join('\n\n') });
    else showToast('Идеи скоро появятся', 'info');
}

async function handleShowGoals() {
    const goals = await getUserGoals();
    if (goals.length) navigateTo('goals', { content: goals.map(g => `**${g.name}**\n⏱ ${g.time || '?'}  |  🎯 ${g.difficulty || 'medium'}\n${g.is_priority ? '🔐 Приоритетная цель' : ''}`).join('\n\n') });
    else showToast('Цели появятся после прохождения теста', 'info');
}

async function handleShowQuestions() {
    const questions = await getSmartQuestions();
    if (questions.length) navigateTo('questions', { content: questions.map((q, i) => `${i+1}. ${q}`).join('\n\n') });
    else showToast('Вопросы появятся после прохождения теста', 'info');
}

async function handleShowChallenges() {
    const challenges = await getChallenges();
    if (challenges.length) navigateTo('challenges', { content: challenges.map(c => `**${c.name}**\n${c.description}\n🎁 Награда: ${c.reward} очков`).join('\n\n') });
    else showToast('Челленджи появятся после прохождения теста', 'info');
}

async function handleShowDoubles() {
    const doubles = await findPsychometricDoubles();
    if (doubles.length) navigateTo('doubles', { content: doubles.map(d => `**${d.name}**\nПрофиль: ${d.profile_code}\nСхожесть: ${Math.round(d.similarity * 100)}%`).join('\n\n') });
    else showToast('Двойники появятся после прохождения теста', 'info');
}

// ========== ДАШБОРД ==========

function updateModeUI() {
    const config = MODES[currentMode];
    document.getElementById('modeLabel').textContent = config.name;
    document.getElementById('modeIndicator').style.background = config.color;
}

async function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    const config = MODES[mode];
    showToast(`Режим "${config.name}" активирован`, 'success');
    await apiCall('/api/save-mode', { method: 'POST', body: JSON.stringify({ user_id: CONFIG.USER_ID, mode }) });
    updateModeUI();
    renderDashboard();
}

function initMobileEnhancements() {
    if (window.innerWidth > 768) return;
    
    const container = document.getElementById('screenContainer');
    
    if (container) {
        let hasScrolled = false;
        
        container.addEventListener('scroll', () => {
            if (!hasScrolled && container.scrollTop > 50) {
                hasScrolled = true;
            }
        });
    }
    
    let isScrolling = false;
    const interactiveElements = document.querySelectorAll('.module-card, .quick-action, .mode-btn');
    
    container?.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(window.scrollEndTimer);
        window.scrollEndTimer = setTimeout(() => {
            isScrolling = false;
        }, 150);
    });
    
    interactiveElements.forEach(el => {
        el.addEventListener('click', (e) => {
            if (isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Подождите, скролл завершается...', 'info');
            }
        });
    });
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
    
    let touchStartX = 0;
    chatsPanel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });
    
    chatsPanel.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        if (touchEndX - touchStartX < -50) {
            chatsPanel.classList.remove('open');
        }
    });
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                chatsPanel.classList.remove('open');
            }
        });
    });
}

async function initWebSocket() {
    liveVoiceWS = new LiveVoiceWebSocket(CONFIG.USER_ID);
    
    liveVoiceWS.onStatusChange = (status) => {
        console.log('WebSocket status:', status);
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (voiceBtn) {
            if (status === 'connected') {
                voiceBtn.style.border = '2px solid #4caf50';
            } else if (status === 'ai_speaking') {
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
    
    liveVoiceWS.onTranscript = (text) => {
        addMessage(`🎤 ${text}`, 'system');
    };
    
    liveVoiceWS.onError = (error) => {
        showToast(`❌ ${error}`, 'error');
    };
    
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
        </div>
    `;
    
    if (window.innerWidth <= 768) {
        const swipeIndicator = document.getElementById('swipeIndicator');
        if (swipeIndicator) swipeIndicator.style.display = 'block';
    }
    
    // Инициализируем голосовую кнопку
    const voiceBtnElement = document.getElementById('mainVoiceBtn');
    if (voiceBtnElement) {
        const voiceHandler = new VoiceButtonHandler();
        voiceHandler.setupButton(voiceBtnElement);
    }
    
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
            }
        });
    });
    
    initMobileEnhancements();
}

// ========== TTS ФУНКЦИЯ ==========

async function textToSpeech(text, mode) {
    try {
        const formData = new URLSearchParams();
        formData.append('text', text);
        formData.append('mode', mode);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/voice/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        return { audio_url: audioUrl };
        
    } catch (error) {
        console.error('TTS error:', error);
        return null;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

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
    
    // Инициализируем WebSocket для живого голоса
    await initWebSocket();
    
    setTimeout(async () => {
        const hasMic = await checkMicrophonePermission();
        if (!hasMic) {
            console.log('Microphone permission not granted yet');
        }
    }, 1000);
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chat = item.dataset.chat;
            
            switch(chat) {
                case 'fredi':
                    renderDashboard();
                    break;
                case 'test':
                    if (window.Test && window.Test.start) {
                        window.Test.init(CONFIG.USER_ID);
                        window.Test.start();
                    } else {
                        console.error('Test module not loaded');
                        showToast('Тест загружается...', 'info');
                        const script = document.createElement('script');
                        script.src = '/test.js';
                        script.onload = () => {
                            window.Test.init(CONFIG.USER_ID);
                            window.Test.start();
                        };
                        document.head.appendChild(script);
                    }
                    break;
                case 'confinement':
                    navigateTo('confinement-model');
                    break;
                case 'practices':
                    navigateTo('practices');
                    break;
                case 'hypnosis':
                    navigateTo('hypnosis');
                    break;
                case 'tales':
                    navigateTo('tales');
                    break;
                case 'anchors':
                    navigateTo('anchors');
                    break;
                case 'statistics':
                    navigateTo('statistics');
                    break;
                default:
                    renderDashboard();
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
