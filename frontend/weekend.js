// ============================================
// weekend.js — Модуль "Идеи на выходные"
// ============================================

async function openWeekendScreen() {
    const completed = await isTestCompleted();
    if (!completed) {
        showToast('📊 Сначала пройдите психологический тест, чтобы получить персональные идеи');
        return;
    }

    showLoading('🌟 Генерирую идеи на выходные специально для тебя...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/ideas/${USER_ID}`);
        const data = await response.json();

        if (data.success && data.ideas && data.ideas.length > 0) {
            renderWeekendIdeas(data.ideas);
        } else {
            renderWeekendIdeas([]); // покажет fallback
        }

    } catch (error) {
        console.error('Weekend ideas error:', error);
        showToast('Не удалось загрузить идеи. Показываю резервные варианты.');
        renderWeekendIdeas([]); // покажет fallback
    }
}

function renderWeekendIdeas(ideas) {
    const container = document.getElementById('screenContainer');

    let ideasHtml = '';

    if (ideas && ideas.length > 0) {
        ideasHtml = ideas.map((idea, index) => `
            <div class="weekend-idea-card">
                <div class="idea-number">${index + 1}</div>
                <div class="idea-text">${idea}</div>
            </div>
        `).join('');
    } else {
        // Fallback идеи, если ничего не пришло
        ideasHtml = `
            <div class="weekend-idea-card">
                <div class="idea-number">1</div>
                <div class="idea-text">🌳 Прогулка в парке или лесу — спокойно подышать свежим воздухом</div>
            </div>
            <div class="weekend-idea-card">
                <div class="idea-number">2</div>
                <div class="idea-text">📖 Устроить уютный вечер с книгой и любимым напитком</div>
            </div>
            <div class="weekend-idea-card">
                <div class="idea-number">3</div>
                <div class="idea-text">🧘 Попробовать короткую медитацию или дыхательную практику</div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="full-content-page" style="max-width: 900px;">
            <button class="back-btn" id="backToDashboard">◀️ НАЗАД К ДАШБОРДУ</button>
            
            <div class="content-header">
                <div class="content-emoji" style="font-size: 68px;">🌟</div>
                <h1>Идеи на выходные</h1>
                <p style="color: var(--text-secondary);">Персональные предложения специально для тебя</p>
            </div>

            <div class="weekend-ideas-container">
                ${ideasHtml}
            </div>

            <div style="margin-top: 40px; text-align: center; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button onclick="refreshWeekendIdeas()" class="voice-record-btn-premium" style="background: rgba(255,107,59,0.15); border-color: #ff6b3b;">
                    🔄 Обновить идеи
                </button>
                <button onclick="renderDashboard()" class="back-btn" style="min-width: 160px;">
                    Вернуться в дашборд
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', renderDashboard);
}

// Обновление идей
async function refreshWeekendIdeas() {
    showLoading('🌟 Генерирую новые идеи...');
    await new Promise(resolve => setTimeout(resolve, 800)); // небольшая задержка для красоты
    openWeekendScreen();
}

// Добавляем стили (можно вынести в styles.css позже)
const weekendStyles = `
.weekend-ideas-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 24px 0;
}

.weekend-idea-card {
    background: rgba(224, 224, 224, 0.08);
    border-radius: 20px;
    padding: 20px;
    border: 1px solid rgba(224, 224, 224, 0.15);
    transition: all 0.3s ease;
}

.weekend-idea-card:hover {
    transform: translateY(-4px);
    border-color: #ff6b3b;
    background: rgba(255, 107, 59, 0.08);
}

.idea-number {
    font-size: 18px;
    font-weight: 700;
    color: #ff6b3b;
    margin-bottom: 8px;
}

.idea-text {
    font-size: 15.5px;
    line-height: 1.6;
    color: var(--text-primary);
}
`;

document.head.insertAdjacentHTML('beforeend', `<style>${weekendStyles}</style>`);

// Экспорт
window.openWeekendScreen = openWeekendScreen;
window.refreshWeekendIdeas = refreshWeekendIdeas;
