"""
bot_routes.py — All startup integrations: bots, TTS, meter, analytics, mode enhancements.

Usage in main.py:
    from bot_routes import register_bot_routes
    setup_bots = register_bot_routes(app, db)
    await setup_bots()
"""

import asyncio
import logging
from services.bot_service import register_bot_webhooks
from services.freddy_service import get_freddy_service
from voice_fish_patch import apply_fish_audio_patch
from mode_enhancer import apply_mode_enhancements
from meter_routes import register_meter_routes

logger = logging.getLogger(__name__)

# Apply patches on import
apply_fish_audio_patch()
apply_mode_enhancements()

_meter_init = None
_meter_cooldown = None
_analytics_init = None


def register_bot_routes(app, db, limiter=None):
    global _meter_init, _meter_cooldown, _analytics_init

    setup_webhooks = register_bot_webhooks(app, db)

    if limiter is None:
        try:
            import main
            limiter = getattr(main, "limiter", None)
        except Exception:
            pass

    if limiter:
        _meter_init, _meter_cooldown = register_meter_routes(app, db, limiter)
        logger.info("Meter routes registered")

    # Analytics
    try:
        from analytics_routes import register_analytics_routes
        _analytics_init = register_analytics_routes(app, db)
        logger.info("Analytics routes registered")
    except Exception as e:
        logger.warning(f"Analytics routes not loaded: {e}")

    async def setup_all():
        await setup_webhooks()

        if _meter_init:
            await _meter_init()
            logger.info("Meter tables initialized")

        if _meter_cooldown:
            asyncio.create_task(_meter_cooldown())
            logger.info("Cooldown checker started")

        if _analytics_init:
            await _analytics_init()
            logger.info("Analytics table initialized")

        try:
            freddy = get_freddy_service()
            await freddy.warmup()
            logger.info("FreddyService ready")
        except Exception as e:
            logger.warning(f"FreddyService warmup: {e}")

    return setup_all
