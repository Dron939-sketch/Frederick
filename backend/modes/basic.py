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

Отвечай максимум 2 коротких предложения.
В конце почти всегда вопрос или предложение продолжить разговор.
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

        full_prompt = self._build_clean_prompt(question)

        try:
            async for chunk in self.ai_service._simple_call_streaming(
                prompt=full_prompt,
                max_tokens=130,
                temperature=0.92
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
        """Очень строгий промпт специально для чистого голосового вывода"""
        address = self._get_address()
        history = "\n".join(self.conversation_history[-5:])

        return f"""{self.get_system_prompt()}

История разговора:
{history}

Сообщение пользователя: {question}

Правила для ответа:
- Максимум 2 коротких предложения.
- Говори живо, с иронией, как Остап Бендер.
- Используй нормальные пробелы после запятых, тире и точек.
- Обязательно закончи вопросом.
- Реагируй сразу на смысл сказанного.
- Никаких длинных фраз и философии."""

    def _clean_for_tts(self, text: str) -> str:
        """Максимально агрессивная очистка для TTS"""
        if not text:
            return ""

        # Принудительно вставляем пробел после всех знаков препинания
        text = re.sub(r'([.,!?;:-—])(\S)', r'\1 \2', text)
        text = re.sub(r'([.,!?;:-—])\s*', r'\1 ', text)

        # Убираем повторяющиеся символы и тире
        text = re.sub(r'([*`_#@~^!]){2,}', ' ', text)
        text = re.sub(r'—\s*—', ' — ', text)
        text = re.sub(r'-\s*-', ' - ', text)

        # Финальная нормализация
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    # Заглушка для совместимости
    def process_question(self, question: str):
        return {"response": "Бендер работает в streaming-режиме", "tools_used": []}

    def __repr__(self):
        return f"<BasicMode(Bender, messages={self.message_counter})>"
