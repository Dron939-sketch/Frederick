#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: ИНИЦИАЛИЗАЦИЯ РЕЖИМОВ (modes/__init__.py)
Фабрика для создания режимов общения
"""

import logging
from typing import Dict, Any, Optional

from modes.base_mode import BaseMode
from modes.coach import CoachMode
from modes.psychologist import PsychologistMode
from modes.trainer import TrainerMode
from modes.basic import BasicMode

logger = logging.getLogger(__name__)


def is_test_completed(user_data: Dict[str, Any]) -> bool:
    """
    Проверяет, прошел ли пользователь тест
    
    Args:
        user_data: словарь с данными пользователя
    
    Returns:
        True если тест пройден, False если нет
    """
    # Проверяем наличие данных профиля
    if user_data.get("profile_data"):
        return True
    if user_data.get("ai_generated_profile"):
        return True
    
    # Проверяем обязательные поля
    required = ["perception_type", "thinking_level", "behavioral_levels"]
    if all(field in user_data for field in required):
        return True
    
    return False


def get_mode(
    mode_name: str,
    user_id: int,
    user_data: Dict[str, Any],
    context: Any = None
) -> BaseMode:
    """
    Фабрика для создания режимов общения
    
    Args:
        mode_name: имя режима ('coach', 'psychologist', 'trainer', 'basic')
        user_id: ID пользователя
        user_data: словарь с данными пользователя
        context: объект контекста пользователя
    
    Returns:
        Экземпляр режима
    """
    
    # Проверяем, прошел ли пользователь тест
    test_passed = is_test_completed(user_data)
    
    # Если тест не пройден, всегда возвращаем BasicMode
    if not test_passed:
        logger.info(f"User {user_id} hasn't completed test, using BasicMode")
        return BasicMode(user_id, user_data, context)
    
    # Тест пройден - выбираем режим по запросу
    mode_map = {
        'coach': CoachMode,
        'psychologist': PsychologistMode,
        'trainer': TrainerMode,
        'basic': BasicMode  # на случай если кто-то запросит basic
    }
    
    mode_class = mode_map.get(mode_name, PsychologistMode)
    logger.info(f"Creating {mode_class.__name__} for user {user_id}")
    
    return mode_class(user_id, user_data, context)


# Экспортируем классы для удобства
__all__ = [
    'BaseMode',
    'CoachMode',
    'PsychologistMode',
    'TrainerMode',
    'BasicMode',
    'get_mode',
    'is_test_completed'
]
