"""
Voice Service - сервис для работы с голосом
Использует Edge TTS (бесплатно) и SpeechRecognition
Поддержка потокового распознавания и синтеза для живого диалога
"""

import logging
import base64
import asyncio
import os
import io
import tempfile
import time
import traceback
from typing import Optional, Dict, Any, AsyncGenerator, Callable
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import edge_tts
import speech_recognition as sr

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ
# ============================================

# VAD настройки
VAD_MODE = int(os.getenv("VAD_MODE", "3"))  # 0-3, 3 - самая агрессивная
VAD_SAMPLE_RATE = 16000

# Edge TTS настройки
EDGE_TTS_VOICES = {
    "psychologist": "ru-RU-DariyaNeural",     # спокойный женский
    "coach": "ru-RU-DmitryNeural",            # энергичный мужской
    "trainer": "ru-RU-SvetlanaNeural",        # бодрый женский
    "default": "ru-RU-DariyaNeural"
}

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
        
        # Энергетический порог
        self.energy_threshold = 0.01
        
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
        
        # Проверяем длину
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
    """
    Распознает речь из аудио через SpeechRecognition (Google или Sphinx)
    """
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")
    
    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None
    
    recognizer = sr.Recognizer()
    
    # Конвертируем в WAV для SpeechRecognition
    try:
        from pydub import AudioSegment
        
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
        logger.error(traceback.format_exc())
        return None


# ============================================
# TTS - Text-to-Speech (Edge TTS - бесплатно)
# ============================================

async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    """
    Преобразует текст в речь через Edge TTS (бесплатно, без API ключей)
    
    Args:
        text: текст для озвучивания
        mode: режим (psychologist, coach, trainer)
    
    Returns:
        байты аудиофайла (MP3) или None
    """
    logger.info(f"🎤 Синтез речи (Edge TTS), режим: {mode}, текст: {text[:100]}...")
    
    voice = EDGE_TTS_VOICES.get(mode, EDGE_TTS_VOICES["default"])
    logger.info(f"🗣️ Выбран голос: {voice}")
    
    # Ограничиваем длину текста
    if len(text) > 5000:
        text = text[:5000] + "..."
    
    try:
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            output_file = tmp.name
        
        # Синтезируем речь
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_file)
        
        # Читаем файл
        with open(output_file, "rb") as f:
            audio_data = f.read()
        
        # Удаляем временный файл
        os.unlink(output_file)
        
        logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт, формат: MP3")
        return audio_data
        
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
    """Сервис для работы с голосом с поддержкой потоковой обработки"""
    
    def __init__(self):
        self._vad_cache = {}
        
        logger.info("VoiceService инициализирован")
        logger.info(f"  TTS: Edge TTS (бесплатно)")
        logger.info(f"  STT: Google Speech Recognition")
        logger.info(f"  VAD Mode: {VAD_MODE}")
    
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
    
    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        """Синтез речи, возвращает байты аудио"""
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
        """Потоковое распознавание речи с VAD"""
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
        self.clear_vad_cache()
        logger.info("VoiceService закрыт")


# ============================================
# ФАБРИКА
# ============================================

def create_voice_service() -> VoiceService:
    """Создает экземпляр VoiceService"""
    return VoiceService()
