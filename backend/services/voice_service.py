"""
Сервис для работы с голосом (STT и TTS)
"""

import aiohttp
import asyncio
import base64
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class VoiceService:
    """Сервис для распознавания и синтеза речи"""
    
    def __init__(self):
        self.deepgram_key = os.environ.get('DEEPGRAM_API_KEY')
        self.yandex_key = os.environ.get('YANDEX_API_KEY')
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Получение HTTP сессии"""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def speech_to_text(self, audio_bytes: bytes, language: str = "ru-RU") -> Optional[str]:
        """
        Распознавание речи (STT) через Deepgram
        
        Args:
            audio_bytes: Аудио в формате webm/ogg
            language: Язык (ru-RU, en-US)
        """
        if not self.deepgram_key:
            logger.warning("DEEPGRAM_API_KEY not set")
            return None
        
        try:
            session = await self._get_session()
            
            async with session.post(
                "https://api.deepgram.com/v1/listen",
                headers={
                    "Authorization": f"Token {self.deepgram_key}",
                    "Content-Type": "audio/webm"
                },
                params={
                    "language": language,
                    "model": "nova-2",
                    "smart_format": True,
                    "punctuate": True
                },
                data=audio_bytes,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    text = data.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
                    if text:
                        logger.info(f"STT success: {text[:50]}...")
                        return text
                    else:
                        logger.warning("STT: empty transcript")
                        return None
                else:
                    error = await response.text()
                    logger.error(f"Deepgram error: {response.status} - {error}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("Deepgram timeout")
            return None
        except Exception as e:
            logger.error(f"STT error: {e}")
            return None
    
    async def text_to_speech(self, text: str, voice: str = "psychologist") -> Optional[str]:
        """
        Синтез речи (TTS) через Yandex SpeechKit
        
        Args:
            text: Текст для озвучивания
            voice: Голос (coach, psychologist, trainer)
        
        Returns:
            Base64 строка с аудио или None
        """
        if not self.yandex_key:
            logger.warning("YANDEX_API_KEY not set")
            return None
        
        # Выбираем голос в зависимости от режима
        voice_config = {
            'coach': 'alena',      # Женский, энергичный
            'psychologist': 'oksana',  # Женский, мягкий
            'trainer': 'filipp'    # Мужской, уверенный
        }
        
        voice_name = voice_config.get(voice, 'oksana')
        
        try:
            session = await self._get_session()
            
            # Yandex SpeechKit API v3
            async with session.post(
                "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                headers={
                    "Authorization": f"Api-Key {self.yandex_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "text": text,
                    "voice": voice_name,
                    "emotion": "good" if voice == 'coach' else "neutral",
                    "speed": 1.0,
                    "format": "oggopus",
                    "sampleRateHertz": 48000
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    audio_data = await response.read()
                    # Возвращаем base64 для передачи клиенту
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    logger.info(f"TTS success: {len(audio_data)} bytes")
                    return audio_base64
                else:
                    error = await response.text()
                    logger.error(f"Yandex TTS error: {response.status} - {error}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("Yandex TTS timeout")
            return None
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def text_to_speech_file(self, text: str, voice: str = "psychologist") -> Optional[bytes]:
        """
        Синтез речи с возвратом байтов аудио
        """
        base64_audio = await self.text_to_speech(text, voice)
        if base64_audio:
            return base64.b64decode(base64_audio)
        return None
    
    async def close(self):
        """Закрытие сессии"""
        if self.session and not self.session.closed:
            await self.session.close()
