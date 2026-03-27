"""
Репозиторий для работы с пользователями
"""

import json
import logging
from typing import Optional, Dict, Any

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class UserRepository:
    """Репозиторий пользователей"""
    
    def __init__(self, db: Database, cache: Optional[RedisCache] = None):
        self.db = db
        self.cache = cache
    
    async def save_profile(self, user_id: int, profile: Dict[str, Any]) -> bool:
        """Сохранение профиля пользователя"""
        try:
            await self.db.execute("""
                INSERT INTO users (user_id, profile, updated_at, last_activity)
                VALUES ($1, $2, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    profile = $2,
                    updated_at = NOW(),
                    last_activity = NOW()
            """, user_id, json.dumps(profile, default=str))
            
            # Очищаем кэш
            if self.cache:
                await self.cache.delete(f"profile:{user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving profile for user {user_id}: {e}")
            return False
    
    async def get_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение профиля пользователя"""
        # Проверяем кэш
        cache_key = f"profile:{user_id}"
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached
        
        try:
            row = await self.db.fetchrow("""
                SELECT profile FROM users WHERE user_id = $1
            """, user_id)
            
            if row and row['profile']:
                profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])
                
                # Сохраняем в кэш
                if self.cache:
                    await self.cache.set(cache_key, profile, ttl=300)
                
                return profile
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting profile for user {user_id}: {e}")
            return None
    
    async def save_message(self, user_id: int, role: str, content: str, metadata: Dict = None) -> bool:
        """Сохранение сообщения"""
        try:
            await self.db.execute("""
                INSERT INTO messages (user_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, user_id, role, content, json.dumps(metadata or {}))
            
            # Обновляем активность
            await self.db.execute("""
                UPDATE users SET last_activity = NOW() WHERE user_id = $1
            """, user_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return False
    
    async def save_psychologist_thought(self, user_id: int, thought: str) -> bool:
        """Сохранение мысли психолога"""
        try:
            await self.db.execute("""
                INSERT INTO psychologist_thoughts (user_id, thought_text, thought_summary)
                VALUES ($1, $2, $3)
            """, user_id, thought, thought[:200])
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving psychologist thought: {e}")
            return False
    
    async def get_psychologist_thought(self, user_id: int) -> Optional[str]:
        """Получение последней мысли психолога"""
        try:
            row = await self.db.fetchrow("""
                SELECT thought_text FROM psychologist_thoughts
                WHERE user_id = $1 AND is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            """, user_id)
            
            return row['thought_text'] if row else None
            
        except Exception as e:
            logger.error(f"Error getting psychologist thought: {e}")
            return None
