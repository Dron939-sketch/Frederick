"""
Сервис для работы с голосом (STT и TTS)
Адаптирован для FastAPI
"""

import aiohttp
import asyncio
import base64
import logging
import os
import time
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class VoiceService:
    """Сервис для распознавания и синтеза речи"""
    
    def __init__(self):
        self.deepgram_key = os.environ.get('DEEPGRAM_API_KEY')
        self.yandex_key = os.environ.get('YANDEX_API_KEY')
        self.session: Optional[aiohttp.ClientSession] = None
        self._voice_cache = {}
        self._voice_cache_time = {}
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Получение HTTP сессии"""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    # ========== STT (Распознавание речи) ==========
    
    async def speech_to_text(self, audio_bytes: bytes, language: str = "ru-RU") -> Optional[str]:
        """
        Распознавание речи через Deepgram
        """
        if not self.deepgram_key:
            logger.warning("DEEPGRAM_API_KEY not set")
            return None
        
        audio_format = self._detect_format(audio_bytes)
        content_type = {
            'ogg': 'audio/ogg',
            'webm': 'audio/webm',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav'
        }.get(audio_format, 'audio/webm')
        
        logger.info(f"🎤 STT: format={audio_format}, size={len(audio_bytes)} bytes")
        
        try:
            session = await self._get_session()
            
            async with session.post(
                "https://api.deepgram.com/v1/listen",
                headers={
                    "Authorization": f"Token {self.deepgram_key}",
                    "Content-Type": content_type
                },
                params={
                    "language": language,
                    "model": "nova-2",
                    "smart_format": "true",
                    "punctuate": "true"
                },
                data=audio_bytes,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    text = data.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
                    
                    if text and len(text.strip()) > 1:
                        logger.info(f"✅ STT: '{text[:100]}...'")
                        return text.strip()
                    else:
                        logger.warning("STT: empty transcript")
                        return None
                else:
                    error = await response.text()
                    logger.error(f"Deepgram error {response.status}: {error[:200]}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("Deepgram timeout")
            return None
        except Exception as e:
            logger.error(f"STT error: {e}")
            return None
    
    # ========== TTS (Синтез речи) - РАБОЧАЯ ВЕРСИЯ ==========
    
    async def text_to_speech(self, text: str, voice: str = "psychologist") -> Optional[str]:
        """
        Синтез речи через Yandex SpeechKit
        
        Args:
            text: Текст для озвучивания
            voice: Тип голоса (coach, psychologist, trainer)
        
        Returns:
            Base64 строка с аудио или None
        """
        if not self.yandex_key:
            logger.warning("YANDEX_API_KEY not set")
            return None
        
        # Очищаем текст
        clean_text = self._clean_for_tts(text)
        
        if not clean_text:
            logger.warning("Empty text after cleaning")
            return None
        
        # Проверяем кэш
        cached = self._get_cached(clean_text, voice)
        if cached:
            logger.info(f"📦 Voice cache hit")
            return cached
        
        # 👇 ПРАВИЛЬНЫЕ ГОЛОСА (как в рабочем боте)
        voices = {
            "coach": "filipp",
            "psychologist": "ermil",
            "trainer": "filipp"
        }
        voice_name = voices.get(voice, "filipp")
        
        # 👇 ФОРМАТ OGGOPUS (как в рабочем боте)
        data = {
            "text": clean_text,
            "lang": "ru-RU",
            "voice": voice_name,
            "emotion": "good" if voice == "psychologist" else "neutral",
            "speed": 0.9 if voice == "psychologist" else 1.0,
            "format": "oggopus"
        }
        
        logger.info(f"🎙️ TTS: voice={voice}, text_len={len(clean_text)}")
        
        try:
            session = await self._get_session()
            
            async with session.post(
                "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                headers={
                    "Authorization": f"Api-Key {self.yandex_key}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    audio_data = await response.read()
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    
                    self._cache_voice(clean_text, voice, audio_base64)
                    
                    logger.info(f"✅ TTS: {len(audio_data)} bytes")
                    return audio_base64
                else:
                    error = await response.text()
                    logger.error(f"Yandex TTS error {response.status}: {error[:200]}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("Yandex TTS timeout")
            return None
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def text_to_speech_raw(self, text: str, voice: str = "psychologist") -> Optional[bytes]:
        """Синтез речи с возвратом raw bytes"""
        base64_audio = await self.text_to_speech(text, voice)
        if base64_audio:
            return base64.b64decode(base64_audio)
        return None
    
    # ========== КЭШИРОВАНИЕ ==========
    
    def _get_cached(self, text: str, voice: str) -> Optional[str]:
        """Получает из кэша"""
        key = f"{voice}_{hash(text)}"
        if key in self._voice_cache:
            if time.time() - self._voice_cache_time.get(key, 0) < 3600:
                return self._voice_cache[key]
            else:
                del self._voice_cache[key]
                del self._voice_cache_time[key]
        return None
    
    def _cache_voice(self, text: str, voice: str, audio: str):
        """Сохраняет в кэш"""
        key = f"{voice}_{hash(text)}"
        self._voice_cache[key] = audio
        self._voice_cache_time[key] = time.time()
        
        if len(self._voice_cache) > 100:
            oldest = min(self._voice_cache_time.items(), key=lambda x: x[1])[0]
            del self._voice_cache[oldest]
            del self._voice_cache_time[oldest]
    
    # ========== ВСПОМОГАТЕЛЬНЫЕ ==========
    
    def _detect_format(self, data: bytes) -> str:
        """Определяет формат аудио"""
        if len(data) < 4:
            return 'webm'
        
        header = data[:4]
        
        if header[:4] == b'OggS':
            return 'ogg'
        if header[:3] == b'ID3' or (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
            return 'mp3'
        if header[:4] == b'RIFF':
            return 'wav'
        
        return 'webm'
    
    def _clean_for_tts(self, text: str) -> str:
        """Очищает текст для TTS"""
        if not text:
            return ""
        
        # Удаляем HTML
        text = re.sub(r'<[^>]+>', '', text)
        
        # Удаляем Markdown
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        
        # Удаляем ссылки
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        
        # Удаляем эмодзи
        emoji_pattern = re.compile(
            "["
            u"\U0001F600-\U0001F64F"
            u"\U0001F300-\U0001F5FF"
            u"\U0001F680-\U0001F6FF"
            u"\U0001F700-\U0001F77F"
            u"\U0001F780-\U0001F7FF"
            u"\U0001F800-\U0001F8FF"
            u"\U0001F900-\U0001F9FF"
            u"\U0001FA00-\U0001FA6F"
            u"\U0001FA70-\U0001FAFF"
            u"\U00002702-\U000027B0"
            u"\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE
        )
        text = emoji_pattern.sub(r'', text)
        
        # Убираем лишние пробелы
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Ограничиваем длину (Yandex TTS лимит)
        if len(text) > 500:
            sentences = re.split(r'[.!?]', text)
            result = ""
            for s in sentences:
                if len(result) + len(s) + 1 <= 500:
                    result += s + "."
                else:
                    break
            text = result.strip()
        
        return text
    
    async def check_apis(self) -> Dict[str, bool]:
        """Проверяет доступность API"""
        result = {"deepgram": False, "yandex": False}
        
        if self.deepgram_key:
            try:
                session = await self._get_session()
                async with session.head(
                    "https://api.deepgram.com/v1/listen",
                    headers={"Authorization": f"Token {self.deepgram_key}"},
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    result["deepgram"] = resp.status != 401
            except:
                pass
        
        if self.yandex_key:
            result["yandex"] = True
        
        return result
    
    async def close(self):
        """Закрытие сессии"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("🔌 Voice session closed")
