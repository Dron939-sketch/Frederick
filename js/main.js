// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function init() {
    console.log('🚀 FREDI PREMIUM — полная версия');
    
    try {
        const status = await getUserStatus();
        if (status.profile_code) {
            const profileCodeEl = document.getElementById('profileCode');
            if (profileCodeEl) profileCodeEl.textContent = status.profile_code;
        }
    } catch (e) {}
    
    renderDashboard();
    initMobileMenu();
    
    document.getElementById('userName').textContent = CONFIG.USER_NAME;
    document.getElementById('userMiniAvatar').textContent = CONFIG.USER_NAME.charAt(0);
    
    // Проверяем микрофон при загрузке
    setTimeout(async () => {
        const hasMic = await checkMicrophonePermission();
        if (!hasMic) {
            console.log('Microphone permission not granted yet');
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
