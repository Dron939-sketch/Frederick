"""
subscription_meter.py - Fading Fredi logic.
Free sessions: 30 -> 20 -> 10 -> 0 minutes.
Cooldown: 2 hours between sessions.
Subscription: unlimited access.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

SESSION_LIMITS = {
    1: 30,
    2: 20,
    3: 10,
}
DEFAULT_LIMIT = 0

COOLDOWN_HOURS = 2
COOLDOWN_SECONDS = COOLDOWN_HOURS * 3600


class SubscriptionMeter:
    def __init__(self, db):
        self.db = db

    async def init_user_tracking(self, user_id: int):
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_users SET
                    trial_started_at = COALESCE(trial_started_at, NOW()),
                    free_session_count = COALESCE(free_session_count, 0),
                    daily_usage_seconds = COALESCE(daily_usage_seconds, 0),
                    last_usage_reset = COALESCE(last_usage_reset, CURRENT_DATE)
                WHERE user_id = $1
            """, user_id)

    async def has_active_subscription(self, user_id: int) -> bool:
        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT 1 FROM fredi_subscriptions
                WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
            """, user_id)
            return row is not None

    async def get_user_status(self, user_id: int) -> Dict[str, Any]:
        is_premium = await self.has_active_subscription(user_id)
        if is_premium:
            return {
                "has_subscription": True,
                "is_premium": True,
                "is_on_cooldown": False,
                "can_send": True,
                "remaining_minutes": None,
                "free_session_count": 0,
                "next_session_limit_minutes": None,
                "used_minutes_today": 0,
            }

        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT free_session_count, daily_usage_seconds, last_usage_reset,
                       cooldown_ends_at, last_cooldown_started_at
                FROM fredi_users WHERE user_id = $1
            """, user_id)

        if not row:
            await self.init_user_tracking(user_id)
            return {
                "has_subscription": False,
                "is_premium": False,
                "is_on_cooldown": False,
                "can_send": True,
                "remaining_minutes": 30,
                "free_session_count": 0,
                "next_session_limit_minutes": 30,
                "used_minutes_today": 0,
            }

        session_count = row["free_session_count"] or 0
        daily_seconds = row["daily_usage_seconds"] or 0
        last_reset = row["last_usage_reset"]
        cooldown_ends = row["cooldown_ends_at"]
        now = datetime.now(timezone.utc)

        if last_reset and last_reset < now.date():
            daily_seconds = 0
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_users SET daily_usage_seconds = 0, last_usage_reset = CURRENT_DATE
                    WHERE user_id = $1
                """, user_id)

        is_on_cooldown = False
        remaining_cooldown_minutes = 0
        if cooldown_ends and cooldown_ends > now:
            is_on_cooldown = True
            remaining_cooldown_minutes = int((cooldown_ends - now).total_seconds() / 60)

        current_session = session_count + 1
        limit_minutes = SESSION_LIMITS.get(current_session, DEFAULT_LIMIT)
        used_minutes = daily_seconds / 60
        remaining_minutes = max(0, limit_minutes - used_minutes)

        next_session = current_session + 1
        next_limit = SESSION_LIMITS.get(next_session, DEFAULT_LIMIT)

        can_send = not is_on_cooldown and remaining_minutes > 0

        return {
            "has_subscription": False,
            "is_premium": False,
            "is_on_cooldown": is_on_cooldown,
            "remaining_cooldown_minutes": remaining_cooldown_minutes,
            "can_send": can_send,
            "remaining_minutes": round(remaining_minutes, 1),
            "free_session_count": session_count,
            "current_session_number": current_session,
            "session_limit_minutes": limit_minutes,
            "next_session_limit_minutes": next_limit,
            "used_minutes_today": round(used_minutes, 1),
        }

    async def can_send_message(self, user_id: int) -> Tuple[bool, Dict[str, Any]]:
        status = await self.get_user_status(user_id)
        return status["can_send"], status

    async def record_usage(self, user_id: int, seconds: int) -> Dict[str, Any]:
        if await self.has_active_subscription(user_id):
            return {"is_premium": True}

        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_users SET
                    daily_usage_seconds = COALESCE(daily_usage_seconds, 0) + $2
                WHERE user_id = $1
            """, user_id, seconds)

        status = await self.get_user_status(user_id)

        if status["remaining_minutes"] <= 0 and not status["is_on_cooldown"]:
            await self.start_cooldown(user_id)
            status["is_on_cooldown"] = True
            status["can_send"] = False

        return status

    async def start_cooldown(self, user_id: int):
        now = datetime.now(timezone.utc)
        cooldown_ends = now + timedelta(seconds=COOLDOWN_SECONDS)
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_users SET
                    last_cooldown_started_at = $2,
                    cooldown_ends_at = $3,
                    free_session_count = COALESCE(free_session_count, 0) + 1,
                    daily_usage_seconds = 0
                WHERE user_id = $1
            """, user_id, now, cooldown_ends)
        logger.info(f"Cooldown started for user {user_id}, ends at {cooldown_ends}")
