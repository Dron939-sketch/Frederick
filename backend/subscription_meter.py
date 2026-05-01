"""
subscription_meter.py — Free-tier meter (Anthropic-style).

Простая модель: 15 минут в день суммарно. Без сессий, без cooldown'ов.
Когда лимит исчерпан → paywall (Premium или «приходи завтра»).
Reset в 00:00 UTC (даты считаются по UTC).
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


# Бесплатный дневной лимит в минутах. Reset в 00:00 UTC.
FREE_DAILY_MINUTES = 15

# Когда осталось ≤ этой границы — фронт показывает warning-toast.
WARNING_THRESHOLD_MINUTES = 5


class SubscriptionMeter:
    def __init__(self, db):
        self.db = db

    async def init_user_tracking(self, user_id: int):
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_users SET
                    trial_started_at = COALESCE(trial_started_at, NOW()),
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
                "can_send": True,
                "remaining_minutes": None,
                "used_minutes_today": 0,
                "limit_minutes": None,
                # Backward-compat: фронт ещё может ждать эти поля.
                "is_on_cooldown": False,
                "remaining_cooldown_minutes": 0,
                "free_session_count": 0,
                "next_session_limit_minutes": None,
            }

        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT daily_usage_seconds, last_usage_reset
                FROM fredi_users WHERE user_id = $1
            """, user_id)

        if not row:
            await self.init_user_tracking(user_id)
            return self._fresh_status(used_seconds=0)

        daily_seconds = row["daily_usage_seconds"] or 0
        last_reset = row["last_usage_reset"]
        now = datetime.now(timezone.utc)

        # Daily reset в 00:00 UTC.
        if last_reset and last_reset < now.date():
            daily_seconds = 0
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_users SET daily_usage_seconds = 0, last_usage_reset = CURRENT_DATE
                    WHERE user_id = $1
                """, user_id)

        return self._fresh_status(used_seconds=daily_seconds)

    def _fresh_status(self, used_seconds: int) -> Dict[str, Any]:
        used_minutes = used_seconds / 60.0
        remaining_minutes = max(0.0, FREE_DAILY_MINUTES - used_minutes)
        can_send = remaining_minutes > 0
        return {
            "has_subscription": False,
            "is_premium": False,
            "can_send": can_send,
            "remaining_minutes": round(remaining_minutes, 1),
            "used_minutes_today": round(used_minutes, 1),
            "limit_minutes": FREE_DAILY_MINUTES,
            # Backward-compat.
            "is_on_cooldown": False,
            "remaining_cooldown_minutes": 0,
            "free_session_count": 0,
            "next_session_limit_minutes": FREE_DAILY_MINUTES,
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

        return await self.get_user_status(user_id)

    async def start_cooldown(self, user_id: int):
        """Заглушка для backward compat — cooldown'ов больше нет.

        Если что-то ещё дёргает — просто no-op.
        """
        return
