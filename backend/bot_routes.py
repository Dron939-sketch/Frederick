"""
bot_routes.py — Register bot webhooks, Fish Audio TTS, subscription meter,
and pre-warm FreddyService connection.

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
from meter_routes import register_meter_routes

logger = logging.getLogger(__name__)

# Apply Fish Audio patch on import
apply_fish_audio_patch()

_meter_init = None
_meter_cooldown = None


def register_bot_routes(app, db, limiter=None):
    global _meter_init, _meter_cooldown

    setup_webhooks = register_bot_webhooks(app, db)

    if limiter is None:
        try:
            import main
            limiter = getattr(main, 'limiter', None)
        except Exception:
            pass

    if limiter:
        _meter_init, _meter_cooldown = register_meter_routes(app, db, limiter)
        logger.info("Meter routes registered")

    async def setup_all():
        # Bot webhooks
        await setup_webhooks()

        # Meter tables
        if _meter_init:
            await _meter_init()
            logger.info("Meter tables initialized")

        # Meter cooldown checker
        if _meter_cooldown:
            asyncio.create_task(_meter_cooldown())
            logger.info("Cooldown checker started")

        # Pre-warm FreddyService: auth + keepalive
        try:
            freddy = get_freddy_service()
            await freddy.warmup()
            await freddy.start_keepalive()
            logger.info("FreddyService warmed up + keepalive started")
        except Exception as e:
            logger.warning(f"FreddyService warmup failed: {e}")

    return setup_all
