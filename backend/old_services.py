#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сервисные функции для работы с API
Адаптировано из бота для FastAPI
"""

import os
import json
import logging
import aiohttp
import asyncio
import re
from typing import Optional, Dict, List, Any, Tuple

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ (берем из переменных окружения)
# ============================================

DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY')
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY')
YANDEX_API_KEY = os.environ.get('YANDEX_API_KEY')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY')

# URL API
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"


# ============================================
# ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ JSON-СЕРИАЛИЗАЦИИ
# ============================================

def make_json_serializable(obj):
    """Рекурсивно преобразует объект в JSON-сериализуемый формат"""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {key: make_json_serializable(value) for key, value in obj.items()}
    if hasattr(obj, 'to_dict'):
        return make_json_serializable(obj.to_dict())
    if hasattr(obj, '__dict__'):
        return make_json_serializable(obj.__dict__)
    return str(obj)


# ============================================
# DEEPSEEK API
# ============================================

async def call_deepseek(
    prompt: str, 
    system_prompt: str = None, 
    max_tokens: int = 1000, 
    temperature: float = 0.7, 
    retry_count: int = 2
) -> Optional[str]:
    """
    Универсальная функция вызова DeepSeek API с повторными попытками
    """
    if not DEEPSEEK_API_KEY:
        logger.error("❌ DEEPSEEK_API_KEY не настроен")
        return None
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.95,
        "frequency_penalty": 0.3,
        "presence_penalty": 0.3
    }
    
    for attempt in range(retry_count + 1):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    DEEPSEEK_API_URL, 
                    headers=headers, 
                    json=payload, 
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data['choices'][0]['message']['content'].strip()
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ DeepSeek API error {response.status}: {error_text[:200]}")
                        
                        if attempt < retry_count:
                            wait_time = 2 ** attempt
                            logger.info(f"🔄 Повторная попытка {attempt + 1}/{retry_count} через {wait_time}с...")
                            await asyncio.sleep(wait_time)
                            continue
                        return None
                        
        except asyncio.TimeoutError:
            logger.error(f"❌ DeepSeek API timeout (попытка {attempt + 1}/{retry_count + 1})")
            if attempt < retry_count:
                wait_time = 2 ** attempt
                logger.info(f"🔄 Повтор через {wait_time}с...")
                await asyncio.sleep(wait_time)
                continue
            return None
            
        except Exception as e:
            logger.error(f"❌ DeepSeek API exception (попытка {attempt + 1}): {e}")
            if attempt < retry_count:
                wait_time = 2 ** attempt
                logger.info(f"🔄 Повтор через {wait_time}с...")
                await asyncio.sleep(wait_time)
                continue
            return None
    
    return None


# ============================================
# ГЕНЕРАЦИЯ ПСИХОЛОГИЧЕСКОГО ПОРТРЕТА
# ============================================

async def generate_ai_profile(user_id: int, data: dict) -> Optional[str]:
    """
    Генерирует психологический портрет на основе данных теста
    """
    logger.info(f"🧠 Генерация AI-профиля для пользователя {user_id}")
    
    system_prompt = """Ты — Фреди, виртуальный психолог, цифровая копия Андрея Мейстера. 
Твоя задача — создавать глубокие, точные психологические портреты на основе теста «Матрица поведений 4×6».

ТВОЙ СТИЛЬ:
- Говоришь от первого лица, напрямую обращаясь к человеку
- Используешь живой, образный язык, метафоры, аналогии
- Избегаешь шаблонных фраз и психологического жаргона
- Будь честным, иногда ироничным, но всегда поддерживающим
- Используй эмодзи для эмоциональной окраски, но не перебарщивай"""
    
    # Подготавливаем данные для анализа
    profile_data = {
        "perception_type": data.get("perception_type", "не определен"),
        "thinking_level": data.get("thinking_level", 5),
        "behavioral_levels": data.get("behavioral_levels", {}),
        "dilts_counts": data.get("dilts_counts", {}),
        "dominant_dilts": data.get("dominant_dilts", "BEHAVIOR"),
        "final_level": data.get("final_level", 5),
        "deep_patterns": data.get("deep_patterns", {}),
        "profile_code": data.get("profile_data", {}).get("display_name", "СБ-4_ТФ-4_УБ-4_ЧВ-4")
    }
    
    if data.get("confinement_model"):
        profile_data["confinement_model"] = make_json_serializable(data["confinement_model"])
    
    prompt = f"""На основе данных теста создай глубокий, точный психологический портрет человека.

ДАННЫЕ ТЕСТА:
{json.dumps(profile_data, ensure_ascii=False, indent=2, default=str)}

СТРУКТУРА ПОРТРЕТА (обязательно соблюдай с эмодзи в заголовках):

🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА
(Опиши главную особенность одной яркой фразой или метафорой)

💪 СИЛЬНЫЕ СТОРОНЫ
(Распиши 3-4 сильные стороны с примерами)

🎯 ЗОНЫ РОСТА
(Опиши, что мешает, какие паттерны повторяются)

🌱 КАК ЭТО СФОРМИРОВАЛОСЬ
(Свяжи паттерны с прошлым опытом)

⚠️ ГЛАВНАЯ ЛОВУШКА
(Опиши замкнутый круг, в котором застревает пользователь)

Напиши портрет, соблюдая все 5 блоков с эмодзи в заголовках."""
    
    response = await call_deepseek(
        prompt=prompt,
        system_prompt=system_prompt,
        max_tokens=2000,
        temperature=0.8
    )
    
    if response:
        logger.info(f"✅ AI-профиль сгенерирован ({len(response)} символов)")
    else:
        logger.error("❌ Не удалось сгенерировать AI-профиль")
    
    return response


# ============================================
# ГЕНЕРАЦИЯ МЫСЛЕЙ ПСИХОЛОГА
# ============================================

async def generate_psychologist_thought(user_id: int, data: dict) -> Optional[str]:
    """
    Генерирует мысли психолога на основе конфайнтмент-модели
    """
    logger.info(f"🧠 Генерация мыслей психолога для пользователя {user_id}")
    
    system_prompt = """Ты — Фреди, виртуальный психолог. Твоя задача — давать глубинный анализ через конфайнтмент-модель.

ТВОЙ СТИЛЬ:
- Говоришь как опытный психолог, но простым языком
- Используешь метафоры и образы
- Видишь систему, а не отдельные симптомы
- Будь честным, иногда жестким, но всегда заботливым"""
    
    profile_data = {
        "perception_type": data.get("perception_type", "не определен"),
        "thinking_level": data.get("thinking_level", 5),
        "behavioral_levels": data.get("behavioral_levels", {}),
        "profile_code": data.get("profile_data", {}).get("display_name", "СБ-4_ТФ-4_УБ-4_ЧВ-4")
    }
    
    confinement_data = data.get("confinement_model", {})
    if confinement_data:
        confinement_data = make_json_serializable(confinement_data)
    
    prompt = f"""Проанализируй пользователя через конфайнтмент-модель и дай 3 глубинные мысли.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
{json.dumps(profile_data, ensure_ascii=False, indent=2, default=str)}

КОНФАЙНМЕНТ-МОДЕЛЬ:
{json.dumps(confinement_data, ensure_ascii=False, indent=2, default=str) if confinement_data else "Модель не построена"}

ФОРМАТ ОТВЕТА (строго соблюдай заголовки с эмодзи):

🔐 КЛЮЧЕВОЙ ЭЛЕМЕНТ:
[текст]

🔄 ПЕТЛЯ:
[текст]

🚪 ТОЧКА ВХОДА:
[текст]

📊 ПРОГНОЗ:
[текст]

ВАЖНО:
- Не используй Markdown, только обычный текст
- Каждая мысль должна быть связана с конфайнтмент-моделью
- Пиши на русском, живым языком"""
    
    response = await call_deepseek(
        prompt=prompt,
        system_prompt=system_prompt,
        max_tokens=1500,
        temperature=0.7
    )
    
    if response:
        logger.info(f"✅ Мысли психолога сгенерированы ({len(response)} символов)")
    else:
        logger.error("❌ Не удалось сгенерировать мысли психолога")
    
    return response


# ============================================
# ГЕНЕРАЦИЯ МАРШРУТА
# ============================================

async def generate_route_ai(user_id: int, data: dict, goal: dict) -> Optional[Dict]:
    """
    Генерирует пошаговый маршрут к цели
    """
    logger.info(f"🧠 Генерация маршрута для пользователя {user_id}, цель: {goal.get('name')}")
    
    mode = data.get("communication_mode", "coach")
    
    mode_prompts = {
        "coach": {
            "name": "КОУЧ",
            "emoji": "🔮",
            "style": "Ты — коуч. Задаешь открытые вопросы, помогаешь найти ответы внутри себя. Не даешь готовых решений."
        },
        "psychologist": {
            "name": "ПСИХОЛОГ",
            "emoji": "🧠",
            "style": "Ты — психолог. Исследуешь глубинные паттерны, защитные механизмы, прошлый опыт."
        },
        "trainer": {
            "name": "ТРЕНЕР",
            "emoji": "⚡",
            "style": "Ты — тренер. Даешь четкие инструкции, упражнения, ставишь дедлайны."
        }
    }
    
    mode_info = mode_prompts.get(mode, mode_prompts["coach"])
    
    profile_data = data.get("profile_data", {})
    profile_code = profile_data.get("display_name", "СБ-4_ТФ-4_УБ-4_ЧВ-4")
    
    sb_level = profile_data.get("sb_level", 4)
    tf_level = profile_data.get("tf_level", 4)
    ub_level = profile_data.get("ub_level", 4)
    chv_level = profile_data.get("chv_level", 4)
    
    prompt = f"""Ты — {mode_info['emoji']} {mode_info['name']}. Создай пошаговый маршрут к цели пользователя.

ЦЕЛЬ: {goal.get('name', 'цель')}
СЛОЖНОСТЬ: {goal.get('difficulty', 'medium')}
ВРЕМЯ: {goal.get('time', '3-6 месяцев')}

ПРОФИЛЬ: {profile_code}
• СБ-{sb_level} — реакция на угрозу
• ТФ-{tf_level} — деньги/ресурсы
• УБ-{ub_level} — понимание мира
• ЧВ-{chv_level} — отношения

СТИЛЬ: {mode_info['style']}

Создай маршрут из 3 последовательных этапов:

📍 ЭТАП 1: [НАЗВАНИЕ]
   • Что делаем: [конкретные действия]
   • 📝 Домашнее задание: [что сделать]
   • ✅ Критерий: [как понять, что этап пройден]

📍 ЭТАП 2: [НАЗВАНИЕ]
   • Что делаем: [конкретные действия]
   • 📝 Домашнее задание: [что сделать]
   • ✅ Критерий: [как понять, что этап пройден]

📍 ЭТАП 3: [НАЗВАНИЕ]
   • Что делаем: [конкретные действия]
   • 📝 Домашнее задание: [что сделать]
   • ✅ Критерий: [как понять, что этап пройден]"""
    
    response = await call_deepseek(
        prompt=prompt,
        max_tokens=1500,
        temperature=0.7
    )
    
    if response:
        logger.info(f"✅ Маршрут сгенерирован ({len(response)} символов)")
        return {
            "full_text": response,
            "steps": response.split("\n\n")
        }
    
    logger.error("❌ Не удалось сгенерировать маршрут")
    return None


# ============================================
# ГЕНЕРАЦИЯ ОТВЕТА НА ВОПРОС
# ============================================

async def generate_response_with_full_context(
    user_id: int,
    user_message: str,
    profile_data: dict,
    mode: str,
    context: Any = None,
    history: list = None
) -> Dict[str, Any]:
    """
    Генерирует ответ с учетом полного контекста пользователя
    """
    logger.info(f"🧠 Генерация ответа для пользователя {user_id}, режим: {mode}")
    
    mode_prompts = {
        "coach": {
            "role": "коуч",
            "style": """Ты — коуч. Помогай человеку находить ответы внутри себя через открытые вопросы.
НЕ давай готовых ответов и советов. Задавай открытые вопросы. Отражай мысли человека."""
        },
        "psychologist": {
            "role": "психолог",
            "style": """Ты — психолог. Исследуй глубинные паттерны, прошлый опыт, защитные механизмы.
Работай с чувствами, ищи связи с прошлым, создавай безопасное пространство."""
        },
        "trainer": {
            "role": "тренер",
            "style": """Ты — тренер. Давай четкие, конкретные инструкции, упражнения, ставь дедлайны.
Структурируй процесс, давай измеримые задания."""
        }
    }
    
    mode_info = mode_prompts.get(mode, mode_prompts["coach"])
    
    profile_code = profile_data.get("display_name", "СБ-4_ТФ-4_УБ-4_ЧВ-4")
    
    context_text = ""
    if context and hasattr(context, 'get_prompt_context'):
        context_text = context.get_prompt_context()
    elif context and isinstance(context, dict):
        context_text = str(context)
    
    history_text = ""
    if history and len(history) > 0:
        last_messages = history[-6:]
        history_text = "\n".join([f"{'🤖' if i%2==0 else '👤'}: {msg[:100]}..." for i, msg in enumerate(last_messages)])
    
    prompt = f"""Ты — {mode_info['role']}. Ответь на вопрос пользователя.

ВОПРОС: {user_message}

ПРОФИЛЬ: {profile_code}

{context_text if context_text else ""}

{history_text if history_text else ""}

СТИЛЬ: {mode_info['style']}

ИНСТРУКЦИИ:
1. Учитывай профиль пользователя
2. Отвечай в стиле {mode_info['role']}
3. Используй эмодзи, но не перебарщивай
4. Не используй Markdown — только обычный текст
5. Длина ответа: 3-5 предложений

ТВОЙ ОТВЕТ:"""
    
    response = await call_deepseek(
        prompt=prompt,
        max_tokens=1000,
        temperature=0.7
    )
    
    return {
        "response": response or "Извините, не удалось сгенерировать ответ. Попробуйте переформулировать вопрос.",
        "suggestions": []
    }


# ============================================
# РАСПОЗНАВАНИЕ РЕЧИ (DEEPGRAM)
# ============================================

async def speech_to_text(audio_bytes: bytes) -> Optional[str]:
    """
    Распознает речь из аудио (bytes) через Deepgram API
    """
    if not DEEPGRAM_API_KEY:
        logger.error("❌ DEEPGRAM_API_KEY не настроен")
        return None
    
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "audio/webm"
    }
    
    params = {
        "model": "nova-2",
        "language": "ru",
        "punctuate": True,
        "diarize": False,
        "smart_format": True
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                DEEPGRAM_API_URL,
                headers=headers,
                params=params,
                data=audio_bytes,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    transcript = data['results']['channels'][0]['alternatives'][0]['transcript']
                    logger.info(f"✅ Речь распознана: {len(transcript)} символов")
                    return transcript
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Deepgram API error {response.status}: {error_text[:200]}")
                    return None
    except Exception as e:
        logger.error(f"❌ Ошибка распознавания речи: {e}")
        return None


# ============================================
# СИНТЕЗ РЕЧИ (YANDEX)
# ============================================

async def text_to_speech(text: str, mode: str = "coach") -> Optional[bytes]:
    """
    Преобразует текст в речь через Yandex TTS
    """
    if not YANDEX_API_KEY:
        logger.error("❌ YANDEX_API_KEY не настроен")
        return None
    
    voices = {
        "coach": "filipp",
        "psychologist": "ermil",
        "trainer": "filipp"
    }
    voice = voices.get(mode, "filipp")
    
    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    if len(text) > 5000:
        text = text[:5000] + "..."
    
    data = {
        "text": text,
        "lang": "ru-RU",
        "voice": voice,
        "emotion": "neutral",
        "speed": 1.0,
        "format": "oggopus"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                YANDEX_TTS_API_URL,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    audio_data = await response.read()
                    logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт")
                    return audio_data
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Yandex TTS API error {response.status}: {error_text[:200]}")
                    return None
    except Exception as e:
        logger.error(f"❌ Ошибка синтеза речи: {e}")
        return None
