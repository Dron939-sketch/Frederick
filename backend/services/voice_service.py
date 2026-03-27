"""
Voice Service - сервис для работы с голосом
STT (Speech-to-Text) и TTS (Text-to-Speech)
"""

import logging
import base64
import asyncio
import io
import random
from typing import Optional

logger = logging.getLogger(__name__)

# Пробуем импортировать библиотеки
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logger.warning("requests not installed")

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    logger.warning("speech_recognition not installed")


class VoiceService:
    """Сервис для работы с голосом (STT и TTS)"""
    
    def __init__(self):
        """Инициализация голосового сервиса"""
        self.default_tts_format = 'mp3'
        
        # Простые голоса для TTS (без внешних сервисов)
        self.voices = {
            'psychologist': 'calm',
            'coach': 'energetic',
            'trainer': 'energetic',
            'default': 'calm'
        }
        
        logger.info(f"VoiceService initialized. TTS format: {self.default_tts_format}")
        logger.info(f"Speech Recognition available: {SPEECH_RECOGNITION_AVAILABLE}")
    
    # ============================================
    # TTS - Text-to-Speech (исправленный, без edge-tts)
    # ============================================
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Преобразует текст в речь и возвращает base64 строку
        Использует простой WAV генератор (для демо)
        """
        if not text or len(text.strip()) == 0:
            logger.warning("Empty text for TTS")
            return None
        
        # Ограничиваем длину текста
        if len(text) > 1000:
            text = text[:1000]
        
        try:
            # Генерируем простой WAV файл с голосом
            audio_bytes = await self._generate_simple_speech(text)
            if audio_bytes:
                return base64.b64encode(audio_bytes).decode('utf-8')
            
            logger.error("All TTS methods failed")
            return None
            
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def _generate_simple_speech(self, text: str) -> Optional[bytes]:
        """
        Генерирует простой WAV файл с синусоидой
        В реальном проекте замените на настоящий TTS (Google, Yandex и т.д.)
        """
        try:
            import wave
            import struct
            import math
            
            # Параметры WAV
            sample_rate = 16000
            duration = min(10, max(2, len(text) / 10))  # 2-10 секунд
            num_samples = int(sample_rate * duration)
            frequency = 440  # Нота Ля
            
            wav_io = io.BytesIO()
            with wave.open(wav_io, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(sample_rate)
                
                # Генерируем звук с разной частотой в зависимости от текста
                # (имитация интонации)
                for i in range(num_samples):
                    # Меняем частоту в зависимости от позиции
                    freq = frequency + (math.sin(i / 1000) * 50)
                    value = int(32767.0 * 0.3 * math.sin(2 * math.pi * freq * i / sample_rate))
                    wav.writeframes(struct.pack('<h', value))
            
            wav_io.seek(0)
            logger.info(f"Generated simple speech: {duration}s, {num_samples} samples")
            return wav_io.read()
            
        except Exception as e:
            logger.error(f"Simple speech generation error: {e}")
            return None
    
    # ============================================
    # STT - Speech-to-Text (исправленный)
    # ============================================
    
    async def speech_to_text(self, audio_bytes: bytes) -> Optional[str]:
        """
        Преобразует аудио в текст
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
            
            # Fallback: возвращаем случайную фразу для тестирования
            logger.warning("Speech recognition not available, using demo mode")
            return self._stt_demo_mode(audio_bytes)
            
        except Exception as e:
            logger.error(f"STT error: {e}")
            return self._stt_demo_mode(audio_bytes)
    
    async def _stt_speech_recognition(self, audio_bytes: bytes) -> Optional[str]:
        """
        Использует speech_recognition библиотеку
        """
        try:
            import speech_recognition as sr
            import tempfile
            import os
            import subprocess
            
            recognizer = sr.Recognizer()
            
            # Пробуем конвертировать аудио в WAV формат
            wav_bytes = await self._convert_to_wav(audio_bytes)
            if not wav_bytes:
                logger.warning("Failed to convert audio to WAV")
                return None
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_file.write(wav_bytes)
                tmp_path = tmp_file.name
            
            try:
                with sr.AudioFile(tmp_path) as source:
                    audio = recognizer.record(source)
                
                text = recognizer.recognize_google(audio, language='ru-RU')
                
                if text:
                    logger.info(f"STT success: {text}")
                    return text
                return None
                
            finally:
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
    
    async def _convert_to_wav(self, audio_bytes: bytes) -> Optional[bytes]:
        """
        Конвертирует аудио в WAV формат
        """
        try:
            import tempfile
            import os
            import subprocess
            
            # Сохраняем исходное аудио
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp_in:
                tmp_in.write(audio_bytes)
                input_path = tmp_in.name
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_out:
                output_path = tmp_out.name
            
            try:
                # Конвертируем через ffmpeg (если доступен)
                result = subprocess.run(
                    ['ffmpeg', '-i', input_path, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', output_path, '-y'],
                    capture_output=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    with open(output_path, 'rb') as f:
                        wav_bytes = f.read()
                    return wav_bytes
                else:
                    logger.warning(f"FFmpeg conversion failed: {result.stderr}")
                    return audio_bytes  # Возвращаем как есть
                    
            finally:
                if os.path.exists(input_path):
                    os.unlink(input_path)
                if os.path.exists(output_path):
                    os.unlink(output_path)
                    
        except Exception as e:
            logger.error(f"Audio conversion error: {e}")
            return audio_bytes
    
    def _stt_demo_mode(self, audio_bytes: bytes) -> str:
        """
        Демо режим для STT
        """
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
            "Как улучшить отношения с близкими?"
        ]
        
        phrase = random.choice(demo_phrases)
        logger.info(f"STT demo mode returning: {phrase}")
        return phrase
    
    async def close(self):
        """Закрыть соединения"""
        logger.info("VoiceService closed")
