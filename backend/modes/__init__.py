#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: ИНИЦИАЛИЗАЦИЯ РЕЖИМОВ (modes/__init__.py)
"""
import logging
from typing import Dict, Any
from modes.base_mode import BaseMode
from modes.basic import BasicMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode

logger = logging.getLogger(__name__)

def is_test_completed(user_data: Dict[str, Any]) -> bool:
    """Определяет, прошёл ли пользователь полноценный тест"""
    if not user_data:
        return False
    
    if user_data.get("profile_data") or user_data.get("ai_generated_profile"):
        return True
    
    if (user_data.get("perception_type") and 
        user_data.get("thinking_level") is not None and 
        user_data.get("behavioral_levels")):
        return True
    
    return False


def get_mode(
    mode_name: str,
    user_id: int,
    user_data: Dict[str, Any],
    context: Any = None
) -> BaseMode:
    """
    Главная фабрика режимов.
    Важно: BasicMode получает облегчённые данные, остальные режимы — полные.
    """
    user_data = user_data or {}

    # === 1. Пользователь без теста → всегда Бендер ===
    if not is_test_completed(user_data):
        logger.info(f"User {user_id} → тест НЕ пройден → BasicMode (Бендер)")

        # Облегчённые данные специально для Бендера
        bender_data = {
            "profile_data": {},
            "perception_type": user_data.get("perception_type", "не определен"),
            "thinking_level": user_data.get("thinking_level", 5),
            "behavioral_levels": user_data.get("behavioral_levels", {}),
            "deep_patterns": {},
            "confinement_model": None,
            "history": user_data.get("history", [])[-15:],   # только последние сообщения
        }
        
        return BasicMode(user_id, bender_data, context)

    # === 2. Тест пройден → используем запрошенный режим с ПОЛНЫМИ данными ===
    mode_name = (mode_name or "psychologist").lower().strip()

    mode_map = {
        "basic": BasicMode,      # на всякий случай
        "bender": BasicMode,
        "psychologist": PsychologistMode,
        "coach": CoachMode,
        "trainer": TrainerMode,
    }

    mode_class = mode_map.get(mode_name, PsychologistMode)

    logger.info(f"User {user_id} → тест пройден → {mode_class.__name__}")

    # Передаём оригинальные данные без изменений
    return mode_class(user_id, user_data, context)


__all__ = ["get_mode", "is_test_completed", "BaseMode", "BasicMode"]
