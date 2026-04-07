#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Фреди - Виртуальный психолог
Асинхронный API сервер на FastAPI
Версия 3.2 - Исправлены баги аудита:
  1. Добавлен /api/ai/generate
  2. История диалога загружается перед get_mode()
  3. BasicMode.message_counter передаётся через context
  4. weather 'temp' → 'temperature' (в get_context_string через context_obj)
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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from db import Database
from cache import RedisCache
from services.ai_service import AIService
from services.weather_service import WeatherService
from services.weekend_planner import WeekendPlanner
from repositories.user_repo import UserRepository
from repositories.context_repo import ContextRepository
from repositories.message_repo import MessageRepository
from confinement.confinement_model import ConfinementModel9 as ConfinementModel
from confinement.loop_analyzer import LoopAnalyzer, create_analyzer_from_model_data
from confinement.key_confinement import KeyConfinementDetector
from confinement.intervention_library import InterventionLibrary
from confinement.question_analyzer import QuestionContextAnalyzer, create_analyzer_from_user_data
from hypno.hypno_module import HypnoOrchestrator
from hypno.therapeutic_tales import TherapeuticTales
from modes.base_mode import BaseMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode
from modes import get_mode
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
hypno: Optional[HypnoOrchestrator] = None
tales: Optional[TherapeuticTales] = None
intervention_lib: Optional[InterventionLibrary] = None
morning_manager: Optional[MorningMessageManager] = None
push_service = None
weekend_planner: Optional[WeekendPlanner] = None

# ============================================
# VOICE CONNECTION MANAGER
# ============================================

class VoiceConnectionManager:
    def __init__(self):
        self.active_connections: Dict[Any, WebSocket] = {}
        self.speaking_tasks: Dict[Any, asyncio.Task] = {}

    async def connect(self, user_id: Any, websocket: WebSocket):
        self.active_connections[user_id] = websocket
        logger.info(f"🔊 Voice WS connected for user {user_id}")

    def disconnect(self, user_id: Any):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.speaking_tasks:
            task = self.speaking_tasks.pop(user_id, None)
            if task and not task.done():
                task.cancel()
        logger.info(f"🔊 Voice WS disconnected for user {user_id}")

    async def send_audio(self, user_id: Any, audio_base64: str, is_final: bool = True):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({
                    "type": "audio", "data": audio_base64, "is_final": is_final
                })
            except Exception as e:
                logger.error(f"Error sending audio to {user_id}: {e}")

    async def send_text(self, user_id: Any, text: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({"type": "text", "data": text})
            except Exception as e:
                logger.error(f"Error sending text to {user_id}: {e}")

    async def send_status(self, user_id: Any, status: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({"type": "status", "status": status})
            except Exception as e:
                logger.error(f"Error sending status to {user_id}: {e}")

    async def send_error(self, user_id: Any, error: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json({"type": "error", "error": error})
            except Exception as e:
                logger.error(f"Error sending error to {user_id}: {e}")

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

# ФИХ 1: Pydantic-модель для /api/ai/generate
class PushSubscribeRequest(BaseModel):
    user_id: int
    subscription: Dict[str, Any]

class PushSendRequest(BaseModel):
    user_id: int
    title: str
    body: str
    url: str = "/"

class AIGenerateRequest(BaseModel):
    user_id: int
    prompt: str
    max_tokens: int = 1000
    temperature: float = 0.7

# ============================================
# LIFESPAN
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, cache, ai_service, voice_service, weather_service
    global user_repo, context_repo, message_repo
    global hypno, tales, intervention_lib
    global morning_manager, weekend_planner
    global voice_manager

    logger.info("=" * 60)
    logger.info("🚀 ЗАПУСК ПРИЛОЖЕНИЯ ФРЕДИ v3.2")
    logger.info("=" * 60)

    try:
        logger.info("📦 Подключение к PostgreSQL...")
        db = Database()
        await db.connect()
        logger.info("✅ PostgreSQL подключена")

        logger.info("📦 Подключение к Redis...")
        cache = RedisCache()
        await cache.connect()
        if cache.is_connected:
            logger.info("✅ Redis подключен")
        else:
            logger.warning("⚠️ Redis не подключен (работаем без кэша)")

        logger.info("📦 Инициализация репозиториев...")
        user_repo = UserRepository(db, cache)
        context_repo = ContextRepository(db, cache)
        message_repo = MessageRepository(db, cache)
        logger.info("✅ Репозитории готовы")

        logger.info("📦 Инициализация сервисов...")
        ai_service = AIService(cache)
        voice_service = VoiceService()
        weather_service = WeatherService(cache)
        weekend_planner = WeekendPlanner(ai_service)
        logger.info("✅ Сервисы готовы")

        logger.info("📦 Инициализация гипнотических модулей...")
        hypno = HypnoOrchestrator()
        tales = TherapeuticTales()
        intervention_lib = InterventionLibrary()
        logger.info("✅ Гипнотические модули готовы")

        logger.info("📦 Инициализация утилит...")
        morning_manager = MorningMessageManager()
        logger.info("✅ Утилиты готовы")

        voice_manager = VoiceConnectionManager()

        # Push-уведомления
        from services.push_service import PushService
        global push_service
        push_service = PushService(db)
        logger.info("✅ PushService готов")
        logger.info("✅ VoiceConnectionManager готов")

        logger.info("📦 Проверка и создание таблиц...")
        await init_database_tables()
        logger.info("✅ Таблицы готовы")

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

        logger.info("=" * 60)
        logger.info("🛑 ОСТАНОВКА ПРИЛОЖЕНИЯ")
        logger.info("=" * 60)

        for task in background_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        if db: await db.close()
        if cache: await cache.close()
        if ai_service: await ai_service.close()
        if voice_service: await voice_service.close()
        if weather_service: await weather_service.close()

        logger.info("✅ Приложение остановлено")

    except Exception as e:
        logger.error(f"❌ Критическая ошибка при запуске: {e}")
        raise
