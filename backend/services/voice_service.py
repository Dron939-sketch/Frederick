#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка живого голосового диалога (WebSocket + VAD + Barge-in)
Адаптирован из рабочего кода Telegram-бота MAX

ВЕРСИЯ 2.0 - С ПОДДЕРЖКОЙ ГОЛОСА БЕНДЕРА 🦾
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

# DeepGram для STT
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

# Yandex для TTS
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

# VAD настройки
VAD_MODE = int(os.getenv("VAD_MODE", "3"))  # 0-3, 3 - самая агрессивная
VAD_SAMPLE_RATE = 16000

# ============================================
# ГОЛОСА YANDEX TTS ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================

VOICES = {
    "psychologist": "ermil",    # спокойный мужской
    "coach": "filipp",          # энергичный мужской  
    "trainer": "alena",         # бодрый женский
    "basic": "filipp",          # 👈 БЕНДЕР: энергичный мужской голос
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
        "speed": 1.18,           # 👈 БЫСТРЕЕ ОБЫЧНОГО
        "emotion": "good",       # 👈 ВЕСЕЛЫЙ, БОДРЫЙ ТОН
        "description": "Бендер — дерзкий, быстрый, с юмором",
        "add_flavor": True       # 👈 ДОБАВЛЯТЬ ФИРМЕННЫЕ ФРАЗЫ
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
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ БЕНДЕРА
# ============================================

def add_bender_flavor(text: str) -> str:
    """
    Добавляет фирменные бендеровские вставки в текст
    """
    original_text = text
    
    # Добавляем случайную фразу в начало, если её нет
    if not any(p.strip() in text for p in BENDER_PREFIXES):
        prefix = random.choice(BENDER_PREFIXES)
        text = prefix + text[0].lower() + text[1:] if text else prefix
    
    # Добавляем эмодзи в конец, если нет
    if not any(emoji in text for emoji in ["🦾", "🤖", "😎", "🎭", "🔥", "💪"]):
        if len(text) < 500:
            suffix = random.choice(BENDER_SUFFIXES)
            text = text.rstrip() + suffix
    
    # Заменяем многоточия на паузы для драматического эффекта
    text = text.replace("...", " <break time='400ms'/> ")
    text = text.replace("!", "! <break time='200ms'/> ")
    text = text.replace("?", "? <break time='250ms'/> ")
    
    # Добавляем фирменные бендеровские слова, если их нет
    bender_words = ["братец", "сударь", "детка", "комбинатор", "банан"]
    if not any(word in text.lower() for word in bender_words):
        # Вставляем обращение в середину, если текст длинный
        if len(text) > 50:
            address = random.choice(["братец", "сударь", "друг мой"])
            words = text.split()
            insert_pos = min(len(words) // 2, 5)
            words.insert(insert_pos, address + ",")
            text = " ".join(words)
    
    logger.debug(f"✨ Бендеровская обработка текста: {len(original_text)} -> {len(text)} символов")
    return text


# ============================================
# VAD - Voice Activity Detection
# ============================================

class VADDetector:
    """
    Voice Activity Detector для потокового аудио
    Определяет начало и конец речи для живого диалога
    """
    
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        self.sample_rate = sample_rate
        self.mode = mode
        self.frame_duration = 30  # ms
        self.frame_size = int(sample_rate * self.frame_duration / 1000)
        
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False
        
        # Пороги для определения речи
        self.speech_trigger_frames = 3   # 3 кадра = 90ms для начала речи
        self.silence_trigger_frames = 10 # 10 кадров = 300ms для окончания речи
        
        self.energy_threshold = 0.01  # Порог энергии для упрощенного VAD
        
        # WebRTC VAD если доступен
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
        """Сброс состояния детектора"""
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False
    
    def _calculate_energy(self, audio_chunk: bytes) -> float:
        """Вычисляет энергию аудио чанка"""
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_array.astype(np.float32)**2))
            return rms / 32768.0
        except:
            return 0.0
    
    def _is_speech_energy(self, audio_chunk: bytes) -> bool:
        """Упрощенный VAD на основе энергии"""
        return self._calculate_energy(audio_chunk) > self.energy_threshold
    
    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        """VAD через WebRTC"""
        if not self.has_vad:
            return self._is_speech_energy(audio_chunk)
        
        if len(audio_chunk) != self.frame_size * 2:
            return self._is_speech_energy(audio_chunk)
        
        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except:
            return self._is_speech_energy(audio_chunk)
    
    def process_chunk(self, audio_chunk: bytes) -> Dict[str, Any]:
        """
        Обрабатывает чанк аудио и возвращает состояние
        
        Returns:
            {
                "is_speech": bool,      # есть ли речь в этом чанке
                "speech_started": bool, # только что началась речь
                "speech_ended": bool,   # только что закончилась речь
                "is_speaking": bool,    # текущее состояние
                "energy": float         # энергия аудио
            }
        """
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
    """
    Распознает речь из аудио через DeepGram API
    
    Args:
        audio_bytes: байты аудиофайла
        audio_format: формат аудио (webm, ogg, wav, mp3)
    
    Returns:
        распознанный текст или None
    """
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")
    
    if not DEEPGRAM_API_KEY:
        logger.error("❌ DEEPGRAM_API_KEY не настроен")
        return None
    
    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None
    
    # Определяем MIME тип
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
        
        logger.info(f"📡 Отправка запроса в DeepGram (model=nova-2, language=ru)...")
        
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
                
        elif response.status_code == 401:
            logger.error("❌ Неверный API ключ DeepGram")
            return None
        elif response.status_code == 429:
            logger.error("❌ Превышен лимит запросов DeepGram")
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
    """
    Преобразует текст в речь через Yandex TTS
    С поддержкой специального голоса для Бендера (режим basic)
    """
    logger.info(f"🎤 Синтез речи (Yandex TTS), режим: {mode}, текст: {text[:100]}...")
    
    if not YANDEX_API_KEY:
        logger.error("❌ YANDEX_API_KEY не настроен")
        logger.info("💡 Добавьте YANDEX_API_KEY в переменные окружения Render")
        return None
    
    # Получаем настройки для режима
    settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])
    voice = VOICES.get(mode, VOICES["default"])
    
    logger.info(f"🗣️ Голос: {voice}, скорость: {settings['speed']}, эмоция: {settings['emotion']}")
    logger.info(f"📝 Описание: {settings.get('description', 'стандартный')}")
    
    # ========== ДЛЯ БЕНДЕРА: добавляем фирменные фразы ==========
    if mode == "basic" and settings.get("add_flavor", False):
        original_text = text
        text = add_bender_flavor(text)
        logger.debug(f"✨ Бендеровская обработка: '{original_text[:50]}...' -> '{text[:80]}...'")
    
    # Ограничиваем длину текста (Yandex TTS лимит ~5000 символов)
    if len(text) > 4500:
        text = text[:4500] + "..."
        logger.warning(f"⚠️ Текст обрезан до 4500 символов")
    
    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    # Формируем данные для запроса
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
        
        logger.info(f"📡 Отправка запроса в Yandex TTS, voice={voice}, speed={settings['speed']}")
        
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
    """
    ПОТОКОВОЕ распознавание речи с VAD для живого диалога
    
    Args:
        audio_stream: асинхронный генератор аудио чанков (bytes)
        sample_rate: частота дискретизации
        on_transcript: callback при получении транскрипта (text, is_final)
        on_speech_start: callback при начале речи
        on_speech_end: callback при окончании речи
    
    Yields:
        Dict с результатами VAD и распознавания
    """
    vad = VADDetector(sample_rate, VAD_MODE)
    audio_buffer = bytearray()
    current_utterance = []
    is_collecting = False
    
    logger.info("🎤 Запуск потокового распознавания речи")
    
    async for chunk in audio_stream:
        if not chunk:
            continue
        
        vad_result = vad.process_chunk(chunk)
        
        # Начало речи
        if vad_result["speech_started"]:
            logger.info("🗣️ Речь началась")
            if on_speech_start:
                await on_speech_start()
            is_collecting = True
            audio_buffer.clear()
            current_utterance.clear()
        
        # Собираем аудио
        if is_collecting:
            audio_buffer.extend(chunk)
        
        # Окончание речи
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
    """
    ПОТОКОВЫЙ синтез речи - отправляет аудио чанками
    Позволяет прерывать воспроизведение (barge-in)
    
    Args:
        text: текст для озвучивания
        mode: режим голоса
        chunk_size: размер чанка для отправки
    
    Yields:
        bytes: чанки аудио
    """
    logger.info(f"🎤 Потоковый синтез речи, режим: {mode}, текст: {text[:100]}...")
    
    audio_bytes = await text_to_speech(text, mode)
    
    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            # Небольшая задержка для имитации потоковости
            await asyncio.sleep(0.01)
        
        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """
    Сервис для работы с голосом
    Поддерживает:
    - Распознавание речи (DeepGram)
    - Синтез речи (Yandex TTS) с поддержкой Бендера
    - Потоковую обработку для живого диалога
    - VAD для определения начала/конца речи
    - Barge-in (возможность перебивать ИИ)
    """
    
    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache = {}  # Кэш VAD детекторов по user_id
        
        # Настройки для разных режимов
        self.voice_settings = VOICE_SETTINGS
        self.voices = VOICES
        
        logger.info("=" * 60)
        logger.info("🎤 VoiceService инициализирован")
        logger.info(f"  DeepGram (STT): {'✅' if self.deepgram_key else '❌'}")
        logger.info(f"  Yandex TTS: {'✅' if self.yandex_key else '❌'}")
        logger.info(f"  VAD Mode: {VAD_MODE}")
        logger.info("")
        logger.info("  🗣️ Доступные голоса:")
        for mode, settings in VOICE_SETTINGS.items():
            voice = VOICES.get(mode, "default")
            logger.info(f"     • {mode}: {voice} (speed={settings['speed']}, emotion={settings['emotion']})")
        logger.info("=" * 60)
        
        if not self.deepgram_key:
            logger.warning("⚠️ DEEPGRAM_API_KEY не настроен! Распознавание речи не будет работать.")
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_API_KEY не настроен! Синтез речи не будет работать.")
    
    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        """Распознавание речи (не потоковое)"""
        return await speech_to_text(audio_bytes, audio_format)
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Синтез речи, возвращает base64 строку с аудио
        """
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None

    async def speech_to_text_pcm(self, pcm_bytes: bytes, sample_rate: int = 16000) -> Optional[str]:
        """
        Распознавание речи из сырых PCM данных (linear16)
        """
        logger.info(f"🎤 Распознавание PCM, размер: {len(pcm_bytes)} байт, sample_rate: {sample_rate}")
        
        if not DEEPGRAM_API_KEY:
            logger.error("❌ DEEPGRAM_API_KEY не настроен")
            return None
        
        MIN_AUDIO_BYTES = 16000  # 0.5 секунды при 16kHz
        if len(pcm_bytes) < MIN_AUDIO_BYTES:
            logger.warning(f"⚠️ Аудио слишком короткое: {len(pcm_bytes)} байт, нужно минимум {MIN_AUDIO_BYTES}")
            return None
        
        # Проверяем громкость
        try:
            audio_array = np.frombuffer(pcm_bytes, dtype=np.int16)
            max_amp = np.max(np.abs(audio_array))
            avg_amp = np.mean(np.abs(audio_array))
            logger.info(f"🔊 Анализ PCM: max={max_amp}, avg={avg_amp:.2f}")
            
            if max_amp < 800:
                logger.warning(f"⚠️ Аудио слишком тихое (max={max_amp}), речь не распознается")
                return None
            else:
                logger.info(f"✅ Аудио нормальной громкости (max={max_amp})")
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
            "interim_results": "false",
            "vad_events": "false",
            "detect_language": "false"
        }
        
        try:
            client = await get_http_client()
            
            logger.info(f"📡 Отправка PCM в DeepGram (model=nova-2, language=ru)...")
            
            response = await client.post(
                DEEPGRAM_API_URL,
                headers=headers,
                params=params,
                content=pcm_bytes,
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                try:
                    transcript = data['results']['channels'][0]['alternatives'][0].get('transcript', '')
                    confidence = data['results']['channels'][0]['alternatives'][0].get('confidence', 0)
                    
                    logger.info(f"📝 DeepGram результат: '{transcript}' (уверенность: {confidence:.2f})")
                    
                    if transcript and transcript.strip():
                        return transcript.strip()
                    else:
                        logger.warning("⚠️ DeepGram вернул пустой текст")
                        return None
                        
                except (KeyError, IndexError) as e:
                    logger.error(f"❌ Не удалось извлечь транскрипт: {e}")
                    return None
                    
            elif response.status_code == 401:
                logger.error("❌ Неверный API ключ DeepGram")
                return None
            elif response.status_code == 429:
                logger.error("❌ Превышен лимит запросов DeepGram")
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
        """Синтез речи, возвращает байты аудио"""
        return await text_to_speech(text, mode)
    
    async def speech_to_text_streaming(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
        on_transcript: Optional[Callable] = None,
        on_speech_start: Optional[Callable] = None,
        on_speech_end: Optional[Callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Потоковое распознавание речи с VAD для живого диалога
        """
        async for result in speech_to_text_streaming(
            audio_stream, sample_rate,
            on_transcript, on_speech_start, on_speech_end
        ):
            yield result
    
    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        """
        Потоковый синтез речи - отправляет аудио чанками
        Позволяет прерывать воспроизведение (barge-in)
        """
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk
    
    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
        """
        Создает детектор активности речи для пользователя
        
        Args:
            user_id: ID пользователя (для кэширования)
            sample_rate: частота дискретизации
            mode: агрессивность VAD (0-3)
        
        Returns:
            VADDetector
        """
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
        """Очищает кэш VAD детекторов"""
        if user_id is not None:
            to_remove = [k for k in self._vad_cache if k.startswith(f"{user_id}:")]
            for key in to_remove:
                del self._vad_cache[key]
            logger.info(f"🗑️ Очищен кэш VAD для user_id={user_id}")
        else:
            self._vad_cache.clear()
            logger.info("🗑️ Очищен весь кэш VAD")
    
    def get_voice_info(self, mode: str = "psychologist") -> Dict[str, Any]:
        """
        Возвращает информацию о голосе для режима
        """
        return {
            "mode": mode,
            "voice": VOICES.get(mode, VOICES["default"]),
            "settings": VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"]),
            "available_modes": list(VOICE_SETTINGS.keys())
        }
    
    async def close(self):
        """Закрывает соединения"""
        await close_http_client()
        self.clear_vad_cache()
        logger.info("🔒 VoiceService закрыт")


# ============================================
# ФАБРИКА
# ============================================

def create_voice_service() -> VoiceService:
    """Создает экземпляр VoiceService"""
    return VoiceService()


# ============================================
# ФУНКЦИЯ ДЛЯ ОТЛАДКИ
# ============================================

async def save_audio_debug(audio_bytes: bytes, prefix: str = "audio") -> Optional[str]:
    """
    Сохраняет аудио для отладки
    """
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
