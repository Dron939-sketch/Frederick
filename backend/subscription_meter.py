"""
subscription_meter.py — платный Фреди: подписка 990 ₽/мес и возобновляемый
бесплатный уровень.

Модель (правка 04.09.2026, решение владельца — «возобновляемые лимиты,
метрика покажет»):
- Бесплатные минуты ОБНОВЛЯЮТСЯ каждый день и не кончаются насовсем:
  аноним — 3 мин/день, аккаунт — 5 мин/день. Механика та же, что у
  подписочных ИИ-сервисов: человек возвращается, потому что точно знает,
  что завтра снова получит своё, привычка складывается до оплаты, и стена
  продаёт многократно, а не один раз. Терминальная проба продавала
  единожды: выговорил 10 минут — и бесплатного «завтра» не существовало,
  писем возврата не к чему было звать.
- Первые FREE_TRIAL_MINUTES суммарных минут — окно «всё включено»:
  доступен и голос. Дальше бесплатным остаётся текст, голос — в Premium.
  Дорогая часть бесплатной минуты — голосовой стек (STT + Fish Audio),
  и окно ограничивает именно её; текстовые минуты стоят копейки.
- Кто ещё не оставил почту, на пустом лимите получает block_reason='auth':
  дверь в регистрацию (аккаунт даёт больше минут в день и сохраняет
  разговор), а не пейволл.

Урок 31.08, который эта модель обязана не повторить: тогда запас и
дневной темп жили ВМЕСТЕ, стен было две, и они путались — человеку с
пустым запасом обещали «завтра снова минуты», которых не будет. Теперь у
текста ограничитель ровно один, дневной, и обещание «завтра снова N
минут» истинно всегда. У голоса своя, отдельная стена ('voice'), и она
не смешивается с дневной: голос не вернётся в полночь, и мы этого не
обещаем.

История: 30.08 лимиты урезаны вдвое (бесплатная минута — реальные деньги
за DeepSeek и голос); 31.08 дневная нарезка отменена в пользу разовой
пробы; 02.09 снят гейт на входе (аноним говорит сразу); 04.09 — эта
модель.

Анонимная инфраструктура (IP-потолок из правок #599-600) работает:
анонимные секунды считаются ещё и на IP, пересоздание localStorage-личности
день не обнуляет.

Принципиально:
- НЕ урезаем ответы AI по уровню — бесплатный уровень показывает
  настоящего Фреди.
- Минуты привязаны к аккаунту (почта), а не к устройству.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


def client_ip_hash(raw_ip: Optional[str]) -> Optional[str]:
    """Солёный хеш IP для дневного анонимного потолка.

    Сырой адрес в базе не храним: для потолка нужна только сравнимость
    в пределах дня, а не сам адрес. Соль из env, чтобы дампом таблицы
    нельзя было перебрать адреса по радуге.
    """
    ip = (raw_ip or "").strip()
    if not ip:
        return None
    salt = os.environ.get("METER_IP_SALT") or "fredi-meter-v1"
    return hashlib.sha256((salt + "|" + ip).encode()).hexdigest()[:32]


# Бесплатный дневной лимит в минутах. Reset в 00:00 UTC.
#
# Дневной темп разный (правка 08.2026). Аноним — единственный, кто уходит
# бесследно: он не получит письма, не вернётся по ссылке из почты и не
# увидит напоминания. Тратить на него столько же бесплатных минут, сколько
# на человека с аккаунтом, — значит платить за разговор, у которого нет
# продолжения. Три минуты разницы дают человеку СВОЮ причину завести
# аккаунт: не «подпишись», а «оставь почту — говори дольше».
#
# Число маленькое намеренно. Аноним должен упереться в стену на середине
# разговора, а не на входе: пара минут — это уже сложившийся контакт, и
# предложение сохранить его звучит как продолжение, а не как турникет.
#
# 30.08.2026 лимиты урезаны вдвое (10/7/30 → 5/3/15): каждая бесплатная
# минута — реальные деньги за DeepSeek и голосовой стек, а конверсии в
# подписку они пока не приносят. Пропорция «аккаунт даёт больше» сохранена.
# Дневной лимит равен пробе: дневная нарезка отменена (см. докстринг).
# 04.09.2026: дневные лимиты снова главные и возобновляемые (см. докстринг).
# 5 у аккаунта против 3 у анонима — чтобы «оставь почту — говори дольше»
# оставалось правдой каждый день, а не только в день регистрации.
FREE_DAILY_MINUTES = 5
FREE_DAILY_MINUTES_ANON = 3


def daily_limit_minutes(registered: bool) -> int:
    """Сколько минут в день положено: с аккаунтом больше, чем без."""
    return FREE_DAILY_MINUTES if registered else FREE_DAILY_MINUTES_ANON

# Окно «всё включено», в суммарных минутах с начала знакомства: пока оно
# не выговорено, бесплатному уровню доступен и голос. Дальше бесплатным
# остаётся текст, голос — в Premium. Текст это окно НЕ ограничивает
# (правка 04.09): раньше здесь был общий терминальный запас, и стена
# «запас кончился» хоронила человека насовсем.
FREE_TRIAL_MINUTES = 10

# Дневной потолок анонимного расхода с одного IP. Анонимная «личность»
# живёт в localStorage, и до этой правки её можно было пересоздавать
# бесконечно: инкогнито или чистка хранилища — и у «нового» человека
# снова полный запас. Теперь анонимные секунды считаются ещё и на IP:
# сколько личностей ни заводи, день с одного адреса ограничен. Потолок —
# два анонимных лимита, чтобы два человека за одним роутером прошли день
# без ложной стены; аккаунтов и Premium это не касается вовсе, так что
# честный выход из-под потолка — оставить почту.
ANON_IP_DAILY_CAP_MINUTES = FREE_DAILY_MINUTES_ANON * 2

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
            # Строка заводится, если её нет. Раньше здесь был только UPDATE,
            # и user_id, отсутствующий в fredi_users, оставался невидимым
            # для счётчика насовсем: get_user_status раз за разом отдавал
            # свежий полный запас, а record_usage упирался в пустой UPDATE
            # и не записывал ни секунды — бесконечные бесплатные минуты
            # для любого выдуманного id.
            await conn.execute("""
                INSERT INTO fredi_users (user_id, created_at, last_activity)
                VALUES ($1, NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
            """, user_id)
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
                "can_send": True,
                "remaining_minutes": None,
                "used_minutes_today": 0,
                "limit_minutes": None,
                "remaining_today_minutes": None,
                "remaining_trial_minutes": None,
                "trial_limit_minutes": None,
                "trial_used_minutes": 0,
                "block_reason": None,
                "voice_allowed": True,
                "free_days_used": 0,
                "free_days_left": None,  # без лимита
                "trial_exhausted": False,
                "is_registered": True,
                "registered_limit_minutes": None,
                "anon_limit_minutes": None,
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

        if not row:
            await self.init_user_tracking(user_id)
            return self._compose_status(used_seconds=0, free_days_used=0,
                                        total_seconds=0, registered=False)

        daily_seconds = row["daily_usage_seconds"] or 0
        last_reset = row["last_usage_reset"]
        free_days_used = row["free_days_used"] or 0
        total_seconds = row["total_usage_seconds"] or 0
        # Аккаунт — это почта в fredi_users. При регистрации анонима строка
        # не заводится заново, к ней дописывают email (auth_routes), так что
        # человек не теряет ни истории, ни потраченных минут — он ровно в тот
        # же день получает лишние три.
        registered = row["email"] is not None
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
                                    total_seconds=total_seconds,
                                    registered=registered)

    def _compose_status(self, used_seconds: int, free_days_used: int,
                        total_seconds: int = 0,
                        registered: bool = True) -> Dict[str, Any]:
        limit_today = daily_limit_minutes(registered)
        used_minutes = used_seconds / 60.0
        remaining_today = max(0.0, limit_today - used_minutes)

        trial_used_minutes = total_seconds / 60.0
        remaining_trial = max(0.0, FREE_TRIAL_MINUTES - trial_used_minutes)

        # 04.09: окно «всё включено» больше НЕ ограничивает текст — только
        # голос. Единственный ограничитель текста — дневной лимит, поэтому
        # обещание стены «завтра снова минуты» истинно всегда: ровно та
        # ошибка двух путающихся стен из аналитики 31.08 стала невозможной
        # по построению.
        trial_exhausted = remaining_trial <= 0
        voice_allowed = not trial_exhausted
        can_send = remaining_today > 0

        # В бадже — дневной остаток: это и есть настоящий лимит текста.
        remaining_minutes = remaining_today

        # Единственная причина блока текста — 'daily': на сегодня всё,
        # завтра снова будут минуты. 'trial' как причина блока умер вместе
        # с терминальным запасом; голосовой блок ('voice') ставит не статус,
        # а middleware на голосовых путях — это отдельная стена с отдельным
        # честным текстом, и с дневной она не смешивается.
        block_reason = "daily" if remaining_today <= 0 else None

        status = {
            "has_subscription": False,
            "is_premium": False,
            "can_send": can_send,
            "remaining_minutes": round(remaining_minutes, 1),
            "used_minutes_today": round(used_minutes, 1),
            "limit_minutes": limit_today,
            "remaining_today_minutes": round(remaining_today, 1),
            "remaining_trial_minutes": round(remaining_trial, 1),
            "trial_limit_minutes": FREE_TRIAL_MINUTES,
            "trial_used_minutes": round(trial_used_minutes, 1),
            "block_reason": block_reason,
            # Голос доступен, пока не выговорено окно «всё включено».
            "voice_allowed": voice_allowed,
            "free_days_used": free_days_used,
            "free_days_left": max(0, FREE_TRIAL_DAYS - free_days_used),
            "trial_exhausted": trial_exhausted,
            # Есть ли аккаунт и сколько минут он даёт. Фронт рисует по этим
            # полям предложение зарегистрироваться, а не вписывает числа
            # руками — иначе экран разъедется с настоящим лимитом в первый
            # же раз, когда лимит поменяют.
            "is_registered": registered,
            "registered_limit_minutes": FREE_DAILY_MINUTES,
            "anon_limit_minutes": FREE_DAILY_MINUTES_ANON,
            # Backward-compat.
            "is_on_cooldown": False,
            "remaining_cooldown_minutes": 0,
            "free_session_count": 0,
            "next_session_limit_minutes": limit_today,
        }
        # Решение 02.09.2026 (пересмотр правила 31.08): анониму разрешены
        # его 3 минуты разговора, регистрация просится на пике, а не на
        # входе. Аналитика недели с обязательным гейтом: 46 показов гейта →
        # 1 регистрация, десктопные сессии умирали за 3-14 секунд, средняя
        # десктопная сессия — 26 секунд. Когда анонимные минуты кончились,
        # вместо пейволла — дверь в регистрацию: аккаунт даёт больше минут
        # В ДЕНЬ (см. daily_limit_minutes) и сохраняет разговор — честная
        # причина оставить почту, истинная теперь каждый день, а не только
        # первый. Переопределение по-прежнему в единственной точке сборки.
        if not registered and not status["can_send"]:
            status["block_reason"] = "auth"
        return status

    async def can_send_message(self, user_id: int,
                               ip_hash: Optional[str] = None
                               ) -> Tuple[bool, Dict[str, Any]]:
        status = await self.get_user_status(user_id)
        can = status["can_send"]
        # Анонимный дневной потолок по IP. Проверяется только когда по
        # личному счётчику ещё можно: стена та же дневная («на сегодня
        # всё»), человек не должен видеть разницу между «кончились твои
        # минуты» и «кончились минуты твоих сегодняшних личностей» —
        # второе объяснило бы, как обходить первый счётчик.
        if can and ip_hash and not status.get("is_premium") \
                and status.get("is_registered") is False:
            try:
                if await self.anon_ip_capped(ip_hash):
                    can = False
                    status["can_send"] = False
                    status["block_reason"] = "daily"
                    status["remaining_minutes"] = 0.0
                    status["remaining_today_minutes"] = 0.0
                    status["ip_capped"] = True
            except Exception as e:
                # Потолок — страховка, а не главный счётчик: сломался —
                # работаем по личному лимиту, не запираем человека зря.
                logger.warning(f"anon ip cap check failed: {e}")
        return can, status

    async def anon_ip_seconds_today(self, ip_hash: str) -> int:
        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT seconds FROM fredi_anon_ip_usage
                WHERE ip_hash = $1 AND day = CURRENT_DATE
            """, ip_hash)
            return int(row["seconds"]) if row else 0

    async def anon_ip_capped(self, ip_hash: str) -> bool:
        used = await self.anon_ip_seconds_today(ip_hash)
        return used >= ANON_IP_DAILY_CAP_MINUTES * 60

    async def record_anon_ip_usage(self, ip_hash: str, seconds: int):
        async with self.db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO fredi_anon_ip_usage (ip_hash, day, seconds)
                VALUES ($1, CURRENT_DATE, $2)
                ON CONFLICT (ip_hash, day)
                DO UPDATE SET seconds = fredi_anon_ip_usage.seconds + $2
            """, ip_hash, seconds)

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
