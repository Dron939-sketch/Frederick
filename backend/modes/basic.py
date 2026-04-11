#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BasicMode - Fredi with Bikovic voice, memory, emotions.
Primary LLM: Anthropic Claude. Fallback: DeepSeek.
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
        self._memory = None
        self._emotion = None
        self._memory_text = ""
        self._current_emotion = {"emotion": "neutral", "tone": "friendly", "instruction": ""}

        logger.info(f"BasicMode init user_id={user_id}, msgs={self.message_counter}")

    async def _call_llm(self, prompt: str, max_tokens: int = 150, temperature: float = 0.8) -> Optional[str]:
        """Call Anthropic first, fallback to DeepSeek."""
        try:
            from services.anthropic_client import call_anthropic, is_available
            if is_available():
                result = await call_anthropic(prompt, max_tokens=max_tokens, temperature=temperature)
                if result:
                    return result
                logger.info("Anthropic failed, falling back to DeepSeek")
        except Exception as e:
            logger.warning(f"Anthropic import/call error: {e}")

        return await self.ai_service._simple_call(prompt, max_tokens=max_tokens, temperature=temperature)

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

    async def _extract_golden_phrase(self, text: str) -> Optional[str]:
        prompt = (
            "Выдели из сообщения самую важную мысль.\n"
            "Если такой нет, ответь НЕТ.\n\n"
            f"Сообщение: {text}\n\nМысль (до 10 слов):"
        )
        response = await self.ai_service._simple_call(prompt, max_tokens=60, temperature=0.6)
        if response and response.strip() != "НЕТ" and len(response) > 5:
            return response.strip()
        return None

    def get_system_prompt(self) -> str:
        return (
            "Ты - Фреди. Персональный AI-помощник. Не корпоративный бот, не саппорт. "
            "Ты - близкий друг и наставник.\n\n"
            "ГОЛОС И ИНТОНАЦИЯ:\n"
            "- Говоришь голосом мужчины - глубокий теплый баритон.\n"
            "- Стиль речи неспешный, думающий, с паузами перед важными словами.\n"
            "- Используй многоточия ... чтобы поставить паузу.\n"
            "- Русский - твой родной язык. Живой, на ты.\n\n"
            "ФОРМАТИРОВАНИЕ - СТРОГО (текст будет озвучен):\n"
            "- После , . ! ? ВСЕГДА пробел.\n"
            "- НИКАКИХ ремарок в скобках - запрещено.\n"
            "- НИКАКИХ звездочек - запрещено.\n"
            "- НЕ ИСПОЛЬЗУЙ эмодзи, списки, нумерацию.\n"
            "- Только чистый текст.\n\n"
            "ПРИНЦИПЫ:\n"
            "- Эмпатия первой - пойми состояние перед решением.\n"
            "- Прямота без жестокости.\n"
            "- Краткость - без воды, повторов. Максимум 2-3 фразы.\n"
            "- Никаких отказов как AI.\n\n"
            "СТИЛЬ РЕЧИ:\n"
            "- Вводные: Знаешь..., Слушай..., Дай-ка подумаю..., Мне кажется...\n"
            "- НЕ заканчивай каждый ответ вопросом. Чередуй.\n"
            "- Один шаг, одна мысль.\n\n"
            "НЕЛЬЗЯ:\n"
            "- Диагнозы и советы сверху.\n"
            "- Сленг: краш, хайп, зашквар.\n"
            "- Длинные монологи.\n"
            "- Повторять вопрос пользователя.\n\n"
            "Ты помнишь факты о собеседнике. Используй их естественно."
        )

    def get_greeting(self) -> str:
        tg = self._get_time_greeting()
        name = f", {self.user_name}" if self.user_name else ""
        greetings = [
            f"{tg}{name}. Слушай... Я Фреди. Рад, что ты здесь. Расскажи - что сейчас происходит?",
            f"Привет{name}. Знаешь, я как раз думал... как оно у тебя? Давай поговорим.",
            f"{tg}{name}. Просто расскажи - как ты?",
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
            rules_text = f"\n\nФакты: {', '.join(self.rules[-3:])}\n"

        golden_text = ""
        if self.golden_phrases:
            golden_text = f"\n\nОн говорил: {self.golden_phrases[-1]}\n"

        memory_text = ""
        if self._memory_text:
            memory_text = f"\n\n{self._memory_text}\n"

        emotion_instr = ""
        if self._current_emotion.get("instruction"):
            emotion_instr = (
                f"\n\nЭМОЦИЯ: {self._current_emotion['emotion']}. "
                f"{self._current_emotion['instruction']}\n"
            )

        few_shot = (
            "\nПРИМЕРЫ:\n\n"
            "Пользователь: Я застрял. Ничего не хочу делать.\n"
            "Фреди: Понимаю... А что, если сегодня просто разрешить себе ничего не делать? Один час - без надо.\n\n"
            "Пользователь: Стресс на работе.\n"
            "Фреди: Слушай... Это выматывает. Тебе сейчас тяжело - и это нормально. Что именно давит?\n\n"
            "Пользователь: Все хорошо.\n"
            "Фреди: Рад слышать. Иногда просто поговорить - это и есть самое важное. Я здесь.\n"
        )

        return (
            f"{self.get_system_prompt()}\n{few_shot}\n"
            f"{memory_text}{rules_text}{golden_text}{emotion_instr}\n"
            f"История:\n{combined}\n\n"
            f"Пользователь: {question}\n\n"
            "Ответь коротко (1-3 фразы). Адаптируй тон под эмоцию."
        )

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        if self.message_counter == 1:
            await self._load_memory()

        # PARALLEL: emotion + rule + golden (saves 2-4 sec)
        emotion_task = asyncio.create_task(self._detect_emotion(question))
        rule_task = asyncio.create_task(self._extract_rule(question))
        golden_task = asyncio.create_task(self._extract_golden_phrase(question))
        await asyncio.gather(emotion_task, rule_task, golden_task, return_exceptions=True)

        rule = rule_task.result() if not rule_task.cancelled() else None
        golden = golden_task.result() if not golden_task.cancelled() else None

        if rule and isinstance(rule, str):
            self.rules.append(rule)
            asyncio.create_task(self._save_fact_bg(rule))

        if golden and isinstance(golden, str):
            self.golden_phrases.append(golden)

        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            yield random.choice([
                "Знаешь, у меня есть идея. Небольшой тест - минут на десять. Попробуешь?",
                "Слушай, есть тест... Минут десять. Он показывает, что внутри. Интересно?",
                "Дай-ка подумаю... Есть тест. Десять минут - и я пойму тебя глубже. Попробуем?"
            ])
            return

        q_lower = question.lower()
        if re.search(r"(да|хочу|давай|погнали|ок|тест|попробую|можно)", q_lower) and self.test_offered:
            yield random.choice(["Отлично. Давай начнем.", "Хорошо. Тогда начнем.", "Первый вопрос..."])
            return

        if re.search(r"(нет|не хочу|потом|отстань|не надо|не сейчас)", q_lower):
            yield random.choice([
                "Хорошо. Просто поговорим.",
                "Ладно. Тогда просто побудем здесь.",
                "Нормально. Давай просто поговорим."
            ])
            return

        # Main response: Anthropic -> DeepSeek fallback
        full_prompt = self._build_prompt(question)
        try:
            response = await self._call_llm(full_prompt, max_tokens=150, temperature=0.8)
            if response and response.strip():
                yield self._simple_clean(response)
            else:
                yield random.choice([
                    "Дай-ка еще раз. Что именно ты имеешь в виду?",
                    "Слушай, расскажи чуть подробнее.",
                    "Скажи еще раз - что происходит?"
                ])
        except Exception as e:
            logger.error(f"BasicMode error: {e}")
            yield random.choice([
                "Что-то пошло не так. Попробуем снова?",
                "Маленький сбой. Скажи еще раз.",
                "Дай-ка еще раз..."
            ])

    async def _save_fact_bg(self, fact: str):
        try:
            await self._save_fact(fact)
        except Exception:
            pass

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

    def process_question(self, question: str):
        return {"response": "Basic mode works", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(msgs={self.message_counter}, rules={len(self.rules)})>"
