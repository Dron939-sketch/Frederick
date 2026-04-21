// tracker.js — Fredi analytics (lightweight, fire-and-forget)
//
// Покрывает:
//   session_start / session_end (active-only время, без заэкранного простоя)
//   screen_view, feature_opened / feature_closed (с duration_sec)
//   message_sent, ai_response_received, ai_response_error  (через apiCall + fetch)
//   api_error / api_network_error                          (на сетевом уровне)
//   tab_hidden / tab_visible, theme_switch, error, promise_unhandled
//
// Публичный API: window.FrediTracker.track(event, data)
(function(){
    if(window._trackerLoaded) return;
    window._trackerLoaded=true;

    var API=function(){return window.API_BASE_URL||window.CONFIG?.API_BASE_URL||'https://fredi-backend-flz2.onrender.com';};
    var UID=function(){return window.USER_ID||window.CONFIG?.USER_ID;};
    var SID=Date.now()+'_'+Math.random().toString(36).substr(2,6);
    var START=Date.now();
    var _screen='';
    var _queue=[];
    var _sending=false;

    // --- active-time accounting (visibility API) ---
    var _activeMs=0;
    var _lastActiveAt=Date.now();
    var _isVisible=!document.hidden;

    function _tickActive(){
        if(_isVisible){
            var now=Date.now();
            _activeMs += now - _lastActiveAt;
            _lastActiveAt = now;
        }
    }

    // Текущая «открытая» фича для feature_opened/closed.
    var _currentFeature=null;
    var _featureOpenedAt=0;

    // ---- user attrs ----
    var _isPremium=null;
    function _detectDevice(){
        var ua=(navigator.userAgent||'').toLowerCase();
        if(/ipad|tablet/.test(ua) || (window.innerWidth>=768 && window.innerWidth<=1024 && 'ontouchstart' in window)) return 'tablet';
        if(/mobile|iphone|android|phone/.test(ua) || (window.innerWidth<768 && 'ontouchstart' in window)) return 'mobile';
        return 'desktop';
    }
    function _isPwa(){
        try{ return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true); }catch(e){ return false; }
    }
    function _connType(){ try{ return (navigator.connection && navigator.connection.effectiveType) || ''; }catch(e){ return ''; } }
    function _getAttrs(){
        var a={
            is_authed: !!(window.IS_AUTHENTICATED || window.CURRENT_USER_EMAIL),
            device: _detectDevice(),
            pwa: _isPwa(),
            lang: (navigator.language||'').slice(0,20),
            connection: _connType(),
            theme: (document.documentElement.getAttribute('data-theme')||'dark'),
            plan: (_isPremium === true ? 'premium' : 'free'),
        };
        if(_isPremium !== null) a.is_premium = !!_isPremium;
        return a;
    }
    async function _refreshPremium(){
        var uid=UID();
        if(!uid) return;
        try{
            var r=await _origFetch.call(window, API()+'/api/meter/status/'+uid, {credentials:'include'});
            if(!r.ok) return;
            var d=await r.json();
            _isPremium=!!d.is_premium;
        }catch(e){}
    }

    function track(event,data){
        var payload={
            user_id:UID(),
            session_id:SID,
            event:event,
            data:data||{},
            attrs:_getAttrs(),
            screen:_screen,
            ts:new Date().toISOString()
        };
        _queue.push(payload);
        _flush();
    }

    // Сохраняем оригинальный fetch ДО любых патчей (до meter.js),
    // чтобы аналитика могла слать события, не попадая сама в meter-проверки.
    var _origFetch=window.fetch.bind(window);

    function _flush(){
        if(_sending||!_queue.length) return;
        _sending=true;
        var batch=_queue.splice(0,10);
        try{
            var blob=new Blob([JSON.stringify({events:batch})],{type:'application/json'});
            navigator.sendBeacon(API()+'/api/analytics/events',blob);
        }catch(e){
            try{
                _origFetch(API()+'/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true});
            }catch(e2){}
        }
        _sending=false;
        if(_queue.length) setTimeout(_flush,1000);
    }

    // ---- feature lifecycle ----
    function _openFeature(name){
        if(!name) return;
        if(_currentFeature && _currentFeature === name) return;
        if(_currentFeature){
            var dur=Math.round((Date.now()-_featureOpenedAt)/1000);
            track('feature_closed',{feature:_currentFeature,duration_sec:dur});
        }
        _currentFeature=name;
        _featureOpenedAt=Date.now();
        track('feature_opened',{feature:name});
    }
    function _closeCurrentFeature(reason){
        if(!_currentFeature) return;
        var dur=Math.round((Date.now()-_featureOpenedAt)/1000);
        track('feature_closed',{feature:_currentFeature,duration_sec:dur,reason:reason||''});
        _currentFeature=null;
    }

    // Auto-track: screen views (navigation)
    function _hookNav(){
        var list=document.getElementById('chatsList');
        var footer=document.querySelector('.chats-footer');
        function onClick(e){
            var item=e.target.closest('.chat-item[data-chat]');
            if(!item) return;
            var chat=item.dataset.chat;
            _screen=chat;
            track('screen_view',{screen:chat});
            _openFeature(chat);
        }
        if(list) list.addEventListener('click',onClick);
        if(footer) footer.addEventListener('click',onClick);
    }

    // ---- список AI-эндпоинтов ----
    var AI_RE=/\/api\/(?:chat|voice\/process|ai\/generate|deep-analysis|hypno\/support|psychologist-thoughts\/generate|dreams\/(?:interpret|clarify)|reality\/(?:check|parse\/[^/]+)|brand\/transformation|mirrors\/(?:complete|[^/]+\/complete)|morning\/send-now)(?:\/|$|\?)/;

    function _shortEndpoint(urlStr){
        try{ var u=new URL(urlStr,window.location.origin); return u.pathname.slice(0,80); }
        catch(e){ return (urlStr||'').split('?')[0].slice(0,80); }
    }
    function _extractResponseText(data) {
        // AI-эндпоинты возвращают ответ в разных полях — /api/chat → response,
        // /api/ai/generate → generated/answer, /api/deep-analysis → analysis/text
        // и т.п. Берём первое непустое строковое значение.
        if (!data || typeof data !== 'object') return '';
        var keys = ['response','text','message','generated','answer','result',
                    'analysis','content','reply','output','content_text'];
        for (var i = 0; i < keys.length; i++) {
            var v = data[keys[i]];
            if (typeof v === 'string' && v.length) return v;
        }
        // fallback: посмотрим в data.data если есть nested object
        if (data.data && typeof data.data === 'object') {
            for (var j = 0; j < keys.length; j++) {
                var vv = data.data[keys[j]];
                if (typeof vv === 'string' && vv.length) return vv;
            }
        }
        return '';
    }
    function _safeParseBody(body){
        if(!body) return null;
        if(typeof body !== 'string') return null;
        try{ return JSON.parse(body); }catch(e){ return null; }
    }

    // ---- AI busy indicator ----
    // Показываем глобальный «Фреди думает…» во время AI-запросов. Текст
    // меняется, если ответа нет 10+ или 20+ секунд — юзер понимает, что
    // система жива и не висит.
    var _aiBusyCount=0, _aiBusyEl=null, _aiBusyT1=null, _aiBusyT2=null;
    function _showAiBusy(){
        _aiBusyCount++;
        if(_aiBusyCount>1) return;
        if(!_aiBusyEl){
            var st=document.createElement('style');
            st.textContent='@keyframes fbspin{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.5);opacity:1}}';
            document.head.appendChild(st);
            _aiBusyEl=document.createElement('div');
            _aiBusyEl.id='fredi-ai-busy';
            _aiBusyEl.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 18px;border-radius:22px;font:13px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;z-index:9999;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:none;transition:opacity 0.2s';
            _aiBusyEl.innerHTML='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#a78bfa;animation:fbspin 1s infinite ease-in-out"></span><span id="fredi-ai-busy-text">Фреди думает…</span>';
            document.body.appendChild(_aiBusyEl);
        }
        var t=document.getElementById('fredi-ai-busy-text');
        if(t) t.textContent='Фреди думает…';
        _aiBusyEl.style.display='flex';
        _aiBusyEl.style.opacity='1';
        if(_aiBusyT1) clearTimeout(_aiBusyT1);
        if(_aiBusyT2) clearTimeout(_aiBusyT2);
        _aiBusyT1=setTimeout(function(){
            var x=document.getElementById('fredi-ai-busy-text');
            if(x) x.textContent='Думает долго — подожди чуть-чуть';
        },10000);
        _aiBusyT2=setTimeout(function(){
            var y=document.getElementById('fredi-ai-busy-text');
            if(y) y.textContent='⚠ Связь медленная, ещё момент';
        },25000);
    }
    function _hideAiBusy(){
        _aiBusyCount=Math.max(0,_aiBusyCount-1);
        if(_aiBusyCount>0) return;
        if(_aiBusyT1){clearTimeout(_aiBusyT1);_aiBusyT1=null;}
        if(_aiBusyT2){clearTimeout(_aiBusyT2);_aiBusyT2=null;}
        if(_aiBusyEl) _aiBusyEl.style.display='none';
    }

    // ---- fetch hook ----
    function _hookFetch(){
        if(window._trackerFetchPatched) return;
        window._trackerFetchPatched=true;
        var _wrapped=window.fetch;
        window.fetch=async function(url,options){
            var urlStr=typeof url==='string'?url:(url && url.url)||'';
            var method=(options && options.method)||'GET';
            var started=Date.now();
            var isAi = AI_RE.test(urlStr);
            // если apiCall уже эмитил message_sent — fetch не дублирует
            var alreadyTracked = !!(options && options._fa_tracked);

            if(isAi && method==='POST' && !alreadyTracked){
                try{
                    var body=_safeParseBody(options && options.body);
                    track('message_sent',{
                        endpoint:_shortEndpoint(urlStr),
                        text_length:(body && ((body.message||body.text||body.query||'')+'')).length||0,
                        mode:body && (body.mode||body.context_mode||''),
                        via:'fetch'
                    });
                }catch(e){}
                _showAiBusy();
            }

            try{
                var response=await _wrapped(url,options);
                var latency=Date.now()-started;

                if(isAi && response.ok && !alreadyTracked){
                    try{
                        var cloned=response.clone();
                        var data=await cloned.json();
                        var respText=_extractResponseText(data);
                        track('ai_response_received',{
                            endpoint:_shortEndpoint(urlStr),
                            text_length:respText.length,
                            latency_ms:latency,
                            success:!!(data && data.success !== false),
                            via:'fetch'
                        });
                    }catch(e){}
                }

                if(urlStr.indexOf('/api/')>=0 && response.status >= 400 && response.status !== 402){
                    track('api_error',{endpoint:_shortEndpoint(urlStr),status:response.status,method:method});
                }
                return response;
            }catch(netErr){
                if(urlStr.indexOf('/api/')>=0){
                    track('api_network_error',{endpoint:_shortEndpoint(urlStr),method:method,error:((netErr && netErr.message)||'').slice(0,100)});
                }
                throw netErr;
            }finally{
                if(isAi && method==='POST' && !alreadyTracked) _hideAiBusy();
            }
        };
    }

    // ---- apiCall hook (app.js grow its own httpClient) ----
    // app.js грузится ПОСЛЕ tracker → ждём появления window.apiCall и патчим.
    function _hookApiCall(){
        if(window._trackerApiCallPatched) return true;
        if(typeof window.apiCall !== 'function') return false;
        window._trackerApiCallPatched=true;
        var _origApiCall=window.apiCall;
        window.apiCall=async function(endpoint, options){
            options = options || {};
            var urlStr=endpoint||'';
            var method=(options && options.method)||'GET';
            var started=Date.now();
            var isAi = AI_RE.test(urlStr);
            // маркер для fetch-хука, чтобы не дублировал
            if(isAi && typeof options==='object'){ options._fa_tracked = 1; }

            if(isAi && method==='POST'){
                try{
                    var body=_safeParseBody(options.body);
                    track('message_sent',{
                        endpoint:_shortEndpoint(urlStr),
                        text_length:(body && ((body.message||body.text||body.query||'')+'')).length||0,
                        mode:body && (body.mode||body.context_mode||''),
                        via:'apiCall'
                    });
                }catch(e){}
                _showAiBusy();
            }
            try{
                var data=await _origApiCall(endpoint, options);
                var latency=Date.now()-started;
                if(isAi){
                    var respText=_extractResponseText(data);
                    track('ai_response_received',{
                        endpoint:_shortEndpoint(urlStr),
                        text_length:respText.length,
                        latency_ms:latency,
                        success:!!(data && data.success !== false),
                        via:'apiCall'
                    });
                }
                return data;
            }catch(err){
                if(isAi){
                    track('ai_response_error',{
                        endpoint:_shortEndpoint(urlStr),
                        error:((err && err.message)||'').slice(0,100),
                        latency_ms:Date.now()-started
                    });
                }
                throw err;
            }finally{
                if(isAi && method==='POST') _hideAiBusy();
            }
        };
        console.log('tracker: apiCall patched');
        return true;
    }

    // JS runtime errors
    window.addEventListener('error',function(e){
        track('error',{message:(e.message||'').slice(0,200),filename:(e.filename||'').split('/').pop(),line:e.lineno,col:e.colno});
    });
    window.addEventListener('unhandledrejection',function(e){
        var msg='';
        try{ msg = (e.reason && (e.reason.message || String(e.reason))) || ''; }catch(x){}
        track('promise_unhandled',{message:msg.slice(0,200)});
    });

    // session_start
    track('session_start',{referrer:document.referrer||'',screen_w:screen.width,screen_h:screen.height,theme:document.documentElement.getAttribute('data-theme')||'dark',ua:navigator.userAgent.substr(0,100)});

    // session_end с active-time (а не wall time). Cap 2 часа — sanity.
    // На iOS + Safari beforeunload не всегда срабатывает, поэтому дублируем
    // отправку через pagehide и visibilitychange='hidden' (idempotent — флаг).
    var _sessionEnded=false;
    function _emitSessionEnd(){
        if(_sessionEnded) return;
        _sessionEnded=true;
        _closeCurrentFeature('unload');
        _tickActive();
        var wallSec=Math.round((Date.now()-START)/1000);
        var activeSec=Math.min(Math.round(_activeMs/1000), 7200);
        track('session_end',{duration_sec:activeSec, wall_sec:wallSec, last_screen:_screen});
        _flush();
    }
    window.addEventListener('beforeunload', _emitSessionEnd);
    window.addEventListener('pagehide',     _emitSessionEnd);

    // visibility
    document.addEventListener('visibilitychange',function(){
        if(document.hidden){
            _tickActive();
            _isVisible=false;
            track('tab_hidden',{active_sec_so_far:Math.round(_activeMs/1000)});
            // На мобильных скрытие вкладки часто предшествует закрытию без
            // pagehide — страхуемся, но не помечаем сессию завершённой,
            // чтобы при возврате юзера продолжать учитывать активное время.
            _flush();
        }else{
            _isVisible=true;
            _lastActiveAt=Date.now();
            _sessionEnded=false;   // вернулся — сессия снова активна
            track('tab_visible',{active_sec_so_far:Math.round(_activeMs/1000)});
        }
    });

    // theme switch
    var _origThemeSet=window.FrediTheme?.set;
    if(_origThemeSet){
        window.FrediTheme.set=function(theme){
            track('theme_switch',{theme:theme});
            return _origThemeSet(theme);
        };
    }

    // Init hooks
    _hookFetch();
    if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',_hookNav);
    }else{
        _hookNav();
    }
    // apiCall появляется после загрузки app.js — пробуем в несколько заходов
    if(!_hookApiCall()){
        setTimeout(_hookApiCall, 500);
        setTimeout(_hookApiCall, 2000);
        setTimeout(_hookApiCall, 5000);
    }

    setTimeout(_refreshPremium, 1500);
    setInterval(_refreshPremium, 300000);

    // Public API
    window.FrediTracker={
        track:track,
        openFeature:_openFeature,
        closeFeature:_closeCurrentFeature,
        activeSec:function(){ _tickActive(); return Math.round(_activeMs/1000); }
    };
    console.log('tracker.js v3 loaded');
})();
