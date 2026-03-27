# backend/config.py
import os

# API ключи
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY', '')
YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY', '')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')

# Режимы общения
COMMUNICATION_MODES = {
    'coach': {
        'id': 'coach',
        'name': 'КОУЧ',
        'display_name': 'КОУЧ',
        'emoji': '🔮',
        'description': 'Помогаю найти ответы внутри себя',
        'voicePrompt': 'Задай вопрос — я помогу найти решение'
    },
    'psychologist': {
        'id': 'psychologist',
        'name': 'ПСИХОЛОГ',
        'display_name': 'ПСИХОЛОГ',
        'emoji': '🧠',
        'description': 'Исследую глубинные паттерны',
        'voicePrompt': 'Расскажите, что вас беспокоит'
    },
    'trainer': {
        'id': 'trainer',
        'name': 'ТРЕНЕР',
        'display_name': 'ТРЕНЕР',
        'emoji': '⚡',
        'description': 'Даю чёткие инструменты и алгоритмы',
        'voicePrompt': 'Сформулируй задачу — получишь чёткий план'
    }
}
