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
    }
    
    play(audioData, mimeType = 'audio/mpeg') {
        return new Promise((resolve, reject) => {
            try {
                this.stop();
                
                this.audio = new Audio();
                let audioUrl = audioData;
                
                // Если это base64 данные
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
                // Если это URL
                else if (typeof audioData === 'string' && audioData.startsWith('http')) {
                    audioUrl = audioData;
                }
                // Если это Blob
                else if (audioData instanceof Blob) {
                    audioUrl = URL.createObjectURL(audioData);
                }
                
                this.currentUrl = audioUrl;
                this.audio.src = audioUrl;
                this.audio.load();
                
                this.audio.oncanplaythrough = () => {
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
// КОНФИГУРАЦИЯ ГОЛОСА FREDI PREMIUM
// ============================================

const VoiceConfig = {
    // Настройки API
    apiBaseUrl: 'https://fredi-backend-flz2.onrender.com',
    
    // Настройки записи
    recording: {
        sampleRate: 16000,      // 16kHz - оптимально для распознавания
        maxDuration: 60000,     // 60 секунд максимум
        minDuration: 1000,      // Минимум 1 секунда (иначе игнорируем)
        chunkSize: 4096,
        format: 'wav',          // Отправляем как WAV
        mimeType: 'audio/wav'
    },
    
    // Настройки воспроизведения
    playback: {
        format: 'mp3',          // Ожидаем MP3 от сервера
        autoPlay: true,
        volume: 1.0,
        preload: true
    },
    
    // Настройки голоса для разных режимов
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
            speed: 0.9,         // Медленнее для глубоких тем
            pitch: 0.95,
            emotion: 'calm'
        },
        trainer: {
            name: 'Филипп (энергичный)',
            emoji: '⚡',
            speed: 1.1,         // Быстрее для инструкций
            pitch: 1.05,
            emotion: 'energetic'
        }
    },
    
    // UI настройки
    ui: {
        showVolumeMeter: true,
        showRecordingTime: true,
        autoStopAfterSilence: true,
        silenceTimeout: 2000,   // 2 секунды тишины = авто-стоп
        minVolumeToConsiderSpeech: 5  // Минимальная громкость для речи
    },
    
    // Отладка
    debug: true
};

// ============================================
// VoiceWebSocket С ПОДДЕРЖКОЙ НАСТРОЕК
// ============================================

class VoiceWebSocket {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.config = { ...VoiceConfig, ...config };
        this.isConnected = false;
        this.isAISpeaking = false;
        this.currentMode = 'psychologist';
        
        // Колбэки
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onThinking = null;
        
        // HTTP клиент
        this.apiBaseUrl = this.config.apiBaseUrl;
        
        // Таймауты
        this.pendingRequest = null;
        this.lastRequestTime = 0;
    }
    
    async connect() {
        console.log('📡 HTTP mode active (WebSocket disabled)');
        this.isConnected = true;
        this.updateStatus('connected');
        return true;
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
    
    // ========== ОТПРАВКА АУДИО ==========
    async sendFullAudio(audioBlob) {
        // Проверка минимальной длины
        const minBytes = this.config.recording.minDuration * 
                        (this.config.recording.sampleRate / 1000) * 2;
        
        if (audioBlob.size < minBytes) {
            console.warn(`⚠️ Audio too short: ${audioBlob.size} bytes < ${minBytes} bytes`);
            if (this.onError) {
                this.onError('Говорите дольше (минимум 1 секунду)');
            }
            return false;
        }
        
        // Проверка максимальной длины
        const maxBytes = this.config.recording.maxDuration * 
                        (this.config.recording.sampleRate / 1000) * 2;
        
        if (audioBlob.size > maxBytes) {
            console.warn(`⚠️ Audio too long: ${audioBlob.size} bytes > ${maxBytes} bytes`);
            if (this.onError) {
                this.onError('Сообщение слишком длинное (максимум 60 секунд)');
            }
            return false;
        }
        
        // Создаем FormData
        const formData = new FormData();
        formData.append('user_id', this.userId);
        
        // Отправляем в правильном формате (WAV)
        const audioFormat = this.config.recording.format;
        formData.append('voice', audioBlob, `audio.${audioFormat}`);
        formData.append('mode', this.currentMode || 'psychologist');
        
        // Добавляем параметры голоса
        const voiceSettings = this.config.voices[this.currentMode];
        if (voiceSettings) {
            formData.append('voice_speed', voiceSettings.speed);
            formData.append('voice_pitch', voiceSettings.pitch);
            formData.append('voice_emotion', voiceSettings.emotion);
        }
        
        // Обновляем статус
        this.updateStatus('processing');
        
        // Показываем "думает"
        if (this.onThinking) {
            this.onThinking(true);
        }
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(30000)
            });
            
            const elapsed = Date.now() - startTime;
            if (this.config.debug) {
                console.log(`📊 Request completed in ${elapsed}ms`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Скрываем "думает"
            if (this.onThinking) {
                this.onThinking(false);
            }
            
            if (result.success) {
                console.log('✅ Распознано:', result.recognized_text);
                
                // Отображаем распознанный текст
                if (this.onTranscript && result.recognized_text) {
                    this.onTranscript(result.recognized_text);
                }
                
                // Отображаем ответ ИИ
                if (this.onAIResponse && result.answer) {
                    this.onAIResponse(result.answer);
                }
                
                // Воспроизводим аудио ответ
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
            
            // Скрываем "думает"
            if (this.onThinking) {
                this.onThinking(false);
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
    
    // Воспроизведение аудио из base64
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
                    reject(error);
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
    
    interrupt() {
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        this.updateStatus('idle');
        console.log('🛑 Interrupted');
    }
    
    disconnect() {
        this.isConnected = false;
        console.log('🔌 HTTP mode disconnected');
    }
}

// ============================================
// VoiceRecorder С АВТО-СТОПОМ ПО ТИШИНЕ
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
        
        // Для отслеживания тишины
        this.silenceStartTime = null;
        this.speechDetected = false;
        this.lastVolume = 0;
        
        // Колбэки
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
            this.speechDetected = false;
            this.silenceStartTime = null;
            this.lastVolume = 0;
            this.isRecording = true;
            
            // Инициализируем AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.config.sampleRate
            });
            
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Создаём анализатор для визуализации
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            // Запускаем визуализацию
            this.startVisualizer();
            
            // Создаём ScriptProcessorNode для захвата аудиоданных
            this.processor = this.audioContext.createScriptProcessor(
                this.config.chunkSize, 1, 1
            );
            
            this.processor.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                
                // Конвертируем float32 (-1..1) в int16 (-32768..32767)
                const int16Data = new Int16Array(inputData.length);
                let sumAbs = 0;
                
                for (let i = 0; i < inputData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, inputData[i]));
                    int16Data[i] = Math.floor(sample * 32767);
                    sumAbs += Math.abs(int16Data[i]);
                }
                
                this.wavData.push(int16Data);
                
                // Вычисляем громкость
                const volume = Math.min(100, (sumAbs / int16Data.length / 32768) * 100);
                this.lastVolume = volume;
                
                // Детекция речи (громкость выше порога)
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
                
                // Авто-стоп по тишине
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
            
            // Запускаем AudioContext
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Таймаут на максимальную длительность записи
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) {
                    console.log('⏱️ Max recording duration reached');
                    this.stopRecording();
                }
            }, this.config.maxDuration);
            
            if (this.onRecordingStart) {
                this.onRecordingStart();
            }
            
            console.log('🎙️ Recording started');
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
    
    stopRecording() {
        if (!this.isRecording) {
            return null;
        }
        
        this.isRecording = false;
        
        // Очищаем таймауты
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        // Останавливаем визуализацию
        this.stopVisualizer();
        
        // Отключаем процессор
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        // Закрываем AudioContext
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        
        // Создаём WAV файл из собранных данных
        let audioBlob = null;
        if (this.wavData && this.wavData.length > 0) {
            audioBlob = this.createWavBlob(this.wavData);
        }
        
        // Закрываем медиа-поток
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.onRecordingStop) {
            this.onRecordingStop(audioBlob);
        }
        
        console.log('⏹️ Recording stopped');
        return audioBlob;
    }
    
    createWavBlob(audioData) {
        // Объединяем все чанки
        let totalLength = 0;
        for (const chunk of audioData) {
            totalLength += chunk.length;
        }
        
        // Ограничиваем максимальную длину
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
        
        const mimeType = `audio/${this.config.format}`;
        return new Blob([buffer], { type: mimeType });
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
// VoiceManager
// ============================================

class VoiceManager {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.config = { ...VoiceConfig, ...config };
        this.websocket = null;
        this.recorder = null;
        this.player = null;
        
        // Состояние
        this.isRecording = false;
        this.isAISpeaking = false;
        this.currentMode = 'psychologist';
        
        // Колбэки
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVolumeChange = null;
        this.onThinking = null;
        this.onSpeechDetected = null;
        
        // Инициализация
        this.init();
    }
    
    init() {
        // Инициализируем плеер
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
        
        // Инициализируем рекордер
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
        
        // Инициализируем HTTP клиент
        this.initHTTP();
    }
    
    initHTTP() {
        console.log('📡 HTTP mode active (stable)');
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
        
        this.websocket.onStatusChange = (status) => {
            if (status === 'speaking') {
                this.isAISpeaking = true;
            } else if (status === 'idle') {
                this.isAISpeaking = false;
            }
            this.updateStatus(status);
        };
        
        this.websocket.onError = (error) => {
            if (this.onError) {
                this.onError(error);
            }
        };
        
        this.websocket.connect();
    }
    
    async sendAudio(audioBlob) {
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
// ЭКСПОРТ ДЛЯ БРАУЗЕРА
// ============================================

if (typeof window !== 'undefined') {
    window.AudioPlayer = AudioPlayer;
    window.VoiceManager = VoiceManager;
    window.VoiceConfig = VoiceConfig;
    window.VoiceWebSocket = VoiceWebSocket;
    window.VoiceRecorder = VoiceRecorder;
}
