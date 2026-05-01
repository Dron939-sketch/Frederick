"""
meter_routes.py — Subscription meter + UserMemory init.
"""

import asyncio
import logging
from fastapi import Request
from subscription_meter import SubscriptionMeter
from services.user_memory import get_user_memory

logger = logging.getLogger(__name__)

subscription_meter = None


def register_meter_routes(app, db, limiter):
    global subscription_meter
    subscription_meter = SubscriptionMeter(db)
    logger.info("SubscriptionMeter initialized")

    # Init UserMemory singleton with db
    memory = get_user_memory(db)
    logger.info("UserMemory initialized")

    async def init_meter_tables():
        # Meter columns
        async with db.get_connection() as conn:
            for col, coltype, default in [
                ("trial_started_at", "TIMESTAMP WITH TIME ZONE", "NOW()"),
                ("free_session_count", "INTEGER", "0"),
                ("daily_usage_seconds", "INTEGER", "0"),
                ("last_usage_reset", "DATE", "CURRENT_DATE"),
                ("last_cooldown_started_at", "TIMESTAMP WITH TIME ZONE", None),
                ("cooldown_ends_at", "TIMESTAMP WITH TIME ZONE", None),
                ("subscription_reminded_at", "TIMESTAMP WITH TIME ZONE", None),
            ]:
                default_clause = f" DEFAULT {default}" if default else ""
                try:
                    await conn.execute(
                        f"ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS {col} {coltype}{default_clause}"
                    )
                except Exception:
                    pass
            try:
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_fredi_users_cooldown "
                    "ON fredi_users(cooldown_ends_at) WHERE cooldown_ends_at IS NOT NULL"
                )
            except Exception:
                pass
        logger.info("Meter tables ready")

        # User facts table
        if memory:
            await memory.init_table()

    @app.get("/api/meter/status/{user_id}")
    @limiter.limit("60/minute")
    async def get_meter_status(request: Request, user_id: int):
        try:
            status = await subscription_meter.get_user_status(user_id)
            return {"success": True, **status}
        except Exception as e:
            logger.error(f"meter status error: {e}")
            return {"success": False, "can_send": True}

    @app.post("/api/meter/record-usage")
    @limiter.limit("60/minute")
    async def record_meter_usage(request: Request):
        try:
            data = await request.json()
            user_id = data.get("user_id")
            seconds = data.get("seconds", 30)
            if not user_id:
                return {"success": False, "error": "user_id required"}
            status = await subscription_meter.record_usage(int(user_id), int(seconds))
            return {"success": True, **status}
        except Exception as e:
            logger.error(f"meter record error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/meter/can-send/{user_id}")
    @limiter.limit("120/minute")
    async def can_send_message(request: Request, user_id: int):
        try:
            can_send, status = await subscription_meter.can_send_message(user_id)
            result = {
                "success": True,
                "can_send": can_send,
                "is_premium": status.get("is_premium", False),
                "limit_minutes": status.get("limit_minutes"),
                "used_minutes_today": status.get("used_minutes_today"),
                "remaining_minutes": status.get("remaining_minutes"),
            }
            if not can_send:
                # Когда лимит исчерпан — даём фронту понять, что reset в полночь UTC.
                from datetime import datetime as _dt, timedelta as _td, timezone as _tz
                now = _dt.now(_tz.utc)
                next_midnight = (now + _td(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                result["reset_at"] = next_midnight.isoformat()
                result["minutes_until_reset"] = int((next_midnight - now).total_seconds() / 60)
                # Backward-compat поля.
                result["is_on_cooldown"] = False
                result["remaining_cooldown_minutes"] = 0
            else:
                remaining = status.get("remaining_minutes", 30)
                if (remaining is not None
                        and remaining <= 5
                        and not status.get("is_premium")):
                    result["warning"] = True
                    # Analytics: момент когда юзер в зоне warning — старт воронки.
                    try:
                        from analytics_routes import log_server_event
                        await log_server_event(int(user_id), "meter_warning_server", {
                            "remaining_minutes": float(remaining),
                        })
                    except Exception:
                        pass
            return result
        except Exception as e:
            logger.error(f"can_send error: {e}")
            return {"success": True, "can_send": True}

    @app.post("/api/debug/reset-cooldown/{user_id}")
    async def debug_reset_cooldown(request: Request, user_id: int):
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_users SET cooldown_ends_at = NULL, "
                "last_cooldown_started_at = NULL WHERE user_id = $1", user_id
            )
        return {"success": True}

    @app.post("/api/debug/reset-sessions/{user_id}")
    async def debug_reset_sessions(request: Request, user_id: int):
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_users SET free_session_count = 0, daily_usage_seconds = 0, "
                "cooldown_ends_at = NULL, last_cooldown_started_at = NULL WHERE user_id = $1",
                user_id
            )
        return {"success": True}

    async def cooldown_checker():
        await asyncio.sleep(30)
        while True:
            try:
                async with db.get_connection() as conn:
                    rows = await conn.fetch(
                        "SELECT user_id FROM fredi_users "
                        "WHERE cooldown_ends_at <= NOW() "
                        "AND cooldown_ends_at > NOW() - INTERVAL '2 minutes' "
                        "AND NOT EXISTS ("
                        "  SELECT 1 FROM fredi_subscriptions "
                        "  WHERE user_id = fredi_users.user_id "
                        "  AND status = 'active' AND expires_at > NOW()"
                        ")"
                    )
                for row in rows:
                    logger.info(f"Cooldown ended for user {row['user_id']}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"cooldown_checker error: {e}")
            await asyncio.sleep(60)

    return init_meter_tables, cooldown_checker
