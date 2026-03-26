// ========== ГОЛОСОВЫЕ ФУНКЦИИ ==========

async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Microphone permission error:', error);
        let errorMessage = '❌ Нет доступа к микрофону. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Микрофон не найден.';
        } else {
            errorMessage += 'Ошибка: ' + error.message;
        }
        showToast(errorMessage, 'error');
        return false;
    }
}

function stopVisualizer() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    if (audioContext) {
        audioContext.close().catch(console.warn);
        audioContext = null;
    }
    
    const voiceBtn = document.getElementById('mainVoiceBtn');
    if (voiceBtn) {
        voiceBtn.style.boxShadow = '';
    }
}

async function startRecordingWithHold() {
    if (isRecording) {
        console.log('Recording already in progress');
        return;
    }
    
    try {
        if (!window.MediaRecorder) {
            showToast('❌ Ваш браузер не поддерживает запись голоса', 'error');
            return;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        mediaStream = stream;
        
        // Инициализируем визуализатор
        if (window.AudioContext || window.webkitAudioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            function updateVolumeIndicator() {
                if (!isRecording) return;
                
                analyser.getByteFrequencyData(dataArray);
                let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                let volume = Math.min(100, (average / 255) * 100);
                
                const voiceBtn = document.getElementById('mainVoiceBtn');
                if (voiceBtn) {
                    const intensity = volume / 100;
                    voiceBtn.style.boxShadow = `0 0 ${20 + intensity * 30}px rgba(255, 59, 59, ${0.3 + intensity * 0.5})`;
                }
                
                animationFrame = requestAnimationFrame(updateVolumeIndicator);
            }
            
            updateVolumeIndicator();
        }
        
        let mimeType = '';
        const supportedTypes = [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ];
        
        for (const type of supportedTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }
        
        const options = mimeType ? { mimeType } : {};
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, processing audio...');
            stopVisualizer();
            
            const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
            
            if (audioBlob.size > 5000) {
                showToast('🎙️ Распознаю речь...', 'info');
                
                const voiceBtn = document.getElementById('mainVoiceBtn');
                if (voiceBtn) {
                    voiceBtn.querySelector('.voice-text').textContent = '🔄 Обработка...';
                }
                
                const result = await sendVoiceToServer(audioBlob);
                
                if (voiceBtn) {
                    voiceBtn.classList.remove('recording');
                    voiceBtn.querySelector('.voice-icon').textContent = '🎤';
                    voiceBtn.querySelector('.voice-text').textContent = MODES[currentMode].voicePrompt;
                }
                
                if (result && result.success) {
                    if (result.recognized_text && result.recognized_text.trim()) {
                        addMessage(`🎤 "${result.recognized_text}"`, 'system');
                    }
                    if (result.answer) {
                        addMessage(result.answer, 'bot');
                        if (result.audio_url) {
                            playAudioResponse(result.audio_url);
                        } else {
                            const ttsResponse = await textToSpeech(result.answer, currentMode);
                            if (ttsResponse?.audio_url) {
                                playAudioResponse(ttsResponse.audio_url);
                            }
                        }
                    }
                } else {
                    const errorMsg = result?.error || 'Не удалось распознать речь';
                    showToast(`❌ ${errorMsg}`, 'error');
                    addMessage(`❌ ${errorMsg}`, 'system');
                }
            } else if (audioBlob.size > 0) {
                showToast('Запись слишком короткая. Поговорите хотя бы 2 секунды.', 'warning');
                addMessage('🎙️ Запись слишком короткая, попробуйте еще раз', 'system');
                
                const voiceBtn = document.getElementById('mainVoiceBtn');
                if (voiceBtn) {
                    voiceBtn.classList.remove('recording');
                    voiceBtn.querySelector('.voice-icon').textContent = '🎤';
                    voiceBtn.querySelector('.voice-text').textContent = MODES[currentMode].voicePrompt;
                }
            }
            
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
            }
            
            isRecording = false;
            if (recordingTimer) {
                clearTimeout(recordingTimer);
                recordingTimer = null;
            }
        };
        
        mediaRecorder.start(1000);
        isRecording = true;
        
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.add('recording');
            voiceBtn.querySelector('.voice-icon').textContent = '⏹️';
            voiceBtn.querySelector('.voice-text').textContent = 'Отпустите для отправки';
        }
        
        recordingTimer = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log('Auto-stop after 60 seconds');
                mediaRecorder.stop();
            }
        }, 60000);
        
    } catch (error) {
        console.error('Recording error:', error);
        isRecording = false;
        stopVisualizer();
        
        let errorMessage = '❌ Ошибка записи: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Нет разрешения на использование микрофона.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Микрофон не найден.';
        } else {
            errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error');
        
        const voiceBtn = document.getElementById('mainVoiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('.voice-icon').textContent = '🎤';
            voiceBtn.querySelector('.voice-text').textContent = MODES[currentMode].voicePrompt;
        }
    }
}

function stopRecordingIfActive() {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('Stopping recording...');
        mediaRecorder.stop();
        return true;
    }
    return false;
}

async function sendVoiceToServer(audioBlob, retries = 2) {
    const formData = new FormData();
    formData.append('user_id', CONFIG.USER_ID);
    formData.append('voice', audioBlob, `voice_${Date.now()}.webm`);
    
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/voice/process`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error(`Send voice attempt ${i + 1} failed:`, error);
            
            if (i === retries) {
                return { 
                    success: false, 
                    error: error.name === 'AbortError' 
                        ? 'Превышено время ожидания ответа от сервера' 
                        : 'Ошибка соединения. Проверьте интернет.'
                };
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

async function textToSpeech(text, mode) {
    try {
        const response = await apiCall('/api/tts', {
            method: 'POST',
            body: JSON.stringify({ text, mode })
        });
        return response;
    } catch (error) {
        console.error('TTS error:', error);
        return null;
    }
}

function playAudioResponse(audioUrl) {
    if (!audioUrl) return;
    const audio = document.getElementById('hiddenAudioPlayer');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = audioUrl;
        audio.play().catch(e => console.warn('Audio error:', e));
    }
}

function initVoiceButton() {
    const voiceBtn = document.getElementById('mainVoiceBtn');
    if (!voiceBtn) {
        console.warn('Voice button not found');
        return;
    }
    
    if (voiceBtn.dataset.initialized === 'true') {
        return;
    }
    
    voiceBtn.dataset.initialized = 'true';
    
    let pressTimer = null;
    let isPressing = false;
    let touchIdentifier = null;
    
    const startPress = (event) => {
        if (isPressing || isRecording) return;
        
        if (event.cancelable) {
            event.preventDefault();
        }
        isPressing = true;
        
        pressTimer = setTimeout(async () => {
            if (isPressing) {
                const hasPermission = await checkMicrophonePermission();
                if (hasPermission) {
                    startRecordingWithHold();
                } else {
                    isPressing = false;
                }
            }
        }, 100);
    };
    
    const endPress = (event) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        
        if (isPressing) {
            if (isRecording) {
                stopRecordingIfActive();
            }
            isPressing = false;
        }
        
        touchIdentifier = null;
    };
    
    voiceBtn.addEventListener('mousedown', startPress);
    voiceBtn.addEventListener('mouseup', endPress);
    voiceBtn.addEventListener('mouseleave', endPress);
    
    voiceBtn.addEventListener('touchstart', (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        if (e.touches && e.touches.length > 0) {
            touchIdentifier = e.touches[0].identifier;
        }
        startPress(e);
    }, { passive: false });
    
    voiceBtn.addEventListener('touchend', (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        if (touchIdentifier !== null) {
            endPress(e);
        }
    }, { passive: false });
    
    voiceBtn.addEventListener('touchcancel', (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        endPress(e);
    }, { passive: false });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRecording) {
            console.log('Page hidden, stopping recording');
            stopRecordingIfActive();
        }
    });
    
    console.log('Voice button initialized successfully');
}
