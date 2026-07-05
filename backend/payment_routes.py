"""
payment_routes.py — API endpoints for YooKassa subscription payments.
Usage: register_payment_routes(app, db, limiter)
"""

import asyncio
import ipaddress
import json
import logging
import hashlib
import hmac
import os
from fastapi import Request

from payment import PaymentService

logger = logging.getLogger(__name__)

payment_service = None
_pending_poller_task = None

YOOKASSA_WEBHOOK_SECRET = os.environ.get("YOOKASSA_WEBHOOK_SECRET", "").strip()

MIN_USER_ID = 1
MAX_USER_ID = 10**15
MAX_URL_LENGTH = 500

YOOKASSA_IPS = {
    "185.71.76.0/27", "185.71.77.0/27", "77.75.153.0/25",
    "77.75.156.11", "77.75.156.35", "77.75.154.128/25",
    "2a02:5180::/32",
}


def _validate_user_id(user_id):
    if user_id is None:
        return None
    try:
        uid = int(user_id)
        if uid < MIN_USER_ID or uid > MAX_USER_ID:
            return None
        return uid
    except (ValueError, TypeError, OverflowError):
        return None


def _validate_return_url(url):
    if not url or not isinstance(url, str):
        return "https://fredi-frontend.onrender.com"
    url = url.strip()[:MAX_URL_LENGTH]
    if not url.startswith(("https://", "http://")):
        return "https://fredi-frontend.onrender.com"
    return url


def _check_ip_trusted(client_ip):
    try:
        client_addr = ipaddress.ip_address(client_ip)
        for cidr in YOOKASSA_IPS:
            try:
                if client_addr in ipaddress.ip_network(cidr, strict=False):
                    return True
            except ValueError:
                if client_ip == cidr:
                    return True
    except ValueError:
        pass
    return False


def register_payment_routes(app, db, limiter):
    global payment_service
    payment_service = PaymentService(db)
    logger.info("PaymentService initialized")

    async def init_payment_tables():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_payments (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    yookassa_id TEXT UNIQUE NOT NULL,
                    amount NUMERIC(10,2) NOT NULL DEFAULT 690.00,
                    status TEXT NOT NULL DEFAULT 'pending',
                    payment_type TEXT NOT NULL DEFAULT 'subscription_first',
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_subscriptions (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT UNIQUE NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    started_at TIMESTAMP WITH TIME ZONE,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    auto_renew BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_payment_methods (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT UNIQUE NOT NULL,
                    payment_method_id TEXT NOT NULL,
                    card_last4 TEXT DEFAULT '****',
                    card_type TEXT DEFAULT 'Unknown',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_payments_user ON fredi_payments(user_id, created_at DESC)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_payments_yookassa ON fredi_payments(yookassa_id)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_subscriptions_user ON fredi_subscriptions(user_id)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_fredi_subscriptions_expires ON fredi_subscriptions(expires_at) WHERE status = 'active' AND auto_renew = TRUE")
            # Add email/phone columns for receipts (54-FZ)
            await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS email TEXT")
            await conn.execute("ALTER TABLE fredi_users ADD COLUMN IF NOT EXISTS phone TEXT")
            # Отвязка карты обнуляет токен (требование ЮKassa) — колонка
            # должна допускать NULL
            await conn.execute("ALTER TABLE fredi_payment_methods ALTER COLUMN payment_method_id DROP NOT NULL")
        logger.info("Payment tables ready")

        # Стартуем фоновый поллинг pending-платежей здесь, чтобы не
        # требовать ручной правки lifespan в main.py. Один раз за время
        # жизни приложения.
        global _pending_poller_task
        if _pending_poller_task is None or _pending_poller_task.done():
            try:
                _pending_poller_task = asyncio.create_task(pending_payments_poller())
                logger.info("pending_payments_poller started")
            except Exception as e:
                logger.error(f"failed to start pending_payments_poller: {e}")

    @app.post("/api/subscription/create-payment")
    @limiter.limit("3/minute")
    async def create_subscription_payment(request: Request):
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            return_url = _validate_return_url(data.get("return_url"))

            customer_email = data.get("email", "").strip()[:100] if data.get("email") else None
            customer_phone = data.get("phone", "").strip()[:20] if data.get("phone") else None
            if not customer_email and not customer_phone:
                return {"success": False, "error": "Необходимо указать email или телефон для чека"}

            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                    "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                    user_id
                )
                if customer_email:
                    await conn.execute(
                        "UPDATE fredi_users SET email = $2, updated_at = NOW() WHERE user_id = $1",
                        user_id, customer_email
                    )
                if customer_phone:
                    await conn.execute(
                        "UPDATE fredi_users SET phone = $2, updated_at = NOW() WHERE user_id = $1",
                        user_id, customer_phone
                    )

            # Идемпотентность: если за последние 10 минут уже создан
            # pending-платёж за эту же подписку — отдаём его confirmation_url
            # вместо создания нового. Это страховка от тройного списания,
            # когда фронт по какой-то причине дёрнул endpoint несколько раз.
            try:
                async with db.get_connection() as conn:
                    existing = await conn.fetchrow(
                        """
                        SELECT yookassa_id, created_at
                        FROM fredi_payments
                        WHERE user_id = $1
                          AND payment_type = 'subscription_first'
                          AND status IN ('pending', 'waiting_for_capture')
                          AND created_at > NOW() - INTERVAL '10 minutes'
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                        user_id,
                    )
                if existing:
                    existing_id = existing["yookassa_id"]
                    payment_obj = await payment_service._fetch_payment(existing_id)
                    if payment_obj:
                        yk_status = payment_obj.get("status")
                        conf = (payment_obj.get("confirmation") or {}).get(
                            "confirmation_url"
                        )
                        if (
                            yk_status in ("pending", "waiting_for_capture")
                            and conf
                        ):
                            logger.info(
                                "Returning existing pending payment "
                                f"{existing_id} for user {user_id} (dedupe)"
                            )
                            return {
                                "success": True,
                                "payment_id": existing_id,
                                "confirmation_url": conf,
                                "deduplicated": True,
                            }
            except Exception as dedupe_err:
                # Не блокируем создание нового платежа из-за сбоя дедуп-проверки.
                logger.warning(
                    f"dedupe check failed for user {user_id}: {dedupe_err}"
                )

            result = await payment_service.create_subscription_payment(
                user_id, return_url,
                customer_email=customer_email,
                customer_phone=customer_phone,
            )
            if result["success"]:
                async with db.get_connection() as conn:
                    await conn.execute(
                        "INSERT INTO fredi_events (user_id, event_type, event_data) VALUES ($1, $2, $3)",
                        user_id, "subscription_payment_created",
                        json.dumps({"payment_id": result["payment_id"]})
                    )
            return result
        except json.JSONDecodeError:
            return {"success": False, "error": "invalid JSON"}
        except Exception as e:
            logger.error(f"create_subscription_payment error: {e}")
            return {"success": False, "error": "internal error"}

    @app.get("/api/subscription/status/{user_id}")
    @limiter.limit("15/minute")
    async def get_subscription_status(request: Request, user_id: int):
        try:
            uid = _validate_user_id(user_id)
            if not uid:
                return {"has_subscription": False, "status": "invalid", "card": None}
            return await payment_service.get_subscription_status(uid)
        except Exception as e:
            logger.error(f"get_subscription_status error: {e}")
            return {"has_subscription": False, "status": "error", "card": None}

    @app.post("/api/subscription/toggle-auto-renew")
    @limiter.limit("5/minute")
    async def toggle_auto_renew(request: Request):
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            enabled = bool(data.get("enabled", True))
            result = await payment_service.toggle_auto_renew(user_id, enabled)
            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_events (user_id, event_type, event_data) VALUES ($1, $2, $3)",
                    user_id, "auto_renew_toggled", json.dumps({"enabled": enabled})
                )
            return result
        except json.JSONDecodeError:
            return {"success": False, "error": "invalid JSON"}
        except Exception as e:
            logger.error(f"toggle_auto_renew error: {e}")
            return {"success": False, "error": "internal error"}

    @app.post("/api/subscription/delete-card")
    @limiter.limit("3/minute")
    async def delete_saved_card(request: Request):
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            async with db.get_connection() as conn:
                # Требование ЮKassa: при отвязке карты платёжный токен
                # удаляется из нашей системы, а не просто деактивируется.
                await conn.execute(
                    "UPDATE fredi_payment_methods SET is_active = FALSE, payment_method_id = NULL, updated_at = NOW() WHERE user_id = $1",
                    user_id
                )
                await conn.execute(
                    "UPDATE fredi_subscriptions SET auto_renew = FALSE, updated_at = NOW() WHERE user_id = $1",
                    user_id
                )
            logger.info(f"Card deleted for user {user_id}")
            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_events (user_id, event_type, event_data) VALUES ($1, $2, $3)",
                    user_id, "card_deleted", json.dumps({})
                )
            return {"success": True}
        except json.JSONDecodeError:
            return {"success": False, "error": "invalid JSON"}
        except Exception as e:
            logger.error(f"delete_card error: {e}")
            return {"success": False, "error": "internal error"}

    @app.post("/api/subscription/verify-payment")
    @limiter.limit("20/minute")
    async def verify_subscription_payment(request: Request):
        """Fallback-проверка статуса платежа после возврата с YooKassa.
        Фронт дёргает этот endpoint с payment_id, чтобы активировать
        подписку, даже если webhook от YooKassa почему-то не пришёл —
        в этом и был баг, из-за которого у клиентки списались деньги,
        а план не активировался."""
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            payment_id = (data.get("payment_id") or "").strip()
            if not payment_id or len(payment_id) > 100:
                return {"success": False, "error": "invalid payment_id"}
            result = await payment_service.verify_payment(payment_id, expected_user_id=user_id)
            return result
        except json.JSONDecodeError:
            return {"success": False, "error": "invalid JSON"}
        except Exception as e:
            logger.error(f"verify_subscription_payment error: {e}")
            return {"success": False, "error": "internal error"}

    @app.post("/api/yookassa-webhook")
    async def yookassa_webhook(request: Request):
        try:
            body_bytes = await request.body()
            if len(body_bytes) > 50000:
                return {"success": False, "error": "payload too large"}

            client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
            ip_trusted = _check_ip_trusted(client_ip)

            if not ip_trusted:
                logger.warning(f"Webhook from untrusted IP: {client_ip}")
                # In production, uncomment to block untrusted IPs:
                # return {"success": False, "error": "forbidden"}

            body = json.loads(body_bytes)
            event = body.get("event", "")
            payment_obj = body.get("object", {})
            if not event or not isinstance(payment_obj, dict):
                return {"success": False, "error": "invalid webhook format"}
            logger.info(f"YooKassa webhook: event={event}, id={payment_obj.get('id')}, ip={client_ip}, trusted={ip_trusted}")
            await payment_service.process_webhook(event, payment_obj)
            return {"success": True}
        except json.JSONDecodeError:
            return {"success": False, "error": "invalid JSON"}
        except Exception as e:
            logger.error(f"yookassa_webhook error: {e}")
            return {"success": False, "error": "internal error"}

    async def subscription_renewal_scheduler():
        await asyncio.sleep(60)
        while True:
            try:
                if payment_service:
                    result = await payment_service.process_renewals()
                    logger.info(f"Subscription renewals: {result}")
            except Exception as e:
                logger.error(f"subscription_renewal_scheduler error: {e}")
            await asyncio.sleep(86400)

    async def pending_payments_poller():
        """Подбирает оплаченные платежи, для которых webhook не дошёл.
        Каждые 5 минут проходит по pending-записям в fredi_payments и
        тянет их статусы из YooKassa API. Если status=succeeded —
        автоматически активирует подписку через ту же логику, что и
        webhook. Это страховка, чтобы такие истории больше не повторялись."""
        await asyncio.sleep(90)
        while True:
            try:
                if payment_service:
                    await payment_service.poll_pending_payments()
            except Exception as e:
                logger.error(f"pending_payments_poller error: {e}")
            await asyncio.sleep(300)

    @app.get("/api/admin/users-premium")
    @limiter.limit("30/minute")
    async def admin_users_with_premium(request: Request):
        """Расширенный список последних пользователей с пометкой premium.
        Фронт админки (admin.js) дёргает этот endpoint, чтобы показать
        значок ⭐ PRO у тех, кто оплатил подписку. Делается через JOIN с
        fredi_subscriptions, чтобы не править main.py."""
        try:
            async with db.get_connection() as conn:
                rows = await conn.fetch("""
                    SELECT u.user_id, u.username, u.first_name, u.email,
                           u.last_activity, u.created_at,
                           s.status AS sub_status,
                           s.expires_at AS sub_expires_at,
                           s.auto_renew AS sub_auto_renew
                    FROM fredi_users u
                    LEFT JOIN fredi_subscriptions s ON s.user_id = u.user_id
                    ORDER BY u.last_activity DESC NULLS LAST
                    LIMIT 30
                """)
            from datetime import datetime as _dt
            users = []
            now_utc = _dt.utcnow()
            for r in rows:
                sub_expires = r['sub_expires_at']
                is_premium = bool(
                    r['sub_status'] == 'active'
                    and sub_expires is not None
                    and sub_expires > now_utc
                )
                users.append({
                    'user_id': r['user_id'],
                    'username': r['username'],
                    'first_name': r['first_name'],
                    'email': r['email'],
                    'last_activity': r['last_activity'].isoformat() if r['last_activity'] else '',
                    'created_at': r['created_at'].isoformat() if r['created_at'] else '',
                    'is_premium': is_premium,
                    'subscription_expires_at': sub_expires.isoformat() if sub_expires else None,
                    'subscription_auto_renew': bool(r['sub_auto_renew']) if r['sub_auto_renew'] is not None else None,
                })
            return {"success": True, "users": users}
        except Exception as e:
            logger.error(f"admin_users_with_premium error: {e}")
            return {"success": False, "error": "internal error"}

    @app.get("/api/admin/user-contacts/{user_id}")
    @limiter.limit("30/minute")
    async def admin_user_contacts(request: Request, user_id: int):
        """Возвращает все каналы доставки уведомлений конкретного юзера:
        email, привязки Telegram/MAX, наличие web-push подписки. Нужен,
        чтобы понять, дойдёт ли до юзера автоматическое сообщение об
        активации подписки (см. services/subscription_notify.py)."""
        try:
            uid = _validate_user_id(user_id)
            if not uid:
                return {"success": False, "error": "invalid user_id"}
            email = None
            phone = None
            first_name = None
            messenger_links = []
            push_count = 0
            sub_status = None
            sub_expires = None
            try:
                async with db.get_connection() as conn:
                    u = await conn.fetchrow(
                        "SELECT email, phone, first_name FROM fredi_users WHERE user_id = $1",
                        uid,
                    )
                    if u:
                        email = (u.get("email") or "").strip() or None
                        phone = (u.get("phone") or "").strip() or None
                        first_name = (u.get("first_name") or "").strip() or None
                    ml = await conn.fetch(
                        "SELECT platform, chat_id, username, is_active, linked_at "
                        "FROM fredi_messenger_links WHERE user_id = $1",
                        uid,
                    )
                    for r in ml:
                        messenger_links.append({
                            "platform": r["platform"],
                            "chat_id": str(r["chat_id"]) if r["chat_id"] is not None else None,
                            "username": r["username"],
                            "is_active": bool(r["is_active"]),
                            "linked_at": r["linked_at"].isoformat() if r["linked_at"] else None,
                        })
                    try:
                        push_count = await conn.fetchval(
                            "SELECT COUNT(*) FROM fredi_push_subscriptions "
                            "WHERE user_id = $1 AND is_active = TRUE",
                            uid,
                        ) or 0
                    except Exception:
                        push_count = 0
                    s = await conn.fetchrow(
                        "SELECT status, expires_at FROM fredi_subscriptions WHERE user_id = $1",
                        uid,
                    )
                    if s:
                        sub_status = s["status"]
                        sub_expires = s["expires_at"].isoformat() if s["expires_at"] else None
            except Exception as e:
                logger.error(f"admin_user_contacts db error: {e}")
                return {"success": False, "error": "db error"}

            return {
                "success": True,
                "user_id": uid,
                "first_name": first_name,
                "email": email,
                "phone": phone,
                "messenger_links": messenger_links,
                "active_telegram": any(
                    l["platform"] == "telegram" and l["is_active"] for l in messenger_links
                ),
                "active_max": any(
                    l["platform"] == "max" and l["is_active"] for l in messenger_links
                ),
                "push_subscriptions": int(push_count),
                "subscription_status": sub_status,
                "subscription_expires_at": sub_expires,
                "can_notify": bool(
                    email
                    or any(l["is_active"] for l in messenger_links)
                    or push_count
                ),
            }
        except Exception as e:
            logger.error(f"admin_user_contacts error: {e}")
            return {"success": False, "error": "internal error"}

    return init_payment_tables, subscription_renewal_scheduler
