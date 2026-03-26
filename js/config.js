// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    API_BASE_URL: 'https://max-bot-1-ywpz.onrender.com',
    USER_ID: 213102077,
    USER_NAME: 'Андрей',
    PROFILE_CODE: 'СБ-4_ТФ-4_УБ-4_ЧВ-4'
};

// Режимы
const MODES = {
    coach: {
        id: 'coach',
        name: 'КОУЧ',
        emoji: '🔮',
        color: '#3b82ff',
        greeting: 'Приветствую. Я твой коуч. Давай найдём ответы внутри тебя.',
        voicePrompt: 'Задай вопрос — я помогу найти решение'
    },
    psychologist: {
        id: 'psychologist',
        name: 'ПСИХОЛОГ',
        emoji: '🧠',
        color: '#ff6b3b',
        greeting: 'Здравствуйте. Я здесь, чтобы помочь разобраться в глубинных паттернах.',
        voicePrompt: 'Расскажите, что вас беспокоит'
    },
    trainer: {
        id: 'trainer',
        name: 'ТРЕНЕР',
        emoji: '⚡',
        color: '#ff3b3b',
        greeting: 'Готов к работе. Давай достигать целей вместе!',
        voicePrompt: 'Сформулируй задачу — получишь чёткий план'
    }
};

// Модули для каждого режима
const MODULES = {
    coach: [
        { id: 'goals', name: 'Цели', icon: '🎯', desc: 'Постановка и достижение' },
        { id: 'strategy', name: 'Стратегия', icon: '📊', desc: 'План действий' },
        { id: 'motivation', name: 'Мотивация', icon: '⚡', desc: 'Энергия для движения' },
        { id: 'habits', name: 'Привычки', icon: '🔄', desc: 'Формирование привычек' }
    ],
    psychologist: [
        { id: 'analysis', name: 'Анализ', icon: '🧠', desc: 'Глубинные паттерны' },
        { id: 'emotions', name: 'Эмоции', icon: '💭', desc: 'Работа с чувствами' },
        { id: 'trauma', name: 'Исцеление', icon: '🕊️', desc: 'Проработка опыта' },
        { id: 'relations', name: 'Отношения', icon: '💕', desc: 'Коммуникация' }
    ],
    trainer: [
        { id: 'workout', name: 'Тренировки', icon: '💪', desc: 'Физическая активность' },
        { id: 'discipline', name: 'Дисциплина', icon: '⏰', desc: 'Режим и порядок' },
        { id: 'results', name: 'Результаты', icon: '🏆', desc: 'Достижения' },
        { id: 'challenges', name: 'Челленджи', icon: '🔥', desc: 'Испытания' }
    ]
};

// Состояние
let currentMode = 'psychologist';
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;
let mediaRecorder = null;
let audioChunks = [];
let navigationHistory = [];
let audioContext = null;
let mediaStream = null;
let animationFrame = null;
