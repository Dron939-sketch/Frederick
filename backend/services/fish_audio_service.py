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
# Модель синтеза Fish (заголовок model: speech-1.5 / speech-1.6 / s1 / s2...).
# Пусто — Fish берёт свою «модель по умолчанию», и когда они её меняют,
# голос того же reference_id может «поплыть» (звучит не Фреди, а нейтральный
# робот). Задай FISH_AUDIO_MODEL, чтобы закрепить модель, на которой голос
# Фреди звучит правильно.
FISH_AUDIO_MODEL = os.environ.get("FISH_AUDIO_MODEL", "").strip()

# All modes use Fish Audio (Jarvis voice)
FISH_AUDIO_MODES = {"psychologist", "coach", "trainer", "basic", "default"}


def fish_configured() -> bool:
    """Настроен ли Fish (есть ключ и id голоса Фреди). Если нет — озвучка
    молча уходит в Яндекс-фолбэк, и голос перестаёт быть Фреди."""
    return bool(FISH_AUDIO_API_KEY and FISH_AUDIO_VOICE_ID)


# Почему НЕ получилось в последний раз. Возврат synthesize_fish_audio остаётся
# bytes|None (сигнатуру ждут чат и озвучка блога), а вызывающему коду нужно
# отличать «кончился баланс» (повторять бессмысленно) от таймаута (повторить
# стоит) — иначе лекция уходит в запасной голос из-за одного случайного сбоя.
last_fail: str | None = None

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


async def synthesize_fish_audio(text: str, mode: str = "psychologist", timeout: float = 30) -> bytes | None:
    """
    Synthesize speech via Fish Audio API.
    Returns MP3 bytes or None if unavailable.
    timeout: чат живёт с дефолтными 30с; длинные куски (озвучка лекций
    блога) передают больше — Fish генерирует минуту речи дольше 30с.
    """
    global last_fail
    if mode not in FISH_AUDIO_MODES:
        last_fail = "bad_mode"
        return None

    if not FISH_AUDIO_API_KEY or not FISH_AUDIO_VOICE_ID:
        logger.debug("Fish Audio not configured, skipping")
        last_fail = "not_configured"
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
        if FISH_AUDIO_MODEL:
            headers["model"] = FISH_AUDIO_MODEL

        async with httpx.AsyncClient(timeout=timeout) as client:
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
                            provider="fishaudio",
                            model=FISH_AUDIO_MODEL or "default",
                            chars=len(text or ""),
                            feature=f"tts.{mode}",
                        ))
                    except Exception as _e:
                        logger.warning(f"api_usage skip: {_e}")
                    last_fail = None
                    return audio_bytes
                else:
                    logger.warning(f"Fish Audio returned too small response: {len(audio_bytes)} bytes")
                    last_fail = "small_response"
                    return None
            elif resp.status_code == 402:
                logger.warning("Fish Audio: no balance (402), falling back")
                last_fail = "no_balance"
                return None
            else:
                logger.warning(f"Fish Audio error: {resp.status_code} {resp.text[:200]}")
                last_fail = f"http_{resp.status_code}"
                return None

    except httpx.TimeoutException:
        logger.warning("Fish Audio timeout, falling back")
        last_fail = "timeout"
        return None
    except Exception as e:
        logger.error(f"Fish Audio error: {e}")
        last_fail = f"error: {str(e)[:120]}"
        return None
