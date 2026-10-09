# -*- coding: utf-8 -*-
"""Оплата → сообщение владельцу в MAX.

Зачем. Владелец 29.09.2026: «когда человек оплачивает либо три дня, либо
месячную подписку — чтобы мне на MAX приходило сообщение». До этого об
оплате он узнавал из часового пульса или из кабинета ЮKassa.

Как привязать чат. Бот Фреди в MAX уже есть (MAX_TOKEN, ссылка
https://max.ru/id502238728185_1_bot). Владелец открывает ссылку вида
<бот>?start=owner_<код> — MAX присылает bot_started с этим payload, и чат
записывается в fredi_owner_chats. Код выводится из ADMIN_TOKEN (HMAC), в
базе не хранится; ссылку отдаёт только админ-ручка под X-Admin-Token.
Без ADMIN_TOKEN привязка выключена.

Что приходит: сумма, тариф, первая оплата или продление, время по Москве,
последние цифры id, есть ли аккаунт и в какой день человек пришёл. Имени и
почты в сообщении нет: MAX — внешний сервис, персональные данные туда не
отправляем.

Любая ошибка здесь не должна мешать активации подписки: всё в try, вызов —
через asyncio.create_task.
"""
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)

MSK = timezone(timedelta(hours=3))
BIND_PREFIX = "owner_"
PLAN_LABEL = {
    "trial_week": "проба на 3 дня",
    "monthly": "месяц",
    "quarter": "три месяца",
    "tokens_100": "100 токенов чата",
    "tokens_300": "300 токенов чата",
    "tokens_1000": "1000 токенов чата",
}
MAX_BOT_LINK_DEFAULT = "https://max.ru/id502238728185_1_bot"


def bind_code() -> str:
    """Код привязки: HMAC от ADMIN_TOKEN. Пустая строка — привязка выключена."""
    secret = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not secret:
        return ""
    return hmac.new(secret.encode(), b"owner-max-bind", hashlib.sha256).hexdigest()[:16]


def bind_link() -> str:
    code = bind_code()
    if not code:
        return ""
    base = (os.environ.get("MAX_BOT_LINK") or MAX_BOT_LINK_DEFAULT).strip()
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}start={BIND_PREFIX}{code}"


def is_bind_payload(payload: str) -> bool:
    code = bind_code()
    if not code or not payload:
        return False
    return hmac.compare_digest(payload.strip(), BIND_PREFIX + code)


async def ensure_table(db) -> None:
    async with db.get_connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_owner_chats (
                platform TEXT NOT NULL,
                chat_id  TEXT NOT NULL,
                name     TEXT,
                bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (platform, chat_id)
            )
        """)


async def bind_chat(db, platform: str, chat_id: str, name: str = "") -> bool:
    if not chat_id:
        return False
    await ensure_table(db)
    async with db.get_connection() as conn:
        await conn.execute("""
            INSERT INTO fredi_owner_chats (platform, chat_id, name, bound_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (platform, chat_id) DO UPDATE SET name = $3, bound_at = NOW()
        """, platform, str(chat_id), name or "")
    logger.info(f"owner_notify: чат владельца привязан ({platform})")
    return True


async def owner_chats(db) -> List[dict]:
    try:
        async with db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT platform, chat_id, name, bound_at FROM fredi_owner_chats ORDER BY bound_at")
        return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"owner_notify: чатов нет ({e})")
        return []


async def send_to_owner(db, text: str) -> int:
    """Шлёт во все привязанные чаты владельца. Возвращает, во сколько дошло."""
    from services.subscription_notify import _send_max
    sent = 0
    for c in await owner_chats(db):
        if c["platform"] == "max":
            try:
                if await _send_max(c["chat_id"], text):
                    sent += 1
            except Exception as e:
                logger.warning(f"owner_notify: MAX не принял: {e}")
    if not sent:
        logger.warning("owner_notify: сообщение владельцу не доставлено (нет чата или MAX не принял)")
    return sent


async def _who(db, user_id: int) -> str:
    """Есть ли аккаунт и когда пришёл — без имени и почты."""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT (u.email IS NOT NULL AND u.email <> '') AS acc, "
                "       (SELECT MIN(m.created_at) FROM fredi_messages m "
                "         WHERE m.user_id = u.user_id AND m.role = 'user') AS first_seen, "
                "       (SELECT COUNT(*) FROM fredi_messages m "
                "         WHERE m.user_id = u.user_id AND m.role = 'user') AS turns "
                "FROM fredi_users u WHERE u.user_id = $1", int(user_id))
        if not row:
            return ""
        parts = ["с аккаунтом" if row["acc"] else "без аккаунта"]
        if row["first_seen"]:
            first = row["first_seen"].astimezone(MSK)
            days = (datetime.now(MSK).date() - first.date()).days
            when = "сегодня" if days == 0 else ("вчера" if days == 1 else f"{days} дн. назад")
            parts.append(f"первое сообщение {when} ({first:%d.%m})")
        parts.append(f"реплик в разговорах {int(row['turns'] or 0)}")
        return ", ".join(parts)
    except Exception as e:
        logger.debug(f"owner_notify who skip: {e}")
        return ""


def payment_text(plan: str, amount, is_renewal: bool, user_id: int, who: str = "",
                 now: Optional[datetime] = None) -> str:
    now = (now or datetime.now(timezone.utc)).astimezone(MSK)
    try:
        rub = int(float(amount))
    except (TypeError, ValueError):
        rub = amount
    label = PLAN_LABEL.get(plan, plan or "подписка")
    kind = "продление" if is_renewal else "новая оплата"
    lines = [f"Оплата {rub} ₽ — {label}, {kind}",
             f"{now:%d.%m %H:%M} МСК, человек …{str(user_id)[-4:]}"]
    if who:
        lines.append(who)
    return "\n".join(lines)


async def notify_payment(db, user_id: int, plan: str, amount, is_renewal: bool) -> int:
    try:
        text = payment_text(plan, amount, is_renewal, user_id, await _who(db, user_id))
        return await send_to_owner(db, text)
    except Exception as e:
        logger.warning(f"owner_notify: оплата не отправлена владельцу: {e}")
        return 0


def register_owner_notify_routes(app, db):
    from fastapi import Request

    def _gate(request: Request):
        # Гейт тот же, что у остальных админ-ручек.
        import sys
        _main = sys.modules.get("main") or sys.modules.get("__main__")
        _main._require_admin_token(request)

    @app.get("/api/admin/owner-notify")
    async def owner_notify_status(request: Request):
        """Ссылка привязки и сколько чатов владельца привязано."""
        _gate(request)
        chats = await owner_chats(db)
        return {"bind_link": bind_link(), "chats": len(chats),
                "bound_at": [str(c["bound_at"]) for c in chats]}

    @app.post("/api/admin/owner-notify/test")
    async def owner_notify_test(request: Request):
        _gate(request)
        sent = await send_to_owner(
            db, "Проверка: сюда будут приходить оплаты Фреди — проба, месяц, три месяца и продления.")
        return {"sent": sent}

    @app.delete("/api/admin/owner-notify")
    async def owner_notify_unbind(request: Request):
        _gate(request)
        await ensure_table(db)
        async with db.get_connection() as conn:
            await conn.execute("DELETE FROM fredi_owner_chats")
        return {"ok": True}

    @app.get("/api/admin/owner-notify/max")
    async def owner_notify_max_state(request: Request):
        """Куда MAX шлёт события бота и доходили ли они до сервера.
        Токен бота наружу не отдаётся — только адреса подписок."""
        _gate(request)
        import httpx
        from services import bot_service
        token = (os.environ.get("MAX_TOKEN") or "").strip()
        out = {"max_token_set": bool(token),
               "backend_url_env": bot_service.BACKEND_URL,
               "recent_updates": list(bot_service.RECENT_MAX_UPDATES)}
        if token:
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.get("https://platform-api.max.ru/subscriptions",
                                         headers={"Authorization": token})
                out["subscriptions_status"] = r.status_code
                subs = (r.json() or {}).get("subscriptions", []) if r.status_code == 200 else []
                out["subscriptions"] = [{"url": x.get("url"), "update_types": x.get("update_types"),
                                         "time": x.get("time")} for x in subs]
            except Exception as ex:
                out["subscriptions_error"] = str(ex)[:200]
        return out

    @app.post("/api/admin/owner-notify/max/subscribe")
    async def owner_notify_max_subscribe(request: Request):
        """Направить события бота MAX на этот сервер. Тело: {"url": ...}."""
        _gate(request)
        import httpx
        body = await request.json()
        url = (body.get("url") or "").strip()
        if not url.startswith("https://") or not url.endswith("/api/max/webhook"):
            return {"ok": False, "error": "url должен быть https://…/api/max/webhook"}
        token = (os.environ.get("MAX_TOKEN") or "").strip()
        if not token:
            return {"ok": False, "error": "MAX_TOKEN не задан"}
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post("https://platform-api.max.ru/subscriptions",
                                  json={"url": url, "update_types": ["bot_started", "message_created"]},
                                  headers={"Authorization": token})
        return {"ok": r.status_code in (200, 201), "status": r.status_code, "body": r.text[:300]}

    async def init():
        await ensure_table(db)

    return init
