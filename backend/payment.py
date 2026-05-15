"""
payment.py — YooKassa payment service for Fredi subscription.
Recurring payments: first payment saves card, then autopay.
"""

import asyncio
import os
import logging
import uuid
import base64
import httpx
from datetime import datetime, timedelta, timezone
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
        
        logger.info(f"PaymentService initialized: shop_id={'yes' if self.shop_id else 'no'}, secret_key={'yes' if self.secret_key else 'no'}")

    def _get_auth_header(self) -> str:
        auth_string = f"{self.shop_id}:{self.secret_key}"
        auth_b64 = base64.b64encode(auth_string.encode()).decode()
        return f"Basic {auth_b64}"

    def _idempotence_key(self) -> str:
        return str(uuid.uuid4())

    async def create_subscription_payment(
        self,
        user_id: int,
        return_url: str,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.shop_id or not self.secret_key:
            logger.error("YooKassa credentials not configured!")
            return {"success": False, "error": "Payment system not configured. Please contact support."}

        customer = {}
        if customer_email:
            customer["email"] = customer_email
        if customer_phone:
            customer["phone"] = customer_phone
        if not customer:
            logger.error(f"No customer email or phone for user {user_id}")
            return {"success": False, "error": "Для оплаты необходимо указать email или телефон"}

        description = f"Подписка Фреди — {SUBSCRIPTION_AMOUNT} руб/мес"

        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "save_payment_method": True,
            "description": description,
            "metadata": {"user_id": str(user_id), "type": "subscription_first"},
            "receipt": {
                "customer": customer,
                "items": [
                    {
                        "description": description,
                        "quantity": "1.00",
                        "amount": {
                            "value": SUBSCRIPTION_AMOUNT,
                            "currency": SUBSCRIPTION_CURRENCY,
                        },
                        "vat_code": 1,
                        "payment_mode": "full_payment",
                        "payment_subject": "service",
                    }
                ],
            },
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
            return {"success": False, "error": "Внутренняя ошибка платежной системы. Попробуйте позже."}

    async def charge_recurring(
        self,
        user_id: int,
        payment_method_id: str,
    ) -> Dict[str, Any]:
        if not self.shop_id or not self.secret_key:
            logger.error("YooKassa credentials missing!")
            return {"success": False, "error": "Payment system not configured"}

        if not payment_method_id:
            logger.error(f"No payment_method_id for user {user_id}")
            return {"success": False, "error": "No saved payment method"}

        logger.info(f"Creating recurring payment for user {user_id} with payment_method_id: {payment_method_id[:12]}...")

        description = "Автопродление подписки Фреди"

        customer = {}
        async with self.db.get_connection() as conn:
            row = await conn.fetchrow("""
                SELECT email, phone FROM fredi_users WHERE user_id = $1
            """, user_id)
            if row:
                if row.get("email"):
                    customer["email"] = row["email"]
                if row.get("phone"):
                    customer["phone"] = row["phone"]

        if not customer:
            logger.warning(f"No email/phone for recurring receipt, user {user_id}")
            customer = {"email": "noreply@meysternlp.ru"}

        payment_data = {
            "amount": {"value": SUBSCRIPTION_AMOUNT, "currency": SUBSCRIPTION_CURRENCY},
            "capture": True,
            "payment_method_id": payment_method_id,
            "description": description,
            "metadata": {"user_id": str(user_id), "type": "subscription_recurring"},
            "receipt": {
                "customer": customer,
                "items": [
                    {
                        "description": description,
                        "quantity": "1.00",
                        "amount": {
                            "value": SUBSCRIPTION_AMOUNT,
                            "currency": SUBSCRIPTION_CURRENCY,
                        },
                        "vat_code": 1,
                        "payment_mode": "full_payment",
                        "payment_subject": "service",
                    }
                ],
            },
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

            async with self.db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_payments (user_id, yookassa_id, amount, status, payment_type, description)
                    VALUES ($1, $2, $3, $4, 'subscription_recurring', $5)
                    ON CONFLICT (yookassa_id) DO NOTHING
                """, user_id, yookassa_id, float(SUBSCRIPTION_AMOUNT), status,
                    "Автопродление подписки Фреди")

            logger.info(f"Recurring payment {yookassa_id}: {status} for user {user_id}")

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
            return {"success": False, "error": "Ошибка автоплатежа. Попробуйте позже."}

    async def _extend_subscription(self, user_id: int):
        async with self.db.get_connection() as conn:
            now = datetime.now(timezone.utc)
            row = await conn.fetchrow("""
                SELECT expires_at FROM fredi_subscriptions
                WHERE user_id = $1 AND status = 'active'
            """, user_id)

            if row and row["expires_at"] and row["expires_at"] > now:
                new_expires = row["expires_at"] + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                is_renewal = True
                logger.info(f"Extending subscription for user {user_id} from {row['expires_at']} to {new_expires}")
            else:
                new_expires = now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                is_renewal = False
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

        # Analytics: ключевое событие воронки.
        try:
            from analytics_routes import log_server_event
            await log_server_event(user_id, "subscription_activated", {
                "is_renewal": bool(is_renewal),
                "expires_at": new_expires.isoformat(),
            })
        except Exception as e:
            logger.debug(f"analytics track(subscription_activated) failed: {e}")

    async def _apply_succeeded_payment(self, user_id: int, payment_obj: Dict) -> Dict[str, Any]:
        """Идемпотентная активация подписки на основании оплаченного
        платежа YooKassa. Используется и из webhook, и из verify_payment,
        и из фонового поллинга — чтобы любая ветка приводила БД в одно
        и то же согласованное состояние.
        """
        yookassa_id = payment_obj.get("id", "")
        metadata = payment_obj.get("metadata", {}) or {}
        payment_type = metadata.get("type", "subscription_first")

        async with self.db.get_connection() as conn:
            # 1) Идемпотентность: если этот платёж уже отработан в подписку,
            #    повторно не активируем — просто возвращаем актуальное состояние.
            already = await conn.fetchval("""
                SELECT status FROM fredi_payments WHERE yookassa_id = $1
            """, yookassa_id)

            await conn.execute("""
                INSERT INTO fredi_payments (user_id, yookassa_id, amount, status, payment_type, description)
                VALUES ($1, $2, $3, 'succeeded', $4, $5)
                ON CONFLICT (yookassa_id) DO UPDATE SET
                    status = 'succeeded', updated_at = NOW()
            """, user_id, yookassa_id, float(SUBSCRIPTION_AMOUNT), payment_type,
                f"Подписка Фреди — {SUBSCRIPTION_AMOUNT} руб/мес")

            # 2) Сохраняем способ оплаты, если он пришёл (нужен для автопродления).
            payment_method = payment_obj.get("payment_method", {}) or {}
            payment_method_id = payment_method.get("id")
            if payment_method_id and payment_method.get("saved"):
                card_info = payment_method.get("card", {}) or {}
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

            # 3) Активация / продление подписки.
            now = datetime.now(timezone.utc)
            row = await conn.fetchrow("""
                SELECT expires_at FROM fredi_subscriptions
                WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
            """, user_id)
            if row:
                new_expires = row["expires_at"] + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                is_renewal = True
                await conn.execute("""
                    UPDATE fredi_subscriptions SET expires_at = $1, updated_at = NOW()
                    WHERE user_id = $2 AND status = 'active'
                """, new_expires, user_id)
            else:
                new_expires = now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
                is_renewal = False
                await conn.execute("""
                    INSERT INTO fredi_subscriptions (user_id, status, started_at, expires_at, auto_renew)
                    VALUES ($1, 'active', $2, $3, TRUE)
                    ON CONFLICT (user_id) DO UPDATE SET
                        status = 'active', started_at = $2, expires_at = $3,
                        auto_renew = TRUE, updated_at = NOW()
                """, user_id, now, new_expires)

        # Аналитика только при первой обработке этого платежа, чтобы
        # не дублировать subscription_activated при ретраях/поллинге.
        if already != "succeeded":
            try:
                from analytics_routes import log_server_event
                await log_server_event(user_id, "subscription_activated", {
                    "is_renewal": bool(is_renewal),
                    "expires_at": new_expires.isoformat(),
                    "source": "webhook_or_verify",
                    "yookassa_id": yookassa_id,
                })
            except Exception as e:
                logger.debug(f"analytics track(subscription_activated) failed: {e}")

            # Оповещение пользователя по email + Telegram/MAX. Делаем
            # fire-and-forget через create_task: активация в БД уже
            # сохранена, ждать доставки уведомления нет смысла.
            try:
                from services.subscription_notify import notify_subscription_activated
                asyncio.create_task(notify_subscription_activated(
                    self.db, user_id, new_expires, is_renewal=is_renewal,
                ))
            except Exception as e:
                logger.warning(f"notify dispatch failed for user {user_id}: {e}")

        logger.info(f"Subscription activated for user {user_id} until {new_expires} (yookassa_id={yookassa_id})")
        return {"success": True, "user_id": user_id, "expires_at": str(new_expires)}

    async def _fetch_payment(self, yookassa_id: str) -> Optional[Dict[str, Any]]:
        """GET /payments/{id} — нужен для fallback-сценариев: когда webhook
        не дошёл, фронт или background-поллер дёргают этот метод чтобы
        узнать реальный статус платежа в YooKassa."""
        if not self.shop_id or not self.secret_key:
            logger.error("YooKassa credentials missing for _fetch_payment")
            return None
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    f"{YOOKASSA_API_URL}/payments/{yookassa_id}",
                    headers={"Authorization": self._get_auth_header()},
                )
                if resp.status_code != 200:
                    logger.warning(f"YooKassa GET payment {yookassa_id}: {resp.status_code} {resp.text[:200]}")
                    return None
                return resp.json()
        except Exception as e:
            logger.error(f"_fetch_payment error for {yookassa_id}: {e}")
            return None

    async def verify_payment(self, yookassa_id: str, expected_user_id: Optional[int] = None) -> Dict[str, Any]:
        """Fallback-проверка: фронт после возврата с YooKassa дёргает этот
        метод, чтобы активировать подписку без ожидания webhook'а.
        Это спасает кейсы, когда webhook не дошёл (сеть, не настроен URL).
        """
        if not yookassa_id or not isinstance(yookassa_id, str):
            return {"success": False, "error": "invalid payment_id"}

        payment_obj = await self._fetch_payment(yookassa_id)
        if not payment_obj:
            return {"success": False, "error": "Платёж не найден в YooKassa"}

        status = payment_obj.get("status", "")
        metadata = payment_obj.get("metadata", {}) or {}
        meta_user_id = metadata.get("user_id")
        try:
            user_id = int(meta_user_id) if meta_user_id else None
        except (ValueError, TypeError):
            user_id = None

        # Защита от чужих payment_id: если фронт передал свой uid, он
        # должен совпасть с metadata. Иначе кто угодно мог бы активировать
        # себе чужую подписку, зная случайный yookassa_id.
        if expected_user_id and user_id and expected_user_id != user_id:
            logger.warning(f"verify_payment uid mismatch: expected={expected_user_id}, meta={user_id}")
            return {"success": False, "error": "Платёж принадлежит другому пользователю"}

        if not user_id:
            return {"success": False, "error": "В платеже нет user_id"}

        if status == "succeeded":
            await self._apply_succeeded_payment(user_id, payment_obj)
            return {"success": True, "status": "succeeded", "activated": True}
        elif status == "pending" or status == "waiting_for_capture":
            return {"success": True, "status": status, "activated": False}
        elif status == "canceled":
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_payments SET status = 'canceled', updated_at = NOW()
                    WHERE yookassa_id = $1
                """, yookassa_id)
            return {"success": True, "status": "canceled", "activated": False}
        else:
            return {"success": True, "status": status, "activated": False}

    async def poll_pending_payments(self, max_age_hours: int = 48) -> Dict[str, int]:
        """Фоновый поллинг pending-платежей в БД через YooKassa API.
        Страховка на случай потерянного webhook: если YooKassa подтвердила
        оплату, но webhook не пришёл, мы всё равно активируем подписку.
        """
        activated = 0
        still_pending = 0
        canceled = 0
        errors = 0

        async with self.db.get_connection() as conn:
            rows = await conn.fetch(f"""
                SELECT yookassa_id, user_id FROM fredi_payments
                WHERE status = 'pending'
                  AND created_at > NOW() - INTERVAL '{int(max_age_hours)} hours'
                ORDER BY created_at DESC
                LIMIT 100
            """)

        for r in rows:
            try:
                result = await self.verify_payment(r["yookassa_id"], expected_user_id=r["user_id"])
                st = result.get("status")
                if result.get("activated"):
                    activated += 1
                elif st == "canceled":
                    canceled += 1
                elif st in ("pending", "waiting_for_capture"):
                    still_pending += 1
            except Exception as e:
                errors += 1
                logger.error(f"poll_pending_payments item {r['yookassa_id']}: {e}")

        if rows:
            logger.info(f"Pending poll: total={len(rows)} activated={activated} canceled={canceled} still_pending={still_pending} errors={errors}")
        return {"checked": len(rows), "activated": activated, "canceled": canceled, "pending": still_pending, "errors": errors}

    async def process_webhook(self, event: str, payment_obj: Dict) -> Dict[str, Any]:
        yookassa_id = payment_obj.get("id", "")
        status = payment_obj.get("status", "")
        metadata = payment_obj.get("metadata", {})
        user_id_str = metadata.get("user_id")
        
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
        
        if event == "payment.succeeded" and status == "succeeded":
            if not user_id_str:
                logger.warning(f"Webhook without user_id: {yookassa_id}")
                return {"success": False, "error": "No user_id in metadata"}

            user_id = int(user_id_str)
            return await self._apply_succeeded_payment(user_id, payment_obj)
        
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
            and sub["expires_at"] > datetime.now(timezone.utc)
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
                UPDATE fredi_subscriptions SET auto_renew = $1, updated_at = NOW() 
                WHERE user_id = $2
            """, enabled, user_id)
        logger.info(f"Auto-renew toggled to {enabled} for user {user_id}")
        return {"success": True, "auto_renew": enabled}

    async def process_renewals(self) -> Dict[str, Any]:
        renewed = 0
        failed = 0
        
        async with self.db.get_connection() as conn:
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
                logger.info(f"Renewal successful for user {row['user_id']}")
            else:
                failed += 1
                error = result.get("error", "Unknown error")
                logger.error(f"Renewal failed for user {row['user_id']}: {error}")
                
                if any(keyword in error.lower() for keyword in ["недостаточно средств", "истек", "заблокирована"]):
                    async with self.db.get_connection() as conn:
                        await conn.execute("""
                            UPDATE fredi_subscriptions SET auto_renew = FALSE, updated_at = NOW()
                            WHERE user_id = $1
                        """, row["user_id"])
                    logger.info(f"Auto-renew disabled for user {row['user_id']} due to payment failure")
        
        logger.info(f"Renewals processed: {renewed} ok, {failed} failed")
        return {"renewed": renewed, "failed": failed}
