"""
Voice Service - сервис для работы с голосом
Адаптирован из рабочего кода Telegram-бота MAX
Поддержка потокового распознавания и синтеза для живого диалога
"""

import logging
import base64
import asyncio
import os
import tempfile
import json
import time
import traceback
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
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

# VAD настройки
VAD_MODE = int(os.getenv("VAD_MODE", "3"))  # 0-3, 3 - самая агрессивная фильтрация
VAD_SAMPLE_RATE = 16000  # WebRTC VAD требует 16kHz
VAD_FRAME_DURATION = 30  # мс (30ms - стандарт для WebRTC)

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
    """
    Voice Activity Detector для потокового аудио
    Определяет, когда пользователь говорит, а когда замолчал
    Использует WebRTC VAD алгоритм
    """
    
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        """
        Args:
            sample_rate: частота дискретизации (16000 Hz для WebRTC VAD)
            mode: агрессивность VAD (0-3, где 3 - самая агрессивная)
        """
        self.sample_rate = sample_rate
        self.mode = mode
        
        # Пытаемся импортировать webrtcvad
        self.vad = None
        self.has_vad = False
        try:
            import webrtcvad
            self.vad = webrtcvad.Vad(mode)
            self.has_vad = True
            logger.info(f"✅ WebRTC VAD инициализирован, mode={mode}")
        except ImportError:
            logger.warning("⚠️ webrtcvad не установлен, используется упрощенный VAD на основе энергии")
        
        self.frame_duration = 30  # ms
        self.frame_size = int(sample_rate * self.frame_duration / 1000)  # 480 samples для 16kHz
        
        # Состояние
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False
        
        # Пороги
        self.speech_trigger_frames = 3  # 3 кадра речи = 90ms для начала разговора
        self.silence_trigger_frames = 10  # 10 кадров тишины = 300ms для окончания
        
        # Для упрощенного VAD
        self.energy_threshold = 0.01  # Порог энергии для определения речи
        self.energy_history = []
        
    def reset(self):
        """Сброс состояния"""
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False
        self.energy_history = []
    
    def _calculate_energy(self, audio_chunk: bytes) -> float:
        """Вычисляет энергию аудио чанка"""
        try:
            # Преобразуем байты в numpy array (16-bit PCM)
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            # RMS энергия
            rms = np.sqrt(np.mean(audio_array.astype(np.float32)**2))
            # Нормализуем
            energy = rms / 32768.0
            return energy
        except Exception as e:
            logger.debug(f"Energy calculation error: {e}")
            return 0.0
    
    def _is_speech_simple(self, audio_chunk: bytes) -> bool:
        """Упрощенный VAD на основе энергии"""
        energy = self._calculate_energy(audio_chunk)
        
        # Добавляем в историю
        self.energy_history.append(energy)
        if len(self.energy_history) > 50:
            self.energy_history.pop(0)
        
        # Динамический порог
        if len(self.energy_history) > 10:
            noise_floor = np.mean(self.energy_history) * 1.5
            threshold = max(self.energy_threshold, noise_floor)
        else:
            threshold = self.energy_threshold
        
        return energy > threshold
    
    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        """VAD через WebRTC"""
        if not self.vad:
            return self._is_speech_simple(audio_chunk)
        
        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except Exception as e:
            logger.debug(f"WebRTC VAD error: {e}")
            return self._is_speech_simple(audio_chunk)
    
    def process_chunk(self, audio_chunk: bytes) -> Dict[str, Any]:
        """
        Обрабатывает чанк аудио и возвращает состояние
        
        Returns:
            {
                "is_speech": bool,      # есть ли речь в этом чанке
                "speech_started": bool, # только что началась речь
                "speech_ended": bool,   # только что закончилась речь
                "is_speaking": bool,    # текущее состояние (говорит/молчит)
                "energy": float         # энергия аудио (для отладки)
            }
        """
        result = {
            "is_speech": False,
            "speech_started": False,
            "speech_ended": False,
            "is_speaking": self.is_speaking,
            "energy": 0.0
        }
        
        # Вычисляем энергию для отладки
        result["energy"] = self._calculate_energy(audio_chunk)
        
        # Проверяем длину чанка для WebRTC VAD
        if self.has_vad and len(audio_chunk) != self.frame_size * 2:
            # Длина не соответствует, используем упрощенный VAD
            is_speech = self._is_speech_simple(audio_chunk)
        else:
            is_speech = self._is_speech_webrtc(audio_chunk)
        
        result["is_speech"] = is_speech
        
        # Логика определения начала и конца речи
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
            # Просто тишина
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
    
    # Голоса для разных режимов
    voices = {
        "psychologist": "ermil",    # спокойный мужской
        "coach": "filipp",          # энергичный мужской
        "trainer": "alena",         # бодрый женский
        "default": "filipp"
    }
    voice = voices.get(mode, voices["default"])
    
    logger.info(f"🗣️ Выбран голос: {voice} для режима: {mode}")
    
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
        "voice": voice,
        "emotion": "neutral",
        "speed": 1.0,
        "format": "mp3"
    }
    
    try:
        client = await get_http_client()
        
        logger.info(f"📡 Отправка запроса в Yandex TTS, голос: {voice}")
        
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
# ПОТОКОВОЕ РАСПОЗНАВАНИЕ
# ============================================

async def speech_to_text_streaming(
    audio_stream: AsyncGenerator[bytes, None],
    sample_rate: int = 16000,
    on_transcript: Optional[Callable] = None,
    on_speech_start: Optional[Callable] = None,
    on_speech_end: Optional[Callable] = None,
    interim_results: bool = False
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    ПОТОКОВОЕ распознавание речи с VAD
    
    Args:
        audio_stream: асинхронный генератор аудио чанков (bytes)
        sample_rate: частота дискретизации
        on_transcript: callback при получении транскрипта (text, is_final)
        on_speech_start: callback при начале речи
        on_speech_end: callback при окончании речи (full_text)
        interim_results: отправлять ли промежуточные результаты
    
    Yields:
        Dict с результатами VAD и распознавания
    """
    
    vad = VADDetector(sample_rate, VAD_MODE)
    audio_buffer = bytearray()
    current_utterance = []
    is_collecting = False
    chunk_counter = 0
    
    logger.info("🎤 Запуск потокового распознавания речи")
    
    async for chunk in audio_stream:
        chunk_counter += 1
        
        if not chunk:
            continue
        
        # Обрабатываем через VAD
        vad_result = vad.process_chunk(chunk)
        
        # Начало речи
        if vad_result["speech_started"]:
            logger.info("🗣️ Речь началась")
            if on_speech_start:
                await on_speech_start()
            is_collecting = True
            audio_buffer.clear()
            current_utterance.clear()
        
        # Собираем аудио во время речи
        if is_collecting:
            audio_buffer.extend(chunk)
        
        # Промежуточные результаты (если включены)
        if interim_results and is_collecting and len(audio_buffer) > sample_rate:
            # Можно отправлять промежуточные результаты
            # Для упрощения пока пропускаем
            pass
        
        # Окончание речи
        if vad_result["speech_ended"] and len(audio_buffer) > 0:
            logger.info(f"🔇 Речь закончилась, собрано {len(audio_buffer)} байт")
            
            # Распознаем накопленное аудио
            # Конвертируем в WAV формат для лучшего распознавания
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
                    
                    # Возвращаем результат
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
            
            # Сброс
            audio_buffer.clear()
            is_collecting = False
            vad.reset()
        
        # Возвращаем состояние VAD
        yield {
            "type": "vad_state",
            **vad_result
        }
    
    logger.info("🎤 Потоковое распознавание завершено")


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
    
    Args:
        text: текст для озвучивания
        mode: режим голоса
        chunk_size: размер чанка для отправки
    
    Yields:
        bytes: чанки аудио
    """
    logger.info(f"🎤 Запуск потокового синтеза речи: {text[:100]}...")
    
    # Yandex TTS не поддерживает потоковый синтез,
    # поэтому получаем полное аудио и отправляем чанками
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
# ФУНКЦИИ ДЛЯ ОТЛАДКИ
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


def convert_to_pcm16(audio_bytes: bytes, original_sample_rate: int = 48000) -> bytes:
    """
    Конвертирует аудио в PCM 16-bit 16kHz для VAD
    
    Упрощенная версия - для продакшена используйте pydub или ffmpeg
    """
    # Если уже 16kHz, просто возвращаем
    if original_sample_rate == 16000:
        return audio_bytes
    
    # Для реального использования:
    # from pydub import AudioSegment
    # import io
    # audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    # audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    # return audio.raw_data
    
    logger.warning("⚠️ Конвертация аудио не реализована, VAD может работать некорректно")
    return audio_bytes


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """Сервис для работы с голосом с поддержкой потоковой обработки"""
    
    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache = {}  # Кэш для VAD детекторов по user_id
        
        logger.info(f"VoiceService инициализирован")
        logger.info(f"  DeepGram: {'✅' if self.deepgram_key else '❌'}")
        logger.info(f"  Yandex TTS: {'✅' if self.yandex_key else '❌'}")
        logger.info(f"  VAD Mode: {VAD_MODE}")
    
    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        """Распознавание речи (не потоковое)"""
        return await speech_to_text(audio_bytes, audio_format)
    
    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        """
        Синтез речи, возвращает base64 строку с аудио
        
        Args:
            text: текст для озвучивания
            mode: режим (psychologist, coach, trainer)
        """
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None
    
    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        """
        Синтез речи, возвращает байты аудио
        
        Args:
            text: текст для озвучивания
            mode: режим (psychologist, coach, trainer)
        """
        return await text_to_speech(text, mode)
    
    async def speech_to_text_streaming(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
        on_transcript: Optional[Callable] = None,
        on_speech_start: Optional[Callable] = None,
        on_speech_end: Optional[Callable] = None,
        interim_results: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Потоковое распознавание речи с VAD
        
        Args:
            audio_stream: асинхронный генератор аудио чанков
            sample_rate: частота дискретизации
            on_transcript: callback при получении транскрипта
            on_speech_start: callback при начале речи
            on_speech_end: callback при окончании речи
            interim_results: отправлять ли промежуточные результаты
        
        Yields:
            Dict с результатами VAD и распознавания
        """
        async for result in speech_to_text_streaming(
            audio_stream, sample_rate,
            on_transcript, on_speech_start, on_speech_end,
            interim_results
        ):
            yield result
    
    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        """
        Потоковый синтез речи
        
        Args:
            text: текст для озвучивания
            mode: режим голоса
            chunk_size: размер чанка
        
        Yields:
            bytes: чанки аудио
        """
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk
    
    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
        """
        Создать детектор активности речи
        
        Args:
            user_id: ID пользователя (для кэширования)
            sample_rate: частота дискретизации
            mode: агрессивность VAD
        
        Returns:
            VADDetector
        """
        if user_id is not None:
            # Проверяем кэш
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
