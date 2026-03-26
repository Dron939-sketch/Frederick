// ========== СТРАНИЦЫ ==========

async function showConfinementModel() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю модель ограничений...', 'info');
    
    const model = await getConfinementModel();
    if (!model) {
        container.innerHTML = `
            <div class="full-content-page">
                <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
                <div class="content-header">
                    <div class="content-emoji">🔐</div>
                    <h1 class="content-title">Модель ограничений</h1>
                </div>
                <div class="content-body">
                    <p>Не удалось загрузить модель. Попробуйте позже.</p>
                </div>
            </div>
        `;
        document.getElementById('backBtn').onclick = () => navigateBack();
        return;
    }
    
    let elementsHtml = '';
    if (model.elements) {
        for (let i = 1; i <= 9; i++) {
            const elem = model.elements[i];
            if (elem) {
                elementsHtml += `
                    <div class="confinement-element" data-element="${i}">
                        <div class="element-number">${i}</div>
                        <div class="element-name">${elem.name || `Элемент ${i}`}</div>
                        <div class="element-desc">${(elem.description || '').substring(0, 60)}...</div>
                        <div class="element-meta">
                            <span class="element-strength">💪 ${Math.round((elem.strength || 0.5) * 100)}%</span>
                            <span class="element-vak">🎭 ${elem.vak || 'digital'}</span>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    let loopsHtml = '';
    if (model.loops && model.loops.length) {
        loopsHtml = '<h3>🔄 Петли</h3>';
        model.loops.forEach(loop => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">${loop.type || 'Петля'}</div>
                    <div class="loop-desc">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                </div>
            `;
        });
    }
    
    let keyHtml = '';
    if (model.key_confinement) {
        keyHtml = `
            <div class="key-confinement">
                <div class="key-icon">🔐</div>
                <div class="key-title">КЛЮЧЕВОЕ ОГРАНИЧЕНИЕ</div>
                <div class="key-desc">${model.key_confinement.description || 'Анализ в процессе...'}</div>
                <div class="key-desc" style="margin-top: 8px;">Важность: ${Math.round((model.key_confinement.importance || 0.7) * 100)}%</div>
                <button class="action-btn" id="keyConfinementInterventionBtn" style="margin-top: 12px;">💡 Получить интервенцию</button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔐</div>
                <h1 class="content-title">Модель ограничений</h1>
            </div>
            <div class="content-body">
                <div class="key-confinement" style="background: rgba(224,224,224,0.05); margin-bottom: 20px;">
                    <div class="key-title">📊 СТЕПЕНЬ ЗАМЫКАНИЯ</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--chrome);">${Math.round((model.closure_score || 0) * 100)}%</div>
                    <div>${model.is_closed ? '🔒 Система замкнута' : '🔓 Система открыта'}</div>
                </div>
                
                ${keyHtml}
                
                <h3>📊 ЭЛЕМЕНТЫ МОДЕЛИ</h3>
                <div class="elements-grid" id="elementsGrid">
                    ${elementsHtml || '<p>Нет данных об элементах</p>'}
                </div>
                
                ${loopsHtml}
                
                <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="action-btn" id="loopsBtn">🔄 Все петли</button>
                    <button class="action-btn" id="rebuildModelBtn">🔄 Перестроить модель</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('loopsBtn')?.addEventListener('click', () => navigateTo('confinement-loops', { model: model }));
    document.getElementById('rebuildModelBtn')?.addEventListener('click', async () => {
        showToast('Перестраиваю модель...', 'info');
        const result = await rebuildConfinementModel();
        if (result && result.success) {
            showToast('Модель перестроена', 'success');
            navigateTo('confinement-model');
        } else {
            showToast('Не удалось перестроить модель', 'error');
        }
    });
    document.getElementById('keyConfinementInterventionBtn')?.addEventListener('click', () => {
        if (model.key_confinement && model.key_confinement.element) {
            navigateTo('intervention', { elementId: model.key_confinement.element.id });
        }
    });
    
    document.querySelectorAll('.confinement-element').forEach(el => {
        el.addEventListener('click', () => {
            const elementId = el.dataset.element;
            navigateTo('intervention', { elementId: parseInt(elementId) });
        });
    });
}

async function showConfinementLoops(params) {
    const container = document.getElementById('screenContainer');
    showToast('Анализирую петли...', 'info');
    
    const loopsData = await getConfinementLoops();
    
    let loopsHtml = '';
    if (loopsData && loopsData.loops && loopsData.loops.length) {
        loopsData.loops.forEach((loop, idx) => {
            loopsHtml += `
                <div class="loop-card">
                    <div class="loop-type">🔄 ПЕТЛЯ ${idx + 1}: ${loop.type || 'Цикл'}</div>
                    <div class="loop-desc" style="margin: 8px 0;">${loop.description || 'Нет описания'}</div>
                    <div class="loop-strength">Сила: ${Math.round((loop.strength || 0.5) * 100)}%</div>
                    ${loop.elements ? `<div class="loop-strength">Элементы: ${loop.elements.join(' → ')}</div>` : ''}
                </div>
            `;
        });
    } else {
        loopsHtml = '<p>Петли не обнаружены</p>';
    }
    
    let statsHtml = '';
    if (loopsData && loopsData.statistics) {
        statsHtml = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card"><div class="stat-value">${loopsData.statistics.total_loops || 0}</div><div class="stat-label">Всего петель</div></div>
                <div class="stat-card"><div class="stat-value">${Math.round((loopsData.statistics.avg_loop_strength || 0) * 100)}%</div><div class="stat-label">Ср. сила петель</div></div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🔄</div>
                <h1 class="content-title">Петли системы</h1>
            </div>
            <div class="content-body">
                ${statsHtml}
                <h3>Обнаруженные петли</h3>
                ${loopsHtml}
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}

async function showIntervention(params) {
    const elementId = params.elementId;
    const container = document.getElementById('screenContainer');
    showToast('Загружаю интервенцию...', 'info');
    
    const intervention = await getIntervention(elementId);
    
    let elementHtml = '';
    if (intervention && intervention.element) {
        elementHtml = `
            <div class="key-confinement" style="margin-bottom: 20px;">
                <div class="key-title">🧠 ЭЛЕМЕНТ ${intervention.element.id}: ${intervention.element.name || 'Неизвестно'}</div>
                <div class="key-desc">${intervention.element.description || 'Нет описания'}</div>
                <div class="key-desc">Уровень: ${intervention.element.level || 3}/6 | Сила: ${Math.round((intervention.element.strength || 0.5) * 100)}%</div>
            </div>
        `;
    }
    
    let interventionHtml = '';
    if (intervention && intervention.intervention) {
        interventionHtml = `
            <div class="intervention-card">
                <h3>💡 ЧТО ДЕЛАТЬ</h3>
                <div class="intervention-text">${intervention.intervention.description || intervention.intervention}</div>
            </div>
        `;
    }
    
    let dailyHtml = '';
    if (intervention && intervention.daily_practice) {
        dailyHtml = `
            <div class="daily-practice">
                <h3>📝 ЕЖЕДНЕВНАЯ ПРАКТИКА</h3>
                <div class="intervention-text">${intervention.daily_practice}</div>
            </div>
        `;
    }
    
    let weekHtml = '';
    if (intervention && intervention.week_program) {
        weekHtml = `
            <div class="daily-practice">
                <h3>📅 НЕДЕЛЬНАЯ ПРОГРАММА</h3>
                <div class="intervention-text">${intervention.week_program}</div>
            </div>
        `;
    }
    
    let quoteHtml = '';
    if (intervention && intervention.random_quote) {
        quoteHtml = `
            <div class="quote-card">
                <div>${intervention.random_quote}</div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">💡</div>
                <h1 class="content-title">Интервенция</h1>
            </div>
            <div class="content-body">
                ${elementHtml}
                ${interventionHtml}
                ${dailyHtml}
                ${weekHtml}
                ${quoteHtml}
                <button class="action-btn primary-btn" id="speakInterventionBtn" style="margin-top: 16px;">🔊 Озвучить</button>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakInterventionBtn')?.addEventListener('click', async () => {
        const text = (intervention?.intervention?.description || '') + ' ' + (intervention?.daily_practice || '');
        const tts = await textToSpeech(text, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
}

async function showPractices() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю практики...', 'info');
    
    const [morning, evening, exercise, quote] = await Promise.all([
        getMorningPractice(),
        getEveningPractice(),
        getRandomExercise(),
        getRandomQuote()
    ]);
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🧘</div>
                <h1 class="content-title">Практики</h1>
            </div>
            <div class="content-body">
                <div class="practice-card">
                    <h3>🌅 УТРЕННЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${morning}</div>
                    <button class="action-btn" id="speakMorningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🌙 ВЕЧЕРНЯЯ ПРАКТИКА</h3>
                    <div class="intervention-text">${evening}</div>
                    <button class="action-btn" id="speakEveningBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="practice-card">
                    <h3>🎲 СЛУЧАЙНОЕ УПРАЖНЕНИЕ</h3>
                    <div class="intervention-text">${exercise}</div>
                    <button class="action-btn" id="newExerciseBtn" style="margin-top: 12px;">🔄 Другое упражнение</button>
                    <button class="action-btn" id="speakExerciseBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
                
                <div class="quote-card">
                    <h3>📖 ЦИТАТА ДНЯ</h3>
                    <div class="intervention-text" style="font-style: italic;">${quote}</div>
                    <button class="action-btn" id="newQuoteBtn" style="margin-top: 12px;">🔄 Другая цитата</button>
                    <button class="action-btn" id="speakQuoteBtn" style="margin-top: 12px;">🔊 Озвучить</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    document.getElementById('speakMorningBtn')?.addEventListener('click', async () => {
        const tts = await textToSpeech(morning, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    document.getElementById('speakEveningBtn')?.addEventListener('click', async () => {
        const tts = await textToSpeech(evening, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    document.getElementById('newExerciseBtn')?.addEventListener('click', async () => {
        const newExercise = await getRandomExercise();
        const exerciseDiv = document.querySelector('.practice-card:nth-child(3) .intervention-text');
        if (exerciseDiv) exerciseDiv.textContent = newExercise;
    });
    document.getElementById('newQuoteBtn')?.addEventListener('click', async () => {
        const newQuote = await getRandomQuote();
        const quoteDiv = document.querySelector('.quote-card .intervention-text');
        if (quoteDiv) quoteDiv.textContent = newQuote;
    });
}

async function showHypnosis() {
    const container = document.getElementById('screenContainer');
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🌙</div>
                <h1 class="content-title">Гипноз</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics">
                    <button class="topic-btn" data-topic="тревога">Тревога</button>
                    <button class="topic-btn" data-topic="уверенность">Уверенность</button>
                    <button class="topic-btn" data-topic="спокойствие">Спокойствие</button>
                    <button class="topic-btn" data-topic="сон">Сон</button>
                    <button class="topic-btn" data-topic="вдохновение">Вдохновение</button>
                </div>
                <textarea class="hypno-input" id="hypnoInput" rows="3" placeholder="Напишите, что вас беспокоит..."></textarea>
                <button class="action-btn primary-btn" id="processHypnoBtn">🌙 Получить гипнотический ответ</button>
                
                <div id="hypnoResponse" style="margin-top: 20px;"></div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>🎧 ПОДДЕРЖКА</h3>
                    <button class="action-btn" id="supportBtn">Получить поддерживающий ответ</button>
                    <div id="supportResponse" style="margin-top: 12px;"></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const topic = btn.dataset.topic;
            const input = document.getElementById('hypnoInput');
            input.value = `Я чувствую ${topic}`;
            const response = await processHypno(input.value);
            document.getElementById('hypnoResponse').innerHTML = `
                <div class="intervention-card">
                    <div class="intervention-text">${response}</div>
                    <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
                </div>
            `;
            document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
                const tts = await textToSpeech(response, currentMode);
                if (tts?.audio_url) playAudioResponse(tts.audio_url);
            });
        });
    });
    
    document.getElementById('processHypnoBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('hypnoInput').value;
        if (!input.trim()) {
            showToast('Напишите, что вас беспокоит', 'info');
            return;
        }
        showToast('Формирую гипнотический ответ...', 'info');
        const response = await processHypno(input);
        document.getElementById('hypnoResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${response}</div>
                <button class="action-btn" id="speakHypnoBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakHypnoBtn')?.addEventListener('click', async () => {
            const tts = await textToSpeech(response, currentMode);
            if (tts?.audio_url) playAudioResponse(tts.audio_url);
        });
    });
    
    document.getElementById('supportBtn')?.addEventListener('click', async () => {
        const support = await getHypnoSupport();
        document.getElementById('supportResponse').innerHTML = `
            <div class="intervention-card">
                <div class="intervention-text">${support}</div>
                <button class="action-btn" id="speakSupportBtn">🔊 Озвучить</button>
            </div>
        `;
        document.getElementById('speakSupportBtn')?.addEventListener('click', async () => {
            const tts = await textToSpeech(support, currentMode);
            if (tts?.audio_url) playAudioResponse(tts.audio_url);
        });
    });
}

async function showTales() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю библиотеку сказок...', 'info');
    
    const talesData = await getTales();
    const talesList = talesData.available_tales || [];
    
    let talesHtml = '';
    if (talesList.length) {
        talesList.forEach(tale => {
            talesHtml += `
                <div class="tale-card" data-tale-id="${tale}">
                    <div class="loop-type">📖 ${tale}</div>
                    <div class="loop-desc">Терапевтическая сказка</div>
                </div>
            `;
        });
    } else {
        talesHtml = '<p>Сказки загружаются...</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📚</div>
                <h1 class="content-title">Терапевтические сказки</h1>
            </div>
            <div class="content-body">
                <div class="hypno-topics" style="margin-bottom: 20px;">
                    <button class="topic-btn" data-issue="страх">Страх</button>
                    <button class="topic-btn" data-issue="одиночество">Одиночество</button>
                    <button class="topic-btn" data-issue="уверенность">Уверенность</button>
                    <button class="topic-btn" data-issue="потеря">Потеря</button>
                    <button class="topic-btn" data-issue="любовь">Любовь</button>
                </div>
                <div id="taleContent"></div>
                <h3>📚 БИБЛИОТЕКА СКАЗОК</h3>
                <div id="talesList">
                    ${talesHtml}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const issue = btn.dataset.issue;
            showToast(`Ищу сказку на тему "${issue}"...`, 'info');
            const data = await apiCall(`/api/tale?issue=${issue}`);
            if (data.tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 Сказка</h3>
                        <div class="intervention-text">${data.tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    const tts = await textToSpeech(data.tale, currentMode);
                    if (tts?.audio_url) playAudioResponse(tts.audio_url);
                });
            }
        });
    });
    
    document.querySelectorAll('.tale-card').forEach(card => {
        card.addEventListener('click', async () => {
            const taleId = card.dataset.taleId;
            const tale = await getTaleById(taleId);
            if (tale) {
                document.getElementById('taleContent').innerHTML = `
                    <div class="intervention-card">
                        <h3>📖 ${taleId}</h3>
                        <div class="intervention-text">${tale}</div>
                        <button class="action-btn" id="speakTaleBtn">🔊 Озвучить</button>
                    </div>
                `;
                document.getElementById('speakTaleBtn')?.addEventListener('click', async () => {
                    const tts = await textToSpeech(tale, currentMode);
                    if (tts?.audio_url) playAudioResponse(tts.audio_url);
                });
            }
        });
    });
}

async function showAnchors() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю якоря...', 'info');
    
    const anchors = await getUserAnchors();
    
    let anchorsHtml = '';
    if (anchors && anchors.length) {
        anchors.forEach(anchor => {
            anchorsHtml += `
                <div class="anchor-card">
                    <div>
                        <div class="loop-type">${anchor.name}</div>
                        <div class="anchor-phrase">${anchor.phrase}</div>
                        <div class="loop-strength">Состояние: ${anchor.state}</div>
                    </div>
                    <button class="action-btn fire-anchor" data-name="${anchor.name}" style="padding: 6px 12px;">🔥 Активировать</button>
                </div>
            `;
        });
    } else {
        anchorsHtml = '<p>У вас пока нет якорей. Создайте свой первый якорь.</p>';
    }
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">⚓</div>
                <h1 class="content-title">Мои якоря</h1>
            </div>
            <div class="content-body">
                <h3>📋 АКТИВНЫЕ ЯКОРЯ</h3>
                <div id="anchorsList">
                    ${anchorsHtml}
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>➕ СОЗДАТЬ НОВЫЙ ЯКОРЬ</h3>
                    <input type="text" id="anchorName" placeholder="Название якоря" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <input type="text" id="anchorState" placeholder="Состояние (например: спокойствие)" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 30px; color: white;">
                    <textarea id="anchorPhrase" placeholder="Фраза-якорь" rows="2" style="width: 100%; padding: 10px; margin: 8px 0; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.2); border-radius: 20px; color: white;"></textarea>
                    <button class="action-btn primary-btn" id="createAnchorBtn">✨ СОЗДАТЬ</button>
                </div>
                
                <div class="practice-card" style="margin-top: 20px;">
                    <h3>💡 ПРЕДЛОЖЕННЫЕ ЯКОРЯ</h3>
                    <button class="action-btn" id="anchorCalmBtn" style="margin: 5px;">😌 Спокойствие</button>
                    <button class="action-btn" id="anchorConfidenceBtn" style="margin: 5px;">💪 Уверенность</button>
                    <button class="action-btn" id="anchorHereBtn" style="margin: 5px;">🧘 Здесь и сейчас</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
    
    document.querySelectorAll('.fire-anchor').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name;
            const phrase = await fireAnchor(name);
            if (phrase) {
                showToast(`Активирован якорь: ${phrase}`, 'success');
                const tts = await textToSpeech(phrase, currentMode);
                if (tts?.audio_url) playAudioResponse(tts.audio_url);
            }
        });
    });
    
    document.getElementById('createAnchorBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('anchorName').value;
        const state = document.getElementById('anchorState').value;
        const phrase = document.getElementById('anchorPhrase').value;
        if (!name || !state || !phrase) {
            showToast('Заполните все поля', 'error');
            return;
        }
        const result = await setAnchor(name, state, phrase);
        if (result && result.success) {
            showToast('Якорь создан!', 'success');
            showAnchors();
        } else {
            showToast('Не удалось создать якорь', 'error');
        }
    });
    
    document.getElementById('anchorCalmBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('calm');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    
    document.getElementById('anchorConfidenceBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('confidence');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
    
    document.getElementById('anchorHereBtn')?.addEventListener('click', async () => {
        const phrase = await getAnchor('here');
        showToast(`Якорь: ${phrase}`, 'success');
        const tts = await textToSpeech(phrase, currentMode);
        if (tts?.audio_url) playAudioResponse(tts.audio_url);
    });
}

async function showStatistics() {
    const container = document.getElementById('screenContainer');
    showToast('Загружаю статистику...', 'info');
    
    const stats = await getConfinementStatistics();
    const status = await getUserStatus();
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="backBtn">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📊</div>
                <h1 class="content-title">Статистика</h1>
            </div>
            <div class="content-body">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_elements || 0}</div><div class="stat-label">Всего элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.active_elements || 0}</div><div class="stat-label">Активных элементов</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.total_loops || 0}</div><div class="stat-label">Найдено петель</div></div>
                    <div class="stat-card"><div class="stat-value">${Math.round((stats.closure_score || 0) * 100)}%</div><div class="stat-label">Степень замыкания</div></div>
                </div>
                
                <div class="key-confinement" style="margin-top: 20px;">
                    <div class="key-title">${stats.is_system_closed ? '🔒 СИСТЕМА ЗАМКНУТА' : '🔓 СИСТЕМА ОТКРЫТА'}</div>
                    <div class="key-desc">${stats.is_system_closed ? 'Требуется работа с ключевыми элементами для разрыва петель' : 'Система готова к изменениям'}</div>
                </div>
                
                <div class="practice-card">
                    <h3>🧠 ПРОФИЛЬ</h3>
                    <div class="intervention-text">Код: ${status.profile_code || CONFIG.PROFILE_CODE}</div>
                    <div class="intervention-text">Тест: ${status.test_completed ? '✅ Пройден' : '⏳ Не пройден'}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('backBtn').onclick = () => navigateBack();
}
