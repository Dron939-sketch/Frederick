"""
bot_routes.py — Register bot webhooks and setup.
Usage in main.py:
    from bot_routes import register_bot_routes
    setup_bots = register_bot_routes(app, db)
    await setup_bots()  # in lifespan, sets up webhooks with Telegram/Max
"""

from services.bot_service import register_bot_webhooks


def register_bot_routes(app, db):
    """Register bot webhook endpoints and return setup coroutine."""
    return register_bot_webhooks(app, db)
