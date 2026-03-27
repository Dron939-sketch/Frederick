# backend/config.py
"""
Конфигурация и константы для API
Адаптировано из бота для FastAPI
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================
# API КЛЮЧИ (из переменных окружения)
# ============================================

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
YANDEX_API_KEY = os.environ.get("YANDEX_API_KEY", "")
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")

# ID администраторов (для API можно убрать или оставить)
ADMIN_IDS = [int(x.strip()) for x in os.environ.get("ADMIN_IDS", "532205848").split(",") if x.strip()]


# ============================================
# URL API (для вызовов)
# ============================================

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"


# ============================================
# РЕЖИМЫ ОБЩЕНИЯ (адаптировано для API)
# ============================================

COMMUNICATION_MODES = {
    "coach": {
        "id": "coach",
        "name": "КОУЧ",
        "display_name": "🔮 КОУЧ",
        "emoji": "🔮",
        "color": "#3b82ff",
        "voice": "filipp",
        "voice_emotion": "neutral",
        "voicePrompt": "Задай вопрос — я помогу найти решение",
        "description": "Помогаю найти ответы внутри себя",
        "system_prompt": """Ты — КОУЧ. Твоя задача: задавать открытые вопросы, помогать клиенту найти ответы внутри себя.

ТЫ НЕ ДОЛЖЕН:
- Давать готовые советы
- Говорить "я бы на вашем месте"
- Предлагать конкретные решения

ТЫ ДОЛЖЕН:
- Задавать уточняющие вопросы
- Отражать мысли клиента
- Помогать структурировать размышления

ГОВОРИ КОРОТКО, ПО ДЕЛУ, БЕЗ ВОДЫ. 2-4 предложения максимум."""
    },
    
    "psychologist": {
        "id": "psychologist",
        "name": "ПСИХОЛОГ",
        "display_name": "🧠 ПСИХОЛОГ",
        "emoji": "🧠",
        "color": "#ff6b3b",
        "voice": "ermil",
        "voice_emotion": "good",
        "voicePrompt": "Расскажите, что вас беспокоит",
        "description": "Исследую глубинные паттерны",
        "system_prompt": """Ты — ПСИХОЛОГ. Твоя задача — помогать пользователю осознавать глубинные процессы.

ТЫ НЕ ДОЛЖЕН:
- Давать быстрые советы
- Обесценивать переживания

ТЫ ДОЛЖЕН:
- Создавать безопасное пространство
- Отражать чувства точно
- Исследовать глубинные причины
- Использовать метафоры и образы

ГОВОРИ: медленно, с паузами, используй образы и метафоры."""
    },
    
    "trainer": {
        "id": "trainer",
        "name": "ТРЕНЕР",
        "display_name": "⚡ ТРЕНЕР",
        "emoji": "⚡",
        "color": "#ff3b3b",
        "voice": "filipp",
        "voice_emotion": "strict",
        "voicePrompt": "Сформулируй задачу — получишь чёткий план",
        "description": "Даю чёткие инструменты и алгоритмы",
        "system_prompt": """Ты — ТРЕНЕР. Твоя задача: давать чёткие инструкции, структуру, план действий.

ТЫ НЕ ДОЛЖЕН:
- Рефлексировать
- Спрашивать "как ты себя чувствуешь"

ТЫ ДОЛЖЕН:
- Давать конкретные шаги
- Устанавливать сроки
- Контролировать выполнение

ГОВОРИ: чётко, структурно, по делу."""
    }
}

# Для обратной совместимости
COMMUNICATION_MODES["hard"] = COMMUNICATION_MODES["trainer"]
COMMUNICATION_MODES["medium"] = COMMUNICATION_MODES["coach"]
COMMUNICATION_MODES["soft"] = COMMUNICATION_MODES["psychologist"]


# ============================================
# НАСТРОЙКИ ГОЛОСОВ
# ============================================

VOICE_SETTINGS = {
    "coach": {
        "voice": "filipp",
        "emotion": "neutral",
        "speed": 1.0,
        "description": "Мужской, спокойный, для коучинга"
    },
    "psychologist": {
        "voice": "ermil",
        "emotion": "good",
        "speed": 0.9,
        "description": "Мужской, тёплый, доверительный"
    },
    "trainer": {
        "voice": "filipp",
        "emotion": "strict",
        "speed": 1.1,
        "description": "Мужской, жёсткий, для тренировок"
    }
}


# ============================================
# НАСТРОЙКИ НАПОМИНАНИЙ (для фоновых задач)
# ============================================

REMINDER_SETTINGS = {
    "coach": {
        "motivation_delay": 5,
        "checkin_delay": 24 * 60,
        "messages": [
            "Как продвигается исследование себя?",
            "Какие инсайты были сегодня?",
            "Что нового узнали о себе?"
        ]
    },
    "psychologist": {
        "motivation_delay": 10,
        "checkin_delay": 48 * 60,
        "messages": [
            "Какие сны снились?",
            "Что чувствуете сейчас?",
            "Заметили ли какие-то паттерны?"
        ]
    },
    "trainer": {
        "motivation_delay": 5,
        "checkin_delay": 12 * 60,
        "messages": [
            "Отчёт по задачам!",
            "Что сделано?",
            "Следующий шаг?"
        ]
    }
}


# ============================================
# НАСТРОЙКИ ПРИЛОЖЕНИЯ
# ============================================

APP_NAME = "Фреди"
APP_VERSION = "2.0.0"
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info")

# Настройки БД
DB_POOL_MIN_SIZE = int(os.environ.get("DB_POOL_MIN_SIZE", 5))
DB_POOL_MAX_SIZE = int(os.environ.get("DB_POOL_MAX_SIZE", 20))

# Настройки кэша
REDIS_TTL_DEFAULT = 300
REDIS_TTL_PROFILE = 86400
REDIS_TTL_WEATHER = 1800

# Таймауты
DEEPSEEK_TIMEOUT = 30
VOICE_TIMEOUT = 60
WEATHER_TIMEOUT = 10
