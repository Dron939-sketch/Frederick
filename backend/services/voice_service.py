#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка Yandex TTS и потоковой обработки
"""

import logging
import base64
import asyncio
import os
import tempfile
import time
import traceback
from typing import Optional, Dict, Any, AsyncGenerator, Callable

import numpy as np
import aiohttp
import httpx

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ
# ============================================

# Yandex TTS
YANDEX_TTS_API_KEY = os.getenv("YANDEX_TTS_API_KEY", "")
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

# VAD настройки
VAD_MODE = int(os.getenv("VAD_MODE", "3"))
VAD_SAMPLE_RATE = 16000

# Голоса Yandex TTS
YANDEX_VOICES = {
    "psychologist": "alena",      # женский, спокойный, мягкий
    "coach": "filipp",            # мужской, энергичный, вдохновляющий
    "trainer": "oksana",          # женский, бодрый, мотивирующий
    "default": "alena"
}

# ============================================
# ГЛОБАЛЬНЫЙ HTTP КЛИЕНТ
# ============================================

_http_client = None
_client_lock = asyncio.Lock()

async def get_http_client():
    """Возвращает глобальный HTTPX клиент"""
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
    """Закрывает глобальный HTTPX клиент"""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("🔒 HTTPX клиент закрыт")


# ============================================
# VAD - Voice Activity Detection
# ============================================

class VADDetector:
    """Voice Activity Detector для потокового аудио"""
    
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        self.sample_rate = sample_rate
        self.mode = mode
        self.frame_duration = 30  # ms
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
        energy = self._calculate_energy(audio_chunk)
        return energy > self.energy_threshold
    
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
# STT - Speech-to-Text (SpeechRecognition)
# ============================================

async def speech_to_text(audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
    """Распознает речь из аудио через SpeechRecognition (Google)"""
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")
    
    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None
    
    import speech_recognition as sr
    from pydub import AudioSegment
    
    recognizer = sr.Recognizer()
    
    try:
        # Сохраняем во временный файл
        with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        # Конвертируем в WAV
        audio = AudioSegment.from_file(tmp_path)
        wav_path = tmp_path.replace(f".{audio_format}", ".wav")
        audio.export(wav_path, format="wav")
        
        # Читаем WAV
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
        
        # Очищаем временные файлы
        os.unlink(tmp_path)
        os.unlink(wav_path)
        
        # Распознаем
        text = recognizer.recognize_google(audio_data, language="ru-RU")
        logger.info(f"🎤 Распознано: '{text}'")
        
        return text.strip() if text else None
        
    except sr.UnknownValueError:
        logger.warning("⚠️ Речь не распознана")
        return None
    except sr.RequestError as e:
        logger.error(f"❌ Ошибка сервиса распознавания: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Ошибка распознавания: {e}")
        return None


# ============================================
# TTS - Text-to-Speech (Yandex)
# ============================================

async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    """
    Преобразует текст в речь через Yandex TTS
    
    Args:
        text: текст для озвучивания
        mode: режим (psychologist, coach, trainer)
    
    Returns:
        байты аудиофайла (MP3) или None
    """
    logger.info(f"🎤 Синтез речи (Yandex TTS), режим: {mode}, текст: {text[:100]}...")
    
    if not YANDEX_TTS_API_KEY:
        logger.error("❌ YANDEX_TTS_API_KEY не настроен")
        logger.info("💡 Добавьте YANDEX_TTS_API_KEY в переменные окружения Render")
        return None
    
    voice = YANDEX_VOICES.get(mode, YANDEX_VOICES["default"])
    logger.info(f"🗣️ Выбран голос: {voice}")
    
    # Ограничиваем длину текста
    if len(text) > 5000:
        text = text[:5000]
        logger.warning(f"⚠️ Текст обрезан до 5000 символов")
    
    headers = {
        "Authorization": f"Api-Key {YANDEX_TTS_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "text": text,
        "lang": "ru-RU",
        "voice": voice,
        "emotion": "neutral",
        "speed": 1.0,
        "format": "mp3"
    }
    
    try:
        client = await get_http_client()
        
        logger.info(f"📡 Отправка запроса в Yandex TTS...")
        
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
# ПОТОКОВЫЙ СИНТЕЗ РЕЧИ
# ============================================

async def text_to_speech_streaming(
    text: str,
    mode: str = "psychologist",
    chunk_size: int = 4096
) -> AsyncGenerator[bytes, None]:
    """
    ПОТОКОВЫЙ синтез речи - отправляет аудио чанками
    """
    logger.info(f"🎤 Потоковый синтез речи: {text[:100]}...")
    
    audio_bytes = await text_to_speech(text, mode)
    
    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            await asyncio.sleep(0.01)
        
        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """Сервис для работы с голосом с поддержкой Yandex TTS"""
    
    def __init__(self):
        self._vad_cache = {}
        self.yandex_key = YANDEX_TTS_API_KEY
        
        logger.info("VoiceService инициализирован")
        logger.info(f"  TTS: Yandex TTS {'✅' if self.yandex_key else '❌'}")
        logger.info(f"  STT: Google Speech Recognition")
        logger.info(f"  VAD Mode: {VAD_MODE}")
        
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_TTS_API_KEY не настроен! Голос не будет работать.")
    
    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        """Распознавание речи"""
        return await speech_to_text(audio_bytes, audio_format)
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Синтез речи, возвращает base64 строку с аудио
        """
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None
    
    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        """Синтез речи, возвращает байты аудио"""
        return await text_to_speech(text, mode)
    
    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        """Потоковый синтез речи"""
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk
    
    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
        """Создать детектор активности речи"""
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
        """Очистить кэш VAD детекторов"""
        if user_id is not None:
            to_remove = [k for k in self._vad_cache if k.startswith(f"{user_id}:")]
            for key in to_remove:
                del self._vad_cache[key]
            logger.info(f"🗑️ Очищен кэш VAD для user_id={user_id}")
        else:
            self._vad_cache.clear()
            logger.info("🗑️ Очищен весь кэш VAD")
    
    async def close(self):
        """Закрыть соединения"""
        await close_http_client()
        self.clear_vad_cache()
        logger.info("VoiceService закрыт")


# ============================================
# ФАБРИКА
# ============================================

def create_voice_service() -> VoiceService:
    """Создает экземпляр VoiceService"""
    return VoiceService()
