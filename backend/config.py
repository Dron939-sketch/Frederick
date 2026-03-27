"""
Voice Service - сервис для работы с голосом
Использует DeepGram для STT и Yandex для TTS
"""

import logging
import base64
import asyncio
import os
import json
import time
import traceback
from typing import Optional, Dict, Any

import aiohttp
import httpx

# Импортируем конфигурацию
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    DEEPGRAM_API_KEY,
    YANDEX_API_KEY,
    DEEPGRAM_API_URL,
    YANDEX_TTS_API_URL,
    VOICE_SETTINGS,
    COMMUNICATION_MODES
)

logger = logging.getLogger(__name__)

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
        "diarize": "false",
        "smart_format": "true"
    }
    
    try:
        client = await get_http_client()
        
        logger.info(f"📡 Отправка запроса в DeepGram...")
        
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
                logger.debug(f"Ответ DeepGram: {json.dumps(data, ensure_ascii=False)[:500]}")
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
    logger.info(f"🎤 Синтез речи, режим: {mode}, текст: {text[:100]}...")
    
    if not YANDEX_API_KEY:
        logger.error("❌ YANDEX_API_KEY не настроен")
        return None
    
    # Получаем настройки голоса из конфигурации
    voice_settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["coach"])
    voice = voice_settings.get("voice", "filipp")
    emotion = voice_settings.get("emotion", "neutral")
    speed = voice_settings.get("speed", 1.0)
    
    # Также можно использовать голос из COMMUNICATION_MODES
    mode_config = COMMUNICATION_MODES.get(mode, COMMUNICATION_MODES["coach"])
    mode_voice = mode_config.get("voice", "filipp")
    
    # Приоритет у VOICE_SETTINGS
    final_voice = voice if voice else mode_voice
    
    logger.info(f"🗣️ Выбран голос: {final_voice}, эмоция: {emotion}, скорость: {speed}")
    
    # Ограничиваем длину текста
    original_length = len(text)
    if len(text) > 5000:
        text = text[:5000] + "..."
        logger.warning(f"⚠️ Текст обрезан с {original_length} до 5000 символов")
    
    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "text": text,
        "lang": "ru-RU",
        "voice": final_voice,
        "emotion": emotion,
        "speed": speed,
        "format": "mp3"  # MP3 поддерживается всеми браузерами
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
            logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт, формат: MP3")
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
# ФУНКЦИЯ ДЛЯ СОХРАНЕНИЯ АУДИО В ФАЙЛ (для отладки)
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


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """Сервис для работы с голосом"""
    
    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self.voice_settings = VOICE_SETTINGS
        self.modes = COMMUNICATION_MODES
        
        logger.info(f"VoiceService инициализирован")
        logger.info(f"  DeepGram: {'✅' if self.deepgram_key else '❌'}")
        logger.info(f"  Yandex TTS: {'✅' if self.yandex_key else '❌'}")
        
        if self.deepgram_key:
            logger.info(f"  DeepGram ключ: {self.deepgram_key[:10]}...")
        if self.yandex_key:
            logger.info(f"  Yandex ключ: {self.yandex_key[:10]}...")
    
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
    
    async def get_available_voices(self) -> Dict[str, Any]:
        """Получить доступные голоса"""
        return {
            "voices": VOICE_SETTINGS,
            "modes": {k: v.get("voice") for k, v in COMMUNICATION_MODES.items()}
        }
    
    async def check_tts_available(self) -> bool:
        """Проверить доступность TTS"""
        test_text = "Тест"
        audio = await self.text_to_speech(test_text)
        return audio is not None
    
    async def check_stt_available(self) -> bool:
        """Проверить доступность STT"""
        return bool(self.deepgram_key)
    
    async def close(self):
        """Закрыть соединения"""
        await close_http_client()
        logger.info("VoiceService закрыт")


# ============================================
# ФАБРИКА
# ============================================

def create_voice_service() -> VoiceService:
    """Создает экземпляр VoiceService"""
    return VoiceService()
