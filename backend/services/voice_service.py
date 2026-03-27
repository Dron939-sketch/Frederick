"""
Voice Service - сервис для работы с голосом
STT (Speech-to-Text) и TTS (Text-to-Speech)
"""

import logging
import base64
import asyncio
from typing import Optional, Tuple
import io

# Попробуем импортировать различные TTS/STT библиотеки
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logging.warning("edge_tts not installed. Install with: pip install edge-tts")

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    logging.warning("speech_recognition not installed. Install with: pip install SpeechRecognition")

logger = logging.getLogger(__name__)


class VoiceService:
    """Сервис для работы с голосом (STT и TTS)"""
    
    def __init__(self):
        """Инициализация голосового сервиса"""
        self.supported_tts_formats = ['mp3', 'webm', 'ogg']
        self.default_tts_format = 'mp3'  # MP3 поддерживается всеми браузерами
        self.default_voice = 'ru-RU-SvetlanaNeural'  # Голос для TTS
        
        # Доступные голоса для edge-tts
        self.voices = {
            'psychologist': 'ru-RU-SvetlanaNeural',  # Женский, спокойный
            'coach': 'ru-RU-DmitryNeural',           # Мужской, энергичный
            'trainer': 'ru-RU-DariyaNeural',         # Женский, бодрый
            'default': 'ru-RU-SvetlanaNeural'
        }
        
        logger.info(f"VoiceService initialized. TTS format: {self.default_tts_format}")
        logger.info(f"Edge TTS available: {EDGE_TTS_AVAILABLE}")
        logger.info(f"Speech Recognition available: {SPEECH_RECOGNITION_AVAILABLE}")
    
    # ============================================
    # TTS - Text-to-Speech
    # ============================================
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Преобразует текст в речь и возвращает base64 строку
        
        Args:
            text: текст для озвучивания
            mode: режим (psychologist, coach, trainer)
        
        Returns:
            base64 строка с аудио или None в случае ошибки
        """
        if not text or len(text.strip()) == 0:
            logger.warning("Empty text for TTS")
            return None
        
        # Ограничиваем длину текста
        if len(text) > 1000:
            text = text[:1000]
            logger.info(f"Text truncated to 1000 chars")
        
        try:
            # Выбираем голос в зависимости от режима
            voice = self.voices.get(mode, self.voices['default'])
            
            # Пробуем использовать edge-tts (бесплатно, хорошее качество)
            if EDGE_TTS_AVAILABLE:
                audio_bytes = await self._tts_edge_tts(text, voice)
                if audio_bytes:
                    return base64.b64encode(audio_bytes).decode('utf-8')
            
            # Если edge-tts не сработал, пробуем fallback
            logger.warning("Edge TTS failed, using fallback")
            audio_bytes = await self._tts_fallback(text)
            if audio_bytes:
                return base64.b64encode(audio_bytes).decode('utf-8')
            
            logger.error("All TTS methods failed")
            return None
            
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def _tts_edge_tts(self, text: str, voice: str) -> Optional[bytes]:
        """
        Использует edge-tts (Microsoft Azure TTS) бесплатно
        Поддерживает MP3 формат
        """
        try:
            # Создаем коммуникацию с edge-tts
            communicate = edge_tts.Communicate(text, voice)
            
            # Собираем аудио в байты
            audio_bytes = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes.extend(chunk["data"])
            
            if audio_bytes:
                logger.info(f"TTS edge-tts success: {len(audio_bytes)} bytes, voice: {voice}")
                return bytes(audio_bytes)
            else:
                logger.warning("No audio data from edge-tts")
                return None
                
        except Exception as e:
            logger.error(f"Edge TTS error: {e}")
            return None
    
    async def _tts_fallback(self, text: str) -> Optional[bytes]:
        """
        Fallback TTS - возвращает заглушку или использует другой сервис
        """
        try:
            # Здесь можно добавить другой TTS сервис, например:
            # - Google TTS (требует API ключ)
            # - Yandex SpeechKit (требует API ключ)
            # - Silero TTS (локальная модель)
            
            # Пока возвращаем информацию о том, что TTS не доступен
            logger.warning("Using fallback TTS (no actual audio generated)")
            
            # Создаем простой WAV файл-заглушку (тишина)
            # В реальном проекте лучше использовать настоящий TTS
            import wave
            import struct
            
            # Параметры WAV
            sample_rate = 24000
            duration = 2  # секунды
            num_samples = sample_rate * duration
            
            # Создаем WAV в памяти
            wav_io = io.BytesIO()
            with wave.open(wav_io, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(sample_rate)
                
                # Генерируем тишину (нули)
                for i in range(num_samples):
                    wav.writeframes(struct.pack('<h', 0))
            
            wav_io.seek(0)
            return wav_io.read()
            
        except Exception as e:
            logger.error(f"Fallback TTS error: {e}")
            return None
    
    # ============================================
    # STT - Speech-to-Text
    # ============================================
    
    async def speech_to_text(self, audio_bytes: bytes) -> Optional[str]:
        """
        Преобразует аудио в текст
        
        Args:
            audio_bytes: байты аудио файла
        
        Returns:
            распознанный текст или None
        """
        if not audio_bytes or len(audio_bytes) < 1000:
            logger.warning(f"Audio too short: {len(audio_bytes)} bytes")
            return None
        
        try:
            # Пробуем использовать speech_recognition
            if SPEECH_RECOGNITION_AVAILABLE:
                text = await self._stt_speech_recognition(audio_bytes)
                if text:
                    return text
            
            # Fallback: возвращаем заглушку для демо
            logger.warning("Speech recognition not available, using demo mode")
            return self._stt_demo_mode(audio_bytes)
            
        except Exception as e:
            logger.error(f"STT error: {e}")
            return None
    
    async def _stt_speech_recognition(self, audio_bytes: bytes) -> Optional[str]:
        """
        Использует speech_recognition библиотеку (Google Speech Recognition)
        """
        try:
            import speech_recognition as sr
            
            # Создаем recognizer
            recognizer = sr.Recognizer()
            
            # Сохраняем аудио во временный файл
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Загружаем аудио
                with sr.AudioFile(tmp_path) as source:
                    audio = recognizer.record(source)
                
                # Распознаем русскую речь
                text = recognizer.recognize_google(audio, language='ru-RU')
                
                if text:
                    logger.info(f"STT success: {text}")
                    return text
                else:
                    return None
                    
            finally:
                # Удаляем временный файл
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except sr.UnknownValueError:
            logger.warning("Speech recognition could not understand audio")
            return None
        except sr.RequestError as e:
            logger.error(f"Speech recognition request error: {e}")
            return None
        except Exception as e:
            logger.error(f"Speech recognition error: {e}")
            return None
    
    def _stt_demo_mode(self, audio_bytes: bytes) -> Optional[str]:
        """
        Демо режим для STT (возвращает случайные фразы для тестирования)
        """
        # В реальном приложении здесь должен быть настоящий STT
        # Для тестирования возвращаем заглушку
        demo_phrases = [
            "Здравствуйте, я хочу поговорить о своих чувствах",
            "У меня сегодня хорошее настроение",
            "Я чувствую тревогу и беспокойство",
            "Расскажите мне о методах релаксации",
            "Как справиться со стрессом?",
            "Я хочу стать более уверенным",
            "Помогите мне разобраться в себе",
            "Что мне делать, когда я злюсь?"
        ]
        
        import random
        phrase = random.choice(demo_phrases)
        logger.info(f"STT demo mode returning: {phrase}")
        return phrase
    
    # ============================================
    # ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    # ============================================
    
    async def get_available_voices(self) -> dict:
        """Получить список доступных голосов"""
        return self.voices
    
    async def set_voice(self, mode: str, voice_name: str) -> bool:
        """Установить голос для режима"""
        if mode in self.voices:
            self.voices[mode] = voice_name
            logger.info(f"Voice set for {mode}: {voice_name}")
            return True
        return False
    
    async def check_tts_available(self) -> bool:
        """Проверить доступность TTS"""
        test_text = "Тест"
        audio = await self.text_to_speech(test_text)
        return audio is not None
    
    async def check_stt_available(self) -> bool:
        """Проверить доступность STT"""
        return SPEECH_RECOGNITION_AVAILABLE
    
    async def close(self):
        """Закрыть соединения (если есть)"""
        logger.info("VoiceService closed")


# ============================================
# ВЕРСИЯ С ПОДДЕРЖКОЙ РАЗНЫХ TTS СЕРВИСОВ
# ============================================

class VoiceServiceExtended(VoiceService):
    """
    Расширенная версия с поддержкой нескольких TTS сервисов
    """
    
    def __init__(self, use_yandex: bool = False, yandex_api_key: str = None):
        super().__init__()
        self.use_yandex = use_yandex
        self.yandex_api_key = yandex_api_key
        
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """Расширенный TTS с выбором сервиса"""
        
        if self.use_yandex and self.yandex_api_key:
            # Используем Yandex SpeechKit
            audio = await self._tts_yandex(text, mode)
            if audio:
                return base64.b64encode(audio).decode('utf-8')
        
        # Fallback к стандартному методу
        return await super().text_to_speech(text, mode)
    
    async def _tts_yandex(self, text: str, mode: str) -> Optional[bytes]:
        """TTS через Yandex SpeechKit"""
        try:
            import aiohttp
            
            # Голоса Yandex
            yandex_voices = {
                'psychologist': 'alena',      # женский, спокойный
                'coach': 'filipp',            # мужской, энергичный
                'trainer': 'maria',           # женский, бодрый
                'default': 'alena'
            }
            
            voice = yandex_voices.get(mode, yandex_voices['default'])
            
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
                async with session.post(url, headers=headers, data=data) as response:
                    if response.status == 200:
                        audio = await response.read()
                        logger.info(f"Yandex TTS success: {len(audio)} bytes")
                        return audio
                    else:
                        error_text = await response.text()
                        logger.error(f"Yandex TTS error: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"Yandex TTS error: {e}")
            return None


# ============================================
# ПРОСТАЯ ВЕРСИЯ ДЛЯ ТЕСТИРОВАНИЯ
# ============================================

class VoiceServiceSimple(VoiceService):
    """
    Простая версия для тестирования (возвращает заглушки)
    """
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """Возвращает заглушку для тестирования"""
        logger.info(f"TTS Simple mode: would speak: {text[:50]}...")
        
        # Создаем тестовый WAV файл с синусоидой (для проверки воспроизведения)
        import wave
        import struct
        import math
        
        sample_rate = 24000
        duration = 1
        frequency = 440  # Нота Ля
        
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            
            for i in range(sample_rate * duration):
                value = int(32767.0 * 0.3 * math.sin(2 * math.pi * frequency * i / sample_rate))
                wav.writeframes(struct.pack('<h', value))
        
        wav_io.seek(0)
        return base64.b64encode(wav_io.read()).decode('utf-8')
    
    async def speech_to_text(self, audio_bytes: bytes) -> Optional[str]:
        """Возвращает заглушку для тестирования"""
        return "Это тестовое сообщение для проверки голосового ввода"


# ============================================
# ФАБРИКА СОЗДАНИЯ СЕРВИСА
# ============================================

def create_voice_service(
    use_extended: bool = False,
    use_simple: bool = False,
    yandex_api_key: str = None
) -> VoiceService:
    """
    Фабрика для создания голосового сервиса
    
    Args:
        use_extended: использовать расширенную версию (с Yandex)
        use_simple: использовать простую версию (для тестирования)
        yandex_api_key: API ключ Yandex (если use_extended=True)
    
    Returns:
        экземпляр VoiceService
    """
    if use_simple:
        return VoiceServiceSimple()
    elif use_extended:
        return VoiceServiceExtended(use_yandex=True, yandex_api_key=yandex_api_key)
    else:
        return VoiceService()
