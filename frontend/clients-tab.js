// fredi/clients-tab.js — вкладка «👥 Клиенты» для admin-analytics.html
// Self-injecting лоадер. Использует localStorage['fredi_admin_token'].
(function(){
  'use strict';
  var API = (window.API_BASE_URL) || 'https://fredi-backend-flz2.onrender.com';
  var LS = 'fredi_admin_token';
  var debTimer = null, currentSearch = '';

  function tok(){ try { return localStorage.getItem(LS) || ''; } catch(e){ return ''; } }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  async function api(path, opts){
    opts = opts || {};
    var h = { 'X-Admin-Token': tok(), 'Accept':'application/json' };
    if (opts.body) h['Content-Type'] = 'application/json';
    var r = await fetch(API + path, { method: opts.method||'GET', headers: h, body: opts.body?JSON.stringify(opts.body):undefined });
    if (r.status === 401) throw new Error('Неверный ADMIN_TOKEN');
    if (r.status === 503) throw new Error('ADMIN_TOKEN не задан на сервере');
    var j = null; try { j = await r.json(); } catch(e){}
    if (!r.ok){ var m = (j && (j.detail && (j.detail.message||j.detail.error)||j.error))||('HTTP '+r.status); throw new Error(m); }
    return j;
  }

  function injectUI(){
    var nav = document.getElementById('navBar');
    if (!nav){ return setTimeout(injectUI, 500); }
    if (document.getElementById('vkTabBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'vkTabBtn'; btn.dataset.tab = 'vk'; btn.textContent = '👥 Клиенты';
    btn.style.cssText = 'flex:0 0 auto';
    var exp = document.getElementById('exportClaudeBtn');
    if (exp) nav.insertBefore(btn, exp); else nav.appendChild(btn);

    var sec = document.createElement('section');
    sec.id = 'vkTab'; sec.style.display = 'none';
    sec.innerHTML =
      '<h2>VK-привязки</h2>' +
      '<div id="vkStats" class="kv-grid" style="margin-bottom:14px"></div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">' +
        '<div style="font-weight:600;margin-bottom:8px">➕ Привязать VK к юзеру</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:8px;align-items:start">' +
          '<div style="position:relative">' +
            '<input id="vkUserInput" type="text" placeholder="user_id или имя" autocomplete="off" style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit">' +
            '<div id="vkUserSuggest" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--surface);border:1px solid var(--border-hi);border-radius:8px;margin-top:4px;max-height:280px;overflow-y:auto;box-shadow:0 6px 24px rgba(0,0,0,0.4)"></div>' +
          '</div>' +
          '<input id="vkInput" type="text" placeholder="vk: id123, durov, vk.com/…" style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit">' +
          '<input id="vkNotes" type="text" placeholder="заметка (опц.)" style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit">' +
          '<button id="vkSubmit" style="padding:9px 18px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer">Привязать</button>' +
        '</div>' +
        '<div id="vkFormStatus" style="font-size:12px;color:var(--text-dim);margin-top:8px;min-height:14px"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">' +
        '<input id="vkSearch" type="text" placeholder="🔍 поиск по user_id, vk_id, имени…" style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit">' +
        '<button id="vkFunnel" style="padding:9px 14px;border-radius:8px;border:1px solid rgba(167,139,250,0.4);background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap" title="Воронка эффективности">📊 Воронка</button>' +
        '<button id="vkRefresh" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;cursor:pointer">🔄</button>' +
      '</div>' +
      // Phase 6/7: контролы поиска близнецов в отдельной строке (geo + min_intersections + re-rank)
      '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--text-dim)">' +
        '<span style="font-weight:600;color:var(--text)">Поиск близнецов:</span>' +
        '<label style="display:flex;align-items:center;gap:4px" title="Где искать">' +
          '<select id="vkGeoScope" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:12px;cursor:pointer">' +
            '<option value="same_city">🎯 город пациента</option>' +
            '<option value="russia">🎯 вся Россия</option>' +
          '</select>' +
        '</label>' +
        '<label style="display:flex;align-items:center;gap:4px" title="Минимум групп пересечения с marker_groups образца. 3 = более точно, меньше кандидатов">' +
          'мин. групп:' +
          '<select id="vkMinInt" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:12px;cursor:pointer">' +
            '<option value="1">1</option>' +
            '<option value="2">2</option>' +
            '<option value="3" selected>3</option>' +
            '<option value="4">4</option>' +
            '<option value="5">5</option>' +
          '</select>' +
        '</label>' +
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer" title="Дополнительная проверка через ИИ: посты кандидата сравниваются со слепком. Стоит DeepSeek-токенов и +30-60 сек на поиск.">' +
          '<input id="vkReRank" type="checkbox" style="cursor:pointer"> 🧠 ИИ-проверка постов' +
        '</label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:11px" title="Минимальный quality_score после ИИ-проверки (0..100). Кандидаты ниже отбрасываются как rejected.">' +
          'порог качества:' +
          '<input id="vkQualThr" type="number" min="0" max="100" value="60" style="width:50px;padding:5px 6px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:11px">' +
        '</label>' +
      '</div>' +
      '<div id="vkLinksTable"></div>';
    var container = document.querySelector('.container');
    if (container) container.appendChild(sec);

    var ov = document.createElement('div');
    ov.id = 'vkProfileOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;max-width:820px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.4)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)">' +
          '<div><div id="vkProfileTitle" style="font-weight:700;font-size:15px">Собирательный образ</div>' +
          '<div id="vkProfileSub" style="font-size:11px;color:var(--text-dim);margin-top:2px"></div></div>' +
          '<button id="vkProfileClose" style="background:transparent;border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);cursor:pointer;font:inherit">✕</button>' +
        '</div>' +
        '<div id="vkProfileBody" style="flex:1;overflow-y:auto;padding:14px 18px;background:rgba(0,0,0,0.02)"></div>' +
      '</div>';
    document.body.appendChild(ov);

    btn.addEventListener('click', activateVkTab);
    document.querySelectorAll('#navBar button').forEach(function(b){
      if (b.id === 'vkTabBtn' || b.id === 'exportClaudeBtn') return;
      b.addEventListener('click', deactivateVkTab);
    });
    document.getElementById('vkSubmit').addEventListener('click', submitLink);
    document.getElementById('vkRefresh').addEventListener('click', loadVkTab);
    document.getElementById('vkFunnel').addEventListener('click', openFunnel);
    document.getElementById('vkSearch').addEventListener('input', function(e){
      currentSearch = e.target.value;
      clearTimeout(debTimer);
      debTimer = setTimeout(loadLinks, 300);
    });
    document.getElementById('vkUserInput').addEventListener('input', function(e){
      clearTimeout(debTimer);
      var q = e.target.value;
      debTimer = setTimeout(function(){ suggestUsers(q); }, 250);
    });
    document.getElementById('vkUserInput').addEventListener('blur', function(){
      setTimeout(function(){ document.getElementById('vkUserSuggest').style.display='none'; }, 200);
    });
    document.getElementById('vkProfileClose').addEventListener('click', closeProfile);
    ov.addEventListener('click', function(e){ if (e.target === ov) closeProfile(); });

    // Phase 6: персистим выбор geo_scope в localStorage (две опции: same_city / russia).
    try {
      var savedGeo = localStorage.getItem('vk_geo_scope');
      if (savedGeo === 'same_city' || savedGeo === 'russia') {
        document.getElementById('vkGeoScope').value = savedGeo;
      }
    } catch(e) {}
    document.getElementById('vkGeoScope').addEventListener('change', function(e){
      try { localStorage.setItem('vk_geo_scope', e.target.value); } catch(_){}
    });
    // Phase 7: персистим min_intersections, re_rank, quality_threshold
    try {
      var sm = localStorage.getItem('vk_min_int');
      if (sm && ['1','2','3','4','5'].indexOf(sm) >= 0) document.getElementById('vkMinInt').value = sm;
      if (localStorage.getItem('vk_rerank') === '1') document.getElementById('vkReRank').checked = true;
      var sqt = localStorage.getItem('vk_qual_thr');
      if (sqt) document.getElementById('vkQualThr').value = sqt;
    } catch(_){}
    document.getElementById('vkMinInt').addEventListener('change', function(e){
      try { localStorage.setItem('vk_min_int', e.target.value); } catch(_){}
    });
    document.getElementById('vkReRank').addEventListener('change', function(e){
      try { localStorage.setItem('vk_rerank', e.target.checked ? '1' : '0'); } catch(_){}
    });
    document.getElementById('vkQualThr').addEventListener('change', function(e){
      try { localStorage.setItem('vk_qual_thr', e.target.value); } catch(_){}
    });
  }

  function activateVkTab(){
    document.querySelectorAll('#navBar button').forEach(function(x){ x.classList.remove('active'); });
    document.getElementById('vkTabBtn').classList.add('active');
    ['summaryTab','recentTab','dialogsTab'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    document.getElementById('vkTab').style.display = 'block';
    loadVkTab();
  }
  function deactivateVkTab(){
    var t = document.getElementById('vkTab'); if (t) t.style.display = 'none';
    var b = document.getElementById('vkTabBtn'); if (b) b.classList.remove('active');
  }

  async function loadVkTab(){ await Promise.all([loadStats(), loadLinks()]); }

  async function loadStats(){
    var box = document.getElementById('vkStats');
    if (!tok()){ box.innerHTML = '<div class="empty">Введи ADMIN_TOKEN сверху</div>'; return; }
    try {
      var s = await api('/api/admin/vk/stats');
      box.innerHTML =
        kvCard('Привязано', s.linked, 'юзеров с VK') +
        kvCard('С vk_id', s.with_vk_id, 'не только screen_name') +
        kvCard('Спарсено', s.parsed, 'vk_data заполнен') +
        kvCard('Покрытие', (s.coverage_pct||0)+' %', 'из ' + (s.total_users||0) + ' юзеров');
    } catch(e){ box.innerHTML = '<div class="err">'+esc(e.message)+'</div>'; }
  }

  async function loadLinks(){
    var box = document.getElementById('vkLinksTable');
    if (!tok()){ box.innerHTML = ''; return; }
    box.innerHTML = '<div class="empty">Загружаю…</div>';
    try {
      var d = await api('/api/admin/vk/links?limit=100&search=' + encodeURIComponent(currentSearch));
      renderLinks(d);
    } catch(e){ box.innerHTML = '<div class="err">'+esc(e.message)+'</div>'; }
  }

  function renderLinks(d){
    var items = (d && d.items) || [];
    if (!items.length){
      document.getElementById('vkLinksTable').innerHTML =
        '<div class="empty">Пока ничего не привязано. Введи user_id и VK сверху.</div>';
      return;
    }
    var rows = items.map(function(r){
      var vk = r.vk_id ? ('id'+r.vk_id) : (r.vk_screen_name||'—');
      var url = r.vk_id ? ('https://vk.com/id'+r.vk_id) : (r.vk_screen_name?('https://vk.com/'+r.vk_screen_name):'');
      var vkCell = url ? ('<a href="'+esc(url)+'" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">'+esc(vk)+' ↗</a>') : esc(vk);
      var when = r.linked_at ? new Date(r.linked_at).toLocaleString('ru-RU') : '';
      var parsed = r.parsed_at ? '<span title="vk_data есть" style="color:var(--success)">●</span>' : '<span title="не спарсен" style="color:var(--text-dim)">○</span>';
      return '<tr>' +
        '<td style="font-family:\'SF Mono\',Menlo,Consolas,monospace;font-size:12px">'+r.user_id+'</td>' +
        '<td>'+esc(r.user_name||'—')+'</td>' +
        '<td>'+vkCell+'</td>' +
        '<td style="text-align:center">'+parsed+'</td>' +
        '<td style="font-size:11px;color:var(--text-dim);white-space:nowrap">'+when+'</td>' +
        '<td style="font-size:12px;color:var(--text-dim)">'+esc(r.notes||'')+'</td>' +
        '<td style="text-align:right;white-space:nowrap">' +
          '<button data-act="profile" data-uid="'+r.user_id+'" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-hi);color:var(--text);font:inherit;font-size:12px;cursor:pointer;margin-right:4px">📋 Образ</button>' +
          '<button data-act="dig" data-uid="'+r.user_id+'" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(167,139,250,0.4);background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;margin-right:4px" title="Парсить VK-страницу">🔍 Копать</button>' +
          '<button data-act="features" data-uid="'+r.user_id+'" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(52,211,153,0.4);background:transparent;color:var(--success);font:inherit;font-size:12px;cursor:pointer;margin-right:4px" title="Извлечь признаки через ИИ (нужно сначала «Копать»)">🧠 Признаки</button>' +
          '<button data-act="twins" data-uid="'+r.user_id+'" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(251,191,36,0.4);background:transparent;color:var(--warning);font:inherit;font-size:12px;cursor:pointer;margin-right:4px" title="Найти близнецов в VK (нужно сначала «Признаки»)">🎯 Близнецы</button>' +
          '<button data-act="unlink" data-uid="'+r.user_id+'" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.4);background:transparent;color:var(--error);font:inherit;font-size:12px;cursor:pointer">🗑</button>' +
        '</td></tr>';
    }).join('');
    document.getElementById('vkLinksTable').innerHTML =
      '<table><thead><tr><th>user_id</th><th>Имя</th><th>VK</th><th title="спарсен ли vk_data">📦</th><th>Привязан</th><th>Заметка</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' +
      '<div style="font-size:11px;color:var(--text-dim);margin-top:6px">Всего: '+(d.total||items.length)+'</div>';

    document.querySelectorAll('#vkLinksTable button[data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var uid = b.dataset.uid;
        if (b.dataset.act === 'profile') openProfile(uid);
        else if (b.dataset.act === 'dig') dig(uid, b);
        else if (b.dataset.act === 'features') extractFeatures(uid, b);
        else if (b.dataset.act === 'twins') findTwins(uid, b);
        else if (b.dataset.act === 'unlink') unlink(uid);
      });
    });
  }

  function kvCard(label, value, sub){
    return '<div class="kv-card"><div class="label">'+esc(label)+'</div>' +
           '<div class="value">'+esc(value)+'</div>' +
           (sub?('<div class="sub">'+esc(sub)+'</div>'):'') + '</div>';
  }

  async function suggestUsers(q){
    var box = document.getElementById('vkUserSuggest');
    if (!q || q.length < 1){ box.style.display='none'; return; }
    if (!tok()){ return; }
    try {
      var d = await api('/api/admin/vk/users?only_unlinked=true&limit=8&search=' + encodeURIComponent(q));
      var items = (d && d.items) || [];
      if (!items.length){ box.innerHTML = '<div style="padding:10px;color:var(--text-dim);font-size:12px">Никого не нашёл (или все уже привязаны)</div>'; box.style.display='block'; return; }
      box.innerHTML = items.map(function(u){
        var lm = u.last_message ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">'+esc(u.last_message.slice(0,90))+'</div>' : '';
        return '<div data-uid="'+u.user_id+'" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border)">' +
          '<div style="font-size:13px"><b>'+u.user_id+'</b> '+esc(u.display_name||u.username||'—')+'</div>'+lm+'</div>';
      }).join('');
      box.style.display = 'block';
      box.querySelectorAll('div[data-uid]').forEach(function(d){
        d.addEventListener('mousedown', function(e){
          e.preventDefault();
          document.getElementById('vkUserInput').value = d.dataset.uid;
          box.style.display = 'none';
        });
      });
    } catch(e){ /* silent */ }
  }

  async function submitLink(){
    var uid = document.getElementById('vkUserInput').value.trim();
    var vk = document.getElementById('vkInput').value.trim();
    var notes = document.getElementById('vkNotes').value.trim();
    var status = document.getElementById('vkFormStatus');
    if (!uid || !vk){ status.innerHTML = '<span style="color:var(--error)">Заполни user_id и VK</span>'; return; }
    var uidNum = parseInt(uid, 10);
    if (isNaN(uidNum)){ status.innerHTML = '<span style="color:var(--error)">user_id должен быть числом — выбери из подсказок</span>'; return; }
    status.textContent = 'Сохраняю…';
    try {
      await api('/api/admin/vk/links', { method:'POST', body:{ user_id:uidNum, vk:vk, notes:notes } });
      status.innerHTML = '<span style="color:var(--success)">✓ Привязано</span>';
      document.getElementById('vkUserInput').value = '';
      document.getElementById('vkInput').value = '';
      document.getElementById('vkNotes').value = '';
      loadVkTab();
    } catch(e){ status.innerHTML = '<span style="color:var(--error)">'+esc(e.message)+'</span>'; }
  }

  async function unlink(uid){
    if (!confirm('Отвязать VK от user_id='+uid+'?')) return;
    try {
      await api('/api/admin/vk/links/'+uid, { method:'DELETE' });
      loadVkTab();
    } catch(e){ alert('Ошибка: ' + e.message); }
  }

  async function dig(uid, btn){
    if (!uid) return;
    var prevHTML = btn ? btn.innerHTML : '';
    if (btn){ btn.disabled = true; btn.innerHTML = '⏳ копаю…'; }
    try {
      var r = await api('/api/admin/vk/parse/'+encodeURIComponent(uid), { method: 'POST' });
      var s = (r && r.summary) || {};
      var msg = '✓ Спарсено';
      if (s.name) msg += ': ' + s.name;
      if (s.is_closed) msg += ' (профиль закрыт)';
      else {
        var bits = [];
        if (typeof s.wall_posts === 'number') bits.push(s.wall_posts + ' постов');
        if (typeof s.groups_count === 'number') bits.push(s.groups_count + ' групп');
        if (s.city) bits.push(s.city);
        if (bits.length) msg += ' — ' + bits.join(', ');
      }
      alert(msg);
      await loadVkTab();
    } catch(e){
      alert('Ошибка парсинга: ' + (e.message || ''));
      if (btn){ btn.disabled = false; btn.innerHTML = prevHTML; }
    }
  }

  async function extractFeatures(uid, btn){
    if (!uid) return;
    var prevHTML = btn ? btn.innerHTML : '';
    if (btn){ btn.disabled = true; btn.innerHTML = '⏳ думаю…'; }
    try {
      var r = await api('/api/admin/vk/extract-features/'+encodeURIComponent(uid), { method: 'POST' });
      var f = (r && r.features) || {};
      var lines = ['✓ Признаки извлечены'];
      if (f.problem_summary) lines.push('• ' + f.problem_summary);
      if (f.key_themes && f.key_themes.length) lines.push('Темы: ' + f.key_themes.slice(0,5).join(', '));
      if (f.marker_groups && f.marker_groups.length) lines.push('Marker-группы: ' + f.marker_groups.length);
      if (f.marker_keywords && f.marker_keywords.length) lines.push('Marker-слов: ' + f.marker_keywords.length);
      if (f.data_quality){
        var dq = f.data_quality;
        var lvl = dq.level === 'high' ? 'высокое' : dq.level === 'medium' ? 'среднее' : 'низкое';
        lines.push('Данные: ' + lvl + ' (' + dq.score + '/100)');
        if (dq.recommendation) lines.push('→ ' + dq.recommendation);
      }
      alert(lines.join('\n'));
      if (btn){ btn.disabled = false; btn.innerHTML = '✓ Признаки'; setTimeout(function(){ btn.innerHTML = prevHTML; }, 1500); }
    } catch(e){
      alert('Ошибка извлечения: ' + (e.message || ''));
      if (btn){ btn.disabled = false; btn.innerHTML = prevHTML; }
    }
  }

  // Phase 5A: lazy-creates a separate overlay for draft messages — отдельно
  // от vkProfileOverlay, чтобы не конфликтовать с уже открытым drawer'ом
  // кандидатов. Один экземпляр на DOM, переиспользуется.
  function ensureDraftOverlay(){
    var ov = document.getElementById('vkDraftOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'vkDraftOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;max-width:680px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)">' +
          '<div><div id="vkDraftTitle" style="font-weight:700;font-size:15px">✉️ Черновик сообщения</div>' +
          '<div id="vkDraftSub" style="font-size:11px;color:var(--text-dim);margin-top:2px"></div></div>' +
          '<button id="vkDraftClose" style="background:transparent;border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);cursor:pointer;font:inherit">✕</button>' +
        '</div>' +
        '<div id="vkDraftBody" style="flex:1;overflow-y:auto;padding:14px 18px"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('vkDraftClose').addEventListener('click', closeDraftModal);
    ov.addEventListener('click', function(e){ if (e.target === ov) closeDraftModal(); });
    return ov;
  }
  function closeDraftModal(){
    var ov = document.getElementById('vkDraftOverlay');
    if (ov) ov.style.display = 'none';
  }

  async function openDraftModal(sourceUid, candId, candVkId, existing){
    var ov = ensureDraftOverlay();
    ov.style.display = 'flex';
    var name = (existing && existing.data && (existing.data.first_name||'') + ' ' + (existing.data.last_name||''))
      .trim() || ('id'+candVkId);
    document.getElementById('vkDraftTitle').textContent = '✉️ ' + name;
    document.getElementById('vkDraftSub').textContent = 'Кандидат #' + candId + ' · vk.com/id' + candVkId;

    if (existing && existing.draft_message){
      // Уже сгенерён — показываем сразу
      renderDraftModal(sourceUid, candId, candVkId, {
        draft: existing.draft_message,
        alternatives: existing.draft_alternatives || [],
        reasoning: (existing.draft_meta && existing.draft_meta.reasoning) || '',
        hook_used: (existing.draft_meta && existing.draft_meta.hook_used) || '',
        pain_targeted: (existing.draft_meta && existing.draft_meta.pain_targeted) || '',
        vk_chat_url: 'https://vk.com/im?sel=' + candVkId,
        generated_at: existing.draft_generated_at,
      });
    } else {
      document.getElementById('vkDraftBody').innerHTML =
        '<div class="empty">⏳ Генерирую черновик через DeepSeek (5-10 секунд)…</div>';
      try {
        var r = await api('/api/admin/vk/candidates/'+encodeURIComponent(candId)+'/draft-message', { method: 'POST' });
        renderDraftModal(sourceUid, candId, candVkId, r);
      } catch(e){
        document.getElementById('vkDraftBody').innerHTML =
          '<div class="err">Ошибка генерации: '+esc(e.message)+'</div>';
      }
    }
  }

  function renderDraftModal(sourceUid, candId, candVkId, r){
    var alts = r.alternatives || [];
    var info = '';
    // Phase 8: красный варнинг если этому VK ID уже писали за последние 30 дней
    if (r.cooldown_warning && r.cooldown_warning.message){
      info += '<div style="background:rgba(248,113,113,0.15);border:2px solid var(--error);padding:10px 14px;margin-bottom:10px;border-radius:8px;font-size:13px;color:var(--error);font-weight:600">' +
        esc(r.cooldown_warning.message) +
        '</div>';
    }
    if (r.pain_targeted) info += '<div style="background:rgba(248,113,113,0.08);border-left:3px solid var(--error);padding:6px 10px;margin-bottom:8px;border-radius:4px;font-size:12px">🔥 <b>Цель крючка:</b> '+esc(r.pain_targeted)+'</div>';
    if (r.hook_used) info += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">🪝 <b>Заход:</b> '+esc(r.hook_used)+'</div>';
    if (r.reasoning) info += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">💭 '+esc(r.reasoning)+'</div>';
    if (r.generated_at) info += '<div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">сгенерировано: '+new Date(r.generated_at).toLocaleString('ru-RU')+'</div>';

    var altsBlock = '';
    if (alts.length){
      altsBlock = '<details style="margin-top:10px;background:var(--surface-hi);border:1px solid var(--border);border-radius:10px;padding:8px 12px">' +
        '<summary style="cursor:pointer;color:var(--accent);font-size:12px">Альтернативные варианты ('+alts.length+')</summary>' +
        alts.map(function(a, i){
          return '<div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:13px;line-height:1.5">' +
            '<div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">Вариант '+(i+2)+'</div>' +
            esc(a) +
            '<button data-use-alt="'+i+'" style="display:block;margin-top:6px;padding:3px 10px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--accent);font:inherit;font-size:11px;cursor:pointer">↑ Использовать</button>' +
          '</div>';
        }).join('') +
      '</details>';
    }

    var html =
      info +
      '<textarea id="vkDraftText" style="width:100%;min-height:180px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;color:var(--text);font:13px/1.55 inherit;resize:vertical;box-sizing:border-box">'+esc(r.draft||'')+'</textarea>' +
      '<div style="font-size:10px;color:var(--text-dim);margin-top:4px;text-align:right" id="vkDraftCounter">'+(r.draft||'').length+' символов</div>' +
      altsBlock +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
        '<button id="vkDraftCopy" style="flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:none;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer">📋 Скопировать</button>' +
        '<a id="vkDraftOpenVk" href="'+esc(r.vk_chat_url||('https://vk.com/im?sel='+candVkId))+'" target="_blank" rel="noopener" '+
          'style="flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid rgba(0,136,204,0.5);background:transparent;color:#0088cc;font:inherit;font-weight:600;cursor:pointer;text-align:center;text-decoration:none">💬 Открыть VK-чат</a>' +
        '<button id="vkDraftSent" style="flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid rgba(52,211,153,0.5);background:transparent;color:var(--success);font:inherit;font-weight:600;cursor:pointer">✓ Отправил</button>' +
        '<button id="vkDraftRegen" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font:inherit;cursor:pointer" title="Перегенерировать">🔄</button>' +
      '</div>' +
      '<div id="vkDraftStatus" style="font-size:11px;color:var(--text-dim);margin-top:8px;text-align:center;min-height:14px"></div>';
    document.getElementById('vkDraftBody').innerHTML = html;

    var ta = document.getElementById('vkDraftText');
    var counter = document.getElementById('vkDraftCounter');
    ta.addEventListener('input', function(){ counter.textContent = ta.value.length + ' символов'; });

    document.getElementById('vkDraftCopy').addEventListener('click', async function(){
      try {
        if (navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(ta.value);
          document.getElementById('vkDraftStatus').textContent = '✓ Скопировано в буфер. Открой VK-чат и вставь.';
        } else {
          ta.select(); document.execCommand('copy');
          document.getElementById('vkDraftStatus').textContent = '✓ Скопировано (fallback).';
        }
      } catch(e){
        document.getElementById('vkDraftStatus').textContent = '⚠ Не удалось скопировать — выдели текст и Ctrl+C.';
      }
    });

    document.getElementById('vkDraftSent').addEventListener('click', async function(){
      var btn = this;
      btn.disabled = true; btn.textContent = '…';
      try {
        await api('/api/admin/vk/candidates/'+encodeURIComponent(candId), {
          method: 'PATCH', body: { status: 'contacted' },
        });
        document.getElementById('vkDraftStatus').textContent = '✓ Статус → contacted, дата зафиксирована.';
        // Reload candidates list в фоне
        if (sourceUid) filterCandidates(sourceUid, '');
        setTimeout(closeDraftModal, 1200);
      } catch(e){
        btn.disabled = false; btn.textContent = '✓ Отправил';
        document.getElementById('vkDraftStatus').textContent = '⚠ Ошибка обновления: '+esc(e.message);
      }
    });

    document.getElementById('vkDraftRegen').addEventListener('click', async function(){
      var btn = this;
      btn.disabled = true; btn.textContent = '⏳';
      document.getElementById('vkDraftStatus').textContent = 'Перегенерирую…';
      try {
        var r2 = await api('/api/admin/vk/candidates/'+encodeURIComponent(candId)+'/draft-message', { method: 'POST' });
        renderDraftModal(sourceUid, candId, candVkId, r2);
      } catch(e){
        btn.disabled = false; btn.textContent = '🔄';
        document.getElementById('vkDraftStatus').textContent = '⚠ Ошибка: '+esc(e.message);
      }
    });

    document.querySelectorAll('button[data-use-alt]').forEach(function(b){
      b.addEventListener('click', function(){
        var idx = parseInt(b.dataset.useAlt, 10);
        if (alts[idx]){
          ta.value = alts[idx];
          counter.textContent = ta.value.length + ' символов';
          document.getElementById('vkDraftStatus').textContent = 'Подставлен вариант '+(idx+2)+'. Не забудь скопировать.';
        }
      });
    });
  }

  // Phase 8: воронка эффективности — открывает modal со счётчиками.
  async function openFunnel(){
    var ov = document.getElementById('vkProfileOverlay');
    ov.style.display = 'flex';
    document.getElementById('vkProfileTitle').textContent = '📊 Воронка эффективности';
    document.getElementById('vkProfileSub').textContent = 'Загружаю…';
    document.getElementById('vkProfileBody').innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      var d = await api('/api/admin/vk/funnel');
      renderFunnel(d);
    } catch(e){
      document.getElementById('vkProfileBody').innerHTML = '<div class="err">'+esc(e.message)+'</div>';
    }
  }

  function renderFunnel(d){
    document.getElementById('vkProfileSub').textContent =
      'Глобальные метрики · обновлено ' + new Date().toLocaleString('ru-RU');
    var byStatus = d.candidates_by_status || {};
    var stages = [
      {label: '🔗 Привязано VK к юзерам', value: d.linked || 0, color: 'var(--text)'},
      {label: '🔍 Спарсено публичных данных', value: d.parsed || 0, color: 'var(--accent)'},
      {label: '🧠 С извлечёнными признаками', value: d.with_features || 0, color: 'var(--success)'},
      {label: '🎯 Найдено кандидатов всего', value: d.candidates_total || 0, color: 'var(--warning)'},
      {label: '📩 Контактировано (сообщений отправлено)', value: d.contacted_total || 0, color: 'var(--accent-2)'},
      {label: '   из них уникальных VK ID', value: d.contacted_unique_vk_ids || 0, color: 'var(--text-dim)'},
      {label: '   за последние 7 дней', value: d.contacted_last_7d || 0, color: 'var(--text-dim)'},
      {label: '💬 Ответили', value: d.responded_total || 0, color: 'var(--success)'},
    ];
    var maxVal = Math.max.apply(null, stages.slice(0,5).map(function(s){return s.value;}).concat([1]));
    var rowsHtml = stages.map(function(s, i){
      var pct = maxVal > 0 ? Math.round(s.value / maxVal * 100) : 0;
      var bar = i < 5
        ? '<div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-left:12px"><div style="width:'+pct+'%;height:100%;background:'+s.color+';transition:width 0.4s"></div></div>'
        : '';
      return '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">' +
        '<div style="flex:1;color:var(--text)">'+s.label+'</div>' +
        '<div style="font-weight:700;font-size:16px;color:'+s.color+';min-width:60px;text-align:right">'+s.value+'</div>' +
        bar +
      '</div>';
    }).join('');

    var rrPct = d.response_rate_pct || 0;
    var rrColor = rrPct >= 10 ? 'var(--success)' : (rrPct >= 3 ? 'var(--warning)' : 'var(--error)');
    var responseRate = '<div style="margin-top:14px;padding:14px;background:'+rrColor+';color:#fff;border-radius:10px;display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;opacity:0.8">Response rate</div>' +
      '<div style="font-size:28px;font-weight:800">'+rrPct+'%</div></div>' +
      '<div style="font-size:12px;opacity:0.85;text-align:right">отвечают на сообщения<br>(норма: 5–15%)</div>' +
    '</div>';

    var statusBars = '';
    if (Object.keys(byStatus).length){
      var statusOrder = ['new','reviewed','contacted','responded','rejected','scheduled'];
      var statusColors = {
        'new':'var(--text-dim)', 'reviewed':'var(--accent)',
        'contacted':'var(--accent-2)', 'responded':'var(--success)',
        'rejected':'var(--text-dim)', 'scheduled':'var(--warning)',
      };
      var totalCands = Object.values(byStatus).reduce(function(a,b){return a+b;}, 0) || 1;
      statusBars = '<h3 style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin:18px 0 8px">Кандидаты по статусу</h3>' +
        statusOrder.filter(function(s){return byStatus[s];}).map(function(s){
          var cnt = byStatus[s] || 0;
          var pct = Math.round(cnt / totalCands * 100);
          return '<div style="display:flex;align-items:center;padding:6px 0;font-size:12px">' +
            '<div style="width:120px;color:'+statusColors[s]+'">'+s+'</div>' +
            '<div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;margin-right:10px"><div style="width:'+pct+'%;height:100%;background:'+statusColors[s]+';border-radius:3px"></div></div>' +
            '<div style="font-weight:700;min-width:50px;text-align:right">'+cnt+'</div>' +
            '<div style="font-size:11px;color:var(--text-dim);min-width:40px;text-align:right">'+pct+'%</div>' +
          '</div>';
        }).join('');
    }

    document.getElementById('vkProfileBody').innerHTML = rowsHtml + responseRate + statusBars +
      '<details style="margin-top:14px;background:var(--surface-hi);border:1px solid var(--border);border-radius:10px;padding:8px 12px">' +
        '<summary style="cursor:pointer;color:var(--accent);font-size:11px">сырой JSON</summary>' +
        '<pre style="margin:6px 0 0;font-size:10px;white-space:pre-wrap;color:var(--text-dim)">'+esc(JSON.stringify(d,null,2))+'</pre>' +
      '</details>';
  }

  async function findTwins(uid, btn){
    if (!uid) return;
    var prevHTML = btn ? btn.innerHTML : '';
    if (btn){ btn.disabled = true; btn.innerHTML = '⏳ ищу…'; }
    try {
      var geoScope = (document.getElementById('vkGeoScope') || {}).value || 'same_city';
      var minInt = (document.getElementById('vkMinInt') || {}).value || '3';
      var reRank = !!(document.getElementById('vkReRank') || {}).checked;
      var qThr = (document.getElementById('vkQualThr') || {}).value || '60';
      if (reRank){ btn.innerHTML = '⏳ ищу + ИИ-проверка (~1 мин)…'; }
      var qs = '?max_groups=3&max_candidates=50' +
        '&geo_scope=' + encodeURIComponent(geoScope) +
        '&min_intersections=' + encodeURIComponent(minInt) +
        '&re_rank=' + (reRank ? 'true' : 'false') +
        '&quality_threshold=' + encodeURIComponent(qThr);
      var r = await api('/api/admin/vk/find-twins/'+encodeURIComponent(uid)+qs, { method: 'POST' });
      var s = r.stats || {};
      var msg = '✓ Поиск завершён\n';
      msg += 'Просканировано групп: ' + (s.groups_scanned||0) + '\n';
      msg += 'Загружено участников: ' + (s.members_fetched||0) + '\n';
      msg += 'Уникальных: ' + (s.unique_members||0) + '\n';
      if (typeof s.after_intersection_filter === 'number'){
        msg += 'После пересечения групп (мин ' + (s.min_intersections||3) + '): ' + s.after_intersection_filter + '\n';
      }
      msg += 'После фильтра по демографии: ' + (s.after_demo_filter||0) + '\n';
      msg += 'Записано кандидатов: ' + (s.returned||0);
      if (r.rerank_stats){
        var rs = r.rerank_stats;
        msg += '\n\n🧠 ИИ-проверка постов:\n';
        msg += '  Проверено: ' + (rs.reranked||0) + '\n';
        msg += '  Прошли порог ('+ (rs.threshold||60) +'): ' + (rs.passed_threshold||0) + '\n';
        msg += '  Отбраковано: ' + (rs.rejected_below_threshold||0);
        if (rs.failed) msg += '\n  Ошибок: ' + rs.failed;
      }
      if (r.note) msg += '\n\n' + r.note;
      alert(msg);
      if (btn){ btn.disabled = false; btn.innerHTML = prevHTML; }
      // Сразу открываем drawer кандидатов
      openCandidates(uid);
    } catch(e){
      alert('Ошибка поиска: ' + (e.message || ''));
      if (btn){ btn.disabled = false; btn.innerHTML = prevHTML; }
    }
  }

  // Drawer со списком кандидатов («близнецов»). Используем тот же overlay
  // что для собирательного образа, но с другим заголовком и контентом.
  async function openCandidates(uid){
    var ov = document.getElementById('vkProfileOverlay');
    ov.style.display = 'flex';
    document.getElementById('vkProfileTitle').textContent = '🎯 Близнецы для user_id=' + uid;
    document.getElementById('vkProfileSub').textContent = 'Загружаю…';
    document.getElementById('vkProfileBody').innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      var d = await api('/api/admin/vk/candidates/'+encodeURIComponent(uid)+'?limit=100');
      renderCandidates(uid, d);
    } catch(e){
      document.getElementById('vkProfileBody').innerHTML = '<div class="err">'+esc(e.message)+'</div>';
    }
  }

  function renderCandidates(sourceUid, d){
    var items = (d && d.items) || [];
    document.getElementById('vkProfileSub').textContent = 'Всего найдено: ' + (d.total||0);
    if (!items.length){
      document.getElementById('vkProfileBody').innerHTML =
        '<div class="empty">Близнецов нет. Жми «🎯 Близнецы» в строке таблицы для запуска поиска.</div>';
      return;
    }

    var statusFilters = ['all','new','reviewed','contacted','responded','rejected'];
    var filtersBar = '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">' +
      statusFilters.map(function(s){
        return '<button data-cand-filter="'+s+'" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-hi);color:var(--text);font:inherit;font-size:11px;cursor:pointer">'+
          (s==='all'?'все':s)+'</button>';
      }).join('') + '</div>';

    var rows = items.map(function(c){
      var cd = c.data || {};
      var name = esc((cd.first_name||'') + ' ' + (cd.last_name||'')).trim() || ('id'+c.vk_id);
      var demoBits = [];
      if (cd.sex === 1) demoBits.push('♀');
      else if (cd.sex === 2) demoBits.push('♂');
      if (cd.bdate) demoBits.push(esc(cd.bdate));
      if (cd.city) demoBits.push('🏙 '+esc(cd.city));
      var demo = demoBits.join(' · ');

      var grpsHtml = (c.matched_groups||[]).map(function(g){
        return '<span style="display:inline-block;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);border-radius:4px;padding:1px 5px;margin:0 3px 2px 0;font-size:10px">'+esc(g.name||'?')+'</span>';
      }).join('');

      var statusColors = {
        'new': 'var(--text-dim)',
        'reviewed': 'var(--accent)',
        'contacted': 'var(--accent-2)',
        'responded': 'var(--success)',
        'rejected': 'var(--text-dim)',
        'scheduled': 'var(--warning)',
      };
      var statusColor = statusColors[c.status] || 'var(--text-dim)';

      var statusBtns =
        '<select data-cand-id="'+c.id+'" data-act="status" style="background:var(--surface-hi);color:'+statusColor+';border:1px solid var(--border);border-radius:5px;padding:2px 6px;font:inherit;font-size:11px;cursor:pointer">' +
          ['new','reviewed','contacted','responded','rejected','scheduled'].map(function(st){
            return '<option value="'+st+'"'+(st===c.status?' selected':'')+'>'+st+'</option>';
          }).join('') +
        '</select>';

      var status = c.status || 'new';
      var rowBg = status === 'rejected' ? 'opacity:0.5;' : '';

      // Кнопка «✉️ Сообщение» — если черновик уже сгенерирован, показываем
      // зелёным «✉️ ✓», иначе обычную «✉️ Написать».
      var hasDraft = !!(c.draft_message && c.draft_message.length);
      var msgBtn = '<button data-cand-id="'+c.id+'" data-cand-vk="'+c.vk_id+'" data-cand-source="'+sourceUid+'" data-act="draft" '+
        'style="padding:4px 9px;border-radius:6px;border:1px solid '+(hasDraft?'rgba(52,211,153,0.5)':'rgba(167,139,250,0.4)')+';'+
        'background:transparent;color:'+(hasDraft?'var(--success)':'var(--accent)')+';font:inherit;font-size:11px;cursor:pointer;white-space:nowrap" '+
        'title="'+(hasDraft?'Открыть готовый черновик':'Сгенерировать черновик через ИИ')+'">'+
        (hasDraft?'✉️ ✓':'✉️')+'</button>';

      // Phase 7: quality_score после ИИ-проверки постов
      var qCell = '—';
      if (typeof c.quality_score === 'number'){
        var qColor = c.quality_score >= 80 ? 'var(--success)' :
                     c.quality_score >= 60 ? 'var(--accent)' :
                     c.quality_score >= 40 ? 'var(--warning)' : 'var(--error)';
        var qTitle = c.quality_reasoning || 'нет описания';
        qCell = '<span title="'+esc(qTitle).replace(/"/g,'&quot;')+'" '+
                'style="display:inline-block;padding:2px 8px;border-radius:6px;background:'+qColor+';color:#fff;font-weight:700;font-size:11px;cursor:help">'+
                c.quality_score+'</span>';
      }

      return '<tr style="'+rowBg+'">' +
        '<td style="font-size:13px"><a href="'+esc(cd.url||('https://vk.com/id'+c.vk_id))+'" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">'+name+' ↗</a>'+
          (demo?'<div style="font-size:10px;color:var(--text-dim);margin-top:1px">'+demo+'</div>':'')+
          (cd.status?'<div style="font-size:10px;color:var(--text-dim);margin-top:2px;font-style:italic">"'+esc(cd.status.slice(0,80))+'"</div>':'')+'</td>' +
        '<td style="text-align:center;font-weight:700;color:var(--accent)">'+c.match_score+'</td>' +
        '<td style="text-align:center">'+qCell+'</td>' +
        '<td style="font-size:11px;max-width:200px">'+grpsHtml+'</td>' +
        '<td>'+statusBtns+'</td>' +
        '<td style="text-align:center">'+msgBtn+'</td>' +
        '<td style="font-size:11px;color:var(--text-dim);white-space:nowrap">'+(c.found_at?new Date(c.found_at).toLocaleDateString('ru-RU'):'')+'</td>' +
      '</tr>';
    }).join('');

    document.getElementById('vkProfileBody').innerHTML =
      filtersBar +
      '<table><thead><tr><th>Кандидат</th><th title="Score по совпадению групп (Этап 1)">Score</th><th title="Quality 0-100 после ИИ-проверки постов (Этап 2)">🧠 Q</th><th>Совпадение по группам</th><th>Статус</th><th title="Сообщение">✉️</th><th>Найден</th></tr></thead><tbody>'+rows+'</tbody></table>' +
      '<div style="font-size:11px;color:var(--text-dim);margin-top:8px">Кликни по имени — открыть VK-страницу. Кликни ✉️ — сгенерить или открыть черновик сообщения. Статус меняй через dropdown.</div>';

    document.querySelectorAll('select[data-cand-id][data-act="status"]').forEach(function(sel){
      sel.addEventListener('change', function(){
        updateCandidateStatus(sel.dataset.candId, sel.value, sel);
      });
    });
    document.querySelectorAll('button[data-cand-id][data-act="draft"]').forEach(function(b){
      b.addEventListener('click', function(){
        var existingDraft = items.find(function(it){ return String(it.id) === String(b.dataset.candId); });
        openDraftModal(b.dataset.candSource, b.dataset.candId, b.dataset.candVk, existingDraft);
      });
    });
    document.querySelectorAll('button[data-cand-filter]').forEach(function(b){
      b.addEventListener('click', function(){
        var st = b.dataset.candFilter;
        filterCandidates(sourceUid, st === 'all' ? '' : st);
      });
    });
  }

  async function filterCandidates(uid, status){
    document.getElementById('vkProfileBody').innerHTML = '<div class="empty">Фильтрую…</div>';
    try {
      var d = await api('/api/admin/vk/candidates/'+encodeURIComponent(uid)+'?limit=100' +
        (status?'&status='+encodeURIComponent(status):''));
      renderCandidates(uid, d);
    } catch(e){
      document.getElementById('vkProfileBody').innerHTML = '<div class="err">'+esc(e.message)+'</div>';
    }
  }

  async function updateCandidateStatus(candId, newStatus, sel){
    var prev = sel.dataset.prev || '';
    sel.disabled = true;
    try {
      await api('/api/admin/vk/candidates/'+encodeURIComponent(candId), {
        method: 'PATCH', body: { status: newStatus },
      });
      sel.dataset.prev = newStatus;
      // визуальная подсветка успеха
      sel.style.borderColor = 'var(--success)';
      setTimeout(function(){ sel.style.borderColor = 'var(--border)'; }, 800);
    } catch(e){
      alert('Не удалось обновить статус: ' + (e.message||''));
      // откатываем визуально
      sel.value = prev || 'new';
    } finally {
      sel.disabled = false;
    }
  }

  async function openProfile(uid){
    var ov = document.getElementById('vkProfileOverlay');
    ov.style.display = 'flex';
    document.getElementById('vkProfileTitle').textContent = 'Собирательный образ user_id=' + uid;
    document.getElementById('vkProfileSub').textContent = 'Загружаю…';
    document.getElementById('vkProfileBody').innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      var d = await api('/api/admin/vk/profile-summary/'+encodeURIComponent(uid)+'?msg_limit=15');
      renderProfile(d);
    } catch(e){
      document.getElementById('vkProfileBody').innerHTML = '<div class="err">'+esc(e.message)+'</div>';
    }
  }
  function closeProfile(){ document.getElementById('vkProfileOverlay').style.display = 'none'; }

  function renderProfile(d){
    var u = d.user || {}, p = d.profile || {}, c = d.context || {}, msgs = d.messages || [], v = d.vk;
    var title = (u.first_name || '') + ' ' + (u.last_name || '');
    if (c.name) title = c.name;
    document.getElementById('vkProfileTitle').textContent = (title.trim() || ('user_id=' + d.user_id));
    var sub = [];
    if (u.username) sub.push('@' + u.username);
    if (u.platform) sub.push(u.platform);
    if (u.language_code) sub.push(u.language_code);
    if (d.stats) sub.push(d.stats.user_msg_count + ' сообщ. от юзера');
    document.getElementById('vkProfileSub').textContent = sub.join(' · ');

    var html = '';

    if (v){
      var vkUrl = v.vk_id ? ('https://vk.com/id'+v.vk_id) : (v.vk_screen_name?('https://vk.com/'+v.vk_screen_name):'');
      html += '<div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px">' +
        '🔗 <b>VK:</b> ' + (vkUrl ? '<a href="'+esc(vkUrl)+'" target="_blank" rel="noopener" style="color:var(--accent)">'+esc(vkUrl)+'</a>' : (v.vk_screen_name||v.vk_id||'')) +
        (v.notes ? ' · <i>'+esc(v.notes)+'</i>' : '') +
        (v.parsed_at ? ' · <span style="color:var(--success)">spar.</span>' : '') +
      '</div>';

      // Блок «спарсенное» — то что притянул POST /api/admin/vk/parse/.
      // Показываем компактно: имя+город+год рождения, топ-10 групп, кол-во постов на стене.
      // Полный JSON прячем под details для тех, кому нужно копаться.
      if (v.vk_data && typeof v.vk_data === 'object'){
        var vd = v.vk_data;
        var vu = vd.user || {};
        var wall = vd.wall || {};
        var groups = vd.groups || {};
        var bits = [];
        if (vu.first_name || vu.last_name) bits.push('<b>'+esc((vu.first_name||'') + ' ' + (vu.last_name||'')).trim()+'</b>');
        if (vu.city && vu.city.title) bits.push('🏙 '+esc(vu.city.title));
        if (vu.bdate) bits.push('🎂 '+esc(vu.bdate));
        if (vu.status) bits.push('💬 '+esc(vu.status));
        if (vu.is_closed) bits.push('<span style="color:var(--warning)">🔒 закрыт</span>');
        var head = bits.join(' · ');

        var grpRows = '';
        var grpItems = (groups && groups.items) || [];
        if (grpItems.length){
          grpRows = '<div style="margin-top:8px;font-size:12px"><b style="color:var(--accent)">Группы (топ '+Math.min(grpItems.length,10)+' из '+(groups.count||grpItems.length)+'):</b><ul style="margin:4px 0 0 18px;padding:0">' +
            grpItems.slice(0,10).map(function(g){
              var name = esc(g.name||'—');
              var act = g.activity ? ' <span style="color:var(--text-dim)">— '+esc(g.activity)+'</span>' : '';
              var url = g.screen_name ? ('https://vk.com/'+g.screen_name) : (g.id ? 'https://vk.com/club'+g.id : '');
              return '<li>' + (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener" style="color:var(--text)">'+name+'</a>':name) + act + '</li>';
            }).join('') + '</ul></div>';
        } else if (groups && groups.error){
          grpRows = '<div style="margin-top:8px;font-size:12px;color:var(--text-dim)">Группы: '+esc(groups.error)+'</div>';
        }

        var wallLine = '';
        if (typeof wall.count === 'number'){
          wallLine = '<div style="margin-top:6px;font-size:12px"><b style="color:var(--accent)">Стена:</b> '+wall.count+' постов всего';
          var wi = (wall.items||[]).filter(function(p){ return p && p.text; });
          if (wi.length){
            wallLine += ', последние тексты: <span style="color:var(--text-dim)">'+esc(wi.slice(0,3).map(function(p){return p.text.slice(0,60);}).join(' / '))+'…</span>';
          }
          wallLine += '</div>';
        } else if (wall && wall.error){
          wallLine = '<div style="margin-top:6px;font-size:12px;color:var(--text-dim)">Стена: '+esc(wall.error)+'</div>';
        }

        html += '<div style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px">' +
          '<div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">🔍 Спарсено с VK</div>' +
          (head ? '<div>'+head+'</div>' : '') +
          wallLine + grpRows +
          '<details style="margin-top:8px;background:transparent;border:0;padding:0"><summary style="cursor:pointer;color:var(--accent);font-size:11px">сырой JSON</summary>' +
          '<pre style="margin:4px 0 0;font-size:10px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;color:var(--text-dim);max-height:400px;overflow:auto">'+esc(JSON.stringify(vd,null,2))+'</pre></details>' +
        '</div>';
      }

      // Phase 3+6: ИИ-«слепок» — структурированные признаки + pain_point для крючка.
      if (v.features && typeof v.features === 'object'){
        var ff = v.features;
        var when = v.features_extracted_at ? new Date(v.features_extracted_at).toLocaleString('ru-RU') : '';
        var fbits = '';
        // Бэйдж качества данных — оператор сразу видит, готов ли профиль
        // к поиску близнецов или нужно дособрать данные.
        if (ff.data_quality && typeof ff.data_quality === 'object'){
          var dq = ff.data_quality;
          var lvl = dq.level || 'low';
          var lvlLabel = lvl === 'high' ? 'высокое' : lvl === 'medium' ? 'среднее' : 'низкое';
          var lvlColor = lvl === 'high' ? 'var(--success)' :
                         lvl === 'medium' ? 'var(--warning)' : 'var(--error)';
          var lvlBg = lvl === 'high' ? 'rgba(52,211,153,0.10)' :
                      lvl === 'medium' ? 'rgba(251,191,36,0.10)' : 'rgba(248,113,113,0.10)';
          var issuesHtml = '';
          if (dq.issues && dq.issues.length){
            issuesHtml = '<ul style="margin:6px 0 0 18px;padding:0;font-size:12px;color:var(--text-dim)">' +
              dq.issues.map(function(i){ return '<li>'+esc(i)+'</li>'; }).join('') + '</ul>';
          }
          var recHtml = dq.recommendation
            ? '<div style="margin-top:6px;font-size:12px;color:var(--text-dim);font-style:italic">→ '+esc(dq.recommendation)+'</div>'
            : '';
          fbits += '<div style="background:'+lvlBg+';border-left:3px solid '+lvlColor+';padding:8px 12px;margin-bottom:10px;border-radius:4px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
              '<div style="font-size:10px;color:'+lvlColor+';text-transform:uppercase;letter-spacing:0.4px">📊 Качество данных</div>' +
              '<div style="font-size:13px;font-weight:600;color:'+lvlColor+'">'+lvlLabel+' · '+(dq.score||0)+'/100</div>' +
            '</div>' + issuesHtml + recHtml +
          '</div>';
        }
        // Phase 6: pain_point — главный крючок. Выделяем красно-розовым.
        if (ff.pain_point){
          fbits += '<div style="background:rgba(248,113,113,0.08);border-left:3px solid var(--error);padding:8px 12px;margin-bottom:10px;border-radius:4px">' +
            '<div style="font-size:10px;color:var(--error);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">🔥 Активная боль</div>' +
            '<div style="font-size:14px;font-weight:600;line-height:1.4">'+esc(ff.pain_point)+'</div>' +
          '</div>';
        }
        if (ff.desired_outcome){
          fbits += '<div style="background:rgba(52,211,153,0.08);border-left:3px solid var(--success);padding:8px 12px;margin-bottom:10px;border-radius:4px">' +
            '<div style="font-size:10px;color:var(--success);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">🎯 Чего хочет</div>' +
            '<div style="font-size:13px;line-height:1.4">'+esc(ff.desired_outcome)+'</div>' +
          '</div>';
        }
        if (ff.evidence_in_dialogue && ff.evidence_in_dialogue.length){
          fbits += '<div style="font-size:12px;margin-bottom:8px"><b style="color:var(--accent)">📝 Цитаты из диалогов:</b><ul style="margin:4px 0 0 18px;padding:0;font-style:italic;color:var(--text-dim)">' +
            ff.evidence_in_dialogue.map(function(q){ return '<li>«'+esc(q)+'»</li>'; }).join('') + '</ul></div>';
        }
        if (ff.evidence_in_vk && ff.evidence_in_vk.length){
          fbits += '<div style="font-size:12px;margin-bottom:8px"><b style="color:var(--accent)">👁 Маркеры в VK:</b><ul style="margin:4px 0 0 18px;padding:0;color:var(--text-dim)">' +
            ff.evidence_in_vk.map(function(o){ return '<li>'+esc(o)+'</li>'; }).join('') + '</ul></div>';
        }
        if (ff.vulnerability_window && ff.vulnerability_window !== 'недостаточно данных'){
          fbits += '<div style="font-size:12px;margin-bottom:8px"><b style="color:var(--accent)">🪟 Окно открытости:</b> '+esc(ff.vulnerability_window)+'</div>';
        }
        if (ff.problem_summary){
          fbits += '<div style="font-size:12px;margin-bottom:8px;color:var(--text-dim)"><b style="color:var(--accent)">Контекст:</b> ' + esc(ff.problem_summary) + '</div>';
        }
        if (ff.key_themes && ff.key_themes.length){
          fbits += '<div style="font-size:12px;margin-bottom:6px"><b style="color:var(--accent)">Темы:</b> ' +
            ff.key_themes.map(function(t){
              return '<span style="display:inline-block;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);border-radius:6px;padding:1px 7px;margin:0 4px 4px 0;font-size:11px">'+esc(t)+'</span>';
            }).join('') + '</div>';
        }
        if (ff.marker_groups && ff.marker_groups.length){
          fbits += '<div style="font-size:12px;margin-bottom:6px"><b style="color:var(--accent)">Marker-группы (' + ff.marker_groups.length + '):</b><ul style="margin:4px 0 0 18px;padding:0">' +
            ff.marker_groups.slice(0,10).map(function(g){
              var nm = esc(g && g.name || '—');
              var url = g && g.id ? 'https://vk.com/club'+g.id : (g && g.screen_name ? 'https://vk.com/'+g.screen_name : '');
              return '<li>' + (url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener" style="color:var(--text)">'+nm+'</a>' : nm) + '</li>';
            }).join('') + '</ul></div>';
        }
        if (ff.marker_keywords && ff.marker_keywords.length){
          fbits += '<div style="font-size:12px;margin-bottom:6px"><b style="color:var(--accent)">Marker-слова:</b> ' +
            ff.marker_keywords.map(function(k){
              return '<code style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 5px;margin:0 3px 3px 0;display:inline-block;font-size:11px">'+esc(k)+'</code>';
            }).join(' ') + '</div>';
        }
        var demo = ff.demographics || {};
        var demoLine = [];
        if (demo.sex) demoLine.push('пол: ' + esc(demo.sex));
        if (demo.age_range && demo.age_range.length === 2) demoLine.push('возраст: ' + demo.age_range[0]+'–'+demo.age_range[1]);
        if (demo.city) demoLine.push('город: ' + esc(demo.city));
        if (demoLine.length){
          fbits += '<div style="font-size:12px;margin-bottom:4px"><b style="color:var(--accent)">Демография:</b> ' + demoLine.join(' · ') + '</div>';
        }
        if (ff.post_tone){
          fbits += '<div style="font-size:12px;margin-bottom:4px"><b style="color:var(--accent)">Тональность постов:</b> ' + esc(ff.post_tone) + '</div>';
        }
        if (ff.activity_pattern){
          fbits += '<div style="font-size:12px;margin-bottom:4px"><b style="color:var(--accent)">Активность:</b> ' + esc(ff.activity_pattern) + '</div>';
        }
        // Phase 6: ИИ рекомендует географию поиска
        var rec = ff.search_recommendation || {};
        if (rec.geo_scope){
          var geoLabel = ({
            same_city: 'в том же городе',
            russia: 'по всей России',
            worldwide: 'по всему миру',
          })[rec.geo_scope] || rec.geo_scope;
          fbits += '<div style="font-size:12px;margin-top:8px;padding:6px 10px;background:rgba(167,139,250,0.08);border-radius:6px">' +
            '<b style="color:var(--accent)">📍 Где ИИ советует искать:</b> '+esc(geoLabel)+
            (rec.rationale ? ' <span style="color:var(--text-dim)">— '+esc(rec.rationale)+'</span>' : '') +
          '</div>';
        }
        if (ff.search_strategies && ff.search_strategies.length){
          fbits += '<div style="font-size:12px;margin-top:8px"><b style="color:var(--accent)">Стратегии поиска близнецов:</b><ol style="margin:4px 0 0 18px;padding:0">' +
            ff.search_strategies.map(function(s){ return '<li>'+esc(s)+'</li>'; }).join('') + '</ol></div>';
        }

        html += '<div style="background:rgba(255,191,36,0.06);border:1px solid rgba(255,191,36,0.3);border-radius:10px;padding:10px 14px;margin-bottom:14px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">' +
            '<span>🧠 ИИ-слепок (для поиска близнецов)</span>' +
            (when ? '<span style="text-transform:none;letter-spacing:normal">' + when + '</span>' : '') +
          '</div>' +
          fbits +
          '<details style="margin-top:8px;background:transparent;border:0;padding:0"><summary style="cursor:pointer;color:var(--accent);font-size:11px">сырой JSON слепка</summary>' +
          '<pre style="margin:4px 0 0;font-size:10px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;color:var(--text-dim);max-height:400px;overflow:auto">'+esc(JSON.stringify(ff,null,2))+'</pre></details>' +
        '</div>';
      }
    }

    if (Object.keys(p).length){
      html += '<h3 style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin:0 0 6px">Профиль (тест)</h3>';
      html += '<div style="background:var(--surface-hi);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:14px">';
      var rows = [];
      ['profile_code','attachment','core_fears','defenses','vectors','psych_profile'].forEach(function(k){
        if (p[k] !== undefined){
          rows.push('<div style="margin-bottom:4px"><b style="color:var(--accent)">'+k+':</b> '+esc(typeof p[k] === 'object' ? JSON.stringify(p[k]) : p[k])+'</div>');
        }
      });
      var extra = Object.keys(p).filter(function(k){ return ['profile_code','attachment','core_fears','defenses','vectors','psych_profile'].indexOf(k)<0; });
      if (extra.length){
        rows.push('<details style="margin-top:6px"><summary>+'+extra.length+' других полей</summary><pre>'+esc(JSON.stringify(p,null,2))+'</pre></details>');
      }
      html += (rows.join('') || '<div style="color:var(--text-dim);font-size:12px">пусто</div>') + '</div>';
    }

    if (Object.keys(c).length){
      html += '<h3 style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin:0 0 6px">Контекст (то, что юзер о себе рассказал)</h3>';
      html += '<details style="background:var(--surface-hi);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:14px"><summary style="cursor:pointer;color:var(--accent)">показать/скрыть</summary>' +
        '<pre style="margin:6px 0 0;font-size:11px;white-space:pre-wrap;word-wrap:break-word;color:var(--text)">'+esc(JSON.stringify(c,null,2))+'</pre></details>';
    }

    // Cross-session memory: что Фреди помнит о юзере из прошлых сессий.
    var summaries = (d.session_summaries || []);
    if (summaries.length){
      html += '<h3 style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin:18px 0 8px">🧠 Память Фреди (' + summaries.length + ' сесс.)</h3>';
      html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;font-style:italic">Это сводки прошлых сессий, которые Фреди подмешивает в системный промпт при следующей встрече. Так он «помнит» клиента.</div>';
      summaries.forEach(function(s, i){
        var when = s.ended_at ? new Date(s.ended_at).toLocaleString('ru-RU', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        var modeBadge = '';
        if (s.mode){
          var modeColors = {'psychologist':'rgba(167,139,250,0.22)','coach':'rgba(52,211,153,0.22)','trainer':'rgba(251,191,36,0.22)'};
          var modeIcons = {'psychologist':'🧠','coach':'🎯','trainer':'💪'};
          modeBadge = '<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:'+(modeColors[s.mode]||'rgba(180,180,200,0.18)')+';font-size:10px;margin-right:6px">'+(modeIcons[s.mode]||'•')+' '+esc(s.mode)+(s.method_code?(' / '+esc(s.method_code)):'')+'</span>';
        }
        var kf = s.key_facts || {};
        var hooks = s.continuity_hooks || [];
        html += '<div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.25);border-radius:10px;padding:10px 14px;margin-bottom:8px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">' +
            '<div>'+modeBadge+'<span style="font-size:11px;color:var(--text-dim)">'+esc(when)+' · '+(s.message_count||0)+' сообщ.</span></div>' +
            (s.client_state_at_end?'<span style="font-size:10px;color:var(--text-dim);font-style:italic">→ '+esc(s.client_state_at_end)+'</span>':'') +
          '</div>';
        if (s.summary){
          html += '<div style="font-size:13px;line-height:1.45;margin-bottom:8px">'+esc(s.summary)+'</div>';
        }
        // Key facts compact display
        var kfBits = [];
        ['persons','events','themes','emotions','hypotheses','actions_or_tools'].forEach(function(key){
          var arr = kf[key] || [];
          if (Array.isArray(arr) && arr.length){
            var label = ({persons:'👤 Люди',events:'📅 События',themes:'📋 Темы',emotions:'💔 Эмоции',hypotheses:'💡 Гипотезы',actions_or_tools:'🛠 Шаги'})[key] || key;
            kfBits.push('<div style="font-size:11px;margin-bottom:3px"><b style="color:var(--accent);font-weight:600">'+label+':</b> '+arr.slice(0,5).map(function(x){return esc(String(x).slice(0,80));}).join(', ')+'</div>');
          }
        });
        if (kfBits.length){
          html += '<div style="margin-top:6px">'+kfBits.join('')+'</div>';
        }
        if (hooks.length){
          html += '<div style="margin-top:6px;font-size:11px;background:rgba(255,191,36,0.06);border-left:3px solid var(--warning);padding:4px 8px;border-radius:3px">' +
            '<b style="color:var(--warning)">🪝 Зацепки на следующий раз:</b> ' +
            hooks.slice(0,3).map(function(h){return esc(String(h).slice(0,150));}).join(' | ') +
          '</div>';
        }
        html += '</div>';
      });
      html += '<details style="margin-top:6px;background:var(--surface-hi);border:1px solid var(--border);border-radius:8px;padding:6px 10px;margin-bottom:14px"><summary style="cursor:pointer;color:var(--accent);font-size:11px">сырой JSON всех сводок</summary>' +
        '<pre style="margin:6px 0 0;font-size:10px;white-space:pre-wrap;word-wrap:break-word;color:var(--text-dim);max-height:300px;overflow:auto">'+esc(JSON.stringify(summaries,null,2))+'</pre></details>';
    }

    html += '<h3 style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin:0 0 6px">Последние ' + msgs.length + ' сообщений (хронологически)</h3>';
    if (!msgs.length){
      html += '<div class="empty">Нет сообщений</div>';
    } else {
      html += msgs.map(function(m){
        var isUser = m.role === 'user';
        var bg = isUser ? 'rgba(59,130,255,0.08)' : 'rgba(16,185,129,0.06)';
        var bd = isUser ? 'rgba(59,130,255,0.25)' : 'rgba(16,185,129,0.25)';
        var role = isUser ? 'ТЫ' : (m.role==='system'?'SYSTEM':'ФРЕДИ');
        var ts = m.created_at ? new Date(m.created_at).toLocaleString('ru-RU') : '';
        var text = esc(String(m.content||'')).replace(/\n/g,'<br>');
        return '<div style="background:'+bg+';border:1px solid '+bd+';border-radius:10px;padding:8px 12px;margin-bottom:6px">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:0.4px;color:var(--text-dim);margin-bottom:3px">'+role+' <span style="font-weight:400">· '+ts+'</span></div>' +
          '<div style="font-size:12px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word">'+text+'</div></div>';
      }).join('');
    }

    document.getElementById('vkProfileBody').innerHTML = html;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectUI);
  } else { injectUI(); }
})();


// ============================================
// «🔎 Поиск по проблеме» — отдельный таб рядом с «Клиентами».
// Полностью изолированная IIFE, ничего не ломает в клиентах.
// Вход: оператор выбирает категорию и геообласть → бэк тащит
// участников тематических сообществ → возвращает список ссылок
// и базовых полей. Драфт по клику — следующим шагом.
// ============================================
(function(){
  'use strict';
  var API = (window.API_BASE_URL) || 'https://fredi-backend-flz2.onrender.com';
  var LS = 'fredi_admin_token';
  function tok(){ try { return localStorage.getItem(LS) || ''; } catch(e){ return ''; } }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  async function api(path, opts){
    opts = opts || {};
    var h = { 'X-Admin-Token': tok(), 'Accept':'application/json' };
    if (opts.body) h['Content-Type'] = 'application/json';
    var r = await fetch(API + path, { method: opts.method||'GET', headers: h, body: opts.body?JSON.stringify(opts.body):undefined });
    if (r.status === 401) throw new Error('Неверный ADMIN_TOKEN');
    var j = null; try { j = await r.json(); } catch(e){}
    if (!r.ok){ var m = (j && (j.detail && (j.detail.message||j.detail.error)||j.error))||('HTTP '+r.status); throw new Error(m); }
    return j;
  }

  var loadedCategories = null;

  function injectUI(){
    var nav = document.getElementById('navBar');
    if (!nav){ return setTimeout(injectUI, 500); }
    if (document.getElementById('vkProblemTabBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'vkProblemTabBtn'; btn.dataset.tab = 'vkproblem'; btn.textContent = '🔎 По проблеме';
    // Скрыта: старый поиск страдальцев. Заменён вкладкой 🎯 VK B2B/B2C ниже.
    btn.style.cssText = 'flex:0 0 auto;display:none';
    var anchor = document.getElementById('vkTabBtn') || document.getElementById('exportClaudeBtn');
    if (anchor && anchor.nextSibling) nav.insertBefore(btn, anchor.nextSibling);
    else if (anchor) nav.appendChild(btn);
    else nav.appendChild(btn);

    var sec = document.createElement('section');
    sec.id = 'vkProblemTab'; sec.style.display = 'none';
    sec.innerHTML =
      '<h2>🔎 Поиск клиентов по проблеме</h2>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">' +
        '<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">' +
          'Выбираешь категорию → бэкенд тянет участников из тематических сообществ ВКонтакте, ' +
          'фильтрует по полу/возрасту, возвращает список с открытыми профилями. ' +
          'Источник Fredi-юзер не нужен.' +
        '</div>' +
        '<div id="vkProblemCats" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">— загружаю категории —</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px">' +
          '<label style="display:flex;align-items:center;gap:4px">Лимит:' +
            '<input id="vkProblemLimit" type="number" min="10" max="200" step="10" value="50" style="width:70px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit"></label>' +
          '<label style="display:flex;align-items:center;gap:4px">Групп для скана:' +
            '<input id="vkProblemMaxGroups" type="number" min="1" max="5" value="3" style="width:60px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit"></label>' +
          '<label style="display:flex;align-items:center;gap:4px;cursor:pointer" title="После эвристик топ-30 идёт через DeepSeek для финальной оценки «реально ли страдает». +DeepSeek-запрос, +5–10 секунд, заметно лучше качество.">' +
            '<input type="checkbox" id="vkProblemRerank" style="cursor:pointer">' +
            '<span style="color:var(--accent);font-size:12px">🧠 ИИ-рерэнк</span>' +
          '</label>' +
          '<button id="vkProblemSearch" disabled style="padding:9px 16px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer;opacity:0.6">🔎 Найти кандидатов</button>' +
          '<button id="vkProblemOptimize" disabled style="padding:9px 14px;border-radius:8px;border:1px solid rgba(167,139,250,0.4);background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;opacity:0.5" title="DeepSeek проанализирует перфоманс фраз и предложит улучшения">🧠 Скорректировать фразы</button>' +
          '<span id="vkProblemStatus" style="color:var(--text-dim)"></span>' +
        '</div>' +
      '</div>' +
      '<div id="vkProblemMeta" style="margin-bottom:10px;font-size:12px;color:var(--text-dim)"></div>' +
      '<div id="vkProblemResults"></div>';
    document.body.appendChild(sec);

    btn.addEventListener('click', activate);
    document.querySelectorAll('#navBar button').forEach(function(b){
      if (b.id === 'vkProblemTabBtn') return;
      b.addEventListener('click', deactivate);
    });

    document.getElementById('vkProblemSearch').addEventListener('click', runSearch);
    document.getElementById('vkProblemOptimize').addEventListener('click', openOptimize);
  }

  function activate(){
    document.querySelectorAll('#navBar button').forEach(function(x){ x.classList.remove('active'); });
    document.getElementById('vkProblemTabBtn').classList.add('active');
    ['summaryTab','recentTab','dialogsTab','vkTab'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    document.getElementById('vkProblemTab').style.display = 'block';
    if (!loadedCategories) loadCategories();
  }
  function deactivate(){
    var t = document.getElementById('vkProblemTab'); if (t) t.style.display = 'none';
    var b = document.getElementById('vkProblemTabBtn'); if (b) b.classList.remove('active');
  }

  var selectedCode = null;

  async function loadCategories(){
    try {
      var r = await api('/api/admin/vk/problem-categories');
      loadedCategories = r.categories || [];
      renderCategoryChips();
    } catch (e){
      document.getElementById('vkProblemCats').innerHTML =
        '<span style="color:var(--error)">Ошибка загрузки категорий: ' + esc(e.message) + '</span>';
    }
  }

  function renderCategoryChips(){
    var html = loadedCategories.map(function(c){
      var demo = c.demographics || {};
      var demoText = '';
      if (demo.sex && demo.sex !== 'any') demoText += demo.sex === 'f' ? '♀ ' : '♂ ';
      if (demo.age_from || demo.age_to) demoText += (demo.age_from||'') + '–' + (demo.age_to||'') + ' лет';
      var hours = (c.best_send_hours||[]).length ? ' · ⏰ ' + c.best_send_hours.join(', ') + ':00' : '';
      return '<button data-code="' + esc(c.code) + '" class="vk-prob-chip" ' +
        'style="padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;cursor:pointer;text-align:left;line-height:1.3" ' +
        'title="' + esc(c.audience_brief || '') + '">' +
          '<div style="font-size:13px;font-weight:600">' + c.icon + ' ' + esc(c.name_ru) + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' + esc(demoText + hours) + '</div>' +
        '</button>';
    }).join('');
    document.getElementById('vkProblemCats').innerHTML = html;

    document.querySelectorAll('.vk-prob-chip').forEach(function(b){
      b.addEventListener('click', function(){
        document.querySelectorAll('.vk-prob-chip').forEach(function(x){
          x.style.borderColor = 'var(--border)';
          x.style.background = 'var(--surface)';
        });
        b.style.borderColor = 'var(--accent)';
        b.style.background = 'rgba(167,139,250,0.10)';
        selectedCode = b.dataset.code;
        var btn = document.getElementById('vkProblemSearch');
        btn.disabled = false; btn.style.opacity = '1';
        var optBtn = document.getElementById('vkProblemOptimize');
        if (optBtn){ optBtn.disabled = false; optBtn.style.opacity = '1'; }
        var meta = (loadedCategories.find(function(c){ return c.code === selectedCode; }) || {});
        document.getElementById('vkProblemMeta').innerHTML =
          'Аудитория: <span style="color:var(--text)">' + esc(meta.audience_brief || '') + '</span>';
      });
    });
  }

  async function runSearch(){
    if (!selectedCode) return;
    var limit = parseInt(document.getElementById('vkProblemLimit').value || '50', 10);
    var maxGroups = parseInt(document.getElementById('vkProblemMaxGroups').value || '3', 10);
    var status = document.getElementById('vkProblemStatus');
    var results = document.getElementById('vkProblemResults');
    var rerank = document.getElementById('vkProblemRerank') && document.getElementById('vkProblemRerank').checked;
    status.textContent = rerank ? '⏳ ищу + 🧠 ИИ-рерэнк…' : '⏳ ищу…';
    results.innerHTML = '';
    try {
      var r = await api('/api/admin/vk/search-by-problem?category=' + encodeURIComponent(selectedCode) +
        '&max_candidates=' + limit + '&max_groups=' + maxGroups +
        (rerank ? '&rerank=true' : ''), { method: 'POST' });
      status.textContent = '✓ найдено ' + (r.candidates||[]).length;
      renderResults(r);
    } catch (e){
      status.textContent = '';
      results.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  // Кеш кандидатов по vk_id — нужен, чтобы при клике на ✉️ передать
  // на бэк весь объект кандидата (имя, статус, from_group и т.д.).
  var candidateById = {};
  var lastSearchPayload = null; // запоминаем category для перегенерации

  function renderResults(r){
    var cands = r.candidates || [];
    var stats = r.stats || {};
    var groups = r.groups_used || [];

    candidateById = {};
    cands.forEach(function(c){ if (c && c.vk_id) candidateById[c.vk_id] = c; });
    lastSearchPayload = { category: (r.category && r.category.code) || null };

    // Стата с разбивкой по причинам отсева — оператор видит, сколько
    // битых страниц фильтр срезал и почему.
    var rejected = stats.rejected_by_reason || {};
    var rejHtml = '';
    var rejTotal = 0;
    Object.keys(rejected).forEach(function(k){ rejTotal += rejected[k]||0; });
    if (rejTotal){
      var rejLabels = {
        deactivated: 'забанен/удалён',
        abandoned: 'давно не заходил',
        no_photo: 'без аватарки',
        no_name: 'без имени',
        empty_profile: 'пустой профиль'
      };
      var parts = Object.keys(rejected).map(function(k){
        return (rejLabels[k]||k) + ': ' + rejected[k];
      }).join(', ');
      rejHtml = ' · 🧹 отсеяно ' + rejTotal + ' (' + esc(parts) + ')';
    }

    var bySource = stats.by_source || {};
    var sourceHtml = '';
    var totalSrc = (bySource.newsfeed||0) + (bySource.comment||0) + (bySource.like||0) + (bySource.repost||0) + (bySource.group||0);
    if (totalSrc){
      sourceHtml = ' · 📰 ' + (bySource.newsfeed||0) +
        ' · 💬 ' + (bySource.comment||0) +
        ' · 🔁 ' + (bySource.repost||0) +
        ' · ❤️ ' + (bySource.like||0) +
        ' · 👥 ' + (bySource.group||0);
    }

    function aggReasons(obj, label){
      var total = 0;
      Object.keys(obj||{}).forEach(function(k){ total += obj[k]||0; });
      if (!total) return '';
      return ' · ' + label + ' ' + Object.keys(obj).map(function(k){
        return esc((k.length > 30 ? k.slice(0,30) + '…' : k)) + ': ' + obj[k];
      }).join(', ');
    }
    var wallReasonsTxt   = aggReasons(stats.wall_failed_reasons, '💥 wall fail:');
    var likeReasonsTxt   = aggReasons(stats.likes_failed_reasons, '💥 likes fail:');
    var repostReasonsTxt = aggReasons(stats.reposts_failed_reasons, '💥 reposts fail:');

    var statsHtml = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">' +
      '📰 фраз: ' + (stats.phrases_used||0) + ' · ' +
      'постов: ' + (stats.posts_seen||0) + ' · ' +
      'уникальных авторов: ' + (stats.newsfeed_authors||0) +
      '<br>💬 wall.getComments: ' + (stats.wall_success||0) + '/' + (stats.wall_attempted||0) + ' успешно · ' +
      'комментов: ' + (stats.comments_seen||0) + ' · ' +
      'комментаторов: ' + (stats.comment_authors||0) +
      ' (отсев: коротких ' + (stats.comments_filtered_short||0) + ', от пабликов ' + (stats.comments_filtered_neg_from||0) + ')' +
      wallReasonsTxt +
      '<br>🎣 рыбаков-постов: ' + (stats.fishermen_posts||0) + '/' + (stats.anchors_total||0) + ' · ' +
      'якорей: ' + (stats.anchors_used||0) + ' · ' +
      '❤️ лайков ' + (stats.likes_success||0) + '/' + (stats.likes_attempted||0) + ' (' + (stats.likers_unique||0) + ' уник.) · ' +
      '🔁 репостов ' + (stats.reposts_success||0) + '/' + (stats.reposts_attempted||0) + ' (' + (stats.reposters_unique||0) + ' уник.)' +
      likeReasonsTxt + repostReasonsTxt +
      '<br>👥 групп: ' + (stats.groups_scanned||0) + ' из ' + (stats.groups_resolved||0) + ' резолвленных · ' +
      'участников: ' + (stats.members_fetched||0) +
      '<br>после фильтра: ' + (stats.after_demo_filter||0) + sourceHtml + rejHtml +
      '</div>';

    var groupsHtml = '';
    if (groups.length){
      groupsHtml = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px">Источники: ' +
        groups.map(function(g){
          return '<a href="https://vk.com/' + esc(g.screen_name||('club'+g.id)) + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">' +
            esc(g.name||g.screen_name) + '</a>';
        }).join(' · ') +
      '</div>';
    }

    if (!cands.length){
      document.getElementById('vkProblemResults').innerHTML = statsHtml + groupsHtml +
        '<div style="padding:24px;text-align:center;color:var(--text-dim)">Никого не нашли. Возможно, seed-сообщества категории закрыты или малочисленны — попробуй другую категорию или открой их в админке.</div>';
      return;
    }

    var rows = cands.map(function(c){
      var bdate = c.bdate || '';
      var sexLabel = c.sex === 1 ? '♀' : c.sex === 2 ? '♂' : '';
      var about = c.about ? '<div style="font-size:12px;color:var(--text-dim);margin-top:4px;line-height:1.4">' + esc(c.about) + '</div>' : '';
      var status = c.status ? '<div style="font-size:12px;font-style:italic;color:var(--text-dim);margin-top:2px">«' + esc(c.status) + '»</div>' : '';
      // Источник: 📰 пост, 💬 коммент, ❤️ лайкер магнита, 🔁 репостер магнита, 👥 группа
      var srcBadge = '';
      if (c.source === 'newsfeed'){
        srcBadge = '<span style="font-size:10px;color:var(--success);margin-left:6px;border:1px solid var(--success);padding:1px 6px;border-radius:4px" title="Автор поста на тему">📰 автор поста</span>';
      } else if (c.source === 'comment'){
        srcBadge = '<span style="font-size:10px;color:var(--accent);margin-left:6px;border:1px solid var(--accent);padding:1px 6px;border-radius:4px" title="Оставил комментарий под постом на тему">💬 комментатор</span>';
      } else if (c.source === 'repost'){
        srcBadge = '<span style="font-size:10px;color:#f472b6;margin-left:6px;border:1px solid #f472b6;padding:1px 6px;border-radius:4px" title="Репостнул маркетинговый пост рыбака про эту боль — узнал себя сильно">🔁 репостнул магнит</span>';
      } else if (c.source === 'like'){
        srcBadge = '<span style="font-size:10px;color:#fb7185;margin-left:6px;border:1px solid #fb7185;padding:1px 6px;border-radius:4px" title="Лайкнул маркетинговый пост рыбака про эту боль — узнал себя">❤️ лайкер магнита</span>';
      } else if (c.source === 'group' && c.from_group && c.from_group.name){
        srcBadge = '<span style="font-size:11px;color:var(--text-dim)" title="Состоит в сообществе">👥 ' + esc(c.from_group.name) + '</span>';
      }
      // Brightness — насколько ярко выражена проблема (0..100).
      // Чем выше — тем сильнее текст-маркеры, тем теплее цвет чипа.
      var br = parseInt(c.brightness || 0, 10);
      var brColor = br >= 60 ? 'var(--error)' :
                    br >= 35 ? 'var(--warning)' :
                    br >= 15 ? 'var(--accent)' : 'var(--text-dim)';
      // Тултип-расшифровка: какие именно слагаемые дали этот балл.
      var brReasons = (c.brightness_reasons && c.brightness_reasons.length)
        ? c.brightness_reasons.join('\n')
        : 'нет данных для разбора';
      var brTitle = 'Яркость выраженности проблемы (наведи для расшифровки):\n\n' +
        brReasons + '\n\n' +
        'Шкала: 0–14 серый, 15–34 синий, 35–59 жёлтый, 60+ красный.';
      var brChip = '<span style="font-size:10px;color:' + brColor + ';margin-left:6px;border:1px solid ' + brColor + ';padding:1px 6px;border-radius:4px;cursor:help" title="' + esc(brTitle) + '">🔥 ' + br + '</span>';
      // Rerank-чип (если был ИИ-рерэнк)
      var rrChip = '';
      if (typeof c.rerank_score === 'number' && c.rerank_score >= 0){
        var rr = c.rerank_score;
        var rrColor = rr >= 70 ? 'var(--success)' :
                      rr >= 40 ? 'var(--warning)' :
                      'var(--error)';
        var rrTitle = 'ИИ-оценка «реально ли страдает прямо сейчас» 0–100.\n\n' +
          (c.rerank_reason || 'нет причины') +
          '\n\n70+ = точно страдает, 40–69 = граничный, <40 = не страдает.';
        rrChip = '<span style="font-size:10px;color:' + rrColor + ';margin-left:6px;border:1px solid ' + rrColor + ';padding:1px 6px;border-radius:4px;cursor:help;font-weight:600" title="' + esc(rrTitle) + '">🧠 ' + rr + '</span>';
      }
      var closed = c.is_closed ? '<span style="font-size:10px;color:var(--warning);margin-left:6px;border:1px solid var(--warning);padding:1px 6px;border-radius:4px">закрыт</span>' : '';
      // Триггер-блок: коммент или пост, реальные слова человека.
      var trig = '';
      if (c.triggering_comment && c.triggering_comment.text){
        var tc = c.triggering_comment;
        var postLink = tc.post_url ? '<a href="' + esc(tc.post_url) + '" target="_blank" rel="noopener" style="color:var(--text-dim);font-size:10px;text-decoration:underline" title="Открыть пост, под которым был коммент">↗ пост</a>' : '';
        trig = '<div style="margin-top:6px;padding:6px 10px;background:rgba(167,139,250,0.06);border-left:3px solid var(--accent);border-radius:4px">' +
          '<div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px">💬 его комментарий ' + postLink + '</div>' +
          '<div style="font-size:12px;line-height:1.4;font-style:italic">«' + esc(tc.text) + '»</div>' +
        '</div>';
      } else if (c.triggering_post && c.triggering_post.text){
        var tp = c.triggering_post;
        var postLink2 = tp.post_url ? '<a href="' + esc(tp.post_url) + '" target="_blank" rel="noopener" style="color:var(--text-dim);font-size:10px;text-decoration:underline" title="Открыть пост">↗ пост</a>' : '';
        trig = '<div style="margin-top:6px;padding:6px 10px;background:rgba(52,211,153,0.06);border-left:3px solid var(--success);border-radius:4px">' +
          '<div style="font-size:10px;color:var(--success);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px">📰 его пост ' + postLink2 + '</div>' +
          '<div style="font-size:12px;line-height:1.4;font-style:italic">«' + esc(tp.text) + '»</div>' +
        '</div>';
      } else if (c.anchor && c.anchor.post_excerpt){
        // Anchor — лайк/репост маркетингового поста рыбака.
        // Цитата якорного поста + engagement = «вот что зацепило».
        var an = c.anchor;
        var anLink = an.post_url ? '<a href="' + esc(an.post_url) + '" target="_blank" rel="noopener" style="color:var(--text-dim);font-size:10px;text-decoration:underline" title="Открыть якорный пост рыбака">↗ пост</a>' : '';
        var anLabel = an.action === 'repost' ? '🔁 репостнул' : '❤️ лайкнул';
        var anEng = an.engagement ? ' · ' + an.engagement + ' реакций' : '';
        trig = '<div style="margin-top:6px;padding:6px 10px;background:rgba(244,114,182,0.06);border-left:3px solid #f472b6;border-radius:4px">' +
          '<div style="font-size:10px;color:#f472b6;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px">' + anLabel + ' пост рыбака' + anEng + ' ' + anLink + '</div>' +
          '<div style="font-size:12px;line-height:1.4;font-style:italic">«' + esc(an.post_excerpt) + '»</div>' +
        '</div>';
      }
      var draftBtn = '<button data-vk="' + c.vk_id + '" class="vk-prob-draft" ' +
        'style="padding:6px 10px;border-radius:8px;border:1px solid rgba(167,139,250,0.4);background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer" ' +
        'title="Сгенерировать черновик сообщения с эхо-зацепкой по его словам">✉️ Сообщение</button>';
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:0">' +
            '<a href="' + esc(c.vk_url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;text-decoration:none">' +
              esc(c.full_name||('id'+c.vk_id)) +
            '</a>' +
            ' <span style="font-size:11px;color:var(--text-dim)">' + esc(sexLabel) + ' ' + esc(bdate) + ' ' + esc(c.city||'') + '</span>' +
            brChip +
            rrChip +
            closed +
          '</div>' +
          srcBadge +
          draftBtn +
        '</div>' +
        status + about + trig +
      '</div>';
    }).join('');

    document.getElementById('vkProblemResults').innerHTML = statsHtml + groupsHtml + rows;
    document.querySelectorAll('.vk-prob-draft').forEach(function(b){
      b.addEventListener('click', function(){ openDraft(parseInt(b.dataset.vk, 10)); });
    });
  }

  // ============================================
  // Драфт-модал для кандидата из «По проблеме»
  // ============================================
  function ensureModal(){
    var ov = document.getElementById('vkProbDraftOv');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'vkProbDraftOv';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:10000;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:680px;width:100%;max-height:90vh;overflow:auto;padding:18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<div style="font-size:16px;font-weight:700">✉️ Черновик сообщения</div>' +
          '<button id="vkProbDraftClose" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="vkProbDraftBody" style="font-size:13px"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('vkProbDraftClose').addEventListener('click', function(){ ov.style.display = 'none'; });
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.style.display = 'none'; });
    return ov;
  }

  async function openDraft(vkId){
    var c = candidateById[vkId];
    if (!c || !lastSearchPayload || !lastSearchPayload.category){
      alert('Сначала запусти поиск.');
      return;
    }
    var ov = ensureModal();
    ov.style.display = 'flex';
    var body = document.getElementById('vkProbDraftBody');
    body.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px">⏳ DeepSeek пишет крючок…</div>';
    try {
      var r = await api('/api/admin/vk/draft-by-problem', {
        method: 'POST',
        body: { category: lastSearchPayload.category, candidate: c },
      });
      renderDraft(r, c);
    } catch (e){
      body.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  function renderDraft(r, c){
    var alts = r.alternatives || [];
    var html = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Получатель: <a href="' + esc(c.vk_url) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(c.full_name||('id'+c.vk_id)) + '</a></div>';
    if (r.reasoning){
      html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;font-style:italic">💡 ' + esc(r.reasoning) + '</div>';
    }
    html += '<div style="background:rgba(167,139,250,0.06);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;margin-bottom:12px">' +
      '<div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Основной вариант</div>' +
      '<div id="vkProbDraftMain" style="white-space:pre-wrap;line-height:1.5;font-size:13px">' + esc(r.draft||'') + '</div>' +
    '</div>';
    if (alts.length){
      html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Альтернативы:</div>';
      alts.forEach(function(a, i){
        html += '<div style="background:var(--surface);border:1px solid var(--border);padding:8px 10px;border-radius:6px;margin-bottom:6px">' +
          '<div style="font-size:10px;color:var(--text-dim);margin-bottom:3px">Вариант ' + (i+2) + '</div>' +
          '<div style="white-space:pre-wrap;line-height:1.5;font-size:13px">' + esc(a) + '</div>' +
        '</div>';
      });
    }
    html += '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button id="vkProbDraftCopy" style="flex:1;padding:9px 14px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer">📋 Скопировать</button>' +
      '<button id="vkProbDraftRegen" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font:inherit;cursor:pointer">🔄 Перегенерить</button>' +
      (r.vk_chat_url
        ? '<a href="' + esc(r.vk_chat_url) + '" target="_blank" rel="noopener" style="padding:9px 14px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:transparent;color:var(--success);font:inherit;text-decoration:none">💬 Открыть VK</a>'
        : '') +
    '</div>';
    document.getElementById('vkProbDraftBody').innerHTML = html;

    document.getElementById('vkProbDraftCopy').addEventListener('click', async function(){
      var txt = document.getElementById('vkProbDraftMain').innerText || (r.draft||'');
      try { await navigator.clipboard.writeText(txt); this.textContent = '✓ Скопировано'; }
      catch (_e) { this.textContent = '⚠️ не вышло'; }
      var btn = this;
      setTimeout(function(){ btn.textContent = '📋 Скопировать'; }, 1500);
    });
    document.getElementById('vkProbDraftRegen').addEventListener('click', function(){ openDraft(c.vk_id); });
  }

  // ============================================
  // Self-correction phrases — модалка с диффом
  // ============================================
  function ensureOptModal(){
    var ov = document.getElementById('vkProbOptOv');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'vkProbOptOv';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:10000;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:760px;width:100%;max-height:90vh;overflow:auto;padding:18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<div style="font-size:16px;font-weight:700">🧠 Самокоррекция фраз</div>' +
          '<button id="vkProbOptClose" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="vkProbOptBody" style="font-size:13px"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('vkProbOptClose').addEventListener('click', function(){ ov.style.display = 'none'; });
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.style.display = 'none'; });
    return ov;
  }

  async function openOptimize(){
    if (!selectedCode){ alert('Сначала выбери категорию.'); return; }
    var ov = ensureOptModal();
    ov.style.display = 'flex';
    var body = document.getElementById('vkProbOptBody');
    body.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px">⏳ DeepSeek анализирует перфоманс…</div>';
    try {
      var r = await api('/api/admin/vk/phrases/optimize?category=' + encodeURIComponent(selectedCode), { method: 'POST' });
      renderOpt(r);
    } catch (e){
      body.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  function renderOpt(r){
    var current = r.current_phrases || [];
    var keep = r.keep || [];
    var drop = r.drop || [];
    var suggested = r.suggested || [];
    var proposed = r.proposed || [];
    var perf = r.perf || [];
    var reasoning = r.reasoning || '';

    var perfRows = perf.map(function(p){
      var conv = (p.posts_seen > 0) ? Math.round((p.candidates_yielded||0) * 100 / p.posts_seen) + '%' : '—';
      var color = drop.indexOf(p.phrase) >= 0 ? 'var(--error)' :
                  keep.indexOf(p.phrase) >= 0 ? 'var(--success)' : 'var(--text-dim)';
      var marker = drop.indexOf(p.phrase) >= 0 ? '🗑' :
                   keep.indexOf(p.phrase) >= 0 ? '✓' : '·';
      return '<tr><td style="padding:4px 8px;color:' + color + '">' + marker + ' ' + esc(p.phrase) + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-dim);text-align:right">' + (p.posts_seen||0) + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-dim);text-align:right">' + (p.candidates_yielded||0) + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-dim);text-align:right">' + conv + '</td></tr>';
    }).join('');

    var perfHtml = perf.length
      ? '<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Текущие фразы</div>' +
          '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
            '<thead><tr style="color:var(--text-dim)"><th style="text-align:left;padding:4px 8px">фраза</th><th style="padding:4px 8px;text-align:right">постов</th><th style="padding:4px 8px;text-align:right">кандидатов</th><th style="padding:4px 8px;text-align:right">конв.</th></tr></thead>' +
            '<tbody>' + perfRows + '</tbody>' +
          '</table>' +
        '</div>'
      : '<div style="margin-bottom:14px;color:var(--text-dim)">Перфоманс ещё не накоплен — запусти поиск пару раз и приходи.</div>';

    var sugHtml = suggested.length
      ? '<div style="background:rgba(52,211,153,0.06);border-left:3px solid var(--success);padding:10px 12px;border-radius:6px;margin-bottom:14px">' +
          '<div style="font-size:10px;color:var(--success);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Новые фразы от DeepSeek</div>' +
          '<ul style="margin:0;padding-left:20px;line-height:1.5">' +
            suggested.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') +
          '</ul>' +
        '</div>'
      : '<div style="margin-bottom:14px;color:var(--text-dim)">DeepSeek ничего нового не предложил.</div>';

    var reasonHtml = reasoning
      ? '<div style="font-size:11px;color:var(--text-dim);font-style:italic;margin-bottom:14px">💡 ' + esc(reasoning) + '</div>'
      : '';

    var proposedListHtml = proposed.map(function(p, i){
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<input type="checkbox" data-idx="' + i + '" class="vk-prob-opt-chk" checked style="margin:0">' +
        '<input type="text" class="vk-prob-opt-phrase" value="' + esc(p) + '" style="flex:1;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit;font-size:12px">' +
      '</div>';
    }).join('');

    var html = reasonHtml + perfHtml + sugHtml +
      '<div style="margin-bottom:6px;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px">Применить набор фраз (правь и снимай галочки)</div>' +
      '<div id="vkProbOptList" style="margin-bottom:14px;max-height:220px;overflow:auto">' + proposedListHtml + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="vkProbOptApply" style="flex:1;padding:9px 14px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer">✓ Применить</button>' +
        '<button id="vkProbOptCancel" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font:inherit;cursor:pointer">Отмена</button>' +
      '</div>';

    document.getElementById('vkProbOptBody').innerHTML = html;

    document.getElementById('vkProbOptCancel').addEventListener('click', function(){
      document.getElementById('vkProbOptOv').style.display = 'none';
    });
    document.getElementById('vkProbOptApply').addEventListener('click', async function(){
      var picks = [];
      document.querySelectorAll('#vkProbOptList > div').forEach(function(row){
        var chk = row.querySelector('.vk-prob-opt-chk');
        var inp = row.querySelector('.vk-prob-opt-phrase');
        if (chk && chk.checked && inp && inp.value.trim()){
          picks.push(inp.value.trim());
        }
      });
      if (!picks.length){ alert('Выбери хотя бы одну фразу.'); return; }
      this.disabled = true; this.textContent = '⏳…';
      try {
        await api('/api/admin/vk/phrases/apply', {
          method: 'POST',
          body: { category: selectedCode, phrases: picks, suggested_by: 'auto' },
        });
        document.getElementById('vkProbOptBody').innerHTML =
          '<div style="text-align:center;color:var(--success);padding:20px">' +
            '✓ Применено ' + picks.length + ' фраз. Следующий поиск возьмёт их.' +
          '</div>';
        setTimeout(function(){
          document.getElementById('vkProbOptOv').style.display = 'none';
        }, 1500);
      } catch (e){
        this.disabled = false; this.textContent = '✓ Применить';
        alert('Ошибка применения: ' + (e.message || ''));
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectUI);
  } else { injectUI(); }
})();


// ============================================
// 🎯 VK B2B/B2C — отдельный IIFE с двумя секциями:
//   1) 🔬 B2C: глубокий анализ одной страницы по URL (без БД)
//   2) 🎣 B2B: поиск рыбаков (психологи/коучи/нутрициологи и т.д.)
//      и питч-генератор «продаём AI-помощника под их нишу».
// Заменяет старый таб «🔎 По проблеме» (там же скрыта кнопка).
// ============================================
(function(){
  'use strict';
  var API = (window.API_BASE_URL) || 'https://fredi-backend-flz2.onrender.com';
  var LS = 'fredi_admin_token';
  function tok(){ try { return localStorage.getItem(LS) || ''; } catch(e){ return ''; } }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  async function api(path, opts){
    opts = opts || {};
    var h = { 'X-Admin-Token': tok(), 'Accept':'application/json' };
    if (opts.body) h['Content-Type'] = 'application/json';
    var r = await fetch(API + path, { method: opts.method||'GET', headers: h, body: opts.body?JSON.stringify(opts.body):undefined });
    if (r.status === 401) throw new Error('Неверный ADMIN_TOKEN');
    var j = null; try { j = await r.json(); } catch(e){}
    if (!r.ok){ var m = (j && (j.detail && (j.detail.message||j.detail.error)||j.error))||('HTTP '+r.status); throw new Error(m); }
    return j;
  }

  var fishCats = null;
  var lastFishermenSearch = null;

  function injectUI(){
    var nav = document.getElementById('navBar');
    if (!nav){ return setTimeout(injectUI, 500); }
    if (document.getElementById('vkB2Btn')) return;

    var btn = document.createElement('button');
    btn.id = 'vkB2Btn'; btn.dataset.tab = 'vkB2'; btn.textContent = '🎯 VK B2B/B2C';
    btn.style.cssText = 'flex:0 0 auto';
    var anchor = document.getElementById('vkProblemTabBtn') || document.getElementById('vkTabBtn') || document.getElementById('exportClaudeBtn');
    if (anchor && anchor.nextSibling) nav.insertBefore(btn, anchor.nextSibling);
    else nav.appendChild(btn);

    var sec = document.createElement('section');
    sec.id = 'vkB2Tab'; sec.style.display = 'none';
    sec.innerHTML =
      '<h2>🔬 B2C: Глубокий анализ VK-профиля</h2>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:24px">' +
        '<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">' +
          'Вставь ссылку на VK-профиль. DeepSeek проходит по нему в три прохода: ' +
          'психологический портрет → активная боль → 3 крючка с self-оценкой. ' +
          'Цель — крючок такой силы, чтобы 9 из 10 ответили.' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<input id="vkB2Url" type="text" placeholder="vk.com/durov или durov или id1" ' +
            'style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit">' +
          '<button id="vkB2AnalyzeBtn" style="padding:9px 16px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer">🔬 Проанализировать</button>' +
          '<span id="vkB2AnalyzeStatus" style="font-size:12px;color:var(--text-dim)"></span>' +
        '</div>' +
        '<div id="vkB2AnalyzeBody" style="margin-top:14px"></div>' +
      '</div>' +
      '<h2>🎣 B2B: Поиск рыбаков (продажа AI-инструмента)</h2>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">' +
        '<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">' +
          'Психологи, коучи, нутрициологи, тарологи и др. — кому продаём <b>конфигурируемого AI-помощника</b>: ' +
          'он работает в их стиле, под их брендом, держит клиентов между сессиями, сам находит новых. ' +
          'Фреди — наш референс-кейс (виртуальный психолог).' +
        '</div>' +
        '<div id="vkFishCats" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">— загружаю категории —</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px">' +
          '<label style="display:flex;align-items:center;gap:4px" title="Минимум подписчиков+друзей у рыбака">Мин. аудитория:' +
            '<input id="vkFishMinAud" type="number" min="0" max="100000" step="100" value="100" style="width:80px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit"></label>' +
          '<label style="display:flex;align-items:center;gap:4px">Лимит:' +
            '<input id="vkFishMax" type="number" min="5" max="100" step="5" value="20" style="width:70px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.03);color:var(--text);font:inherit"></label>' +
          '<button id="vkFishSearchBtn" disabled style="padding:9px 16px;border-radius:8px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-weight:700;cursor:pointer;opacity:0.6">🎣 Найти рыбаков</button>' +
          '<span id="vkFishStatus" style="color:var(--text-dim)"></span>' +
        '</div>' +
      '</div>' +
      '<div id="vkFishMeta" style="margin-bottom:10px;font-size:12px;color:var(--text-dim)"></div>' +
      '<div id="vkFishResults"></div>';
    document.body.appendChild(sec);

    btn.addEventListener('click', activate);
    document.querySelectorAll('#navBar button').forEach(function(b){
      if (b.id === 'vkB2Btn') return;
      b.addEventListener('click', deactivate);
    });

    document.getElementById('vkB2AnalyzeBtn').addEventListener('click', runB2C);
    document.getElementById('vkB2Url').addEventListener('keydown', function(e){
      if (e.key === 'Enter') runB2C();
    });
    document.getElementById('vkFishSearchBtn').addEventListener('click', runFish);
  }

  function activate(){
    document.querySelectorAll('#navBar button').forEach(function(x){ x.classList.remove('active'); });
    document.getElementById('vkB2Btn').classList.add('active');
    ['summaryTab','recentTab','dialogsTab','vkTab','vkProblemTab'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    document.getElementById('vkB2Tab').style.display = 'block';
    if (!fishCats) loadFishCats();
  }
  function deactivate(){
    var t = document.getElementById('vkB2Tab'); if (t) t.style.display = 'none';
    var b = document.getElementById('vkB2Btn'); if (b) b.classList.remove('active');
  }

  async function runB2C(){
    var url = (document.getElementById('vkB2Url').value || '').trim();
    if (!url){ alert('Вставь ссылку или username'); return; }
    var status = document.getElementById('vkB2AnalyzeStatus');
    var body = document.getElementById('vkB2AnalyzeBody');
    status.textContent = '⏳ парсинг VK + DeepSeek (3 прохода)…';
    body.innerHTML = '';
    try {
      var r = await api('/api/admin/vk/profile-analysis', {
        method: 'POST', body: { url: url },
      });
      status.textContent = '✓ готово';
      renderB2C(r);
    } catch (e){
      status.textContent = '';
      body.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  function renderB2C(r){
    var p = r.profile || {};
    var pain = r.pain || {};
    var hooks = r.hooks || {};
    var ub = (r.vk_data || {}).user_basic || {};

    var profileHtml =
      '<div style="background:rgba(167,139,250,0.06);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;margin-bottom:12px">' +
        '<div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">🧠 Психологический портрет</div>' +
        '<div style="font-size:13px;line-height:1.5">' + esc(p.profile || '—') + '</div>' +
        (p.archetype ? '<div style="font-size:11px;color:var(--text-dim);margin-top:6px">Архетип: <b>' + esc(p.archetype) + '</b> · Открытость: ' + esc(p.openness || '—') + '</div>' : '') +
        (p.defenses && p.defenses.length ? '<div style="font-size:11px;color:var(--text-dim);margin-top:4px">Защиты: ' + p.defenses.map(esc).join(', ') + '</div>' : '') +
        (p.patterns && p.patterns.length ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">Паттерны: ' + p.patterns.map(esc).join(', ') + '</div>' : '') +
      '</div>';

    var painHtml =
      '<div style="background:rgba(248,113,113,0.08);border-left:3px solid var(--error);padding:10px 12px;border-radius:6px;margin-bottom:12px">' +
        '<div style="font-size:10px;color:var(--error);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">🔥 Активная боль (' + esc(pain.pain_intensity || '—') + ')</div>' +
        '<div style="font-size:14px;font-weight:600;line-height:1.4">' + esc(pain.pain_active || '—') + '</div>' +
        (pain.evidence_quotes && pain.evidence_quotes.length ?
          '<ul style="margin:6px 0 0 18px;padding:0;font-style:italic;color:var(--text-dim);font-size:12px">' +
          pain.evidence_quotes.map(function(q){ return '<li>«' + esc(q) + '»</li>'; }).join('') + '</ul>' : '') +
        (pain.desired_outcome ? '<div style="margin-top:6px;font-size:12px;color:var(--text-dim)">Хочет: ' + esc(pain.desired_outcome) + '</div>' : '') +
        (pain.vulnerability_window ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">Окно открытости: ' + esc(pain.vulnerability_window) + '</div>' : '') +
      '</div>';

    var variants = (hooks.variants || []);
    var hooksHtml = '';
    if (variants.length){
      hooksHtml += '<div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">✉️ Крючки (3 варианта, рекомендуем: <b>' + esc(hooks.best_tone || '—') + '</b>)</div>';
      variants.forEach(function(v, i){
        var label = v.tone === 'soft' ? 'Мягкий' : v.tone === 'direct' ? 'Прямой' : v.tone === 'emotional' ? 'Эмоциональный' : v.tone;
        var sc = parseInt(v.score || 0, 10);
        var scColor = sc >= 70 ? 'var(--success)' : sc >= 40 ? 'var(--warning)' : 'var(--error)';
        hooksHtml +=
          '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
              '<div style="font-size:12px;font-weight:600">' + esc(label) + '</div>' +
              '<span style="font-size:10px;color:' + scColor + ';border:1px solid ' + scColor + ';padding:1px 6px;border-radius:4px">🧠 ' + sc + '</span>' +
            '</div>' +
            '<div class="vk-b2c-hook" style="white-space:pre-wrap;line-height:1.5;font-size:13px">' + esc(v.text || '') + '</div>' +
            (v.reasoning ? '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;font-style:italic">💡 ' + esc(v.reasoning) + '</div>' : '') +
            '<button data-i="' + i + '" class="vk-b2c-copy" style="margin-top:6px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--accent);font:inherit;font-size:11px;cursor:pointer">📋 Скопировать</button>' +
          '</div>';
      });
      if (hooks.strategy_summary){
        hooksHtml += '<div style="font-size:11px;color:var(--text-dim);font-style:italic">💡 ' + esc(hooks.strategy_summary) + '</div>';
      }
    } else if (hooks.error){
      hooksHtml = '<div style="color:var(--error);font-size:12px">DeepSeek не справился: ' + esc(hooks.error) + '</div>';
    }

    var head =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<a href="' + esc(r.vk_url || '#') + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;text-decoration:none">' +
          esc(((ub.first_name||'') + ' ' + (ub.last_name||'')).trim()) +
        '</a>' +
        ' <span style="font-size:11px;color:var(--text-dim)">' + ((r.vk_data||{}).wall_count||0) + ' постов · ' + ((r.vk_data||{}).groups_count||0) + ' групп</span>' +
        (ub.is_closed ? '<span style="font-size:10px;color:var(--warning);border:1px solid var(--warning);padding:1px 6px;border-radius:4px">закрыт</span>' : '') +
      '</div>';

    document.getElementById('vkB2AnalyzeBody').innerHTML = head + profileHtml + painHtml + hooksHtml;

    document.querySelectorAll('.vk-b2c-copy').forEach(function(b){
      b.addEventListener('click', async function(){
        var hookEl = b.parentElement.querySelector('.vk-b2c-hook');
        if (!hookEl) return;
        try { await navigator.clipboard.writeText(hookEl.innerText || ''); b.textContent = '✓ Скопировано'; }
        catch(e){ b.textContent = '⚠️ не вышло'; }
        setTimeout(function(){ b.textContent = '📋 Скопировать'; }, 1500);
      });
    });
  }

  async function loadFishCats(){
    try {
      var r = await api('/api/admin/vk/fisherman-categories');
      fishCats = r.categories || [];
      renderFishCats();
    } catch (e){
      document.getElementById('vkFishCats').innerHTML =
        '<span style="color:var(--error)">Ошибка загрузки категорий: ' + esc(e.message) + '</span>';
    }
  }

  var fishSelectedCode = null;

  function renderFishCats(){
    var html = fishCats.map(function(c){
      return '<button data-code="' + esc(c.code) + '" class="vk-fish-chip" ' +
        'style="padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;cursor:pointer;text-align:left;line-height:1.3" ' +
        'title="' + esc(c.description || '') + ' · продукт: ' + esc(c.product_hint || '') + '">' +
          '<div style="font-size:13px;font-weight:600">' + c.icon + ' ' + esc(c.name_ru) + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' + esc(c.product_hint || '') + '</div>' +
        '</button>';
    }).join('');
    document.getElementById('vkFishCats').innerHTML = html;

    document.querySelectorAll('.vk-fish-chip').forEach(function(b){
      b.addEventListener('click', function(){
        document.querySelectorAll('.vk-fish-chip').forEach(function(x){
          x.style.borderColor = 'var(--border)';
          x.style.background = 'var(--surface)';
        });
        b.style.borderColor = 'var(--accent)';
        b.style.background = 'rgba(167,139,250,0.10)';
        fishSelectedCode = b.dataset.code;
        var btn = document.getElementById('vkFishSearchBtn');
        btn.disabled = false; btn.style.opacity = '1';
        var meta = (fishCats.find(function(c){ return c.code === fishSelectedCode; }) || {});
        document.getElementById('vkFishMeta').innerHTML =
          'Ниша: <span style="color:var(--text)">' + esc(meta.description || '') + '</span> · ' +
          'Продукт: <span style="color:var(--accent)">' + esc(meta.product_hint || '') + '</span>';
      });
    });
  }

  async function runFish(){
    if (!fishSelectedCode){ return; }
    var minAud = parseInt(document.getElementById('vkFishMinAud').value || '100', 10);
    var maxRes = parseInt(document.getElementById('vkFishMax').value || '20', 10);
    var status = document.getElementById('vkFishStatus');
    var results = document.getElementById('vkFishResults');
    status.textContent = '⏳ ищу рыбаков…';
    results.innerHTML = '';
    try {
      var r = await api('/api/admin/vk/fisherman-search?category=' + encodeURIComponent(fishSelectedCode) +
        '&min_audience=' + minAud + '&max_results=' + maxRes, { method: 'POST' });
      lastFishermenSearch = { category: fishSelectedCode, candidates: r.candidates || [] };
      status.textContent = '✓ найдено ' + (r.candidates||[]).length;
      renderFish(r);
    } catch (e){
      status.textContent = '';
      results.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  function renderFish(r){
    var cands = r.candidates || [];
    var stats = r.stats || {};

    var statsHtml = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">' +
      '🔍 users.search: ' + (stats.search_success||0) + '/' + (stats.search_attempts||0) + ' · ' +
      'найдено: ' + (stats.candidates_total||0) + ' · ' +
      'с маркерами категории: ' + (stats.after_marker_filter||0) + ' · ' +
      'с аудиторией ≥' + (stats.min_audience||0) + ': ' + (stats.after_audience_filter||0) +
      '</div>';

    if (!cands.length){
      document.getElementById('vkFishResults').innerHTML = statsHtml +
        '<div style="padding:24px;text-align:center;color:var(--text-dim)">Никого не нашли. Попробуй снизить мин. аудиторию или другую категорию.</div>';
      return;
    }

    var rows = cands.map(function(c){
      var name = c.full_name || ('id'+c.vk_id);
      var subtitle = (c.occupation || c.status || '').substring(0, 200);
      var followers = c.followers || 0;
      var aud = c.audience_size || 0;
      var about = c.about ? '<div style="font-size:12px;color:var(--text-dim);margin-top:4px;line-height:1.4">' + esc(c.about) + '</div>' : '';
      var site = c.site ? '<a href="' + esc(c.site) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent);text-decoration:none">↗ сайт</a>' : '';
      var pitchBtn = '<button data-vk="' + c.vk_id + '" class="vk-fish-pitch" ' +
        'style="padding:6px 12px;border-radius:8px;border:1px solid rgba(167,139,250,0.4);background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer" ' +
        'title="Сгенерировать B2B-питч для этого рыбака">✉️ Предложить Фреди</button>';
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:0">' +
            '<a href="' + esc(c.vk_url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;text-decoration:none">' +
              esc(name) +
            '</a>' +
            ' <span style="font-size:11px;color:var(--text-dim)">' + (c.city ? esc(c.city) + ' · ' : '') +
            '👥 ' + followers + ' подп · ' + aud + ' всего</span>' +
            ' ' + site +
          '</div>' +
          pitchBtn +
        '</div>' +
        (subtitle ? '<div style="font-size:12px;font-style:italic;color:var(--text-dim);margin-top:4px">«' + esc(subtitle) + '»</div>' : '') +
        about +
      '</div>';
    }).join('');

    document.getElementById('vkFishResults').innerHTML = statsHtml + rows;
    document.querySelectorAll('.vk-fish-pitch').forEach(function(b){
      b.addEventListener('click', function(){ openPitch(parseInt(b.dataset.vk, 10)); });
    });
  }

  function ensurePitchModal(){
    var ov = document.getElementById('vkFishPitchOv');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'vkFishPitchOv';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:10000;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<div style="font-size:16px;font-weight:700">✉️ B2B-питч рыбаку</div>' +
          '<button id="vkFishPitchClose" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="vkFishPitchBody" style="font-size:13px"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('vkFishPitchClose').addEventListener('click', function(){ ov.style.display = 'none'; });
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.style.display = 'none'; });
    return ov;
  }

  async function openPitch(vkId){
    if (!lastFishermenSearch) return;
    var cand = (lastFishermenSearch.candidates || []).find(function(c){ return c.vk_id === vkId; });
    if (!cand) return;
    var ov = ensurePitchModal();
    ov.style.display = 'flex';
    var body = document.getElementById('vkFishPitchBody');
    body.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px">⏳ DeepSeek пишет питч под этого рыбака…</div>';
    try {
      var r = await api('/api/admin/vk/fisherman-pitch', {
        method: 'POST',
        body: { category: lastFishermenSearch.category, fisherman: cand },
      });
      renderPitch(r, cand);
    } catch (e){
      body.innerHTML = '<div style="color:var(--error);padding:14px">Ошибка: ' + esc(e.message) + '</div>';
    }
  }

  function renderPitch(r, cand){
    var variants = r.variants || [];
    var label = r.product_label || '';
    var rec = r.recommended_tone || '';
    var head = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Получатель: <a href="' + esc(cand.vk_url) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(cand.full_name||('id'+cand.vk_id)) + '</a> · продукт: <b style="color:var(--accent)">' + esc(label) + '</b></div>';
    if (r.strategy_summary){
      head += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;font-style:italic">💡 ' + esc(r.strategy_summary) + '</div>';
    }

    var html = head;
    var labels = { short: 'Короткий', detail: 'Развёрнутый', case: 'С кейсом' };
    variants.forEach(function(v, i){
      var isRec = v.tone === rec;
      var bg = isRec ? 'rgba(167,139,250,0.06)' : 'var(--surface)';
      var br = isRec ? '3px solid var(--accent)' : '1px solid var(--border)';
      html += '<div style="background:' + bg + ';border-left:' + br + ';padding:10px 12px;border-radius:6px;margin-bottom:10px" data-tone="' + esc(v.tone || '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
          '<div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px">' + esc(labels[v.tone] || v.tone) + (isRec ? ' ⭐ рекоменд' : '') + '</div>' +
        '</div>' +
        '<div class="vk-fish-pitch-text" style="white-space:pre-wrap;line-height:1.5;font-size:13px">' + esc(v.text || '') + '</div>' +
        (v.reasoning ? '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;font-style:italic">💡 ' + esc(v.reasoning) + '</div>' : '') +
        '<div class="vk-fish-pitch-status" style="font-size:11px;margin-top:6px;min-height:14px"></div>' +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<button data-i="' + i + '" class="vk-fish-pitch-copy" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--accent);font:inherit;font-size:11px;cursor:pointer">📋 Скопировать</button>' +
          '<button data-vk="' + (cand.vk_id || '') + '" class="vk-fish-pitch-send" style="padding:5px 10px;border-radius:6px;border:none;background:var(--accent-grad);color:#fff;font:inherit;font-size:11px;font-weight:700;cursor:pointer">📤 Отправить</button>' +
          (r.vk_chat_url ? '<a href="' + esc(r.vk_chat_url) + '" target="_blank" rel="noopener" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(52,211,153,0.4);background:transparent;color:var(--success);font:inherit;font-size:11px;text-decoration:none">💬 VK-чат</a>' : '') +
        '</div>' +
      '</div>';
    });

    document.getElementById('vkFishPitchBody').innerHTML = html;
    document.querySelectorAll('.vk-fish-pitch-copy').forEach(function(b){
      b.addEventListener('click', async function(){
        var txt = b.parentElement.parentElement.querySelector('.vk-fish-pitch-text').innerText || '';
        try { await navigator.clipboard.writeText(txt); b.textContent = '✓ Скопировано'; }
        catch(e){ b.textContent = '⚠️ не вышло'; }
        setTimeout(function(){ b.textContent = '📋 Скопировать'; }, 1500);
      });
    });
    // Кнопка «📤 Отправить» — реальная отправка через VK messages.send.
    document.querySelectorAll('.vk-fish-pitch-send').forEach(function(b){
      b.addEventListener('click', async function(){
        var box = b.parentElement.parentElement;
        var txtEl = box.querySelector('.vk-fish-pitch-text');
        var statusEl = box.querySelector('.vk-fish-pitch-status');
        var tone = box.getAttribute('data-tone') || '';
        var vkId = parseInt(b.dataset.vk, 10);
        var name = (cand && cand.full_name) || ('id' + vkId);
        var txt = (txtEl && txtEl.innerText || '').trim();
        if (!vkId || !txt){ return; }
        if (!confirm('Отправить это сообщение «' + name + '»? Действие необратимо.')) return;
        b.disabled = true; b.textContent = '⏳…';
        if (statusEl) statusEl.innerHTML = '';
        try {
          var resp = await api('/api/admin/vk/fisherman-send', {
            method: 'POST',
            body: {
              vk_id: vkId, text: txt,
              category: (lastFishermenSearch && lastFishermenSearch.category) || '',
              tone: tone,
            },
          });
          if (resp.success){
            b.textContent = '✓ Отправлено';
            b.style.background = 'var(--success)';
            if (statusEl) statusEl.innerHTML =
              '<span style="color:var(--success)">✓ Сообщение доставлено</span>';
          } else {
            b.disabled = false;
            b.textContent = '📤 Отправить';
            if (statusEl) statusEl.innerHTML =
              '<span style="color:var(--error)">⚠ ' + esc(resp.message || 'не удалось') + ' — </span>' +
              '<a href="' + esc(resp.vk_chat_url || ('https://vk.com/im?sel=' + vkId)) +
              '" target="_blank" rel="noopener" style="color:var(--accent)">открой VK-чат и отправь руками ↗</a>';
          }
        } catch (e){
          b.disabled = false;
          b.textContent = '📤 Отправить';
          if (statusEl) statusEl.innerHTML =
            '<span style="color:var(--error)">⚠ ' + esc(e.message || 'ошибка') + '</span>';
        }
      });
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectUI);
  } else { injectUI(); }
})();
