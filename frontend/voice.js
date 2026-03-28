// ============================================
// ГОЛОСОВОЙ МОДУЛЬ FREDI PREMIUM
// Единый файл для всей голосовой функциональности
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
        
        // Heartbeat
        this.pingInterval = null;
        this.pingIntervalMs = config.pingIntervalMs || 25000;
        this.pongTimeout = null;
        
        // Reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
        this.reconnectDelay = config.reconnectDelay || 2000;
        this.reconnectTimer = null;
        
        // URL WebSocket
        this.wsUrl = config.wsUrl || `wss://fredi-backend-flz2.onrender.com/ws/voice/${userId}`;
        
        // Флаги
        this.isReconnecting = false;
    }
    
    async connect() {
        if (this.isConnected) {
            console.log('📡 WebSocket already connected');
            return true;
        }
        
        return new Promise((resolve, reject) => {
            try {
                console.log(`📡 Connecting to WebSocket: ${this.wsUrl}`);
                this.ws = new WebSocket(this.wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected for live voice');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.isReconnecting = false;
                    
                    this.startHeartbeat();
                    
                    if (this.onStatusChange) {
                        this.onStatusChange('connected');
                    }
                    resolve(true);
                };
                
                this.ws.onclose = (event) => {
                    console.log(`❌ WebSocket disconnected: code=${event.code}, reason=${event.reason || 'no reason'}`);
                    this.isConnected = false;
                    
                    this.stopHeartbeat();
                    
                    if (this.onStatusChange) {
                        this.onStatusChange('disconnected');
                    }
                    
                    // Автоматическое переподключение
                    if (!this.isReconnecting && event.code !== 1000) {
                        this.scheduleReconnect();
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    if (this.onError) {
                        this.onError('Connection error');
                    }
                    reject(error);
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                };
            } catch (error) {
                console.error('WebSocket connection error:', error);
                reject(error);
            }
        });
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            if (this.onError) {
                this.onError('Не удалось восстановить соединение');
            }
            return;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        const delay = Math.min(30000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectAttempts++;
            this.isReconnecting = true;
            
            try {
                await this.connect();
                console.log('✅ Reconnection successful');
            } catch (error) {
                console.log('Reconnection failed, will retry');
            }
        }, delay);
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        // Отправляем первый ping через 5 секунд
        setTimeout(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                this.sendPing();
            }
        }, 5000);
        
        // Запускаем периодический ping
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                this.sendPing();
            } else if (this.pingInterval) {
                this.stopHeartbeat();
            }
        }, this.pingIntervalMs);
        
        console.log(`💓 Heartbeat started: ping every ${this.pingIntervalMs / 1000} seconds`);
    }
    
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
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
        this.ws.send(JSON.stringify({ 
            type: 'ping',
            timestamp: pingTime 
        }));
        
        // Таймаут на получение pong
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
        }
        
        this.pongTimeout = setTimeout(() => {
            console.warn('⚠️ No pong received from server, connection may be dead');
            if (this.isConnected) {
                this.scheduleReconnect();
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
                if (this.onTranscript) {
                    this.onTranscript(data.data);
                }
                break;
                
            case 'status':
                console.log('📊 Status:', data.status);
                this.updateStatus(data.status);
                break;
                
            case 'error':
                console.error('Server error:', data.error);
                if (this.onError) {
                    this.onError(data.error);
                }
                break;
                
            case 'audio_end':
                console.log('Audio playback ended');
                this.isAISpeaking = false;
                if (this.onStatusChange) {
                    this.onStatusChange('idle');
                }
                break;
        }
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
            return false;
        }
        
        if (!chunk) {
            this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: '',
                is_final: isFinal
            }));
            return true;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64Data,
                is_final: isFinal
            }));
        };
        reader.readAsDataURL(chunk);
        
        return true;
    }
    
    // ========== ИСПРАВЛЕННЫЙ МЕТОД sendFullAudio ==========
    sendFullAudio(audioBlob) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send audio: WebSocket not connected');
            return false;
        }
        
        // Проверка размера аудио (макс 10MB)
        if (audioBlob.size > 10 * 1024 * 1024) {
            console.error('Audio too large:', audioBlob.size);
            if (this.onError) {
                this.onError('Аудио слишком длинное (макс. 60 сек)');
            }
            return false;
        }
        
        // Проверка минимального размера (0.5 секунды)
        const MIN_AUDIO_BYTES = 8000;
        if (audioBlob.size < MIN_AUDIO_BYTES) {
            console.warn(`⚠️ Audio too short: ${audioBlob.size} bytes, skipping`);
            if (this.onError) {
                this.onError('Аудио слишком короткое (говорите дольше)');
            }
            return false;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            
            // ========== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ДОБАВЛЯЕМ format И sample_rate ==========
            this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64Data,
                is_final: true,
                format: 'pcm16',        // ← ОТПРАВЛЯЕМ КАК PCM16
                sample_rate: 16000      // ← УКАЗЫВАЕМ ЧАСТОТУ
            }));
            
            console.log(`📤 Sent full audio: ${audioBlob.size} bytes, format=pcm16, sample_rate=16000`);
        };
        
        reader.onerror = (error) => {
            console.error('Failed to read audio blob:', error);
            if (this.onError) {
                this.onError('Ошибка чтения аудио');
            }
        };
        
        reader.readAsDataURL(audioBlob);
        
        return true;
    }
    // ========== КОНЕЦ ИСПРАВЛЕННОГО МЕТОДА ==========
    
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
    
    disconnect() {
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {}
            this.currentSource = null;
        }
        
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close().catch(console.warn);
            this.audioContext = null;
        }
        
        this.isConnected = false;
        this.isReconnecting = false;
        console.log('🔌 WebSocket disconnected manually');
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
                // Останавливаем текущее воспроизведение
                this.stop();
                
                // Создаем новый аудио элемент
                this.audio = new Audio();
                
                let audioUrl = audioData;
                
                // Если это base64 данные
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
        
        this.useWebSocket = config.useWebSocket !== false;
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
        
        // Инициализируем WebSocket если нужно
        if (this.useWebSocket) {
            this.initWebSocket();
        }
    }
    
    initWebSocket() {
        this.websocket = new VoiceWebSocket(this.userId);
        
        this.websocket.onTranscript = (text) => {
            if (this.onTranscript) {
                this.onTranscript(text);
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
        
        this.websocket.connect().catch(error => {
            console.warn('WebSocket failed, falling back to HTTP', error);
            this.useWebSocket = false;
            if (this.onError) {
                this.onError('WebSocket connection failed, using HTTP fallback');
            }
        });
    }
    
    async sendAudio(audioBlob) {
        if (this.useWebSocket && this.websocket?.isConnected) {
            return this.websocket.sendFullAudio(audioBlob);
        } else {
            return this.sendViaHTTP(audioBlob);
        }
    }
    
    async sendViaHTTP(audioBlob) {
        const formData = new FormData();
        formData.append('user_id', this.userId);
        formData.append('voice', audioBlob, 'audio.wav');
        
        if (this.currentMode) {
            formData.append('mode', this.currentMode);
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (result.recognized_text && this.onTranscript) {
                    this.onTranscript(result.recognized_text);
                }
                
                if (result.answer && this.onAIResponse) {
                    this.onAIResponse(result.answer);
                }
                
                if (result.audio_base64) {
                    await this.player.play(result.audio_base64);
                }
            } else {
                if (this.onError) {
                    this.onError(result.error || 'Ошибка распознавания');
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('HTTP voice error:', error);
            if (this.onError) {
                this.onError('Ошибка соединения');
            }
            return null;
        }
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
        // Если ИИ говорит, прерываем его
        if (this.isAISpeaking) {
            this.interrupt();
            // Небольшая задержка перед началом записи
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
