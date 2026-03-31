# services/push_service.py
import json
import logging
from typing import List, Dict, Any
import asyncio

import aiohttp
from pywebpush import webpush, WebPushException

from db import Database

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, db: Database):
        self.db = db
        # Замени на свои реальные VAPID-ключи (генерируются один раз)
        self.vapid_private_key = "твой_VAPID_private_key"   # ← очень секретно!
        self.vapid_public_key = "твой_VAPID_public_key"     # ← этот можно показывать
        self.vapid_claims = {
            "sub": "mailto:your-email@example.com"   # замени на свой реальный email
        }

    async def save_subscription(self, user_id: int, subscription: Dict) -> bool:
        """Сохраняет push-подписку пользователя"""
        try:
            async with self.db.get_connection() as conn:
                # Удаляем старую подписку, если есть
                await conn.execute("""
                    UPDATE push_subscriptions 
                    SET is_active = FALSE 
                    WHERE user_id = $1
                """, user_id)

                # Сохраняем новую
                await conn.execute("""
                    INSERT INTO push_subscriptions (user_id, subscription)
                    VALUES ($1, $2)
                """, user_id, json.dumps(subscription))

            logger.info(f"✅ Push subscription saved for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving push subscription: {e}")
            return False

    async def get_subscriptions(self, user_id: int = None) -> List[Dict]:
        """Получает активные подписки (все или по пользователю)"""
        try:
            async with self.db.get_connection() as conn:
                if user_id:
                    rows = await conn.fetch("""
                        SELECT subscription 
                        FROM push_subscriptions 
                        WHERE user_id = $1 AND is_active = TRUE
                    """, user_id)
                else:
                    rows = await conn.fetch("""
                        SELECT subscription 
                        FROM push_subscriptions 
                        WHERE is_active = TRUE
                    """)

                return [row['subscription'] for row in rows]
        except Exception as e:
            logger.error(f"Error fetching subscriptions: {e}")
            return []

    async def send_notification(self, subscription: Dict, title: str, body: str, url: str = "/") -> bool:
        """Отправляет push-уведомление одному подписчику"""
        try:
            payload = json.dumps({
                "title": title,
                "body": body,
                "url": url,
                "icon": "/icon-192.png"
            })

            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=self.vapid_private_key,
                vapid_claims=self.vapid_claims
            )
            return True

        except WebPushException as e:
            logger.error(f"WebPush failed: {e}")
            # Если подписка устарела — деактивируем её
            if e.response and e.response.status_code in (410, 404):
                await self._deactivate_subscription(subscription)
            return False
        except Exception as e:
            logger.error(f"Push send error: {e}")
            return False

    async def _deactivate_subscription(self, subscription: Dict):
        """Деактивирует устаревшую подписку"""
        try:
            async with self.db.get_connection() as conn:
                await conn.execute("""
                    UPDATE push_subscriptions 
                    SET is_active = FALSE 
                    WHERE subscription @> $1::jsonb
                """, json.dumps(subscription))
        except Exception as e:
            logger.error(f"Failed to deactivate subscription: {e}")

    async def broadcast_morning_message(self, message: str):
        """Отправляет утреннее сообщение всем активным подписчикам"""
        subscriptions = await self.get_subscriptions()

        if not subscriptions:
            logger.info("No active push subscriptions found")
            return

        logger.info(f"Sending morning message to {len(subscriptions)} subscribers")

        tasks = []
        for sub in subscriptions:
            task = self.send_notification(
                subscription=sub,
                title="🌅 Доброе утро от Фреди",
                body=message[:100] + "..." if len(message) > 100 else message,
                url="/"
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = sum(1 for r in results if r is True)
        logger.info(f"Morning push sent successfully to {success_count}/{len(subscriptions)} users")
