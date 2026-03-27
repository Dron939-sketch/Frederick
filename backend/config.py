# backend/config.py
import os

# API ключи (берутся из переменных окружения)
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY', '')
YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')

# URL API
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

# Режимы общения
COMMUNICATION_MODES = {
    'coach': {
        'id': 'coach',
        'name': 'КОУЧ',
        'display_name': 'КОУЧ',
        'emoji': '🔮',
        'description': 'Помогаю найти ответы внутри себя',
        'voicePrompt': 'Задай вопрос — я помогу найти решение',
        'color': '#3b82ff',
        'system_prompt': 'Ты — коуч. Помогай человеку находить ответы внутри себя через открытые вопросы. Не давай готовых ответов.'
    },
    'psychologist': {
        'id': 'psychologist',
        'name': 'ПСИХОЛОГ',
        'display_name': 'ПСИХОЛОГ',
        'emoji': '🧠',
        'description': 'Исследую глубинные паттерны',
        'voicePrompt': 'Расскажите, что вас беспокоит',
        'color': '#ff6b3b',
        'system_prompt': 'Ты — психолог. Исследуй глубинные паттерны, защитные механизмы, прошлый опыт. Будь эмпатичным.'
    },
    'trainer': {
        'id': 'trainer',
        'name': 'ТРЕНЕР',
        'display_name': 'ТРЕНЕР',
        'emoji': '⚡',
        'description': 'Даю чёткие инструменты и алгоритмы',
        'voicePrompt': 'Сформулируй задачу — получишь чёткий план',
        'color': '#ff3b3b',
        'system_prompt': 'Ты — тренер. Давай четкие, конкретные инструкции, упражнения, ставь дедлайны. Структурируй ответы.'
    }
}
