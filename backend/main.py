# backend/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncpg
import os
import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Глобальные переменные
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db_pool
    logger.info("🚀 Starting application...")
    
    # Подключаемся к БД
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        try:
            db_pool = await asyncpg.create_pool(
                database_url,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            # Проверяем соединение
            async with db_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            logger.info("✅ PostgreSQL connected")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            db_pool = None
    
    yield
    
    # Shutdown
    if db_pool:
        await db_pool.close()
        logger.info("🔌 Database pool closed")

app = FastAPI(
    title="Фреди API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене ограничить
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    """Health check для Render"""
    db_status = "ok" if db_pool else "disconnected"
    return {
        "status": "healthy" if db_pool else "degraded",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }

# Тестовый эндпоинт
@app.get("/api/ping")
async def ping():
    return {"pong": True, "db": db_pool is not None}

# Эндпоинт для сохранения контекста
@app.post("/api/save-context")
async def save_context(request: Request):
    try:
        data = await request.json()
        user_id = data.get('user_id')
        context = data.get('context', {})
        
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "user_id required"}
            )
        
        # Здесь будет сохранение в БД
        if db_pool:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO user_contexts (user_id, data, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        data = $2,
                        updated_at = NOW()
                """, user_id, context)
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Другие эндпоинты...
