"""
Репозиторий для работы с пользователями
Поддерживает оба формата user_id: int (старый фронтенд) и str (новый фронтенд)
"""

import json
import logging
from typing import Optional, Dict, Any, List, Union

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class UserRepository:
    """Репозиторий пользователей (поддержка int и str user_id)"""
    
    def __init__(self, db: Database, cache: Optional[RedisCache] = None):
        self.db = db
        self.cache = cache
    
    def _normalize_user_id(self, user_id: Union[int, str]) -> Union[int, str]:
        if user_id is None:
            raise ValueError("user_id cannot be None")
        return user_id
    
    def _get_id_condition(self, user_id: Union[int, str]) -> tuple:
        if isinstance(user_id, int):
            return "user_id = $1", user_id
        else:
            return "user_id::text = $1", user_id
    
    # ============================================
    # ОСНОВНЫЕ МЕТОДЫ
    # ============================================
    
    async def save_profile(self, user_id: Union[int, str], profile: Dict[str, Any]) -> bool:
        try:
            condition, value = self._get_id_condition(user_id)
            
            await self.db.execute(f"""
                INSERT INTO fredi_users (user_id, profile, updated_at, last_activity)
                VALUES ($1, $2, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    profile = $2,
                    updated_at = NOW(),
                    last_activity = NOW()
            """, value, json.dumps(profile, default=str))
            
            if self.cache:
                await self.cache.delete(f"profile:{user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving profile for user {user_id}: {e}")
            return False
    
    async def get_profile(self, user_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        try:
            cache_key = f"profile:{user_id}"
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached
            
            condition, value = self._get_id_condition(user_id)
            
            row = await self.db.fetchrow(f"""
                SELECT profile FROM fredi_users WHERE {condition}
            """, value)
            
            if row and row['profile']:
                profile = row['profile'] if isinstance(row['profile'], dict) else json.loads(row['profile'])
                
                if self.cache:
                    await self.cache.set(cache_key, profile, ttl=300)
                
                return profile
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting profile for user {user_id}: {e}")
            return None
    
    async def update_profile_field(self, user_id: Union[int, str], field: str, value: Any) -> bool:
        try:
            current_profile = await self.get_profile(user_id) or {}
            current_profile[field] = value
            return await self.save_profile(user_id, current_profile)
        except Exception as e:
            logger.error(f"Error updating profile field '{field}' for user {user_id}: {e}")
            return False
    
    # ============================================
    # ГЛУБОКИЙ АНАЛИЗ
    # ============================================
    
    async def save_deep_analysis(self, user_id: Union[int, str], analysis_data: Dict[str, Any]) -> Optional[int]:
        try:
            condition, value = self._get_id_condition(user_id)
            await self.create_user_if_not_exists(user_id)
            
            await self.db.execute(f"""
                UPDATE deep_analyses SET is_active = FALSE WHERE {condition}
            """, value)
            
            analysis_id = await self.db.fetchval("""
                INSERT INTO deep_analyses (user_id, analysis_text, analysis_type, created_at, updated_at, is_active)
                VALUES ($1, $2, $3, NOW(), NOW(), TRUE)
                RETURNING id
            """, value, json.dumps(analysis_data, ensure_ascii=False), 'deep_analysis')
            
            logger.info(f"Deep analysis saved for user {user_id}, id={analysis_id}")
            return analysis_id
        except Exception as e:
            logger.error(f"Error saving deep analysis for user {user_id}: {e}")
            return None
    
    async def get_last_deep_analysis(self, user_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        try:
            condition, value = self._get_id_condition(user_id)
            
            row = await self.db.fetchrow(f"""
                SELECT analysis_text, created_at, updated_at 
                FROM deep_analyses
                WHERE {condition} AND is_active = TRUE
                ORDER BY created_at DESC LIMIT 1
            """, value)
            
            if row and row['analysis_text']:
                analysis_data = json.loads(row['analysis_text'])
                return {
                    "analysis": analysis_data,
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                    "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
                }
            return None
        except Exception as e:
            logger.error(f"Error getting deep analysis for user {user_id}: {e}")
            return None
    
    async def get_deep_analyses_history(self, user_id: Union[int, str], limit: int = 10) -> List[Dict[str, Any]]:
        try:
            condition, value = self._get_id_condition(user_id)
            rows = await self.db.fetch(f"""
                SELECT id, analysis_text, analysis_type, created_at, updated_at, is_active
                FROM deep_analyses WHERE {condition}
                ORDER BY created_at DESC LIMIT $2
            """, value, limit)
            
            analyses = []
            for row in rows:
                analyses.append({
                    "id": row['id'],
                    "analysis": json.loads(row['analysis_text']),
                    "type": row['analysis_type'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                    "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None,
                    "is_active": row['is_active']
                })
            return analyses
        except Exception as e:
            logger.error(f"Error getting deep analyses history for user {user_id}: {e}")
            return []
    
    async def delete_deep_analysis(self, user_id: Union[int, str], analysis_id: int = None) -> bool:
        try:
            condition, value = self._get_id_condition(user_id)
            if analysis_id:
                await self.db.execute(f"""
                    UPDATE deep_analyses SET is_active = FALSE WHERE {condition} AND id = $2
                """, value, analysis_id)
            else:
                await self.db.execute(f"""
                    UPDATE deep_analyses SET is_active = FALSE WHERE {condition}
                """, value)
            logger.info(f"Deep analysis deleted for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting deep analysis for user {user_id}: {e}")
            return False
    
    # ============================================
    # ТЕСТЫ
    # ============================================
    
    async def save_test_results(
        self, user_id: Union[int, str], test_type: str, results: Dict,
        profile_code: str = None, perception_type: str = None,
        thinking_level: int = None, vectors: Dict = None,
        behavioral_levels: Dict = None, confinement_model: Dict = None
    ) -> Optional[int]:
        try:
            condition, value = self._get_id_condition(user_id)
            await self.create_user_if_not_exists(user_id)
            
            result_id = await self.db.fetchval("""
                INSERT INTO fredi_test_results (
                    user_id, test_type, results, profile_code,
                    perception_type, thinking_level, vectors,
                    behavioral_levels, confinement_model, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id
            """,
                value, test_type, json.dumps(results, default=str), profile_code,
                perception_type, thinking_level,
                json.dumps(vectors, default=str) if vectors else None,
                json.dumps(behavioral_levels, default=str) if behavioral_levels else None,
                json.dumps(confinement_model, default=str) if confinement_model else None
            )
            logger.info(f"Test results saved for user {user_id}, id={result_id}")
            return result_id
        except Exception as e:
            logger.error(f"Error saving test results for user {user_id}: {e}")
            return None
    
    async def get_test_results(self, user_id: Union[int, str], limit: int = 5) -> List[Dict]:
        try:
            condition, value = self._get_id_condition(user_id)
            rows = await self.db.fetch(f"""
                SELECT id, test_type, results, profile_code,
                       perception_type, thinking_level, created_at
                FROM fredi_test_results WHERE {condition}
                ORDER BY created_at DESC LIMIT $2
            """, value, limit)
            
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
            logger.error(f"Error getting test results for user {user_id}: {e}")
            return []
    
    # ============================================
    # СООБЩЕНИЯ
    # ============================================
    
    async def save_message(self, user_id: Union[int, str], role: str, content: str, metadata: Dict = None) -> bool:
        try:
            condition, value = self._get_id_condition(user_id)
            await self.create_user_if_not_exists(user_id)
            
            await self.db.execute("""
                INSERT INTO fredi_messages (user_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, value, role, content, json.dumps(metadata or {}))
            
            await self.db.execute(f"""
                UPDATE fredi_users SET last_activity = NOW() WHERE {condition}
            """, value)
            return True
        except Exception as e:
            logger.error(f"Error saving message for user {user_id}: {e}")
            return False
    
    # ============================================
    # МЫСЛИ ПСИХОЛОГА
    # ============================================
    
    async def save_psychologist_thought(
        self, user_id: Union[int, str], thought: str,
        test_result_id: int = None, thought_type: str = 'psychologist_thought'
    ) -> Optional[int]:
        try:
            condition, value = self._get_id_condition(user_id)
            await self.create_user_if_not_exists(user_id)
            
            thought_id = await self.db.fetchval("""
                INSERT INTO fredi_psychologist_thoughts (
                    user_id, test_result_id, thought_type, thought_text, thought_summary
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, value, test_result_id, thought_type, thought, thought[:200])
            logger.info(f"Psychologist thought saved for user {user_id}, id={thought_id}")
            return thought_id
        except Exception as e:
            logger.error(f"Error saving psychologist thought for user {user_id}: {e}")
            return None
    
    async def get_psychologist_thought(self, user_id: Union[int, str], thought_type: str = 'psychologist_thought') -> Optional[str]:
        try:
            condition, value = self._get_id_condition(user_id)
            row = await self.db.fetchrow(f"""
                SELECT thought_text FROM fredi_psychologist_thoughts
                WHERE {condition} AND thought_type = $2 AND is_active = TRUE
                ORDER BY created_at DESC LIMIT 1
            """, value, thought_type)
            return row['thought_text'] if row else None
        except Exception as e:
            logger.error(f"Error getting psychologist thought for user {user_id}: {e}")
            return None
    
    async def get_all_psychologist_thoughts(self, user_id: Union[int, str], limit: int = 10) -> List[Dict]:
        try:
            condition, value = self._get_id_condition(user_id)
            rows = await self.db.fetch(f"""
                SELECT id, thought_type, thought_text, thought_summary, created_at
                FROM fredi_psychologist_thoughts
                WHERE {condition} AND is_active = TRUE
                ORDER BY created_at DESC LIMIT $2
            """, value, limit)
            
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
            logger.error(f"Error getting psychologist thoughts for user {user_id}: {e}")
            return []
    
    # ============================================
    # УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
    # ============================================
    
    async def update_user_activity(self, user_id: Union[int, str]) -> bool:
        try:
            condition, value = self._get_id_condition(user_id)
            await self.db.execute(f"""
                UPDATE fredi_users SET last_activity = NOW() WHERE {condition}
            """, value)
            return True
        except Exception as e:
            logger.error(f"Error updating user activity for user {user_id}: {e}")
            return False
    
    async def user_exists(self, user_id: Union[int, str]) -> bool:
        try:
            condition, value = self._get_id_condition(user_id)
            count = await self.db.fetchval(f"""
                SELECT COUNT(*) FROM fredi_users WHERE {condition}
            """, value)
            return count > 0
        except Exception as e:
            logger.error(f"Error checking user existence for user {user_id}: {e}")
            return False
    
    async def create_user_if_not_exists(self, user_id: Union[int, str], username: str = None, first_name: str = None) -> bool:
        try:
            if await self.user_exists(user_id):
                return True
            condition, value = self._get_id_condition(user_id)
            await self.db.execute("""
                INSERT INTO fredi_users (user_id, username, first_name, created_at, last_activity)
                VALUES ($1, $2, $3, NOW(), NOW())
            """, value, username, first_name)
            logger.info(f"User created: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating user {user_id}: {e}")
            return False
    
    # ============================================
    # СТАТИСТИКА
    # ============================================
    
    async def get_user_stats(self, user_id: Union[int, str]) -> Dict[str, Any]:
        try:
            condition, value = self._get_id_condition(user_id)
            messages_count = await self.db.fetchval(f"""
                SELECT COUNT(*) FROM fredi_messages WHERE {condition}
            """, value)
            sessions = await self.db.fetchval(f"""
                SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at))
                FROM fredi_messages WHERE {condition}
            """, value)
            last_activity = await self.db.fetchval(f"""
                SELECT last_activity FROM fredi_users WHERE {condition}
            """, value)
            return {
                "total_messages": messages_count or 0,
                "total_sessions": sessions or 0,
                "last_activity": last_activity.isoformat() if last_activity else None
            }
        except Exception as e:
            logger.error(f"Error getting stats for user {user_id}: {e}")
            return {"total_messages": 0, "total_sessions": 0, "last_activity": None}
    
    # ============================================
    # АДМИНКА
    # ============================================
    
    async def get_total_users_count(self) -> int:
        try:
            count = await self.db.fetchval("SELECT COUNT(*) FROM fredi_users")
            return count or 0
        except Exception as e:
            logger.error(f"Error getting total users count: {e}")
            return 0
    
    async def get_active_users_today(self) -> int:
        try:
            count = await self.db.fetchval("""
                SELECT COUNT(DISTINCT user_id) FROM events 
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)
            return count or 0
        except Exception as e:
            logger.error(f"Error getting active users: {e}")
            return 0
