// ============================================
// test-core.js - ЯДРО ТЕСТА
// Состояние, API, утилиты, UI-функции
// ============================================

const TEST_API_BASE_URL = 'https://fredi-backend-flz2.onrender.com';

// ============================================
// БАЗОВЫЙ КЛАСС ТЕСТА
// ============================================
class TestCore {
    constructor() {
        // Состояние
        this.currentStage = 0;
        this.currentQuestionIndex = 0;
        this.userId = null;
        this.answers = [];
        this.showIntro = true;
        
        // Контекст пользователя
        this.context = {
            city: null,
            gender: null,
            age: null,
            weather: null,
            isComplete: false,
            name: null
        };
        
        // Данные для расчетов
        this.perceptionScores = { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
        this.perceptionType = null;
        this.thinkingLevel = null;
        this.thinkingScores = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
        this.strategyLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.behavioralLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.stage3Scores = [];
        this.diltsCounts = { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
        this.deepAnswers = [];
        this.deepPatterns = null;
        this.profileData = null;
        
        // Уточнения
        this.clarificationIteration = 0;
        this.discrepancies = [];
        this.clarifyingAnswers = [];
        this.clarifyingQuestions = [];
        this.clarifyingCurrent = 0;
        
        // Кэш для AI-профиля
        this.aiGeneratedProfile = null;
        this.psychologistThought = null;
        
        // Структура этапов
        this.stages = [
            { id: 'perception', number: 1, name: 'КОНФИГУРАЦИЯ ВОСПРИЯТИЯ', total: 8 },
            { id: 'thinking', number: 2, name: 'КОНФИГУРАЦИЯ МЫШЛЕНИЯ', total: null },
            { id: 'behavior', number: 3, name: 'КОНФИГУРАЦИЯ ПОВЕДЕНИЯ', total: 8 },
            { id: 'growth', number: 4, name: 'ТОЧКА РОСТА', total: 8 },
            { id: 'deep', number: 5, name: 'ГЛУБИННЫЕ ПАТТЕРНЫ', total: 10 }
        ];
    }
    
    // ============================================
    // МОБИЛЬНАЯ ОПТИМИЗАЦИЯ
    // ============================================
    
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    optimizeMobileView() {
        if (!this.isMobile()) return;
        
        const container = document.getElementById('testChatContainer');
        if (!container) return;
        
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';
        
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.bottom = '0';
        
        const updateHeight = () => {
            const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            container.style.height = `${height}px`;
            container.style.minHeight = `${height}px`;
        };
        
        updateHeight();
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateHeight);
            window.visualViewport.addEventListener('scroll', updateHeight);
        }
        
        setTimeout(() => {
            window.scrollTo(0, 1);
        }, 100);
        
        container.addEventListener('touchmove', (e) => {
            const messages = document.getElementById('testChatMessages');
            if (messages && messages.contains(e.target)) {
                return;
            }
            e.preventDefault();
        }, { passive: false });
        
        console.log('📱 Мобильная оптимизация применена');
    }
    
    deoptimizeMobileView() {
        if (!this.isMobile()) return;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.bottom = '';
    }
    
    // ============================================
    // РАСЧЕТНЫЕ ФУНКЦИИ
    // ============================================
    
    determinePerceptionType() {
        const external = this.perceptionScores.EXTERNAL;
        const internal = this.perceptionScores.INTERNAL;
        const symbolic = this.perceptionScores.SYMBOLIC;
        const material = this.perceptionScores.MATERIAL;
        
        const attention = external > internal ? "EXTERNAL" : "INTERNAL";
        const anxiety = symbolic > material ? "SYMBOLIC" : "MATERIAL";
        
        if (attention === "EXTERNAL" && anxiety === "SYMBOLIC") {
            return "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ";
        } else if (attention === "EXTERNAL" && anxiety === "MATERIAL") {
            return "СТАТУСНО-ОРИЕНТИРОВАННЫЙ";
        } else if (attention === "INTERNAL" && anxiety === "SYMBOLIC") {
            return "СМЫСЛО-ОРИЕНТИРОВАННЫЙ";
        } else {
            return "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ";
        }
    }
    
    calculateThinkingLevel() {
        let totalScore = 0;
        for (let level in this.thinkingScores) {
            totalScore += this.thinkingScores[level];
        }
        
        const thresholds = [0, 10, 20, 30, 40, 50, 60, 70, 80, Infinity];
        for (let i = 1; i < thresholds.length; i++) {
            if (totalScore <= thresholds[i]) return i;
        }
        return 9;
    }
    
    getLevelGroup(level) {
        if (level <= 3) return "1-3";
        if (level <= 6) return "4-6";
        return "7-9";
    }
    
    calculateFinalLevel() {
        const stage2Level = this.thinkingLevel;
        const stage3Avg = this.stage3Scores.length > 0 
            ? this.stage3Scores.reduce((a, b) => a + b, 0) / this.stage3Scores.length 
            : stage2Level;
        return Math.round((stage2Level + stage3Avg) / 2);
    }
    
    determineDominantDilts() {
        let max = 0;
        let dominant = "BEHAVIOR";
        for (let level in this.diltsCounts) {
            if (this.diltsCounts[level] > max) {
                max = this.diltsCounts[level];
                dominant = level;
            }
        }
        return dominant;
    }
    
    calculateFinalProfile() {
        const sbAvg = this.behavioralLevels["СБ"].length 
            ? this.behavioralLevels["СБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["СБ"].length 
            : 3;
        const tfAvg = this.behavioralLevels["ТФ"].length 
            ? this.behavioralLevels["ТФ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ТФ"].length 
            : 3;
        const ubAvg = this.behavioralLevels["УБ"].length 
            ? this.behavioralLevels["УБ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["УБ"].length 
            : 3;
        const chvAvg = this.behavioralLevels["ЧВ"].length 
            ? this.behavioralLevels["ЧВ"].reduce((a, b) => a + b, 0) / this.behavioralLevels["ЧВ"].length 
            : 3;
        
        return {
            displayName: `СБ-${Math.round(sbAvg)}_ТФ-${Math.round(tfAvg)}_УБ-${Math.round(ubAvg)}_ЧВ-${Math.round(chvAvg)}`,
            perceptionType: this.perceptionType,
            thinkingLevel: this.thinkingLevel,
            sbLevel: Math.round(sbAvg),
            tfLevel: Math.round(tfAvg),
            ubLevel: Math.round(ubAvg),
            chvLevel: Math.round(chvAvg),
            dominantDilts: this.determineDominantDilts(),
            diltsCounts: this.diltsCounts
        };
    }
    
    analyzeDeepPatterns() {
        const patterns = { secure: 0, anxious: 0, avoidant: 0, dismissive: 0 };
        (this.deepAnswers || []).forEach(a => {
            if (a.pattern && patterns[a.pattern] !== undefined) {
                patterns[a.pattern] = (patterns[a.pattern] || 0) + 1;
            }
        });
        
        let max = 0, dominant = "secure";
        for (let p in patterns) {
            if (patterns[p] > max) { max = patterns[p]; dominant = p; }
        }
        
        const map = {
            secure: "🤗 Надежный",
            anxious: "😥 Тревожный",
            avoidant: "🛡️ Избегающий",
            dismissive: "🏔️ Отстраненный"
        };
        
        return { attachment: map[dominant] || "🤗 Надежный", patterns };
    }
    
    // ============================================
    // ИНТЕРПРЕТАЦИИ
    // ============================================
    
    getStage1Interpretation() {
        const interpretations = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на других, чутко считываете настроение и ожидания окружающих. Ваше внимание направлено вовне, а тревога связана с отвержением.",
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": "Для вас важны статус, положение и материальные достижения. Вы ориентированы на внешние атрибуты успеха, а тревожитесь о потере контроля.",
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": "Вы ищете глубинные смыслы и ориентируетесь на внутренние ощущения. Ваша тревога связана с отвержением и непониманием.",
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на практические результаты и конкретные действия. Ваше внимание направлено внутрь, а тревога — о потере контроля."
        };
        return interpretations[this.perceptionType] || interpretations["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"];
    }
    
    getStage2Interpretation() {
        const levelGroup = this.getLevelGroup(this.thinkingLevel);
        
        const interpretations = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и привязано к социальным ситуациям. Вы хорошо понимаете сиюминутные взаимодействия, но не всегда видите общие закономерности.",
                "4-6": "Вы замечаете социальные закономерности и тренды. Видите, как складываются отношения и почему люди ведут себя определенным образом.",
                "7-9": "Вы видите глубинные социальные механизмы и законы. Можете предсказывать развитие социальных ситуаций."
            },
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление направлено на достижение статуса. Вы хорошо понимаете иерархию и позиции, но не всегда видите скрытые механизмы.",
                "4-6": "Вы стратегически мыслите в категориях статуса. Видите, как меняются позиции и что нужно для продвижения.",
                "7-9": "Вы видите иерархические закономерности. Понимаете законы власти и влияния."
            },
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Вы ищете смыслы в отдельных событиях. Вам важно понять 'почему' в конкретных ситуациях.",
                "4-6": "Вы находите закономерности в жизненных историях. Видите связь событий и их глубинный смысл.",
                "7-9": "Вы постигаете глубинные смыслы бытия. Видите универсальные законы, управляющие жизнью."
            },
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и практично. Вы хорошо решаете текущие задачи, но не всегда видите перспективу.",
                "4-6": "Вы видите практические закономерности. Понимаете, как устроены процессы и системы.",
                "7-9": "Вы создаёте эффективные практические модели. Можете оптимизировать любые процессы."
            }
        };
        
        return interpretations[this.perceptionType]?.[levelGroup] || interpretations["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"]["4-6"];
    }
    
    getStage3Interpretation() {
        const finalLevel = this.calculateFinalLevel();
        const feedback = {
            1: "Ваше поведение реактивно — вы скорее отвечаете на стимулы, чем действуете осознанно.",
            2: "Вы начинаете осознавать свои автоматические реакции.",
            3: "Вы можете выбирать реакции, но не всегда.",
            4: "Вы управляете своим поведением в большинстве ситуаций.",
            5: "Поведение становится инструментом для достижения целей.",
            6: "Вы мастерски владеете своим поведением."
        };
        
        let level = finalLevel <= 2 ? 1 : finalLevel <= 4 ? 2 : finalLevel <= 6 ? 3 : finalLevel <= 8 ? 4 : 5;
        if (finalLevel >= 9) level = 6;
        
        return feedback[level] || feedback[3];
    }
    
    getStage5Interpretation() {
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        
        const attachmentDesc = {
            "🤗 Надежный": "У тебя надёжный тип привязанности — ты уверен в отношениях и не боишься близости.",
            "😥 Тревожный": "Тревожный тип привязанности: ты часто боишься, что тебя бросят, нуждаешься в подтверждениях любви.",
            "🛡️ Избегающий": "Избегающий тип привязанности: ты держишь дистанцию, боишься близости, надеясь только на себя.",
            "🏔️ Отстраненный": "Отстранённый тип: ты обесцениваешь отношения, считая, что лучше быть одному."
        };
        
        return `🔗 Тип привязанности:\n${attachmentDesc[deep.attachment] || attachmentDesc["🤗 Надежный"]}`;
    }
    
    // ============================================
    // ФУНКЦИИ ФОРМАТИРОВАНИЯ
    // ============================================
    
    cleanTextForDisplay(text) {
        if (!text) return text;
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/__(.*?)__/g, '$1');
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/_(.*?)_/g, '$1');
        text = text.replace(/`(.*?)`/g, '$1');
        text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
        text = text.replace(/#{1,6}\s+/g, '');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/\n\s*\n/g, '\n\n');
        return text;
    }
    
    formatProfileText(text) {
        if (!text) return text;
        text = this.cleanTextForDisplay(text);
        
        const headerMap = {
            'БЛОК 1:': '🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА',
            'БЛОК 2:': '💪 СИЛЬНЫЕ СТОРОНЫ',
            'БЛОК 3:': '🎯 ЗОНЫ РОСТА',
            'БЛОК 4:': '🌱 КАК ЭТО СФОРМИРОВАЛОСЬ',
            'БЛОК 5:': '⚠️ ГЛАВНАЯ ЛОВУШКА',
            'БЛОК1:': '🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА',
            'БЛОК2:': '💪 СИЛЬНЫЕ СТОРОНЫ',
            'БЛОК3:': '🎯 ЗОНЫ РОСТА',
            'БЛОК4:': '🌱 КАК ЭТО СФОРМИРОВАЛОСЬ',
            'БЛОК5:': '⚠️ ГЛАВНАЯ ЛОВУШКА'
        };
        
        for (const [oldHeader, newHeader] of Object.entries(headerMap)) {
            const regex = new RegExp(oldHeader, 'gi');
            text = text.replace(regex, `<b>${newHeader}</b>`);
        }
        
        const headers = Object.values(headerMap);
        for (const header of headers) {
            const pattern = new RegExp(`<b>${header}</b>\\s*\\n\\s*<b>${header}</b>`, 'gi');
            text = text.replace(pattern, `<b>${header}</b>`);
        }
        
        text = text.replace(/•\s*/g, '<br>• ');
        text = text.replace(/-\s*/g, '<br>• ');
        text = text.replace(/\n\n/g, '<br><br>');
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    getClarifyingQuestions(discrepancies, currentLevels, clarifyingQuestionsDB, discrepancyQuestions) {
        const questions = [];
        
        for (const vector of ["СБ", "ТФ", "УБ", "ЧВ"]) {
            if (discrepancies.includes(vector)) {
                const level = Math.round(currentLevels[vector] || 3);
                const vectorQuestions = clarifyingQuestionsDB[vector] || [];
                
                const matchingQuestion = vectorQuestions.find(q => q.level === level);
                if (matchingQuestion) {
                    questions.push({
                        type: "vector",
                        vector: vector,
                        text: matchingQuestion.text,
                        options: matchingQuestion.options
                    });
                } else {
                    const nearest = vectorQuestions.reduce((prev, curr) => {
                        return Math.abs(curr.level - level) < Math.abs(prev.level - level) ? curr : prev;
                    }, vectorQuestions[0]);
                    
                    if (nearest) {
                        questions.push({
                            type: "vector",
                            vector: vector,
                            text: nearest.text,
                            options: nearest.options
                        });
                    }
                }
            }
        }
        
        const generalDiscrepancies = ["people", "money", "signs", "relations"];
        for (const disc of discrepancies) {
            if (generalDiscrepancies.includes(disc) && discrepancyQuestions[disc]) {
                questions.push({
                    type: "discrepancy",
                    target: disc,
                    text: discrepancyQuestions[disc].text,
                    options: discrepancyQuestions[disc].options
                });
            }
        }
        
        const uniqueQuestions = [];
        const questionTexts = new Set();
        
        for (const q of questions) {
            if (!questionTexts.has(q.text)) {
                questionTexts.add(q.text);
                uniqueQuestions.push(q);
            }
        }
        
        return uniqueQuestions.slice(0, 5);
    }
    
    // ============================================
    // РАБОТА С USER_ID
    // ============================================
    
    getUserId() {
        if (window.maxContext?.user_id && window.maxContext.user_id !== 'null' && window.maxContext.user_id !== 'undefined') {
            return window.maxContext.user_id;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        if (urlUserId && urlUserId !== 'null' && urlUserId !== 'undefined') {
            return urlUserId;
        }
        const stored = localStorage.getItem('fredi_user_id');
        if (stored && stored !== 'null' && stored !== 'undefined') {
            return stored;
        }
        console.warn('⚠️ userId не найден!');
        return null;
    }
    
    // ============================================
    // СОХРАНЕНИЕ/ЗАГРУЗКА ПРОГРЕССА
    // ============================================
    
    init(userId) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        
        this.userId = userId || this.getUserId() || urlUserId;
        
        if (!this.userId || this.userId === 'null' || this.userId === 'undefined') {
            console.warn('⚠️ userId не найден! Тест будет работать в локальном режиме');
            this.userId = null;
        } else {
            console.log('✅ userId найден:', this.userId);
            localStorage.setItem('fredi_user_id', this.userId);
        }
        
        this.reset();
        this.loadProgress();
        console.log('📝 Тест инициализирован для пользователя:', this.userId);
    }
    
    reset() {
        this.currentStage = 0;
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.perceptionScores = { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
        this.perceptionType = null;
        this.thinkingLevel = null;
        this.thinkingScores = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
        this.strategyLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.behavioralLevels = { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
        this.stage3Scores = [];
        this.diltsCounts = { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
        this.deepAnswers = [];
        this.deepPatterns = null;
        this.profileData = null;
        this.discrepancies = [];
        this.clarifyingAnswers = [];
        this.clarifyingQuestions = [];
        this.clarifyingCurrent = 0;
        this.aiGeneratedProfile = null;
        this.psychologistThought = null;
        this.context = {
            city: null,
            gender: null,
            age: null,
            weather: null,
            isComplete: false,
            name: null
        };
    }
    
    loadProgress() {
        if (!this.userId) return;
        
        const saved = localStorage.getItem(`test_${this.userId}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.currentStage = data.currentStage || 0;
                this.currentQuestionIndex = data.currentQuestionIndex || 0;
                this.answers = data.answers || [];
                this.perceptionScores = data.perceptionScores || { EXTERNAL: 0, INTERNAL: 0, SYMBOLIC: 0, MATERIAL: 0 };
                this.perceptionType = data.perceptionType || null;
                this.thinkingLevel = data.thinkingLevel || null;
                this.thinkingScores = data.thinkingScores || { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 };
                this.strategyLevels = data.strategyLevels || { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
                this.behavioralLevels = data.behavioralLevels || { "СБ": [], "ТФ": [], "УБ": [], "ЧВ": [] };
                this.stage3Scores = data.stage3Scores || [];
                this.diltsCounts = data.diltsCounts || { "ENVIRONMENT": 0, "BEHAVIOR": 0, "CAPABILITIES": 0, "VALUES": 0, "IDENTITY": 0 };
                this.deepAnswers = data.deepAnswers || [];
                this.deepPatterns = data.deepPatterns || null;
                this.profileData = data.profileData || null;
                this.context = data.context || { city: null, gender: null, age: null, weather: null, isComplete: false, name: null };
            } catch (e) { console.warn('❌ Ошибка загрузки прогресса:', e); }
        }
    }
    
    saveProgress() {
        if (!this.userId) return;
        
        const data = {
            currentStage: this.currentStage,
            currentQuestionIndex: this.currentQuestionIndex,
            answers: this.answers,
            perceptionScores: this.perceptionScores,
            perceptionType: this.perceptionType,
            thinkingLevel: this.thinkingLevel,
            thinkingScores: this.thinkingScores,
            strategyLevels: this.strategyLevels,
            behavioralLevels: this.behavioralLevels,
            stage3Scores: this.stage3Scores,
            diltsCounts: this.diltsCounts,
            deepAnswers: this.deepAnswers,
            deepPatterns: this.deepPatterns,
            profileData: this.profileData,
            context: this.context,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(`test_${this.userId}`, JSON.stringify(data));
        console.log('💾 Прогресс сохранен');
    }
    
    // ============================================
    // API ЗАПРОСЫ
    // ============================================
    
    async saveContextToServer() {
        if (!this.userId) return false;
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/save-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(this.userId),
                    context: {
                        city: this.context.city,
                        gender: this.context.gender,
                        age: this.context.age
                    }
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Ошибка сохранения контекста:', error);
            return false;
        }
    }
    
    async fetchWeatherFromServer() {
        if (!this.userId || !this.context.city) return null;
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/weather/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.weather) {
                return {
                    temp: data.weather.temperature,
                    description: data.weather.description,
                    icon: data.weather.icon
                };
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения погоды:', error);
            return null;
        }
    }
    
    async sendTestResultsToServer() {
        if (!this.userId) {
            console.warn('⚠️ Нет user_id, результаты сохранены локально');
            return false;
        }
        
        const profile = this.calculateFinalProfile();
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        
        const results = {
            user_id: parseInt(this.userId),
            context: this.context,
            results: {
                perception_type: this.perceptionType,
                thinking_level: this.thinkingLevel,
                behavioral_levels: this.behavioralLevels,
                dilts_counts: this.diltsCounts,
                deep_patterns: deep,
                profile_data: profile,
                all_answers: this.answers,
                test_completed: true,
                test_completed_at: new Date().toISOString()
            }
        };
        
        console.log('📤 Отправка результатов на сервер...', { userId: parseInt(this.userId) });
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/save-test-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.warn('⚠️ Сервер вернул не-JSON ответ, статус:', response.status);
                data = { success: response.ok };
            }
            
            if (data.success) {
                console.log('✅ Результаты теста успешно отправлены на сервер');
                await this.fetchAIGeneratedProfile();
                return true;
            } else {
                console.error('❌ Ошибка при отправке:', data.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка сети:', error);
            return false;
        }
    }
    
    async fetchAIGeneratedProfile() {
        if (!this.userId) return;
        
        try {
            console.log('📥 Запрос AI-профиля...');
            const response = await fetch(`${TEST_API_BASE_URL}/api/generated-profile/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.ai_profile) {
                this.aiGeneratedProfile = data.ai_profile;
                console.log('✅ AI-профиль получен');
            } else if (data.status === 'generating') {
                console.log('⏳ AI-профиль генерируется, ждём...');
                setTimeout(() => this.fetchAIGeneratedProfile(), 3000);
                return;
            }
        } catch (error) {
            console.error('Ошибка получения AI-профиля:', error);
        }
    }
    
    async fetchPsychologistThought() {
        if (!this.userId) return null;
        
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/psychologist-thought/${this.userId}`);
            const data = await response.json();
            
            if (data.success && data.thought) {
                this.psychologistThought = data.thought;
                return data.thought;
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения мыслей психолога:', error);
            return null;
        }
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestCore;
}
