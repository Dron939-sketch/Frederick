"""
test_routes.py — API для модуля 5-этапного теста.

Endpoints:
  GET  /api/test/interpretations
    Возвращает JSON со всеми интерпретациями для этапов 1-5 теста.
    Фронт грузит один раз при старте теста, дальше использует локально.
    Источник правды: backend/data/test_interpretations.json

  POST /api/test/feedback
    Логирует выбор пользователя на этапе 4 («✅ ДА / ❓ ЕСТЬ СОМНЕНИЯ»)
    с привязкой к его профилю. Через несколько недель агрегированные
    данные показывают, какие комбинации профиля чаще получают «не моё» —
    это карта слабых формулировок интерпретации, материал для будущих
    правок JSON.
"""

import json
import logging
import os
from datetime import datetime, timezone
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# Кэш интерпретаций. Файл небольшой (~30KB), грузим один раз при первом
# запросе, держим в памяти до рестарта приложения.
_INTERPRETATIONS_CACHE = None


def _load_interpretations():
    """Загружает интерпретации этапов теста из data/test_interpretations.json."""
    global _INTERPRETATIONS_CACHE
    if _INTERPRETATIONS_CACHE is not None:
        return _INTERPRETATIONS_CACHE
    path = os.path.join(os.path.dirname(__file__), "data", "test_interpretations.json")
    if not os.path.exists(path):
        logger.error(f"test_interpretations.json not found at {path}")
        _INTERPRETATIONS_CACHE = {}
        return _INTERPRETATIONS_CACHE
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _INTERPRETATIONS_CACHE = data
        logger.info(f"✅ test_interpretations loaded (version {data.get('_version', '?')})")
    except Exception as e:
        logger.error(f"Failed to load test_interpretations.json: {e}")
        _INTERPRETATIONS_CACHE = {}
    return _INTERPRETATIONS_CACHE


def register_test_routes(app, db=None, limiter=None):
    """Регистрирует роуты модуля теста."""

    @app.get("/api/test/interpretations")
    async def get_test_interpretations():
        """Возвращает все интерпретации этапов 1-5 одним JSON.

        Фронт кэширует результат на сессию теста; сервер кэширует
        в памяти до рестарта.
        """
        data = _load_interpretations()
        if not data:
            raise HTTPException(status_code=500, detail="Interpretations not loaded")
        return data

    @app.post("/api/test/feedback")
    async def post_test_feedback(request: Request):
        """Логирует отзыв пользователя об интерпретации на этапе 4.

        Принимает: user_id, stage, response ('yes'|'doubt'|'no'),
        profile (snapshot ключевых полей профиля), timestamp.

        Хранит в таблице fredi_test_feedback. Аналитика читает
        агрегаты позже (отдельным эндпоинтом или вручную через SQL).
        """
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON")

        user_id = body.get("user_id")
        stage = body.get("stage")
        response = body.get("response")
        profile = body.get("profile") or {}

        if not user_id or stage is None or response not in ("yes", "doubt", "no"):
            raise HTTPException(status_code=400, detail="user_id, stage, response required")

        if db is None:
            logger.warning("test/feedback called but db is None — skip logging")
            return {"status": "skipped", "reason": "no_db"}

        try:
            async with db.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO fredi_test_feedback
                    (user_id, stage, response, profile, created_at)
                    VALUES ($1, $2, $3, $4::jsonb, $5)
                    """,
                    int(user_id), int(stage), response,
                    json.dumps(profile, ensure_ascii=False),
                    datetime.now(timezone.utc)
                )
            return {"status": "ok"}
        except Exception as e:
            logger.error(f"Failed to log test feedback: {e}")
            return {"status": "error", "detail": str(e)}

    async def init_test_routes():
        """Прогрев кэша + создание таблицы fredi_test_feedback при старте."""
        _load_interpretations()
        if db is None:
            return
        try:
            async with db.get_connection() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS fredi_test_feedback (
                        id          SERIAL PRIMARY KEY,
                        user_id     BIGINT NOT NULL,
                        stage       INT NOT NULL,
                        response    TEXT NOT NULL,
                        profile     JSONB,
                        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_fredi_test_feedback_user
                    ON fredi_test_feedback(user_id)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_fredi_test_feedback_response
                    ON fredi_test_feedback(response, stage)
                """)
            logger.info("✅ fredi_test_feedback table ready")
        except Exception as e:
            logger.error(f"Failed to init fredi_test_feedback table: {e}")

    return init_test_routes
