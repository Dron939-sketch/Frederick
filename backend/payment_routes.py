"""
payment_routes.py — FastAPI эндпоинты подписки, миграции таблиц и фоновая задача.
Подключается из main.py: from payment_routes import register_payment_routes
"""

import asyncio
import json
import logging
from typing import Dict

from fastapi import Request

logger = logging.getLogger(__name__)


async def init_payment_tables(db):
    """Создание таблиц платежей и подписок (вызывать из init_database_tables)."""
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
    logger.info("Payment tables created/verified")


def register_payment_routes(app, db, payment_service, limiter, log_event_fn):
    """Регистрирует все эндпоинты подписки на FastAPI app."""

    @app.post("/api/subscription/create-payment")
    @limiter.limit("10/minute")
    async def create_subscription_payment(request: Request):
        """Создаёт платёж 690 руб с сохранением карты для рекуррентных списаний."""
        try:
            data = await request.json()
            user_id = data.get("user_id")
            return_url = data.get("return_url", "https://fredi-frontend.onrender.com")
            if not user_id:
                return {"success": False, "error": "user_id required"}

            async with db.get_connection() as conn:
                await conn.execute(
                    "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                    "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                    int(user_id)
                )

            result = await payment_service.create_subscription_payment(int(user_id), return_url)
            if result["success"]:
                await log_event_fn(int(user_id), "subscription_payment_created", {
                    "payment_id": result["payment_id"]
                })
            return result
        except Exception as e:
            logger.error(f"create_subscription_payment error: {e}")
            return {"success": False, "error": str(e)}

    @app.get("/api/subscription/status/{user_id}")
    @limiter.limit("30/minute")
    async def get_subscription_status(request: Request, user_id: int):
        """Возвращает статус подписки пользователя."""
        try:
            return await payment_service.get_subscription_status(user_id)
        except Exception as e:
            logger.error(f"get_subscription_status error: {e}")
            return {"has_subscription": False, "status": "error", "card": None}

    @app.post("/api/subscription/toggle-auto-renew")
    @limiter.limit("10/minute")
    async def toggle_auto_renew(request: Request):
        """Включает/выключает автопродление подписки."""
        try:
            data = await request.json()
            user_id = data.get("user_id")
            enabled = data.get("enabled", True)
            if not user_id:
                return {"success": False, "error": "user_id required"}
            result = await payment_service.toggle_auto_renew(int(user_id), bool(enabled))
            await log_event_fn(int(user_id), "auto_renew_toggled", {"enabled": enabled})
            return result
        except Exception as e:
            logger.error(f"toggle_auto_renew error: {e}")
            return {"success": False, "error": str(e)}

    @app.post("/api/yookassa-webhook")
    async def yookassa_webhook(request: Request):
        """Webhook от YooKassa — обработка статуса платежа."""
        try:
            body = await request.json()
            event = body.get("event", "")
            payment_obj = body.get("object", {})
            logger.info(f"YooKassa webhook: event={event}, id={payment_obj.get('id')}")
            await payment_service.process_webhook(event, payment_obj)
            return {"success": True}
        except Exception as e:
            logger.error(f"yookassa_webhook error: {e}")
            return {"success": False, "error": str(e)}

    logger.info("Payment routes registered")


async def subscription_renewal_scheduler(payment_service):
    """Фоновая задача: раз в день проверяет и продлевает подписки."""
    await asyncio.sleep(60)
    while True:
        try:
            if payment_service:
                result = await payment_service.process_renewals()
                logger.info(f"Subscription renewals: {result}")
        except Exception as e:
            logger.error(f"subscription_renewal_scheduler error: {e}")
        await asyncio.sleep(86400)
