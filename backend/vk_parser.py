"""
vk_parser.py — Async-клиент VK API для выкачки публичных данных профиля.

Используется фазой 2 модуля «Психологический таргетинг»: для каждого
привязанного user_id вытаскиваем первый «слой» поведенческих данных —
профиль, стена, группы. Дальше по этим данным AI выделяет маркеры
архетипа и ищет «двойников».

Что фетчим (зависит от приватности профиля и scope сервисного токена):
  - users.get  — базовый профиль (имя, город, возраст, статус, интересы)
  - wall.get   — последние 100 постов (если стена открыта)
  - groups.get — паблики, на которые подписан (часто закрыто, ок)

Чего не фетчим:
  - audio.get  — VK выпилил методы для аудио в 2017
  - friends.get — приватно у большинства
  - photos.get — большой объём, пока не нужен

Лимиты:
  - VK service token: 3 req/sec на токен (эмуляция: gap 333 мс между вызовами).
  - In-memory кэш ответов на 7 суток (TTL), чтобы не молотить API при
    повторных «Копать» по одному user_id.

Энв:
  VK_SERVICE_TOKEN — токен сервисного приложения VK (без пользователя).
"""

import asyncio
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

VK_API_VERSION = "5.199"
VK_API_BASE = "https://api.vk.com/method"

# Поля users.get — берём всё, что бывает полезно для психопрофилирования
# и что VK отдаёт по сервисному токену для открытых аккаунтов.
VK_USER_FIELDS = (
    "first_name,last_name,bdate,city,country,sex,relation,status,about,"
    "interests,books,music,movies,quotes,activities,games,personal,"
    "screen_name,site,career,occupation,connections,counters,"
    "last_seen,online,photo_max_orig,deactivated,is_closed,can_access_closed"
)


class VKParserError(Exception):
    """Любая ошибка от VK API или от сетевого слоя."""


class VKParser:
    """Async VK API клиент с rate-limit и in-memory TTL кэшем."""

    def __init__(self,
                 service_token: Optional[str] = None,
                 ttl_seconds: int = 7 * 86400):
        self.token = (service_token or os.environ.get("VK_SERVICE_TOKEN") or "").strip()
        self.ttl = ttl_seconds
        # 3 rps → минимальный интервал между вызовами 333 мс.
        # Lock + последняя отметка времени даёт честное равномерное окно.
        self._lock = asyncio.Lock()
        self._last_call_ts = 0.0
        self._min_gap = 1.0 / 3.0
        self._cache: dict = {}

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _cache_key(self, method: str, params: dict) -> str:
        # Токен в ключ не кладём — он один на процесс.
        return method + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))

    def _gc_cache(self):
        # Простой GC: если перевалило за 5000 записей — выкидываем 1000 самых старых.
        if len(self._cache) <= 5000:
            return
        items = sorted(self._cache.items(), key=lambda kv: kv[1][0])
        for k, _ in items[:1000]:
            self._cache.pop(k, None)

    async def _call(self, method: str, params: dict) -> dict:
        if not self.enabled:
            raise VKParserError("VK_SERVICE_TOKEN не задан в env")

        key = self._cache_key(method, params)
        now = time.time()
        cached = self._cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

        # Rate limit + выполнение запроса под одним lock'ом, чтобы
        # параллельные «Копать» не превысили 3 rps.
        async with self._lock:
            elapsed = time.time() - self._last_call_ts
            if elapsed < self._min_gap:
                await asyncio.sleep(self._min_gap - elapsed)
            url = f"{VK_API_BASE}/{method}"
            payload = {"access_token": self.token, "v": VK_API_VERSION, **params}
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    r = await client.post(url, data=payload)
            except httpx.HTTPError as e:
                self._last_call_ts = time.time()
                raise VKParserError(f"VK network error: {e}")
            self._last_call_ts = time.time()

            try:
                data = r.json()
            except Exception:
                raise VKParserError(f"VK non-JSON response (HTTP {r.status_code})")

        if "error" in data:
            err = data["error"] or {}
            code = err.get("error_code")
            msg = err.get("error_msg", "")
            raise VKParserError(f"VK API error {code}: {msg}")

        resp = data.get("response", {})
        self._cache[key] = (now + self.ttl, resp)
        self._gc_cache()
        return resp

    async def fetch_profile(self,
                            vk_id: Optional[int],
                            screen_name: Optional[str]) -> dict:
        """Тянет users.get + wall.get + groups.get. Каждый блок может
        упасть отдельно (приватность, ограничения токена) — кладём
        ошибку в errors[<method>] и едем дальше.

        Returns:
            {
              "fetched_at": <unix ts>,
              "user": {...},                  # users.get[0]
              "wall": {"count": N, "items": [...]},
              "groups": {"count": N, "items": [...]},
              "errors": {"wall.get": "...", ...}
            }
        """
        if not (vk_id or screen_name):
            raise VKParserError("Нужен vk_id или screen_name")

        target = str(vk_id) if vk_id else screen_name
        result: dict = {"fetched_at": int(time.time()), "errors": {}}

        # 1) users.get — без него остальное смысла не имеет.
        try:
            users = await self._call("users.get", {
                "user_ids": target,
                "fields": VK_USER_FIELDS,
            })
            if not users:
                raise VKParserError("user_not_found")
            result["user"] = users[0]
            real_uid = users[0].get("id")
        except VKParserError as e:
            result["errors"]["users.get"] = str(e)
            return result

        if not real_uid:
            return result

        # 2) wall.get — открытая стена.
        try:
            wall = await self._call("wall.get", {
                "owner_id": real_uid,
                "count": 100,
                "extended": 0,
                "filter": "owner",
            })
            result["wall"] = wall
        except VKParserError as e:
            result["errors"]["wall.get"] = str(e)

        # 3) groups.get — часто закрыто для сервисного токена, пробуем.
        try:
            groups = await self._call("groups.get", {
                "user_id": real_uid,
                "extended": 1,
                "fields": "name,description,members_count,activity",
                "count": 200,
            })
            result["groups"] = groups
        except VKParserError as e:
            result["errors"]["groups.get"] = str(e)

        return result


_parser_singleton: Optional[VKParser] = None


def get_parser() -> VKParser:
    """Singleton, чтобы rate-limit и cache были общими на процесс."""
    global _parser_singleton
    if _parser_singleton is None:
        _parser_singleton = VKParser()
    return _parser_singleton
