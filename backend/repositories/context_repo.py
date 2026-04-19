"""
Репозиторий для работы с контекстом пользователей
"""

import json
import logging
from typing import Optional, Dict, Any, Union

from db import Database
from cache import RedisCache

logger = logging.getLogger(__name__)


class ContextRepository:
    """Репозиторий контекста пользователей"""
    
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
    
    # Columns in fredi_user_contexts that can be saved/loaded
    _CONTEXT_COLUMNS = [
        "name", "age", "gender", "city", "birth_date", "timezone", "timezone_offset",
        "communication_mode", "last_context_update", "weather_cache", "weather_cache_time",
        "family_status", "has_children", "children_ages", "work_schedule", "job_title",
        "commute_time", "housing_type", "has_private_space", "has_car",
        "support_people", "resistance_people", "energy_level",
        "life_context_complete", "awaiting_context",
        "psychologist_state",
    ]

    async def save(self, user_id: Union[int, str], context: Dict[str, Any]) -> bool:
        """Сохранение контекста (поддержка int и str) — normalized columns"""
        try:
            condition, value = self._get_id_condition(user_id)

            # Сначала создаем пользователя, если нет
            await self.db.execute("""
                INSERT INTO fredi_users (user_id, created_at, updated_at)
                VALUES ($1, NOW(), NOW())
                ON CONFLICT (user_id) DO NOTHING
            """, value)

            # Build column list and values from context dict
            cols = []
            vals = [value]  # $1 = user_id
            idx = 2
            for col in self._CONTEXT_COLUMNS:
                if col in context:
                    cols.append(col)
                    v = context[col]
                    # JSONB columns need json.dumps
                    if col in ("weather_cache", "psychologist_state") and isinstance(v, dict):
                        v = json.dumps(v, default=str)
                    vals.append(v)
                    idx += 1

            if not cols:
                # Nothing to save, just ensure row exists
                await self.db.execute("""
                    INSERT INTO fredi_user_contexts (user_id, updated_at)
                    VALUES ($1, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
                """, value)
            else:
                col_names = ", ".join(cols)
                placeholders = ", ".join(f"${i}" for i in range(2, 2 + len(cols)))
                updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
                sql = f"""
                    INSERT INTO fredi_user_contexts (user_id, {col_names}, updated_at)
                    VALUES ($1, {placeholders}, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        {updates},
                        updated_at = NOW()
                """
                await self.db.execute(sql, *vals)

            # Очищаем кэш
            if self.cache:
                await self.cache.delete(f"context:{user_id}")

            return True

        except Exception as e:
            logger.error(f"Error saving context for user {user_id}: {e}")
            return False
    
    async def get(self, user_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Получение контекста (поддержка int и str) — normalized columns"""
        try:
            condition, value = self._get_id_condition(user_id)

            # Проверяем кэш
            cache_key = f"context:{user_id}"
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached

            row = await self.db.fetchrow(f"""
                SELECT * FROM fredi_user_contexts WHERE {condition}
            """, value)

            if row:
                context = {}
                for col in self._CONTEXT_COLUMNS:
                    val = row.get(col)
                    if val is not None:
                        # Parse JSONB strings if needed
                        if col in ("weather_cache", "psychologist_state") and isinstance(val, str):
                            try:
                                val = json.loads(val)
                            except json.JSONDecodeError:
                                pass
                        context[col] = val

                # Сохраняем в кэш
                if self.cache:
                    await self.cache.set(cache_key, context, ttl=300)

                return context

            return {}

        except Exception as e:
            logger.error(f"Error getting context for user {user_id}: {e}")
            return None
    
    async def update_weather(self, user_id: Union[int, str], weather: Dict[str, Any]) -> bool:
        """Обновление погоды в контексте (поддержка int и str)"""
        try:
            context = await self.get(user_id) or {}
            context['weather'] = weather

            return await self.save(user_id, context)
            
        except Exception as e:
            logger.error(f"Error updating weather: {e}")
            return False
