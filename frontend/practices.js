// ============================================
// practices.js — Нейро-практики 2.0
// Версия 2.0 — Интерактивные практики
// ============================================

let practicesState = {
    isLoading: false,
    activeTab: 'neurotracker',
    userVectors: { СБ: 4, ТФ: 4, УБ: 4, ЧВ: 4 },
    userName: 'друг',
    cognitiveBiases: {
        catastrophizing: 85,
        blackAndWhite: 45,
        mindReading: 65,
        personalization: 30,
        shouldStatements: 70,
        labeling: 50
    },
    meditationActive: false
};

const BIASES = {
    catastrophizing:  { name: "Катастрофизация",        color: "#ef4444", description: "Видишь ситуацию хуже, чем она есть на самом деле" },
    blackAndWhite:    { name: "Чёрно-белое мышление",   color: "#f59e0b", description: "Видишь только крайности, без полутонов" },
    mindReading:      { name: "Чтение мыслей",          color: "#8b5cf6", description: "Уверен, что знаешь, что думают другие" },
    personalization:  { name: "Персонализация",         color: "#ec4899", description: "Принимаешь всё на свой счёт" },
    shouldStatements: { name: "Долженствование",        color: "#3b82ff", description: "Требуешь от себя и других по жёстким правилам" },
    labeling:         { name: "Наклеивание ярлыков",   color: "#10b981", description: "Обобщаешь: «я неудачник», «всё ужасно»" }
};

function showToastMessage(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else console.log(`[${type}] ${message}`);
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
    else location.reload();
}

async function checkTestCompleted() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
        const data = await response.json();
        return data.has_profile === true;
    } catch (e) { return true; }
}

async function loadUserProfileForPractices() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const res  = await fetch(`${apiUrl}/api/get-profile/${userId}`);
        const data = await res.json();
        const bl   = data.profile?.behavioral_levels || {};
        const avg  = x => Array.isArray(x) ? x[x.length-1] : (x || 4);

        practicesState.userVectors = { СБ: avg(bl.СБ), ТФ: avg(bl.ТФ), УБ: avg(bl.УБ), ЧВ: avg(bl.ЧВ) };
        practicesState.userName    = localStorage.getItem('fredi_user_name') || 'друг';

        const v = practicesState.userVectors;
        if (v.СБ >= 5) { practicesState.cognitiveBiases.catastrophizing = 85; practicesState.cognitiveBiases.mindReading = 70; }
        if (v.УБ >= 5) { practicesState.cognitiveBiases.blackAndWhite = 60; }
        if (v.ЧВ >= 5) { practicesState.cognitiveBiases.personalization = 75; practicesState.cognitiveBiases.mindReading = 80; }
    } catch (e) { console.warn('Failed to load profile:', e); }
}

// ============================================
// ОСНОВНОЙ ЭКРАН
// ============================================
async function showPracticesScreen() {
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    const container = document.getElementById('screenContainer');
    if (!container) return;
    await loadUserProfileForPractices();
    _renderPractices(container);
}

function _renderPractices(container) {
    const TABS = [
        { id:'neurotracker', label:'🧬 НЕЙРО' },
        { id:'minigames',    label:'🎮 ИГРЫ'  },
        { id:'visual',       label:'🌌 ВИЗУАЛ'},
        { id:'generate',     label:'✨ AI'    },
        { id:'esoteric',     label:'🔮 ЭЗОТЕРИКА' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="prc-tab${practicesState.activeTab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (practicesState.activeTab === 'neurotracker') body = _renderNeuro();
    if (practicesState.activeTab === 'minigames')    body = _renderGames();
    if (practicesState.activeTab === 'visual')       body = _renderVisual();
    if (practicesState.activeTab === 'generate')     body = _renderAI();

    container.innerHTML = `
        <div class="full-content-page" id="practicesScreen">
            <button class="back-btn" id="prcBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🧬</div>
                <h1>Практики 2.0</h1>
                <div style="font-size:12px;color:var(--text-secondary)">Нейро-инструменты для изменения реальности</div>
            </div>
            <div class="prc-tabs">${tabsHtml}</div>
            <div id="prcBody">${body}</div>
        </div>`;

    addPracticesStyles();

    document.getElementById('prcBack').onclick = () => goBackToDashboard();
    document.querySelectorAll('.prc-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'esoteric') {
                const launch = () => { if (typeof showEsotericaScreen === 'function') showEsotericaScreen(); };
                if (typeof showEsotericaScreen === 'function') { launch(); return; }
                const s = document.createElement('script');
                s.src = 'esoterica.js';
                s.onload = launch;
                s.onerror = () => { if (typeof showToast==='function') showToast('Не удалось загрузить модуль','error'); };
                document.head.appendChild(s);
                return;
            }
            practicesState.activeTab = btn.dataset.tab;
            _renderPractices(container);
        });
    });
    _bindHandlers(container);
}

// ============================================
// НЕЙРО-ТРЕКЕР
// ============================================
function _renderNeuro() {
    const biasesHtml = Object.entries(BIASES).map(([key, bias]) => {
        const level = practicesState.cognitiveBiases[key] || 50;
        return `
        <div class="prc-bias-item">
            <div class="prc-bias-header">
                <span class="prc-bias-name" style="color:${bias.color}">● ${bias.name}</span>
                <span class="prc-bias-pct">${level}%</span>
            </div>
            <div class="prc-bias-bar"><div class="prc-bias-fill" style="width:${level}%;background:${bias.color}"></div></div>
            <div class="prc-bias-desc">${bias.description}</div>
        </div>`;
    }).join('');

    return `
        <div class="prc-section-label">🔬 КОГНИТИВНЫЙ ПРОФИЛЬ</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px">Твои мыслительные паттерны</div>
        ${biasesHtml}
        <button id="prcResetBiases" class="prc-btn-primary" style="margin-top:6px">🧠 ПЕРЕЗАГРУЗИТЬ МОЗГ</button>
        <div class="prc-tip" style="margin-top:12px">
            💡 <strong>Нейропластичность:</strong> каждый раз, когда ты замечаешь искажение и выбираешь другую мысль, создаётся новая нейронная связь.
        </div>`;
}

// ============================================
// МИНИ-ИГРЫ
// ============================================
function _renderGames() {
    const games = [
        { id:'focus',       emoji:'🎯', title:'Поймай мысль',      desc:'Тренировка фокуса — поймай убегающую мысль и верни её в настоящее', diff:'⚡ средняя' },
        { id:'perspective', emoji:'🔄', title:'Смени перспективу', desc:'Тренировка гибкости — найди 3 альтернативных объяснения ситуации',   diff:'🧠 высокая' },
        { id:'breathing',   emoji:'🌊', title:'Дыши с ритмом',     desc:'Тренировка спокойствия — синхронизируй дыхание с пульсирующим кругом',diff:'🍃 лёгкая'  }
    ];
    return games.map(g => `
        <div class="prc-game-card">
            <div class="prc-game-emoji">${g.emoji}</div>
            <div class="prc-game-title">${g.title}</div>
            <div class="prc-game-desc">${g.desc}</div>
            <div class="prc-game-diff">${g.diff}</div>
            <button class="prc-game-btn" data-game="${g.id}">▶️ ИГРАТЬ</button>
        </div>`).join('');
}

// ============================================
// ВИЗУАЛЬНАЯ МЕДИТАЦИЯ
// ============================================
function _renderVisual() {
    return `
        <canvas id="prcCanvas" style="width:100%;height:260px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:18px;display:block"></canvas>
        <div class="prc-presets">
            <button class="prc-preset active" data-mode="calm">🌊 Спокойствие</button>
            <button class="prc-preset" data-mode="energy">⚡ Энергия</button>
            <button class="prc-preset" data-mode="focus">🎯 Фокус</button>
            <button class="prc-preset" data-mode="sleep">🌙 Сон</button>
        </div>
        <button id="prcMedStart" class="prc-btn-primary">🌀 ЗАПУСТИТЬ ВИЗУАЛИЗАЦИЮ</button>
        <button id="prcMedStop"  class="prc-btn-ghost"   style="display:none;width:100%;border-radius:40px;padding:13px;margin-top:8px">⏹️ ОСТАНОВИТЬ</button>
        <div class="prc-tip" style="margin-top:12px">🧠 <strong>Нейро-визуализация:</strong> представь, что ты внутри этого пространства. Дыши в ритме пульсации.</div>`;
}

// ============================================
// AI-ГЕНЕРАЦИЯ
// ============================================
function _renderAI() {
    return `
        <div class="prc-ai-header">
            <div style="font-size:40px;margin-bottom:8px">✨</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">Нейросеть создаст практику под тебя</div>
            <div style="font-size:12px;color:var(--text-secondary)">Опиши, что ты хочешь изменить или что тебя беспокоит</div>
        </div>
        <textarea id="prcAiInput" class="prc-textarea"
            placeholder="Пример: «Хочу перестать тревожиться перед важными звонками»" rows="3"></textarea>
        <button id="prcAiGen" class="prc-btn-primary">✨ СОЗДАТЬ ПРАКТИКУ</button>
        <div id="prcAiResult" style="display:none;margin-top:16px"></div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
let _animId = null;
let _medMode = 'calm';

function _bindHandlers(container) {
    // Нейро-трекер
    document.getElementById('prcResetBiases')?.addEventListener('click', () => {
        const btn = document.getElementById('prcResetBiases');
        btn.textContent = '🌀 ПЕРЕЗАГРУЖАЮ...'; btn.disabled = true;
        setTimeout(() => {
            for (const key of Object.keys(practicesState.cognitiveBiases)) {
                const r = Math.floor(Math.random() * 20) + 5;
                practicesState.cognitiveBiases[key] = Math.max(20, practicesState.cognitiveBiases[key] - r);
            }
            _renderPractices(container);
            showToastMessage('🧠 Нейро-профиль обновлён! Искажения снижены.', 'success');
        }, 1500);
    });

    // Игры
    document.querySelectorAll('.prc-game-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msgs = { focus:'🎯 "Поймай мысль"', perspective:'🔄 "Смени перспективу"', breathing:'🌊 "Дыши с ритмом"' };
            showToastMessage(`${msgs[btn.dataset.game] || 'Игра'} — скоро будет доступна`, 'info');
        });
    });

    // Пресеты медитации
    document.querySelectorAll('.prc-preset').forEach(p => {
        p.addEventListener('click', () => {
            _medMode = p.dataset.mode;
            document.querySelectorAll('.prc-preset').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
        });
    });

    // Старт медитации
    document.getElementById('prcMedStart')?.addEventListener('click', () => {
        const canvas = document.getElementById('prcCanvas');
        if (!canvas) return;
        canvas.width  = canvas.clientWidth;
        canvas.height = 260;
        const ctx = canvas.getContext('2d');
        practicesState.meditationActive = true;
        document.getElementById('prcMedStart').style.display = 'none';
        document.getElementById('prcMedStop').style.display  = 'block';

        let t = 0;
        function draw() {
            if (!practicesState.meditationActive) return;
            t += 0.02;
            const w = canvas.width, h = canvas.height, cx = w/2, cy = h/2;
            ctx.clearRect(0, 0, w, h);

            const hueMap = { calm: 200 + Math.sin(t*0.5)*10, energy: 30 + Math.sin(t*2)*20, focus: 270 + Math.sin(t)*20, sleep: 250 + Math.sin(t*0.3)*10 };
            const rMap   = { calm: 50+Math.sin(t)*30, energy: 50+Math.sin(t*2)*40, focus: 50+Math.sin(t)*25, sleep: 30+Math.sin(t*0.5)*15 };
            const hue = hueMap[_medMode] || 200;
            const r   = rMap[_medMode]   || 50;

            const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
            g.addColorStop(0, `hsla(${hue},100%,60%,0.8)`);
            g.addColorStop(0.5, `hsla(${hue},100%,50%,0.5)`);
            g.addColorStop(1, `hsla(${hue},100%,40%,0.15)`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
            ctx.fillStyle = `hsla(${hue},100%,60%,0.3)`; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, cy, r*0.6, 0, Math.PI*2);
            ctx.fillStyle = `hsla(${hue},100%,70%,0.5)`; ctx.fill();

            for (let i = 0; i < 20; i++) {
                const a = (i/20)*Math.PI*2 + t;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a)*(r+10), cy + Math.sin(a)*(r+10), 3, 0, Math.PI*2);
                ctx.fillStyle = `hsla(${hue+20},100%,70%,0.6)`; ctx.fill();
            }
            _animId = requestAnimationFrame(draw);
        }
        if (_animId) cancelAnimationFrame(_animId);
        draw();
    });

    // Стоп медитации
    document.getElementById('prcMedStop')?.addEventListener('click', () => {
        practicesState.meditationActive = false;
        if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
        const canvas = document.getElementById('prcCanvas');
        if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='rgba(26,26,46,1)'; ctx.fillRect(0,0,canvas.width,canvas.height); }
        document.getElementById('prcMedStart').style.display = 'block';
        document.getElementById('prcMedStop').style.display  = 'none';
        showToastMessage('🧘 Медитация завершена. Как ты себя чувствуешь?', 'success');
    });

    // AI-генерация
    document.getElementById('prcAiGen')?.addEventListener('click', async () => {
        const prompt = document.getElementById('prcAiInput')?.value.trim();
        if (!prompt) { showToastMessage('📝 Опиши, что ты хочешь изменить', 'warning'); return; }

        const btn = document.getElementById('prcAiGen');
        btn.textContent = '✨ ГЕНЕРИРУЮ...'; btn.disabled = true;

        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const v = practicesState.userVectors;

        let practiceHtml = '';
        try {
            const r = await fetch(`${apiUrl}/api/ai/generate`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    user_id: userId,
                    prompt: `Ты — Фреди, психолог. Пользователь ${practicesState.userName} хочет: "${prompt}".
Профиль: СБ-${v.СБ}, ТФ-${v.ТФ}, УБ-${v.УБ}, ЧВ-${v.ЧВ}.

Создай одну короткую практику. JSON:
{"title":"...","duration":"...","steps":["шаг1","шаг2","шаг3"],"result":"что изменится"}

Только JSON.`,
                    max_tokens: 400, temperature: 0.7
                })
            });
            const d = await r.json();
            if (d.success && d.content) {
                const p = JSON.parse(d.content.replace(/```json\n?/g,'').replace(/```\n?/g,''));
                practiceHtml = `
                    <div class="prc-generated">
                        <div style="font-size:13px;font-weight:700;color:var(--chrome);margin-bottom:8px">✨ ${p.title}</div>
                        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">⏱️ ${p.duration}</div>
                        ${p.steps.map((s,i)=>`<div style="font-size:13px;color:var(--text-secondary);padding:4px 0">*${i+1}.* ${s}</div>`).join('')}
                        <div style="font-size:12px;color:var(--chrome);margin-top:10px;padding-top:10px;border-top:1px solid rgba(224,224,224,0.1)">🎯 ${p.result}</div>
                    </div>`;
            }
        } catch {}

        if (!practiceHtml) {
            const practices = ['3 глубоких вдоха, представляя, как стресс выходит с выдохом','минутный перерыв и посмотреть в окно, замечая детали','записать 3 вещи, за которые ты благодарен сегодня'];
            practiceHtml = `
                <div class="prc-generated">
                    <div style="font-size:14px;font-weight:600;margin-bottom:10px">✨ Твоя практика</div>
                    <div style="font-size:13px;color:var(--text-secondary)">Сделай: ${practices[Math.floor(Math.random()*practices.length)]}</div>
                </div>`;
        }

        const res = document.getElementById('prcAiResult');
        if (res) { res.style.display = 'block'; res.innerHTML = practiceHtml; }
        btn.textContent = '✨ СОЗДАТЬ ПРАКТИКУ'; btn.disabled = false;
    });
}

// ============================================
// СТИЛИ
// ============================================
function addPracticesStyles() {
    if (document.getElementById('practices-styles')) return;
    const style = document.createElement('style');
    style.id = 'practices-styles';
    style.textContent = `
        .prc-tabs {
            display:flex;gap:4px;background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);
            border-radius:40px;padding:4px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none;
        }
        .prc-tabs::-webkit-scrollbar{display:none}
        .prc-tab {
            flex-shrink:0;padding:8px 12px;border-radius:30px;border:none;
            background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;
            font-family:inherit;cursor:pointer;transition:background 0.2s;min-height:36px;white-space:nowrap;
        }
        .prc-tab.active{background:rgba(224,224,224,0.14);color:var(--text-primary)}

        .prc-bias-item{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:14px;padding:12px;margin-bottom:8px}
        .prc-bias-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
        .prc-bias-name{font-size:12px;font-weight:600}
        .prc-bias-pct{font-size:12px;color:var(--text-secondary)}
        .prc-bias-bar{height:5px;background:rgba(224,224,224,0.1);border-radius:3px;overflow:hidden;margin-bottom:5px}
        .prc-bias-fill{height:100%;border-radius:3px;transition:width 0.6s ease}
        .prc-bias-desc{font-size:10px;color:var(--text-secondary)}

        .prc-game-card{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.1);border-radius:20px;padding:20px;text-align:center;margin-bottom:12px}
        .prc-game-emoji{font-size:44px;margin-bottom:8px}
        .prc-game-title{font-size:17px;font-weight:700;margin-bottom:6px}
        .prc-game-desc{font-size:12px;color:var(--text-secondary);margin-bottom:6px;line-height:1.5}
        .prc-game-diff{font-size:11px;color:var(--text-secondary);margin-bottom:10px}
        .prc-game-btn{padding:9px 20px;background:rgba(224,224,224,0.1);border:1px solid rgba(224,224,224,0.2);border-radius:50px;color:var(--text-primary);cursor:pointer;font-family:inherit;font-size:12px}

        .prc-presets{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap}
        .prc-preset{flex:1;min-width:70px;padding:8px 6px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.12);border-radius:30px;color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;transition:background 0.2s;white-space:nowrap}
        .prc-preset.active{background:rgba(224,224,224,0.16);border-color:rgba(224,224,224,0.3);color:var(--text-primary)}

        .prc-btn-primary{width:100%;padding:13px;background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);border-radius:40px;color:var(--text-primary);font-weight:600;cursor:pointer;font-family:inherit;font-size:13px}
        .prc-btn-primary:disabled{opacity:0.4;cursor:not-allowed}
        .prc-btn-ghost{background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.14);color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:13px;font-weight:500}

        .prc-ai-header{text-align:center;padding:16px 0 12px;color:var(--text-primary)}
        .prc-textarea{width:100%;background:rgba(224,224,224,0.08);border:1px solid rgba(224,224,224,0.2);border-radius:14px;padding:12px 14px;color:var(--text-primary);font-size:14px;resize:vertical;font-family:inherit;margin:12px 0;box-sizing:border-box;min-height:80px;line-height:1.6}
        .prc-textarea::placeholder{color:var(--text-secondary)}
        .prc-textarea:focus{outline:none;border-color:rgba(224,224,224,0.35)}

        .prc-generated{background:rgba(224,224,224,0.06);border:1px solid rgba(224,224,224,0.15);border-radius:16px;padding:16px}

        .prc-section-label{font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px}
        .prc-tip{background:rgba(224,224,224,0.03);border:1px solid rgba(224,224,224,0.08);border-radius:14px;padding:12px 14px;font-size:12px;color:var(--text-secondary);line-height:1.5}
        .prc-tip strong{color:var(--chrome)}
    `;
    document.head.appendChild(style);
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showPracticesScreen = showPracticesScreen;
console.log('✅ Модуль "Практики 2.0" загружен (practices.js v2.0)');
