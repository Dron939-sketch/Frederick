// ============================================
// 🪞 ЗЕРКАЛА / ОТРАЖЕНИЯ
// Версия 1.0
// ============================================

const API_BASE = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

// ============================================
// API ФУНКЦИИ
// ============================================

async function apiCreateMirror(userId, mirrorType) {
    const res = await fetch(`${API_BASE}/api/mirrors/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, mirror_type: mirrorType })
    });
    return await res.json();
}

async function apiGetMirrors(userId) {
    const res = await fetch(`${API_BASE}/api/mirrors/${userId}`);
    return await res.json();
}

async function apiGetReflections(userId) {
    const res = await fetch(`${API_BASE}/api/mirrors/${userId}/reflections`);
    return await res.json();
}

// ============================================
// ЭКРАН ЗЕРКАЛА
// ============================================

async function showMirrorsScreen() {
    const container = document.getElementById('screenContainer');
    const userId = window.USER_ID;

    container.innerHTML = `
        <div style="padding: 20px; max-width: 600px; margin: 0 auto; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
                <span style="font-size:32px;">🪞</span>
                <div>
                    <div style="font-size:20px; font-weight:700; color:#fff;">Зеркало</div>
                    <div style="font-size:13px; color:#888;">Отправь другу — увидь его профиль</div>
                </div>
            </div>

            <!-- ТАБЫ -->
            <div style="display:flex; gap:8px; margin-bottom:24px; background:#111; border-radius:12px; padding:4px;">
                <button onclick="switchMirrorTab('reflections')" id="tab-reflections"
                    style="flex:1; padding:10px; border:none; border-radius:10px; font-size:14px; font-weight:600;
                           background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; cursor:pointer; transition:all 0.2s;">
                    👥 Мои отражения
                </button>
                <button onclick="switchMirrorTab('create')" id="tab-create"
                    style="flex:1; padding:10px; border:none; border-radius:10px; font-size:14px; font-weight:600;
                           background:transparent; color:#888; cursor:pointer; transition:all 0.2s;">
                    🔗 Создать ссылку
                </button>
            </div>

            <!-- КОНТЕНТ ТАБОВ -->
            <div id="mirrorTabContent"></div>
        </div>
    `;

    // Показываем первый таб
    switchMirrorTab('reflections');
}

function switchMirrorTab(tab) {
    // Стили табов
    const tabs = ['reflections', 'create'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            btn.style.background = t === tab ? 'linear-gradient(135deg,#ff6b3b,#ff3b3b)' : 'transparent';
            btn.style.color = t === tab ? '#fff' : '#888';
        }
    });

    const content = document.getElementById('mirrorTabContent');
    if (tab === 'reflections') {
        showReflectionsTab(content);
    } else {
        showCreateLinkTab(content);
    }
}

// ============================================
// ТАБ: МОИ ОТРАЖЕНИЯ
// ============================================

async function showReflectionsTab(container) {
    container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#666;">
            <div style="font-size:32px; margin-bottom:8px;">⏳</div>
            <div>Загружаю отражения...</div>
        </div>
    `;

    try {
        const data = await apiGetReflections(window.USER_ID);
        const reflections = data.reflections || [];

        if (reflections.length === 0) {
            container.innerHTML = `
                <div style="background:#111; border-radius:16px; padding:24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:12px;">🌑</div>
                    <div style="font-size:16px; font-weight:600; color:#fff; margin-bottom:8px;">
                        Пока нет отражений
                    </div>
                    <div style="font-size:13px; color:#666; margin-bottom:20px; line-height:1.5;">
                        Создай ссылку и отправь другу.<br>
                        Когда он пройдёт тест — его профиль откроется тебе.
                    </div>
                    <button onclick="switchMirrorTab('create')"
                        style="background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; border:none; border-radius:12px;
                               padding:12px 24px; font-size:14px; font-weight:600; cursor:pointer;">
                        🔗 Создать первую ссылку
                    </button>
                </div>

                <div style="background:#111; border-radius:16px; padding:20px; margin-top:16px;">
                    <div style="font-size:13px; font-weight:600; color:#e0e0e0; margin-bottom:12px;">💫 КАК ЭТО РАБОТАЕТ</div>
                    <div style="font-size:13px; color:#aaa; line-height:1.8;">
                        <div>1. Ты создаёшь уникальную ссылку</div>
                        <div>2. Отправляешь другу в Telegram или MAX</div>
                        <div>3. Друг проходит тест по твоей ссылке</div>
                        <div>4. Тебе открывается его полный профиль</div>
                    </div>
                </div>
            `;
            return;
        }

        // Статистика
        const stats = data.stats || {};
        let html = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
                <div style="background:#111; border-radius:12px; padding:16px; text-align:center;">
                    <div style="font-size:28px; font-weight:700; color:#e0e0e0;">${stats.total_mirrors || 0}</div>
                    <div style="font-size:12px; color:#666; margin-top:4px;">Создано зеркал</div>
                </div>
                <div style="background:#111; border-radius:12px; padding:16px; text-align:center;">
                    <div style="font-size:28px; font-weight:700; color:#27ae60;">${reflections.length}</div>
                    <div style="font-size:12px; color:#666; margin-top:4px;">Отражений</div>
                </div>
            </div>

            <div style="font-size:14px; font-weight:600; color:#fff; margin-bottom:12px;">
                👥 ОТРАЖЕНИЯ
            </div>
        `;

        reflections.forEach((ref, i) => {
            const profile = ref.friend_profile_code || '—';
            const name = ref.friend_name || `Пользователь ${i+1}`;
            const date = ref.completed_at ? new Date(ref.completed_at).toLocaleDateString('ru') : '';
            const vectors = ref.friend_vectors || {};

            html += `
                <div style="background:#111; border-radius:16px; padding:20px; margin-bottom:12px;
                            border:1px solid #222; cursor:pointer;"
                     onclick="showFriendProfile(${JSON.stringify(ref).replace(/"/g, '&quot;')})">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                                        display:flex; align-items:center; justify-content:center;
                                        font-size:18px; font-weight:700; color:#fff;">
                                ${name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-size:15px; font-weight:600; color:#fff;">${name}</div>
                                <div style="font-size:12px; color:#666;">${date}</div>
                            </div>
                        </div>
                        <div style="background:rgba(26,26,26,0.8); border-radius:8px; padding:4px 10px;
                                    font-size:12px; color:#e0e0e0; font-weight:600;">
                            ${profile}
                        </div>
                    </div>

                    ${Object.keys(vectors).length > 0 ? `
                    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                        ${Object.entries(vectors).map(([k, v]) => `
                            <div style="text-align:center; background:rgba(224,224,224,0.04); border-radius:8px; padding:8px 4px;">
                                <div style="font-size:16px; font-weight:700; color:#e0e0e0;">${Math.round(v)}</div>
                                <div style="font-size:10px; color:#555;">${k}</div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    <div style="margin-top:12px; font-size:12px; color:#e0e0e0; text-align:right;">
                        Нажми чтобы открыть профиль →
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch(e) {
        container.innerHTML = `
            <div style="background:#1a0a0a; border-radius:16px; padding:24px; text-align:center; color:#e74c3c;">
                <div style="font-size:24px; margin-bottom:8px;">❌</div>
                <div>Ошибка загрузки отражений</div>
                <button onclick="switchMirrorTab('reflections')"
                    style="margin-top:12px; background:#333; color:#fff; border:none;
                           border-radius:8px; padding:8px 16px; cursor:pointer;">
                    Повторить
                </button>
            </div>
        `;
    }
}

// ============================================
// ТАБ: СОЗДАТЬ ССЫЛКУ
// ============================================

async function showCreateLinkTab(container) {
    container.innerHTML = `
        <div style="background:#111; border-radius:16px; padding:24px; margin-bottom:16px;">
            <div style="font-size:15px; font-weight:600; color:#fff; margin-bottom:16px;">
                🔗 ВЫБЕРИ КАК ОТПРАВИТЬ
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
                <button onclick="generateMirrorLink('telegram')"
                    style="background:#0088cc; color:#fff; border:none; border-radius:14px;
                           padding:18px; font-size:15px; font-weight:600; cursor:pointer;
                           display:flex; align-items:center; gap:12px; text-align:left;">
                    <span style="font-size:28px;">✈️</span>
                    <div>
                        <div>Telegram</div>
                        <div style="font-size:12px; font-weight:400; opacity:0.8; margin-top:2px;">
                            t.me/Nanotech_varik_bot?start=mirror_...
                        </div>
                    </div>
                </button>

                <button onclick="generateMirrorLink('max')"
                    style="background:linear-gradient(135deg,#333,#555); color:#fff; border:none; border-radius:14px;
                           padding:18px; font-size:15px; font-weight:600; cursor:pointer;
                           display:flex; align-items:center; gap:12px; text-align:left;">
                    <span style="font-size:28px;">⚡</span>
                    <div>
                        <div>MAX</div>
                        <div style="font-size:12px; font-weight:400; opacity:0.8; margin-top:2px;">
                            Ссылка для MAX мессенджера
                        </div>
                    </div>
                </button>

                <button onclick="generateMirrorLink('web')"
                    style="background:#1a1a1a; color:#fff; border:1px solid #333; border-radius:14px;
                           padding:18px; font-size:15px; font-weight:600; cursor:pointer;
                           display:flex; align-items:center; gap:12px; text-align:left;">
                    <span style="font-size:28px;">🌐</span>
                    <div>
                        <div>Веб-ссылка</div>
                        <div style="font-size:12px; font-weight:400; opacity:0.8; margin-top:2px;">
                            fredi-frontend.onrender.com/?ref=...
                        </div>
                    </div>
                </button>
            </div>
        </div>

        <div id="generatedLinkBlock" style="display:none;"></div>

        <!-- ЧТО ОТКРОЕТСЯ ТЕБЕ -->
        <div style="background:#111; border-radius:16px; padding:20px; margin-bottom:12px;">
            <div style="font-size:14px; font-weight:700; color:#e0e0e0; margin-bottom:16px;">
                💫 ЧТО ОТКРОЕТСЯ ТЕБЕ КОГДА ДРУГ ПРОЙДЁТ ТЕСТ
            </div>

            <!-- 1. Обычный профиль -->
            <div style="background:rgba(224,224,224,0.04); border-radius:12px; padding:14px; margin-bottom:10px;
                        border-left:3px solid rgba(224,224,224,0.4);">
                <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:6px;">
                    🧠 ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ
                </div>
                <div style="font-size:12px; color:#888; line-height:1.7;">
                    Тип восприятия, уровень мышления,<br>
                    векторы поведения (СБ, ТФ, УБ, ЧВ),<br>
                    глубинные паттерны и привязанность
                </div>
            </div>

            <!-- 2. Интимный профиль -->
            <div style="background:rgba(224,224,224,0.04); border-radius:12px; padding:14px; margin-bottom:10px;
                        border-left:3px solid #e74c3c;">
                <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:6px;">
                    🔞 ИНТИМНЫЙ ПРОФИЛЬ
                </div>
                <div style="font-size:12px; color:#888; line-height:1.7;">
                    От чего возбуждается, сексуальные паттерны,<br>
                    тип привязанности в близости,<br>
                    чего боится в отношениях
                </div>
            </div>

            <!-- 3. 4F Ключи -->
            <div style="background:rgba(224,224,224,0.04); border-radius:12px; padding:14px; margin-bottom:16px;
                        border-left:3px solid #f39c12;">
                <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:8px;">
                    🔑 4F КЛЮЧИ
                </div>
                <div style="font-size:12px; color:#888; line-height:1.8;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        <span>🔥</span><span><b style="color:#ccc;">1F — Ярость:</b> что запускает его агрессию и как погасить</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        <span>🏃</span><span><b style="color:#ccc;">2F — Страх:</b> чего боится на самом деле, 3 якоря безопасности</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        <span>🧬</span><span><b style="color:#ccc;">3F — Желание:</b> 3 слова-пароля и 3 касания-ключа</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span>🍽</span><span><b style="color:#ccc;">4F — Деньги:</b> что включает режим заработка</span>
                    </div>
                </div>
            </div>

            <!-- Кнопка ПРИМЕР -->
            <button onclick="showProfileExample()"
                style="width:100%; background:transparent; color:#e0e0e0;
                       border:1px solid rgba(224,224,224,0.3); border-radius:12px;
                       padding:12px; font-size:13px; font-weight:600;
                       cursor:pointer; transition:all 0.2s;"
                onmouseover="this.style.background='#1a0a2e'"
                onmouseout="this.style.background='transparent'">
                👁 Посмотреть пример профиля
            </button>
        </div>
    `;
}

async function generateMirrorLink(mirrorType) {
    const block = document.getElementById('generatedLinkBlock');
    block.style.display = 'block';
    block.innerHTML = `
        <div style="background:#111; border-radius:16px; padding:24px; margin-bottom:16px; text-align:center;">
            <div style="font-size:24px; margin-bottom:8px;">⏳</div>
            <div style="color:#888;">Создаю зеркало...</div>
        </div>
    `;

    try {
        const data = await apiCreateMirror(window.USER_ID, mirrorType);

        if (!data.success) {
            block.innerHTML = `
                <div style="background:#1a0a0a; border-radius:16px; padding:20px; text-align:center; color:#e74c3c;">
                    ❌ ${data.error || 'Ошибка создания ссылки'}
                </div>
            `;
            return;
        }

        const link = data.link;
        const text = data.invite_text;

        const typeEmoji = { telegram: '✈️', max: '⚡', web: '🌐' }[mirrorType] || '🔗';
        const typeName = { telegram: 'Telegram', max: 'MAX', web: 'Веб' }[mirrorType] || '';

        block.innerHTML = `
            <div style="background:#0d1a0d; border:1px solid #27ae60; border-radius:16px; padding:20px; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                    <span style="font-size:20px;">${typeEmoji}</span>
                    <span style="font-size:14px; font-weight:700; color:#27ae60;">Ссылка создана!</span>
                </div>

                <div style="background:#0a0a0a; border-radius:10px; padding:12px; margin-bottom:12px;
                            font-family:monospace; font-size:12px; color:#aaa; word-break:break-all;
                            border:1px solid #1a1a1a;">
                    ${link}
                </div>

                <div style="background:#111; border-radius:10px; padding:12px; margin-bottom:16px;
                            font-size:13px; color:#ccc; line-height:1.6; font-style:italic;">
                    "${text}"
                </div>

                <div style="display:flex; gap:8px;">
                    <button onclick="copyMirrorLink('${link}')"
                        style="flex:1; background:#27ae60; color:#fff; border:none; border-radius:10px;
                               padding:12px; font-size:13px; font-weight:600; cursor:pointer;">
                        📋 Скопировать ссылку
                    </button>
                    <button onclick="shareMirrorLink('${link}', '${text.replace(/'/g, "\\'")}')"
                        style="flex:1; background:linear-gradient(135deg,#ff6b3b,#ff3b3b); color:#fff; border:none; border-radius:10px;
                               padding:12px; font-size:13px; font-weight:600; cursor:pointer;">
                        📤 Поделиться
                    </button>
                </div>
            </div>
        `;

    } catch(e) {
        block.innerHTML = `
            <div style="background:#1a0a0a; border-radius:16px; padding:20px; text-align:center; color:#e74c3c;">
                ❌ Ошибка: ${e.message}
            </div>
        `;
    }
}

function copyMirrorLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Ссылка скопирована!');
    }).catch(() => {
        // Fallback
        const el = document.createElement('textarea');
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('✅ Ссылка скопирована!');
    });
}

function shareMirrorLink(link, text) {
    if (navigator.share) {
        navigator.share({ title: 'Фреди — психологический профиль', text: text, url: link });
    } else {
        copyMirrorLink(link);
    }
}

// ============================================
// ЭКРАН ПРОФИЛЯ ДРУГА
// ============================================

async function showFriendProfile(ref) {
    const container = document.getElementById('screenContainer');
    const name = ref.friend_name || 'Друг';
    const profile = ref.friend_profile_code || '—';
    const vectors = ref.friend_vectors || {};
    const patterns = ref.friend_deep_patterns || {};
    const aiProfile = ref.friend_ai_profile || '';
    const date = ref.completed_at ? new Date(ref.completed_at).toLocaleDateString('ru') : '';
    const mirrorCode = ref.mirror_code || '';

    const vectorNames = { 'СБ': 'Самооборона', 'ТФ': 'Финансы', 'УБ': 'Убеждения', 'ЧВ': 'Чувства' };
    const vectorBar = (val) => {
        const pct = Math.round((val / 6) * 100);
        const color = val <= 2 ? '#e74c3c' : val <= 4 ? '#f39c12' : '#27ae60';
        return `<div style="background:#1a1a1a; border-radius:4px; height:6px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:${color}; border-radius:4px;"></div>
        </div>`;
    };

    container.innerHTML = `
        <div style="padding:20px; max-width:600px; margin:0 auto;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
                <button onclick="showMirrorsScreen()"
                    style="background:#1a1a1a; border:none; color:#fff; width:36px; height:36px;
                           border-radius:50%; cursor:pointer; font-size:18px;">←</button>
                <div style="font-size:18px; font-weight:700; color:#fff;">🪞 Профиль: ${name}</div>
            </div>

            <!-- ШАПКА -->
            <div style="background:linear-gradient(135deg,#1a0a2e,#2d1b4e); border-radius:20px;
                        padding:24px; margin-bottom:16px; text-align:center;">
                <div style="width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                            display:flex; align-items:center; justify-content:center;
                            font-size:28px; font-weight:700; color:#fff; margin:0 auto 12px;">
                    ${name.charAt(0).toUpperCase()}
                </div>
                <div style="font-size:20px; font-weight:700; color:#fff; margin-bottom:4px;">${name}</div>
                <div style="font-size:13px; color:#e0e0e0; margin-bottom:4px;">${profile}</div>
                <div style="font-size:12px; color:#666;">Прошёл тест: ${date}</div>
            </div>

            <!-- ВЕКТОРЫ -->
            ${Object.keys(vectors).length > 0 ? `
            <div style="background:#111; border-radius:16px; padding:20px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:600; color:#e0e0e0; margin-bottom:16px;">📊 ВЕКТОРЫ ПОВЕДЕНИЯ</div>
                ${Object.entries(vectors).map(([k, v]) => `
                    <div style="margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-size:13px; color:#ccc;">${vectorNames[k] || k}</span>
                            <span style="font-size:13px; font-weight:700; color:#e0e0e0;">${v.toFixed(1)}/6</span>
                        </div>
                        ${vectorBar(v)}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- ГЛУБИННЫЕ ПАТТЕРНЫ -->
            ${Object.keys(patterns).length > 0 ? `
            <div style="background:#111; border-radius:16px; padding:20px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:600; color:#e0e0e0; margin-bottom:12px;">🌀 ГЛУБИННЫЕ ПАТТЕРНЫ</div>
                ${patterns.attachment ? `
                <div style="margin-bottom:8px;">
                    <span style="font-size:12px; color:#666;">Тип привязанности: </span>
                    <span style="font-size:13px; color:#fff; font-weight:600;">${patterns.attachment}</span>
                </div>` : ''}
                ${patterns.core_fears ? `
                <div>
                    <span style="font-size:12px; color:#666;">Основные страхи: </span>
                    <span style="font-size:13px; color:#fff;">${Array.isArray(patterns.core_fears) ? patterns.core_fears.join(', ') : patterns.core_fears}</span>
                </div>` : ''}
            </div>
            ` : ''}

            <!-- AI ПРОФИЛЬ -->
            ${aiProfile ? `
            <div style="background:#111; border-radius:16px; padding:20px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:600; color:#e0e0e0; margin-bottom:12px;">🧠 AI ПРОФИЛЬ</div>
                <div style="font-size:13px; color:#ccc; line-height:1.7;">${aiProfile.substring(0, 500)}${aiProfile.length > 500 ? '...' : ''}</div>
            </div>
            ` : ''}

            <!-- ТАБЫ: Интимный / 4F -->
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <button onclick="loadIntimateProfile('${mirrorCode}', this)"
                    style="flex:1; background:#1a0005; color:#e74c3c; border:1px solid #e74c3c44;
                           border-radius:12px; padding:12px; font-size:13px; font-weight:600; cursor:pointer;">
                    🔞 Интимный профиль
                </button>
                <button onclick="load4FKeys('${mirrorCode}', this)"
                    style="flex:1; background:#1a1000; color:#f39c12; border:1px solid #f39c1244;
                           border-radius:12px; padding:12px; font-size:13px; font-weight:600; cursor:pointer;">
                    🔑 4F ключи
                </button>
            </div>

            <div id="friendExtraContent"></div>

            <button onclick="showMirrorsScreen()"
                style="width:100%; background:#1a1a1a; color:#aaa; border:1px solid #333;
                       border-radius:12px; padding:14px; font-size:14px; cursor:pointer; margin-top:8px;">
                ← Назад к отражениям
            </button>
        </div>
    `;
}

async function loadIntimateProfile(mirrorCode, btn) {
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode) {
        block.innerHTML = '<div style="background:#1a0005;border-radius:12px;padding:16px;color:#e74c3c;text-align:center;">❌ Код зеркала не найден</div>';
        return;
    }
    block.innerHTML = '<div style="background:#111;border-radius:12px;padding:20px;text-align:center;color:#888;"><div style="font-size:24px;margin-bottom:8px;">⏳</div>Генерирую интимный профиль...</div>';
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/intimate');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const i = data.intimate;

        let html = '<div style="background:#0d0005;border:1px solid #e74c3c33;border-radius:16px;padding:20px;margin-bottom:12px;">';
        html += '<div style="font-size:14px;font-weight:700;color:#e74c3c;margin-bottom:14px;">🔞 ИНТИМНЫЙ ПРОФИЛЬ</div>';

        html += '<div style="margin-bottom:14px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">💋 ЧТО ВОЗБУЖДАЕТ</div>';
        (i.sexual_triggers || []).forEach(t => { html += '<div style="font-size:13px;color:#ccc;margin-bottom:4px;">• ' + t + '</div>'; });
        html += '</div>';

        html += '<div style="margin-bottom:14px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">❄️ ЧТО ГАСИТ ЖЕЛАНИЕ</div>';
        (i.sexual_blockers || []).forEach(t => { html += '<div style="font-size:13px;color:#ccc;margin-bottom:4px;">• ' + t + '</div>'; });
        html += '</div>';

        html += '<div style="margin-bottom:14px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">🧬 ПАТТЕРН БЛИЗОСТИ</div>';
        html += '<div style="font-size:13px;color:#ccc;line-height:1.6;">' + (i.intimacy_pattern || '') + '</div></div>';

        html += '<div style="margin-bottom:14px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">💡 ГЛАВНАЯ ПОТРЕБНОСТЬ</div>';
        html += '<div style="font-size:13px;color:#fff;font-weight:600;">' + (i.key_need || '') + '</div></div>';

        html += '<div style="background:#1a0a00;border-radius:10px;padding:12px;">';
        html += '<div style="font-size:12px;color:#e74c3c;margin-bottom:4px;">🎯 КАК ПОДОЙТИ</div>';
        html += '<div style="font-size:13px;color:#ccc;">' + (i.approach_tip || '') + '</div></div>';
        html += '</div>';

        block.innerHTML = html;
    } catch(e) {
        block.innerHTML = '<div style="background:#1a0005;border-radius:12px;padding:16px;color:#e74c3c;text-align:center;">❌ Ошибка: ' + e.message + '</div>';
    }
}

async function load4FKeys(mirrorCode, btn) {
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode) {
        block.innerHTML = '<div style="background:#1a1000;border-radius:12px;padding:16px;color:#f39c12;text-align:center;">❌ Код зеркала не найден</div>';
        return;
    }
    block.innerHTML = '<div style="background:#111;border-radius:12px;padding:20px;text-align:center;color:#888;"><div style="font-size:24px;margin-bottom:8px;">⏳</div>Генерирую 4F ключи...</div>';
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/4f-keys');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const keys = data.keys;
        const colors = {'1F':'#e74c3c','2F':'#3498db','3F':'#9b59b6','4F':'#27ae60'};

        let html = '';
        Object.entries(keys).forEach(function([code, k]) {
            const color = colors[code] || '#9b59b6';
            html += '<div style="background:#111;border-left:3px solid ' + color + ';border-radius:14px;padding:18px;margin-bottom:12px;">';
            html += '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">' + (k.emoji||'') + ' ' + code + ' — ' + (k.title||'') + '</div>';
            html += '<div style="font-size:12px;color:#666;margin-bottom:8px;">🎯 Триггеры</div>';
            (k.triggers || []).forEach(function(t) {
                html += '<div style="font-size:13px;color:#ccc;margin-bottom:3px;">• ' + t + '</div>';
            });
            html += '<div style="background:rgba(224,224,224,0.04);border-radius:10px;padding:12px;margin-top:10px;">';
            html += '<div style="font-size:12px;color:' + color + ';margin-bottom:4px;">🔑 Ключ</div>';
            html += '<div style="font-size:13px;color:#fff;font-weight:600;">' + (k.key_phrase||'') + '</div></div>';
            html += '<div style="font-size:12px;color:#888;margin-top:8px;line-height:1.6;">⚡ ' + (k.technique||'') + '</div>';
            html += '<div style="font-size:12px;color:#555;margin-top:6px;font-style:italic;">' + (k.insight||'') + '</div>';
            html += '</div>';
        });
        block.innerHTML = html;
    } catch(e) {
        block.innerHTML = '<div style="background:#1a1000;border-radius:12px;padding:16px;color:#f39c12;text-align:center;">❌ Ошибка: ' + e.message + '</div>';
    }
}


// ============================================
// ПРИМЕР ПРОФИЛЯ
// ============================================

function showProfileExample() {
    var container = document.getElementById('screenContainer');
    var html = '<div style="padding:20px;max-width:600px;margin:0 auto;">';
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">';
    html += '<button onclick="showMirrorsScreen()" style="background:#1a1a1a;border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">←</button>';
    html += '<div style="font-size:18px;font-weight:700;color:#fff;">👁 Пример профиля</div></div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:20px;background:#111;border-radius:12px;padding:4px;">';
    html += '<button onclick="switchExampleTab(\'basic\')" id="ex-tab-basic" style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;cursor:pointer;">🧠 Профиль</button>';
    html += '<button onclick="switchExampleTab(\'intimate\')" id="ex-tab-intimate" style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;background:transparent;color:#888;cursor:pointer;">🔞 Интимный</button>';
    html += '<button onclick="switchExampleTab(\'4f\')" id="ex-tab-4f" style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;background:transparent;color:#888;cursor:pointer;">🔑 4F ключи</button>';
    html += '</div><div id="exampleTabContent"></div>';
    html += '<button onclick="showMirrorsScreen()" style="width:100%;margin-top:16px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:600;cursor:pointer;">🔗 Создать своё зеркало</button>';
    html += '</div>';
    container.innerHTML = html;
    switchExampleTab('basic');
}

function switchExampleTab(tab) {
    ['basic','intimate','4f'].forEach(function(t) {
        var btn = document.getElementById('ex-tab-' + t);
        if (btn) { btn.style.background = t === tab ? 'linear-gradient(135deg,#ff6b3b,#ff3b3b)' : 'transparent'; btn.style.color = t === tab ? '#fff' : '#888'; }
    });
    var content = document.getElementById('exampleTabContent');
    if (!content) return;
    if (tab === 'basic') showExampleBasic(content);
    else if (tab === 'intimate') showExampleIntimate(content);
    else showExample4F(content);
}

function showExampleBasic(container) {
    var html = '<div style="background:rgba(10,10,10,0.7);border-radius:16px;padding:20px;margin-bottom:12px;text-align:center;">';
    html += '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;margin:0 auto 12px;">А</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#fff;">Алексей</div>';
    html += '<div style="font-size:13px;color:#e0e0e0;margin-top:4px;">СБ-4 ТФ-2 УБ-5 ЧВ-3</div></div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:12px;">🔍 ТИП ВОСПРИЯТИЯ</div>';
    html += '<div style="font-size:14px;color:#fff;font-weight:600;">ПРАКТИКО-ОРИЕНТИРОВАННЫЙ</div>';
    html += '<div style="font-size:13px;color:#888;margin-top:4px;line-height:1.6;">Фокусируется на конкретных результатах. Принимает решения на основе фактов.</div></div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:14px;">📊 ВЕКТОРЫ ПОВЕДЕНИЯ</div>';
    [['СБ','Самооборона',4,'#e74c3c'],['ТФ','Финансы',2,'#f39c12'],['УБ','Убеждения',5,'#27ae60'],['ЧВ','Чувства',3,'#3498db']].forEach(function(v) {
        var pct = Math.round(v[2]/6*100);
        html += '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;">';
        html += '<span style="font-size:13px;color:#ccc;">' + v[1] + ' (' + v[0] + ')</span>';
        html += '<span style="font-size:13px;font-weight:700;color:' + v[3] + ';">' + v[2] + '/6</span></div>';
        html += '<div style="background:#1a1a1a;border-radius:4px;height:6px;"><div style="width:' + pct + '%;height:100%;background:' + v[3] + ';border-radius:4px;"></div></div></div>';
    });
    html += '</div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:12px;">🌀 ГЛУБИННЫЕ ПАТТЕРНЫ</div>';
    html += '<div style="font-size:13px;color:#ccc;line-height:1.8;">';
    html += '<div>Привязанность: <b style="color:#fff;">Избегающий</b></div>';
    html += '<div>Страхи: <b style="color:#fff;">потеря контроля, зависимость</b></div>';
    html += '<div>Убеждение: <b style="color:#fff;">«Я должен справляться сам»</b></div>';
    html += '</div></div>';
    container.innerHTML = html;
}

function showExampleIntimate(container) {
    var html = '<div style="background:#1a0005;border:1px solid #e74c3c33;border-radius:16px;padding:16px;margin-bottom:12px;text-align:center;">';
    html += '<div style="font-size:24px;margin-bottom:6px;">🔞</div>';
    html += '<div style="font-size:13px;color:#e74c3c;font-weight:600;">ИНТИМНЫЙ ПРОФИЛЬ — ПРИМЕР</div></div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e74c3c;margin-bottom:12px;">💋 ЧТО ВОЗБУЖДАЕТ</div>';
    ['Когда его не торопят и дают время','Визуальные стимулы','Ощущение контроля в близости'].forEach(function(t) {
        html += '<div style="font-size:13px;color:#ccc;margin-bottom:4px;">• ' + t + '</div>';
    });
    html += '</div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e74c3c;margin-bottom:12px;">❄️ ЧТО ГАСИТ ЖЕЛАНИЕ</div>';
    ['Давление и требования','Эмоциональные сцены перед близостью','Ощущение оценки'].forEach(function(t) {
        html += '<div style="font-size:13px;color:#ccc;margin-bottom:4px;">• ' + t + '</div>';
    });
    html += '</div>';
    html += '<div style="background:#111;border-radius:16px;padding:20px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#e74c3c;margin-bottom:12px;">🧬 ПАТТЕРН БЛИЗОСТИ</div>';
    html += '<div style="font-size:13px;color:#ccc;line-height:1.7;">Избегающий тип. Нуждается в ощущении свободы. Близость через общие задачи сильнее чем через слова.</div></div>';
    container.innerHTML = html;
}

function showExample4F(container) {
    var html = '<div style="background:#1a1000;border:1px solid #f39c1233;border-radius:16px;padding:16px;margin-bottom:16px;text-align:center;">';
    html += '<div style="font-size:24px;margin-bottom:6px;">🔑</div>';
    html += '<div style="font-size:13px;color:#f39c12;font-weight:600;">4F КЛЮЧИ — ПРИМЕР</div></div>';
    var keys4f = [
        ['🔥','1F','Ярость','#e74c3c',['Критика при свидетелях','Обесценивание усилий','Игнорирование границ'],'«Я вижу как много ты сделал»','Пауза 3 сек + имя'],
        ['🏃','2F','Страх','#3498db',['Вопросы о будущем','Повышение голоса','Требования'],'«Я никуда не ухожу, просто поговорим»','Без дедлайнов и давления'],
        ['🧬','3F','Желание','#9b59b6',['Особая интонация','Зрительный контакт 4+ сек','Неожиданные касания'],'«только мы», «никуда не торопимся»','Плечо → запястье → шея'],
        ['🍽','4F','Деньги','#27ae60',['Упоминание конкурентов','Идеи заработка','Вызов'],'«Как думаешь, можно это монетизировать?»','Задача с измеримым результатом']
    ];
    keys4f.forEach(function(k) {
        html += '<div style="background:#111;border-left:3px solid ' + k[3] + ';border-radius:14px;padding:18px;margin-bottom:12px;">';
        html += '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">' + k[0] + ' ' + k[1] + ' — ' + k[2] + '</div>';
        html += '<div style="font-size:12px;color:#666;margin-bottom:8px;">🎯 Триггеры</div>';
        k[4].forEach(function(t) { html += '<div style="font-size:13px;color:#ccc;margin-bottom:3px;">• ' + t + '</div>'; });
        html += '<div style="background:rgba(224,224,224,0.04);border-radius:10px;padding:12px;margin-top:10px;">';
        html += '<div style="font-size:12px;color:' + k[3] + ';margin-bottom:4px;">🔑 Ключ</div>';
        html += '<div style="font-size:13px;color:#fff;font-weight:600;">' + k[5] + '</div></div>';
        html += '<div style="font-size:12px;color:#888;margin-top:8px;">⚡ ' + k[6] + '</div></div>';
    });
    container.innerHTML = html;
}


window.showMirrorsScreen = showMirrorsScreen;
window.switchMirrorTab = switchMirrorTab;
window.generateMirrorLink = generateMirrorLink;
window.copyMirrorLink = copyMirrorLink;
window.shareMirrorLink = shareMirrorLink;
window.showFriendProfile = showFriendProfile;
