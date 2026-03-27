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
    
    async def save(self, user_id: int, context: Dict[str, Any]) -> bool:
        """Сохранение контекста"""
        try:
            # Сначала создаем пользователя, если нет
            await self.db.execute("""
                INSERT INTO users (user_id, created_at, updated_at)
                VALUES ($1, NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
            """, user_id)
            
            # Сохраняем контекст
            await self.db.execute("""
                INSERT INTO user_contexts (user_id, context, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    context = $2,
                    updated_at = NOW()
            """, user_id, json.dumps(context, default=str))
            
            # Очищаем кэш
            if self.cache:
                await self.cache.delete(f"context:{user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving context for user {user_id}: {e}")
            return False
    
    async def get(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение контекста"""
        # Проверяем кэш
        cache_key = f"context:{user_id}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached
        
        try:
            row = await self.db.fetchrow("""
                SELECT context FROM user_contexts WHERE user_id = $1
            """, user_id)
            
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
            context = await self.get(user_id) or {}
            context['weather'] = weather
            
            return await self.save(user_id, context)
            
        except Exception as e:
            logger.error(f"Error updating weather: {e}")
            return False
