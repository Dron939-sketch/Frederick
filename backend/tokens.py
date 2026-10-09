# -*- coding: utf-8 -*-
"""Токены чата /fredi/chat/ (решение владельца 09.10.2026).

1 сообщение = 2 токена, озвучка ответа — ещё 1 (решение владельца 10.10.2026;
до этого сообщение стоило 1 токен).
Каждому — 50 бесплатных (25 сообщений) при первом заходе, дальше — пакеты (TOKEN_PACKS),
оплата через ту же ЮKassa, что подписка. У кого активен Фреди Premium —
говорят без токенов: подписчик не должен почувствовать, что у него
что-то отняли.

Защита от «бесконечных 50»: анонимная личность живёт в localStorage и
пересоздаётся чисткой браузера, поэтому бесплатные токены выдаются не
больше FREE_GRANTS_PER_IP_DAY раз в сутки на один IP — как потолок
анонимных минут в subscription_meter (два человека за одним роутером
проходят, фабрика личностей — нет).

Всё в базе, никаких счётчиков в памяти: инстансов несколько.
Списание — одним UPDATE с условием balance >= n, поэтому две вкладки
одновременно не уведут баланс в минус. Зачисление за платёж — через
журнал с уникальным ref (id платежа): webhook, verify и поллер могут
прийти за одним платежом трижды, токены лягут один раз.
"""
import asyncio
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

FREE_TOKENS = 50
FREE_GRANTS_PER_IP_DAY = 2
COST_MESSAGE = 2
COST_VOICE = 1
# Голосовой режим (решение владельца 10.10.2026): человек говорит, речь
# распознаётся, ответ сразу звучит голосом — 4 токена за реплику целиком,
# озвучка этого ответа отдельно не списывается.
COST_VOICE_MODE = 4

# Пакеты: ключ — тариф для /api/subscription/create-payment.
TOKEN_PACKS: Dict[str, Dict[str, Any]] = {
    "tokens_100": {"tokens": 100, "amount": "149.00", "title": "Фреди — 100 токенов (50 сообщений)"},
    "tokens_300": {"tokens": 300, "amount": "349.00", "title": "Фреди — 300 токенов (150 сообщений)"},
    "tokens_1000": {"tokens": 1000, "amount": "990.00", "title": "Фреди — 1000 токенов (500 сообщений)"},
}

_ready = False
_lock = asyncio.Lock()


async def ensure_schema(conn) -> None:
    """Таблицы — один раз на процесс. Под замком: параллельные CREATE TABLE
    IF NOT EXISTS в Postgres сталкиваются на системном каталоге
    (UniqueViolation pg_type_typname_nsp_index) — это поймал тест на трёх
    одновременных обработках одного платежа. Гонку с другим инстансом
    сервера замок не закрывает, поэтому «уже создано» тоже не ошибка."""
    global _ready
    if _ready:
        return
    async with _lock:
        if _ready:
            return
        try:
            await _create(conn)
        except Exception as e:
            if "already exists" not in str(e) and "duplicate key" not in str(e):
                raise
            logger.info(f"tokens schema: создано параллельно ({type(e).__name__})")
        _ready = True


async def _create(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fredi_tokens (
            user_id BIGINT PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
            free_granted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fredi_token_ledger (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            delta INTEGER NOT NULL,
            reason TEXT NOT NULL,
            ref TEXT,
            ip TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS fredi_token_ledger_ref ON fredi_token_ledger (ref) WHERE ref IS NOT NULL")
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS fredi_token_ledger_ip_day ON fredi_token_ledger (ip, created_at) WHERE reason = 'free'")


async def balance(db, user_id: int, ip: Optional[str] = None) -> Dict[str, Any]:
    """Баланс; при первом обращении — выдать бесплатные (если IP не исчерпал)."""
    async with db.get_connection() as conn:
        await ensure_schema(conn)
        async with conn.transaction():
            await conn.execute(
                "INSERT INTO fredi_tokens (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", user_id)
            row = await conn.fetchrow(
                "SELECT balance, free_granted FROM fredi_tokens WHERE user_id = $1 FOR UPDATE", user_id)
            granted_now = False
            if not row["free_granted"]:
                allowed = True
                if ip:
                    n = await conn.fetchval(
                        "SELECT COUNT(*) FROM fredi_token_ledger WHERE reason = 'free' AND ip = $1 "
                        "AND created_at > NOW() - INTERVAL '1 day'", ip)
                    allowed = int(n or 0) < FREE_GRANTS_PER_IP_DAY
                if allowed:
                    await conn.execute(
                        "UPDATE fredi_tokens SET balance = balance + $2, free_granted = TRUE, updated_at = NOW() "
                        "WHERE user_id = $1", user_id, FREE_TOKENS)
                    await conn.execute(
                        "INSERT INTO fredi_token_ledger (user_id, delta, reason, ip) VALUES ($1, $2, 'free', $3)",
                        user_id, FREE_TOKENS, ip)
                    granted_now = True
                else:
                    # Отметка, чтобы не проверять IP на каждом запросе: этот
                    # id свои бесплатные уже не получит.
                    await conn.execute(
                        "UPDATE fredi_tokens SET free_granted = TRUE, updated_at = NOW() WHERE user_id = $1", user_id)
            bal = await conn.fetchval("SELECT balance FROM fredi_tokens WHERE user_id = $1", user_id)
    return {"balance": int(bal or 0), "free_granted_now": granted_now, "free_tokens": FREE_TOKENS}


async def spend(db, user_id: int, n: int, reason: str) -> Optional[int]:
    """Списать n токенов. Вернуть новый баланс или None, если не хватает."""
    async with db.get_connection() as conn:
        await ensure_schema(conn)
        async with conn.transaction():
            new = await conn.fetchval(
                "UPDATE fredi_tokens SET balance = balance - $2, updated_at = NOW() "
                "WHERE user_id = $1 AND balance >= $2 RETURNING balance", user_id, n)
            if new is None:
                return None
            await conn.execute(
                "INSERT INTO fredi_token_ledger (user_id, delta, reason) VALUES ($1, $2, $3)",
                user_id, -n, reason)
    return int(new)


async def credit(db, user_id: int, n: int, reason: str, ref: Optional[str] = None) -> Optional[int]:
    """Зачислить n токенов. С ref — ровно один раз на ref (платёж).
    Вернуть новый баланс или None, если по этому ref уже зачислено."""
    async with db.get_connection() as conn:
        await ensure_schema(conn)
        async with conn.transaction():
            if ref:
                ok = await conn.fetchval(
                    "INSERT INTO fredi_token_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4) "
                    "ON CONFLICT (ref) WHERE ref IS NOT NULL DO NOTHING RETURNING 1", user_id, n, reason, ref)
                if not ok:
                    return None
            else:
                await conn.execute(
                    "INSERT INTO fredi_token_ledger (user_id, delta, reason) VALUES ($1, $2, $3)",
                    user_id, n, reason)
            await conn.execute(
                "INSERT INTO fredi_tokens (user_id, balance, free_granted) VALUES ($1, 0, FALSE) "
                "ON CONFLICT (user_id) DO NOTHING", user_id)
            new = await conn.fetchval(
                "UPDATE fredi_tokens SET balance = balance + $2, updated_at = NOW() "
                "WHERE user_id = $1 RETURNING balance", user_id, n)
    return int(new or 0)


async def issue_voice(db, user_id: int, ref: str) -> None:
    """Пометка «озвучка этого ответа оплачена» — нулевая строка журнала."""
    async with db.get_connection() as conn:
        await ensure_schema(conn)
        await conn.execute(
            "INSERT INTO fredi_token_ledger (user_id, delta, reason, ref) VALUES ($1, 0, 'voice_paid', $2) "
            "ON CONFLICT (ref) WHERE ref IS NOT NULL DO NOTHING", user_id, "vpaid:" + ref)


async def claim_voice(db, user_id: int, ref: str) -> bool:
    """Озвучка по оплаченной метке — ровно один раз и только своему id.
    Метку не подделать: её выдаёт сервер после списания COST_VOICE_MODE."""
    if not ref or len(ref) > 64:
        return False
    async with db.get_connection() as conn:
        await ensure_schema(conn)
        async with conn.transaction():
            own = await conn.fetchval(
                "SELECT 1 FROM fredi_token_ledger WHERE ref = $1 AND user_id = $2", "vpaid:" + ref, user_id)
            if not own:
                return False
            ok = await conn.fetchval(
                "INSERT INTO fredi_token_ledger (user_id, delta, reason, ref) VALUES ($1, 0, 'voice_used', $2) "
                "ON CONFLICT (ref) WHERE ref IS NOT NULL DO NOTHING RETURNING 1", user_id, "vuse:" + ref)
            return bool(ok)
