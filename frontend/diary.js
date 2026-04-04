// ============================================
// diary.js — Дневник с AI-рефлексией
// Версия 1.0
// ============================================

function _dyInjectStyles() {
    if (document.getElementById('dy-v1-styles')) return;
    const s = document.createElement('style');
    s.id = 'dy-v1-styles';
    s.textContent = `
        .dy-tabs {
            display: flex; gap: 4px;
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 40px; padding: 4px; margin-bottom: 20px;
        }
        .dy-tab {
            flex: 1; padding: 8px 14px; border-radius: 30px; border: none;
            background: transparent; color: var(--text-secondary);
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background 0.2s, color 0.2s; min-height: 36px; touch-action: manipulation;
        }
        .dy-tab.active { background: rgba(224,224,224,0.14); color: var(--text-primary); }

        /* Форма записи */
        .dy-form {
            background: rgba(224,224,224,0.04);
            border: 1px solid rgba(224,224,224,0.12);
            border-radius: 18px; padding: 16px; margin-bottom: 16px;
        }
        .dy-form-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 500; }
        .dy-textarea {
            width: 100%; background: rgba(224,224,224,0.07);
            border: 1px solid rgba(224,224,224,0.18); border-radius: 12px;
            padding: 12px 14px; color: var(--text-primary); font-family: inherit;
            font-size: 15px; outline: none; resize: none; box-sizing: border-box;
            -webkit-appearance: none; min-height: 100px; line-height: 1.6;
        }
        .dy-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .dy-textarea::placeholder { color: var(--text-secondary); }

        /* Запись + ответ */
        .dy-entry {
            margin-bottom: 16px;
        }
        .dy-entry-bubble {
            background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.12);
            border-radius: 16px 16px 4px 16px; padding: 14px 16px; margin-bottom: 8px;
        }
        .dy-entry-meta {
            font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;
        }
        .dy-entry-text { font-size: 14px; color: var(--text-primary); line-height: 1.65; white-space: pre-wrap; }

        .dy-reply-bubble {
            background: rgba(192,192,192,0.06); border: 1px solid rgba(192,192,192,0.15);
            border-radius: 4px 16px 16px 16px; padding: 14px 16px; margin-left: 16px;
        }
        .dy-reply-from { font-size: 10px; color: var(--chrome); font-weight: 700; margin-bottom: 6px; }
        .dy-reply-text { font-size: 14px; color: var(--text-secondary); line-height: 1.65; }

        .dy-reply-loading {
            display: flex; align-items: center; gap: 8px;
            font-size: 13px; color: var(--text-secondary);
            background: rgba(192,192,192,0.06); border: 1px solid rgba(192,192,192,0.12);
            border-radius: 4px 16px 16px 16px; padding: 12px 16px; margin-left: 16px;
        }
        .dy-dots span {
            display: inline-block; width: 5px; height: 5px; border-radius: 50%;
            background: var(--text-secondary); animation: dy-blink 1.2s ease-in-out infinite;
        }
        .dy-dots span:nth-child(2) { animation-delay: 0.2s; }
        .dy-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dy-blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }

        /* Паттерны */
        .dy-pattern-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.07), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.2); border-radius: 18px; padding: 18px;
            margin-bottom: 12px;
        }
        .dy-pattern-title { font-size: 14px; font-weight: 700; color: var(--chrome); margin-bottom: 8px; }
        .dy-pattern-text  { font-size: 13px; color: var(--text-secondary); line-height: 1.65; }

        .dy-empty { text-align: center; padding: 40px 20px; }
        .dy-empty-icon  { font-size: 44px; display: block; margin-bottom: 12px; }
        .dy-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .dy-empty-desc  { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

        .dy-btn {
            padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500;
            font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s;
            min-height: 42px; touch-action: manipulation; outline: none;
        }
        .dy-btn:active { transform: scale(0.97); }
        .dy-btn-primary {
            background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1));
            border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary);
            width: 100%; border-radius: 40px; padding: 13px;
        }
        .dy-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .dy-btn-ghost {
            background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14);
            color: var(--text-secondary);
        }
        .dy-section-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px;
        }
        .dy-tip {
            background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08);
            border-radius: 14px; padding: 12px 14px; font-size: 12px;
            color: var(--text-secondary); line-height: 1.5; margin-top: 12px;
        }
        .dy-tip strong { color: var(--chrome); }
    `;
    document.head.appendChild(s);
}

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._dyState) window._dyState = { tab: 'write', sending: false };
const _dy = window._dyState;

// ============================================
// УТИЛИТЫ
// ============================================
function _dyToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _dyHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _dyApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _dyUid()   { return window.CONFIG?.USER_ID; }
function _dyName()  { return localStorage.getItem('fredi_user_name') || 'друг'; }

function _dySaveEntry(entry) {
    try {
        const key = 'diary_entries_'+_dyUid();
        const arr = _dyLoadEntries();
        arr.unshift(entry);
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 100)));
    } catch {}
}

function _dyLoadEntries() {
    try {
        const raw = localStorage.getItem('diary_entries_'+_dyUid());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function _dyFormatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) + ' · ' +
           d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

// ============================================
// РЕНДЕР
// ============================================
function _dyRender() {
    _dyInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    const TABS = [
        { id:'write',    label:'✏️ Запись' },
        { id:'history',  label:'📖 История' },
        { id:'patterns', label:'🔍 Паттерны' }
    ];
    const tabsHtml = TABS.map(t =>
        `<button class="dy-tab${_dy.tab===t.id?' active':''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    let body = '';
    if (_dy.tab === 'write')    body = _dyWrite();
    if (_dy.tab === 'history')  body = _dyHistory();
    if (_dy.tab === 'patterns') body = _dyPatterns();

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="dyBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">📓</div>
                <h1 class="content-title">Дневник</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Пишите — Фреди отвечает как психолог</p>
            </div>
            <div class="dy-tabs">${tabsHtml}</div>
            <div id="dyBody">${body}</div>
        </div>`;

    document.getElementById('dyBack').onclick = () => _dyHome();
    document.querySelectorAll('.dy-tab').forEach(btn => {
        btn.addEventListener('click', () => { _dy.tab = btn.dataset.tab; _dyRender(); });
    });
    _dyBindHandlers();
}

// ===== ЗАПИСЬ =====
function _dyWrite() {
    return `
        <div class="dy-form">
            <div class="dy-form-label">Что происходит? Что чувствуете? О чём думаете?</div>
            <textarea class="dy-textarea" id="dyInput" rows="5"
                placeholder="Сегодня я чувствую..."></textarea>
        </div>
        <button class="dy-btn dy-btn-primary" id="dySendBtn"${_dy.sending?' disabled':''}>
            ${_dy.sending ? '⏳ Фреди отвечает...' : '📩 Отправить Фреди'}
        </button>
        <div class="dy-tip" style="margin-top:12px">
            💡 Пишите честно и без цензуры. Фреди не осуждает — он замечает, отражает и задаёт вопросы.
        </div>`;
}

// ===== ИСТОРИЯ =====
function _dyHistory() {
    const entries = _dyLoadEntries();
    if (!entries.length) return `
        <div class="dy-empty">
            <span class="dy-empty-icon">📓</span>
            <div class="dy-empty-title">Дневник пуст</div>
            <div class="dy-empty-desc">Напишите первую запись — Фреди ответит как психолог</div>
        </div>`;

    const html = entries.map(e => `
        <div class="dy-entry">
            <div class="dy-entry-bubble">
                <div class="dy-entry-meta">${_dyFormatDate(e.date)}</div>
                <div class="dy-entry-text">${e.text}</div>
            </div>
            ${e.reply ? `
            <div class="dy-reply-bubble">
                <div class="dy-reply-from">🔮 Фреди</div>
                <div class="dy-reply-text">${e.reply}</div>
            </div>` : ''}
        </div>`).join('');

    return `
        <div class="dy-section-label">Записей: ${entries.length}</div>
        ${html}`;
}

// ===== ПАТТЕРНЫ =====
function _dyPatterns() {
    const entries = _dyLoadEntries();
    if (entries.length < 3) return `
        <div class="dy-empty">
            <span class="dy-empty-icon">🔍</span>
            <div class="dy-empty-title">Нужно больше записей</div>
            <div class="dy-empty-desc">Фреди начнёт замечать паттерны после 3-5 записей. У вас ${entries.length} из 3.</div>
        </div>`;

    const saved = localStorage.getItem('diary_patterns_'+_dyUid());
    if (saved) {
        const p = JSON.parse(saved);
        return `
            <div class="dy-section-label">Анализ ${entries.length} записей</div>
            ${p.patterns.map(pt => `
            <div class="dy-pattern-card">
                <div class="dy-pattern-title">${pt.title}</div>
                <div class="dy-pattern-text">${pt.text}</div>
            </div>`).join('')}
            <div style="margin-top:14px;display:flex;gap:10px">
                <button class="dy-btn dy-btn-ghost" id="dyRefreshPatterns">🔄 Обновить анализ</button>
            </div>`;
    }

    return `
        <div class="dy-empty">
            <span class="dy-empty-icon">🔍</span>
            <div class="dy-empty-title">Паттерны не проанализированы</div>
            <div class="dy-empty-desc">Фреди изучит ваши записи и найдёт повторяющиеся темы, эмоции и паттерны мышления</div>
            <div style="margin-top:16px">
                <button class="dy-btn dy-btn-primary" id="dyAnalyzeBtn">🔍 Проанализировать</button>
            </div>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _dyBindHandlers() {

    // Отправить запись
    document.getElementById('dySendBtn')?.addEventListener('click', async () => {
        const text = (document.getElementById('dyInput')?.value || '').trim();
        if (!text) { _dyToast('Напишите что-нибудь', 'error'); return; }
        if (_dy.sending) return;

        _dy.sending = true;
        _dyRender();

        // Переключаемся на историю и показываем loading
        const entry = { date: new Date().toISOString(), text, reply: null };
        _dySaveEntry(entry);
        _dy.tab = 'history';
        _dyRender();

        // Добавляем индикатор загрузки в первую запись
        const firstBubble = document.querySelector('.dy-entry');
        if (firstBubble) {
            const loading = document.createElement('div');
            loading.className = 'dy-reply-loading';
            loading.innerHTML = `<span>🔮 Фреди думает</span><div class="dy-dots"><span></span><span></span><span></span></div>`;
            firstBubble.appendChild(loading);
        }

        try {
            const entries = _dyLoadEntries();
            const context = entries.slice(0, 5).reverse().map((e,i) =>
                `Запись ${i+1}: "${e.text.slice(0,200)}"`
            ).join('\n');

            const isPattern = entries.length >= 3;

            const prompt = `Ты — Фреди, психолог-ассистент. Пользователь ведёт личный дневник.

Имя: ${_dyName()}
Последние записи:
${context}

НОВАЯ ЗАПИСЬ:
"${text}"

Твоя задача — ответить как хороший психолог:
— Отрази что услышал (не пересказывай дословно)
— Замечай эмоцию под словами, а не только слова
— Задай ОДИН уточняющий вопрос который помогает копнуть глубже
— Если видишь паттерн (повторяющуюся тему), мягко его назови
— Не давай советов, не оценивай, не утешай банально

${isPattern ? 'Обрати внимание на повторяющиеся темы в нескольких записях.' : ''}

Длина ответа: 3-5 предложений. Тёплый, без психологического жаргона.`;

            const r = await fetch(`${_dyApi()}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: _dyUid(), prompt, max_tokens: 400 })
            });
            const d = await r.json();

            if (d.success && d.content) {
                // Обновляем первую запись (она же новая)
                const arr = _dyLoadEntries();
                arr[0].reply = d.content.trim();
                localStorage.setItem('diary_entries_'+_dyUid(), JSON.stringify(arr));
            }
        } catch(e) { console.error('Diary reply error:', e); }

        _dy.sending = false;
        _dyRender();
    });

    // Анализ паттернов
    document.getElementById('dyAnalyzeBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('dyAnalyzeBtn');
        if (btn) { btn.textContent = '⏳ Анализирую...'; btn.disabled = true; }

        const entries = _dyLoadEntries();
        const allText = entries.slice(0, 20).map((e,i) =>
            `[Запись ${i+1}, ${new Date(e.date).toLocaleDateString('ru-RU')}]: ${e.text}`
        ).join('\n\n');

        try {
            const r = await fetch(`${_dyApi()}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: _dyUid(),
                    prompt: `Ты — психолог. Проанализируй дневниковые записи пользователя ${_dyName()} и найди паттерны.

ЗАПИСИ:
${allText}

Найди 3-4 паттерна: повторяющиеся темы, эмоции, установки, способы реагирования.

Верни только JSON:
{
  "patterns": [
    { "title": "название паттерна", "text": "описание что замечено, без советов, как наблюдение" },
    ...
  ]
}`,
                    max_tokens: 800
                })
            });
            const d = await r.json();
            if (d.success && d.content) {
                const clean = d.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
                const parsed = JSON.parse(clean);
                localStorage.setItem('diary_patterns_'+_dyUid(), JSON.stringify(parsed));
                _dyToast('✅ Анализ готов', 'success');
                _dyRender();
                return;
            }
        } catch(e) { console.error('Pattern analysis error:', e); }

        _dyToast('Не удалось проанализировать. Попробуйте позже.', 'error');
        if (btn) { btn.textContent = '🔍 Проанализировать'; btn.disabled = false; }
    });

    // Обновить анализ
    document.getElementById('dyRefreshPatterns')?.addEventListener('click', () => {
        localStorage.removeItem('diary_patterns_'+_dyUid());
        _dyRender();
        setTimeout(() => document.getElementById('dyAnalyzeBtn')?.click(), 100);
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showDiaryScreen() {
    _dy.tab = 'write';
    _dyRender();
}

window.showDiaryScreen = showDiaryScreen;
console.log('✅ diary.js v1.0 загружен');
