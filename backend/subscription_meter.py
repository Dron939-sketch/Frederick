"""
subscription_meter.py — 3-дневный free trial с дневным окном 10 минут.

Модель (после ребута Fading Fredi):
- 10 минут на день
- Сброс счётчика в 00:00 UTC
- Максимум 3 дня использования. Пропуск дня НЕ сжигает trial.
- После 3-го дня — paywall, купить пакет.
- Внутри trial-дня: полный функционал, без урезания.
- На UI: видимый бадж-таймер в правом верхнем углу.

Принципиально отличается от прежнего Fading Fredi:
- НЕ урезаем ответы AI по уровню — всё работает 100%.
- Ставка на видимость лимита через постоянный таймер, а не на
  деградацию качества.
- Trial считается по «дням использования», а не календарным дням.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


# Бесплатный дневной лимит в минутах. Reset в 00:00 UTC.
FREE_DAILY_MINUTES = 10

# Сколько дней использования предоставляем как trial.
# Пропуск дня НЕ списывает один из 3 — считаем только активные дни.
FREE_TRIAL_DAYS = 3

# Когда осталось ≤ этой границы — фронт может отметить бадж красным.
WARNING_THRESHOLD_MINUTES = 2


class SubscriptionMeter:
    def __init__(self, db):
        self.db = db

    async def init_user_tracking(self, user_id: int):
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_users SET
                    trial_started_at = COALESCE(trial_started_at, NOW()),
                    daily_usage_seconds = COALESCE(daily_usage_seconds, 0),
                    last_usage_reset = COALESCE(last_usage_reset, CURRENT_DATE),
                    free_days_used = COALESCE(free_days_used, 0)
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
                "free_days_used": 0,
                "free_days_left": None,  # без лимита
                "trial_exhausted": False,
                # Backward-compat: старые билды могут читать.
                "is_on_cooldown": False,
                "remaining_cooldown_minutes": 0,
                "free_session_count": 0,
                "next_session_limit_minutes": None,
            }

        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT daily_usage_seconds, last_usage_reset, free_days_used
                FROM fredi_users WHERE user_id = $1
            """, user_id)

        if not row:
            await self.init_user_tracking(user_id)
            return self._compose_status(used_seconds=0, free_days_used=0)

        daily_seconds = row["daily_usage_seconds"] or 0
        last_reset = row["last_usage_reset"]
        free_days_used = row["free_days_used"] or 0
        now = datetime.now(timezone.utc)

        # Daily reset в 00:00 UTC. На новой дате счётчик минут обнуляется.
        # Инкремент free_days_used произойдёт ПРИ ПЕРВОЙ активности дня
        # (см. record_usage), а не сейчас — так пропущенный день не
        # сжигает trial.
        if last_reset and last_reset < now.date():
            daily_seconds = 0
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_users
                    SET daily_usage_seconds = 0, last_usage_reset = CURRENT_DATE
                    WHERE user_id = $1
                """, user_id)

        return self._compose_status(used_seconds=daily_seconds,
                                    free_days_used=free_days_used)

    def _compose_status(self, used_seconds: int, free_days_used: int) -> Dict[str, Any]:
        used_minutes = used_seconds / 60.0
        remaining_minutes = max(0.0, FREE_DAILY_MINUTES - used_minutes)

        # Trial исчерпан, если юзер уже потратил >= FREE_TRIAL_DAYS
        # дней (полностью или частично — каждый день, в котором было
        # использование, считается одним из trial-дней).
        trial_exhausted = free_days_used >= FREE_TRIAL_DAYS

        # Можно отправлять, если:
        # 1) trial не исчерпан И
        # 2) есть минуты на сегодня
        # ИЛИ юзер уже сегодня записал активность (тогда даже исчерпан-trial
        # позволяет дописать день — мы не блокируем mid-session).
        # Здесь упрощаем: блок настаёт ровно когда исчерпано минут на день
        # ИЛИ исчерпан весь trial.
        can_send = (not trial_exhausted) and (remaining_minutes > 0)

        return {
            "has_subscription": False,
            "is_premium": False,
            "can_send": can_send,
            "remaining_minutes": round(remaining_minutes, 1),
            "used_minutes_today": round(used_minutes, 1),
            "limit_minutes": FREE_DAILY_MINUTES,
            "free_days_used": free_days_used,
            "free_days_left": max(0, FREE_TRIAL_DAYS - free_days_used),
            "trial_exhausted": trial_exhausted,
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
        """Записываем активность. При первой активности дня инкрементируем
        free_days_used (если ещё не инкрементили на эту дату)."""
        if await self.has_active_subscription(user_id):
            return {"is_premium": True}

        async with self.db.get_connection() as conn:
            # Если это первая активность нового дня — увеличиваем free_days_used.
            # Условие: last_usage_reset < CURRENT_DATE ИЛИ
            # daily_usage_seconds = 0 (никогда сегодня не записывали).
            # Используем атомарный UPDATE, чтобы избежать race conditions.
            await conn.execute("""
                UPDATE fredi_users SET
                    daily_usage_seconds = COALESCE(daily_usage_seconds, 0) + $2,
                    free_days_used = CASE
                        WHEN last_usage_reset IS NULL OR last_usage_reset < CURRENT_DATE
                            THEN COALESCE(free_days_used, 0) + 1
                        WHEN COALESCE(daily_usage_seconds, 0) = 0
                            THEN COALESCE(free_days_used, 0) + 1
                        ELSE COALESCE(free_days_used, 0)
                    END,
                    last_usage_reset = CURRENT_DATE
                WHERE user_id = $1
            """, user_id, seconds)

        return await self.get_user_status(user_id)

    async def start_cooldown(self, user_id: int):
        """Backward compat — cooldown'ов больше нет."""
        return
