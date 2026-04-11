"""
payment.py — YooKassa payment service for Fredi subscription.
Recurring payments: first payment saves card, then autopay.
"""

import os
import logging
import uuid
import base64
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
        
        # Логируем наличие ключей (без показа самих ключей)
        logger.info(f"PaymentService initialized: shop_id={'yes' if self.shop_id else 'no'}, secret_key={'yes' if self.secret_key else 'no'}")

    def _get_auth_header(self) -> str:
        """Формирует Basic Auth заголовок для YooKassa API"""
        auth_string = f"{self.shop_id}:{self.secret_key}"
        auth_b64 = base64.b64encode(auth_string.encode()).decode()
        return f"Basic {auth_b64}"

    def _idempotence_key(self) -> str:
        return str(uuid.uuid4())

    async def create_subscription_payment(
        self,
        user_id: int,
        return_url: str,
    ) -> Dict[str, Any]:
        """Создает первый платеж с сохранением способа оплаты"""
        if not self.shop_id or not self.secret_key:
            logger.error("YooKassa credentials not configured!")
            return {"success": False, "error": "Payment system not configured. Please contact support."}

        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "save_payment_method": True,  # ← КЛЮЧЕВОЙ ПАРАМЕТР для сохранения карты
            "description": f"Подписка Фреди — {SUBSCRIPTION_AMOUNT} руб/мес",
            "metadata": {"user_id": str(user_id), "type": "subscription_first"},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{YOOKASSA_API_URL}/payments",
                    json=payment_data,
                    headers={
                        "Authorization": self._get_auth_header(),
                        "Idempotence-Key": self._idempotence_key(),
                        "Content-Type": "application/json",
                    },
                )
                
                if resp.status_code != 200:
                    logger.error(f"YooKassa API error: {resp.status_code}")
                    logger.error(f"Response: {resp.text}")
                    
                    if resp.status_code == 403:
                        return {
                            "success": False,
                            "error": "Ошибка аутентификации платежной системы. Пожалуйста, сообщите администратору."
                        }
                    
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
                    f"Подписка Фреди — {SUBSCRIPTION_AMOUNT} руб/мес")

            logger.info(f"Payment created: {yookassa_id} for user {user_id}")
            return {
                "success": True,
                "payment_id": yookassa_id,
                "confirmation_url": confirmation_url,
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"YooKassa API error: {e.response.status_code} {e.response.text}")
            return {"success": False, "error": f"Ошибка платежной системы: {e.response.status_code}"}
        except Exception as e:
            logger.error(f"Payment creation error: {e}")
            return {"success": False, "error": str(e)}

    async def charge_recurring(
        self,
        user_id: int,
        payment_method_id: str,
    ) -> Dict[str, Any]:
        """Автоматическое списание по сохраненной карте"""
        if not self.shop_id or not self.secret_key:
            logger.error("YooKassa credentials missing!")
            return {"success": False, "error": "Payment system not configured"}
        
        if not payment_method_id:
            logger.error(f"No payment_method_id for user {user_id}")
            return {"success": False, "error": "No saved payment method"}

        logger.info(f"Creating recurring payment for user {user_id} with payment_method_id: {payment_method_id[:12]}...")

        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "payment_method_id": payment_method_id,  # ← КЛЮЧЕВОЙ ПАРАМЕТР для автоплатежа
            "description": "Автопродление подписки Фреди",
            "metadata": {"user_id": str(user_id), "type": "subscription_recurring"},
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{YOOKASSA_API_URL}/payments",
                    json=payment_data,
                    headers={
                        "Authorization": self._get_auth_header(),
                        "Idempotence-Key": self._idempotence_key(),
                        "Content-Type": "application/json",
                    },
                )
                
                # Логируем ошибку подробно
                if resp.status_code != 200:
                    logger.error(f"YooKassa API error: {resp.status_code}")
                    logger.error(f"Response body: {resp.text}")
                    
                    if resp.status_code == 403:
                        return {
                            "success": False,
                            "error": "Ошибка авторизации платежной системы. Проверьте настройки API ключей."
                        }
                    elif resp.status_code == 400:
                        try:
                            error_data = resp.json()
                            error_code = error_data.get("code", "unknown")
                            error_desc = error_data.get("description", "Unknown error")
                            
                            if "insufficient_funds" in error_desc.lower():
                                return {"success": False, "error": "Недостаточно средств на карте"}
                            elif "expired_card" in error_desc.lower():
                                return {"success": False, "error": "Срок действия карты истек"}
                            elif "blocked" in error_desc.lower():
                                return {"success": False, "error": "Карта заблокирована"}
                            else:
                                return {"success": False, "error": f"Ошибка платежа: {error_desc}"}
                        except:
                            pass
                    
                    resp.raise_for_status()
                
                result = resp.json()

            yookassa_id = result["id"]
            status = result["status"]

            # Сохраняем платеж в БД
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_payments (user_id, yookassa_id, amount, status, payment_type, description)
                    VALUES ($1, $2, $3, $4, 'subscription_recurring', $5)
                    ON CONFLICT (yookassa_id) DO NOTHING
                """, user_id, yookassa_id, float(SUBSCRIPTION_AMOUNT), status,
                    "Автопродление подписки Фреди")

            logger.info(f"Recurring payment {yookassa_id}: {status} for user {user_id}")

            # Если платеж успешен, обновляем подписку
            if status == "succeeded":
                await self._extend_subscription(user_id)
                return {"success": True, "payment_id": yookassa_id, "status": status}
            elif status == "pending":
                logger.warning(f"Recurring payment {yookassa_id} is pending - may require 3DS")
                return {"success": False, "error": "Платеж требует подтверждения", "status": "pending"}
            else:
                return {"success": False, "error": f"Статус платежа: {status}"}

        except httpx.HTTPStatusError as e:
            logger.error(f"Recurring payment HTTP error: {e.response.status_code}")
            return {"success": False, "error": f"Ошибка платежной системы: {e.response.status_code}"}
        except Exception as e:
            logger.error(f"Recurring payment error for user {user_id}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _extend_subscription(self, user_id: int):
        """Продление подписки после успешного платежа"""
        async with self.db.get_connection() as conn:
            now = datetime.utcnow()
            row = await conn.fetchrow("""
                SELECT expires_at FROM fredi_subscriptions
                WHERE user_id = $1 AND status = 'active'
            """, user_id)
            
            if row and row["expires_at"] and row["expires_at"] > now:
                new_expires = row["expires_at"] + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                logger.info(f"Extending subscription for user {user_id} from {row['expires_at']} to {new_expires}")
            else:
                new_expires = now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                logger.info(f"Creating new subscription for user {user_id} until {new_expires}")
            
            await conn.execute("""
                INSERT INTO fredi_subscriptions (user_id, status, started_at, expires_at, auto_renew)
                VALUES ($1, 'active', $2, $3, TRUE)
                ON CONFLICT (user_id) DO UPDATE SET
                    status = 'active', 
                    expires_at = $3,
                    auto_renew = TRUE,
                    updated_at = NOW()
            """, user_id, now, new_expires)

    async def process_webhook(self, event: str, payment_obj: Dict) -> Dict[str, Any]:
        """Обработка входящих вебхуков от ЮKassa"""
        yookassa_id = payment_obj.get("id", "")
        status = payment_obj.get("status", "")
        metadata = payment_obj.get("metadata", {})
        user_id_str = metadata.get("user_id")
        
        # Обработка события привязки способа оплаты
        if event == "payment_method.active":
            payment_method = payment_obj
            payment_method_id = payment_method.get("id")
            user_id = int(metadata.get("user_id", 0)) if metadata.get("user_id") else None
            
            if user_id and payment_method_id:
                card_info = payment_method.get("card", {})
                card_last4 = card_info.get("last4", "****")
                card_type = card_info.get("card_type", "Unknown")
                
                async with self.db.get_connection() as conn:
                    await conn.execute("""
                        INSERT INTO fredi_payment_methods (user_id, payment_method_id, card_last4, card_type, is_active)
                        VALUES ($1, $2, $3, $4, TRUE)
                        ON CONFLICT (user_id) DO UPDATE SET
                            payment_method_id = $2, card_last4 = $3, card_type = $4,
                            is_active = TRUE, updated_at = NOW()
                    """, user_id, payment_method_id, card_last4, card_type)
                
                logger.info(f"Payment method {payment_method_id} saved for user {user_id}")
                return {"success": True, "event": "payment_method.active"}
        
        # Обработка успешного платежа
        if event == "payment.succeeded" and status == "succeeded":
            if not user_id_str:
                logger.warning(f"Webhook without user_id: {yookassa_id}")
                return {"success": False, "error": "No user_id in metadata"}
            
            user_id = int(user_id_str)
            payment_type = metadata.get("type", "subscription_first")
            
            async with self.db.get_connection() as conn:
                # Обновляем статус платежа
                await conn.execute("""
                    UPDATE fredi_payments SET status = $1, updated_at = NOW() 
                    WHERE yookassa_id = $2
                """, status, yookassa_id)
                
                # Сохраняем способ оплаты для первого платежа
                if payment_type == "subscription_first":
                    payment_method = payment_obj.get("payment_method", {})
                    payment_method_id = payment_method.get("id")
                    
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
                        
                        logger.info(f"Saved payment_method_id {payment_method_id} for user {user_id}")
                
                # Обновляем или создаем подписку
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
        
        # Обработка отмены платежа
        if event == "payment.canceled":
            logger.info(f"Payment canceled: {yookassa_id}")
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_payments SET status = 'canceled', updated_at = NOW()
                    WHERE yookassa_id = $1
                """, yookassa_id)
            return {"success": True, "status": "canceled"}
        
        return {"success": True, "event": event, "status": "ignored"}

    async def get_subscription_status(self, user_id: int) -> Dict[str, Any]:
        """Получить статус подписки пользователя"""
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
        """Включить/выключить автопродление"""
        async with self.db.get_connection() as conn:
            await conn.execute("""
                UPDATE fredi_subscriptions SET auto_renew = $1, updated_at = NOW() 
                WHERE user_id = $2
            """, enabled, user_id)
        logger.info(f"Auto-renew toggled to {enabled} for user {user_id}")
        return {"success": True, "auto_renew": enabled}

    async def process_renewals(self) -> Dict[str, Any]:
        """Ежедневная задача для обработки автопродлений"""
        renewed = 0
        failed = 0
        
        async with self.db.get_connection() as conn:
            # Находим подписки, которые истекают в ближайшие 24 часа
            rows = await conn.fetch("""
                SELECT s.user_id, pm.payment_method_id
                FROM fredi_subscriptions s
                JOIN fredi_payment_methods pm ON pm.user_id = s.user_id AND pm.is_active = TRUE
                WHERE s.auto_renew = TRUE 
                  AND s.status = 'active' 
                  AND s.expires_at <= NOW() + INTERVAL '1 day'
                  AND s.expires_at > NOW() - INTERVAL '1 day'
            """)
        
        logger.info(f"Found {len(rows)} subscriptions to renew")
        
        for row in rows:
            logger.info(f"Processing renewal for user {row['user_id']}")
            result = await self.charge_recurring(row["user_id"], row["payment_method_id"])
            
            if result.get("success"):
                renewed += 1
                logger.info(f"✅ Renewal successful for user {row['user_id']}")
            else:
                failed += 1
                error = result.get("error", "Unknown error")
                logger.error(f"❌ Renewal failed for user {row['user_id']}: {error}")
                
                # Если ошибка связана с картой — отключаем автоплатежи
                if any(keyword in error.lower() for keyword in ["недостаточно средств", "истек", "заблокирована"]):
                    async with self.db.get_connection() as conn:
                        await conn.execute("""
                            UPDATE fredi_subscriptions SET auto_renew = FALSE, updated_at = NOW()
                            WHERE user_id = $1
                        """, row["user_id"])
                    logger.info(f"Auto-renew disabled for user {row['user_id']} due to payment failure")
        
        logger.info(f"Renewals processed: {renewed} ok, {failed} failed")
        return {"renewed": renewed, "failed": failed}
