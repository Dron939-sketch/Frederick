"""
bot_routes.py — Register bot webhooks and setup.
Also applies Fish Audio TTS patch at import time.

Usage in main.py:
    from bot_routes import register_bot_routes
    setup_bots = register_bot_routes(app, db)
    await setup_bots()  # in lifespan, sets up webhooks with Telegram/Max
"""

from services.bot_service import register_bot_webhooks
from voice_fish_patch import apply_fish_audio_patch

# Apply Fish Audio patch on import — wraps TTS for psychologist/coach/trainer
apply_fish_audio_patch()


def register_bot_routes(app, db):
    """Register bot webhook endpoints and return setup coroutine."""
    return register_bot_webhooks(app, db)
