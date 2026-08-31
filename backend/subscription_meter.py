"""
subscription_meter.py — платный Фреди: подписка 990 ₽/мес, бесплатная проба
10 минут на аккаунт.

Модель (правка 31.08.2026, решение владельца):
- Разговор с Фреди доступен только зарегистрированным (имя + почта).
  Аноним получает block_reason='auth' — фронт показывает регистрацию,
  а не пейволл. Проверка здесь, на сервере: обход фронтовой модалки
  прямым запросом к API упирается в тот же блок.
- После регистрации — 10 бесплатных минут разговора на аккаунт, целиком,
  без дневной нарезки. Кончились — подписка 990 ₽/мес.
- Внутри пробы: полный функционал, без урезания.
- На UI: видимый бадж-таймер в правом верхнем углу.

Почему без дневной нарезки. Прежняя модель (запас + дневной темп) давала
две разные стены — «на сегодня всё, приходите завтра» и «запас кончился,
нужен Premium», — и по аналитике они путались между собой: человеку с
пустым запасом обещали «завтра снова минуты», которых не будет. Одна
проба и одна стена убирают этот класс ошибок целиком. FREE_DAILY_MINUTES
оставлен равным пробе: старые сборки фронта читают limit_minutes, а
дневная ветка при равных лимитах недостижима — общий запас всегда
кончается первым.

Принципиально:
- НЕ урезаем ответы AI по уровню — проба показывает настоящего Фреди.
- Проба привязана к аккаунту (почта), а не к устройству.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


# Дневной лимит держим равным общей пробе: при равных значениях дневная
# ветка недостижима (общий запас кончается первым или одновременно), и
# человек никогда не увидит ложное «завтра снова будут минуты».
FREE_DAILY_MINUTES = 10

# Бесплатная проба: 10 минут разговора на аккаунт, целиком.
FREE_TRIAL_MINUTES = 10

# Счётчик активных дней. Больше не блокирует — остаётся для аналитики
# и для старых сборок фронта, которые читают free_days_used/free_days_left.
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
                    free_days_used = COALESCE(free_days_used, 0),
                    total_usage_seconds = COALESCE(total_usage_seconds, 0)
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
                "is_registered": True,
                "can_send": True,
                "remaining_minutes": None,
                "used_minutes_today": 0,
                "limit_minutes": None,
                "remaining_today_minutes": None,
                "remaining_trial_minutes": None,
                "trial_limit_minutes": None,
                "trial_used_minutes": 0,
                "block_reason": None,
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
                SELECT daily_usage_seconds, last_usage_reset, free_days_used,
                       total_usage_seconds, email
                FROM fredi_users WHERE user_id = $1
            """, user_id)

        # Без аккаунта разговора нет. Проверка именно здесь: через
        # get_user_status ходят и can-send, и 402-мидлварь в main.py —
        # прямой запрос к API мимо фронтовой модалки упрётся в тот же блок.
        # Фронт по block_reason='auth' открывает регистрацию, не пейволл.
        registered = bool(row and (row["email"] or "").strip())
        if not registered:
            if not row:
                await self.init_user_tracking(user_id)
            status = self._compose_status(used_seconds=0, free_days_used=0,
                                          total_seconds=0)
            status["can_send"] = False
            status["block_reason"] = "auth"
            status["is_registered"] = False
            return status

        daily_seconds = row["daily_usage_seconds"] or 0
        last_reset = row["last_usage_reset"]
        free_days_used = row["free_days_used"] or 0
        total_seconds = row["total_usage_seconds"] or 0
        now = datetime.now(timezone.utc)

        # Daily reset в 00:00 UTC. На новой дате счётчик минут обнуляется —
        # но общий запас не трогаем, он на то и общий.
        if last_reset and last_reset < now.date():
            daily_seconds = 0
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_users
                    SET daily_usage_seconds = 0, last_usage_reset = CURRENT_DATE
                    WHERE user_id = $1
                """, user_id)

        return self._compose_status(used_seconds=daily_seconds,
                                    free_days_used=free_days_used,
                                    total_seconds=total_seconds)

    def _compose_status(self, used_seconds: int, free_days_used: int,
                        total_seconds: int = 0) -> Dict[str, Any]:
        used_minutes = used_seconds / 60.0
        remaining_today = max(0.0, FREE_DAILY_MINUTES - used_minutes)

        trial_used_minutes = total_seconds / 60.0
        remaining_trial = max(0.0, FREE_TRIAL_MINUTES - trial_used_minutes)

        # Запас кончился — дальше paywall. В отличие от прежнего счётчика
        # дней, сюда нельзя попасть, ничего не потратив.
        trial_exhausted = remaining_trial <= 0
        can_send = (not trial_exhausted) and (remaining_today > 0)

        # Что показывать в бадже и по чему предупреждать — то из двух
        # ограничений, которое ближе. Иначе бывает «осталось 10 минут»
        # ровно перед стеной, как было с дневным счётчиком при пустом trial.
        remaining_minutes = min(remaining_today, remaining_trial)

        # Почему заблокировали: 'trial' — кончился весь запас, нужен пакет;
        # 'daily' — на сегодня всё, но завтра снова будут минуты. Это разные
        # экраны, и раньше фронт не мог их различить.
        block_reason = None
        if trial_exhausted:
            block_reason = "trial"
        elif remaining_today <= 0:
            block_reason = "daily"

        return {
            "has_subscription": False,
            "is_premium": False,
            "can_send": can_send,
            "remaining_minutes": round(remaining_minutes, 1),
            "used_minutes_today": round(used_minutes, 1),
            "limit_minutes": FREE_DAILY_MINUTES,
            "remaining_today_minutes": round(remaining_today, 1),
            "remaining_trial_minutes": round(remaining_trial, 1),
            "trial_limit_minutes": FREE_TRIAL_MINUTES,
            "trial_used_minutes": round(trial_used_minutes, 1),
            "block_reason": block_reason,
            "is_registered": True,
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
        """Записываем активность: в дневной счётчик и в общий запас.

        free_days_used инкрементируется при первой активности дня — он
        больше ничего не блокирует, но остаётся полезной метрикой
        возвращаемости.
        """
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
                    total_usage_seconds = COALESCE(total_usage_seconds, 0) + $2,
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
