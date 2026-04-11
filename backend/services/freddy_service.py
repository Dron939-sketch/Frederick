"""
Freddy Service for Frederick — connects smart AI for users without test.

Usage:
    from services.freddy_service import get_freddy_service
    freddy = get_freddy_service()
    response = await freddy.chat(user_id, message, history=history)
    audio = await freddy.speak(response["reply"])
"""

import os
import logging
import time
import aiohttp
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

FREDDY_URL = os.environ.get("FREDDY_URL", "https://agent-ynlg.onrender.com")
FREDDY_USERNAME = os.environ.get("FREDDY_USERNAME", "")
FREDDY_PASSWORD = os.environ.get("FREDDY_PASSWORD", "")
FREDDY_TOKEN = os.environ.get("FREDDY_TOKEN", "")

CHAT_TIMEOUT = 90
TTS_TIMEOUT = 60
AUTH_TIMEOUT = 15


class FreddyService:
    def __init__(self):
        self.url = FREDDY_URL.rstrip("/")
        self.token = FREDDY_TOKEN
        self._session = None
        self._logged_in = False
        logger.info(f"FreddyService: url={self.url}, token={'set' if self.token else 'not set'}")

    async def _get_session(self):
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(force_close=True)
        )
        return self._session

    async def _ensure_auth(self):
        if self.token:
            return True
        if not FREDDY_USERNAME or not FREDDY_PASSWORD:
            logger.warning("FreddyService: no credentials")
            return False
        if self._logged_in:
            return True

        try:
            session = await self._get_session()
            logger.info(f"FreddyService: attempting login as '{FREDDY_USERNAME}' to {self.url}")

            async with session.post(
                f"{self.url}/api/auth/login",
                json={"username": FREDDY_USERNAME, "password": FREDDY_PASSWORD},
                timeout=aiohttp.ClientTimeout(total=AUTH_TIMEOUT),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.token = data.get("access_token", "")
                    self._logged_in = True
                    logger.info("FreddyService: auth OK")
                    return True

                if resp.status == 401:
                    logger.info("FreddyService: login 401, trying auto-register...")
                    try:
                        async with session.post(
                            f"{self.url}/api/auth/register",
                            json={
                                "username": FREDDY_USERNAME,
                                "email": f"{FREDDY_USERNAME}@freddy.local",
                                "password": FREDDY_PASSWORD,
                            },
                            timeout=aiohttp.ClientTimeout(total=AUTH_TIMEOUT),
                        ) as reg_resp:
                            reg_body = await reg_resp.text()
                            logger.info(f"FreddyService: register: {reg_resp.status} {reg_body[:200]}")
                    except Exception as reg_err:
                        logger.warning(f"FreddyService: register error: {reg_err}")

                    async with session.post(
                        f"{self.url}/api/auth/login",
                        json={"username": FREDDY_USERNAME, "password": FREDDY_PASSWORD},
                        timeout=aiohttp.ClientTimeout(total=AUTH_TIMEOUT),
                    ) as resp2:
                        if resp2.status == 200:
                            data = await resp2.json()
                            self.token = data.get("access_token", "")
                            self._logged_in = True
                            logger.info("FreddyService: auth OK after register")
                            return True
                        body2 = await resp2.text()
                        logger.error(f"FreddyService: login after register failed: {resp2.status} {body2[:200]}")
                        return False

                body = await resp.text()
                logger.error(f"FreddyService login failed: {resp.status} {body[:200]}")
                return False
        except Exception as exc:
            logger.error(f"FreddyService login error: {type(exc).__name__}: {exc}")
            return False

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    async def chat(self, user_id, message, *, history=None, profile="fast"):
        """Chat with Freddy agent. Default profile is 'fast' for basic mode speed."""
        if not await self._ensure_auth():
            return {"reply": "", "model": "unavailable", "error": "auth_failed"}

        try:
            start = time.time()
            session = await self._get_session()
            async with session.post(
                f"{self.url}/api/chat/",
                json={
                    "message": message,
                    "profile": profile,
                    "use_memory": True,
                    "use_tools": False,
                },
                headers=self._headers(),
                timeout=aiohttp.ClientTimeout(total=CHAT_TIMEOUT),
            ) as resp:
                elapsed = time.time() - start
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"FreddyService: reply from {data.get('model','?')}, {len(data.get('reply',''))} chars, {elapsed:.1f}s, profile={profile}")
                    return data
                else:
                    body = await resp.text()
                    logger.error(f"FreddyService chat error: {resp.status} {body[:200]} ({elapsed:.1f}s)")
                    if resp.status == 401:
                        self.token = ""
                        self._logged_in = False
                    return {"reply": "", "model": "error", "error": body[:200]}
        except Exception as exc:
            logger.error(f"FreddyService chat exception: {type(exc).__name__}: {repr(exc)}")
            return {"reply": "", "model": "error", "error": f"{type(exc).__name__}"}

    async def speak(self, text, *, voice="jarvis", tone="warm"):
        if not await self._ensure_auth():
            return None
        try:
            session = await self._get_session()
            async with session.post(
                f"{self.url}/api/voice/tts/stream",
                json={"text": text[:1000], "voice": voice, "tone": tone},
                headers=self._headers(),
                timeout=aiohttp.ClientTimeout(total=TTS_TIMEOUT),
            ) as resp:
                if resp.status == 200:
                    audio = await resp.read()
                    logger.info(f"FreddyService: TTS {len(audio)} bytes")
                    return audio
                else:
                    logger.error(f"FreddyService TTS error: {resp.status}")
                    return None
        except Exception as exc:
            logger.error(f"FreddyService TTS exception: {type(exc).__name__}: {repr(exc)}")
            return None

    async def is_available(self):
        try:
            session = await self._get_session()
            async with session.get(f"{self.url}/health", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                return resp.status == 200
        except Exception:
            return False

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


_instance = None

def get_freddy_service():
    global _instance
    if _instance is None:
        _instance = FreddyService()
    return _instance
