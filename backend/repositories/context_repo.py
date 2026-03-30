"""
Репозиторий для работы с контекстом пользователей
"""

import json
import logging
from typing import Optional, Dict, Any

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class ContextRepository:
    """Репозиторий контекста пользователей"""
    
    def __init__(self, db: Database, cache: Optional[RedisCache] = None):
        self.db = db
        self.cache = cache
    
    def _ensure_int(self, user_id) -> int:
        """Преобразует user_id в int, если это возможно"""
        if user_id is None:
            raise ValueError("user_id cannot be None")
        if isinstance(user_id, int):
            return user_id
        if isinstance(user_id, str) and user_id.isdigit():
            return int(user_id)
        raise ValueError(f"Cannot convert {user_id} (type: {type(user_id)}) to int")
    
    async def save(self, user_id: int, context: Dict[str, Any]) -> bool:
        """Сохранение контекста"""
        try:
            # Преобразуем user_id в int
            user_id_int = self._ensure_int(user_id)
            
            # Сначала создаем пользователя, если нет
            await self.db.execute("""
                INSERT INTO users (user_id, created_at, updated_at)
                VALUES ($1, NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
            """, user_id_int)
            
            # Сохраняем контекст
            await self.db.execute("""
                INSERT INTO user_contexts (user_id, context, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    context = $2,
                    updated_at = NOW()
            """, user_id_int, json.dumps(context, default=str))
            
            # Очищаем кэш
            if self.cache:
                await self.cache.delete(f"context:{user_id_int}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving context for user {user_id}: {e}")
            return False
    
    async def get(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение контекста"""
        try:
            # Преобразуем user_id в int
            user_id_int = self._ensure_int(user_id)
            
            # Проверяем кэш
            cache_key = f"context:{user_id_int}"
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached
            
            row = await self.db.fetchrow("""
                SELECT context FROM user_contexts WHERE user_id = $1
            """, user_id_int)
            
            if row and row['context']:
                context = row['context'] if isinstance(row['context'], dict) else json.loads(row['context'])
                
                # Сохраняем в кэш
                if self.cache:
                    await self.cache.set(cache_key, context, ttl=300)
                
                return context
            
            return {}
            
        except Exception as e:
            logger.error(f"Error getting context for user {user_id}: {e}")
            return None
    
    async def update_weather(self, user_id: int, weather: Dict[str, Any]) -> bool:
        """Обновление погоды в контексте"""
        try:
            user_id_int = self._ensure_int(user_id)
            context = await self.get(user_id_int) or {}
            context['weather'] = weather
            
            return await self.save(user_id_int, context)
            
        except Exception as e:
            logger.error(f"Error updating weather: {e}")
            return False
