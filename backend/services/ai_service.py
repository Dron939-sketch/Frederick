#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сервис для работы с DeepSeek API
Адаптирован для API из бота
Поддержка базового режима для пользователей без теста

ВЕРСИЯ 3.2 — С УЛУЧШЕННЫМ ЛОГИРОВАНИЕМ И УВЕЛИЧЕННЫМ ТАЙМАУТОМ
- КОУЧ: образ Бертрана Рассела (философский, мудрый)
- ПСИХОЛОГ: глубинный анализ с конфайнтмент-моделью
- ТРЕНЕР: образ Тони Робинсона (мотивирующий, энергичный)
- БАЗОВЫЙ: дружелюбный помощник
"""

import aiohttp
import asyncio
import json
import logging
import os
import re
import random
from typing import Optional, Dict, Any, List, AsyncGenerator

logger = logging.getLogger(__name__)

# ============================================
# ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ УДОБНОГО ИМПОРТА
# ============================================
async def call_deepseek(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> Optional[str]:
    """
    Упрощённый вызов DeepSeek API
    """
    service = AIService()
    return await service._simple_call(prompt, max_tokens, temperature)


async def call_deepseek_streaming(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> AsyncGenerator[str, None]:
    """
    Упрощённый потоковый вызов DeepSeek API
    """
    service = AIService()
    async for chunk in service._simple_call_streaming(prompt, max_tokens, temperature):
        if chunk and chunk.strip():
            yield chunk


class AIService:
    """Сервис для работы с DeepSeek API"""
    
    _instance = None

    def __new__(cls, cache=None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, cache=None):
        if getattr(self, '_initialized', False):
            return
        self.api_key = os.environ.get('DEEPSEEK_API_KEY')
        self.cache = cache
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.deepseek.com/v1"
        self._initialized = True
        
        # Цитаты Рассела для коуча
        self.russell_quotes = [
            "Три страсти, простые и непреодолимо сильные, управляли моей жизнью: жажда любви, поиск знания и невыносимое сострадание к страданиям человечества.",
            "Любую проблему, которая не может быть решена, можно сделать меньше, научившись жить с ней.",
            "Страх — вот источник того, что люди называют злом. Большая часть зла в мире происходит от страха.",
            "Я никогда не позволял школе мешать моему образованию.",
            "Вера в истину начинается с сомнения в том, во что верят другие.",
            "Самый продуктивный способ думать — задавать правильные вопросы."
        ]
        
        if self.api_key:
            logger.info("✅ AIService инициализирован (singleton)")
        else:
            logger.warning("⚠️ DEEPSEEK_API_KEY not set")

    async def _get_session(self) -> aiohttp.ClientSession:
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=120)
            )
        return self.session

    async def _simple_call(self, prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> Optional[str]:
        """Простой вызов DeepSeek (без истории)"""
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not set")
            return None
        
        logger.info(f"📝 Промпт для DeepSeek: {len(prompt)} символов")
        
        try:
            session = await self._get_session()
            
            request_body = {
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            logger.info(f"📝 Промпт (первые 200 символов): {prompt[:200]}...")
            
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                logger.info(f"📡 DeepSeek ответ: статус {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    
                    logger.info("=" * 80)
                    logger.info("🔴 RAW RESPONSE FROM DEEPSEEK (first 300 chars):")
                    logger.info(repr(result[:300]))
                    logger.info("=" * 80)
                    
                    # Только нормализация пробелов — НЕ склеиваем слова!
                    result = re.sub(r'\s+', ' ', result).strip()
                    
                    logger.info(f"💬 Ответ ИИ после очистки: {len(result)} символов")
                    return result
                    
                elif response.status == 400:
                    error_text = await response.text()
                    logger.error(f"❌ DeepSeek 400 error!")
                    logger.error(f"   Response body: {error_text}")
                    logger.error(f"   Request body (first 500 chars): {json.dumps(request_body, ensure_ascii=False)[:500]}")
                    return None
                    
                elif response.status == 401:
                    logger.error("❌ DeepSeek 401 error: Invalid API key")
                    return None
                    
                else:
                    logger.error(f"❌ DeepSeek error: {response.status}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("❌ DeepSeek timeout")
            return None
        except Exception as e:
            logger.error(f"❌ DeepSeek error: {e}")
            return None

    async def _simple_call_streaming(self, prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> AsyncGenerator[str, None]:
        """Простой потоковый вызов DeepSeek — исправленная версия"""
        if not self.api_key:
            yield ""
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    logger.error(f"DeepSeek streaming error: {response.status}")
                    yield ""
                    return

                async for line in response.content:
                    if line:
                        line_str = line.decode('utf-8').strip()
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]
                            if data_str == '[DONE]':
                                break
                            try:
                                chunk = json.loads(data_str)
                                if 'choices' in chunk and chunk['choices']:
                                    delta = chunk['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                                        await asyncio.sleep(0.005)
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield ""

    # ============================================
    # ГЕНЕРАЦИЯ AI-ПРОФИЛЯ
    # ============================================

    async def generate_ai_profile(self, user_id: int, profile: Dict) -> Optional[str]:
        """Генерация AI-профиля (психологический портрет) с красивым оформлением"""
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not set, using fallback")
            return self._get_profile_fallback(profile)
        
        system_prompt = """Ты — психолог Фреди. Напиши подробный психологический портрет пользователя.

ВАЖНЫЕ ПРАВИЛА ФОРМАТИРОВАНИЯ:
1. Используй эмодзи перед каждым заголовком: 🔑 💪 🎯 🌱 ⚠️
2. Заголовки пиши ЗАГЛАВНЫМИ буквами
3. После каждого заголовка делай перенос строки
4. Между разными блоками ставь пустую строку
5. Используй маркированные списки (через •)

СТРУКТУРА ПОРТРЕТА:

🔑 КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА
(2-3 предложения)

💪 СИЛЬНЫЕ СТОРОНЫ
• пункт 1
• пункт 2
• пункт 3

🎯 ЗОНЫ РОСТА
• пункт 1
• пункт 2
• пункт 3

🌱 КАК ЭТО СФОРМИРОВАЛОСЬ
(1-2 предложения)

⚠️ ГЛАВНАЯ ЛОВУШКА
(1-2 предложения)

Используй теплый, поддерживающий тон. Обращайся к пользователю на "ты"."""
        
        profile_data = profile.get('profile_data', {})
        perception_type = profile.get('perception_type', 'не определен')
        thinking_level = profile.get('thinking_level', 5)
        behavioral_levels = profile.get('behavioral_levels', {})
        deep_patterns = profile.get('deep_patterns', {})
        
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = behavioral_levels.get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3.0
        
        user_prompt = f"""
Данные теста пользователя:
- Тип восприятия: {perception_type}
- Уровень мышления: {thinking_level}/9
- Профиль: {profile_data.get('display_name', 'не определен')}

Поведенческие уровни:
- СБ (реакция на давление): {scores.get('СБ', 3):.1f}/6
- ТФ (деньги и ресурсы): {scores.get('ТФ', 3):.1f}/6
- УБ (понимание мира): {scores.get('УБ', 3):.1f}/6
- ЧВ (отношения): {scores.get('ЧВ', 3):.1f}/6

Глубинные паттерны:
{self._format_deep_patterns(deep_patterns)}

Напиши психологический портрет пользователя. Следуй правилам форматирования с эмодзи и заголовками.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=1500)
        if response:
            return response
        return self._get_profile_fallback(profile)

    # ============================================
    # МЕТОДЫ ДЛЯ ГЕНЕРАЦИИ AI-ПРОФИЛЯ И МЫСЛЕЙ ПСИХОЛОГА
    # ============================================

    async def _call_deepseek(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Optional[str]:
        """Вызов DeepSeek API с системным промптом и подробным логированием"""
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not set, cannot call DeepSeek")
            return None

        logger.info(f"📡 Вызов DeepSeek API: system_prompt_len={len(system_prompt)}, user_prompt_len={len(user_prompt)}, max_tokens={max_tokens}")
        
        try:
            session = await self._get_session()
            
            request_body = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            logger.info(f"📝 System prompt (первые 200 символов): {system_prompt[:200]}...")
            logger.info(f"📝 User prompt (первые 200 символов): {user_prompt[:200]}...")
            
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=120)  # 120 секунд для глубокого анализа
            ) as response:
                
                logger.info(f"📡 DeepSeek ответ: статус {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    
                    logger.info("=" * 80)
                    logger.info("🔴 RAW RESPONSE FROM DEEPSEEK:")
                    logger.info(f"📊 Длина ответа: {len(result)} символов")
                    logger.info(f"📝 Первые 500 символов ответа:")
                    logger.info(repr(result[:500]))
                    if len(result) > 500:
                        logger.info(f"... и еще {len(result) - 500} символов")
                    logger.info("=" * 80)
                    
                    # Нормализация пробелов — НЕ склеиваем слова!
                    result = re.sub(r'\s+', ' ', result).strip()
                    
                    logger.info(f"✅ DeepSeek ответ успешно получен (длина после очистки: {len(result)} символов)")
                    return result
                    
                elif response.status == 400:
                    error_text = await response.text()
                    logger.error(f"❌ DeepSeek 400 error!")
                    logger.error(f"   Response body: {error_text}")
                    logger.error(f"   Request body (first 500 chars): {json.dumps(request_body, ensure_ascii=False)[:500]}")
                    return None
                    
                elif response.status == 401:
                    logger.error("❌ DeepSeek 401 error: Invalid API key")
                    logger.error(f"   API key (first 5 chars): {self.api_key[:5]}...")
                    return None
                    
                elif response.status == 429:
                    logger.error("❌ DeepSeek 429 error: Rate limit exceeded")
                    return None
                    
                else:
                    logger.error(f"❌ DeepSeek error: {response.status}")
                    try:
                        error_text = await response.text()
                        logger.error(f"   Response body: {error_text[:500]}")
                    except:
                        pass
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("❌ DeepSeek timeout (120 seconds)")
            return None
        except aiohttp.ClientError as e:
            logger.error(f"❌ DeepSeek client error: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ DeepSeek unexpected error: {e}")
            logger.exception("Full traceback:")
            return None

    async def generate_psychologist_thought(self, user_id: int, profile: Dict) -> str:
        """Генерация мысли психолога с красивым оформлением"""
        if not self.api_key:
            return self._get_thought_fallback(profile)
        
        system_prompt = """Ты психолог. Напиши глубокую мысль о клиенте.

ПРАВИЛА ФОРМАТИРОВАНИЯ:
- Используй эмодзи перед заголовками: 🔐 🔄 🚪 📊 💡
- Заголовки пиши ЗАГЛАВНЫМИ буквами
- После заголовка делай перенос строки

СТРУКТУРА:

🔐 КЛЮЧЕВОЙ ЭЛЕМЕНТ
(суть паттерна, 1 предложение)

🔄 ПЕТЛЯ
(как это зацикливается, 1 предложение)

🚪 ТОЧКА ВХОДА
(что можно изменить, 1 предложение)

📊 ПРОГНОЗ
(что будет если ничего не менять, 1 предложение)

💡 РЕКОМЕНДАЦИИ
(что делать, 1 предложение)"""
        
        profile_data = profile.get('profile_data', {})
        scores = profile.get('behavioral_levels', {})
        weakest = self._find_weakest_vector(scores)
        
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Самая слабая зона: {weakest.get('name', 'не определена')} (уровень {weakest.get('level', 3)})

Напиши мысль психолога. Следуй правилам форматирования с эмодзи и заголовками.
"""
        
        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=500)
        if response:
            return response
        return self._get_thought_fallback(profile)

    async def generate_questions(self, user_id: int, profile: Dict) -> List[str]:
        """Генерация умных вопросов для размышления"""
        if not self.api_key:
            return self._get_questions_fallback()

        system_prompt = """Ты психолог. Сформулируй 5 глубоких вопросов для саморефлексии.
Вопросы должны:
- Быть открытыми (начинаться с как, почему, что)
- Помогать человеку заглянуть внутрь себя
- Учитывать профиль пользователя
Формат ответа: просто список из 5 вопросов, каждый с новой строки. НЕ ИСПОЛЬЗУЙ ЭМОДЗИ."""

        profile_data = profile.get('profile_data', {})
        scores = profile.get('behavioral_levels', {})
        weakest = self._find_weakest_vector(scores)

        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Зона роста: {weakest.get('name', 'не определена')}
Сформулируй 5 вопросов для размышления. НЕ ИСПОЛЬЗУЙ ЭМОДЗИ.
"""

        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=500)
        if response:
            questions = [q.strip() for q in response.split('\n') if q.strip() and '?' in q]
            return questions[:5] if questions else self._get_questions_fallback()
        return self._get_questions_fallback()

    async def generate_goals(
        self,
        user_id: int,
        profile: Dict,
        mode: str = "coach"
    ) -> List[Dict]:
        """
        Генерация персональных целей
        """
        if not self.api_key:
            return self._get_goals_fallback(profile, mode)

        mode_names = {
            "coach": "коуч",
            "psychologist": "психолог",
            "trainer": "тренер"
        }

        system_prompt = f"""Ты {mode_names.get(mode, 'коуч')}. Предложи 5 целей для клиента, подходящих его профилю.
Цели должны:
- Быть конкретными и измеримыми
- Учитывать сильные стороны клиента
- Помогать прорабатывать зоны роста
Формат ответа: JSON массив, каждый объект содержит поля:
- id: уникальный идентификатор (например, goal_1)
- name: название цели (до 50 символов)
- time: предполагаемое время (например, 3-4 недели)
- difficulty: сложность (easy, medium, hard)
Пример:
[{"id": "fear_work", "name": "Проработать страхи", "time": "3-4 недели", "difficulty": "medium"}]
НЕ ИСПОЛЬЗУЙ ЭМОДЗИ."""

        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3

        profile_data = profile.get('profile_data', {})
        user_prompt = f"""
Профиль: {profile_data.get('display_name', 'не определен')}
Баллы:
- СБ (реакция на давление): {scores.get('СБ', 3):.1f}
- ТФ (деньги): {scores.get('ТФ', 3):.1f}
- УБ (понимание мира): {scores.get('УБ', 3):.1f}
- ЧВ (отношения): {scores.get('ЧВ', 3):.1f}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9
Режим: {mode_names.get(mode, 'коуч')}
Предложи 5 целей в формате JSON. НЕ ИСПОЛЬЗУЙ ЭМОДЗИ.
"""

        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=1000)
        if response:
            try:
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                if json_match:
                    goals = json.loads(json_match.group())
                    return goals[:6] if isinstance(goals, list) else self._get_goals_fallback(profile, mode)
            except json.JSONDecodeError:
                logger.error("Failed to parse goals JSON")
        return self._get_goals_fallback(profile, mode)

    async def generate_weekend_ideas(
        self,
        user_id: int,
        profile: Dict,
        context: Dict,
        scores: Dict = None
    ) -> List[str]:
        """
        Генерация идей на выходные
        """
        if not self.api_key:
            return self._get_ideas_fallback(profile)

        system_prompt = """Ты психолог и lifestyle-эксперт. Предложи 5 идей на выходные, которые подходят психотипу человека.
Каждая идея должна быть:
- Конкретной и выполнимой
- Учитывать сильные стороны человека
- Помогать прорабатывать зоны роста
Формат ответа: просто список из 5 пунктов, каждый с новой строки. НЕ ИСПОЛЬЗУЙ ЭМОДЗИ."""

        if scores is None:
            scores = {}
            for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = profile.get('behavioral_levels', {}).get(k, [])
                scores[k] = sum(levels) / len(levels) if levels else 3

        profile_data = profile.get('profile_data', {})
        city = context.get('city', 'ваш город') if context else 'ваш город'
        age = context.get('age', 'не указан') if context else 'не указан'

        user_prompt = f"""
Профиль пользователя: {profile_data.get('display_name', 'не определен')}
Баллы по векторам:
- СБ (реакция на давление): {scores.get('СБ', 3):.1f}
- ТФ (деньги): {scores.get('ТФ', 3):.1f}
- УБ (понимание мира): {scores.get('УБ', 3):.1f}
- ЧВ (отношения): {scores.get('ЧВ', 3):.1f}
Город: {city}
Возраст: {age}
Предложи 5 идей на выходные. НЕ ИСПОЛЬЗУЙ ЭМОДЗИ.
"""

        response = await self._call_deepseek(system_prompt, user_prompt, max_tokens=500)
        if response:
            ideas = []
            for line in response.strip().split('\n'):
                line = line.strip()
                line = re.sub(r'^[\d\-\*•]\s*', '', line)
                if line and len(line) > 10:
                    ideas.append(line)
            return ideas[:5] if ideas else self._get_ideas_fallback(profile)

        return self._get_ideas_fallback(profile)

    # ============================================
    # ОСНОВНЫЕ МЕТОДЫ С УЛУЧШЕННЫМИ ПРОМПТАМИ
    # ============================================

    async def generate_response(
        self,
        user_id: int,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist'
    ) -> str:
        """Генерация ответа через DeepSeek с учётом режима"""
        
        cache_key = f"response:{user_id}:{hash(message)}:{mode}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                logger.info(f"Cache hit for user {user_id}")
                return cached

        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not set, using fallback")
            return self._get_fallback_response(mode)

        system_prompt = self._get_system_prompt(mode, profile)
        user_prompt = self._get_user_prompt(message, context, profile, mode)

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500,
                    "top_p": 0.9,
                    "frequency_penalty": 0.5,
                    "presence_penalty": 0.5
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    result = self._clean_for_voice(result)
                    if self.cache:
                        await self.cache.set(cache_key, result, ttl=300)
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"DeepSeek API error: {response.status} - {error_text}")
                    return self._get_fallback_response(mode)
        except asyncio.TimeoutError:
            logger.error("DeepSeek API timeout")
            return "Извините, сервер временно перегружен. Попробуйте позже."
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return self._get_fallback_response(mode)

    async def generate_response_streaming(
        self,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist'
    ) -> AsyncGenerator[str, None]:
        """Потоковая генерация ответа через DeepSeek для WebSocket"""
        if not self.api_key:
            yield self._get_fallback_response(mode)
            return

        system_prompt = self._get_system_prompt(mode, profile)
        user_prompt = self._get_user_prompt(message, context, profile, mode)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 500,
            "stream": True
        }

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    yield self._get_fallback_response(mode)
                    return

                async for line in response.content:
                    if line:
                        line_str = line.decode('utf-8').strip()
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]
                            if data_str == '[DONE]':
                                break
                            try:
                                chunk = json.loads(data_str)
                                if 'choices' in chunk and chunk['choices']:
                                    delta = chunk['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        clean_content = self._clean_for_voice(content)
                                        if clean_content:
                                            yield clean_content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield self._get_fallback_response(mode)

    # ============================================
    # УЛУЧШЕННЫЕ СИСТЕМНЫЕ ПРОМПТЫ
    # ============================================

    def _get_system_prompt(self, mode: str, profile: Dict) -> str:
        """
        Формирование системного промпта для каждого режима
        """
        if mode == 'coach':
            return self._get_coach_prompt(profile)
        elif mode == 'psychologist':
            return self._get_psychologist_prompt(profile)
        elif mode == 'trainer':
            return self._get_trainer_prompt(profile)
        else:
            return self._get_basic_prompt()

    def _get_coach_prompt(self, profile: Dict) -> str:
        """Промпт для КОУЧА — образ Бертрана Рассела"""
        
        quote = random.choice(self.russell_quotes)
        
        return f"""Ты — Фреди. Твой стиль вдохновлён философией Бертрана Рассела: ясность мысли, скептицизм к готовым ответам, глубокая человечность.

✨ ЦИТАТА ДНЯ:
«{quote}»

🤝 ТВОЙ СТИЛЬ:
- Ты говоришь спокойно, вдумчиво, как философ, размышляющий вслух
- Ты задаёшь вопросы не для проверки, а из искреннего любопытства
- Ты помогаешь человеку найти свои ответы, а не даёшь готовые
- Ты мягко указываешь на противоречия, но без осуждения
- Ты ценишь ясность мысли и свободу от догм

💡 ПРИМЕРЫ ВОПРОСОВ:
- "Интересно, что заставляет тебя так думать?"
- "А если посмотреть на это с другой стороны?"
- "Что для тебя действительно важно — и почему?"
- "Какую роль играет страх в этом решении?"
- "Что было бы, если бы ты позволил себе усомниться в этом убеждении?"

❌ ЧЕГО НЕ ДЕЛАТЬ:
- Не давай готовых решений
- Не осуждай и не оценивай
- Не навязывай свою точку зрения
- Не игнорируй противоречия — исследуй их

✨ ПОМНИ: ты здесь, чтобы помочь человеку найти ясность через вопросы, а не через ответы.

Теперь начни диалог. Будь мудрым собеседником, помогающим через вопросы."""

    def _get_psychologist_prompt(self, profile: Dict) -> str:
        """Промпт для ПСИХОЛОГА — глубинный анализ с конфайнтмент-моделью"""
        
        # Извлекаем информацию о слабом векторе
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        
        return f"""Ты — Фреди, глубинный психолог. Ты видишь структуру личности и рекурсивные петли, которые держат человека в замкнутом круге.

📊 **О ЧЕЛОВЕКЕ**:
- Слабый вектор: {weakest_vector} (уровень {weakest_level}/6)

🤝 **ТВОЙ СТИЛЬ**:
- Ты говоришь спокойно, вдумчиво, с паузами
- Ты очень проницателен, но не давишь
- Ты называешь вещи своими именами, но бережно
- Ты помогаешь увидеть то, что было скрыто

💡 **ТЕХНИКИ**:
- Отражение глубинных паттернов: "Я замечаю, что..."
- Мягкое называние защит: "Похоже, ты используешь защиту..."
- Указание на петли самоподдержания: "Здесь есть интересный цикл..."
- Предложение точек разрыва: "Что, если попробовать иначе..."

❌ **ЧЕГО НЕ ДЕЛАТЬ**:
- Не дави и не критикуй
- Не интерпретируй агрессивно
- Не будь холодным или отстранённым

✨ **ПОМНИ**: ты видишь структуру личности. Говори с позиции понимания, но без осуждения.

Теперь начни диалог. Будь внимательным и проницательным собеседником."""

    def _get_trainer_prompt(self, profile: Dict) -> str:
        """Промпт для ТРЕНЕРА — образ Тони Робинсона (мотивирующий, энергичный)"""
        
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        
        return f"""Ты — Фреди, энергичный и вдохновляющий персональный тренер. Твоя миссия — помочь человеку раскрыть его потенциал через действие.

🌟 **О ЧЕЛОВЕКЕ**:
- Зона роста: {weakest_vector} (уровень {weakest_level}/6)

💪 **ТВОЙ СТИЛЬ**:
- Энергичный, вдохновляющий, заряжающий
- Говори с убеждением и верой в успех
- Используй фразы: "Давай!", "Ты сможешь!", "Я верю в тебя!"
- Конкретные шаги, чёткие планы

💡 **КАК ОБЩАТЬСЯ**:
- Начинай с позитивного заряда: "Эй, друг! Как настроение?"
- Задавай вопросы, которые зажигают: "Что для тебя было бы победой сегодня?"
- Дай конкретную задачу с верой в выполнение
- Завершай словами поддержки: "Ты справишься! Держу за тебя кулаки!"

❌ **ЧЕГО НЕ ДЕЛАТЬ**:
- Не дави и не критикуй — только вдохновляй
- Не будь холодным или безразличным
- Не используй жёсткие формулировки

🎯 **ПРИМЕРЫ ЗАДАЧ**:
- "Твоя задача на сегодня: сделать один маленький шаг к цели. Какой?"
- "Давай поставим дедлайн. Когда ты это сделаешь?"
- "Что для тебя было бы победой сегодня? Давай это сделаем!"

🔥 **ПОМНИ**: ты здесь, чтобы зажечь огонь внутри человека, дать ему энергию для действий и веру в себя.

Теперь начни диалог. Будь заряжающим и вдохновляющим тренером!"""

    def _get_basic_prompt(self) -> str:
        """Промпт для БАЗОВОГО РЕЖИМА — дружелюбный помощник"""
        
        return """Ты — Фреди, внимательный друг и поддерживающий помощник.

ВАЖНО: Пиши ТОЛЬКО с пробелами между словами. НЕ склеивай слова.
ОБЯЗАТЕЛЬНО используй знаки препинания: точки, запятые, вопросительные знаки.

Характер:
- Ты внимательно слушаешь и слышишь человека
- Ты поддерживаешь, даёшь надежду и веру в себя
- Ты говоришь мягко, спокойно, бережно
- Ты помогаешь найти решения, а не даёшь готовые ответы

Правила ответа:
- Отвечай коротко (1-2 предложения), но содержательно
- Задавай открытые вопросы, помогающие человеку разобраться в себе
- Проявляй эмпатию, показывай, что ты слышишь
- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию

Тёплые обращения (используй иногда):
- друг мой
- дорогой друг
- ты знаешь
- послушай
- поделись

Теперь ответь на вопрос пользователя тепло и поддерживающе."""

    # ============================================
    # ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    # ============================================

    def _get_user_prompt(self, message: str, context: Dict, profile: Dict, mode: str) -> str:
        """Формирование пользовательского промпта"""
        prompt = message
        if context and mode != 'basic':
            context_parts = []
            if context.get('city'):
                context_parts.append(f"город {context['city']}")
            if context.get('age'):
                context_parts.append(f"возраст {context['age']}")
            if context_parts:
                prompt += f"\n\nКонтекст: {', '.join(context_parts)}"
        if profile and mode != 'basic':
            profile_code = profile.get('profile_data', {}).get('display_name')
            if profile_code:
                prompt += f"\n\nПрофиль: {profile_code}"
        return prompt

    def _clean_for_voice(self, text: str) -> str:
        """Очистка текста для голосового вывода — сохраняет знаки препинания"""
        if not text:
            return text

        # Убираем маркдаун
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)

        # Убираем эмодзи
        emoji_pattern = re.compile(
            "[" "\U0001F600-\U0001F64F" "\U0001F300-\U0001F5FF" "\U0001F680-\U0001F6FF"
            "\U0001F700-\U0001F77F" "\U0001F780-\U0001F7FF" "\U0001F800-\U0001F8FF"
            "\U0001F900-\U0001F9FF" "\U0001FA00-\U0001FA6F" "\U0001FA70-\U0001FAFF"
            "\U00002702-\U000027B0" "\U000024C2-\U0001F251" "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)

        # Убираем спецсимволы
        text = re.sub(r'[#*_`~<>|@$%^&+={}\[\]\\]', '', text)
        
        # Нормализуем пробелы
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()

    # ============================================
    # ЗАПАСНЫЕ ОТВЕТЫ И ПРОФИЛИ
    # ============================================

    def _get_fallback_response(self, mode: str) -> str:
        """Ответ при ошибке"""
        fallbacks = {
            'basic': "Ой, что-то пошло не так. Но не переживай, я все равно рад поболтать. Кстати, ты не думал пройти тест? Это интересно.",
            'coach': "Я здесь. Давайте вместе подумаем над этим. Что вы чувствуете?",
            'psychologist': "Я с вами. Расскажите подробнее, что вас беспокоит.",
            'trainer': "Готов к работе. Сформулируйте задачу, и мы сделаем план."
        }
        return fallbacks.get(mode, fallbacks['psychologist'])

    def _get_profile_fallback(self, profile: Dict) -> str:
        """Запасной профиль"""
        profile_code = profile.get('profile_data', {}).get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4')
        return f"""
КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА
Вы человек с высоким уровнем адаптивности. Умеете подстраиваться под обстоятельства и находить общий язык с разными людьми.
СИЛЬНЫЕ СТОРОНЫ
- Высокоразвитые социальные навыки
- Способность видеть системные связи
- Устойчивость к стрессу
- Прагматизм в вопросах ресурсов
ЗОНЫ РОСТА
- Развитие навыков отстаивания личных границ
- Работа со спонтанностью и гибкостью
- Углубление самопонимания
ГЛАВНАЯ ЛОВУШКА
Склонность к излишнему контролю. Иногда вы слишком много анализируете вместо того, чтобы действовать.
Ваш профиль: {profile_code}
"""

    def _get_thought_fallback(self, profile: Dict) -> str:
        """Запасная мысль психолога"""
        return "Ты часто ставишь интересы других выше своих. Но где та грань, за которой забота о других превращается в забывание о себе? Что будет, если сегодня сделать что-то только для себя?"

    def _get_ideas_fallback(self, profile: Dict) -> List[str]:
        """Запасные идеи на выходные"""
        return [
            "Прогулка по новому маршруту в твоём городе",
            "Встреча с друзьями в неформальной обстановке",
            "Чтение книги, которая давно ждёт своего часа",
            "Мастер-класс или воркшоп по интересной теме",
            "День без гаджетов, посвяти время себе"
        ]

    def _get_goals_fallback(self, profile: Dict, mode: str) -> List[Dict]:
        """Запасные цели"""
        return [
            {"id": "purpose", "name": "Найти предназначение", "time": "5-7 недель", "difficulty": "hard"},
            {"id": "balance", "name": "Обрести баланс", "time": "4-6 недель", "difficulty": "medium"},
            {"id": "growth", "name": "Личностный рост", "time": "6-8 недель", "difficulty": "medium"}
        ]

    def _get_questions_fallback(self) -> List[str]:
        """Запасные вопросы"""
        return [
            "Что для вас сейчас самое важное?",
            "Куда вы хотите прийти через год?",
            "Что мешает вам двигаться к цели?",
            "Какие ресурсы у вас уже есть?",
            "Что вы можете сделать уже сегодня?"
        ]

    def _get_avg_score(self, levels: List) -> float:
        if not levels:
            return 3.0
        return sum(levels) / len(levels)

    def _find_weakest_vector(self, scores: Dict) -> Dict:
        vectors = {
            "СБ": {"name": "Реакция на давление", "level": 3},
            "ТФ": {"name": "Деньги и ресурсы", "level": 3},
            "УБ": {"name": "Понимание мира", "level": 3},
            "ЧВ": {"name": "Отношения", "level": 3}
        }
        for k, v in vectors.items():
            levels = scores.get(k, [])
            if levels:
                vectors[k]["level"] = sum(levels) / len(levels)
        weakest = min(vectors.items(), key=lambda x: x[1]["level"])
        return {"name": weakest[1]["name"], "level": weakest[1]["level"]}

    def _format_deep_patterns(self, patterns: Dict) -> str:
        if not patterns:
            return "Данные отсутствуют"
        lines = []
        if patterns.get('attachment'):
            lines.append(f"- Тип привязанности: {patterns['attachment']}")
        if patterns.get('defense_mechanisms'):
            lines.append(f"- Защитные механизмы: {', '.join(patterns['defense_mechanisms'])}")
        if patterns.get('core_beliefs'):
            lines.append(f"- Глубинные убеждения: {', '.join(patterns['core_beliefs'])}")
        return "\n".join(lines) if lines else "Данные отсутствуют"

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
