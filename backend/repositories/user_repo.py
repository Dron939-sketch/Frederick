"""
Репозиторий для работы с пользователями
"""

import json
import logging
from typing import Optional, Dict, Any, List

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class UserRepository:
    """Репозиторий пользователей"""
    
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
    
    async def save_profile(self, user_id: int, profile: Dict[str, Any]) -> bool:
        """Сохранение профиля пользователя"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            await self.db.execute("""
                INSERT INTO users (user_id, profile, updated_at, last_activity)
                VALUES ($1, $2, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    profile = $2,
                    updated_at = NOW(),
                    last_activity = NOW()
            """, user_id_int, json.dumps(profile, default=str))
            
            # Очищаем кэш
            if self.cache:
                await self.cache.delete(f"profile:{user_id_int}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving profile for user {user_id}: {e}")
            return False
    
    async def get_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение профиля пользователя"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            # Проверяем кэш
            cache_key = f"profile:{user_id_int}"
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached
            
            row = await self.db.fetchrow("""
                SELECT profile FROM users WHERE user_id = $1
            """, user_id_int)
            
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
    
    async def update_profile_field(self, user_id: int, field: str, value: Any) -> bool:
        """
        Обновляет одно поле в профиле пользователя
        """
        try:
            user_id_int = self._ensure_int(user_id)
            
            # Получаем текущий профиль
            current_profile = await self.get_profile(user_id_int) or {}
            
            # Обновляем поле
            current_profile[field] = value
            
            # Сохраняем обновлённый профиль
            return await self.save_profile(user_id_int, current_profile)
            
        except Exception as e:
            logger.error(f"Error updating profile field '{field}' for user {user_id}: {e}")
            return False
    
    # ============================================
    # ОСТАЛЬНЫЕ МЕТОДЫ (с добавленным преобразованием типов)
    # ============================================
    
    async def save_test_results(
        self, 
        user_id: int, 
        test_type: str, 
        results: Dict, 
        profile_code: str = None,
        perception_type: str = None,
        thinking_level: int = None,
        vectors: Dict = None,
        behavioral_levels: Dict = None,
        confinement_model: Dict = None
    ) -> Optional[int]:
        """Сохраняет результаты теста в таблицу test_results"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            result_id = await self.db.fetchval("""
                INSERT INTO test_results (
                    user_id, test_type, results, profile_code, 
                    perception_type, thinking_level, vectors, 
                    behavioral_levels, confinement_model, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id
            """, 
                user_id_int, 
                test_type, 
                json.dumps(results, default=str), 
                profile_code,
                perception_type, 
                thinking_level, 
                json.dumps(vectors, default=str) if vectors else None,
                json.dumps(behavioral_levels, default=str) if behavioral_levels else None,
                json.dumps(confinement_model, default=str) if confinement_model else None
            )
            
            logger.info(f"✅ Test results saved for user {user_id}, id={result_id}")
            return result_id
            
        except Exception as e:
            logger.error(f"Error saving test results: {e}")
            return None
    
    async def get_test_results(self, user_id: int, limit: int = 5) -> List[Dict]:
        """Получает результаты тестов пользователя"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            rows = await self.db.fetch("""
                SELECT id, test_type, results, profile_code, 
                       perception_type, thinking_level, created_at
                FROM test_results
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """, user_id_int, limit)
            
            results = []
            for row in rows:
                results.append({
                    "id": row['id'],
                    "test_type": row['test_type'],
                    "results": row['results'] if isinstance(row['results'], dict) else json.loads(row['results']),
                    "profile_code": row['profile_code'],
                    "perception_type": row['perception_type'],
                    "thinking_level": row['thinking_level'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting test results: {e}")
            return []
    
    async def save_message(self, user_id: int, role: str, content: str, metadata: Dict = None) -> bool:
        """Сохранение сообщения"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            await self.db.execute("""
                INSERT INTO messages (user_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, user_id_int, role, content, json.dumps(metadata or {}))
            
            # Обновляем активность
            await self.db.execute("""
                UPDATE users SET last_activity = NOW() WHERE user_id = $1
            """, user_id_int)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return False
    
    async def save_psychologist_thought(
        self, 
        user_id: int, 
        thought: str, 
        test_result_id: int = None,
        thought_type: str = 'psychologist_thought'
    ) -> Optional[int]:
        """Сохранение мысли психолога"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            thought_id = await self.db.fetchval("""
                INSERT INTO psychologist_thoughts (
                    user_id, test_result_id, thought_type, thought_text, thought_summary
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, user_id_int, test_result_id, thought_type, thought, thought[:200])
            
            logger.info(f"✅ Psychologist thought saved for user {user_id}, id={thought_id}")
            return thought_id
            
        except Exception as e:
            logger.error(f"Error saving psychologist thought: {e}")
            return None
    
    async def get_psychologist_thought(self, user_id: int, thought_type: str = 'psychologist_thought') -> Optional[str]:
        """Получение последней мысли психолога"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            row = await self.db.fetchrow("""
                SELECT thought_text FROM psychologist_thoughts
                WHERE user_id = $1 AND thought_type = $2 AND is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            """, user_id_int, thought_type)
            
            return row['thought_text'] if row else None
            
        except Exception as e:
            logger.error(f"Error getting psychologist thought: {e}")
            return None
    
    async def get_all_psychologist_thoughts(self, user_id: int, limit: int = 10) -> List[Dict]:
        """Получение всех мыслей психолога пользователя"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            rows = await self.db.fetch("""
                SELECT id, thought_type, thought_text, thought_summary, created_at
                FROM psychologist_thoughts
                WHERE user_id = $1 AND is_active = TRUE
                ORDER BY created_at DESC
                LIMIT $2
            """, user_id_int, limit)
            
            thoughts = []
            for row in rows:
                thoughts.append({
                    "id": row['id'],
                    "type": row['thought_type'],
                    "text": row['thought_text'],
                    "summary": row['thought_summary'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            
            return thoughts
            
        except Exception as e:
            logger.error(f"Error getting psychologist thoughts: {e}")
            return []
    
    async def update_user_activity(self, user_id: int) -> bool:
        """Обновление времени последней активности"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            await self.db.execute("""
                UPDATE users SET last_activity = NOW() WHERE user_id = $1
            """, user_id_int)
            return True
        except Exception as e:
            logger.error(f"Error updating user activity: {e}")
            return False
    
    async def user_exists(self, user_id: int) -> bool:
        """Проверка существования пользователя"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            count = await self.db.fetchval("""
                SELECT COUNT(*) FROM users WHERE user_id = $1
            """, user_id_int)
            return count > 0
        except Exception as e:
            logger.error(f"Error checking user existence: {e}")
            return False
    
    async def create_user_if_not_exists(self, user_id: int, username: str = None, first_name: str = None) -> bool:
        """Создание пользователя если не существует"""
        try:
            user_id_int = self._ensure_int(user_id)
            
            await self.db.execute("""
                INSERT INTO users (user_id, username, first_name, created_at, last_activity)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
            """, user_id_int, username, first_name)
            return True
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return False
