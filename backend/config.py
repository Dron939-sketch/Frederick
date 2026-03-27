# backend/config.py
import os

# API ключи (берутся из переменных окружения)
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
        'voicePrompt': 'Задай вопрос — я помогу найти решение',
        'color': '#3b82ff'
    },
    'psychologist': {
        'id': 'psychologist',
        'name': 'ПСИХОЛОГ',
        'display_name': 'ПСИХОЛОГ',
        'emoji': '🧠',
        'description': 'Исследую глубинные паттерны',
        'voicePrompt': 'Расскажите, что вас беспокоит',
        'color': '#ff6b3b'
    },
    'trainer': {
        'id': 'trainer',
        'name': 'ТРЕНЕР',
        'display_name': 'ТРЕНЕР',
        'emoji': '⚡',
        'description': 'Даю чёткие инструменты и алгоритмы',
        'voicePrompt': 'Сформулируй задачу — получишь чёткий план',
        'color': '#ff3b3b'
    }
}

# Настройки приложения
APP_NAME = "Фреди"
APP_VERSION = "2.0.0"
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'info')

# Настройки БД
DB_POOL_MIN_SIZE = int(os.environ.get('DB_POOL_MIN_SIZE', 5))
DB_POOL_MAX_SIZE = int(os.environ.get('DB_POOL_MAX_SIZE', 20))

# Настройки кэша
REDIS_TTL_DEFAULT = 300  # 5 минут
REDIS_TTL_PROFILE = 86400  # 24 часа
REDIS_TTL_WEATHER = 1800  # 30 минут

# Таймауты
DEEPSEEK_TIMEOUT = 30
VOICE_TIMEOUT = 60
WEATHER_TIMEOUT = 10

# Администраторы (из переменных окружения)
ADMIN_IDS = [int(x.strip()) for x in os.environ.get('ADMIN_IDS', '').split(',') if x.strip()]
