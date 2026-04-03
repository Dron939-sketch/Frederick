// ============================================
// interests.js — Интересы на основе профиля
// Версия 1.0
// ============================================

// ============================================
// 1. БАЗА ДАННЫХ ИНТЕРЕСОВ ПО ВЕКТОРАМ
// ============================================

const INTERESTS_DB = {
    // КНИГИ
    books: [
        {
            id: 'book_1',
            title: 'Дэниел Канеман — "Думай медленно... решай быстро"',
            description: 'Как работают две системы мышления и почему мы ошибаемся',
            vectors: { УБ: 5, СБ: 3, ТФ: 4, ЧВ: 2 },
            rating: 4.7,
            year: 2011,
            tags: ['мышление', 'психология', 'наука'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_2',
            title: 'Роберт Чалдини — "Психология влияния"',
            description: 'Как работают механизмы убеждения и защиты от манипуляций',
            vectors: { ЧВ: 5, СБ: 4, УБ: 3, ТФ: 3 },
            rating: 4.8,
            year: 2009,
            tags: ['влияние', 'коммуникация', 'психология'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_3',
            title: 'Михай Чиксентмихайи — "Поток"',
            description: 'Состояние оптимального переживания и как его достичь',
            vectors: { УБ: 4, СБ: 4, ЧВ: 4, ТФ: 4 },
            rating: 4.6,
            year: 2014,
            tags: ['счастье', 'продуктивность', 'психология'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_4',
            title: 'Карл Густав Юнг — "Архетипы и коллективное бессознательное"',
            description: 'Фундаментальная работа о глубинных паттернах психики',
            vectors: { УБ: 5, ЧВ: 4, СБ: 3, ТФ: 2 },
            rating: 4.5,
            year: 1960,
            tags: ['юнг', 'архетипы', 'психоанализ'],
            formats: ['pdf', 'epub']
        },
        {
            id: 'book_5',
            title: 'Эрих Фромм — "Искусство любить"',
            description: 'Любовь как искусство, требующее усилий и знаний',
            vectors: { ЧВ: 5, СБ: 2, УБ: 3, ТФ: 2 },
            rating: 4.7,
            year: 1956,
            tags: ['любовь', 'отношения', 'психология'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_6',
            title: 'Виктор Франкл — "Сказать жизни "Да!" "',
            description: 'Психолог в концлагере и поиск смысла в страдании',
            vectors: { СБ: 5, УБ: 4, ЧВ: 3, ТФ: 2 },
            rating: 4.9,
            year: 1946,
            tags: ['смысл', 'экзистенциализм', 'психология'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_7',
            title: 'Нассим Талеб — "Чёрный лебедь"',
            description: 'О непредсказуемых событиях и как на них реагировать',
            vectors: { УБ: 5, ТФ: 4, СБ: 3, ЧВ: 2 },
            rating: 4.6,
            year: 2007,
            tags: ['риск', 'неопределённость', 'бизнес'],
            formats: ['pdf', 'epub', 'audiobook']
        },
        {
            id: 'book_8',
            title: 'Сьюзан Кейн — "Интроверты"',
            description: 'Как использовать свои сильные стороны, если вы интроверт',
            vectors: { СБ: 2, ЧВ: 4, УБ: 3, ТФ: 3 },
            rating: 4.5,
            year: 2012,
            tags: ['интроверсия', 'личность', 'психология'],
            formats: ['pdf', 'epub', 'audiobook']
        }
    ],
    
    // КИНО И СЕРИАЛЫ
    movies: [
        {
            id: 'movie_1',
            title: 'Начало (Inception)',
            description: 'Фильм о проникновении в сны и изменении убеждений',
            vectors: { УБ: 5, СБ: 4, ЧВ: 3, ТФ: 2 },
            rating: 4.8,
            year: 2010,
            tags: ['триллер', 'психология', 'фантастика']
        },
        {
            id: 'movie_2',
            title: 'Клиент всегда мёртв (Six Feet Under)',
            description: 'Сериал о семье, управляющей похоронным бюро',
            vectors: { ЧВ: 5, УБ: 4, СБ: 3, ТФ: 2 },
            rating: 4.9,
            year: 2001,
            tags: ['драма', 'психология', 'семья']
        },
        {
            id: 'movie_3',
            title: 'Помаранчевый — хит сезона',
            description: 'Трогательная история о подростках и первой любви',
            vectors: { ЧВ: 5, СБ: 2, УБ: 2, ТФ: 2 },
            rating: 4.7,
            year: 2023,
            tags: ['драма', 'подростки', 'любовь']
        },
        {
            id: 'movie_4',
            title: 'Мистер Робот',
            description: 'Гениальный хакер с диссоциативным расстройством',
            vectors: { УБ: 5, ЧВ: 4, СБ: 3, ТФ: 3 },
            rating: 4.8,
            year: 2015,
            tags: ['триллер', 'психология', 'хакеры']
        },
        {
            id: 'movie_5',
            title: 'Красивый ум',
            description: 'История Джона Нэша, гения с шизофренией',
            vectors: { УБ: 5, ЧВ: 4, СБ: 4, ТФ: 3 },
            rating: 4.8,
            year: 2001,
            tags: ['драма', 'биография', 'психология']
        }
    ],
    
    // ПРАКТИКИ
    practices: [
        {
            id: 'practice_1',
            title: 'Утреннее сканирование тела',
            duration: 5,
            description: 'Настройка на день через осознанность',
            vectors: { СБ: 4, ЧВ: 4, УБ: 2, ТФ: 2 },
            type: 'meditation',
            audioUrl: null
        },
        {
            id: 'practice_2',
            title: 'Дневник эмоций',
            duration: 10,
            description: 'Отслеживание эмоциональных паттернов',
            vectors: { ЧВ: 5, УБ: 4, СБ: 3, ТФ: 2 },
            type: 'journaling',
            template: 'Что я чувствую? Что вызвало эту эмоцию?'
        },
        {
            id: 'practice_3',
            title: 'Медитация благодарности',
            duration: 15,
            description: 'Завершение дня с чувством благодарности',
            vectors: { ЧВ: 5, СБ: 3, УБ: 2, ТФ: 2 },
            type: 'meditation',
            audioUrl: null
        },
        {
            id: 'practice_4',
            title: 'Дыхательная практика "Квадрат"',
            duration: 3,
            description: 'Быстрое успокоение нервной системы',
            vectors: { СБ: 5, ЧВ: 3, УБ: 2, ТФ: 2 },
            type: 'breathing',
            instruction: 'Вдох 4 сек — задержка 4 сек — выдох 4 сек — задержка 4 сек'
        },
        {
            id: 'practice_5',
            title: 'Анализ убеждений',
            duration: 20,
            description: 'Выявление и проработка ограничивающих убеждений',
            vectors: { УБ: 5, ЧВ: 4, СБ: 3, ТФ: 2 },
            type: 'worksheet',
            template: 'Какое убеждение меня ограничивает? Откуда оно взялось?'
        }
    ],
    
    // КАРЬЕРНЫЕ ТРЕКИ
    careers: [
        {
            id: 'career_1',
            title: 'Психолог-консультант',
            description: 'Помощь людям в решении психологических проблем',
            vectors: { ЧВ: 5, УБ: 4, СБ: 3, ТФ: 3 },
            salary: '80-200k',
            demand: 'high'
        },
        {
            id: 'career_2',
            title: 'Аналитик данных',
            description: 'Поиск закономерностей в данных и принятие решений',
            vectors: { УБ: 5, ТФ: 4, СБ: 3, ЧВ: 2 },
            salary: '120-300k',
            demand: 'high'
        },
        {
            id: 'career_3',
            title: 'HR-специалист',
            description: 'Работа с персоналом, подбор и развитие сотрудников',
            vectors: { ЧВ: 5, СБ: 4, ТФ: 3, УБ: 3 },
            salary: '70-180k',
            demand: 'medium'
        },
        {
            id: 'career_4',
            title: 'Product Manager',
            description: 'Управление продуктом, коммуникация с командами',
            vectors: { СБ: 5, УБ: 4, ЧВ: 4, ТФ: 4 },
            salary: '150-350k',
            demand: 'high'
        },
        {
            id: 'career_5',
            title: 'Исследователь',
            description: 'Научная работа, поиск новых знаний',
            vectors: { УБ: 5, СБ: 3, ТФ: 3, ЧВ: 3 },
            salary: '60-150k',
            demand: 'low'
        }
    ]
};

// ============================================
// 2. СОСТОЯНИЕ
// ============================================
let interestsState = {
    activeCategory: null,  // 'books', 'movies', 'practices', 'careers'
    activeItem: null,
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 }
};

// ============================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else if (window.showToastMessage) window.showToastMessage(message, type);
    else console.log(`[${type}] ${message}`);
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
    else if (typeof window.goToDashboard === 'function') window.goToDashboard();
    else location.reload();
}

// ============================================
// 4. РАСЧЁТ РЕЛЕВАНТНОСТИ
// ============================================
function calculateRelevance(item, userVectors) {
    let score = 0;
    let totalWeight = 0;
    
    for (const [vector, userValue] of Object.entries(userVectors)) {
        const itemValue = item.vectors?.[vector] || 3;
        const diff = Math.abs(userValue - itemValue);
        const relevance = 1 - (diff / 5);
        const weight = 1; // можно настроить веса
        
        score += relevance * weight;
        totalWeight += weight;
    }
    
    return totalWeight > 0 ? (score / totalWeight) * 100 : 50;
}

function getRecommendations(items, userVectors, limit = 8) {
    return items
        .map(item => ({
            ...item,
            relevance: calculateRelevance(item, userVectors)
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
}

// ============================================
// 5. ЗАГРУЗКА ПРОФИЛЯ
// ============================================
async function loadUserVectors() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        
        const response = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const data = await response.json();
        
        const profile = data.profile || {};
        const behavioralLevels = profile.behavioral_levels || {};
        
        interestsState.userVectors = {
            СБ: behavioralLevels.СБ ? (Array.isArray(behavioralLevels.СБ) ? behavioralLevels.СБ[behavioralLevels.СБ.length-1] : behavioralLevels.СБ) : 4,
            ТФ: behavioralLevels.ТФ ? (Array.isArray(behavioralLevels.ТФ) ? behavioralLevels.ТФ[behavioralLevels.ТФ.length-1] : behavioralLevels.ТФ) : 4,
            УБ: behavioralLevels.УБ ? (Array.isArray(behavioralLevels.УБ) ? behavioralLevels.УБ[behavioralLevels.УБ.length-1] : behavioralLevels.УБ) : 4,
            ЧВ: behavioralLevels.ЧВ ? (Array.isArray(behavioralLevels.ЧВ) ? behavioralLevels.ЧВ[behavioralLevels.ЧВ.length-1] : behavioralLevels.ЧВ) : 4
        };
        
        console.log('📊 Векторы для подбора интересов:', interestsState.userVectors);
    } catch (error) {
        console.warn('Failed to load user vectors:', error);
    }
}

// ============================================
// 6. ОСНОВНОЙ ЭКРАН (КАТАЛОГ)
// ============================================
async function showInterestsScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserVectors();
    renderInterestsMainScreen(container);
}

async function checkTestCompleted() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
        const data = await response.json();
        return data.has_profile === true;
    } catch (e) {
        return false;
    }
}

function renderInterestsMainScreen(container) {
    const vectors = interestsState.userVectors;
    const profileName = `СБ-${vectors.СБ} · ТФ-${vectors.ТФ} · УБ-${vectors.УБ} · ЧВ-${vectors.ЧВ}`;
    
    // Подсчёт количества рекомендаций в каждой категории
    const booksCount = getRecommendations(INTERESTS_DB.books, vectors).length;
    const moviesCount = getRecommendations(INTERESTS_DB.movies, vectors).length;
    const practicesCount = getRecommendations(INTERESTS_DB.practices, vectors).length;
    const careersCount = getRecommendations(INTERESTS_DB.careers, vectors).length;
    
    container.innerHTML = `
        <div class="full-content-page" id="interestsScreen">
            <button class="back-btn" id="interestsBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1>Интересы</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">Подобрано на основе вашего профиля</div>
            </div>
            
            <div class="interests-profile-card">
                <div class="interests-profile-label">🧬 ВАШ ПРОФИЛЬ</div>
                <div class="interests-profile-code">${profileName}</div>
                <div class="interests-profile-vectors">
                    <span class="vector-badge" style="background: rgba(255,107,59,0.15);">СБ ${vectors.СБ}/6</span>
                    <span class="vector-badge" style="background: rgba(255,107,59,0.15);">ТФ ${vectors.ТФ}/6</span>
                    <span class="vector-badge" style="background: rgba(255,107,59,0.15);">УБ ${vectors.УБ}/6</span>
                    <span class="vector-badge" style="background: rgba(255,107,59,0.15);">ЧВ ${vectors.ЧВ}/6</span>
                </div>
            </div>
            
            <div class="interests-grid">
                <div class="interests-category" data-category="books">
                    <div class="category-emoji">📚</div>
                    <div class="category-name">КНИГИ</div>
                    <div class="category-count">${booksCount} рекомендаций</div>
                    <div class="category-arrow">→</div>
                </div>
                
                <div class="interests-category" data-category="movies">
                    <div class="category-emoji">🎬</div>
                    <div class="category-name">КИНО</div>
                    <div class="category-count">${moviesCount} рекомендаций</div>
                    <div class="category-arrow">→</div>
                </div>
                
                <div class="interests-category" data-category="practices">
                    <div class="category-emoji">🧘</div>
                    <div class="category-name">ПРАКТИКИ</div>
                    <div class="category-count">${practicesCount} рекомендаций</div>
                    <div class="category-arrow">→</div>
                </div>
                
                <div class="interests-category" data-category="careers">
                    <div class="category-emoji">💼</div>
                    <div class="category-name">КАРЬЕРА</div>
                    <div class="category-count">${careersCount} рекомендаций</div>
                    <div class="category-arrow">→</div>
                </div>
            </div>
            
            <div class="interests-footer">
                <button id="refreshInterestsBtn" class="interests-refresh-btn">
                    🔄 ОБНОВИТЬ РЕКОМЕНДАЦИИ
                </button>
            </div>
        </div>
    `;
    
    // Стили
    const style = document.createElement('style');
    style.textContent = `
        .interests-profile-card {
            background: linear-gradient(135deg, rgba(255,107,59,0.08), rgba(255,59,59,0.03));
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: center;
        }
        .interests-profile-label {
            font-size: 10px;
            color: var(--text-secondary);
            letter-spacing: 1px;
            margin-bottom: 6px;
        }
        .interests-profile-code {
            font-family: monospace;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .interests-profile-vectors {
            display: flex;
            justify-content: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .vector-badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
        }
        .interests-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        .interests-category {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 20px 16px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
            position: relative;
        }
        .interests-category:hover {
            background: rgba(255,107,59,0.08);
            border-color: rgba(255,107,59,0.3);
            transform: translateY(-2px);
        }
        .category-emoji {
            font-size: 40px;
            margin-bottom: 8px;
        }
        .category-name {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .category-count {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .category-arrow {
            position: absolute;
            bottom: 16px;
            right: 16px;
            font-size: 20px;
            opacity: 0.5;
        }
        .interests-refresh-btn {
            width: 100%;
            padding: 14px;
            background: rgba(224,224,224,0.08);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 50px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .interests-refresh-btn:hover {
            background: rgba(255,107,59,0.15);
            border-color: rgba(255,107,59,0.3);
        }
        @media (max-width: 768px) {
            .interests-grid {
                gap: 10px;
            }
            .interests-category {
                padding: 16px 12px;
            }
            .category-emoji {
                font-size: 32px;
            }
            .category-name {
                font-size: 14px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Обработчики
    const backBtn = document.getElementById('interestsBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => goBackToDashboard());
    }
    
    document.querySelectorAll('.interests-category').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            interestsState.activeCategory = category;
            renderCategoryScreen(container, category);
        });
    });
    
    document.getElementById('refreshInterestsBtn')?.addEventListener('click', () => {
        showToastMessage('🔄 Рекомендации обновлены', 'success');
        renderInterestsMainScreen(container);
    });
}

// ============================================
// 7. ЭКРАН КАТЕГОРИИ
// ============================================
function renderCategoryScreen(container, category) {
    const vectors = interestsState.userVectors;
    const profileName = `СБ-${vectors.СБ} · ТФ-${vectors.ТФ} · УБ-${vectors.УБ} · ЧВ-${vectors.ЧВ}`;
    
    let items = [];
    let categoryName = '';
    let categoryEmoji = '';
    
    switch (category) {
        case 'books':
            items = getRecommendations(INTERESTS_DB.books, vectors);
            categoryName = 'КНИГИ';
            categoryEmoji = '📚';
            break;
        case 'movies':
            items = getRecommendations(INTERESTS_DB.movies, vectors);
            categoryName = 'КИНО';
            categoryEmoji = '🎬';
            break;
        case 'practices':
            items = getRecommendations(INTERESTS_DB.practices, vectors);
            categoryName = 'ПРАКТИКИ';
            categoryEmoji = '🧘';
            break;
        case 'careers':
            items = getRecommendations(INTERESTS_DB.careers, vectors);
            categoryName = 'КАРЬЕРА';
            categoryEmoji = '💼';
            break;
    }
    
    let itemsHtml = '';
    items.forEach((item, idx) => {
        const relevancePercent = Math.round(item.relevance);
        const relevanceStars = '⭐'.repeat(Math.floor(relevancePercent / 20));
        
        if (category === 'books') {
            itemsHtml += `
                <div class="interest-item">
                    <div class="interest-number">${idx + 1}</div>
                    <div class="interest-content">
                        <div class="interest-title">${item.title}</div>
                        <div class="interest-description">${item.description}</div>
                        <div class="interest-meta">
                            <span class="interest-rating">⭐ ${item.rating}</span>
                            <span class="interest-year">📅 ${item.year}</span>
                            <span class="interest-relevance">🎯 ${relevanceStars} ${relevancePercent}%</span>
                        </div>
                        <div class="interest-tags">
                            ${item.tags.map(tag => `<span class="interest-tag">#${tag}</span>`).join('')}
                        </div>
                        <div class="interest-actions">
                            <button class="interest-download-btn" data-id="${item.id}">📥 Скачать</button>
                            <button class="interest-detail-btn" data-id="${item.id}">📖 Подробнее</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (category === 'practices') {
            itemsHtml += `
                <div class="interest-item">
                    <div class="interest-number">${idx + 1}</div>
                    <div class="interest-content">
                        <div class="interest-title">${item.title}</div>
                        <div class="interest-description">${item.description}</div>
                        <div class="interest-meta">
                            <span class="interest-duration">⏱️ ${item.duration} мин</span>
                            <span class="interest-type">🧘 ${item.type}</span>
                            <span class="interest-relevance">🎯 ${relevanceStars} ${relevancePercent}%</span>
                        </div>
                        <div class="interest-actions">
                            <button class="practice-start-btn" data-id="${item.id}">▶️ ВЫПОЛНИТЬ</button>
                            <button class="interest-detail-btn" data-id="${item.id}">📋 Инструкция</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (category === 'careers') {
            const demandMap = { high: '🔥 Высокий', medium: '📊 Средний', low: '📉 Низкий' };
            itemsHtml += `
                <div class="interest-item">
                    <div class="interest-number">${idx + 1}</div>
                    <div class="interest-content">
                        <div class="interest-title">${item.title}</div>
                        <div class="interest-description">${item.description}</div>
                        <div class="interest-meta">
                            <span class="interest-salary">💰 ${item.salary} ₽</span>
                            <span class="interest-demand">📈 ${demandMap[item.demand]}</span>
                            <span class="interest-relevance">🎯 ${relevanceStars} ${relevancePercent}%</span>
                        </div>
                        <div class="interest-actions">
                            <button class="career-detail-btn" data-id="${item.id}">📊 Подробнее</button>
                            <button class="career-courses-btn" data-id="${item.id}">📚 Курсы</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            itemsHtml += `
                <div class="interest-item">
                    <div class="interest-number">${idx + 1}</div>
                    <div class="interest-content">
                        <div class="interest-title">${item.title}</div>
                        <div class="interest-description">${item.description}</div>
                        <div class="interest-meta">
                            <span class="interest-rating">⭐ ${item.rating}</span>
                            <span class="interest-year">📅 ${item.year}</span>
                            <span class="interest-relevance">🎯 ${relevanceStars} ${relevancePercent}%</span>
                        </div>
                        <div class="interest-tags">
                            ${item.tags ? item.tags.map(tag => `<span class="interest-tag">#${tag}</span>`).join('') : ''}
                        </div>
                        <div class="interest-actions">
                            <button class="interest-detail-btn" data-id="${item.id}">🎬 Подробнее</button>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="categoryBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">${categoryEmoji}</div>
                <h1>${categoryName}</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">Для профиля ${profileName}</div>
            </div>
            
            <div class="category-content">
                ${itemsHtml}
            </div>
        </div>
    `;
    
    // Стили для элементов
    const style2 = document.createElement('style');
    style2.textContent = `
        .category-content {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .interest-item {
            display: flex;
            gap: 16px;
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 16px;
            transition: all 0.2s;
        }
        .interest-item:hover {
            background: rgba(224,224,224,0.08);
        }
        .interest-number {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-secondary);
            opacity: 0.5;
            min-width: 40px;
        }
        .interest-content {
            flex: 1;
        }
        .interest-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .interest-description {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 10px;
            line-height: 1.4;
        }
        .interest-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 10px;
            font-size: 11px;
        }
        .interest-rating, .interest-year, .interest-duration, .interest-type, .interest-salary, .interest-demand, .interest-relevance {
            color: var(--text-secondary);
        }
        .interest-relevance {
            color: #ff6b3b;
        }
        .interest-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 12px;
        }
        .interest-tag {
            background: rgba(255,107,59,0.1);
            border-radius: 20px;
            padding: 2px 8px;
            font-size: 9px;
            color: #ff6b3b;
        }
        .interest-actions {
            display: flex;
            gap: 10px;
        }
        .interest-actions button {
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .interest-download-btn, .interest-detail-btn, .practice-start-btn, .career-detail-btn, .career-courses-btn {
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            color: white;
        }
        .interest-download-btn:hover, .interest-detail-btn:hover, .practice-start-btn:hover {
            background: rgba(255,107,59,0.2);
            border-color: rgba(255,107,59,0.3);
        }
        @media (max-width: 768px) {
            .interest-item {
                flex-direction: column;
                gap: 8px;
            }
            .interest-number {
                font-size: 20px;
                min-width: auto;
            }
            .interest-title {
                font-size: 14px;
            }
            .interest-actions {
                flex-wrap: wrap;
            }
        }
    `;
    document.head.appendChild(style2);
    
    const backBtn = document.getElementById('categoryBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => renderInterestsMainScreen(container));
    }
    
    // Обработчики кнопок
    document.querySelectorAll('.interest-download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('📥 Скачивание будет доступно в следующей версии', 'info');
        });
    });
    
    document.querySelectorAll('.interest-detail-btn, .career-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('📖 Подробный анализ будет доступен в следующей версии', 'info');
        });
    });
    
    document.querySelectorAll('.practice-start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('🧘 Практика будет доступна в следующей версии', 'info');
        });
    });
    
    document.querySelectorAll('.career-courses-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToastMessage('📚 Курсы появятся в следующем обновлении', 'info');
        });
    });
}

// ============================================
// 8. ЭКСПОРТ
// ============================================
window.showInterestsScreen = showInterestsScreen;

console.log('✅ Модуль интересов загружен (interests.js v1.0)');
