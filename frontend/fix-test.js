// fix-weather.js - Только изменения для погоды
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test.js');

console.log('🔧 Вношу изменения для погоды в test.js...\n');

// Читаем файл
let content = fs.readFileSync(filePath, 'utf8');

// ============================================
// 1. ОБНОВЛЯЕМ showContextSummary (добавляем блок погоды)
// ============================================

const newShowContextSummary = `showContextSummary() {
    const genderText = {
        'male': 'Мужчина',
        'female': 'Женщина',
        'other': 'Другое'
    }[this.context.gender] || 'не указан';
    
    // Формируем блок с погодой, если она есть
    let weatherBlock = '';
    if (this.context.weather) {
        weatherBlock = \`

🌡️ **Погода в \${this.context.city}:** \${this.context.weather.icon} \${this.context.weather.description}, \${this.context.weather.temp}°C

💡 \${this.getWeatherTip(this.context.weather)}\`;
    } else if (this.context.city) {
        weatherBlock = \`

🌡️ **Загружаю погоду для \${this.context.city}...**\`;
    }
    
    const text = \`
✅ **ОТЛИЧНО! ТЕПЕРЬ Я ЗНАЮ О ВАС**

📍 **Город:** \${this.context.city}
👤 **Пол:** \${genderText}
📅 **Возраст:** \${this.context.age} лет\${weatherBlock}

---

🎯 **Теперь я буду учитывать это в наших разговорах!**

🧠 **ЧТО ДАЛЬШЕ?**

Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).
Он определит ваш психологический профиль по 4 векторам и глубинным паттернам.

👇 **НАЧИНАЕМ?**
\`;
    
    this.addBotMessage(text, true);
    
    this.addMessageWithButtons("", [
        { text: "🚀 НАЧАТЬ ТЕСТ", callback: () => this.startTest() },
        { text: "📖 ЧТО ДАЁТ ТЕСТ", callback: () => this.showTestBenefits() }
    ]);
},`;

if (content.includes('showContextSummary()')) {
    content = content.replace(/showContextSummary\(\)\s*\{[\s\S]*?\n\},/, newShowContextSummary);
    console.log('✅ showContextSummary обновлена (добавлен блок погоды)');
}

// ============================================
// 2. ДОБАВЛЯЕМ getWeatherTip
// ============================================

const getWeatherTip = `
getWeatherTip(weather) {
    const temp = weather.temp;
    
    if (temp < 0) {
        return "❄️ На улице холодно. Не забудьте одеться теплее перед выходом!";
    } else if (temp < 10) {
        return "🧥 Прохладно. Возьмите с собой тёплую одежду.";
    } else if (temp < 20) {
        return "🍃 Приятная погода. Хороший день для прогулки и размышлений.";
    } else if (temp < 30) {
        return "☀️ Тепло. Не забывайте пить воду, если выходите на улицу.";
    } else {
        return "🥵 Жарко! Старайтесь меньше находиться на солнце в пиковые часы.";
    }
},`;

if (!content.includes('getWeatherTip(weather)')) {
    // Вставляем после showContextSummary
    content = content.replace(/showContextSummary\(\)[\s\S]*?\n\},\n/, (match) => {
        return match + getWeatherTip;
    });
    console.log('✅ getWeatherTip добавлена');
}

// ============================================
// 3. ДОБАВЛЯЕМ updateContextSummaryWithWeather
// ============================================

const updateContextSummary = `
updateContextSummaryWithWeather() {
    const messagesContainer = document.getElementById('testChatMessages');
    if (!messagesContainer) return;
    
    const botMessages = messagesContainer.querySelectorAll('.test-message-bot');
    if (botMessages.length === 0) return;
    
    const lastBotMessage = botMessages[botMessages.length - 1];
    const bubble = lastBotMessage.querySelector('.test-message-bubble');
    if (!bubble) return;
    
    const genderText = {
        'male': 'Мужчина',
        'female': 'Женщина',
        'other': 'Другое'
    }[this.context.gender] || 'не указан';
    
    const weatherBlock = \`
🌡️ **Погода в \${this.context.city}:** \${this.context.weather.icon} \${this.context.weather.description}, \${this.context.weather.temp}°C

💡 \${this.getWeatherTip(this.context.weather)}\`;
    
    const text = \`
✅ **ОТЛИЧНО! ТЕПЕРЬ Я ЗНАЮ О ВАС**

📍 **Город:** \${this.context.city}
👤 **Пол:** \${genderText}
📅 **Возраст:** \${this.context.age} лет

\${weatherBlock}

---

🎯 **Теперь я буду учитывать это в наших разговорах!**

🧠 **ЧТО ДАЛЬШЕ?**

Чтобы я мог помочь по-настоящему, нужно пройти тест (15 минут).
Он определит ваш психологический профиль по 4 векторам и глубинным паттернам.

👇 **НАЧИНАЕМ?**
\`;
    
    const textDiv = bubble.querySelector('.test-message-text');
    if (textDiv) {
        textDiv.innerHTML = text.replace(/\\n/g, '<br>');
    }
    
    this.scrollToBottom();
},`;

if (!content.includes('updateContextSummaryWithWeather()')) {
    content = content.replace(/getWeatherTip[\s\S]*?\n\},\n/, (match) => {
        return match + updateContextSummary;
    });
    console.log('✅ updateContextSummaryWithWeather добавлена');
}

// ============================================
// 4. ОБНОВЛЯЕМ saveContextFromForm (добавляем обновление погоды)
// ============================================

const newSaveContextFromForm = `saveContextFromForm() {
    const cityInput = document.getElementById('contextCity');
    const ageInput = document.getElementById('contextAge');
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    
    const city = cityInput ? cityInput.value.trim() : '';
    const age = ageInput ? ageInput.value.trim() : '';
    const gender = selectedGender ? selectedGender.value : null;
    
    // Валидация
    const errors = [];
    if (!city) errors.push('🏙️ Укажите город');
    if (!gender) errors.push('👤 Укажите пол');
    if (!age) errors.push('📅 Укажите возраст');
    else if (parseInt(age) < 1 || parseInt(age) > 120) errors.push('📅 Возраст должен быть от 1 до 120 лет');
    
    if (errors.length > 0) {
        this.addBotMessage(\`❌ Пожалуйста, заполните все поля:\\n\\n\${errors.join('\\n')}\`, true);
        return;
    }
    
    // Сохраняем контекст
    this.context.city = city;
    this.context.gender = gender;
    this.context.age = parseInt(age);
    this.context.isComplete = true;
    
    this.saveProgress();
    this.saveContextToServer();
    
    // Показываем СВОДНЫЙ ЭКРАН
    this.showContextSummary();
    
    // Обновляем погоду, если она загрузится
    setTimeout(() => {
        if (this.context.weather) {
            this.updateContextSummaryWithWeather();
        }
    }, 500);
},`;

if (content.includes('saveContextFromForm()')) {
    content = content.replace(/saveContextFromForm\(\)\s*\{[\s\S]*?\n\},/, newSaveContextFromForm);
    console.log('✅ saveContextFromForm обновлена (добавлено обновление погоды)');
}

// ============================================
// 5. ОБНОВЛЯЕМ saveContextToServer (возвращаем weather)
// ============================================

const newSaveContextToServer = `async saveContextToServer() {
    if (!this.userId) return;
    
    try {
        await fetch(\`\${TEST_API_BASE_URL}/api/save-context\`, {
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
        
        // После сохранения контекста получаем погоду
        const weather = await this.fetchWeatherFromServer();
        if (weather) {
            this.context.weather = weather;
        }
    } catch (error) {
        console.error('Ошибка сохранения контекста:', error);
    }
},`;

if (content.includes('async saveContextToServer()')) {
    content = content.replace(/async saveContextToServer\(\)\s*\{[\s\S]*?\n\},/, newSaveContextToServer);
    console.log('✅ saveContextToServer обновлена');
}

// ============================================
// СОХРАНЯЕМ ФАЙЛ
// ============================================

fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Готово! Все изменения для погоды внесены.');
console.log('📁 Файл test.js обновлён');
