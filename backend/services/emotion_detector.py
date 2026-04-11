"""
emotion_detector.py - Lightweight emotion detection for BasicMode.
Detects user emotion from text using DeepSeek (no external API).
Returns emotion label + suggested tone for response.
"""

import logging
from typing import Dict, Optional
from services.ai_service import AIService

logger = logging.getLogger(__name__)

# Emotion -> response tone mapping
EMOTION_TONES = {
    "sadness": "gentle",
    "anger": "calm",
    "anxiety": "grounding",
    "joy": "warm",
    "confusion": "clear",
    "neutral": "friendly",
    "frustration": "patient",
    "loneliness": "warm",
    "fear": "reassuring",
    "guilt": "accepting",
}

# Tone -> prompt instruction
TONE_INSTRUCTIONS = {
    "gentle": "Будь особенно мягким и принимающим. Не давай советов сразу - сначала прими чувства.",
    "calm": "Будь спокойным и устойчивым. Не спорь. Дай выговориться, потом помоги увидеть суть.",
    "grounding": "Помоги вернуться в настоящий момент. Упрости. Дай один конкретный шаг.",
    "warm": "Раздели радость. Будь искренне рад. Помоги запомнить это состояние.",
    "clear": "Упрости ситуацию. Дай один конкретный шаг. Не перегружай.",
    "friendly": "Будь дружелюбным и открытым. Обычный теплый разговор.",
    "patient": "Прояви терпение. Признай сложность ситуации. Поддержи.",
    "reassuring": "Успокой. Помоги почувствовать безопасность. Нормализуй переживания.",
    "accepting": "Прими без осуждения. Помоги отпустить вину.",
}


class EmotionDetector:
    """Detects emotion from user text using DeepSeek."""

    def __init__(self):
        self.ai = AIService()
        self._cache: Dict[str, str] = {}

    async def detect(self, text: str) -> Dict[str, str]:
        """Detect emotion and return {emotion, tone, instruction}."""
        if not text or len(text) < 3:
            return {"emotion": "neutral", "tone": "friendly", "instruction": TONE_INSTRUCTIONS["friendly"]}

        # Simple keyword detection first (fast, no API call)
        emotion = self._keyword_detect(text)
        if emotion:
            tone = EMOTION_TONES.get(emotion, "friendly")
            return {"emotion": emotion, "tone": tone, "instruction": TONE_INSTRUCTIONS.get(tone, "")}

        # DeepSeek detection for ambiguous cases
        try:
            prompt = (
                "Определи основную эмоцию в сообщении. "
                "Ответь ОДНИМ словом из списка: "
                "sadness, anger, anxiety, joy, confusion, neutral, frustration, loneliness, fear, guilt.\n\n"
                f"Сообщение: {text[:200]}\n\nЭмоция:"
            )
            result = await self.ai._simple_call(prompt, max_tokens=10, temperature=0.3)
            if result:
                emotion = result.strip().lower().split()[0] if result.strip() else "neutral"
                if emotion not in EMOTION_TONES:
                    emotion = "neutral"
            else:
                emotion = "neutral"
        except Exception as e:
            logger.warning(f"emotion detect error: {e}")
            emotion = "neutral"

        tone = EMOTION_TONES.get(emotion, "friendly")
        instruction = TONE_INSTRUCTIONS.get(tone, "")
        return {"emotion": emotion, "tone": tone, "instruction": instruction}

    def _keyword_detect(self, text: str) -> Optional[str]:
        """Fast keyword-based emotion detection."""
        t = text.lower()

        sad_words = ["грустно", "плачу", "тоска", "одинок", "больно", "потеря", "умер", "скучаю"]
        if any(w in t for w in sad_words):
            return "sadness"

        anger_words = ["бесит", "злюсь", "ненавижу", "достало", "задолбал", "раздражает", "взбесил"]
        if any(w in t for w in anger_words):
            return "anger"

        anxiety_words = ["тревога", "страшно", "паника", "нервничаю", "волнуюсь", "боюсь", "переживаю"]
        if any(w in t for w in anxiety_words):
            return "anxiety"

        joy_words = ["рад", "счастлив", "ура", "здорово", "отлично", "класс", "победа", "получилось"]
        if any(w in t for w in joy_words):
            return "joy"

        confusion_words = ["не знаю", "запутал", "не понимаю", "растерян", "не могу решить"]
        if any(w in t for w in confusion_words):
            return "confusion"

        frustration_words = ["устал", "надоело", "сил нет", "выгорел", "замучил"]
        if any(w in t for w in frustration_words):
            return "frustration"

        loneliness_words = ["одинок", "никому не нужен", "один", "не с кем", "никто не понимает"]
        if any(w in t for w in loneliness_words):
            return "loneliness"

        return None
