// ============================================
// ГОЛОСОВОЙ МОДУЛЬ FREDI PREMIUM
// HTTP версия - стабильная и проверенная
// ============================================

class VoiceWebSocket {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.ws = null;
        this.isConnected = false;
        this.isAISpeaking = false;
        
        // Колбэки
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        
        // Аудио
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentSource = null;
        this.audioContext = null;
        
        // HTTP вместо WebSocket
        this.useWebSocket = false;
        this.apiBaseUrl = config.apiBaseUrl || 'https://fredi-backend-flz2.onrender.com';
        
        // Флаги
        this.isReconnecting = false;
    }
    
    async connect() {
        // HTTP режим - всегда "подключен"
        console.log('📡 HTTP mode active (WebSocket disabled)');
        this.isConnected = true;
        if (this.onStatusChange) {
            this.onStatusChange('connected');
        }
        return true;
    }
    
    handleMessage(data) {
        // Не используется в HTTP режиме
    }
    
    updateStatus(status) {
        switch (status) {
            case 'speaking':
                this.isAISpeaking = true;
                break;
            case 'idle':
                this.isAISpeaking = false;
                break;
        }
        
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }
    
    // ========== ОТПРАВКА АУДИО ЧЕРЕЗ HTTP ==========
    sendFullAudio(audioBlob) {
        console.log(`📤 Отправка через HTTP: ${audioBlob.size} bytes`);
        
        // Проверка минимального размера
        const MIN_AUDIO_BYTES = 8000;
        if (audioBlob.size < MIN_AUDIO_BYTES) {
            console.warn(`⚠️ Audio too short: ${audioBlob.size} bytes, skipping`);
            if (this.onError) {
                this.onError('Аудио слишком короткое (говорите дольше)');
            }
            return false;
        }
        
        // Создаем FormData
        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('voice', audioBlob, 'audio.wav');
        formData.append('mode', this.currentMode || 'psychologist');
        
        // Обновляем статус
        if (this.onStatusChange) {
            this.onStatusChange('processing');
        }
        
        // Отправляем через fetch
        fetch(`${this.apiBaseUrl}/api/voice/process`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
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
                    this.playAudioResponse(result.audio_base64);
                }
                
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
            } else {
                console.error('❌ Ошибка:', result.error);
                if (this.onError) {
                    this.onError(result.error || 'Ошибка распознавания');
                }
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
            }
        })
        .catch(error => {
            console.error('HTTP error:', error);
            if (this.onError) {
                this.onError('Ошибка соединения');
            }
            if (this.onStatusChange) {
                this.onStatusChange('idle');
            }
        });
        
        return true;
    }
    
    // Воспроизведение аудио из base64
    playAudioResponse(audioBase64) {
        try {
            // Создаем аудио элемент
            const audio = new Audio();
            audio.src = `data:audio/mpeg;base64,${audioBase64}`;
            
            // Обновляем статус
            if (this.onStatusChange) {
                this.onStatusChange('speaking');
            }
            
            audio.onplay = () => {
                console.log('🔊 Воспроизведение начато');
            };
            
            audio.onended = () => {
                console.log('🔊 Воспроизведение завершено');
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
            };
            
            audio.onerror = (error) => {
                console.error('Playback error:', error);
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
            };
            
            audio.play().catch(e => {
                console.error('Play failed:', e);
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
            });
        } catch (error) {
            console.error('Playback error:', error);
            if (this.onStatusChange) {
                this.onStatusChange('idle');
            }
        }
    }
    
    sendAudioChunk(chunk, isFinal) {
        // Не используется в HTTP режиме
        console.warn('sendAudioChunk not used in HTTP mode');
        return false;
    }
    
    interrupt() {
        // Останавливаем текущее воспроизведение
        if (this.currentSource) {
            try {
                this.currentSource.stop();
                this.currentSource = null;
            } catch (e) {
                // Игнорируем
            }
        }
        console.log('🛑 Interrupt (HTTP mode)');
    }
    
    disconnect() {
        this.isConnected = false;
        console.log('🔌 HTTP mode disconnected');
    }
}

// ============================================
// ГОЛОСОВАЯ КНОПКА С УДЕРЖАНИЕМ (PUSH-TO-TALK)
// ============================================

class VoiceRecorder {
    constructor(config = {}) {
        this.isRecording = false;
        this.mediaStream = null;
        this.audioContext = null;
        this.processor = null;
        this.wavData = [];
        this.recordingTimeout = null;
        this.visualizerAnimation = null;
        this.analyser = null;
        
        // Конфигурация
        this.sampleRate = config.sampleRate || 16000;
        this.maxDuration = config.maxDuration || 60000; // 60 секунд
        this.chunkSize = config.chunkSize || 4096;
        
        // Колбэки
        this.onDataAvailable = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVolumeChange = null;
        this.onError = null;
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
                    sampleRate: this.sampleRate,
                    channelCount: 1
                }
            });
            
            this.mediaStream = stream;
            this.wavData = [];
            this.isRecording = true;
            
            // Инициализируем AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Создаём анализатор для визуализации
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            // Запускаем визуализацию
            this.startVisualizer();
            
            // Создаём ScriptProcessorNode для захвата аудиоданных
            this.processor = this.audioContext.createScriptProcessor(this.chunkSize, 1, 1);
            
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
                
                // Вычисляем громкость
                let sum = 0;
                for (let i = 0; i < int16Data.length; i++) {
                    sum += Math.abs(int16Data[i]);
                }
                const volume = Math.min(100, (sum / int16Data.length / 32768) * 100);
                
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
                    console.log('Max recording duration reached');
                    this.stopRecording();
                }
            }, this.maxDuration);
            
            if (this.onRecordingStart) {
                this.onRecordingStart();
            }
            
            console.log('🎙️ Recording started');
            return true;
            
        } catch (error) {
            console.error('Start recording error:', error);
            if (this.onError) {
                this.onError('Не удалось получить доступ к микрофону');
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
        
        // Очищаем таймаут
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
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
        
        // Ограничиваем максимальную длину (60 секунд при 16kHz = 960,000 сэмплов)
        const MAX_SAMPLES = this.sampleRate * 60; // 60 секунд
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
        
        const sampleRate = this.sampleRate;
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
// АУДИО ПЛЕЕР (запасной)
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
// ГОЛОВНОЙ МЕНЕДЖЕР ГОЛОСА
// ============================================

class VoiceManager {
    constructor(userId, config = {}) {
        this.userId = userId;
        this.websocket = null;
        this.recorder = null;
        this.player = null;
        
        // ========== ОТКЛЮЧАЕМ WEBSOCKET, ИСПОЛЬЗУЕМ HTTP ==========
        this.useWebSocket = false;
        this.apiBaseUrl = config.apiBaseUrl || 'https://fredi-backend-flz2.onrender.com';
        
        // Состояние
        this.isRecording = false;
        this.isAISpeaking = false;
        
        // Колбэки
        this.onTranscript = null;
        this.onAIResponse = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVolumeChange = null;
        
        // Инициализация
        this.init();
    }
    
    init() {
        // Инициализируем плеер
        this.player = new AudioPlayer();
        this.player.onPlayStart = () => {
            this.isAISpeaking = true;
            this.updateStatus('ai_speaking');
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
        this.recorder = new VoiceRecorder({
            sampleRate: 16000,
            maxDuration: 60000
        });
        
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
        
        // Инициализируем HTTP клиент
        this.initHTTP();
    }
    
    initHTTP() {
        console.log('📡 HTTP mode active (stable)');
        this.websocket = new VoiceWebSocket(this.userId, {
            apiBaseUrl: this.apiBaseUrl
        });
        this.websocket.useWebSocket = false;
        
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
        // Используем HTTP всегда
        return this.websocket.sendFullAudio(audioBlob);
    }
    
    async sendViaHTTP(audioBlob) {
        // Уже реализовано в VoiceWebSocket.sendFullAudio
        return this.websocket.sendFullAudio(audioBlob);
    }
    
    async textToSpeech(text, mode) {
        try {
            const formData = new URLSearchParams();
            formData.append('text', text);
            formData.append('mode', mode || 'psychologist');
            
            const response = await fetch(`${this.apiBaseUrl}/api/voice/tts`, {
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
    }
    
    isRecordingActive() {
        return this.recorder?.isRecordingActive() || false;
    }
    
    isSpeaking() {
        return this.isAISpeaking;
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
// ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ (глобальная переменная)
// ============================================

// Для браузера (глобальная переменная)
if (typeof window !== 'undefined') {
    window.VoiceManager = VoiceManager;
    window.VoiceWebSocket = VoiceWebSocket;
    window.VoiceRecorder = VoiceRecorder;
    window.AudioPlayer = AudioPlayer;
}
