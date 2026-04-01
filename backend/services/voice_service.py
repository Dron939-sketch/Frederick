#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Voice Service - сервис для работы с голосом
Поддержка живого голосового диалога (WebSocket + VAD + Barge-in)
Адаптирован из рабочего кода Telegram-бота MAX

ВЕРСИЯ 3.5 — С ЕСТЕСТВЕННЫМ ОЗВУЧИВАНИЕМ РЕМАРОК
- Автоматическая конвертация любого аудио в webm/opus для DeepGram
- Восстанавливает знаки препинания в тексте (точки, запятые, вопросительные знаки)
- Добавляет запятые после обращений и вводных слов
- Поддержка вокальных маркеров: [вздох], [смех], [пауза], [кашель]
- ПРЕОБРАЗУЕТ ремарки в паузы и междометия (вздыхает → пауза, смеётся → *смеётся*)
- НЕ удаляет ремарки, а делает речь естественной
"""

import logging
import base64
import asyncio
import os
import time
import traceback
import random
import re
import subprocess
import tempfile
from typing import Optional, Dict, Any, AsyncGenerator, Callable, Tuple

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# ============================================
# КОНФИГУРАЦИЯ СЕРВИСА
# ============================================
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_TTS_API_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

VAD_MODE = int(os.getenv("VAD_MODE", "3"))
VAD_SAMPLE_RATE = 16000

# ============================================
# ГОЛОСА YANDEX TTS ДЛЯ РАЗНЫХ РЕЖИМОВ
# ============================================
VOICES = {
    "psychologist": "ermil",
    "coach": "filipp",
    "trainer": "alena",
    "basic": "filipp",
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
        "speed": 1.18,
        "emotion": "good",
        "description": "Быстрый, бодрый голос",
        "add_flavor": False
    },
    "default": {
        "speed": 1.0,
        "emotion": "neutral",
        "description": "Стандартный голос"
    }
}

# ============================================
# РЕМАРКИ И ИХ ЗАМЕНА ДЛЯ ЕСТЕСТВЕННОГО ОЗВУЧИВАНИЯ
# ============================================

# Паттерны ремарок и их замена на паузы/междометия
REMAKE_TO_TEXT = {
    # Паузы
    r'\b(делает паузу|пауза|молчит|замолкает)\b': '... ',
    r'\b(долгая пауза|задумался|задумалась|задумывается)\b': '... ... ',
    
    # Вздохи
    r'\b(вздыхает|вздохнул|вздохнула|вздыхая)\b': '... ',
    
    # Смех
    r'\b(смеётся|засмеялся|засмеялась|усмехается|смеясь)\b': ' *смеётся* ',
    r'\b(улыбается|улыбнулся|улыбнулась|улыбнувшись)\b': ' *с улыбкой* ',
    
    # Интонации
    r'\b(тихо|шёпотом)\s+(говорит|сказал|сказала|промолвил)\b': ' ... ',
    r'\b(шутливо|смеясь)\s+(говорит|сказал|сказала)\b': ' *смеётся* ',
    r'\b(серьёзно|строго)\s+(говорит|сказал|сказала)\b': ' ... ',
    r'\b(иронично|с иронией)\s+(говорит|сказал|сказала)\b': ' *с иронией* ',
    
    # Действия
    r'\b(смотрит|посмотрел|посмотрела|глядит|взглянул)\s+в окно\b': ' ... ',
    r'\b(смотрит|посмотрел|посмотрела|глядит|взглянул)\s+на часы\b': ' ... ',
    r'\b(отводит|отвел|отвела)\s+взгляд\b': ' ... ',
    r'\b(пожимает|пожал)\s+плечами\b': ' ... ',
    r'\b(кивает|кивнул|кивнула|кивая)\b': ' да ',
    r'\b(качает|покачал|покачивает)\s+головой\b': ' нет ',
    r'\b(встаёт|встал|встала|поднимается)\b': ' ... ',
    r'\b(садится|сел|села|присаживается)\b': ' ... ',
    r'\b(отворачивается|отвернулся|отвернулась)\b': ' ... ',
    r'\b(прикрывает|прикрыл|прикрыла)\s+глаза\b': ' ... ',
    r'\b(проводит|провёл|провела)\s+рукой\b': ' ... ',
    
    # Эмоции в начале
    r'^\s*(тихо|шёпотом|смеясь|вздыхая|задумчиво|с грустью|с иронией)\s*[,.]?\s*': '',
    r'^\s*(делает паузу|пауза)\s*[,.]?\s*': '',
    
    # Ремарки с "я"
    r'\bя\s+(вздыхаю|смеюсь|кашляю|молчу|задумываюсь)\b': '... ',
}

# Вокальные маркеры в квадратных скобках
VOCAL_MARKERS = {
    '[вздох]': '... ',
    '[вздыхает]': '... ',
    '[смех]': ' *смеётся* ',
    '[смеётся]': ' *смеётся* ',
    '[пауза]': '... ',
    '[кашель]': '... ',
    '[молчание]': '... ',
    '[задумчиво]': '... ',
    '[тихо]': ' ',
    '[шёпотом]': ' ',
    '[радостно]': '! ',
    '[удивлённо]': '?! ',
    '[грустно]': '... ',
    '[иронично]': ' *с иронией* '
}


def process_remakes_to_text(text: str) -> str:
    """
    Преобразует ремарки в паузы и междометия для естественного озвучивания.
    """
    if not text:
        return text
    
    original = text
    
    for pattern, replacement in REMAKE_TO_TEXT.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE | re.UNICODE)
    
    if text != original:
        logger.debug(f"🎭 Ремарки преобразованы: '{original[:80]}...' → '{text[:80]}...'")
    
    return text


def process_vocal_markers(text: str) -> str:
    """
    Преобразует вокальные маркеры в квадратных скобках.
    """
    if not text:
        return text
    
    original = text
    
    for marker, replacement in VOCAL_MARKERS.items():
        text = text.replace(marker, replacement)
    
    # Нормализуем пробелы после замены
    text = re.sub(r'\s+', ' ', text)
    
    if text != original:
        logger.debug(f"🎭 Вокальные маркеры обработаны: '{original[:100]}' → '{text[:100]}'")
    
    return text


# ============================================
# ВОССТАНОВЛЕНИЕ ПУНКТУАЦИИ
# ============================================

def restore_punctuation(text: str) -> str:
    """
    Восстанавливает знаки препинания в тексте для TTS.
    """
    if not text:
        return text
    
    original = text
    
    # 1. Добавляем точку в конце, если её нет
    if text and text[-1] not in '.!?':
        text += '.'
    
    # 2. Добавляем пробел после знаков препинания, если его нет
    text = re.sub(r'([.!?])([А-ЯЁA-Zа-яёa-z0-9])', r'\1 \2', text)
    
    # 3. Убираем дублирующиеся знаки препинания
    text = re.sub(r'([.!?])\1+', r'\1', text)
    text = re.sub(r'([,;:])\1+', r'\1', text)
    
    # 4. Убираем лишние запятые
    text = re.sub(r',\s*,', ',', text)
    text = re.sub(r'\,\s*\)', ')', text)
    
    # 5. Исправляем тире
    text = re.sub(r'\s*-\s*,?\s*', ' — ', text)
    text = re.sub(r'—\s*—', '—', text)
    
    # 6. Убираем запятые перед союзами в начале предложения
    text = re.sub(r',\s*(и|а|но|или|да)\s+', r' \1 ', text, flags=re.IGNORECASE)
    
    # 7. Исправляем "Не," → "Не"
    text = re.sub(r'\b(не|ни)\s*,', r'\1', text, flags=re.IGNORECASE)
    
    # 8. Добавляем запятые после обращений (упрощенно)
    address_words = [
        'друг мой', 'дорогой', 'приятель', 'друг', 'товарищ', 
        'слушай', 'дружок', 'братец', 'уважаемый'
    ]
    for word in address_words:
        text = re.sub(rf'\b{word}\s+', rf'{word}, ', text, flags=re.IGNORECASE)
    
    # 9. Добавляем запятые после вводных слов (упрощенно)
    intro_words = [
        'спасибо', 'пожалуйста', 'извините', 'знаешь', 
        'понимаешь', 'видишь', 'кстати', 'наверное', 
        'конечно', 'действительно', 'например', 'итак', 'ну', 'вот'
    ]
    for word in intro_words:
        text = re.sub(rf'\b{word}\s+', rf'{word}, ', text, flags=re.IGNORECASE)
    
    # 10. Нормализуем пробелы
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s*([.,!?:;])\s*', r'\1 ', text)
    text = re.sub(r'\s+([.,!?:;])', r'\1', text)
    
    # 11. Убираем двойные пробелы
    text = re.sub(r'\s{2,}', ' ', text)
    
    # 12. Убираем множественные знаки в конце
    if len(text) > 1 and text[-1] in '.!?' and text[-2] in '.!?':
        text = text[:-1]
    
    # 13. Убираем запятую перед точкой
    text = re.sub(r',\s*\.', '.', text)
    
    if text != original:
        logger.debug(f"🔄 Восстановлена пунктуация: '{original[:100]}...' → '{text[:100]}...'")
    
    return text


# ============================================
# НОРМАЛИЗАЦИЯ ЧИСЕЛ И ДАТ
# ============================================

def normalize_numbers(text: str) -> str:
    """
    Преобразует числа в слова для естественного произношения.
    """
    if not text:
        return text
    
    original = text
    
    number_words = {
        '0': 'ноль', '1': 'один', '2': 'два', '3': 'три', '4': 'четыре',
        '5': 'пять', '6': 'шесть', '7': 'семь', '8': 'восемь', '9': 'девять',
        '10': 'десять', '11': 'одиннадцать', '12': 'двенадцать', '13': 'тринадцать',
        '14': 'четырнадцать', '15': 'пятнадцать', '16': 'шестнадцать',
        '17': 'семнадцать', '18': 'восемнадцать', '19': 'девятнадцать', '20': 'двадцать'
    }
    
    for num, word in number_words.items():
        text = re.sub(rf'\b{num}\b', word, text)
    
    text = re.sub(r'(\d+)%', r'\1 процентов', text)
    text = re.sub(r'\b(20)(\d{2})\b', r'двадцать \2', text)
    text = re.sub(r'\b(19)(\d{2})\b', r'девятнадцать \2', text)
    text = re.sub(r'\b(\d{1,2}):(\d{2})\b', lambda m: f"{int(m.group(1))} {int(m.group(2))} минут", text)
    
    if text != original:
        logger.debug(f"🔢 Нормализованы числа: '{original[:100]}' → '{text[:100]}'")
    
    return text


# ============================================
# НОРМАЛИЗАЦИЯ ТЕКСТА ДЛЯ YANDEX TTS
# ============================================

def normalize_tts_text(text: str) -> str:
    """
    Полная нормализация текста для Yandex TTS:
    - Убирает эмодзи
    - Преобразует ремарки в паузы и междометия (естественное озвучивание)
    - Нормализует числа
    - Обрабатывает вокальные маркеры
    - Восстанавливает знаки препинания
    """
    if not text:
        return ""

    original = text

    # 1. Убираем эмодзи
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F700-\U0001F77F"
        "\U0001F780-\U0001F7FF"
        "\U0001F800-\U0001F8FF"
        "\U0001F900-\U0001F9FF"
        "\U0001FA00-\U0001FA6F"
        "\U0001FA70-\U0001FAFF"
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)

    # 2. Преобразуем ремарки в паузы и междометия (главное улучшение!)
    text = process_remakes_to_text(text)

    # 3. Обрабатываем вокальные маркеры в скобках
    text = process_vocal_markers(text)

    # 4. Убираем служебные символы (не трогаем * и другие важные маркеры)
    text = re.sub(r'[#_`~<>|@$%^&+={}\\]', '', text)

    # 5. Нормализуем числа
    text = normalize_numbers(text)

    # 6. Восстанавливаем знаки препинания
    text = restore_punctuation(text)

    # 7. Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text).strip()

    # 8. Если текст стал пустым, возвращаем стандартную фразу
    if not text or len(text) < 2:
        text = "Вопрос интересный. Расскажите подробнее."

    # 9. Убираем звёздочки, если они остались (для Yandex TTS)
    text = text.replace('*', '')

    if text != original:
        logger.debug(f"🔄 Нормализован текст: '{original[:100]}...' → '{text[:100]}...'")

    return text


# ============================================
# КОНВЕРТАЦИЯ АУДИО ДЛЯ DEEPGRAM
# ============================================

async def convert_to_webm(audio_bytes: bytes, source_format: str) -> Optional[bytes]:
    """
    Конвертирует любой аудиоформат в webm/opus для DeepGram.
    """
    if source_format == "webm":
        return audio_bytes
    
    logger.info(f"🔄 Конвертируем {source_format} → webm/opus")
    
    try:
        with tempfile.NamedTemporaryFile(suffix=f'.{source_format}', delete=False) as f_in:
            f_in.write(audio_bytes)
            input_path = f_in.name
        
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f_out:
            output_path = f_out.name
        
        cmd = [
            'ffmpeg', '-i', input_path,
            '-c:a', 'libopus',
            '-b:a', '48k',
            '-ar', '16000',
            '-ac', '1',
            '-f', 'webm',
            '-y',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg ошибка: {result.stderr.decode()[:200]}")
            return None
        
        with open(output_path, 'rb') as f:
            converted = f.read()
        
        try:
            os.unlink(input_path)
            os.unlink(output_path)
        except:
            pass
        
        logger.info(f"✅ Конвертация успешна: {len(audio_bytes)} → {len(converted)} байт")
        return converted
        
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timeout")
        return None
    except FileNotFoundError:
        logger.error("FFmpeg не установлен! Установите ffmpeg: apt-get install ffmpeg")
        return None
    except Exception as e:
        logger.error(f"Ошибка конвертации: {e}")
        return None


async def check_audio_quality(audio_bytes: bytes, audio_format: str) -> Dict[str, Any]:
    """Проверяет качество аудио и возвращает параметры"""
    try:
        if audio_format == "wav" and len(audio_bytes) > 44:
            sample_rate = int.from_bytes(audio_bytes[24:28], 'little')
            bits = int.from_bytes(audio_bytes[34:36], 'little')
            channels = int.from_bytes(audio_bytes[22:24], 'little')
            return {
                "format": "wav",
                "sample_rate": sample_rate,
                "bits": bits,
                "channels": channels,
                "size": len(audio_bytes)
            }
        return {"format": audio_format, "size": len(audio_bytes)}
    except Exception as e:
        logger.warning(f"Ошибка проверки аудио: {e}")
        return {"error": str(e)}


# ============================================
# ГЛОБАЛЬНЫЙ HTTP КЛИЕНТ
# ============================================
_http_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()


async def get_http_client():
    """Возвращает (или создаёт) глобальный HTTPX клиент"""
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
                    connect=30.0, read=60.0, write=30.0, pool=None
                )
                _http_client = httpx.AsyncClient(
                    limits=limits,
                    timeout=timeouts,
                    follow_redirects=True
                )
                logger.info("✅ Глобальный HTTPX клиент создан")
    return _http_client


async def close_http_client():
    """Закрывает глобальный HTTP клиент"""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("🔒 HTTPX клиент закрыт")


# ============================================
# VAD - Voice Activity Detection
# ============================================

class VADDetector:
    """Детектор речевой активности."""
    
    def __init__(self, sample_rate: int = 16000, mode: int = 3):
        self.sample_rate = sample_rate
        self.mode = mode
        self.frame_duration = 30
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
            logger.info(f"✅ WebRTC VAD инициализирован (mode={mode})")
        except ImportError:
            logger.info("ℹ️ WebRTC VAD не установлен → используется энергетический VAD")

    def reset(self):
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def _calculate_energy(self, audio_chunk: bytes) -> float:
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_array.astype(np.float32) ** 2))
            return rms / 32768.0
        except Exception:
            return 0.0

    def _is_speech_energy(self, audio_chunk: bytes) -> bool:
        return self._calculate_energy(audio_chunk) > self.energy_threshold

    def _is_speech_webrtc(self, audio_chunk: bytes) -> bool:
        if not self.has_vad or len(audio_chunk) != self.frame_size * 2:
            return self._is_speech_energy(audio_chunk)
        try:
            return self.vad.is_speech(audio_chunk, self.sample_rate)
        except Exception:
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
        else:
            self.speech_frames = 0
            self.silence_frames = 0

        return result


# ============================================
# STT - Speech-to-Text (DeepGram) с конвертацией
# ============================================

async def speech_to_text(audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
    """Распознавание речи через DeepGram с авто-конвертацией в webm."""
    logger.info(f"🎤 Распознавание речи, формат: {audio_format}, размер: {len(audio_bytes)} байт")

    if not DEEPGRAM_API_KEY:
        logger.error("❌ DEEPGRAM_API_KEY не настроен")
        return None

    if len(audio_bytes) < 1000:
        logger.warning(f"⚠️ Аудио слишком короткое: {len(audio_bytes)} байт")
        return None

    audio_info = await check_audio_quality(audio_bytes, audio_format)
    logger.info(f"📊 Аудио параметры: {audio_info}")

    if audio_format != "webm":
        converted = await convert_to_webm(audio_bytes, audio_format)
        if converted:
            audio_bytes = converted
            audio_format = "webm"
            logger.info(f"✅ Аудио сконвертировано в webm")
        else:
            logger.warning(f"⚠️ Не удалось конвертировать {audio_format}, пробуем оригинал")

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
        "smart_format": "true"
    }

    try:
        client = await get_http_client()
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
                return transcript.strip() if transcript and transcript.strip() else None
            except (KeyError, IndexError) as e:
                logger.error(f"❌ Не удалось извлечь транскрипт: {e}")
                return None
        else:
            logger.error(f"❌ DeepGram error {response.status_code}: {response.text[:200]}")
            return None

    except Exception as e:
        logger.error(f"❌ Ошибка распознавания речи: {e}")
        return None


# ============================================
# TTS - Text-to-Speech (Yandex)
# ============================================

async def text_to_speech(text: str, mode: str = "psychologist") -> Optional[bytes]:
    """Синтез речи через Yandex TTS с нормализацией и естественным озвучиванием ремарок."""
    logger.info(f"🎤 Синтез речи (Yandex TTS), режим: {mode}, текст: {text[:150]}...")

    if not text or not text.strip():
        logger.warning("⚠️ Пустой текст для TTS")
        return None

    # Полная нормализация текста (включая преобразование ремарок)
    text = normalize_tts_text(text)
    logger.debug(f"Normalized TTS text ({mode}): {text[:220]}{'...' if len(text) > 220 else ''}")

    settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])
    voice = VOICES.get(mode, VOICES["default"])

    if len(text) > 4500:
        text = text[:4500] + "..."

    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
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
        response = await client.post(
            YANDEX_TTS_API_URL,
            headers=headers,
            data=data,
            timeout=30.0
        )

        if response.status_code == 200:
            audio_data = response.content
            logger.info(f"✅ Речь синтезирована: {len(audio_data)} байт, голос: {voice}")
            return audio_data
        else:
            logger.error(f"❌ Yandex TTS error {response.status_code}: {response.text[:200]}")
            return None

    except Exception as e:
        logger.error(f"❌ Ошибка синтеза речи: {e}")
        logger.error(traceback.format_exc())
        return None


# ============================================
# ПОТОКОВОЕ РАСПОЗНАВАНИЕ РЕЧИ
# ============================================

async def speech_to_text_streaming(
    audio_stream: AsyncGenerator[bytes, None],
    sample_rate: int = 16000,
    on_transcript: Optional[Callable] = None,
    on_speech_start: Optional[Callable] = None,
    on_speech_end: Optional[Callable] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """Потоковое распознавание речи с VAD"""
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
                    yield {"type": "error", "error": "Речь не распознана"}
            except Exception as e:
                logger.error(f"Ошибка в speech_to_text: {e}")
                yield {"type": "error", "error": str(e)}

            audio_buffer.clear()
            is_collecting = False
            vad.reset()

        yield {"type": "vad_state", **vad_result}

    logger.info("🎤 Потоковое распознавание завершено")


# ============================================
# ПОТОКОВЫЙ СИНТЕЗ РЕЧИ
# ============================================

async def text_to_speech_streaming(
    text: str,
    mode: str = "psychologist",
    chunk_size: int = 4096
) -> AsyncGenerator[bytes, None]:
    """Потоковая отправка аудио (для WebSocket)"""
    logger.info(f"🎤 Потоковый синтез речи, режим: {mode}, текст: {text[:100]}...")

    audio_bytes = await text_to_speech(text, mode)

    if audio_bytes:
        total_sent = 0
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            yield chunk
            total_sent += len(chunk)
            await asyncio.sleep(0.012)
        logger.info(f"✅ Потоковый синтез завершен, отправлено {total_sent} байт")
    else:
        logger.error("❌ Не удалось синтезировать речь")
        yield b''


# ============================================
# ОСНОВНОЙ КЛАСС VoiceService
# ============================================

class VoiceService:
    """Основной класс сервиса голосового взаимодействия."""

    def __init__(self):
        self.deepgram_key = DEEPGRAM_API_KEY
        self.yandex_key = YANDEX_API_KEY
        self._vad_cache: Dict[str, VADDetector] = {}

        logger.info("=" * 70)
        logger.info("🎤 VoiceService v3.5 успешно инициализирован")
        logger.info(f" DeepGram STT : {'✅' if self.deepgram_key else '❌'}")
        logger.info(f" Yandex TTS   : {'✅' if self.yandex_key else '❌'}")
        logger.info(f" VAD Mode     : {VAD_MODE}")
        logger.info(f" Ремарки → паузы: ✅ (естественное озвучивание)")
        logger.info(f" Вокальные маркеры: ✅")
        logger.info(f" Нормализация чисел: ✅")
        logger.info("=" * 70)

        if not self.deepgram_key:
            logger.warning("⚠️ DEEPGRAM_API_KEY не настроен!")
        if not self.yandex_key:
            logger.warning("⚠️ YANDEX_API_KEY не настроен!")

    async def speech_to_text(self, audio_bytes: bytes, audio_format: str = "webm") -> Optional[str]:
        return await speech_to_text(audio_bytes, audio_format)

    async def text_to_speech(self, text: str, mode: str = "psychologist") -> Optional[str]:
        audio_bytes = await text_to_speech(text, mode)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode('utf-8')
        return None

    async def text_to_speech_bytes(self, text: str, mode: str = "psychologist") -> Optional[bytes]:
        return await text_to_speech(text, mode)

    async def speech_to_text_streaming(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
        on_transcript: Optional[Callable] = None,
        on_speech_start: Optional[Callable] = None,
        on_speech_end: Optional[Callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        async for result in speech_to_text_streaming(
            audio_stream, sample_rate, on_transcript, on_speech_start, on_speech_end
        ):
            yield result

    async def text_to_speech_streaming(
        self,
        text: str,
        mode: str = "psychologist",
        chunk_size: int = 4096
    ) -> AsyncGenerator[bytes, None]:
        async for chunk in text_to_speech_streaming(text, mode, chunk_size):
            yield chunk

    def create_vad(self, user_id: Optional[int] = None, sample_rate: int = 16000, mode: int = 3) -> VADDetector:
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
        if user_id is not None:
            to_remove = [k for k in self._vad_cache if k.startswith(f"{user_id}:")]
            for key in to_remove:
                del self._vad_cache[key]
            logger.info(f"🗑️ Очищен кэш VAD для user_id={user_id}")
        else:
            self._vad_cache.clear()
            logger.info("🗑️ Очищен весь кэш VAD")

    def get_voice_info(self, mode: str = "psychologist") -> Dict[str, Any]:
        return {
            "mode": mode,
            "voice": VOICES.get(mode, VOICES["default"]),
            "settings": VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"]),
            "available_modes": list(VOICE_SETTINGS.keys())
        }

    async def close(self):
        await close_http_client()
        self.clear_vad_cache()
        logger.info("🔒 VoiceService полностью закрыт")


def create_voice_service() -> VoiceService:
    return VoiceService()


async def save_audio_debug(audio_bytes: bytes, prefix: str = "audio") -> Optional[str]:
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
