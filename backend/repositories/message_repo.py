"""
Репозиторий для работы с сообщениями
"""

import json
import logging
from typing import List, Dict, Any, Optional, Union

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class MessageRepository:
    """Репозиторий сообщений"""

    def __init__(self, db: Database, cache: Optional[RedisCache] = None):
        self.db = db
        self.cache = cache

    def _get_id_condition(self, user_id: Union[int, str]) -> tuple:
        """
        Возвращает SQL условие и значение для поиска пользователя.
        Поддерживает и int, и str (аналогично user_repo.py).
        """
        if user_id is None:
            raise ValueError("user_id cannot be None")
        if isinstance(user_id, int):
            return "user_id = $1", user_id
        else:
            return "user_id::text = $1", user_id

    async def save(self, user_id: Union[int, str], role: str, content: str, metadata: Dict = None) -> bool:
        """Сохранение сообщения"""
        try:
            condition, value = self._get_id_condition(user_id)
            await self.db.execute("""
                INSERT INTO messages (user_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, value, role, content, json.dumps(metadata or {}))
            
            # Очищаем кэш истории
            if self.cache:
                try:
                    await self.cache.delete(f"history:{user_id}")
                except Exception as cache_error:
                    logger.warning(f"Cache delete error: {cache_error}")
            
            return True
            
        except Exception as e:
            # Логируем ошибку, но не прерываем работу
            logger.error(f"Error saving message for user {user_id}: {type(e).__name__}: {e}")
            return False
    
    async def get_history(self, user_id: Union[int, str], limit: int = 50) -> List[Dict[str, Any]]:
        """Получение истории сообщений"""
        # Проверяем кэш
        cache_key = f"history:{user_id}"
        if self.cache:
            try:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached[:limit]
            except Exception as cache_error:
                logger.warning(f"Cache read error: {cache_error}")
        
        try:
            condition, value = self._get_id_condition(user_id)
            rows = await self.db.fetch(f"""
                SELECT role, content, metadata, created_at
                FROM messages
                WHERE {condition}
                ORDER BY created_at DESC
                LIMIT $2
            """, value, limit)
            
            messages = []
            for row in rows:
                metadata = row['metadata']
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError:
                        metadata = {}
                elif metadata is None:
                    metadata = {}
                
                messages.append({
                    "role": row['role'],
                    "content": row['content'],
                    "metadata": metadata,
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            
            messages.reverse()  # От старых к новым
            
            # Сохраняем в кэш
            if self.cache and messages:
                try:
                    await self.cache.set(cache_key, messages, ttl=60)
                except Exception as cache_error:
                    logger.warning(f"Cache write error: {cache_error}")
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting history for user {user_id}: {type(e).__name__}: {e}")
            return []
    
    async def get_last_message(self, user_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Получение последнего сообщения"""
        try:
            condition, value = self._get_id_condition(user_id)
            row = await self.db.fetchrow(f"""
                SELECT role, content, created_at
                FROM messages
                WHERE {condition}
                ORDER BY created_at DESC
                LIMIT 1
            """, value)
            
            if row:
                return {
                    "role": row['role'],
                    "content": row['content'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting last message for user {user_id}: {type(e).__name__}: {e}")
            return None
    
    async def delete_history(self, user_id: Union[int, str]) -> bool:
        """Удаление истории сообщений"""
        try:
            condition, value = self._get_id_condition(user_id)
            await self.db.execute(f"""
                DELETE FROM messages WHERE {condition}
            """, value)
            
            if self.cache:
                try:
                    await self.cache.delete(f"history:{user_id}")
                except Exception as cache_error:
                    logger.warning(f"Cache delete error: {cache_error}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting history for user {user_id}: {type(e).__name__}: {e}")
            return False
    
    async def get_message_count(self, user_id: Union[int, str]) -> int:
        """Получить количество сообщений пользователя"""
        try:
            condition, value = self._get_id_condition(user_id)
            count = await self.db.fetchval(f"""
                SELECT COUNT(*) FROM messages WHERE {condition}
            """, value)
            return count or 0
        except Exception as e:
            logger.error(f"Error getting message count: {e}")
            return 0
    
    async def get_recent_context(self, user_id: Union[int, str], limit: int = 10) -> List[Dict[str, Any]]:
        """Получить последние сообщения для контекста"""
        try:
            condition, value = self._get_id_condition(user_id)
            rows = await self.db.fetch(f"""
                SELECT role, content
                FROM messages
                WHERE {condition}
                ORDER BY created_at DESC
                LIMIT $2
            """, value, limit)
            
            messages = []
            for row in rows:
                messages.append({
                    "role": row['role'],
                    "content": row['content']
                })
            
            messages.reverse()  # От старых к новым
            return messages
            
        except Exception as e:
            logger.error(f"Error getting recent context: {e}")
            return []
