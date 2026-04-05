// ============================================
// FREDI VOICE v2.0
// WebSocket-first с автоматическим fallback на HTTP
// Поддержка: iOS Safari, Android Chrome, Desktop
// ============================================

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
        this._unlocked = false;

        const unlock = () => {
            this._unlocked = true;
            const a = new Audio();
            a.play().catch(() => {});
            document.removeEventListener('touchstart', unlock, true);
            document.removeEventListener('touchend', unlock, true);
            document.removeEventListener('click', unlock, true);
        };
        document.addEventListener('touchstart', unlock, true);
        document.addEventListener('touchend', unlock, true);
        document.addEventListener('click', unlock, true);
    }

    async play(audioData, mimeType = 'audio/mpeg') {
        this.stop();
        let audioUrl = null;
        let isObjectUrl = false;

        try {
            if (typeof audioData === 'string' && audioData.startsWith('data:')) {
                const m = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
                if (m) {
                    const binary = atob(m[2]);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    audioUrl = URL.createObjectURL(new Blob([bytes], { type: m[1] }));
                    isObjectUrl = true;
                }
            } else if (typeof audioData === 'string' && audioData.startsWith('blob:')) {
                audioUrl = audioData;
            } else if (typeof audioData === 'string') {
                try {
                    const binary = atob(audioData);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    audioUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
                    isObjectUrl = true;
                } catch { audioUrl = audioData; }
            } else if (audioData instanceof Blob) {
                audioUrl = URL.createObjectURL(audioData);
                isObjectUrl = true;
            } else {
                throw new Error('Неизвестный формат аудио');
            }

            if (!audioUrl) throw new Error('Не удалось создать URL аудио');
            this.currentUrl = isObjectUrl ? audioUrl : null;
            this.audio = new Audio();
            this.audio.preload = 'auto';
            this.audio.volume = 1.0;

            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    if (isObjectUrl && audioUrl) URL.revokeObjectURL(audioUrl);
                };
                this.audio.onended = () => {
                    cleanup(); this.audio = null;
                    if (this.onPlayEnd) this.onPlayEnd();
                    resolve();
                };
                this.audio.onerror = (e) => {
                    cleanup(); this.audio = null;
                    if (this.onError) this.onError('Не удалось воспроизвести аудио');
                    reject(new Error('Audio error'));
                };
                this.audio.src = audioUrl;
                this.audio.load();

                const doPlay = () => {
                    if (!this.audio) { resolve(); return; }
                    const p = this.audio.play();
                    if (p && p.then) {
                        p.then(() => { if (this.onPlayStart) this.onPlayStart(); })
                         .catch(err => {
                             cleanup(); this.audio = null;
                             if (this.onError) this.onError('Нажмите на экран для включения звука');
                             reject(err);
                         });
                    }
                };

                if (this.isIOS) {
                    this.audio.oncanplaythrough = doPlay;
                    setTimeout(doPlay, 300);
                } else {
                    this.audio.oncanplay = doPlay;
                    setTimeout(doPlay, 100);
                }
            });
        } catch (err) {
            if (this.onError) this.onError('Ошибка звука: ' + err.message);
            throw err;
        }
    }

    stop() {
        if (this.audio) {
            try { this.audio.pause(); this.audio.src = ''; } catch {}
            this.audio = null;
        }
        if (this.currentUrl) {
            try { URL.revokeObjectURL(this.currentUrl); } catch {}
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
        this.el = null;
        this.interval = null;
        this.dots = 0;
        this.isShowing = false;
    }

    show(message = 'Фреди думает') {
        this.remove();
        this.el = document.createElement('div');
        this.el.style.cssText = `
            position:fixed; bottom:max(100px,calc(env(safe-area-inset-bottom)+80px));
            left:50%; transform:translateX(-50%);
            background:rgba(10,10,10,0.95); backdrop-filter:blur(20px);
            -webkit-backdrop-filter:blur(20px); border-radius:50px;
            padding:12px 24px; border:1px solid rgba(224,224,224,0.2);
            z-index:9998; display:flex; align-items:center; gap:8px;
            pointer-events:none; font-size:14px; color:rgba(224,224,224,0.8);
            white-space:nowrap;
        `;
        this.msgEl = document.createElement('span');
        this.msgEl.textContent = message;
        this.dotsEl = document.createElement('span');
        this.dotsEl.textContent = '...';
        this.el.appendChild(this.msgEl);
        this.el.appendChild(this.dotsEl);
        document.body.appendChild(this.el);
        this.isShowing = true;
        this.interval = setInterval(() => {
            this.dots = (this.dots + 1) % 4;
            if (this.dotsEl) this.dotsEl.textContent = '.'.repeat(this.dots) + '\u00a0'.repeat(3 - this.dots);
        }, 400);
    }

    update(message) { if (this.msgEl) this.msgEl.textContent = message; }

    remove() {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        if (this.el) { try { this.el.remove(); } catch {} this.el = null; }
        this.isShowing = false;
        this.dots = 0;
    }
}

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const VoiceConfig = {
    apiBaseUrl: window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com',

    // WebSocket включён — с автофallback на HTTP при неудаче
    useWebSocket: true,

    // iOS — всегда только HTTP (WebSocket с бинарными чанками нестабилен)
    forceHTTPoniOS: true,

    recording: {
        sampleRate: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 44100 : 16000,
        maxDuration: 60000,
        minDuration: 800,
        chunkSize: 4096,
        format: 'wav',
        mimeType: 'audio/wav'
    },

    playback: { volume: 1.0 },

    voices: {
        coach:        { name: 'Филипп',            speed: 1.0, pitch: 1.0,  emotion: 'neutral'   },
        psychologist: { name: 'Эрмил',             speed: 0.9, pitch: 0.95, emotion: 'calm'      },
        trainer:      { name: 'Филипп (энергичный)', speed: 1.1, pitch: 1.05, emotion: 'energetic' }
    },

    ui: {
        autoStopAfterSilence: true,
        silenceTimeout: 4000,
        minVolumeToConsiderSpeech: 4
    },

    ws: {
        connectTimeout: 15000,  // мс до признания WS недоступным (Render = 10-30с)
        pingInterval: 25000,    // heartbeat
        maxRetries: 5,          // попыток переподключения WS
        retryDelay: 8000        // мс между попытками
    },

    diagnostics: {
        isIOS:                 /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid:             /Android/.test(navigator.userAgent),
        audioContextSupported: !!(window.AudioContext || window.webkitAudioContext),
        mediaRecorderSupported: !!window.MediaRecorder,
        getUserMediaSupported:  !!(navigator.mediaDevices?.getUserMedia)
    }
};

// ============================================
// РЕКОРДЕР
// ============================================

class VoiceRecorder {
    constructor(config = {}) {
        this.config    = { ...VoiceConfig.recording, ...config };
        this.isIOS     = VoiceConfig.diagnostics.isIOS;
        this.isAndroid = VoiceConfig.diagnostics.isAndroid;
        this.recording     = false;
        this.mediaStream   = null;
        this.audioCtx      = null;
        this.processor     = null;
        this.analyser      = null;
        this.wavData       = [];
        this.mediaRecorder = null;
        this.mrChunks      = [];
        this.rafId         = null;
        this.stopTimer     = null;
        this.silenceStart  = null;
        this.speechSeen    = false;
        this.onRecordingStart = null;
        this.onRecordingStop  = null;
        this.onVolumeChange   = null;
        this.onSpeechDetected = null;
        this.onError          = null;
    }

    async start() {
        if (this.recording) return false;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true, noiseSuppression: true,
                    autoGainControl: true, channelCount: 1,
                    ...(this.isIOS ? {} : { sampleRate: this.config.sampleRate })
                }
            });
            this.mediaStream = stream;
            this.wavData = []; this.mrChunks = [];
            this.speechSeen = false; this.silenceStart = null;
            this.recording = true;

            if (this.isIOS && window.MediaRecorder) {
                const types = ['audio/mp4', 'audio/aac', 'audio/webm'];
                const mime  = types.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
                if (mime) {
                    this.mediaRecorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
                    this.mediaRecorder.ondataavailable = e => { if (e.data?.size > 0) this.mrChunks.push(e.data); };
                    this.mediaRecorder.onstop = () => {
                        const blob = new Blob(this.mrChunks, { type: mime });
                        this._finish(blob);
                    };
                    this.mediaRecorder.start(500);
                    this._setupAnalyser(stream);
                } else {
                    await this._setupScriptProcessor(stream);
                }
            } else {
                await this._setupScriptProcessor(stream);
            }

            this.stopTimer = setTimeout(() => this.stop(), this.config.maxDuration);
            if (this.onRecordingStart) this.onRecordingStart();
            return true;
        } catch (err) {
            this.recording = false;
            const msgs = {
                NotAllowedError:  'Разрешите доступ к микрофону в настройках браузера',
                NotFoundError:    'Микрофон не найден',
                NotReadableError: 'Микрофон занят другим приложением'
            };
            if (this.onError) this.onError(msgs[err.name] || 'Не удалось запустить микрофон');
            return false;
        }
    }

    async _setupScriptProcessor(stream) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.config.sampleRate });
        if (this.audioCtx.state === 'suspended') { try { await this.audioCtx.resume(); } catch {} }
        const src = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        src.connect(this.analyser);
        this.processor = this.audioCtx.createScriptProcessor(this.config.chunkSize, 1, 1);
        this.processor.onaudioprocess = e => {
            if (!this.recording) return;
            const data = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(data.length);
            let sumAbs = 0;
            for (let i = 0; i < data.length; i++) {
                const s = Math.max(-1, Math.min(1, data[i]));
                int16[i] = s * 32767;
                sumAbs += Math.abs(int16[i]);
            }
            this.wavData.push(int16);
            const vol = Math.min(100, (sumAbs / data.length / 32768) * 100);
            if (this.onVolumeChange) this.onVolumeChange(vol);
            const isSpeech = vol > VoiceConfig.ui.minVolumeToConsiderSpeech;
            if (isSpeech) {
                if (!this.speechSeen) { this.speechSeen = true; if (this.onSpeechDetected) this.onSpeechDetected(true); }
                this.silenceStart = null;
            } else if (this.speechSeen && !this.silenceStart) {
                this.silenceStart = Date.now();
            }
            // autoStopAfterSilence отключён — пользователь останавливает кнопкой
            // if (VoiceConfig.ui.autoStopAfterSilence && this.speechSeen && this.silenceStart &&
            //     (Date.now() - this.silenceStart) > VoiceConfig.ui.silenceTimeout) {
            //     this.stop();
            // }
        };
        src.connect(this.processor);
        this.processor.connect(this.audioCtx.destination);
        this._startVolumeRaf();
    }

    _setupAnalyser(stream) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            this._volCtx = ctx;
            const buf = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!this.recording) return;
                analyser.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                if (this.onVolumeChange) this.onVolumeChange(Math.min(100, (avg / 255) * 100));
                this.rafId = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.warn('Volume analyser failed:', e); }
    }

    _startVolumeRaf() {
        if (!this.analyser) return;
        const buf = new Uint8Array(this.analyser.frequencyBinCount);
        const tick = () => {
            if (!this.recording || !this.analyser) return;
            this.analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            if (this.onVolumeChange) this.onVolumeChange(Math.min(100, (avg / 255) * 100));
            this.rafId = requestAnimationFrame(tick);
        };
        tick();
    }

    stop() {
        if (!this.recording) return;
        this.recording = false;
        this.silenceStart = null;
        this.speechSeen = false;
        if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null; }
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop(); return;
        }
        if (this.processor) { try { this.processor.disconnect(); } catch {} this.processor = null; }
        if (this.audioCtx)  { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
        if (this._volCtx)   { this._volCtx.close().catch(() => {}); this._volCtx = null; }
        this._stopStream();
        if (this.wavData.length > 0) {
            this._finish(this._buildWav());
        } else {
            this._stopStream();
            if (this.onError) this.onError('Не удалось получить аудио');
            if (this.onRecordingStop) this.onRecordingStop(null);
        }
    }

    _stopStream() {
        if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => { try { t.stop(); } catch {} }); this.mediaStream = null; }
    }

    _finish(blob) { this._stopStream(); if (this.onRecordingStop) this.onRecordingStop(blob); }

    _buildWav() {
        let total = 0;
        for (const c of this.wavData) total += c.length;
        const MAX = Math.floor((this.config.maxDuration / 1000) * this.config.sampleRate);
        if (total > MAX) total = MAX;
        const combined = new Int16Array(total);
        let offset = 0;
        for (const c of this.wavData) {
            if (offset >= total) break;
            const len = Math.min(c.length, total - offset);
            combined.set(c.subarray(0, len), offset);
            offset += len;
        }
        const sr = this.config.sampleRate;
        const buf = new ArrayBuffer(44 + combined.length * 2);
        const v   = new DataView(buf);
        const ws  = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); v.setUint32(4, 36 + combined.length * 2, true);
        ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        ws(36, 'data'); v.setUint32(40, combined.length * 2, true);
        for (let i = 0; i < combined.length; i++) v.setInt16(44 + i * 2, combined[i], true);
        return new Blob([buf], { type: 'audio/wav' });
    }

    isRecordingActive() { return this.recording; }
    dispose() { this.stop(); }
}

// ============================================
// TRANSPORT — WebSocket-first + HTTP fallback
// ============================================

class VoiceTransport {
    constructor(userId, apiBaseUrl) {
        this.userId     = userId;
        this.apiBaseUrl = apiBaseUrl;
        this.isIOS      = VoiceConfig.diagnostics.isIOS;
        this.currentMode = 'psychologist';

        // Состояние транспорта
        this._ws          = null;
        this._wsReady     = false;
        this._wsRetries   = 0;
        this._pingTimer   = null;
        this._audioChunks = [];  // буфер аудио-чанков от WS
        this._wsResponseTimer = null;  // таймаут ожидания ответа по WS
        this._pendingAudioBlob = null; // блоб для повторной отправки через HTTP при разрыве WS

        // Режим: 'ws' | 'http'
        this._mode = 'http';

        // Callbacks
        this.onTranscript     = null;
        this.onAIResponse     = null;
        this.onStatusChange   = null;
        this.onError          = null;
        this.onThinking       = null;
        this.onThinkingUpdate = null;
        this.onWeather        = null;
        this.onModeChange     = null;  // уведомить UI о смене транспорта
    }

    // ---- ПОДКЛЮЧЕНИЕ ----

    async connect() {
        // iOS — сразу HTTP, WebSocket нестабилен с бинарными данными
        if (this.isIOS || !VoiceConfig.useWebSocket) {
            return this._initHTTP('iOS или useWebSocket=false');
        }
        return this._connectWS();
    }

    async _connectWS(isRetry = false) {
        // Передаём текущий режим как query param — бэкенд использует его при создании mode_instance
        const modeParam = this.currentMode ? `?mode=${this.currentMode}` : '';
        const wsUrl = this.apiBaseUrl.replace(/^https?/, 'wss').replace(/^http/, 'ws')
                    + `/ws/voice/${this.userId}${modeParam}`;

        console.log(`🔌 WS connect: ${wsUrl}${isRetry ? ' (retry)' : ''}`);

        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                console.warn('⏱️ WS connect timeout → HTTP fallback');
                this._wsCleanup();
                this._initHTTP('timeout');
                resolve(false);
            }, VoiceConfig.ws.connectTimeout);

            try {
                this._ws = new WebSocket(wsUrl);
            } catch (e) {
                clearTimeout(timeout);
                console.warn('WS constructor error:', e.message, '→ HTTP fallback');
                this._initHTTP('constructor error');
                resolve(false);
                return;
            }

            this._ws.onopen = () => {
                clearTimeout(timeout);
                this._wsReady = true;
                this._mode = 'ws';
                this._wsRetries = 0;
                console.log('✅ WebSocket connected');
                this._startPing();
                if (this.onModeChange) this.onModeChange('ws');
                if (this.onStatusChange) this.onStatusChange('connected');
                resolve(true);
            };

            this._ws.onerror = () => {
                clearTimeout(timeout);
                console.warn('WS error → HTTP fallback');
                this._wsCleanup();
                this._initHTTP('ws error');
                resolve(false);
            };

            this._ws.onclose = (e) => {
                clearTimeout(timeout);
                const wasWS = this._mode === 'ws';
                this._wsReady = false;

                // Если ждали ответ по WS — повторяем через HTTP
                const pendingBlob = this._pendingAudioBlob;
                this._pendingAudioBlob = null;
                this._clearWsResponseTimer();
                if (pendingBlob) {
                    console.warn('WS closed while waiting for response → HTTP fallback');
                    this._initHTTP('ws closed during processing');
                    this._sendHTTP(pendingBlob);
                    return;
                }

                if (this._intentionalClose) {
                    this._intentionalClose = false;
                    return;  // намеренное закрытие — не делаем fallback
                }
                console.warn(`WS closed (code=${e.code})`);
                // 1012 = сервер перезагружается (деплой) — ждём дольше
                if (e.code === 1012) {
                    console.log('🔄 Сервер перезагружается, ждём 15с...');
                    setTimeout(() => {
                        this._wsRetries = 0;
                        this._connectWS().catch(() => {});
                    }, 15000);
                    return;
                }
                if (wasWS) {
                    this._tryReconnectWS();
                }
            };

            this._ws.onmessage = e => this._handleWsMessage(e.data);
        });
    }

    _tryReconnectWS() {
        if (this._wsRetries >= VoiceConfig.ws.maxRetries) {
            console.warn(`WS max retries (${VoiceConfig.ws.maxRetries}) → постоянный HTTP`);
            this._initHTTP('max retries');
            return;
        }
        this._wsRetries++;
        const delay = VoiceConfig.ws.retryDelay * this._wsRetries;
        console.log(`🔄 WS retry ${this._wsRetries}/${VoiceConfig.ws.maxRetries} через ${delay}мс`);
        setTimeout(() => this._connectWS(true), delay);
    }

    _initHTTP(reason = '') {
        this._mode = 'http';
        this._wsReady = false;
        console.log(`📡 HTTP mode${reason ? ' (' + reason + ')' : ''}`);
        if (this.onModeChange) this.onModeChange('http');
        if (this.onStatusChange) this.onStatusChange('connected');
        // Через 30с пробуем вернуться на WS — сервер мог подняться после деплоя
        if (!this._wsRecoveryTimer) {
            this._wsRecoveryTimer = setTimeout(() => {
                this._wsRecoveryTimer = null;
                if (this._mode === 'http') {
                    console.log('🔄 Попытка восстановить WS...');
                    this._wsRetries = 0;
                    this._connectWS().catch(() => {});
                }
            }, 30000);
        }
        return false;
    }

    _wsCleanup(intentional = false) {
        this._stopPing();
        this._clearWsResponseTimer();
        if (this._wsRecoveryTimer) { clearTimeout(this._wsRecoveryTimer); this._wsRecoveryTimer = null; }
        this._intentionalClose = intentional;
        if (this._ws) {
            try { this._ws.close(1000, 'mode_change'); } catch {}
            this._ws = null;
        }
        this._wsReady = false;
    }

    // ---- PING / PONG ----

    _startPing() {
        this._stopPing();
        this._pingTimer = setInterval(() => {
            if (this._ws?.readyState === WebSocket.OPEN) {
                this._ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
        }, VoiceConfig.ws.pingInterval);
    }

    _stopPing() {
        if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    }

    // ---- ОБРАБОТКА WS СООБЩЕНИЙ ----

    _handleWsMessage(raw) {
        try {
            const msg = JSON.parse(raw);

            switch (msg.type) {
                case 'text':
                    this._clearWsResponseTimer();
                    this._pendingAudioBlob = null;
                    if (!msg.data) break;
                    if (msg.data.includes('Вы:') && this.onTranscript)
                        this.onTranscript(msg.data.replace('🎤 Вы: ', '').trim());
                    else if (this.onAIResponse)
                        this.onAIResponse(msg.data.replace('🧠 Фреди: ', '').trim());
                    break;

                case 'audio':
                    this._clearWsResponseTimer();
                    this._pendingAudioBlob = null;
                    if (msg.is_final) {
                        // Конец стрима — собираем все чанки и играем
                        if (this._audioChunks.length > 0 || msg.data) {
                            if (msg.data) this._audioChunks.push(msg.data);
                            this._flushAudio();
                        }
                    } else if (msg.data) {
                        // Защита от переполнения памяти (>10MB)
                        const totalSize = this._audioChunks.reduce((s, c) => s + c.length, 0);
                        if (totalSize > 10 * 1024 * 1024) {
                            console.warn('Audio chunks exceeded 10MB, flushing');
                            this._flushAudio();
                        }
                        // Накапливаем чанки
                        this._audioChunks.push(msg.data);
                    }
                    break;

                case 'status':
                    if (this.onStatusChange) this.onStatusChange(msg.status);
                    break;

                case 'error':
                    this._clearWsResponseTimer();
                    this._pendingAudioBlob = null;
                    if (this.onError) this.onError(msg.error);
                    if (this.onStatusChange) this.onStatusChange('idle');
                    break;

                case 'thinking':
                    if (this.onThinkingUpdate) this.onThinkingUpdate(msg.message || 'Фреди думает');
                    break;

                case 'pong':
                    // heartbeat ответ — OK
                    break;

                case 'ping':
                    if (this._ws?.readyState === WebSocket.OPEN)
                        this._ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
                    break;

                case 'chunk_ack':
                    // подтверждение чанка — OK
                    break;
            }
        } catch (e) {
            console.error('WS message parse error:', e);
        }
    }

    // Собираем накопленные base64-чанки в один Blob и воспроизводим
    async _flushAudio() {
        if (!this._audioChunks.length) return;
        const chunks = [...this._audioChunks];
        this._audioChunks = [];

        try {
            // Склеиваем base64 чанки → один ArrayBuffer
            const byteArrays = chunks
                .filter(c => c && c.length > 0)
                .map(c => {
                    const binary = atob(c);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    return bytes;
                });

            if (!byteArrays.length) return;

            const totalLen = byteArrays.reduce((s, a) => s + a.length, 0);
            const combined = new Uint8Array(totalLen);
            let offset = 0;
            for (const arr of byteArrays) { combined.set(arr, offset); offset += arr.length; }

            const blob = new Blob([combined], { type: 'audio/mpeg' });
            const url  = URL.createObjectURL(blob);

            if (this._onPlayAudio) await this._onPlayAudio(url);

        } catch (e) {
            console.error('_flushAudio error:', e);
        }
    }

    // ---- ОТПРАВКА АУДИО ----

    async sendAudio(audioBlob) {
        const minBytes = (VoiceConfig.recording.minDuration / 1000) *
                         VoiceConfig.recording.sampleRate * 2;
        if (audioBlob.size < minBytes) {
            if (this.onError) this.onError('Говорите немного дольше');
            return false;
        }

        console.log(`📤 sendAudio: ${audioBlob.size}b via ${this._mode.toUpperCase()}`);

        if (this._mode === 'ws' && this._wsReady && this._ws?.readyState === WebSocket.OPEN) {
            return this._sendWS(audioBlob);
        }
        return this._sendHTTP(audioBlob);
    }

    // ---- WEBSOCKET ПУТЬ ----

    async _sendWS(audioBlob) {
        try {
            if (this.onThinking) this.onThinking(true);
            if (this.onStatusChange) this.onStatusChange('processing');

            // Конвертируем Blob → ArrayBuffer → Base64
            // Используем чанки чтобы не переполнять стек (btoa+spread падает на >64KB)
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let base64 = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8.length; i += chunkSize) {
                const chunk = uint8.subarray(i, i + chunkSize);
                base64 += String.fromCharCode.apply(null, chunk);
            }
            base64 = btoa(base64);

            this._audioChunks = []; // сбрасываем буфер
            this._pendingAudioBlob = audioBlob; // сохраняем для повторной отправки при разрыве

            // Таймаут: если за 50с ответ не пришёл — фоллбэк на HTTP
            this._clearWsResponseTimer();
            this._wsResponseTimer = setTimeout(() => {
                console.warn('⏱️ WS response timeout → HTTP fallback');
                this._pendingAudioBlob = null;
                this._wsCleanup();
                this._initHTTP('response timeout');
                this._sendHTTP(audioBlob);
            }, 50000);

            this._ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64,
                is_final: true,
                chunk_index: 1
            }));

            return true;
        } catch (e) {
            console.error('WS send error:', e, '→ HTTP fallback');
            this._pendingAudioBlob = null;
            this._clearWsResponseTimer();
            // При ошибке отправки — падаем на HTTP
            this._wsCleanup();
            this._initHTTP('send error');
            return this._sendHTTP(audioBlob);
        }
    }

    _clearWsResponseTimer() {
        if (this._wsResponseTimer) { clearTimeout(this._wsResponseTimer); this._wsResponseTimer = null; }
    }

    // ---- HTTP ПУТЬ ----

    async _sendHTTP(audioBlob, attempt = 0) {
        const MAX_ATTEMPTS = 2;
        const formData = new FormData();
        formData.append('user_id', String(this.userId));

        let ext = 'wav';
        const t = audioBlob.type || '';
        if (t.includes('mp4')) ext = 'mp4';
        else if (t.includes('aac')) ext = 'aac';
        else if (t.includes('webm')) ext = 'webm';
        else if (t.includes('ogg')) ext = 'ogg';

        formData.append('voice', audioBlob, `audio.${ext}`);
        formData.append('mode', this.currentMode || 'psychologist');
        formData.append('ios_device', this.isIOS ? 'true' : 'false');
        formData.append('user_agent', navigator.userAgent);

        const voiceConf = VoiceConfig.voices[this.currentMode];
        if (voiceConf) {
            formData.append('voice_speed', String(voiceConf.speed));
            formData.append('voice_pitch', String(voiceConf.pitch));
            formData.append('voice_emotion', voiceConf.emotion);
        }

        if (this.onStatusChange) this.onStatusChange('processing');
        if (this.onThinking) this.onThinking(true);

        try {
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 50000);

            const resp = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST', body: formData, signal: ctrl.signal
            });
            clearTimeout(tid);

            if (!resp.ok) {
                const body = await resp.text().catch(() => '');
                throw new Error(`HTTP ${resp.status}: ${body.substring(0, 100)}`);
            }

            const result = await resp.json();
            if (this.onThinking) this.onThinking(false);

            if (!result.success) throw new Error(result.error || 'Сервер вернул ошибку');

            if (result.recognized_text && this.onTranscript)
                this.onTranscript(result.recognized_text);

            if (result.answer && this.onAIResponse)
                this.onAIResponse(result.answer);

            const audioData = result.audio_base64 || result.audio || result.tts_audio;
            if (audioData && this._onPlayAudio) {
                const binary = atob(audioData);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
                await this._onPlayAudio(url);
                URL.revokeObjectURL(url);
            } else if (result.audio_url && this._onPlayAudio) {
                await this._onPlayAudio(result.audio_url);
            }

            if (this.onStatusChange) this.onStatusChange('idle');
            return true;

        } catch (err) {
            if (this.onThinking) this.onThinking(false);
            console.error(`HTTP error (attempt ${attempt + 1}):`, err.name, err.message);

            if (attempt < MAX_ATTEMPTS && err.name !== 'AbortError') {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                return this._sendHTTP(audioBlob, attempt + 1);
            }

            let msg = 'Ошибка соединения';
            if (err.name === 'AbortError')             msg = 'Сервер не отвечает (таймаут)';
            else if (err.message.includes('500'))      msg = 'Ошибка сервера. Попробуйте позже.';
            else if (err.message.includes('429'))      msg = 'Слишком много запросов. Подождите.';
            else if (err.message.includes('Network') ||
                     err.message.includes('fetch'))    msg = 'Нет соединения с интернетом';

            if (this.onError) this.onError(msg);
            if (this.onStatusChange) this.onStatusChange('idle');
            return false;
        }
    }

    // ---- ПРОЧЕЕ ----

    async getWeather() {
        try {
            const r = await fetch(`${this.apiBaseUrl}/api/weather/${this.userId}`);
            const d = await r.json();
            if (d.success && d.weather && this.onWeather) this.onWeather(d.weather);
            return d.weather || null;
        } catch { return null; }
    }

    getMode() { return this._mode; }
    isWS()    { return this._mode === 'ws' && this._wsReady; }

    disconnect() {
        this._wsCleanup();
        this._stopPing();
    }
}

// ============================================
// VOICE MANAGER — главный класс
// ============================================

class VoiceManager {
    constructor(userId, config = {}) {
        this.userId      = userId;
        this.config      = { ...VoiceConfig, ...config };
        this.isIOS       = VoiceConfig.diagnostics.isIOS;
        this.currentMode = 'psychologist';

        this.isRecording  = false;
        this.isAISpeaking = false;

        // Callbacks для app.js
        this.onTranscript     = null;
        this.onAIResponse     = null;
        this.onStatusChange   = null;
        this.onError          = null;
        this.onRecordingStart = null;
        this.onRecordingStop  = null;
        this.onVolumeChange   = null;
        this.onThinking       = null;
        this.onSpeechDetected = null;
        this.onWeather        = null;
        this.onTransportMode  = null;  // 'ws' | 'http' — для UI-индикатора

        this._loading   = new LoadingIndicator();
        this._player    = new AudioPlayer();
        this._transport = null;
        this._rec       = null;
        this._modeSwitching = false;

        console.log('🎤 VoiceManager v2.0, diagnostics:', VoiceConfig.diagnostics);
        this._init();
    }

    _init() {
        // Плеер
        this._player.onPlayStart = () => { this.isAISpeaking = true; this._status('speaking'); };
        this._player.onPlayEnd   = () => { this.isAISpeaking = false; this._status('idle'); };
        this._player.onError     = msg => { if (this.onError) this.onError(msg); };

        // Транспорт
        const apiUrl = this.config.apiBaseUrl || VoiceConfig.apiBaseUrl;
        this._transport = new VoiceTransport(this.userId, apiUrl);
        this._transport.currentMode = this.currentMode;

        // Колбэки транспорта
        this._transport.onTranscript    = t => { if (this.onTranscript) this.onTranscript(t); };
        this._transport.onAIResponse    = a => { if (this.onAIResponse) this.onAIResponse(a); };
        this._transport.onThinking      = b => {
            if (b) this._loading.show('Фреди думает');
            else   this._loading.remove();
            if (this.onThinking) this.onThinking(b);
        };
        this._transport.onThinkingUpdate = m => { this._loading.update(m); };
        this._transport.onStatusChange  = s => {
            if (s === 'speaking') { this.isAISpeaking = true; this._loading.remove(); }
            else if (s === 'idle') { this.isAISpeaking = false; this._loading.remove(); }
            this._status(s);
        };
        this._transport.onError = e => {
            this._loading.remove();
            if (this.onError) this.onError(e);
        };
        this._transport.onWeather    = w => { if (this.onWeather) this.onWeather(w); };
        this._transport.onModeChange = m => {
            console.log(`🔀 Transport mode: ${m.toUpperCase()}`);
            if (this.onTransportMode) this.onTransportMode(m);
        };

        // Плеер для транспорта (и WS и HTTP используют один)
        this._transport._onPlayAudio = async url => {
            this.isAISpeaking = true;
            this._status('speaking');
            try {
                const audio = new Audio();
                audio.volume = 1.0;
                audio.src = url;
                await new Promise((resolve) => {
                    audio.onended = resolve;
                    audio.onerror = resolve;
                    const doPlay = () => {
                        const p = audio.play();
                        if (p) p.catch(resolve);
                    };
                    if (this.isIOS) { audio.oncanplaythrough = doPlay; setTimeout(doPlay, 300); }
                    else            { audio.oncanplay = doPlay; setTimeout(doPlay, 100); }
                });
            } finally {
                this.isAISpeaking = false;
                this._status('idle');
            }
        };

        // Рекордер
        this._rec = new VoiceRecorder(this.config.recording);

        this._rec.onRecordingStart = () => {
            this.isRecording = true;
            this._status('recording');
            if (this.onRecordingStart) this.onRecordingStart();
        };

        this._rec.onRecordingStop = async (blob) => {
            this.isRecording = false;
            this._status('idle');
            if (this.onRecordingStop) this.onRecordingStop(blob);
            if (blob && blob.size > 100) {
                await this._transport.sendAudio(blob);
            } else {
                if (this.onError) this.onError('Аудио слишком короткое');
            }
        };

        this._rec.onVolumeChange   = v => { if (this.onVolumeChange) this.onVolumeChange(v); };
        this._rec.onSpeechDetected = d => { if (this.onSpeechDetected) this.onSpeechDetected(d); };
        this._rec.onError          = e => {
            this.isRecording = false;
            this._status('idle');
            if (this.onError) this.onError(e);
        };

        // Подключаемся асинхронно — не блокируем инит
        this._transport.connect().then(ok => {
            console.log(`🔌 Transport connected via ${this._transport.getMode().toUpperCase()}`);
        }).catch(e => console.warn('Transport connect error:', e));
    }

    _status(s) { if (this.onStatusChange) this.onStatusChange(s); }

    startRecording() {
        if (this.isAISpeaking) {
            this._player.stop();
            this.isAISpeaking = false;
        }
        return this._rec.start();
    }

    stopRecording() { return this._rec.stop(); }

    async textToSpeech(text, mode) {
        try {
            const params = new URLSearchParams();
            params.append('text', text);
            params.append('mode', mode || this.currentMode);
            const vc = this.config.voices?.[mode || this.currentMode];
            if (vc) {
                params.append('speed', String(vc.speed));
                params.append('pitch', String(vc.pitch));
                params.append('emotion', vc.emotion);
            }
            const resp = await fetch(`${this._transport.apiBaseUrl}/api/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });
            if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`);
            const blob = await resp.blob();
            await this._player.play(blob);
        } catch (e) {
            console.error('TTS error:', e);
            if (this.onError) this.onError('Ошибка синтеза речи');
        }
    }

    interrupt() {
        this._player.stop();
        this._loading.remove();
        this.isAISpeaking = false;
        this._status('idle');
    }

    setMode(mode) {
        if (this._modeSwitching) return;
        this._modeSwitching = true;
        this.currentMode = mode;
        if (this._transport) {
            this._transport.currentMode = mode;
            // Если WS активен — переподключаемся с новым mode
            // чтобы бэкенд создал правильный mode_instance
            if (this._transport.isWS()) {
                console.log(`🔄 Переподключение WS для режима: ${mode}`);
                this._transport._wsCleanup(true);  // intentional — не делать fallback
                setTimeout(() => {
                    this._transport._connectWS().catch(e => console.warn('WS reconnect failed:', e));
                    this._modeSwitching = false;
                }, 300);  // небольшая задержка чтобы старый WS успел закрыться
            } else {
                this._modeSwitching = false;
            }
        } else {
            this._modeSwitching = false;
        }
    }

    async getWeather()    { return this._transport?.getWeather(); }
    isRecordingActive()   { return this._rec?.isRecordingActive() || false; }
    isSpeaking()          { return this.isAISpeaking; }
    getCurrentMode()      { return this.currentMode; }
    getTransportMode()    { return this._transport?.getMode() || 'http'; }

    dispose() {
        this._loading.remove();
        this._player.dispose();
        this._rec?.dispose();
        this._transport?.disconnect();
    }
}

// ============================================
// ЭКСПОРТ
// ============================================

if (typeof window !== 'undefined') {
    window.AudioPlayer      = AudioPlayer;
    window.LoadingIndicator = LoadingIndicator;
    window.VoiceRecorder    = VoiceRecorder;
    window.VoiceTransport   = VoiceTransport;
    window.VoiceManager     = VoiceManager;
    window.VoiceConfig      = VoiceConfig;

    window.checkVoiceSupport = () => {
        const d = VoiceConfig.diagnostics;
        console.table(d);
        return d;
    };
}

console.log('✅ voice.js v2.0 загружен. Режим: WS-first + HTTP fallback');
