#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка живого голосового диалога (WebSocket + VAD + Barge-in)
Адаптирован из рабочего кода Telegram-бота MAX

ВЕРСИЯ 2.2 — ИСПРАВЛЕНА НОРМАЛИЗАЦИЯ ТЕКСТА ДЛЯ TTS
Основные улучшения:
- Надёжная функция normalize_tts_text (убирает разбиение по буквам)
- Убрано дублирование метода text_to_speech_streaming
- Добавлено детальное логирование
- Улучшена обработка для режима Бендера
- Код очищен и хорошо структурирован
"""

import logging
import base64
import asyncio
import os
import time
import traceback
import random
import re
from typing import Optional, Dict, Any, AsyncGenerator, Callable

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ СЕРВИСА
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
    " 🦾", " 🤖", " 😎", " 🎭", " 🔥", " 💪"
]

# ============================================
# НОРМАЛИЗАЦИЯ ТЕКСТА ДЛЯ YANDEX TTS
# ============================================
def normalize_tts_text(text: str) -> str:
    """
    Финальная нормализация текста для Yandex TTS.
    Склеивает разорванные буквы и разделяет слипшиеся слова.
    """
    if not text:
        return ""

    # 1. Убираем эмодзи
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)

    # 2. Убираем спецсимволы
    text = re.sub(r'[#*_`~<>|@$%^&+={}[\]\\;:]', ' ', text)

    # 3. Склеиваем разорванные буквы (два прохода)
    for _ in range(2):
        text = re.sub(r'([а-яёА-ЯЁa-zA-Z])\s+([а-яёА-ЯЁa-zA-Z])', r'\1\2', text)

    # 5. Нормализуем пробелы
    text = re.sub(r'\s+', ' ', text)

    # 6. Добавляем пробелы после знаков препинания
    text = re.sub(r'([.,!?])(\S)', r'\1 \2', text)

    # 7. Убираем пробелы перед знаками препинания
    text = re.sub(r'\s+([.,!?])', r'\1', text)

    # 8. Финальная нормализация
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('—', '-')

    return text


def add_bender_flavor(text: str) -> str:
    """
    Добавляет фирменный стиль Бендера (префикс), но не ломает текст.
    Вызывается только для режима "basic".
    """
    if not text or not text.strip():
        return text

    original = text.strip()

    # Добавляем префикс только если его ещё нет в начале
    if not any(p.strip().lower() in original.lower()[:50] for p in BENDER_PREFIXES):
        prefix = random.choice(BENDER_PREFIXES)
        text = prefix + original
    else:
        text = original

    # Безопасная очистка эмодзи и HTML-тегов
    text = re.sub(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF]+', '', text)
    text = re.sub(r'<[^>]+>', ' ', text)

    # Нормализация пробелов
    text = re.sub(r'\s+', ' ', text).strip()

    logger.debug(f"✨ Бендер flavor применён: '{original[:60]}...' → '{text[:90]}...'")
    return text


# ============================================
# ГЛОБАЛЬНЫЙ HTTP КЛИЕНТ
# ============================================
_http_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()


async def get_http_client():
    """Возвращает (или создаёт) глобальный HTTPX клиент"""
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
                    connect=30.0, read=60.0, write=30.0, pool=None
                )
                _http_client = httpx.AsyncClient(
                    limits=limits,
                    timeout=timeouts,
                    follow_redirects=True
                )
                logger.info("✅ Глобальный HTTPX клиент создан")
    return _http_client


async def close_http_client():
    """Закрывает глобальный HTTP клиент"""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("🔒 HTTPX клиент закрыт")


# ============================================
# VAD - Voice Activity Detection
# ============================================
class VADDetector:
    """
    Детектор речевой активности.
    Поддерживает WebRTC VAD и fallback на энергетический анализ.
    """

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
            logger.info(f"✅ WebRTC VAD инициализирован (mode={mode})")
        except ImportError:
            logger.info("ℹ️ WebRTC VAD не установлен → используется энергетический VAD")

    def reset(self):
        """Сброс состояния детектора"""
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def _calculate_energy(self, audio_chunk: bytes) -> float:
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_array.astype(np.float32) ** 2))
            return rms / 32768.0
        except Exception:
            return 0.0

    def _is_speech_energy(self, audio_chunk: bytes) -> bool:
        return self._calculate_energy(audio_chunk) > self.energy_threshold

    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        if not self.has_vad or len(audio_chunk) != self.frame_size * 2:
            return self._is_speech_energy(audio_chunk)
        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except Exception:
            return self._is_speech_energy(audio_chunk)

    def process_chunk(self, audio_chunk: bytes) -> Dict[str, Any]:
        """Обработка одного аудио-чанка"""
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
        else:
            self.speech_frames = 0
            self.silence_frames = 0

        return result


# ============================================
# STT - Speech-to-Text (DeepGram)
# ============================================
async def speech_to_text(audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
    """Распознавание речи через DeepGram"""
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
        "smart_format": "true"
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
                return transcript.strip() if transcript and transcript.strip() else None
            except (KeyError, IndexError) as e:
                logger.error(f"❌ Не удалось извлечь транскрипт: {e}")
                return None
        else:
            logger.error(f"❌ DeepGram error {response.status_code}: {response.text[:200]}")
            return None

    except Exception as e:
        logger.error(f"❌ Ошибка распознавания речи: {e}")
        return None


# ============================================
# TTS - Text-to-Speech (Yandex) — ОСНОВНАЯ ФУНКЦИЯ
# ============================================
async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    """
    Синтез речи через Yandex TTS с обязательной нормализацией текста.
    """
    logger.info(f"🎤 Синтез речи (Yandex TTS), режим: {mode}, текст: {text[:150]}...")

    if not text or not text.strip():
        logger.warning("⚠️ Пустой текст для TTS")
        return None

    # === ГЛАВНАЯ НОРМАЛИЗАЦИЯ ===
    text = normalize_tts_text(text)
    logger.debug(f"Normalized TTS text ({mode}): {text[:220]}{'...' if len(text) > 220 else ''}")

    settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])
    voice = VOICES.get(mode, VOICES["default"])

    # Применяем стиль Бендера только в basic-режиме
    if mode == "basic":
        text = add_bender_flavor(text)

    # Ограничение длины
    if len(text) > 4500:
        text = text[:4500] + "..."

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
            logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт, голос: {voice}")
            return audio_data
        else:
            logger.error(f"❌ Yandex TTS error {response.status_code}: {response.text[:200]}")
            return None

    except Exception as e:
        logger.error(f"❌ Ошибка синтеза речи: {e}")
        logger.error(traceback.format_exc())
        return None


# ============================================
# ПОТОКОВОЕ РАСПОЗНАВАНИЕ РЕЧИ
# ============================================
async def speech_to_text_streaming(
    audio_stream: AsyncGenerator[bytes, None],
    sample_rate: int = 16000,
    on_transcript: Optional[Callable] = None,
    on_speech_start: Optional[Callable] = None,
    on_speech_end: Optional[Callable] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """Потоковое распознавание речи с VAD"""
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
                    yield {"type": "error", "error": "Речь не распознана"}
            except Exception as e:
                logger.error(f"Ошибка в speech_to_text: {e}")
                yield {"type": "error", "error": str(e)}

            audio_buffer.clear()
            is_collecting = False
            vad.reset()

        yield {"type": "vad_state", **vad_result}

    logger.info("🎤 Потоковое распознавание завершено")


# ============================================
# ПОТОКОВЫЙ СИНТЕЗ РЕЧИ
# ============================================
async def text_to_speech_streaming(
    text: str,
    mode: str = "psychologist",
    chunk_size: int = 4096
) -> AsyncGenerator[bytes, None]:
    """Потоковая отправка аудио (для WebSocket)"""
    logger.info(f"🎤 Потоковый синтез речи, режим: {mode}, текст: {text[:100]}...")

    audio_bytes = await text_to_speech(text, mode)

    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            await asyncio.sleep(0.012)  # плавность воспроизведения
        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================
class VoiceService:
    """
    Основной класс сервиса голосового взаимодействия.
    Предоставляет удобные методы для STT и TTS.
    """

    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache: Dict[str, VADDetector] = {}

        logger.info("=" * 70)
        logger.info("🎤 VoiceService v2.2 успешно инициализирован")
        logger.info(f" DeepGram STT : {'✅' if self.deepgram_key else '❌'}")
        logger.info(f" Yandex TTS   : {'✅' if self.yandex_key else '❌'}")
        logger.info(f" VAD Mode     : {VAD_MODE}")
        logger.info("=" * 70)

        if not self.deepgram_key:
            logger.warning("⚠️ DEEPGRAM_API_KEY не настроен!")
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_API_KEY не настроен!")

    # ====================== Основные методы ======================
    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        return await speech_to_text(audio_bytes, audio_format)

    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """Возвращает аудио в base64 (для JSON-ответов)"""
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
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

    # ====================== VAD управление ======================
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
        """Закрытие всех ресурсов"""
        await close_http_client()
        self.clear_vad_cache()
        logger.info("🔒 VoiceService полностью закрыт")


# ============================================
# ФАБРИКА ДЛЯ СОЗДАНИЯ СЕРВИСА
# ============================================
def create_voice_service() -> VoiceService:
    """Фабрика для создания экземпляра VoiceService"""
    return VoiceService()


# ============================================
# ФУНКЦИЯ ДЛЯ ОТЛАДКИ
# ============================================
async def save_audio_debug(audio_bytes: bytes, prefix: str = "audio") -> Optional[str]:
    """Сохраняет аудио в /tmp для отладки"""
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
