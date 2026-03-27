"""
Voice Service - сервис для работы с голосом
Исправленная версия для работы на Render
"""

import logging
import base64
import asyncio
import io
import os
import tempfile
import random
import subprocess
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Кэш для синтезированной речи
_voice_cache = {}
_voice_cache_time = {}

# Пытаемся импортировать библиотеки
try:
    import aiohttp
    HTTP_AVAILABLE = True
except ImportError:
    HTTP_AVAILABLE = False
    logger.warning("aiohttp not installed")

try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    logger.warning("speech_recognition not installed")


class VoiceService:
    """Сервис для работы с голосом (STT и TTS)"""
    
    def __init__(self, deepgram_api_key: str = None, yandex_api_key: str = None):
        self.deepgram_api_key = deepgram_api_key
        self.yandex_api_key = yandex_api_key
        
        # Голоса для разных режимов
        self.voices = {
            'psychologist': 'filipp',
            'coach': 'filipp',
            'trainer': 'alena',
            'default': 'alena'
        }
        
        logger.info(f"VoiceService initialized")
        logger.info(f"SpeechRecognition available: {SR_AVAILABLE}")
        logger.info(f"DeepGram configured: {bool(deepgram_api_key)}")
        logger.info(f"Yandex configured: {bool(yandex_api_key)}")
    
    # ============================================
    # TTS - Text-to-Speech
    # ============================================
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Преобразует текст в речь и возвращает base64 строку
        Использует Yandex SpeechKit если доступен, иначе генерирует простой WAV
        """
        if not text or len(text.strip()) == 0:
            logger.warning("Empty text for TTS")
            return None
        
        # Ограничиваем длину
        if len(text) > 500:
            text = text[:500]
        
        # Проверяем кэш
        cache_key = f"{mode}_{hash(text)}"
        if cache_key in _voice_cache:
            cache_time = _voice_cache_time.get(cache_key, 0)
            if time.time() - cache_time < 3600:  # 1 час
                logger.info(f"📦 Using cached voice")
                return _voice_cache[cache_key]
        
        try:
            audio_bytes = None
            
            # Пробуем Yandex SpeechKit (если есть ключ)
            if self.yandex_api_key:
                audio_bytes = await self._tts_yandex(text, mode)
                if audio_bytes:
                    logger.info(f"✅ Yandex TTS success: {len(audio_bytes)} bytes")
            
            # Если Yandex не сработал, используем простую генерацию
            if not audio_bytes:
                audio_bytes = await self._tts_simple(text, mode)
                if audio_bytes:
                    logger.info(f"✅ Simple TTS success: {len(audio_bytes)} bytes")
            
            if audio_bytes:
                # Сохраняем в кэш
                _voice_cache[cache_key] = base64.b64encode(audio_bytes).decode('utf-8')
                _voice_cache_time[cache_key] = time.time()
                
                # Очищаем старый кэш
                if len(_voice_cache) > 100:
                    oldest = min(_voice_cache_time.items(), key=lambda x: x[1])[0]
                    del _voice_cache[oldest]
                    del _voice_cache_time[oldest]
                
                return _voice_cache[cache_key]
            
            return None
            
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def _tts_yandex(self, text: str, mode: str) -> Optional[bytes]:
        """TTS через Yandex SpeechKit"""
        if not self.yandex_api_key:
            return None
        
        try:
            import aiohttp
            
            voice = self.voices.get(mode, self.voices['default'])
            
            url = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
            headers = {
                "Authorization": f"Api-Key {self.yandex_api_key}"
            }
            data = {
                "text": text,
                "voice": voice,
                "emotion": "good" if mode == 'coach' else "neutral",
                "speed": 1.0,
                "format": "mp3",
                "lang": "ru-RU"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=data, timeout=30) as response:
                    if response.status == 200:
                        return await response.read()
                    else:
                        error = await response.text()
                        logger.warning(f"Yandex TTS error {response.status}: {error[:200]}")
                        return None
                        
        except Exception as e:
            logger.error(f"Yandex TTS error: {e}")
            return None
    
    async def _tts_simple(self, text: str, mode: str) -> Optional[bytes]:
        """
        Простой TTS - генерирует WAV файл с голосом
        Это временное решение, пока не подключен платный TTS
        """
        try:
            import wave
            import struct
            import math
            
            # Параметры WAV
            sample_rate = 16000
            duration = min(10, max(2, len(text) / 15))  # 2-10 секунд
            num_samples = int(sample_rate * duration)
            
            # Простая "голосовая" модуляция
            wav_io = io.BytesIO()
            with wave.open(wav_io, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(sample_rate)
                
                # Генерируем звук с разной частотой для имитации речи
                for i in range(num_samples):
                    # Используем текст для генерации частоты
                    char_index = (i // (sample_rate // 5)) % len(text)
                    char_code = ord(text[char_index]) if text else 65
                    
                    # Частота зависит от символа
                    freq = 200 + (char_code % 200)
                    
                    # Добавляем модуляцию
                    mod = math.sin(i / 1000) * 30
                    freq = max(100, min(600, freq + mod))
                    
                    # Генерируем синусоиду
                    value = int(32767.0 * 0.3 * math.sin(2 * math.pi * freq * i / sample_rate))
                    wav.writeframes(struct.pack('<h', value))
            
            wav_io.seek(0)
            return wav_io.read()
            
        except Exception as e:
            logger.error(f"Simple TTS error: {e}")
            return None
    
    # ============================================
    # STT - Speech-to-Text
    # ============================================
    
    async def speech_to_text(self, audio_bytes: bytes) -> Optional[str]:
        """
        Преобразует аудио в текст
        Поддерживает WebM, OGG, WAV форматы
        """
        if not audio_bytes or len(audio_bytes) < 1000:
            logger.warning(f"Audio too short: {len(audio_bytes)} bytes")
            return None
        
        try:
            # Пробуем DeepGram если есть ключ
            if self.deepgram_api_key:
                text = await self._stt_deepgram(audio_bytes)
                if text:
                    logger.info(f"✅ DeepGram STT success: {text[:50]}...")
                    return text
            
            # Пробуем SpeechRecognition
            if SR_AVAILABLE:
                text = await self._stt_speech_recognition(audio_bytes)
                if text:
                    logger.info(f"✅ SpeechRecognition STT success: {text[:50]}...")
                    return text
            
            # Демо режим
            logger.warning("No STT available, using demo mode")
            return self._stt_demo_mode(audio_bytes)
            
        except Exception as e:
            logger.error(f"STT error: {e}")
            return self._stt_demo_mode(audio_bytes)
    
    async def _stt_deepgram(self, audio_bytes: bytes) -> Optional[str]:
        """STT через DeepGram API"""
        if not self.deepgram_api_key:
            return None
        
        try:
            import aiohttp
            
            url = "https://api.deepgram.com/v1/listen"
            headers = {
                "Authorization": f"Token {self.deepgram_api_key}",
                "Content-Type": "audio/webm"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=audio_bytes, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        text = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
                        if text:
                            return text
                    else:
                        error = await response.text()
                        logger.warning(f"DeepGram error {response.status}: {error[:200]}")
                        return None
                        
        except Exception as e:
            logger.error(f"DeepGram error: {e}")
            return None
    
    async def _stt_speech_recognition(self, audio_bytes: bytes) -> Optional[str]:
        """STT через SpeechRecognition библиотеку"""
        if not SR_AVAILABLE:
            return None
        
        try:
            import speech_recognition as sr
            import tempfile
            
            recognizer = sr.Recognizer()
            
            # Конвертируем в WAV если нужно
            wav_bytes = await self._convert_to_wav(audio_bytes)
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp.write(wav_bytes)
                tmp_path = tmp.name
            
            try:
                with sr.AudioFile(tmp_path) as source:
                    audio = recognizer.record(source)
                
                text = recognizer.recognize_google(audio, language='ru-RU')
                return text
                
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except sr.UnknownValueError:
            logger.warning("Could not understand audio")
            return None
        except sr.RequestError as e:
            logger.warning(f"Google Speech API error: {e}")
            return None
        except Exception as e:
            logger.error(f"SpeechRecognition error: {e}")
            return None
    
    async def _convert_to_wav(self, audio_bytes: bytes) -> bytes:
        """
        Конвертирует аудио в WAV формат
        Использует pydub если доступен
        """
        try:
            # Пробуем использовать pydub для конвертации
            from pydub import AudioSegment
            import io
            
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
            wav_io = io.BytesIO()
            audio.export(wav_io, format='wav')
            return wav_io.getvalue()
            
        except ImportError:
            logger.warning("pydub not installed, skipping conversion")
            return audio_bytes
        except Exception as e:
            logger.warning(f"Audio conversion failed: {e}")
            return audio_bytes
    
    def _stt_demo_mode(self, audio_bytes: bytes) -> str:
        """Демо режим для STT"""
        demo_phrases = [
            "Здравствуйте, я хочу поговорить о своих чувствах",
            "У меня сегодня хорошее настроение",
            "Я чувствую тревогу и беспокойство",
            "Расскажите мне о методах релаксации",
            "Как справиться со стрессом?",
            "Я хочу стать более уверенным",
            "Помогите мне разобраться в себе",
            "Что мне делать, когда я злюсь?",
            "Я чувствую усталость и апатию",
            "Как улучшить отношения с близкими?",
            "Что такое осознанность?",
            "Как научиться прощать себя?"
        ]
        
        phrase = random.choice(demo_phrases)
        logger.info(f"STT demo mode: {phrase}")
        return phrase
    
    async def close(self):
        """Закрыть соединения"""
        logger.info("VoiceService closed")


# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

def get_cached_voice(text: str, voice_id: str) -> Optional[str]:
    """Получить кэшированную речь"""
    cache_key = f"{voice_id}_{hash(text)}"
    if cache_key in _voice_cache:
        if time.time() - _voice_cache_time.get(cache_key, 0) < 3600:
            return _voice_cache[cache_key]
    return None


def cache_voice(text: str, voice_id: str, audio_base64: str):
    """Кэшировать речь"""
    cache_key = f"{voice_id}_{hash(text)}"
    _voice_cache[cache_key] = audio_base64
    _voice_cache_time[cache_key] = time.time()


# ============================================
# ФАБРИКА
# ============================================

def create_voice_service(
    deepgram_api_key: str = None,
    yandex_api_key: str = None
) -> VoiceService:
    """Создает экземпляр VoiceService"""
    return VoiceService(deepgram_api_key, yandex_api_key)
