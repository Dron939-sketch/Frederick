// ============================================
// brand.js — Личный бренд, стиль и архетип
// Версия 1.0
// ============================================

// Архетипы по Юнгу
const ARCHETYPES = {
    'INNOCENT': {
        name: 'ПРОСТОДУШНЫЙ',
        emoji: '😇',
        description: 'Оптимист, который верит в лучшее и ищет гармонию',
        style: 'Естественный, светлые тона, натуральные ткани',
        brand: 'Эксперт по позитиву, доверию и простоте',
        careers: ['Психолог', 'Учитель', 'Воспитатель', 'Бренд-амбассадор'],
        brands: ['Coca-Cola', 'Dove', 'Johnson & Johnson']
    },
    'EVERYMAN': {
        name: 'СЛАВНЫЙ МАЛЫЙ',
        emoji: '👥',
        description: 'Свой парень, который ценит принадлежность и связь с другими',
        style: 'Демократичный, доступный, без излишеств',
        brand: 'Народный эксперт, близкий к аудитории',
        careers: ['HR', 'Менеджер', 'Политик', 'Лидер сообщества'],
        brands: ['IKEA', 'Volkswagen', 'ВкусВилл']
    },
    'HERO': {
        name: 'ГЕРОЙ',
        emoji: '🦸',
        description: 'Смелый боец, который доказывает свою ценность через действие',
        style: 'Спортивный, динамичный, яркие акценты',
        brand: 'Эксперт по преодолению и достижениям',
        careers: ['Спортсмен', 'Военный', 'Спасатель', 'CEO'],
        brands: ['Nike', 'Red Bull', 'Alpha']
    },
    'CAREGIVER': {
        name: 'ЗАБОТЛИВЫЙ',
        emoji: '🤱',
        description: 'Альтруист, который защищает и заботится о других',
        style: 'Мягкий, уютный, пастельные тона',
        brand: 'Эксперт по заботе, помощи и поддержке',
        careers: ['Врач', 'Социальный работник', 'Волонтёр', 'Коуч'],
        brands: ['Pampers', 'Amedisys', 'Добро Mail.ru']
    },
    'EXPLORER': {
        name: 'ИСКАТЕЛЬ',
        emoji: '🧭',
        description: 'Авантюрист, который ищет свободу и новые горизонты',
        style: 'Походный, практичный, землистые тона',
        brand: 'Эксперт по путешествиям, приключениям и открытиям',
        careers: ['Фотограф', 'Журналист', 'Гид', 'Исследователь'],
        brands: ['Jeep', 'The North Face', 'GoPro']
    },
    'REBEL': {
        name: 'БУНТАРЬ',
        emoji: '🤘',
        description: 'Разрушитель шаблонов, который меняет правила игры',
        style: 'Авангардный, чёрный, кожа, металл',
        brand: 'Эксперт по переменам, инновациям и вызовам',
        careers: ['Предприниматель', 'Художник', 'Активист', 'Стартапер'],
        brands: ['Harley-Davidson', 'Apple (ранний)', 'Diesel']
    },
    'LOVER': {
        name: 'ЛЮБОВНИК',
        emoji: '💕',
        description: 'Страстный ценитель красоты, близости и удовольствий',
        style: 'Чувственный, элегантный, шёлк и бархат',
        brand: 'Эксперт по отношениям, красоте и наслаждению',
        careers: ['Дизайнер', 'Визажист', 'Шеф-повар', 'Свадебный организатор'],
        brands: ['Chanel', 'Victoria Secret', 'Godiva']
    },
    'CREATOR': {
        name: 'ТВОРЕЦ',
        emoji: '🎨',
        description: 'Новатор, который создаёт что-то новое и уникальное',
        style: 'Креативный, нестандартный, яркие детали',
        brand: 'Эксперт по созданию, дизайну и инновациям',
        careers: ['Дизайнер', 'Архитектор', 'Писатель', 'Музыкант'],
        brands: ['Apple', 'LEGO', 'Adobe']
    },
    'JESTER': {
        name: 'ШУТ',
        emoji: '🤡',
        description: 'Весельчак, который приносит радость и легкость',
        style: 'Яркий, эксцентричный, смелые сочетания',
        brand: 'Эксперт по юмору, развлечениям и позитиву',
        careers: ['Комедиант', 'Аниматор', 'SMM-менеджер', 'Тик-токер'],
        brands: ['M&M's', 'Skittles', 'Old Spice']
    },
    'SAGE': {
        name: 'МУДРЕЦ',
        emoji: '🦉',
        description: 'Искатель истины, который передаёт знания',
        style: 'Академичный, консервативный, тёмные тона',
        brand: 'Эксперт по знаниям, аналитике и обучению',
        careers: ['Учёный', 'Преподаватель', 'Аналитик', 'Ментор'],
        brands: ['Google', 'Harvard', 'The Economist']
    },
    'MAGICIAN': {
        name: 'МАГ',
        emoji: '🔮',
        description: 'Визионер, который превращает мечты в реальность',
        style: 'Мистический, элегантный, глубокие цвета',
        brand: 'Эксперт по трансформации и чудесам',
        careers: ['Психолог', 'Коуч', 'Медиум', 'Инноватор'],
        brands: ['Tesla', 'Disney', 'MasterClass']
    },
    'RULER': {
        name: 'ПРАВИТЕЛЬ',
        emoji: '👑',
        description: 'Лидер, который создаёт порядок и процветание',
        style: 'Статусный, дорогой, классический',
        brand: 'Эксперт по лидерству, управлению и власти',
        careers: ['Директор', 'Политик', 'Судья', 'Банкир'],
        brands: ['Mercedes-Benz', 'Rolex', 'Microsoft']
    }
};

// Состояние
let brandState = {
    activeTab: 'archetype', // 'archetype', 'style', 'brand'
    userArchetype: null
};

// Загрузка архетипа пользователя
async function loadUserArchetype() {
    const vectors = userDoublesProfile?.vectors || { СБ:4, ТФ:4, УБ:4, ЧВ:4 };
    
    // Алгоритм определения архетипа по векторам
    const sb = vectors.СБ;
    const tf = vectors.ТФ;
    const ub = vectors.УБ;
    const chv = vectors.ЧВ;
    
    if (sb >= 5 && tf >= 5 && ub >= 5) return 'RULER';
    if (chv >= 5 && sb >= 4) return 'LOVER';
    if (ub >= 5 && sb >= 4) return 'SAGE';
    if (chv >= 5 && ub <= 3) return 'CAREGIVER';
    if (sb >= 5 && tf >= 4) return 'HERO';
    if (ub >= 4 && chv >= 4) return 'CREATOR';
    if (chv >= 5) return 'CAREGIVER';
    if (sb >= 5) return 'HERO';
    if (tf >= 5) return 'RULER';
    if (ub >= 5) return 'SAGE';
    
    return 'EXPLORER';
}

// Главный экран
async function showPersonalBrandScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    await loadUserProfileForDoubles();
    brandState.userArchetype = await loadUserArchetype();
    
    renderBrandScreen(container);
}

function renderBrandScreen(container) {
    const archetype = ARCHETYPES[brandState.userArchetype] || ARCHETYPES['EXPLORER'];
    
    container.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="brandBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">🏆</div>
                <h1>Личный бренд</h1>
                <div style="font-size: 12px; color: var(--text-secondary);">Ваш образ, стиль и архетип</div>
            </div>
            
            <div class="brand-tabs">
                <button class="brand-tab ${brandState.activeTab === 'archetype' ? 'active' : ''}" data-tab="archetype">
                    🎭 АРХЕТИП
                </button>
                <button class="brand-tab ${brandState.activeTab === 'style' ? 'active' : ''}" data-tab="style">
                    👔 СТИЛЬ
                </button>
                <button class="brand-tab ${brandState.activeTab === 'brand' ? 'active' : ''}" data-tab="brand">
                    📊 БРЕНД
                </button>
            </div>
            
            <div class="brand-content" id="brandContent">
                ${renderArchetypeTab(archetype)}
            </div>
            
            <div class="brand-footer">
                <button id="downloadBrandBtn" class="brand-action-btn">
                    📥 Скачать анализ (PDF)
                </button>
                <button id="shareBrandBtn" class="brand-action-btn">
                    📤 Поделиться
                </button>
            </div>
        </div>
    `;
    
    // Стили
    const style = document.createElement('style');
    style.textContent = `
        .brand-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
        }
        .brand-tab {
            flex: 1;
            padding: 10px 16px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .brand-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        .brand-archetype-card {
            background: linear-gradient(135deg, rgba(255,107,59,0.1), rgba(255,59,59,0.05));
            border-radius: 28px;
            padding: 24px;
            text-align: center;
            margin-bottom: 20px;
        }
        .brand-archetype-emoji {
            font-size: 64px;
            margin-bottom: 12px;
        }
        .brand-archetype-name {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .brand-archetype-desc {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 16px;
        }
        .brand-section {
            background: rgba(224,224,224,0.05);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .brand-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--chrome);
        }
        .brand-tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .brand-tag {
            background: rgba(255,107,59,0.15);
            border-radius: 30px;
            padding: 6px 14px;
            font-size: 12px;
        }
        .brand-action-btn {
            width: 48%;
            padding: 12px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 50px;
            color: white;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .brand-action-btn:hover {
            background: rgba(255,107,59,0.2);
            border-color: rgba(255,107,59,0.3);
        }
        .brand-footer {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }
    `;
    document.head.appendChild(style);
    
    // Обработчики
    const backBtn = document.getElementById('brandBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => goBackToDashboard());
    }
    
    document.querySelectorAll('.brand-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            brandState.activeTab = tab.dataset.tab;
            renderBrandScreen(container);
        });
    });
    
    document.getElementById('downloadBrandBtn')?.addEventListener('click', () => {
        showToastMessage('📥 PDF будет доступен в следующей версии', 'info');
    });
    
    document.getElementById('shareBrandBtn')?.addEventListener('click', () => {
        showToastMessage('📤 Поделиться можно будет в следующей версии', 'info');
    });
}

function renderArchetypeTab(archetype) {
    return `
        <div class="brand-archetype-card">
            <div class="brand-archetype-emoji">${archetype.emoji}</div>
            <div class="brand-archetype-name">${archetype.name}</div>
            <div class="brand-archetype-desc">${archetype.description}</div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">💼 КАРЬЕРНЫЙ ТРЕК</div>
            <div class="brand-tag-list">
                ${archetype.careers.map(c => `<span class="brand-tag">${c}</span>`).join('')}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">🏢 БРЕНДЫ-ПРИМЕРЫ</div>
            <div class="brand-tag-list">
                ${archetype.brands.map(b => `<span class="brand-tag">${b}</span>`).join('')}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">🔮 ВАША СУПЕРСИЛА</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getSuperpowerText(archetype.name)}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">⚠️ ЗОНА РОСТА</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getGrowthZoneText(archetype.name)}
            </div>
        </div>
    `;
}

function renderStyleTab(archetype) {
    return `
        <div class="brand-section">
            <div class="brand-section-title">👔 РЕКОМЕНДУЕМЫЙ СТИЛЬ</div>
            <div style="font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
                ${archetype.style}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">🎨 ЦВЕТОВАЯ ГАММА</div>
            <div class="brand-tag-list">
                ${getColorPalette(archetype.name).map(c => `<span class="brand-tag" style="background: ${c.color}20; border-color: ${c.color}40;">${c.name}</span>`).join('')}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">📸 СТИЛЬ ФОТОГРАФИЙ</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getPhotoStyle(archetype.name)}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">💬 СТИЛЬ ОБЩЕНИЯ</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getCommunicationStyle(archetype.name)}
            </div>
        </div>
    `;
}

function renderBrandTab(archetype) {
    return `
        <div class="brand-section">
            <div class="brand-section-title">📊 ПОЗИЦИОНИРОВАНИЕ</div>
            <div style="font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
                ${archetype.brand}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">📝 УТП (Уникальное торговое предложение)</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getUTP(archetype.name)}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">📱 КОНТЕНТ-СТРАТЕГИЯ</div>
            <div style="font-size: 13px; line-height: 1.5;">
                ${getContentStrategy(archetype.name)}
            </div>
        </div>
        
        <div class="brand-section">
            <div class="brand-section-title">🎯 ЦЕЛЕВАЯ АУДИТОРИЯ</div>
            <div class="brand-tag-list">
                ${getTargetAudience(archetype.name).map(a => `<span class="brand-tag">${a}</span>`).join('')}
            </div>
        </div>
    `;
}

// Вспомогательные функции
function getSuperpowerText(archetype) {
    const map = {
        'ТВОРЕЦ': 'Вы способны видеть то, чего ещё нет, и создавать это. Ваша суперсила — воображение и инновации.',
        'МУДРЕЦ': 'Вы видите глубинные закономерности и можете объяснить сложное простыми словами.',
        'ГЕРОЙ': 'Ваша суперсила — мужество и способность действовать там, где другие боятся.',
        'ЗАБОТЛИВЫЙ': 'Вы умеете создавать безопасное пространство, где другие могут расти и развиваться.',
        'ПРАВИТЕЛЬ': 'Вы создаёте порядок из хаоса и умеете вести за собой людей.',
        'ИСКАТЕЛЬ': 'Ваша суперсила — адаптивность и способность находить возможности там, где другие видят проблемы.',
        'БУНТАРЬ': 'Вы ломаете устаревшие системы и создаёте новые правила игры.',
        'ЛЮБОВНИК': 'Вы создаёте красоту и гармонию, привлекаете людей своей энергетикой.',
        'ПРОСТОДУШНЫЙ': 'Вы вселяете доверие и оптимизм, ваша искренность — главный актив.',
        'СЛАВНЫЙ МАЛЫЙ': 'Вы свой в доску, люди вам доверяют, потому что вы такой же, как они.',
        'ШУТ': 'Вы делаете жизнь легче и веселее, ваша суперсила — лёгкость и юмор.',
        'МАГ': 'Вы превращаете мечты в реальность, ваша суперсила — трансформация.'
    };
    return map[archetype] || 'Ваша суперсила — уникальное сочетание качеств, которое привлекает нужных людей.';
}

function getGrowthZoneText(archetype) {
    const map = {
        'ТВОРЕЦ': 'Доводить проекты до конца, не распыляться, принимать критику.',
        'МУДРЕЦ': 'Больше действовать, меньше анализировать, не застревать в теории.',
        'ГЕРОЙ': 'Научиться отдыхать и просить о помощи, не брать всё на себя.',
        'ЗАБОТЛИВЫЙ': 'Ставить себя на первое место, говорить "нет", не выгорать.',
        'ПРАВИТЕЛЬ': 'Делегировать и доверять, не пытаться контролировать всё.',
        'ИСКАТЕЛЬ': 'Сфокусироваться на одном направлении, не прыгать с места на место.',
        'БУНТАРЬ': 'Научиться работать внутри системы, не разрушая её полностью.',
        'ЛЮБОВНИК': 'Не терять себя в других, сохранять личные границы.',
        'ПРОСТОДУШНЫЙ': 'Научиться говорить правду, даже если она неприятна.',
        'СЛАВНЫЙ МАЛЫЙ': 'Заявить о себе, не бояться выделяться из толпы.',
        'ШУТ': 'Показывать серьёзность там, где это действительно важно.',
        'МАГ': 'Соблюдать обещания, быть более предсказуемым для других.'
    };
    return map[archetype] || 'Баланс между действием и рефлексией.';
}

function getColorPalette(archetype) {
    const map = {
        'ТВОРЕЦ': [{ name: 'Фиолетовый', color: '#9b59b6' }, { name: 'Оранжевый', color: '#ff6b3b' }, { name: 'Бирюзовый', color: '#1abc9c' }],
        'МУДРЕЦ': [{ name: 'Синий', color: '#3498db' }, { name: 'Тёмно-синий', color: '#2c3e50' }, { name: 'Серый', color: '#95a5a6' }],
        'ГЕРОЙ': [{ name: 'Красный', color: '#e74c3c' }, { name: 'Чёрный', color: '#2c3e50' }, { name: 'Золотой', color: '#f1c40f' }],
        'ЗАБОТЛИВЫЙ': [{ name: 'Мятный', color: '#2ecc71' }, { name: 'Нежно-розовый', color: '#ffb6c1' }, { name: 'Бежевый', color: '#f5e6d3' }],
        'ПРАВИТЕЛЬ': [{ name: 'Тёмно-синий', color: '#1a252f' }, { name: 'Золотой', color: '#f39c12' }, { name: 'Бордовый', color: '#8e44ad' }],
        'ИСКАТЕЛЬ': [{ name: 'Оливковый', color: '#6c7a89' }, { name: 'Терракотовый', color: '#d35400' }, { name: 'Хаки', color: '#8e9e6b' }]
    };
    return map[archetype] || [{ name: 'Белый', color: '#ffffff' }, { name: 'Чёрный', color: '#000000' }, { name: 'Серый', color: '#7f8c8d' }];
}

function getPhotoStyle(archetype) {
    const map = {
        'ТВОРЕЦ': 'Креативные, нестандартные ракурсы. Фото в процессе создания. Яркие цветовые акценты.',
        'МУДРЕЦ': 'Интеллектуальные фото с книгами, у доски. Классические портреты. Спокойный фон.',
        'ГЕРОЙ': 'Динамичные фото в движении, с достижениями. Спортивный стиль. Чёткие линии.',
        'ЗАБОТЛИВЫЙ': 'Тёплые, уютные фото. С людьми, детьми, животными. Мягкий свет.',
        'ПРАВИТЕЛЬ': 'Статусные фото в кабинете, с атрибутами власти. Строгий костюм. Уверенная поза.',
        'ИСКАТЕЛЬ': 'Фото в путешествиях, с рюкзаком, на природе. Естественные кадры.'
    };
    return map[archetype] || 'Естественные, живые фото, отражающие вашу личность.';
}

function getCommunicationStyle(archetype) {
    const map = {
        'ТВОРЕЦ': 'Образно, метафорично, с воодушевлением. "Представьте, если..."',
        'МУДРЕЦ': 'Структурированно, с фактами, спокойно. "Исследования показывают..."',
        'ГЕРОЙ': 'Коротко, по делу, с призывами к действию. "Давай сделаем!"',
        'ЗАБОТЛИВЫЙ': 'Мягко, поддерживающе, с вопросами. "Как ты себя чувствуешь?"',
        'ПРАВИТЕЛЬ': 'Уверенно, авторитетно, с цифрами. "Стратегия на следующий квартал..."',
        'ИСКАТЕЛЬ': 'Открыто, любопытно, с историями. "А ты знал, что..."'
    };
    return map[archetype] || 'Искренне и от сердца. Будьте собой — это ваше преимущество.';
}

function getUTP(archetype) {
    const map = {
        'ТВОРЕЦ': 'Я создаю то, чего ещё нет. Мои решения нестандартны и работают там, где стандарты бессильны.',
        'МУДРЕЦ': 'Я вижу систему там, где другие видят хаос. Мои знания экономят годы ошибок.',
        'ГЕРОЙ': 'Я делаю то, что другие боятся. Моя смелость становится вашим ресурсом.',
        'ЗАБОТЛИВЫЙ': 'Создаю безопасное пространство для роста. С вами не страшно меняться.',
        'ПРАВИТЕЛЬ': 'Создаю порядок и систему. Со мной хаос превращается в результат.',
        'ИСКАТЕЛЬ': 'Нахожу пути там, где их не видят. Открываю новые горизонты.'
    };
    return map[archetype] || 'Помогаю людям стать лучшей версией себя через понимание их психотипа.';
}

function getContentStrategy(archetype) {
    const map = {
        'ТВОРЕЦ': 'Показывайте процесс создания, кейсы "до/после", инсайты из творчества. Reels с процессом, блог о креативности.',
        'МУДРЕЦ': 'Длинные посты с анализом, видео-лекции, чек-листы, схемы. Экспертные статьи, подкасты.',
        'ГЕРОЙ': 'Короткие мотивирующие видео, истории преодоления, чек-листы достижений. Stories с победами.',
        'ЗАБОТЛИВЫЙ': 'Посты-поддержки, ответы на вопросы, тёплые сторис. Сообщество, прямые эфиры "разговор по душам".',
        'ПРАВИТЕЛЬ': 'Экспертные посты, бизнес-кейсы, стратегии. LinkedIn-style контент, вебинары.',
        'ИСКАТЕЛЬ': 'Фото из путешествий, лайфхаки, короткие заметки. Лёгкий, вдохновляющий контент.'
    };
    return map[archetype] || 'Аутентичный контент о вашем пути и открытиях. Будьте честны с аудиторией.';
}

function getTargetAudience(archetype) {
    const map = {
        'ТВОРЕЦ': ['Креативные профессионалы', 'Дизайнеры', 'Стартаперы', 'Фрилансеры'],
        'МУДРЕЦ': ['Аналитики', 'Исследователи', 'Преподаватели', 'Студенты'],
        'ГЕРОЙ': ['Спортсмены', 'Бизнесмены', 'Люди в кризисе', 'Амбициозные'],
        'ЗАБОТЛИВЫЙ': ['Родители', 'Психологи', 'Волонтёры', 'Люди в уязвимом положении'],
        'ПРАВИТЕЛЬ': ['Руководители', 'Предприниматели', 'Политики', 'Управленцы'],
        'ИСКАТЕЛЬ': ['Путешественники', 'Фотографы', 'Искатели себя', 'Авантюристы']
    };
    return map[archetype] || ['Саморазвивающиеся люди', 'Психологически грамотные', 'Ищущие себя'];
}

// Экспорт
window.showPersonalBrandScreen = showPersonalBrandScreen;
