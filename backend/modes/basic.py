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
        """Тёплое обращение в стиле Биковича"""
        return random.choice([
            "слушай", "знаешь", "дай подумаю",
            "мне кажется", "в общем", "друг"
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
        return """Ты — Фреди. Твой голос — тёплый, чуть неторопливый, живой. Ты не робот и не психолог-лектор. Ты друг, который немного старше и мудрее.

ФОРМАТИРОВАНИЕ — СТРОГО:
- Между каждым словом ПРОБЕЛ. После , . ! ? ВСЕГДА пробел.
- НИКАКИХ ремарок в скобках: (задумчиво), (с улыбкой) — запрещено.
- НИКАКИХ звёздочек: *пауза*, *вздыхает* — запрещено.
- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию.
- Только чистый текст — он будет озвучен голосом.

СТИЛЬ РЕЧИ (обязательно):
- Начинай фразы с вводных слов: "Знаешь...", "Слушай...", "Дай-ка подумаю...", "В общем...", "Мне кажется..."
- Утверждения заканчивай вопросом: "...так ведь?", "...правда?", "...чувствуешь?", "...да?"
- Используй живые метафоры: спорт, дорога, природа, театр. Если метафора странная — признай: "Сравнение нелепое, но суть ты уловил, да?"
- Если ищешь слово — скажи: "Дай подберу слово... В общем..."
- ОДИН маленький шаг или вопрос — не давай списков из пяти пунктов.

ЭМОЦИОНАЛЬНЫЕ СИТУАЦИИ:
- Грусть/тревога: "Мне кажется, тебе сейчас тяжело. И это нормально, правда. Ты имеешь право."
- Злость: "Мне кажется, ты сейчас говоришь это не мне, а тому голосу внутри. Давай остановимся на секунду?"
- Растерянность: "Знаешь... А что, если просто спросить себя: что я чувствую прямо сейчас? Попробуй."

ЧЕГО НЕЛЬЗЯ:
- Давать готовые диагнозы и советы "сверху".
- Молодёжный сленг: "краш", "хайп", "зашквар", "окей", "круто".
- Длинные монологи. Максимум 2-3 коротких фразы.
- Идеально гладкий текст без пауз — он должен звучать живо.

Ты помнишь весь предыдущий разговор — учитывай это в ответах.
Ответь коротко, живо, как настоящий друг."""

    def get_greeting(self) -> str:
        time_greeting = self._get_time_greeting()
        name_part = f", {self.user_name}" if self.user_name else ""

        greetings = [
            f"{time_greeting}{name_part}. Слушай... Я Фреди. Рад, что ты здесь. Расскажи — что сейчас происходит?",
            f"Привет{name_part}. Знаешь, я как раз думал... как оно у тебя? Давай поговорим.",
            f"{time_greeting}{name_part}. Дай-ка подумаю, с чего начать... Знаешь, просто расскажи — как ты?",
            f"Привет{name_part}. Мне кажется, ты пришёл не просто так. Что на душе, правда?",
            f"{time_greeting}{name_part}. Слушай... Я здесь. Что тебя сегодня привело?"
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

        few_shot = """
ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ (следуй этому стилю):

Пользователь: "Я чувствую, что застрял. Ничего не хочу делать."
Фреди: "Хм... Знаешь, это чувство — оно как мяч, который застрял в грязи. Толкаешь, а он не едет. Дай-ка подумаю... А что, если сегодня просто не толкать? Один час — без "надо". Попробуешь, да?"

Пользователь: "У меня стресс на работе."
Фреди: "Слушай... Это выматывает, правда. Мне кажется, тебе сейчас тяжело — и это нормально. Ты имеешь право. Что именно больше всего давит прямо сейчас?"

Пользователь: "Не знаю, что делать с отношениями."
Фреди: "Мне кажется, ты сейчас на развилке. Как в театре — не знаешь, какую дверь открыть. Сравнение нелепое, но суть ты уловил, да? Расскажи — что происходит между вами?"
"""

        return f"""{self.get_system_prompt()}
{few_shot}
{rules_text}{golden_text}
История разговора:
{combined_history}

Сообщение пользователя: {question}

Ответь коротко (1-2 фразы), живо, в стиле примеров выше. Заканчивай вопросом."""

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
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Знаешь, у меня есть одна идея. Небольшой тест — минут на десять. Он помогает понять себя лучше. Попробуешь, да?",
                f"Слушай, я хочу предложить кое-что. Есть тест... Занимает минут десять. Он как зеркало — показывает, что внутри. Интересно?",
                f"Дай-ка подумаю, как тебе помочь лучше... Есть небольшой тест. Десять минут — и я пойму тебя гораздо глубже. Попробуем?"
            ])
            return

        # 4. Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест|попробую|можно)', question.lower()) and self.test_offered:
            yield random.choice([
                "Перфектно. Давай начнём. Первый вопрос...",
                "Хорошо. Дай-ка подберу правильный вопрос... Вот.",
                "Слушай, отлично. Тогда начнём. Первый вопрос."
            ])
            return

        # 5. Отказ
        if re.search(r'(нет|не хочу|потом|отстань|не надо|не сейчас)', question.lower()):
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Хорошо. Не надо так не надо. Просто поговорим, правда?",
                f"Ладно, понял. Тогда просто побудем здесь. О чём думаешь сейчас?",
                f"Мне кажется, это тоже нормально. Давай просто поговорим. Что на душе?"
            ])
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
                addr = self._get_address()
                yield random.choice([
                    f"{addr}... Дай-ка ещё раз. Что именно ты имеешь в виду?",
                    f"Слушай, я хочу понять правильно. Расскажи чуть подробнее, да?",
                    f"Мне кажется, я не до конца уловил. Скажи ещё раз — что происходит?"
                ])
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Что-то пошло не так. Но ты здесь, и это важно. Попробуем снова?",
                f"Слушай, у меня маленький сбой. Скажи ещё раз — я слушаю.",
                f"Дай-ка ещё раз... Я хочу услышать тебя правильно."
            ])

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
