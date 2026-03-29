#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка живого голосового диалога (WebSocket + VAD + Barge-in)
Адаптирован из рабочего кода Telegram-бота MAX
ВЕРСИЯ 2.1 - С ПОДДЕРЖКОЙ ГОЛОСА БЕНДЕРА
"""

import logging
import base64
import asyncio
import os
import tempfile
import json
import time
import traceback
import random
from typing import Optional, Dict, Any, AsyncGenerator, Callable
from datetime import datetime

import aiohttp
import httpx
import numpy as np

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ
# ============================================
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

VAD_MODE = int(os.getenv("VAD_MODE", "3"))
VAD_SAMPLE_RATE = 16000

# ============================================
# ГОЛОСА YANDEX TTS ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================
VOICES = {
    "psychologist": "ermil",
    "coach": "filipp",
    "trainer": "alena",
    "basic": "filipp",
    "default": "filipp"
}

# ============================================
# НАСТРОЙКИ СКОРОСТИ, ТОНА И ЭМОЦИЙ ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================
VOICE_SETTINGS = {
    "psychologist": {
        "speed": 0.95,
        "emotion": "neutral",
        "description": "Спокойный, размеренный голос психолога"
    },
    "coach": {
        "speed": 1.0,
        "emotion": "energetic",
        "description": "Энергичный, мотивирующий голос коуча"
    },
    "trainer": {
        "speed": 1.1,
        "emotion": "energetic",
        "description": "Быстрый, бодрый голос тренера"
    },
    "basic": {
        "speed": 1.18,
        "emotion": "good",
        "description": "Бендер — дерзкий, быстрый, с юмором",
        "add_flavor": True
    },
    "default": {
        "speed": 1.0,
        "emotion": "neutral",
        "description": "Стандартный голос"
    }
}

# ============================================
# ФИРМЕННЫЕ ФРАЗЫ БЕНДЕРА
# ============================================
BENDER_PREFIXES = [
    "О да, детка! ",
    "Слушай, братец, ",
    "Ну, сударь, ",
    "Великий комбинатор говорит: ",
    "Клянусь бананом, ",
    "А вот это, я тебе скажу, ",
    "Так-так-так, ",
    "О, я вижу, ",
    "Бендер в деле: "
]

BENDER_SUFFIXES = [
    " 🦾",
    " 🤖",
    " 😎",
    " 🎭",
    " 🔥",
    " 💪"
]

def add_bender_flavor(text: str) -> str:
    """
    Добавляет фирменные бендеровские вставки в текст
    """
    original_text = text

    if not any(p.strip() in text for p in BENDER_PREFIXES):
        prefix = random.choice(BENDER_PREFIXES)
        text = prefix + text[0].lower() + text[1:] if text else prefix

    if not any(emoji in text for emoji in BENDER_SUFFIXES):
        if len(text) < 500:
            suffix = random.choice(BENDER_SUFFIXES)
            text = text.rstrip() + suffix

    text = text.replace("...", " <break time='400ms'/> ")
    text = text.replace("!", "! <break time='200ms'/> ")
    text = text.replace("?", "? <break time='250ms'/> ")

    bender_words = ["братец", "сударь", "детка", "комбинатор", "банан"]
    if not any(word in text.lower() for word in bender_words):
        if len(text) > 50:
            address = random.choice(["братец", "сударь", "друг мой"])
            words = text.split()
            insert_pos = min(len(words) // 2, 5)
            words.insert(insert_pos, address + ",")
            text = " ".join(words)

    logger.debug(f"✨ Бендеровская обработка текста: {len(original_text)} -> {len(text)} символов")
    return text


# ============================================
# ГЛОБАЛЬНЫЙ HTTP КЛИЕНТ (улучшенный)
# ============================================
_http_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()

async def get_http_client():
    global _http_client
    if _http_client is None:
        async with _client_lock:
            if _http_client is None:
                limits = httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=50,
                    keepalive_expiry=30
                )
                timeouts = httpx.Timeout(
                    connect=30.0,
                    read=60.0,
                    write=30.0,
                    pool=None
                )
                _http_client = httpx.AsyncClient(
                    limits=limits,
                    timeout=timeouts,
                    follow_redirects=True
                )
                logger.info("✅ Глобальный HTTPX клиент создан")
    return _http_client


async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("🔒 HTTPX клиент закрыт")


# ============================================
# VAD - Voice Activity Detection
# ============================================
class VADDetector:
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        self.sample_rate = sample_rate
        self.mode = mode
        self.frame_duration = 30
        self.frame_size = int(sample_rate * self.frame_duration / 1000)

        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

        self.speech_trigger_frames = 3
        self.silence_trigger_frames = 10
        self.energy_threshold = 0.01

        self.vad = None
        self.has_vad = False
        try:
            import webrtcvad
            self.vad = webrtcvad.Vad(mode)
            self.has_vad = True
            logger.info(f"✅ WebRTC VAD инициализирован, mode={mode}")
        except ImportError:
            logger.info("ℹ️ WebRTC VAD не установлен, использую энергетический VAD")

    def reset(self):
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def _calculate_energy(self, audio_chunk: bytes) -> float:
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_array.astype(np.float32)**2))
            return rms / 32768.0
        except:
            return 0.0

    def _is_speech_energy(self, audio_chunk: bytes) -> bool:
        return self._calculate_energy(audio_chunk) > self.energy_threshold

    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        if not self.has_vad:
            return self._is_speech_energy(audio_chunk)

        if len(audio_chunk) != self.frame_size * 2:
            return self._is_speech_energy(audio_chunk)

        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except:
            return self._is_speech_energy(audio_chunk)

    def process_chunk(self, audio_chunk: bytes) -> Dict[str, Any]:
        result = {
            "is_speech": False,
            "speech_started": False,
            "speech_ended": False,
            "is_speaking": self.is_speaking,
            "energy": self._calculate_energy(audio_chunk)
        }

        is_speech = self._is_speech_webrtc(audio_chunk)
        result["is_speech"] = is_speech

        if is_speech and not self.is_speaking:
            self.speech_frames += 1
            if self.speech_frames >= self.speech_trigger_frames:
                self.is_speaking = True
                result["speech_started"] = True
                result["is_speaking"] = True
                self.speech_frames = 0
        elif is_speech and self.is_speaking:
            self.silence_frames = 0
        elif not is_speech and self.is_speaking:
            self.silence_frames += 1
            if self.silence_frames >= self.silence_trigger_frames:
                self.is_speaking = False
                result["speech_ended"] = True
                result["is_speaking"] = False
                self.silence_frames = 0
        elif not is_speech and not self.is_speaking:
            self.speech_frames = 0
            self.silence_frames = 0

        return result


# ============================================
# STT - Speech-to-Text (DeepGram)
# ============================================
async def speech_to_text(audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")

    if not DEEPGRAM_API_KEY:
        logger.error("❌ DEEPGRAM_API_KEY не настроен")
        return None

    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None

    mime_types = {
        "webm": "audio/webm",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
        "mp3": "audio/mpeg",
        "mp4": "audio/mp4"
    }
    content_type = mime_types.get(audio_format, "audio/webm")

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": content_type
    }

    params = {
        "model": "nova-2",
        "language": "ru",
        "punctuate": "true",
        "smart_format": "true",
        "detect_language": "false"
    }

    try:
        client = await get_http_client()

        response = await client.post(
            DEEPGRAM_API_URL,
            headers=headers,
            params=params,
            content=audio_bytes,
            timeout=30.0
        )

        if response.status_code == 200:
            data = response.json()
            try:
                transcript = data['results']['channels'][0]['alternatives'][0].get('transcript', '')
                confidence = data['results']['channels'][0]['alternatives'][0].get('confidence', 0)

                logger.info(f"🎤 Распознано: '{transcript}' (уверенность: {confidence:.2f})")

                if transcript and transcript.strip():
                    return transcript.strip()
                else:
                    logger.warning("⚠️ DeepGram вернул пустой текст")
                    return None
            except (KeyError, IndexError) as e:
                logger.error(f"❌ Не удалось извлечь транскрипт: {e}")
                return None
        else:
            logger.error(f"❌ DeepGram error {response.status_code}: {response.text[:200]}")
            return None

    except httpx.TimeoutException:
        logger.error("❌ Таймаут DeepGram")
        return None
    except Exception as e:
        logger.error(f"❌ Ошибка распознавания: {e}")
        logger.error(traceback.format_exc())
        return None


# ============================================
# TTS - Text-to-Speech (Yandex) с поддержкой Бендера
# ============================================
async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    logger.info(f"🎤 Синтез речи (Yandex TTS), режим: {mode}, текст: {text[:100]}...")

    if not YANDEX_API_KEY:
        logger.error("❌ YANDEX_API_KEY не настроен")
        logger.info("💡 Добавьте YANDEX_API_KEY в переменные окружения Render")
        return None

    settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])
    voice = VOICES.get(mode, VOICES["default"])

    if mode == "basic" and settings.get("add_flavor", False):
        original_text = text
        text = add_bender_flavor(text)
        logger.debug(f"✨ Бендеровская обработка: '{original_text[:50]}...' -> '{text[:80]}...'")

    if len(text) > 4500:
        text = text[:4500] + "..."
        logger.warning(f"⚠️ Текст обрезан до 4500 символов")

    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "text": text,
        "lang": "ru-RU",
        "voice": voice,
        "emotion": settings["emotion"],
        "speed": settings["speed"],
        "format": "mp3"
    }

    try:
        client = await get_http_client()

        response = await client.post(
            YANDEX_TTS_API_URL,
            headers=headers,
            data=data,
            timeout=30.0
        )

        if response.status_code == 200:
            audio_data = response.content
            logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт, формат: MP3, голос: {voice}")
            return audio_data
        else:
            logger.error(f"❌ Yandex TTS error {response.status_code}: {response.text[:200]}")
            return None

    except httpx.TimeoutException:
        logger.error("❌ Таймаут Yandex TTS")
        return None
    except Exception as e:
        logger.error(f"❌ Ошибка синтеза речи: {e}")
        logger.error(traceback.format_exc())
        return None


# ============================================
# ПОТОКОВОЕ РАСПОЗНАВАНИЕ (для живого диалога)
# ============================================
async def speech_to_text_streaming(
    audio_stream: AsyncGenerator[bytes, None],
    sample_rate: int = 16000,
    on_transcript: Optional[Callable] = None,
    on_speech_start: Optional[Callable] = None,
    on_speech_end: Optional[Callable] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    vad = VADDetector(sample_rate, VAD_MODE)
    audio_buffer = bytearray()
    current_utterance = []
    is_collecting = False

    logger.info("🎤 Запуск потокового распознавания речи")

    async for chunk in audio_stream:
        if not chunk:
            continue

        vad_result = vad.process_chunk(chunk)

        if vad_result["speech_started"]:
            logger.info("🗣️ Речь началась")
            if on_speech_start:
                await on_speech_start()
            is_collecting = True
            audio_buffer.clear()
            current_utterance.clear()

        if is_collecting:
            audio_buffer.extend(chunk)

        if vad_result["speech_ended"] and len(audio_buffer) > 0:
            logger.info(f"🔇 Речь закончилась, собрано {len(audio_buffer)} байт")

            try:
                recognized = await speech_to_text(bytes(audio_buffer), "wav")

                if recognized and recognized.strip():
                    logger.info(f"📝 Распознано: {recognized}")
                    current_utterance.append(recognized)
                    full_text = " ".join(current_utterance)

                    if on_transcript:
                        await on_transcript(recognized, True)

                    if on_speech_end:
                        await on_speech_end(full_text)

                    yield {
                        "type": "utterance",
                        "text": full_text,
                        "is_final": True,
                        "segments": current_utterance.copy()
                    }
                else:
                    logger.warning("⚠️ Речь не распознана")
                    yield {
                        "type": "error",
                        "error": "Речь не распознана"
                    }

            except Exception as e:
                logger.error(f"Ошибка распознавания: {e}")
                yield {
                    "type": "error",
                    "error": str(e)
                }

            audio_buffer.clear()
            is_collecting = False
            vad.reset()

        yield {
            "type": "vad_state",
            **vad_result
        }

    logger.info("🎤 Потоковое распознавание завершено")


# ============================================
# ПОТОКОВЫЙ СИНТЕЗ РЕЧИ (для живого диалога)
# ============================================
async def text_to_speech_streaming(
    text: str,
    mode: str = "psychologist",
    chunk_size: int = 4096
) -> AsyncGenerator[bytes, None]:
    logger.info(f"🎤 Потоковый синтез речи, режим: {mode}, текст: {text[:100]}...")

    audio_bytes = await text_to_speech(text, mode)

    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            await asyncio.sleep(0.012)   # улучшает плавность в WebSocket

        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================
class VoiceService:
    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache = {}

        logger.info("=" * 60)
        logger.info("🎤 VoiceService инициализирован")
        logger.info(f" DeepGram (STT): {'✅' if self.deepgram_key else '❌'}")
        logger.info(f" Yandex TTS: {'✅' if self.yandex_key else '❌'}")
        logger.info(f" VAD Mode: {VAD_MODE}")
        logger.info("")

        for mode, settings in VOICE_SETTINGS.items():
            voice = VOICES.get(mode, "default")
            logger.info(f" • {mode}: {voice} (speed={settings['speed']}, emotion={settings['emotion']})")
        logger.info("=" * 60)

        if not self.deepgram_key:
            logger.warning("⚠️ DEEPGRAM_API_KEY не настроен!")
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_API_KEY не настроен!")

    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        return await speech_to_text(audio_bytes, audio_format)

    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None

    async def speech_to_text_pcm(self, pcm_bytes: bytes, sample_rate: int = 16000) -> Optional[str]:
        logger.info(f"🎤 Распознавание PCM, размер: {len(pcm_bytes)} байт, sample_rate: {sample_rate}")

        if not DEEPGRAM_API_KEY:
            logger.error("❌ DEEPGRAM_API_KEY не настроен")
            return None

        MIN_AUDIO_BYTES = 16000
        if len(pcm_bytes) < MIN_AUDIO_BYTES:
            logger.warning(f"⚠️ Аудио слишком короткое: {len(pcm_bytes)} байт")
            return None

        try:
            audio_array = np.frombuffer(pcm_bytes, dtype=np.int16)
            max_amp = np.max(np.abs(audio_array))
            avg_amp = np.mean(np.abs(audio_array))
            logger.info(f"🔊 Анализ PCM: max={max_amp}, avg={avg_amp:.2f}")

            if max_amp < 800:
                logger.warning(f"⚠️ Аудио слишком тихое (max={max_amp})")
                return None
        except Exception as e:
            logger.warning(f"⚠️ Не удалось проанализировать PCM: {e}")

        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/octet-stream",
        }

        params = {
            "model": "nova-2",
            "language": "ru",
            "encoding": "linear16",
            "sample_rate": sample_rate,
            "channels": 1,
            "punctuate": "true",
            "smart_format": "true",
            "detect_language": "false"
        }

        try:
            client = await get_http_client()

            response = await client.post(
                DEEPGRAM_API_URL,
                headers=headers,
                params=params,
                content=pcm_bytes,
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data['results']['channels'][0]['alternatives'][0].get('transcript', '')
                confidence = data['results']['channels'][0]['alternatives'][0].get('confidence', 0)

                logger.info(f"📝 DeepGram результат: '{transcript}' (уверенность: {confidence:.2f})")

                if transcript and transcript.strip():
                    return transcript.strip()
                else:
                    logger.warning("⚠️ DeepGram вернул пустой текст")
                    return None
            else:
                logger.error(f"❌ DeepGram error {response.status_code}: {response.text[:200]}")
                return None

        except httpx.TimeoutException:
            logger.error("❌ Таймаут DeepGram")
            return None
        except Exception as e:
            logger.error(f"❌ Ошибка распознавания: {e}")
            logger.error(traceback.format_exc())
            return None

    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        return await text_to_speech(text, mode)

    async def speech_to_text_streaming(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
        on_transcript: Optional[Callable] = None,
        on_speech_start: Optional[Callable] = None,
        on_speech_end: Optional[Callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        async for result in speech_to_text_streaming(
            audio_stream, sample_rate, on_transcript, on_speech_start, on_speech_end
        ):
            yield result

    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk

    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
        if user_id is not None:
            cache_key = f"{user_id}:{sample_rate}:{mode}"
            if cache_key in self._vad_cache:
                vad = self._vad_cache[cache_key]
                vad.reset()
                return vad

            vad = VADDetector(sample_rate, mode)
            self._vad_cache[cache_key] = vad
            return vad

        return VADDetector(sample_rate, mode)

    def clear_vad_cache(self, user_id: Optional[int] = None):
        if user_id is not None:
            to_remove = [k for k in self._vad_cache if k.startswith(f"{user_id}:")]
            for key in to_remove:
                del self._vad_cache[key]
            logger.info(f"🗑️ Очищен кэш VAD для user_id={user_id}")
        else:
            self._vad_cache.clear()
            logger.info("🗑️ Очищен весь кэш VAD")

    def get_voice_info(self, mode: str = "psychologist") -> Dict[str, Any]:
        return {
            "mode": mode,
            "voice": VOICES.get(mode, VOICES["default"]),
            "settings": VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"]),
            "available_modes": list(VOICE_SETTINGS.keys())
        }

    async def close(self):
        await close_http_client()
        self.clear_vad_cache()
        logger.info("🔒 VoiceService закрыт")


# ============================================
# ФАБРИКА
# ============================================
def create_voice_service() -> VoiceService:
    return VoiceService()


# ============================================
# ФУНКЦИЯ ДЛЯ ОТЛАДКИ
# ============================================
async def save_audio_debug(audio_bytes: bytes, prefix: str = "audio") -> Optional[str]:
    try:
        timestamp = int(time.time())
        filename = f"/tmp/{prefix}_{timestamp}.webm"
        with open(filename, 'wb') as f:
            f.write(audio_bytes)
        logger.info(f"💾 Аудио сохранено для отладки: {filename}")
        return filename
    except Exception as e:
        logger.warning(f"⚠️ Не удалось сохранить аудио: {e}")
        return None
