"""
skill_plan_routes.py — API для модуля выбора навыка (21-дневный план).

Endpoints:
  POST   /api/skill-plan                       — создать/обновить план для пользователя
  GET    /api/skill-plan/{user_id}             — получить план пользователя
  POST   /api/skill-plan/{user_id}/day-done    — отметить день выполненным
  POST   /api/skill-plan/{user_id}/day-undone  — снять отметку с дня
  POST   /api/skill-plan/{user_id}/settings    — обновить канал/время/режим
  DELETE /api/skill-plan/{user_id}             — удалить план (новый навык)

Таблица fredi_skill_plans создаётся автоматически на старте приложения.
"""

import json
import logging
from datetime import datetime, timezone
from fastapi import Request

logger = logging.getLogger(__name__)


def register_skill_plan_routes(app, db, limiter):
    """Регистрирует роуты модуля skill_plan и возвращает init-функцию для миграции."""

    async def init_skill_plan_tables():
        """Создаёт таблицу fredi_skill_plans, если её нет."""
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_skill_plans (
                    user_id            BIGINT PRIMARY KEY,
                    skill_id           TEXT,
                    skill_name         TEXT,
                    skill_desc         TEXT,
                    skill_long_desc    TEXT,
                    skill_promise      TEXT,
                    plan               JSONB,
                    days_done          JSONB DEFAULT '[]'::jsonb,
                    started_at         TIMESTAMP WITH TIME ZONE,
                    channel            TEXT,
                    notify_time        TEXT DEFAULT '09:00',
                    mode               TEXT DEFAULT 'calm',
                    telegram_chat_id   BIGINT,
                    email              TEXT,
                    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            try:
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_skill_plans_notify "
                    "ON fredi_skill_plans(channel, notify_time) "
                    "WHERE channel IS NOT NULL AND channel <> 'none'"
                )
            except Exception:
                pass
        logger.info("Skill plan tables ready")

    @app.post("/api/skill-plan")
    @limiter.limit("30/minute")
    async def save_skill_plan(request: Request):
        """Создать или обновить план пользователя.

        Body: {
            user_id, skill_id, skill_name, skill_desc, skill_long_desc, skill_promise,
            plan (object), channel, notify_time, mode, started_at (ISO string),
            email (optional)
        }
        """
        try:
            data = await request.json()
            user_id = data.get("user_id")
            if not user_id:
                return {"success": False, "error": "user_id required"}

            started_at = data.get("started_at")
            started_at_dt = None
            if started_at:
                try:
                    started_at_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                except Exception:
                    started_at_dt = datetime.now(timezone.utc)
            else:
                started_at_dt = datetime.now(timezone.utc)

            plan_json = json.dumps(data.get("plan") or {})

            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_skill_plans (
                        user_id, skill_id, skill_name, skill_desc, skill_long_desc,
                        skill_promise, plan, days_done, started_at, channel, notify_time,
                        mode, email, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, '[]'::jsonb,
                              $8, $9, $10, $11, $12, NOW(), NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        skill_id        = EXCLUDED.skill_id,
                        skill_name      = EXCLUDED.skill_name,
                        skill_desc      = EXCLUDED.skill_desc,
                        skill_long_desc = EXCLUDED.skill_long_desc,
                        skill_promise   = EXCLUDED.skill_promise,
                        plan            = EXCLUDED.plan,
                        days_done       = '[]'::jsonb,
                        started_at      = EXCLUDED.started_at,
                        channel         = EXCLUDED.channel,
                        notify_time     = EXCLUDED.notify_time,
                        mode            = EXCLUDED.mode,
                        email           = COALESCE(EXCLUDED.email, fredi_skill_plans.email),
                        updated_at      = NOW()
                """,
                    int(user_id),
                    data.get("skill_id"),
                    data.get("skill_name"),
                    data.get("skill_desc"),
                    data.get("skill_long_desc"),
                    data.get("skill_promise"),
                    plan_json,
                    started_at_dt,
                    data.get("channel"),
                    data.get("notify_time") or "09:00",
                    data.get("mode") or "calm",
                    data.get("email"),
                )

            return {"success": True}

        except Exception as e:
            logger.error(f"save_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/skill-plan/{user_id}")
    @limiter.limit("60/minute")
    async def get_skill_plan(request: Request, user_id: int):
        """Получить план пользователя или null, если его нет."""
        try:
            row = await db.fetchrow(
                "SELECT * FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            if not row:
                return {"success": True, "plan": None}

            plan_data = row["plan"]
            if isinstance(plan_data, str):
                try:
                    plan_data = json.loads(plan_data)
                except Exception:
                    plan_data = None

            days_done = row["days_done"]
            if isinstance(days_done, str):
                try:
                    days_done = json.loads(days_done)
                except Exception:
                    days_done = []

            return {
                "success": True,
                "plan": {
                    "skill_id":         row["skill_id"],
                    "skill_name":       row["skill_name"],
                    "skill_desc":       row["skill_desc"],
                    "skill_long_desc":  row["skill_long_desc"],
                    "skill_promise":    row["skill_promise"],
                    "plan":             plan_data,
                    "days_done":        days_done or [],
                    "started_at":       row["started_at"].isoformat() if row["started_at"] else None,
                    "channel":          row["channel"],
                    "notify_time":      row["notify_time"],
                    "mode":             row["mode"],
                    "telegram_chat_id": row["telegram_chat_id"],
                    "email":            row["email"],
                }
            }
        except Exception as e:
            logger.error(f"get_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/day-done")
    @limiter.limit("60/minute")
    async def mark_day_done(request: Request, user_id: int):
        """Отметить день выполненным. Body: {day: int}."""
        try:
            data = await request.json()
            day = int(data.get("day", 0))
            if day < 1 or day > 21:
                return {"success": False, "error": "day must be 1..21"}

            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT days_done FROM fredi_skill_plans WHERE user_id = $1", user_id
                )
                if not row:
                    return {"success": False, "error": "plan not found"}
                days = row["days_done"] or []
                if isinstance(days, str):
                    days = json.loads(days)
                if day not in days:
                    days.append(day)
                    days = sorted(set(days))
                    await conn.execute(
                        "UPDATE fredi_skill_plans SET days_done = $1::jsonb, updated_at = NOW() "
                        "WHERE user_id = $2",
                        json.dumps(days), user_id
                    )
            return {"success": True, "days_done": days}
        except Exception as e:
            logger.error(f"mark_day_done error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/day-undone")
    @limiter.limit("60/minute")
    async def unmark_day(request: Request, user_id: int):
        """Снять отметку с дня. Body: {day: int}."""
        try:
            data = await request.json()
            day = int(data.get("day", 0))
            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT days_done FROM fredi_skill_plans WHERE user_id = $1", user_id
                )
                if not row:
                    return {"success": False, "error": "plan not found"}
                days = row["days_done"] or []
                if isinstance(days, str):
                    days = json.loads(days)
                days = [d for d in days if d != day]
                await conn.execute(
                    "UPDATE fredi_skill_plans SET days_done = $1::jsonb, updated_at = NOW() "
                    "WHERE user_id = $2",
                    json.dumps(days), user_id
                )
            return {"success": True, "days_done": days}
        except Exception as e:
            logger.error(f"unmark_day error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/skill-plan/{user_id}/settings")
    @limiter.limit("30/minute")
    async def update_settings(request: Request, user_id: int):
        """Обновить канал/время/режим. Body: {channel, notify_time, mode, email}."""
        try:
            data = await request.json()
            async with db.get_connection() as conn:
                # Обновляем только переданные поля
                fields = []
                values = []
                idx = 1
                for key in ("channel", "notify_time", "mode", "email"):
                    if key in data:
                        fields.append(f"{key} = ${idx}")
                        values.append(data[key])
                        idx += 1
                if not fields:
                    return {"success": False, "error": "no fields to update"}
                fields.append("updated_at = NOW()")
                values.append(user_id)
                query = f"UPDATE fredi_skill_plans SET {', '.join(fields)} WHERE user_id = ${idx}"
                result = await conn.execute(query, *values)
                if result.endswith(" 0"):
                    return {"success": False, "error": "plan not found"}
            return {"success": True}
        except Exception as e:
            logger.error(f"update_settings error: {e}")
            return {"success": False, "error": str(e)}

    @app.delete("/api/skill-plan/{user_id}")
    @limiter.limit("10/minute")
    async def delete_skill_plan(request: Request, user_id: int):
        """Удалить план — пользователь хочет начать новый навык."""
        try:
            await db.execute(
                "DELETE FROM fredi_skill_plans WHERE user_id = $1", user_id
            )
            return {"success": True}
        except Exception as e:
            logger.error(f"delete_skill_plan error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/skill-plan/{user_id}/link-status")
    @limiter.limit("60/minute")
    async def get_link_status(request: Request, user_id: int):
        """Возвращает {telegram: bool, max: bool} — какие мессенджеры привязаны."""
        try:
            from services.skill_notify import get_link_status as _gls
            status = await _gls(db, user_id)
            return {"success": True, **status}
        except Exception as e:
            logger.error(f"link-status error: {e}")
            return {"success": False, "telegram": False, "max": False}

    @app.post("/api/skill-plan/{user_id}/test-send")
    @limiter.limit("6/minute")
    async def test_send(request: Request, user_id: int):
        """Отправляет тестовое сообщение в выбранный канал."""
        try:
            from services.skill_notify import send_test_message
            result = await send_test_message(db, user_id)
            return result
        except Exception as e:
            logger.error(f"test_send error: {e}")
            return {"success": False, "error": str(e)}

    return init_skill_plan_tables
