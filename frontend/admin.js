// ============================================
// admin.js — Секретная комната v2.0
// ============================================

let adminState = {
    activeTab: 'overview',
    stats: {},
    mirrors: {},
    recentUsers: [],
    systemStatus: {}
};

// ============================================
// СТИЛИ
// ============================================
(function() {
    if (document.getElementById('admin-styles')) return;
    const s = document.createElement('style');
    s.id = 'admin-styles';
    s.textContent = `
        @keyframes adminFadeIn {
            from { opacity:0; transform:translateY(12px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .adm-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 18px;
            padding: 18px;
            margin-bottom: 14px;
            animation: adminFadeIn 0.3s ease both;
        }
        .adm-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.28);
            margin-bottom: 12px;
        }
        .adm-tab-btn {
            flex: 1;
            padding: 10px 6px;
            border: none;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.22s;
            white-space: nowrap;
        }
        .adm-tab-btn.on {
            background: linear-gradient(135deg,#ff6b3b,#ff3b3b);
            color: #fff;
            box-shadow: 0 4px 14px rgba(255,59,59,0.3);
        }
        .adm-tab-btn.off {
            background: transparent;
            color: rgba(255,255,255,0.38);
        }
        .adm-tab-btn.off:hover { color: rgba(255,255,255,0.7); }
        .adm-row {
            display: flex;
            align-items: center;
            padding: 11px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            gap: 12px;
        }
        .adm-row:last-child { border-bottom: none; }
        .adm-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .adm-bar-track {
            background: rgba(255,255,255,0.06);
            border-radius: 4px; height: 4px; overflow: hidden; margin-top: 5px;
        }
        .adm-bar-fill { height:100%; border-radius:4px; transition: width 0.7s ease; }
    `;
    document.head.appendChild(s);
})();

// ============================================
// ВХОД / ВЫХОД
// ============================================
function openSecretRoom() {
    document.getElementById('chatsPanel')?.classList.remove('open');
    if (localStorage.getItem('admin_key') === 'fredi_admin_2024') {
        renderAdminDashboard();
    } else {
        showAdminLogin();
    }
}

function showAdminLogin() {
    document.getElementById('screenContainer').innerHTML = `
        <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;">
          <div style="width:100%;max-width:340px;">
            <div style="text-align:center;margin-bottom:36px;">
              <div style="font-size:52px;margin-bottom:10px;">🔐</div>
              <div style="font-size:21px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Секретная комната</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:5px;">Только для администраторов</div>
            </div>
            <div class="adm-card" style="padding:22px;">
              <input type="password" id="adminPwd" placeholder="Ключ доступа"
                style="width:100%;padding:13px 15px;background:rgba(0,0,0,0.5);
                       border:1px solid rgba(255,255,255,0.1);border-radius:12px;
                       color:#fff;font-size:15px;font-family:inherit;outline:none;
                       box-sizing:border-box;margin-bottom:12px;transition:border-color 0.2s;"
                onfocus="this.style.borderColor='rgba(255,107,59,0.5)'"
                onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
                onkeydown="if(event.key==='Enter')adminLogin()">
              <button onclick="adminLogin()"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                       border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;
                       cursor:pointer;font-family:inherit;box-shadow:0 5px 20px rgba(255,59,59,0.3);">
                ВОЙТИ →
              </button>
              <div id="adminErr" style="display:none;margin-top:10px;text-align:center;
                                        font-size:12px;color:rgba(255,80,80,0.9);">
                Неверный ключ
              </div>
            </div>
          </div>
        </div>`;
}

function adminLogin() {
    if ((document.getElementById('adminPwd')?.value||'') === 'fredi_admin_2024') {
        localStorage.setItem('admin_key','fredi_admin_2024');
        renderAdminDashboard();
    } else {
        const e = document.getElementById('adminErr');
        if (e) { e.style.display='block'; setTimeout(()=>e.style.display='none',2000); }
    }
}

function adminLogout() {
    localStorage.removeItem('admin_key');
    if (typeof renderDashboard==='function') renderDashboard();
}

// ============================================
// ГЛАВНЫЙ ДАШБОРД
// ============================================
async function renderAdminDashboard() {
    const API = window.API_BASE_URL||'https://fredi-backend-flz2.onrender.com';
    document.getElementById('screenContainer').innerHTML = `
        <div style="max-width:760px;margin:0 auto;padding:20px 16px;
                    padding-bottom:max(80px,calc(env(safe-area-inset-bottom,0px)+80px));">

          <!-- ШАПКА -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:42px;height:42px;border-radius:12px;
                          background:linear-gradient(135deg,#ff6b3b,#ff3b3b);
                          display:flex;align-items:center;justify-content:center;font-size:18px;
                          box-shadow:0 5px 18px rgba(255,59,59,0.3);">🔐</div>
              <div>
                <div style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.4px;">Секретная комната</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.28);margin-top:1px;">Административная панель</div>
              </div>
            </div>
            <button onclick="adminLogout()"
              style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);
                     border-radius:10px;padding:7px 13px;color:rgba(255,255,255,0.35);
                     font-size:11px;cursor:pointer;font-family:inherit;transition:color 0.2s;"
              onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">
              Выйти
            </button>
          </div>

          <!-- ТАБЫ -->
          <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);
                      border:1px solid rgba(255,255,255,0.07);border-radius:13px;
                      padding:4px;margin-bottom:22px;overflow-x:auto;">
            ${[['overview','📊 Обзор'],['mirrors','🪞 Зеркала'],['users','👥 Пользователи'],['system','⚙️ Система']].map(([id,label])=>`
              <button class="adm-tab-btn ${id==='overview'?'on':'off'}"
                id="adm-tab-${id}" onclick="adminTab('${id}')">${label}</button>`).join('')}
          </div>

          <div id="admContent">
            <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">
              <div style="font-size:28px;margin-bottom:8px;">⏳</div>
              <div style="font-size:13px;">Загружаю данные...</div>
            </div>
          </div>
        </div>`;

    // Параллельная загрузка всех данных
    const [statsRes, healthRes, mirrorsRes] = await Promise.allSettled([
        fetch(`${API}/admin/stats`).then(r=>r.json()),
        fetch(`${API}/health`).then(r=>r.json()),
        fetch(`${API}/api/admin/mirrors-stats`).then(r=>r.json()),
    ]);

    adminState.stats   = statsRes.status==='fulfilled' ? statsRes.value : {};
    adminState.systemStatus = healthRes.status==='fulfilled' ? (healthRes.value.services||{}) : {};
    adminState.mirrors = mirrorsRes.status==='fulfilled' && mirrorsRes.value.success
                         ? mirrorsRes.value.stats : getDemoMirrors();

    adminTab('overview');
}

function adminTab(tab) {
    adminState.activeTab = tab;
    ['overview','mirrors','users','system'].forEach(id => {
        const b = document.getElementById('adm-tab-'+id);
        if (!b) return;
        b.className = 'adm-tab-btn ' + (id===tab?'on':'off');
    });
    const c = document.getElementById('admContent');
    if (!c) return;
    if (tab==='overview') renderOverview(c);
    else if (tab==='mirrors') renderMirrors(c);
    else if (tab==='users') renderUsers(c);
    else renderSystem(c);
}

// ============================================
// ОБЗОР
// ============================================
function renderOverview(c) {
    const s = adminState.stats;
    const m = adminState.mirrors;
    const conv = m.totalCreated ? Math.round(m.totalCompleted/m.totalCreated*100) : 0;

    const bigCards = [
        ['👥', s.total_users||0,       'Всего пользователей', '#e0e0e0'],
        ['🟢', s.active_today||0,      'Активны сегодня',     '#27ae60'],
        ['📊', s.total_tests||0,        'Тестов пройдено',    '#00d4ff'],
        ['💬', s.total_messages||0,     'Сообщений',          '#f39c12'],
        ['🪞', m.totalCreated||0,       'Зеркал создано',     '#ff6b3b'],
        ['✅', m.totalCompleted||0,     'Зеркал сработало',   '#27ae60'],
        ['📈', conv+'%',                'Конверсия зеркал',   '#a855f7'],
        ['🌐', (s.modes_distribution||[]).length, 'Режимов активно', '#3b82ff'],
    ];

    c.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
          ${bigCards.map(([e,v,l,col],i)=>`
            <div class="adm-card" style="padding:16px;text-align:center;animation-delay:${i*0.04}s">
              <div style="font-size:22px;margin-bottom:5px;">${e}</div>
              <div style="font-size:26px;font-weight:700;color:${col};line-height:1.1;">${v}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:5px;letter-spacing:0.3px;">${l}</div>
            </div>`).join('')}
        </div>

        ${(s.modes_distribution||[]).length ? `
        <div class="adm-card">
          <div class="adm-label">📱 Режимы общения</div>
          ${(s.modes_distribution||[]).map(m=>`
            <div class="adm-row">
              <span style="font-size:13px;color:rgba(255,255,255,0.6);flex:1;">${m.mode||'—'}</span>
              <span style="font-size:14px;font-weight:700;color:#fff;">${m.count}</span>
            </div>`).join('')}
        </div>` : ''}

        <button onclick="renderAdminDashboard()"
          style="width:100%;padding:12px;background:rgba(255,255,255,0.04);
                 border:1px solid rgba(255,255,255,0.09);border-radius:13px;
                 color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;font-family:inherit;">
          🔄 Обновить данные
        </button>`;
}

// ============================================
// ЗЕРКАЛА
// ============================================
function renderMirrors(c) {
    const m = adminState.mirrors;
    const conv = m.totalCreated ? Math.round(m.totalCompleted/m.totalCreated*100) : 0;
    const pending = (m.totalCreated||0) - (m.totalCompleted||0);
    const platforms = m.byPlatform||{telegram:0,max:0,web:0};
    const total = m.totalCreated||1;

    c.innerHTML = `
        <!-- 4 ЦИФРЫ -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
          ${[
            ['🪞',m.totalCreated||0,'Создано зеркал','#e0e0e0'],
            ['✅',m.totalCompleted||0,'Сработало','#27ae60'],
            ['📈',conv+'%','Конверсия','#00d4ff'],
            ['⏳',pending,'В ожидании','#f39c12'],
          ].map(([e,v,l,col],i)=>`
            <div class="adm-card" style="padding:16px;text-align:center;animation-delay:${i*0.05}s">
              <div style="font-size:20px;margin-bottom:4px;">${e}</div>
              <div style="font-size:26px;font-weight:700;color:${col};line-height:1.1;">${v}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:5px;">${l}</div>
            </div>`).join('')}
        </div>

        <!-- ПО ПЛАТФОРМАМ -->
        <div class="adm-card">
          <div class="adm-label">📱 По платформам</div>
          ${[
            ['✈️','Telegram', platforms.telegram||0, '#0088cc'],
            ['⚡','MAX',      platforms.max||0,      '#ff6b3b'],
            ['🌐','Web',      platforms.web||0,      '#00d4ff'],
          ].map(([e,name,cnt,col])=>`
            <div style="margin-bottom:13px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <div style="display:flex;align-items:center;gap:7px;">
                  <span>${e}</span>
                  <span style="font-size:13px;color:rgba(255,255,255,0.6);">${name}</span>
                </div>
                <span style="font-size:13px;font-weight:700;color:#fff;">${cnt}</span>
              </div>
              <div class="adm-bar-track">
                <div class="adm-bar-fill" style="width:${Math.round(cnt/total*100)}%;background:${col};"></div>
              </div>
            </div>`).join('')}
        </div>

        <!-- ТОП ШАРЕРОВ -->
        ${(m.topSharers||[]).length ? `
        <div class="adm-card">
          <div class="adm-label">🏆 Топ шареров</div>
          ${(m.topSharers||[]).map((s,i)=>`
            <div class="adm-row">
              <div style="width:26px;height:26px;border-radius:50%;flex-shrink:0;
                          background:${i===0?'linear-gradient(135deg,#f39c12,#e67e22)':i===1?'rgba(192,192,192,0.3)':'rgba(255,255,255,0.08)'};
                          display:flex;align-items:center;justify-content:center;
                          font-size:11px;font-weight:700;color:#fff;">${i+1}</div>
              <span style="flex:1;font-size:13px;color:#fff;">${s.user_name||'—'}</span>
              <span style="font-size:12px;color:rgba(255,255,255,0.4);">${s.count} ссыл.</span>
              <span style="font-size:12px;color:#27ae60;margin-left:8px;">✅ ${s.completed}</span>
            </div>`).join('')}
        </div>` : ''}

        <!-- ПОСЛЕДНИЕ ЗЕРКАЛА -->
        ${(m.recentMirrors||[]).length ? `
        <div class="adm-card">
          <div class="adm-label">📋 Последние зеркала</div>
          ${(m.recentMirrors||[]).slice(0,8).map(r=>`
            <div class="adm-row">
              <span style="font-size:18px;">${r.platform==='telegram'?'✈️':r.platform==='max'?'⚡':'🌐'}</span>
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:600;color:#fff;">${r.user_name||'—'}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.28);">${(r.created_at||'').substring(0,16)}</div>
              </div>
              ${r.completed
                ? `<div style="text-align:right;">
                     <div style="font-size:11px;color:#27ae60;">✅ ${r.friend_name||'друг'}</div>
                   </div>`
                : `<div style="font-size:11px;color:#f39c12;">⏳ ждёт</div>`}
            </div>`).join('')}
        </div>` : `
        <div class="adm-card" style="text-align:center;padding:24px;color:rgba(255,255,255,0.3);">
          <div style="font-size:28px;margin-bottom:8px;">🪞</div>
          <div style="font-size:13px;">Зеркал ещё нет</div>
        </div>`}`;
}

// ============================================
// ПОЛЬЗОВАТЕЛИ
// ============================================
async function renderUsers(c) {
    c.innerHTML = `<div style="text-align:center;padding:32px;color:rgba(255,255,255,0.3);font-size:13px;">⏳ Загружаю...</div>`;
    const API = window.API_BASE_URL||'https://fredi-backend-flz2.onrender.com';
    let users = [];
    try {
        const res = await fetch(`${API}/api/admin/recent-users`).then(r=>r.json());
        if (res.success) users = res.users||[];
    } catch(e) {}

    const s = adminState.stats;
    c.innerHTML = `
        <!-- СВОДКА -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
          ${[
            ['👥', s.total_users||0,  'Всего', '#e0e0e0'],
            ['🟢', s.active_today||0, 'Сегодня', '#27ae60'],
            ['📊', s.total_tests||0,  'Тестов', '#00d4ff'],
          ].map(([e,v,l,col])=>`
            <div class="adm-card" style="padding:14px;text-align:center;">
              <div style="font-size:18px;margin-bottom:4px;">${e}</div>
              <div style="font-size:22px;font-weight:700;color:${col};">${v}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px;">${l}</div>
            </div>`).join('')}
        </div>

        <!-- СПИСОК -->
        <div class="adm-card">
          <div class="adm-label">👤 Последние пользователи</div>
          ${users.length ? users.map(u=>`
            <div class="adm-row">
              <div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;
                          background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);
                          display:flex;align-items:center;justify-content:center;
                          font-size:13px;font-weight:700;color:#fff;">
                ${(u.username||u.first_name||'?').charAt(0).toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;color:#fff;">
                  ${u.username ? '@'+u.username : u.first_name||'Пользователь'}
                </div>
                <div style="font-size:10px;color:rgba(255,255,255,0.28);">
                  ID: ${u.user_id} · ${(u.last_activity||'').substring(0,10)}
                </div>
              </div>
              ${u.profile_code ? `
                <div style="background:rgba(255,255,255,0.06);border-radius:6px;padding:3px 8px;
                            font-size:10px;color:rgba(255,255,255,0.4);font-family:monospace;">
                  ${u.profile_code}
                </div>` : ''}
            </div>`).join('')
          : `<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.3);font-size:13px;">
               Эндпоинт /api/admin/recent-users не подключён
             </div>`}
        </div>`;
}

// ============================================
// СИСТЕМА
// ============================================
function renderSystem(c) {
    const ss = adminState.systemStatus;
    const API = window.API_BASE_URL||'https://fredi-backend-flz2.onrender.com';

    const services = [
        ['🗄️','База данных',   ss.database],
        ['🤖','AI сервис',     ss.ai_service],
        ['🎙️','Голос (TTS/STT)',ss.voice_service],
        ['🔌','WebSocket',     ss.websocket!==false],
        ['🟢','Redis',         ss.redis],
    ];

    const endpoints = [
        ['/health',                    'Health Check'],
        ['/admin/stats',               'Admin Stats'],
        ['/api/admin/mirrors-stats',   'Mirrors Stats'],
        ['/api/admin/recent-users',    'Recent Users'],
        ['/api/mirrors/213102077/reflections', 'Test Mirrors API'],
    ];

    c.innerHTML = `
        <div class="adm-card">
          <div class="adm-label">⚙️ Статус сервисов</div>
          ${services.map(([e,name,ok])=>`
            <div class="adm-row">
              <span style="font-size:17px;">${e}</span>
              <span style="flex:1;font-size:13px;color:rgba(255,255,255,0.65);">${name}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="adm-dot" style="background:${ok?'#27ae60':'#e74c3c'};
                  box-shadow:0 0 6px ${ok?'rgba(39,174,96,0.6)':'rgba(231,76,60,0.6)'};"></div>
                <span style="font-size:12px;color:${ok?'#27ae60':'#e74c3c'};">${ok?'OK':'ОШИБКА'}</span>
              </div>
            </div>`).join('')}
        </div>

        <div class="adm-card">
          <div class="adm-label">🔗 Эндпоинты бэкенда</div>
          ${endpoints.map(([path,name])=>`
            <div class="adm-row">
              <span style="flex:1;font-size:12px;color:rgba(255,255,255,0.6);">${name}</span>
              <a href="${API+path}" target="_blank"
                style="font-size:10px;color:rgba(255,255,255,0.3);text-decoration:none;
                       font-family:'SF Mono',monospace;letter-spacing:0.2px;transition:color 0.2s;"
                onmouseover="this.style.color='#ff6b3b'"
                onmouseout="this.style.color='rgba(255,255,255,0.3)'">
                открыть ›
              </a>
            </div>`).join('')}
        </div>

        <button onclick="renderAdminDashboard()"
          style="width:100%;padding:12px;background:rgba(255,255,255,0.04);
                 border:1px solid rgba(255,255,255,0.09);border-radius:13px;
                 color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;font-family:inherit;
                 transition:all 0.2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'"
          onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.color='rgba(255,255,255,0.4)'">
          🔄 Обновить всё
        </button>`;
}

// ============================================
// ДЕМО-ДАННЫЕ (если нет эндпоинта)
// ============================================
function getDemoMirrors() {
    return {
        totalCreated: 0, totalCompleted: 0,
        byPlatform: { telegram: 0, max: 0, web: 0 },
        recentMirrors: [], topSharers: []
    };
}

window.openSecretRoom = openSecretRoom;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.adminTab = adminTab;
window.renderAdminDashboard = renderAdminDashboard;
window.renderUsers = renderUsers;
