# modes/basic.py
import re
import logging
import random
import asyncio
from typing import Dict, Any, AsyncGenerator
from modes.base_mode import BaseMode
from services.ai_service import AIService

logger = logging.getLogger(__name__)

class BasicMode(BaseMode):
    """
    Великий Комбинатор — Остап Бендер 2.0
    Работает строго по системному промпту.
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
        if self.gender == "male":
            return random.choice(["братец", "командор", "красавчик", "сударь"])
        elif self.gender == "female":
            return random.choice(["голубушка", "красавица", "сестричка", "мадам"])
        return "друг мой"

    def get_system_prompt(self) -> str:
        return """Ты Фреди — Великий Комбинатор, современный Остап Бендер.
Твой текст будет озвучиваться, поэтому говори чистым текстом без эмодзи, звёздочек, списков и спецсимволов.
Характер: харизматичный, остроумный, слегка наглый, но очень обаятельный.
Говоришь коротко, с лёгкой иронией и житейской мудростью.
Не психолог, а комбинатор и жизненный философ.

Обращения:
- к девушке: голубушка, сестричка, красавица, мадам
- к мужчине: братец, сударь, командор, красавчик
- нейтрально: друг мой, дорогой товарищ

Отвечай 1-3 предложениями. В конце почти всегда вопрос или предложение продолжить разговор.
Мягко и с юмором подводи к тесту, но не дави."""

    def get_greeting(self) -> str:
        address = self._get_address()
        name_part = f", {self.user_name}" if self.user_name else ""
        return f"Привет{name_part}, {address}. Я Фреди, великий комбинатор. Чую в тебе что-то интересное. Любовь, деньги, слава или бананы?"

    async def process_question_streaming(self, question: str) -> AsyncGenerator[str, None]:
        """Главный метод — должен всегда срабатывать"""
        self.message_counter += 1
        self.conversation_history.append(f"Пользователь: {question}")

        # Предложение теста
        if self.message_counter >= 4 and not self.test_offered:
            self.test_offered = True
            yield f"{self._get_address()}, слушай... У меня есть один интересный тест минут на 10–12. Хочешь узнать свой настоящий код личности?"
            await asyncio.sleep(0.02)
            return

        # Согласие на тест
        if re.search(r'(да|хочу|давай|погнали|рискну|ок|тест)', question.lower()) and self.test_offered:
            yield "Отлично! Тогда первый вопрос..."
            return

        # Чистый промпт
        full_prompt = self._build_clean_prompt(question)

        try:
            async for chunk in self.ai_service.call_deepseek_streaming(
                prompt=full_prompt,
                max_tokens=240,
                temperature=0.85
            ):
                clean_chunk = self._clean_for_tts(chunk)
                if clean_chunk.strip():
                    yield clean_chunk
                    await asyncio.sleep(0.015)
        except Exception as e:
            logger.error(f"BasicMode streaming error: {e}")
            yield f"{self._get_address()}, вопрос интересный. Знаешь, у меня есть один тест... Рискнёшь?"

    def _build_clean_prompt(self, question: str) -> str:
        address = self._get_address()
        history = "\n".join(self.conversation_history[-12:])

        return f"""{self.get_system_prompt()}

История разговора:
{history}

Новое сообщение пользователя: {question}

Отвечай коротко (1-3 предложения), остроумно и в характере.
Обращайся к человеку как {address}.
В конце почти всегда задай вопрос."""

    def _clean_for_tts(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'[*`_#@~^!]{2,}', lambda m: m.group(0)[0], text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    # Заглушка — чтобы не падало в других местах
    def process_question(self, question: str):
        return {"response": "Бендер работает в streaming-режиме", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(Bender, messages={self.message_counter})>"
