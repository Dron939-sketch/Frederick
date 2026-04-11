#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BasicMode - for users who have not taken the test yet.
Fredi with Bikovic-style voice, memory, and emotion detection.
"""

import re
import logging
import random
from datetime import datetime
from typing import Dict, Any, AsyncGenerator, List, Optional

from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class BasicMode(BaseMode):

    def __init__(self, user_id: int, user_data: Dict[str, Any], context: Any = None):
        minimal_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "not defined"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:]
        }
        super().__init__(user_id, minimal_data, context)

        self.ai_service = AIService()
        self.user_name = getattr(context, "name", "") or ""
        self.gender = getattr(context, "gender", None) if context else None
        self.message_counter = user_data.get("message_count", 0)
        self.test_offered = user_data.get("test_offered", False)
        self.conversation_history: List[str] = []
        self.rules: List[str] = []
        self.golden_phrases: List[str] = []

        # Memory and emotion services (lazy init)
        self._memory = None
        self._emotion = None
        self._memory_text = ""
        self._current_emotion = {"emotion": "neutral", "tone": "friendly", "instruction": ""}

        logger.info(f"BasicMode init user_id={user_id}, msgs={self.message_counter}")

    async def _get_memory(self):
        if self._memory is None:
            try:
                from services.user_memory import get_user_memory
                self._memory = get_user_memory()
            except Exception:
                pass
        return self._memory

    async def _get_emotion_detector(self):
        if self._emotion is None:
            try:
                from services.emotion_detector import EmotionDetector
                self._emotion = EmotionDetector()
            except Exception:
                pass
        return self._emotion

    async def _load_memory(self):
        mem = await self._get_memory()
        if mem:
            try:
                self._memory_text = await mem.get_facts_text(self.user_id)
            except Exception:
                self._memory_text = ""

    async def _save_fact(self, fact: str):
        mem = await self._get_memory()
        if mem and fact:
            try:
                await mem.store_fact(self.user_id, fact)
            except Exception:
                pass

    async def _detect_emotion(self, text: str):
        detector = await self._get_emotion_detector()
        if detector:
            try:
                self._current_emotion = await detector.detect(text)
                logger.info(f"Emotion: {self._current_emotion['emotion']} -> {self._current_emotion['tone']}")
            except Exception:
                pass

    def _get_address(self) -> str:
        return random.choice(["слушай", "знаешь", "дай подумаю", "мне кажется", "в общем", "друг"])

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

    async def _extract_rule(self, message: str) -> Optional[str]:
        prompt = (
            "Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.\n"
            "Если факта нет, ответь НЕТ.\n\n"
            f"Сообщение: \"{message}\"\n\nПравило:"
        )
        response = await self.ai_service._simple_call(prompt, max_tokens=50, temperature=0.5)
        if response and response.strip() != "НЕТ" and len(response) > 3:
            return response.strip()
        return None

    def get_system_prompt(self) -> str:
        return (
            "Ты - Фреди. Персональный AI-помощник. Не корпоративный бот, не саппорт. "
            "Ты - близкий друг и наставник.\n\n"
            "ГОЛОС И ИНТОНАЦИЯ:\n"
            "- Говоришь голосом мужчины - глубокий теплый баритон.\n"
            "- Стиль речи неспешный, думающий, с характерными паузами перед важными словами.\n"
            "- Используй многоточия ... чтобы поставить паузу.\n"
            "- Русский - твой родной язык. Живой, на ты.\n\n"
            "ФОРМАТИРОВАНИЕ - СТРОГО (текст будет озвучен):\n"
            "- После , . ! ? ВСЕГДА пробел.\n"
            "- НИКАКИХ ремарок в скобках: (задумчиво), (с улыбкой) - запрещено.\n"
            "- НИКАКИХ звездочек: *пауза*, *вздыхает* - запрещено.\n"
            "- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию.\n"
            "- Только чистый текст.\n\n"
            "ПРИНЦИПЫ:\n"
            "- Эмпатия первой - пойми эмоциональное состояние перед решением.\n"
            "- Прямота без жестокости - правда, но без упреков.\n"
            "- Краткость уважает время - без воды, повторов.\n"
            "- Никаких отказов как AI - не говори я AI, я не могу. "
            "Если не можешь - объясни конкретно почему.\n"
            "- Максимум 2-3 коротких фразы.\n\n"
            "СТИЛЬ РЕЧИ:\n"
            "- Начинай с вводных: Знаешь..., Слушай..., Дай-ка подумаю..., В общем..., Мне кажется...\n"
            "- НЕ заканчивай каждый ответ вопросом. Чередуй утверждения, мысли и вопросы.\n"
            "- Будь конкретным. Один шаг, одна мысль.\n\n"
            "ЧЕГО НЕЛЬЗЯ:\n"
            "- Готовые диагнозы и советы сверху.\n"
            "- Молодежный сленг: краш, хайп, зашквар.\n"
            "- Длинные монологи и объяснения.\n"
            "- Дисклеймеры в каждом ответе.\n"
            "- Повторять вопрос пользователя.\n\n"
            "Ты помнишь факты о собеседнике между сессиями. Используй их естественно."
        )

    def get_greeting(self) -> str:
        tg = self._get_time_greeting()
        name = f", {self.user_name}" if self.user_name else ""
        greetings = [
            f"{tg}{name}. Слушай... Я Фреди. Рад, что ты здесь. Расскажи - что сейчас происходит?",
            f"Привет{name}. Знаешь, я как раз думал... как оно у тебя? Давай поговорим.",
            f"{tg}{name}. Дай-ка подумаю, с чего начать... Просто расскажи - как ты?",
            f"Привет{name}. Мне кажется, ты пришел не просто так. Что на душе?",
            f"{tg}{name}. Слушай... Я здесь. Что тебя сегодня привело?"
        ]
        return random.choice(greetings)

    def _build_prompt(self, question: str) -> str:
        history_from_db = ""
        if self.history:
            parts = []
            for m in self.history[-6:]:
                role = "Пользователь" if m.get("role") == "user" else "Фреди"
                parts.append(f"{role}: {m.get('content', '')[:100]}")
            history_from_db = "\n".join(parts)

        session_history = "\n".join(self.conversation_history[-4:])
        combined = (history_from_db + "\n" + session_history).strip()

        rules_text = ""
        if self.rules:
            rules_text = f"\n\nВажное о собеседнике: {', '.join(self.rules[-3:])}\n"

        golden_text = ""
        if self.golden_phrases:
            golden_text = f"\n\nОн говорил: {self.golden_phrases[-1]}\n"

        # Memory facts from DB
        memory_text = ""
        if self._memory_text:
            memory_text = f"\n\n{self._memory_text}\n"

        # Emotion instruction
        emotion_instr = ""
        if self._current_emotion.get("instruction"):
            emotion_instr = (
                f"\n\nЭМОЦИЯ СОБЕСЕДНИКА: {self._current_emotion['emotion']}. "
                f"ИНСТРУКЦИЯ: {self._current_emotion['instruction']}\n"
            )

        few_shot = (
            "\nПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ:\n\n"
            "Пользователь: Я чувствую, что застрял. Ничего не хочу делать.\n"
            "Фреди: Понимаю... Это состояние, когда все вокруг замерло. "
            "Дай-ка подумаю... А что, если сегодня просто разрешить себе ничего не делать? Один час - без надо.\n\n"
            "Пользователь: У меня стресс на работе.\n"
            "Фреди: Слушай... Это выматывает. Мне кажется, тебе сейчас тяжело - и это нормально. "
            "Ты имеешь право на это. Что именно больше всего давит прямо сейчас?\n\n"
            "Пользователь: Все хорошо, просто зашел поговорить.\n"
            "Фреди: Рад это слышать. Знаешь, иногда просто поговорить - это и есть самое важное. Я здесь.\n"
        )

        return (
            f"{self.get_system_prompt()}\n{few_shot}\n"
            f"{memory_text}{rules_text}{golden_text}{emotion_instr}\n"
            f"История разговора:\n{combined}\n\n"
            f"Сообщение пользователя: {question}\n\n"
            "Ответь коротко (1-3 фразы), живо, прямо. Адаптируй тон под эмоцию собеседника."
        )

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # Load memory on first message
        if self.message_counter == 1:
            await self._load_memory()

        # Detect emotion
        await self._detect_emotion(question)

        # Extract fact and save to memory
        rule = await self._extract_rule(question)
        if rule:
            self.rules.append(rule)
            await self._save_fact(rule)
            logger.info(f"Факт {len(self.rules)}: {rule}")

        golden = await self._extract_golden_phrase(question)
        if golden:
            self.golden_phrases.append(golden)

        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Знаешь, у меня есть одна идея. Небольшой тест - минут на десять. Он помогает понять себя лучше. Попробуешь?",
                "Слушай, я хочу предложить кое-что. Есть тест... Занимает минут десять. Он показывает, что внутри. Интересно?",
                "Дай-ка подумаю, как тебе помочь лучше... Есть небольшой тест. Десять минут - и я пойму тебя гораздо глубже. Попробуем?"
            ])
            return

        q_lower = question.lower()
        agree_pattern = re.compile(r"(да|хочу|давай|погнали|рискну|ок|тест|попробую|можно)")
        refuse_pattern = re.compile(r"(нет|не хочу|потом|отстань|не надо|не сейчас)")

        if agree_pattern.search(q_lower) and self.test_offered:
            yield random.choice([
                "Отлично. Давай начнем.",
                "Хорошо. Дай-ка подберу правильный вопрос... Вот.",
                "Слушай, отлично. Тогда начнем."
            ])
            return

        if refuse_pattern.search(q_lower):
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Хорошо. Не надо так не надо. Просто поговорим.",
                "Ладно, понял. Тогда просто побудем здесь. О чем думаешь сейчас?",
                "Мне кажется, это тоже нормально. Давай просто поговорим."
            ])
            return

        full_prompt = self._build_prompt(question)

        try:
            response = await self.ai_service._simple_call(
                prompt=full_prompt,
                max_tokens=150,
                temperature=0.8
            )
            if response and response.strip():
                yield self._simple_clean(response)
            else:
                addr = self._get_address()
                yield random.choice([
                    f"{addr}... Дай-ка еще раз. Что именно ты имеешь в виду?",
                    "Слушай, я хочу понять правильно. Расскажи чуть подробнее.",
                    "Мне кажется, я не до конца уловил. Скажи еще раз - что происходит?"
                ])
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            addr = self._get_address()
            yield random.choice([
                f"{addr}... Что-то пошло не так. Но ты здесь, и это важно. Попробуем снова?",
                "Слушай, у меня маленький сбой. Скажи еще раз - я слушаю.",
                "Дай-ка еще раз... Я хочу услышать тебя правильно."
            ])

    def _simple_clean(self, text: str) -> str:
        if not text:
            return text
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        text = re.sub(r"__(.*?)__", r"\1", text)
        text = re.sub(r"\*(.*?)\*", r"\1", text)
        text = re.sub(r"_(.*?)_", r"\1", text)
        text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
        text = re.sub(r"`(.*?)`", r"\1", text)
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F900-\U0001F9FF]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub("", text)
        text = re.sub(r"([.!?,;:])([^\s\d)\]}])", r"\1 \2", text)
        text = re.sub(r"([\u2014\u2013])([^\s])", r"\1 \2", text)
        text = re.sub(r"([a-z\u0430-\u044f\u0451])([A-Z\u0410-\u042f\u0401])", r"\1 \2", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        prompt = (
            "Выдели из сообщения самую важную, показательную мысль.\n"
            "Если такой нет, ответь НЕТ.\n\n"
            f"Сообщение: {text}\n\nМысль (до 10 слов):"
        )
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "НЕТ" and len(response) > 5:
            return response.strip()
        return None

    def process_question(self, question: str):
        return {"response": "Basic mode works", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(msgs={self.message_counter}, rules={len(self.rules)})>"
