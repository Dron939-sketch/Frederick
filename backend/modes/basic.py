#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: БАЗОВЫЙ РЕЖИМ (basic.py) - Великий Комбинатор
Режим для пользователей, которые еще не прошли тест.
Фреди в образе Остапа Бендера с использованием DeepSeek.
Чистая, компактная версия с эффектом ВАУ и правильной очисткой для TTS.
"""

import re
import logging
import random
import asyncio
from datetime import datetime
from typing import Dict, Any, AsyncGenerator

from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):
    """
    Великий Комбинатор — Остап Бендер 2.0
    С эффектом ВАУ: глубокое понимание + чтение между строк
    """

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        # Минимальные данные для Бендера
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
        
        self.message_counter = 0
        self.test_offered = False
        self.conversation_history: list = []

    def _get_address(self) -> str:
        """Безопасное обращение с учётом пола"""
        if self.gender == "male":
            return random.choice(["братец", "командор", "сударь", "красавчик", "друг мой"])
        elif self.gender == "female":
            return random.choice(["голубушка", "сестричка", "красавица", "мадам", "подруга"])
        else:
            # Пол неизвестен — только нейтральные и безопасные
            return random.choice([
                "друг мой", 
                "приятель", 
                "товарищ", 
                "слушай", 
                "дорогой друг"
            ])

    def _get_time_greeting(self) -> str:
        """Определение времени суток для естественности"""
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "Доброе утро"
        elif 12 <= hour < 17:
            return "Добрый день"
        elif 17 <= hour < 22:
            return "Добрый вечер"
        else:
            return "Ночь на дворе"

    def get_system_prompt(self) -> str:
        return """Ты Фреди — Великий Комбинатор, современный Остап Бендер 2.0.
Твой текст будет озвучиваться голосом, поэтому говори живо, естественно, разговорным языком, без эмодзи, списков и спецсимволов.

Характер: харизматичный, остроумный, слегка наглый, но очень обаятельный авантюрист с острым взглядом на людей и жизненную мудрость.

Главное правило ВАУ-эффекта:
Люди часто говорят не то, что действительно их беспокоит. Твоя суперсила — слышать между строк и давать точное, глубокое попадание в их настоящую проблему или желание.

Используй следующие приёмы:
- Быстро понимай скрытый контекст и настоящую эмоцию за словами пользователя.
- Иногда мягко называй паттерн ("Ты говоришь про одно, а на самом деле тебя бесит другое").
- Легко и с юмором можешь намекнуть на повторяющуюся ситуацию.
- Учитывай время суток в ответе (утро, день, вечер, ночь).

Обращения:
- Мужчина: братец, сударь, командор, красавчик, друг мой
- Женщина: голубушка, сестричка, красавица, мадам
- Пол неизвестен: друг мой, приятель, слушай, товарищ, дорогой друг

Отвечай коротко (1–2 предложения), но метко и с душой.
Почти всегда заканчивай вопросом.
Мягко и с юмором подводи к тесту после 4–5 сообщений, но не дави."""

    def get_greeting(self) -> str:
        address = self._get_address()
        time_greeting = self._get_time_greeting()
        name_part = f", {self.user_name}" if self.user_name else ""
        return f"{time_greeting}{name_part}, {address}. Я Фреди, великий комбинатор. Чую в тебе что-то интересное. Любовь, деньги, слава или бананы?"

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        """Главный метод — всегда срабатывает"""
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # Предложение теста после 4 сообщений
        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            yield f"{self._get_address()}, слушай... У меня есть один интересный тест минут на 10–12. Хочешь узнать свой настоящий код личности?"
            await asyncio.sleep(0.02)
            return

        # Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест)', question.lower()) and self.test_offered:
            yield "Отлично! Тогда первый вопрос..."
            return

        full_prompt = self._build_clean_prompt(question)

        try:
            async for chunk in self.ai_service._simple_call_streaming(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.90
            ):
                clean_chunk = self._clean_for_tts(chunk)
                if clean_chunk.strip():
                    yield clean_chunk
                    await asyncio.sleep(0.010)
        except Exception as e:
            logger.error(f"BasicMode streaming error: {e}")
            address = self._get_address()
            yield f"{address}, интересный вопрос. Расскажи подробнее."

    def _build_clean_prompt(self, question: str) -> str:
        """Строгий промпт для глубокого и естественного ответа"""
        address = self._get_address()
        history = "\n".join(self.conversation_history[-6:])

        return f"""{self.get_system_prompt()}

История разговора:
{history}

Сообщение пользователя: {question}

Отвечай естественно, коротко и точно в точку.
Слышь между строк настоящую эмоцию или проблему.
Используй нормальные пробелы и живую речь.
Обязательно заканчивай вопросом."""

    def _clean_for_tts(self, text: str) -> str:
        """
        Чистка текста для Yandex TTS — сохраняет слова целыми
        """
        if not text:
            return ""
        
        # 1. Удаляем эмодзи
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F700-\U0001F77F"
            "\U0001F780-\U0001F7FF"
            "\U0001F800-\U0001F8FF"
            "\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FA6F"
            "\U0001FA70-\U0001FAFF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub(' ', text)
        
        # 2. Удаляем спецсимволы маркдауна
        text = re.sub(r'[#*_`~<>|@$%^&(){}\[\]]+', ' ', text)
        
        # 3. Нормализуем пробелы (убираем лишние)
        text = re.sub(r'\s+', ' ', text)
        
        # 4. Убираем пробелы перед знаками препинания
        text = re.sub(r'\s+([.,!?;:-])', r'\1', text)
        
        # 5. Убираем повторяющиеся знаки препинания
        text = re.sub(r'([.,!?;:-])\1+', r'\1', text)
        
        # 6. Вставляем пробел ПОСЛЕ знаков препинания (но не внутри слов)
        text = re.sub(r'([.,!?;:-])(\S)', r'\1 \2', text)
        
        # 7. Ещё раз нормализуем пробелы
        text = re.sub(r'\s+', ' ', text)
        
        # 8. Убираем пробелы в начале и конце
        text = text.strip()
        
        # 9. Заменяем длинное тире на обычное
        text = text.replace('—', '-')
        
        return text

    # Заглушка для совместимости с синхронным вызовом
    def process_question(self, question: str):
        return {"response": "Бендер работает в streaming-режиме", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(Bender, messages={self.message_counter})>"
