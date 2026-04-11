"""
voice_fish_patch.py — Patches voice TTS to use Fish Audio as primary.
Call apply_fish_audio_patch() at startup to wrap text_to_speech.
For psychologist/coach/trainer: Fish Audio first, Yandex fallback.
For basic: Yandex only (no change).
"""

import logging
import services.voice_service as voice_module
from services.fish_audio_service import synthesize_fish_audio, FISH_AUDIO_MODES

logger = logging.getLogger(__name__)

_original_tts = None


def apply_fish_audio_patch():
    """Wrap the global text_to_speech function with Fish Audio priority."""
    global _original_tts

    if _original_tts is not None:
        logger.info("Fish Audio patch already applied")
        return

    _original_tts = voice_module.text_to_speech

    async def text_to_speech_with_fish(text: str, mode: str = "psychologist"):
        # Try Fish Audio for psychologist/coach/trainer
        if mode in FISH_AUDIO_MODES:
            try:
                fish_result = await synthesize_fish_audio(text, mode)
                if fish_result:
                    logger.info(f"Fish Audio TTS ok: {len(fish_result)} bytes, mode={mode}")
                    return fish_result
                logger.info(f"Fish Audio unavailable for mode={mode}, falling back to Yandex")
            except Exception as e:
                logger.warning(f"Fish Audio error: {e}, falling back to Yandex")

        # Fallback to original Yandex TTS
        return await _original_tts(text, mode)

    # Replace the module-level function
    voice_module.text_to_speech = text_to_speech_with_fish
    logger.info("Fish Audio patch applied: psychologist/coach/trainer -> Fish Audio -> Yandex fallback")
