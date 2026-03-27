# backend/main.py
"""
Фреди - Виртуальный психолог
Асинхронный API сервер на FastAPI
"""

import os
import sys
import asyncio
import logging
import time
import json
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
import signal

from fastapi import FastAPI, Request, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field
import uvicorn

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Импорты наших модулей
from db import Database
from cache import RedisCache
from services.ai_service import AIService
from services.voice_service import VoiceService
from services.weather_service import WeatherService
from repositories.user_repo import UserRepository
from repositories.context_repo import ContextRepository
from repositories.message_repo import MessageRepository
from models import (
    UserProfile, UserContext, Message, ChatRequest,
    VoiceRequest, VoiceResponse, SaveContextRequest,
    HealthResponse, ErrorResponse
)

# ============================================
# ГЛОБАЛЬНЫЕ ОБЪЕКТЫ (инициализируются в lifespan)
# ============================================
db: Optional[Database] = None
cache: Optional[RedisCache] = None
ai_service: Optional[AIService] = None
voice_service: Optional[VoiceService] = None
weather_service: Optional[WeatherService] = None
user_repo: Optional[UserRepository] = None
context_repo: Optional[ContextRepository] = None
message_repo: Optional[MessageRepository] = None

# ============================================
# RATE LIMITING
# ============================================
limiter = Limiter(key_func=get_remote_address)

# ============================================
# LIFESPAN (Управление жизненным циклом)
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global db, cache, ai_service, voice_service, weather_service
    global user_repo, context_repo, message_repo
    
    # ========== STARTUP ==========
    logger.info("=" * 60)
    logger.info("🚀 ЗАПУСК ПРИЛОЖЕНИЯ ФРЕДИ")
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
        logger.info("✅ Сервисы готовы")
        
        # 5. Создаем таблицы
        logger.info("📦 Проверка и создание таблиц...")
        await init_database_tables()
        logger.info("✅ Таблицы готовы")
        
        # 6. Запускаем фоновые задачи
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
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fredi-frontend.onrender.com",
        "https://fredi-app.onrender.com",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:10000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================
# MIDDLEWARE: Логирование запросов
# ============================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирование всех HTTP запросов"""
    start_time = time.time()
    
    # Логируем входящий запрос
    logger.debug(f"→ {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        
        # Вычисляем длительность
        duration = time.time() - start_time
        
        # Логируем ответ
        logger.info(
            f"{request.method} {request.url.path} "
            f"status={response.status_code} "
            f"duration={duration:.3f}s"
        )
        
        # Добавляем заголовок с длительностью
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
        
        # ========== ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ==========
        
        # Индексы для messages
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_user_id_created 
            ON messages(user_id, created_at DESC)
        """)
        
        # Индексы для events
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_user_id 
            ON events(user_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_events_type 
            ON events(event_type, created_at DESC)
        """)
        
        # Индексы для test_results
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_results_user_id 
            ON test_results(user_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_results_profile 
            ON test_results(profile_code) WHERE profile_code IS NOT NULL
        """)
        
        # Индексы для reminders
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_reminders_pending 
            ON reminders(remind_at) WHERE is_sent = FALSE
        """)
        
        # Индексы для weekend_ideas_cache
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_weekend_cache_expires 
            ON weekend_ideas_cache(expires_at)
        """)
        
        # Индексы для users
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
            await asyncio.sleep(3600)  # 1 час
            
            async with db.get_connection() as conn:
                # Удаляем сообщения старше 30 дней
                deleted_messages = await conn.execute("""
                    DELETE FROM messages 
                    WHERE created_at < NOW() - INTERVAL '30 days'
                """)
                
                # Удаляем события старше 30 дней
                deleted_events = await conn.execute("""
                    DELETE FROM events 
                    WHERE created_at < NOW() - INTERVAL '30 days'
                """)
                
                # Удаляем просроченный кэш
                deleted_cache = await conn.execute("""
                    DELETE FROM weekend_ideas_cache 
                    WHERE expires_at < NOW()
                """)
                
                # Деактивируем неактивных пользователей
                deactivated = await conn.execute("""
                    UPDATE users 
                    SET is_active = FALSE 
                    WHERE last_activity < NOW() - INTERVAL '90 days' 
                    AND is_active = TRUE
                """)
                
                if deleted_messages or deleted_events or deleted_cache or deactivated:
                    logger.info(
                        f"🧹 Cleanup: {deleted_messages} messages, "
                        f"{deleted_events} events, {deleted_cache} cache, "
                        f"{deactivated} users deactivated"
                    )
                    
        except asyncio.CancelledError:
            logger.info("Cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Cleanup error: {e}")

async def send_reminders():
    """Отправка отложенных напоминаний"""
    while True:
        try:
            await asyncio.sleep(60)  # Каждую минуту
            
            async with db.get_connection() as conn:
                # Получаем напоминания, которые пора отправлять
                reminders = await conn.fetch("""
                    SELECT * FROM reminders 
                    WHERE is_sent = FALSE 
                    AND remind_at <= NOW()
                    LIMIT 100
                """)
                
                for reminder in reminders:
                    try:
                        # Отправляем уведомление (здесь может быть push, email и т.д.)
                        logger.info(f"📬 Sending reminder {reminder['id']} to user {reminder['user_id']}")
                        
                        # Отмечаем как отправленное
                        await conn.execute("""
                            UPDATE reminders 
                            SET is_sent = TRUE, sent_at = NOW() 
                            WHERE id = $1
                        """, reminder['id'])
                        
                    except Exception as e:
                        logger.error(f"Failed to send reminder {reminder['id']}: {e}")
                        
        except asyncio.CancelledError:
            logger.info("Reminders task cancelled")
            break
        except Exception as e:
            logger.error(f"Reminders error: {e}")

async def update_metrics():
    """Обновление метрик (каждые 5 минут)"""
    while True:
        try:
            await asyncio.sleep(300)  # 5 минут
            
            async with db.get_connection() as conn:
                # Считаем активных пользователей за последние 24 часа
                active_24h = await conn.fetchval("""
                    SELECT COUNT(DISTINCT user_id) 
                    FROM events 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                """)
                
                # Считаем сообщения за последний час
                messages_1h = await conn.fetchval("""
                    SELECT COUNT(*) 
                    FROM messages 
                    WHERE created_at > NOW() - INTERVAL '1 hour'
                """)
                
                # Считаем новые тесты
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
            logger.info("Metrics task cancelled")
            break
        except Exception as e:
            logger.error(f"Metrics error: {e}")

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

class VoiceProcessRequest(BaseModel):
    user_id: int

class VoiceProcessResponse(BaseModel):
    success: bool
    recognized_text: Optional[str] = None
    answer: Optional[str] = None
    audio_base64: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, Any]

# ============================================
# HEALTH CHECK
# ============================================
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check для Render"""
    status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": False,
            "redis": False,
            "ai_service": False
        }
    }
    
    # Проверка БД
    if db:
        try:
            async with db.get_connection() as conn:
                await conn.execute("SELECT 1")
            status["services"]["database"] = True
        except Exception as e:
            logger.error(f"DB health check failed: {e}")
            status["services"]["database"] = False
            status["status"] = "degraded"
    
    # Проверка Redis
    if cache and cache.is_connected:
        try:
            await cache.redis.ping()
            status["services"]["redis"] = True
        except Exception:
            status["services"]["redis"] = False
    
    # Проверка AI сервиса
    if ai_service and ai_service.api_key:
        status["services"]["ai_service"] = True
    
    # Общий статус
    if not status["services"]["database"]:
        status["status"] = "unhealthy"
        return JSONResponse(status_code=503, content=status)
    
    return status

@app.get("/health/detailed")
async def health_check_detailed():
    """Детальный health check для отладки"""
    if not db:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "Database not initialized"}
        )
    
    try:
        async with db.get_connection() as conn:
            # Проверяем количество таблиц
            tables = await conn.fetch("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename LIKE 'fredi_%'
            """)
            
            # Проверяем размер БД
            db_size = await conn.fetchval("""
                SELECT pg_database_size(current_database())
            """)
            
            # Проверяем активные соединения
            connections = await conn.fetchval("""
                SELECT COUNT(*) FROM pg_stat_activity
            """)
            
        return {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "connected": True,
                "tables_count": len(tables),
                "size_mb": round(db_size / 1024 / 1024, 2),
                "active_connections": connections
            },
            "redis": {
                "connected": cache.is_connected if cache else False
            },
            "environment": os.environ.get("ENVIRONMENT", "development")
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": str(e)}
        )

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
        
        # Логируем событие
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
        
        # Логируем событие
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
        return {"success": True, "profile": profile}
        
    except Exception as e:
        logger.error(f"Error getting profile for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-profile-interpretation/{user_id}")
@limiter.limit("30/minute")
async def get_profile_interpretation(request: Request, user_id: int):
    """Получить интерпретацию профиля (мысли психолога)"""
    try:
        # Пытаемся получить из кэша
        cache_key = f"profile_interpretation:{user_id}"
        interpretation = await cache.get(cache_key) if cache else None
        
        if not interpretation:
            # Генерируем новую интерпретацию
            profile = await user_repo.get_profile(user_id)
            if profile:
                interpretation = await ai_service.generate_profile_interpretation(user_id, profile)
                if cache:
                    await cache.set(cache_key, interpretation, ttl=86400)  # 24 часа
        
        return {"success": True, "interpretation": interpretation}
        
    except Exception as e:
        logger.error(f"Error getting interpretation for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ЧАТ ----------
@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, data: ChatRequest):
    """Текстовый чат с Фреди"""
    try:
        # Получаем контекст и профиль
        context = await context_repo.get(data.user_id)
        profile = await user_repo.get_profile(data.user_id)
        
        # Генерируем ответ
        response = await ai_service.generate_response(
            user_id=data.user_id,
            message=data.message,
            context=context,
            profile=profile,
            mode=data.mode
        )
        
        # Сохраняем сообщения
        await message_repo.save(data.user_id, "user", data.message)
        await message_repo.save(data.user_id, "assistant", response)
        
        # Логируем событие
        await log_event(data.user_id, "chat", {"mode": data.mode, "message_length": len(data.message)})
        
        return {"success": True, "response": response}
        
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

# ---------- ГОЛОС ----------
@app.post("/api/voice/process")
@limiter.limit("10/minute")
async def process_voice(
    request: Request,
    user_id: int = Form(...),
    voice: UploadFile = File(...)
):
    """Обработка голосового сообщения (STT + AI + TTS)"""
    try:
        # Читаем аудио файл
        audio_bytes = await voice.read()
        
        if len(audio_bytes) < 1000:
            return VoiceProcessResponse(
                success=False,
                error="Аудио файл слишком короткий"
            )
        
        # 1. STT: распознаем речь
        recognized_text = await voice_service.speech_to_text(audio_bytes)
        
        if not recognized_text:
            return VoiceProcessResponse(
                success=False,
                error="Не удалось распознать речь"
            )
        
        # 2. Получаем контекст и профиль
        context = await context_repo.get(user_id)
        profile = await user_repo.get_profile(user_id)
        
        # 3. AI: генерируем ответ
        response = await ai_service.generate_response(
            user_id=user_id,
            message=recognized_text,
            context=context,
            profile=profile,
            mode="psychologist"
        )
        
        # 4. TTS: озвучиваем ответ
        audio_response = await voice_service.text_to_speech(response)
        
        # 5. Сохраняем сообщения
        await message_repo.save(user_id, "user", recognized_text, {"voice": True})
        await message_repo.save(user_id, "assistant", response, {"voice": True})
        
        # Логируем событие
        await log_event(user_id, "voice", {"text_length": len(recognized_text)})
        
        return VoiceProcessResponse(
            success=True,
            recognized_text=recognized_text,
            answer=response,
            audio_base64=audio_response
        )
        
    except Exception as e:
        logger.error(f"Error processing voice for user {user_id}: {e}")
        return VoiceProcessResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/voice/tts")
@limiter.limit("30/minute")
async def text_to_speech_endpoint(request: Request, text: str = Form(...), mode: str = Form("psychologist")):
    """Преобразование текста в речь (TTS)"""
    try:
        audio = await voice_service.text_to_speech(text, mode)
        return Response(content=audio, media_type="audio/ogg")
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ПОГОДА ----------
@app.get("/api/weather/{user_id}")
@limiter.limit("30/minute")
async def get_weather(request: Request, user_id: int):
    """Получить погоду для пользователя"""
    try:
        context = await context_repo.get(user_id)
        city = context.get("city") if context else None
        
        if not city:
            return {"success": False, "error": "Город не указан"}
        
        weather = await weather_service.get_weather(city)
        return {"success": True, "weather": weather}
        
    except Exception as e:
        logger.error(f"Error getting weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ИДЕИ НА ВЫХОДНЫЕ ----------
@app.get("/api/ideas/{user_id}")
@limiter.limit("10/minute")
async def get_weekend_ideas(request: Request, user_id: int):
    """Получить идеи на выходные"""
    try:
        # Проверяем кэш
        cache_key = f"weekend_ideas:{user_id}"
        cached = await cache.get(cache_key) if cache else None
        
        if cached:
            return {"success": True, "ideas": cached}
        
        # Получаем профиль и контекст
        profile = await user_repo.get_profile(user_id)
        context = await context_repo.get(user_id)
        
        # Генерируем идеи
        ideas = await ai_service.generate_weekend_ideas(user_id, profile, context)
        
        # Сохраняем в кэш
        if cache:
            await cache.set(cache_key, ideas, ttl=3600)  # 1 час
        
        return {"success": True, "ideas": ideas}
        
    except Exception as e:
        logger.error(f"Error getting weekend ideas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ЦЕЛИ ----------
@app.get("/api/goals/{user_id}")
@limiter.limit("20/minute")
async def get_goals(request: Request, user_id: int, mode: str = "coach"):
    """Получить персональные цели"""
    try:
        profile = await user_repo.get_profile(user_id)
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
        profile = await user_repo.get_profile(user_id)
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
            # Генерируем новую мысль
            profile = await user_repo.get_profile(user_id)
            if profile:
                thought = await ai_service.generate_psychologist_thought(user_id, profile)
                await user_repo.save_psychologist_thought(user_id, thought)
        
        return {"success": True, "thought": thought}
        
    except Exception as e:
        logger.error(f"Error getting psychologist thought: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- СТАТИСТИКА ----------
@app.get("/api/stats/{user_id}")
@limiter.limit("10/minute")
async def get_user_stats(request: Request, user_id: int):
    """Получить статистику пользователя"""
    try:
        async with db.get_connection() as conn:
            # Количество сообщений
            messages_count = await conn.fetchval("""
                SELECT COUNT(*) FROM messages WHERE user_id = $1
            """, user_id)
            
            # Количество сессий (группируем по часам)
            sessions = await conn.fetchval("""
                SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at))
                FROM messages WHERE user_id = $1
            """, user_id)
            
            # Активность за последние 7 дней
            weekly_activity = await conn.fetch("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM messages
                WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """, user_id)
            
            # Результаты тестов
            test_results = await conn.fetch("""
                SELECT test_type, profile_code, created_at
                FROM test_results
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            """, user_id)
        
        return {
            "success": True,
            "stats": {
                "total_messages": messages_count,
                "total_sessions": sessions,
                "weekly_activity": [dict(row) for row in weekly_activity],
                "test_results": [dict(row) for row in test_results]
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- НАПОМИНАНИЯ ----------
@app.post("/api/reminder")
@limiter.limit("10/minute")
async def create_reminder(request: Request, user_id: int = Form(...), reminder_type: str = Form(...), remind_at: str = Form(...)):
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
    """Статистика для администратора (требует проверки)"""
    # TODO: Добавить проверку ADMIN_IDS
    try:
        async with db.get_connection() as conn:
            # Общая статистика
            total_users = await conn.fetchval("SELECT COUNT(*) FROM users")
            active_today = await conn.fetchval("""
                SELECT COUNT(DISTINCT user_id) FROM events 
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)
            total_messages = await conn.fetchval("SELECT COUNT(*) FROM messages")
            total_tests = await conn.fetchval("SELECT COUNT(*) FROM test_results")
            
            # Статистика по режимам
            modes_stats = await conn.fetch("""
                SELECT data->>'mode' as mode, COUNT(*) as count
                FROM user_contexts
                WHERE context->>'communication_mode' IS NOT NULL
                GROUP BY data->>'mode'
            """)
            
        return {
            "total_users": total_users,
            "active_today": active_today,
            "total_messages": total_messages,
            "total_tests": total_tests,
            "modes_distribution": [dict(row) for row in modes_stats]
        }
        
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
async def log_event(user_id: int, event_type: str, event_data: Dict = None):
    """Логирование события"""
    try:
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO events (user_id, event_type, event_data)
                VALUES ($1, $2, $3)
            """, user_id, event_type, json.dumps(event_data) if event_data else None)
    except Exception as e:
        logger.error(f"Error logging event: {e}")

# ============================================
# ЗАПУСК ПРИЛОЖЕНИЯ (для локальной разработки)
# ============================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
