// ============================================
// theme.js — Переключение тёмной/светлой темы
// ============================================

(function () {
    if (window._themeLoaded) return;
    window._themeLoaded = true;

    var THEME_KEY = 'fredi_theme';

    function setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.removeAttribute('data-theme');
        }
        localStorage.setItem(THEME_KEY, theme);
        updateIcon(theme);

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'light' ? '#f5f5f7' : '#0a0a0a');
        }
    }

    function getCurrentTheme() {
        return document.body.hasAttribute('data-theme') ? 'light' : 'dark';
    }

    function toggleTheme() {
        var newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    function updateIcon(theme) {
        var icons = document.querySelectorAll('.theme-icon');
        icons.forEach(function (icon) {
            icon.textContent = theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
        });
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

    function bindToggle() {
        var btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleTheme();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
    } else {
        bindToggle();
    }

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
