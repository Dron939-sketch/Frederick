// ============================================
// goals.js — Модуль "Цели"
// Динамический подбор целей по профилю пользователя
// ============================================

async function openGoalsScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест, чтобы получить персональные цели');
        return;
    }

    showLoading('🎯 Подбираю цели специально под ваш профиль...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/goals/${USER_ID}`);
        const data = await response.json();

        if (data.success && data.goals && data.goals.length > 0) {
            renderGoalsScreen(data.goals, data.profile_code || '');
        } else {
            renderGoalsScreen([], '');
        }

    } catch (error) {
        console.error('Goals loading error:', error);
        showToast('Не удалось загрузить цели. Показываю примеры.');
        renderGoalsScreen([], '');
    }
}

function renderGoalsScreen(goals, profileCode) {
    const container = document.getElementById('screenContainer');

    let goalsHtml = '';

    if (goals && goals.length > 0) {
        goalsHtml = goals.map((goal, index) => {
            const difficultyColor = goal.difficulty === 'hard' ? '#ef4444' : 
                                  goal.difficulty === 'medium' ? '#f59e0b' : '#10b981';
            
            return `
                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-number">${index + 1}</span>
                        <span class="goal-difficulty" style="background: ${difficultyColor}20; color: ${difficultyColor}">
                            ${goal.difficulty === 'hard' ? 'Сложная' : goal.difficulty === 'medium' ? 'Средняя' : 'Лёгкая'}
                        </span>
                    </div>
                    <div class="goal-title">${goal.title || goal.name}</div>
                    <div class="goal-desc">${goal.description || ''}</div>
                    ${goal.is_priority ? `<div class="goal-priority">⭐ Приоритетная цель</div>` : ''}
                </div>
            `;
        }).join('');
    } else {
        // Fallback, если целей пока нет
        goalsHtml = `
            <div class="no-goals">
                <div class="no-goals-emoji">🎯</div>
                <h3>Ваши цели скоро появятся</h3>
                <p>После анализа вашего профиля Фреди подберёт персональные цели, которые помогут вам расти.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 920px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">🎯</div>
                <h1>Ваши цели</h1>
                ${profileCode ? `<p style="color: var(--text-secondary);">Профиль: <strong>${profileCode}</strong></p>` : ''}
            </div>

            <div class="goals-container">
                ${goalsHtml}
            </div>

            <div class="goals-actions">
                <button onclick="refreshGoals()" class="voice-record-btn-premium">
                    🔄 Обновить цели
                </button>
                <button onclick="renderDashboard()" class="back-btn">
                    Вернуться в дашборд
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Обновление целей
async function refreshGoals() {
    showLoading('🎯 Генерирую новые цели по вашему профилю...');
    await new Promise(r => setTimeout(r, 700)); // небольшая задержка для красоты
    openGoalsScreen();
}

// Стили для модуля "Цели"
const goalsStyles = `
.goals-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 24px 0;
}

.goal-card {
    background: rgba(224, 224, 224, 0.08);
    border-radius: 20px;
    padding: 20px;
    border: 1px solid rgba(224, 224, 224, 0.15);
    transition: all 0.3s ease;
}

.goal-card:hover {
    transform: translateY(-3px);
    border-color: #3b82ff;
}

.goal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.goal-number {
    font-size: 18px;
    font-weight: 700;
    color: #3b82ff;
}

.goal-difficulty {
    font-size: 13px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 30px;
}

.goal-title {
    font-size: 17px;
    font-weight: 600;
    margin-bottom: 8px;
    line-height: 1.4;
}

.goal-desc {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-secondary);
}

.goal-priority {
    margin-top: 12px;
    font-size: 13px;
    color: #f59e0b;
    font-weight: 600;
}

.no-goals {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
}

.goals-actions {
    margin-top: 40px;
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}
`;

document.head.insertAdjacentHTML('beforeend', `<style>${goalsStyles}</style>`);

// Экспорт
window.openGoalsScreen = openGoalsScreen;
window.refreshGoals = refreshGoals;
