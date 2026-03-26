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

function initMobileMenu() {
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
        document.getElementById('chatsPanel').classList.toggle('open');
    });
}

function initMobileEnhancements() {
    if (window.innerWidth > 768) return;
    
    const container = document.getElementById('screenContainer');
    const swipeIndicator = document.getElementById('swipeIndicator');
    
    if (container && swipeIndicator) {
        let hasScrolled = false;
        
        container.addEventListener('scroll', () => {
            if (!hasScrolled && container.scrollTop > 50) {
                hasScrolled = true;
                swipeIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (swipeIndicator) swipeIndicator.style.display = 'none';
                }, 500);
            }
        });
        
        setTimeout(() => {
            if (swipeIndicator && !hasScrolled) {
                swipeIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (swipeIndicator) swipeIndicator.style.display = 'none';
                }, 500);
            }
        }, 3000);
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
