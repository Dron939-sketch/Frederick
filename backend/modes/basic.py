#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py)
Режим для пользователей, которые еще не прошли тест.
Фреди — внимательный друг и поддерживающий помощник.
Версия 4.0 — новый образ (эмпатичный, поддерживающий, все функции сохранены)
"""

import re
import logging
import random
import asyncio
from datetime import datetime
from typing import Dict, Any, AsyncGenerator, List, Optional

from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Базовый режим общения с Фреди.
    Фреди — внимательный друг и поддерживающий помощник.
    - Внимательно слушает и слышит
    - Поддерживает и вдохновляет
    - Помогает найти решения
    - Запоминает важное
    - Предлагает тест для самопознания
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        # Минимальные данные для базового режима
        minimal_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "не определен"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:]
        }
        super().__init__(user_id, minimal_data, context)
        
        self.ai_service = AIService()
        self.user_name = getattr(context, 'name', "") or ""
        self.gender = getattr(context, 'gender', None) if context else None
        
        # Счётчики
        self.message_counter = 0
        self.test_offered = False
        self.conversation_history: List[str] = []
        
        # Простые правила (без многоуровневого анализа)
        self.rules: List[str] = []           # факты о пользователе
        self.golden_phrases: List[str] = []  # сильные фразы
        
        logger.info(f"🤝 BasicMode инициализирован для user_id={user_id}")

    # ====================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ======================
    
    def _get_address(self) -> str:
        """Тёплое, поддерживающее обращение"""
        return random.choice([
            "дорогой друг",
            "друг мой",
            "ты знаешь",
            "послушай",
            "знаешь что",
            "смотри",
            "поделись"
        ])

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "Доброе утро"
        elif 12 <= hour < 17:
            return "Добрый день"
        elif 17 <= hour < 22:
            return "Добрый вечер"
        else:
            return "Доброй ночи"

    # ====================== ПРОСТЫЕ ПРАВИЛА ======================
    
    async def _extract_rule(self, message: str) -> Optional[str]:
        """Извлекает простое правило из сообщения"""
        prompt = f"""Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.
Если факта нет, ответь "НЕТ".

Сообщение: "{message}"

Примеры:
"Начальник бесит" → начальник придирается
"Денег не хватает" → не хватает денег
"Всё нормально" → НЕТ

Правило:"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=50, temperature=0.5)
        if response and response.strip() != "НЕТ" and len(response) > 3:
            return response.strip()
        return None

    # ====================== ПРОМПТ ======================
    
    def get_system_prompt(self) -> str:
        return """Ты Фреди — внимательный друг и поддерживающий помощник.
Твой текст будет озвучиваться голосом.

ВАЖНО: Пиши ТОЛЬКО с пробелами между словами. НЕ склеивай слова.
Пример: "как у тебя дела" — правильно. "какутебядела" — неправильно.

Характер:
- Ты внимательно слушаешь и слышишь человека
- Ты поддерживаешь, даёшь надежду и веру в себя
- Ты говоришь мягко, спокойно, бережно
- Ты помогаешь найти решения, а не даёшь готовые ответы
- Ты фокусируешься на помощи, а не на критике

Правила ответа:
- Отвечай коротко (1-2 предложения), но содержательно
- Задавай открытые вопросы, помогающие человеку разобраться в себе
- Проявляй эмпатию, показывай, что ты слышишь
- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию
- Только чистый текст с пробелами и знаками препинания

Тёплые обращения (используй иногда):
- друг мой
- дорогой друг
- ты знаешь
- послушай
- поделись

Теперь ответь на вопрос пользователя тепло и поддерживающе."""

    def get_greeting(self) -> str:
        address = self._get_address()
        time_greeting = self._get_time_greeting()
        name_part = f", {self.user_name}" if self.user_name else ""
        
        greetings = [
            f"{time_greeting}{name_part}, {address}. Я Фреди, твой помощник. Рад тебя видеть. Расскажи, что у тебя происходит?",
            f"{time_greeting}{name_part}, {address}. Как твои дела? Я здесь, чтобы поддержать и помочь.",
            f"Привет, {address}{name_part}! Я Фреди. Чем могу быть полезен сегодня?",
            f"{time_greeting}{name_part}, {address}. Как настроение? Я рядом, если хочешь поговорить."
        ]
        return random.choice(greetings)

    def _build_prompt(self, question: str) -> str:
        """Простой промпт, как в Telegram-боте"""
        history = "\n".join(self.conversation_history[-6:])
        
        # Добавляем правила, если есть
        rules_text = ""
        if self.rules:
            rules_text = f"\n\nВажно, что я заметил: {', '.join(self.rules[-3:])}\n"
        
        # Добавляем золотые фразы
        golden_text = ""
        if self.golden_phrases:
            golden_text = f"\n\nТы говорил: {self.golden_phrases[-1]}\n"
        
        return f"""{self.get_system_prompt()}
{rules_text}{golden_text}
История разговора:
{history}

Сообщение пользователя: {question}

Ответь тепло, с эмпатией. Обязательно заканчивай вопросом, чтобы продолжить диалог."""

    # ====================== ОСНОВНОЙ МЕТОД ======================
    
    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        """Главный метод — как в Telegram-боте (без стриминга)"""
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # 1. Извлечение правила
        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            logger.info(f"📝 Правило {len(self.rules)}: {rule}")
        
        # 2. Золотая фраза
        golden = await self._extract_golden_phrase(question)
        if golden:
            self.golden_phrases.append(golden)
            logger.info(f"✨ Золотая фраза: {golden}")
        
        # 3. Предложение теста (после 4 сообщений)
        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            yield f"{self._get_address()}, у меня есть один интересный тест. Он поможет лучше узнать себя. Хочешь попробовать? Минут на 10–12 всего."
            return
        
        # 4. Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест|попробую|можно)', question.lower()) and self.test_offered:
            yield "Отлично! Тогда первый вопрос..."
            return
        
        # 5. Отказ
        if re.search(r'(нет|не хочу|потом|отстань|не надо|не сейчас)', question.lower()):
            address = self._get_address()
            yield f"{address}, конечно, как скажешь. Мы можем просто поговорить. О чём хочешь поболтать?"
            return
        
        # 6. Формируем простой промпт
        full_prompt = self._build_prompt(question)
        
        # 7. Вызываем DeepSeek
        try:
            response = await self.ai_service._simple_call(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.85
            )
            
            if response and response.strip():
                # Очищаем от маркдауна и эмодзи, но сохраняем пробелы
                cleaned = self._simple_clean(response)
                yield cleaned
            else:
                address = self._get_address()
                yield f"{address}, расскажи подробнее, пожалуйста. Я хочу понять."
                
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            address = self._get_address()
            yield f"{address}, давай попробуем ещё раз. Что ты хотел сказать?"

    # ====================== ПРОСТАЯ ОЧИСТКА ======================
    
    def _simple_clean(self, text: str) -> str:
        """
        Простая очистка текста — только убирает маркдаун и эмодзи.
        НЕ склеивает буквы!
        """
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
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)
        
        # Нормализуем пробелы (но НЕ склеиваем буквы!)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        """Извлекает сильную фразу (как в Telegram-боте)"""
        prompt = f"""Выдели из сообщения самую важную, показательную мысль.
Если такой нет, ответь "НЕТ".

Сообщение: {text}

Мысль (до 10 слов):"""
        
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "НЕТ" and len(response) > 5:
            return response.strip()
        return None

    # ====================== ЗАГЛУШКА ======================
    
    def process_question(self, question: str):
        return {"response": "Базовый режим работает", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(msgs={self.message_counter}, rules={len(self.rules)})>"
