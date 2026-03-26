// ========== API ВЫЗОВЫ ==========

async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

// ========== КОНФАЙНТМЕНТ-МОДЕЛЬ API ==========

async function getConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement-model?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get confinement model', error);
        return null;
    }
}

async function getConfinementLoops() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/loops`);
        return data;
    } catch (error) {
        console.warn('Failed to get loops', error);
        return null;
    }
}

async function getKeyConfinement() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/key-confinement`);
        return data;
    } catch (error) {
        console.warn('Failed to get key confinement', error);
        return null;
    }
}

async function getIntervention(elementId) {
    try {
        const data = await apiCall(`/api/intervention/${elementId}?user_id=${CONFIG.USER_ID}`);
        return data;
    } catch (error) {
        console.warn('Failed to get intervention', error);
        return null;
    }
}

async function rebuildConfinementModel() {
    try {
        const data = await apiCall(`/api/confinement/model/${CONFIG.USER_ID}/rebuild`, {
            method: 'POST'
        });
        return data;
    } catch (error) {
        console.warn('Failed to rebuild model', error);
        return null;
    }
}

// ========== ПРАКТИКИ API ==========

async function getMorningPractice() {
    try {
        const data = await apiCall('/api/practice/morning');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get morning practice', error);
        return 'Утренняя практика: начните день с намерения. Сделайте 3 глубоких вдоха и скажите себе: "Я выбираю, как мне относиться к этому дню".';
    }
}

async function getEveningPractice() {
    try {
        const data = await apiCall('/api/practice/evening');
        return data.practice;
    } catch (error) {
        console.warn('Failed to get evening practice', error);
        return 'Вечерняя практика: вспомните три хороших события сегодня. За что вы благодарны? Что было важным?';
    }
}

async function getRandomExercise() {
    try {
        const data = await apiCall('/api/practice/random-exercise');
        return data.exercise;
    } catch (error) {
        console.warn('Failed to get exercise', error);
        return 'Сделайте паузу. Обратите внимание на своё дыхание. Вдох... выдох... Повторите 5 раз.';
    }
}

async function getRandomQuote() {
    try {
        const data = await apiCall('/api/practice/random-quote');
        return data.quote;
    } catch (error) {
        console.warn('Failed to get quote', error);
        return '«Не в силе, а в правде. Не в деньгах, а в душевном покое.» — Андрей Мейстер';
    }
}

// ========== ГИПНОЗ API ==========

async function processHypno(text, mode = currentMode) {
    try {
        const data = await apiCall('/api/hypno/process', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                text: text,
                mode: mode
            })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to process hypno', error);
        return 'Сделайте глубокий вдох... Представьте, что с каждым выдохом вы отпускаете напряжение... Вы в безопасности... Дышите...';
    }
}

async function getHypnoSupport(text = '') {
    try {
        const data = await apiCall('/api/hypno/support', {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });
        return data.response;
    } catch (error) {
        console.warn('Failed to get support', error);
        return 'Я здесь. Ты справляешься. Дыши спокойно.';
    }
}

// ========== СКАЗКИ API ==========

async function getTales() {
    try {
        const data = await apiCall('/api/tale');
        return data;
    } catch (error) {
        console.warn('Failed to get tales', error);
        return { success: false, available_tales: [] };
    }
}

async function getTaleById(taleId) {
    try {
        const data = await apiCall(`/api/tale/${taleId}`);
        return data.tale;
    } catch (error) {
        console.warn('Failed to get tale', error);
        return null;
    }
}

// ========== ЯКОРЯ API ==========

async function getUserAnchors() {
    try {
        const data = await apiCall(`/api/anchor/user/${CONFIG.USER_ID}`);
        return data.anchors;
    } catch (error) {
        console.warn('Failed to get anchors', error);
        return [];
    }
}

async function setAnchor(anchorName, state, phrase) {
    try {
        const data = await apiCall('/api/anchor/set', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName,
                state: state,
                phrase: phrase
            })
        });
        return data;
    } catch (error) {
        console.warn('Failed to set anchor', error);
        return null;
    }
}

async function fireAnchor(anchorName) {
    try {
        const data = await apiCall('/api/anchor/fire', {
            method: 'POST',
            body: JSON.stringify({
                user_id: CONFIG.USER_ID,
                anchor_name: anchorName
            })
        });
        return data.phrase;
    } catch (error) {
        console.warn('Failed to fire anchor', error);
        return null;
    }
}

async function getAnchor(state) {
    try {
        const data = await apiCall(`/api/anchor/${state}`);
        return data.phrase;
    } catch (error) {
        console.warn('Failed to get anchor', error);
        return `Я спокоен. Я дышу. Я здесь и сейчас.`;
    }
}

// ========== СТАТИСТИКА API ==========

async function getConfinementStatistics() {
    try {
        const data = await apiCall(`/api/confinement/statistics/${CONFIG.USER_ID}`);
        return data.statistics;
    } catch (error) {
        console.warn('Failed to get statistics', error);
        return {
            total_elements: 0,
            active_elements: 0,
            total_loops: 0,
            is_system_closed: false,
            closure_score: 0
        };
    }
}

// ========== ДРУГИЕ API ==========

async function getUserStatus() {
    try {
        return await apiCall(`/api/user-status?user_id=${CONFIG.USER_ID}`);
    } catch (error) {
        return { has_profile: true, test_completed: true, profile_code: CONFIG.PROFILE_CODE };
    }
}

async function getPsychologistThought() {
    try {
        const data = await apiCall(`/api/thought?user_id=${CONFIG.USER_ID}`);
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function generateNewThought() {
    try {
        const data = await apiCall('/api/psychologist-thoughts/generate', {
            method: 'POST',
            body: JSON.stringify({ user_id: CONFIG.USER_ID })
        });
        return data.thought;
    } catch (error) {
        return null;
    }
}

async function getWeekendIdeas() {
    try {
        const data = await apiCall(`/api/ideas?user_id=${CONFIG.USER_ID}`);
        return data.ideas || [];
    } catch (error) {
        return [];
    }
}

async function getUserProfile() {
    try {
        const data = await apiCall(`/api/get-profile?user_id=${CONFIG.USER_ID}`);
        return data.ai_generated_profile || 'Психологический портрет формируется.';
    } catch (error) {
        return 'Профиль временно недоступен.';
    }
}

async function getUserGoals() {
    try {
        const data = await apiCall(`/api/goals/with-confinement?user_id=${CONFIG.USER_ID}&mode=${currentMode}`);
        return data.goals || [];
    } catch (error) {
        return [];
    }
}

async function getSmartQuestions() {
    try {
        const data = await apiCall(`/api/smart-questions?user_id=${CONFIG.USER_ID}`);
        return data.questions || [];
    } catch (error) {
        return [];
    }
}

async function getChallenges() {
    try {
        const data = await apiCall(`/api/challenges?user_id=${CONFIG.USER_ID}`);
        return data.challenges || [];
    } catch (error) {
        return [];
    }
}

async function findPsychometricDoubles() {
    try {
        const data = await apiCall(`/api/psychometric/find-doubles?user_id=${CONFIG.USER_ID}&limit=5`);
        return data.doubles || [];
    } catch (error) {
        return [];
    }
}
