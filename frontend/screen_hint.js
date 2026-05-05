/* screen_hint.js
 *
 * Deep-link для кнопки «Открыть Фреди» под сообщениями 21-дневной программы.
 *
 * Бэк (services/skill_notify.py:_build_app_url) шлёт URL вида
 *   https://meysternlp.ru/fredi/?fid=<id>&t=<token>&screen=<name>
 * где screen ∈ { training, progress, skill_choice }.
 *
 * Этот файл:
 *   1. На раннем этапе (run-now, до того как inline-script в index.html
 *      успеет почистить URL через replaceState) считывает ?screen=
 *      и сохраняет в window.SCREEN_HINT.
 *   2. На событии 'load' — после инициализации app.js и renderDashboard —
 *      вызывает соответствующий showXScreen(), если хинт валидный.
 *
 * Работает параллельно с inline-логикой авто-логина в index.html
 * (которая чистит fid+t из URL). Хинт читается до этой чистки или
 * из URL уже после — не важно.
 *
 * Подключать ЛЮБЫМ местом до renderDashboard, лучше всего сразу после
 * tracker.js, до большой пачки модулей.
 */

(function () {
    if (typeof window === 'undefined') return;

    // 1. Захватываем screen-хинт как можно раньше.
    try {
        var params = new URLSearchParams(window.location.search);
        var screen = (params.get('screen') || '').trim().toLowerCase();
        var WHITELIST = { training: 1, progress: 1, skill_choice: 1 };
        if (screen && WHITELIST[screen]) {
            window.SCREEN_HINT = screen;
        }
    } catch (e) { /* старые браузеры — пропускаем */ }

    // 2. После полной инициализации страницы — открываем нужный экран.
    function _shTrigger() {
        var hint = window.SCREEN_HINT;
        if (!hint) return;
        // Сбрасываем сразу, чтобы при последующих renderDashboard не
        // прыгало в ту же вкладку каждый раз.
        window.SCREEN_HINT = null;

        var openers = {
            training: function () {
                if (typeof window.showDailyTrainingScreen === 'function') {
                    window.showDailyTrainingScreen();
                } else {
                    var s = document.createElement('script');
                    s.src = 'daily_training.js';
                    s.onload = function () {
                        if (typeof window.showDailyTrainingScreen === 'function') {
                            window.showDailyTrainingScreen();
                        }
                    };
                    document.head.appendChild(s);
                }
            },
            progress: function () {
                if (typeof window.showProgressScreen === 'function') {
                    window.showProgressScreen();
                } else {
                    var s = document.createElement('script');
                    s.src = 'progress_tracker.js';
                    s.onload = function () {
                        if (typeof window.showProgressScreen === 'function') {
                            window.showProgressScreen();
                        }
                    };
                    document.head.appendChild(s);
                }
            },
            skill_choice: function () {
                if (typeof window.showSkillChoiceScreen === 'function') {
                    window.showSkillChoiceScreen();
                } else {
                    var s = document.createElement('script');
                    s.src = 'skill_choice.js';
                    s.onload = function () {
                        if (typeof window.showSkillChoiceScreen === 'function') {
                            window.showSkillChoiceScreen();
                        }
                    };
                    document.head.appendChild(s);
                }
            }
        };

        var fn = openers[hint];
        if (typeof fn === 'function') fn();
    }

    // Триггер должен случиться ПОСЛЕ того, как app.js отрендерил
    // дашборд первый раз. На load-событии app.js обычно уже отработал.
    // Дополнительно даём микро-таймаут на случай, если renderDashboard
    // регистрируется позже в стеке.
    if (document.readyState === 'complete') {
        setTimeout(_shTrigger, 250);
    } else {
        window.addEventListener('load', function () {
            setTimeout(_shTrigger, 250);
        });
    }
})();
