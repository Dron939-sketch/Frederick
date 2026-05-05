/* skill_choice_extras.js
 *
 * Подключается ДО skill_choice.js. Кладёт в window._scExtraSkills массив
 * описаний дополнительных навыков, которые skill_choice.js при загрузке
 * мерджит в SC_SKILLS (через try-блок сразу после const SC_SKILLS).
 *
 * Формат каждого элемента:
 *   { category: 'personal' | 'professional' | 'influence',
 *     entries: [ { id, icon, name, desc, longDesc, promise, isNew? }, ... ] }
 *
 * Метаданные карточки — для каталога (экран выбора). Полный 21-дневный план
 * и 9-элементная конфайнмент-модель лежат на бэке в data/skill_plans_extra.json
 * под тем же id; фронт подтягивает их через
 *   GET /api/skill-plan/template/{id}
 *   GET /api/skill-plan/details/{id}
 */

(function () {
    if (typeof window === 'undefined') return;
    if (!Array.isArray(window._scExtraSkills)) window._scExtraSkills = [];

    window._scExtraSkills.push({
        category: 'influence',
        entries: [
            {
                id: 'calibration',
                icon: '🔍',
                name: 'Калибровка собеседника',
                isNew: true,
                desc: 'Читать невербальные сигналы и отклонения от baseline — без угадывания',
                longDesc: 'Калибровка — навык собирать чёткую модель собеседника по голосу, позе, паузам, лексике. Сначала фиксируете baseline (как человек выглядит «в нейтрале»), потом ловите отклонения и проверяете гипотезы действием. Базовая способность для переговоров, психологической работы, управления командой и близких отношений.',
                promise: 'Через 21 день вы будете считывать состояние собеседника по конкретным сенсорным фактам, а не угадывать «вроде ему не нравится» — и отличать своё эхо от его реальной реакции.'
            }
        ]
    });
})();
