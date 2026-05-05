/* skill_choice_patch.js
 *
 * Подключается СРАЗУ ПОСЛЕ skill_choice.js. Переопределяет три функции
 * через глобальные имена, чтобы:
 *
 *  1. Модал "уже идёт активный навык" объяснял ПОЧЕМУ нельзя брать
 *     несколько навыков параллельно (а не просто "будет сброшен прогресс").
 *  2. _scApiPush принимал {force:true} и читал ответ бэка — если бэк
 *     отверг сохранение из-за active_skill_exists (race-condition или
 *     рассинхрон localStorage с БД), мы знаем об этом и ничего не падаем.
 *  3. _scSave прокидывал force=true в _scApiPush, когда юзер только что
 *     явно подтвердил замену активного плана через модал (флаг
 *     _sc.replaceActive). Без force бэк (PR #290) отверг бы POST, потому
 *     что в DB ещё может висеть старая строка (DELETE — fire-and-forget).
 *
 * Файл-патч, а не правка skill_choice.js — потому что skill_choice.js
 * 134 KB и переписывать целиком ради 3 функций невыгодно. Когда удобно —
 * можно слить патч в основной файл и удалить этот.
 */

(function () {
    if (typeof window === 'undefined') return;

    function getState() {
        return window._scState || {};
    }

    window._scShowReplaceActiveModal = function _scShowReplaceActiveModalPatched(onReplace) {
        const state = getState();
        const name = state.activePlanSkillName || 'другой навык';
        const done = state.activePlanDaysDone || 0;
        const newName = state.skillName || 'новый навык';

        if (typeof window._scModal !== 'function') {
            if (confirm('У вас уже идёт активный навык «' + name + '». Сбросить прогресс и начать новый?')) {
                onReplace();
            }
            return;
        }

        window._scModal(`
            <div style="font-size:28px;text-align:center;margin-bottom:8px">⚠️</div>
            <div style="font-size:15px;color:var(--text-primary);margin-bottom:8px;font-weight:600;text-align:center">У вас уже идёт активный навык</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;line-height:1.55">
                «${name}» — прогресс ${done}/21 дней.
            </div>
            <div style="font-size:12px;color:var(--text-primary);margin-bottom:14px;line-height:1.55;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.25);border-radius:14px;padding:11px 13px">
                <div style="font-weight:600;margin-bottom:4px">🧠 Почему один навык за раз</div>
                Параллельно нагружая 2–3 навыка, мозг распыляет внимание: ни один не доходит до автоматизма за 21 день. Через месяц у вас 0 закреплённых навыков вместо 1. Лучше довести текущий до конца, а потом взять следующий.
            </div>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5">
                Если всё-таки начнёте «${newName}», прогресс по «${name}» будет сброшен.
            </div>
            <div style="display:flex;gap:10px;flex-direction:column">
                <button id="rpKeep"    style="padding:12px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Открыть текущий навык</button>
                <button id="rpReplace" style="padding:12px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Всё равно сбросить и начать новый</button>
                <button id="rpCancel"  style="padding:9px;border-radius:30px;background:transparent;border:none;color:var(--text-secondary);font-family:inherit;font-size:12px;cursor:pointer">Отмена</button>
            </div>
        `, function (overlay, close) {
            overlay.querySelector('#rpReplace').onclick = async function () {
                close();
                try {
                    if (typeof window._scApiDelete === 'function') {
                        await window._scApiDelete();
                    }
                } catch (e) { /* ignore */ }
                try {
                    const uid = (typeof window._scUid === 'function') ? window._scUid() : null;
                    if (uid) localStorage.removeItem('sc_plan_' + uid);
                } catch (e) { /* ignore */ }
                const s = getState();
                s.daysDone = [];
                s.plan = null;
                s.startDate = null;
                s.replaceActive = true;
                onReplace();
            };
            overlay.querySelector('#rpKeep').onclick = function () {
                close();
                const s = getState();
                const find = window._scFindSkill;
                if (typeof find === 'function') {
                    const sk = find(s.activePlanSkillId);
                    if (sk) {
                        s.skillId = sk.id; s.skillName = sk.name;
                        s.skillDesc = sk.desc; s.skillLongDesc = sk.longDesc;
                        s.skillPromise = sk.promise;
                    }
                }
                s.view = 'plan';
                if (typeof window._scRender === 'function') window._scRender();
            };
            overlay.querySelector('#rpCancel').onclick = close;
        });
    };

    window._scApiPush = async function _scApiPushPatched(opts) {
        opts = opts || {};
        const state = getState();
        const uid = (typeof window._scUid === 'function') ? window._scUid() : null;
        if (!uid || !state.skillId || !state.plan) return null;
        const apiBase = (typeof window._scApi === 'function') ? window._scApi() : '';
        const tz = (typeof window._scTz === 'function') ? window._scTz() : 'UTC';
        try {
            const r = await fetch(apiBase + '/api/skill-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id:         uid,
                    skill_id:        state.skillId,
                    skill_name:      state.skillName,
                    skill_desc:      state.skillDesc,
                    skill_long_desc: state.skillLongDesc,
                    skill_promise:   state.skillPromise,
                    plan:            state.plan,
                    started_at:      state.startDate,
                    channel:         state.channel,
                    notify_time:     state.notifyTime,
                    mode:            state.mode,
                    tz:              tz,
                    force:           !!opts.force
                })
            });
            try {
                const data = await r.json();
                if (data && data.success === false && data.error === 'active_skill_exists') {
                    return data;
                }
            } catch (e) { /* json parse fail — ok */ }
        } catch (e) { /* offline — ok, есть localStorage */ }
        return null;
    };

    // _scSave — переписываем целиком: localStorage-часть + force-aware POST.
    // Не зовём оригинал, чтобы не делать двойной POST.
    window._scSave = function _scSavePatched() {
        const state = getState();
        const force = !!state.replaceActive;
        state.replaceActive = false;

        try {
            const uid = (typeof window._scUid === 'function') ? window._scUid() : null;
            if (uid) {
                const data = {
                    skillId: state.skillId, skillName: state.skillName, skillDesc: state.skillDesc,
                    skillLongDesc: state.skillLongDesc, skillPromise: state.skillPromise,
                    plan: state.plan, daysDone: state.daysDone, startDate: state.startDate,
                    channel: state.channel, notifyTime: state.notifyTime, mode: state.mode
                };
                localStorage.setItem('sc_plan_' + uid, JSON.stringify(data));
                localStorage.setItem('trainer_skill_' + uid, JSON.stringify({
                    skillId: state.skillId, skillName: state.skillName,
                    plan: state.plan, daysDone: state.daysDone, startDate: state.startDate,
                    channel: state.channel, notifyTime: state.notifyTime, mode: state.mode
                }));
            }
        } catch (e) { /* ignore */ }

        return window._scApiPush({ force: force });
    };
})();
