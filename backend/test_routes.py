"""
test_routes.py — API для модуля 5-этапного теста.

Endpoint:
  GET /api/test/interpretations
    Возвращает JSON со всеми интерпретациями для этапов 1-5 теста.
    Фронт грузит один раз при старте теста, дальше использует локально.
    Источник правды: backend/data/test_interpretations.json
"""

import json
import logging
import os
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Кэш интерпретаций. Файл небольшой (~30KB), грузим один раз при первом
# запросе, держим в памяти до рестарта приложения.
_INTERPRETATIONS_CACHE = None


def _load_interpretations():
    """Загружает интерпретации этапов теста из data/test_interpretations.json."""
    global _INTERPRETATIONS_CACHE
    if _INTERPRETATIONS_CACHE is not None:
        return _INTERPRETATIONS_CACHE
    path = os.path.join(os.path.dirname(__file__), "data", "test_interpretations.json")
    if not os.path.exists(path):
        logger.error(f"test_interpretations.json not found at {path}")
        _INTERPRETATIONS_CACHE = {}
        return _INTERPRETATIONS_CACHE
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _INTERPRETATIONS_CACHE = data
        logger.info(f"✅ test_interpretations loaded (version {data.get('_version', '?')})")
    except Exception as e:
        logger.error(f"Failed to load test_interpretations.json: {e}")
        _INTERPRETATIONS_CACHE = {}
    return _INTERPRETATIONS_CACHE


def register_test_routes(app, db=None, limiter=None):
    """Регистрирует роуты модуля теста.

    Параметры db/limiter принимаются для единообразия с другими
    register_*_routes — пока не используются, но оставлены для
    будущих эндпоинтов (например, сохранение результата теста).
    """

    @app.get("/api/test/interpretations")
    async def get_test_interpretations():
        """Возвращает все интерпретации этапов 1-5 одним JSON.

        Фронт кэширует результат на сессию теста; сервер кэширует
        в памяти до рестарта.
        """
        data = _load_interpretations()
        if not data:
            raise HTTPException(status_code=500, detail="Interpretations not loaded")
        return data

    async def init_test_routes():
        """Прогрев кэша при старте приложения. Вызывается из main.py."""
        _load_interpretations()

    return init_test_routes
