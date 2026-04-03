// ============================================
// АУДИО ПЛЕЕР
// ============================================

class AudioPlayer {
    constructor() {
        this.audio = null;
        this.currentUrl = null;
        this.onPlayStart = null;
        this.onPlayEnd = null;
        this.onError = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.userInteractionOccurred = false;
        
        this._handleInteraction = () => {
            this.userInteractionOccurred = true;
            document.removeEventListener('touchstart', this._handleInteraction);
            document.removeEventListener('click', this._handleInteraction);
        };
        document.addEventListener('touchstart', this._handleInteraction);
        document.addEventListener('click', this._handleInteraction);
    }
    
    play(audioData, mimeType = 'audio/mpeg') {
        return new Promise(async (resolve, reject) => {
            try {
                this.stop();
                this.audio = new Audio();
                let audioUrl = audioData;
                
                if (typeof audioData === 'string' && audioData.startsWith('data:audio/')) {
                    const matches = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
                    if (matches) {
                        try {
                            const binary = atob(matches[2]);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                            audioUrl = URL.createObjectURL(new Blob([bytes], { type: matches[1] }));
                        } catch (e) {
                            reject(new Error('Ошибка декодирования аудио'));
                            return;
                        }
                    }
                } else if (audioData instanceof Blob) {
                    audioUrl = URL.createObjectURL(audioData);
                }
                
                this.currentUrl = audioUrl;
                this.audio.src = audioUrl;
                this.audio.load();
                this.audio.volume = 1.0;
                
                const playAudio = () => {
                    const p = this.audio.play();
                    if (p !== undefined) {
                        p.then(() => {
                            if (this.onPlayStart) this.onPlayStart();
                            resolve();
                        }).catch(error => {
                            if (this.isIOS && !this.userInteractionOccurred) {
                                this.onError && this.onError('Для воспроизведения коснитесь экрана');
                                reject(new Error('Требуется взаимодействие с пользователем'));
                            } else {
                                this.onError && this.onError(error);
                                reject(error);
                            }
                        });
                    }
                };
                
                let loadTimeout = setTimeout(() => { if (this.audio) playAudio(); }, 3000);
                this.audio.oncanplaythrough = () => { clearTimeout(loadTimeout); playAudio(); };
                setTimeout(() => {
                    if (this.audio && this.audio.readyState >= 2 && !this.audio.played.length) {
                        clearTimeout(loadTimeout);
                        playAudio();
                    }
                }, 100);
                
                this.audio.onended = () => {
                    if (this.currentUrl && this.currentUrl.startsWith('blob:')) URL.revokeObjectURL(this.currentUrl);
                    if (this.onPlayEnd) this.onPlayEnd();
                };
                
                this.audio.onerror = (error) => {
                    clearTimeout(loadTimeout);
                    if (this.onError) this.onError(error);
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            if (this.currentUrl && this.currentUrl.startsWith('blob:')) URL.revokeObjectURL(this.currentUrl);
            this.audio = null;
            this.currentUrl = null;
        }
    }
    
    isPlaying() { return this.audio && !this.audio.paused && !this.audio.ended; }
    dispose() { this.stop(); }
}

// ============================================
// ИНДИКАТОР ЗАГРУЗКИ
// ============================================

class LoadingIndicator {
    constructor() {
        this.container = null;
        this.timeout = null;
        this.warningTimeout = null;
        this.animationInterval = null;
        this.isShowing = false;
        this.dotsCount = 0;
        this.messageElement = null;
        this.dotsElement = null;
    }
    
    create() {
        this.remove();
        
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(10,10,10,0.95); backdrop-filter: blur(20px);
            border-radius: 50px; padding: 12px 24px;
            border: 1px solid rgba(224,224,224,0.2);
            z-index: 1000; display: flex; align-items: center; gap: 8px;
            pointer-events: none;
        `;
        
        this.messageElement = document.createElement('span');
        this.messageElement.style.cssText = 'color: #ff6b3b; font-size: 14px;';
        this.messageElement.textContent = 'Фреди думает';
        
        this.dotsElement = document.createElement('span');
        this.dotsElement.style.cssText = 'color: #ff6b3b; font-size: 14px;';
        this.dotsElement.textContent = '...';
        
        this.container.appendChild(this.messageElement);
        this.container.appendChild(this.dotsElement);
        document.body.appendChild(this.container); // Вешаем на body, а не на screenContainer
        
        this.isShowing = true;
        
        this.animationInterval = setInterval(() => {
            this.dotsCount = (this.dotsCount + 1) % 4;
            if (this.dotsElement) {
                this.dotsElement.textContent = '.'.repeat(this.dotsCount) + ' '.repeat(3 - this.dotsCount);
            }
        }, 400);
        
        this.timeout = setTimeout(() => {
            if (this.isShowing && this.messageElement) this.messageElement.textContent = 'Всё ещё думаю';
        }, 5000);
        
        this.warningTimeout = setTimeout(() => {
            if (this.isShowing && this.messageElement) this.messageElement.textContent = 'Это займёт чуть больше времени';
        }, 10000);
    }
    
    updateMessage(message) {
        if (this.messageElement && this.isShowing) this.messageElement.textContent = message;
    }
    
    remove() {
        clearInterval(this.animationInterval);
        clearTimeout(this.timeout);
        clearTimeout(this.warningTimeout);
        this.animationInterval = null;
        this.timeout = null;
        this.warningTimeout = null;
        if (this.container) { this.container.remove(); this.container = null; }
        this.messageElement = null;
        this.dotsElement = null;
        this.isShowing = false;
        this.dotsCount = 0;
    }
}

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const VoiceConfig = {
    apiBaseUrl: 'https://fredi-backend-flz2.onrender.com',
    useWebSocket: true,
    
    recording: {
        sampleRate: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 44100 : 16000,
        maxDuration: 60000,
        minDuration: 1000,
        chunkSize: /Android/.test(navigator.userAgent) ? 2048 : 4096,
        format: 'wav',
        mimeType: 'audio/wav'
    },
    
    playback: { format: 'mp3', autoPlay: true, volume: 1.0, preload: true },
    
    voices: {
        coach:       { name: 'Филипп',              speed: 1.0,  pitch: 1.0,  emotion: 'neutral'   },
        psychologist:{ name: 'Эрмил',               speed: 0.9,  pitch: 0.95, emotion: 'calm'      },
        trainer:     { name: 'Филипп (энергичный)', speed: 1.1,  pitch: 1.05, emotion: 'energetic' }
    },
    
    ui: {
        showVolumeMeter: true,
        showRecordingTime: true,
        autoStopAfterSilence: true,
        silenceTimeout: 5000,
        minVolumeToConsiderSpeech: 5
    },
    
    debug: false
};

// ============================================
// VoiceWebSocket
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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onThinking = null;
        this.onWeather = null;
        this.onThinkingUpdate = null;
        
        this.apiBaseUrl = this.config.apiBaseUrl;
    }
    
    async connect() {
        if (this.isIOS || !this.config.useWebSocket || !window.WebSocket) {
            return this.initHTTP();
        }
        
        try {
            const wsUrl = `wss://${new URL(this.apiBaseUrl).host}/ws/voice/${this.userId}`;
            console.log(`🔌 Connecting WebSocket: ${wsUrl}`);
            
            await new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                this.ws = new WebSocket(wsUrl);
                
                // ИСПРАВЛЕНО: единый onopen — не перезаписываем его ниже
                this.ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log('✅ WebSocket connected');
                    this.isConnected = true;
                    this.useWebSocket = true;
                    this.reconnectAttempts = 0;
                    this.updateStatus('connected');
                    
                    this.ws.send(JSON.stringify({
                        type: 'init',
                        mode: this.currentMode,
                        timestamp: Date.now(),
                        userAgent: navigator.userAgent
                    }));
                    
                    resolve();
                };
                
                this.ws.onerror = () => {
                    clearTimeout(connectionTimeout);
                    reject(new Error('WebSocket failed'));
                };
                
                this.ws.onmessage = (event) => this.handleWebSocketMessage(event.data);
                
                this.ws.onclose = () => {
                    console.log('WebSocket closed');
                    if (this.useWebSocket && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        setTimeout(() => this.connect(), 2000);
                    } else if (this.useWebSocket) {
                        this.useWebSocket = false;
                        this.initHTTP();
                    }
                };
            });
            
            return true;
            
        } catch (error) {
            console.warn('WebSocket failed, falling back to HTTP:', error.message);
            this.useWebSocket = false;
            return this.initHTTP();
        }
    }
    
    initHTTP() {
        console.log('📡 HTTP mode active');
        this.isConnected = true;
        this.useWebSocket = false;
        this.updateStatus('connected');
        return true;
    }
    
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'text':
                    if (message.data?.includes('Вы:') && this.onTranscript)
                        this.onTranscript(message.data.replace('🎤 Вы: ', ''));
                    else if (message.data?.includes('Фреди:') && this.onAIResponse)
                        this.onAIResponse(message.data.replace('🧠 Фреди: ', ''));
                    break;
                case 'audio':
                    if (message.data) this.playAudioResponse(message.data);
                    break;
                case 'status':
                    this.updateStatus(message.status);
                    break;
                case 'thinking':
                    if (this.onThinkingUpdate) this.onThinkingUpdate(message.message || 'Фреди думает');
                    break;
                case 'error':
                    if (this.onError) this.onError(message.error);
                    break;
                case 'ping':
                    if (this.ws?.readyState === WebSocket.OPEN)
                        this.ws.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }));
                    break;
                case 'weather':
                    if (this.onWeather && message.data) this.onWeather(message.data);
                    break;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    }
    
    updateStatus(status) {
        if (status === 'speaking') this.isAISpeaking = true;
        else if (status === 'idle' || status === 'connected') this.isAISpeaking = false;
        if (this.onStatusChange) this.onStatusChange(status);
    }
    
    async sendFullAudio(audioBlob, retryCount = 0) {
        const maxRetries = 3;
        const minBytes = (this.config.recording.minDuration / 1000) * this.config.recording.sampleRate * 2;
        
        if (audioBlob.size < minBytes) {
            if (this.onError) this.onError('Говорите дольше (минимум 1 секунду)');
            return false;
        }
        
        if (this.useWebSocket && this.ws?.readyState === WebSocket.OPEN) {
            return this.sendAudioViaWebSocket(audioBlob);
        }
        return this.sendAudioViaHTTP(audioBlob, retryCount, maxRetries);
    }
    
    async sendAudioViaWebSocket(audioBlob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                try {
                    this.ws.send(JSON.stringify({
                        type: 'audio_chunk',
                        data: reader.result.split(',')[1],
                        format: this.config.recording.format,
                        sample_rate: this.config.recording.sampleRate,
                        is_final: true,
                        timestamp: Date.now()
                    }));
                    this.updateStatus('processing');
                    resolve(true);
                } catch (error) {
                    console.error('WS audio send error:', error);
                    resolve(this.sendAudioViaHTTP(audioBlob));
                }
            };
            reader.readAsDataURL(audioBlob);
        });
    }
    
    async sendAudioViaHTTP(audioBlob, retryCount = 0, maxRetries = 3) {
        const formData = new FormData();
        formData.append('user_id', this.userId);
        
        let audioFormat = this.config.recording.format;
        if (this.isIOS && audioBlob.type) {
            if (audioBlob.type.includes('mp4')) audioFormat = 'mp4';
            else if (audioBlob.type.includes('aac')) audioFormat = 'aac';
            else if (audioBlob.type.includes('webm')) audioFormat = 'webm';
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
        if (this.onThinking) this.onThinking(true);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);
            
            const response = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok && retryCount < maxRetries) {
                await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                return this.sendAudioViaHTTP(audioBlob, retryCount + 1, maxRetries);
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            if (this.onThinking) this.onThinking(false);
            
            if (result.success) {
                if (this.onTranscript && result.recognized_text) this.onTranscript(result.recognized_text);
                if (this.onAIResponse && result.answer) this.onAIResponse(result.answer);
                if (result.audio_base64) await this.playAudioResponse(result.audio_base64);
                else if (result.audio_url) await this.playAudioFromUrl(result.audio_url);
                this.updateStatus('idle');
                return true;
            } else {
                throw new Error(result.error || 'Ошибка распознавания');
            }
            
        } catch (error) {
            if (this.onThinking) this.onThinking(false);
            
            if (retryCount < maxRetries && error.name !== 'AbortError') {
                await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                return this.sendAudioViaHTTP(audioBlob, retryCount + 1, maxRetries);
            }
            
            const msgs = {
                AbortError: 'Сервер не отвечает. Попробуйте позже.',
                '500': 'Ошибка на сервере. Мы уже чиним.',
                '429': 'Слишком много запросов. Подождите.',
                'Network': 'Проверьте интернет-соединение'
            };
            
            let errorMessage = 'Ошибка соединения';
            for (const [key, msg] of Object.entries(msgs)) {
                if (error.name === key || error.message?.includes(key)) { errorMessage = msg; break; }
            }
            
            if (this.onError) this.onError(errorMessage);
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
                audio.onended = () => { this.updateStatus('idle'); resolve(); };
                audio.onerror = (err) => { this.updateStatus('idle'); reject(err); };
                const p = audio.play();
                if (p !== undefined) p.catch(reject);
            } catch (error) {
                this.updateStatus('idle');
                reject(error);
            }
        });
    }
    
    async playAudioFromUrl(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.volume = this.config.playback.volume;
            this.updateStatus('speaking');
            audio.onended = () => { this.updateStatus('idle'); resolve(); };
            audio.onerror = (err) => { this.updateStatus('idle'); reject(err); };
            const p = audio.play();
            if (p !== undefined) p.catch(reject);
        });
    }
    
    async getWeather() {
        try {
            const r = await fetch(`${this.apiBaseUrl}/api/weather/${this.userId}`);
            const d = await r.json();
            if (d.success && d.weather) { if (this.onWeather) this.onWeather(d.weather); return d.weather; }
            return null;
        } catch { return null; }
    }
    
    async getWeatherByCity(city) {
        try {
            const r = await fetch(`${this.apiBaseUrl}/api/weather/by-city?city=${encodeURIComponent(city)}`);
            const d = await r.json();
            return d.success ? d.weather : null;
        } catch { return null; }
    }
    
    async setUserCity(city) {
        try {
            const r = await fetch(`${this.apiBaseUrl}/api/weather/set-city`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId, city })
            });
            return (await r.json()).success;
        } catch { return false; }
    }
    
    interrupt() {
        if (this.ws?.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify({ type: 'interrupt', timestamp: Date.now() }));
        document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
        this.updateStatus('idle');
    }
    
    disconnect() {
        if (this.ws) { this.ws.close(); this.ws = null; }
        this.isConnected = false;
    }
}

// ============================================
// VoiceRecorder
// ============================================

class VoiceRecorder {
    constructor(config = {}) {
        this.config = { ...VoiceConfig.recording, ...config };
        this.isRecording = false;
        this.mediaStream = null;
        
        // ИСПРАВЛЕНО: один AudioContext и один анализатор
        this.audioContext = null;
        this.processor = null;
        this.analyser = null;
        this.wavData = [];
        this.visualizerAnimation = null;
        this.recordingTimeout = null;
        this.silenceStartTime = null;
        this.speechDetected = false;
        
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
        if (this.isRecording) return false;
        
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
            this.isRecording = true;
            
            if (this.isIOS && window.MediaRecorder) {
                const mimeTypes = ['audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm'];
                const selectedType = mimeTypes.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
                
                if (selectedType) {
                    this.mediaRecorder = new MediaRecorder(stream, { mimeType: selectedType, audioBitsPerSecond: 128000 });
                    this.mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) this.audioChunks.push(e.data); };
                    this.mediaRecorder.onstop = () => {
                        const blob = new Blob(this.audioChunks, { type: selectedType });
                        if (this.onRecordingStop) this.onRecordingStop(blob);
                    };
                    this.mediaRecorder.start(1000);
                } else {
                    await this.setupLegacyRecording(stream);
                }
            } else {
                await this.setupLegacyRecording(stream);
            }
            
            // ИСПРАВЛЕНО: setupVolumeAnalyzer только если НЕ setupLegacyRecording
            // (legacy уже создаёт analyser внутри)
            if (this.isIOS && this.mediaRecorder) {
                this.setupVolumeAnalyzer(stream);
            }
            
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) this.stopRecording();
            }, this.config.maxDuration);
            
            if (this.onRecordingStart) this.onRecordingStart();
            return true;
            
        } catch (error) {
            this.isRecording = false;
            const msgs = {
                NotAllowedError: 'Пожалуйста, разрешите доступ к микрофону',
                NotFoundError: 'Микрофон не найден',
                NotReadableError: 'Микрофон используется другим приложением'
            };
            if (this.onError) this.onError(msgs[error.name] || 'Не удалось получить доступ к микрофону');
            return false;
        }
    }
    
    async setupLegacyRecording(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.config.sampleRate });
        
        if (this.audioContext.state === 'suspended') {
            try { await this.audioContext.resume(); } catch (e) { console.warn('AudioContext resume failed:', e); }
        }
        
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // ИСПРАВЛЕНО: один analyser создаётся здесь и используется для visualizer
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
            const isSpeech = volume > VoiceConfig.ui.minVolumeToConsiderSpeech;
            
            if (isSpeech) {
                if (!this.speechDetected) { this.speechDetected = true; if (this.onSpeechDetected) this.onSpeechDetected(true); }
                this.silenceStartTime = null;
            } else if (this.speechDetected && !this.silenceStartTime) {
                this.silenceStartTime = Date.now();
            }
            
            if (VoiceConfig.ui.autoStopAfterSilence && this.speechDetected && this.silenceStartTime &&
                (Date.now() - this.silenceStartTime) > VoiceConfig.ui.silenceTimeout) {
                this.stopRecording();
            }
            
            if (this.onVolumeChange) this.onVolumeChange(volume);
        };
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }
    
    // Используется только для iOS + MediaRecorder (без legacy AudioContext)
    setupVolumeAnalyzer(stream) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            // Сохраняем для cleanup
            this._iosVolumeCtx = ctx;
            
            const update = () => {
                if (!this.isRecording) return;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const volume = Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length / 255) * 100);
                if (this.onVolumeChange) this.onVolumeChange(volume);
                this.visualizerAnimation = requestAnimationFrame(update);
            };
            update();
        } catch (e) { console.warn('Volume analyzer failed:', e); }
    }
    
    stopRecording() {
        if (!this.isRecording) return null;
        this.isRecording = false;
        
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
        
        if (this.visualizerAnimation) {
            cancelAnimationFrame(this.visualizerAnimation);
            this.visualizerAnimation = null;
        }
        
        let audioBlob = null;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            // blob возвращается через onstop callback
        } else if (this.wavData.length > 0) {
            audioBlob = this.createWavBlob(this.wavData);
            if (this.onRecordingStop) this.onRecordingStop(audioBlob);
        }
        
        // Cleanup
        if (this.processor) { try { this.processor.disconnect(); } catch (e) {} this.processor = null; }
        if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
        
        // ИСПРАВЛЕНО: закрываем iOS volume context
        if (this._iosVolumeCtx) { this._iosVolumeCtx.close().catch(() => {}); this._iosVolumeCtx = null; }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            this.mediaStream = null;
        }
        
        this.analyser = null;
        this.wavData = [];
        
        return audioBlob;
    }
    
    createWavBlob(audioData) {
        let totalLength = 0;
        for (const chunk of audioData) totalLength += chunk.length;
        
        const MAX_SAMPLES = (this.config.maxDuration / 1000) * this.config.sampleRate;
        if (totalLength > MAX_SAMPLES) totalLength = MAX_SAMPLES;
        
        const combined = new Int16Array(totalLength);
        let offset = 0;
        for (const chunk of audioData) {
            if (offset + chunk.length > totalLength) {
                combined.set(chunk.slice(0, totalLength - offset), offset);
                break;
            }
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        
        const sampleRate = this.config.sampleRate;
        const buffer = new ArrayBuffer(44 + combined.length * 2);
        const view = new DataView(buffer);
        
        const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + combined.length * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, combined.length * 2, true);
        for (let i = 0; i < combined.length; i++) view.setInt16(44 + i * 2, combined[i], true);
        
        return new Blob([buffer], { type: `audio/${this.config.format}` });
    }
    
    startVisualizer() {
        if (!this.analyser) return;
        const update = () => {
            if (!this.isRecording || !this.analyser) return;
            const data = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(data);
            const volume = Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length / 255) * 100);
            if (this.onVolumeChange) this.onVolumeChange(volume);
            this.visualizerAnimation = requestAnimationFrame(update);
        };
        update();
    }
    
    isRecordingActive() { return this.isRecording; }
    dispose() { this.stopRecording(); }
}

// ============================================
// VoiceManager
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
        this.player.onPlayStart = () => { this.isAISpeaking = true; this.updateStatus('speaking'); };
        this.player.onPlayEnd = () => { this.isAISpeaking = false; this.updateStatus('idle'); };
        this.player.onError = () => { if (this.onError) this.onError('Ошибка воспроизведения'); };
        
        this.recorder = new VoiceRecorder(this.config.recording);
        
        this.recorder.onRecordingStart = () => {
            this.isRecording = true;
            if (this.onRecordingStart) this.onRecordingStart();
            this.updateStatus('recording');
        };
        
        this.recorder.onRecordingStop = (audioBlob) => {
            this.isRecording = false;
            if (this.onRecordingStop) this.onRecordingStop(audioBlob);
            if (audioBlob?.size > 0) this.sendAudio(audioBlob);
            this.updateStatus('idle');
        };
        
        this.recorder.onVolumeChange = (v) => { if (this.onVolumeChange) this.onVolumeChange(v); };
        this.recorder.onError = (e) => { if (this.onError) this.onError(e); };
        this.recorder.onSpeechDetected = (d) => { if (this.onSpeechDetected) this.onSpeechDetected(d); };
        
        this.initWebSocket();
    }
    
    async initWebSocket() {
        this.websocket = new VoiceWebSocket(this.userId, this.config);
        this.websocket.currentMode = this.currentMode;
        
        this.websocket.onTranscript = (t) => { if (this.onTranscript) this.onTranscript(t); };
        this.websocket.onAIResponse = (a) => { if (this.onAIResponse) this.onAIResponse(a); };
        this.websocket.onThinking = (t) => { if (this.onThinking) this.onThinking(t); };
        this.websocket.onThinkingUpdate = (m) => { if (this.loadingIndicator?.isShowing) this.loadingIndicator.updateMessage(m); };
        
        this.websocket.onStatusChange = (status) => {
            if (status === 'speaking') {
                this.isAISpeaking = true;
                this.loadingIndicator?.remove();
            } else if (status === 'idle') {
                this.isAISpeaking = false;
                this.loadingIndicator?.remove();
            }
            this.updateStatus(status);
        };
        
        this.websocket.onError = (e) => {
            if (this.onError) this.onError(e);
            this.loadingIndicator?.remove();
        };
        
        this.websocket.onWeather = (w) => { if (this.onWeather) this.onWeather(w); };
        
        await this.websocket.connect();
    }
    
    async sendAudio(audioBlob) {
        this.loadingIndicator?.create();
        return this.websocket.sendFullAudio(audioBlob);
    }
    
    async textToSpeech(text, mode) {
        try {
            const formData = new URLSearchParams();
            formData.append('text', text);
            formData.append('mode', mode || this.currentMode);
            const vs = this.config.voices[mode || this.currentMode];
            if (vs) { formData.append('speed', vs.speed); formData.append('pitch', vs.pitch); formData.append('emotion', vs.emotion); }
            
            const response = await fetch(`${this.config.apiBaseUrl}/api/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            await this.player.play(audioUrl);
            return { audio_url: audioUrl };
        } catch (error) {
            if (this.onError) this.onError('Ошибка синтеза речи');
            return null;
        }
    }
    
    getWeather() { return this.websocket.getWeather(); }
    getWeatherByCity(city) { return this.websocket.getWeatherByCity(city); }
    setUserCity(city) { return this.websocket.setUserCity(city); }
    
    startRecording() {
        if (this.isAISpeaking) {
            this.interrupt();
            setTimeout(() => this.recorder.startRecording(), 300);
        } else {
            this.recorder.startRecording();
        }
    }
    
    stopRecording() { return this.recorder.stopRecording(); }
    
    interrupt() {
        this.websocket?.interrupt();
        this.player?.stop();
        this.isAISpeaking = false;
        this.loadingIndicator?.remove();
    }
    
    updateStatus(status) { if (this.onStatusChange) this.onStatusChange(status); }
    setMode(mode) { this.currentMode = mode; if (this.websocket) this.websocket.currentMode = mode; }
    isRecordingActive() { return this.recorder?.isRecordingActive() || false; }
    isSpeaking() { return this.isAISpeaking; }
    getCurrentMode() { return this.currentMode; }
    getVoiceSettings() { return this.config.voices[this.currentMode] || this.config.voices.psychologist; }
    
    dispose() {
        this.loadingIndicator?.remove();
        this.recorder?.dispose();
        this.player?.dispose();
        this.websocket?.disconnect();
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
