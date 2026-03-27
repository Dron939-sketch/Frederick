"""
Репозиторий для работы с сообщениями
"""

import json
import logging
from typing import List, Dict, Any, Optional

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class MessageRepository:
    """Репозиторий сообщений"""
    
    def __init__(self, db: Database, cache: Optional[RedisCache] = None):
        self.db = db
        self.cache = cache
    
    async def save(self, user_id: int, role: str, content: str, metadata: Dict = None) -> bool:
        """Сохранение сообщения"""
        try:
            await self.db.execute("""
                INSERT INTO messages (user_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, user_id, role, content, json.dumps(metadata or {}))
            
            # Очищаем кэш истории
            if self.cache:
                await self.cache.delete(f"history:{user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return False
    
    async def get_history(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Получение истории сообщений"""
        # Проверяем кэш
        cache_key = f"history:{user_id}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached[:limit]
        
        try:
            rows = await self.db.fetch("""
                SELECT role, content, metadata, created_at
                FROM messages
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """, user_id, limit)
            
            messages = []
            for row in rows:
                messages.append({
                    "role": row['role'],
                    "content": row['content'],
                    "metadata": row['metadata'] if isinstance(row['metadata'], dict) else json.loads(row['metadata']) if row['metadata'] else {},
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            
            messages.reverse()  # От старых к новым
            
            # Сохраняем в кэш
            if self.cache:
                await self.cache.set(cache_key, messages, ttl=60)
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting history for user {user_id}: {e}")
            return []
    
    async def get_last_message(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение последнего сообщения"""
        try:
            row = await self.db.fetchrow("""
                SELECT role, content, created_at
                FROM messages
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            """, user_id)
            
            if row:
                return {
                    "role": row['role'],
                    "content": row['content'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting last message: {e}")
            return None
    
    async def delete_history(self, user_id: int) -> bool:
        """Удаление истории сообщений"""
        try:
            await self.db.execute("""
                DELETE FROM messages WHERE user_id = $1
            """, user_id)
            
            if self.cache:
                await self.cache.delete(f"history:{user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting history: {e}")
            return False
