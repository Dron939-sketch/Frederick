#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Фреди - Виртуальный психолог
Асинхронный API сервер на FastAPI
Версия 3.1 - Добавлена поддержка живого голосового диалога (WebSocket + VAD)
"""

import os
import sys
import asyncio
import logging
import time
import json
import random
import base64
import re
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List, Union
import signal
import traceback

from fastapi import FastAPI, Request, HTTPException, Depends, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field
import uvicorn
from services.voice_service import VoiceService, normalize_tts_text

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# ИМПОРТЫ ПО СТРУКТУРЕ (С УКАЗАНИЕМ ПАПОК)
# ============================================

# База данных и кэш
from db import Database
from cache import RedisCache

# Сервисы
from services.ai_service import AIService
from services.weather_service import WeatherService
from services.weekend_planner import WeekendPlanner

# Репозитории
from repositories.user_repo import UserRepository
from repositories.context_repo import ContextRepository
from repositories.message_repo import MessageRepository

# Конфайнтмент-модель (из папки confinement)
from confinement.confinement_model import ConfinementModel9 as ConfinementModel
from confinement.loop_analyzer import LoopAnalyzer, create_analyzer_from_model_data
from confinement.key_confinement import KeyConfinementDetector
from confinement.intervention_library import InterventionLibrary
from confinement.question_analyzer import QuestionContextAnalyzer, create_analyzer_from_user_data

# Гипнотические модули (из папки hypno)
from hypno.hypno_module import HypnoOrchestrator
from hypno.therapeutic_tales import TherapeuticTales

# Режимы общения (из папки modes)
from modes.base_mode import BaseMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode
from modes import get_mode

# Утилиты
from utils import (
    get_theoretical_path,
    generate_life_context_questions,
    generate_goal_context_questions,
    calculate_feasibility,
    parse_life_context_answers,
    parse_goal_context_answers,
    get_goal_difficulty,
    get_goal_time_estimate,
    save_feasibility_result,
    MorningMessageManager,
    get_weekend_planner as get_utils_weekend_planner
)

# Форматирование и профили
from formatters import bold, italic, clean_text_for_safe_display, format_profile_text, format_psychologist_text
from profiles import VECTORS, LEVEL_PROFILES, STAGE_1_FEEDBACK, STAGE_2_FEEDBACK, STAGE_3_FEEDBACK, DILTS_LEVELS, FALLBACK_ANALYSIS

# ============================================
# ГЛОБАЛЬНЫЕ ОБЪЕКТЫ
# ============================================
db: Optional[Database] = None
cache: Optional[RedisCache] = None
ai_service: Optional[AIService] = None
voice_service: Optional[VoiceService] = None
weather_service: Optional[WeatherService] = None
user_repo: Optional[UserRepository] = None
context_repo: Optional[ContextRepository] = None
message_repo: Optional[MessageRepository] = None

# Гипнотические модули
hypno: Optional[HypnoOrchestrator] = None
tales: Optional[TherapeuticTales] = None

# Библиотека интервенций
intervention_lib: Optional[InterventionLibrary] = None

# Утренние сообщения и планировщик
morning_manager: Optional[MorningMessageManager] = None
weekend_planner: Optional[WeekendPlanner] = None

# ============================================
# VOICE CONNECTION MANAGER (для WebSocket)
# ============================================

class VoiceConnectionManager:
    """Управление WebSocket соединениями для голосового диалога"""
    
    def __init__(self):
        self.active_connections: Dict[Any, WebSocket] = {}  # ← Any
        self.speaking_tasks: Dict[Any, asyncio.Task] = {}   # ← Any
    
    async def connect(self, user_id: Any, websocket: WebSocket):  # ← Any
        self.active_connections[user_id] = websocket
        logger.info(f"🔊 Voice WS connected for user {user_id}")
    
    def disconnect(self, user_id: Any):  # ← Any
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.speaking_tasks:
            task = self.speaking_tasks.pop(user_id, None)
            if task and not task.done():
                task.cancel()
        logger.info(f"🔊 Voice WS disconnected for user {user_id}")
    
    async def send_audio(self, user_id: Any, audio_base64: str, is_final: bool = True):  # ← Any
        """Отправить аудио клиенту"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({
                    "type": "audio",
                    "data": audio_base64,
                    "is_final": is_final
                })
            except Exception as e:
                logger.error(f"Error sending audio to {user_id}: {e}")
    
    async def send_text(self, user_id: Any, text: str):  # ← Any
        """Отправить текст клиенту (для субтитров)"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({
                    "type": "text",
                    "data": text
                })
            except Exception as e:
                logger.error(f"Error sending text to {user_id}: {e}")
    
    async def send_status(self, user_id: Any, status: str):  # ← Any
        """Отправить статус клиенту"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({
                    "type": "status",
                    "status": status
                })
            except Exception as e:
                logger.error(f"Error sending status to {user_id}: {e}")
    
    async def send_error(self, user_id: Any, error: str):  # ← Any
        """Отправить ошибку клиенту"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({
                    "type": "error",
                    "error": error
                })
            except Exception as e:
                logger.error(f"Error sending error to {user_id}: {e}")
                
# Создаем глобальный менеджер (будет инициализирован в lifespan)
voice_manager: Optional[VoiceConnectionManager] = None

# ============================================
# RATE LIMITING
# ============================================
limiter = Limiter(key_func=get_remote_address)

# ============================================
# MODELS (Pydantic)
# ============================================
class SaveContextRequest(BaseModel):
    user_id: int
    context: Dict[str, Any]


class SaveProfileRequest(BaseModel):
    user_id: int
    profile: Dict[str, Any]


class ChatRequest(BaseModel):
    user_id: int
    message: str
    mode: str = "psychologist"


class ChatResponse(BaseModel):
    success: bool
    response: str
    mode_used: Optional[str] = None
    reflection: Optional[str] = None


class VoiceProcessResponse(BaseModel):
    success: bool
    recognized_text: Optional[str] = None
    answer: Optional[str] = None
    audio_base64: Optional[str] = None
    audio_mime: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, Any]


class MorningMessageRequest(BaseModel):
    user_id: int
    day: int = 1


class WeekendIdeasRequest(BaseModel):
    user_id: int
    city: Optional[str] = None


# ============================================
# LIFESPAN
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global db, cache, ai_service, voice_service, weather_service
    global user_repo, context_repo, message_repo
    global hypno, tales, intervention_lib
    global morning_manager, weekend_planner
    global voice_manager
    
    # ========== STARTUP ==========
    logger.info("=" * 60)
    logger.info("🚀 ЗАПУСК ПРИЛОЖЕНИЯ ФРЕДИ v3.1 (с живым голосом)")
    logger.info("=" * 60)
    
    try:
        # 1. Подключаем PostgreSQL
        logger.info("📦 Подключение к PostgreSQL...")
        db = Database()
        await db.connect()
        logger.info("✅ PostgreSQL подключена")
        
        # 2. Подключаем Redis (опционально)
        logger.info("📦 Подключение к Redis...")
        cache = RedisCache()
        await cache.connect()
        if cache.is_connected:
            logger.info("✅ Redis подключен")
        else:
            logger.warning("⚠️ Redis не подключен (работаем без кэша)")
        
        # 3. Инициализируем репозитории
        logger.info("📦 Инициализация репозиториев...")
        user_repo = UserRepository(db, cache)
        context_repo = ContextRepository(db, cache)
        message_repo = MessageRepository(db, cache)
        logger.info("✅ Репозитории готовы")
        
        # 4. Инициализируем сервисы
        logger.info("📦 Инициализация сервисов...")
        ai_service = AIService(cache)
        voice_service = VoiceService()
        weather_service = WeatherService(cache)
        weekend_planner = WeekendPlanner(ai_service)
        logger.info("✅ Сервисы готовы")
        
        # 5. Инициализируем гипнотические модули
        logger.info("📦 Инициализация гипнотических модулей...")
        hypno = HypnoOrchestrator()
        tales = TherapeuticTales()
        intervention_lib = InterventionLibrary()
        logger.info("✅ Гипнотические модули готовы")
        
        # 6. Инициализируем утилиты
        logger.info("📦 Инициализация утилит...")
        morning_manager = MorningMessageManager()
        logger.info("✅ Утилиты готовы")
        
        # 7. Инициализируем менеджер голосовых соединений
        voice_manager = VoiceConnectionManager()
        logger.info("✅ VoiceConnectionManager готов")
        
        # 8. Создаем таблицы
        logger.info("📦 Проверка и создание таблиц...")
        await init_database_tables()
        logger.info("✅ Таблицы готовы")
        
        # 9. Запускаем фоновые задачи
        logger.info("📦 Запуск фоновых задач...")
        background_tasks = [
            asyncio.create_task(cleanup_old_data()),
            asyncio.create_task(send_reminders()),
            asyncio.create_task(update_metrics())
        ]
        logger.info("✅ Фоновые задачи запущены")
        
        logger.info("=" * 60)
        logger.info("✅ ПРИЛОЖЕНИЕ ГОТОВО К РАБОТЕ")
        logger.info("=" * 60)
        
        yield
        
        # ========== SHUTDOWN ==========
        logger.info("=" * 60)
        logger.info("🛑 ОСТАНОВКА ПРИЛОЖЕНИЯ")
        logger.info("=" * 60)
        
        # Отменяем фоновые задачи
        for task in background_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Закрываем соединения
        if db:
            await db.close()
        if cache:
            await cache.close()
        if ai_service:
            await ai_service.close()
        if voice_service:
            await voice_service.close()
        if weather_service:
            await weather_service.close()
        
        logger.info("✅ Приложение остановлено")
        
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при запуске: {e}")
        raise


# ============================================
# СОЗДАНИЕ ПРИЛОЖЕНИЯ
# ============================================
app = FastAPI(
    title="Фреди API",
    description="Виртуальный психолог - API для работы с пользователями, голосом и AI",
    version="3.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    websocket_ping_interval=15,   
    websocket_ping_timeout=30,
    # ДОБАВЬТЕ ЭТИ ПАРАМЕТРЫ:
    websocket_max_size=50 * 1024 * 1024,  # 50 MB
)

# ========== CORS НАСТРОЙКА - ДОЛЖНА БЫТЬ ПЕРВОЙ И ПРАВИЛЬНОЙ ==========
# Добавляем CORS middleware ПЕРВЫМ (до всех остальных middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://meysternlp.ru",           # ← Новый основной домен
        "http://meysternlp.ru",
        "https://www.meysternlp.ru",

        "https://fredi-frontend.onrender.com",   # ← Старый фронтенд
        "https://fredi-app.onrender.com",

        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://localhost:10000",
        "https://fredi-backend-flz2.onrender.com", # для self-запросов
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Upgrade", # для WebSocket
        "Connection", # для WebSocket
    ],
    expose_headers=[
        "Content-Length",
        "Content-Range",
        "X-Response-Time",
        "X-Total-Count",
    ],
    max_age=86400, # кэшировать preflight на 24 часа
)


# ============================================
# MIDDLEWARE: Логирование запросов (с поддержкой WebSocket)
# ============================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирование всех HTTP запросов (WebSocket пропускаем)"""
    # Пропускаем WebSocket соединения
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)
    
    start_time = time.time()
    
    logger.debug(f"→ {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        logger.info(
            f"{request.method} {request.url.path} "
            f"status={response.status_code} "
            f"duration={duration:.3f}s"
        )
        
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        return response
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f"{request.method} {request.url.path} "
            f"error={str(e)} "
            f"duration={duration:.3f}s"
        )
        raise


# ============================================
# WEBSOCKET ЭНДПОИНТ - ЖИВОЙ ГОЛОСОВОЙ ДИАЛОГ
# ============================================

@app.websocket("/ws/voice/{user_id}")
async def websocket_voice_endpoint(websocket: WebSocket, user_id: str):  # ← меняем на str
    """
    WebSocket эндпоинт для живого голосового диалога
    Поддерживает оба формата: число (старый фронт) и строку user_xxx (новый фронт)
    """
    logger.info(f"🔌 WebSocket connection attempt for user {user_id}")
    
    # ========== 1. ПРИНИМАЕМ СОЕДИНЕНИЕ ==========
    try:
        await websocket.accept()
        logger.info(f"✅ WebSocket accepted for user {user_id}")
    except Exception as e:
        logger.error(f"❌ Failed to accept WebSocket: {e}")
        return
    
    # ========== 2. ПРОВЕРЯЕМ МЕНЕДЖЕР ==========
    if not voice_manager:
        logger.error(f"❌ Voice manager not ready")
        try:
            await websocket.close(code=1011, reason="Voice service not ready")
        except:
            pass
        return
    
    # ========== 3. НОРМАЛИЗУЕМ USER_ID (поддержка int и str) ==========
    # Пробуем преобразовать в int для старого фронтенда
    try:
        user_id_int = int(user_id)
        user_id_for_db = user_id_int
        logger.info(f"✅ Старый формат (число): {user_id_for_db}")
    except ValueError:
        # Строковый формат для нового фронтенда
        user_id_for_db = user_id
        logger.info(f"✅ Новый формат (строка): {user_id_for_db}")
        
        # Создаем пользователя если не существует
        async with db.get_connection() as conn:
            exists = await conn.fetchval("SELECT 1 FROM users WHERE user_id::text = $1", user_id)
            if not exists:
                await conn.execute(
                    "INSERT INTO users (user_id, username, created_at, last_activity) VALUES ($1, $2, NOW(), NOW())",
                    user_id, f"user_{user_id}"
                )
                logger.info(f"📝 Создан пользователь со строковым ID: {user_id}")
    
    await voice_manager.connect(user_id_for_db, websocket)
    
    # ========== 4. ЗАГРУЖАЕМ КОНТЕКСТ (используем нормализованный ID) ==========
    try:
        context = await context_repo.get(user_id_for_db) or {}
        profile = await user_repo.get_profile(user_id_for_db) or {}
        logger.info(f"📦 Context loaded for user {user_id_for_db}: {context.get('name', 'unknown')}")
    except Exception as e:
        logger.error(f"❌ Failed to load context: {e}")
        await websocket.close(code=1011, reason="Context load failed")
        return
    
    # ========== 5. ОПРЕДЕЛЯЕМ РЕЖИМ ==========
    has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
    
    if not has_profile:
        mode_name = "basic"
        logger.info(f"🎭 User {user_id_for_db} has no profile, switching to BASIC mode")
    else:
        mode_name = context.get("communication_mode", "psychologist")
    
    logger.info(f"🎭 Mode: {mode_name} for user {user_id_for_db}")
    
    # ========== 6. СОЗДАЕМ ОБЪЕКТ РЕЖИМА ==========
    user_data = {
        "profile_data": profile.get("profile_data", {}),
        "perception_type": profile.get("perception_type", "не определен"),
        "thinking_level": profile.get("thinking_level", 5),
        "deep_patterns": profile.get("deep_patterns", {}),
        "behavioral_levels": profile.get("behavioral_levels", {}),
        "dilts_counts": profile.get("dilts_counts", {}),
        "confinement_model": profile.get("confinement_model"),
        "history": []
    }
    
    class SimpleContext:
        def __init__(self, data):
            self.name = data.get("name", "друг")
            self.gender = data.get("gender")
            self.age = data.get("age")
            self.city = data.get("city")
            self.weather_cache = data.get("weather_cache")
            self.communication_mode = data.get("communication_mode", "psychologist")
    
    simple_context = SimpleContext(context)
    
    try:
        mode_instance = get_mode(mode_name, user_id_for_db, user_data, simple_context)
        logger.info(f"✅ Mode instance created: {mode_instance.__class__.__name__}")
    except Exception as e:
        logger.error(f"❌ Failed to create mode instance: {e}")
        await websocket.close(code=1011, reason="Mode creation failed")
        return
    
    # ========== 7. ОСТАЛЬНОЙ КОД (буфер, heartbeat, цикл) ==========
    # ... здесь остаётся без изменений, но везде используем user_id_for_db
    
    audio_buffer = bytearray()
    chunk_count = 0
    
    # Heartbeat задача
    async def heartbeat_task():
        try:
            while True:
                await asyncio.sleep(25)
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                    logger.debug(f"💓 Server ping sent to user {user_id_for_db}")
                except Exception:
                    break
        except asyncio.CancelledError:
            pass
    
    heartbeat = asyncio.create_task(heartbeat_task())
    
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                    continue
                except:
                    break
            
            # Обработка сообщений (оставляем как было)
            if message.get("type") == "websocket.receive":
                if "bytes" in message:
                    audio_chunk = message["bytes"]
                    audio_buffer.extend(audio_chunk)
                    chunk_count += 1
                    
                    await websocket.send_json({
                        "type": "chunk_ack",
                        "chunk_index": chunk_count,
                        "timestamp": time.time()
                    })
                    
                    if len(audio_buffer) >= 32000:
                        await process_audio_buffer()
                
                elif "text" in message:
                    try:
                        data = json.loads(message["text"])
                        msg_type = data.get("type")
                        
                        if msg_type == "audio_chunk":
                            chunk_base64 = data.get("data", "")
                            is_final = data.get("is_final", False)
                            chunk_index = data.get("chunk_index", chunk_count)
                            
                            if chunk_base64:
                                chunk_data = base64.b64decode(chunk_base64)
                                audio_buffer.extend(chunk_data)
                                chunk_count += 1
                            
                            if is_final and len(audio_buffer) > 0:
                                await process_audio_buffer()
                        
                        elif msg_type == "interrupt":
                            logger.info(f"🛑 INTERRUPT from user {user_id_for_db}")
                            audio_buffer = bytearray()
                            chunk_count = 0
                            await websocket.send_json({"type": "status", "status": "listening"})
                        
                        elif msg_type == "ping":
                            await websocket.send_json({
                                "type": "pong",
                                "timestamp": data.get("timestamp", time.time())
                            })
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error: {e}")
                        await websocket.send_json({"type": "error", "error": "Invalid JSON"})
            
            elif message.get("type") == "websocket.disconnect":
                logger.info(f"🔌 WebSocket disconnected for user {user_id_for_db}")
                break
    
    except WebSocketDisconnect as e:
        logger.info(f"🔌 WebSocket disconnect for user {user_id_for_db}: code={e.code}")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
    finally:
        heartbeat.cancel()
        voice_manager.disconnect(user_id_for_db)
        logger.info(f"🧹 Cleanup complete for user {user_id_for_db}")
    
    # ========== ВНУТРЕННЯЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ АУДИО ==========
    async def process_audio_buffer():
        nonlocal audio_buffer, chunk_count
        
        if len(audio_buffer) < 1000:
            logger.warning(f"⚠️ Audio too short: {len(audio_buffer)} bytes")
            audio_buffer = bytearray()
            chunk_count = 0
            return
        
        logger.info(f"🎤 Processing audio: {len(audio_buffer)} bytes from {chunk_count} chunks")
        
        await websocket.send_json({"type": "status", "status": "processing"})
        
        try:
            recognized_text = await voice_service.speech_to_text_pcm(
                bytes(audio_buffer), sample_rate=16000
            )
            
            logger.info(f"📝 STT result: '{recognized_text}'")
            
            if recognized_text and len(recognized_text.strip()) > 0:
                await websocket.send_json({
                    "type": "text",
                    "data": f"🎤 Вы: {recognized_text}"
                })
                
                # Используем process_question_streaming (есть во всех режимах)
                response_text = ""
                async for chunk in mode_instance.process_question_streaming(recognized_text):
                    if chunk:
                        response_text += chunk
                        await websocket.send_json({
                            "type": "text",
                            "data": f"🧠 Фреди: {chunk}"
                        })
                
                if not response_text:
                    response_text = "Вопрос интересный. Расскажи подробнее, пожалуйста."
                
                response_text = normalize_tts_text(response_text)
                
                logger.info(f"💬 AI response: {len(response_text)} chars")
                await websocket.send_json({"type": "status", "status": "speaking"})
                
                try:
                    async for audio_chunk in voice_service.text_to_speech_streaming(
                        response_text, mode_name, chunk_size=4096
                    ):
                        if audio_chunk:
                            audio_base64 = base64.b64encode(audio_chunk).decode()
                            await websocket.send_json({
                                "type": "audio",
                                "data": audio_base64,
                                "is_final": False
                            })
                            await asyncio.sleep(0.05)
                    
                    await websocket.send_json({
                        "type": "audio",
                        "data": "",
                        "is_final": True
                    })
                    logger.info(f"✅ TTS complete")
                    
                    # Сохраняем в БД (используем нормализованный ID)
                    await message_repo.save(user_id_for_db, "user", recognized_text, {"voice": True})
                    await message_repo.save(user_id_for_db, "assistant", response_text, {"voice": True})
                    
                except Exception as e:
                    logger.error(f"TTS error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "error": f"TTS error: {str(e)}"
                    })
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": "Не удалось распознать речь"
                })
        
        except Exception as e:
            logger.error(f"Processing error: {e}", exc_info=True)
            await websocket.send_json({
                "type": "error",
                "error": f"Ошибка: {str(e)}"
            })
        
        audio_buffer = bytearray()
        chunk_count = 0
        await websocket.send_json({"type": "status", "status": "idle"})
                    
# ============================================
# ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
# ============================================
async def init_database_tables():
    """Создание всех необходимых таблиц"""
    async with db.get_connection() as conn:
        # Таблица пользователей
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                profile JSONB DEFAULT '{}',
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        
        # Таблица контекста пользователей
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_contexts (
                user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                context JSONB NOT NULL DEFAULT '{}',
                weather_cache JSONB,
                weather_cache_time TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Таблица сообщений
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Таблица результатов тестов
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS test_results (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                test_type TEXT NOT NULL,
                results JSONB NOT NULL,
                profile_code TEXT,
                perception_type TEXT,
                thinking_level INTEGER,
                vectors JSONB,
                behavioral_levels JSONB,
                confinement_model JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Таблица мыслей психолога
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS psychologist_thoughts (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                test_result_id BIGINT REFERENCES test_results(id) ON DELETE SET NULL,
                thought_type TEXT NOT NULL DEFAULT 'psychologist_thought',
                thought_text TEXT NOT NULL,
                thought_summary TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        
        # Таблица событий для статистики
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Таблица напоминаний
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                reminder_type TEXT NOT NULL,
                remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
                data JSONB,
                is_sent BOOLEAN DEFAULT FALSE,
                sent_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Таблица кэша идей на выходные
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS weekend_ideas_cache (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                ideas_text TEXT NOT NULL,
                main_vector TEXT,
                main_level INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
            )
        """)
        
        # Таблица утренних сообщений
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS morning_messages (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                message_text TEXT NOT NULL,
                message_type TEXT NOT NULL,
                day_number INTEGER DEFAULT 1,
                sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)

        # Таблица глубоких анализов
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS deep_analyses (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                analysis_text TEXT NOT NULL,
                analysis_type TEXT DEFAULT 'deep_analysis',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_deep_analyses_user_id 
            ON deep_analyses(user_id, created_at DESC)
        """)
        
        # ========== ИНДЕКСЫ ==========
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_user_id_created 
            ON messages(user_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_user_id 
            ON events(user_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_type 
            ON events(event_type, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_results_user_id 
            ON test_results(user_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_results_profile 
            ON test_results(profile_code) WHERE profile_code IS NOT NULL
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_reminders_pending 
            ON reminders(remind_at) WHERE is_sent = FALSE
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_weekend_cache_expires 
            ON weekend_ideas_cache(expires_at)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_morning_messages_user 
            ON morning_messages(user_id, sent_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_last_activity 
            ON users(last_activity DESC) WHERE is_active = TRUE
        """)
        
        logger.info("✅ Все таблицы и индексы созданы")


# ============================================
# ФОНОВЫЕ ЗАДАЧИ
# ============================================
async def cleanup_old_data():
    """Очистка старых данных (запускается каждый час)"""
    while True:
        try:
            await asyncio.sleep(3600)
            
            async with db.get_connection() as conn:
                await conn.execute("""
                    DELETE FROM messages 
                    WHERE created_at < NOW() - INTERVAL '30 days'
                """)
                
                await conn.execute("""
                    DELETE FROM events 
                    WHERE created_at < NOW() - INTERVAL '30 days'
                """)
                
                await conn.execute("""
                    DELETE FROM weekend_ideas_cache 
                    WHERE expires_at < NOW()
                """)
                
                await conn.execute("""
                    UPDATE users 
                    SET is_active = FALSE 
                    WHERE last_activity < NOW() - INTERVAL '90 days' 
                    AND is_active = TRUE
                """)
                
                logger.info("🧹 Cleanup completed")
                    
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


async def send_reminders():
    """Отправка отложенных напоминаний"""
    while True:
        try:
            await asyncio.sleep(60)
            
            async with db.get_connection() as conn:
                reminders = await conn.fetch("""
                    SELECT * FROM reminders 
                    WHERE is_sent = FALSE 
                    AND remind_at <= NOW()
                    LIMIT 100
                """)
                
                for reminder in reminders:
                    try:
                        logger.info(f"📬 Sending reminder {reminder['id']} to user {reminder['user_id']}")
                        
                        await conn.execute("""
                            UPDATE reminders 
                            SET is_sent = TRUE, sent_at = NOW() 
                            WHERE id = $1
                        """, reminder['id'])
                        
                    except Exception as e:
                        logger.error(f"Failed to send reminder {reminder['id']}: {e}")
                        
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Reminders error: {e}")


async def update_metrics():
    """Обновление метрик (каждые 5 минут)"""
    while True:
        try:
            await asyncio.sleep(300)
            
            async with db.get_connection() as conn:
                active_24h = await conn.fetchval("""
                    SELECT COUNT(DISTINCT user_id) 
                    FROM events 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                """)
                
                messages_1h = await conn.fetchval("""
                    SELECT COUNT(*) 
                    FROM messages 
                    WHERE created_at > NOW() - INTERVAL '1 hour'
                """)
                
                new_tests = await conn.fetchval("""
                    SELECT COUNT(*) 
                    FROM test_results 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                """)
                
                logger.info(
                    f"📊 Metrics: active_24h={active_24h}, "
                    f"messages_1h={messages_1h}, new_tests={new_tests}"
                )
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Metrics error: {e}")


# ============================================
# HEALTH CHECK
# ============================================
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check для Render"""
    logger.info("=" * 50)
    logger.info("🏥 HEALTH CHECK CALLED")
    logger.info("=" * 50)
    
    status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": False,
            "redis": False,
            "ai_service": False,
            "voice_service": False,
            "websocket": voice_manager is not None
        }
    }
    
    # Проверка базы данных
    if db:
        try:
            logger.info("🔍 Checking database connection...")
            async with db.get_connection() as conn:
                await conn.execute("SELECT 1")
            status["services"]["database"] = True
            logger.info("✅ Database connected successfully")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            status["services"]["database"] = False
            status["status"] = "degraded"
    else:
        logger.warning("⚠️ Database object is None")
        status["services"]["database"] = False
        status["status"] = "degraded"
    
    # Проверка Redis
    if cache and cache.is_connected:
        try:
            logger.info("🔍 Checking Redis connection...")
            await cache.redis.ping()
            status["services"]["redis"] = True
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            status["services"]["redis"] = False
            status["status"] = "degraded"
    else:
        logger.warning("⚠️ Redis not connected or cache is None")
        status["services"]["redis"] = False
    
    # Проверка AI Service
    if ai_service and ai_service.api_key:
        status["services"]["ai_service"] = True
        logger.info("✅ AI Service configured")
    else:
        logger.warning("⚠️ AI Service not configured")
        status["services"]["ai_service"] = False
    
    # Проверка Voice Service
    if voice_service:
        status["services"]["voice_service"] = True
        logger.info("✅ Voice Service available")
    else:
        logger.warning("⚠️ Voice Service not available")
        status["services"]["voice_service"] = False
    
    # Проверка WebSocket Manager
    if voice_manager:
        status["services"]["websocket"] = True
        logger.info(f"✅ WebSocket Manager active, connections: {len(voice_manager.active_connections)}")
    else:
        logger.warning("⚠️ WebSocket Manager not initialized")
        status["services"]["websocket"] = False
    
    logger.info(f"📊 Health status: {status['status']}")
    logger.info(f"📊 Services: {status['services']}")
    logger.info("=" * 50)
    
    if not status["services"]["database"]:
        status["status"] = "unhealthy"
        logger.error("❌ Database is required, marking as unhealthy")
        return JSONResponse(status_code=503, content=status)
    
    return status


@app.get("/api/ping")
async def ping():
    """Быстрая проверка доступности API"""
    return {
        "pong": True,
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": db is not None,
            "redis": cache.is_connected if cache else False,
            "websocket": voice_manager is not None
        }
    }


# ============================================
# API ЭНДПОИНТЫ
# ============================================

# ---------- КОНТЕКСТ ----------
@app.post("/api/save-context")
@limiter.limit("30/minute")
async def save_context(request: Request, data: SaveContextRequest):
    """Сохранить контекст пользователя"""
    try:
        await context_repo.save(data.user_id, data.context)
        await log_event(data.user_id, "save_context", {"context_keys": list(data.context.keys())})
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving context for user {data.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-context/{user_id}")
@limiter.limit("60/minute")
async def get_context(request: Request, user_id: int):
    """Получить контекст пользователя"""
    try:
        context = await context_repo.get(user_id)
        return {"success": True, "context": context or {}}
    except Exception as e:
        logger.error(f"Error getting context for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ПРОФИЛЬ ----------
@app.post("/api/save-profile")
@limiter.limit("10/minute")
async def save_profile(request: Request, data: SaveProfileRequest):
    """Сохранить профиль пользователя"""
    try:
        await user_repo.save_profile(data.user_id, data.profile)
        await log_event(data.user_id, "save_profile", {"profile_code": data.profile.get("display_name")})
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving profile for user {data.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-profile/{user_id}")
@limiter.limit("60/minute")
async def get_profile(request: Request, user_id: int):
    """Получить профиль пользователя"""
    try:
        profile = await user_repo.get_profile(user_id)
        if profile:
            if profile.get('ai_generated_profile'):
                profile['ai_generated_profile'] = format_profile_text(profile['ai_generated_profile'])
        return {"success": True, "profile": profile}
    except Exception as e:
        logger.error(f"Error getting profile for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-profile-interpretation/{user_id}")
@limiter.limit("30/minute")
async def get_profile_interpretation(request: Request, user_id: int):
    """Получить интерпретацию профиля (мысли психолога)"""
    try:
        cache_key = f"profile_interpretation:{user_id}"
        interpretation = await cache.get(cache_key) if cache else None
        
        if not interpretation:
            profile = await user_repo.get_profile(user_id)
            if profile:
                interpretation = await ai_service.generate_profile_interpretation(user_id, profile)
                if cache:
                    await cache.set(cache_key, interpretation, ttl=86400)
        
        if interpretation:
            interpretation = format_profile_text(interpretation)
        
        return {"success": True, "interpretation": interpretation}
    except Exception as e:
        logger.error(f"Error getting interpretation for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ЧАТ С РЕЖИМАМИ ----------
@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, data: ChatRequest):
    """Текстовый чат с Фреди с использованием режимов"""
    try:
        context_obj = await context_repo.get(data.user_id) or {}
        profile = await user_repo.get_profile(data.user_id) or {}
        
        # ========== АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ РЕЖИМА ==========
        # Проверяем, прошел ли пользователь тест
        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
        
        if not has_profile:
            # Если нет профиля — включаем режим БЕНДЕРА (BasicMode)
            mode_name = "basic"
            logger.info(f"🎭 User {data.user_id} has no profile, switching to BENADER mode")
        else:
            # Если есть профиль — используем выбранный режим
            mode_name = context_obj.get("communication_mode", data.mode)
        # ========== КОНЕЦ ОПРЕДЕЛЕНИЯ ==========
        
        # Создаем объект режима
        user_data = {
            "profile_data": profile.get("profile_data", {}),
            "perception_type": profile.get("perception_type", "не определен"),
            "thinking_level": profile.get("thinking_level", 5),
            "deep_patterns": profile.get("deep_patterns", {}),
            "behavioral_levels": profile.get("behavioral_levels", {}),
            "dilts_counts": profile.get("dilts_counts", {}),
            "confinement_model": profile.get("confinement_model"),
            "history": []
        }
        
        # Создаем объект контекста для режима
        class SimpleContext:
            def __init__(self, data):
                self.name = data.get("name", "друг")
                self.gender = data.get("gender")
                self.age = data.get("age")
                self.city = data.get("city")
                self.weather_cache = data.get("weather_cache")
                self.communication_mode = data.get("communication_mode", "psychologist")
        
        simple_context = SimpleContext(context_obj)
        
        # Получаем режим и обрабатываем вопрос
        mode_instance = get_mode(mode_name, data.user_id, user_data, simple_context)
        
        # Если есть анализатор вопросов, используем его (только для пользователей с профилем)
        reflection = None
        if has_profile and user_data.get("confinement_model"):
            try:
                from confinement.confinement_model import ConfinementModel9 as ConfinementModel
                from confinement.question_analyzer import QuestionContextAnalyzer
                analyzer = QuestionContextAnalyzer(
                    ConfinementModel.from_dict(user_data["confinement_model"]),
                    simple_context.name or "друг"
                )
                reflection = analyzer.get_reflection_text(data.message)
            except Exception as e:
                logger.warning(f"Error in question analysis: {e}")
        
        # Обрабатываем вопрос
        result = mode_instance.process_question(data.message)
        
        # Сохраняем в историю
        await message_repo.save(data.user_id, "user", data.message)
        await message_repo.save(data.user_id, "assistant", result["response"])
        
        await log_event(data.user_id, "chat", {
            "mode": mode_name,
            "message_length": len(data.message),
            "tools_used": result.get("tools_used", []),
            "has_profile": has_profile
        })
        
        return {
            "success": True,
            "response": result["response"],
            "mode_used": mode_name,
            "reflection": reflection
        }
        
    except Exception as e:
        logger.error(f"Error in chat for user {data.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chat/history/{user_id}")
@limiter.limit("30/minute")
async def get_chat_history(request: Request, user_id: int, limit: int = 50):
    """Получить историю чата пользователя"""
    try:
        messages = await message_repo.get_history(user_id, limit)
        return {"success": True, "messages": messages}
    except Exception as e:
        logger.error(f"Error getting history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== ГЛУБОКИЙ АНАЛИЗ ==========
@app.post("/api/deep-analysis")
@limiter.limit("5/minute")
async def deep_analysis(request: Request, data: ChatRequest):
    """Глубокий психологический анализ (отдельный эндпоинт)"""
    try:
        context_obj = await context_repo.get(data.user_id) or {}
        profile = await user_repo.get_profile(data.user_id) or {}
        
        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
        
        if not has_profile:
            return {"success": False, "error": "Сначала пройдите тест"}
        
        # Формируем данные для анализа
        profile_data = profile.get('profile_data', {})
        behavioral_levels = profile.get('behavioral_levels', {})
        deep_patterns = profile.get('deep_patterns', {})
        
        # УВЕЛИЧЕННЫЙ ПРОМПТ (max_tokens теперь 4000)
        system_prompt = """Ты — психолог Фреди. Проведи ГЛУБОКИЙ психологический анализ личности пользователя.

ВЕРНИ ОТВЕТ СТРОГО В ФОРМАТЕ JSON:

{
  "portrait": "Глубинный портрет: 5-6 предложений о характере, ключевых особенностях, внутренних конфликтах и базовых убеждениях",
  "loops": "Системные петли: 5-6 предложений с описанием 2-3 повторяющихся циклов поведения, как они замыкаются и к чему приводят",
  "mechanisms": "Скрытые механизмы: 5-6 предложений о защитных механизмах, бессознательных стратегиях и скрытых выгодах текущего поведения",
  "growth": "Точки роста: 5-6 предложений с конкретными практическими шагами, упражнениями и техниками для развития",
  "forecast": "Прогноз: 4-5 предложений — что будет без изменений и что станет возможным при работе над собой",
  "keys": "Персональные ключи: 4-5 предложений с ключевыми идеями, инсайтами и мантрами для пользователя"
}

ПРАВИЛА:
- Пиши на русском языке
- Обращайся на "ты"
- Не используй эмодзи
- Не используй маркдаун (** и т.д.)
- Каждое поле должно содержать ТОЛЬКО текст, без заголовков внутри
- Пиши содержательно, без воды
- Будь честным, но бережным

Пример правильного ответа:
{
  "portrait": "Ты — человек, чья личность и самооценка сильно зависят от внешнего одобрения. Ты обладаешь высокой чувствительностью к социальным сигналам. Твоя тревожная привязанность заставляет постоянно искать подтверждение своей значимости. В глубине души ты боишься отвержения и одиночества. При этом ты демонстрируешь высокую адаптивность и умение подстраиваться.",
  "loops": "Петля одобрения: жажда одобрения → гиперфокус на других → игнорирование себя → истощение → усиление жажды одобрения. Петля конфликта: страх конфликта → избегание → накопление обид → пассивная агрессия → усиление страха. Петля контроля: тревога → гиперконтроль → напряжение в отношениях → подтверждение тревоги.",
  "mechanisms": "Внешняя валидация как топливо — твоё состояние зависит от внешних сигналов. Слияние как защита — ты стираешь границы, чтобы чувствовать связь. Предвосхищающая адаптация — ты заранее подстраиваешь поведение под ожидания других.",
  "growth": "1. Начни распознавать свои истинные желания, отделяя их от желания угодить. 2. Практикуй малые отказы в безопасной среде. 3. Веди дневник эмоций, отслеживая триггеры тревоги. 4. Развивай навык самоуспокоения через дыхательные практики. 5. Учись говорить 'нет' без оправданий.",
  "forecast": "Без изменений: риск эмоционального выгорания, созависимые отношения и хроническая тревога. Ты будешь чувствовать пустоту и усталость, даже когда внешне всё хорошо. При работе над собой: ты сможешь построить здоровые, равноправные отношения, где тебя ценят за подлинность, а не за услужливость. Появится внутренняя опора и устойчивость.",
  "keys": "Твоя ценность не зависит от полезности для других. Тревога — это сигнал, а не приговор. Практикуй само-сочувствие каждый день. Твои границы — это не стена, а дверь, которую ты открываешь по своему желанию. Будь аутентичным — именно это притягивает нужных людей."
}"
"""
        
        user_prompt = f"""
Данные пользователя:
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9

Поведенческие уровни:
СБ (реакция на давление): {behavioral_levels.get('СБ', [3])[-1] if behavioral_levels.get('СБ') else 3}/6
ТФ (деньги): {behavioral_levels.get('ТФ', [3])[-1] if behavioral_levels.get('ТФ') else 3}/6
УБ (понимание мира): {behavioral_levels.get('УБ', [3])[-1] if behavioral_levels.get('УБ') else 3}/6
ЧВ (отношения): {behavioral_levels.get('ЧВ', [3])[-1] if behavioral_levels.get('ЧВ') else 3}/6

Глубинные паттерны:
{json.dumps(deep_patterns, ensure_ascii=False, indent=2) if deep_patterns else 'Нет данных'}

AI-профиль:
{profile.get('ai_generated_profile', 'Нет данных')[:1500]}

Проведи глубокий психологический анализ. Верни ответ строго в формате JSON. Пиши содержательно, 5-6 предложений в каждом разделе.
"""
        
        # УВЕЛИЧИЛИ max_tokens С 3000 ДО 4000
        response = await ai_service._call_deepseek(system_prompt, user_prompt, max_tokens=4000, temperature=0.7)
        
        if response:
            # Парсим JSON
            cleaned = re.sub(r'^```json\s*', '', response)
            cleaned = re.sub(r'\s*```$', '', cleaned)
            analysis_data = json.loads(cleaned)
            
            # Сохраняем в БД (используем обновленный метод)
            await user_repo.save_deep_analysis(data.user_id, analysis_data)
            
            return {"success": True, "analysis": analysis_data}
        else:
            return {"success": False, "error": "Не удалось сгенерировать анализ"}
        
    except Exception as e:
        logger.error(f"Deep analysis error: {e}")
        return {"success": False, "error": str(e)}


# ========== НОВЫЙ ЭНДПОИНТ: ПОЛУЧИТЬ СОХРАНЕННЫЙ АНАЛИЗ ==========
@app.get("/api/deep-analysis/{user_id}")
@limiter.limit("30/minute")
async def get_saved_deep_analysis(request: Request, user_id: Union[int, str]):
    """
    Получить последний сохраненный глубокий анализ пользователя
    Поддерживает оба формата user_id: int и str
    """
    try:
        # Нормализуем user_id
        if isinstance(user_id, str):
            try:
                # Пробуем преобразовать в int для старого формата
                user_id_int = int(user_id)
                user_id_for_db = user_id_int
            except ValueError:
                # Оставляем как строку для нового формата
                user_id_for_db = user_id
        else:
            user_id_for_db = user_id
        
        # Получаем сохраненный анализ
        saved_analysis = await user_repo.get_last_deep_analysis(user_id_for_db)
        
        if saved_analysis:
            return {
                "success": True, 
                "analysis": saved_analysis["analysis"],
                "cached": True,
                "created_at": saved_analysis.get("created_at"),
                "updated_at": saved_analysis.get("updated_at")
            }
        else:
            return {
                "success": False, 
                "analysis": None,
                "cached": False,
                "message": "Анализ ещё не выполнен. Вызовите POST /api/deep-analysis для генерации."
            }
        
    except Exception as e:
        logger.error(f"Error getting saved deep analysis for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


# ========== ДОПОЛНИТЕЛЬНЫЙ ЭНДПОИНТ: ИСТОРИЯ АНАЛИЗОВ ==========
@app.get("/api/deep-analysis/{user_id}/history")
@limiter.limit("20/minute")
async def get_deep_analysis_history(request: Request, user_id: Union[int, str], limit: int = 10):
    """
    Получить историю всех глубоких анализов пользователя
    """
    try:
        # Нормализуем user_id
        if isinstance(user_id, str):
            try:
                user_id_int = int(user_id)
                user_id_for_db = user_id_int
            except ValueError:
                user_id_for_db = user_id
        else:
            user_id_for_db = user_id
        
        history = await user_repo.get_deep_analyses_history(user_id_for_db, limit)
        
        return {
            "success": True,
            "history": history,
            "total": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error getting deep analysis history for user {user_id}: {e}")
        return {"success": False, "error": str(e), "history": []}
        
# ---------- ГОЛОС ----------
@app.post("/api/voice/process")
@limiter.limit("10/minute")
async def process_voice(
    request: Request,
    user_id: str = Form(...),  # ← принимаем как строку
    voice: UploadFile = File(...),
    mode: str = Form("psychologist")
):
    """Обработка голосового сообщения (STT + AI + TTS) - поддерживает оба формата user_id"""
    try:
        audio_bytes = await voice.read()
     
        if len(audio_bytes) < 1000:
            return {"success": False, "error": "Аудио файл слишком короткий"}
        
        # STT — распознавание речи
        recognized_text = await voice_service.speech_to_text(audio_bytes, "wav")
     
        if not recognized_text or not recognized_text.strip():
            return {"success": False, "error": "Не удалось распознать речь"}
        
        logger.info(f"🎤 Распознано: «{recognized_text}»")

        # ========== УНИВЕРСАЛЬНАЯ ОБРАБОТКА USER_ID ==========
        # Пробуем преобразовать в int (для старого фронтенда)
        try:
            user_id_int = int(user_id)
            user_id_for_db = user_id_int
            logger.info(f"✅ Старый формат user_id (число): {user_id_int}")
        except ValueError:
            # Строковый формат (для нового фронтенда)
            user_id_for_db = user_id
            logger.info(f"✅ Новый формат user_id (строка): {user_id}")
            
            # Убеждаемся, что пользователь есть в БД
            async with db.get_connection() as conn:
                exists = await conn.fetchval("SELECT 1 FROM users WHERE user_id::text = $1", user_id)
                if not exists:
                    await conn.execute(
                        "INSERT INTO users (user_id, username, created_at) VALUES ($1, $2, NOW())",
                        user_id, f"user_{user_id}"
                    )
                    logger.info(f"📝 Создан новый пользователь со строковым ID: {user_id}")
        
        # Загрузка данных пользователя (работает и с int, и со str)
        context_obj = await context_repo.get(user_id_for_db) or {}
        profile = await user_repo.get_profile(user_id_for_db) or {}
        
        # === ОПРЕДЕЛЕНИЕ РЕЖИМА ===
        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
     
        if not has_profile:
            mode_name = "basic"
            logger.info(f"🎭 User {user_id} has no profile → BASIC mode")
        else:
            mode_name = context_obj.get("communication_mode", mode)

        # === Создание объекта режима ===
        user_data = {
            "profile_data": profile.get("profile_data", {}),
            "perception_type": profile.get("perception_type", "не определен"),
            "thinking_level": profile.get("thinking_level", 5),
            "deep_patterns": profile.get("deep_patterns", {}),
            "behavioral_levels": profile.get("behavioral_levels", {}),
            "dilts_counts": profile.get("dilts_counts", {}),
            "confinement_model": profile.get("confinement_model"),
            "history": []
        }

        class SimpleContext:
            def __init__(self, data):
                self.name = data.get("name", "друг")
                self.gender = data.get("gender")
                self.age = data.get("age")
                self.city = data.get("city")
                self.weather_cache = data.get("weather_cache")
                self.communication_mode = data.get("communication_mode", "psychologist")

        simple_context = SimpleContext(context_obj)
        
        # Передаем user_id_for_db (может быть int или str)
        mode_instance = get_mode(mode_name, user_id_for_db, user_data, simple_context)

        # === ПОЛУЧЕНИЕ ОТВЕТА (универсальный вызов) ===
        response_text = None
        
        # Пробуем process_question_full (новый метод)
        if hasattr(mode_instance, 'process_question_full'):
            try:
                response_text = await mode_instance.process_question_full(recognized_text)
            except Exception as e:
                logger.warning(f"process_question_full failed: {e}")
        
        # Если не сработало, пробуем process_question_streaming
        if response_text is None and hasattr(mode_instance, 'process_question_streaming'):
            try:
                response_text = ""
                async for chunk in mode_instance.process_question_streaming(recognized_text):
                    response_text += chunk
            except Exception as e:
                logger.warning(f"process_question_streaming failed: {e}")
        
        # Если всё ещё нет ответа, используем синхронный метод
        if response_text is None or not response_text.strip():
            try:
                result = mode_instance.process_question(recognized_text)
                response_text = result.get("response", "")
            except Exception as e:
                logger.error(f"All methods failed: {e}")
                response_text = "Вопрос интересный. Расскажи подробнее, пожалуйста."

        # Защита от пустого ответа
        if not response_text or not response_text.strip():
            response_text = "Вопрос интересный. Расскажи подробнее, пожалуйста."

        response_text = normalize_tts_text(response_text)

        logger.info(f"💬 AI response: {len(response_text)} символов")

        # === TTS (синтез речи) ===
        audio_base64 = await voice_service.text_to_speech(response_text, mode_name)

        # Сохранение в историю (используем user_id_for_db)
        await message_repo.save(user_id_for_db, "user", recognized_text, {"voice": True})
        await message_repo.save(user_id_for_db, "assistant", response_text, {"voice": True})

        await log_event(user_id_for_db, "voice", {
            "text_length": len(recognized_text),
            "mode": mode_name,
            "has_profile": has_profile,
            "user_id_format": "int" if isinstance(user_id_for_db, int) else "str"
        })

        return {
            "success": True,
            "recognized_text": recognized_text,
            "answer": response_text,
            "audio_base64": audio_base64,
            "audio_mime": "audio/mpeg"
        }

    except Exception as e:
        logger.error(f"Error processing voice for user {user_id}: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
        
    
@app.post("/api/voice/tts")
@limiter.limit("30/minute")
async def text_to_speech_endpoint(
    request: Request, 
    text: str = Form(...), 
    mode: str = Form("psychologist")
):
    """Преобразование текста в речь (TTS) - возвращает MP3"""
    try:
        audio_base64 = await voice_service.text_to_speech(text, mode)
        if audio_base64:
            audio_bytes = base64.b64decode(audio_base64)
            return Response(content=audio_bytes, media_type="audio/mpeg")
        raise HTTPException(status_code=500, detail="TTS failed")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ПОГОДА ----------
# ============================================
# ПОГОДА - ПОЛНАЯ ВЕРСИЯ ДЛЯ ФРОНТЕНДА
# ============================================

@app.get("/api/weather/{user_id}")
@limiter.limit("30/minute")
async def get_weather(request: Request, user_id: int):
    """Получить погоду для пользователя по ID"""
    try:
        context = await context_repo.get(user_id) or {}
        city = context.get("city")
        
        if not city:
            return {
                "success": False, 
                "error": "Город не указан в профиле"
            }
        
        weather = await weather_service.get_weather(city)
        
        if weather:
            return {
                "success": True,
                "weather": {
                    "city": weather["city"],
                    "temperature": weather["temperature"],
                    "feels_like": weather["feels_like"],
                    "description": weather["description"],
                    "icon": weather["icon"],
                    "humidity": weather["humidity"],
                    "wind_speed": weather["wind_speed"],
                    "pressure": weather["pressure"]
                }
            }
        else:
            return {
                "success": False,
                "error": f"Не удалось получить погоду для города {city}"
            }
            
    except Exception as e:
        logger.error(f"Error getting weather for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/weather/by-city")
@limiter.limit("60/minute")
async def get_weather_by_city(request: Request, city: str):
    """Получить погоду по названию города"""
    try:
        if not city:
            return {
                "success": False,
                "error": "Название города не указано"
            }
        
        weather = await weather_service.get_weather(city)
        
        if weather:
            return {
                "success": True,
                "weather": {
                    "city": weather["city"],
                    "temperature": weather["temperature"],
                    "feels_like": weather["feels_like"],
                    "description": weather["description"],
                    "icon": weather["icon"],
                    "humidity": weather["humidity"],
                    "wind_speed": weather["wind_speed"],
                    "pressure": weather["pressure"]
                }
            }
        else:
            return {
                "success": False,
                "error": f"Не удалось получить погоду для города {city}"
            }
            
    except Exception as e:
        logger.error(f"Error getting weather for city {city}: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/weather/set-city")
@limiter.limit("10/minute")
async def set_user_city(request: Request):
    """Сохранить город пользователя"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        city = data.get("city")
        
        if not user_id or not city:
            return {
                "success": False,
                "error": "user_id и city обязательны"
            }
        
        # Получаем текущий контекст
        context = await context_repo.get(user_id) or {}
        
        # Обновляем город
        context["city"] = city
        
        # Сохраняем контекст
        await context_repo.save(user_id, context)
        
        # Логируем событие
        await log_event(user_id, "set_city", {"city": city})
        
        return {
            "success": True,
            "message": f"Город {city} сохранён для пользователя {user_id}"
        }
        
    except Exception as e:
        logger.error(f"Error setting city: {e}")
        return {"success": False, "error": str(e)}


# ---------- ИДЕИ НА ВЫХОДНЫЕ ----------
@app.get("/api/ideas/{user_id}")
@limiter.limit("10/minute")
async def get_weekend_ideas(request: Request, user_id: int):
    """Получить идеи на выходные"""
    try:
        cache_key = f"weekend_ideas:{user_id}"
        cached = await cache.get(cache_key) if cache else None
        
        if cached:
            return {"success": True, "ideas": cached}
        
        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}
        
        # Получаем scores
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3
        
        # Получаем идеи через планировщик
        ideas = await weekend_planner.get_weekend_ideas(
            user_id=user_id,
            user_name=context.get('name', 'друг'),
            scores=scores,
            profile_data=profile,
            context=context
        )
        
        if cache:
            await cache.set(cache_key, ideas, ttl=3600)
        
        return {"success": True, "ideas": ideas}
    except Exception as e:
        logger.error(f"Error getting weekend ideas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- УТРЕННИЕ СООБЩЕНИЯ ----------
@app.get("/api/morning-message/{user_id}")
@limiter.limit("5/minute")
async def get_morning_message(request: Request, user_id: int, day: int = 1):
    """Получить утреннее вдохновляющее сообщение"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}
        
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3
        
        message = await morning_manager.generate_morning_message(
            user_id=user_id,
            user_name=context.get('name', 'друг'),
            scores=scores,
            profile_data=profile,
            context=context,
            day=day
        )
        
        # Сохраняем в БД
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO morning_messages (user_id, message_text, message_type, day_number)
                VALUES ($1, $2, $3, $4)
            """, user_id, message, "morning", day)
        
        return {"success": True, "message": message}
        
    except Exception as e:
        logger.error(f"Error generating morning message: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/morning-message/schedule")
@limiter.limit("5/minute")
async def schedule_morning_messages(request: Request):
    """Запланировать серию утренних сообщений (3 дня)"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        
        if not user_id:
            return {"success": False, "error": "user_id required"}
        
        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}
        
        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3
        
        # Генерируем и сохраняем сообщения на 3 дня
        messages = []
        for day in range(1, 4):
            message = await morning_manager.generate_morning_message(
                user_id=user_id,
                user_name=context.get('name', 'друг'),
                scores=scores,
                profile_data=profile,
                context=context,
                day=day
            )
            messages.append({"day": day, "message": message})
            
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO morning_messages (user_id, message_text, message_type, day_number)
                    VALUES ($1, $2, $3, $4)
                """, user_id, message, "morning", day)
        
        await log_event(user_id, "schedule_morning_messages", {"days": 3})
        
        return {"success": True, "messages": messages}
        
    except Exception as e:
        logger.error(f"Error scheduling morning messages: {e}")
        return {"success": False, "error": str(e)}


# ---------- ЦЕЛИ ----------
@app.get("/api/goals/{user_id}")
@limiter.limit("20/minute")
async def get_goals(request: Request, user_id: int, mode: str = "coach"):
    """Получить персональные цели"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        goals = await ai_service.generate_goals(user_id, profile, mode)
        return {"success": True, "goals": goals}
    except Exception as e:
        logger.error(f"Error getting goals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ВОПРОСЫ ----------
@app.get("/api/smart-questions/{user_id}")
@limiter.limit("20/minute")
async def get_smart_questions(request: Request, user_id: int):
    """Получить умные вопросы для размышления"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        questions = await ai_service.generate_questions(user_id, profile)
        return {"success": True, "questions": questions}
    except Exception as e:
        logger.error(f"Error getting questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- МЫСЛИ ПСИХОЛОГА ----------
@app.get("/api/psychologist-thought/{user_id}")
@limiter.limit("20/minute")
async def get_psychologist_thought(request: Request, user_id: int):
    """Получить мысль психолога"""
    try:
        thought = await user_repo.get_psychologist_thought(user_id)
        
        if not thought:
            profile = await user_repo.get_profile(user_id) or {}
            if profile:
                thought = await ai_service.generate_psychologist_thought(user_id, profile)
                await user_repo.save_psychologist_thought(user_id, thought)
        
        if thought:
            context = await context_repo.get(user_id) or {}
            user_name = context.get('name', 'друг')
            thought = format_psychologist_text(thought, user_name)
        
        return {"success": True, "thought": thought}
    except Exception as e:
        logger.error(f"Error getting psychologist thought: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== ПСИХОМЕТРИЧЕСКИЕ ДВОЙНИКИ ==========
@app.get("/api/psychometric/find-doubles")
@limiter.limit("10/minute")
async def find_psychometric_doubles(
    request: Request, 
    user_id: str,
    limit: int = 10
):
    """
    Поиск психометрических двойников пользователя
    Без проверки согласия — если ищем, значит пользователь дал согласие
    """
    try:
        # Нормализуем user_id
        try:
            user_id_int = int(user_id)
            user_id_for_db = user_id_int
        except ValueError:
            user_id_for_db = user_id
        
        # 1. Получаем профиль текущего пользователя
        profile = await user_repo.get_profile(user_id_for_db) or {}
        profile_data = profile.get('profile_data', {})
        behavioral_levels = profile.get('behavioral_levels', {})
        
        # Получаем векторы текущего пользователя
        vectors = {
            'СБ': behavioral_levels.get('СБ', [4])[-1] if behavioral_levels.get('СБ') else 4,
            'ТФ': behavioral_levels.get('ТФ', [4])[-1] if behavioral_levels.get('ТФ') else 4,
            'УБ': behavioral_levels.get('УБ', [4])[-1] if behavioral_levels.get('УБ') else 4,
            'ЧВ': behavioral_levels.get('ЧВ', [4])[-1] if behavioral_levels.get('ЧВ') else 4
        }
        
        # 2. Ищем других пользователей с профилем
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT DISTINCT u.user_id, u.profile, u.username
                FROM users u
                WHERE u.user_id::text != $1
                AND u.profile IS NOT NULL
                AND u.profile != '{}'
                LIMIT $2
            """, user_id_for_db, limit * 3)
        
        doubles = []
        
        for row in rows:
            other_profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])
            other_behavioral = other_profile.get('behavioral_levels', {})
            
            # Получаем векторы другого пользователя
            other_vectors = {
                'СБ': other_behavioral.get('СБ', [4])[-1] if other_behavioral.get('СБ') else 4,
                'ТФ': other_behavioral.get('ТФ', [4])[-1] if other_behavioral.get('ТФ') else 4,
                'УБ': other_behavioral.get('УБ', [4])[-1] if other_behavioral.get('УБ') else 4,
                'ЧВ': other_behavioral.get('ЧВ', [4])[-1] if other_behavioral.get('ЧВ') else 4
            }
            
            # Вычисляем схожесть
            total_diff = 0
            differences = []
            
            for key in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                current_val = vectors.get(key, 4)
                other_val = other_vectors.get(key, 4)
                diff = abs(current_val - other_val)
                total_diff += diff
                if diff > 0:
                    differences.append(f"{key}: {current_val} → {other_val}")
            
            # Схожесть в процентах (макс разница 4 вектора * 6 уровней = 24)
            similarity = max(0, min(100, int((1 - total_diff / 24) * 100)))
            
            # Показываем всех, сортируем по схожести позже
            other_context = await context_repo.get(row['user_id']) or {}
            
            doubles.append({
                "user_id": row['user_id'],
                "name": other_context.get('name') or f"User_{row['user_id']}",
                "age": other_context.get('age'),
                "city": other_context.get('city'),
                "profile_code": other_profile.get('display_name', ''),
                "profile_type": other_profile.get('perception_type', ''),
                "similarity": similarity,
                "diff": ", ".join(differences) if differences else None
            })
        
        # Сортируем по схожести (убывание)
        doubles.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Отделяем точных двойников (>=80%) и близкие профили (50-79%)
        exact_doubles = [d for d in doubles if d['similarity'] >= 80]
        nearby_profiles = [d for d in doubles if 50 <= d['similarity'] < 80]
        
        return {
            "success": True,
            "doubles": exact_doubles[:limit],
            "nearby": nearby_profiles[:limit],
            "total_found": len(doubles),
            "your_profile": {
                "profile_code": profile_data.get('display_name'),
                "vectors": vectors,
                "profile_type": profile.get('perception_type')
            }
        }
        
    except Exception as e:
        logger.error(f"Error finding doubles for user {user_id}: {e}")
        return {"success": False, "error": str(e), "doubles": []}


# ---------- СТАТИСТИКА ----------
@app.get("/api/stats/{user_id}")
@limiter.limit("10/minute")
async def get_user_stats(request: Request, user_id: int):
    """Получить статистику пользователя"""
    try:
        async with db.get_connection() as conn:
            messages_count = await conn.fetchval("""
                SELECT COUNT(*) FROM messages WHERE user_id = $1
            """, user_id)
            
            sessions = await conn.fetchval("""
                SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at))
                FROM messages WHERE user_id = $1
            """, user_id)
            
            weekly_activity = await conn.fetch("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM messages
                WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """, user_id)
            
            test_results = await conn.fetch("""
                SELECT test_type, profile_code, created_at
                FROM test_results
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            """, user_id)
            
            morning_messages_count = await conn.fetchval("""
                SELECT COUNT(*) FROM morning_messages WHERE user_id = $1
            """, user_id)
        
        return {
            "success": True,
            "stats": {
                "total_messages": messages_count,
                "total_sessions": sessions,
                "weekly_activity": [dict(row) for row in weekly_activity],
                "test_results": [dict(row) for row in test_results],
                "morning_messages": morning_messages_count
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- НАПОМИНАНИЯ ----------
@app.post("/api/reminder")
@limiter.limit("10/minute")
async def create_reminder(
    request: Request,
    user_id: int = Form(...),
    reminder_type: str = Form(...),
    remind_at: str = Form(...)
):
    """Создать напоминание"""
    try:
        remind_dt = datetime.fromisoformat(remind_at)
        
        async with db.get_connection() as conn:
            reminder_id = await conn.fetchval("""
                INSERT INTO reminders (user_id, reminder_type, remind_at)
                VALUES ($1, $2, $3)
                RETURNING id
            """, user_id, reminder_type, remind_dt)
        
        await log_event(user_id, "create_reminder", {"type": reminder_type})
        
        return {"success": True, "reminder_id": reminder_id}
    except Exception as e:
        logger.error(f"Error creating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- АДМИНКА ----------
@app.get("/admin/stats")
async def admin_stats(request: Request):
    """Статистика для администратора"""
    try:
        async with db.get_connection() as conn:
            total_users = await conn.fetchval("SELECT COUNT(*) FROM users")
            active_today = await conn.fetchval("""
                SELECT COUNT(DISTINCT user_id) FROM events 
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)
            total_messages = await conn.fetchval("SELECT COUNT(*) FROM messages")
            total_tests = await conn.fetchval("SELECT COUNT(*) FROM test_results")
            total_morning = await conn.fetchval("SELECT COUNT(*) FROM morning_messages")
            
            modes_stats = await conn.fetch("""
                SELECT context->>'communication_mode' as mode, COUNT(*) as count
                FROM user_contexts
                WHERE context->>'communication_mode' IS NOT NULL
                GROUP BY context->>'communication_mode'
            """)
        
        return {
            "total_users": total_users,
            "active_today": active_today,
            "total_messages": total_messages,
            "total_tests": total_tests,
            "total_morning_messages": total_morning,
            "modes_distribution": [dict(row) for row in modes_stats]
        }
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# КОНФАЙНТМЕНТ-МОДЕЛЬ ЭНДПОИНТЫ
# ============================================

@app.get("/api/confinement/model/{user_id}")
async def get_confinement_model(user_id: int):
    """Получить конфайнтмент-модель пользователя"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        
        if not model_data:
            scores = {}
            behavioral_levels = profile.get('behavioral_levels', {})
            for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = behavioral_levels.get(vector, [])
                scores[vector] = sum(levels) / len(levels) if levels else 3.0
            
            model = ConfinementModel(user_id)
            model.build_from_profile(scores, profile.get('history', []))
            model_data = model.to_dict()
        
        return {
            "success": True,
            "elements": model_data.get('elements', {}),
            "links": model_data.get('links', []),
            "loops": model_data.get('loops', []),
            "key_confinement": model_data.get('key_confinement'),
            "is_closed": model_data.get('is_closed', False),
            "closure_score": model_data.get('closure_score', 0)
        }
    except Exception as e:
        logger.error(f"Error in confinement model: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/confinement/model/{user_id}/loops")
async def get_confinement_loops(user_id: int):
    """Получить петли конфайнтмент-модели"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        
        if not model_data:
            scores = {}
            behavioral_levels = profile.get('behavioral_levels', {})
            for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = behavioral_levels.get(vector, [])
                scores[vector] = sum(levels) / len(levels) if levels else 3.0
            
            model = ConfinementModel(user_id)
            model.build_from_profile(scores, profile.get('history', []))
            model_data = model.to_dict()
        
        model = ConfinementModel.from_dict(model_data)
        analyzer = LoopAnalyzer(model)
        loops = analyzer.analyze()
        
        return {
            "success": True,
            "loops": loops,
            "statistics": analyzer.get_statistics() if hasattr(analyzer, 'get_statistics') else {}
        }
    except Exception as e:
        logger.error(f"Error in confinement loops: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/confinement/model/{user_id}/key-confinement")
async def get_key_confinement(user_id: int):
    """Получить ключевое ограничение"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        
        if not model_data:
            scores = {}
            behavioral_levels = profile.get('behavioral_levels', {})
            for vector in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
                levels = behavioral_levels.get(vector, [])
                scores[vector] = sum(levels) / len(levels) if levels else 3.0
            
            model = ConfinementModel(user_id)
            model.build_from_profile(scores, profile.get('history', []))
            model_data = model.to_dict()
        
        model = ConfinementModel.from_dict(model_data)
        analyzer = LoopAnalyzer(model)
        loops = analyzer.analyze()
        detector = KeyConfinementDetector(model, loops)
        key_confinement = detector.detect()
        
        return {
            "success": True,
            "key_confinement": key_confinement,
            "break_points": detector.get_break_points() if hasattr(detector, 'get_break_points') else []
        }
    except Exception as e:
        logger.error(f"Error in key confinement: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/confinement/statistics/{user_id}")
async def get_confinement_statistics(user_id: int):
    """Получить статистику конфайнтмент-модели"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        
        if not model_data:
            return {
                "statistics": {
                    "total_elements": 0,
                    "active_elements": 0,
                    "total_loops": 0,
                    "is_system_closed": False,
                    "closure_score": 0
                }
            }
        
        model = ConfinementModel.from_dict(model_data)
        analyzer = LoopAnalyzer(model)
        stats = analyzer.get_statistics() if hasattr(analyzer, 'get_statistics') else {}
        
        return {"statistics": stats}
    except Exception as e:
        logger.error(f"Error in confinement statistics: {e}")
        return {"statistics": {}}


@app.get("/api/intervention/{element_id}")
async def get_intervention(element_id: int, user_id: int):
    """Получить интервенцию для элемента"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        
        if not model_data:
            return {"success": False, "error": "Модель не построена"}
        
        model = ConfinementModel.from_dict(model_data)
        element = model.elements.get(element_id)
        
        if not element:
            return {"success": False, "error": f"Элемент {element_id} не найден"}
        
        intervention = intervention_lib.get_daily_practice(element_id) if intervention_lib else {
            'title': 'Осознанность',
            'practice': 'Побудь в тишине 2 минуты',
            'duration': '2 минуты'
        }
        
        return {
            "success": True,
            "element": {
                "id": element.id,
                "name": element.name,
                "description": element.description,
                "type": element.element_type,
                "vector": element.vector,
                "level": element.level,
                "strength": element.strength
            },
            "intervention": intervention,
            "random_quote": intervention_lib.get_random_quote() if intervention_lib else "Изменения начинаются с осознания"
        }
    except Exception as e:
        logger.error(f"Error in intervention: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# ПРАКТИКИ И УПРАЖНЕНИЯ
# ============================================

@app.get("/api/practice/morning")
async def get_morning_practice():
    """Получить утреннюю практику"""
    return {
        "practice": "🌅 **УТРЕННЯЯ ПРАКТИКА**\n\n"
                    "Проснувшись, не вставайте сразу:\n\n"
                    "1. Сделайте 3 глубоких вдоха\n"
                    "2. Потянитесь всем телом\n"
                    "3. Улыбнитесь себе в зеркало\n"
                    "4. Скажите: «Сегодня будет хороший день»\n\n"
                    "⏱ Время: 3-5 минут"
    }


@app.get("/api/practice/evening")
async def get_evening_practice():
    """Получить вечернюю практику"""
    return {
        "practice": "🌙 **ВЕЧЕРНЯЯ ПРАКТИКА**\n\n"
                    "За 15 минут до сна:\n\n"
                    "1. Вспомните 3 хороших события сегодня\n"
                    "2. Поблагодарите себя за что-то\n"
                    "3. Сделайте 5 медленных вдохов\n"
                    "4. Скажите: «Я справляюсь. Я благодарен за этот день»\n\n"
                    "⏱ Время: 5-10 минут"
    }


@app.get("/api/practice/random-exercise")
async def get_random_exercise():
    """Получить случайное упражнение"""
    exercises = [
        "🧘 **Дыхание**\n\nСделайте паузу. Обратите внимание на своё дыхание. Вдох... выдох... Повторите 5 раз.",
        "👀 **Наблюдение**\n\nПосмотрите вокруг. Найдите 3 предмета, которые вызывают у вас приятные чувства.",
        "📝 **Дневник**\n\nНапишите одно дело, которое вы сделали хорошо сегодня.",
        "🚶 **Прогулка**\n\nВыйдите на 10 минут. Замечайте, что видите, слышите, чувствуете.",
        "💭 **Мысли**\n\nЗапишите все мысли, которые крутятся в голове. Не оценивайте, просто выпишите."
    ]
    return {"exercise": random.choice(exercises)}


@app.get("/api/practice/random-quote")
async def get_random_quote():
    """Получить случайную цитату"""
    quotes = [
        "«Не в силе, а в правде. Не в деньгах, а в душевном покое.» — Андрей Мейстер",
        "«То, что мы думаем, определяет то, что мы делаем. То, что мы делаем, определяет то, кем мы становимся.»",
        "«Маленькие шаги каждый день ведут к большим изменениям.»",
        "«Проблему нельзя решить на том же уровне, на котором она возникла.» — Альберт Эйнштейн",
        "«Изменения начинаются там, где заканчивается зона комфорта.»"
    ]
    return {"quote": random.choice(quotes)}


# ============================================
# ГИПНОЗ ЭНДПОИНТЫ
# ============================================

@app.get("/api/hypno/process")
async def hypno_process(user_id: int, text: str, mode: str = "psychologist"):
    """Обработка гипнотического запроса"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        
        context = {
            'mode': mode,
            'profile': profile,
            'confinement_model': profile.get('confinement_model')
        }
        
        if hypno:
            response = hypno.process(user_id, text, context)
        else:
            response = "Сделайте глубокий вдох... Представьте, что с каждым выдохом вы отпускаете напряжение... Вы в безопасности... Дышите..."
        
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in hypno process: {e}")
        return {"response": "Дышите спокойно. Всё хорошо. Я здесь."}


@app.post("/api/hypno/support")
async def hypno_support(request: Request):
    """Поддерживающий гипнотический ответ"""
    try:
        data = await request.json()
        text = data.get("text", "")
        
        support_texts = [
            "Я здесь. Ты справляешься. Дыши спокойно.",
            "Ты в безопасности. Всё идёт своим чередом.",
            "Позволь себе просто быть. Без оценок. Без долженствований.",
            "Ты делаешь достаточно. Ты уже справляешься."
        ]
        
        return {"response": random.choice(support_texts)}
    except Exception as e:
        logger.error(f"Error in hypno support: {e}")
        return {"response": "Я рядом. Дыши."}


# ============================================
# СКАЗКИ ЭНДПОИНТЫ
# ============================================

@app.get("/api/tale")
async def get_tale(issue: str = None):
    """Получить терапевтическую сказку"""
    try:
        if issue and tales:
            tale = tales.get_tale_for_issue(issue)
        else:
            tale = tales.get_random_tale()
        
        return {
            "success": True,
            "tale": tale.get('text', 'Сказка скоро появится...'),
            "title": tale.get('title', 'Сказка'),
            "available_tales": tales.get_all_tale_ids() if tales else ['growth']
        }
    except Exception as e:
        logger.error(f"Error in get tale: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/tale/{tale_id}")
async def get_tale_by_id(tale_id: str):
    """Получить конкретную сказку по ID"""
    try:
        if not tales:
            return {"success": False, "error": "Сказки недоступны"}
        
        tale = tales.get_tale_by_id(tale_id)
        
        if not tale:
            return {"success": False, "error": "Сказка не найдена"}
        
        return {
            "success": True,
            "tale": tale.get('text', ''),
            "title": tale.get('title', '')
        }
    except Exception as e:
        logger.error(f"Error in get tale by id: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# ЯКОРЯ ЭНДПОИНТЫ
# ============================================

@app.get("/api/anchor/user/{user_id}")
async def get_user_anchors(user_id: int):
    """Получить якоря пользователя"""
    try:
        anchors = []
        
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT metadata->>'name' as name, 
                       thought_text as phrase,
                       metadata->>'state' as state
                FROM psychologist_thoughts
                WHERE user_id = $1 AND thought_type = 'anchor'
                ORDER BY created_at DESC
                LIMIT 20
            """, user_id)
        
        for row in rows:
            anchors.append({
                "name": row['name'] or "Неизвестный",
                "phrase": row['phrase'],
                "state": row['state'] or "calm"
            })
        
        if not anchors:
            anchors = [
                {"name": "Спокойствие", "phrase": "Я спокоен. Я дышу ровно. Всё хорошо.", "state": "calm"},
                {"name": "Уверенность", "phrase": "Я знаю, что делаю. У меня всё получится.", "state": "confidence"},
                {"name": "Действие", "phrase": "Пора действовать. Я готов.", "state": "action"}
            ]
        
        return {"success": True, "anchors": anchors}
    except Exception as e:
        logger.error(f"Error in get user anchors: {e}")
        return {"success": False, "error": str(e), "anchors": []}


@app.post("/api/anchor/set")
async def set_anchor(request: Request):
    """Установить персональный якорь"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        anchor_name = data.get("anchor_name")
        state = data.get("state")
        phrase = data.get("phrase")
        
        if not all([user_id, anchor_name, state, phrase]):
            return {"success": False, "error": "Missing fields"}
        
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO psychologist_thoughts (user_id, thought_type, thought_text, metadata)
                VALUES ($1, 'anchor', $2, $3)
            """, user_id, phrase, json.dumps({
                "name": anchor_name,
                "state": state
            }))
        
        if hasattr(tales, 'set_anchor'):
            tales.set_anchor(user_id, anchor_name, state, phrase)
        
        await log_event(user_id, "set_anchor", {"name": anchor_name, "state": state})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error in set anchor: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/anchor/fire")
async def fire_anchor(request: Request):
    """Активировать якорь"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        anchor_name = data.get("anchor_name")
        
        if not user_id or not anchor_name:
            return {"success": False, "error": "user_id and anchor_name required"}
        
        phrase = None
        
        if hasattr(tales, 'fire_anchor'):
            phrase = tales.fire_anchor(user_id, anchor_name)
        
        if not phrase:
            phrases = {
                "calm": "Я спокоен. Я дышу ровно. Всё хорошо.",
                "confidence": "Я знаю, что делаю. У меня всё получится.",
                "action": "Пора действовать. Я готов.",
                "trust": "Я доверяю себе и миру.",
                "insight": "Понимание приходит. Я вижу яснее."
            }
            phrase = phrases.get(anchor_name, "Я здесь и сейчас. Я в безопасности.")
        
        await log_event(user_id, "fire_anchor", {"name": anchor_name})
        
        return {"success": True, "phrase": phrase}
    except Exception as e:
        logger.error(f"Error in fire anchor: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/anchor/{state}")
async def get_anchor_state(state: str):
    """Получить якорь по состоянию"""
    try:
        phrases = {
            "calm": "Я спокоен. Я дышу ровно. Всё хорошо.",
            "confidence": "Я знаю, что делаю. У меня всё получится.",
            "here": "Я здесь и сейчас. Я в безопасности.",
            "action": "Пора действовать. Я готов.",
            "trust": "Я доверяю себе и миру.",
            "insight": "Понимание приходит. Я вижу яснее."
        }
        
        phrase = phrases.get(state, "Я здесь. Я спокоен. Я в безопасности.")
        
        return {"success": True, "phrase": phrase}
    except Exception as e:
        logger.error(f"Error in get anchor: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# ДОПОЛНИТЕЛЬНЫЕ ЭНДПОИНТЫ
# ============================================

from typing import Optional

@app.get("/api/user-status")
async def user_status(user_id: Optional[str] = None):
    """
    Получить статус пользователя
    Поддерживает user_id как query-параметр (?user_id=...)
    Работает и со старым, и с новым фронтендом
    """
    try:
        if not user_id:
            return {"success": False, "error": "user_id is required"}

        # Приводим к строке и очищаем
        user_id = str(user_id).strip()
        
        # Пытаемся конвертировать в int, если не получается - оставляем строку
        try:
            user_id_int = int(user_id)
        except ValueError:
            # Если user_id строка (как у нового фронтенда), создаем запись
            user_id_int = None
            # Проверяем есть ли такой пользователь в БД
            async with db.get_connection() as conn:
                exists = await conn.fetchval("SELECT 1 FROM users WHERE user_id::text = $1", user_id)
                if not exists:
                    # Создаем пользователя со строковым ID
                    await conn.execute(
                        "INSERT INTO users (user_id, username, created_at) VALUES ($1, $2, NOW())",
                        user_id, f"user_{user_id}"
                    )
            user_id_int = user_id  # сохраняем строку для дальнейшей работы

        profile = await user_repo.get_profile(user_id_int) or {}

        has_profile = bool(
            profile.get('profile_data') or 
            profile.get('ai_generated_profile')
        )

        return {
            "success": True,
            "has_profile": has_profile,
            "test_completed": has_profile,
            "profile_code": profile.get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4') 
                           if has_profile else "не определен",
            "interpretation_ready": bool(profile.get('ai_generated_profile')),
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error in user-status for user_id={user_id}: {e}")
        return {"success": False, "error": "Internal server error"}

@app.post("/api/save-mode")
async def save_mode(request: Request):
    """Сохранить режим общения"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        mode = data.get("mode")
        
        if not user_id or not mode:
            return {"success": False, "error": "user_id and mode required"}
        
        context = await context_repo.get(user_id) or {}
        context["communication_mode"] = mode
        await context_repo.save(user_id, context)
        
        await log_event(user_id, "save_mode", {"mode": mode})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error in save-mode: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/thought")
async def thought(request: Request, user_id: int):
    """Получить мысль психолога (алиас)"""
    return await get_psychologist_thought(request, user_id)


@app.post("/api/psychologist-thoughts/generate")
async def generate_thought(request: Request):
    """Сгенерировать новую мысль психолога"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        
        if not user_id:
            return {"success": False, "error": "user_id required"}
        
        profile = await user_repo.get_profile(user_id) or {}
        thought = await ai_service.generate_psychologist_thought(user_id, profile)
        
        if thought:
            await user_repo.save_psychologist_thought(user_id, thought)
        
        return {"success": True, "thought": thought}
    except Exception as e:
        logger.error(f"Error in generate thought: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/goals/with-confinement")
async def goals_with_confinement(user_id: int, mode: str = "coach"):
    """Получить цели с учетом конфайнтмент-модели"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        goals = await ai_service.generate_goals(user_id, profile, mode)
        
        for goal in goals:
            goal["is_priority"] = goal.get("difficulty") == "hard"
        
        return {
            "success": True,
            "goals": goals[:6],
            "profile_code": profile.get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4')
        }
    except Exception as e:
        logger.error(f"Error in goals with confinement: {e}")
        return {"success": False, "error": str(e), "goals": []}


@app.get("/api/challenges")
async def get_challenges(user_id: int):
    """Получить челленджи для пользователя"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        profile_data = profile.get('profile_data', {})
        
        challenges = [
            {"id": 1, "name": "Ежедневное общение", "description": "Напиши сообщение в чат",
             "progress": 0, "target": 1, "reward": 10, "emoji": "💬", "type": "daily", "completed": False},
            {"id": 2, "name": "Анализ мыслей", "description": "Запиши 3 мысли в дневник",
             "progress": 0, "target": 3, "reward": 30, "emoji": "📝", "type": "daily", "completed": False}
        ]
        
        sb_level = profile_data.get('sb_level', 4)
        tf_level = profile_data.get('tf_level', 4)
        
        if sb_level < 3:
            challenges.append({"id": 4, "name": "Преодоление страхов", "description": "Сделай одно действие, которое пугает",
                              "progress": 0, "target": 1, "reward": 50, "emoji": "🛡️", "type": "personalized", "completed": False})
        
        if tf_level < 3:
            challenges.append({"id": 5, "name": "Финансовая осознанность", "description": "Запиши все расходы",
                              "progress": 0, "target": 1, "reward": 40, "emoji": "💰", "type": "personalized", "completed": False})
        
        return {"success": True, "challenges": challenges}
    except Exception as e:
        logger.error(f"Error in challenges: {e}")
        return {"success": False, "error": str(e), "challenges": []}


@app.get("/api/psychometric/find-doubles")
async def find_doubles(user_id: int, limit: int = 10):
    """Найти психометрических двойников"""
    try:
        profile = await user_repo.get_profile(user_id) or {}
        profile_data = profile.get('profile_data', {})
        profile_code = profile_data.get('display_name', '')
        
        doubles = []
        
        if profile_code:
            async with db.get_connection() as conn:
                rows = await conn.fetch("""
                    SELECT user_id, profile->'profile_data'->>'display_name' as profile_code
                    FROM users
                    WHERE profile->'profile_data'->>'display_name' = $1
                    AND user_id != $2
                    LIMIT $3
                """, profile_code, user_id, limit)
                
                for row in rows:
                    doubles.append({
                        "user_id": row['user_id'],
                        "name": f"Пользователь {row['user_id']}",
                        "profile_code": row['profile_code'],
                        "similarity": 0.85,
                        "common_traits": ["Аналитическое мышление", "Эмоциональный интеллект"]
                    })
        
        return {
            "success": True,
            "doubles": doubles,
            "total": len(doubles),
            "profile_code": profile_code
        }
    except Exception as e:
        logger.error(f"Error in find doubles: {e}")
        return {"success": False, "error": str(e), "doubles": []}


# ============================================
# ТЕСТ ЭНДПОИНТЫ
# ============================================

@app.post("/api/save-test-results")
@limiter.limit("5/minute")
async def save_test_results(request: Request):
    """Сохраняет результаты теста и сразу генерирует AI-профиль"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        results = data.get('results', {})
        
        if not user_id:
            return {"success": False, "error": "user_id required"}
        
        logger.info(f"📊 Saving test results for user {user_id}")
        
        profile_data = results.get('profile_data', {})
        perception_type = results.get('perception_type')
        thinking_level = results.get('thinking_level')
        behavioral_levels = results.get('behavioral_levels', {})
        deep_patterns = results.get('deep_patterns', {})
        profile_code = profile_data.get('displayName')
        
        # Сохраняем результаты теста
        test_result_id = await user_repo.save_test_results(
            user_id=user_id, test_type='full_test', results=results,
            profile_code=profile_code, perception_type=perception_type,
            thinking_level=thinking_level, vectors=behavioral_levels,
            behavioral_levels=behavioral_levels, confinement_model=deep_patterns
        )
        
        full_profile = {
            'profile_data': profile_data,
            'perception_type': perception_type,
            'thinking_level': thinking_level,
            'behavioral_levels': behavioral_levels,
            'deep_patterns': deep_patterns,
            'test_result_id': test_result_id,
            'test_completed_at': datetime.now().isoformat(),
            'display_name': profile_code
        }
        
        # Сохраняем профиль
        await user_repo.save_profile(user_id, full_profile)
        
        # ========== АКТИВНАЯ ГЕНЕРАЦИЯ AI-ПРОФИЛЯ ==========
        logger.info(f"🤖 Начинаем активную генерацию AI-профиля для {user_id}")
        
        ai_profile = None
        thought = None
        
        try:
            # Генерируем AI-профиль
            ai_profile = await ai_service.generate_ai_profile(user_id, full_profile)
            if ai_profile:
                await user_repo.update_profile_field(user_id, 'ai_generated_profile', ai_profile)
                logger.info(f"✅ AI-профиль сгенерирован для {user_id} (длина: {len(ai_profile)})")
            else:
                logger.warning(f"⚠️ AI-профиль не сгенерирован для {user_id}")
        except Exception as e:
            logger.error(f"❌ Ошибка генерации AI-профиля: {e}")
        
        try:
            # Генерируем мысль психолога
            thought = await ai_service.generate_psychologist_thought(user_id, full_profile)
            if thought:
                await user_repo.save_psychologist_thought(user_id, thought, test_result_id)
                logger.info(f"✅ Мысль психолога сгенерирована для {user_id}")
            else:
                logger.warning(f"⚠️ Мысль психолога не сгенерирована для {user_id}")
        except Exception as e:
            logger.error(f"❌ Ошибка генерации мысли психолога: {e}")
        
        # ========== ВОЗВРАЩАЕМ РЕЗУЛЬТАТ СРАЗУ ==========
        await log_event(user_id, "test_completed", {"profile_code": profile_code})
        
        return {
            "success": True,
            "test_result_id": test_result_id,
            "profile_code": profile_code,
            "ai_profile": ai_profile,
            "psychologist_thought": thought
        }
        
    except Exception as e:
        logger.error(f"Error saving test results: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/test-results/{user_id}")
@limiter.limit("30/minute")
async def get_test_results(request: Request, user_id: int):
    """Получить результаты теста пользователя"""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT id, test_type, results, profile_code, 
                       perception_type, thinking_level, created_at
                FROM test_results
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            """, user_id)
            
            results = []
            for row in rows:
                results.append({
                    "id": row['id'], "test_type": row['test_type'],
                    "results": row['results'] if isinstance(row['results'], dict) else json.loads(row['results']),
                    "profile_code": row['profile_code'], "perception_type": row['perception_type'],
                    "thinking_level": row['thinking_level'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            
            return {"success": True, "results": results}
            
    except Exception as e:
        logger.error(f"Error getting test results: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/tts")
async def tts_compat(
    request: Request,
    text: str = Form(...),
    mode: str = Form("psychologist")
):
    """Совместимый эндпоинт для TTS"""
    try:
        audio_base64 = await voice_service.text_to_speech(text, mode)
        
        if audio_base64:
            return {
                "audio_url": f"data:audio/mpeg;base64,{audio_base64}",
                "success": True
            }
        else:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "TTS failed"}
            )
            
    except Exception as e:
        logger.error(f"TTS compat error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# ============================================
# НОВЫЙ ЭНДПОИНТ: ПОЛУЧЕНИЕ СГЕНЕРИРОВАННОГО ПРОФИЛЯ ПОСЛЕ ТЕСТА
# ============================================

@app.get("/api/generated-profile/{user_id}")
@limiter.limit("30/minute")
async def get_generated_profile(request: Request, user_id: int):
    """
    Получить сгенерированный AI-профиль (с активной генерацией если нет)
    """
    try:
        profile = await user_repo.get_profile(user_id) or {}
        
        # Получаем рассчитанный профиль
        profile_data = profile.get('profile_data', {})
        deep_patterns = profile.get('deep_patterns', {})
        
        # Получаем AI-профиль (если есть)
        ai_profile = profile.get('ai_generated_profile')
        
        # Получаем мысли психолога (если есть)
        psychologist_thought = await user_repo.get_psychologist_thought(user_id)
        
        # Форматируем, если нужно
        if psychologist_thought:
            context = await context_repo.get(user_id) or {}
            user_name = context.get('name', 'друг')
            psychologist_thought = format_psychologist_text(psychologist_thought, user_name)
        
        # ЕСЛИ НЕТ AI-ПРОФИЛЯ — ГЕНЕРИРУЕМ СЕЙЧАС
        if not ai_profile and profile_data:
            logger.info(f"🤖 Активная генерация AI-профиля для {user_id} (по запросу)")
            
            try:
                # Генерируем AI-профиль
                ai_profile = await ai_service.generate_ai_profile(user_id, profile)
                if ai_profile:
                    await user_repo.update_profile_field(user_id, 'ai_generated_profile', ai_profile)
                    logger.info(f"✅ AI-профиль сгенерирован для {user_id}")
                else:
                    logger.warning(f"⚠️ AI-профиль не сгенерирован для {user_id}")
            except Exception as e:
                logger.error(f"❌ Ошибка генерации AI-профиля: {e}")
        
        # ЕСЛИ НЕТ МЫСЛИ ПСИХОЛОГА — ГЕНЕРИРУЕМ СЕЙЧАС
        if not psychologist_thought and profile_data:
            logger.info(f"💭 Активная генерация мысли психолога для {user_id}")
            
            try:
                thought = await ai_service.generate_psychologist_thought(user_id, profile)
                if thought:
                    # Получаем последний test_result_id
                    async with db.get_connection() as conn:
                        test_result = await conn.fetchrow("""
                            SELECT id FROM test_results 
                            WHERE user_id = $1 
                            ORDER BY created_at DESC 
                            LIMIT 1
                        """, user_id)
                        test_result_id = test_result['id'] if test_result else None
                    
                    await user_repo.save_psychologist_thought(user_id, thought, test_result_id)
                    psychologist_thought = format_psychologist_text(thought, context.get('name', 'друг') if context else 'друг')
                    logger.info(f"✅ Мысль психолога сгенерирована для {user_id}")
            except Exception as e:
                logger.error(f"❌ Ошибка генерации мысли психолога: {e}")
        
        return {
            "success": True,
            "status": "ready",
            "profile_data": profile_data,
            "deep_patterns": deep_patterns,
            "ai_profile": ai_profile,
            "psychologist_thought": psychologist_thought,
            "profile_code": profile_data.get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4')
        }
        
    except Exception as e:
        logger.error(f"Error getting generated profile for user {user_id}: {e}")
        return {"success": False, "error": str(e)}

# ============================================
# ПРОВЕРКА РЕАЛЬНОСТИ ЭНДПОИНТЫ
# ============================================

@app.get("/api/reality/path/{goal_id}")
async def get_reality_path(goal_id: str, mode: str = "coach"):
    """Получить теоретический путь к цели"""
    try:
        path = get_theoretical_path(goal_id, mode)
        return {"success": True, "path": path}
    except Exception as e:
        logger.error(f"Error in reality path: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/reality/check")
async def check_reality(request: Request):
    """Проверить достижимость цели"""
    try:
        data = await request.json()
        goal_id = data.get("goal_id")
        mode = data.get("mode", "coach")
        life_context = data.get("life_context", {})
        goal_context = data.get("goal_context", {})
        profile = data.get("profile", {})
        
        path = get_theoretical_path(goal_id, mode)
        result = calculate_feasibility(path, life_context, goal_context, profile)
        
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Error in reality check: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/reality/questions/life")
async def get_life_questions():
    """Получить вопросы о жизненном контексте"""
    return {"success": True, "questions": generate_life_context_questions()}


@app.post("/api/reality/parse/life")
async def parse_life_answers(request: Request):
    """Распарсить ответы о жизненном контексте"""
    try:
        data = await request.json()
        text = data.get("text", "")
        parsed = parse_life_context_answers(text)
        return {"success": True, "parsed": parsed}
    except Exception as e:
        logger.error(f"Error parsing life answers: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/reality/parse/goal")
async def parse_goal_answers(request: Request):
    """Распарсить ответы о целевом контексте"""
    try:
        data = await request.json()
        text = data.get("text", "")
        parsed = parse_goal_context_answers(text)
        return {"success": True, "parsed": parsed}
    except Exception as e:
        logger.error(f"Error parsing goal answers: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================
async def log_event(user_id: int, event_type: str, event_data: Dict = None):
    """Логирование события"""
    try:
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO events (user_id, event_type, event_data)
                VALUES ($1, $2, $3)
            """, user_id, event_type, json.dumps(event_data) if event_data else None)
    except Exception as e:
        logger.error(f"Error logging event for user {user_id}: {type(e).__name__}: {e}")


# ============================================
# ТОЧКА ВХОДА - ТОЛЬКО ДЛЯ РАЗРАБОТКИ
# ============================================

if __name__ == "__main__":
    # Запуск в режиме разработки (python main.py)
    logger.info("🚀 Запуск в режиме разработки (Uvicorn)")
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=False
    )

# ============================================
# ПРИНУДИТЕЛЬНЫЙ ЗАПУСК LIFESPAN ДЛЯ RENDER
# ============================================
import asyncio

_lifespan_started = False

async def _force_lifespan():
    global _lifespan_started
    if _lifespan_started:
        return
    
    logger.info("🔄 Принудительный запуск lifespan...")
    try:
        async with lifespan(app):
            _lifespan_started = True
            logger.info("✅ Lifespan успешно запущен принудительно")
            await asyncio.Event().wait()
    except Exception as e:
        logger.error(f"❌ Ошибка при принудительном запуске lifespan: {e}")

# Если модуль импортируется (не запускается напрямую), запускаем lifespan

@app.post("/api/migrate-user")
async def migrate_user(request: Request):
    """Миграция строкового ID в числовой"""
    try:
        data = await request.json()
        old_user_id = data.get('old_user_id')
        new_user_id = data.get('new_user_id')
        
        if not old_user_id or not new_user_id:
            return {"success": False, "error": "Missing ids"}
        
        async with db.get_connection() as conn:
            # Переносим данные из старого ID в новый
            await conn.execute("""
                UPDATE messages SET user_id = $1 WHERE user_id::text = $2
            """, new_user_id, old_user_id)
            
            await conn.execute("""
                UPDATE user_contexts SET user_id = $1 WHERE user_id::text = $2
            """, new_user_id, old_user_id)
            
            await conn.execute("""
                UPDATE test_results SET user_id = $1 WHERE user_id::text = $2
            """, new_user_id, old_user_id)
            
            await conn.execute("""
                UPDATE psychologist_thoughts SET user_id = $1 WHERE user_id::text = $2
            """, new_user_id, old_user_id)
            
            await conn.execute("""
                UPDATE events SET user_id = $1 WHERE user_id::text = $2
            """, new_user_id, old_user_id)
            
            # Удаляем старого пользователя
            await conn.execute("DELETE FROM users WHERE user_id::text = $1", old_user_id)
            
        logger.info(f"✅ Миграция: {old_user_id} → {new_user_id}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Migration error: {e}")
        return {"success": False, "error": str(e)}
        
if __name__ != "__main__":
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_force_lifespan())
            logger.info("✅ Задача принудительного запуска lifespan создана")
        else:
            loop.run_until_complete(_force_lifespan())
    except RuntimeError:
        asyncio.run(_force_lifespan())

# ============================================
# ДЛЯ ASGI СЕРВЕРОВ (Daphne, Uvicorn)
# ============================================
# Экспортируем приложение для ASGI серверов
application = app
