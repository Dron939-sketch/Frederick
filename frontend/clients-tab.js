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
