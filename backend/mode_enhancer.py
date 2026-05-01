"""
mode_enhancer.py - Enhances psychologist/coach/trainer modes with:
- Anthropic Claude as primary LLM (DeepSeek fallback)
- UserMemory (shared facts across all modes)
- EmotionDetector (tone adaptation)
- Parallel processing

Call apply_mode_enhancements() at startup.
All modes share the same fredi_user_facts table per user_id.
"""

import asyncio
import logging
import time
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

_enhanced = False


def apply_mode_enhancements():
    """Patch PsychologistMode, CoachMode, TrainerMode with memory + emotions + Anthropic."""
    global _enhanced
    if _enhanced:
        return
    _enhanced = True

    try:
        from modes.psychologist import PsychologistMode
        from modes.coach import CoachMode
        from modes.trainer import TrainerMode
    except ImportError as e:
        logger.warning(f"mode_enhancer: can't import modes: {e}")
        return

    for mode_cls in [PsychologistMode, CoachMode, TrainerMode]:
        _patch_mode(mode_cls)

    logger.info("mode_enhancer: PsychologistMode, CoachMode, TrainerMode enhanced with memory+emotions+anthropic")


def _patch_mode(mode_cls):
    """Monkey-patch a mode class to add enhanced features."""
    original_init = mode_cls.__init__
    original_process = mode_cls.process_question_streaming

    async def enhanced_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        self._user_memory = None
        self._emotion_detector = None
        self._memory_text = ""
        self._current_emotion = {"emotion": "neutral", "tone": "friendly", "instruction": ""}
        self._memory_loaded = False

    def sync_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        self._user_memory = None
        self._emotion_detector = None
        self._memory_text = ""
        self._current_emotion = {"emotion": "neutral", "tone": "friendly", "instruction": ""}
        self._memory_loaded = False

    async def _load_user_memory(self):
        if self._memory_loaded:
            return
        self._memory_loaded = True
        try:
            from services.user_memory import get_user_memory
            mem = get_user_memory()
            if mem:
                self._user_memory = mem
                self._memory_text = await mem.get_facts_text(self.user_id)
                if self._memory_text:
                    logger.info(f"mode_enhancer: loaded {len(self._memory_text)} chars of facts for user {self.user_id}")
        except Exception as e:
            logger.warning(f"mode_enhancer: memory load failed: {e}")

    async def _detect_user_emotion(self, text):
        try:
            from services.emotion_detector import EmotionDetector
            if self._emotion_detector is None:
                self._emotion_detector = EmotionDetector()
            self._current_emotion = await self._emotion_detector.detect(text)
        except Exception:
            pass

    async def _extract_and_save_fact(self, text):
        try:
            from services.ai_service import AIService
            ai = AIService()
            prompt = (
                "Из сообщения человека выдели ОДИН конкретный факт о его жизни или проблеме.\n"
                "Если факта нет, ответь НЕТ.\n\n"
                f"Сообщение: \"{text}\"\n\nФакт:"
            )
            response = await ai._simple_call(prompt, max_tokens=50, temperature=0.5)
            if response and response.strip() != "НЕТ" and len(response.strip()) > 3:
                fact = response.strip()
                if self._user_memory:
                    await self._user_memory.store_fact(self.user_id, fact)
                    logger.info(f"mode_enhancer: saved fact for user {self.user_id}: {fact[:50]}")
        except Exception:
            pass

    async def _call_anthropic(self, prompt, max_tokens=200, temperature=0.7):
        try:
            from services.anthropic_client import call_anthropic, is_available
            if is_available():
                result = await call_anthropic(prompt, max_tokens=max_tokens, temperature=temperature)
                if result:
                    return result
        except Exception:
            pass
        return None

    async def enhanced_process(self, question):
        start = time.time()

        # Load memory + detect emotion in parallel
        await asyncio.gather(
            _load_user_memory(self),
            _detect_user_emotion(self, question),
            return_exceptions=True
        )

        # Save fact in background
        asyncio.create_task(_extract_and_save_fact(self, question))

        # Build enhanced prompt with memory and emotion
        memory_addition = ""
        if self._memory_text:
            memory_addition = f"\n\n{self._memory_text}\n"

        emotion_addition = ""
        if self._current_emotion.get("instruction"):
            emotion_addition = (
                f"\n\nЭМОЦИЯ СОБЕСЕДНИКА: {self._current_emotion['emotion']}. "
                f"{self._current_emotion['instruction']}\n"
            )

        # Try Anthropic for the main response
        anthropic_response = None
        if memory_addition or emotion_addition:
            # Build a prompt with context for Anthropic
            system = getattr(self, 'get_system_prompt', lambda: '')() if hasattr(self, 'get_system_prompt') else ''
            history_text = ""
            if hasattr(self, 'history') and self.history:
                history_parts = []
                for m in self.history[-6:]:
                    role = "Пользователь" if m.get('role') == 'user' else "Фреди"
                    history_parts.append(f"{role}: {m.get('content', '')[:100]}")
                history_text = "\n".join(history_parts)

            # ВАЖНО: этот mode_enhancer применяется ТОЛЬКО к Psychologist/
            # Coach/TrainerMode — то есть к юзерам, у которых тест УЖЕ пройден.
            # Без этого guard'а LLM иногда сам вставлял в ответ предложение
            # «пройди тест» — это вызывало жалобы, что Фреди предлагает тест
            # человеку с уже пройденным тестом.
            no_test_guard = (
                "\n\nКРИТИЧНО: тест уже пройден, у пользователя есть готовый "
                "профиль. НИКОГДА не предлагай ему пройти тест, не упоминай "
                "тест и его варианты.\n"
            )

            anthropic_prompt = (
                f"{system}\n{memory_addition}{emotion_addition}{no_test_guard}\n"
                f"История:\n{history_text}\n\n"
                f"Пользователь: {question}\n\n"
                "Ответь коротко (2-4 фразы). Адаптируй тон под эмоцию."
            )
            anthropic_response = await _call_anthropic(self, anthropic_prompt, max_tokens=200, temperature=0.7)

        if anthropic_response:
            logger.info(f"mode_enhancer: Anthropic response for {self.__class__.__name__}, {time.time()-start:.1f}s")
            yield anthropic_response
        else:
            # Fallback to original mode processing (DeepSeek)
            async for chunk in original_process(self, question):
                yield chunk

    # Apply patches
    mode_cls.__init__ = sync_init
    mode_cls.process_question_streaming = enhanced_process
