// ============================================
// voice.js - Голосовой модуль
// ============================================

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
            this.ws.binaryType = 'arraybuffer';
            
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
        if (data.type === 'chunk_ack') {
            console.log(`✅ Chunk ${data.chunk_index} acknowledged`);
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
        this.useWebSocket = false;  // Используем HTTP (стабильно)
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
                    sampleRate: 16000,
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
            
            if (window.showToast) window.showToast('🎙️ Говорите... Отпустите для отправки', 'info');
            
        } catch (error) {
            console.error('Start recording error:', error);
            if (window.showToast) window.showToast('❌ Не удалось получить доступ к микрофону', 'error');
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
            let totalLength = 0;
            for (const chunk of this.wavData) totalLength += chunk.length;
            
            const combinedPCM = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of this.wavData) {
                combinedPCM.set(chunk, offset);
                offset += chunk.length;
            }
            
            console.log(`🔊 PCM data: ${combinedPCM.length} samples`);
            
            // ВСЕГДА ИСПОЛЬЗУЕМ HTTP (стабильно)
            const wavBlob = this.createWavBlob(this.wavData);
            this.sendViaHTTPWithBlob(wavBlob);
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
    
    async sendAudioInChunks(pcmData) {
        const CHUNK_SIZE = 8000;
        
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64Data = btoa(binary);
        
        const totalLength = base64Data.length;
        console.log(`📤 Sending PCM audio: ${totalLength} chars total, ${pcmData.length} samples`);
        
        const waitForAck = (chunkIndex) => {
            return new Promise((resolve) => {
                const handler = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'chunk_ack' && data.chunk_index === chunkIndex) {
                        console.log(`✅ Chunk ${chunkIndex} acknowledged`);
                        liveVoiceWS.ws.removeEventListener('message', handler);
                        resolve();
                    }
                };
                liveVoiceWS.ws.addEventListener('message', handler);
                setTimeout(() => {
                    liveVoiceWS.ws.removeEventListener('message', handler);
                    console.warn(`⚠️ No ack for chunk ${chunkIndex}`);
                    resolve();
                }, 5000);
            });
        };
        
        for (let i = 0; i < totalLength; i += CHUNK_SIZE) {
            const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
            const chunk = base64Data.slice(i, i + CHUNK_SIZE);
            const isFinal = i + CHUNK_SIZE >= totalLength;
            
            if (!liveVoiceWS || !liveVoiceWS.ws || liveVoiceWS.ws.readyState !== WebSocket.OPEN) {
                console.warn('WebSocket closed, switching to HTTP');
                const wavBlob = this.createWavBlob([pcmData]);
                this.sendViaHTTPWithBlob(wavBlob);
                return;
            }
            
            liveVoiceWS.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: chunk,
                is_final: isFinal,
                format: 'pcm16',
                sample_rate: 16000,
                chunk_index: chunkIndex
            }));
            
            console.log(`📦 Sent PCM chunk ${chunkIndex}: ${chunk.length} chars, is_final=${isFinal}`);
            
            if (!isFinal) {
                await waitForAck(chunkIndex);
            }
        }
        
        console.log(`✅ All ${Math.ceil(totalLength/CHUNK_SIZE)} PCM chunks sent`);
    }
    
    createWavBlob(audioData) {
        let totalLength = 0;
        for (const chunk of audioData) totalLength += chunk.length;
        
        const MAX_SAMPLES = 480000;
        if (totalLength > MAX_SAMPLES) totalLength = MAX_SAMPLES;
        
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
        formData.append('user_id', window.CONFIG?.USER_ID || 213102077);
        formData.append('voice', audioBlob, 'audio.wav');
        formData.append('mode', window.currentMode || 'psychologist');
        
        fetch(`${window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'}/api/voice/process`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                if (result.recognized_text && window.addMessage) {
                    window.addMessage(`🎤 "${result.recognized_text}"`, 'system');
                }
                if (result.answer && window.addMessage) {
                    window.addMessage(result.answer, 'bot');
                }
                if (result.audio_base64 && window.playAudioResponse) {
                    window.playAudioResponse(result.audio_base64);
                }
            } else if (window.showToast) {
                window.showToast(`❌ ${result.error || 'Ошибка распознавания'}`, 'error');
            }
        })
        .catch(error => {
            console.error('HTTP voice error:', error);
            if (window.showToast) window.showToast('❌ Ошибка соединения', 'error');
        });
    }
    
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
