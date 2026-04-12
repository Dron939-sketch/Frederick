// tracker.js — Fredi analytics (lightweight, fire-and-forget)
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

    function track(event,data){
        var payload={user_id:UID(),session_id:SID,event:event,data:data||{},screen:_screen,ts:new Date().toISOString()};
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
        }
        if(list) list.addEventListener('click',onClick);
        if(footer) footer.addEventListener('click',onClick);
    }

    // Auto-track: JS errors
    window.addEventListener('error',function(e){
        track('error',{message:e.message||'',filename:(e.filename||'').split('/').pop(),line:e.lineno,col:e.colno});
    });

    // Auto-track: session start
    track('session_start',{referrer:document.referrer||'',screen_w:screen.width,screen_h:screen.height,theme:document.documentElement.getAttribute('data-theme')||'dark',ua:navigator.userAgent.substr(0,100)});

    // Auto-track: session duration (on unload)
    window.addEventListener('beforeunload',function(){
        var dur=Math.round((Date.now()-START)/1000);
        track('session_end',{duration_sec:dur,screens_visited:_screen});
        _flush();
    });

    // Auto-track: theme switch
    var _origThemeSet=window.FrediTheme?.set;
    if(_origThemeSet){
        window.FrediTheme.set=function(theme){
            track('theme_switch',{theme:theme});
            return _origThemeSet(theme);
        };
    }

    // Init nav hooks when DOM ready
    if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',_hookNav);
    }else{
        _hookNav();
    }

    // Public API
    window.FrediTracker={track:track};
    console.log('tracker.js loaded');
})();
