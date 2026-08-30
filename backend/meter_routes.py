"""
meter_routes.py — Subscription meter + UserMemory init.
"""

import asyncio
import logging
import os
from typing import Optional
from fastapi import Request, Header, HTTPException
from subscription_meter import SubscriptionMeter
from services.user_memory import get_user_memory

logger = logging.getLogger(__name__)


def _require_admin(token: Optional[str]) -> None:
    """X-Admin-Token gate для debug-эндпоинтов meter.

    Раньше /api/debug/reset-* были открытыми — любой curl мог обнулять
    daily_usage_seconds любого user_id. Это бэкдор от старой разработки
    + один из главных каналов утечки monetization. Закрываем тем же
    токеном, что vk_routes._check_admin.
    """
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail={"error": "admin_disabled",
                    "message": "ADMIN_TOKEN не задан в env"},
        )
    if not token or token != expected:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


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
                # Сколько ДНЕЙ юзер пользовался free. С 08.2026 больше не
                # блокирует — метрика возвращаемости (см. subscription_meter).
                ("free_days_used", "INTEGER", "0"),
                # Общий израсходованный бесплатный запас. Именно он теперь
                # ограничивает: 30 минут разговора вместо трёх заходов.
                # Всем существующим юзерам колонка ставится в 0, то есть
                # запас начинается заново — тем, кого прежняя механика
                # заблокировала, не потратив их минут, это и причиталось.
                ("total_usage_seconds", "INTEGER", "0"),
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

    async def _warned_today(user_id: int) -> bool:
        """Писали ли уже сегодня meter_warning_server этому человеку.

        Сутки — от полуночи UTC, ровно как дневной лимит в
        SubscriptionMeter: предупреждение живёт в том же такте, что и
        запас, который оно предсказывает.
        """
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM fredi_analytics "
                "WHERE user_id = $1 AND event = 'meter_warning_server' "
                "AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') "
                "LIMIT 1",
                user_id)
            return row is not None

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
                # Остаток по каждому из двух ограничений отдельно: фронту
                # нужно различать «на сегодня всё, приходите завтра» и
                # «бесплатный запас кончился, нужен пакет».
                "remaining_today_minutes": status.get("remaining_today_minutes"),
                "remaining_trial_minutes": status.get("remaining_trial_minutes"),
                "trial_limit_minutes": status.get("trial_limit_minutes"),
                "trial_used_minutes": status.get("trial_used_minutes"),
                "block_reason": status.get("block_reason"),
                "free_days_used": status.get("free_days_used", 0),
                "free_days_left": status.get("free_days_left"),
                "trial_exhausted": status.get("trial_exhausted", False),
                # Дневной лимит разный: с аккаунтом больше, чем без. Фронту
                # нужны оба числа, чтобы предложить регистрацию на цифрах,
                # а не на слово.
                "is_registered": status.get("is_registered", True),
                "registered_limit_minutes": status.get("registered_limit_minutes"),
                "anon_limit_minutes": status.get("anon_limit_minutes"),
            }
            if not can_send:
                # Дневной лимит отпустит в полночь UTC, общий запас — нет.
                # Раньше reset_at отдавался в обоих случаях, и человек с
                # исчерпанным trial ждал полуночи впустую.
                if status.get("block_reason") != "trial":
                    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
                    now = _dt.now(_tz.utc)
                    next_midnight = (now + _td(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    result["reset_at"] = next_midnight.isoformat()
                    result["minutes_until_reset"] = int((next_midnight - now).total_seconds() / 60)
                # Backward-compat поля.
                result["is_on_cooldown"] = False
                result["remaining_cooldown_minutes"] = 0
            else:
                # Warning при ≥70% израсходованного — по тому из двух
                # ограничений, которое ближе. Считать только дневной процент
                # нельзя: к концу общего запаса человек может открыть день
                # с нулевым расходом, получить «использовано 0%» и упереться
                # в paywall через минуту разговора.
                used_day = status.get("used_minutes_today")
                lim_day = status.get("limit_minutes")
                used_trial = status.get("trial_used_minutes")
                lim_trial = status.get("trial_limit_minutes")

                def _pct(used, lim):
                    return (used / lim) if (lim and lim > 0 and used is not None) else 0.0

                pct = max(_pct(used_day, lim_day), _pct(used_trial, lim_trial))
                if pct >= 0.70 and not status.get("is_premium"):
                    result["warning"] = True
                    # Событие — только на первое пересечение порога за сутки.
                    # /api/meter/check дёргает бадж таймера раз в 60 секунд
                    # (fredi/meter.js), и раньше каждый такой опрос писал
                    # строку в аналитику. Один человек с открытой вкладкой
                    # давал 43 «предупреждения» за 43 минуты, и первый шаг
                    # воронки показывал опросы вместо людей.
                    try:
                        if await _warned_today(int(user_id)):
                            return result
                    except Exception:
                        pass
                    try:
                        from analytics_routes import log_server_event
                        await log_server_event(int(user_id), "meter_warning_server", {
                            "remaining_minutes": float(status.get("remaining_minutes") or 0),
                            "remaining_trial_minutes": float(status.get("remaining_trial_minutes") or 0),
                            "used_minutes": float(used_day or 0),
                            "limit_minutes": float(lim_day or 0),
                            "used_pct": round(pct * 100, 1),
                        })
                    except Exception:
                        pass
            return result
        except Exception as e:
            logger.error(f"can_send error: {e}")
            return {"success": True, "can_send": True}

    @app.post("/api/debug/reset-cooldown/{user_id}")
    async def debug_reset_cooldown(
        request: Request, user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        # Закрыто X-Admin-Token: раньше любой curl мог обнулять
        # cooldown_ends_at любого юзера (audit Phase 1 fix).
        _require_admin(x_admin_token)
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_users SET cooldown_ends_at = NULL, "
                "last_cooldown_started_at = NULL WHERE user_id = $1", user_id
            )
        logger.warning(f"debug_reset_cooldown by admin for user_id={user_id}")
        return {"success": True}

    @app.post("/api/debug/reset-sessions/{user_id}")
    async def debug_reset_sessions(
        request: Request, user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        # Закрыто X-Admin-Token: раньше любой curl мог обнулять
        # daily_usage_seconds + free_session_count любого юзера —
        # бэкдор для бесплатного использования (audit Phase 1 fix).
        _require_admin(x_admin_token)
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_users SET free_session_count = 0, daily_usage_seconds = 0, "
                "cooldown_ends_at = NULL, last_cooldown_started_at = NULL WHERE user_id = $1",
                user_id
            )
        logger.warning(f"debug_reset_sessions by admin for user_id={user_id}")
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
