// ============================================
// diary.js — Дневник с AI-рефлексией
// Версия 2.0 — AI анализирует несколько записей
// ============================================

function _dyInjectStyles() {
    if (document.getElementById('dy-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'dy-v2-styles';
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
            -webkit-appearance: none; min-height: 110px; line-height: 1.65;
        }
        .dy-textarea:focus { border-color: rgba(224,224,224,0.35); }
        .dy-textarea::placeholder { color: var(--text-secondary); }

        .dy-counter {
            text-align: right; font-size: 11px; color: var(--text-secondary);
            margin-top: 6px;
        }

        /* Записи */
        .dy-entry {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 14px 16px; margin-bottom: 10px;
        }
        .dy-entry-meta { font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; }
        .dy-entry-text { font-size: 14px; color: var(--text-primary); line-height: 1.65; white-space: pre-wrap; }

        /* AI-инсайт */
        .dy-insight-card {
            background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02));
            border: 1px solid rgba(224,224,224,0.22); border-radius: 18px; padding: 18px;
            margin-bottom: 16px;
        }
        .dy-insight-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .dy-insight-icon   { font-size: 24px; }
        .dy-insight-title  { font-size: 14px; font-weight: 700; color: var(--chrome); }
        .dy-insight-sub    { font-size: 11px; color: var(--text-secondary); }
        .dy-insight-text   { font-size: 14px; color: var(--text-secondary); line-height: 1.7; }

        .dy-pattern-block  { margin-top: 14px; }
        .dy-pattern-item {
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 12px; padding: 12px 14px; margin-bottom: 8px;
        }
        .dy-pattern-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .dy-pattern-text  { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

        /* Прогресс-бар записей */
        .dy-progress-strip {
            display: flex; gap: 4px; margin-bottom: 16px;
        }
        .dy-progress-dot {
            flex: 1; height: 4px; border-radius: 2px;
            background: rgba(224,224,224,0.1);
        }
        .dy-progress-dot.filled { background: var(--chrome); }

        .dy-generating {
            display: flex; align-items: center; gap: 10px;
            background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1);
            border-radius: 16px; padding: 16px; margin-bottom: 16px;
            font-size: 13px; color: var(--text-secondary);
        }
        .dy-dots span {
            display: inline-block; width: 5px; height: 5px; border-radius: 50%;
            background: var(--text-secondary); animation: dy-blink 1.2s ease-in-out infinite;
            margin-left: 2px;
        }
        .dy-dots span:nth-child(2) { animation-delay: 0.2s; }
        .dy-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dy-blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }

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
        .dy-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
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
if (!window._dyState) window._dyState = {
    tab: 'write',
    analyzing: false
};
const _dy = window._dyState;

// ============================================
// УТИЛИТЫ
// ============================================
function _dyToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _dyHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _dyApi()   { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _dyUid()   { return window.CONFIG?.USER_ID; }
function _dyName()  { return localStorage.getItem('fredi_user_name') || 'друг'; }

function _dyLoadEntries() {
    try { return JSON.parse(localStorage.getItem('diary_entries_'+_dyUid()) || '[]'); } catch { return []; }
}
function _dySaveEntries(arr) {
    try { localStorage.setItem('diary_entries_'+_dyUid(), JSON.stringify(arr.slice(0, 100))); } catch {}
}
function _dyLoadInsight() {
    try { return JSON.parse(localStorage.getItem('diary_insight_'+_dyUid()) || 'null'); } catch { return null; }
}
function _dySaveInsight(obj) {
    try { localStorage.setItem('diary_insight_'+_dyUid(), JSON.stringify(obj)); } catch {}
}
function _dyFormatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) +
           ' · ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
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
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Пишите — Фреди находит паттерны</p>
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
    const entries = _dyLoadEntries();
    const count = entries.length;
    const nextAnalysis = count < 3 ? 3 : count < 5 ? 5 : count + 5;
    const toNext = nextAnalysis - count;

    const dotsHtml = Array.from({length: Math.min(count, 10)}, (_, i) =>
        `<div class="dy-progress-dot filled"></div>`
    ).join('') + (count < 10
        ? `<div class="dy-progress-dot"></div>`.repeat(10 - count)
        : '');

    return `
        <div class="dy-form">
            <div class="dy-form-label">Что происходит? Что чувствуете? Что думаете?</div>
            <textarea class="dy-textarea" id="dyInput"
                placeholder="Сегодня я думаю о том, что..."></textarea>
            <div class="dy-counter" id="dyCounter">0 символов</div>
        </div>
        <button class="dy-btn dy-btn-primary" id="dySaveBtn">💾 Сохранить запись</button>

        ${count > 0 ? `
        <div style="margin-top:20px">
            <div class="dy-section-label">Накоплено записей: ${count}</div>
            <div class="dy-progress-strip">${dotsHtml}</div>
            ${toNext > 0
                ? `<div style="font-size:12px;color:var(--text-secondary)">Ещё ${toNext} ${toNext===1?'запись':'записи'} — и Фреди даст новый инсайт</div>`
                : `<div style="font-size:12px;color:var(--chrome)">✨ Готово к анализу — перейдите в Паттерны</div>`
            }
        </div>` : ''}

        <div class="dy-tip" style="margin-top:14px">
            💡 <strong>Как писать:</strong> без цензуры, без структуры. Пишите поток мысли — чем честнее, тем точнее будет инсайт Фреди.
        </div>`;
}

// ===== ИСТОРИЯ =====
function _dyHistory() {
    const entries = _dyLoadEntries();
    if (!entries.length) return `
        <div class="dy-empty">
            <span class="dy-empty-icon">📓</span>
            <div class="dy-empty-title">Записей пока нет</div>
            <div class="dy-empty-desc">Напишите первую запись во вкладке «Запись»</div>
        </div>`;

    const html = entries.map(e => `
        <div class="dy-entry">
            <div class="dy-entry-meta">${_dyFormatDate(e.date)}</div>
            <div class="dy-entry-text">${e.text}</div>
        </div>`).join('');

    return `
        <div class="dy-section-label">Записей: ${entries.length}</div>
        ${html}
        <div style="margin-top:12px;text-align:center">
            <button class="dy-btn dy-btn-ghost" id="dyClearBtn" style="font-size:12px;padding:9px 16px">
                🗑 Очистить дневник
            </button>
        </div>`;
}

// ===== ПАТТЕРНЫ =====
function _dyPatterns() {
    const entries = _dyLoadEntries();
    const insight = _dyLoadInsight();

    if (!entries.length) return `
        <div class="dy-empty">
            <span class="dy-empty-icon">🔍</span>
            <div class="dy-empty-title">Нет записей</div>
            <div class="dy-empty-desc">Для анализа нужно минимум 3 записи в дневнике</div>
        </div>`;

    if (entries.length < 3) return `
        <div class="dy-empty">
            <span class="dy-empty-icon">🔍</span>
            <div class="dy-empty-title">Нужно больше записей</div>
            <div class="dy-empty-desc">Фреди начнёт видеть паттерны после 3 записей.<br>У вас ${entries.length} из 3.</div>
        </div>`;

    if (_dy.analyzing) return `
        <div class="dy-generating">
            <span>🔮 Фреди анализирует ваши записи</span>
            <div class="dy-dots"><span></span><span></span><span></span></div>
        </div>`;

    if (insight) {
        const patternsHtml = (insight.patterns || []).map(p => `
            <div class="dy-pattern-item">
                <div class="dy-pattern-title">${p.title}</div>
                <div class="dy-pattern-text">${p.text}</div>
            </div>`).join('');

        return `
            <div class="dy-insight-card">
                <div class="dy-insight-header">
                    <span class="dy-insight-icon">🔮</span>
                    <div>
                        <div class="dy-insight-title">Инсайт Фреди</div>
                        <div class="dy-insight-sub">На основе ${insight.entryCount} записей · ${new Date(insight.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                </div>
                <div class="dy-insight-text">${insight.summary}</div>
                ${patternsHtml ? `
                <div class="dy-pattern-block">
                    <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px">Замеченные паттерны</div>
                    ${patternsHtml}
                </div>` : ''}
            </div>

            <div style="display:flex;gap:10px">
                <button class="dy-btn dy-btn-ghost" id="dyRefreshBtn">🔄 Обновить анализ</button>
            </div>

            <div class="dy-tip" style="margin-top:12px">
                💡 Паттерн — это не приговор, а наблюдение. Осознанность — первый шаг к изменению.
            </div>`;
    }

    return `
        <div style="text-align:center;padding:32px 20px">
            <span style="font-size:48px;display:block;margin-bottom:14px">🔍</span>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">Готово к анализу</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6">
                Фреди прочитает все ваши записи (${entries.length} шт.) и найдёт повторяющиеся темы, эмоции и паттерны мышления
            </div>
            <button class="dy-btn dy-btn-primary" id="dyAnalyzeBtn">🔮 Получить инсайт</button>
        </div>`;
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _dyBindHandlers() {
    const input = document.getElementById('dyInput');
    if (input) {
        input.addEventListener('input', () => {
            const len = input.value.length;
            const counter = document.getElementById('dyCounter');
            if (counter) counter.textContent = `${len} символов`;
        });
    }

    // Сохранить запись
    document.getElementById('dySaveBtn')?.addEventListener('click', () => {
        const text = (document.getElementById('dyInput')?.value || '').trim();
        if (!text) { _dyToast('Напишите что-нибудь', 'error'); return; }
        if (text.length < 10) { _dyToast('Слишком коротко', 'error'); return; }

        const entries = _dyLoadEntries();
        entries.unshift({ date: new Date().toISOString(), text });
        _dySaveEntries(entries);

        // После 3, 5, 10... записей — сбрасываем кэш инсайта
        if ([3,5,10,15,20].includes(entries.length)) {
            _dySaveInsight(null);
        }

        _dyToast('✅ Запись сохранена', 'success');
        document.getElementById('dyInput').value = '';
        _dyRender();
    });

    // Анализ паттернов
    document.getElementById('dyAnalyzeBtn')?.addEventListener('click', () => _dyRunAnalysis());
    document.getElementById('dyRefreshBtn')?.addEventListener('click', () => {
        _dySaveInsight(null);
        _dyRunAnalysis();
    });

    // Очистить
    document.getElementById('dyClearBtn')?.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:320px;width:100%">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Очистить дневник?</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px">Все записи и инсайты будут удалены.</div>
            <div style="display:flex;gap:10px">
                <button id="cfNo"  style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Нет</button>
                <button id="cfYes" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Да</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#cfNo').onclick = () => overlay.remove();
        overlay.querySelector('#cfYes').onclick = () => {
            overlay.remove();
            localStorage.removeItem('diary_entries_'+_dyUid());
            localStorage.removeItem('diary_insight_'+_dyUid());
            _dyToast('Дневник очищен', 'info');
            _dyRender();
        };
    });
}

async function _dyRunAnalysis() {
    _dy.analyzing = true;
    _dy.tab = 'patterns';
    _dyRender();

    const entries = _dyLoadEntries();
    const allText = entries.slice(0, 20).reverse().map((e, i) =>
        `[${i+1}. ${new Date(e.date).toLocaleDateString('ru-RU')}] ${e.text}`
    ).join('\n\n');

    try {
        const r = await fetch(`${_dyApi()}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: _dyUid(),
                prompt: `Ты — Фреди, психолог-ассистент. Проанализируй дневниковые записи пользователя по имени ${_dyName()}.

ЗАПИСИ (от старых к новым):
${allText}

Найди:
1. Общий инсайт — что ты видишь в этих записях как психолог? Что стоит за словами? (3-4 предложения, тепло, без жаргона)
2. 2-4 конкретных паттерна — повторяющиеся темы, эмоции, способы реагирования, убеждения

Верни только JSON без markdown:
{
  "summary": "общий инсайт текстом",
  "patterns": [
    { "title": "название паттерна", "text": "описание что замечено" }
  ]
}`,
                max_tokens: 900
            })
        });
        const d = await r.json();
        if (d.success && d.content) {
            const clean = d.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            const parsed = JSON.parse(clean);
            _dySaveInsight({
                summary: parsed.summary,
                patterns: parsed.patterns || [],
                entryCount: entries.length,
                date: new Date().toISOString()
            });
        }
    } catch(e) {
        console.error('Diary analysis error:', e);
        _dyToast('Не удалось проанализировать. Попробуйте позже.', 'error');
    }

    _dy.analyzing = false;
    _dyRender();
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showDiaryScreen() {
    _dy.tab = 'write';
    _dy.analyzing = false;
    _dyRender();
}

window.showDiaryScreen = showDiaryScreen;
console.log('✅ diary.js v2.0 загружен');
