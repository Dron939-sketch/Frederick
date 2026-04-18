# services/push_service.py
import json
import logging
import os
import asyncio
from typing import List, Dict

import httpx
from pywebpush import webpush, WebPushException
from db import Database

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, db: Database):
        self.db = db
        # ВАЖНО: VAPID ключи только из env. Если их нет — push отключается.
        # Хардкод-фолбэк удалён из-за утечки в git-истории. См. docs/PUSH_VAPID_SETUP.md
        self.vapid_private_key = (os.environ.get("VAPID_PRIVATE_KEY") or "").strip()
        self.vapid_public_key  = (os.environ.get("VAPID_PUBLIC_KEY") or "").strip()
        contact = (os.environ.get("VAPID_CONTACT") or "mailto:admin@example.com").strip()
        self.vapid_claims = {"sub": contact}
        self.enabled = bool(self.vapid_private_key and self.vapid_public_key)
        if not self.enabled:
            logger.error(
                "❌ VAPID ключи не заданы в env (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY). "
                "Push-уведомления отключены. См. docs/PUSH_VAPID_SETUP.md"
            )
        else:
            logger.info(f"🔑 PushService: VAPID ready, contact={contact}")

    async def save_subscription(self, user_id: int, subscription: Dict) -> bool:
        try:
            async with self.db.get_connection() as conn:
                # Auto-create user if not exists (prevents foreign key violation)
                await conn.execute(
                    "INSERT INTO fredi_users (user_id, created_at, updated_at) "
                    "VALUES ($1, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING",
                    user_id
                )
                await conn.execute("""
                    UPDATE fredi_push_subscriptions SET is_active = FALSE WHERE user_id = $1
                """, user_id)
                await conn.execute("""
                    INSERT INTO fredi_push_subscriptions (user_id, subscription, created_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT DO NOTHING
                """, user_id, json.dumps(subscription))
            logger.info(f"Push subscription saved for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving push subscription: {e}")
            return False

    async def get_subscriptions(self, user_id: int = None) -> List[Dict]:
        try:
            async with self.db.get_connection() as conn:
                if user_id:
                    rows = await conn.fetch("""
                        SELECT subscription FROM fredi_push_subscriptions
                        WHERE user_id = $1 AND is_active = TRUE
                    """, user_id)
                else:
                    rows = await conn.fetch("""
                        SELECT subscription FROM fredi_push_subscriptions WHERE is_active = TRUE
                    """)
                result = []
                for row in rows:
                    sub = row["subscription"]
                    result.append(json.loads(sub) if isinstance(sub, str) else sub)
                return result
        except Exception as e:
            logger.error(f"Error fetching subscriptions: {e}")
            return []

    async def send_notification(self, subscription: Dict, title: str, body: str,
                                 url: str = "/", icon: str = "/icon-192.png") -> bool:
        if not self.enabled:
            logger.warning("send_notification skipped: VAPID keys not configured")
            return False
        try:
            payload = json.dumps({"title": title, "body": body, "url": url, "icon": icon})
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=self.vapid_private_key,
                vapid_claims=self.vapid_claims
            )
            return True
        except WebPushException as e:
            logger.error(f"WebPush failed: {e}")
            if e.response and e.response.status_code in (410, 404):
                await self._deactivate_subscription(subscription)
            return False
        except Exception as e:
            logger.error(f"Push send error: {e}")
            return False

    async def send_to_user(self, user_id: int, title: str, body: str, url: str = "/") -> bool:
        subs = await self.get_subscriptions(user_id)
        if not subs:
            return False
        results = await asyncio.gather(*[
            self.send_notification(s, title, body, url) for s in subs
        ], return_exceptions=True)
        return any(r is True for r in results)

    async def broadcast(self, title: str, body: str, url: str = "/"):
        subs = await self.get_subscriptions()
        if not subs:
            return 0
        results = await asyncio.gather(*[
            self.send_notification(s, title, body, url) for s in subs
        ], return_exceptions=True)
        ok = sum(1 for r in results if r is True)
        logger.info(f"Broadcast push: {ok}/{len(subs)} sent")
        return ok

    async def broadcast_morning_message(self, message: str):
        return await self.broadcast(
            title="\uD83C\uDF05 Доброе утро от Фреди",
            body=message[:100] + "..." if len(message) > 100 else message,
            url="/"
        )

    async def notify_mirror_completed(self, owner_user_id: int, friend_name: str):
        """Оповещает владельца зеркала: сначала мессенджер, если нет — web push."""
        msg = f"🪞 Зеркало сработало!\n{friend_name} прошёл тест. Открой профиль в приложении Фреди."

        # Пробуем отправить в привязанный мессенджер
        sent_via_messenger = await self._send_to_messenger(owner_user_id, msg)

        if not sent_via_messenger:
            # Нет привязанного мессенджера — отправляем web push
            await self.send_to_user(
                owner_user_id,
                title="🪞 Зеркало сработало!",
                body=f"{friend_name} прошёл тест. Открой его профиль →",
                url="/?action=mirrors"
            )

    async def _send_to_messenger(self, user_id: int, text: str) -> bool:
        """Отправляет сообщение в привязанный мессенджер. Возвращает True если отправлено."""
        try:
            async with self.db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT platform, chat_id FROM fredi_messenger_links "
                    "WHERE user_id = $1 AND is_active = TRUE LIMIT 1",
                    user_id
                )
            if not row:
                return False

            platform = row["platform"]
            chat_id = row["chat_id"]

            if platform == "telegram":
                token = os.environ.get("TELEGRAM_TOKEN", "").strip()
                if not token:
                    return False
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={"chat_id": chat_id, "text": text}
                    )
                    logger.info(f"Mirror notify TG: {resp.status_code}")
                    return resp.status_code == 200

            elif platform == "max":
                token = os.environ.get("MAX_TOKEN", "").strip()
                if not token:
                    return False
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"https://platform-api.max.ru/messages?chat_id={chat_id}",
                        json={"text": text},
                        headers={"Authorization": token, "Content-Type": "application/json"}
                    )
                    logger.info(f"Mirror notify Max: {resp.status_code}")
                    return resp.status_code == 200

            return False
        except Exception as e:
            logger.error(f"Messenger notify error: {e}")
            return False

    async def _deactivate_subscription(self, subscription: Dict):
        try:
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_push_subscriptions SET is_active = FALSE
                    WHERE subscription @> $1::jsonb
                """, json.dumps(subscription))
        except Exception as e:
            logger.error(f"Failed to deactivate subscription: {e}")
