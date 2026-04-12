"""
payment_routes.py — API endpoints for YooKassa subscription payments.
Usage: register_payment_routes(app, db, limiter)
"""

import asyncio
import json
import logging
import hashlib
import hmac
import os
from fastapi import Request

from payment import PaymentService

logger = logging.getLogger(__name__)

payment_service = None

# Webhook secret for YooKassa signature verification (optional)
YOOKASSA_WEBHOOK_SECRET = os.environ.get("YOOKASSA_WEBHOOK_SECRET", "").strip()

# Valid user_id range
MIN_USER_ID = 1
MAX_USER_ID = 10**15  # timestamp-based IDs can be large

# Max return_url length
MAX_URL_LENGTH = 500


def _validate_user_id(user_id):
    """Validate and sanitize user_id. Returns int or None."""
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
    """Validate return URL — must be http(s) and reasonable length."""
    if not url or not isinstance(url, str):
        return "https://fredi-frontend.onrender.com"
    url = url.strip()[:MAX_URL_LENGTH]
    if not url.startswith(("https://", "http://")):
        return "https://fredi-frontend.onrender.com"
    return url


def register_payment_routes(app, db, limiter):
    """Register payment endpoints on FastAPI app."""
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
        logger.info("Payment tables ready")

    @app.post("/api/subscription/create-payment")
    @limiter.limit("3/minute")
    async def create_subscription_payment(request: Request):
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            return_url = _validate_return_url(data.get("return_url"))
            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                    "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                    user_id
                )
            result = await payment_service.create_subscription_payment(user_id, return_url)
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
        """Delete saved payment method (unlink card)."""
        try:
            data = await request.json()
            user_id = _validate_user_id(data.get("user_id"))
            if not user_id:
                return {"success": False, "error": "invalid user_id"}
            async with db.get_connection() as conn:
                await conn.execute(
                    "UPDATE fredi_payment_methods SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1",
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

    @app.post("/api/yookassa-webhook")
    async def yookassa_webhook(request: Request):
        try:
            body_bytes = await request.body()
            if len(body_bytes) > 50000:
                return {"success": False, "error": "payload too large"}
            body = json.loads(body_bytes)
            event = body.get("event", "")
            payment_obj = body.get("object", {})
            if not event or not isinstance(payment_obj, dict):
                return {"success": False, "error": "invalid webhook format"}
            logger.info(f"YooKassa webhook: event={event}, id={payment_obj.get('id')}")
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

    return init_payment_tables, subscription_renewal_scheduler
