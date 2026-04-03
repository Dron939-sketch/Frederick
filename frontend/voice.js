// ============================================
// FREDI VOICE — полная переработка
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

        // Флаг "пользователь уже тапал" — нужен для iOS
        this._unlocked = false;
        const unlock = () => {
            this._unlocked = true;
            // Создаём и сразу останавливаем пустой Audio — разблокирует контекст на iOS
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
                // data URI — декодируем в Blob → objectURL
                const m = audioData.match(/^data:(audio\/[^;]+);base64,(.+)$/);
                if (m) {
                    const binary = atob(m[2]);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: m[1] });
                    audioUrl = URL.createObjectURL(blob);
                    isObjectUrl = true;
                }
            } else if (typeof audioData === 'string' && audioData.startsWith('blob:')) {
                audioUrl = audioData;
            } else if (typeof audioData === 'string') {
                // base64 без префикса
                try {
                    const binary = atob(audioData);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: mimeType });
                    audioUrl = URL.createObjectURL(blob);
                    isObjectUrl = true;
                } catch {
                    audioUrl = audioData; // Возможно это URL
                }
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
                    if (isObjectUrl && audioUrl) {
                        URL.revokeObjectURL(audioUrl);
                    }
                };

                this.audio.onended = () => {
                    cleanup();
                    this.audio = null;
                    if (this.onPlayEnd) this.onPlayEnd();
                    resolve();
                };

                this.audio.onerror = (e) => {
                    cleanup();
                    this.audio = null;
                    const err = new Error('Ошибка воспроизведения аудио: ' + (e?.message || 'unknown'));
                    console.error('🔊 Audio error:', e, 'URL:', audioUrl);
                    if (this.onError) this.onError('Не удалось воспроизвести аудио');
                    reject(err);
                };

                this.audio.src = audioUrl;
                this.audio.load();

                const doPlay = () => {
                    if (!this.audio) { resolve(); return; }
                    const p = this.audio.play();
                    if (p && p.then) {
                        p.then(() => {
                            console.log('🔊 Воспроизведение начато');
                            if (this.onPlayStart) this.onPlayStart();
                        }).catch(err => {
                            console.error('🔊 play() rejected:', err.name, err.message);
                            cleanup();
                            this.audio = null;
                            if (this.onError) this.onError('Нажмите на экран для включения звука');
                            reject(err);
                        });
                    }
                };

                // На iOS ждём canplaythrough, на других — просто play()
                if (this.isIOS) {
                    this.audio.oncanplaythrough = doPlay;
                    setTimeout(doPlay, 300); // Fallback если событие не пришло
                } else {
                    this.audio.oncanplay = doPlay;
                    setTimeout(doPlay, 100);
                }
            });

        } catch (err) {
            console.error('🔊 AudioPlayer.play error:', err);
            if (this.onError) this.onError('Ошибка звука: ' + err.message);
            throw err;
        }
    }

    stop() {
        if (this.audio) {
            try {
                this.audio.pause();
                this.audio.src = '';
            } catch {}
            this.audio = null;
        }
        if (this.currentUrl) {
            try { URL.revokeObjectURL(this.currentUrl); } catch {}
            this.currentUrl = null;
        }
    }

    isPlaying() {
        return this.audio && !this.audio.paused && !this.audio.ended;
    }

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
            position: fixed;
            bottom: max(100px, calc(env(safe-area-inset-bottom) + 80px));
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10,10,10,0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 50px;
            padding: 12px 24px;
            border: 1px solid rgba(224,224,224,0.2);
            z-index: 9998;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            font-size: 14px;
            color: #ff6b3b;
            white-space: nowrap;
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

    update(message) {
        if (this.msgEl) this.msgEl.textContent = message;
    }

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
    apiBaseUrl: 'https://fredi-backend-flz2.onrender.com',
    useWebSocket: false, // По умолчанию HTTP — надёжнее

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
        coach:       { name: 'Филипп',           speed: 1.0, pitch: 1.0,  emotion: 'neutral'   },
        psychologist:{ name: 'Эрмил',            speed: 0.9, pitch: 0.95, emotion: 'calm'      },
        trainer:     { name: 'Филипп (энергичный)',speed: 1.1, pitch: 1.05, emotion: 'energetic' }
    },

    ui: {
        autoStopAfterSilence: true,
        silenceTimeout: 4000,
        minVolumeToConsiderSpeech: 4
    },

    diagnostics: {
        isIOS:                /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid:            /Android/.test(navigator.userAgent),
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

        // Состояние
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

        // Колбэки
        this.onRecordingStart = null;
        this.onRecordingStop  = null;  // (audioBlob) => void
        this.onVolumeChange   = null;  // (0-100) => void
        this.onSpeechDetected = null;  // (bool) => void
        this.onError          = null;  // (msg) => void
    }

    async start() {
        if (this.recording) return false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl:  true,
                    channelCount: 1,
                    ...(this.isIOS ? {} : { sampleRate: this.config.sampleRate })
                }
            });

            this.mediaStream = stream;
            this.wavData     = [];
            this.mrChunks    = [];
            this.speechSeen  = false;
            this.silenceStart = null;
            this.recording   = true;

            // iOS: предпочитаем MediaRecorder (mp4/aac)
            if (this.isIOS && window.MediaRecorder) {
                const types = ['audio/mp4', 'audio/aac', 'audio/webm'];
                const mime  = types.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
                if (mime) {
                    this.mediaRecorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
                    this.mediaRecorder.ondataavailable = e => { if (e.data?.size > 0) this.mrChunks.push(e.data); };
                    this.mediaRecorder.onstop = () => {
                        const blob = new Blob(this.mrChunks, { type: mime });
                        console.log(`🎙️ MediaRecorder blob: ${blob.size} bytes, type: ${mime}`);
                        this._finish(blob);
                    };
                    this.mediaRecorder.start(500);
                    // Анализатор громкости отдельно
                    this._setupAnalyser(stream);
                } else {
                    await this._setupScriptProcessor(stream);
                }
            } else {
                await this._setupScriptProcessor(stream);
            }

            // Максимальное время
            this.stopTimer = setTimeout(() => {
                console.log('⏱️ Max duration reached');
                this.stop();
            }, this.config.maxDuration);

            if (this.onRecordingStart) this.onRecordingStart();
            console.log(`🎙️ Recording started (${this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Desktop'})`);
            return true;

        } catch (err) {
            this.recording = false;
            console.error('🎙️ getUserMedia error:', err);
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
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.config.sampleRate
        });

        if (this.audioCtx.state === 'suspended') {
            try { await this.audioCtx.resume(); } catch {}
        }

        const src     = this.audioCtx.createMediaStreamSource(stream);
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
                if (!this.speechSeen) {
                    this.speechSeen = true;
                    if (this.onSpeechDetected) this.onSpeechDetected(true);
                }
                this.silenceStart = null;
            } else if (this.speechSeen && !this.silenceStart) {
                this.silenceStart = Date.now();
            }

            if (VoiceConfig.ui.autoStopAfterSilence && this.speechSeen && this.silenceStart &&
                (Date.now() - this.silenceStart) > VoiceConfig.ui.silenceTimeout) {
                console.log('🔇 Auto-stop: silence detected');
                this.stop();
            }
        };

        src.connect(this.processor);
        this.processor.connect(this.audioCtx.destination);
        this._startVolumeRaf();
    }

    _setupAnalyser(stream) {
        try {
            const ctx     = new (window.AudioContext || window.webkitAudioContext)();
            const src     = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            this._volCtx = ctx;

            const buf = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!this.recording) return;
                analyser.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                const vol = Math.min(100, (avg / 255) * 100);
                if (this.onVolumeChange) this.onVolumeChange(vol);
                this.rafId = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            console.warn('Volume analyser setup failed:', e);
        }
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

        if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null; }
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop(); // onstop вызовет _finish
            return; // blob придёт через onstop
        }

        // ScriptProcessor путь
        if (this.processor) { try { this.processor.disconnect(); } catch {} this.processor = null; }
        if (this.audioCtx)  { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
        if (this._volCtx)   { this._volCtx.close().catch(() => {}); this._volCtx = null; }
        this._stopStream();

        if (this.wavData.length > 0) {
            const blob = this._buildWav();
            console.log(`🎙️ WAV blob: ${blob.size} bytes`);
            this._finish(blob);
        } else {
            if (this.onError) this.onError('Не удалось получить аудио');
        }
    }

    _stopStream() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => { try { t.stop(); } catch {} });
            this.mediaStream = null;
        }
    }

    _finish(blob) {
        this._stopStream();
        if (this.onRecordingStop) this.onRecordingStop(blob);
    }

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

        ws(0, 'RIFF');
        v.setUint32(4, 36 + combined.length * 2, true);
        ws(8, 'WAVE');
        ws(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);   // PCM
        v.setUint16(22, 1, true);   // Mono
        v.setUint32(24, sr, true);
        v.setUint32(28, sr * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        ws(36, 'data');
        v.setUint32(40, combined.length * 2, true);
        for (let i = 0; i < combined.length; i++) v.setInt16(44 + i * 2, combined[i], true);

        return new Blob([buf], { type: 'audio/wav' });
    }

    isRecordingActive() { return this.recording; }
    dispose() { this.stop(); }
}

// ============================================
// VoiceWebSocket (HTTP-first, WS опционально)
// ============================================

class VoiceWebSocket {
    constructor(userId, config = {}) {
        this.userId      = userId;
        this.config      = { ...VoiceConfig, ...config };
        this.apiBaseUrl  = this.config.apiBaseUrl;
        this.isIOS       = VoiceConfig.diagnostics.isIOS;
        this.currentMode = 'psychologist';
        this.useWebSocket = false;
        this.ws          = null;
        this.isConnected = false;

        this.onTranscript    = null;
        this.onAIResponse    = null;
        this.onStatusChange  = null;
        this.onError         = null;
        this.onThinking      = null;
        this.onThinkingUpdate = null;
        this.onWeather       = null;
    }

    async connect() {
        // iOS — только HTTP
        if (this.isIOS || !this.config.useWebSocket) {
            return this._initHTTP();
        }

        try {
            const wsUrl = `wss://${new URL(this.apiBaseUrl).host}/ws/voice/${this.userId}`;
            this.ws = new WebSocket(wsUrl);

            await new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('WS timeout')), 5000);
                this.ws.onopen  = () => { clearTimeout(t); resolve(); };
                this.ws.onerror = () => { clearTimeout(t); reject(new Error('WS error')); };
            });

            this.useWebSocket = true;
            this.isConnected  = true;
            this.ws.onmessage = e => this._handleWsMessage(e.data);
            this.ws.onclose   = () => { this.useWebSocket = false; this._initHTTP(); };
            this.ws.onerror   = () => { this.useWebSocket = false; this._initHTTP(); };
            console.log('✅ WebSocket connected');
            return true;

        } catch (e) {
            console.warn('WS failed, using HTTP:', e.message);
            return this._initHTTP();
        }
    }

    _initHTTP() {
        this.isConnected  = true;
        this.useWebSocket = false;
        console.log('📡 HTTP mode');
        if (this.onStatusChange) this.onStatusChange('connected');
        return true;
    }

    _handleWsMessage(raw) {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'text' && msg.data) {
                if (msg.data.includes('Вы:') && this.onTranscript)
                    this.onTranscript(msg.data.replace('🎤 Вы: ', ''));
                else if (this.onAIResponse)
                    this.onAIResponse(msg.data.replace('🧠 Фреди: ', ''));
            } else if (msg.type === 'audio' && msg.data) {
                this._playBase64(msg.data);
            } else if (msg.type === 'status') {
                this._updateStatus(msg.status);
            } else if (msg.type === 'thinking' && this.onThinkingUpdate) {
                this.onThinkingUpdate(msg.message || 'Фреди думает');
            } else if (msg.type === 'error' && this.onError) {
                this.onError(msg.error);
            } else if (msg.type === 'ping' && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
            }
        } catch (e) {
            console.error('WS message parse error:', e);
        }
    }

    _updateStatus(status) {
        if (this.onStatusChange) this.onStatusChange(status);
    }

    async sendFullAudio(audioBlob) {
        const minBytes = (this.config.recording.minDuration / 1000) * 
                         this.config.recording.sampleRate * 2;

        if (audioBlob.size < minBytes) {
            console.warn(`Audio too short: ${audioBlob.size} bytes < ${minBytes}`);
            if (this.onError) this.onError('Говорите немного дольше');
            return false;
        }

        console.log(`📤 Sending audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        return this._sendHTTP(audioBlob);
    }

    async _sendHTTP(audioBlob, attempt = 0) {
        const MAX_ATTEMPTS = 2;

        const formData = new FormData();
        formData.append('user_id', String(this.userId));

        // Определяем формат по MIME
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

        const voiceConf = this.config.voices[this.currentMode];
        if (voiceConf) {
            formData.append('voice_speed', String(voiceConf.speed));
            formData.append('voice_pitch', String(voiceConf.pitch));
            formData.append('voice_emotion', voiceConf.emotion);
        }

        this._updateStatus('processing');
        if (this.onThinking) this.onThinking(true);

        try {
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 50000);

            console.log(`📡 POST /api/voice/process (attempt ${attempt + 1})`);

            const resp = await fetch(`${this.apiBaseUrl}/api/voice/process`, {
                method: 'POST',
                body:   formData,
                signal: ctrl.signal
            });

            clearTimeout(tid);
            console.log(`📡 Response: ${resp.status}`);

            if (!resp.ok) {
                const body = await resp.text().catch(() => '');
                throw new Error(`HTTP ${resp.status}: ${body.substring(0, 100)}`);
            }

            const result = await resp.json();
            console.log('📡 Result keys:', Object.keys(result));

            if (this.onThinking) this.onThinking(false);

            if (!result.success) {
                throw new Error(result.error || 'Сервер вернул ошибку');
            }

            // Транскрипт
            if (result.recognized_text && this.onTranscript) {
                console.log('📝 Recognized:', result.recognized_text);
                this.onTranscript(result.recognized_text);
            }

            // Текстовый ответ
            if (result.answer && this.onAIResponse) {
                console.log('🧠 Answer:', result.answer.substring(0, 80) + '...');
                this.onAIResponse(result.answer);
            }

            // АУДИО — пробуем все возможные поля
            const audioData = result.audio_base64 || result.audio || result.tts_audio;
            if (audioData) {
                console.log('🔊 Got audio_base64, length:', audioData.length);
                await this._playBase64(audioData);
            } else if (result.audio_url) {
                console.log('🔊 Got audio_url:', result.audio_url);
                await this._playUrl(result.audio_url);
            } else {
                console.warn('⚠️ No audio in response. Keys:', Object.keys(result));
            }

            this._updateStatus('idle');
            return true;

        } catch (err) {
            if (this.onThinking) this.onThinking(false);
            console.error(`📡 HTTP error (attempt ${attempt + 1}):`, err.name, err.message);

            if (attempt < MAX_ATTEMPTS && err.name !== 'AbortError') {
                const delay = 2000 * (attempt + 1);
                console.log(`🔄 Retry in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this._sendHTTP(audioBlob, attempt + 1);
            }

            let msg = 'Ошибка соединения';
            if (err.name === 'AbortError')           msg = 'Сервер не отвечает (таймаут)';
            else if (err.message.includes('500'))    msg = 'Ошибка сервера. Попробуйте позже.';
            else if (err.message.includes('429'))    msg = 'Слишком много запросов. Подождите.';
            else if (err.message.includes('Network') || err.message.includes('fetch'))
                                                     msg = 'Нет соединения с интернетом';

            if (this.onError) this.onError(msg);
            this._updateStatus('idle');
            return false;
        }
    }

    async _playBase64(base64) {
        try {
            // Декодируем base64 → Blob → objectURL → Audio
            const binary = atob(base64);
            const bytes  = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob   = new Blob([bytes], { type: 'audio/mpeg' });
            const url    = URL.createObjectURL(blob);

            await this._playUrl(url);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('🔊 _playBase64 error:', e);
            if (this.onError) this.onError('Не удалось воспроизвести аудио');
        }
    }

    async _playUrl(url) {
        return new Promise((resolve) => {
            this._updateStatus('speaking');
            const audio = new Audio();
            audio.volume = 1.0;
            audio.src    = url;

            const done = () => { this._updateStatus('idle'); resolve(); };

            audio.onended = done;
            audio.onerror = (e) => {
                console.error('🔊 Audio playback error:', e);
                if (this.onError) this.onError('Ошибка воспроизведения');
                done();
            };

            const play = () => {
                const p = audio.play();
                if (p) p.catch(e => {
                    console.error('🔊 play() error:', e.name, e.message);
                    if (this.onError) this.onError('Коснитесь экрана для включения звука');
                    done();
                });
            };

            if (this.isIOS) {
                audio.oncanplaythrough = play;
                setTimeout(play, 500);
            } else {
                audio.oncanplay = play;
                setTimeout(play, 100);
            }
        });
    }

    async getWeather() {
        try {
            const r = await fetch(`${this.apiBaseUrl}/api/weather/${this.userId}`);
            const d = await r.json();
            if (d.success && d.weather && this.onWeather) this.onWeather(d.weather);
            return d.weather || null;
        } catch { return null; }
    }

    disconnect() {
        if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
        this.isConnected = false;
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

        // Колбэки для app.js
        this.onTranscript    = null;
        this.onAIResponse    = null;
        this.onStatusChange  = null;
        this.onError         = null;
        this.onRecordingStart = null;
        this.onRecordingStop  = null;
        this.onVolumeChange   = null;
        this.onThinking       = null;
        this.onSpeechDetected = null;
        this.onWeather        = null;

        this._loading = new LoadingIndicator();
        this._player  = new AudioPlayer();
        this._ws      = null;
        this._rec     = null;

        console.log('🎤 VoiceManager init, diagnostics:', VoiceConfig.diagnostics);
        this._init();
    }

    _init() {
        // Плеер
        this._player.onPlayStart = () => {
            this.isAISpeaking = true;
            this._status('speaking');
        };
        this._player.onPlayEnd = () => {
            this.isAISpeaking = false;
            this._status('idle');
        };
        this._player.onError = msg => {
            console.error('Player error:', msg);
            if (this.onError) this.onError(msg);
        };

        // WebSocket/HTTP транспорт
        this._ws = new VoiceWebSocket(this.userId, this.config);
        this._ws.currentMode = this.currentMode;

        this._ws.onTranscript    = t => { console.log('📝 Transcript:', t); if (this.onTranscript) this.onTranscript(t); };
        this._ws.onAIResponse    = a => { console.log('🧠 AI Response received'); if (this.onAIResponse) this.onAIResponse(a); };
        this._ws.onThinking      = b => {
            if (b) this._loading.show('Фреди думает');
            else   this._loading.remove();
            if (this.onThinking) this.onThinking(b);
        };
        this._ws.onThinkingUpdate = m => { this._loading.update(m); };
        this._ws.onStatusChange  = s => {
            if (s === 'speaking') { this.isAISpeaking = true; this._loading.remove(); }
            else if (s === 'idle') { this.isAISpeaking = false; this._loading.remove(); }
            this._status(s);
        };
        this._ws.onError = e => {
            console.error('WS/HTTP error:', e);
            this._loading.remove();
            if (this.onError) this.onError(e);
        };
        this._ws.onWeather = w => { if (this.onWeather) this.onWeather(w); };

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
                console.log(`📤 Sending blob: ${blob.size} bytes`);
                await this._ws.sendFullAudio(blob);
            } else {
                console.warn('⚠️ Blob too small or empty:', blob?.size);
                if (this.onError) this.onError('Аудио слишком короткое');
            }
        };

        this._rec.onVolumeChange   = v => { if (this.onVolumeChange) this.onVolumeChange(v); };
        this._rec.onSpeechDetected = d => { if (this.onSpeechDetected) this.onSpeechDetected(d); };
        this._rec.onError          = e => { if (this.onError) this.onError(e); };

        // Подключаемся (не блокируем)
        this._ws.connect().catch(e => console.warn('Connect failed:', e));
    }

    _status(s) {
        if (this.onStatusChange) this.onStatusChange(s);
    }

    startRecording() {
        if (this.isAISpeaking) {
            this._player.stop();
            this.isAISpeaking = false;
        }
        return this._rec.start();
    }

    stopRecording() {
        return this._rec.stop();
    }

    async textToSpeech(text, mode) {
        try {
            const params = new URLSearchParams();
            params.append('text', text);
            params.append('mode', mode || this.currentMode);
            const vc = this.config.voices[mode || this.currentMode];
            if (vc) {
                params.append('speed', String(vc.speed));
                params.append('pitch', String(vc.pitch));
                params.append('emotion', vc.emotion);
            }

            const resp = await fetch(`${this.config.apiBaseUrl}/api/voice/tts`, {
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
        this.currentMode = mode;
        if (this._ws) this._ws.currentMode = mode;
        console.log('🎭 Mode:', mode);
    }

    async getWeather()          { return this._ws?.getWeather(); }
    isRecordingActive()         { return this._rec?.isRecordingActive() || false; }
    isSpeaking()                { return this.isAISpeaking; }
    getCurrentMode()            { return this.currentMode; }

    dispose() {
        this._loading.remove();
        this._player.dispose();
        this._rec.dispose();
        this._ws?.disconnect();
    }
}

// ============================================
// ЭКСПОРТ
// ============================================

if (typeof window !== 'undefined') {
    window.AudioPlayer     = AudioPlayer;
    window.LoadingIndicator = LoadingIndicator;
    window.VoiceRecorder   = VoiceRecorder;
    window.VoiceWebSocket  = VoiceWebSocket;
    window.VoiceManager    = VoiceManager;
    window.VoiceConfig     = VoiceConfig;

    window.checkVoiceSupport = () => {
        const d = VoiceConfig.diagnostics;
        console.table(d);
        return d;
    };
}

console.log('✅ voice.js загружен. Диагностика:', VoiceConfig.diagnostics);
