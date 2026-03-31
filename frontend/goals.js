// ============================================
// goals.js — Модуль "Цели"
// Полностью рабочий + красивый дизайн
// ============================================

async function openGoalsScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест, чтобы получить персональные цели');
        return;
    }

    showLoading('🎯 Анализирую твой профиль и подбираю цели...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/goals/${USER_ID}`);
        const data = await response.json();

        if (data.success && data.goals && data.goals.length > 0) {
            renderGoalsScreen(data.goals, data.profile_code || '');
        } else {
            renderGoalsScreen([], '');
        }

    } catch (error) {
        console.error('Goals error:', error);
        showToast('Не удалось загрузить цели. Показываю примеры.');
        renderGoalsScreen([], '');
    }
}

function renderGoalsScreen(goals, profileCode) {
    const container = document.getElementById('screenContainer');

    let goalsHtml = '';

    if (goals && goals.length > 0) {
        goalsHtml = goals.map((goal, i) => {
            const diffColor = goal.difficulty === 'hard' ? '#ef4444' : 
                             goal.difficulty === 'medium' ? '#f59e0b' : '#10b981';
            
            return `
                <div class="goal-card" onclick="selectGoal(${JSON.stringify(goal)})">
                    <div class="goal-header">
                        <span class="goal-number">${i + 1}</span>
                        <span class="goal-difficulty" style="background:${diffColor}20; color:${diffColor}">
                            ${goal.difficulty === 'hard' ? 'Сложная' : goal.difficulty === 'medium' ? 'Средняя' : 'Лёгкая'}
                        </span>
                    </div>
                    <div class="goal-title">${goal.name || goal.title}</div>
                    <div class="goal-desc">${goal.description || ''}</div>
                    ${goal.is_priority ? `<div class="goal-priority">⭐ Приоритетная цель</div>` : ''}
                    <div class="goal-time">⏱ ${goal.time || 'не указано'}</div>
                </div>
            `;
        }).join('');
    } else {
        goalsHtml = `
            <div class="no-goals">
                <div class="no-goals-emoji">🎯</div>
                <h3>Цели скоро появятся</h3>
                <p>После анализа твоего профиля Фреди подберёт цели, которые помогут тебе расти.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 920px;">
            <button class="back-btn" id="backBtn">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">🎯</div>
                <h1>Твои цели</h1>
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

    document.getElementById('backBtn').addEventListener('click', renderDashboard);
}

// Выбор цели
async function selectGoal(goal) {
    if (!goal) return;

    showLoading('💾 Сохраняю выбранную цель...');

    try {
        const res = await fetch(`${API_BASE_URL}/api/goals/select`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: USER_ID,
                goal: goal
            })
        });

        const data = await res.json();

        if (data.success) {
            showToast(`✅ Цель «${goal.name}» сохранена`);
            // Можно открыть маршрут или вернуться в дашборд
            setTimeout(() => renderDashboard(), 1200);
        } else {
            showToast('Не удалось сохранить цель');
        }
    } catch (e) {
        console.error(e);
        showToast('Ошибка сохранения цели');
    }
}

// Обновление целей
async function refreshGoals() {
    showLoading('🎯 Генерирую новые цели...');
    await new Promise(r => setTimeout(r, 600));
    openGoalsScreen();
}

// Стили для модуля
const goalsCSS = `
.goals-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 24px 0;
}
.goal-card {
    background: rgba(224,224,224,0.08);
    border: 1px solid rgba(224,224,224,0.2);
    border-radius: 20px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s;
}
.goal-card:hover {
    transform: translateY(-4px);
    border-color: #3b82ff;
}
.goal-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
}
.goal-number {
    font-size: 18px;
    font-weight: 700;
    color: #3b82ff;
}
.goal-difficulty {
    font-size: 13px;
    padding: 4px 14px;
    border-radius: 30px;
    font-weight: 600;
}
.goal-title {
    font-size: 17px;
    font-weight: 600;
    margin-bottom: 8px;
}
.goal-desc {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-secondary);
}
.goal-priority {
    margin-top: 12px;
    color: #f59e0b;
    font-weight: 600;
    font-size: 13px;
}
.goal-time {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-secondary);
}
.goals-actions {
    margin-top: 40px;
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}
.no-goals {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
}
`;

document.head.insertAdjacentHTML('beforeend', `<style>${goalsCSS}</style>`);

// Экспорт
window.openGoalsScreen = openGoalsScreen;
window.refreshGoals = refreshGoals;
window.selectGoal = selectGoal;
