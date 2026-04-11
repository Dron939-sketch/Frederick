"""
bot_routes.py — Register bot webhooks, Fish Audio TTS, and subscription meter.
All startup integrations go through here to avoid patching main.py.

Usage in main.py:
    from bot_routes import register_bot_routes
    setup_bots = register_bot_routes(app, db)
    await setup_bots()
"""

import asyncio
import logging
from services.bot_service import register_bot_webhooks
from voice_fish_patch import apply_fish_audio_patch
from meter_routes import register_meter_routes

logger = logging.getLogger(__name__)

# Apply Fish Audio patch on import
apply_fish_audio_patch()

# Will be set during register
_meter_init = None
_meter_cooldown = None


def register_bot_routes(app, db, limiter=None):
    """Register bot webhooks, meter routes, and return setup coroutine."""
    global _meter_init, _meter_cooldown

    setup_webhooks = register_bot_webhooks(app, db)

    # Try to get limiter from main module if not passed
    if limiter is None:
        try:
            import main
            limiter = getattr(main, 'limiter', None)
        except Exception:
            pass

    # Register meter routes
    if limiter:
        _meter_init, _meter_cooldown = register_meter_routes(app, db, limiter)
        logger.info("Meter routes registered")
    else:
        logger.warning("No limiter available, meter routes skipped")

    async def setup_all():
        await setup_webhooks()

        if _meter_init:
            await _meter_init()
            logger.info("Meter tables initialized")

        if _meter_cooldown:
            asyncio.create_task(_meter_cooldown())
            logger.info("Cooldown checker started")

    return setup_all
