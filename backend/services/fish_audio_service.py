"""
fish_audio_service.py — Fish Audio TTS provider (Jarvis voice).
Primary voice for ALL modes. Yandex as fallback.
"""

import os
import logging
import asyncio
import subprocess
import tempfile
import httpx

logger = logging.getLogger(__name__)

FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
FISH_AUDIO_VOICE_ID = os.environ.get("FISH_AUDIO_VOICE_ID", "")
FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts"

# All modes use Fish Audio (Jarvis voice)
FISH_AUDIO_MODES = {"psychologist", "coach", "trainer", "basic", "default"}

# Скорость воспроизведения для Fish Audio. Сам API не даёт параметра
# скорости, поэтому замедляем post-process'ом через ffmpeg atempo.
# 0.90 = на 10% медленнее (просьба пользователя — Фреди говорит слишком быстро).
FISH_AUDIO_SPEED = float(os.environ.get("FISH_AUDIO_SPEED", "0.90"))


def _slow_audio_atempo(mp3_bytes: bytes, factor: float = 0.9) -> bytes:
    """Замедление MP3 без изменения тона через ffmpeg atempo.

    Возвращает изменённый MP3 или исходные байты при ошибке (no-op fallback).
    Latency: ~150-300мс на типичном голосовом ответе.
    """
    if abs(factor - 1.0) < 0.01:
        return mp3_bytes
    if not mp3_bytes or len(mp3_bytes) < 100:
        return mp3_bytes
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as fin:
            fin.write(mp3_bytes)
            in_path = fin.name
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as fout:
            out_path = fout.name
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", in_path,
            "-filter:a", f"atempo={factor:.3f}",
            "-c:a", "libmp3lame", "-b:a", "128k",
            out_path,
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        if result.returncode != 0:
            logger.warning(f"atempo ffmpeg failed: {result.stderr.decode()[:200]}")
            return mp3_bytes
        with open(out_path, "rb") as f:
            slowed = f.read()
        try:
            os.unlink(in_path)
            os.unlink(out_path)
        except Exception:
            pass
        return slowed if len(slowed) > 100 else mp3_bytes
    except subprocess.TimeoutExpired:
        logger.warning("atempo ffmpeg timeout")
        return mp3_bytes
    except Exception as e:
        logger.warning(f"atempo error: {e}")
        return mp3_bytes


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
                    # Замедление на ~10% — Fish API без speed-параметра, делаем
                    # post-process через ffmpeg atempo. Никакого изменения тона.
                    if FISH_AUDIO_SPEED and abs(FISH_AUDIO_SPEED - 1.0) > 0.01:
                        try:
                            slowed = await asyncio.to_thread(
                                _slow_audio_atempo, audio_bytes, FISH_AUDIO_SPEED
                            )
                            if slowed and len(slowed) > 100:
                                audio_bytes = slowed
                                logger.info(
                                    f"Fish Audio: speed={FISH_AUDIO_SPEED} → "
                                    f"{len(audio_bytes)} bytes"
                                )
                        except Exception as _e:
                            logger.warning(f"Fish Audio atempo skip: {_e}")
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
