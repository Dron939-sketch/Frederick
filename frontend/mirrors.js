// ============================================
// 🪞 ЗЕРКАЛА / ОТРАЖЕНИЯ
// Версия 2.0 — Premium Dark
// ============================================

const API_BASE = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

// ============================================
// СТИЛИ
// ============================================
function injectMirrorStyles() {
    if (document.getElementById('mirror-styles')) return;
    const style = document.createElement('style');
    style.id = 'mirror-styles';
    style.textContent = `
        @keyframes mirrorFadeIn {
            from { opacity:0; transform:translateY(16px); }
            to   { opacity:1; transform:translateY(0); }
        }
        @keyframes mirrorPulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(255,107,59,0); }
            50%      { box-shadow: 0 0 0 8px rgba(255,107,59,0.12); }
        }
        @keyframes shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
        }
        .mirror-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 12px;
            transition: border-color 0.2s, background 0.2s, transform 0.15s;
            animation: mirrorFadeIn 0.35s ease both;
            cursor: pointer;
        }
        .mirror-card:hover {
            border-color: rgba(255,107,59,0.35);
            background: rgba(255,107,59,0.04);
            transform: translateY(-2px);
        }
        .mirror-tab-btn {
            flex: 1;
            padding: 11px 8px;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s;
            font-family: inherit;
            letter-spacing: 0.2px;
        }
        .mirror-tab-btn.active {
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            color: #fff;
            box-shadow: 0 4px 20px rgba(255,59,59,0.3);
        }
        .mirror-tab-btn.inactive {
            background: transparent;
            color: rgba(255,255,255,0.4);
        }
        .mirror-tab-btn.inactive:hover {
            color: rgba(255,255,255,0.7);
            background: rgba(255,255,255,0.05);
        }
        .mirror-stat-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 18px;
            text-align: center;
            flex: 1;
        }
        .mirror-action-btn {
            display: flex;
            align-items: center;
            gap: 14px;
            width: 100%;
            padding: 18px 20px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            background: rgba(255,255,255,0.03);
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
            text-align: left;
            margin-bottom: 10px;
        }
        .mirror-action-btn:hover {
            background: rgba(255,255,255,0.07);
            border-color: rgba(255,255,255,0.2);
            transform: translateX(4px);
        }
        .mirror-vector-bar-track {
            background: rgba(255,255,255,0.06);
            border-radius: 4px;
            height: 5px;
            overflow: hidden;
            margin-top: 5px;
        }
        .mirror-vector-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.6s ease;
        }
        .mirror-info-block {
            background: rgba(255,255,255,0.025);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 10px;
        }
        .mirror-info-block-left {
            border-left: 2px solid rgba(255,107,59,0.6);
            padding-left: 14px;
        }
        .mirror-link-box {
            background: #000;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 12px 14px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            word-break: break-all;
            letter-spacing: 0.3px;
            margin-bottom: 12px;
        }
        .mirror-copy-btn {
            flex: 1;
            padding: 13px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
        }
        .mirror-copy-btn:hover { opacity: 0.85; transform: scale(0.98); }
        .mirror-section-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.3);
            margin-bottom: 10px;
        }
        .mirror-4f-card {
            border-radius: 16px;
            padding: 18px;
            margin-bottom: 10px;
            border-left: 3px solid;
            background: rgba(255,255,255,0.025);
            animation: mirrorFadeIn 0.3s ease both;
        }
        .mirror-skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 8px;
            height: 14px;
            margin-bottom: 8px;
        }
    `;
    document.head.appendChild(style);
}
injectMirrorStyles();

// ============================================
// API
// ============================================
async function apiCreateMirror(userId, mirrorType) {
    const res = await fetch(`${API_BASE}/api/mirrors/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, mirror_type: mirrorType })
    });
    return res.json();
}
async function apiGetReflections(userId) {
    const res = await fetch(`${API_BASE}/api/mirrors/${userId}/reflections`);
    return res.json();
}

// ============================================
// ГЛАВНЫЙ ЭКРАН
// ============================================
async function showMirrorsScreen() {
    injectMirrorStyles();
    const container = document.getElementById('screenContainer');

    container.innerHTML = `
        <div style="max-width:600px; margin:0 auto; padding:20px 16px;">

            <!-- ШАПКА -->
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:28px; animation:mirrorFadeIn 0.3s ease;">
                <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                            display:flex;align-items:center;justify-content:center;font-size:22px;
                            box-shadow:0 8px 24px rgba(255,59,59,0.3);">🪞</div>
                <div>
                    <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Зеркало</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px;letter-spacing:0.3px;">
                        Отправь ссылку — получи профиль друга
                    </div>
                </div>
            </div>

            <!-- ТАБЫ -->
            <div style="display:flex;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                        border-radius:14px;padding:4px;margin-bottom:24px;">
                <button class="mirror-tab-btn active" id="tab-reflections" onclick="switchMirrorTab('reflections')">
                    👥 Мои отражения
                </button>
                <button class="mirror-tab-btn inactive" id="tab-create" onclick="switchMirrorTab('create')">
                    🔗 Создать ссылку
                </button>
            </div>

            <div id="mirrorTabContent"></div>
        </div>
    `;

    switchMirrorTab('reflections');
}

function switchMirrorTab(tab) {
    ['reflections','create'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.classList.add('active'); btn.classList.remove('inactive');
        } else {
            btn.classList.remove('active'); btn.classList.add('inactive');
        }
    });
    const content = document.getElementById('mirrorTabContent');
    if (tab === 'reflections') showReflectionsTab(content);
    else showCreateLinkTab(content);
}

// ============================================
// ТАБ: ОТРАЖЕНИЯ
// ============================================
async function showReflectionsTab(container) {
    container.innerHTML = `
        <div style="padding:32px;text-align:center;color:rgba(255,255,255,0.3);">
            <div class="mirror-skeleton" style="width:60%;margin:0 auto 8px;height:12px;"></div>
            <div class="mirror-skeleton" style="width:40%;margin:0 auto;height:12px;"></div>
        </div>`;

    try {
        const data = await apiGetReflections(window.USER_ID);
        const reflections = data.reflections || [];
        const stats = data.stats || {};

        if (!reflections.length) {
            container.innerHTML = `
                <div style="animation:mirrorFadeIn 0.4s ease;">
                    <!-- ПУСТО -->
                    <div style="text-align:center;padding:40px 20px;background:rgba(255,255,255,0.02);
                                border:1px dashed rgba(255,255,255,0.1);border-radius:24px;margin-bottom:16px;">
                        <div style="font-size:52px;margin-bottom:16px;opacity:0.6;">🌑</div>
                        <div style="font-size:17px;font-weight:600;color:#fff;margin-bottom:8px;">Зеркало пусто</div>
                        <div style="font-size:13px;color:rgba(255,255,255,0.35);line-height:1.7;max-width:280px;margin:0 auto 24px;">
                            Отправь ссылку другу. Как только он пройдёт тест — его профиль откроется тебе.
                        </div>
                        <button onclick="switchMirrorTab('create')"
                            style="background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;border:none;
                                   border-radius:12px;padding:13px 28px;font-size:14px;font-weight:600;
                                   cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(255,59,59,0.3);">
                            Создать первую ссылку →
                        </button>
                    </div>

                    <!-- КАК РАБОТАЕТ -->
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
                                border-radius:20px;padding:20px;">
                        <div class="mirror-section-label">КАК ЭТО РАБОТАЕТ</div>
                        ${['1️⃣ Создаёшь уникальную ссылку',
                           '2️⃣ Отправляешь другу в Telegram или MAX',
                           '3️⃣ Друг проходит тест по твоей ссылке',
                           '4️⃣ Тебе открывается его полный профиль + интимный + 4F ключи'].map(s => `
                            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;
                                        border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:rgba(255,255,255,0.6);">
                                ${s}
                            </div>`).join('')}
                    </div>
                </div>`;
            return;
        }

        // СТАТИСТИКА
        let html = `
            <div style="display:flex;gap:10px;margin-bottom:20px;animation:mirrorFadeIn 0.3s ease;">
                <div class="mirror-stat-card">
                    <div style="font-size:30px;font-weight:700;color:#fff;">${stats.total_mirrors||0}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.3px;">Создано зеркал</div>
                </div>
                <div class="mirror-stat-card" style="border-color:rgba(255,107,59,0.2);">
                    <div style="font-size:30px;font-weight:700;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                                -webkit-background-clip:text;-webkit-text-fill-color:transparent;">${reflections.length}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.3px;">Отражений</div>
                </div>
            </div>
            <div class="mirror-section-label">ОТРАЖЕНИЯ</div>`;

        reflections.forEach((ref, i) => {
            const name = ref.friend_name || `Пользователь ${i+1}`;
            const profile = ref.friend_profile_code || '—';
            const date = ref.completed_at ? new Date(ref.completed_at).toLocaleDateString('ru') : '';
            const vectors = ref.friend_vectors || {};
            const vKeys = Object.keys(vectors);

            html += `
                <div class="mirror-card" style="animation-delay:${i*0.06}s"
                     onclick="showFriendProfile(${JSON.stringify(ref).replace(/"/g,'&quot;')})">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:42px;height:42px;border-radius:50%;
                                        background:linear-gradient(135deg,rgba(255,107,59,0.3),rgba(255,59,59,0.15));
                                        border:1px solid rgba(255,107,59,0.3);
                                        display:flex;align-items:center;justify-content:center;
                                        font-size:18px;font-weight:700;color:#fff;">
                                ${name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-size:15px;font-weight:600;color:#fff;">${name}</div>
                                <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">${date}</div>
                            </div>
                        </div>
                        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                                    border-radius:8px;padding:4px 10px;font-size:11px;color:rgba(255,255,255,0.5);
                                    font-weight:600;letter-spacing:0.3px;">${profile}</div>
                    </div>

                    ${vKeys.length ? `
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
                        ${Object.entries(vectors).map(([k,v]) => {
                            const pct = Math.round((v/6)*100);
                            const col = v<=2?'#3b82ff':v<=4?'#f39c12':'#ff6b3b';
                            return `<div style="text-align:center;">
                                <div style="font-size:15px;font-weight:700;color:${col};">${Math.round(v)}</div>
                                <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:4px;">${k}</div>
                                <div class="mirror-vector-bar-track">
                                    <div class="mirror-vector-bar-fill" style="width:${pct}%;background:${col};"></div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>` : ''}

                    <div style="font-size:11px;color:rgba(255,107,59,0.7);text-align:right;letter-spacing:0.3px;">
                        Открыть профиль →
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `
            <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
                        border-radius:16px;padding:24px;text-align:center;color:rgba(59,130,246,0.8);">
                <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
                <div style="font-size:13px;">Ошибка загрузки</div>
                <button onclick="switchMirrorTab('reflections')"
                    style="margin-top:12px;background:rgba(255,255,255,0.08);color:#fff;border:none;
                           border-radius:8px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:12px;">
                    Повторить
                </button>
            </div>`;
    }
}

// ============================================
// ТАБ: СОЗДАТЬ ССЫЛКУ
// ============================================
async function showCreateLinkTab(container) {
    container.innerHTML = `
        <div style="animation:mirrorFadeIn 0.35s ease;">

            <!-- ВЫБОР ПЛАТФОРМЫ -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:16px;">
                <div class="mirror-section-label">ВЫБЕРИ ПЛАТФОРМУ</div>

                <button class="mirror-action-btn" onclick="generateMirrorLink('telegram')">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(0,136,204,0.15);
                                border:1px solid rgba(0,136,204,0.3);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">✈️</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">Telegram</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">t.me/Nanotech_varik_bot?start=mirror_...</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>

                <button class="mirror-action-btn" onclick="generateMirrorLink('max')">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,107,59,0.12);
                                border:1px solid rgba(255,107,59,0.25);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">⚡</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">MAX</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">Ссылка для MAX мессенджера</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>

                <button class="mirror-action-btn" onclick="generateMirrorLink('web')" style="margin-bottom:0;">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.06);
                                border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;
                                justify-content:center;font-size:22px;flex-shrink:0;">🌐</div>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">Веб-ссылка</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">fredi-frontend.onrender.com/?ref=...</div>
                    </div>
                    <div style="color:rgba(255,255,255,0.2);font-size:18px;">›</div>
                </button>
            </div>

            <!-- РЕЗУЛЬТАТ -->
            <div id="generatedLinkBlock"></div>

            <!-- ЧТО ОТКРОЕТСЯ -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:16px;">
                <div class="mirror-section-label">ЧТО ОТКРОЕТСЯ ТЕБЕ</div>

                ${[
                    ['rgba(255,255,255,0.5)','🧠','ПСИХОЛОГИЧЕСКИЙ ПРОФИЛЬ','Тип восприятия, векторы поведения (СБ/ТФ/УБ/ЧВ), уровень мышления, глубинные паттерны'],
                    ['#3b82ff','🔞','ИНТИМНЫЙ ПРОФИЛЬ','Что возбуждает, что гасит желание, сексуальный паттерн, главная потребность'],
                    ['#f39c12','🔑','4F КЛЮЧИ','🔥 Ярость — как погасить   🏃 Страх — якоря безопасности   🧬 Желание — слова-пароли   🍽 Деньги — мотиваторы'],
                ].map(([col,emoji,title,desc]) => `
                    <div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:22px;flex-shrink:0;margin-top:2px;">${emoji}</div>
                        <div>
                            <div style="font-size:12px;font-weight:700;color:${col};letter-spacing:0.5px;margin-bottom:4px;">${title}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">${desc}</div>
                        </div>
                    </div>`).join('')}

                <div style="padding-top:14px;">
                    <button onclick="showProfileExample()"
                        style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.12);
                               border-radius:12px;padding:12px;color:rgba(255,255,255,0.5);font-size:13px;
                               font-weight:600;cursor:pointer;font-family:inherit;
                               transition:all 0.2s;letter-spacing:0.3px;"
                        onmouseover="this.style.borderColor='rgba(255,107,59,0.4)';this.style.color='rgba(255,107,59,0.8)'"
                        onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='rgba(255,255,255,0.5)'">
                        👁 Посмотреть пример профиля
                    </button>
                </div>
            </div>
        </div>`;
}

async function generateMirrorLink(mirrorType) {
    const block = document.getElementById('generatedLinkBlock');
    if (!block) return;
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">
            <div class="mirror-skeleton" style="width:50%;margin:0 auto 8px;"></div>
            <div class="mirror-skeleton" style="width:70%;margin:0 auto;"></div>
        </div>`;

    try {
        const data = await apiCreateMirror(window.USER_ID, mirrorType);
        if (!data.success) throw new Error(data.error || 'Ошибка');

        const link = data.link;
        const text = data.invite_text;
        const icons = {telegram:'✈️', max:'⚡', web:'🌐'};

        block.innerHTML = `
            <div style="background:rgba(255,107,59,0.06);border:1px solid rgba(255,107,59,0.25);
                        border-radius:20px;padding:20px;margin-bottom:16px;animation:mirrorFadeIn 0.3s ease;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                    <span style="font-size:20px;">${icons[mirrorType]||'🔗'}</span>
                    <span style="font-size:14px;font-weight:700;color:#ff6b3b;">Ссылка создана!</span>
                </div>

                <div class="mirror-link-box">${link}</div>

                <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;
                            font-size:12px;color:rgba(255,255,255,0.45);line-height:1.7;
                            font-style:italic;margin-bottom:14px;border:1px solid rgba(255,255,255,0.06);">
                    «${text}»
                </div>

                <div style="display:flex;gap:8px;">
                    <button class="mirror-copy-btn"
                        style="background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;"
                        onclick="copyMirrorLink('${link}')">
                        📋 Скопировать
                    </button>
                    <button class="mirror-copy-btn"
                        style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);"
                        onclick="shareMirrorLink('${link}','${text.replace(/'/g,"\\'")}')">
                        📤 Поделиться
                    </button>
                </div>
            </div>`;
    } catch(e) {
        block.innerHTML = `
            <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
                        border-radius:16px;padding:16px;margin-bottom:16px;text-align:center;
                        color:rgba(59,130,246,0.8);font-size:13px;">
                ❌ ${e.message}
            </div>`;
    }
}

function copyMirrorLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        if (typeof showToast === 'function') showToast('✅ Ссылка скопирована!');
    }).catch(() => {
        const el = document.createElement('textarea');
        el.value = link; document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
        if (typeof showToast === 'function') showToast('✅ Ссылка скопирована!');
    });
}

function shareMirrorLink(link, text) {
    if (navigator.share) navigator.share({ title: 'Фреди — психологический профиль', text, url: link });
    else copyMirrorLink(link);
}

// ============================================
// ПРОФИЛЬ ДРУГА
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

    const vNames = {'СБ':'Самооборона','ТФ':'Финансы','УБ':'Убеждения','ЧВ':'Чувства'};
    const vColor = v => v<=2?'#3b82ff':v<=4?'#f39c12':'#ff6b3b';

    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:20px 16px;animation:mirrorFadeIn 0.35s ease;">

            <!-- НАВИГАЦИЯ -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <button onclick="showMirrorsScreen()"
                    style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.06);
                           border:1px solid rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:16px;
                           display:flex;align-items:center;justify-content:center;flex-shrink:0;
                           transition:all 0.2s;font-family:inherit;"
                    onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.06)'">←</button>
                <div style="font-size:17px;font-weight:600;color:#fff;">🪞 Профиль отражения</div>
            </div>

            <!-- HERO -->
            <div style="background:linear-gradient(135deg,rgba(255,107,59,0.1),rgba(255,59,59,0.05));
                        border:1px solid rgba(255,107,59,0.2);border-radius:24px;
                        padding:28px;margin-bottom:16px;text-align:center;">
                <div style="width:68px;height:68px;border-radius:50%;margin:0 auto 14px;
                            background:linear-gradient(135deg,rgba(255,107,59,0.4),rgba(255,59,59,0.2));
                            border:2px solid rgba(255,107,59,0.4);
                            display:flex;align-items:center;justify-content:center;
                            font-size:28px;font-weight:700;color:#fff;
                            box-shadow:0 8px 24px rgba(255,59,59,0.2);">
                    ${name.charAt(0).toUpperCase()}
                </div>
                <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4);font-family:'SF Mono',monospace;
                            letter-spacing:1px;margin-bottom:4px;">${profile}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.25);">Тест пройден: ${date}</div>
            </div>

            <!-- ВЕКТОРЫ -->
            ${Object.keys(vectors).length ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">ВЕКТОРЫ ПОВЕДЕНИЯ</div>
                ${Object.entries(vectors).map(([k,v]) => `
                    <div style="margin-bottom:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="font-size:13px;color:rgba(255,255,255,0.6);">${vNames[k]||k}</span>
                            <span style="font-size:13px;font-weight:700;color:${vColor(v)};">${v.toFixed(1)}/6</span>
                        </div>
                        <div class="mirror-vector-bar-track">
                            <div class="mirror-vector-bar-fill" style="width:${Math.round(v/6*100)}%;background:${vColor(v)};"></div>
                        </div>
                    </div>`).join('')}
            </div>` : ''}

            <!-- ПАТТЕРНЫ -->
            ${Object.keys(patterns).length ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">ГЛУБИННЫЕ ПАТТЕРНЫ</div>
                ${patterns.attachment ? `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);">Привязанность</span>
                    <span style="font-size:13px;font-weight:600;color:#fff;">${patterns.attachment}</span>
                </div>` : ''}
                ${patterns.core_fears ? `
                <div style="display:flex;justify-content:space-between;padding:10px 0;align-items:flex-start;gap:12px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);flex-shrink:0;">Страхи</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.6);text-align:right;">${Array.isArray(patterns.core_fears)?patterns.core_fears.join(', '):patterns.core_fears}</span>
                </div>` : ''}
            </div>` : ''}

            <!-- AI ПРОФИЛЬ -->
            ${aiProfile ? `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                        border-radius:20px;padding:20px;margin-bottom:12px;">
                <div class="mirror-section-label">AI ПРОФИЛЬ</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
                    ${aiProfile.substring(0,500)}${aiProfile.length>500?'…':''}
                </div>
            </div>` : ''}

            <!-- КНОПКИ -->
            <div style="display:flex;gap:10px;margin-bottom:12px;">
                <button onclick="loadIntimateProfile('${mirrorCode}')"
                    style="flex:1;background:rgba(59,130,246,0.08);color:#3b82ff;
                           border:1px solid rgba(59,130,246,0.25);border-radius:14px;
                           padding:14px;font-size:13px;font-weight:600;cursor:pointer;
                           font-family:inherit;transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(59,130,246,0.15)'"
                    onmouseout="this.style.background='rgba(59,130,246,0.08)'">
                    🔞 Интимный профиль
                </button>
                <button onclick="load4FKeys('${mirrorCode}')"
                    style="flex:1;background:rgba(243,156,18,0.08);color:#f39c12;
                           border:1px solid rgba(243,156,18,0.25);border-radius:14px;
                           padding:14px;font-size:13px;font-weight:600;cursor:pointer;
                           font-family:inherit;transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(243,156,18,0.15)'"
                    onmouseout="this.style.background='rgba(243,156,18,0.08)'">
                    🔑 4F ключи
                </button>
            </div>

            <div id="friendExtraContent"></div>

            <button onclick="showMirrorsScreen()"
                style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.08);
                       border-radius:14px;padding:14px;color:rgba(255,255,255,0.3);font-size:13px;
                       cursor:pointer;font-family:inherit;margin-top:8px;transition:all 0.2s;"
                onmouseover="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='rgba(255,255,255,0.6)'"
                onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='rgba(255,255,255,0.3)'">
                ← Назад к отражениям
            </button>
        </div>`;
}

async function loadIntimateProfile(mirrorCode) {
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode || !block) return;
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border-radius:16px;padding:20px;margin-bottom:12px;">
            <div class="mirror-skeleton" style="width:50%;margin-bottom:10px;"></div>
            <div class="mirror-skeleton"></div><div class="mirror-skeleton" style="width:80%;"></div>
        </div>`;
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/intimate');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const i = data.intimate;

        let html = `
            <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);
                        border-radius:20px;padding:20px;margin-bottom:12px;animation:mirrorFadeIn 0.3s ease;">
                <div style="font-size:12px;font-weight:700;color:#3b82ff;letter-spacing:0.8px;
                            text-transform:uppercase;margin-bottom:16px;">🔞 Интимный профиль</div>`;

        const sections = [
            ['💋 Что возбуждает', i.sexual_triggers||[]],
            ['❄️ Что гасит желание', i.sexual_blockers||[]],
        ];
        sections.forEach(([label, items]) => {
            html += `<div style="margin-bottom:14px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">${label}</div>
                ${items.map(t => `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;
                    border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`).join('')}
            </div>`;
        });

        if (i.intimacy_pattern) html += `
            <div style="margin-bottom:12px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:6px;">🧬 Паттерн близости</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7;">${i.intimacy_pattern}</div>
            </div>`;

        if (i.key_need) html += `
            <div style="background:rgba(59,130,246,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="font-size:11px;color:#3b82ff;letter-spacing:0.5px;margin-bottom:4px;">💡 Главная потребность</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">${i.key_need}</div>
            </div>`;

        if (i.approach_tip) html += `
            <div style="background:rgba(255,107,59,0.08);border-radius:12px;padding:14px;">
                <div style="font-size:11px;color:#ff6b3b;letter-spacing:0.5px;margin-bottom:4px;">🎯 Как подойти</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);">${i.approach_tip}</div>
            </div>`;

        html += '</div>';
        block.innerHTML = html;
    } catch(e) {
        block.innerHTML = `<div style="background:rgba(59,130,246,0.08);border-radius:14px;padding:16px;
            text-align:center;color:rgba(59,130,246,0.7);font-size:13px;margin-bottom:12px;">❌ ${e.message}</div>`;
    }
}

async function load4FKeys(mirrorCode) {
    const block = document.getElementById('friendExtraContent');
    if (!mirrorCode || !block) return;
    block.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border-radius:16px;padding:20px;margin-bottom:12px;">
            <div class="mirror-skeleton" style="width:40%;margin-bottom:10px;"></div>
            <div class="mirror-skeleton"></div><div class="mirror-skeleton" style="width:70%;"></div>
        </div>`;
    try {
        const res = await fetch(API_BASE + '/api/mirrors/' + mirrorCode + '/4f-keys');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const keys = data.keys;
        const palette = {'1F':'#ff6b3b','2F':'#3b82ff','3F':'#a855f7','4F':'#f39c12'};

        let html = '';
        Object.entries(keys).forEach(([code, k], idx) => {
            const col = palette[code] || '#ff6b3b';
            html += `
                <div class="mirror-4f-card" style="border-color:${col};animation-delay:${idx*0.08}s">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                        <span style="font-size:20px;">${k.emoji||''}</span>
                        <div>
                            <div style="font-size:14px;font-weight:700;color:#fff;">${code} — ${k.title||''}</div>
                        </div>
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">🎯 ТРИГГЕРЫ</div>
                    ${(k.triggers||[]).map(t => `
                        <div style="font-size:13px;color:rgba(255,255,255,0.65);padding:5px 0;
                                    border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`).join('')}
                    <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:12px;margin-top:12px;">
                        <div style="font-size:11px;color:${col};letter-spacing:0.5px;margin-bottom:4px;">🔑 КЛЮЧ</div>
                        <div style="font-size:13px;font-weight:600;color:#fff;">${k.key_phrase||''}</div>
                    </div>
                    ${k.technique ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:10px;line-height:1.5;">⚡ ${k.technique}</div>` : ''}
                    ${k.insight ? `<div style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:6px;font-style:italic;">${k.insight}</div>` : ''}
                </div>`;
        });
        block.innerHTML = html;
    } catch(e) {
        block.innerHTML = `<div style="background:rgba(243,156,18,0.08);border-radius:14px;padding:16px;
            text-align:center;color:rgba(243,156,18,0.7);font-size:13px;margin-bottom:12px;">❌ ${e.message}</div>`;
    }
}

// ============================================
// ПРИМЕР ПРОФИЛЯ
// ============================================
function showProfileExample() {
    const container = document.getElementById('screenContainer');
    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:20px 16px;animation:mirrorFadeIn 0.35s ease;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
                <button onclick="showMirrorsScreen()"
                    style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.06);
                           border:1px solid rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:16px;
                           display:flex;align-items:center;justify-content:center;font-family:inherit;">←</button>
                <div style="font-size:17px;font-weight:600;color:#fff;">👁 Пример профиля</div>
            </div>

            <!-- ТАБЫ -->
            <div style="display:flex;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                        border-radius:14px;padding:4px;margin-bottom:20px;">
                <button class="mirror-tab-btn active" id="ex-tab-basic" onclick="switchExampleTab('basic')">🧠 Профиль</button>
                <button class="mirror-tab-btn inactive" id="ex-tab-intimate" onclick="switchExampleTab('intimate')">🔞 Интимный</button>
                <button class="mirror-tab-btn inactive" id="ex-tab-4f" onclick="switchExampleTab('4f')">🔑 4F ключи</button>
            </div>

            <div id="exampleTabContent"></div>

            <button onclick="switchMirrorTab('create');showMirrorsScreen()"
                style="width:100%;margin-top:16px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                       color:#fff;border:none;border-radius:14px;padding:15px;font-size:14px;
                       font-weight:600;cursor:pointer;font-family:inherit;
                       box-shadow:0 6px 24px rgba(255,59,59,0.3);">
                Создать своё зеркало →
            </button>
        </div>`;
    switchExampleTab('basic');
}

function switchExampleTab(tab) {
    ['basic','intimate','4f'].forEach(t => {
        const btn = document.getElementById('ex-tab-'+t);
        if (!btn) return;
        if (t===tab) { btn.classList.add('active'); btn.classList.remove('inactive'); }
        else { btn.classList.remove('active'); btn.classList.add('inactive'); }
    });
    const c = document.getElementById('exampleTabContent');
    if (!c) return;
    if (tab==='basic') showExampleBasic(c);
    else if (tab==='intimate') showExampleIntimate(c);
    else showExample4F(c);
}

function showExampleBasic(c) {
    const data = [['СБ','Самооборона',4,'#3b82ff'],['ТФ','Финансы',2,'#f39c12'],['УБ','Убеждения',5,'#ff6b3b'],['ЧВ','Чувства',3,'#a855f7']];
    c.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(255,107,59,0.1),rgba(255,59,59,0.05));
                    border:1px solid rgba(255,107,59,0.2);border-radius:24px;padding:24px;text-align:center;margin-bottom:12px;">
            <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,rgba(255,107,59,0.4),rgba(255,59,59,0.2));
                        border:2px solid rgba(255,107,59,0.4);margin:0 auto 12px;display:flex;align-items:center;
                        justify-content:center;font-size:26px;font-weight:700;color:#fff;">А</div>
            <div style="font-size:19px;font-weight:700;color:#fff;">Алексей</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);font-family:'SF Mono',monospace;margin-top:4px;letter-spacing:1px;">
                ПРАКТИКО-ОРИЕНТИРОВАННЫЙ · УР. 5
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:20px;margin-bottom:12px;">
            <div class="mirror-section-label">ВЕКТОРЫ ПОВЕДЕНИЯ</div>
            ${data.map(([k,name,v,col]) => `
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:13px;color:rgba(255,255,255,0.6);">${name} (${k})</span>
                        <span style="font-size:13px;font-weight:700;color:${col};">${v}/6</span>
                    </div>
                    <div class="mirror-vector-bar-track">
                        <div class="mirror-vector-bar-fill" style="width:${Math.round(v/6*100)}%;background:${col};"></div>
                    </div>
                </div>`).join('')}
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:20px;">
            <div class="mirror-section-label">ГЛУБИННЫЕ ПАТТЕРНЫ</div>
            ${[['Привязанность','Избегающий'],['Страхи','потеря контроля, зависимость'],['Убеждение','«Я должен справляться сам»']].map(([l,v])=>`
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);">${l}</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;text-align:right;max-width:60%;">${v}</span>
                </div>`).join('')}
        </div>`;
}

function showExampleIntimate(c) {
    c.innerHTML = `
        <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);
                    border-radius:20px;padding:20px;">
            <div style="font-size:12px;font-weight:700;color:#3b82ff;letter-spacing:0.8px;
                        text-transform:uppercase;margin-bottom:16px;">🔞 Интимный профиль — пример</div>

            <div style="margin-bottom:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">💋 ЧТО ВОЗБУЖДАЕТ</div>
                ${['Когда не торопят и дают время','Визуальные стимулы — важнее тактильных','Ощущение контроля в близости'].map(t=>
                    `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`
                ).join('')}
            </div>

            <div style="margin-bottom:16px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">❄️ ЧТО ГАСИТ ЖЕЛАНИЕ</div>
                ${['Давление и требования','Эмоциональные сцены перед близостью','Ощущение что его оценивают'].map(t=>
                    `<div style="font-size:13px;color:rgba(255,255,255,0.7);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`
                ).join('')}
            </div>

            <div style="background:rgba(59,130,246,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="font-size:11px;color:#3b82ff;letter-spacing:0.5px;margin-bottom:4px;">💡 Главная потребность</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">Ощущение свободы даже в близости</div>
            </div>

            <div style="background:rgba(255,107,59,0.08);border-radius:12px;padding:14px;">
                <div style="font-size:11px;color:#ff6b3b;letter-spacing:0.5px;margin-bottom:4px;">🎯 Как подойти</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);">Близость через общие задачи и проекты. Прикосновения как якорь — без давления.</div>
            </div>
        </div>`;
}

function showExample4F(c) {
    const keys = [
        ['🔥','1F','Ярость / Нападение','#ff6b3b',
            ['Критика при свидетелях','Обесценивание усилий','Игнорирование границ'],
            '«Я вижу как много ты сделал» — снижает напряжение',
            'Пауза 3 сек + имя'],
        ['🏃','2F','Страх / Бегство','#3b82ff',
            ['Вопросы о будущем','Требования и давление','Повышение голоса'],
            '«Я никуда не ухожу, просто поговорим»',
            'Без дедлайнов — безопасная среда'],
        ['🧬','3F','Желание / Секс','#a855f7',
            ['Особая интонация','Зрительный контакт 4+ сек','Неожиданные касания'],
            'Слова: «только мы», «никуда не торопимся»',
            'Плечо → запястье → основание шеи'],
        ['🍽','4F','Деньги / Поглощение','#f39c12',
            ['Упоминание конкурентов','Идеи заработка','Вызов'],
            '«Как думаешь, можно это монетизировать?»',
            'Задача с измеримым результатом'],
    ];
    c.innerHTML = keys.map(([emoji,code,title,col,triggers,key,tech],idx) => `
        <div class="mirror-4f-card" style="border-color:${col};animation-delay:${idx*0.08}s">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <span style="font-size:20px;">${emoji}</span>
                <div style="font-size:14px;font-weight:700;color:#fff;">${code} — ${title}</div>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:8px;">🎯 ТРИГГЕРЫ</div>
            ${triggers.map(t=>`<div style="font-size:13px;color:rgba(255,255,255,0.65);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">• ${t}</div>`).join('')}
            <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:12px;margin-top:12px;">
                <div style="font-size:11px;color:${col};letter-spacing:0.5px;margin-bottom:4px;">🔑 КЛЮЧ</div>
                <div style="font-size:13px;font-weight:600;color:#fff;">${key}</div>
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:10px;">⚡ ${tech}</div>
        </div>`).join('');
}

// ============================================
// ЭКСПОРТ
// ============================================
window.showMirrorsScreen = showMirrorsScreen;
window.switchMirrorTab = switchMirrorTab;
window.generateMirrorLink = generateMirrorLink;
window.copyMirrorLink = copyMirrorLink;
window.shareMirrorLink = shareMirrorLink;
window.showFriendProfile = showFriendProfile;
window.loadIntimateProfile = loadIntimateProfile;
window.load4FKeys = load4FKeys;
window.showProfileExample = showProfileExample;
window.switchExampleTab = switchExampleTab;
