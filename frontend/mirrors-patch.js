// mirrors-patch.js — Fix for JSONB double-serialization in mirrors
// Loaded AFTER mirrors.js
(function() {
    function fixRef(ref) {
        if (!ref) return ref;
        ['friend_vectors', 'friend_deep_patterns'].forEach(function(key) {
            if (typeof ref[key] === 'string') {
                try { ref[key] = JSON.parse(ref[key]); } catch(e) { ref[key] = {}; }
            }
            if (!ref[key]) ref[key] = {};
        });
        var v = ref.friend_vectors;
        if (v && typeof v === 'object') {
            Object.keys(v).forEach(function(k) { v[k] = Number(v[k]) || 0; });
        }
        return ref;
    }

    // Override apiGetReflections to fix data before card rendering
    var origApi = window.apiGetReflections;
    if (typeof origApi === 'function') {
        window.apiGetReflections = async function(userId) {
            var data = await origApi(userId);
            if (data && data.reflections) {
                data.reflections.forEach(fixRef);
            }
            return data;
        };
        console.log('mirrors-patch: apiGetReflections patched');
    }

    // Override showFriendProfile to fix data in detail view
    var origShow = window.showFriendProfile;
    if (typeof origShow === 'function') {
        window.showFriendProfile = async function(ref) {
            return origShow(fixRef(ref));
        };
        console.log('mirrors-patch: showFriendProfile patched');
    }

    console.log('mirrors-patch: JSONB parsing fix loaded');
})();
