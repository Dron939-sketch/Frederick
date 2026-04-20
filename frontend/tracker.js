// tracker.js — Fredi analytics (lightweight, fire-and-forget)
//
// Trackable events:
//   session_start / session_end
//   screen_view
//   feature_opened / feature_closed   — с duration_sec, чтобы видеть, сколько
//                                        реально юзер сидит в каждой фиче
//   message_sent                      — POST /api/chat, /api/voice/process, ...
//   ai_response_received              — длина ответа, latency_ms
//   api_error / api_network_error     — что ломается у юзера
//   theme_switch
//   error                             — window.error (runtime JS)
//
// Публичный API:
//   window.FrediTracker.track(event, data)  — вручную из других модулей
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

    // Текущая «открытая» фича для feature_opened/closed.
    var _currentFeature=null;
    var _featureOpenedAt=0;

    // ---- user attrs (для сегментации всех событий) ----
    var _isPremium=null; // null = неизвестно; обновляется фоновым fetch

    function _detectDevice(){
        var ua=(navigator.userAgent||'').toLowerCase();
        if(/ipad|tablet/.test(ua) || (window.innerWidth>=768 && window.innerWidth<=1024 && 'ontouchstart' in window)) return 'tablet';
        if(/mobile|iphone|android|phone/.test(ua) || (window.innerWidth<768 && 'ontouchstart' in window)) return 'mobile';
        return 'desktop';
    }
    function _isPwa(){
        try{
            return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                || (window.navigator && window.navigator.standalone === true);
        }catch(e){ return false; }
    }
    function _connType(){
        try{ return (navigator.connection && navigator.connection.effectiveType) || ''; }catch(e){ return ''; }
    }
    function _getAttrs(){
        var a={
            is_authed: !!window.IS_AUTHENTICATED,
            device: _detectDevice(),
            pwa: _isPwa(),
            lang: (navigator.language||'').slice(0,20),
            connection: _connType(),
            theme: (document.documentElement.getAttribute('data-theme')||'dark'),
        };
        if(_isPremium !== null) a.is_premium = !!_isPremium;
        return a;
    }

    // Фоновая проверка is_premium, чтобы сегментировать фри/премиум юзеров.
    async function _refreshPremium(){
        var uid=UID();
        if(!uid) return;
        try{
            var r=await fetch(API()+'/api/meter/status/'+uid, {credentials:'include'});
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

    function _flush(){
        if(_sending||!_queue.length) return;
        _sending=true;
        var batch=_queue.splice(0,10);
        try{
            var blob=new Blob([JSON.stringify({events:batch})],{type:'application/json'});
            navigator.sendBeacon(API()+'/api/analytics/events',blob);
        }catch(e){
            try{
                fetch(API()+'/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true});
            }catch(e2){}
        }
        _sending=false;
        if(_queue.length) setTimeout(_flush,1000);
    }

    // ---- feature lifecycle ----
    function _openFeature(name){
        if(!name) return;
        // Если уже открыта — закрываем, трекаем duration.
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

    // ---- fetch hook: message_sent + ai_response_received + api errors ----
    // Список AI-эндпоинтов, которые считаем "message_sent".
    var AI_RE=/\/api\/(?:chat|voice\/process|ai\/generate|deep-analysis|hypno\/support|psychologist-thoughts\/generate|dreams\/(?:interpret|clarify)|reality\/(?:check|parse\/[^/]+)|brand\/transformation|mirrors\/(?:complete|[^/]+\/complete)|morning\/send-now)(?:\/|$|\?)/;

    function _shortEndpoint(urlStr){
        try{
            var u=new URL(urlStr,window.location.origin);
            return u.pathname.slice(0,80);
        }catch(e){
            return (urlStr||'').split('?')[0].slice(0,80);
        }
    }

    function _safeParseBody(body){
        if(!body) return null;
        if(typeof body !== 'string') return null; // не паримся с FormData/Blob
        try{ return JSON.parse(body); }catch(e){ return null; }
    }

    function _hookFetch(){
        if(window._trackerFetchPatched) return;
        window._trackerFetchPatched=true;
        var _origFetch=window.fetch;
        window.fetch=async function(url,options){
            var urlStr=typeof url==='string'?url:(url && url.url)||'';
            var method=(options && options.method)||'GET';
            var started=Date.now();
            var isAi = AI_RE.test(urlStr);

            if(isAi && method==='POST'){
                try{
                    var body=_safeParseBody(options && options.body);
                    track('message_sent',{
                        endpoint:_shortEndpoint(urlStr),
                        text_length:(body && ((body.message||body.text||body.query||'')+'')).length||0,
                        mode:body && (body.mode||body.context_mode||'')
                    });
                }catch(e){}
            }

            try{
                var response=await _origFetch.call(window,url,options);
                var latency=Date.now()-started;

                if(isAi && response.ok){
                    try{
                        var cloned=response.clone();
                        var data=await cloned.json();
                        var respText = (data && (data.response||data.text||data.message||''))+'';
                        track('ai_response_received',{
                            endpoint:_shortEndpoint(urlStr),
                            text_length:respText.length,
                            latency_ms:latency,
                            success:!!(data && data.success !== false)
                        });
                    }catch(e){}
                }

                // Error-signals only for our own API calls, не шумим про внешние ресурсы.
                if(urlStr.indexOf('/api/')>=0 && response.status >= 400 && response.status !== 402){
                    // 402 уже трекается через meter_blocked — не дублируем.
                    track('api_error',{
                        endpoint:_shortEndpoint(urlStr),
                        status:response.status,
                        method:method
                    });
                }

                return response;
            }catch(netErr){
                if(urlStr.indexOf('/api/')>=0){
                    track('api_network_error',{
                        endpoint:_shortEndpoint(urlStr),
                        method:method,
                        error:((netErr && netErr.message)||'').slice(0,100)
                    });
                }
                throw netErr;
            }
        };
    }

    // Auto-track: JS runtime errors
    window.addEventListener('error',function(e){
        track('error',{message:(e.message||'').slice(0,200),filename:(e.filename||'').split('/').pop(),line:e.lineno,col:e.colno});
    });

    window.addEventListener('unhandledrejection',function(e){
        var msg='';
        try{ msg = (e.reason && (e.reason.message || String(e.reason))) || ''; }catch(x){}
        track('promise_unhandled',{message:msg.slice(0,200)});
    });

    // Auto-track: session start
    track('session_start',{referrer:document.referrer||'',screen_w:screen.width,screen_h:screen.height,theme:document.documentElement.getAttribute('data-theme')||'dark',ua:navigator.userAgent.substr(0,100)});

    // Auto-track: session duration (on unload)
    window.addEventListener('beforeunload',function(){
        _closeCurrentFeature('unload');
        var dur=Math.round((Date.now()-START)/1000);
        track('session_end',{duration_sec:dur,last_screen:_screen});
        _flush();
    });

    // Auto-track: visibility (чтобы отличать "вернулся" от "новый визит")
    var _hiddenAt=0;
    document.addEventListener('visibilitychange',function(){
        if(document.hidden){
            _hiddenAt=Date.now();
            track('tab_hidden',{});
        }else if(_hiddenAt){
            var awaySec=Math.round((Date.now()-_hiddenAt)/1000);
            track('tab_visible',{away_sec:awaySec});
            _hiddenAt=0;
        }
    });

    // Auto-track: theme switch
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

    // Подхватываем is_premium с небольшой задержкой, чтобы USER_ID успел проставиться.
    setTimeout(_refreshPremium, 1500);
    // И обновляем его раз в 5 минут, на случай оплаты во время сессии.
    setInterval(_refreshPremium, 300000);

    // Public API
    window.FrediTracker={
        track:track,
        openFeature:_openFeature,
        closeFeature:_closeCurrentFeature
    };
    console.log('tracker.js v2 loaded');
})();
