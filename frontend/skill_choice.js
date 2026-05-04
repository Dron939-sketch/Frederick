// ============================================
// skill_choice.js — Выбор навыка + план
// Версия 5.8 — поле "why" в каждом упражнении + день 1 мягче
// ============================================

function _scInjectStyles() {
    if (document.getElementById('sc-v2-styles')) return;
    const s = document.createElement('style');
    s.id = 'sc-v2-styles';
    s.textContent = `
        .sc-skill-card { background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 16px; padding: 14px; margin-bottom: 8px; cursor: pointer; transition: background 0.18s, border-color 0.18s, transform 0.12s; display: flex; align-items: center; gap: 12px; touch-action: manipulation; }
        .sc-skill-card:hover  { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.22); }
        .sc-skill-card:active { transform: scale(0.98); }
        .sc-skill-icon { font-size: 24px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(224,224,224,0.06); flex-shrink: 0; }
        .sc-skill-body  { flex: 1; min-width: 0; }
        .sc-skill-name  { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .sc-skill-new   { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; background: rgba(255,107,53,0.15); color: #FF8B5C; padding: 2px 6px; border-radius: 6px; text-transform: uppercase; }
        .sc-skill-sub   { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
        .sc-skill-hint  { font-size: 10px; color: var(--chrome); margin-top: 4px; opacity: 0; transition: opacity 0.2s; }
        .sc-skill-card:hover .sc-skill-hint { opacity: 1; }
        .sc-skill-arrow { font-size: 16px; color: var(--text-secondary); flex-shrink: 0; opacity: 0.5; }
        .sc-skill-card:hover .sc-skill-arrow { opacity: 1; color: var(--chrome); }

        /* === СТЕП-ИНДИКАТОР === */
        .sc-steps { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 10px 12px; background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 12px; }
        .sc-step { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
        .sc-step-num { width: 20px; height: 20px; border-radius: 50%; background: rgba(224,224,224,0.1); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
        .sc-step.done  .sc-step-num { background: rgba(94,224,168,0.2); color: #5EE0A8; }
        .sc-step.current .sc-step-num { background: var(--chrome); color: #000; }
        .sc-step.current { color: var(--text-primary); font-weight: 600; }
        .sc-step-arrow { color: var(--text-secondary); opacity: 0.4; font-size: 10px; }
        @media (max-width: 480px) {
            .sc-step-text { display: none; }
            .sc-step.current .sc-step-text { display: inline; }
        }

        /* === ПЛАШКА «ВЫБРАНО» === */
        .sc-chosen { background: linear-gradient(135deg, rgba(94,224,168,0.12), rgba(94,224,168,0.02)); border: 1px solid rgba(94,224,168,0.35); border-radius: 16px; padding: 14px 16px; margin-bottom: 16px; }
        .sc-chosen-mark { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #5EE0A8; margin-bottom: 4px; }
        .sc-chosen-name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .sc-chosen-text { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
        .sc-skill-score { font-size: 11px; font-weight: 700; color: var(--text-secondary); flex-shrink: 0; background: rgba(224,224,224,0.08); border: 1px solid rgba(224,224,224,0.14); border-radius: 20px; padding: 3px 9px; }
        .sc-skill-bar-wrap { height: 3px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .sc-skill-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); }

        .sc-input { width: 100%; background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18); border-radius: 14px; padding: 12px 14px; color: var(--text-primary); font-family: inherit; font-size: 14px; outline: none; box-sizing: border-box; -webkit-appearance: none; }
        .sc-input:focus { border-color: rgba(224,224,224,0.35); }
        .sc-input::placeholder { color: var(--text-secondary); }

        .sc-btn { padding: 11px 20px; border-radius: 30px; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 0.2s, transform 0.15s; min-height: 42px; touch-action: manipulation; outline: none; }
        .sc-btn:active { transform: scale(0.97); }
        .sc-btn-primary { background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(192,192,192,0.1)); border: 1px solid rgba(224,224,224,0.3); color: var(--text-primary); width: 100%; border-radius: 40px; padding: 13px; }
        .sc-btn-primary:hover { background: linear-gradient(135deg, rgba(224,224,224,0.28), rgba(192,192,192,0.16)); }
        .sc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .sc-btn-ghost { background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.14); color: var(--text-secondary); }
        .sc-btn-ghost:hover { background: rgba(224,224,224,0.1); color: var(--text-primary); }
        .sc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .sc-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px; margin-top: 18px; }
        .sc-custom-block { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1); border-radius: 16px; padding: 14px; margin-top: 8px; }
        .sc-custom-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

        /* ===== ЭКРАН НАВЫКА (DETAIL) ===== */
        .sc-detail-hero { background: linear-gradient(135deg, rgba(224,224,224,0.10), rgba(192,192,192,0.03)); border: 1px solid rgba(224,224,224,0.22); border-radius: 20px; padding: 20px; margin-bottom: 14px; }
        .sc-detail-cat { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--chrome); margin-bottom: 8px; }
        .sc-detail-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; line-height: 1.25; }
        .sc-detail-promise-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px; }
        .sc-detail-promise { font-size: 13px; line-height: 1.55; color: var(--text-primary); }

        .sc-detail-section { background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .sc-detail-h { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px; }
        .sc-detail-p { font-size: 13px; color: var(--text-primary); line-height: 1.6; margin: 0; }

        .sc-phases-list { display: flex; flex-direction: column; gap: 8px; }
        .sc-phase { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 12px; }
        .sc-phase-num { width: 22px; height: 22px; border-radius: 50%; background: rgba(224,224,224,0.15); color: var(--chrome); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .sc-phase-body { min-width: 0; flex: 1; }
        .sc-phase-theme { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .sc-phase-mean { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }

        .sc-example { padding: 10px 12px; background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 12px; margin-bottom: 8px; }
        .sc-example:last-child { margin-bottom: 0; }
        .sc-example-head { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; flex-wrap: wrap; }
        .sc-example-tag { font-size: 9px; font-weight: 700; letter-spacing: 0.4px; background: rgba(224,224,224,0.15); color: var(--chrome); padding: 2px 7px; border-radius: 8px; text-transform: uppercase; flex-shrink: 0; }
        .sc-example-task { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
        .sc-example-dur { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }
        .sc-example-inst { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

        .sc-format-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .sc-format-item { background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.1); border-radius: 12px; padding: 10px; text-align: center; }
        .sc-format-icon { font-size: 18px; margin-bottom: 4px; }
        .sc-format-text { font-size: 10px; color: var(--text-secondary); line-height: 1.3; }
        .sc-format-text strong { color: var(--text-primary); display: block; font-size: 11px; }

        /* ===== ЭКРАН НАСТРОЙКИ (SETUP) ===== */
        .sc-setup-intro { background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02)); border: 1px solid rgba(224,224,224,0.18); border-radius: 18px; padding: 16px 18px; margin-bottom: 18px; }
        .sc-setup-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .sc-setup-text { font-size: 12px; color: var(--text-secondary); line-height: 1.55; }

        .sc-channel-card { background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.12); border-radius: 14px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.18s, border-color 0.18s, transform 0.12s; touch-action: manipulation; }
        .sc-channel-card:hover  { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.24); }
        .sc-channel-card:active { transform: scale(0.985); }
        .sc-channel-card.active { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.45); }
        .sc-channel-icon { font-size: 22px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(224,224,224,0.06); flex-shrink: 0; }
        .sc-channel-body { flex: 1; min-width: 0; }
        .sc-channel-name { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .sc-channel-tag { font-size: 9px; font-weight: 700; letter-spacing: 0.4px; background: rgba(224,224,224,0.18); color: var(--chrome); padding: 2px 7px; border-radius: 8px; text-transform: uppercase; }
        .sc-link-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; margin-left: 6px; }
        .sc-link-badge.linked   { background: rgba(94,224,168,0.18); color: #5EE0A8; }
        .sc-link-badge.unlinked { background: rgba(255,107,53,0.15); color: #FF8B5C; }
        .sc-link-hint { font-size: 11px; color: var(--text-secondary); margin-top: 6px; }
        .sc-link-hint a { color: var(--chrome); cursor: pointer; }
        .sc-test-btn { background: rgba(94,224,168,0.10); border: 1px solid rgba(94,224,168,0.35); color: #5EE0A8; padding: 8px 14px; border-radius: 24px; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; margin-top: 10px; }
        .sc-test-btn:hover { background: rgba(94,224,168,0.16); }
        .sc-test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sc-channel-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.45; }
        .sc-channel-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(224,224,224,0.3); flex-shrink: 0; position: relative; transition: border-color 0.18s; }
        .sc-channel-card.active .sc-channel-radio { border-color: var(--chrome); }
        .sc-channel-card.active .sc-channel-radio::after { content: ''; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; border-radius: 50%; background: var(--chrome); }

        .sc-time-block { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1); border-radius: 14px; padding: 12px; margin-top: 14px; }
        .sc-time-label { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .sc-time-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .sc-time-btn { padding: 9px 8px; background: rgba(224,224,224,0.05); border: 1px solid rgba(224,224,224,0.12); border-radius: 10px; color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; font-family: inherit; }
        .sc-time-btn:hover { background: rgba(224,224,224,0.1); }
        .sc-time-btn.active { background: rgba(224,224,224,0.15); border-color: rgba(224,224,224,0.4); color: var(--text-primary); font-weight: 600; }

        .sc-mode-card { background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.12); border-radius: 14px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; transition: background 0.18s, border-color 0.18s; }
        .sc-mode-card:hover { background: rgba(224,224,224,0.09); border-color: rgba(224,224,224,0.24); }
        .sc-mode-card.active { background: rgba(224,224,224,0.14); border-color: rgba(224,224,224,0.45); }
        .sc-mode-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .sc-mode-name { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
        .sc-mode-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(224,224,224,0.3); flex-shrink: 0; position: relative; transition: border-color 0.18s; }
        .sc-mode-card.active .sc-mode-radio { border-color: var(--chrome); }
        .sc-mode-card.active .sc-mode-radio::after { content: ''; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; border-radius: 50%; background: var(--chrome); }
        .sc-mode-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }

        /* ===== ЭКРАН ПЛАНА ===== */
        .sc-plan-header { background: linear-gradient(135deg, rgba(224,224,224,0.08), rgba(192,192,192,0.02)); border: 1px solid rgba(224,224,224,0.18); border-radius: 18px; padding: 16px 18px; margin-bottom: 18px; }
        .sc-plan-skill { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .sc-plan-promise { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; }
        .sc-plan-meta { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .sc-plan-progress { height: 4px; background: rgba(224,224,224,0.1); border-radius: 2px; margin-top: 10px; overflow: hidden; }
        .sc-plan-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--silver-brushed), var(--chrome)); transition: width 0.4s; }
        .sc-plan-channel-info { font-size: 11px; color: var(--text-secondary); margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .sc-plan-channel-info strong { color: var(--text-primary); font-weight: 600; }
        .sc-plan-channel-info a { color: var(--chrome); text-decoration: none; cursor: pointer; }
        .sc-plan-channel-info a:hover { text-decoration: underline; }

        .sc-today-card { background: rgba(224,224,224,0.06); border: 1px solid rgba(224,224,224,0.18); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .sc-today-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
        .sc-today-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(224,224,224,0.18); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--chrome); flex-shrink: 0; }
        .sc-today-task { font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.4; }
        .sc-today-dur  { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
        .sc-today-inst { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; }

        .sc-tomorrow { display: flex; gap: 10px; align-items: center; background: rgba(224,224,224,0.03); border: 1px dashed rgba(224,224,224,0.15); border-radius: 12px; padding: 10px 14px; margin-bottom: 22px; }
        .sc-tomorrow-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-secondary); }
        .sc-tomorrow-task  { font-size: 12px; color: var(--text-primary); flex: 1; }
        .sc-tomorrow-dur   { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }

        .sc-week { margin-bottom: 14px; }
        .sc-week-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 10px 0; user-select: none; border-bottom: 1px solid rgba(224,224,224,0.08); margin-bottom: 8px; }
        .sc-week-head:hover .sc-week-theme { color: var(--chrome); }
        .sc-week-info { min-width: 0; flex: 1; }
        .sc-week-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 2px; }
        .sc-week-theme { font-size: 13px; font-weight: 600; color: var(--text-primary); transition: color 0.15s; }
        .sc-week-mean { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
        .sc-week-stats { font-size: 11px; font-weight: 700; color: var(--text-secondary); background: rgba(224,224,224,0.08); border-radius: 20px; padding: 3px 10px; flex-shrink: 0; margin-left: 10px; }
        .sc-week-toggle { color: var(--text-secondary); font-size: 14px; margin-left: 8px; transition: transform 0.2s; display: inline-block; }
        .sc-week-head.open .sc-week-toggle { transform: rotate(90deg); }

        .sc-week-list { display: none; flex-direction: column; gap: 4px; }
        .sc-week-list.open { display: flex; }

        .sc-day-row { display: flex; gap: 10px; align-items: center; padding: 10px 12px; background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08); border-radius: 12px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .sc-day-row:hover { background: rgba(224,224,224,0.07); }
        .sc-day-row.done { background: rgba(224,224,224,0.05); border-color: rgba(224,224,224,0.12); }
        .sc-day-row.current { background: rgba(224,224,224,0.1); border-color: rgba(224,224,224,0.3); }

        .sc-day-num-pill { width: 26px; height: 26px; border-radius: 50%; background: rgba(224,224,224,0.1); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .sc-day-row.done .sc-day-num-pill    { background: rgba(224,224,224,0.18); color: var(--chrome); }
        .sc-day-row.current .sc-day-num-pill { background: var(--chrome); color: #000; }

        .sc-day-info { flex: 1; min-width: 0; }
        .sc-day-task { font-size: 13px; font-weight: 500; color: var(--text-primary); line-height: 1.35; }
        .sc-day-row.done .sc-day-task { text-decoration: line-through; opacity: 0.7; }
        .sc-day-dur { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .sc-day-status { flex-shrink: 0; font-size: 14px; color: var(--text-secondary); min-width: 18px; text-align: right; }
        .sc-day-row.done .sc-day-status { color: var(--chrome); }

        .sc-day-detail { font-size: 12px; line-height: 1.55; color: var(--text-secondary); padding: 10px 12px 4px; border-top: 1px dashed rgba(224,224,224,0.12); margin-top: 8px; display: none; }
        .sc-day-row.expanded { flex-wrap: wrap; }
        .sc-day-row.expanded .sc-day-detail { display: block; width: 100%; }
        .sc-day-detail-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }

        .sc-tip { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.08); border-radius: 14px; padding: 12px 14px; font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 14px; }
        .sc-tip strong { color: var(--chrome); }

        @media (max-width: 480px) {
            .sc-skill-name { font-size: 13px; }
            .sc-today-task { font-size: 13px; }
            .sc-day-task { font-size: 12px; }
            .sc-week-theme { font-size: 12px; }
            .sc-detail-title { font-size: 19px; }
            .sc-time-grid { grid-template-columns: repeat(3, 1fr); }
        }
    `;
    document.head.appendChild(s);
}

// ============================================
// ПРЕДОПРЕДЕЛЁННЫЕ НАВЫКИ
// ============================================
const SC_SKILLS = {
    personal: [
        { id:'confidence', icon:'💪', name:'Уверенность в себе', desc:'Действовать без одобрения извне, верить в свои силы',
          longDesc:'Уверенность — это не отсутствие сомнений, а способность действовать вопреки им. Тренируем доверие собственным решениям и опыту, даже когда вокруг неопределённость или давление.',
          promise:'Через 21 день вы будете действовать в важных ситуациях, не дожидаясь одобрения и не оглядываясь на оценку.' },
        { id:'discipline', icon:'🎯', name:'Дисциплина', desc:'Выполнять намеченное независимо от настроения',
          longDesc:'Дисциплина — это не сила воли, а система: правильные триггеры, ритуалы и среда, в которых нужное действие становится естественным. Учимся делать решённое, не торгуясь с собой.',
          promise:'Через 21 день вы будете делать намеченное даже когда не хочется — без внутреннего торга и «соберусь завтра».' },
        { id:'boundaries', icon:'🛡', name:'Личные границы', desc:'Говорить «нет» без чувства вины',
          longDesc:'Личные границы — умение ясно обозначать, что для вас приемлемо, а что нет. Без агрессии и без вины. Граница — это не стена, а ориентир для других.',
          promise:'Через 21 день вы будете отказывать спокойно и без оправданий — и при этом сохранять отношения.' },
        { id:'emotions', icon:'🎭', name:'Эмоциональный интеллект', desc:'Распознавать и управлять своими эмоциями',
          longDesc:'Навык распознавать свои эмоции в момент возникновения и направлять их, а не реагировать автоматически. Базовый уровень саморегуляции.',
          promise:'Через 21 день вы будете замечать эмоцию до того, как она возьмёт верх, и выбирать реакцию, а не «прорываться».' },
        { id:'communication', icon:'💬', name:'Коммуникация', desc:'Ясно и честно выражать мысли и чувства',
          longDesc:'Доносить мысли так, чтобы вас поняли, и слышать так, чтобы собеседник почувствовал себя услышанным. База любых отношений — личных и рабочих.',
          promise:'Через 21 день вы будете говорить о важном напрямую — без намёков, обиняков и страха быть неправильно понятым.' },
        { id:'resilience', icon:'🧗', name:'Стрессоустойчивость', desc:'Восстанавливаться после трудностей',
          longDesc:'Не отсутствие реакции на стресс, а скорость возвращения в баланс. Расширяем «окно толерантности», в котором вы остаётесь функциональны.',
          promise:'Через 21 день вы будете быстрее возвращаться в строй после ударов и не залипать в плохом настроении на дни.' },
        { id:'focus', icon:'🔍', name:'Фокус и концентрация', desc:'Удерживать внимание на важном',
          longDesc:'Удерживать внимание на одной задаче 25–90 минут без отвлечений. Базовый ресурс продуктивности и качественного мышления.',
          promise:'Через 21 день вы будете удерживать внимание на главном по 60–90 минут без скатывания в соцсети и переключения.' },
        { id:'growth', icon:'🌱', name:'Установка на рост', desc:'Воспринимать трудности как возможности',
          longDesc:'Восприятие способностей как развиваемых, а не врождённых. Ошибка → информация, а не приговор. Подход Кэрол Двек, переведённый в ежедневные действия.',
          promise:'Через 21 день вы будете воспринимать неудачи как данные, а не как приговор себе — и быстрее идти дальше.' }
    ],
    professional: [
        { id:'planning', icon:'📋', name:'Планирование', desc:'Ставить цели и разбивать на конкретные шаги',
          longDesc:'Перевод больших целей в конкретные физические действия. Без этого «хочу» остаётся «хочу». Метод следующего действия + декомпозиция.',
          promise:'Через 21 день вы будете превращать любую большую цель в конкретный недельный план и идти по нему.' },
        { id:'decision', icon:'⚡', name:'Принятие решений', desc:'Действовать при неполной информации',
          longDesc:'Действовать при неполной информации, не парализуясь поиском «идеального варианта». Различать важные и неважные решения и не тратить силы поровну.',
          promise:'Через 21 день вы будете решать быстро даже без полной картины — и переставать зависать в раздумьях.' },
        { id:'delegation', icon:'🤝', name:'Делегирование', desc:'Передавать задачи и доверять другим',
          longDesc:'Передача задачи целиком и доверие результату. Не «приказ-исполнение», а партнёрство с правильной обратной связью. Освобождаете время на стратегию.',
          promise:'Через 21 день вы будете отпускать задачи команде без чувства «лучше сам» — и освобождать время на главное.' },
        { id:'leadership', icon:'🚩', name:'Лидерство', desc:'Вести за собой и вдохновлять людей',
          longDesc:'Не должность и не харизма — система поведения, которой можно научиться. Ясность смысла и внутренняя опора — то, за чем идут люди.',
          promise:'Через 21 день вы будете говорить так, что за вами хочется идти — и направлять других без давления.' },
        { id:'timemanage', icon:'⏰', name:'Управление временем', desc:'Расставлять приоритеты и не прокрастинировать',
          longDesc:'Не «успеть всё», а «успеть важное». Принцип Парето + защита фокусного времени. Меньше прокрастинации без насилия над собой.',
          promise:'Через 21 день вы будете успевать важное за день — без переработок и чувства «снова ничего не сделал».' },
        { id:'feedback', icon:'🔁', name:'Обратная связь', desc:'Давать и принимать критику конструктивно',
          longDesc:'Давать и принимать критику так, чтобы она вела к росту, а не к обиде. Сильно недооценённый навык, определяющий качество работы в команде.',
          promise:'Через 21 день вы будете говорить и слышать критику без напряжения — и превращать её в реальные изменения.' },
        { id:'networking', icon:'🌐', name:'Нетворкинг', desc:'Строить и поддерживать профессиональные связи',
          longDesc:'Строить и поддерживать профессиональные связи без манипуляций и социальной фальши. Принцип «дай раньше, чем попросишь».',
          promise:'Через 21 день вы будете заводить полезные контакты без неловкости и поддерживать связи без выгорания.' },
        { id:'creativity', icon:'✨', name:'Креативность', desc:'Находить нестандартные решения',
          longDesc:'Находить нестандартные решения через комбинаторику и латеральное мышление. Тренируется как мышца — не про «вдохновение», а про устойчивые техники.',
          promise:'Через 21 день вы будете находить решения там, где другие видят тупик — за счёт устойчивых техник, а не вдохновения.' }
    ],
    influence: [
        { id:'speech_influence', icon:'🎙️', name:'Речевое воздействие', isNew:true,
          desc:'Гипнотические языковые паттерны, метафоры, риторические структуры',
          longDesc:'Арсенал из эриксоновского гипноза, НЛП и риторики: метафоры, языковые паттерны, структура убеждения. Тот же навык, что у лучших спикеров и переговорщиков.',
          promise:'Через 21 день ваша речь будет удерживать внимание и встраивать смыслы — без давления, без «продаж».' },
        { id:'emotion_partner', icon:'🪞', name:'Управление эмоциями собеседника', isNew:true,
          desc:'Возвращать собеседника из реактивного состояния в ресурсное',
          longDesc:'Не манипуляция — навык конструктивного диалога: возвращать собеседника из реактивного состояния в ресурсное, не подменяя его выбор. Нужен врачу, переговорщику, родителю, руководителю.',
          promise:'Через 21 день вы будете гасить острые конфликты в первые 30 секунд и возвращать партнёра к диалогу.' },
        { id:'emotion_group', icon:'👥', name:'Управление эмоциями группы', isNew:true,
          desc:'Эмоциональное заражение, работа с настроением команды или зала',
          longDesc:'Эмоциональное заражение в коллективах — мощный механизм. Можно использовать для создания продуктивной атмосферы или для понимания, как массовое настроение формируется.',
          promise:'Через 21 день вы будете считывать динамику группы и направлять её — на работе, на встрече, в зале.' },
        { id:'media_influence', icon:'📺', name:'Информационное воздействие через СМИ', isNew:true,
          desc:'Как новости формируют гормональный фон больших групп — для PR, маркетинга и критического мышления',
          longDesc:'Как новостные циклы формируют гормональный фон у больших групп. Понимать механизм — для критического мышления; применять этично — для PR, маркетинга, политической коммуникации.',
          promise:'Через 21 день вы будете читать новостную повестку на трёх уровнях смысла — и сознательно строить свой инфопоток.' }
    ]
};

const _SC_CUSTOM_PROMISE = 'Через 21 день у вас будет рабочий навык, который вы тренировали ежедневно — устойчивая привычка, а не разовая попытка.';
const _SC_CUSTOM_LONGDESC = 'Свой навык — мы тренируем его по тому же 21-дневному каркасу: знакомство, активная тренировка, закрепление. Каждый день — короткое упражнение.';

// ============================================
// КАНАЛЫ, ВРЕМЯ, РЕЖИМ
// ============================================
const SC_CHANNELS = [
    { id:'telegram', icon:'📱', name:'Telegram', desc:'Текст, голос, аудио-практики. Удобно в дороге.', tag:'Рекомендуем' },
    { id:'max',      icon:'🤖', name:'MAX',      desc:'Российский мессенджер от ВК. Те же форматы, что в Telegram.' },
    { id:'web',      icon:'🌐', name:'Веб-уведомления', desc:'Push в браузере, если открыт в фоне. Подходит для офиса.' },
    { id:'email',    icon:'📧', name:'Email-дайджест',  desc:'Утренний email с заданием и инструкцией.' },
    { id:'none',     icon:'🔕', name:'Без напоминаний', desc:'Сами заходите и отмечаете дни. Никто не пишет.' }
];

const SC_TIMES = ['07:00','08:00','09:00','10:00','12:00','18:00','20:00','21:00'];

const SC_MODES = [
    { id:'calm',   name:'Спокойный',  desc:'Одно утреннее сообщение с заданием дня. Ничего лишнего.' },
    { id:'active', name:'Активный',   desc:'Утром — задание, днём — короткий чек-ин «как идёт?», вечером — рефлексия в одно сообщение.' }
];

// ============================================
// ШАБЛОН 21-ДНЕВНОГО ПЛАНА
// ============================================
const DEFAULT_TEMPLATE_PLAN = {
    weeks: [
        {
            theme: 'Знакомство и калибровка',
            meaning: 'Поймёте, где именно вас «ловит», и сделаете первый осторожный шаг по-другому.',
            exercises: [
                { day:1, task:'Зачем вам этот навык', dur:'5 мин',
                  inst:'Представьте 3 ситуации, где этот навык изменил бы исход. Записывать необязательно — главное прочувствовать, где он реально нужен.',
                  why:'Без ясного «зачем» практика идёт через силу. Этот шаг превращает абстрактное намерение в конкретные ситуации, ради которых стоит тренироваться.' },
                { day:2, task:'Замечание', dur:'10 мин',
                  inst:'В течение дня замечайте моменты, где навык бы понадобился. Просто отмечайте мысленно — без оценки и попыток сразу действовать.',
                  why:'Прежде чем менять реакцию, её нужно увидеть. Без этого шага мы пытаемся изменить то, чего не замечаем.' },
                { day:3, task:'Триггеры', dur:'7 мин',
                  inst:'Подумайте: какие 3 ситуации запускают старую реакцию? Конкретно — место, человек, время, ваша мысль.',
                  why:'Зная триггеры, вы получаете предупреждение за секунды до старой реакции — и можете выбрать другой ответ.' },
                { day:4, task:'Микро-эксперимент', dur:'15 мин',
                  inst:'В одной безопасной ситуации сегодня попробуйте действовать по-новому. После — отметьте про себя, что получилось.',
                  why:'Знание о навыке ≠ навык. Только реальная безопасная попытка переводит понимание в опыт.' },
                { day:5, task:'Рефлексия', dur:'5 мин',
                  inst:'Что было неудобно вчера? Назовите это чувство одним словом.',
                  why:'Обучение происходит не в действии, а в его осмыслении. Чувство одним словом — ключ к точке роста.' },
                { day:6, task:'Повтор с поправкой', dur:'15 мин',
                  inst:'Похожая ситуация на день 4 — но с учётом вчерашнего наблюдения. Что попробуете сделать иначе?',
                  why:'Один раз — случайность. Повтор с поправкой превращает удачу в навык.' },
                { day:7, task:'Итог недели', dur:'10 мин',
                  inst:'Один главный инсайт за неделю. На сколько процентов вы продвинулись?',
                  why:'Без замера прогресса мозг не закрепляет результат. Цифра в процентах делает невидимое — видимым.' }
            ]
        },
        {
            theme: 'Активная тренировка',
            meaning: 'Начнёте действовать по-новому даже там, где раньше избегали — и заметите, что получается.',
            exercises: [
                { day:8, task:'Усложнение', dur:'15 мин',
                  inst:'Та же техника, но в более сложной ситуации. Там, где раньше избегали.',
                  why:'Привычка формируется на грани комфорта. Возвращение в избегаемые ситуации — обязательный этап.' },
                { day:9, task:'Постановка якоря', dur:'7 мин',
                  inst:'Когда сегодня получится — запомните телесное ощущение и сожмите большой и указательный пальцы на 5 секунд.',
                  why:'Тело помнит лучше слов. Якорь даёт быстрый доступ к ресурсному состоянию в момент стресса.' },
                { day:10, task:'Препятствие', dur:'10 мин',
                  inst:'Что в окружении мешает практике? Назовите один конкретный фактор и один шаг по его устранению.',
                  why:'Срывы случаются не от слабости, а от среды. Один убранный фактор стоит десяти усилий воли.' },
                { day:11, task:'Поддержка', dur:'5 мин',
                  inst:'Расскажите близкому, что проходите 21 день навыка. Попросите не оценивать прогресс.',
                  why:'Озвученное намерение приобретает социальный вес. Близкому говорят то, от чего не отступишь.' },
                { day:12, task:'Худший момент', dur:'10 мин',
                  inst:'Что было самым трудным? Опишите 3 предложениями. Что бы посоветовали другу в такой ситуации?',
                  why:'Через неудачи проходит граница освоенного. Совет другу — это совет себе, увиденный со стороны.' },
                { day:13, task:'Маленькая победа', dur:'15 мин',
                  inst:'Найдите ситуацию, где точно получится. Зафиксируйте успех любым способом — текстом, голосом, в дневнике.',
                  why:'Мозг закрепляет то, что мы фиксируем. Без фиксации успех проходит мимо нейронных путей.' },
                { day:14, task:'Полу-итог', dur:'10 мин',
                  inst:'На сколько процентов продвинулись? Что главное изменилось? Что осталось на третью неделю?',
                  why:'Два недельных среза дают вектор: ускоряемся или вышли на плато. Это решение — корректировать или продолжать.' }
            ]
        },
        {
            theme: 'Закрепление и интеграция',
            meaning: 'Новое поведение перестаёт требовать усилий и становится тем, как вы действуете по умолчанию.',
            exercises: [
                { day:15, task:'Естественная среда', dur:'12 мин',
                  inst:'Применяйте навык без специальных условий — просто в обычном дне.',
                  why:'Навык в специальных условиях ≠ навык в жизни. Этот день показывает, выдерживает ли он реальность.' },
                { day:16, task:'Без напоминаний', dur:'10 мин',
                  inst:'Попробуйте сделать без подсказки. К вечеру отметьте, удалось ли вспомнить самостоятельно.',
                  why:'Цель — не в том, чтобы Фреди напоминал, а чтобы навык включался сам. Сегодня проверяем автономию.' },
                { day:17, task:'Перенос', dur:'15 мин',
                  inst:'Новая ситуация, где раньше не пробовали. Что из навыка переносится, что нет?',
                  why:'Гибкость — это способность применять в новом контексте. Если работает только в одном месте — это не навык.' },
                { day:18, task:'Глубже', dur:'15 мин',
                  inst:'Усложните: больше людей, выше ставки, дольше время.',
                  why:'Тренировка только в лёгких ситуациях не двигает планку. Сегодня берём на ступень выше.' },
                { day:19, task:'Помощь другому', dur:'10 мин',
                  inst:'Объясните принцип навыка кому-то ещё в 2–3 предложениях.',
                  why:'Объяснение требует понимания. Этот шаг закрепляет навык на уровне смысла, а не действия.' },
                { day:20, task:'Письмо себе', dur:'15 мин',
                  inst:'Напишите себе через год — что хотите помнить из этих 21 дня.',
                  why:'Пройденный путь забывается быстрее, чем кажется. Письмо в будущее закрепляет урок надолго.' },
                { day:21, task:'Итог цикла', dur:'15 мин',
                  inst:'Сравните: где были в день 1 и где сегодня. Что точно изменилось? Что дальше?',
                  why:'Сравнение «было/стало» делает результат осязаемым. Без него прогресс растворяется в повседневности.' }
            ]
        }
    ]
};

function _scLocalPlan() { return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_PLAN)); }

// Тянем специализированный 21-дневный план под конкретный навык с бэка.
// Если на бэке шаблона ещё нет (404 / no specialized template) — отдаём
// универсальный DEFAULT_TEMPLATE_PLAN. Это гарантирует, что «Поехали!»
// работает даже когда контентная база ещё не докатана.
async function _scFetchPlan(skillId) {
    const fallback = _scLocalPlan();
    if (!skillId || skillId === 'custom') return fallback;
    try {
        const r = await fetch(`${_scApi()}/api/skill-plan/template/${encodeURIComponent(skillId)}`,
                              { cache: 'no-store' });
        if (!r.ok) return fallback;
        const j = await r.json();
        if (j && j.success && j.plan && Array.isArray(j.plan.weeks) && j.plan.weeks.length === 3) {
            return j.plan;
        }
    } catch (e) {
        console.warn('[Fredi] template fetch failed, using default:', e);
    }
    return fallback;
}

// ============================================
// СОСТОЯНИЕ
// ============================================
if (!window._scState) window._scState = {
    view: 'select',
    skillId: null, skillName: null, skillDesc: null, skillLongDesc: null, skillPromise: null,
    plan: null, daysDone: [], startDate: null,
    channel: null, notifyTime: '09:00', mode: 'calm',
    expandedDay: null, openWeeks: null,
    linkStatus: null  // {telegram: bool, max: bool} — обновляется на setup-экране
};
const _sc = window._scState;

// ============================================
// УТИЛИТЫ
// ============================================
function _scToast(msg, t) { if (window.showToast) window.showToast(msg, t||'info'); }
function _scHome()  { if (typeof renderDashboard==='function') renderDashboard(); else if (window.renderDashboard) window.renderDashboard(); }
function _scUid()   { return window.CONFIG?.USER_ID; }
function _scApi()   { return window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
function _scTz()    {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
}
function _scTgBot()    { return window.CONFIG?.TG_BOT_USERNAME || 'Frederick777bot'; }
function _scMaxLink()  { return window.CONFIG?.MAX_BOT_LINK || 'https://max.ru/id502238728185_1_bot'; }
function _scLinkUrl(channel) {
    const uid = _scUid() || 0;
    if (channel === 'telegram') return `https://t.me/${_scTgBot()}?start=web_${uid}`;
    if (channel === 'max')      return `${_scMaxLink()}?start=web_${uid}`;
    return null;
}

// ============================================
// СИНХРОНИЗАЦИЯ С БЭКЕНДОМ
// localStorage — первичный источник (мгновенный UI), бэкенд — для cross-device.
// Все вызовы fire-and-forget — если бэк недоступен, фронт продолжает работать.
// ============================================
async function _scApiPush() {
    const uid = _scUid();
    if (!uid || !_sc.skillId || !_sc.plan) return;
    try {
        await fetch(`${_scApi()}/api/skill-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id:         uid,
                skill_id:        _sc.skillId,
                skill_name:      _sc.skillName,
                skill_desc:      _sc.skillDesc,
                skill_long_desc: _sc.skillLongDesc,
                skill_promise:   _sc.skillPromise,
                plan:            _sc.plan,
                started_at:      _sc.startDate,
                channel:         _sc.channel,
                notify_time:     _sc.notifyTime,
                mode:             _sc.mode,
                tz:              _scTz()
            })
        });
    } catch (e) { /* offline — ok, есть localStorage */ }
}

async function _scApiPull() {
    const uid = _scUid();
    if (!uid) return null;
    try {
        const r = await fetch(`${_scApi()}/api/skill-plan/${uid}`);
        if (!r.ok) return null;
        const d = await r.json();
        if (!d.success || !d.plan) return null;
        return d.plan;
    } catch { return null; }
}

async function _scApiDayDone(day) {
    const uid = _scUid();
    if (!uid) return;
    try {
        await fetch(`${_scApi()}/api/skill-plan/${uid}/day-done`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day })
        });
    } catch {}
}

async function _scApiDayUndone(day) {
    const uid = _scUid();
    if (!uid) return;
    try {
        await fetch(`${_scApi()}/api/skill-plan/${uid}/day-undone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day })
        });
    } catch {}
}

async function _scApiSettings(payload) {
    const uid = _scUid();
    if (!uid) return;
    try {
        await fetch(`${_scApi()}/api/skill-plan/${uid}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch {}
}

async function _scApiDelete() {
    const uid = _scUid();
    if (!uid) return;
    try {
        await fetch(`${_scApi()}/api/skill-plan/${uid}`, { method: 'DELETE' });
    } catch {}
}

async function _scApiLinkStatus() {
    const uid = _scUid();
    if (!uid) return null;
    try {
        const r = await fetch(`${_scApi()}/api/skill-plan/${uid}/link-status`);
        if (!r.ok) return null;
        return await r.json();
    } catch { return null; }
}

async function _scApiTestSend() {
    const uid = _scUid();
    if (!uid) return { success: false, error: 'no user' };
    try {
        const r = await fetch(`${_scApi()}/api/skill-plan/${uid}/test-send`, { method: 'POST' });
        return await r.json();
    } catch (e) {
        return { success: false, error: 'network' };
    }
}

async function _scApiWelcomeSend() {
    const uid = _scUid();
    if (!uid) return { success: false };
    try {
        const r = await fetch(`${_scApi()}/api/skill-plan/${uid}/welcome-send`, { method: 'POST' });
        return await r.json();
    } catch { return { success: false }; }
}

function _scSave() {
    try {
        const data = {
            skillId: _sc.skillId, skillName: _sc.skillName, skillDesc: _sc.skillDesc,
            skillLongDesc: _sc.skillLongDesc, skillPromise: _sc.skillPromise,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate,
            channel: _sc.channel, notifyTime: _sc.notifyTime, mode: _sc.mode
        };
        localStorage.setItem('sc_plan_'+_scUid(), JSON.stringify(data));
        localStorage.setItem('trainer_skill_'+_scUid(), JSON.stringify({
            skillId: _sc.skillId, skillName: _sc.skillName,
            plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate,
            channel: _sc.channel, notifyTime: _sc.notifyTime, mode: _sc.mode
        }));
    } catch {}
    // Возвращаем промис, чтобы вызыватели могли await при необходимости.
    return _scApiPush();
}

async function _scLoad() {
    // Сначала пробуем бэк (cross-device), затем localStorage как fallback.
    const remote = await _scApiPull();
    if (remote) {
        _sc.skillId       = remote.skill_id;
        _sc.skillName     = remote.skill_name;
        _sc.skillDesc     = remote.skill_desc;
        _sc.skillLongDesc = remote.skill_long_desc;
        _sc.skillPromise  = remote.skill_promise;
        _sc.plan          = remote.plan;
        _sc.daysDone      = remote.days_done || [];
        _sc.startDate     = remote.started_at;
        _sc.channel       = remote.channel;
        _sc.notifyTime    = remote.notify_time || '09:00';
        _sc.mode          = remote.mode || 'calm';
        // Подстрахуемся: записываем в localStorage, чтобы при следующей загрузке
        // без сети тоже было что показать.
        try {
            localStorage.setItem('sc_plan_'+_scUid(), JSON.stringify({
                skillId: _sc.skillId, skillName: _sc.skillName, skillDesc: _sc.skillDesc,
                skillLongDesc: _sc.skillLongDesc, skillPromise: _sc.skillPromise,
                plan: _sc.plan, daysDone: _sc.daysDone, startDate: _sc.startDate,
                channel: _sc.channel, notifyTime: _sc.notifyTime, mode: _sc.mode
            }));
        } catch {}
        return;
    }
    // Fallback: localStorage.
    try {
        const d = localStorage.getItem('sc_plan_'+_scUid());
        if (d) Object.assign(_sc, JSON.parse(d));
    } catch {}
}

function _scCurrentDay() {
    if (!_sc.startDate) return 1;
    const diff = Math.floor((Date.now() - new Date(_sc.startDate)) / 86400000) + 1;
    return Math.min(21, Math.max(1, diff));
}

function _scFindSkill(id) {
    if (!id) return null;
    for (const cat of Object.values(SC_SKILLS)) {
        const sk = cat.find(s => s.id === id);
        if (sk) return sk;
    }
    return null;
}

function _scAllExercises() { return (_sc.plan?.weeks || []).flatMap(w => w.exercises); }
function _scWeekOf(day) { return day <= 7 ? 0 : (day <= 14 ? 1 : 2); }
function _scChannelMeta(id) { return SC_CHANNELS.find(c => c.id === id); }
function _scModeMeta(id)    { return SC_MODES.find(m => m.id === id); }

function _scCategoryLabel(id) {
    if (SC_SKILLS.personal.some(s => s.id === id))     return '🧠 Личностный навык';
    if (SC_SKILLS.professional.some(s => s.id === id)) return '💼 Профессиональный навык';
    if (SC_SKILLS.influence.some(s => s.id === id))    return '🎙️ Влияние и коммуникация';
    return '✏️ Свой навык';
}

function _scShowWelcomeModal(opts) {
    const { skillName, channel, notifyTime, tz } = opts || {};
    const chMeta = _scChannelMeta(channel) || {};
    const channelName = chMeta.name || channel;
    const isReal = channel && channel !== 'none';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:9001;display:flex;align-items:center;justify-content:center;padding:20px;animation:scFade .3s ease';

    const noChan = `<div style="background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.12);border-radius:12px;padding:12px 14px;margin-bottom:18px;font-size:12px;color:var(--text-secondary);line-height:1.5">
        🔕 Без напоминаний — заходите сами каждый день и отмечайте выполнение.
    </div>`;
    const realChan = `<div style="background:rgba(58,134,255,0.10);border:1px solid rgba(58,134,255,0.30);border-radius:12px;padding:12px 14px;margin-bottom:18px;font-size:12px;color:var(--text-primary);line-height:1.55">
        📨 Завтра в <strong>${notifyTime} (${tz||'UTC'})</strong> пришлю задание дня 2 в <strong>${channelName}</strong>.
    </div>`;

    overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(94,224,168,0.35);border-radius:22px;padding:24px;max-width:360px;width:100%;box-shadow:0 8px 40px rgba(94,224,168,0.15)">
        <div style="font-size:42px;text-align:center;margin-bottom:12px;line-height:1">🎉</div>
        <div style="font-size:20px;font-weight:700;text-align:center;color:var(--text-primary);margin-bottom:6px">Поехали!</div>
        <div style="font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:20px">${skillName} — 21 день</div>
        <div style="background:rgba(94,224,168,0.12);border:1px solid rgba(94,224,168,0.35);border-radius:12px;padding:12px 14px;margin-bottom:10px;font-size:12px;color:var(--text-primary);line-height:1.55">
            ✅ <strong>Первое задание</strong> уже на экране — можно сделать прямо сейчас, 5 минут.
        </div>
        ${isReal ? realChan : noChan}
        <button id="scWelcomeOk" style="width:100%;padding:13px;border-radius:30px;background:linear-gradient(135deg,rgba(224,224,224,0.2),rgba(192,192,192,0.1));border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-weight:600;font-family:inherit;cursor:pointer;font-size:14px">Открыть план →</button>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#scWelcomeOk').onclick = () => overlay.remove();
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
}

function _scStepsHtml(active) {
    const steps = [
        { id:'select', label:'Выбор'    },
        { id:'detail', label:'Знакомство' },
        { id:'setup',  label:'Настройка' },
        { id:'plan',   label:'Тренировка'  }
    ];
    const order = steps.findIndex(s => s.id === active);
    return `<div class="sc-steps">${steps.map((s, i) => {
        const cls = i < order ? 'done' : (i === order ? 'current' : '');
        const arrow = i < steps.length-1 ? '<span class="sc-step-arrow">▸</span>' : '';
        return `<div class="sc-step ${cls}">
            <div class="sc-step-num">${i+1}</div>
            <span class="sc-step-text">${s.label}</span>
        </div>${arrow}`;
    }).join('')}</div>`;
}

// ============================================
// РЕНДЕР
// ============================================
function _scRender() {
    _scInjectStyles();
    const c = document.getElementById('screenContainer');
    if (!c) return;

    let body = '';
    if (_sc.view === 'select')   body = _scRenderSelect();
    if (_sc.view === 'detail')   body = _scRenderDetail();
    if (_sc.view === 'setup')    body = _scRenderSetup();
    if (_sc.view === 'launched') body = _scRenderLaunched();
    if (_sc.view === 'plan')     body = _scRenderPlan();

    const subtitle = _sc.view === 'setup'    ? 'Беру навык — настройка'
                   : _sc.view === 'detail'   ? 'Знакомство с навыком'
                   : _sc.view === 'launched' ? 'Программа запущена'
                   : _sc.view === 'plan'     ? 'Активная тренировка'
                   : 'Что развиваем за 21 день';

    c.innerHTML = `
        <div class="full-content-page">
            <button class="back-btn" id="scBack">◀️ НАЗАД</button>
            <div class="content-header">
                <div class="content-emoji">🎯</div>
                <h1 class="content-title">Выбор навыка</h1>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">${subtitle}</p>
            </div>
            <div id="scBody">${body}</div>
        </div>`;

    document.getElementById('scBack').onclick = () => {
        if (_sc.view === 'plan')     { _sc.view = 'select'; _scRender(); return; }
        if (_sc.view === 'launched') { _sc.view = 'select'; _scRender(); return; }
        if (_sc.view === 'setup')    { _sc.view = 'detail'; _scRender(); return; }
        if (_sc.view === 'detail')   { _sc.view = 'select'; _scRender(); return; }
        _scHome();
    };

    _scBindHandlers();
}

// ===== ЭКРАН ВЫБОРА =====
function _scRenderSelect() {
    let activePlan = '';
    if (_sc.plan) {
        activePlan = `
        <div style="background:rgba(224,224,224,0.06);border:1px solid rgba(224,224,224,0.18);border-radius:14px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-size:13px;font-weight:600;color:var(--chrome)">${_sc.skillName}</div>
                <div style="font-size:11px;color:var(--text-secondary)">День ${_scCurrentDay()} из 21 · выполнено ${_sc.daysDone.length}</div>
            </div>
            <button class="sc-btn sc-btn-ghost" id="scOpenPlan" style="flex-shrink:0">Открыть план →</button>
        </div>`;
    }

    let diagBlock = '';
    try {
        const sdRaw = localStorage.getItem('sd_result_'+_scUid());
        if (sdRaw) {
            const sd = JSON.parse(sdRaw);
            const sphere = sd.sphere || 'personal';
            const skills = SC_SKILLS[sphere] || SC_SKILLS.personal;
            const entries = Object.entries(sd.scores || {});
            if (entries.length > 0) {
                const sorted = entries.map(([qi, score]) => ({ qi: parseInt(qi), score }))
                    .sort((a,b) => a.score - b.score).slice(0, 3);
                const cards = sorted.map(({qi, score}) => {
                    const skill = skills[qi];
                    if (!skill) return '';
                    const pct = Math.round(score/4*100);
                    return `<div class="sc-skill-card" data-id="${skill.id}">
                        <div class="sc-skill-icon">${skill.icon||'🎯'}</div>
                        <div class="sc-skill-body">
                            <div class="sc-skill-name">${skill.name}</div>
                            <div class="sc-skill-sub">${skill.desc}</div>
                            <div class="sc-skill-bar-wrap"><div class="sc-skill-bar-fill" style="width:${pct}%"></div></div>
                            <div class="sc-skill-hint">Узнать подробнее →</div>
                        </div>
                        <div class="sc-skill-score">${score}/4</div>
                        <div class="sc-skill-arrow">›</div>
                    </div>`;
                }).filter(Boolean).join('');
                if (cards) diagBlock = `<div class="sc-section-label">📊 Из диагностики — слабые места</div>${cards}`;
            }
        }
    } catch {}

    const renderList = (arr) => arr.map(sk => `
        <div class="sc-skill-card" data-id="${sk.id}">
            <div class="sc-skill-icon">${sk.icon||'🎯'}</div>
            <div class="sc-skill-body">
                <div class="sc-skill-name">${sk.name}${sk.isNew?'<span class="sc-skill-new">NEW</span>':''}</div>
                <div class="sc-skill-sub">${sk.desc}</div>
                <div class="sc-skill-hint">Узнать подробнее →</div>
            </div>
            <div class="sc-skill-arrow">›</div>
        </div>`).join('');

    return `
        ${activePlan}
        ${diagBlock}
        <div class="sc-section-label" style="margin-top:${diagBlock?'18px':'0'}">🧠 Личностные навыки</div>
        ${renderList(SC_SKILLS.personal)}
        <div class="sc-section-label">💼 Профессиональные навыки</div>
        ${renderList(SC_SKILLS.professional)}
        <div class="sc-section-label">🎙️ Влияние и коммуникация</div>
        ${renderList(SC_SKILLS.influence)}

        <div class="sc-custom-block">
            <div class="sc-custom-label">✏️ Или введите свой навык:</div>
            <input class="sc-input" id="scCustomInput" placeholder="Например: публичные выступления, управление гневом...">
            <button class="sc-btn sc-btn-primary" id="scCustomBtn" style="margin-top:10px">
                Открыть описание →
            </button>
        </div>
        <div class="sc-tip">
            💡 Кликните на навык — увидите описание, примеры заданий и сможете выбрать его для 21-дневной тренировки.
        </div>`;
}

// ===== ЭКРАН НАВЫКА =====
function _scRenderDetail() {
    const sk = _scFindSkill(_sc.skillId);
    const isCustom = _sc.skillId === 'custom';
    const name     = sk?.name     || _sc.skillName    || 'Свой навык';
    const longDesc = sk?.longDesc || _sc.skillLongDesc || _SC_CUSTOM_LONGDESC;
    const promise  = sk?.promise  || _sc.skillPromise || _SC_CUSTOM_PROMISE;
    const cat      = isCustom ? '✏️ Свой навык' : _scCategoryLabel(_sc.skillId);

    const phasesHtml = DEFAULT_TEMPLATE_PLAN.weeks.map((w, i) => `
        <div class="sc-phase">
            <div class="sc-phase-num">${i+1}</div>
            <div class="sc-phase-body">
                <div class="sc-phase-theme">Неделя ${i+1}: ${w.theme}</div>
                <div class="sc-phase-mean">${w.meaning}</div>
            </div>
        </div>`).join('');

    const sampleDays = [1, 9, 17];
    const allEx = DEFAULT_TEMPLATE_PLAN.weeks.flatMap(w => w.exercises);
    const examplesHtml = sampleDays.map(d => {
        const ex = allEx.find(e => e.day === d);
        if (!ex) return '';
        const wIdx = _scWeekOf(d);
        return `<div class="sc-example">
            <div class="sc-example-head">
                <div class="sc-example-tag">День ${d} · Неделя ${wIdx+1}</div>
                <div class="sc-example-task">${ex.task}</div>
                <div class="sc-example-dur">⏱ ${ex.dur}</div>
            </div>
            <div class="sc-example-inst">${ex.inst}</div>
        </div>`;
    }).join('');

    return `
        ${_scStepsHtml('detail')}
        <div class="sc-detail-hero">
            <div class="sc-detail-cat">${cat}</div>
            <div class="sc-detail-title">${(sk?.icon||'🎯')} ${name}</div>
            <div class="sc-detail-promise-label">Что вы получите за 21 день</div>
            <div class="sc-detail-promise">${promise}</div>
        </div>

        <div class="sc-detail-section">
            <div class="sc-detail-h">📖 Что это за навык</div>
            <p class="sc-detail-p">${longDesc}</p>
        </div>

        <div class="sc-detail-section">
            <div class="sc-detail-h">🗺 Как пойдём — 3 фазы по неделе</div>
            <div class="sc-phases-list">${phasesHtml}</div>
        </div>

        <div class="sc-detail-section">
            <div class="sc-detail-h">📝 Примеры заданий</div>
            ${examplesHtml}
        </div>

        <div class="sc-detail-section">
            <div class="sc-detail-h">📋 Формат</div>
            <div class="sc-format-grid">
                <div class="sc-format-item"><div class="sc-format-icon">📅</div><div class="sc-format-text"><strong>21 день</strong>3 недели по 7 дней</div></div>
                <div class="sc-format-item"><div class="sc-format-icon">⏱</div><div class="sc-format-text"><strong>5–15 мин</strong>в день</div></div>
                <div class="sc-format-item"><div class="sc-format-icon">📲</div><div class="sc-format-text"><strong>Напоминания</strong>в выбранном канале</div></div>
            </div>
        </div>

        <button class="sc-btn sc-btn-primary" id="scChooseBtn" style="margin-top:14px">
            🤝 Беру этот навык →
        </button>
        <button class="sc-btn sc-btn-ghost" id="scBackToList" style="width:100%;margin-top:10px">
            ← Посмотреть другие
        </button>`;
}

// ===== ЭКРАН НАСТРОЙКИ =====
function _scRenderSetup() {
    const linkable = (id) => id === 'telegram' || id === 'max';
    const linkStatus = _sc.linkStatus || {};
    const channelsHtml = SC_CHANNELS.map(ch => {
        let badge = '';
        if (_sc.channel === ch.id && linkable(ch.id)) {
            const linked = !!linkStatus[ch.id];
            badge = linked
                ? '<span class="sc-link-badge linked">✓ привязано</span>'
                : '<span class="sc-link-badge unlinked">⚠ не привязано</span>';
        }
        const isActive = _sc.channel === ch.id;
        const showLinkBtn  = isActive && linkable(ch.id) && !linkStatus[ch.id];
        const showTestBtn  = isActive && linkable(ch.id) &&  linkStatus[ch.id];
        const linkUrl = showLinkBtn ? _scLinkUrl(ch.id) : null;
        return `
        <div class="sc-channel-card${isActive?' active':''}" data-channel="${ch.id}">
            <div class="sc-channel-icon">${ch.icon}</div>
            <div class="sc-channel-body">
                <div class="sc-channel-name">${ch.name}${ch.tag?`<span class="sc-channel-tag">${ch.tag}</span>`:''}${badge}</div>
                <div class="sc-channel-desc">${ch.desc}</div>
                ${showLinkBtn ? `
                    <a class="sc-test-btn" id="scLink_${ch.id}" href="${linkUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">
                        🔗 Связать ${ch.name}
                    </a>
                    <div class="sc-link-hint">После клика откроется ${ch.name}-бот, нажми Start. Затем вернись сюда и нажми «Проверить» <a id="scLinkRecheck_${ch.id}">↻</a></div>
                ` : ''}
                ${showTestBtn ? `<button class="sc-test-btn" id="scTestSend_${ch.id}">📨 Отправить тестовое сообщение</button>` : ''}
            </div>
            <div class="sc-channel-radio"></div>
        </div>`;
    }).join('');

    const showTime = _sc.channel && _sc.channel !== 'none';
    const timeButtonsHtml = SC_TIMES.map(t =>
        `<button class="sc-time-btn${_sc.notifyTime===t?' active':''}" data-time="${t}">${t}</button>`
    ).join('');

    const modesHtml = SC_MODES.map(m => `
        <div class="sc-mode-card${_sc.mode===m.id?' active':''}" data-mode="${m.id}">
            <div class="sc-mode-head">
                <div class="sc-mode-name">${m.name}</div>
                <div class="sc-mode-radio"></div>
            </div>
            <div class="sc-mode-desc">${m.desc}</div>
        </div>`).join('');

    const canStart = !!_sc.channel;

    const sk = _scFindSkill(_sc.skillId);
    const skIcon = sk?.icon || '🎯';

    return `
        ${_scStepsHtml('setup')}
        <div class="sc-chosen">
            <div class="sc-chosen-mark">✓ Навык выбран</div>
            <div class="sc-chosen-name">${skIcon} ${_sc.skillName}</div>
            <div class="sc-chosen-text">Осталось настроить, как тренироваться — и можно начинать.</div>
        </div>

        <div class="sc-section-label">📲 Куда присылать задания</div>
        ${channelsHtml}

        ${showTime ? `
        <div class="sc-time-block">
            <div class="sc-time-label">⏰ Время утреннего сообщения <span style="font-weight:400;color:var(--text-secondary)">(${_scTz()})</span></div>
            <div class="sc-time-grid">${timeButtonsHtml}</div>
        </div>` : ''}

        <div class="sc-section-label">⚡ Режим</div>
        ${modesHtml}

        <button class="sc-btn sc-btn-primary" id="scStartBtn" style="margin-top:18px"${canStart?'':' disabled'}>
            🚀 Поехали!
        </button>
        <button class="sc-btn sc-btn-ghost" id="scBackToDetail" style="width:100%;margin-top:10px">
            ← Назад к описанию
        </button>
        <div class="sc-tip">
            💡 Настройки можно изменить позже на экране плана.
        </div>`;
}

// ===== ЭКРАН «ПРОГРАММА ЗАПУЩЕНА» =====
// Показывается сразу после нажатия «🚀 Поехали!». Главная задача —
// сообщить юзеру: «всё, можно идти в мессенджер, программа сама поведёт».
function _scRenderLaunched() {
    const sk = _scFindSkill(_sc.skillId);
    const skIcon = sk?.icon || '🎯';
    const chMeta = _scChannelMeta(_sc.channel) || {};
    const channelName = chMeta.name || _sc.channel || '';
    const isMessenger = _sc.channel === 'telegram' || _sc.channel === 'max';
    const linkUrl = isMessenger ? _scLinkUrl(_sc.channel) : null;
    const tz = _scTz();

    return `
        ${_scStepsHtml('plan')}

        <div style="text-align:center;padding:24px 12px 18px">
            <div style="font-size:64px;margin-bottom:14px;line-height:1">🚀</div>
            <div style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:6px">Поехали!</div>
            <div style="font-size:13px;color:var(--text-secondary)">21 день · ${skIcon} ${_sc.skillName}</div>
        </div>

        <div class="sc-detail-section">
            ${isMessenger ? `
            <div style="display:flex;align-items:flex-start;gap:12px;font-size:13px;color:var(--text-primary);line-height:1.55;margin-bottom:14px">
                <span style="color:#5EE0A8;font-size:18px;line-height:1.3;flex-shrink:0">✅</span>
                <span><strong>День 1 уже в ${channelName}</strong> — открой и сделай прямо там, всё что нужно прислал.</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;font-size:13px;color:var(--text-primary);line-height:1.55;margin-bottom:14px">
                <span style="color:var(--chrome);font-size:16px;line-height:1.3;flex-shrink:0">⏰</span>
                <span><strong>Завтра в ${_sc.notifyTime} (${tz})</strong> — пришлю день 2 туда же.</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;font-size:13px;color:var(--text-primary);line-height:1.55">
                <span style="font-size:16px;line-height:1.3;flex-shrink:0">📅</span>
                <span><strong>21 день подряд</strong> — короткое задание каждое утро.</span>
            </div>
            ` : `
            <div style="display:flex;align-items:flex-start;gap:12px;font-size:13px;color:var(--text-primary);line-height:1.55;margin-bottom:14px">
                <span style="color:#5EE0A8;font-size:18px;line-height:1.3;flex-shrink:0">✅</span>
                <span><strong>День 1</strong> доступен в плане — переходи и делай.</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;font-size:13px;color:var(--text-primary);line-height:1.55">
                <span style="font-size:16px;line-height:1.3;flex-shrink:0">📅</span>
                <span><strong>Без напоминаний</strong> — заходи сам каждый день и отмечай выполнение.</span>
            </div>
            `}
        </div>

        ${linkUrl ? `
        <a href="${linkUrl}" target="_blank" rel="noopener" class="sc-btn sc-btn-primary" style="margin-top:14px;text-decoration:none;display:flex;align-items:center;justify-content:center">
            Открыть ${channelName} →
        </a>` : ''}

        <button class="sc-btn sc-btn-ghost" id="scGoToPlan" style="width:100%;margin-top:10px">
            ${linkUrl ? 'Посмотреть план на 21 день' : '📋 К плану'}
        </button>

        <div class="sc-tip" style="margin-top:14px">
            💡 ${isMessenger
                ? `Можно закрыть страницу — задания будут приходить в ${channelName} каждый день автоматически.`
                : `Заходи сюда каждый день — отмечай выполнение и смотри прогресс.`}
        </div>`;
}

// ===== ЭКРАН ПЛАНА =====
function _scRenderPlan() {
    if (!_sc.plan) return '<p style="color:var(--text-secondary)">Ошибка загрузки плана</p>';

    const day     = _scCurrentDay();
    const done    = _sc.daysDone;
    const pct     = Math.round((done.length / 21) * 100);
    const all     = _scAllExercises();
    const promise = _sc.skillPromise || _scFindSkill(_sc.skillId)?.promise || _SC_CUSTOM_PROMISE;
    const chMeta  = _scChannelMeta(_sc.channel);
    const modeMeta = _scModeMeta(_sc.mode);

    if (!_sc.openWeeks) {
        _sc.openWeeks = [false, false, false];
        _sc.openWeeks[_scWeekOf(day)] = true;
    }

    const curEx = all.find(e => e.day === day);
    const isDoneToday = done.includes(day);
    const isFreshStart = day === 1 && done.length === 0;
    const freshBanner = isFreshStart ? `
        <div style="background:linear-gradient(135deg,rgba(94,224,168,0.10),rgba(94,224,168,0.02));border:1px solid rgba(94,224,168,0.30);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-primary);line-height:1.5">
            ✨ <strong>Первый день — самое начало!</strong> Прочти задание ниже и сделай за 5 минут.
        </div>` : '';
    const todayHtml = curEx ? `
        <div class="sc-section-label">⚡ Сегодня</div>
        ${freshBanner}
        <div class="sc-today-card">
            <div class="sc-today-header">
                <div class="sc-today-num">${day}</div>
                <div class="sc-today-task">${curEx.task}</div>
            </div>
            <div class="sc-today-dur">⏱ ${curEx.dur}</div>
            <div class="sc-today-inst">${curEx.inst}</div>
            ${curEx.why ? `<div style="margin-bottom:12px;padding:10px 12px;background:rgba(58,134,255,0.05);border-left:2px solid rgba(58,134,255,0.4);border-radius:6px;font-size:12px;line-height:1.55;color:var(--text-primary)">
                <strong style="color:var(--chrome)">💭 Зачем это</strong><br>${curEx.why}
            </div>` : ''}
            ${!isDoneToday
                ? `<button class="sc-btn sc-btn-primary" id="scMarkDone">✅ Отметить выполнение</button>`
                : `<div style="font-size:12px;color:var(--text-secondary);text-align:center">✅ Выполнено сегодня — до завтра!</div>`}
        </div>` : '';

    const tomEx = all.find(e => e.day === day + 1);
    const tomorrowHtml = tomEx ? `
        <div class="sc-tomorrow">
            <div>
                <div class="sc-tomorrow-label">Завтра</div>
                <div class="sc-tomorrow-task">${tomEx.task}</div>
            </div>
            <div style="flex:1"></div>
            <div class="sc-tomorrow-dur">⏱ ${tomEx.dur}</div>
        </div>` : '';

    const weeksHtml = _sc.plan.weeks.map((week, wi) => {
        const isOpen   = _sc.openWeeks[wi];
        const weekDone = week.exercises.filter(e => done.includes(e.day)).length;
        const total    = week.exercises.length;

        const rowsHtml = week.exercises.map(ex => {
            const d = ex.day;
            const isDone    = done.includes(d);
            const isCurrent = d === day && !isDone;
            const isFuture  = d > day && !isDone;
            const expanded  = _sc.expandedDay === d;
            const status    = isDone ? '✓' : (isCurrent ? '●' : (isFuture ? '·' : ''));
            const cls = ['sc-day-row', isDone?'done':'', isCurrent?'current':'', expanded?'expanded':''].filter(Boolean).join(' ');
            const detail = expanded ? `
                <div class="sc-day-detail">
                    ${ex.inst}
                    ${ex.why ? `<div style="margin-top:10px;padding:10px 12px;background:rgba(58,134,255,0.05);border-left:2px solid rgba(58,134,255,0.4);border-radius:6px;font-size:11px;line-height:1.55;color:var(--text-primary)">
                        <strong style="color:var(--chrome)">💭 Зачем это</strong><br>${ex.why}
                    </div>` : ''}
                    <div class="sc-day-detail-actions">
                        <button class="sc-btn sc-btn-ghost sc-day-toggle-done" data-day="${d}">
                            ${isDone ? '↩️ Снять отметку' : '✅ Отметить выполнение'}
                        </button>
                    </div>
                </div>` : '';
            return `<div class="${cls}" data-day="${d}">
                <div class="sc-day-num-pill">${d}</div>
                <div class="sc-day-info">
                    <div class="sc-day-task">${ex.task}</div>
                    <div class="sc-day-dur">⏱ ${ex.dur}</div>
                </div>
                <div class="sc-day-status">${status}</div>
                ${detail}
            </div>`;
        }).join('');

        return `<div class="sc-week">
            <div class="sc-week-head${isOpen?' open':''}" data-week="${wi}">
                <div class="sc-week-info">
                    <div class="sc-week-label">Неделя ${wi+1}</div>
                    <div class="sc-week-theme">${week.theme}</div>
                    <div class="sc-week-mean">${week.meaning || ''}</div>
                </div>
                <div class="sc-week-stats">${weekDone}/${total}</div>
                <div class="sc-week-toggle">▸</div>
            </div>
            <div class="sc-week-list${isOpen?' open':''}">${rowsHtml}</div>
        </div>`;
    }).join('');

    const channelInfo = chMeta && chMeta.id !== 'none' ? `
        <div class="sc-plan-channel-info">
            <span>${chMeta.icon}</span>
            <span>Уведомления в <strong>${chMeta.name}</strong> в <strong>${_sc.notifyTime}</strong> · режим <strong>${modeMeta?.name||'спокойный'}</strong></span>
            <a id="scChangeSetup">изменить</a>
        </div>` : `
        <div class="sc-plan-channel-info">
            <span>🔕</span>
            <span>Без напоминаний</span>
            <a id="scChangeSetup">подключить</a>
        </div>`;

    const skIcon = _scFindSkill(_sc.skillId)?.icon || '🎯';
    return `
        ${_scStepsHtml('plan')}
        <div class="sc-plan-header">
            <div class="sc-plan-skill">${skIcon} ${_sc.skillName}</div>
            <div class="sc-plan-promise">${promise}</div>
            <div class="sc-plan-meta">
                День ${day} из 21 · выполнено ${done.length} упражнений · прогресс ${pct}%
            </div>
            <div class="sc-plan-progress">
                <div class="sc-plan-progress-fill" style="width:${pct}%"></div>
            </div>
            ${channelInfo}
        </div>

        ${todayHtml}
        ${tomorrowHtml}

        <div class="sc-section-label">🗺 Весь путь</div>
        ${weeksHtml}

        <div class="sc-btn-row" style="margin-top:20px">
            <button class="sc-btn sc-btn-ghost" id="scResetBtn">🔄 Новый навык</button>
            <button class="sc-btn sc-btn-ghost" id="scGoTraining">⚡ Тренировка дня</button>
        </div>`;
}

// ============================================
// ЗАЩИТА ОТ ПОВТОРНОГО ЗАПУСКА
// ============================================
async function _scStartProgram() {
    // Реальный запуск: создаёт план (специализированный под навык, если есть
    // на бэке, иначе универсальный), переходит на launched, шлёт welcome.
    _sc.plan        = await _scFetchPlan(_sc.skillId);
    _sc.daysDone    = [];
    _sc.startDate   = new Date().toISOString();
    _sc.openWeeks   = null;
    _sc.expandedDay = null;

    // Обновляем снимок — теперь активен этот навык.
    _sc.activePlanSkillId    = _sc.skillId;
    _sc.activePlanSkillName  = _sc.skillName;
    _sc.activePlanStartDate  = _sc.startDate;
    _sc.activePlanDaysDone   = 0;

    const savePromise = _scSave();
    _sc.view = 'launched';
    _scRender();
    if (_sc.channel && _sc.channel !== 'none') {
        savePromise.then(() => _scApiWelcomeSend()).catch(() => {});
    }
}

function _scModal(html, wireUp) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:340px;width:100%">${html}</div>`;
    document.body.appendChild(overlay);
    wireUp(overlay, () => overlay.remove());
}

function _scShowAlreadyRunningModal() {
    const name = _sc.activePlanSkillName || _sc.skillName || 'навык';
    const done = _sc.activePlanDaysDone || 0;
    _scModal(`
        <div style="font-size:32px;text-align:center;margin-bottom:8px">✓</div>
        <div style="font-size:15px;color:var(--text-primary);margin-bottom:6px;font-weight:600;text-align:center">Этот навык уже формируется</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:18px;text-align:center;line-height:1.5">
            «${name}» — прогресс ${done}/21 дней.<br>
            Запускать заново не нужно: задания приходят в выбранный канал.
        </div>
        <div style="display:flex;gap:10px">
            <button id="arClose" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Закрыть</button>
            <button id="arPlan"  style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Открыть план</button>
        </div>
    `, (overlay, close) => {
        overlay.querySelector('#arClose').onclick = close;
        overlay.querySelector('#arPlan').onclick  = () => { close(); _sc.view = 'plan'; _scRender(); };
    });
}

function _scShowReplaceActiveModal(onReplace) {
    const name = _sc.activePlanSkillName || 'другой навык';
    const done = _sc.activePlanDaysDone || 0;
    _scModal(`
        <div style="font-size:15px;color:var(--text-primary);margin-bottom:6px;font-weight:600">Сейчас формируется другой навык</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:18px;line-height:1.5">
            «${name}» — прогресс ${done}/21 дней.<br>
            Если начнём «${_sc.skillName}», текущий прогресс будет сброшен.
        </div>
        <div style="display:flex;gap:10px;flex-direction:column">
            <button id="rpReplace" style="padding:12px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Сбросить и начать новый</button>
            <button id="rpKeep"    style="padding:12px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Открыть текущий</button>
            <button id="rpCancel"  style="padding:9px;border-radius:30px;background:transparent;border:none;color:var(--text-secondary);font-family:inherit;font-size:12px;cursor:pointer">Отмена</button>
        </div>
    `, (overlay, close) => {
        overlay.querySelector('#rpReplace').onclick = () => {
            close();
            // Сбрасываем активный план на бэке/локально, затем запускаем новый.
            try { _scApiDelete(); } catch {}
            try { localStorage.removeItem('sc_plan_'+_scUid()); } catch {}
            // Имя/описание нового навыка уже в _sc.skillId/skillName — пришли из карточки.
            _sc.daysDone = [];
            _sc.plan = null;
            _sc.startDate = null;
            onReplace();
        };
        overlay.querySelector('#rpKeep').onclick = () => {
            close();
            // Возвращаем _sc к активному навыку и открываем план.
            const sk = _scFindSkill(_sc.activePlanSkillId);
            if (sk) {
                _sc.skillId = sk.id; _sc.skillName = sk.name;
                _sc.skillDesc = sk.desc; _sc.skillLongDesc = sk.longDesc; _sc.skillPromise = sk.promise;
            }
            _sc.view = 'plan';
            _scRender();
        };
        overlay.querySelector('#rpCancel').onclick = close;
    });
}

// ============================================
// ОБРАБОТЧИКИ
// ============================================
function _scBindHandlers() {
    // === SELECT ===
    document.querySelectorAll('.sc-skill-card').forEach(card => {
        card.addEventListener('click', () => {
            const sk = _scFindSkill(card.dataset.id);
            if (!sk) return;
            _sc.skillId       = sk.id;
            _sc.skillName     = sk.name;
            _sc.skillDesc     = sk.desc;
            _sc.skillLongDesc = sk.longDesc;
            _sc.skillPromise  = sk.promise;
            _sc.view = 'detail';
            _scRender();
        });
    });

    document.getElementById('scCustomBtn')?.addEventListener('click', () => {
        const v = (document.getElementById('scCustomInput')?.value || '').trim();
        if (!v) { _scToast('Введите свой навык', 'error'); return; }
        _sc.skillId       = 'custom';
        _sc.skillName     = v;
        _sc.skillDesc     = 'персональный навык';
        _sc.skillLongDesc = _SC_CUSTOM_LONGDESC;
        _sc.skillPromise  = _SC_CUSTOM_PROMISE;
        _sc.view = 'detail';
        _scRender();
    });

    document.getElementById('scOpenPlan')?.addEventListener('click', () => {
        _sc.view = 'plan';
        _sc.openWeeks = null;
        _sc.expandedDay = null;
        _scRender();
    });

    // === DETAIL ===
    document.getElementById('scChooseBtn')?.addEventListener('click', async () => {
        if (!_sc.channel) _sc.channel = 'telegram';
        _sc.view = 'setup';
        _scRender();
        _scToast(`✓ Беру навык «${_sc.skillName}». Настроим тренировку.`, 'success');
        // Подтягиваем статус привязки фоном — после ответа перерендерим
        const status = await _scApiLinkStatus();
        if (status) {
            _sc.linkStatus = status;
            if (_sc.view === 'setup') _scRender();
        }
    });
    document.getElementById('scBackToList')?.addEventListener('click', () => {
        _sc.view = 'select'; _scRender();
    });

    // === SETUP ===
    document.querySelectorAll('.sc-channel-card').forEach(card => {
        card.addEventListener('click', () => {
            _sc.channel = card.dataset.channel;
            // Если план уже создан — синкаем настройки сразу.
            if (_sc.plan) { _scSave(); _scApiSettings({ channel: _sc.channel }); }
            _scRender();
        });
    });

    // Кнопка «Отправить тестовое сообщение» в активном канале
    ['telegram','max'].forEach(ch => {
        const btn = document.getElementById('scTestSend_'+ch);
        if (!btn) return;
        btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            btn.disabled = true;
            btn.textContent = '⏳ Отправляю...';
            const res = await _scApiTestSend();
            if (res.success) {
                btn.textContent = '✓ Отправлено — проверь канал';
                _scToast('✓ Тестовое сообщение отправлено', 'success');
            } else {
                btn.disabled = false;
                btn.textContent = '📨 Отправить тестовое сообщение';
                _scToast(res.error === 'plan not found'
                    ? 'Сначала создайте план — нажмите «Начать 21 день»'
                    : `Не удалось отправить: ${res.error||'ошибка'}`, 'error');
            }
        });
    });

    // Кнопка «↻ Проверить» — повторно дёргаем link-status после привязки в боте
    ['telegram','max'].forEach(ch => {
        const a = document.getElementById('scLinkRecheck_'+ch);
        if (!a) return;
        a.style.cursor = 'pointer';
        a.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            _scToast('Проверяю...', 'info');
            const status = await _scApiLinkStatus();
            if (status) {
                _sc.linkStatus = status;
                _scRender();
                if (status[ch]) _scToast(`✓ ${ch} привязан`, 'success');
                else _scToast('Пока не вижу привязки — нажми Start в боте', 'info');
            }
        });
    });
    document.querySelectorAll('.sc-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _sc.notifyTime = btn.dataset.time;
            document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (_sc.plan) { _scSave(); _scApiSettings({ notify_time: _sc.notifyTime, tz: _scTz() }); }
        });
    });
    document.querySelectorAll('.sc-mode-card').forEach(card => {
        card.addEventListener('click', () => {
            _sc.mode = card.dataset.mode;
            document.querySelectorAll('.sc-mode-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            if (_sc.plan) { _scSave(); _scApiSettings({ mode: _sc.mode }); }
        });
    });
    document.getElementById('scBackToDetail')?.addEventListener('click', () => {
        _sc.view = 'detail'; _scRender();
    });
    document.getElementById('scStartBtn')?.addEventListener('click', () => {
        if (!_sc.channel) { _scToast('Выберите канал', 'error'); return; }
        if (!_sc.skillId || !_sc.skillName) { _scToast('Выберите навык', 'error'); return; }

        // Защита от повторного запуска:
        // - тот же навык уже идёт → показываем "уже формируется", не перезапускаем;
        // - другой навык активен → спрашиваем разрешение заменить (текущий прогресс
        //   будет сброшен).
        const activeId = _sc.activePlanSkillId;
        if (activeId) {
            if (activeId === _sc.skillId) {
                _scShowAlreadyRunningModal();
                return;
            }
            _scShowReplaceActiveModal(() => _scStartProgram());
            return;
        }
        _scStartProgram();
    });

    // === LAUNCHED ===
    document.getElementById('scGoToPlan')?.addEventListener('click', () => {
        _sc.view = 'plan';
        _sc.openWeeks = null;
        _sc.expandedDay = null;
        _scRender();
    });

    // === PLAN ===
    document.getElementById('scChangeSetup')?.addEventListener('click', async () => {
        _sc.view = 'setup';
        _scRender();
        const status = await _scApiLinkStatus();
        if (status) { _sc.linkStatus = status; if (_sc.view === 'setup') _scRender(); }
    });
    document.getElementById('scMarkDone')?.addEventListener('click', () => {
        const day = _scCurrentDay();
        if (!_sc.daysDone.includes(day)) {
            _sc.daysDone.push(day);
            _scSave();
            _scApiDayDone(day);
            if (day >= 21) _scToast('🏆 Навык сформирован! 21 день пройден.', 'success');
            else _scToast(`✅ День ${day} выполнен!`, 'success');
            _scRender();
        }
    });
    document.querySelectorAll('.sc-week-head').forEach(h => {
        h.addEventListener('click', () => {
            const wi = parseInt(h.dataset.week);
            if (!_sc.openWeeks) _sc.openWeeks = [false, false, false];
            _sc.openWeeks[wi] = !_sc.openWeeks[wi];
            _scRender();
        });
    });
    document.querySelectorAll('.sc-day-row').forEach(row => {
        row.addEventListener('click', (ev) => {
            if (ev.target.closest('.sc-day-toggle-done')) return;
            const d = parseInt(row.dataset.day);
            _sc.expandedDay = (_sc.expandedDay === d) ? null : d;
            _scRender();
        });
    });
    document.querySelectorAll('.sc-day-toggle-done').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const d = parseInt(btn.dataset.day);
            const wasDone = _sc.daysDone.includes(d);
            if (wasDone) _sc.daysDone = _sc.daysDone.filter(x => x !== d);
            else         _sc.daysDone.push(d);
            _scSave();
            if (wasDone) _scApiDayUndone(d); else _scApiDayDone(d);
            _scRender();
        });
    });
    document.getElementById('scResetBtn')?.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--carbon-fiber,#1a1a1a);border:1px solid rgba(224,224,224,0.2);border-radius:22px;padding:24px;max-width:320px;width:100%">
            <div style="font-size:14px;color:var(--text-primary);margin-bottom:6px;font-weight:600">Начать новый навык?</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px">Текущий прогресс будет сброшен.</div>
            <div style="display:flex;gap:10px">
                <button id="cfNo"  style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.07);border:1px solid rgba(224,224,224,0.15);color:var(--text-secondary);font-family:inherit;cursor:pointer">Нет</button>
                <button id="cfYes" style="flex:1;padding:11px;border-radius:30px;background:rgba(224,224,224,0.18);border:1px solid rgba(224,224,224,0.3);color:var(--text-primary);font-family:inherit;font-weight:600;cursor:pointer">Да</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#cfNo').onclick  = () => overlay.remove();
        overlay.querySelector('#cfYes').onclick = () => {
            overlay.remove();
            _scApiDelete();
            _sc.skillId = _sc.skillName = _sc.skillDesc = _sc.skillLongDesc = _sc.skillPromise = _sc.plan = _sc.startDate = null;
            _sc.daysDone = [];
            _sc.openWeeks = null;
            _sc.expandedDay = null;
            _sc.view = 'select';
            try { localStorage.removeItem('sc_plan_'+_scUid()); } catch {}
            _scRender();
        };
    });
    document.getElementById('scGoTraining')?.addEventListener('click', () => {
        if (typeof showDailyTrainingScreen === 'function') {
            showDailyTrainingScreen();
        } else {
            const s = document.createElement('script');
            s.src = 'daily_training.js';
            s.onload = () => { if (typeof showDailyTrainingScreen==='function') showDailyTrainingScreen(); };
            document.head.appendChild(s);
        }
    });
}

// ============================================
// ТОЧКА ВХОДА
// ============================================
async function showSkillChoiceScreen() {
    // Сначала рендерим экран выбора (мгновенно), параллельно подтягиваем план
    // с бэка/localStorage. Если план есть — UI обновится автоматически.
    _sc.view = 'select';
    _sc.openWeeks = null;
    _sc.expandedDay = null;
    _sc.activePlanSkillId = null;
    _sc.activePlanSkillName = null;
    _sc.activePlanStartDate = null;
    _sc.activePlanDaysDone = 0;
    _scRender();
    await _scLoad();
    // Снимок активного плана: используется в scStartBtn, чтобы не дать
    // запустить тот же навык повторно или молча перезаписать другой активный.
    if (_sc.plan && _sc.skillId && _sc.startDate) {
        const ageMs = Date.now() - new Date(_sc.startDate).getTime();
        if (ageMs < 21 * 86400000) {
            _sc.activePlanSkillId    = _sc.skillId;
            _sc.activePlanSkillName  = _sc.skillName;
            _sc.activePlanStartDate  = _sc.startDate;
            _sc.activePlanDaysDone   = (_sc.daysDone || []).length;
        }
    }
    _scRender();
}

window.showSkillChoiceScreen = showSkillChoiceScreen;
console.log('✅ skill_choice.js v6.0 загружен (специализированные планы по навыкам с бэка)');
