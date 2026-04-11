"""
subscription_meter.py — Fading Fredi logic.
Free sessions: 30 -> 20 -> 10 -> 0 minutes.
Cooldown: 2 hours between sessions.
Subscription: unlimited access.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Session limits in minutes
SESSION_LIMITS = {
    1: 30,
    2: 20,
    3: 10,
}
DEFAULT_LIMIT = 0

COOLDOWN_HOURS = 2
COOLDOWN_SECONDS = COOLDOWN_HOURS * 3600

# Messages
FATIGUE_MESSAGES = {
    "limit_reached_30": """\u{1F319} *\u0424\u0440\u0435\u0434\u0438 \u043d\u0435\u043c\u043d\u043e\u0433\u043e \u0443\u0441\u0442\u0430\u043b...*\n\n\u041c\u044b \u043e\u0431\u0449\u0430\u043b\u0438\u0441\u044c 30 \u043c\u0438\u043d\u0443\u0442, \u0438 \u043c\u043d\u0435 \u043d\u0443\u0436\u043d\u043e \u043e\u0442\u0434\u043e\u0445\u043d\u0443\u0442\u044c.\n\n\u2728 *\u0423 \u043c\u0435\u043d\u044f \u0435\u0441\u0442\u044c \u0434\u0432\u0430 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u0430:*\n\n1\uFE0F\u20E3 *\u041f\u043e\u0434\u043e\u0436\u0434\u0430\u0442\u044c 2 \u0447\u0430\u0441\u0430* \u2014 \u044f \u0432\u044b\u043f\u044c\u044e \u0447\u0430\u0439, \u0438 \u043c\u044b \u0441\u043c\u043e\u0436\u0435\u043c \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c (\u043d\u043e \u0443\u0436\u0435 20 \u043c\u0438\u043d\u0443\u0442)\n\n2\uFE0F\u20E3 *\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443 \u0437\u0430 690\u20BD/\u043c\u0435\u0441* \u2014 \u0443 \u043c\u0435\u043d\u044f \u043e\u0442\u043a\u0440\u043e\u0435\u0442\u0441\u044f *\u0432\u0442\u043e\u0440\u043e\u0435 \u0434\u044b\u0445\u0430\u043d\u0438\u0435*!\n\n\u0421 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u043e\u0439 \u043c\u044b \u043c\u043e\u0436\u0435\u043c \u043e\u0431\u0449\u0430\u0442\u044c\u0441\u044f \u0431\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0439!\n\n\u0410 \u043f\u043e\u043a\u0430 \u2014 \u043e\u0442\u0434\u043e\u0445\u043d\u0438 \u0438 \u044f. \u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0441\u044f \u0447\u0435\u0440\u0435\u0437 2 \u0447\u0430\u0441\u0430!""",
}


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
        now = datetime.utcnow()

        # Reset daily counter if new day
        if last_reset and last_reset < now.date():
            daily_seconds = 0
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_users SET daily_usage_seconds = 0, last_usage_reset = CURRENT_DATE
                    WHERE user_id = $1
                """, user_id)

        # Check cooldown
        is_on_cooldown = False
        remaining_cooldown_minutes = 0
        if cooldown_ends and cooldown_ends > now:
            is_on_cooldown = True
            remaining_cooldown_minutes = int((cooldown_ends - now).total_seconds() / 60)

        # Current session limit
        current_session = session_count + 1
        limit_minutes = SESSION_LIMITS.get(current_session, DEFAULT_LIMIT)
        used_minutes = daily_seconds / 60
        remaining_minutes = max(0, limit_minutes - used_minutes)

        # Next session info
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

        # Check if limit exceeded -> start cooldown
        if status["remaining_minutes"] <= 0 and not status["is_on_cooldown"]:
            await self.start_cooldown(user_id)
            status["is_on_cooldown"] = True
            status["can_send"] = False

        return status

    async def start_cooldown(self, user_id: int):
        now = datetime.utcnow()
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

    def get_fatigue_message(self, user_id: int, status: Dict) -> str:
        session_count = status.get("free_session_count", 0)
        current_session = session_count + 1

        if status.get("is_on_cooldown"):
            remaining = status.get("remaining_cooldown_minutes", 0)
            return (
                f"\U0001F634 *Fredi otdykhaet...*\n\n"
                f"Ya vosstanovlyus' cherez {remaining} minut.\n\n"
                f"\U0001F48E *No est' sposob bystree!*\n"
                f"Oformi podpisku za 690\u20BD/mes, i ya prosnus' pryamo seychas!\n\n"
                f"Otkroy Nastroyki -> Podpiska"
            )

        limit = status.get("session_limit_minutes", 0)
        if limit == 0:
            return (
                "\u274C *Fredi bol'she ne mozhet rabotat' besplatno...*\n\n"
                "Ty ispol'zoval vse besplatnye sessii.\n\n"
                "\U0001F48E *Yedinstvennyy sposob prodolzhit':*\n"
                "Oformi podpisku za 690\u20BD/mes\n\n"
                "Otkroy Nastroyki -> Podpiska"
            )

        if limit == 30:
            return FATIGUE_MESSAGES.get("limit_reached_30", "Fredi ustal.")
        elif limit == 20:
            return (
                "\U0001F634 *Fredi snova ustal...*\n\n"
                "Na etot raz my progovorili tol'ko 20 minut.\n\n"
                "1\uFE0F\u20E3 *Podozhdat' 2 chasa* — no sleduyushchaya sessiya budet vsego 10 minut\n"
                "2\uFE0F\u20E3 *Oformi podpisku za 690\u20BD/mes* — i ya budu polon sil vsegda!\n\n"
                "Otkroy Nastroyki -> Podpiska"
            )
        elif limit == 10:
            return (
                "\U0001F494 *Fredi pochti na predele...*\n\n"
                "Vsego 10 minut — i ya snova ustal.\n\n"
                "\u26A0\uFE0F *Eto tvoy posledniy shans:*\n"
                "Podozhdat' 2 chasa — sleduyushchaya sessiya budet 0 minut\n"
                "Oformi podpisku — bezlimitnoye obshcheniye navsegda\n\n"
                "Otkroy Nastroyki -> Podpiska"
            )

        return "Fredi ustal. Otkroy Nastroyki -> Podpiska dlya bezlimitnogo dostupa."

    def get_limit_warning_message(self, user_id: int, remaining_minutes: float) -> str:
        mins = int(remaining_minutes)
        return (
            f"\u26A1 *Fredi nachinayet ustavat'...*\n\n"
            f"Ostalos' vsego {mins} minut besplatnogo obshcheniya.\n\n"
            f"\U0001F4AB *Khochesh' prodolzhat' bez pereryva?*\n"
            f"Podpiska za 690\u20BD/mes — i Fredi vsegda polon sil!\n\n"
            f"Otkroy Nastroyki -> Podpiska"
        )

    def get_welcome_back_message(self, user_id: int, next_limit_minutes: int) -> str:
        if next_limit_minutes <= 0:
            return (
                "\U0001F6AB *Fredi bol'she ne mozhet rabotat' besplatno.*\n\n"
                "Oformi podpisku za 690\u20BD/mes dlya bezlimitnogo dostupa.\n\n"
                "Otkroy Nastroyki -> Podpiska"
            )
        return (
            f"\u2728 *Fredi otdokhnul i snova gotov!*\n\n"
            f"U tebya {next_limit_minutes} minut besplatnogo obshcheniya.\n\n"
            f"\U0001F48E Napomni, chto s podpiskoy za 690\u20BD/mes my mozhem obshchat'sya bezlimitno!\n\n"
            f"Otkroy Nastroyki -> Podpiska"
        )
