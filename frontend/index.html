// ============================================
// АУДИО ПЛЕЕР (полностью сохранен)
// ============================================

class AudioPlayer {
    constructor() {
        this.audio = null;
        this.currentUrl = null;
        this.onPlayStart = null;
        this.onPlayEnd = null;
        this.onError = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    }
    
    play(audioData, mimeType = 'audio/mpeg') {
        return new Promise((resolve, reject) => {
            try {
                this.stop();
                
                this.audio = new Audio();
                let audioUrl = audioData;
                
                if (typeof audioData === 'string' && audioData.startsWith('data:audio/')) {
                    const matches = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
                    if (matches) {
                        const detectedMimeType = matches[1];
                        const base64Data = matches[2];
                        
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        
                        const blob = new Blob([bytes], { type: detectedMimeType });
                        audioUrl = URL.createObjectURL(blob);
                    }
                } 
                else if (typeof audioData === 'string' && audioData.startsWith('http')) {
                    audioUrl = audioData;
                }
                else if (audioData instanceof Blob) {
                    audioUrl = URL.createObjectURL(audioData);
                }
                
                this.currentUrl = audioUrl;
                this.audio.src = audioUrl;
                this.audio.load();
                
                // Для iOS нужно немного подождать
                const playHandler = () => {
                    if (this.onPlayStart) {
                        this.onPlayStart();
                    }
                    
                    this.audio.play().catch(error => {
                        console.error('Play failed:', error);
                        if (this.onError) {
                            this.onError(error);
                        }
                        reject(error);
                    });
                };
                
                this.audio.oncanplaythrough = playHandler;
                
                // Fallback для iOS, если oncanplaythrough не срабатывает
                setTimeout(() => {
                    if (this.audio && this.audio.readyState >= 2 && !this.audio.played.length) {
                        playHandler();
                    }
                }, 100);
                
                this.audio.onended = () => {
                    if (this.currentUrl && this.currentUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(this.currentUrl);
                    }
                    
                    if (this.onPlayEnd) {
                        this.onPlayEnd();
                    }
                    resolve();
                };
                
                this.audio.onerror = (error) => {
                    console.error('Audio error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                    reject(error);
                };
                
            } catch (error) {
                console.error('Playback error:', error);
                reject(error);
            }
        });
    }
    
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            
            if (this.currentUrl && this.currentUrl.startsWith('blob:')) {
                URL.revokeObjectURL(this.currentUrl);
            }
            
            this.audio = null;
            this.currentUrl = null;
        }
    }
    
    isPlaying() {
        return this.audio && !this.audio.paused && !this.audio.ended;
    }
    
    dispose() {
        this.stop();
    }
}

// ============================================
// ИНДИКАТОР ЗАГРУЗКИ "ФРЕДИ ДУМАЕТ"
// ============================================

class LoadingIndicator {
    constructor() {
        this.container = null;
        this.timeout = null;
        this.isShowing = false;
        this.animationInterval = null;
        this.dotsCount = 0;
        this.messageElement = null;
        this.dotsElement = null;
        this.warningTimeout = null;
    }
    
    create() {
        const messagesContainer = document.getElementById('screenContainer');
        if (!messagesContainer) return;
        
        this.remove();
        
        this.container = document.createElement('div');
        this.container.className = 'loading-indicator';
        this.container.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 50px;
            padding: 12px 24px;
            border: 1px solid rgba(224, 224, 224, 0.2);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        this.messageElement = document.createElement('span');
        this.messageElement.className = 'loading-text';
        this.messageElement.style.cssText = 'color: #ff6b3b; font-size: 14px;';
        this.messageElement.textContent = 'Фреди думает';
        
        this.dotsElement = document.createElement('span');
        this.dotsElement.className = 'loading-dots';
        this.dotsElement.style.cssText = 'color: #ff6b3b; font-size: 14px;';
        this.dotsElement.textContent = '...';
        
        this.container.appendChild(this.messageElement);
        this.container.appendChild(this.dotsElement);
        messagesContainer.appendChild(this.container);
        
        this.startAnimation();
        this.isShowing = true;
        
        // Первый таймаут — через 5 секунд меняем текст
        this.timeout = setTimeout(() => {
            if (this.isShowing) {
                this.messageElement.textContent = 'Всё ещё думаю';
                this.dotsElement.style.color = '#ffaa44';
            }
        }, 5000);
        
        // Второй таймаут — через 10 секунд предупреждение
        this.warningTimeout = setTimeout(() => {
            if (this.isShowing) {
                this.messageElement.textContent = 'Это займёт чуть больше времени';
                this.dotsElement.style.color = '#ff6b6b';
            }
        }, 10000);
    }
    
    startAnimation() {
        this.animationInterval = setInterval(() => {
            if (!this.isShowing) return;
            this.dotsCount = (this.dotsCount + 1) % 4;
            const dots = '.'.repeat(this.dotsCount) + ' '.repeat(3 - this.dotsCount);
            if (this.dotsElement) {
                this.dotsElement.textContent = dots;
            }
        }, 400);
    }
    
    updateMessage(message) {
        if (this.messageElement && this.isShowing) {
            this.messageElement.textContent = message;
        }
    }
    
    remove() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.warningTimeout) {
            clearTimeout(this.warningTimeout);
            this.warningTimeout = null;
        }
        if (this.container && this.container.remove) {
            this.container.remove();
        }
        this.container = null;
        this.messageElement = null;
        this.dotsElement = null;
        this.isShowing = false;
        this.dotsCount = 0;
    }
}

// ============================================
// КОНФИГУРАЦИЯ ГОЛОСА FREDI PREMIUM
// ============================================

const VoiceConfig = {
    apiBaseUrl: 'https://fredi-backend-flz2.onrender.com',
    useWebSocket: true,
    
    recording: {
        sampleRate: 16000,
        maxDuration: 60000,
        minDuration: 1000,
        chunkSize: 4096,
        format: 'wav',
        mimeType: 'audio/wav'
    },
    
    playback: {
        format: 'mp3',
        autoPlay: true,
        volume: 1.0,
        preload: true
    },
    
    voices: {
        coach: {
            name: 'Филипп',
            emoji: '🔮',
            speed: 1.0,
            pitch: 1.0,
            emotion: 'neutral'
        },
        psychologist: {
            name: 'Эрмил',
            emoji: '🧠',
            speed: 0.9,
            pitch: 0.95,
            emotion: 'calm'
        },
        trainer: {
            name: 'Филипп (энергичный)',
            emoji: '⚡',
            speed: 1.1,
            pitch: 1.05,
            emotion: 'energetic'
        }
    },
    
    ui: {
        showVolumeMeter: true,
        showRecordingTime: true,
        autoStopAfterSilence: true,
        silenceTimeout: 5000,
        minVolumeToConsiderSpeech: 5
    },
    
    debug: true
};

// ============================================
// VoiceWebSocket (с поддержкой iOS)
// ============================================

class VoiceWebSocket {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.config = { ...VoiceConfig, ...config };
        this.isConnected = false;
        this.isAISpeaking = false;
        this.currentMode = 'psychologist';
        this.useWebSocket = false;
        this.ws = null;
        
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onThinking = null;
        this.onWeather = null;
        this.onThinkingUpdate = null;
        
        this.apiBaseUrl = this.config.apiBaseUrl;
        this.pendingRequest = null;
        this.lastRequestTime = 0;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        // На iOS отключаем WebSocket (проблемы с соединением)
        if (this.isIOS) {
            console.log('📱 iOS detected, using HTTP only');
            this.useWebSocket = false;
        }
    }
    
    async connect() {
        // На iOS всегда используем HTTP
        if (this.isIOS || !this.config.useWebSocket) {
            return this.initHTTP();
        }
        
        if (this.config.useWebSocket && window.WebSocket) {
            try {
                const wsUrl = `wss://${new URL(this.apiBaseUrl).host}/ws/voice/${this.userId}`;
                console.log(`🔌 Connecting WebSocket: ${wsUrl}`);
                
                this.ws = new WebSocket(wsUrl);
                
                const connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        console.warn('WebSocket connection timeout, falling back to HTTP');
                        this.useWebSocket = false;
                        this.initHTTP();
                    }
                }, 5000);
                
                this.ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log('✅ WebSocket connected');
                    this.isConnected = true;
                    this.useWebSocket = true;
                    this.updateStatus('connected');
                    
                    this.ws.send(JSON.stringify({
                        type: 'init',
                        mode: this.currentMode,
                        timestamp: Date.now()
                    }));
                };
                
                this.ws.onmessage = (event) => {
                    this.handleWebSocketMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.warn('WebSocket error:', error);
                    if (!this.useWebSocket) return;
                    this.useWebSocket = false;
                    this.initHTTP();
                };
                
                this.ws.onclose = () => {
                    console.log('WebSocket closed');
                    if (this.useWebSocket) {
                        this.useWebSocket = false;
                        this.initHTTP();
                    }
                };
                
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
                    this.ws.onopen = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    this.ws.onerror = () => reject(new Error('WebSocket failed'));
                });
                
                return true;
                
            } catch (error) {
                console.warn('WebSocket failed:', error);
                this.useWebSocket = false;
            }
        }
        
        return this.initHTTP();
    }
    
    initHTTP() {
        console.log('📡 HTTP mode active (fallback)');
        this.isConnected = true;
        this.useWebSocket = false;
        this.updateStatus('connected');
        return true;
    }
    
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'text':
                    if (message.data) {
                        if (message.data.includes('Вы:') && this.onTranscript) {
                            const text = message.data.replace('🎤 Вы: ', '');
                            this.onTranscript(text);
                        } else if (message.data.includes('Фреди:') && this.onAIResponse) {
                            const text = message.data.replace('🧠 Фреди: ', '');
                            this.onAIResponse(text);
                        }
                    }
                    break;
                    
                case 'audio':
                    if (message.data) {
                        this.playAudioResponse(message.data);
                    }
                    break;
                    
                case 'status':
                    this.updateStatus(message.status);
                    break;
                    
                case 'thinking':
                    if (this.onThinkingUpdate) {
                        this.onThinkingUpdate(message.message || 'Фреди думает');
                    }
                    break;
                    
                case 'error':
                    if (this.onError) {
                        this.onError(message.error);
                    }
                    break;
                    
                case 'ping':
                    if (this.ws && this.useWebSocket) {
                        this.ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: message.timestamp
                        }));
                    }
                    break;
                    
                case 'weather':
                    if (this.onWeather && message.data) {
                        this.onWeather(message.data);
                    }
                    break;
            }
            
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    }
    
    updateStatus(status) {
        switch (status) {
            case 'speaking':
                this.isAISpeaking = true;
                break;
            case 'idle':
            case 'connected':
                this.isAISpeaking = false;
                break;
        }
        
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }
    
    async sendFullAudio(audioBlob, retryCount = 0) {
        const maxRetries = 3;
        const minBytes = this.config.recording.minDuration * 
                        (this.config.recording.sampleRate / 1000) * 2;
        
        if (audioBlob.size < minBytes) {
            console.warn(`⚠️ Audio too short: ${audioBlob.size} bytes < ${minBytes} bytes`);
            if (this.onError) {
                this.onError('Говорите дольше (минимум 1 секунду)');
            }
            return false;
        }
        
        const maxBytes = this.config.recording.maxDuration * 
                        (this.config.recording.sampleRate / 1000) * 2;
        
        if (audioBlob.size > maxBytes) {
            console.warn(`⚠️ Audio too long: ${audioBlob.size} bytes > ${maxBytes} bytes`);
            if (this.onError) {
                this.onError('Сообщение слишком длинное (максимум 60 секунд)');
            }
            return false;
        }
        
        if (this.useWebSocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
            return this.sendAudioViaWebSocket(audioBlob);
        }
        
        return this.sendAudioViaHTTP(audioBlob, retryCount, maxRetries);
    }
    
    async sendAudioViaWebSocket(audioBlob) {
        return new Promise((resolve) => {
            try {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Data = reader.result.split(',')[1];
                    
                    this.ws.send(JSON.stringify({
                        type: 'audio_chunk',
                        data: base64Data,
                        format: this.config.recording.format,
                        sample_rate: this.config.recording.sampleRate,
                        is_final: true,
                        timestamp: Date.now()
                    }));
                    
                    this.updateStatus('processing');
                    resolve(true);
                };
                reader.readAsDataURL(audioBlob);
                
            } catch (error) {
                console.error('WebSocket audio send error:', error);
                resolve(this.sendAudioViaHTTP(audioBlob));
            }
        });
    }
    
    async sendAudioViaHTTP(audioBlob, retryCount = 0, maxRetries = 3) {
        const formData = new FormData();
        formData.append('user_id', this.userId);
        
        // Для iOS используем правильный MIME тип
        let audioFormat = this.config.recording.format;
        if (this.isIOS && audioBlob.type) {
            if (audioBlob.type.includes('mp4')) audioFormat = 'mp4';
            else if (audioBlob.type.includes('aac')) audioFormat = 'aac';
        }
        
        formData.append('voice', audioBlob, `audio.${audioFormat}`);
        formData.append('mode', this.currentMode || 'psychologist');
        formData.append('ios_device', this.isIOS ? 'true' : 'false');
        
        const voiceSettings = this.config.voices[this.currentMode];
        if (voiceSettings) {
            formData.append('voice_speed', voiceSettings.speed);
            formData.append('voice_pitch', voiceSettings.pitch);
            formData.append('voice_emotion', voiceSettings.emotion);
        }
        
        this.updateStatus('processing');
        
        if (this.onThinking) {
            this.onThinking(true);
        }
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(45000) // Увеличиваем таймаут для iOS
            });
            
            const elapsed = Date.now() - startTime;
            if (this.config.debug) {
                console.log(`📊 Request completed in ${elapsed}ms`);
            }
            
            if (!response.ok && retryCount < maxRetries) {
                console.log(`🔄 Повторная попытка ${retryCount + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                return this.sendAudioViaHTTP(audioBlob, retryCount + 1, maxRetries);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (this.onThinking) {
                this.onThinking(false);
            }
            
            if (result.success) {
                if (this.config.debug) {
                    console.log('✅ Распознано:', result.recognized_text);
                }
                
                if (this.onTranscript && result.recognized_text) {
                    this.onTranscript(result.recognized_text);
                }
                
                if (this.onAIResponse && result.answer) {
                    this.onAIResponse(result.answer);
                }
                
                if (result.audio_base64) {
                    await this.playAudioResponse(result.audio_base64);
                } else if (result.audio_url) {
                    await this.playAudioFromUrl(result.audio_url);
                }
                
                this.updateStatus('idle');
                return true;
            } else {
                throw new Error(result.error || 'Ошибка распознавания');
            }
            
        } catch (error) {
            console.error('HTTP error:', error);
            
            if (this.onThinking) {
                this.onThinking(false);
            }
            
            if (retryCount < maxRetries) {
                console.log(`🔄 Повторная попытка ${retryCount + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                return this.sendAudioViaHTTP(audioBlob, retryCount + 1, maxRetries);
            }
            
            let errorMessage = 'Ошибка соединения';
            if (error.name === 'TimeoutError') {
                errorMessage = 'Сервер не отвечает. Попробуйте позже.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Ошибка на сервере. Мы уже чиним.';
            } else if (error.message.includes('429')) {
                errorMessage = 'Слишком много запросов. Подождите немного.';
            }
            
            if (this.onError) {
                this.onError(errorMessage);
            }
            this.updateStatus('idle');
            return false;
        }
    }
    
    async playAudioResponse(audioBase64) {
        return new Promise((resolve, reject) => {
            try {
                const audio = new Audio();
                audio.src = `data:audio/mpeg;base64,${audioBase64}`;
                audio.volume = this.config.playback.volume;
                
                this.updateStatus('speaking');
                
                audio.onended = () => {
                    this.updateStatus('idle');
                    resolve();
                };
                
                audio.onerror = (error) => {
                    console.error('Playback error:', error);
                    this.updateStatus('idle');
                    
                    // Для iOS пробуем альтернативный метод
                    if (this.isIOS) {
                        const audio2 = new Audio();
                        audio2.src = `data:audio/mpeg;base64,${audioBase64}`;
                        audio2.load();
                        audio2.play().catch(reject);
                        audio2.onended = resolve;
                    } else {
                        reject(error);
                    }
                };
                
                audio.play().catch(reject);
                
            } catch (error) {
                console.error('Playback error:', error);
                this.updateStatus('idle');
                reject(error);
            }
        });
    }
    
    async playAudioFromUrl(url) {
        return new Promise((resolve, reject) => {
            try {
                const audio = new Audio(url);
                audio.volume = this.config.playback.volume;
                
                this.updateStatus('speaking');
                
                audio.onended = () => {
                    this.updateStatus('idle');
                    resolve();
                };
                
                audio.onerror = (error) => {
                    console.error('Playback error:', error);
                    this.updateStatus('idle');
                    reject(error);
                };
                
                audio.play().catch(reject);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async getWeather() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/weather/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.weather) {
                if (this.onWeather) {
                    this.onWeather(data.weather);
                }
                return data.weather;
            }
            return null;
        } catch (error) {
            console.error('Weather fetch error:', error);
            return null;
        }
    }
    
    async getWeatherByCity(city) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/weather/by-city?city=${encodeURIComponent(city)}`);
            const data = await response.json();
            
            if (data.success && data.weather) {
                return data.weather;
            }
            return null;
        } catch (error) {
            console.error('Weather fetch error:', error);
            return null;
        }
    }
    
    async setUserCity(city) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/weather/set-city`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId, city: city })
            });
            
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Set city error:', error);
            return false;
        }
    }
    
    interrupt() {
        if (this.ws && this.useWebSocket && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'interrupt', timestamp: Date.now() }));
        }
        
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        this.updateStatus('idle');
        console.log('🛑 Interrupted');
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        console.log('🔌 Disconnected');
    }
}

// ============================================
// VoiceRecorder (с поддержкой iOS)
// ============================================

class VoiceRecorder {
    constructor(config = {}) {
        this.config = { ...VoiceConfig.recording, ...config };
        this.isRecording = false;
        this.mediaStream = null;
        this.audioContext = null;
        this.processor = null;
        this.wavData = [];
        this.recordingTimeout = null;
        this.silenceTimer = null;
        this.visualizerAnimation = null;
        this.analyser = null;
        this.silenceStartTime = null;
        this.speechDetected = false;
        this.lastVolume = 0;
        
        // ДОБАВЛЯЕМ ДЛЯ iOS
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        this.onDataAvailable = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVolumeChange = null;
        this.onError = null;
        this.onSpeechDetected = null;
    }
    
    async startRecording() {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.config.sampleRate,
                    channelCount: 1
                }
            });
            
            this.mediaStream = stream;
            this.wavData = [];
            this.audioChunks = [];
            this.speechDetected = false;
            this.silenceStartTime = null;
            this.lastVolume = 0;
            this.isRecording = true;
            
            // ДОБАВЛЯЕМ: Для iOS используем MediaRecorder
            if (this.isIOS && window.MediaRecorder) {
                const mimeTypes = ['audio/mp4', 'audio/aac', 'audio/wav'];
                let selectedMimeType = '';
                
                for (const mimeType of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(mimeType)) {
                        selectedMimeType = mimeType;
                        break;
                    }
                }
                
                if (selectedMimeType) {
                    this.mediaRecorder = new MediaRecorder(stream, {
                        mimeType: selectedMimeType
                    });
                    
                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data && event.data.size > 0) {
                            this.audioChunks.push(event.data);
                        }
                    };
                    
                    this.mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(this.audioChunks, { 
                            type: selectedMimeType 
                        });
                        
                        if (this.onRecordingStop) {
                            this.onRecordingStop(audioBlob);
                        }
                    };
                    
                    this.mediaRecorder.start(1000);
                } else {
                    await this.setupLegacyRecording(stream);
                }
            } else {
                await this.setupLegacyRecording(stream);
            }
            
            // Анализатор громкости для всех устройств
            this.setupVolumeAnalyzer(stream);
            
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) {
                    console.log('⏱️ Max recording duration reached');
                    this.stopRecording();
                }
            }, this.config.maxDuration);
            
            if (this.onRecordingStart) {
                this.onRecordingStart();
            }
            
            console.log('🎙️ Recording started on', this.isIOS ? 'iOS' : 'other');
            return true;
            
        } catch (error) {
            console.error('Start recording error:', error);
            
            let errorMessage = 'Не удалось получить доступ к микрофону';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Пожалуйста, разрешите доступ к микрофону';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Микрофон не найден';
            }
            
            if (this.onError) {
                this.onError(errorMessage);
            }
            this.isRecording = false;
            return false;
        }
    }
    
    async setupLegacyRecording(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.config.sampleRate
        });
        
        // Для iOS нужно активировать AudioContext
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        
        this.startVisualizer();
        
        this.processor = this.audioContext.createScriptProcessor(this.config.chunkSize, 1, 1);
        
        this.processor.onaudioprocess = (event) => {
            if (!this.isRecording) return;
            
            const inputData = event.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
            let sumAbs = 0;
            
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                int16Data[i] = Math.floor(sample * 32767);
                sumAbs += Math.abs(int16Data[i]);
            }
            
            this.wavData.push(int16Data);
            const volume = Math.min(100, (sumAbs / int16Data.length / 32768) * 100);
            this.lastVolume = volume;
            
            const isSpeech = volume > VoiceConfig.ui.minVolumeToConsiderSpeech;
            
            if (isSpeech) {
                if (!this.speechDetected) {
                    this.speechDetected = true;
                    if (this.onSpeechDetected) {
                        this.onSpeechDetected(true);
                    }
                }
                this.silenceStartTime = null;
            } else if (this.speechDetected && !this.silenceStartTime) {
                this.silenceStartTime = Date.now();
            }
            
            if (VoiceConfig.ui.autoStopAfterSilence && 
                this.speechDetected && 
                this.silenceStartTime && 
                (Date.now() - this.silenceStartTime) > VoiceConfig.ui.silenceTimeout) {
                console.log('🔇 Silence detected, auto-stopping');
                this.stopRecording();
            }
            
            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
            }
        };
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }
    
    setupVolumeAnalyzer(stream) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const updateVolume = () => {
            if (!this.isRecording) return;
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            let volume = Math.min(100, (average / 255) * 100);
            
            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
            }
            
            this.visualizerAnimation = requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
        
        this.volumeAnalyser = analyser;
        this.volumeContext = audioContext;
    }
    
    stopRecording() {
        if (!this.isRecording) return null;
        
        this.isRecording = false;
        
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        if (this.visualizerAnimation) {
            cancelAnimationFrame(this.visualizerAnimation);
            this.visualizerAnimation = null;
        }
        
        let audioBlob = null;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            audioBlob = new Blob(this.audioChunks, { type: 'audio/mp4' });
        } 
        else if (this.wavData && this.wavData.length > 0) {
            audioBlob = this.createWavBlob(this.wavData);
        }
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        
        if (this.volumeContext) {
            this.volumeContext.close().catch(console.warn);
            this.volumeContext = null;
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.onRecordingStop && audioBlob) {
            this.onRecordingStop(audioBlob);
        }
        
        console.log('⏹️ Recording stopped');
        return audioBlob;
    }
    
    createWavBlob(audioData) {
        let totalLength = 0;
        for (const chunk of audioData) {
            totalLength += chunk.length;
        }
        
        const MAX_SAMPLES = this.config.maxDuration * this.config.sampleRate / 1000;
        if (totalLength > MAX_SAMPLES) {
            console.warn(`Audio too long, truncating to ${MAX_SAMPLES} samples`);
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
        
        const sampleRate = this.config.sampleRate;
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
        
        return new Blob([buffer], { type: `audio/${this.config.format}` });
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    startVisualizer() {
        if (!this.analyser) return;
        
        const updateVolume = () => {
            if (!this.isRecording || !this.analyser) return;
            
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(dataArray);
            let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            let volume = Math.min(100, (average / 255) * 100);
            
            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
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
        this.analyser = null;
    }
    
    isRecordingActive() {
        return this.isRecording;
    }
    
    dispose() {
        this.stopRecording();
    }
}

// ============================================
// VoiceManager (с поддержкой iOS)
// ============================================

class VoiceManager {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.config = { ...VoiceConfig, ...config };
        this.websocket = null;
        this.recorder = null;
        this.player = null;
        this.loadingIndicator = null;
        
        this.isRecording = false;
        this.isAISpeaking = false;
        this.currentMode = 'psychologist';
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVolumeChange = null;
        this.onThinking = null;
        this.onSpeechDetected = null;
        this.onWeather = null;
        
        this.init();
    }
    
    init() {
        this.loadingIndicator = new LoadingIndicator();
        
        this.player = new AudioPlayer();
        this.player.onPlayStart = () => {
            this.isAISpeaking = true;
            this.updateStatus('speaking');
        };
        this.player.onPlayEnd = () => {
            this.isAISpeaking = false;
            this.updateStatus('idle');
        };
        this.player.onError = (error) => {
            console.error('Player error:', error);
            if (this.onError) {
                this.onError('Ошибка воспроизведения');
            }
        };
        
        this.recorder = new VoiceRecorder(this.config.recording);
        
        this.recorder.onRecordingStart = () => {
            this.isRecording = true;
            if (this.onRecordingStart) {
                this.onRecordingStart();
            }
            this.updateStatus('recording');
        };
        
        this.recorder.onRecordingStop = (audioBlob) => {
            this.isRecording = false;
            if (this.onRecordingStop) {
                this.onRecordingStop(audioBlob);
            }
            
            if (audioBlob && audioBlob.size > 0) {
                this.sendAudio(audioBlob);
            }
            
            this.updateStatus('idle');
        };
        
        this.recorder.onVolumeChange = (volume) => {
            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
            }
        };
        
        this.recorder.onError = (error) => {
            if (this.onError) {
                this.onError(error);
            }
        };
        
        this.recorder.onSpeechDetected = (detected) => {
            if (this.onSpeechDetected) {
                this.onSpeechDetected(detected);
            }
        };
        
        this.initWebSocket();
    }
    
    async initWebSocket() {
        console.log('🎤 Initializing voice service...');
        this.websocket = new VoiceWebSocket(this.userId, this.config);
        this.websocket.currentMode = this.currentMode;
        
        this.websocket.onTranscript = (text) => {
            if (this.onTranscript) {
                this.onTranscript(text);
            }
        };
        
        this.websocket.onAIResponse = (answer) => {
            if (this.onAIResponse) {
                this.onAIResponse(answer);
            }
        };
        
        this.websocket.onThinking = (isThinking) => {
            if (this.onThinking) {
                this.onThinking(isThinking);
            }
        };
        
        this.websocket.onThinkingUpdate = (message) => {
            if (this.loadingIndicator && this.loadingIndicator.isShowing) {
                this.loadingIndicator.updateMessage(message);
            }
        };
        
        this.websocket.onStatusChange = (status) => {
            if (status === 'speaking') {
                this.isAISpeaking = true;
                if (this.loadingIndicator) {
                    this.loadingIndicator.remove();
                }
            } else if (status === 'idle') {
                this.isAISpeaking = false;
                if (this.loadingIndicator) {
                    this.loadingIndicator.remove();
                }
            } else if (status === 'processing') {
                if (this.loadingIndicator && this.loadingIndicator.isShowing) {
                    this.loadingIndicator.updateMessage('Распознаю речь...');
                }
            }
            this.updateStatus(status);
        };
        
        this.websocket.onError = (error) => {
            if (this.onError) {
                this.onError(error);
            }
            if (this.loadingIndicator) {
                this.loadingIndicator.remove();
            }
        };
        
        this.websocket.onWeather = (weather) => {
            if (this.onWeather) {
                this.onWeather(weather);
            }
        };
        
        await this.websocket.connect();
    }
    
    async sendAudio(audioBlob) {
        if (this.loadingIndicator) {
            this.loadingIndicator.create();
        }
        return this.websocket.sendFullAudio(audioBlob);
    }
    
    async textToSpeech(text, mode) {
        try {
            const formData = new URLSearchParams();
            formData.append('text', text);
            formData.append('mode', mode || this.currentMode);
            
            const voiceSettings = this.config.voices[mode || this.currentMode];
            if (voiceSettings) {
                formData.append('speed', voiceSettings.speed);
                formData.append('pitch', voiceSettings.pitch);
                formData.append('emotion', voiceSettings.emotion);
            }
            
            const response = await fetch(`${this.config.apiBaseUrl}/api/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            await this.player.play(audioUrl);
            
            return { audio_url: audioUrl };
            
        } catch (error) {
            console.error('TTS error:', error);
            if (this.onError) {
                this.onError('Ошибка синтеза речи');
            }
            return null;
        }
    }
    
    async getWeather() {
        return this.websocket.getWeather();
    }
    
    async getWeatherByCity(city) {
        return this.websocket.getWeatherByCity(city);
    }
    
    async setUserCity(city) {
        return this.websocket.setUserCity(city);
    }
    
    startRecording() {
        if (this.isAISpeaking) {
            this.interrupt();
            setTimeout(() => {
                this.recorder.startRecording();
            }, 300);
        } else {
            this.recorder.startRecording();
        }
    }
    
    stopRecording() {
        return this.recorder.stopRecording();
    }
    
    interrupt() {
        if (this.websocket) {
            this.websocket.interrupt();
        }
        if (this.player) {
            this.player.stop();
        }
        this.isAISpeaking = false;
        if (this.loadingIndicator) {
            this.loadingIndicator.remove();
        }
    }
    
    updateStatus(status) {
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }
    
    setMode(mode) {
        this.currentMode = mode;
        if (this.websocket) {
            this.websocket.currentMode = mode;
        }
        
        if (this.config.debug) {
            const voiceInfo = this.config.voices[mode];
            console.log(`🎭 Mode changed to: ${mode} (${voiceInfo?.name || 'unknown'})`);
        }
    }
    
    isRecordingActive() {
        return this.recorder?.isRecordingActive() || false;
    }
    
    isSpeaking() {
        return this.isAISpeaking;
    }
    
    getCurrentMode() {
        return this.currentMode;
    }
    
    getVoiceSettings() {
        return this.config.voices[this.currentMode] || this.config.voices.psychologist;
    }
    
    dispose() {
        if (this.loadingIndicator) {
            this.loadingIndicator.remove();
        }
        if (this.recorder) {
            this.recorder.dispose();
        }
        if (this.player) {
            this.player.dispose();
        }
        if (this.websocket) {
            this.websocket.disconnect();
        }
    }
}

// ============================================
// ЭКСПОРТ
// ============================================

if (typeof window !== 'undefined') {
    window.AudioPlayer = AudioPlayer;
    window.LoadingIndicator = LoadingIndicator;
    window.VoiceManager = VoiceManager;
    window.VoiceConfig = VoiceConfig;
    window.VoiceWebSocket = VoiceWebSocket;
    window.VoiceRecorder = VoiceRecorder;
}
