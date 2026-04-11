"""
Freddy Service for Frederick — connects smart AI for users without test.
Pre-authenticates on startup, keeps persistent session warm.
"""

import os
import logging
import time
import asyncio
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
KEEPALIVE_INTERVAL = 300  # ping every 5 min


class FreddyService:
    def __init__(self):
        self.url = FREDDY_URL.rstrip("/")
        self.token = FREDDY_TOKEN
        self._session = None
        self._logged_in = False
        self._keepalive_task = None
        logger.info(f"FreddyService: url={self.url}, token={'set' if self.token else 'not set'}")

    async def _get_session(self):
        """Get or create persistent session (reuse, don't recreate)."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(
                    limit=10,
                    keepalive_timeout=60,
                    enable_cleanup_closed=True,
                ),
                timeout=aiohttp.ClientTimeout(total=CHAT_TIMEOUT),
            )
        return self._session

    async def warmup(self):
        """Pre-authenticate and warm up connection. Call on startup."""
        logger.info("FreddyService: warming up...")
        try:
            ok = await self._ensure_auth()
            if ok:
                available = await self.is_available()
                logger.info(f"FreddyService: warmup done, auth={'OK' if ok else 'FAIL'}, available={available}")
            else:
                logger.warning("FreddyService: warmup auth failed")
        except Exception as e:
            logger.error(f"FreddyService: warmup error: {e}")

    async def start_keepalive(self):
        """Start background keepalive pinger."""
        if self._keepalive_task:
            return
        self._keepalive_task = asyncio.create_task(self._keepalive_loop())
        logger.info("FreddyService: keepalive started")

    async def _keepalive_loop(self):
        """Ping agent every 5 min to keep connection warm."""
        while True:
            try:
                await asyncio.sleep(KEEPALIVE_INTERVAL)
                session = await self._get_session()
                async with session.get(
                    f"{self.url}/health",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        logger.debug("FreddyService: keepalive OK")
                    else:
                        logger.warning(f"FreddyService: keepalive {resp.status}")
                # Re-auth if token expired
                if not self.token and not self._logged_in:
                    await self._ensure_auth()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"FreddyService: keepalive error: {e}")

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
            logger.info(f"FreddyService: login as '{FREDDY_USERNAME}'")

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
                    logger.info("FreddyService: 401, trying register...")
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
                            logger.info(f"FreddyService: register {reg_resp.status}")
                    except Exception:
                        pass

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
                    logger.info(f"FreddyService: reply {data.get('model','?')}, {len(data.get('reply',''))}ch, {elapsed:.1f}s")
                    return data
                else:
                    body = await resp.text()
                    logger.error(f"FreddyService chat: {resp.status} {body[:200]} ({elapsed:.1f}s)")
                    if resp.status == 401:
                        self.token = ""
                        self._logged_in = False
                    return {"reply": "", "model": "error", "error": body[:200]}
        except Exception as exc:
            logger.error(f"FreddyService chat: {type(exc).__name__}: {repr(exc)}")
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
                    logger.error(f"FreddyService TTS: {resp.status}")
                    return None
        except Exception as exc:
            logger.error(f"FreddyService TTS: {type(exc).__name__}: {repr(exc)}")
            return None

    async def is_available(self):
        try:
            session = await self._get_session()
            async with session.get(f"{self.url}/health", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                return resp.status == 200
        except Exception:
            return False

    async def close(self):
        if self._keepalive_task:
            self._keepalive_task.cancel()
            self._keepalive_task = None
        if self._session and not self._session.closed:
            await self._session.close()


_instance = None

def get_freddy_service():
    global _instance
    if _instance is None:
        _instance = FreddyService()
    return _instance
