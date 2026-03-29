#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОДУЛЬ: ИНИЦИАЛИЗАЦИЯ РЕЖИМОВ (modes/__init__.py)
Центральная фабрика для создания всех режимов общения.

Основное правило:
- Если пользователь НЕ прошёл тест → всегда возвращаем BasicMode (Великий Комбинатор / Остап Бендер)
- Если тест пройден → возвращаем запрошенный режим (psychologist, coach, trainer)
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
    """
    Определяет, прошёл ли пользователь психологический тест.
    
    Критерии:
    - Есть profile_data или ai_generated_profile
    - Или присутствуют ключевые поля профиля
    """
    # Прямые признаки наличия профиля
    if user_data.get("profile_data") or user_data.get("ai_generated_profile"):
        return True

    # Косвенные признаки
    required_fields = ["perception_type", "thinking_level", "behavioral_levels"]
    if all(field in user_data and user_data.get(field) for field in required_fields):
        return True

    return False


def get_mode(
    mode_name: str,
    user_id: int,
    user_data: Dict[str, Any],
    context: Any = None
) -> BaseMode:
    """
    Главная фабрика режимов общения.

    Args:
        mode_name: желаемый режим ('basic', 'psychologist', 'coach', 'trainer')
        user_id: ID пользователя
        user_data: данные пользователя (профиль, история и т.д.)
        context: контекст пользователя (имя, пол, город и т.д.)

    Returns:
        Экземпляр соответствующего режима (наследник BaseMode)
    """
    # === КРИТИЧЕСКАЯ ЛОГИКА ===
    # Если тест НЕ пройден — принудительно используем BasicMode (Бендер)
    if not is_test_completed(user_data):
        logger.info(f"User {user_id} → тест не пройден → включаем BasicMode (Великий Комбинатор)")
        return BasicMode(user_id, user_data, context)

    # Тест пройден — используем запрошенный режим
    mode_name = mode_name.lower().strip()

    mode_map = {
        "basic": BasicMode,
        "psychologist": PsychologistMode,
        "coach": CoachMode,
        "trainer": TrainerMode,
    }

    mode_class = mode_map.get(mode_name, PsychologistMode)  # по умолчанию — психолог

    logger.info(f"User {user_id} → тест пройден → создаём {mode_class.__name__}")

    return mode_class(user_id, user_data, context)


# Экспортируем для удобного импорта в других модулях
__all__ = [
    "BaseMode",
    "BasicMode",
    "CoachMode",
    "PsychologistMode",
    "TrainerMode",
    "get_mode",
    "is_test_completed",
]
