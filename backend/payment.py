"""
payment.py — YooKassa payment service for Fredi subscription.
Recurring payments: first payment saves card, then autopay.
"""

import os
import logging
import uuid
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

YOOKASSA_API_URL = "https://api.yookassa.ru/v3"
SUBSCRIPTION_AMOUNT = "690.00"
SUBSCRIPTION_CURRENCY = "RUB"
SUBSCRIPTION_PERIOD_DAYS = 30


class PaymentService:
    """YooKassa API service"""

    def __init__(self, db):
        self.db = db
        self.shop_id = os.environ.get("YOOKASSA_SHOP_ID", "")
        self.secret_key = os.environ.get("YOOKASSA_SECRET_KEY", "")

    def _auth(self) -> tuple:
        return (self.shop_id, self.secret_key)

    def _idempotence_key(self) -> str:
        return str(uuid.uuid4())

    async def create_subscription_payment(
        self,
        user_id: int,
        return_url: str,
    ) -> Dict[str, Any]:
        if not self.shop_id or not self.secret_key:
            return {"success": False, "error": "YooKassa credentials not configured"}

        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "save_payment_method": True,
            "description": "Podpiska Fredi — 690 RUB/month",
            "metadata": {"user_id": str(user_id), "type": "subscription"},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{YOOKASSA_API_URL}/payments",
                    json=payment_data,
                    auth=self._auth(),
                    headers={"Idempotence-Key": self._idempotence_key()},
                )
                resp.raise_for_status()
                result = resp.json()

            yookassa_id = result["id"]
            confirmation_url = result["confirmation"]["confirmation_url"]

            async with self.db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_payments (user_id, yookassa_id, amount, status, payment_type, description)
                    VALUES ($1, $2, $3, 'pending', 'subscription_first', $4)
                    ON CONFLICT (yookassa_id) DO NOTHING
                """, user_id, yookassa_id, float(SUBSCRIPTION_AMOUNT),
                    "Podpiska Fredi — 690 RUB/month")

            logger.info(f"Payment created: {yookassa_id} for user {user_id}")
            return {
                "success": True,
                "payment_id": yookassa_id,
                "confirmation_url": confirmation_url,
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"YooKassa API error: {e.response.status_code} {e.response.text}")
            return {"success": False, "error": f"YooKassa error: {e.response.status_code}"}
        except Exception as e:
            logger.error(f"Payment creation error: {e}")
            return {"success": False, "error": str(e)}

    async def charge_recurring(
        self,
        user_id: int,
        payment_method_id: str,
    ) -> Dict[str, Any]:
        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "payment_method_id": payment_method_id,
            "description": "Auto-renewal Fredi subscription",
            "metadata": {"user_id": str(user_id), "type": "subscription_recurring"},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{YOOKASSA_API_URL}/payments",
                    json=payment_data,
                    auth=self._auth(),
                    headers={"Idempotence-Key": self._idempotence_key()},
                )
                resp.raise_for_status()
                result = resp.json()

            yookassa_id = result["id"]
            status = result["status"]

            async with self.db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_payments (user_id, yookassa_id, amount, status, payment_type, description)
                    VALUES ($1, $2, $3, $4, 'subscription_recurring', $5)
                    ON CONFLICT (yookassa_id) DO NOTHING
                """, user_id, yookassa_id, float(SUBSCRIPTION_AMOUNT), status,
                    "Auto-renewal Fredi subscription")

            logger.info(f"Recurring payment {yookassa_id}: {status} for user {user_id}")
            return {"success": True, "payment_id": yookassa_id, "status": status}

        except Exception as e:
            logger.error(f"Recurring payment error for user {user_id}: {e}")
            return {"success": False, "error": str(e)}

    async def process_webhook(self, event: str, payment_obj: Dict) -> Dict[str, Any]:
        yookassa_id = payment_obj.get("id", "")
        status = payment_obj.get("status", "")
        metadata = payment_obj.get("metadata", {})
        user_id_str = metadata.get("user_id")
        payment_method = payment_obj.get("payment_method", {})
        payment_method_id = payment_method.get("id") if payment_method.get("saved") else None

        if not user_id_str:
            logger.warning(f"Webhook without user_id: {yookassa_id}")
            return {"success": False, "error": "No user_id in metadata"}

        user_id = int(user_id_str)

        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_payments SET status = $1, updated_at = NOW() WHERE yookassa_id = $2
            """, status, yookassa_id)

            if event == "payment.succeeded" and status == "succeeded":
                if payment_method_id:
                    card_info = payment_method.get("card", {})
                    card_last4 = card_info.get("last4", "****")
                    card_type = card_info.get("card_type", "Unknown")
                    await conn.execute("""
                        INSERT INTO fredi_payment_methods (user_id, payment_method_id, card_last4, card_type, is_active)
                        VALUES ($1, $2, $3, $4, TRUE)
                        ON CONFLICT (user_id) DO UPDATE SET
                            payment_method_id = $2, card_last4 = $3, card_type = $4,
                            is_active = TRUE, updated_at = NOW()
                    """, user_id, payment_method_id, card_last4, card_type)

                now = datetime.utcnow()
                row = await conn.fetchrow("""
                    SELECT expires_at FROM fredi_subscriptions
                    WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
                """, user_id)

                if row:
                    new_expires = row["expires_at"] + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                    await conn.execute("""
                        UPDATE fredi_subscriptions SET expires_at = $1, updated_at = NOW()
                        WHERE user_id = $2 AND status = 'active'
                    """, new_expires, user_id)
                else:
                    new_expires = now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                    await conn.execute("""
                        INSERT INTO fredi_subscriptions (user_id, status, started_at, expires_at, auto_renew)
                        VALUES ($1, 'active', $2, $3, TRUE)
                        ON CONFLICT (user_id) DO UPDATE SET
                            status = 'active', started_at = $2, expires_at = $3,
                            auto_renew = TRUE, updated_at = NOW()
                    """, user_id, now, new_expires)

                logger.info(f"Subscription activated for user {user_id} until {new_expires}")
                return {"success": True, "user_id": user_id, "expires_at": str(new_expires)}

            elif event == "payment.canceled":
                logger.info(f"Payment canceled: {yookassa_id}")
                return {"success": True, "status": "canceled"}

        return {"success": True, "status": status}

    async def get_subscription_status(self, user_id: int) -> Dict[str, Any]:
        async with self.db.get_connection() as conn:
            sub = await conn.fetchrow("""
                SELECT status, started_at, expires_at, auto_renew
                FROM fredi_subscriptions WHERE user_id = $1
                ORDER BY expires_at DESC LIMIT 1
            """, user_id)
            card = await conn.fetchrow("""
                SELECT card_last4, card_type
                FROM fredi_payment_methods WHERE user_id = $1 AND is_active = TRUE
            """, user_id)

        if not sub:
            return {"has_subscription": False, "status": "none", "card": None}

        is_active = (
            sub["status"] == "active"
            and sub["expires_at"]
            and sub["expires_at"] > datetime.utcnow()
        )

        return {
            "has_subscription": is_active,
            "status": "active" if is_active else "expired",
            "started_at": str(sub["started_at"]) if sub["started_at"] else None,
            "expires_at": str(sub["expires_at"]) if sub["expires_at"] else None,
            "auto_renew": sub["auto_renew"],
            "card": {"last4": card["card_last4"], "type": card["card_type"]} if card else None,
        }

    async def toggle_auto_renew(self, user_id: int, enabled: bool) -> Dict[str, Any]:
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_subscriptions SET auto_renew = $1, updated_at = NOW() WHERE user_id = $2
            """, enabled, user_id)
        return {"success": True, "auto_renew": enabled}

    async def process_renewals(self) -> Dict[str, Any]:
        renewed = 0
        failed = 0
        async with self.db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT s.user_id, pm.payment_method_id
                FROM fredi_subscriptions s
                JOIN fredi_payment_methods pm ON pm.user_id = s.user_id AND pm.is_active = TRUE
                WHERE s.auto_renew = TRUE AND s.status = 'active' AND s.expires_at <= NOW()
            """)
        for row in rows:
            result = await self.charge_recurring(row["user_id"], row["payment_method_id"])
            if result["success"]:
                renewed += 1
            else:
                failed += 1
                async with self.db.get_connection() as conn:
                    await conn.execute("""
                        UPDATE fredi_subscriptions SET status = 'expired', updated_at = NOW()
                        WHERE user_id = $1
                    """, row["user_id"])
        logger.info(f"Renewals processed: {renewed} ok, {failed} failed")
        return {"renewed": renewed, "failed": failed}
