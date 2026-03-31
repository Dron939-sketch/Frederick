# routes/goals.py
"""
Отдельный модуль для работы с целями
Версия 1.0 — динамический подбор целей по профилю
"""

import logging
import time
from typing import Dict, Any, List
from fastapi import APIRouter, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import Database
from services.ai_service import AIService
from state import user_state_data

logger = logging.getLogger(__name__)

# Создаём роутер
goals_router = APIRouter(prefix="/api/goals", tags=["goals"])

# Лимитер (можно использовать глобальный, но для примера оставим)
limiter = Limiter(key_func=get_remote_address)


@goals_router.get("/{user_id}")
@limiter.limit("15/minute")
async def get_user_goals(request: Request, user_id: int, mode: str = "coach"):
    """
    Возвращает персонализированные цели для пользователя
    """
    try:
        # Получаем профиль пользователя
        profile = await Database.get_profile(user_id)  # или user_repo.get_profile(user_id)
        if not profile:
            profile = {}

        profile_data = profile.get('profile_data', {})
        profile_code = profile_data.get('display_name', 'СБ-4_ТФ-4_УБ-4_ЧВ-4')

        # Генерируем цели через AI Service
        goals = await AIService.generate_goals(
            user_id=user_id,
            profile=profile,
            mode=mode
        )

        # Добавляем метку приоритета
        for goal in goals:
            goal["is_priority"] = goal.get("difficulty") == "hard"

        return {
            "success": True,
            "goals": goals[:9],           # не больше 9 целей
            "profile_code": profile_code,
            "total": len(goals)
        }

    except Exception as e:
        logger.error(f"Error generating goals for user {user_id}: {e}")
        return {
            "success": False,
            "error": "Не удалось сгенерировать цели",
            "goals": []
        }


@goals_router.post("/select")
@limiter.limit("20/minute")
async def select_goal(request: Request):
    """
    Сохраняет выбранную пользователем цель
    """
    try:
        data = await request.json()
        user_id = data.get("user_id")
        goal = data.get("goal")

        if not user_id or not goal:
            raise HTTPException(status_code=400, detail="user_id and goal are required")

        # Сохраняем событие в БД
        await Database.log_event(
            user_id,
            'goal_selected',
            {
                'goal_id': goal.get('id'),
                'goal_name': goal.get('name'),
                'difficulty': goal.get('difficulty'),
                'time': goal.get('time'),
                'timestamp': time.time()
            }
        )

        # Сохраняем текущую цель в состоянии пользователя
        if user_id not in user_state_data:
            user_state_data[user_id] = {}
        user_state_data[user_id]['current_goal'] = goal

        logger.info(f"✅ Цель выбрана: {goal.get('name')} | Пользователь {user_id}")

        return {
            "success": True,
            "message": "Цель успешно сохранена",
            "goal": goal
        }

    except Exception as e:
        logger.error(f"Error selecting goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Дополнительный эндпоинт — сохранение прогресса (по желанию)
@goals_router.post("/progress")
async def update_goal_progress(request: Request):
    """Обновляет прогресс по выбранной цели"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        goal_id = data.get("goal_id")
        progress = data.get("progress", 0)

        if not user_id or not goal_id:
            raise HTTPException(status_code=400, detail="user_id and goal_id required")

        await Database.log_event(
            user_id,
            'goal_progress_updated',
            {
                'goal_id': goal_id,
                'progress': progress,
                'timestamp': time.time()
            }
        )

        return {"success": True, "message": "Прогресс обновлён"}

    except Exception as e:
        logger.error(f"Error updating goal progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))
