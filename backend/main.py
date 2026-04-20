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
from typing import Optional, Dict, Any, List, Union, Tuple
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
from services.freddy_service import get_freddy_service

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
from payment_routes import register_payment_routes
from bot_routes import register_bot_routes
from auth_routes import create_auth_router
from email_service import EmailService
from analytics_routes import register_analytics_routes, log_server_event
from modes.base_mode import BaseMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode
from modes import get_mode


# ===== Многоавторская архитектура психолога: персистенция метода между запросами =====
def _merge_psychologist_state(user_data: dict, context_obj: dict) -> None:
    """Подмешивает сохранённый state многоавторского психолога в user_data."""
    psy = (context_obj or {}).get("psychologist_state") or {}
    user_data["current_method_code"] = psy.get("current_method_code")
    user_data["method_changes_count"] = int(psy.get("method_changes_count", 0) or 0)
    user_data["method_selected_at"] = psy.get("method_selected_at")


async def _save_psychologist_state(user_id, context_obj: dict, mode_instance, mode_name: str) -> None:
    """После работы режима психолога — сохраняет current_method_code/changes_count/selected_at в БД."""
    if mode_name != "psychologist" or mode_instance is None:
        return
    msa = getattr(mode_instance, "method_selected_at", None)
    if hasattr(msa, "isoformat"):
        msa = msa.isoformat()
    state = {
        "current_method_code": getattr(mode_instance, "current_method_code", None),
        "method_changes_count": int(getattr(mode_instance, "method_changes_count", 0) or 0),
        "method_selected_at": msa,
    }
    if context_obj is None:
        context_obj = {}
    context_obj["psychologist_state"] = state
    try:
        await context_repo.save(user_id, context_obj)
    except Exception as e:
        logger.warning(f"Failed to persist psychologist_state for user {user_id}: {e}")

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
    get_weekend_planner as get_utils_weekend_planner
)
# AI-powered morning messages (а не пустышка из utils)
from morning_messages import MorningMessageManager
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
email_service = None

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

        # Idempotent migration: persist psychologist multi-author state
        try:
            async with db.get_connection() as _conn:
                await _conn.execute(
                    "ALTER TABLE fredi_user_contexts "
                    "ADD COLUMN IF NOT EXISTS psychologist_state JSONB"
                )
            logger.info("✅ fredi_user_contexts.psychologist_state column ensured")
        except Exception as _e:
            logger.warning(f"⚠️ Could not ensure psychologist_state column: {_e}")

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
        morning_manager = MorningMessageManager(ai_service)
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
        _pay_init, _pay_scheduler = register_payment_routes(app, db, limiter)
        await _pay_init()
        _setup_bots = register_bot_routes(app, db)
        await _setup_bots()
        global email_service
        email_service = EmailService()
        app.include_router(create_auth_router(db, limiter, email_service))
        _init_analytics = register_analytics_routes(app, db)
        await _init_analytics()
        logger.info("✅ Таблицы готовы (включая платежи, auth и analytics)")

        logger.info("📦 Запуск фоновых задач...")
        background_tasks = [
            asyncio.create_task(cleanup_old_data()),
            asyncio.create_task(send_reminders()),
            asyncio.create_task(update_metrics()),
            asyncio.create_task(morning_messages_scheduler()),
            asyncio.create_task(_pay_scheduler()),
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

# ============================================
# СОЗДАНИЕ ПРИЛОЖЕНИЯ
# ============================================
app = FastAPI(
    title="Фреди API",
    description="Виртуальный психолог",
    version="3.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    websocket_ping_interval=15,
    websocket_ping_timeout=30,
    websocket_max_size=50 * 1024 * 1024,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://meysternlp.ru",
        "http://meysternlp.ru",
        "https://www.meysternlp.ru",
        "https://fredium.ru",
        "http://fredium.ru",
        "https://www.fredium.ru",
        "https://dron939-sketch.github.io",
        "https://fredi-frontend.onrender.com",
        "https://fredi-app.onrender.com",
        "https://fredi-frontend-flz2.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://localhost:10000",
        "https://fredi-backend-flz2.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Accept", "Accept-Language", "Content-Language", "Content-Type",
        "Authorization", "Origin", "X-Requested-With", "X-User-Id",
        "X-Admin-Token",
        "Access-Control-Request-Method", "Access-Control-Request-Headers",
        "Upgrade", "Connection",
    ],
    expose_headers=["Content-Length", "Content-Range", "X-Response-Time", "X-Total-Count"],
    max_age=86400,
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)
    start_time = time.time()
    logger.debug(f"→ {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        logger.info(f"{request.method} {request.url.path} status={response.status_code} duration={duration:.3f}s")
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"{request.method} {request.url.path} error={str(e)} duration={duration:.3f}s")
        raise


# ============================================
# METER GUARD — блокирует AI-вызовы бесплатным юзерам,
# исчерпавшим лимит или находящимся в cooldown.
# ============================================
import re as _re_meter

# Точные пути и префиксы (regex), где генерируется AI-контент и идут расходы по API.
# Добавляй сюда новые AI-эндпоинты при появлении.
_METER_AI_REGEX = _re_meter.compile(
    r"^/api/(?:"
    r"chat"
    r"|voice/process"
    r"|ai/generate"
    r"|deep-analysis"
    r"|hypno/support"
    r"|psychologist-thoughts/generate"
    r"|dreams/(?:interpret|clarify)"
    r"|reality/(?:check|parse/.+)"
    r"|brand/transformation"
    r"|mirrors/(?:complete|[^/]+/complete)"
    r"|morning/send-now"
    r")(?:/.*)?$"
)


def _extract_user_id_from_body(body_bytes: bytes):
    """Парсит user_id из JSON-тела (не поглощая его для downstream handler'а)."""
    if not body_bytes:
        return None
    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    for key in ("user_id", "uid", "userId"):
        val = data.get(key)
        if val is not None:
            try:
                n = int(val)
                if n > 0:
                    return n
            except (TypeError, ValueError):
                pass
    return None


@app.middleware("http")
async def meter_guard_middleware(request: Request, call_next):
    """Не пропускает AI-вызовы, если юзер превысил лимит/на cooldown и не имеет подписки."""
    try:
        # Быстрый выход для не-POST или нецелевых путей.
        if request.method != "POST":
            return await call_next(request)
        path = request.url.path or ""
        if not _METER_AI_REGEX.match(path):
            return await call_next(request)

        # Meter мог быть ещё не готов (ранний запрос при старте).
        try:
            from meter_routes import subscription_meter as _meter  # lazy
        except Exception:
            _meter = None
        if _meter is None:
            return await call_next(request)

        # Определяем user_id: заголовок X-User-Id → тело.
        user_id = None
        uid_hdr = request.headers.get("X-User-Id") or request.headers.get("x-user-id")
        if uid_hdr:
            try:
                n = int(str(uid_hdr).strip())
                if n > 0:
                    user_id = n
            except (TypeError, ValueError):
                pass

        # Если в заголовке нет — парсим тело. Кешируем body, чтобы handler мог перечитать.
        body_bytes = b""
        if user_id is None:
            try:
                body_bytes = await request.body()
                user_id = _extract_user_id_from_body(body_bytes)
            except Exception:
                body_bytes = b""

            async def _replay_receive():
                return {"type": "http.request", "body": body_bytes, "more_body": False}

            request._receive = _replay_receive  # подменяем, чтобы downstream тоже прочитал

        if user_id is None:
            # Анонимный вызов без идентификатора — не блокируем,
            # но и считать расход некому. Пропускаем (legacy).
            return await call_next(request)

        try:
            can_send, status = await _meter.can_send_message(int(user_id))
        except Exception as e:
            logger.warning(f"meter_guard: can_send check failed: {e}")
            return await call_next(request)

        if can_send:
            return await call_next(request)

        logger.info(
            f"🚫 meter_guard: blocked {path} for user_id={user_id} "
            f"cooldown={status.get('is_on_cooldown')} "
            f"remaining={status.get('remaining_cooldown_minutes')}"
        )
        # Аналитика: server-side fire-and-forget
        try:
            await log_server_event(user_id, "meter_blocked_server", {
                "path": path,
                "is_on_cooldown": status.get("is_on_cooldown", False),
                "remaining_cooldown_minutes": status.get("remaining_cooldown_minutes", 0),
            })
        except Exception:
            pass
        return JSONResponse(
            status_code=402,
            content={
                "success": False,
                "error": "METER_BLOCKED",
                "can_send": False,
                "is_on_cooldown": status.get("is_on_cooldown", False),
                "remaining_cooldown_minutes": status.get("remaining_cooldown_minutes", 0),
                "next_session_limit_minutes": status.get("next_session_limit_minutes"),
                "message": "Фреди отдыхает. Оформи подписку или подожди, пока восстановится.",
            },
        )
    except Exception as e:
        logger.error(f"meter_guard_middleware failure: {e}")
        return await call_next(request)

# ============================================
# WEBSOCKET ЭНДПОИНТ
# ============================================

@app.websocket("/ws/voice/{user_id}")
async def websocket_voice_endpoint(websocket: WebSocket, user_id: str):
    # mode можно передать как query parameter: /ws/voice/123?mode=psychologist
    mode_from_query = websocket.query_params.get("mode", "")
    logger.info(f"🔌 WebSocket connection attempt for user {user_id}")

    try:
        await websocket.accept()
        logger.info(f"✅ WebSocket accepted for user {user_id}")
    except Exception as e:
        logger.error(f"❌ Failed to accept WebSocket: {e}")
        return

    if not voice_manager:
        logger.error(f"❌ Voice manager not ready")
        try:
            await websocket.close(code=1011, reason="Voice service not ready")
        except Exception:
            pass
        return

    try:
        user_id_int = int(user_id)
        user_id_for_db = user_id_int
        logger.info(f"✅ Старый формат (число): {user_id_for_db}")
    except ValueError:
        user_id_for_db = user_id
        logger.info(f"✅ Новый формат (строка): {user_id_for_db}")
        async with db.get_connection() as conn:
            exists = await conn.fetchval("SELECT 1 FROM fredi_users WHERE user_id::text = $1", user_id)
            if not exists:
                await conn.execute(
                    "INSERT INTO fredi_users (user_id, username, created_at, last_activity) VALUES ($1, $2, NOW(), NOW())",
                    user_id, f"user_{user_id}"
                )
                logger.info(f"📝 Создан пользователь со строковым ID: {user_id}")

    await voice_manager.connect(user_id_for_db, websocket)

    try:
        context = await context_repo.get(user_id_for_db) or {}
        profile = await user_repo.get_profile(user_id_for_db) or {}
        logger.info(f"📦 Context loaded for user {user_id_for_db}: {context.get('name', 'unknown')}")
    except Exception as e:
        logger.error(f"❌ Failed to load context: {e}")
        await websocket.close(code=1011, reason="Context load failed")
        return

    has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))

    if not has_profile:
        mode_name = "basic"
    else:
        # Приоритет: query param > сохранённый в context > default
        mode_from_query = websocket.query_params.get("mode", "")
        valid_modes = {"psychologist", "coach", "trainer", "basic"}
        if mode_from_query in valid_modes:
            mode_name = mode_from_query
            logger.info(f"🎭 Mode из query param: {mode_name}")
        else:
            mode_name = context.get("communication_mode", "psychologist")
            logger.info(f"🎭 Mode из context: {mode_name}")

    # ФИХ 3: Загружаем историю для WebSocket тоже
    try:
        history_rows = await message_repo.get_history(user_id_for_db, limit=10)
        history = [{'role': m['role'], 'content': m['content']} for m in reversed(history_rows)]
    except Exception:
        history = []

    user_data = {
        "profile_data": profile.get("profile_data", {}),
        "perception_type": profile.get("perception_type", "не определен"),
        "thinking_level": profile.get("thinking_level", 5),
        "deep_patterns": profile.get("deep_patterns", {}),
        "behavioral_levels": profile.get("behavioral_levels", {}),
        "dilts_counts": profile.get("dilts_counts", {}),
        "confinement_model": profile.get("confinement_model"),
        "history": history,  # ФИХ: реальная история
        "message_count": context.get("basic_message_count", 0),  # счётчик для BasicMode
        "test_offered": context.get("basic_test_offered", False),  # флаг предложения теста
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
        _merge_psychologist_state(user_data, context)
        mode_instance = get_mode(mode_name, user_id_for_db, user_data, simple_context)
        logger.info(f"✅ Mode instance created: {mode_instance.__class__.__name__}")
    except Exception as e:
        logger.error(f"❌ Failed to create mode instance: {e}")
        await websocket.close(code=1011, reason="Mode creation failed")
        return

    audio_buffer = bytearray()
    chunk_count = 0

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
            # ФИХ 2: используем speech_to_text_pcm (метод добавлен в voice_service)
            recognized_text = await voice_service.speech_to_text_pcm(
                bytes(audio_buffer), sample_rate=16000
            )

            logger.info(f"📝 STT result: '{recognized_text}'")

            if recognized_text and len(recognized_text.strip()) > 0:
                await websocket.send_json({"type": "text", "data": f"🎤 Вы: {recognized_text}"})

                # --- Freddy SDK для голосового режима (basic) ---
                response_text = ""
                freddy_audio = None
                if mode_name == "basic":
                    try:
                        freddy = get_freddy_service()
                        freddy_result = await freddy.chat(
                            user_id=user_id_for_db,
                            message=recognized_text,
                            history=history,
                        )
                        logger.info(f"FreddyService chat result: reply={bool(freddy_result.get('reply'))}, model={freddy_result.get('model','?')}, error={freddy_result.get('error','none')}")
                        if freddy_result.get("reply"):
                            response_text = freddy_result["reply"]
                            await websocket.send_json({"type": "text", "data": f"🧠 Фреди: {response_text}"})
                            logger.info(f"FreddyService voice reply for user {user_id_for_db}")
                            # Озвучка голосом Джарвиса
                            try:
                                freddy_audio = await freddy.speak(response_text, voice="jarvis", tone="warm")
                                if freddy_audio:
                                    logger.info(f"FreddyService TTS: {len(freddy_audio)} bytes (Jarvis)")
                                else:
                                    logger.warning(f"FreddyService TTS returned None, fallback to Yandex")
                            except Exception as tts_err:
                                logger.warning(f"FreddyService TTS error, fallback to Yandex: {tts_err}")
                        else:
                            logger.info(f"FreddyService returned empty reply, fallback to BasicMode")
                    except Exception as e:
                        logger.warning(f"FreddyService voice error: {e}")

                # Fallback на process_question_streaming (или основной путь для не-basic)
                if not response_text:
                    async for chunk in mode_instance.process_question_streaming(recognized_text):
                        if chunk:
                            response_text += chunk
                            await websocket.send_json({"type": "text", "data": f"🧠 Фреди: {chunk}"})

                if not response_text:
                    response_text = "Вопрос интересный. Расскажите подробнее, пожалуйста."

                response_text = response_text.strip()
                logger.info(f"💬 AI response ({len(response_text)} chars): {repr(response_text[:150])}")

                # Сохраняем счётчик сообщений и test_offered для BasicMode
                if mode_name == "basic":
                    try:
                        cur_count = context.get("basic_message_count", 0)
                        context["basic_message_count"] = cur_count + 1
                        # Persist test_offered so it survives reconnections
                        if hasattr(mode_instance, 'test_offered'):
                            context["basic_test_offered"] = mode_instance.test_offered
                        await context_repo.save(user_id_for_db, context)
                    except Exception as _e:
                        logger.warning(f"Не удалось сохранить basic_message_count: {_e}")
                await _save_psychologist_state(user_id_for_db, context, mode_instance, mode_name)
                await websocket.send_json({"type": "status", "status": "speaking"})

                try:
                    if freddy_audio:
                        # Голос Джарвиса от Freddy SDK
                        audio_base64 = base64.b64encode(freddy_audio).decode()
                        await websocket.send_json({"type": "audio", "data": audio_base64, "is_final": False})
                        await websocket.send_json({"type": "audio", "data": "", "is_final": True})
                        logger.info(f"✅ TTS complete (Freddy Jarvis)")
                    else:
                        # Yandex TTS fallback
                        async for audio_chunk in voice_service.text_to_speech_streaming(
                            response_text, mode_name, chunk_size=4096
                        ):
                            if audio_chunk:
                                audio_base64 = base64.b64encode(audio_chunk).decode()
                                await websocket.send_json({"type": "audio", "data": audio_base64, "is_final": False})
                                await asyncio.sleep(0.05)

                        await websocket.send_json({"type": "audio", "data": "", "is_final": True})
                        logger.info(f"✅ TTS complete (Yandex fallback)")

                    await message_repo.save(user_id_for_db, "user", recognized_text, {"voice": True})
                    await message_repo.save(user_id_for_db, "assistant", response_text, {"voice": True})

                except Exception as e:
                    logger.error(f"TTS error: {e}")
                    await websocket.send_json({"type": "error", "error": f"TTS error: {str(e)}"})
            else:
                await websocket.send_json({"type": "error", "error": "Не удалось распознать речь"})

        except Exception as e:
            logger.error(f"Processing error: {e}", exc_info=True)
            await websocket.send_json({"type": "error", "error": f"Ошибка: {str(e)}"})

        audio_buffer = bytearray()
        chunk_count = 0
        await websocket.send_json({"type": "status", "status": "idle"})

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                    continue
                except Exception:
                    break

            if message.get("type") == "websocket.receive":
                if "bytes" in message:
                    audio_chunk = message["bytes"]
                    audio_buffer.extend(audio_chunk)
                    chunk_count += 1
                    await websocket.send_json({"type": "chunk_ack", "chunk_index": chunk_count, "timestamp": time.time()})
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
                            await websocket.send_json({"type": "pong", "timestamp": data.get("timestamp", time.time())})

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


# ============================================
# ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
# ============================================
async def init_database_tables():
    async with db.get_connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                language_code TEXT,
                platform TEXT DEFAULT 'web',
                profile JSONB DEFAULT '{}',
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_user_contexts (
                user_id BIGINT PRIMARY KEY REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                name TEXT,
                age INTEGER,
                gender TEXT,
                city TEXT,
                birth_date DATE,
                timezone TEXT DEFAULT 'Europe/Moscow',
                timezone_offset INTEGER DEFAULT 3,
                communication_mode TEXT DEFAULT 'coach',
                last_context_update TIMESTAMP WITH TIME ZONE,
                weather_cache JSONB,
                weather_cache_time TIMESTAMP WITH TIME ZONE,
                family_status TEXT,
                has_children BOOLEAN DEFAULT FALSE,
                children_ages TEXT,
                work_schedule TEXT,
                job_title TEXT,
                commute_time INTEGER,
                housing_type TEXT,
                has_private_space BOOLEAN DEFAULT FALSE,
                has_car BOOLEAN DEFAULT FALSE,
                support_people TEXT,
                resistance_people TEXT,
                energy_level INTEGER,
                life_context_complete BOOLEAN DEFAULT FALSE,
                awaiting_context TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_messages (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_test_results (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
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
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_psychologist_thoughts (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                test_result_id BIGINT REFERENCES fredi_test_results(id) ON DELETE SET NULL,
                thought_type TEXT NOT NULL DEFAULT 'psychologist_thought',
                thought_text TEXT NOT NULL,
                thought_summary TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_events (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_reminders (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                reminder_type TEXT NOT NULL,
                remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
                data JSONB,
                is_sent BOOLEAN DEFAULT FALSE,
                sent_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_weekend_ideas_cache (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                ideas_text TEXT NOT NULL,
                main_vector TEXT,
                main_level INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_morning_messages (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                message_text TEXT NOT NULL,
                message_type TEXT NOT NULL,
                day_number INTEGER DEFAULT 1,
                sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_deep_analyses (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                analysis_text TEXT NOT NULL,
                analysis_type TEXT DEFAULT 'deep_analysis',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web'")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_deep_analyses_user_id ON fredi_deep_analyses(user_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_messages_user_id_created ON fredi_messages(user_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_events_user_id ON fredi_events(user_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_events_type ON fredi_events(event_type, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_test_results_user_id ON fredi_test_results(user_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_test_results_profile ON fredi_test_results(profile_code) WHERE profile_code IS NOT NULL")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_reminders_pending ON fredi_reminders(remind_at) WHERE is_sent = FALSE")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_weekend_cache_expires ON fredi_weekend_ideas_cache(expires_at)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_morning_messages_user ON fredi_morning_messages(user_id, sent_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_users_last_activity ON fredi_users(last_activity DESC) WHERE is_active = TRUE")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_push_subscriptions (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                subscription JSONB NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_push_user ON fredi_push_subscriptions(user_id) WHERE is_active = TRUE")

        # Колонка для отслеживания когда последний раз отправляли утреннее сообщение
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS last_morning_sent_at TIMESTAMP WITH TIME ZONE")

        # Канал доставки уведомлений: 'push' (default) | 'telegram' | 'max' | 'none'
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'push'")

        # === Email/password auth (email = логин) ===
        # CITEXT для case-insensitive unique; если расширение недоступно — fallback на TEXT.
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS citext")
            await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS email CITEXT")
        except Exception:
            await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS email TEXT")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS password_hash TEXT")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE")
        await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP WITH TIME ZONE")

        # Нормализация и дедупликация ДО создания уникального индекса —
        # иначе миграция падает, если кто-то успел завести дубли через раннюю версию auth.
        await conn.execute(
            "UPDATE fredi_users SET email = LOWER(TRIM(email)) "
            "WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))"
        )
        # Для каждого лишнего дубля оставляем самого активного (по last_activity),
        # у остальных обнуляем email. Данные не теряются — только утрачивается логин.
        dup_rows = await conn.fetch("""
            WITH ranked AS (
                SELECT user_id, email,
                       ROW_NUMBER() OVER (
                           PARTITION BY email
                           ORDER BY last_activity DESC NULLS LAST, user_id ASC
                       ) AS rn
                FROM fredi_users
                WHERE email IS NOT NULL
            )
            SELECT user_id, email FROM ranked WHERE rn > 1
        """)
        if dup_rows:
            dup_ids = [int(r["user_id"]) for r in dup_rows]
            logger.warning(
                f"⚠️ auth migration: обнаружено {len(dup_ids)} дублей email "
                f"(user_ids={dup_ids}). Обнуляю email у менее активных записей."
            )
            await conn.execute(
                "UPDATE fredi_users SET email = NULL, password_hash = NULL "
                "WHERE user_id = ANY($1::bigint[])",
                dup_ids,
            )

        await conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_fredi_users_email_unique "
            "ON fredi_users(email) WHERE email IS NOT NULL"
        )

        # Серверные сессии авторизации. Храним sha256(token), сам токен — только в HttpOnly cookie.
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                remember BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                user_agent TEXT,
                ip_address TEXT
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON fredi_auth_sessions(user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON fredi_auth_sessions(expires_at)")

        # Лог попыток входа — для audit и защиты от brute-force.
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_auth_attempts (
                id BIGSERIAL PRIMARY KEY,
                email TEXT,
                ip_address TEXT,
                user_agent TEXT,
                success BOOLEAN DEFAULT FALSE,
                reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_attempts_email_ts ON fredi_auth_attempts(email, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_ts ON fredi_auth_attempts(ip_address, created_at DESC)")

        # Токены сброса пин-кода. Храним sha256, ссылка одноразовая, TTL 1 час.
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_password_resets (
                token_hash TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                used_at TIMESTAMP WITH TIME ZONE,
                ip_address TEXT,
                user_agent TEXT
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_password_resets_user ON fredi_password_resets(user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON fredi_password_resets(expires_at)")

        # Таблица связок web_user_id ↔ messenger chat_id (для деплинков из бота)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_messenger_links (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                platform TEXT NOT NULL,
                chat_id TEXT NOT NULL,
                username TEXT,
                linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE,
                UNIQUE (user_id, platform)
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_messenger_links_user ON fredi_messenger_links(user_id) WHERE is_active = TRUE")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_mirrors (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                mirror_code TEXT UNIQUE NOT NULL,
                mirror_type TEXT NOT NULL DEFAULT 'web',
                status TEXT NOT NULL DEFAULT 'active',
                friend_user_id BIGINT,
                friend_name TEXT,
                friend_profile_code TEXT,
                friend_vectors JSONB,
                friend_deep_patterns JSONB,
                friend_ai_profile TEXT,
                friend_perception_type TEXT,
                friend_thinking_level INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_mirrors_user_id ON fredi_mirrors(user_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_mirrors_code ON fredi_mirrors(mirror_code)")
        for col, coltype in [
            ("intimate_profile_cache","JSONB"),
            ("intimate_generated_at","TIMESTAMP WITH TIME ZONE"),
            ("four_f_cache","JSONB"),
            ("four_f_generated_at","TIMESTAMP WITH TIME ZONE"),
            ("brief_profile_cache","TEXT"),
        ]:
            try:
                await conn.execute(f"ALTER TABLE fredi_mirrors ADD COLUMN IF NOT EXISTS {col} {coltype}")
            except Exception:
                pass
        # Anchors table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_anchors (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'calm',
                source TEXT DEFAULT 'own',
                source_detail TEXT,
                modality TEXT DEFAULT 'auditory',
                trigger_text TEXT,
                phrase TEXT,
                icon TEXT DEFAULT '⚓',
                state_icon TEXT,
                state_name TEXT,
                uses INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_anchors_user_id ON fredi_anchors(user_id, created_at DESC)")
        for col, coltype in [("type", "TEXT DEFAULT 'anchor'"), ("instruction_steps", "JSONB"), ("program_json", "JSONB"), ("recommended_stimuli", "JSONB")]:
            try:
                await conn.execute(f"ALTER TABLE fredi_anchors ADD COLUMN IF NOT EXISTS {col} {coltype}")
            except Exception:
                pass
        # Dreams table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_dreams (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                dream_text TEXT NOT NULL,
                interpretation TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_dreams_user_id ON fredi_dreams(user_id, created_at DESC)")
        # Chats table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_chats (
                id BIGSERIAL PRIMARY KEY,
                user_id_1 BIGINT NOT NULL,
                user_id_2 BIGINT NOT NULL,
                last_message_text TEXT,
                last_message_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id_1, user_id_2)
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_chats_user1 ON fredi_chats(user_id_1, last_message_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_chats_user2 ON fredi_chats(user_id_2, last_message_at DESC)")
        # Chat messages table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_chat_messages (
                id BIGSERIAL PRIMARY KEY,
                chat_id BIGINT REFERENCES fredi_chats(id) ON DELETE CASCADE,
                sender_id BIGINT NOT NULL,
                text TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_chat_messages_chat ON fredi_chat_messages(chat_id, created_at)")
        # New table: fredi_user_data (shared with bots)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_user_data (
                user_id BIGINT PRIMARY KEY REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_user_devices (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                device_id TEXT NOT NULL UNIQUE,
                fingerprint_hash TEXT NOT NULL,
                fingerprint JSONB NOT NULL,
                user_agent TEXT,
                ip_address TEXT,
                first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_user_devices_user_id ON fredi_user_devices(user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_user_devices_fp_hash ON fredi_user_devices(fingerprint_hash)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_user_devices_last_seen ON fredi_user_devices(last_seen DESC)")
        # Add columns to fredi_test_results that exist in bots
        for col, coltype in [
            ("deep_patterns", "JSONB"),
            ("current_destination", "JSONB"),
            ("current_route", "JSONB"),
        ]:
            try:
                await conn.execute(f"ALTER TABLE fredi_test_results ADD COLUMN IF NOT EXISTS {col} {coltype}")
            except Exception:
                pass

        # ==== PROFILE / PRIVACY (idempotent) ====
        try:
            await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS profile_photo TEXT")
            for col in ("bio", "occupation", "telegram", "instagram", "phone", "email"):
                await conn.execute(f"ALTER TABLE fredi_user_contexts ADD COLUMN IF NOT EXISTS {col} TEXT")
            await conn.execute("ALTER TABLE fredi_user_contexts ADD COLUMN IF NOT EXISTS privacy JSONB DEFAULT '{}'::jsonb")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_profile_access (
                    id SERIAL PRIMARY KEY,
                    owner_id BIGINT NOT NULL,
                    requester_id BIGINT NOT NULL,
                    field_name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    resolved_at TIMESTAMPTZ,
                    UNIQUE (owner_id, requester_id, field_name)
                )
            """)
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_profile_access_owner_status ON fredi_profile_access(owner_id, status)")

            # Уведомления пользователя (для вкладки «Уведомления» в Сообщениях).
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_notifications (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    body TEXT,
                    data JSONB DEFAULT '{}',
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_notifications_user_unread "
                "ON fredi_notifications(user_id, is_read, created_at DESC)"
            )
        except Exception as e:
            logger.warning(f"profile/privacy migration warning: {e}")

        logger.info("✅ Все таблицы и индексы созданы")


# ============================================
# ФОНОВЫЕ ЗАДАЧИ
# ============================================
async def cleanup_old_data():
    while True:
        try:
            await asyncio.sleep(3600)
            async with db.get_connection() as conn:
                await conn.execute("DELETE FROM fredi_messages WHERE created_at < NOW() - INTERVAL '30 days'")
                await conn.execute("DELETE FROM fredi_events WHERE created_at < NOW() - INTERVAL '30 days'")
                await conn.execute("DELETE FROM fredi_weekend_ideas_cache WHERE expires_at < NOW()")
                await conn.execute("UPDATE fredi_users SET is_active = FALSE WHERE last_activity < NOW() - INTERVAL '90 days' AND is_active = TRUE")
                logger.info("🧹 Cleanup completed")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


async def send_reminders():
    while True:
        try:
            await asyncio.sleep(60)
            async with db.get_connection() as conn:
                reminders = await conn.fetch("SELECT * FROM fredi_reminders WHERE is_sent = FALSE AND remind_at <= NOW() LIMIT 100")
                for reminder in reminders:
                    try:
                        logger.info(f"📬 Sending reminder {reminder['id']} to user {reminder['user_id']}")
                        await conn.execute("UPDATE fredi_reminders SET is_sent = TRUE, sent_at = NOW() WHERE id = $1", reminder['id'])
                    except Exception as e:
                        logger.error(f"Failed to send reminder {reminder['id']}: {e}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Reminders error: {e}")


async def update_metrics():
    while True:
        try:
            await asyncio.sleep(300)
            async with db.get_connection() as conn:
                active_24h = await conn.fetchval("SELECT COUNT(DISTINCT user_id) FROM fredi_events WHERE created_at > NOW() - INTERVAL '24 hours'")
                messages_1h = await conn.fetchval("SELECT COUNT(*) FROM fredi_messages WHERE created_at > NOW() - INTERVAL '1 hour'")
                new_tests = await conn.fetchval("SELECT COUNT(*) FROM fredi_test_results WHERE created_at > NOW() - INTERVAL '24 hours'")
                logger.info(f"📊 Metrics: active_24h={active_24h}, messages_1h={messages_1h}, new_tests={new_tests}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Metrics error: {e}")


async def _send_via_telegram(chat_id: str, text: str) -> bool:
    """Шлёт сообщение через Telegram Bot API напрямую."""
    token = os.environ.get("TELEGRAM_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_TOKEN не задан — не могу отправить через Telegram")
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown", "disable_web_page_preview": True}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            if r.status_code == 200:
                return True
            logger.error(f"Telegram sendMessage failed: {r.status_code} {r.text[:200]}")
            return False
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False


async def _send_via_max(chat_id: str, text: str) -> bool:
    """Шлёт сообщение через Max Platform API напрямую."""
    token = os.environ.get("MAX_TOKEN")
    if not token:
        logger.warning("MAX_TOKEN не задан — не могу отправить через Max")
        return False
    try:
        import httpx
        url = "https://platform-api.max.ru/messages"
        params = {"chat_id": chat_id}
        body = {"text": text, "attachments": [], "format": "markdown", "notify": True}
        headers = {"Authorization": token, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            r = await client.post(url, params=params, json=body, headers=headers)
            if r.status_code in (200, 201):
                return True
            logger.error(f"Max sendMessage failed: {r.status_code} {r.text[:200]}")
            return False
    except Exception as e:
        logger.error(f"Max send error: {e}")
        return False


async def _deliver_morning_message(user_id: int, channel: str, title: str, body_short: str, full_text: str) -> bool:
    """
    Маршрутизирует доставку утреннего сообщения по выбранному каналу.
    push: только короткий body (полный текст читается в приложении).
    telegram/max: полный текст (мессенджеры не имеют ограничения).
    none: ничего не отправляем.
    """
    if channel == "none":
        return False

    if channel == "push":
        if push_service:
            return await push_service.send_to_user(user_id, title, body_short, "/")
        return False

    if channel in ("telegram", "max"):
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT chat_id FROM fredi_messenger_links "
                "WHERE user_id = $1 AND platform = $2 AND is_active = TRUE",
                user_id, channel
            )
        if not row:
            logger.info(f"User {user_id}: канал {channel} выбран, но мессенджер не привязан — fallback на push")
            if push_service:
                return await push_service.send_to_user(user_id, title, body_short, "/")
            return False

        chat_id = row["chat_id"]
        if channel == "telegram":
            return await _send_via_telegram(chat_id, full_text)
        return await _send_via_max(chat_id, full_text)

    return False


async def morning_messages_scheduler():
    """
    Каждую минуту проверяет всех пользователей с пройденным тестом
    и активной push-подпиской. Если у пользователя сейчас 9:00-9:05
    по местному времени и день недели пн-пт, и сегодня ещё не отправляли —
    генерирует короткое утреннее сообщение (или пятничное с идеями на выходные)
    и шлёт через Web Push.
    """
    from datetime import timezone as _tz
    logger.info("🌅 Morning messages scheduler запущен")

    while True:
        try:
            await asyncio.sleep(60)

            if morning_manager is None or push_service is None:
                continue

            now_utc = datetime.now(_tz.utc)

            async with db.get_connection() as conn:
                # Все юзеры с пройденным тестом и каналом доставки ≠ 'none',
                # у которых либо есть push-подписка, либо привязан мессенджер.
                # Окончательный фильтр по локальному времени — ниже.
                rows = await conn.fetch("""
                    SELECT u.user_id,
                           u.profile,
                           u.last_morning_sent_at,
                           COALESCE(u.notification_channel, 'push') AS notification_channel,
                           c.name, c.gender, c.timezone_offset,
                           c.city,
                           c.weather_cache,
                           c.weather_cache_time
                    FROM fredi_users u
                    LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
                    WHERE u.is_active = TRUE
                      AND COALESCE(u.notification_channel, 'push') <> 'none'
                      AND (
                          EXISTS (
                              SELECT 1 FROM fredi_push_subscriptions ps
                              WHERE ps.user_id = u.user_id AND ps.is_active = TRUE
                          )
                          OR EXISTS (
                              SELECT 1 FROM fredi_messenger_links ml
                              WHERE ml.user_id = u.user_id AND ml.is_active = TRUE
                          )
                      )
                """)

            sent_count = 0
            for row in rows:
                try:
                    user_id = row["user_id"]
                    profile = row["profile"] or {}
                    if isinstance(profile, str):
                        try:
                            profile = json.loads(profile)
                        except Exception:
                            profile = {}
                    if not (profile.get("profile_data") or profile.get("ai_generated_profile")):
                        continue

                    tz_offset = row["timezone_offset"] if row["timezone_offset"] is not None else 3
                    local_now = now_utc + timedelta(hours=int(tz_offset))
                    local_hour = local_now.hour
                    local_weekday = local_now.weekday()  # 0=пн, 4=пт, 5=сб

                    # Только пн-пт и только в окне 9:00-9:05 местного времени
                    if local_weekday > 4 or local_hour != 9 or local_now.minute > 5:
                        continue

                    # Защита от дублей: если last_morning_sent_at уже был сегодня (по UTC) — скип
                    last_sent = row["last_morning_sent_at"]
                    if last_sent:
                        last_sent_local = last_sent + timedelta(hours=int(tz_offset)) if last_sent.tzinfo is None else last_sent.astimezone(_tz.utc) + timedelta(hours=int(tz_offset))
                        if last_sent_local.date() == local_now.date():
                            continue

                    # Готовим контекст
                    weather_cache = row["weather_cache"]
                    if isinstance(weather_cache, str):
                        try:
                            weather_cache = json.loads(weather_cache)
                        except Exception:
                            weather_cache = None

                    # Если город известен, а кэш пустой или старше 2 часов — тянем свежую погоду.
                    city = (row["city"] or "").strip() if row["city"] else ""
                    if city and weather_service is not None:
                        cache_age_ok = False
                        if weather_cache:
                            wct = row["weather_cache_time"]
                            if wct:
                                try:
                                    wct_utc = wct.astimezone(_tz.utc) if wct.tzinfo else wct.replace(tzinfo=_tz.utc)
                                    cache_age_ok = (now_utc - wct_utc) < timedelta(hours=2)
                                except Exception:
                                    cache_age_ok = False
                        if not cache_age_ok:
                            try:
                                fresh = await weather_service.get_weather(city)
                                if fresh:
                                    # Сохраняем новый кэш обратно в контекст пользователя.
                                    async with db.get_connection() as wconn:
                                        await wconn.execute(
                                            """
                                            UPDATE fredi_user_contexts
                                            SET weather_cache = $1::jsonb,
                                                weather_cache_time = NOW()
                                            WHERE user_id = $2
                                            """,
                                            json.dumps(fresh), user_id,
                                        )
                                    weather_cache = fresh
                            except Exception as _we:
                                logger.warning(f"morning weather refresh failed for {user_id}: {_we}")

                    context = {
                        "name": row["name"] or "друг",
                        "gender": row["gender"] or "other",
                        "city": city,
                        "weather_cache": weather_cache,
                        "timezone_offset": tz_offset,
                    }

                    # Считаем баллы по векторам
                    scores = {}
                    for k in ["СБ", "ТФ", "УБ", "ЧВ"]:
                        levels = profile.get("behavioral_levels", {}).get(k, [])
                        scores[k] = sum(levels) / len(levels) if levels else 3

                    # day = 1..5 = пн..пт
                    day = local_weekday + 1

                    message = await morning_manager.generate_morning_message(
                        user_id=user_id,
                        user_name=context["name"],
                        scores=scores,
                        profile_data=profile,
                        context=context,
                        day=day
                    )

                    # Сохраняем полный текст
                    async with db.get_connection() as conn2:
                        await conn2.execute(
                            "INSERT INTO fredi_morning_messages (user_id, message_text, message_type, day_number) VALUES ($1, $2, $3, $4)",
                            user_id, message, "weekend" if day == 5 else "morning", day
                        )
                        await conn2.execute(
                            "UPDATE fredi_users SET last_morning_sent_at = NOW() WHERE user_id = $1",
                            user_id
                        )

                    # Маршрутизация по выбранному каналу
                    title = "🎉 Идеи на выходные" if day == 5 else "🌅 Доброе утро от Фреди"
                    body_short = re.sub(r'\*\*(.*?)\*\*', r'\1', message)
                    body_short = body_short.replace('\n', ' ').strip()
                    if len(body_short) > 120:
                        body_short = body_short[:117] + "..."

                    channel = row["notification_channel"] or "push"
                    delivered = await _deliver_morning_message(
                        user_id=user_id,
                        channel=channel,
                        title=title,
                        body_short=body_short,
                        full_text=message,
                    )
                    if delivered:
                        sent_count += 1
                        logger.info(f"🌅 Morning sent to user {user_id} via {channel} (day={day})")
                    else:
                        logger.warning(f"🌅 Morning NOT delivered to user {user_id} via {channel}")

                except Exception as e:
                    logger.error(f"Morning scheduler error for user {row.get('user_id')}: {e}")

            if sent_count:
                logger.info(f"🌅 Morning scheduler: sent {sent_count} messages this minute")

        except asyncio.CancelledError:
            logger.info("🛑 Morning scheduler остановлен")
            break
        except Exception as e:
            logger.error(f"Morning scheduler loop error: {e}")


# ============================================
# HEALTH CHECK
# ============================================
@app.get("/health", response_model=HealthResponse)
async def health_check():
    logger.info("=" * 50)
    logger.info("🏥 HEALTH CHECK CALLED")

    status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": False, "redis": False, "ai_service": False,
            "voice_service": False, "websocket": voice_manager is not None
        }
    }

    if db:
        try:
            async with db.get_connection() as conn:
                await conn.execute("SELECT 1")
            status["services"]["database"] = True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            status["status"] = "degraded"
    else:
        status["status"] = "degraded"

    if cache and cache.is_connected:
        try:
            await cache.redis.ping()
            status["services"]["redis"] = True
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")

    if ai_service and ai_service.api_key:
        status["services"]["ai_service"] = True

    if voice_service:
        status["services"]["voice_service"] = True

    if not status["services"]["database"]:
        status["status"] = "unhealthy"
        return JSONResponse(status_code=503, content=status)

    return status


@app.get("/api/ping")
async def ping():
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

# ---------- ИДЕНТИФИКАЦИЯ УСТРОЙСТВА (fingerprint) ----------

def _fp_hash(fingerprint: dict) -> str:
    """Стабильный SHA-256 от отсортированного JSON fingerprint."""
    import hashlib
    try:
        payload = json.dumps(fingerprint or {}, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        payload = str(fingerprint)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def _user_exists(conn, user_id: int) -> bool:
    try:
        row = await conn.fetchrow("SELECT 1 FROM fredi_users WHERE user_id = $1", int(user_id))
        return row is not None
    except Exception:
        return False


@app.post("/api/user/by-device")
@limiter.limit("20/minute")
async def user_by_device(request: Request):
    """
    Идентификация пользователя по устройству.
    Возвращает BIGINT user_id — совместимо со всеми существующими FK.
    Порядок поиска:
      1) existing_user_id (хинт из localStorage) — если юзер существует, привязываем device к нему.
      2) device_id → возвращаем связанного user_id.
      3) fingerprint_hash → возвращаем (кросс-браузерный матч на том же устройстве).
      4) иначе — создаём нового пользователя с user_id = Date.now()-ish (BIGINT).
    """
    try:
        data = await request.json()
        device_id = (data.get("device_id") or "").strip()
        fingerprint = data.get("fingerprint") or {}
        existing_user_id = data.get("existing_user_id")
        user_agent = (fingerprint.get("userAgent") or request.headers.get("user-agent") or "")[:512]
        client_ip = (request.client.host if request.client else None) or ""

        if not device_id:
            return {"success": False, "error": "device_id required"}

        fp_hash = _fp_hash(fingerprint)
        fp_json = json.dumps(fingerprint, default=str, ensure_ascii=False)

        async with db.get_connection() as conn:
            # (1) Хинт existing_user_id — миграция старых юзеров без потери данных.
            if existing_user_id is not None:
                try:
                    hint_uid = int(existing_user_id)
                    if hint_uid > 0 and await _user_exists(conn, hint_uid):
                        # Привязываем (или обновляем) device_id к этому пользователю.
                        await conn.execute("""
                            INSERT INTO fredi_user_devices
                                (user_id, device_id, fingerprint_hash, fingerprint, user_agent, ip_address, first_seen, last_seen)
                            VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW(), NOW())
                            ON CONFLICT (device_id) DO UPDATE SET
                                user_id = EXCLUDED.user_id,
                                fingerprint_hash = EXCLUDED.fingerprint_hash,
                                fingerprint = EXCLUDED.fingerprint,
                                user_agent = EXCLUDED.user_agent,
                                ip_address = EXCLUDED.ip_address,
                                last_seen = NOW()
                        """, hint_uid, device_id, fp_hash, fp_json, user_agent, client_ip)
                        await conn.execute(
                            "UPDATE fredi_users SET last_activity = NOW() WHERE user_id = $1",
                            hint_uid
                        )
                        logger.info(f"🔗 by-device: linked existing user {hint_uid} via hint → device {device_id}")
                        return {
                            "success": True,
                            "user_id": hint_uid,
                            "is_new": False,
                            "device_id": device_id,
                            "matched_by": "existing_hint"
                        }
                except (ValueError, TypeError):
                    pass  # хинт не число — игнорируем, идём дальше

            # (2) Поиск по device_id.
            row = await conn.fetchrow(
                "SELECT user_id FROM fredi_user_devices WHERE device_id = $1",
                device_id
            )
            if row:
                uid = int(row["user_id"])
                # Обновляем last_seen и fingerprint (он мог слегка обновиться).
                await conn.execute("""
                    UPDATE fredi_user_devices
                    SET fingerprint_hash = $2, fingerprint = $3::jsonb,
                        user_agent = $4, ip_address = $5, last_seen = NOW()
                    WHERE device_id = $1
                """, device_id, fp_hash, fp_json, user_agent, client_ip)
                await conn.execute(
                    "UPDATE fredi_users SET last_activity = NOW() WHERE user_id = $1",
                    uid
                )
                return {
                    "success": True,
                    "user_id": uid,
                    "is_new": False,
                    "device_id": device_id,
                    "matched_by": "device_id"
                }

            # (3) Поиск по fingerprint_hash (кросс-браузерность на одном устройстве).
            # Берём самую свежую запись; если давнее 30 дней — игнорируем (защита от коллизий).
            row = await conn.fetchrow("""
                SELECT user_id FROM fredi_user_devices
                WHERE fingerprint_hash = $1 AND last_seen > NOW() - INTERVAL '30 days'
                ORDER BY last_seen DESC LIMIT 1
            """, fp_hash)
            if row:
                uid = int(row["user_id"])
                await conn.execute("""
                    INSERT INTO fredi_user_devices
                        (user_id, device_id, fingerprint_hash, fingerprint, user_agent, ip_address, first_seen, last_seen)
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW(), NOW())
                    ON CONFLICT (device_id) DO UPDATE SET last_seen = NOW()
                """, uid, device_id, fp_hash, fp_json, user_agent, client_ip)
                await conn.execute(
                    "UPDATE fredi_users SET last_activity = NOW() WHERE user_id = $1",
                    uid
                )
                logger.info(f"🔗 by-device: matched user {uid} by fingerprint → new device {device_id}")
                return {
                    "success": True,
                    "user_id": uid,
                    "is_new": False,
                    "device_id": device_id,
                    "matched_by": "fingerprint"
                }

            # (4) Ничего не найдено — создаём нового пользователя.
            import time as _t
            new_uid = int(_t.time() * 1000)  # как Date.now() на фронте
            # Страховка от коллизии (маловероятно, но идемпотентно):
            while await _user_exists(conn, new_uid):
                new_uid += 1
            await conn.execute("""
                INSERT INTO fredi_users (user_id, created_at, last_activity)
                VALUES ($1, NOW(), NOW())
            """, new_uid)
            await conn.execute("""
                INSERT INTO fredi_user_devices
                    (user_id, device_id, fingerprint_hash, fingerprint, user_agent, ip_address, first_seen, last_seen)
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW(), NOW())
                ON CONFLICT (device_id) DO NOTHING
            """, new_uid, device_id, fp_hash, fp_json, user_agent, client_ip)
            logger.info(f"🆕 by-device: created new user {new_uid} for device {device_id}")
            return {
                "success": True,
                "user_id": new_uid,
                "is_new": True,
                "device_id": device_id,
                "matched_by": "new"
            }
    except Exception as e:
        logger.error(f"Error in /api/user/by-device: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/user/verify/{user_id}")
@limiter.limit("60/minute")
async def verify_user(request: Request, user_id: int):
    """Проверяет существование пользователя (для хинта existing_user_id на фронте)."""
    try:
        async with db.get_connection() as conn:
            exists = await _user_exists(conn, int(user_id))
        return {"success": True, "exists": exists, "user_id": int(user_id)}
    except Exception as e:
        logger.error(f"verify_user error: {e}")
        return {"success": False, "exists": False, "error": str(e)}


# ---------- КОНТЕКСТ ----------
@app.post("/api/save-context")
@limiter.limit("30/minute")
async def save_context(request: Request, data: SaveContextRequest):
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


# ---------- ЧАТ ----------
@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, data: ChatRequest):
    try:
        context_obj = await context_repo.get(data.user_id) or {}
        profile = await user_repo.get_profile(data.user_id) or {}

        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))

        if not has_profile:
            mode_name = "basic"
            logger.info(f"🎭 User {data.user_id} has no profile → BasicMode")
        else:
            mode_name = context_obj.get("communication_mode", data.mode)

        # ФИХ 3: Загружаем историю диалога из БД
        try:
            history_rows = await message_repo.get_history(data.user_id, limit=10)
            history = [{'role': m['role'], 'content': m['content']} for m in reversed(history_rows)]
        except Exception as e:
            logger.warning(f"Failed to load history: {e}")
            history = []

        # ФИХ 4: Счётчик сообщений BasicMode через context
        if not has_profile:
            msg_count = context_obj.get('_basic_msg_count', 0) + 1
            context_obj['_basic_msg_count'] = msg_count
            await context_repo.save(data.user_id, context_obj)
        else:
            msg_count = 0

        user_data = {
            "profile_data": profile.get("profile_data", {}),
            "perception_type": profile.get("perception_type", "не определен"),
            "thinking_level": profile.get("thinking_level", 5),
            "deep_patterns": profile.get("deep_patterns", {}),
            "behavioral_levels": profile.get("behavioral_levels", {}),
            "dilts_counts": profile.get("dilts_counts", {}),
            "confinement_model": profile.get("confinement_model"),
            "history": history,           # ФИХ 3: реальная история
            "message_count": msg_count,   # ФИХ 4: счётчик BasicMode
            "test_offered": context_obj.get("basic_test_offered", False),  # флаг предложения теста
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
        _merge_psychologist_state(user_data, context_obj)
        mode_instance = get_mode(mode_name, data.user_id, user_data, simple_context)

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

        # --- Freddy SDK: для пользователей без теста ---
        if not has_profile:
            # Предложение теста после 4 сообщений (сохраняем логику BasicMode)
            test_offered = context_obj.get("basic_test_offered", False)
            if msg_count >= 4 and not test_offered:
                import random as _rnd
                test_offered = True
                context_obj["basic_test_offered"] = True
                await context_repo.save(data.user_id, context_obj)
                test_response = _rnd.choice([
                    "Знаешь... У меня есть одна идея. Небольшой тест — минут на десять. Он помогает понять себя лучше. Попробуешь, да?",
                    "Слушай, я хочу предложить кое-что. Есть тест... Занимает минут десять. Он как зеркало — показывает, что внутри. Интересно?",
                    "Дай-ка подумаю, как тебе помочь лучше... Есть небольшой тест. Десять минут — и я пойму тебя гораздо глубже. Попробуем?",
                ])
                await message_repo.save(data.user_id, "user", data.message)
                await message_repo.save(data.user_id, "assistant", test_response)
                await log_event(data.user_id, "chat", {
                    "mode": "basic", "message_length": len(data.message),
                    "tools_used": ["test_offer"], "has_profile": False
                })
                return {
                    "success": True, "response": test_response,
                    "mode_used": "basic", "reflection": None
                }

            # Пробуем FreddyService, fallback на BasicMode
            freddy_reply = None
            try:
                freddy = get_freddy_service()
                freddy_result = await freddy.chat(
                    user_id=data.user_id,
                    message=data.message,
                    history=history,
                )
                if freddy_result.get("reply"):
                    freddy_reply = freddy_result["reply"]
                    mode_name = "freddy"
                    logger.info(f"FreddyService replied for user {data.user_id}, model={freddy_result.get('model')}")
            except Exception as e:
                logger.warning(f"FreddyService failed for user {data.user_id}: {e}")

            if freddy_reply:
                result = {"response": freddy_reply, "tools_used": ["freddy_sdk"]}
            else:
                logger.info(f"FreddyService unavailable, falling back to BasicMode for user {data.user_id}")
                result = mode_instance.process_question(data.message)
        else:
            result = mode_instance.process_question(data.message)

        # Persist test_offered for BasicMode after processing
        if mode_name == "basic" and hasattr(mode_instance, 'test_offered'):
            context_obj["basic_test_offered"] = mode_instance.test_offered
            await context_repo.save(data.user_id, context_obj)
        await _save_psychologist_state(data.user_id, context_obj, mode_instance, mode_name)

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
    try:
        messages = await message_repo.get_history(user_id, limit)
        return {"success": True, "messages": messages}
    except Exception as e:
        logger.error(f"Error getting history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ФИХ 1: НОВЫЙ ЭНДПОИНТ /api/ai/generate
@app.post("/api/ai/generate")
@limiter.limit("20/minute")
async def ai_generate(request: Request, data: AIGenerateRequest):
    """
    Универсальная генерация текста через AI.
    Используется модулями: diary, emotions, healing, motivation,
    practices, relationships, skill_choice, strategy, tales.
    """
    try:
        result = await ai_service._simple_call(
            prompt=data.prompt,
            max_tokens=data.max_tokens,
            temperature=data.temperature
        )
        if result:
            return {"success": True, "content": result}
        else:
            return {"success": False, "error": "AI не вернул ответ"}
    except Exception as e:
        logger.error(f"AI generate error for user {data.user_id}: {e}")
        return {"success": False, "error": str(e)}


# ========== ГЛУБОКИЙ АНАЛИЗ ==========
@app.post("/api/deep-analysis")
@limiter.limit("5/minute")
async def deep_analysis(request: Request, data: ChatRequest):
    try:
        context_obj = await context_repo.get(data.user_id) or {}
        profile = await user_repo.get_profile(data.user_id) or {}

        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
        if not has_profile:
            return {"success": False, "error": "Сначала пройдите тест"}

        profile_data = profile.get('profile_data', {})
        behavioral_levels = profile.get('behavioral_levels', {})
        deep_patterns = profile.get('deep_patterns', {})

        system_prompt = """Ты — психолог Фреди. Проведи ГЛУБОКИЙ психологический анализ личности пользователя.

ВЕРНИ ОТВЕТ СТРОГО В ФОРМАТЕ JSON:
{
  "portrait": "Глубинный портрет (5-6 предложений)",
  "loops": "Системные петли (5-6 предложений)",
  "mechanisms": "Скрытые механизмы (5-6 предложений)",
  "growth": "Точки роста (5-6 предложений)",
  "forecast": "Прогноз (4-5 предложений)",
  "keys": "Персональные ключи (4-5 предложений)"
}

ПРАВИЛА: пиши на русском, обращайся на "ты", без эмодзи, без маркдауна."""

        user_prompt = f"""
Данные пользователя:
Профиль: {profile_data.get('display_name', 'не определен')}
Тип восприятия: {profile.get('perception_type', 'не определен')}
Уровень мышления: {profile.get('thinking_level', 5)}/9

Поведенческие уровни:
СБ: {behavioral_levels.get('СБ', [3])[-1] if behavioral_levels.get('СБ') else 3}/6
ТФ: {behavioral_levels.get('ТФ', [3])[-1] if behavioral_levels.get('ТФ') else 3}/6
УБ: {behavioral_levels.get('УБ', [3])[-1] if behavioral_levels.get('УБ') else 3}/6
ЧВ: {behavioral_levels.get('ЧВ', [3])[-1] if behavioral_levels.get('ЧВ') else 3}/6

Глубинные паттерны:
{json.dumps(deep_patterns, ensure_ascii=False, indent=2) if deep_patterns else 'Нет данных'}

AI-профиль:
{profile.get('ai_generated_profile', 'Нет данных')[:1500]}

Верни строго JSON, 5-6 предложений в каждом разделе.
"""

        response = await ai_service._call_deepseek(system_prompt, user_prompt, max_tokens=4000, temperature=0.7)

        if response:
            cleaned = re.sub(r'^```json\s*', '', response)
            cleaned = re.sub(r'\s*```$', '', cleaned)
            analysis_data = json.loads(cleaned)
            await user_repo.save_deep_analysis(data.user_id, analysis_data)
            return {"success": True, "analysis": analysis_data}
        else:
            return {"success": False, "error": "Не удалось сгенерировать анализ"}

    except Exception as e:
        logger.error(f"Deep analysis error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/deep-analysis/{user_id}")
@limiter.limit("30/minute")
async def get_saved_deep_analysis(request: Request, user_id: Union[int, str]):
    try:
        try:
            user_id_for_db = int(user_id)
        except (ValueError, TypeError):
            user_id_for_db = user_id

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
                "message": "Анализ ещё не выполнен."
            }
    except Exception as e:
        logger.error(f"Error getting saved deep analysis for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/deep-analysis/{user_id}/history")
@limiter.limit("20/minute")
async def get_deep_analysis_history(request: Request, user_id: Union[int, str], limit: int = 10):
    try:
        try:
            user_id_for_db = int(user_id)
        except (ValueError, TypeError):
            user_id_for_db = user_id
        history = await user_repo.get_deep_analyses_history(user_id_for_db, limit)
        return {"success": True, "history": history, "total": len(history)}
    except Exception as e:
        logger.error(f"Error getting deep analysis history for user {user_id}: {e}")
        return {"success": False, "error": str(e), "history": []}


# ---------- ГОЛОС ----------
@app.post("/api/voice/process")
@limiter.limit("10/minute")
async def process_voice(
    request: Request,
    user_id: str = Form(...),
    voice: UploadFile = File(...),
    mode: str = Form("psychologist")
):
    try:
        audio_bytes = await voice.read()
        if len(audio_bytes) < 1000:
            return {"success": False, "error": "Аудио файл слишком короткий"}

        # Определяем формат из имени файла (iOS отправляет mp4/aac, не wav)
        audio_format = "wav"
        if voice.filename:
            ext = voice.filename.rsplit('.', 1)[-1].lower() if '.' in voice.filename else ""
            if ext in ("mp4", "aac", "webm", "ogg", "mp3"):
                audio_format = ext

        recognized_text = await voice_service.speech_to_text(audio_bytes, audio_format)
        if not recognized_text or not recognized_text.strip():
            return {"success": False, "error": "Не удалось распознать речь"}

        logger.info(f"🎤 Распознано: «{recognized_text}»")

        try:
            user_id_int = int(user_id)
            user_id_for_db = user_id_int
        except ValueError:
            user_id_for_db = user_id
            async with db.get_connection() as conn:
                exists = await conn.fetchval("SELECT 1 FROM fredi_users WHERE user_id::text = $1", user_id)
                if not exists:
                    await conn.execute(
                        "INSERT INTO fredi_users (user_id, username, created_at) VALUES ($1, $2, NOW())",
                        user_id, f"user_{user_id}"
                    )

        context_obj = await context_repo.get(user_id_for_db) or {}
        profile = await user_repo.get_profile(user_id_for_db) or {}

        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))
        if not has_profile:
            mode_name = "basic"
        else:
            mode_name = context_obj.get("communication_mode", mode)

        # ФИХ 3: загружаем историю
        try:
            history_rows = await message_repo.get_history(user_id_for_db, limit=10)
            history = [{'role': m['role'], 'content': m['content']} for m in reversed(history_rows)]
        except Exception:
            history = []

        # ФИХ 4: счётчик BasicMode
        if not has_profile:
            msg_count = context_obj.get('_basic_msg_count', 0) + 1
            context_obj['_basic_msg_count'] = msg_count
            await context_repo.save(user_id_for_db, context_obj)
        else:
            msg_count = 0

        user_data = {
            "profile_data": profile.get("profile_data", {}),
            "perception_type": profile.get("perception_type", "не определен"),
            "thinking_level": profile.get("thinking_level", 5),
            "deep_patterns": profile.get("deep_patterns", {}),
            "behavioral_levels": profile.get("behavioral_levels", {}),
            "dilts_counts": profile.get("dilts_counts", {}),
            "confinement_model": profile.get("confinement_model"),
            "history": history,
            "message_count": msg_count,
            "test_offered": context_obj.get("basic_test_offered", False),  # флаг предложения теста
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
        _merge_psychologist_state(user_data, context_obj)
        mode_instance = get_mode(mode_name, user_id_for_db, user_data, simple_context)

        response_text = None

        if hasattr(mode_instance, 'process_question_full'):
            try:
                response_text = await mode_instance.process_question_full(recognized_text)
            except Exception as e:
                logger.warning(f"process_question_full failed: {e}")

        if response_text is None and hasattr(mode_instance, 'process_question_streaming'):
            try:
                response_text = ""
                async for chunk in mode_instance.process_question_streaming(recognized_text):
                    response_text += chunk

                # ФИХ: пробелы после склейки чанков
                import re as _re2
                response_text = _re2.sub(r'([.!?,;:])([^\s\d\)\]\}])', r'\1 \2', response_text)
                response_text = _re2.sub(r'([—–])([^\s])', r'\1 \2', response_text)
                response_text = _re2.sub(r'([а-яё])([А-ЯЁ])', r'\1 \2', response_text)
                response_text = _re2.sub(r'\s+', ' ', response_text).strip()
            except Exception as e:
                logger.warning(f"process_question_streaming failed: {e}")

        if response_text is None or not response_text.strip():
            try:
                result = mode_instance.process_question(recognized_text)
                response_text = result.get("response", "")
            except Exception as e:
                logger.error(f"All methods failed: {e}")
                response_text = "Вопрос интересный. Расскажи подробнее, пожалуйста."

        if not response_text or not response_text.strip():
            response_text = "Вопрос интересный. Расскажи подробнее, пожалуйста."

        # Persist test_offered for BasicMode after processing
        if mode_name == "basic" and hasattr(mode_instance, 'test_offered'):
            context_obj["basic_test_offered"] = mode_instance.test_offered
            await context_repo.save(user_id_for_db, context_obj)
        await _save_psychologist_state(user_id_for_db, context_obj, mode_instance, mode_name)

        # normalize_tts_text вызывается внутри voice_service — не дублируем
        logger.info(f"💬 AI response: {len(response_text)} символов")

        audio_base64 = await voice_service.text_to_speech(response_text, mode_name)

        await message_repo.save(user_id_for_db, "user", recognized_text, {"voice": True})
        await message_repo.save(user_id_for_db, "assistant", response_text, {"voice": True})

        await log_event(user_id_for_db, "voice", {
            "text_length": len(recognized_text),
            "mode": mode_name,
            "has_profile": has_profile,
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


@app.post("/api/voice/stt")
@limiter.limit("20/minute")
async def voice_stt_only(request: Request):
    """Speech-to-text only — no AI processing. For dreams, diary, etc."""
    try:
        form = await request.form()
        audio_file = form.get("file")
        if not audio_file:
            return {"success": False, "error": "No audio file"}

        audio_bytes = await audio_file.read()
        filename = audio_file.filename or "voice.wav"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "wav"

        text = await voice_service.speech_to_text(audio_bytes, ext)
        if text:
            logger.info(f"🎤 STT-only: {len(text)} chars")
            return {"success": True, "text": text}
        else:
            return {"success": False, "text": "", "error": "Не удалось распознать речь"}
    except Exception as e:
        logger.error(f"STT-only error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/voice/tts")
@limiter.limit("30/minute")
async def text_to_speech_endpoint(
    request: Request,
    text: str = Form(...),
    mode: str = Form("psychologist")
):
    try:
        audio_base64 = await voice_service.text_to_speech(text, mode)
        if audio_base64:
            audio_bytes = base64.b64decode(audio_base64)
            return Response(content=audio_bytes, media_type="audio/mpeg")
        raise HTTPException(status_code=500, detail="TTS failed")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ДИАГНОСТИКА ГОЛОСА ----------
@app.post("/api/debug/tts")
async def debug_tts(request: Request):
    """
    Диагностика TTS — показывает текст на каждом шаге обработки.
    POST {"text": "...", "mode": "psychologist|coach|trainer|basic"}
    """
    try:
        from services.voice_service import (
            normalize_tts_text, process_remakes_to_text,
            process_vocal_markers, VOICES, VOICE_SETTINGS
        )
        data = await request.json()
        text = data.get("text", "Привет, как у тебя дела сегодня?")
        mode = data.get("mode", "psychologist")

        # Пошаговая обработка
        steps = {"0_original": text}

        # Шаг 1: эмодзи
        import re
        t = re.sub(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FAFF]+", '', text, flags=re.UNICODE
        )
        steps["1_no_emoji"] = t

        # Шаг 2: ремарки
        t = process_remakes_to_text(t)
        steps["2_no_remakes"] = t

        # Шаг 3: вокальные маркеры
        t = process_vocal_markers(t)
        steps["3_no_markers"] = t

        # Шаг 4: спецсимволы
        t = re.sub(r'[#_`~<>|@$%^&+={}\\]', '', t)
        steps["4_no_special"] = t

        # Шаг 5: точка в конце
        if t and t[-1] not in '.!?':
            t += '.'
        steps["5_punctuation"] = t

        # Шаг 6: нормализация пробелов
        t = re.sub(r'\s+', ' ', t).strip()
        steps["6_spaces"] = t

        # Итоговый normalize_tts_text
        final = normalize_tts_text(text)
        steps["FINAL"] = final

        # Анализ проблем
        issues = []
        if '  ' in final:                        issues.append("двойные пробелы")
        if re.search(r'[а-яё][А-ЯЁ]', final):   issues.append("склеенные слова")
        if re.search(r'\w,\w', final):          issues.append("запятая без пробела")
        if re.search(r'(?<![а-яё])-(?![а-яё])', final, re.I):
            issues.append("одиночный дефис")

        # Голосовые параметры
        voice    = VOICES.get(mode, VOICES["default"])
        settings = VOICE_SETTINGS.get(mode, VOICE_SETTINGS["default"])

        # Генерируем аудио
        audio_b64 = await voice_service.text_to_speech(text, mode)

        logger.info(f"🔍 DEBUG TTS | режим={mode} голос={voice} скорость={settings['speed']}")
        logger.info(f"   ВХОД:  {repr(text[:200])}")
        logger.info(f"   ИТОГ:  {repr(final[:200])}")
        if issues: logger.warning(f"   ⚠️ {issues}")

        return {
            "pipeline":     steps,
            "voice_params": {"voice": voice, "speed": settings["speed"], "mode": mode},
            "issues":       issues,
            "stats": {
                "words_in":  len(text.split()),
                "words_out": len(final.split()),
                "chars_in":  len(text),
                "chars_out": len(final),
            },
            "audio_base64": audio_b64,
            "audio_mime":   "audio/mpeg"
        }
    except Exception as e:
        logger.error(f"Debug TTS error: {e}", exc_info=True)
        return {"error": str(e)}


@app.get("/api/debug/voice-config")
async def debug_voice_config(request: Request):
    """Текущая конфигурация голосов"""
    from services.voice_service import VOICES, VOICE_SETTINGS
    return {
        "voices":              VOICES,
        "settings":            VOICE_SETTINGS,
        "deepgram_configured": bool(os.environ.get("DEEPGRAM_API_KEY")),
        "yandex_configured":   bool(os.environ.get("YANDEX_API_KEY")),
    }


# ---------- ПОГОДА ----------
@app.get("/api/weather/{user_id}")
@limiter.limit("30/minute")
async def get_weather(request: Request, user_id: int):
    try:
        context = await context_repo.get(user_id) or {}
        city = context.get("city")
        if not city:
            return {"success": False, "error": "Город не указан в профиле"}
        weather = await weather_service.get_weather(city)
        if weather:
            return {
                "success": True,
                "weather": {
                    "city": weather["city"],
                    "temperature": weather["temperature"],    # ФИХ 5: правильный ключ
                    "feels_like": weather["feels_like"],
                    "description": weather["description"],
                    "icon": weather["icon"],
                    "humidity": weather["humidity"],
                    "wind_speed": weather["wind_speed"],
                    "pressure": weather["pressure"]
                }
            }
        else:
            return {"success": False, "error": f"Не удалось получить погоду для города {city}"}
    except Exception as e:
        logger.error(f"Error getting weather for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/weather/by-city")
@limiter.limit("60/minute")
async def get_weather_by_city(request: Request, city: str):
    try:
        if not city:
            return {"success": False, "error": "Название города не указано"}
        weather = await weather_service.get_weather(city)
        if weather:
            return {
                "success": True,
                "weather": {
                    "city": weather["city"],
                    "temperature": weather["temperature"],    # ФИХ 5
                    "feels_like": weather["feels_like"],
                    "description": weather["description"],
                    "icon": weather["icon"],
                    "humidity": weather["humidity"],
                    "wind_speed": weather["wind_speed"],
                    "pressure": weather["pressure"]
                }
            }
        else:
            return {"success": False, "error": f"Не удалось получить погоду для города {city}"}
    except Exception as e:
        logger.error(f"Error getting weather for city {city}: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/weather/set-city")
@limiter.limit("10/minute")
async def set_user_city(request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        city = data.get("city")
        if not user_id or not city:
            return {"success": False, "error": "user_id и city обязательны"}
        context = await context_repo.get(user_id) or {}
        context["city"] = city
        await context_repo.save(user_id, context)
        await log_event(user_id, "set_city", {"city": city})
        return {"success": True, "message": f"Город {city} сохранён"}
    except Exception as e:
        logger.error(f"Error setting city: {e}")
        return {"success": False, "error": str(e)}


# ---------- ИДЕИ НА ВЫХОДНЫЕ ----------
@app.get("/api/ideas/{user_id}")
@limiter.limit("10/minute")
async def get_weekend_ideas(request: Request, user_id: int):
    try:
        cache_key = f"weekend_ideas:{user_id}"
        cached = await cache.get(cache_key) if cache else None
        if cached:
            return {"success": True, "ideas": cached}

        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}

        scores = {}
        for k in ['СБ', 'ТФ', 'УБ', 'ЧВ']:
            levels = profile.get('behavioral_levels', {}).get(k, [])
            scores[k] = sum(levels) / len(levels) if levels else 3

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

        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_morning_messages (user_id, message_text, message_type, day_number)
                VALUES ($1, $2, $3, $4)
            """, user_id, message, "morning", day)

        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Error generating morning message: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/morning-message/schedule")
@limiter.limit("5/minute")
async def schedule_morning_messages(request: Request):
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

        messages = []
        for day in range(1, 4):
            message = await morning_manager.generate_morning_message(
                user_id=user_id, user_name=context.get('name', 'друг'),
                scores=scores, profile_data=profile, context=context, day=day
            )
            messages.append({"day": day, "message": message})
            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_morning_messages (user_id, message_text, message_type, day_number) VALUES ($1, $2, $3, $4)",
                    user_id, message, "morning", day
                )

        await log_event(user_id, "schedule_morning_messages", {"days": 3})
        return {"success": True, "messages": messages}
    except Exception as e:
        logger.error(f"Error scheduling morning messages: {e}")
        return {"success": False, "error": str(e)}


# ---------- ЦЕЛИ ----------
@app.get("/api/goals/{user_id}")
@limiter.limit("20/minute")
async def get_goals(request: Request, user_id: int, mode: str = "coach"):
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


# ---------- ПСИХОМЕТРИЧЕСКИЕ ДВОЙНИКИ ----------
@app.get("/api/psychometric/find-doubles")
@limiter.limit("10/minute")
async def find_psychometric_doubles(request: Request, user_id: str, limit: int = 10):
    try:
        try:
            user_id_for_db = int(user_id)
        except (ValueError, TypeError):
            user_id_for_db = user_id

        profile = await user_repo.get_profile(user_id_for_db) or {}
        profile_data = profile.get('profile_data', {})
        behavioral_levels = profile.get('behavioral_levels', {})

        vectors = {
            'СБ': behavioral_levels.get('СБ', [4])[-1] if behavioral_levels.get('СБ') else 4,
            'ТФ': behavioral_levels.get('ТФ', [4])[-1] if behavioral_levels.get('ТФ') else 4,
            'УБ': behavioral_levels.get('УБ', [4])[-1] if behavioral_levels.get('УБ') else 4,
            'ЧВ': behavioral_levels.get('ЧВ', [4])[-1] if behavioral_levels.get('ЧВ') else 4
        }

        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT DISTINCT u.user_id, u.profile, u.username
                FROM fredi_users u
                WHERE u.user_id::text != $1
                AND u.profile IS NOT NULL
                AND u.profile != '{}'
                LIMIT $2
            """, str(user_id_for_db), limit * 3)

        doubles = []
        for row in rows:
            other_profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])
            other_behavioral = other_profile.get('behavioral_levels', {})

            other_vectors = {
                'СБ': other_behavioral.get('СБ', [4])[-1] if other_behavioral.get('СБ') else 4,
                'ТФ': other_behavioral.get('ТФ', [4])[-1] if other_behavioral.get('ТФ') else 4,
                'УБ': other_behavioral.get('УБ', [4])[-1] if other_behavioral.get('УБ') else 4,
                'ЧВ': other_behavioral.get('ЧВ', [4])[-1] if other_behavioral.get('ЧВ') else 4
            }

            total_diff = sum(abs(vectors.get(k, 4) - other_vectors.get(k, 4)) for k in ['СБ', 'ТФ', 'УБ', 'ЧВ'])
            similarity = max(0, min(100, int((1 - total_diff / 24) * 100)))

            other_context = await context_repo.get(row['user_id']) or {}

            doubles.append({
                "user_id": row['user_id'],
                "name": other_context.get('name') or f"User_{row['user_id']}",
                "age": other_context.get('age'),
                "city": other_context.get('city'),
                "profile_code": other_profile.get('display_name', ''),
                "profile_type": other_profile.get('perception_type', ''),
                "similarity": similarity,
            })

        doubles.sort(key=lambda x: x['similarity'], reverse=True)
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
    try:
        async with db.get_connection() as conn:
            messages_count = await conn.fetchval("SELECT COUNT(*) FROM fredi_messages WHERE user_id = $1", user_id)
            sessions = await conn.fetchval("SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at)) FROM fredi_messages WHERE user_id = $1", user_id)
            weekly_activity = await conn.fetch("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM fredi_messages WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY DATE(created_at) ORDER BY date
            """, user_id)
            test_results = await conn.fetch("""
                SELECT test_type, profile_code, created_at FROM fredi_test_results
                WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
            """, user_id)
            morning_messages_count = await conn.fetchval("SELECT COUNT(*) FROM fredi_morning_messages WHERE user_id = $1", user_id)

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


# ---------- КОНФАЙНТМЕНТ ----------
@app.get("/api/confinement/model/{user_id}")
async def get_confinement_model(user_id: int):
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
    try:
        profile = await user_repo.get_profile(user_id) or {}
        model_data = profile.get('confinement_model')
        if not model_data:
            return {"statistics": {"total_elements": 0, "active_elements": 0, "total_loops": 0, "is_system_closed": False, "closure_score": 0}}
        model = ConfinementModel.from_dict(model_data)
        analyzer = LoopAnalyzer(model)
        stats = analyzer.get_statistics() if hasattr(analyzer, 'get_statistics') else {}
        return {"statistics": stats}
    except Exception as e:
        logger.error(f"Error in confinement statistics: {e}")
        return {"statistics": {}}


@app.get("/api/intervention/{element_id}")
async def get_intervention(element_id: int, user_id: int):
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
            'title': 'Осознанность', 'practice': 'Побудь в тишине 2 минуты', 'duration': '2 минуты'
        }
        return {
            "success": True,
            "element": {
                "id": element.id, "name": element.name, "description": element.description,
                "type": element.element_type, "vector": element.vector,
                "level": element.level, "strength": element.strength
            },
            "intervention": intervention,
            "random_quote": intervention_lib.get_random_quote() if intervention_lib else "Изменения начинаются с осознания"
        }
    except Exception as e:
        logger.error(f"Error in intervention: {e}")
        return {"success": False, "error": str(e)}


# ---------- ПРАКТИКИ ----------
@app.get("/api/practice/morning")
async def get_morning_practice():
    return {"practice": "🌅 УТРЕННЯЯ ПРАКТИКА\n\nПроснувшись, не вставайте сразу:\n\n1. Сделайте 3 глубоких вдоха\n2. Потянитесь всем телом\n3. Улыбнитесь себе в зеркало\n4. Скажите: «Сегодня будет хороший день»\n\n⏱ Время: 3-5 минут"}

@app.get("/api/practice/evening")
async def get_evening_practice():
    return {"practice": "🌙 ВЕЧЕРНЯЯ ПРАКТИКА\n\nЗа 15 минут до сна:\n\n1. Вспомните 3 хороших события сегодня\n2. Поблагодарите себя за что-то\n3. Сделайте 5 медленных вдохов\n4. Скажите: «Я справляюсь. Я благодарен за этот день»\n\n⏱ Время: 5-10 минут"}

@app.get("/api/practice/random-exercise")
async def get_random_exercise():
    exercises = [
        "🧘 Дыхание\n\nСделайте паузу. Обратите внимание на своё дыхание. Вдох... выдох... Повторите 5 раз.",
        "👀 Наблюдение\n\nПосмотрите вокруг. Найдите 3 предмета, которые вызывают приятные чувства.",
        "📝 Дневник\n\nНапишите одно дело, которое вы сделали хорошо сегодня.",
        "🚶 Прогулка\n\nВыйдите на 10 минут. Замечайте, что видите, слышите, чувствуете.",
        "💭 Мысли\n\nЗапишите все мысли, которые крутятся в голове. Не оценивайте, просто выпишите."
    ]
    return {"exercise": random.choice(exercises)}

@app.get("/api/practice/random-quote")
async def get_random_quote():
    quotes = [
        "«Не в силе, а в правде. Не в деньгах, а в душевном покое.»",
        "«То, что мы думаем, определяет то, что мы делаем. То, что мы делаем, определяет то, кем мы становимся.»",
        "«Маленькие шаги каждый день ведут к большим изменениям.»",
        "«Проблему нельзя решить на том же уровне, на котором она возникла.» — Альберт Эйнштейн",
        "«Изменения начинаются там, где заканчивается зона комфорта.»"
    ]
    return {"quote": random.choice(quotes)}


# ---------- ГИПНОЗ ----------
@app.get("/api/hypno/process")
async def hypno_process(user_id: int, text: str, mode: str = "psychologist"):
    try:
        profile = await user_repo.get_profile(user_id) or {}
        context = {'mode': mode, 'profile': profile, 'confinement_model': profile.get('confinement_model')}
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
    try:
        data = await request.json()
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


# ---------- СКАЗКИ ----------
@app.get("/api/tale")
async def get_tale(issue: str = None):
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
    try:
        if not tales:
            return {"success": False, "error": "Сказки недоступны"}
        tale = tales.get_tale_by_id(tale_id)
        if not tale:
            return {"success": False, "error": "Сказка не найдена"}
        return {"success": True, "tale": tale.get('text', ''), "title": tale.get('title', '')}
    except Exception as e:
        logger.error(f"Error in get tale by id: {e}")
        return {"success": False, "error": str(e)}


# ---------- ЯКОРЯ ----------
@app.get("/api/anchor/user/{user_id}")
async def get_user_anchors(user_id: int):
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT metadata->>'name' as name,
                       thought_text as phrase,
                       metadata->>'state' as state
                FROM fredi_psychologist_thoughts
                WHERE user_id = $1 AND thought_type = 'anchor'
                ORDER BY created_at DESC LIMIT 20
            """, user_id)
        anchors = [{"name": r['name'] or "Неизвестный", "phrase": r['phrase'], "state": r['state'] or "calm"} for r in rows]
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
                INSERT INTO fredi_psychologist_thoughts (user_id, thought_type, thought_text, metadata)
                VALUES ($1, 'anchor', $2, $3)
            """, user_id, phrase, json.dumps({"name": anchor_name, "state": state}))
        await log_event(user_id, "set_anchor", {"name": anchor_name, "state": state})
        return {"success": True}
    except Exception as e:
        logger.error(f"Error in set anchor: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/anchor/fire")
async def fire_anchor(request: Request):
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


# ---------- ЯКОРЯ v2 (fredi_anchors) ----------

@app.get("/api/anchors/user/{user_id}")
@limiter.limit("30/minute")
async def get_user_anchors_v2(request: Request, user_id: int):
    """Получить якоря пользователя из fredi_anchors"""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT id, name, state, source, source_detail, modality,
                       trigger_text, phrase, icon, state_icon, state_name, uses, created_at,
                       instruction_steps, recommended_stimuli, program_json, type
                FROM fredi_anchors
                WHERE user_id = $1
                ORDER BY created_at DESC LIMIT 50
            """, user_id)

        def _jsonb(v):
            if v is None:
                return None
            if isinstance(v, (dict, list)):
                return v
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:
                    return v
            return v

        anchors = []
        for r in rows:
            anchors.append({
                "id": r["id"],
                "name": r["name"],
                "state": r["state"],
                "source": r["source"],
                "source_detail": r["source_detail"],
                "modality": r["modality"],
                "trigger": r["trigger_text"],
                "phrase": r["phrase"],
                "icon": r["icon"] or "⚓",
                "state_icon": r["state_icon"],
                "state_name": r["state_name"],
                "uses": r["uses"] or 0,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "instruction_steps": _jsonb(r["instruction_steps"]),
                "recommended_stimuli": _jsonb(r["recommended_stimuli"]),
                "program_json": _jsonb(r["program_json"]),
                "type": r["type"] or "anchor"
            })

        return {"success": True, "anchors": anchors}
    except Exception as e:
        logger.error(f"Error in get_user_anchors_v2: {e}")
        return {"success": True, "anchors": []}


@app.post("/api/anchors/save")
@limiter.limit("20/minute")
async def save_anchor_v2(request: Request):
    """Сохранить новый якорь"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        name = data.get("name", "").strip()
        if not user_id or not name:
            return {"success": False, "error": "user_id and name required"}

        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO fredi_anchors (user_id, name, state, source, source_detail,
                    modality, trigger_text, phrase, icon, state_icon, state_name,
                    type, instruction_steps, program_json, recommended_stimuli)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            """,
                user_id,
                name,
                data.get("state", "calm"),
                data.get("source", "own"),
                data.get("source_detail"),
                data.get("modality", "auditory"),
                data.get("trigger", data.get("trigger_text")),
                data.get("phrase"),
                data.get("icon", "⚓"),
                data.get("state_icon"),
                data.get("state_name"),
                data.get("type", "anchor"),
                data.get("instruction_steps"),
                data.get("program_json"),
                data.get("recommended_stimuli")
            )

        await log_event(user_id, "anchor_saved", {"name": name})
        return {"success": True, "id": row["id"]}
    except Exception as e:
        logger.error(f"Error in save_anchor_v2: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/anchors/delete")
@limiter.limit("20/minute")
async def delete_anchor_v2(request: Request):
    """Удалить якорь"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        anchor_id = data.get("anchor_id")
        if not user_id or not anchor_id:
            return {"success": False, "error": "user_id and anchor_id required"}

        async with db.get_connection() as conn:
            await conn.execute("""
                DELETE FROM fredi_anchors WHERE id = $1 AND user_id = $2
            """, int(anchor_id), user_id)

        return {"success": True}
    except Exception as e:
        logger.error(f"Error in delete_anchor_v2: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/anchors/fire")
@limiter.limit("30/minute")
async def fire_anchor_v2(request: Request):
    """Активировать якорь — увеличить счётчик и вернуть фразу"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        anchor_id = data.get("anchor_id")
        anchor_name = data.get("anchor_name", "")

        if not user_id:
            return {"success": False, "error": "user_id required"}

        phrase = None

        if anchor_id:
            async with db.get_connection() as conn:
                row = await conn.fetchrow("""
                    UPDATE fredi_anchors SET uses = uses + 1
                    WHERE id = $1 AND user_id = $2
                    RETURNING phrase, name
                """, int(anchor_id), user_id)
            if row:
                phrase = row["phrase"]
                anchor_name = row["name"]

        if not phrase:
            defaults = {
                "calm": "Я спокоен. Я дышу ровно. Всё хорошо.",
                "confidence": "Я знаю, что делаю. У меня всё получится.",
                "action": "Пора действовать. Я готов.",
                "focus": "Мой ум ясен. Я сосредоточен.",
                "energy": "Энергия наполняет меня. Я готов действовать.",
                "love": "Я открыт любви. Я принимаю себя.",
                "gratitude": "Я благодарен за этот момент.",
                "safety": "Я в безопасности. Всё под контролем.",
                "joy": "Радость наполняет меня. Жизнь прекрасна.",
                "grounding": "Я здесь. Моё тело — моя опора."
            }
            phrase = defaults.get(anchor_name, f"Якорь «{anchor_name}» активирован.")

        await log_event(user_id, "anchor_fired", {"name": anchor_name})
        return {"success": True, "phrase": phrase}
    except Exception as e:
        logger.error(f"Error in fire_anchor_v2: {e}")
        return {"success": False, "error": str(e)}


# ---------- ЧАТЫ И СООБЩЕНИЯ ----------

@app.post("/api/chats/create")
@limiter.limit("20/minute")
async def create_chat(request: Request):
    """Create or get existing chat between two users."""
    try:
        data = await request.json()
        user_id_1 = int(data.get("user_id_1"))
        user_id_2 = int(data.get("user_id_2"))
        if not user_id_1 or not user_id_2 or user_id_1 == user_id_2:
            return {"success": False, "error": "Two different user_ids required"}

        # Normalize order so (A,B) and (B,A) map to the same chat
        low, high = min(user_id_1, user_id_2), max(user_id_1, user_id_2)

        async with db.get_connection() as conn:
            # Try to find existing
            row = await conn.fetchrow(
                "SELECT id FROM fredi_chats WHERE user_id_1 = $1 AND user_id_2 = $2",
                low, high
            )
            if row:
                return {"success": True, "chat_id": row["id"], "created": False}

            # Create new
            row = await conn.fetchrow("""
                INSERT INTO fredi_chats (user_id_1, user_id_2, created_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id_1, user_id_2) DO UPDATE SET user_id_1 = EXCLUDED.user_id_1
                RETURNING id
            """, low, high)
            return {"success": True, "chat_id": row["id"], "created": True}
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/chats")
@limiter.limit("30/minute")
async def get_chats(request: Request, user_id: int):
    """Get all chats for a user."""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT ch.id, ch.user_id_1, ch.user_id_2,
                       ch.last_message_text, ch.last_message_at, ch.created_at,
                       c1.name as name_1, c1.age as age_1, c1.gender as gender_1, c1.privacy as priv_1,
                       c2.name as name_2, c2.age as age_2, c2.gender as gender_2, c2.privacy as priv_2,
                       u1.profile_photo as photo_1, u2.profile_photo as photo_2,
                       (SELECT COUNT(*) FROM fredi_chat_messages m
                        WHERE m.chat_id = ch.id AND m.sender_id != $1 AND m.is_read = FALSE) as unread
                FROM fredi_chats ch
                LEFT JOIN fredi_user_contexts c1 ON c1.user_id = ch.user_id_1
                LEFT JOIN fredi_user_contexts c2 ON c2.user_id = ch.user_id_2
                LEFT JOIN fredi_users u1          ON u1.user_id = ch.user_id_1
                LEFT JOIN fredi_users u2          ON u2.user_id = ch.user_id_2
                WHERE ch.user_id_1 = $1 OR ch.user_id_2 = $1
                ORDER BY COALESCE(ch.last_message_at, ch.created_at) DESC
                LIMIT 50
            """, user_id)

        chats = []
        for r in rows:
            # Determine partner
            is_user1 = (r["user_id_1"] == user_id)
            partner_id = r["user_id_2"] if is_user1 else r["user_id_1"]
            partner_name = (r["name_2"] if is_user1 else r["name_1"]) or "Пользователь"
            partner_age = r["age_2"] if is_user1 else r["age_1"]
            partner_gender = r["gender_2"] if is_user1 else r["gender_1"]
            partner_photo_raw = r["photo_2"] if is_user1 else r["photo_1"]
            partner_priv = _norm_privacy((r["priv_2"] if is_user1 else r["priv_1"]) or None)
            # Фото доступно в чате для privacy == public или chat
            partner_photo = partner_photo_raw if partner_priv.get("photo") in ("public", "chat") else None

            chats.append({
                "id": r["id"],
                "partnerId": partner_id,
                "partnerName": partner_name,
                "partnerAge": partner_age,
                "partnerGender": partner_gender,
                "partnerPhoto": partner_photo,
                "lastMessage": {"text": r["last_message_text"] or ""} if r["last_message_text"] else None,
                "lastMessageAt": r["last_message_at"].isoformat() if r["last_message_at"] else None,
                "unreadCount": r["unread"] or 0,
                "createdAt": r["created_at"].isoformat()
            })

        return {"success": True, "chats": chats}
    except Exception as e:
        logger.error(f"Error getting chats: {e}")
        return {"success": True, "chats": []}


@app.get("/api/chats/{chat_id}/messages")
@limiter.limit("30/minute")
async def get_chat_messages(request: Request, chat_id: int, user_id: int, limit: int = 50, offset: int = 0):
    """Get messages in a chat."""
    try:
        async with db.get_connection() as conn:
            # Verify user is participant
            chat = await conn.fetchrow(
                "SELECT id FROM fredi_chats WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)",
                chat_id, user_id
            )
            if not chat:
                return {"success": False, "error": "Chat not found"}

            rows = await conn.fetch("""
                SELECT id, sender_id as "fromUserId", text, is_read as "isRead", created_at as "createdAt"
                FROM fredi_chat_messages
                WHERE chat_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            """, chat_id, limit, offset)

            # Mark messages as read
            await conn.execute("""
                UPDATE fredi_chat_messages SET is_read = TRUE
                WHERE chat_id = $1 AND sender_id != $2 AND is_read = FALSE
            """, chat_id, user_id)

        messages = []
        for r in rows:
            messages.append({
                "id": r["id"],
                "fromUserId": r["fromUserId"],
                "text": r["text"],
                "isRead": r["isRead"],
                "createdAt": r["createdAt"].isoformat(),
                "type": "text"
            })

        return {"success": True, "messages": list(reversed(messages))}
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return {"success": True, "messages": []}


@app.post("/api/chats/{chat_id}/messages")
@limiter.limit("30/minute")
async def send_message(request: Request, chat_id: int, user_id: Optional[int] = None):
    """Send a message in a chat."""
    try:
        data = await request.json()
        sender_raw = data.get("user_id") if isinstance(data, dict) else None
        if sender_raw is None:
            sender_raw = user_id
        if sender_raw is None:
            return {"success": False, "error": "user_id required"}
        try:
            sender_id = int(sender_raw)
        except (TypeError, ValueError):
            return {"success": False, "error": "invalid user_id"}

        text = (data.get("text") or "").strip()
        if not text:
            return {"success": False, "error": "Message text required"}

        async with db.get_connection() as conn:
            # Verify user is participant
            chat = await conn.fetchrow(
                "SELECT id FROM fredi_chats WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)",
                chat_id, sender_id
            )
            if not chat:
                return {"success": False, "error": "Chat not found"}

            row = await conn.fetchrow("""
                INSERT INTO fredi_chat_messages (chat_id, sender_id, text, created_at)
                VALUES ($1, $2, $3, NOW())
                RETURNING id, created_at
            """, chat_id, sender_id, text[:2000])

            # Update chat last message
            await conn.execute("""
                UPDATE fredi_chats SET last_message_text = $2, last_message_at = NOW()
                WHERE id = $1
            """, chat_id, text[:100])

        return {
            "success": True,
            "message": {
                "id": row["id"],
                "fromUserId": sender_id,
                "text": text,
                "isRead": False,
                "createdAt": row["created_at"].isoformat(),
                "type": "text"
            }
        }
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/chats/{chat_id}/read")
@limiter.limit("30/minute")
async def mark_chat_read(request: Request, chat_id: int, user_id: Optional[int] = None):
    """Mark all messages in a chat as read."""
    try:
        try:
            data = await request.json()
        except Exception:
            data = {}
        uid_raw = (data.get("user_id") if isinstance(data, dict) else None) or user_id
        if uid_raw is None:
            return {"success": False, "error": "user_id required"}
        try:
            uid = int(uid_raw)
        except (TypeError, ValueError):
            return {"success": False, "error": "invalid user_id"}
        async with db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_chat_messages SET is_read = TRUE
                WHERE chat_id = $1 AND sender_id != $2 AND is_read = FALSE
            """, chat_id, uid)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/notifications")
@limiter.limit("30/minute")
async def get_notifications(request: Request, user_id: int):
    """Список уведомлений пользователя + счётчик непрочитанных чат-сообщений."""
    try:
        async with db.get_connection() as conn:
            unread_chat = await conn.fetchval("""
                SELECT COUNT(*) FROM fredi_chat_messages m
                JOIN fredi_chats ch ON ch.id = m.chat_id
                WHERE (ch.user_id_1 = $1 OR ch.user_id_2 = $1)
                  AND m.sender_id != $1 AND m.is_read = FALSE
            """, user_id) or 0

            rows = await conn.fetch("""
                SELECT id, type, title, body, data, is_read, created_at
                FROM fredi_notifications
                WHERE user_id = $1
                ORDER BY id DESC
                LIMIT 100
            """, user_id)

        notifications = []
        for r in rows:
            raw = r["data"]
            if isinstance(raw, str):
                try:
                    data_obj = json.loads(raw)
                except Exception:
                    data_obj = {}
            else:
                data_obj = raw or {}
            notifications.append({
                "id": r["id"],
                "type": r["type"],
                "title": r["title"],
                "body": r["body"] or "",
                "data": data_obj,
                "isRead": bool(r["is_read"]),
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            })
        return {"success": True, "notifications": notifications, "unread_total": unread_chat}
    except Exception as e:
        logger.error(f"get_notifications error: {e}")
        return {"success": True, "notifications": [], "unread_total": 0}


@app.post("/api/notifications/read-all")
@limiter.limit("30/minute")
async def notifications_read_all(request: Request):
    try:
        data = await request.json()
        user_id = int(data.get("user_id") or 0)
        if not user_id:
            return {"success": False, "error": "user_id required"}
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_notifications SET is_read = TRUE "
                "WHERE user_id = $1 AND is_read = FALSE",
                user_id
            )
        return {"success": True}
    except Exception as e:
        logger.error(f"notifications_read_all error: {e}")
        return {"success": False, "error": str(e)}


@app.delete("/api/notifications/{notif_id}")
@limiter.limit("60/minute")
async def delete_notification(request: Request, notif_id: int):
    try:
        uid_q = request.query_params.get("user_id")
        user_id = int(uid_q) if uid_q else 0
        async with db.get_connection() as conn:
            if user_id:
                await conn.execute(
                    "DELETE FROM fredi_notifications WHERE id = $1 AND user_id = $2",
                    notif_id, user_id
                )
            else:
                await conn.execute("DELETE FROM fredi_notifications WHERE id = $1", notif_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"delete_notification error: {e}")
        return {"success": False, "error": str(e)}


async def _push_notification(user_id: int, ntype: str, title: str, body: str = "", data: Optional[Dict] = None):
    """Вставка уведомления в fredi_notifications. Никогда не бросает — аналитика/нотиф-канал не должен ломать flow."""
    try:
        payload = json.dumps(data or {}, ensure_ascii=False, default=str)
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_notifications (user_id, type, title, body, data, is_read, created_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, FALSE, NOW())
            """, int(user_id), ntype[:40], title[:200], (body or "")[:500], payload)
    except Exception as e:
        logger.warning(f"_push_notification({ntype}) failed: {e}")


@app.post("/api/chats/{chat_id}/contact")
@limiter.limit("10/minute")
async def request_contact(request: Request, chat_id: int):
    """Request contact info from chat partner."""
    try:
        data = await request.json()
        user_id = int(data.get("user_id", 0))
        async with db.get_connection() as conn:
            chat = await conn.fetchrow(
                "SELECT user_id_1, user_id_2 FROM fredi_chats WHERE id = $1", chat_id)
            if not chat:
                return {"success": False, "error": "Chat not found"}
            partner_id = chat["user_id_2"] if chat["user_id_1"] == user_id else chat["user_id_1"]
            await conn.execute("""
                INSERT INTO fredi_chat_messages (chat_id, sender_id, text, created_at)
                VALUES ($1, $2, $3, NOW())
            """, chat_id, user_id, '📱 Запрос контактных данных')
            await conn.execute("UPDATE fredi_chats SET last_message_text = $2, last_message_at = NOW() WHERE id = $1",
                chat_id, '📱 Запрос контакта')
        return {"success": True}
    except Exception as e:
        logger.error(f"Contact request error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/chats/{chat_id}/share-contact")
@limiter.limit("10/minute")
async def share_contact(request: Request, chat_id: int):
    """Share contact info with chat partner."""
    try:
        data = await request.json()
        user_id = int(data.get("user_id", 0))
        contact = data.get("contact", "")
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_chat_messages (chat_id, sender_id, text, created_at)
                VALUES ($1, $2, $3, NOW())
            """, chat_id, user_id, f'📱 Мои контакты: {contact}' if contact else '📱 Контакт отправлен')
            await conn.execute("UPDATE fredi_chats SET last_message_text = $2, last_message_at = NOW() WHERE id = $1",
                chat_id, '📱 Контакт отправлен')
        return {"success": True}
    except Exception as e:
        logger.error(f"Share contact error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/chats/{chat_id}/block")
@limiter.limit("10/minute")
async def block_chat(request: Request, chat_id: int):
    """Block a chat."""
    return {"success": True, "message": "Чат заблокирован"}


# ---------- USERS LIST (fallback for doubles) ----------
@app.get("/api/users/list")
@limiter.limit("10/minute")
async def users_list(request: Request, limit: int = 200):
    """List users with profiles for doubles fallback."""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT u.user_id, u.profile, u.profile_photo, c.name, c.age, c.city, c.gender, c.bio, c.privacy
                FROM fredi_users u
                LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
                WHERE u.profile IS NOT NULL
                  AND u.profile != '{}'::jsonb
                  AND u.profile -> 'behavioral_levels' IS NOT NULL
                ORDER BY u.last_activity DESC NULLS LAST
                LIMIT $1
            """, limit)

        def last_val(arr, default=4):
            if isinstance(arr, list) and arr: return arr[-1]
            if isinstance(arr, (int, float)): return arr
            return default

        users = []
        for r in rows:
            p = r['profile'] if isinstance(r['profile'], dict) else json.loads(r['profile'])
            bl = p.get('behavioral_levels', {})
            priv = _norm_privacy(r['privacy'] if r['privacy'] else None)
            # В списке отдаём фото/био только если приватность = public
            photo = r['profile_photo'] if priv.get('photo') == 'public' else None
            bio   = r['bio'] if priv.get('bio') == 'public' else None
            users.append({
                'user_id': r['user_id'],
                'name': r['name'] or f'User_{r["user_id"]}',
                'age': r['age'],
                'city': r['city'],
                'gender': r['gender'],
                'photo': photo,
                'bio': bio,
                'profile_code': p.get('display_name', ''),
                'profile_type': p.get('perception_type', ''),
                'vectors': {
                    'СБ': last_val(bl.get('СБ')),
                    'ТФ': last_val(bl.get('ТФ')),
                    'УБ': last_val(bl.get('УБ')),
                    'ЧВ': last_val(bl.get('ЧВ'))
                }
            })
        return {"success": True, "users": users}
    except Exception as e:
        logger.error(f"Error in users list: {e}")
        return {"success": True, "users": []}


# ---------- USER STATUS ----------
@app.get("/api/user-status")
async def user_status(user_id: Optional[str] = None):
    try:
        if not user_id:
            return {"success": False, "error": "user_id is required"}
        user_id = str(user_id).strip()
        try:
            user_id_int = int(user_id)
        except ValueError:
            user_id_int = None
            async with db.get_connection() as conn:
                exists = await conn.fetchval("SELECT 1 FROM fredi_users WHERE user_id::text = $1", user_id)
                if not exists:
                    await conn.execute(
                        "INSERT INTO fredi_users (user_id, username, created_at) VALUES ($1, $2, NOW())",
                        user_id, f"user_{user_id}"
                    )
            user_id_int = user_id

        profile = await user_repo.get_profile(user_id_int) or {}
        has_profile = bool(profile.get('profile_data') or profile.get('ai_generated_profile'))

        # Extract vectors for frontend (anchors, dreams, doubles)
        behavioral_levels = profile.get('behavioral_levels', {})
        vectors = None
        if behavioral_levels:
            def _lv(arr):
                if isinstance(arr, list) and arr: return arr[-1]
                if isinstance(arr, (int, float)): return arr
                return 4
            vectors = {
                'СБ': _lv(behavioral_levels.get('СБ')),
                'ТФ': _lv(behavioral_levels.get('ТФ')),
                'УБ': _lv(behavioral_levels.get('УБ')),
                'ЧВ': _lv(behavioral_levels.get('ЧВ'))
            }

        return {
            "success": True,
            "has_profile": has_profile,
            "test_completed": has_profile,
            "profile_code": profile.get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4') if has_profile else "не определен",
            "interpretation_ready": bool(profile.get('ai_generated_profile')),
            "vectors": vectors,
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error in user-status for user_id={user_id}: {e}")
        return {"success": False, "error": "Internal server error"}


@app.post("/api/save-mode")
async def save_mode(request: Request):
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
    return await get_psychologist_thought(request, user_id)


@app.post("/api/psychologist-thoughts/generate")
async def generate_thought(request: Request):
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


# ============================================
# ИНТЕРПРЕТАЦИЯ СНОВ
# ============================================

dream_service = None

# Session store for multi-round dream clarifications.
# Основной storage — Redis (TTL=1h). При недоступности Redis падаем на in-memory.
_DREAM_SESSION_TTL_SECONDS = 3600
_DREAM_SESSION_PREFIX = "dream_session:"
_dream_sessions_mem: Dict[str, Dict[str, Any]] = {}
_dream_sessions_mem_exp: Dict[str, datetime] = {}


def _dream_session_cleanup_mem() -> None:
    now = datetime.now()
    expired = [sid for sid, exp in _dream_sessions_mem_exp.items() if exp < now]
    for sid in expired:
        _dream_sessions_mem.pop(sid, None)
        _dream_sessions_mem_exp.pop(sid, None)


async def _dream_session_get(sid: str) -> Optional[Dict[str, Any]]:
    if cache and cache.is_connected:
        data = await cache.get(f"{_DREAM_SESSION_PREFIX}{sid}")
        if data:
            return data
    _dream_session_cleanup_mem()
    return _dream_sessions_mem.get(sid)


async def _dream_session_set(sid: str, data: Dict[str, Any]) -> None:
    payload = {
        "user_id": data.get("user_id"),
        "dream_text": data.get("dream_text", ""),
        "clarifications": data.get("clarifications", []),
        "last_question": data.get("last_question", ""),
        "school": data.get("school", "jung"),
    }
    stored = False
    if cache and cache.is_connected:
        stored = await cache.set(f"{_DREAM_SESSION_PREFIX}{sid}", payload, ttl=_DREAM_SESSION_TTL_SECONDS)
    if not stored:
        _dream_sessions_mem[sid] = payload
        _dream_sessions_mem_exp[sid] = datetime.now() + timedelta(seconds=_DREAM_SESSION_TTL_SECONDS)


async def _dream_session_delete(sid: str) -> None:
    if cache and cache.is_connected:
        await cache.delete(f"{_DREAM_SESSION_PREFIX}{sid}")
    _dream_sessions_mem.pop(sid, None)
    _dream_sessions_mem_exp.pop(sid, None)


@app.post("/api/dreams/interpret")
@limiter.limit("10/minute")
async def interpret_dream(request: Request):
    """Интерпретация сна с учётом профиля пользователя"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        dream_text = data.get("dream_text", "").strip()
        school = (data.get("school") or "jung").lower().strip()

        if not user_id:
            return {"success": False, "error": "user_id required"}
        if not dream_text:
            return {"success": False, "error": "dream_text required"}

        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}

        profile_code = profile.get('display_name')
        perception_type = profile.get('perception_type')
        thinking_level = profile.get('thinking_level')
        vectors = profile.get('behavioral_levels', {})

        if vectors:
            vectors = {
                'СБ': vectors.get('СБ', [3])[-1] if vectors.get('СБ') else 3,
                'ТФ': vectors.get('ТФ', [3])[-1] if vectors.get('ТФ') else 3,
                'УБ': vectors.get('УБ', [3])[-1] if vectors.get('УБ') else 3,
                'ЧВ': vectors.get('ЧВ', [3])[-1] if vectors.get('ЧВ') else 3,
            }

        ai_profile = profile.get('ai_generated_profile', '')
        key_characteristic = None
        main_trap = None

        if ai_profile:
            lines = ai_profile.split('\n')
            for i, line in enumerate(lines):
                if 'КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА:' in line or '🔑' in line:
                    if i + 1 < len(lines):
                        key_characteristic = lines[i + 1].strip()
                if 'ГЛАВНАЯ ЛОВУШКА:' in line or '⚠️' in line:
                    if i + 1 < len(lines):
                        main_trap = lines[i + 1].strip()

        global dream_service
        if dream_service is None:
            from services.dream_service import create_dream_service
            dream_service = create_dream_service(ai_service)

        result = await dream_service.interpret_dream(
            user_id=user_id,
            dream_text=dream_text,
            user_name=context.get('name', 'друг'),
            profile_code=profile_code,
            perception_type=perception_type,
            thinking_level=thinking_level,
            vectors=vectors,
            key_characteristic=key_characteristic,
            main_trap=main_trap,
            clarifications=[],
            school=school,
        )

        if result.get("needs_clarification"):
            sid = result.get("session_id") or f"{user_id}_{int(datetime.now().timestamp())}"
            await _dream_session_set(sid, {
                "user_id": int(user_id),
                "dream_text": dream_text,
                "clarifications": [],
                "last_question": result.get("question") or "",
                "school": school,
            })
            result["session_id"] = sid
        else:
            await user_repo.create_user_if_not_exists(user_id)
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_dreams (user_id, dream_text, interpretation, created_at)
                    VALUES ($1, $2, $3, NOW())
                """, int(user_id), dream_text[:2000], result["interpretation"])

        return {"success": True, **result}

    except Exception as e:
        logger.error(f"Error in dream interpretation: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@app.post("/api/dreams/clarify")
@limiter.limit("10/minute")
async def clarify_dream(request: Request):
    """Уточнение сна после дополнительных вопросов (многораундовое)"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        session_id = data.get("session_id")
        answer = (data.get("answer") or "").strip()
        dream_text_req = data.get("dream_text", "") or ""

        if not user_id or not session_id:
            return {"success": False, "error": "user_id and session_id required"}
        if not answer:
            return {"success": False, "error": "answer required"}

        session = await _dream_session_get(session_id)

        if session is None:
            if not dream_text_req:
                return {"success": False, "error": "session not found and dream_text missing"}
            session = {
                "user_id": int(user_id),
                "dream_text": dream_text_req,
                "clarifications": [],
                "last_question": "",
            }
            await _dream_session_set(session_id, session)

        dream_text = session.get("dream_text") or dream_text_req
        history: List[Dict[str, str]] = list(session.get("clarifications") or [])
        history.append({
            "question": session.get("last_question") or "Расскажи подробнее.",
            "answer": answer,
        })

        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}

        vectors = profile.get('behavioral_levels', {})
        if vectors:
            vectors = {
                'СБ': vectors.get('СБ', [3])[-1] if vectors.get('СБ') else 3,
                'ТФ': vectors.get('ТФ', [3])[-1] if vectors.get('ТФ') else 3,
                'УБ': vectors.get('УБ', [3])[-1] if vectors.get('УБ') else 3,
                'ЧВ': vectors.get('ЧВ', [3])[-1] if vectors.get('ЧВ') else 3,
            }

        global dream_service
        if dream_service is None:
            from services.dream_service import create_dream_service
            dream_service = create_dream_service(ai_service)

        school = (data.get("school") or session.get("school") or "jung").lower().strip()
        result = await dream_service.interpret_dream(
            user_id=user_id,
            dream_text=dream_text,
            user_name=context.get('name', 'друг'),
            profile_code=profile.get('display_name'),
            perception_type=profile.get('perception_type'),
            thinking_level=profile.get('thinking_level'),
            vectors=vectors,
            clarifications=history,
            school=school,
        )

        if result.get("needs_clarification"):
            session["clarifications"] = history
            session["last_question"] = result.get("question") or ""
            await _dream_session_set(session_id, session)
            result["session_id"] = session_id
        else:
            if not result.get("interpretation"):
                user_name = context.get('name', 'друг')
                result["interpretation"] = f"""🌙 {user_name}, твой сон говорит о глубоких внутренних переживаниях.

Символика сна указывает на поиск свободы и новых впечатлений. Обрати внимание на свои чувства — они подскажут, что действительно важно для тебя сейчас.

Рекомендую в ближайшие дни записывать свои сны и наблюдать за повторяющимися образами. Это поможет лучше понять себя."""
                logger.info(f"✨ Сгенерирован fallback-ответ для сна пользователя {user_id}")

            await user_repo.create_user_if_not_exists(user_id)
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_dreams (user_id, dream_text, interpretation, created_at)
                    VALUES ($1, $2, $3, NOW())
                """, int(user_id), dream_text[:2000], result["interpretation"])

            await _dream_session_delete(session_id)

        return {"success": True, **result}

    except Exception as e:
        logger.error(f"Error in dream clarification: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

@app.get("/api/dreams/history/{user_id}")
@limiter.limit("30/minute")
async def get_dreams_history(request: Request, user_id: int, limit: int = 20):
    """Получить историю снов пользователя"""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT id, dream_text, interpretation, created_at
                FROM fredi_dreams
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """, user_id, limit)

        dreams = []
        for row in rows:
            dreams.append({
                "id": row["id"],
                "text": row["dream_text"],
                "interpretation": row["interpretation"],
                "date": row["created_at"].strftime("%d.%m.%Y"),
                "datetime": row["created_at"].isoformat()
            })

        return {"success": True, "dreams": dreams}

    except Exception as e:
        logger.error(f"Error getting dreams history: {e}")
        return {"success": True, "dreams": []}


@app.post("/api/dreams/save")
@limiter.limit("20/minute")
async def save_dream(request: Request):
    """Save a dream to history (frontend local save backup)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        dream = data.get("dream", {})
        if not user_id or not dream:
            return {"success": False, "error": "user_id and dream required"}
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_dreams (user_id, dream_text, interpretation, created_at)
                VALUES ($1, $2, $3, NOW())
            """, int(user_id), (dream.get("text") or "")[:2000], dream.get("interpretation") or "")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving dream: {e}")
        return {"success": False, "error": str(e)}


@app.delete("/api/dreams/{dream_id}")
@limiter.limit("10/minute")
async def delete_dream(request: Request, dream_id: int, user_id: int):
    """Удалить сон из истории"""
    try:
        async with db.get_connection() as conn:
            await conn.execute("""
                DELETE FROM fredi_dreams
                WHERE id = $1 AND user_id = $2
            """, dream_id, user_id)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error deleting dream: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/goals/with-confinement")
async def goals_with_confinement(user_id: int, mode: str = "coach"):
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


# ---------- ТЕСТ ----------
@app.post("/api/save-test-results")
@limiter.limit("5/minute")
async def save_test_results(request: Request):
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

        await user_repo.save_profile(user_id, full_profile)

        ai_profile = None
        thought = None

        try:
            ai_profile = await ai_service.generate_ai_profile(user_id, full_profile)
            if ai_profile:
                await user_repo.update_profile_field(user_id, 'ai_generated_profile', ai_profile)
                logger.info(f"✅ AI-профиль сгенерирован для {user_id}")
        except Exception as e:
            logger.error(f"❌ Ошибка генерации AI-профиля: {e}")

        try:
            thought = await ai_service.generate_psychologist_thought(user_id, full_profile)
            if thought:
                await user_repo.save_psychologist_thought(user_id, thought, test_result_id)
                logger.info(f"✅ Мысль психолога сгенерирована для {user_id}")
        except Exception as e:
            logger.error(f"❌ Ошибка генерации мысли психолога: {e}")

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
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT id, test_type, results, profile_code, perception_type, thinking_level, created_at
                FROM fredi_test_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
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
async def tts_compat(request: Request, text: str = Form(...), mode: str = Form("psychologist")):
    try:
        audio_base64 = await voice_service.text_to_speech(text, mode)
        if audio_base64:
            return {"audio_url": f"data:audio/mpeg;base64,{audio_base64}", "success": True}
        else:
            return JSONResponse(status_code=500, content={"success": False, "error": "TTS failed"})
    except Exception as e:
        logger.error(f"TTS compat error: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/api/generated-profile/{user_id}")
@limiter.limit("30/minute")
async def get_generated_profile(request: Request, user_id: int):
    try:
        profile = await user_repo.get_profile(user_id) or {}
        profile_data = profile.get('profile_data', {})
        deep_patterns = profile.get('deep_patterns', {})
        ai_profile = profile.get('ai_generated_profile')
        psychologist_thought = await user_repo.get_psychologist_thought(user_id)

        if psychologist_thought:
            context = await context_repo.get(user_id) or {}
            user_name = context.get('name', 'друг')
            psychologist_thought = format_psychologist_text(psychologist_thought, user_name)

        if not ai_profile and profile_data:
            try:
                ai_profile = await ai_service.generate_ai_profile(user_id, profile)
                if ai_profile:
                    await user_repo.update_profile_field(user_id, 'ai_generated_profile', ai_profile)
            except Exception as e:
                logger.error(f"❌ Ошибка генерации AI-профиля: {e}")

        if not psychologist_thought and profile_data:
            try:
                thought = await ai_service.generate_psychologist_thought(user_id, profile)
                if thought:
                    async with db.get_connection() as conn:
                        test_result = await conn.fetchrow(
                            "SELECT id FROM fredi_test_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", user_id
                        )
                        test_result_id = test_result['id'] if test_result else None
                    await user_repo.save_psychologist_thought(user_id, thought, test_result_id)
                    context = await context_repo.get(user_id) or {}
                    psychologist_thought = format_psychologist_text(thought, context.get('name', 'друг'))
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


# ---------- ПРОВЕРКА РЕАЛЬНОСТИ ----------
@app.get("/api/reality/path/{goal_id}")
async def get_reality_path(goal_id: str, mode: str = "coach"):
    try:
        path = get_theoretical_path(goal_id, mode)
        return {"success": True, "path": path}
    except Exception as e:
        logger.error(f"Error in reality path: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/reality/check")
async def check_reality(request: Request):
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
    return {"success": True, "questions": generate_life_context_questions()}


@app.post("/api/reality/parse/life")
async def parse_life_answers(request: Request):
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
    try:
        data = await request.json()
        text = data.get("text", "")
        parsed = parse_goal_context_answers(text)
        return {"success": True, "parsed": parsed}
    except Exception as e:
        logger.error(f"Error parsing goal answers: {e}")
        return {"success": False, "error": str(e)}


# ---------- НАПОМИНАНИЯ ----------
@app.post("/api/reminder")
@limiter.limit("10/minute")
async def create_reminder(
    request: Request,
    user_id: int = Form(...),
    reminder_type: str = Form(...),
    remind_at: str = Form(...)
):
    try:
        remind_dt = datetime.fromisoformat(remind_at)
        async with db.get_connection() as conn:
            reminder_id = await conn.fetchval("""
                INSERT INTO fredi_reminders (user_id, reminder_type, remind_at) VALUES ($1, $2, $3) RETURNING id
            """, user_id, reminder_type, remind_dt)
        await log_event(user_id, "create_reminder", {"type": reminder_type})
        return {"success": True, "reminder_id": reminder_id}
    except Exception as e:
        logger.error(f"Error creating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- МИГРАЦИЯ ----------
@app.post("/api/migrate-user")
async def migrate_user(request: Request):
    try:
        data = await request.json()
        old_user_id = data.get('old_user_id')
        new_user_id = data.get('new_user_id')
        if not old_user_id or not new_user_id:
            return {"success": False, "error": "Missing ids"}
        async with db.get_connection() as conn:
            await conn.execute("UPDATE fredi_messages SET user_id = $1 WHERE user_id::text = $2", new_user_id, old_user_id)
            await conn.execute("UPDATE fredi_user_contexts SET user_id = $1 WHERE user_id::text = $2", new_user_id, old_user_id)
            await conn.execute("UPDATE fredi_test_results SET user_id = $1 WHERE user_id::text = $2", new_user_id, old_user_id)
            await conn.execute("UPDATE fredi_psychologist_thoughts SET user_id = $1 WHERE user_id::text = $2", new_user_id, old_user_id)
            await conn.execute("UPDATE fredi_events SET user_id = $1 WHERE user_id::text = $2", new_user_id, old_user_id)
            await conn.execute("DELETE FROM fredi_users WHERE user_id::text = $1", old_user_id)
        logger.info(f"✅ Миграция: {old_user_id} → {new_user_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Migration error: {e}")
        return {"success": False, "error": str(e)}


# ---------- АДМИНКА ----------
@app.get("/admin/stats")
async def admin_stats(request: Request):
    try:
        async with db.get_connection() as conn:
            total_users = await conn.fetchval("SELECT COUNT(*) FROM fredi_users")
            active_today = await conn.fetchval("SELECT COUNT(DISTINCT user_id) FROM fredi_events WHERE created_at > NOW() - INTERVAL '24 hours'")
            total_messages = await conn.fetchval("SELECT COUNT(*) FROM fredi_messages")
            total_tests = await conn.fetchval("SELECT COUNT(*) FROM fredi_test_results")
            total_morning = await conn.fetchval("SELECT COUNT(*) FROM fredi_morning_messages")
            modes_stats = await conn.fetch("SELECT communication_mode as mode, COUNT(*) as count FROM fredi_user_contexts WHERE communication_mode IS NOT NULL GROUP BY communication_mode")
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
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

@app.get("/api/admin/mirrors-stats")
async def admin_mirrors_stats(request: Request):
    """Статистика зеркал для секретной комнаты"""
    try:
        async with db.get_connection() as conn:
            total_created   = await conn.fetchval("SELECT COUNT(*) FROM fredi_mirrors") or 0
            total_completed = await conn.fetchval("SELECT COUNT(*) FROM fredi_mirrors WHERE status='used'") or 0

            by_platform = await conn.fetch(
                "SELECT mirror_type, COUNT(*) as cnt FROM fredi_mirrors GROUP BY mirror_type")

            recent = await conn.fetch("""
                SELECT m.mirror_code, m.mirror_type, m.status,
                       m.friend_name, m.created_at, m.completed_at,
                       u.username as user_name
                FROM fredi_mirrors m
                LEFT JOIN fredi_users u ON u.user_id = m.user_id
                ORDER BY m.created_at DESC LIMIT 10
            """)

            top_sharers = await conn.fetch("""
                SELECT COALESCE(u.username, 'user_'||m.user_id::text) as user_name,
                       COUNT(*) as count,
                       COUNT(*) FILTER (WHERE m.status='used') as completed
                FROM fredi_mirrors m
                LEFT JOIN fredi_users u ON u.user_id = m.user_id
                GROUP BY m.user_id, u.username
                ORDER BY count DESC LIMIT 5
            """)

        plat = {'telegram': 0, 'max': 0, 'web': 0}
        for row in by_platform:
            t = row['mirror_type']
            if t in plat: plat[t] = row['cnt']

        conv = round(total_completed / total_created * 100) if total_created else 0

        recent_list = []
        for r in recent:
            recent_list.append({
                'mirror_code': r['mirror_code'],
                'platform': r['mirror_type'],
                'status': r['status'],
                'completed': r['status'] == 'used',
                'friend_name': r['friend_name'],
                'user_name': r['user_name'] or f"user_{r['mirror_code'][:4]}",
                'created_at': r['created_at'].isoformat() if r['created_at'] else '',
            })

        return {
            "success": True,
            "stats": {
                "totalCreated": total_created,
                "totalCompleted": total_completed,
                "conversionRate": conv,
                "byPlatform": plat,
                "recentMirrors": recent_list,
                "topSharers": [dict(r) for r in top_sharers],
            }
        }
    except Exception as e:
        logger.error(f"Admin mirrors stats error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/admin/recent-users")
async def admin_recent_users(request: Request):
    """Последние пользователи для секретной комнаты"""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT u.user_id, u.username, u.first_name,
                       u.last_activity, u.created_at,
                       t.profile_code
                FROM fredi_users u
                LEFT JOIN LATERAL (
                    SELECT profile_code FROM fredi_test_results
                    WHERE user_id = u.user_id
                    ORDER BY created_at DESC LIMIT 1
                ) t ON true
                ORDER BY u.last_activity DESC NULLS LAST
                LIMIT 30
            """)
        users = []
        for r in rows:
            users.append({
                'user_id': r['user_id'],
                'username': r['username'],
                'first_name': r['first_name'],
                'last_activity': r['last_activity'].isoformat() if r['last_activity'] else '',
                'created_at': r['created_at'].isoformat() if r['created_at'] else '',
                'profile_code': r['profile_code'],
            })
        return {"success": True, "users": users}
    except Exception as e:
        logger.error(f"Admin recent users error: {e}")
        return {"success": False, "error": str(e)}



@app.get("/api/admin/logs")
async def admin_logs(request: Request, limit: int = 50):
    """Последние события/ошибки из таблицы events"""
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT user_id, event_type, event_data, created_at
                FROM fredi_events
                ORDER BY created_at DESC
                LIMIT $1
            """, limit)

        logs = []
        for r in rows:
            data = r['event_data']
            if isinstance(data, str):
                import json as _json
                try: data = _json.loads(data)
                except Exception: pass

            # Определяем уровень по типу события
            evt = r['event_type'] or ''
            if 'error' in evt.lower() or 'fail' in evt.lower():
                level = 'ERROR'
            elif 'warn' in evt.lower():
                level = 'WARNING'
            else:
                level = 'INFO'

            msg = evt
            if data and isinstance(data, dict):
                details = ', '.join(f"{k}: {v}" for k, v in list(data.items())[:3])
                if details: msg += f' — {details}'

            logs.append({
                'level': level,
                'timestamp': r['created_at'].isoformat() if r['created_at'] else '',
                'message': msg,
                'user_id': r['user_id'],
            })

        return {"success": True, "logs": logs}
    except Exception as e:
        logger.error(f"Admin logs error: {e}")
        return {"success": False, "error": str(e), "logs": []}



# ============================================
# 🔔 PUSH-УВЕДОМЛЕНИЯ
# ============================================

@app.get("/api/push/vapid-public-key")
async def get_vapid_public_key():
    """Отдаёт публичный VAPID ключ фронтенду (читается из env через PushService)."""
    if not push_service or not getattr(push_service, "enabled", False):
        return {"publicKey": None, "enabled": False,
                "error": "VAPID not configured on server"}
    return {"publicKey": push_service.vapid_public_key, "enabled": True}


@app.get("/api/push/diagnostics")
@limiter.limit("30/minute")
async def push_diagnostics(request: Request, user_id: Optional[int] = None):
    """Диагностика push-подсистемы и утренних сообщений."""
    try:
        result = {
            "push_service_ready": push_service is not None,
            "vapid_public_set":   bool(push_service and push_service.vapid_public_key),
            "vapid_private_set":  bool(push_service and push_service.vapid_private_key),
            "push_enabled":       bool(push_service and getattr(push_service, "enabled", False)),
            "vapid_contact":      (push_service.vapid_claims or {}).get("sub") if push_service else None,
            "vapid_public_key_preview": (push_service.vapid_public_key[:16] + "...") if push_service and push_service.vapid_public_key else None,
            "morning_manager_ready": morning_manager is not None,
        }
        async with db.get_connection() as conn:
            result["active_subscriptions_total"] = int(await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_push_subscriptions WHERE is_active = TRUE"
            ) or 0)
            if user_id:
                uid = int(user_id)
                result["user_id"] = uid
                result["active_subscriptions_user"] = int(await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_push_subscriptions WHERE user_id = $1 AND is_active = TRUE", uid
                ) or 0)
                last_row = await conn.fetchrow(
                    "SELECT last_morning_sent_at, COALESCE(notification_channel, 'push') AS channel "
                    "FROM fredi_users WHERE user_id = $1", uid
                )
                if last_row:
                    result["user_last_morning_sent_at"] = last_row["last_morning_sent_at"].isoformat() if last_row["last_morning_sent_at"] else None
                    result["user_notification_channel"] = last_row["channel"]
                last_msg = await conn.fetchrow("""
                    SELECT message_text, message_type, day_number, sent_at
                    FROM fredi_morning_messages
                    WHERE user_id = $1
                    ORDER BY sent_at DESC NULLS LAST
                    LIMIT 1
                """, uid)
                if last_msg:
                    result["last_message_preview"] = (last_msg["message_text"] or "")[:250]
                    result["last_message_type"] = last_msg["message_type"]
                    result["last_message_day"] = last_msg["day_number"]
                    result["last_message_sent_at"] = last_msg["sent_at"].isoformat() if last_msg["sent_at"] else None
                # Linked messengers
                ml = await conn.fetch(
                    "SELECT platform, is_active FROM fredi_messenger_links WHERE user_id = $1", uid
                )
                result["messenger_links"] = [{"platform": r["platform"], "is_active": r["is_active"]} for r in ml]
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"push_diagnostics error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@app.post("/api/morning/send-now")
@limiter.limit("5/minute")
async def morning_send_now(request: Request):
    """
    Ручной триггер утреннего сообщения — для тестирования, без ожидания 9:00.
    Body: { user_id: int, day?: 1..5, dry_run?: bool }
    dry_run=True — только сгенерирует текст, не доставляет и не пишет в БД.
    """
    try:
        data = await request.json() if await request.body() else {}
    except Exception:
        data = {}
    user_id = data.get("user_id") or request.query_params.get("user_id")
    if not user_id:
        return {"success": False, "error": "user_id required"}
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return {"success": False, "error": "invalid user_id"}

    day = int(data.get("day") or 1)
    if day < 1 or day > 5:
        day = 1
    dry_run = bool(data.get("dry_run"))

    if morning_manager is None:
        return {"success": False, "error": "morning_manager not ready"}

    async with db.get_connection() as conn:
        u = await conn.fetchrow("""
            SELECT u.profile,
                   COALESCE(u.notification_channel, 'push') AS channel,
                   c.name, c.gender, c.weather_cache
            FROM fredi_users u
            LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id
            WHERE u.user_id = $1
        """, user_id)
    if not u:
        return {"success": False, "error": "user not found"}

    profile = u["profile"] or {}
    if isinstance(profile, str):
        try: profile = json.loads(profile)
        except Exception: profile = {}

    scores = {}
    bl = profile.get("behavioral_levels", {}) if isinstance(profile, dict) else {}
    for k in ("СБ", "ТФ", "УБ", "ЧВ"):
        arr = bl.get(k)
        if isinstance(arr, list) and arr:
            scores[k] = sum(arr) / len(arr)
        elif isinstance(arr, (int, float)):
            scores[k] = arr
        else:
            scores[k] = 3

    weather_cache = u["weather_cache"]
    if isinstance(weather_cache, str):
        try: weather_cache = json.loads(weather_cache)
        except Exception: weather_cache = None

    context = {
        "name": u["name"] or "друг",
        "gender": u["gender"] or "other",
        "weather_cache": weather_cache,
    }

    try:
        message = await morning_manager.generate_morning_message(
            user_id=user_id,
            user_name=context["name"],
            scores=scores,
            profile_data=profile,
            context=context,
            day=day,
        )
    except Exception as e:
        logger.error(f"morning_send_now generate failed: {e}", exc_info=True)
        return {"success": False, "error": f"generation failed: {e}"}

    delivered = False
    if not dry_run:
        title = "🎉 Идеи на выходные" if day == 5 else "🌅 Доброе утро от Фреди"
        body_short = re.sub(r'\*\*(.*?)\*\*', r'\1', message).replace('\n', ' ').strip()
        if len(body_short) > 120:
            body_short = body_short[:117] + "..."
        try:
            delivered = await _deliver_morning_message(user_id, u["channel"], title, body_short, message)
            async with db.get_connection() as conn2:
                await conn2.execute(
                    "INSERT INTO fredi_morning_messages (user_id, message_text, message_type, day_number) VALUES ($1, $2, $3, $4)",
                    user_id, message, "weekend" if day == 5 else "morning_test", day
                )
        except Exception as e:
            logger.error(f"morning_send_now delivery failed: {e}")

    return {
        "success": True,
        "user_id": user_id,
        "day": day,
        "channel": u["channel"],
        "dry_run": dry_run,
        "delivered": delivered,
        "message": message,
    }

@app.post("/api/push/subscribe")
async def push_subscribe(request: Request, data: PushSubscribeRequest):
    try:
        if push_service:
            ok = await push_service.save_subscription(data.user_id, data.subscription)
            return {"success": ok}
        return {"success": False, "error": "PushService не инициализирован"}
    except Exception as e:
        logger.error(f"Push subscribe error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/push/send")
async def push_send(request: Request, data: PushSendRequest):
    """Отправить push конкретному пользователю"""
    try:
        if push_service:
            ok = await push_service.send_to_user(data.user_id, data.title, data.body, data.url)
            return {"success": ok}
        return {"success": False}
    except Exception as e:
        logger.error(f"Push send error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/push/broadcast")
async def push_broadcast(request: Request):
    """Рассылка всем подписчикам (только для админа)"""
    try:
        data = await request.json()
        title = data.get("title", "Фреди")
        body  = data.get("body", "")
        url   = data.get("url", "/")
        if push_service:
            count = await push_service.broadcast(title, body, url)
            return {"success": True, "sent": count}
        return {"success": False}
    except Exception as e:
        logger.error(f"Push broadcast error: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# НАСТРОЙКИ УВЕДОМЛЕНИЙ + СВЯЗКА С МЕССЕНДЖЕРАМИ
# ============================================

ALLOWED_NOTIFICATION_CHANNELS = {"push", "telegram", "max", "none"}
ALLOWED_LINK_PLATFORMS = {"telegram", "max"}


@app.get("/api/settings/notifications/{user_id}")
@limiter.limit("30/minute")
async def get_notification_settings(request: Request, user_id: int):
    """Возвращает текущий канал уведомлений + список привязанных мессенджеров."""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT notification_channel FROM fredi_users WHERE user_id = $1",
                user_id
            )
            channel = (row["notification_channel"] if row else None) or "push"

            links = await conn.fetch(
                "SELECT platform, username, linked_at FROM fredi_messenger_links "
                "WHERE user_id = $1 AND is_active = TRUE",
                user_id
            )

        return {
            "success": True,
            "channel": channel,
            "linked": [
                {
                    "platform": l["platform"],
                    "username": l["username"],
                    "linked_at": l["linked_at"].isoformat() if l["linked_at"] else None,
                }
                for l in links
            ],
        }
    except Exception as e:
        logger.error(f"get_notification_settings error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/settings/notifications")
@limiter.limit("20/minute")
async def set_notification_settings(request: Request):
    """Меняет канал доставки утренних сообщений (push/telegram/max/none)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        channel = (data.get("channel") or "push").strip().lower()
        if not user_id:
            return {"success": False, "error": "user_id required"}
        if channel not in ALLOWED_NOTIFICATION_CHANNELS:
            return {"success": False, "error": f"channel must be one of {sorted(ALLOWED_NOTIFICATION_CHANNELS)}"}

        async with db.get_connection() as conn:
            # Создаём юзера если его ещё нет
            await conn.execute(
                "INSERT INTO fredi_users (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) "
                "ON CONFLICT (user_id) DO NOTHING",
                int(user_id)
            )
            await conn.execute(
                "UPDATE fredi_users SET notification_channel = $1, updated_at = NOW() WHERE user_id = $2",
                channel, int(user_id)
            )

        await log_event(int(user_id), "notification_channel_changed", {"channel": channel})
        return {"success": True, "channel": channel}
    except Exception as e:
        logger.error(f"set_notification_settings error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/messenger/link")
@limiter.limit("30/minute")
async def link_messenger(request: Request):
    """
    Вызывается из бота при /start web_<id>.
    Сохраняет связку web_user_id ↔ chat_id для нужной платформы.
    """
    try:
        data = await request.json()
        user_id = data.get("user_id")
        platform = (data.get("platform") or "").strip().lower()
        chat_id = data.get("chat_id")
        username = data.get("username")

        if not user_id or not platform or not chat_id:
            return {"success": False, "error": "user_id, platform, chat_id required"}
        if platform not in ALLOWED_LINK_PLATFORMS:
            return {"success": False, "error": f"platform must be one of {sorted(ALLOWED_LINK_PLATFORMS)}"}

        async with db.get_connection() as conn:
            await conn.execute(
                "INSERT INTO fredi_users (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) "
                "ON CONFLICT (user_id) DO NOTHING",
                int(user_id)
            )
            await conn.execute("""
                INSERT INTO fredi_messenger_links (user_id, platform, chat_id, username, linked_at, is_active)
                VALUES ($1, $2, $3, $4, NOW(), TRUE)
                ON CONFLICT (user_id, platform) DO UPDATE SET
                    chat_id = EXCLUDED.chat_id,
                    username = EXCLUDED.username,
                    linked_at = NOW(),
                    is_active = TRUE
            """, int(user_id), platform, str(chat_id), username)

        await log_event(int(user_id), "messenger_linked", {"platform": platform})
        return {"success": True}
    except Exception as e:
        logger.error(f"link_messenger error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/messenger/unlink")
@limiter.limit("30/minute")
async def unlink_messenger(request: Request):
    """Отвязка платформы (по запросу из веб-приложения)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        platform = (data.get("platform") or "").strip().lower()
        if not user_id or platform not in ALLOWED_LINK_PLATFORMS:
            return {"success": False, "error": "bad params"}

        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_messenger_links SET is_active = FALSE WHERE user_id = $1 AND platform = $2",
                int(user_id), platform
            )

        await log_event(int(user_id), "messenger_unlinked", {"platform": platform})
        return {"success": True}
    except Exception as e:
        logger.error(f"unlink_messenger error: {e}")
        return {"success": False, "error": str(e)}


async def log_event(user_id: int, event_type: str, event_data: Dict = None):
    try:
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_events (user_id, event_type, event_data) VALUES ($1, $2, $3)
            """, user_id, event_type, json.dumps(event_data) if event_data else None)
    except Exception as e:
        logger.error(f"Error logging event for user {user_id}: {type(e).__name__}: {e}")


# ============================================
# ПРОФИЛЬ + ПРИВАТНОСТЬ
# ============================================

PROFILE_FIELDS = ("photo", "name", "age", "gender", "city", "bio",
                  "occupation", "telegram", "instagram", "phone", "email")
DEFAULT_PRIVACY = {
    "photo": "public", "name": "public", "age": "public",
    "gender": "public", "city": "public", "bio": "public",
    "occupation": "chat", "telegram": "chat", "instagram": "chat",
    "phone": "request", "email": "request",
}


def _norm_privacy(raw) -> dict:
    out = dict(DEFAULT_PRIVACY)
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k in out and v in ("public", "chat", "request"):
                out[k] = v
    return out


async def _load_full_profile(conn, user_id: int) -> dict:
    row_u = await conn.fetchrow("SELECT profile_photo FROM fredi_users WHERE user_id = $1", user_id)
    row_c = await conn.fetchrow("""
        SELECT name, age, gender, city, bio, occupation, telegram, instagram, phone, email, privacy
        FROM fredi_user_contexts WHERE user_id = $1
    """, user_id)
    privacy = _norm_privacy(row_c["privacy"] if row_c and row_c["privacy"] else None)
    data = {
        "photo":      row_u["profile_photo"] if row_u else None,
        "name":       row_c["name"] if row_c else None,
        "age":        row_c["age"] if row_c else None,
        "gender":     row_c["gender"] if row_c else None,
        "city":       row_c["city"] if row_c else None,
        "bio":        row_c["bio"] if row_c else None,
        "occupation": row_c["occupation"] if row_c else None,
        "telegram":   row_c["telegram"] if row_c else None,
        "instagram":  row_c["instagram"] if row_c else None,
        "phone":      row_c["phone"] if row_c else None,
        "email":      row_c["email"] if row_c else None,
        "privacy":    privacy,
    }
    return data


async def _chat_exists(conn, a: int, b: int) -> bool:
    row = await conn.fetchrow("""
        SELECT 1 FROM fredi_chats
        WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
        LIMIT 1
    """, a, b)
    return row is not None


@app.get("/api/profile/me")
@limiter.limit("30/minute")
async def profile_me(request: Request, user_id: int):
    """Полный профиль текущего пользователя — для экрана настроек."""
    try:
        async with db.get_connection() as conn:
            data = await _load_full_profile(conn, int(user_id))
        return {"success": True, "profile": data}
    except Exception as e:
        logger.error(f"profile_me error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/profile/me")
@limiter.limit("30/minute")
async def profile_me_save(request: Request):
    """Сохранить поля и/или privacy. user_id в body. Пустые поля принимаются (== null)."""
    try:
        data = await request.json()
        user_id = int(data.get("user_id"))
        fields = data.get("fields") or {}
        privacy = data.get("privacy")
        photo_data_url = data.get("photo")  # null = удалить, string = заменить, undefined = не трогать

        if not user_id:
            return {"success": False, "error": "user_id required"}

        # Лимит на размер data-URL фото: ~220KB после base64 inflation
        if isinstance(photo_data_url, str) and len(photo_data_url) > 300_000:
            return {"success": False, "error": "photo too large (max ~200KB)"}

        async with db.get_connection() as conn:
            # Обеспечить существование пользователя и контекста
            await conn.execute(
                "INSERT INTO fredi_users (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) "
                "ON CONFLICT (user_id) DO NOTHING", user_id)
            await conn.execute(
                "INSERT INTO fredi_user_contexts (user_id) VALUES ($1) "
                "ON CONFLICT (user_id) DO NOTHING", user_id)

            if "photo" in data:
                await conn.execute("UPDATE fredi_users SET profile_photo = $2 WHERE user_id = $1",
                                   user_id, photo_data_url)

            # Разрешённые поля для ввода
            allowed = {"name", "age", "gender", "city", "bio", "occupation",
                       "telegram", "instagram", "phone", "email"}
            # Integer-колонки в fredi_user_contexts (нужен int, строка не кодируется asyncpg)
            int_fields = {"age"}
            sets = []
            values = [user_id]
            for key, val in fields.items():
                if key not in allowed:
                    continue
                # Пусто → NULL (пользователь стер поле)
                if val is None or (isinstance(val, str) and val.strip() == ""):
                    coerced = None
                elif key in int_fields:
                    # age: принимаем int / "33" / "33 лет" (цифры извлекаются)
                    try:
                        if isinstance(val, (int, float)):
                            coerced = int(val)
                        else:
                            digits = re.sub(r'\D+', '', str(val))
                            coerced = int(digits) if digits else None
                    except (TypeError, ValueError):
                        coerced = None
                else:
                    # Строковые поля: тримим, обрезаем до 500 символов
                    coerced = str(val).strip()[:500]
                values.append(coerced)
                sets.append(f"{key} = ${len(values)}")
            if sets:
                await conn.execute(
                    f"UPDATE fredi_user_contexts SET {', '.join(sets)}, updated_at = NOW() WHERE user_id = $1",
                    *values)

            if isinstance(privacy, dict):
                await conn.execute(
                    "UPDATE fredi_user_contexts SET privacy = $2 WHERE user_id = $1",
                    user_id, json.dumps(_norm_privacy(privacy)))

            full = await _load_full_profile(conn, user_id)
        return {"success": True, "profile": full}
    except Exception as e:
        logger.error(f"profile_me_save error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@app.get("/api/profile/view/{owner_id}")
@limiter.limit("60/minute")
async def profile_view(request: Request, owner_id: int, user_id: int):
    """
    Чужой профиль с учётом приватности и выданных доступов.
    Возвращает поля + метаданные: каждое поле = {value, visibility, locked}.
    """
    try:
        viewer = int(user_id)
        if viewer == int(owner_id):
            # Смотрит сам себя — отдаём всё
            async with db.get_connection() as conn:
                data = await _load_full_profile(conn, int(owner_id))
            fields = {k: {"value": v, "visibility": data["privacy"].get(k, "public"), "locked": False}
                      for k, v in data.items() if k != "privacy"}
            return {"success": True, "owner_id": int(owner_id), "is_self": True, "fields": fields}

        async with db.get_connection() as conn:
            data = await _load_full_profile(conn, int(owner_id))
            chat_ok = await _chat_exists(conn, viewer, int(owner_id))
            granted_rows = await conn.fetch("""
                SELECT field_name FROM fredi_profile_access
                WHERE owner_id = $1 AND requester_id = $2 AND status = 'granted'
            """, int(owner_id), viewer)
            granted = {r["field_name"] for r in granted_rows}
            pending_rows = await conn.fetch("""
                SELECT field_name FROM fredi_profile_access
                WHERE owner_id = $1 AND requester_id = $2 AND status = 'pending'
            """, int(owner_id), viewer)
            pending = {r["field_name"] for r in pending_rows}

        fields = {}
        for key, val in data.items():
            if key == "privacy":
                continue
            visibility = data["privacy"].get(key, "public")
            can_see = False
            if visibility == "public":
                can_see = True
            elif visibility == "chat":
                can_see = chat_ok
            elif visibility == "request":
                can_see = key in granted
            fields[key] = {
                "value": val if can_see else None,
                "visibility": visibility,
                "locked": not can_see,
                "pending": key in pending,
            }
        return {"success": True, "owner_id": int(owner_id), "is_self": False,
                "chat_exists": chat_ok, "fields": fields}
    except Exception as e:
        logger.error(f"profile_view error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/profile/access/request")
@limiter.limit("30/minute")
async def profile_access_request(request: Request):
    """Попросить у owner_id доступ к полю field_name."""
    try:
        data = await request.json()
        requester = int(data.get("user_id"))
        owner = int(data.get("owner_id"))
        field = (data.get("field") or "").strip()
        if not requester or not owner or field not in DEFAULT_PRIVACY:
            return {"success": False, "error": "invalid params"}
        if requester == owner:
            return {"success": False, "error": "cannot request own profile"}
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_profile_access (owner_id, requester_id, field_name, status)
                VALUES ($1, $2, $3, 'pending')
                ON CONFLICT (owner_id, requester_id, field_name)
                DO UPDATE SET status = 'pending', resolved_at = NULL, created_at = NOW()
                WHERE fredi_profile_access.status != 'granted'
            """, owner, requester, field)
        return {"success": True}
    except Exception as e:
        logger.error(f"profile_access_request error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/profile/access/inbox")
@limiter.limit("60/minute")
async def profile_access_inbox(request: Request, user_id: int):
    """Входящие pending-запросы к моему профилю."""
    try:
        owner = int(user_id)
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT a.id, a.requester_id, a.field_name, a.status, a.created_at,
                       c.name AS requester_name
                FROM fredi_profile_access a
                LEFT JOIN fredi_user_contexts c ON c.user_id = a.requester_id
                WHERE a.owner_id = $1 AND a.status = 'pending'
                ORDER BY a.created_at DESC
                LIMIT 50
            """, owner)
        return {"success": True, "requests": [{
            "id": r["id"],
            "requester_id": r["requester_id"],
            "requester_name": r["requester_name"] or f"User_{r['requester_id']}",
            "field": r["field_name"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        } for r in rows]}
    except Exception as e:
        logger.error(f"profile_access_inbox error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/profile/access/{access_id}/resolve")
@limiter.limit("60/minute")
async def profile_access_resolve(request: Request, access_id: int):
    """Одобрить/отклонить запрос. user_id в body — должен быть owner этого запроса.

    На одобрение/отклонение шлём уведомление запрашивающему в таблицу
    fredi_notifications (отображается в «Сообщения → Уведомления»).
    """
    try:
        data = await request.json()
        user_id = int(data.get("user_id"))
        status = (data.get("status") or "").strip()
        if status not in ("granted", "denied"):
            return {"success": False, "error": "status must be granted|denied"}
        requester_id = None
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT owner_id, requester_id, field_name FROM fredi_profile_access WHERE id = $1",
                access_id
            )
            if not row or int(row["owner_id"]) != user_id:
                return {"success": False, "error": "not found"}
            await conn.execute("""
                UPDATE fredi_profile_access
                SET status = $2, resolved_at = NOW()
                WHERE id = $1
            """, access_id, status)
            requester_id = int(row["requester_id"])
            owner_name_row = await conn.fetchrow(
                "SELECT name FROM fredi_user_contexts WHERE user_id = $1", user_id
            )
            owner_name = (owner_name_row["name"] if owner_name_row else None) or "Пользователь"

            # Чтобы не спамить юзера N уведомлениями (когда резолвится сразу 5
            # полей) — дедупим: если уже есть непрочитанное уведомление этого
            # типа от того же owner за последние 10 минут, обновим его, а
            # не создадим новое.
            recent = await conn.fetchrow("""
                SELECT id FROM fredi_notifications
                WHERE user_id = $1
                  AND type = $2
                  AND (data->>'owner_id')::bigint = $3
                  AND is_read = FALSE
                  AND created_at > NOW() - INTERVAL '10 minutes'
                LIMIT 1
            """, requester_id, f"profile_access_{status}", user_id)

        if recent:
            # Уже есть — просто обновим timestamp, чтобы поднялось в топе.
            try:
                async with db.get_connection() as conn:
                    await conn.execute(
                        "UPDATE fredi_notifications SET created_at = NOW() WHERE id = $1",
                        recent["id"]
                    )
            except Exception:
                pass
        else:
            ntype = f"profile_access_{status}"
            if status == "granted":
                title = f"✅ {owner_name} открыл(а) профиль"
                body = "Ты можешь посмотреть полный профиль."
            else:
                title = f"🔒 {owner_name} отклонил(а) запрос"
                body = "Доступ к профилю не предоставлен."
            await _push_notification(
                requester_id, ntype, title, body,
                {"owner_id": user_id, "owner_name": owner_name}
            )

        # Analytics
        try:
            await log_server_event(user_id, f"profile_access_{status}", {"requester_id": requester_id})
        except Exception:
            pass

        # Web-push requester'у
        try:
            if push_service:
                if status == "granted":
                    await push_service.send_to_user(
                        requester_id,
                        title=f"✅ Доступ открыт",
                        body=f"{owner_name} разрешил(а) посмотреть профиль",
                        url="/?tab=messages"
                    )
        except Exception:
            pass

        return {"success": True}
    except Exception as e:
        logger.error(f"profile_access_resolve error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/profile/access/request-full")
@limiter.limit("10/minute")
async def profile_access_request_full(request: Request):
    """
    Запросить полный доступ к профилю в один приём.
    - Создаёт pending для всех полей с privacy 'chat' и 'request'.
    - Открывает чат (если не было) между requester и owner.
    - Шлёт системное сообщение от имени requester'а.
    - Возвращает статус по каждому полю: pending/granted/already_granted.
    Используется со страницы двойников/подборов по цели.
    """
    try:
        data = await request.json()
        requester = int(data.get("user_id") or 0)
        owner = int(data.get("owner_id") or 0)
        if not requester or not owner:
            return {"success": False, "error": "user_id and owner_id required"}
        if requester == owner:
            return {"success": False, "error": "cannot request own profile"}

        private_fields = [k for k, v in DEFAULT_PRIVACY.items() if v in ("chat", "request")]
        if not private_fields:
            return {"success": True, "requested": [], "already": []}

        requested_fields = []
        already_granted = []
        async with db.get_connection() as conn:
            # Имя запрашивающего для системного сообщения.
            requester_name_row = await conn.fetchrow(
                "SELECT name FROM fredi_user_contexts WHERE user_id = $1", requester
            )
            requester_name = (requester_name_row["name"] if requester_name_row else None) or "Пользователь"

            # Смотрим уже granted-поля, чтобы не пере-пендить.
            granted_rows = await conn.fetch("""
                SELECT field_name FROM fredi_profile_access
                WHERE owner_id = $1 AND requester_id = $2 AND status = 'granted'
            """, owner, requester)
            granted = {r["field_name"] for r in granted_rows}

            for field in private_fields:
                if field in granted:
                    already_granted.append(field)
                    continue
                await conn.execute("""
                    INSERT INTO fredi_profile_access (owner_id, requester_id, field_name, status)
                    VALUES ($1, $2, $3, 'pending')
                    ON CONFLICT (owner_id, requester_id, field_name)
                    DO UPDATE SET status = 'pending', resolved_at = NULL, created_at = NOW()
                    WHERE fredi_profile_access.status != 'granted'
                """, owner, requester, field)
                requested_fields.append(field)

            # Создать/найти чат и отправить системное сообщение — только
            # если реально что-то новое запросили.
            chat_id = None
            if requested_fields:
                low, high = min(requester, owner), max(requester, owner)
                row = await conn.fetchrow(
                    "SELECT id FROM fredi_chats WHERE user_id_1 = $1 AND user_id_2 = $2",
                    low, high
                )
                if row:
                    chat_id = row["id"]
                else:
                    row = await conn.fetchrow("""
                        INSERT INTO fredi_chats (user_id_1, user_id_2, created_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (user_id_1, user_id_2) DO UPDATE SET user_id_1 = EXCLUDED.user_id_1
                        RETURNING id
                    """, low, high)
                    chat_id = row["id"] if row else None

                if chat_id:
                    sys_text = (
                        f"🔐 {requester_name} нашёл(ла) тебя в «Двойниках» и запросил(а) доступ к полному профилю. "
                        f"Ответить: Настройки → 🔑 Аккаунт → Запросы на профиль."
                    )
                    await conn.execute("""
                        INSERT INTO fredi_chat_messages (chat_id, sender_id, text, created_at)
                        VALUES ($1, $2, $3, NOW())
                    """, chat_id, requester, sys_text)
                    await conn.execute(
                        "UPDATE fredi_chats SET last_message_text = $2, last_message_at = NOW() WHERE id = $1",
                        chat_id, sys_text[:200]
                    )

        # Analytics
        try:
            await log_server_event(requester, "profile_access_requested", {
                "owner_id": owner,
                "fields_count": len(requested_fields),
                "already_granted_count": len(already_granted),
                "new_request": bool(requested_fields),
            })
        except Exception:
            pass

        # Push уведомление владельцу, если подписка есть
        try:
            if requested_fields and push_service:
                await push_service.send_to_user(
                    owner,
                    title="🔐 Запрос доступа к профилю",
                    body=f"{requester_name} просит посмотреть твой профиль",
                    url="/?tab=settings&section=account"
                )
        except Exception:
            pass

        return {
            "success": True,
            "chat_id": chat_id,
            "requested": requested_fields,
            "already_granted": already_granted,
        }
    except Exception as e:
        logger.error(f"profile_access_request_full error: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# BRAND TRANSFORMATION — переход от текущего образа к желаемому
# ============================================

TARGET_IMAGES = {
    "expert":      {"label": "Эксперт-гуру",            "examples": "Стив Джобс на презентации iPhone, доктор Хаус"},
    "visionary":   {"label": "Лидер-визионер",          "examples": "Илон Маск, Тони Старк (Iron Man)"},
    "charismatic": {"label": "Соблазнитель/харизматик", "examples": "Дон Дрейпер (Mad Men), Джеймс Бонд"},
    "ally":        {"label": "Свой парень",             "examples": "Том Хэнкс, Форрест Гамп"},
    "rebel":       {"label": "Бунтарь-новатор",         "examples": "Стив Джобс ранний, Курт Кобейн"},
    "mentor":      {"label": "Заботливый наставник",    "examples": "Опра Уинфри, Робин Уильямс в \"Обществе мёртвых поэтов\""},
}


def _brand_transformation_prompt(current_archetype: str, current_desc: str,
                                 target_label: str, target_examples: str,
                                 user_name: str, profile_summary: str,
                                 custom_target: Optional[str]) -> str:
    target_block = (
        f"ЦЕЛЕВОЙ ОБРАЗ: {target_label}.\n"
        f"Примеры людей с таким образом: {target_examples}."
    ) if not custom_target else (
        f"ЦЕЛЕВОЙ ОБРАЗ описан пользователем своими словами:\n«{custom_target}»\n"
        "Сначала кратко (1 предложение) перефразируй это в архетип."
    )
    return f"""Ты — Фреди, психолог-коуч по личному бренду.
Пользователь: {user_name}
ТЕКУЩИЙ АРХЕТИП: {current_archetype}.
{current_desc}

{target_block}

ЗАДАЧА: построить план трансформации публичного образа от текущего к желаемому.
План должен быть конкретным, без общих слов, и применимым к этому пользователю.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА — строго JSON, без префикса ```json и без лишнего текста:
{{
  "summary": "1-2 предложения: что меняем и зачем",
  "gap_analysis": [
    {{
      "axis": "outfit",
      "axis_label": "Внешний вид",
      "from": "как сейчас одевается / выглядит",
      "to":   "как должен выглядеть для целевого образа",
      "steps": ["конкретный шаг 1","шаг 2","шаг 3"]
    }},
    {{
      "axis": "speech",
      "axis_label": "Речь и манера",
      "from": "как сейчас говорит",
      "to":   "как должен говорить",
      "steps": ["шаг 1","шаг 2","шаг 3"]
    }},
    {{
      "axis": "environment",
      "axis_label": "Окружение",
      "from": "с кем сейчас общается / где бывает",
      "to":   "куда выходит / с кем нужно",
      "steps": ["конкретное место/мероприятие/клуб 1","2","3"]
    }},
    {{
      "axis": "habits",
      "axis_label": "Привычки",
      "from": "что делает регулярно сейчас",
      "to":   "какие новые ритуалы нужны",
      "steps": ["шаг 1","2","3"]
    }},
    {{
      "axis": "behavior",
      "axis_label": "Поведение",
      "from": "как ведёт себя в типичных ситуациях",
      "to":   "как должен себя вести",
      "steps": ["шаг 1","2","3"]
    }}
  ],
  "weekly_plan": [
    {{
      "week": 1,
      "focus": "тема недели",
      "actions": [
        {{"axis":"outfit","title":"конкретное действие","detail":"что именно сделать","time":"30 мин","priority":"high"}}
      ]
    }},
    {{ "week": 2, "focus": "...", "actions": [ ... ] }},
    {{ "week": 3, "focus": "...", "actions": [ ... ] }},
    {{ "week": 4, "focus": "...", "actions": [ ... ] }}
  ],
  "support_rituals": {{
    "daily":   ["ритуал 1","ритуал 2"],
    "weekly":  ["ритуал 1","ритуал 2"],
    "monthly": ["ритуал 1"]
  }},
  "examples": [
    {{
      "name": "Имя персонажа или человека",
      "source": "Фильм/реальность",
      "transformation": "что он(а) поменял(а): по 1 строке про внешний вид / речь / окружение / привычки / поведение",
      "lesson": "1-2 предложения: главный урок для пользователя"
    }},
    {{ "name": "...", "source": "...", "transformation": "...", "lesson": "..." }}
  ]
}}

ТРЕБОВАНИЯ К ВЫВОДУ:
- 4 недели, в каждой 3-5 действий
- Каждое действие: указать axis (outfit/speech/environment/habits/behavior)
- 2 примера: один из фильма, один из жизни
- Без markdown-форматирования внутри строк, без эмодзи в JSON
- Пиши на русском (в значениях), обращайся на «ты»

КРИТИЧЕСКИ ВАЖНО ПО ФОРМАТУ JSON:
- Все КЛЮЧИ строго английскими как в примере выше ("summary","gap_analysis","axis"...).
  Не переводи ключи на русский!
- Используй ТОЛЬКО прямые двойные кавычки U+0022 (ASCII "). Не используй «ёлочки»,
  „лапки", тире, или умные кавычки внутри JSON-строк — заменяй их на слова или тире.
- Экранируй любые двойные кавычки внутри значений: \\" (не обычные « или ").
- Без trailing-запятых (после последнего элемента массива/объекта).
- Без комментариев (// или #).
- Без переносов строк внутри строковых значений — используй \\n если очень нужно.
- Весь ответ — ровно один JSON-объект, БЕЗ префикса ```json и БЕЗ пояснений после.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (краткая выдержка для контекста):
{profile_summary}
"""


def _brand_parse_transformation_json(raw: str) -> Optional[Any]:
    """
    Пытаемся максимально терпимо распарсить JSON от LLM.
    Шаги:
    1) Прямой json.loads от первой { до последней }
    2) Починка частых косяков LLM:
       - trailing commas (,  ])
       - умные кавычки внутри строк
       - single-line // комментарии
    3) ast.literal_eval как последний шанс (для случаев с одинарными кавычками)
    Возвращает dict/list, либо None если не удалось.
    """
    if not raw:
        return None
    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
    except ValueError:
        return None
    snippet = raw[start:end]

    # Попытка 1 — как есть
    try:
        return json.loads(snippet)
    except Exception:
        pass

    # Попытка 2 — чистка
    repaired = snippet
    # 2a. Убираем // single-line комментарии
    repaired = re.sub(r'//[^\n]*', '', repaired)
    # 2b. Trailing commas перед ] или }
    repaired = re.sub(r',(\s*[}\]])', r'\1', repaired)
    # 2c. «Ёлочки» → нейтральная кавычка (внутри ЗНАЧЕНИЙ, не ключей)
    #     Грубо: заменяем все « и » на ', \u201C \u201D на ', \u201E на '
    for ch in ("«", "»", "\u201C", "\u201D", "\u201E", "„"):
        repaired = repaired.replace(ch, "'")
    # 2d. Невидимые BOM/zero-width
    repaired = repaired.replace("\ufeff", "").replace("\u200b", "")
    try:
        return json.loads(repaired)
    except Exception:
        pass

    # Попытка 3 — ast.literal_eval (допускает одинарные кавычки, но не всегда корректно мапится на JSON)
    try:
        import ast
        return ast.literal_eval(repaired)
    except Exception:
        return None


# Мапа русских ключей → английских (на случай, если LLM всё-таки их перевёл)
_BRAND_KEY_MAP = {
    "краткое содержание": "summary",
    "сводка": "summary",
    "анализ пробелов": "gap_analysis",
    "анализ": "gap_analysis",
    "план по неделям": "weekly_plan",
    "еженедельный план": "weekly_plan",
    "поддерживающие ритуалы": "support_rituals",
    "ритуалы поддержки": "support_rituals",
    "примеры": "examples",
    "ось": "axis",
    "метка оси": "axis_label",
    "из": "from",
    "к": "to",
    "шаги": "steps",
    "неделя": "week",
    "фокус": "focus",
    "действия": "actions",
    "название": "title",
    "заголовок": "title",
    "детали": "detail",
    "описание": "detail",
    "время": "time",
    "приоритет": "priority",
    "ежедневно": "daily",
    "еженедельно": "weekly",
    "ежемесячно": "monthly",
    "имя": "name",
    "источник": "source",
    "трансформация": "transformation",
    "урок": "lesson",
}


def _brand_normalize_keys(obj):
    """Рекурсивно приводит русские ключи к английским согласно _BRAND_KEY_MAP."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            new_k = _BRAND_KEY_MAP.get(str(k).lower().strip(), k)
            out[new_k] = _brand_normalize_keys(v)
        return out
    if isinstance(obj, list):
        return [_brand_normalize_keys(x) for x in obj]
    return obj


def _brand_transformation_fallback(current_archetype: str, target_label: str, custom_target: Optional[str]) -> dict:
    """Минимальный план-заглушка, если AI не вернул валидный JSON."""
    target = target_label or (custom_target or "Свой образ")
    return {
        "summary": f"Переход от «{current_archetype}» к «{target}». План: внешний вид, речь, окружение, привычки, поведение.",
        "gap_analysis": [
            {"axis": "outfit",      "axis_label": "Внешний вид",   "from": "Текущий", "to": "Новый", "steps": ["Обновить гардероб под новую роль"]},
            {"axis": "speech",      "axis_label": "Речь и манера", "from": "Текущая", "to": "Новая", "steps": ["Говорить короче и увереннее"]},
            {"axis": "environment", "axis_label": "Окружение",     "from": "Текущее", "to": "Новое", "steps": ["Добавить 2 тематических мероприятия в месяц"]},
            {"axis": "habits",      "axis_label": "Привычки",      "from": "Текущие", "to": "Новые", "steps": ["Ввести еженедельные ритуалы"]},
            {"axis": "behavior",    "axis_label": "Поведение",     "from": "Текущее", "to": "Новое", "steps": ["Меняй одну реакцию в неделю"]},
        ],
        "weekly_plan": [
            {"week": i, "focus": ["Стиль", "Голос", "Среда", "Интеграция"][i - 1],
             "actions": [{"axis": "outfit", "title": "Запишись к стилисту или пересобери 3 образа", "detail": "По новому целевому образу", "time": "2 часа", "priority": "high"}]}
            for i in range(1, 5)
        ],
        "support_rituals": {
            "daily":   ["Утром проверить: соответствует ли образ целевому"],
            "weekly":  ["Ревизия действий за неделю"],
            "monthly": ["Пересмотр плана"],
        },
        "examples": [
            {"name": "Тони Старк", "source": "Iron Man",
             "transformation": "Из эгоиста-инженера в публичного героя: поменял гардероб, манеру, окружение.",
             "lesson": "Чёткая цель + видимые внешние перемены быстро переписывают восприятие."},
        ],
        "_fallback": True,
    }


def _brand_archetype_label(profile: dict) -> Tuple[str, str]:
    """Грубое определение текущего архетипа по векторам."""
    bl = (profile or {}).get("behavioral_levels") or {}
    def lv(k, d=4):
        v = bl.get(k)
        if isinstance(v, list) and v: return v[-1]
        if isinstance(v, (int, float)): return v
        return d
    sb, tf, ub, cv = lv("СБ"), lv("ТФ"), lv("УБ"), lv("ЧВ")
    if cv >= 5 and tf <= 3: return ("Искатель/Бунтарь", "сейчас выбираешь свободу и новое, иногда в ущерб системности")
    if tf >= 5 and ub >= 5: return ("Эксперт-Создатель",  "сейчас известен как профессионал, но может не хватать харизмы")
    if sb >= 5 and ub >= 5: return ("Заботливый",         "сейчас воспринимаешься как надёжный и поддерживающий")
    if cv >= 5 and ub >= 5: return ("Любовник/Друг",      "сейчас тебя видят как тёплого, эмоционального, общительного")
    if tf >= 5:             return ("Герой",              "сейчас известен как тот, кто доводит дело до конца")
    return ("Странник",                                   "сейчас образ размытый — это нормально, тебе есть куда расти")


@app.post("/api/brand/transformation")
@limiter.limit("8/minute")
async def brand_transformation(request: Request):
    """План трансформации публичного образа: текущий → выбранный целевой."""
    try:
        data = await request.json()
        user_id = int(data.get("user_id"))
        target_key = (data.get("target") or "").strip().lower()
        custom_target = (data.get("custom_target") or "").strip() or None

        if not target_key and not custom_target:
            return {"success": False, "error": "target or custom_target required"}

        profile = await user_repo.get_profile(user_id) or {}
        context = await context_repo.get(user_id) or {}
        user_name = context.get("name", "друг")

        current_arch, current_desc = _brand_archetype_label(profile)

        target_label = TARGET_IMAGES.get(target_key, {}).get("label", "Свой образ")
        target_examples = TARGET_IMAGES.get(target_key, {}).get("examples", "")

        # Краткое summary профиля для AI-контекста
        bl = profile.get("behavioral_levels", {}) or {}
        def lv(k):
            v = bl.get(k)
            if isinstance(v, list) and v: return v[-1]
            if isinstance(v, (int, float)): return v
            return None
        summary_lines = [
            f"Имя: {user_name}",
            f"Возраст: {context.get('age', '—')}",
            f"Город: {context.get('city', '—')}",
            f"Род занятий: {context.get('occupation', '—')}",
        ]
        vec = ", ".join(f"{k}={lv(k)}" for k in ("СБ", "ТФ", "УБ", "ЧВ") if lv(k) is not None)
        if vec:
            summary_lines.append(f"Поведенческие векторы: {vec}")
        if profile.get("display_name"):
            summary_lines.append(f"Профиль: {profile['display_name']}")

        # Вариатика: развёрнутый контекст по доминирующему и уязвимому векторам
        try:
            from services.varitype_context import build_user_context as _vt_ctx
            raw_vectors = {k: lv(k) for k in ("СБ", "ТФ", "УБ", "ЧВ") if lv(k) is not None}
            vt_block = _vt_ctx(raw_vectors) if raw_vectors else ""
            if vt_block:
                summary_lines.append("")
                summary_lines.append(vt_block)
        except Exception:
            pass

        profile_summary = "\n".join(summary_lines)

        prompt = _brand_transformation_prompt(
            current_archetype=current_arch,
            current_desc=current_desc,
            target_label=target_label,
            target_examples=target_examples,
            user_name=user_name,
            profile_summary=profile_summary,
            custom_target=custom_target,
        )
        system = "Ты помогаешь людям менять публичный образ. Отвечай строго в формате JSON, без преамбул."

        response = await ai_service._call_deepseek(system, prompt, max_tokens=2400, temperature=0.5)
        if not response or not str(response).strip():
            return {"success": False, "error": "empty AI response"}

        clean = re.sub(r'```json|```', '', str(response)).strip()
        payload = _brand_parse_transformation_json(clean)

        if payload is None:
            logger.error(f"brand_transformation JSON parse failed even after repair; raw[:400]={clean[:400]}")
            # Мягкий fallback: не 500, а минимальный план, чтобы фронт не падал
            payload = _brand_transformation_fallback(current_arch, target_label, custom_target)

        # Нормализуем русские ключи, если модель их перевела
        payload = _brand_normalize_keys(payload)

        return {
            "success": True,
            "current_archetype": current_arch,
            "current_description": current_desc,
            "target_key": target_key or "custom",
            "target_label": target_label if target_key else (custom_target[:80] if custom_target else "Свой образ"),
            "target_examples": target_examples,
            "transformation": payload,
        }
    except Exception as e:
        logger.error(f"brand_transformation error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# ============================================
# ТОЧКА ВХОДА
# ============================================
if __name__ == "__main__":
    logger.info("🚀 Запуск в режиме разработки")
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info", reload=False)

_lifespan_started = False


# ============================================
# 🪞 ЗЕРКАЛА — БАЗОВЫЕ ЭНДПОИНТЫ
# ============================================

@app.post("/api/mirrors/create")
async def create_mirror(request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        mirror_type = data.get("mirror_type", "web")
        if not user_id:
            return {"success": False, "error": "user_id обязателен"}
        import uuid as _uuid
        mirror_code = f"mirror_{_uuid.uuid4().hex[:12]}"
        web_base = os.environ.get("FREDI_WEB_BASE", "https://meysternlp.ru/fredi/")
        if not web_base.endswith("/"):
            web_base += "/"
        links = {
            "telegram": f"https://t.me/Nanotech_varik_bot?start={mirror_code}",
            "max": f"https://max.ru/id502238728185_bot?start={mirror_code}",
            "web": f"{web_base}?ref={mirror_code}"
        }
        link = links.get(mirror_type, links["web"])
        invite_texts = {
            "telegram": "Нашёл штуку которая определяет психологический профиль. У меня совпало на 90%. Интересно, у тебя тоже?",
            "max": "Есть одна штука. Определяет твой тип личности. У меня совпало на 90%. Интересно, у тебя тоже?",
            "web": "Нашёл интересный психологический тест. Он определил мой тип точнее чем что-либо раньше. Пройди — посмотрим насколько мы похожи?"
        }
        invite_text = invite_texts.get(mirror_type, invite_texts["web"])
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_users (user_id, created_at, updated_at, last_activity)
                VALUES ($1, NOW(), NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET last_activity = NOW()
            """, int(user_id))
            await conn.execute("""
                INSERT INTO fredi_mirrors (user_id, mirror_code, mirror_type, status, created_at)
                VALUES ($1, $2, $3, 'active', NOW())
            """, int(user_id), mirror_code, mirror_type)
        await log_event(int(user_id), "mirror_created", {"mirror_code": mirror_code, "mirror_type": mirror_type})
        return {"success": True, "mirror_code": mirror_code, "link": link, "invite_text": invite_text, "mirror_type": mirror_type}
    except Exception as e:
        logger.error(f"Ошибка создания зеркала: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/mirrors/{user_id}/reflections")
async def get_user_reflections(user_id: int):
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT m.mirror_code, m.mirror_type, m.friend_user_id, m.friend_name,
                       m.friend_profile_code, m.friend_vectors, m.friend_deep_patterns,
                       m.friend_ai_profile, m.friend_perception_type, m.friend_thinking_level,
                       m.completed_at, m.created_at,
                       c.name as context_name, c.city, c.age, c.gender
                FROM fredi_mirrors m
                LEFT JOIN fredi_user_contexts c ON c.user_id = m.friend_user_id
                WHERE m.user_id = $1 AND m.status = 'used'
                ORDER BY m.completed_at DESC
            """, user_id)
            
            reflections = []
            for row in rows:
                r = dict(row)
                
                # Используем настоящее имя: context > mirror > fallback
                real_name = r.pop("context_name", None)
                if real_name and real_name not in ('друг', 'Друг', None, ''):
                    r["friend_name"] = real_name
                elif not r.get("friend_name") or r["friend_name"] in ('Друг', 'друг'):
                    r["friend_name"] = f'Пользователь'
                
                # Добавляем контекст друга (город, возраст, пол)
                r["friend_context"] = {
                    "city": r.pop("city", None),
                    "age": r.pop("age", None),
                    "gender": r.pop("gender", None)
                }
                
                if r.get("completed_at"): 
                    r["completed_at"] = r["completed_at"].isoformat()
                if r.get("created_at"): 
                    r["created_at"] = r["created_at"].isoformat()
                    
                reflections.append(r)
                
            total = await conn.fetchval("SELECT COUNT(*) FROM fredi_mirrors WHERE user_id = $1", user_id)
            
        return {
            "success": True, 
            "reflections": reflections, 
            "stats": {
                "total_mirrors": total or 0, 
                "total_reflections": len(reflections)
            }
        }
    except Exception as e:
        logger.error(f"Ошибка получения отражений: {e}")
        return {"success": False, "reflections": [], "stats": {}}


@app.get("/api/mirrors/pending/{friend_user_id}")
async def get_pending_mirror(friend_user_id: int):
    """Возвращает mirror_code если для этого friend_user_id есть активное зеркало."""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT mirror_code FROM fredi_mirrors "
                "WHERE friend_user_id = $1 AND status = 'active' "
                "ORDER BY created_at DESC LIMIT 1",
                friend_user_id
            )
        if row:
            return {"mirror_code": row["mirror_code"]}
        return {"mirror_code": None}
    except Exception as e:
        logger.error(f"Pending mirror error: {e}")
        return {"mirror_code": None}


@app.get("/api/mirrors/{user_id}")
async def get_user_mirrors(user_id: int):
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT mirror_code, mirror_type, status, created_at,
                       friend_name, friend_profile_code, completed_at
                FROM fredi_mirrors WHERE user_id = $1 ORDER BY created_at DESC
            """, user_id)
            mirrors = []
            for row in rows:
                m = dict(row)
                if m.get("created_at"): m["created_at"] = m["created_at"].isoformat()
                if m.get("completed_at"): m["completed_at"] = m["completed_at"].isoformat()
                mirrors.append(m)
        used = len([m for m in mirrors if m["status"] == "used"])
        return {"success": True, "mirrors": mirrors, "stats": {"total_mirrors": len(mirrors), "used_mirrors": used}}
    except Exception as e:
        logger.error(f"Ошибка получения зеркал: {e}")
        return {"success": False, "mirrors": [], "stats": {}}


@app.post("/api/mirrors/register-friend")
async def register_mirror_friend(request: Request):
    """Привязывает friend_user_id к зеркалу сразу при /start в боте."""
    try:
        data = await request.json()
        mirror_code = data.get("mirror_code")
        friend_user_id = data.get("friend_user_id")
        friend_name = data.get("friend_name", "Друг")
        if not mirror_code or not friend_user_id:
            return {"success": False, "error": "mirror_code and friend_user_id required"}
        if not mirror_code.startswith("mirror_"):
            mirror_code = f"mirror_{mirror_code}"
        async with db.get_connection() as conn:
            result = await conn.execute(
                "UPDATE fredi_mirrors SET friend_user_id = $1, friend_name = $2 "
                "WHERE mirror_code = $3 AND status = 'active'",
                int(friend_user_id), friend_name, mirror_code
            )
        logger.info(f"🪞 Mirror friend registered: {mirror_code} -> {friend_user_id} ({friend_name})")
        return {"success": True}
    except Exception as e:
        logger.error(f"Register mirror friend error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/mirrors/complete")
async def complete_mirror(request: Request):
    try:
        data = await request.json()
        mirror_code = data.get("mirror_code")
        if not mirror_code:
            return {"success": False, "error": "mirror_code обязателен"}
        # Нормализация: фронт может прислать как "mirror_XXX", так и просто "XXX".
        # В БД хранится с префиксом — приводим к каноническому виду.
        if not mirror_code.startswith("mirror_"):
            mirror_code = f"mirror_{mirror_code}"
        friend_user_id = data.get("friend_user_id")
        friend_vectors = data.get("friend_vectors", {})
        friend_deep_patterns = data.get("friend_deep_patterns", {})
        async with db.get_connection() as conn:
            result = await conn.execute("""
                UPDATE fredi_mirrors SET
                    status = 'used', friend_user_id = $2, friend_name = $3,
                    friend_profile_code = $4, friend_vectors = $5, friend_deep_patterns = $6,
                    friend_ai_profile = $7, friend_perception_type = $8,
                    friend_thinking_level = $9, completed_at = NOW()
                WHERE mirror_code = $1 AND status = 'active'
            """,
                mirror_code,
                int(friend_user_id) if friend_user_id else None,
                data.get("friend_name", "Друг"),
                data.get("friend_profile_code"),
                json.dumps(friend_vectors) if isinstance(friend_vectors, dict) else friend_vectors,
                json.dumps(friend_deep_patterns) if isinstance(friend_deep_patterns, dict) else friend_deep_patterns,
                data.get("friend_ai_profile", ""),
                data.get("friend_perception_type"),
                int(data.get("friend_thinking_level")) if data.get("friend_thinking_level") else None
            )
            rows_updated = int(result.split()[-1]) if result else 0
            owner = await conn.fetchrow("SELECT user_id FROM fredi_mirrors WHERE mirror_code = $1", mirror_code)

        logger.info(f"🪞 Mirror complete: code={mirror_code}, rows_updated={rows_updated}, owner={owner['user_id'] if owner else 'N/A'}")

        if rows_updated == 0:
            return {"success": True, "activated": False, "message": "Зеркало не найдено или уже использовано"}

        if owner:
            await log_event(owner["user_id"], "mirror_completed", {"mirror_code": mirror_code})
            if push_service:
                friend_name = data.get("friend_name", "Друг")
                asyncio.create_task(push_service.notify_mirror_completed(owner["user_id"], friend_name))
        return {"success": True, "activated": True, "message": "Зеркало активировано"}
    except Exception as e:
        logger.error(f"Ошибка завершения зеркала: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# 🪞 ЗЕРКАЛА — ДОПОЛНИТЕЛЬНЫЙ ЭНДПОИНТ
# ============================================

@app.post("/api/mirrors/{mirror_code}/complete")
async def complete_mirror_by_url(mirror_code: str, request: Request):
    """Альтернативный эндпоинт с mirror_code в URL (для совместимости с test.js)"""
    try:
        data = await request.json()
        data["mirror_code"] = mirror_code
        # Вызываем существующую функцию complete_mirror
        return await complete_mirror(request)
    except Exception as e:
        logger.error(f"Ошибка в complete_mirror_by_url: {e}")
        return {"success": False, "error": str(e)}

def _build_profile_context(friend_data: dict) -> str:
    vectors = friend_data.get('friend_vectors') or {}
    deep = friend_data.get('friend_deep_patterns') or {}
    vector_names = {'СБ': 'Самооборона', 'ТФ': 'Финансы', 'УБ': 'Убеждения', 'ЧВ': 'Чувства'}
    vectors_text = ', '.join([f"{vector_names.get(k,k)}: {round(v,1)}/6" for k,v in vectors.items()]) if vectors else 'не определены'
    sb = round(vectors.get('СБ',3),1); tf = round(vectors.get('ТФ',3),1)
    ub = round(vectors.get('УБ',3),1); chv = round(vectors.get('ЧВ',3),1)
    sb_d = {1:'замирает',2:'избегает',3:'соглашается внешне',4:'внешне спокоен',5:'умеет защищать',6:'может атаковать'}.get(round(sb),'')
    tf_d = {1:'деньги как повезёт',2:'ищет возможности',3:'зарабатывает трудом',4:'хорошо зарабатывает',5:'создаёт системы',6:'управляет капиталом'}.get(round(tf),'')
    ub_d = {1:'не думает о сложном',2:'верит в знаки',3:'доверяет экспертам',4:'ищет заговоры',5:'анализирует факты',6:'строит теории'}.get(round(ub),'')
    chv_d = {1:'сильно привязывается',2:'подстраивается',3:'хочет нравиться',4:'умеет влиять',5:'строит партнёрства',6:'создаёт сообщества'}.get(round(chv),'')
    attachment = deep.get('attachment','не определён')
    fears = deep.get('core_fears',[])
    fears_text = ', '.join(fears) if isinstance(fears,list) and fears else str(fears) if fears else 'не определены'
    return f"""ПРОФИЛЬ ЧЕЛОВЕКА:
- Код: {friend_data.get('friend_profile_code','неизвестен')}
- Тип восприятия: {friend_data.get('friend_perception_type','не определён')}
- Уровень мышления: {friend_data.get('friend_thinking_level',5)}/9
- Векторы: {vectors_text}
- СБ {sb}/6: {sb_d}
- ТФ {tf}/6: {tf_d}
- УБ {ub}/6: {ub_d}
- ЧВ {chv}/6: {chv_d}
- Привязанность: {attachment}
- Страхи: {fears_text}"""


@app.get("/api/mirrors/{mirror_code}/intimate")
async def generate_intimate_profile(mirror_code: str):
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT friend_vectors, friend_deep_patterns, friend_profile_code,
                       friend_perception_type, friend_thinking_level, friend_ai_profile,
                       intimate_profile_cache
                FROM fredi_mirrors WHERE mirror_code = $1 AND status = 'used'
            """, mirror_code)
        if not row:
            return {"success": False, "error": "Зеркало не найдено или ещё не активировано"}
        if row.get('intimate_profile_cache'):
            cache_val = row['intimate_profile_cache']
            return {"success": True, "intimate": cache_val if isinstance(cache_val, dict) else json.loads(cache_val), "cached": True}
        friend_data = dict(row)
        if isinstance(friend_data.get('friend_vectors'), str):
            friend_data['friend_vectors'] = json.loads(friend_data['friend_vectors'])
        if isinstance(friend_data.get('friend_deep_patterns'), str):
            friend_data['friend_deep_patterns'] = json.loads(friend_data['friend_deep_patterns'])
        ctx = _build_profile_context(friend_data)
        system_prompt = "Ты психолог Фреди. Генерируй интимный профиль на основе данных. Отвечай ТОЛЬКО валидным JSON."
        user_prompt = f"""{ctx}

Ответь строго JSON:
{{
  "sexual_triggers": ["триггер 1","триггер 2","триггер 3"],
  "sexual_blockers": ["блокер 1","блокер 2","блокер 3"],
  "intimacy_pattern": "2-3 предложения о паттерне близости",
  "key_need": "главная потребность одним предложением",
  "approach_tip": "совет как подойти"
}}"""
        response = await ai_service._call_deepseek(system_prompt, user_prompt, max_tokens=800, temperature=0.7)
        clean = re.sub(r'```json|```', '', response).strip()
        intimate_data = json.loads(clean)
        async with db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_mirrors SET intimate_profile_cache=$1, intimate_generated_at=NOW()
                WHERE mirror_code=$2
            """, json.dumps(intimate_data, ensure_ascii=False), mirror_code)
        return {"success": True, "intimate": intimate_data, "cached": False}
    except json.JSONDecodeError:
        return {"success": False, "error": "Ошибка парсинга JSON"}
    except Exception as e:
        logger.error(f"Ошибка генерации интимного профиля: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/mirrors/{mirror_code}/4f-keys")
async def generate_4f_keys(mirror_code: str):
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT friend_vectors, friend_deep_patterns, friend_profile_code,
                       friend_perception_type, friend_thinking_level,
                       four_f_cache
                FROM fredi_mirrors WHERE mirror_code = $1 AND status = 'used'
            """, mirror_code)
        if not row:
            return {"success": False, "error": "Зеркало не найдено или ещё не активировано"}
        if row.get('four_f_cache'):
            cache_val = row['four_f_cache']
            return {"success": True, "keys": cache_val if isinstance(cache_val, dict) else json.loads(cache_val), "cached": True}
        friend_data = dict(row)
        if isinstance(friend_data.get('friend_vectors'), str):
            friend_data['friend_vectors'] = json.loads(friend_data['friend_vectors'])
        if isinstance(friend_data.get('friend_deep_patterns'), str):
            friend_data['friend_deep_patterns'] = json.loads(friend_data['friend_deep_patterns'])
        ctx = _build_profile_context(friend_data)
        system_prompt = "Ты психолог Фреди. Генерируй 4F ключи. Отвечай ТОЛЬКО валидным JSON."
        user_prompt = f"""{ctx}

Ответь строго JSON:
{{
  "1F": {{"title":"Ярость/Нападение","emoji":"🔥","triggers":["т1","т2","т3"],"key_phrase":"фраза","technique":"техника","insight":"инсайт"}},
  "2F": {{"title":"Страх/Бегство","emoji":"🏃","triggers":["т1","т2","т3"],"key_phrase":"фраза","technique":"техника","insight":"инсайт"}},
  "3F": {{"title":"Желание/Секс","emoji":"🧬","triggers":["т1","т2","т3"],"key_phrase":"фраза","technique":"техника","insight":"инсайт"}},
  "4F": {{"title":"Деньги/Поглощение","emoji":"🍽","triggers":["т1","т2","т3"],"key_phrase":"фраза","technique":"техника","insight":"инсайт"}}
}}"""
        response = await ai_service._call_deepseek(system_prompt, user_prompt, max_tokens=1200, temperature=0.7)
        clean = re.sub(r'```json|```', '', response).strip()
        keys_data = json.loads(clean)
        async with db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_mirrors SET four_f_cache=$1, four_f_generated_at=NOW()
                WHERE mirror_code=$2
            """, json.dumps(keys_data, ensure_ascii=False), mirror_code)
        return {"success": True, "keys": keys_data, "cached": False}
    except json.JSONDecodeError:
        return {"success": False, "error": "Ошибка парсинга JSON"}
    except Exception as e:
        logger.error(f"Ошибка генерации 4F ключей: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/mirrors/{mirror_code}/brief-profile")
async def generate_brief_profile(mirror_code: str):
    """Генерирует краткое описание профиля друга от третьего лица"""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT friend_name, friend_vectors, friend_deep_patterns,
                       friend_profile_code, friend_perception_type, 
                       friend_thinking_level, brief_profile_cache
                FROM fredi_mirrors WHERE mirror_code = $1 AND status = 'used'
            """, mirror_code)
        
        if not row:
            return {"success": False, "error": "Зеркало не найдено или ещё не активировано"}
        
        # Проверяем кэш
        if row.get('brief_profile_cache'):
            return {"success": True, "brief_profile": row['brief_profile_cache'], "cached": True}
        
        friend_data = dict(row)
        if isinstance(friend_data.get('friend_vectors'), str):
            friend_data['friend_vectors'] = json.loads(friend_data['friend_vectors'])
        if isinstance(friend_data.get('friend_deep_patterns'), str):
            friend_data['friend_deep_patterns'] = json.loads(friend_data['friend_deep_patterns'])
        
        name = friend_data.get('friend_name', 'Пользователь')
        vectors = friend_data.get('friend_vectors', {})
        sb = round(vectors.get('СБ', 4))
        tf = round(vectors.get('ТФ', 4))
        ub = round(vectors.get('УБ', 4))
        chv = round(vectors.get('ЧВ', 4))
        
        # Определяем пол (если есть в контексте, иначе по имени)
        gender = "Он"
        if name.endswith('а') or name.endswith('я'):
            gender = "Она"
        
        prompt = f"""Ты — психолог Фреди. Напиши КРАТКИЙ портрет человека (3-4 предложения) от третьего лица.

Данные:
- Имя: {name}
- Пол: {gender}
- Векторы: СБ={sb}/6, ТФ={tf}/6, УБ={ub}/6, ЧВ={chv}/6
- Тип восприятия: {friend_data.get('friend_perception_type', 'не определён')}
- Уровень мышления: {friend_data.get('friend_thinking_level', 5)}/9

ПРАВИЛА:
- Пиши от третьего лица ({gender})
- Только 3-4 предложения
- Без приветствий и подписей
- Без эмодзи
- Просто факты о личности

Пример для мужчины:
«Андрей — человек действия. Он ценит конкретные результаты и четкие инструкции. Его сильная сторона — уверенность в конфликтах и аналитическое мышление.»

Пример для женщины:
«Екатерина — человек отношений. Она тонко чувствует эмоции других и умеет создавать гармонию. Её сильная сторона — эмпатия и умение договариваться.»"""

        response = await ai_service._call_deepseek(
            system_prompt="Ты психолог. Пиши кратко, по делу, от третьего лица. Без лишних слов.",
            user_prompt=prompt,
            max_tokens=300,
            temperature=0.7
        )
        
        brief_profile = response.strip()
        
        # Сохраняем в кэш
        async with db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_mirrors SET brief_profile_cache = $1
                WHERE mirror_code = $2
            """, brief_profile, mirror_code)
        
        return {"success": True, "brief_profile": brief_profile, "cached": False}
        
    except Exception as e:
        logger.error(f"Ошибка генерации краткого профиля: {e}")
        return {"success": False, "error": str(e)}


async def _force_lifespan():
    global _lifespan_started
    if _lifespan_started:
        return
    logger.info("🔄 Принудительный запуск lifespan...")
    try:
        async with lifespan(app):
            _lifespan_started = True
            logger.info("✅ Lifespan успешно запущен")
            await asyncio.Event().wait()
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске lifespan: {e}")


@app.post("/api/ai/generate")
async def ai_generate(request: Request):
    data = await request.json()
    prompt = data.get("prompt")
    user_id = data.get("user_id")
    max_tokens = data.get("max_tokens", 200)
    temperature = data.get("temperature", 0.7)
    
    # Вызов AI сервиса
    response = await ai_service.generate(prompt, max_tokens, temperature)
    return {"success": True, "content": response}

if __name__ != "__main__":
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_force_lifespan())
        else:
            loop.run_until_complete(_force_lifespan())
    except RuntimeError:
        asyncio.run(_force_lifespan())

application = app
