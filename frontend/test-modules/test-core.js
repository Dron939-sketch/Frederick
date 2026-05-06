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

        // Кэш расширенных интерпретаций этапов (грузится с бэка через
        // GET /api/test/interpretations при старте теста; см. loadInterpretations).
        // Формат: см. backend/data/test_interpretations.json
        // Если загрузка не удалась — методы getStageNInterpretation() уходят
        // в захардкоренный fallback (короткие старые тексты).
        this.interpretations = null;
        
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
    
    // ============================================
    // ЗАГРУЗКА РАСШИРЕННЫХ ИНТЕРПРЕТАЦИЙ С БЭКА
    // ============================================
    // Источник правды: backend/data/test_interpretations.json
    // Эндпоинт: GET /api/test/interpretations
    // Грузим один раз при первом обращении, кэшируем в this.interpretations.
    // При любой ошибке методы getStageNInterpretation() уходят в захардкоренный
    // fallback — короткие тексты как до рефакторинга. Тест продолжает работать,
    // просто без расширенных блоков.
    async loadInterpretations() {
        if (this.interpretations) return this.interpretations;
        try {
            const response = await fetch(`${TEST_API_BASE_URL}/api/test/interpretations`);
            if (response.ok) {
                this.interpretations = await response.json();
                return this.interpretations;
            }
        } catch (e) {
            console.warn('Failed to load interpretations, using fallback:', e);
        }
        this.interpretations = {};
        return this.interpretations;
    }

    // Распределение перцептивных баллов в проценты по 4 осям —
    // используется для визуализации в showStage1Result.
    getPerceptionDistribution() {
        const total = Object.values(this.perceptionScores).reduce((a, b) => a + b, 0) || 1;
        return {
            EXTERNAL: Math.round(100 * this.perceptionScores.EXTERNAL / total),
            INTERNAL: Math.round(100 * this.perceptionScores.INTERNAL / total),
            SYMBOLIC: Math.round(100 * this.perceptionScores.SYMBOLIC / total),
            MATERIAL: Math.round(100 * this.perceptionScores.MATERIAL / total)
        };
    }

    // Доминирующий уровень Дилтса (для этапа 4) и распределение в процентах.
    getDiltsDistribution() {
        const total = Object.values(this.diltsCounts).reduce((a, b) => a + b, 0) || 1;
        const result = {};
        for (const [k, v] of Object.entries(this.diltsCounts)) {
            result[k] = Math.round(100 * v / total);
        }
        return result;
    }

    // Реальный confidence для этапа 4 — раньше был захардкорен 0.7.
    // Считаем как соответствие между типом восприятия (этап 1) и
    // доминантой Дилтса (этап 4). Если согласованы — высокая, противоречат —
    // ниже. Базовая 0.6, +/- по согласованности.
    calculateStage4Confidence() {
        const dominant = this.determineDominantDilts();
        const type = this.perceptionType;
        // Соответствия (мягкая эвристика):
        // СОЦИАЛЬНО → ENVIRONMENT/BEHAVIOR (внешнее)
        // СТАТУСНО → BEHAVIOR/CAPABILITIES
        // СМЫСЛО → VALUES/IDENTITY
        // ПРАКТИКО → BEHAVIOR/CAPABILITIES
        const expected = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": ["ENVIRONMENT", "BEHAVIOR"],
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": ["BEHAVIOR", "CAPABILITIES"],
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": ["VALUES", "IDENTITY"],
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": ["BEHAVIOR", "CAPABILITIES"]
        };
        let confidence = 0.6;
        if (expected[type]?.includes(dominant)) {
            confidence = 0.85;
        } else if (expected[type]) {
            confidence = 0.55;
        }
        return confidence;
    }

    // ============================================
    // ИНТЕРПРЕТАЦИИ — структурированные (для расширенного UI)
    // ============================================
    // Каждый getStageNInterpretation() возвращает либо расширенную структуру
    // из загруженного JSON, либо короткий fallback-текст (если загрузка
    // не удалась). showStageNResult в test-main.js знает, как рендерить и то,
    // и другое.

    getStage1Interpretation() {
        const data = this.interpretations?.stage1?.perception_types?.[this.perceptionType];
        if (data) {
            return {
                main: data.main,
                anxiety: data.anxiety,
                practice: data.practice,
                distribution: this.getPerceptionDistribution()
            };
        }
        // Fallback (старый короткий формат)
        const fallback = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на других, чутко считываете настроение и ожидания окружающих. Ваше внимание направлено вовне, а тревога связана с отвержением.",
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": "Для вас важны статус, положение и материальные достижения. Вы ориентированы на внешние атрибуты успеха, а тревожитесь о потере контроля.",
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": "Вы ищете глубинные смыслы и ориентируетесь на внутренние ощущения. Ваша тревога связана с отвержением и непониманием.",
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": "Вы ориентированы на практические результаты и конкретные действия. Ваше внимание направлено внутрь, а тревога — о потере контроля."
        };
        return { main: fallback[this.perceptionType] || fallback["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"] };
    }

    getStage2Interpretation() {
        const level = String(this.thinkingLevel);
        const levels = this.interpretations?.stage2?.by_type_and_level?.[this.perceptionType];
        const meta = this.interpretations?.stage2?.level_meta?.[level];
        if (levels && levels[level]) {
            return {
                main: levels[level],
                level: this.thinkingLevel,
                strength: meta?.strength,
                weakness: meta?.weakness
            };
        }
        // Fallback (старый формат — группы)
        const levelGroup = this.getLevelGroup(this.thinkingLevel);
        const fallbackByGroup = {
            "СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и привязано к социальным ситуациям.",
                "4-6": "Вы замечаете социальные закономерности и тренды.",
                "7-9": "Вы видите глубинные социальные механизмы и законы."
            },
            "СТАТУСНО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление направлено на достижение статуса.",
                "4-6": "Вы стратегически мыслите в категориях статуса.",
                "7-9": "Вы видите иерархические закономерности."
            },
            "СМЫСЛО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Вы ищете смыслы в отдельных событиях.",
                "4-6": "Вы находите закономерности в жизненных историях.",
                "7-9": "Вы постигаете глубинные смыслы бытия."
            },
            "ПРАКТИКО-ОРИЕНТИРОВАННЫЙ": {
                "1-3": "Ваше мышление конкретно и практично.",
                "4-6": "Вы видите практические закономерности.",
                "7-9": "Вы создаёте эффективные практические модели."
            }
        };
        return { main: fallbackByGroup[this.perceptionType]?.[levelGroup] || fallbackByGroup["СОЦИАЛЬНО-ОРИЕНТИРОВАННЫЙ"]["4-6"], level: this.thinkingLevel };
    }

    getStage3Interpretation() {
        const finalLevel = this.calculateFinalLevel();
        const vectorsCfg = this.interpretations?.stage3?.vectors;
        const summaryCfg = this.interpretations?.stage3?.summary_by_final_level;

        // Считаем средние по 4 векторам
        const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const sbAvg = avg(this.behavioralLevels["СБ"]);
        const tfAvg = avg(this.behavioralLevels["ТФ"]);
        const ubAvg = avg(this.behavioralLevels["УБ"]);
        const chvAvg = avg(this.behavioralLevels["ЧВ"]);

        if (vectorsCfg && summaryCfg) {
            return {
                averages: { sbAvg, tfAvg, ubAvg, chvAvg },
                finalLevel,
                vectors: {
                    sb: { name: vectorsCfg.sb.name, icon: vectorsCfg.sb.icon, level: sbAvg, text: vectorsCfg.sb.by_level[String(sbAvg)] || "" },
                    tf: { name: vectorsCfg.tf.name, icon: vectorsCfg.tf.icon, level: tfAvg, text: vectorsCfg.tf.by_level[String(tfAvg)] || "" },
                    ub: { name: vectorsCfg.ub.name, icon: vectorsCfg.ub.icon, level: ubAvg, text: vectorsCfg.ub.by_level[String(ubAvg)] || "" },
                    chv: { name: vectorsCfg.chv.name, icon: vectorsCfg.chv.icon, level: chvAvg, text: vectorsCfg.chv.by_level[String(chvAvg)] || "" }
                },
                summary: summaryCfg[String(finalLevel)] || ""
            };
        }
        // Fallback (старый короткий формат)
        const fallback = {
            1: "Ваше поведение реактивно — вы скорее отвечаете на стимулы, чем действуете осознанно.",
            2: "Вы начинаете осознавать свои автоматические реакции.",
            3: "Вы можете выбирать реакции, но не всегда.",
            4: "Вы управляете своим поведением в большинстве ситуаций.",
            5: "Поведение становится инструментом для достижения целей.",
            6: "Вы мастерски владеете своим поведением."
        };
        let level = finalLevel <= 2 ? 1 : finalLevel <= 4 ? 2 : finalLevel <= 6 ? 3 : finalLevel <= 8 ? 4 : 5;
        if (finalLevel >= 9) level = 6;
        return { averages: { sbAvg, tfAvg, ubAvg, chvAvg }, finalLevel, summary: fallback[level] || fallback[3] };
    }

    // НОВЫЙ метод (раньше для этапа 4 не было полной интерпретации,
    // только однострочный getGrowthTip и захардкоренный confidence 0.7).
    getStage4Interpretation() {
        const dominant = this.determineDominantDilts();
        const cfg = this.interpretations?.stage4?.dilts_levels?.[dominant];
        const distribution = this.getDiltsDistribution();
        const confidence = this.calculateStage4Confidence();
        if (cfg) {
            return {
                dominant,
                title: cfg.title,
                icon: cfg.icon,
                what_means: cfg.what_means,
                lever: cfg.lever,
                blind_spot: cfg.blind_spot,
                distribution,
                confidence
            };
        }
        // Fallback (нет JSON — собираем по-минимуму)
        return {
            dominant,
            title: dominant,
            icon: "🎯",
            what_means: `Ваша точка роста — на уровне ${dominant.toLowerCase()}.`,
            distribution,
            confidence
        };
    }

    getStage5Interpretation() {
        const deep = this.deepPatterns || { attachment: "🤗 Надежный" };
        const cfg = this.interpretations?.stage5?.attachment?.[deep.attachment];
        if (cfg) {
            return {
                attachment: { emoji: deep.attachment, label: cfg.label, text: cfg.text }
            };
        }
        // Fallback
        const fallback = {
            "🤗 Надежный": "У тебя надёжный тип привязанности — ты уверен в отношениях и не боишься близости.",
            "😥 Тревожный": "Тревожный тип привязанности: ты часто боишься, что тебя бросят, нуждаешься в подтверждениях любви.",
            "🛡️ Избегающий": "Избегающий тип привязанности: ты держишь дистанцию, боишься близости, надеясь только на себя.",
            "🏔️ Отстраненный": "Отстранённый тип: ты обесцениваешь отношения, считая, что лучше быть одному."
        };
        return {
            attachment: { emoji: deep.attachment, label: deep.attachment, text: fallback[deep.attachment] || fallback["🤗 Надежный"] }
        };
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
