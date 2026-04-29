"""
fish_audio_service.py — Fish Audio TTS provider (Jarvis voice).
Primary voice for ALL modes. Yandex as fallback.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
FISH_AUDIO_VOICE_ID = os.environ.get("FISH_AUDIO_VOICE_ID", "")
FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts"

# All modes use Fish Audio (Jarvis voice)
FISH_AUDIO_MODES = {"psychologist", "coach", "trainer", "basic", "default"}


async def synthesize_fish_audio(text: str, mode: str = "psychologist") -> bytes | None:
    """
    Synthesize speech via Fish Audio API.
    Returns MP3 bytes or None if unavailable.
    """
    if mode not in FISH_AUDIO_MODES:
        return None

    if not FISH_AUDIO_API_KEY or not FISH_AUDIO_VOICE_ID:
        logger.debug("Fish Audio not configured, skipping")
        return None

    try:
        payload = {
            "text": text,
            "reference_id": FISH_AUDIO_VOICE_ID,
            "format": "mp3",
            "mp3_bitrate": 128,
            "normalize": True,
            "latency": "balanced",
        }

        headers = {
            "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                FISH_AUDIO_API_URL,
                json=payload,
                headers=headers,
            )

            if resp.status_code == 200:
                audio_bytes = resp.content
                if len(audio_bytes) > 100:
                    logger.info(f"Fish Audio TTS ok: {len(audio_bytes)} bytes, mode={mode}")
                    try:
                        import asyncio as _aio
                        from services.api_usage import log_tts_usage
                        _aio.create_task(log_tts_usage(
                            provider="fishaudio", model="default",
                            chars=len(text or ""),
                            feature=f"tts.{mode}",
                        ))
                    except Exception as _e:
                        logger.warning(f"api_usage skip: {_e}")
                    return audio_bytes
                else:
                    logger.warning(f"Fish Audio returned too small response: {len(audio_bytes)} bytes")
                    return None
            elif resp.status_code == 402:
                logger.warning("Fish Audio: no balance (402), falling back")
                return None
            else:
                logger.warning(f"Fish Audio error: {resp.status_code} {resp.text[:200]}")
                return None

    except httpx.TimeoutException:
        logger.warning("Fish Audio timeout, falling back")
        return None
    except Exception as e:
        logger.error(f"Fish Audio error: {e}")
        return None
