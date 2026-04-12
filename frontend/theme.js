// ============================================
// theme.js — Переключение тёмной/светлой темы
// ============================================

(function () {
    if (window._themeLoaded) return;
    window._themeLoaded = true;

    var THEME_KEY = 'fredi_theme';

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) document.body.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'light' ? '#f5f5f7' : '#0a0a0a');
        }
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function toggleTheme() {
        setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    }

    function initTheme() {
        var saved = localStorage.getItem(THEME_KEY);
        if (saved) {
            setTheme(saved);
        } else {
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
        }
    }

    initTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem(THEME_KEY)) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    window.FrediTheme = {
        set: setTheme,
        get: getCurrentTheme,
        toggle: toggleTheme
    };

    console.log('theme.js loaded');
})();
