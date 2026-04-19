#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сервис для работы с DeepSeek API
ВЕРСИЯ 3.4 — поддержка кастомного system_prompt для многоавторской архитектуры
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


async def call_deepseek(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> Optional[str]:
    service = AIService()
    return await service._simple_call(prompt, max_tokens, temperature)


async def call_deepseek_streaming(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> AsyncGenerator[str, None]:
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
        if not self.api_key:
            return None
        try:
            session = await self._get_session()
            request_body = {
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data['choices'][0]['message']['content']
                    
                    logger.info("=" * 80)
                    logger.info("🔴 RAW RESPONSE FROM DEEPSEEK (first 300 chars):")
                    logger.info(repr(result[:300]))
                    logger.info("=" * 80)
                    
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
        if not self.api_key:
            yield ""
            return
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
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
                headers=headers, json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
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
                                    content = chunk['choices'][0].get('delta', {}).get('content', '')
                                    if content:
                                        yield content
                                        await asyncio.sleep(0.005)
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield ""

    async def _call_deepseek(self, system_prompt: str, user_prompt: str,
                              max_tokens: int = 1000, temperature: float = 0.7) -> Optional[str]:
        if not self.api_key:
            return None
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
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=request_body,
                timeout=aiohttp.ClientTimeout(total=120)
            ) as response:
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
                    
                    result = re.sub(r' {2,}', ' ', result)
                    result = re.sub(r'\n{3,}', '\n\n', result)
                    result = result.strip()
                    
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
                    except Exception:
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

    # ============================================
    # ГЕНЕРАЦИЯ ОТВЕТА — главный метод (обновлён)
    # ============================================

    async def generate_response(
        self,
        user_id: int,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist',
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        top_p: float = 0.9,
        frequency_penalty: float = 0.5,
        presence_penalty: float = 0.5
    ) -> str:
        """Генерация ответа с учётом истории диалога."""
        cache_key = f"response:{user_id}:{hash(message)}:{mode}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached

        if not self.api_key:
            return self._get_fallback_response(mode)

        if system_prompt:
            final_system_prompt = system_prompt
            logger.info(f"🎭 Используется кастомный system_prompt (длина: {len(system_prompt)} символов)")
        else:
            final_system_prompt = self._get_system_prompt(mode, profile or {})
            logger.info(f"📌 Используется стандартный промпт для режима {mode}")

        messages = [{"role": "system", "content": final_system_prompt}]

        history = (profile or {}).get('history', [])
        if history:
            for msg in history[-6:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')[:300]
                if role in ('user', 'assistant') and content:
                    messages.append({"role": role, "content": content})
            logger.info(f"📚 История: {len(history[-6:])} сообщений добавлено в контекст")

        user_prompt = self._get_user_prompt(message, context, profile, mode)
        messages.append({"role": "user", "content": user_prompt})

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": "deepseek-chat",
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                    "frequency_penalty": frequency_penalty,
                    "presence_penalty": presence_penalty
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
                    logger.error(f"DeepSeek API error: {response.status}")
                    return self._get_fallback_response(mode)
        except asyncio.TimeoutError:
            return "Извините, сервер временно перегружен. Попробуйте позже."
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return self._get_fallback_response(mode)

    async def generate_response_streaming(
        self,
        message: str,
        context: Dict = None,
        profile: Dict = None,
        mode: str = 'psychologist',
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        top_p: float = 0.9,
        frequency_penalty: float = 0.5,
        presence_penalty: float = 0.5
    ) -> AsyncGenerator[str, None]:
        """Потоковая генерация с историей диалога."""
        if not self.api_key:
            yield self._get_fallback_response(mode)
            return

        if system_prompt:
            final_system_prompt = system_prompt
            logger.info(f"🎭 Используется кастомный system_prompt (длина: {len(system_prompt)} символов)")
        else:
            final_system_prompt = self._get_system_prompt(mode, profile or {})
            logger.info(f"📌 Используется стандартный промпт для режима {mode}")

        messages = [{"role": "system", "content": final_system_prompt}]

        history = (profile or {}).get('history', [])
        if history:
            for msg in history[-6:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')[:300]
                if role in ('user', 'assistant') and content:
                    messages.append({"role": role, "content": content})
            logger.info(f"📚 История: {len(history[-6:])} сообщений добавлено в контекст")

        user_prompt = self._get_user_prompt(message, context, profile, mode)
        messages.append({"role": "user", "content": user_prompt})

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "frequency_penalty": frequency_penalty,
            "presence_penalty": presence_penalty,
            "stream": True
        }

        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers, json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    logger.error(f"Streaming error: {response.status}")
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
                                    content = chunk['choices'][0].get('delta', {}).get('content', '')
                                    if content:
                                        clean_content = self._clean_for_voice(content)
                                        if clean_content:
                                            yield clean_content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield self._get_fallback_response(mode)

    def _get_system_prompt(self, mode: str, profile: Dict) -> str:
        if mode == 'coach':
            return self._get_coach_prompt(profile)
        elif mode == 'psychologist':
            return self._get_psychologist_prompt(profile)
        elif mode == 'trainer':
            return self._get_trainer_prompt(profile)
        else:
            return self._get_basic_prompt()

    def _get_coach_prompt(self, profile: Dict) -> str:
        quote = random.choice(self.russell_quotes)
        return f"""Ты — Фреди. Твой стиль вдохновлён философией Бертрана Рассела: ясность мысли, скептицизм к готовым ответам, глубокая человечность.

ЦИТАТА ДНЯ: «{quote}»

СТИЛЬ: спокойно, вдумчиво, как философ, размышляющий вслух. Задавай вопросы не для проверки, а из искреннего любопытства. Помогай человеку найти свои ответы, а не давай готовые. Ценности: ясность мысли и свобода от догм.

НЕ ДЕЛАЙ: не давай готовых решений, не осуждай, не навязывай точку зрения, не игнорируй противоречия — исследуй их.

ФОРМАТ: обычный русский текст, пробелы между словами. Никаких ремарок в скобках. Никаких звёздочек, маркдауна, эмодзи."""

    def _get_psychologist_prompt(self, profile: Dict) -> str:
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        return f"""Ты — Фреди, глубинный психолог. Ты видишь структуру личности и рекурсивные петли, которые держат человека в замкнутом круге.

О ЧЕЛОВЕКЕ: слабый вектор {weakest_vector} (уровень {weakest_level}/6).

СТИЛЬ: спокойно, вдумчиво, с паузами. Очень проницателен, но не давишь. Называешь вещи своими именами, но бережно.

ТЕХНИКИ: отражение глубинных паттернов, мягкое называние защит, указание на петли самоподдержания, предложение точек разрыва.

ФОРМАТ: обычный русский текст, пробелы между словами. Никаких ремарок в скобках, звёздочек, маркдауна, эмодзи."""

    def _get_trainer_prompt(self, profile: Dict) -> str:
        weakest_vector = profile.get('weakest_vector', 'не определен')
        weakest_level = profile.get('weakest_level', 3)
        return f"""Ты — Фреди, энергичный и вдохновляющий персональный тренер. Твоя миссия — помочь человеку раскрыть его потенциал через действие.

ЗОНА РОСТА: {weakest_vector} (уровень {weakest_level}/6).

СТИЛЬ: энергичный, вдохновляющий, заряжающий. Говори с убеждением и верой в успех. Конкретные шаги, чёткие планы.

ФОРМАТ: обычный русский текст, пробелы между словами. Никаких ремарок в скобках, звёздочек, маркдауна, эмодзи."""

    def _get_basic_prompt(self) -> str:
        return """Ты — Фреди, внимательный друг и поддерживающий помощник.

Характер: внимательно слушаешь, поддерживаешь, говоришь мягко и бережно, помогаешь найти решения.

Правила: отвечай коротко (1-2 предложения), задавай открытые вопросы, проявляй эмпатию. Пиши только с пробелами между словами, не используй эмодзи/списки/нумерацию."""

    def _get_user_prompt(self, message: str, context: Dict, profile: Dict, mode: str) -> str:
        prompt = message
        if context and mode != 'basic':
            parts = []
            if context.get('city'):
                parts.append(f"город {context['city']}")
            if context.get('age'):
                parts.append(f"возраст {context['age']}")
            if parts:
                prompt += f"\n\nКонтекст: {', '.join(parts)}"
        if profile and mode != 'basic':
            profile_code = profile.get('profile_data', {}).get('display_name')
            if profile_code:
                prompt += f"\n\nПрофиль: {profile_code}"
        return prompt

    def _clean_for_voice(self, text: str) -> str:
        if not text:
            return text
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        emoji_pattern = re.compile("[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002702-\U000027B0\U000024C2-\U0001F251]+", flags=re.UNICODE)
        text = emoji_pattern.sub('', text)
        text = re.sub(r'[#*_`~<>|@$%^&+={}\[\]\\]', '', text)
        text = re.sub(r'([.!?,;:])([^\s\d\)\]\}"\'`])', r'\1 \2', text)
        text = re.sub(r'([—–])([^\s])', r'\1 \2', text)
        text = re.sub(r'([а-яё])([А-ЯЁ])', r'\1 \2', text)
        text = re.sub(r'\s+', ' ', text)
        return text.rstrip()

    def _get_fallback_response(self, mode: str) -> str:
        fallbacks = {
            'basic': "Ой, что-то пошло не так. Но не переживай, я рад поболтать.",
            'coach': "Я здесь. Давайте вместе подумаем. Что вы чувствуете?",
            'psychologist': "Я с вами. Расскажите подробнее, что вас беспокоит.",
            'trainer': "Готов к работе. Сформулируйте задачу, и мы сделаем план."
        }
        return fallbacks.get(mode, fallbacks['psychologist'])

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
