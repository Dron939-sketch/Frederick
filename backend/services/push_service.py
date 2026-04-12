# services/push_service.py
import json
import logging
import os
import asyncio
from typing import List, Dict

from pywebpush import webpush, WebPushException
from db import Database

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, db: Database):
        self.db = db
        self.vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY", "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgakYLCF1daoshHmyBxskJP4W-ktyogmv7Pi0KBryoeyKhRANCAAT_skk9MSWxBseanz3ZD59iBnC0a7uNcMEFHY_b11Dkuw6indpcTFP2gHK8EcJ6fYqCLcynkRUfDTVDkPc29lwW")
        self.vapid_public_key  = os.environ.get("VAPID_PUBLIC_KEY",  "BP-yST0xJbEGx5qfPdkPn2IGcLRru41wwQUdj9vXUOS7DqKd2lxMU_aAcrwRwnp9ioItzKeRFR8NNUOQ9zb2XBY")
        self.vapid_claims = {"sub": "mailto:meysternlp@gmail.com"}

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
        return await self.send_to_user(
            owner_user_id,
            title="\uD83E\uDE9E Зеркало сработало!",
            body=f"{friend_name} прошёл тест. Открой его профиль \u2192",
            url="/?action=mirrors"
        )

    async def _deactivate_subscription(self, subscription: Dict):
        try:
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE fredi_push_subscriptions SET is_active = FALSE
                    WHERE subscription @> $1::jsonb
                """, json.dumps(subscription))
        except Exception as e:
            logger.error(f"Failed to deactivate subscription: {e}")
