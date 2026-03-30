// ============================================
// test-main.js - ГЛАВНЫЙ ФАЙЛ ТЕСТА
// UI, навигация, управление этапами
// ============================================

class TestApp {
    constructor() {
        this.core = new TestCore();
        this.stageManagers = {
            perception: new Stage1Manager(this.core),
            thinking: new Stage2Manager(this.core),
            behavior: new Stage3Manager(this.core),
            growth: new Stage4Manager(this.core),
            deep: new Stage5Manager(this.core)
        };
        
        // Дополняем stages описаниями
        this.core.stages[0].shortDesc = 'Линза, через которую вы смотрите на мир';
        this.core.stages[0].detailedDesc = `🔍 ЧТО МЫ ИССЛЕДУЕМ:

• Куда направлено ваше внимание — вовне или внутрь
• Какая тревога доминирует — страх отвержения или страх потери контроля

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`;
        
        this.core.stages[1].shortDesc = 'Как вы обрабатываете информацию';
        this.core.stages[1].detailedDesc = `🎯 САМОЕ ВАЖНОЕ:

Конфигурация мышления — это траектория с чётким пунктом назначения: результат, к которому вы придёте. Если ничего не менять — вы попадёте именно туда.

📊 Вопросов: 4-5
⏱ Время: ~3-4 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`;
        
        this.core.stages[2].shortDesc = 'Ваши автоматические реакции';
        this.core.stages[2].detailedDesc = `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Ваши автоматические реакции
• Как вы действуете в разных ситуациях
• Какие стратегии поведения закреплены

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`;
        
        this.core.stages[3].shortDesc = 'Где находится рычаг изменений';
        this.core.stages[3].detailedDesc = `⚡ ЧТО МЫ НАЙДЁМ:

Где именно находится рычаг — место, где минимальное усилие даёт максимальные изменения.

📊 Вопросов: 8
⏱ Время: ~3 минуты

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`;
        
        this.core.stages[4].shortDesc = 'Тип привязанности, защитные механизмы';
        this.core.stages[4].detailedDesc = `🔍 ЗДЕСЬ МЫ ИССЛЕДУЕМ:

• Какой у вас тип привязанности (из детства)
• Какие защитные механизмы вы используете
• Какие глубинные убеждения управляют вами
• Чего вы боитесь на самом деле

📊 Вопросов: 10
⏱ Время: ~5 минут

💡 Совет: Отвечайте честно — это поможет мне лучше понять вас.`;
    }
    
    // ============================================
    // UI ФУНКЦИИ
    // ============================================
    
    createStyledButton(text, onClick, disabled = false) {
        const btn = document.createElement('button');
        btn.className = 'test-message-button';
        btn.textContent = text;
        btn.style.cssText = `
            background: rgba(255, 107, 59, 0.15);
            border: 1px solid rgba(255, 107, 59, 0.3);
            border-radius: 30px;
            padding: 10px 20px;
            font-size: 14px;
            color: white;
            cursor: ${disabled ? 'default' : 'pointer'};
            transition: all 0.2s;
            font-family: inherit;
            opacity: ${disabled ? 0.5 : 1};
        `;
        
        if (!disabled) {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255, 107, 59, 0.3)';
                btn.style.transform = 'scale(1.02)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255, 107, 59, 0.15)';
                btn.style.transform = 'scale(1)';
            });
            btn.addEventListener('click', onClick);
        }
        
        return btn;
    }
    
    addBotMessage(text, isHtml = true) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        if (isHtml) {
            textDiv.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            textDiv.textContent = text;
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        bubble.appendChild(textDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    }
    
    addUserMessage(text) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-user';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-user';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.textContent = text;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        bubble.appendChild(textDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    }
    
    addQuestionMessage(text, options, callback, current, total) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'test-message-text';
        textDiv.innerHTML = `<b>Вопрос ${current}/${total}</b><br><br>${text}`;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        buttonsDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;';
        
        options.forEach((opt, idx) => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            const btn = this.createStyledButton(optText, () => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
                this.addUserMessage(optText);
                callback(idx, opt);
            });
            buttonsDiv.appendChild(btn);
        });
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = `📊 Прогресс: ${Math.round((current / total) * 100)}%`;
        timeDiv.style.cssText = 'font-size: 10px; opacity: 0.6; margin-top: 8px;';
        
        bubble.appendChild(textDiv);
        bubble.appendChild(buttonsDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
    }
    
    addMessageWithButtons(text, buttons) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'test-message test-message-bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'test-message-bubble test-message-bubble-bot';
        
        if (text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'test-message-text';
            textDiv.innerHTML = text.replace(/\n/g, '<br>');
            bubble.appendChild(textDiv);
        }
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'test-message-buttons';
        buttonsDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;';
        
        buttons.forEach(btn => {
            const button = this.createStyledButton(btn.text, () => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'default';
                btn.callback();
            });
            buttonsDiv.appendChild(button);
        });
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'test-message-time';
        timeDiv.textContent = 'только что';
        timeDiv.style.cssText = 'font-size: 10px; opacity: 0.6; margin-top: 8px;';
        
        bubble.appendChild(buttonsDiv);
        bubble.appendChild(timeDiv);
        msgDiv.appendChild(bubble);
        
        messagesContainer.appendChild(msgDiv);
        this.scrollToBottom();
        return msgDiv;
    }
    
    showTextInput(field, placeholder, showSkip = false) {
        const messagesContainer = document.getElementById('testChatMessages');
        if (!messagesContainer) return;
        
        const inputDiv = document.createElement('div');
        inputDiv.className = 'test-message test-message-input';
        inputDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = `
            flex: 1;
            padding: 10px;
            border-radius: 20px;
            border: 1px solid rgba(255,107,59,0.3);
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 16px;
        `;
        
        const button = this.createStyledButton('📤 ОТПРАВИТЬ', () => {
            const value = input.value.trim();
            if (value) {
                this.addUserMessage(value);
                inputDiv.remove();
                if (field === 'city') {
                    this.setCity(value);
                } else if (field === 'age') {
                    this.setAge(value);
                }
            }
        });
        
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                button.click();
            }
        };
        
        inputDiv.appendChild(input);
        inputDiv.appendChild(button);
        
        if (showSkip) {
            const skipButton = this.createStyledButton('⏭ ПРОПУСТИТЬ', () => {
                this.addUserMessage('Пропустить');
                inputDiv.remove();
                if (field === 'city') {
                    this.askGender();
                } else if (field === 'age') {
                    this.showContextSummary();
                }
            });
            inputDiv.appendChild(skipButton);
        }
        
        messagesContainer.appendChild(inputDiv);
        input.focus();
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        setTimeout(() => {
            const container = document.getElementById('testChatMessages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    }
    
    // ============================================
    // ЛОГИКА ТЕСТА
    // ============================================
    
    getCurrentManager() {
        const stageId = this.core.stages[this.core.currentStage]?.id;
        return this.stageManagers[stageId];
    }
    
    getCurrentQuestions() {
        const manager = this.getCurrentManager();
        if (manager && manager.getQuestions) {
            return manager.getQuestions();
        }
        return [];
    }
    
    start() {
        this.core.init();
        this.showTestScreen();
        
        setTimeout(() => {
            if (this.core.context.isComplete) {
                this.addBotMessage('🧠 ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ\n\nПривет! Я помню тебя. Хочешь пройти тест заново?');
                this.addMessageWithButtons("", [
                    { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
                    { text: "🔄 ОБНОВИТЬ КОНТЕКСТ", callback: () => this.startContextCollection() }
                ]);
            } else {
                this.showIntroScreen();
            }
        }, 100);
    }
    
    showTestScreen() {
        const container = document.getElementById('screenContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="test-chat-container" id="testChatContainer">
                <div class="test-chat-messages" id="testChatMessages">
                    <div class="test-chat-placeholder"></div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            this.core.optimizeMobileView();
        }, 100);
        
        this.scrollToBottom();
    }
    
    showIntroScreen() {
        const text = `
🧠 ФРЕДИ: ВИРТУАЛЬНЫЙ ПСИХОЛОГ

Привет! 👋

Я — Фреди, виртуальный психолог.
Оцифрованная версия Андрея Мейстера.

🕒 Нам нужно познакомиться, чтобы я понимал,
   с кем имею дело и чем могу быть полезен.

📊 5 ЭТАПОВ ТЕСТИРОВАНИЯ:

1️⃣ КОНФИГУРАЦИЯ ВОСПРИЯТИЯ
   Линза, через которую вы смотрите на мир

2️⃣ КОНФИГУРАЦИЯ МЫШЛЕНИЯ
   Как вы обрабатываете информацию

3️⃣ КОНФИГУРАЦИЯ ПОВЕДЕНИЯ
   Ваши автоматические реакции

4️⃣ ТОЧКА РОСТА
   Где находится рычаг изменений

5️⃣ ГЛУБИННЫЕ ПАТТЕРНЫ
   Тип привязанности, защитные механизмы

⏱ 15 минут — и я буду знать о вас больше,
   чем вы думаете.

👇 СНАЧАЛА НУЖНО НЕМНОГО УЗНАТЬ О ВАС
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ЗНАКОМСТВО", callback: () => this.startContextCollection() },
            { text: "🤨 А ТЫ ВООБЩЕ КТО ТАКОЙ?", callback: () => this.showBotInfo() }
        ]);
    }
    
    showBotInfo() {
        const text = `
🎭 Ну, вопрос хороший. Давайте по существу.

Видите ли, дорогой человек, я — экспериментальная модель.
Андрей Мейстер однажды подумал: "А что, если я создам свою цифровую копию?
Пусть работает, пока я сплю, ем или просто ленюсь".

Так я и появился. 🧠

🧐 Что я умею:

• Вижу паттерны там, где вы видите просто день сурка
• Нахожу систему в ваших "случайных" решениях
• Понимаю, почему вы выбираете одних и тех же "не тех" людей
• Я реально беспристрастен — у меня нет плохого настроения

🎯 Конкретно по тесту:

1️⃣ Восприятие — поймём, какую линзу вы носите
2️⃣ Мышление — узнаем, как вы пережёвываете реальность
3️⃣ Поведение — посмотрим, что вы делаете "на автомате"
4️⃣ Точка роста — я скажу, куда вам двигаться
5️⃣ Глубинные паттерны — заглянем в детство и подсознание

⏱ 15 минут — и я составлю ваш профиль.

👌 Погнали?
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "👌 ПОГНАЛИ!", callback: () => this.startContextCollection() }
        ]);
    }
    
    showTestBenefits() {
        const text = `
🔍 ЧТО ВЫ УЗНАЕТЕ О СЕБЕ:

🧠 ЭТАП 1: КОНФИГУРАЦИЯ ВОСПРИЯТИЯ
Линза, через которую вы смотрите на мир.

🧠 ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ
Как вы обрабатываете информацию.

🧠 ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ
Ваши автоматические реакции.

🧠 ЭТАП 4: ТОЧКА РОСТА
Где находится рычаг изменений.

🧠 ЭТАП 5: ГЛУБИННЫЕ ПАТТЕРНЫ
Тип привязанности, защитные механизмы, базовые убеждения.

⚡ ПОСЛЕ ТЕСТА ВЫ ПОЛУЧИТЕ:

✅ Полный психологический портрет
✅ Глубинный анализ подсознательных паттернов
✅ Индивидуальные рекомендации

⏱ Всего 15 минут
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() }
        ]);
    }
    
    // ============================================
    // СБОР КОНТЕКСТА
    // ============================================
    
    startContextCollection() {
        this.core.context.isComplete = false;
        this.askCity();
    }
    
    askCity() {
        const text = `
📝 ДАВАЙТЕ ПОЗНАКОМИМСЯ

🏙️ В каком городе вы живете?
`;
        this.addBotMessage(text, true);
        this.showTextInput("city", "📍 Напишите город...", false);
    }
    
    async setCity(city) {
        this.core.context.city = city;
        this.addBotMessage(`📍 Город сохранен: ${city}`, true);
        
        this.core.saveContextToServer();
        this.askGender();
    }
    
    askGender() {
        const text = `
👤 Теперь скажите, ваш пол
`;
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "👨 МУЖСКОЙ", callback: () => this.setGender("male") },
            { text: "👩 ЖЕНСКИЙ", callback: () => this.setGender("female") },
            { text: "⏭ ПРОПУСТИТЬ", callback: () => this.skipGender() }
        ]);
    }
    
    setGender(gender) {
        this.core.context.gender = gender;
        const genderText = gender === 'male' ? 'Мужской' : gender === 'female' ? 'Женский' : 'Другое';
        this.addBotMessage(`👤 Пол сохранен: ${genderText}`, true);
        
        this.core.saveContextToServer();
        this.askAge();
    }
    
    skipGender() {
        this.core.context.gender = "other";
        this.addBotMessage(`👤 Пол пропущен`, true);
        this.askAge();
    }
    
    askAge() {
        const text = `
📅 Сколько вам лет?
`;
        this.addBotMessage(text, true);
        this.showTextInput("age", "📅 Напишите число от 1 до 120...", false);
    }
    
    async setAge(age) {
        const ageNum = parseInt(age);
        if (ageNum >= 1 && ageNum <= 120) {
            this.core.context.age = ageNum;
            this.addBotMessage(`📅 Возраст сохранен: ${ageNum} лет`, true);
            
            await this.core.saveContextToServer();
            await this.showContextSummary();
        } else {
            this.addBotMessage("❌ Возраст должен быть от 1 до 120 лет. Попробуйте еще раз:", true);
            this.showTextInput("age", "📅 Напишите число от 1 до 120...", false);
        }
    }
    
    async showContextSummary() {
        this.addBotMessage("🌤️ Получаю данные о погоде...", true);
        
        const weather = await this.core.fetchWeatherFromServer();
        if (weather) {
            this.core.context.weather = weather;
        }
        
        const genderMap = { male: 'Мужчина', female: 'Женщина', other: 'Не указан' };
        const genderText = genderMap[this.core.context.gender] || 'Не указан';
        
        let weatherText = '';
        if (this.core.context.weather) {
            weatherText = `
${this.core.context.weather.icon} Погода: ${this.core.context.weather.description}, ${this.core.context.weather.temp}°C`;
        } else {
            weatherText = `
🌤️ Погода: данные не получены`;
        }
        
        const summaryText = `
✅ ОТЛИЧНО! ТЕПЕРЬ Я ЗНАЮ О ВАС

📍 Город: ${this.core.context.city || 'не указан'}
👤 Пол: ${genderText}
📅 Возраст: ${this.core.context.age || 'не указан'}${weatherText}

🎯 Теперь я буду учитывать это в наших разговорах!

🧠 ЧТО ДАЛЬШЕ?

Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).
Он определит ваш психологический профиль по 4 векторам и глубинным паттернам.

👇 НАЧИНАЕМ?
`;
        
        this.addBotMessage(summaryText, true);
        
        this.core.context.isComplete = true;
        this.core.saveProgress();
        
        this.addMessageWithButtons("", [
            { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
            { text: "📖 ЧТО ДАЕТ ТЕСТ", callback: () => this.showTestBenefits() }
        ]);
    }
    
    // ============================================
    // ОСНОВНАЯ ЛОГИКА ТЕСТА
    // ============================================
    
    startTest() {
        this.core.currentStage = 0;
        this.core.currentQuestionIndex = 0;
        this.core.reset();
        this.core.saveProgress();
        this.showTestScreen();
        
        setTimeout(() => {
            this.sendStageIntro();
        }, 500);
    }
    
    sendStageIntro() {
        if (this.core.currentStage >= this.core.stages.length) {
            this.showFinalProfile();
            return;
        }
        
        const stage = this.core.stages[this.core.currentStage];
        const manager = this.getCurrentManager();
        const intro = manager ? manager.getIntro() : stage;
        
        const text = `
🧠 ${intro.name || stage.name}

${intro.shortDesc || stage.shortDesc}

${intro.detailedDesc || stage.detailedDesc}

👇 НАЧИНАЕМ?
`;
        
        this.addBotMessage(text, true);
        
        this.addMessageWithButtons("", [
            { text: "▶️ НАЧАТЬ ЭТАП", callback: () => this.sendNextQuestion() },
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(this.core.currentStage) }
        ]);
    }
    
    showStageDetails(stageIndex) {
        const stage = this.core.stages[stageIndex];
        const manager = this.stageManagers[stage.id];
        const intro = manager ? manager.getIntro() : stage;
        
        const text = `
🔍 ЭТАП ${stage.number}: ${intro.name || stage.name}

${intro.detailedDesc || stage.detailedDesc}

👇 НАЧИНАЕМ?
`;
        
        this.addMessageWithButtons(text, [
            { text: "▶️ НАЧАТЬ ЭТАП", callback: () => this.startStageFromDetails(stageIndex) },
            { text: "◀️ НАЗАД К СПИСКУ", callback: () => this.showIntroScreen() }
        ]);
    }
    
    startStageFromDetails(stageIndex) {
        this.core.currentStage = stageIndex;
        this.core.currentQuestionIndex = 0;
        this.sendStageIntro();
    }
    
    sendNextQuestion() {
        if (this.core.currentStage >= this.core.stages.length) {
            this.showFinalProfile();
            return;
        }
        
        const stage = this.core.stages[this.core.currentStage];
        const questions = this.getCurrentQuestions();
        
        if (this.core.currentQuestionIndex >= stage.total) {
            this.completeCurrentStage();
            return;
        }
        
        const q = questions[this.core.currentQuestionIndex];
        this.addQuestionMessage(
            q.text,
            q.options,
            (idx, opt) => this.handleAnswer(stage.id, q, idx, opt),
            this.core.currentQuestionIndex + 1,
            stage.total
        );
    }
    
    handleAnswer(stageId, q, idx, opt) {
        this.core.answers.push({
            stage: stageId,
            questionIndex: this.core.currentQuestionIndex,
            questionId: q.id,
            question: q.text,
            answer: opt.text,
            option: idx,
            scores: opt.scores,
            level: opt.level,
            strategy: opt.strategy,
            dilts: opt.dilts,
            pattern: opt.pattern,
            target: q.target
        });
        
        const manager = this.stageManagers[stageId];
        if (manager && manager.handleAnswer) {
            manager.handleAnswer(opt, q);
        }
        
        this.core.saveProgress();
        this.core.currentQuestionIndex++;
        setTimeout(() => this.sendNextQuestion(), 800);
    }
    
    completeCurrentStage() {
        const stage = this.core.stages[this.core.currentStage];
        const manager = this.stageManagers[stage.id];
        
        if (stage.id === 'perception') {
            const interpretation = manager.complete();
            this.showStage1Result(interpretation);
        } else if (stage.id === 'thinking') {
            const interpretation = manager.complete();
            this.showStage2Result(interpretation);
        } else if (stage.id === 'behavior') {
            const result = manager.complete();
            this.showStage3Result(result);
        } else if (stage.id === 'growth') {
            const profile = manager.complete();
            this.showStage4Result(profile);
        } else if (stage.id === 'deep') {
            const interpretation = manager.complete();
            this.showStage5Result(interpretation);
        }
    }
    
    showStage1Result(interpretation) {
        const text = `
✨ РЕЗУЛЬТАТ ЭТАПА 1

Ваш тип восприятия: ${this.core.perceptionType}

${interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 2: КОНФИГУРАЦИЯ МЫШЛЕНИЯ

Мы узнали, как вы воспринимаете мир. Теперь исследуем, как вы обрабатываете информацию.

📊 Вопросов: ${this.core.stages[1].total}
⏱ Время: ~3-4 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(0) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 2", callback: () => this.goToNextStage() }
        ]);
    }
    
    showStage2Result(interpretation) {
        const text = `
✨ РЕЗУЛЬТАТ ЭТАПА 2

Уровень мышления: ${this.core.thinkingLevel}/9

${interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 3: КОНФИГУРАЦИЯ ПОВЕДЕНИЯ

Теперь посмотрим, как вы действуете на автомате.

📊 Вопросов: 8
⏱ Время: ~3 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(1) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 3", callback: () => this.goToNextStage() }
        ]);
    }
    
    showStage3Result(result) {
        const text = `
✨ РЕЗУЛЬТАТ ЭТАПА 3

Ваши поведенческие уровни:
• Реакция на давление (СБ ${result.averages.sbAvg}/6)
• Отношение к деньгам (ТФ ${result.averages.tfAvg}/6)
• Понимание мира (УБ ${result.averages.ubAvg}/6)
• Отношения с людьми (ЧВ ${result.averages.chvAvg}/6)

Финальный уровень: ${result.finalLevel}/9

${result.interpretation}

▶️ ЧТО ДАЛЬШЕ?

ЭТАП 4: ТОЧКА РОСТА

Найдем, где находится рычаг изменений.

📊 Вопросов: 8
⏱ Время: ~3 минуты
`;
        
        this.addMessageWithButtons(text, [
            { text: "📖 ПОДРОБНЕЕ ОБ ЭТАПЕ", callback: () => this.showStageDetails(2) },
            { text: "▶️ ПЕРЕЙТИ К ЭТАПУ 4", callback: () => this.goToNextStage() }
        ]);
    }
    
    showStage4Result(profile) {
        const growthManager = this.stageManagers.growth;
        const growthTip = growthManager.getGrowthTip();
        
        const attentionDesc = profile.perceptionType.includes("СОЦИАЛЬНО") || profile.perceptionType.includes("СТАТУСНО")
            ? "Для вас важно, что думают другие, вы чутко считываете настроение и ожидания окружающих."
            : "Для вас важнее ваши внутренние ощущения и чувства, чем мнение других.";
        
        const thinkingDesc = profile.thinkingLevel <= 3 
            ? "Вы хорошо видите отдельные ситуации, но не всегда замечаете общие закономерности."
            : profile.thinkingLevel <= 6
            ? "Вы замечаете закономерности, но не всегда видите, к чему они приведут в будущем."
            : "Вы видите общие законы и можете предсказывать развитие ситуаций.";
        
        const confidence = 0.7;
        const confidenceBar = "█".repeat(Math.floor(confidence * 10)) + "░".repeat(10 - Math.floor(confidence * 10));
        
        const text = `
🧠 ПРЕДВАРИТЕЛЬНЫЙ ПОРТРЕТ

${attentionDesc}

${thinkingDesc}

🎯 Точка роста: ${growthTip}

📊 Уверенность: ${confidenceBar} ${Math.floor(confidence * 100)}%

👇 ЭТО ПОХОЖЕ НА ВАС?
`;
        
        this.addMessageWithButtons(text, [
            { text: "✅ ДА", callback: () => this.profileConfirm() },
            { text: "❓ ЕСТЬ СОМНЕНИЯ", callback: () => this.profileDoubt() },
            { text: "🔄 НЕТ", callback: () => this.profileReject() }
        ]);
    }
    
    profileConfirm() {
        this.addBotMessage("✅ Отлично! Тогда исследуем глубину...", true);
        setTimeout(() => this.goToNextStage(), 1500);
    }
    
    profileDoubt() {
        const text = `
🔍 ДАВАЙ УТОЧНИМ

Что именно вам не подходит?
(можно выбрать несколько)

🎭 Про людей — я не так сильно завишу от чужого мнения
💰 Про деньги — у меня с ними по-другому
🔍 Про знаки — я вполне себе анализирую
🤝 Про отношения — я знаю, чего хочу
🛡 Про давление — я реагирую иначе

👇 Выберите и нажмите ДАЛЬШЕ
`;
        
        this.addMessageWithButtons(text, [
            { text: "🎭 Про людей", callback: () => this.toggleDiscrepancy("people") },
            { text: "💰 Про деньги", callback: () => this.toggleDiscrepancy("money") },
            { text: "🔍 Про знаки", callback: () => this.toggleDiscrepancy("signs") },
            { text: "🤝 Про отношения", callback: () => this.toggleDiscrepancy("relations") },
            { text: "🛡 Про давление", callback: () => this.toggleDiscrepancy("sb") },
            { text: "➡️ ДАЛЬШЕ", callback: () => this.clarifyNext() }
        ]);
    }
    
    toggleDiscrepancy(type) {
        if (this.core.discrepancies.includes(type)) {
            this.core.discrepancies = this.core.discrepancies.filter(d => d !== type);
        } else {
            this.core.discrepancies.push(type);
        }
        this.core.saveProgress();
    }
    
    clarifyNext() {
        if (this.core.discrepancies.length === 0) {
            alert("Выберите хотя бы одно расхождение!");
            return;
        }
        
        const currentLevels = {};
        for (const v of ["СБ", "ТФ", "УБ", "ЧВ"]) {
            const levels = this.core.behavioralLevels[v] || [];
            currentLevels[v] = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
        }
        
        const growthManager = this.stageManagers.growth;
        const questions = this.core.getClarifyingQuestions(
            this.core.discrepancies, 
            currentLevels,
            growthManager.getClarifyingQuestionsDB(),
            growthManager.getDiscrepancyQuestions()
        );
        
        if (questions.length === 0) {
            alert("Нет уточняющих вопросов");
            return;
        }
        
        this.core.clarifyingQuestions = questions;
        this.core.clarifyingCurrent = 0;
        this.askClarifyingQuestion();
    }
    
    askClarifyingQuestion() {
        if (this.core.clarifyingCurrent >= this.core.clarifyingQuestions.length) {
            this.updateProfileWithClarifications();
            return;
        }
        
        const q = this.core.clarifyingQuestions[this.core.clarifyingCurrent];
        const text = `
🔍 УТОЧНЯЮЩИЙ ВОПРОС ${this.core.clarifyingCurrent + 1}/${this.core.clarifyingQuestions.length}

${q.text}
`;
        
        const options = Object.entries(q.options).map(([key, value]) => ({
            text: value,
            callback: () => {
                this.core.clarifyingAnswers.push({ question: q.text, answer: value, key: key, vector: q.vector, type: q.type });
                this.core.clarifyingCurrent++;
                this.askClarifyingQuestion();
            }
        }));
        
        options.push({
            text: "⏭ ПРОПУСТИТЬ",
            callback: () => {
                this.core.clarifyingCurrent++;
                this.askClarifyingQuestion();
            }
        });
        
        this.addMessageWithButtons(text, options);
    }
    
    updateProfileWithClarifications() {
        this.core.clarificationIteration++;
        this.core.saveProgress();
        
        this.core.profileData = this.core.calculateFinalProfile();
        this.showStage4Result(this.core.profileData);
    }
    
    profileReject() {
        const anecdote = `
🧠 ЧЕСТНОСТЬ - ЛУЧШАЯ ПОЛИТИКА

Две подруги решили сходить на ипподром. Приходят, а там скачки, все ставки делают. Решили и они ставку сделать — вдруг повезёт? Одна другой и говорит: «Слушай, у тебя какой размер груди?». Вторая: «Второй… а у тебя?». Первая: «Третий… ну давай на пятую поставим — чтоб сумма была…».

Поставили на пятую, лошадь приходит первая, они счастливые прибегают домой с деньгами и мужьям рассказывают, как было дело.

На следующий день мужики тоже решили сходить на скачки — а вдруг им повезёт? Когда решали, на какую ставить, один говорит: «Ты сколько раз за ночь свою жену можешь удовлетворить?». Другой говорит: «Ну, три…». Первый: «А я четыре… ну давай на седьмую поставим».

Поставили на седьмую, первой пришла вторая.

Мужики переглянулись: «Не напиздили бы — выиграли…».

Мораль: Если врать в тесте — результат будет как у мужиков на скачках. Хотите попробовать еще раз?
`;
        
        this.addMessageWithButtons(anecdote, [
            { text: "🔄 ПРОЙТИ ТЕСТ ЕЩЕ РАЗ", callback: () => this.restartTest() },
            { text: "👋 ДОСВИДУЛИ", callback: () => this.goToChat() }
        ]);
        
        this.core.reset();
        this.core.saveProgress();
    }
    
    restartTest() {
        this.start();
    }
    
    goToChat() {
        this.addBotMessage('👋 До свидания!\n\nБуду рад помочь, если решите вернуться.', true);
        setTimeout(() => {
            if (window.dashboard && window.dashboard.renderDashboard) {
                window.dashboard.renderDashboard();
            }
        }, 2000);
    }
    
    showStage5Result(interpretation) {
        const text = `
✨ РЕЗУЛЬТАТ ЭТАПА 5

${interpretation}

✅ ТЕСТ ЗАВЕРШЕН!

🧠 Собираю воедино результаты 5 этапов...
`;
        
        this.addBotMessage(text, true);
        this.finishTest();
    }
    
    async finishTest() {
        await this.core.sendTestResultsToServer();
        this.showFinalProfile();
    }
    
    // ============================================
    // ФОРМАТИРОВАНИЕ ПРОФИЛЯ
    // ============================================
    
    getVectorDescription(vector, level) {
        const descriptions = {
            sb: {
                1: "Под давлением замираете, слова не идут",
                2: "Избегаете конфликтов, уходите от напряжения",
                3: "Внешне соглашаетесь, внутри кипите",
                4: "Внешне спокойны, но внутри переживаете",
                5: "Умеете защищать себя и свои границы",
                6: "Защищаете себя и можете использовать силу"
            },
            tf: {
                1: "Деньги приходят и уходят как повезёт",
                2: "Ищете возможности заработать с нуля",
                3: "Зарабатываете трудом, но не масштабируете",
                4: "Хорошо зарабатываете, но не инвестируете",
                5: "Создаёте системы пассивного дохода",
                6: "Управляете капиталом и инвестируете"
            },
            ub: {
                1: "Стараетесь не думать о сложных вещах",
                2: "Верите в знаки, судьбу, карму",
                3: "Доверяете экспертам и авторитетам",
                4: "Ищете заговоры и скрытые мотивы",
                5: "Анализируете факты и проверяете информацию",
                6: "Строите теории и находите закономерности"
            },
            chv: {
                1: "Сильно привязываетесь, тяжело переживаете расставание",
                2: "Подстраиваетесь под других, теряете себя",
                3: "Хотите нравиться, нуждаетесь в одобрении",
                4: "Умеете влиять на людей и убеждать",
                5: "Строите равные партнёрские отношения",
                6: "Создаёте сообщества и вдохновляете других"
            }
        };
        
        return descriptions[vector]?.[level] || "Информация уточняется";
    }
    
    formatProfileHTML(profile, deep, aiProfile = null) {
        const sbDesc = this.getVectorDescription('sb', profile.sbLevel);
        const tfDesc = this.getVectorDescription('tf', profile.tfLevel);
        const ubDesc = this.getVectorDescription('ub', profile.ubLevel);
        const chvDesc = this.getVectorDescription('chv', profile.chvLevel);
        
        let html = `
            <div style="font-family: inherit; max-width: 100%;">
                <!-- Заголовок -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">🧠</div>
                    <div style="font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #ff6b3b, #ff9f3b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        ВАШ ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ
                    </div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">
                        ID: ${profile.displayName}
                    </div>
                </div>
                
                <!-- Основные характеристики -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 20px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px;">🎭 ТИП ВОСПРИЯТИЯ</div>
                            <div style="font-size: 13px; font-weight: 600;">${profile.perceptionType}</div>
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px;">🧠 УРОВЕНЬ МЫШЛЕНИЯ</div>
                            <div style="font-size: 13px; font-weight: 600;">${profile.thinkingLevel}/9</div>
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px;">🔗 ГЛУБИННЫЙ ПАТТЕРН</div>
                            <div style="font-size: 13px; font-weight: 600;">${deep.attachment}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Векторы -->
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #ff9f3b;">📊 ТВОИ ВЕКТОРЫ</div>
                    
                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; margin-bottom: 10px; border-left: 3px solid #ff6b3b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 13px; font-weight: 600;">🛡️ Реакция на давление (СБ)</span>
                            <span style="font-size: 18px; font-weight: 700; color: #ff6b3b;">${profile.sbLevel}/6</span>
                        </div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.7);">${sbDesc}</div>
                        <div style="margin-top: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; height: 4px; overflow: hidden;">
                            <div style="width: ${(profile.sbLevel / 6) * 100}%; background: #ff6b3b; height: 100%; border-radius: 10px;"></div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; margin-bottom: 10px; border-left: 3px solid #ff9f3b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 13px; font-weight: 600;">💰 Отношение к деньгам (ТФ)</span>
                            <span style="font-size: 18px; font-weight: 700; color: #ff9f3b;">${profile.tfLevel}/6</span>
                        </div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.7);">${tfDesc}</div>
                        <div style="margin-top: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; height: 4px; overflow: hidden;">
                            <div style="width: ${(profile.tfLevel / 6) * 100}%; background: #ff9f3b; height: 100%; border-radius: 10px;"></div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; margin-bottom: 10px; border-left: 3px solid #6c47ff;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 13px; font-weight: 600;">🔍 Понимание мира (УБ)</span>
                            <span style="font-size: 18px; font-weight: 700; color: #6c47ff;">${profile.ubLevel}/6</span>
                        </div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.7);">${ubDesc}</div>
                        <div style="margin-top: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; height: 4px; overflow: hidden;">
                            <div style="width: ${(profile.ubLevel / 6) * 100}%; background: #6c47ff; height: 100%; border-radius: 10px;"></div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; margin-bottom: 10px; border-left: 3px solid #3b82ff;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 13px; font-weight: 600;">🤝 Отношения с людьми (ЧВ)</span>
                            <span style="font-size: 18px; font-weight: 700; color: #3b82ff;">${profile.chvLevel}/6</span>
                        </div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.7);">${chvDesc}</div>
                        <div style="margin-top: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; height: 4px; overflow: hidden;">
                            <div style="width: ${(profile.chvLevel / 6) * 100}%; background: #3b82ff; height: 100%; border-radius: 10px;"></div>
                        </div>
                    </div>
                </div>
        `;
        
        if (aiProfile) {
            html += `
                <div style="margin-top: 20px;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #ff6b3b;">🧠 AI-АНАЛИЗ</div>
                    <div style="background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,159,59,0.05)); border-radius: 20px; padding: 16px; border: 1px solid rgba(255,107,59,0.2);">
                        <div style="font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.9);">
                            ${aiProfile.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        return html;
    }
    
    showFinalProfile() {
        const profile = this.core.calculateFinalProfile();
        const deep = this.core.deepPatterns || { attachment: "🤗 Надежный" };
        
        const formattedProfile = this.formatProfileHTML(profile, deep, this.core.aiGeneratedProfile);
        this.addBotMessage(formattedProfile, true);
        
        this.addMessageWithButtons("👇 ЧТО ДАЛЬШЕ?", [
            { text: "🧠 МЫСЛИ ПСИХОЛОГА", callback: () => this.showPsychologistThought() }
        ]);
        
        if (this.core.userId) {
            localStorage.setItem(`test_results_${this.core.userId}`, JSON.stringify({
                profile,
                deepPatterns: deep,
                perceptionType: this.core.perceptionType,
                thinkingLevel: this.core.thinkingLevel,
                context: this.core.context,
                aiProfile: this.core.aiGeneratedProfile
            }));
        }
    }
    
    async showPsychologistThought() {
        if (this.core.psychologistThought) {
            const formattedThought = this.core.formatProfileText(this.core.psychologistThought);
            this.addBotMessage(`
🧠 МЫСЛИ ПСИХОЛОГА

${formattedThought}
`, true);
            return;
        }
        
        this.addBotMessage("🧠 Генерирую мысли психолога...", true);
        
        const thought = await this.core.fetchPsychologistThought();
        
        if (thought) {
            const formattedThought = this.core.formatProfileText(thought);
            this.addBotMessage(`
🧠 МЫСЛИ ПСИХОЛОГА

${formattedThought}
`, true);
        } else {
            this.addBotMessage("🧠 Мысли психолога временно недоступны. Попробуйте позже.", true);
        }
        
        this.addMessageWithButtons("", [
            { text: "🧠 К ПРОФИЛЮ", callback: () => this.showFinalProfile() }
        ]);
    }
    
    goToNextStage() {
        this.core.currentStage++;
        this.core.currentQuestionIndex = 0;
        this.sendStageIntro();
    }
}

// Создаём глобальный экземпляр
window.TestApp = TestApp;
window.testApp = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.testApp = new TestApp();
    window.testApp.start();
});

console.log('✅ Тест загружен (модульная версия с улучшенным форматированием)');
