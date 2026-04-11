"""
Freddy Service for Frederick — DISABLED.
Agent API calls disabled for speed. BasicMode uses local DeepSeek directly.
This stub returns empty replies so main.py falls back to BasicMode + AIService.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class FreddyService:
    """Stub: agent API disabled. BasicMode uses local DeepSeek via AIService."""

    def __init__(self):
        logger.info("FreddyService: DISABLED (using local DeepSeek for basic mode)")

    async def warmup(self):
        pass

    async def start_keepalive(self):
        pass

    async def chat(self, user_id, message, **kwargs):
        # Return empty reply -> main.py will fallback to BasicMode + AIService (fast)
        return {"reply": "", "model": "disabled", "error": "agent_disabled"}

    async def speak(self, text, **kwargs):
        # Return None -> main.py will fallback to Yandex/Fish Audio TTS
        return None

    async def is_available(self):
        return False

    async def close(self):
        pass


_instance = None

def get_freddy_service():
    global _instance
    if _instance is None:
        _instance = FreddyService()
    return _instance
