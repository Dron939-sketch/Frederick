// ============================================
// admin.js — Секретная комната
// Версия 1.0
// ============================================

let adminState = {
    isLoading: true,
    activeTab: 'overview',
    stats: { totalUsers: 0, newUsersWeek: 0, testsCompleted: 0, totalMessages: 0 },
    systemStatus: { database: true, ai_service: true, voice_service: true },
    mirrors: {
        totalCreated: 0, totalCompleted: 0, conversionRate: 0,
        byPlatform: { telegram: 0, max: 0, web: 0 },
        recentMirrors: [], topSharers: []
    }
};

// ============================================
// ВХОД
// ============================================
function openSecretRoom() {
    if (isAdmin()) {
        renderAdminDashboard();
    } else {
        showAdminLogin();
    }
    // Закрываем мобильное меню
    document.getElementById('chatsPanel')?.classList.remove('open');
}

function isAdmin() {
    return localStorage.getItem('admin_key') === 'fredi_admin_2024';
}

function showAdminLogin() {
    const container = document.getElementById('screenContainer');
    container.innerHTML = `
        <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="width:100%;max-width:360px;">

                <div style="text-align:center;margin-bottom:40px;">
                    <div style="font-size:52px;margin-bottom:12px;">🔐</div>
                    <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Секретная комната</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.35);margin-top:6px;">Только для администраторов</div>
                </div>

                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
                            border-radius:20px;padding:24px;">
                    <input type="password" id="adminPasswordInput"
                        placeholder="Ключ доступа"
                        style="width:100%;padding:14px 16px;background:rgba(0,0,0,0.4);
                               border:1px solid rgba(255,255,255,0.1);border-radius:12px;
                               color:#fff;font-size:15px;font-family:inherit;outline:none;
                               box-sizing:border-box;margin-bottom:12px;
                               transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='rgba(255,59,59,0.5)'"
                        onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
                        onkeydown="if(event.key==='Enter') adminLogin()">
                    <button onclick="adminLogin()"
                        style="width:100%;padding:14px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                               border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;
                               cursor:pointer;font-family:inherit;letter-spacing:0.5px;
                               box-shadow:0 6px 24px rgba(255,59,59,0.3);transition:opacity 0.2s;"
                        onmouseover="this.style.opacity='0.85'"
                        onmouseout="this.style.opacity='1'">
                        ВОЙТИ
                    </button>
                    <div id="adminLoginError"
                        style="display:none;margin-top:10px;text-align:center;
                               font-size:12px;color:rgba(255,59,59,0.8);">
                        Неверный ключ доступа
                    </div>
                </div>
            </div>
        </div>`;
}

function adminLogin() {
    const val = document.getElementById('adminPasswordInput')?.value;
    if (val === 'fredi_admin_2024') {
        localStorage.setItem('admin_key', val);
        renderAdminDashboard();
    } else {
        const err = document.getElementById('adminLoginError');
        if (err) { err.style.display='block'; setTimeout(()=>err.style.display='none',2000); }
    }
}

// ============================================
// ГЛАВНАЯ ПАНЕЛЬ
// ============================================
async function renderAdminDashboard() {
    const container = document.getElementById('screenContainer');
    container.innerHTML = `
        <div style="max-width:800px;margin:0 auto;padding:20px 16px;
                    padding-bottom:max(80px,calc(env(safe-area-inset-bottom,0px)+80px));">

            <!-- ШАПКА -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;border-radius:12px;
                                background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                                display:flex;align-items:center;justify-content:center;font-size:20px;
                                box-shadow:0 6px 20px rgba(255,59,59,0.3);">🔐</div>
                    <div>
                        <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Секретная комната</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">Административная панель</div>
                    </div>
                </div>
                <button onclick="adminLogout()"
                    style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                           border-radius:10px;padding:8px 14px;color:rgba(255,255,255,0.4);
                           font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.2s;"
                    onmouseover="this.style.color='#fff'"
                    onmouseout="this.style.color='rgba(255,255,255,0.4)'">
                    Выйти
                </button>
            </div>

            <!-- ТАБЫ -->
            <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);
                        border:1px solid rgba(255,255,255,0.07);border-radius:14px;
                        padding:4px;margin-bottom:24px;overflow-x:auto;">
                ${[['overview','📊 Обзор'],['mirrors','🪞 Зеркала'],['system','⚙️ Система']].map(([id,label])=>`
                    <button id="admin-tab-${id}" onclick="switchAdminTab('${id}')"
                        style="flex:1;min-width:80px;padding:10px 8px;border:none;border-radius:10px;
                               font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;
                               transition:all 0.25s;white-space:nowrap;
                               ${id==='overview'?'background:linear-gradient(135deg,#ff6b3b,#ff3b3b);color:#fff;box-shadow:0 4px 16px rgba(255,59,59,0.3);':'background:transparent;color:rgba(255,255,255,0.4);'}">
                        ${label}
                    </button>`).join('')}
            </div>

            <div id="adminTabContent">
                <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">
                    <div style="font-size:32px;margin-bottom:8px;">⏳</div>
                    <div>Загружаю данные...</div>
                </div>
            </div>
        </div>`;

    await loadAllAdminData();
    switchAdminTab('overview');
}

function switchAdminTab(tab) {
    adminState.activeTab = tab;
    ['overview','mirrors','system'].forEach(id => {
        const btn = document.getElementById('admin-tab-'+id);
        if (!btn) return;
        if (id === tab) {
            btn.style.background = 'linear-gradient(135deg,#ff6b3b,#ff3b3b)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 16px rgba(255,59,59,0.3)';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'rgba(255,255,255,0.4)';
            btn.style.boxShadow = 'none';
        }
    });
    const content = document.getElementById('adminTabContent');
    if (!content) return;
    if (tab === 'overview') renderOverviewTab(content);
    else if (tab === 'mirrors') renderMirrorsTab(content);
    else renderSystemTab(content);
}

function adminLogout() {
    localStorage.removeItem('admin_key');
    if (typeof renderDashboard === 'function') renderDashboard();
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================
async function loadAllAdminData() {
    const apiUrl = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    try {
        // Системный статус
        const health = await fetch(`${apiUrl}/health`).then(r=>r.json()).catch(()=>({}));
        adminState.systemStatus = health.services || { database: true, ai_service: true, voice_service: true };

        // Статистика пользователей
        const stats = await fetch(`${apiUrl}/admin/stats`).then(r=>r.json()).catch(()=>({}));
        if (stats.total_users !== undefined) {
            adminState.stats = {
                totalUsers: stats.total_users || 0,
                activeToday: stats.active_today || 0,
                totalMessages: stats.total_messages || 0,
                testsCompleted: stats.total_tests || 0
            };
        }
    } catch(e) {
        console.log('Admin data partial load:', e);
    }
    adminState.isLoading = false;
}

// ============================================
// ТАБ: ОБЗОР
// ============================================
function renderOverviewTab(container) {
    const s = adminState.stats;
    const cards = [
        ['👥', 'Всего пользователей', s.totalUsers || '—', '#ff6b3b'],
        ['🟢', 'Активны сегодня', s.activeToday || '—', '#27ae60'],
        ['📊', 'Тестов пройдено', s.testsCompleted || '—', '#3b82ff'],
        ['💬', 'Сообщений всего', s.totalMessages || '—', '#f39c12'],
    ];

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
            ${cards.map(([emoji,label,val,col])=>`
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                            border-radius:18px;padding:18px;text-align:center;">
                    <div style="font-size:26px;margin-bottom:6px;">${emoji}</div>
                    <div style="font-size:26px;font-weight:700;color:${col};line-height:1;">${val}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px;letter-spacing:0.3px;">${label}</div>
                </div>`).join('')}
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">БЫСТРЫЕ ДЕЙСТВИЯ</div>
            ${[
                ['🔄','Обновить данные','loadAllAdminData().then(()=>switchAdminTab(adminState.activeTab))'],
                ['🪞','Открыть Зеркала',"switchAdminTab('mirrors')"],
                ['⚙️','Статус системы',"switchAdminTab('system')"],
            ].map(([emoji,label,action])=>`
                <div onclick="${action}"
                    style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;
                           cursor:pointer;transition:background 0.2s;margin-bottom:4px;"
                    onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                    onmouseout="this.style.background='transparent'">
                    <span style="font-size:18px;">${emoji}</span>
                    <span style="font-size:14px;color:rgba(255,255,255,0.7);">${label}</span>
                    <span style="margin-left:auto;color:rgba(255,255,255,0.2);">›</span>
                </div>`).join('')}
        </div>`;
}

// ============================================
// ТАБ: ЗЕРКАЛА
// ============================================
async function renderMirrorsTab(container) {
    container.innerHTML = `
        <div style="text-align:center;padding:32px;color:rgba(255,255,255,0.3);">
            <div style="font-size:28px;margin-bottom:8px;">⏳</div>
            <div style="font-size:13px;">Загружаю статистику зеркал...</div>
        </div>`;

    const apiUrl = window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';

    // Пробуем загрузить реальные данные
    let m = {
        totalCreated: 0, totalCompleted: 0, conversionRate: 0,
        byPlatform: { telegram: 0, max: 0, web: 0 },
        recentMirrors: [], topSharers: []
    };

    try {
        const res = await fetch(`${apiUrl}/api/admin/mirrors-stats`).then(r=>r.json()).catch(()=>({}));
        if (res.success) m = res.stats;
    } catch(e) {}

    const conv = m.totalCreated ? Math.round(m.totalCompleted/m.totalCreated*100) : 0;

    container.innerHTML = `
        <!-- СТАТЫ -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
            ${[
                ['🪞', m.totalCreated, 'Создано зеркал', '#ff6b3b'],
                ['✅', m.totalCompleted, 'Завершено', '#27ae60'],
                ['📈', conv+'%', 'Конверсия', '#3b82ff'],
                ['⏳', m.totalCreated-m.totalCompleted, 'В ожидании', '#f39c12'],
            ].map(([e,v,l,c])=>`
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                            border-radius:16px;padding:16px;text-align:center;">
                    <div style="font-size:22px;margin-bottom:4px;">${e}</div>
                    <div style="font-size:24px;font-weight:700;color:${c};">${v}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px;">${l}</div>
                </div>`).join('')}
        </div>

        <!-- ПО ПЛАТФОРМАМ -->
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">📱 ПО ПЛАТФОРМАМ</div>
            ${[
                ['✈️','Telegram',m.byPlatform.telegram,'#0088cc'],
                ['⚡','MAX',m.byPlatform.max,'#ff6b3b'],
                ['🌐','Web',m.byPlatform.web,'rgba(255,255,255,0.4)'],
            ].map(([e,name,count,col])=>{
                const total = m.totalCreated || 1;
                const pct = Math.round(count/total*100);
                return `
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span>${e}</span>
                            <span style="font-size:13px;color:rgba(255,255,255,0.6);">${name}</span>
                        </div>
                        <span style="font-size:13px;font-weight:700;color:#fff;">${count}</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.06);border-radius:4px;height:4px;">
                        <div style="width:${pct}%;height:100%;background:${col};border-radius:4px;transition:width 0.6s;"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>

        <!-- ТОП ШАРЕРОВ -->
        ${m.topSharers?.length ? `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">🏆 ТОП ШАРЕРОВ</div>
            ${m.topSharers.map((s,i)=>`
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                            border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div style="width:28px;height:28px;border-radius:50%;
                                background:${i===0?'linear-gradient(135deg,#f39c12,#e67e22)':i===1?'linear-gradient(135deg,rgba(255,255,255,0.3),rgba(255,255,255,0.1))':'rgba(255,255,255,0.08)'};
                                display:flex;align-items:center;justify-content:center;
                                font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${i+1}</div>
                    <div style="flex:1;font-size:13px;color:#fff;">${s.user_name}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.4);">${s.count} ссылок</div>
                    <div style="font-size:12px;color:#27ae60;">✅ ${s.completed}</div>
                </div>`).join('')}
        </div>` : ''}

        <!-- ПОСЛЕДНИЕ -->
        ${m.recentMirrors?.length ? `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">📋 ПОСЛЕДНИЕ ЗЕРКАЛА</div>
            ${m.recentMirrors.slice(0,5).map(mir=>`
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                            border-bottom:1px solid rgba(255,255,255,0.04);">
                    <span style="font-size:20px;">${mir.platform==='telegram'?'✈️':mir.platform==='max'?'⚡':'🌐'}</span>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;color:#fff;">${mir.user_name}</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.3);">${mir.created_at}</div>
                    </div>
                    ${mir.completed ?
                        `<div style="text-align:right;">
                            <div style="font-size:12px;color:#27ae60;">✅ Отражение</div>
                            <div style="font-size:10px;color:rgba(255,255,255,0.3);">→ ${mir.friend_name}</div>
                         </div>` :
                        `<div style="font-size:12px;color:#f39c12;">⏳ Ожидает</div>`}
                </div>`).join('')}
        </div>` : `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:24px;text-align:center;color:rgba(255,255,255,0.3);">
            <div style="font-size:32px;margin-bottom:8px;">🪞</div>
            <div style="font-size:13px;">Зеркала пока не созданы</div>
        </div>`}`;
}

// ============================================
// ТАБ: СИСТЕМА
// ============================================
function renderSystemTab(container) {
    const s = adminState.systemStatus;
    const services = [
        ['🗄️', 'База данных', s.database],
        ['🤖', 'AI-сервис', s.ai_service],
        ['🎙️', 'Голос', s.voice_service],
        ['🔌', 'WebSocket', s.websocket !== false],
    ];

    container.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">⚙️ СТАТУС СЕРВИСОВ</div>
            ${services.map(([e,name,ok])=>`
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;
                            border-bottom:1px solid rgba(255,255,255,0.04);">
                    <span style="font-size:18px;">${e}</span>
                    <span style="flex:1;font-size:13px;color:rgba(255,255,255,0.7);">${name}</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:8px;height:8px;border-radius:50%;
                                    background:${ok?'#27ae60':'#e74c3c'};
                                    box-shadow:0 0 6px ${ok?'rgba(39,174,96,0.6)':'rgba(231,76,60,0.6)'};"></div>
                        <span style="font-size:12px;color:${ok?'#27ae60':'#e74c3c'};">${ok?'OK':'ОШИБКА'}</span>
                    </div>
                </div>`).join('')}
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                    border-radius:18px;padding:18px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:rgba(255,255,255,0.3);
                        text-transform:uppercase;margin-bottom:14px;">🔗 ЭНДПОИНТЫ</div>
            ${[
                ['Health Check','/health'],
                ['Admin Stats','/admin/stats'],
                ['Mirrors Stats','/api/admin/mirrors-stats'],
                ['User Status','/api/user-status'],
            ].map(([name,path])=>`
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <span style="font-size:13px;color:rgba(255,255,255,0.6);">${name}</span>
                    <a href="${(window.API_BASE_URL||'https://fredi-backend-flz2.onrender.com')+path}"
                        target="_blank"
                        style="font-size:10px;color:rgba(255,255,255,0.3);text-decoration:none;
                               font-family:'SF Mono',monospace;letter-spacing:0.3px;">
                        ${path} ›
                    </a>
                </div>`).join('')}
        </div>

        <button onclick="loadAllAdminData().then(()=>switchAdminTab('system'))"
            style="width:100%;padding:14px;background:rgba(255,255,255,0.05);
                   border:1px solid rgba(255,255,255,0.1);border-radius:14px;
                   color:rgba(255,255,255,0.6);font-size:13px;font-weight:600;
                   cursor:pointer;font-family:inherit;transition:all 0.2s;"
            onmouseover="this.style.background='rgba(255,255,255,0.1)'"
            onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            🔄 Обновить статус
        </button>`;
}

// Экспорт
window.openSecretRoom = openSecretRoom;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.switchAdminTab = switchAdminTab;
window.renderMirrorsTab = renderMirrorsTab;
