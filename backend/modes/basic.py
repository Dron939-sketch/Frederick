#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py)
Режим для пользователей, которые еще не прошли тест.
Фреди — внимательный друг и поддерживающий помощник.
ВЕРСИЯ 4.1 — ФИКСЫ:
  - message_counter читается из user_data (не сбрасывается при каждом запросе)
  - _simple_clean добавляет пробелы после пунктуации
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
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        minimal_data = {
            "profile_data":       {},
            "perception_type":    user_data.get("perception_type", "не определен"),
            "thinking_level":     user_data.get("thinking_level", 5),
            "behavioral_levels":  user_data.get("behavioral_levels", {}),
            "deep_patterns":      {},
            "confinement_model":  None,
            "history":            user_data.get("history", [])[-15:]  # история из БД
        }
        super().__init__(user_id, minimal_data, context)

        self.ai_service  = AIService()
        self.user_name   = getattr(context, 'name', "") or ""
        self.gender      = getattr(context, 'gender', None) if context else None

        # ФИХ: счётчик берём из user_data — main.py сохраняет его в context
        # Это позволяет предлагать тест даже после переподключения
        self.message_counter = user_data.get('message_count', 0)
        self.test_offered    = self.message_counter >= 4

        # In-memory история текущей сессии
        self.conversation_history: List[str] = []

        # Простые правила и золотые фразы
        self.rules:         List[str] = []
        self.golden_phrases: List[str] = []

        logger.info(f"🤝 BasicMode инициализирован для user_id={user_id}, msgs={self.message_counter}")

    # ====================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ======================

    def _get_address(self) -> str:
        return random.choice([
            "дорогой друг", "друг мой", "ты знаешь",
            "послушай", "знаешь что", "смотри", "поделись"
        ])

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12:   return "Доброе утро"
        elif 12 <= hour < 17: return "Добрый день"
        elif 17 <= hour < 22: return "Добрый вечер"
        else:                  return "Доброй ночи"

    # ====================== ПРАВИЛА ======================

    async def _extract_rule(self, message: str) -> Optional[str]:
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
После каждой запятой, точки, !, ? ОБЯЗАТЕЛЬНО ставь пробел.
Пример: "как у тебя дела" — правильно. "какутебядела" — неправильно.

Характер:
- Ты внимательно слушаешь и слышишь человека
- Ты поддерживаешь, даёшь надежду и веру в себя
- Ты говоришь мягко, спокойно, бережно
- Ты помогаешь найти решения, а не даёшь готовые ответы

Правила ответа:
- Отвечай коротко (1-2 предложения), но содержательно
- Задавай открытые вопросы, помогающие разобраться в себе
- Проявляй эмпатию, показывай, что ты слышишь
- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию
- Только чистый текст с пробелами и знаками препинания

Тёплые обращения (используй иногда):
- друг мой
- дорогой друг
- ты знаешь
- послушай
- поделись

Ты помнишь весь предыдущий разговор — учитывай это в ответах.
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
        # История из БД (через self.history) + текущая сессия
        history_from_db = "\n".join(
            f"{'Пользователь' if m.get('role') == 'user' else 'Фреди'}: {m.get('content', '')[:100]}"
            for m in self.history[-6:]
        ) if self.history else ""

        session_history = "\n".join(self.conversation_history[-4:])
        combined_history = (history_from_db + "\n" + session_history).strip()

        rules_text = f"\n\nВажно, что я заметил: {', '.join(self.rules[-3:])}\n" if self.rules else ""
        golden_text = f"\n\nТы говорил: {self.golden_phrases[-1]}\n" if self.golden_phrases else ""

        return f"""{self.get_system_prompt()}
{rules_text}{golden_text}
История разговора:
{combined_history}

Сообщение пользователя: {question}

Ответь тепло, с эмпатией. Обязательно заканчивай вопросом, чтобы продолжить диалог."""

    # ====================== ОСНОВНОЙ МЕТОД ======================

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
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

        # 3. Предложение теста (после 4 сообщений)
        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            yield f"{self._get_address()}, у меня есть один интересный тест. Он поможет лучше узнать себя. Хочешь попробовать? Минут на 10 всего."
            return

        # 4. Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест|попробую|можно)', question.lower()) and self.test_offered:
            yield "Отлично! Тогда первый вопрос..."
            return

        # 5. Отказ
        if re.search(r'(нет|не хочу|потом|отстань|не надо|не сейчас)', question.lower()):
            yield f"{self._get_address()}, конечно, как скажешь. Мы можем просто поговорить. О чём хочешь поболтать?"
            return

        # 6. Формируем промпт и вызываем AI
        full_prompt = self._build_prompt(question)

        try:
            response = await self.ai_service._simple_call(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.85
            )
            if response and response.strip():
                yield self._simple_clean(response)
            else:
                yield f"{self._get_address()}, расскажи подробнее, пожалуйста. Я хочу понять."
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            yield f"{self._get_address()}, давай попробуем ещё раз. Что ты хотел сказать?"

    # ====================== ОЧИСТКА ======================

    def _simple_clean(self, text: str) -> str:
        """Очистка текста — убирает маркдаун, эмодзи, добавляет пробелы."""
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
            "[" "\U0001F600-\U0001F64F" "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF" "\U0001F900-\U0001F9FF" "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text)

        # ФИХ: пробел после знаков препинания (DeepSeek склеивает слова)
        text = re.sub(r'([.!?,;:])([^\s\d\)\]\}])', r'\1 \2', text)
        text = re.sub(r'([—–])([^\s])', r'\1 \2', text)
        text = re.sub(r'([а-яё])([А-ЯЁ])', r'\1 \2', text)

        # Нормализуем пробелы (НЕ склеиваем буквы!)
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
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
