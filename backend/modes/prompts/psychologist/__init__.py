#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Регистр психотерапевтических методов.
"""

from typing import Dict, Optional

from .rogers import ROGERS_METHOD
from .beck import BECK_METHOD
from .frankl import FRANKL_METHOD
from .freud import FREUD_METHOD
from .jung import JUNG_METHOD
from .perls import PERLS_METHOD
from .yalom import YALOM_METHOD
from .berne import BERNE_METHOD

# Регистр всех методов
METHODS_REGISTRY: Dict[str, TherapyMethod] = {
    "person_centered": ROGERS_METHOD,
    "cbt": BECK_METHOD,
    "logo": FRANKL_METHOD,
    "psychoanalysis": FREUD_METHOD,
    "analytical": JUNG_METHOD,
    "gestalt": PERLS_METHOD,
    "existential": YALOM_METHOD,
    "transactional": BERNE_METHOD,
}

DEFAULT_METHOD_CODE = "person_centered"


def get_method(code: str) -> TherapyMethod:
    """
    Получить метод по коду с fallback на дефолтный.
    
    Args:
        code: Код метода (cbt, logo, person_centered...)
    
    Returns:
        Объект TherapyMethod
    """
    if code in METHODS_REGISTRY:
        return METHODS_REGISTRY[code]
    
    # Fallback на Роджерса
    return METHODS_REGISTRY[DEFAULT_METHOD_CODE]


def get_all_methods() -> Dict[str, TherapyMethod]:
    """Возвращает все методы."""
    return METHODS_REGISTRY.copy()
