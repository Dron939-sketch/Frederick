// doubles-patch.js — Fix for find-doubles API response mapping
// Backend returns {doubles:[], nearby:[]} but frontend expects {results:[]}
// Loaded AFTER doubles.js
(function() {
    function patch() {
        if (typeof _doSearch !== 'function' || typeof doublesState === 'undefined') return false;

        _doSearch = async function(container) {
            _renderSearching(container);
            var steps = [
                'Анализирую ваш профиль...',
                'Рассчитываю параметры поиска...',
                'Ищу совпадения в базе...',
                'Сортирую по совместимости...',
                'Генерирую инсайты...'
            ];
            var step = 0;
            var tick = setInterval(function() {
                var el = document.getElementById('dbStatusText');
                if (el && step < steps.length) el.textContent = steps[step++];
            }, 700);

            try {
                await new Promise(function(r) { setTimeout(r, 2500); });
                var api = _api(), uid = _userId();
                var url = api + '/api/psychometric/find-doubles?user_id=' + uid + '&mode=' + doublesState.searchMode;
                if (doublesState.searchGoal) url += '&goal=' + doublesState.searchGoal;
                if (doublesState.filters.distance !== 'any') url += '&distance=' + doublesState.filters.distance;
                if (doublesState.filters.gender !== 'any') url += '&gender=' + doublesState.filters.gender;

                var r = await fetch(url);
                var data = await r.json();
                clearInterval(tick);

                // FIX: backend returns doubles+nearby, not results
                var all = [].concat(data.results || [], data.doubles || [], data.nearby || []);
                doublesState.foundDoubles = data.success ? all : [];

                // Save vectors from response for display
                if (data.your_profile && data.your_profile.vectors) {
                    userDoublesProfile.vectors = data.your_profile.vectors;
                }
            } catch (e) {
                clearInterval(tick);
                console.error('Search failed:', e);
                doublesState.foundDoubles = [];
                _showToast('\u274c \u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u0438\u0441\u043a\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.', 'error');
            }
            _renderResults(container);
        };
        window._doSearch = _doSearch;
        console.log('doubles-patch: _doSearch fixed (doubles+nearby merged)');
        return true;
    }
    if (!patch()) { setTimeout(patch, 500); setTimeout(patch, 1500); }
})();
