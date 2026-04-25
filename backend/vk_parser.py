"""
vk_parser.py — async VK API client (Phase 2).

Тащит публичные данные профиля для построения «образа»:
  - users.get  (имя, город, дата рождения, статус, инфа о себе, музыка/интересы/цитаты, фото)
  - wall.get   (последние 100 постов — для NLP-анализа тональности и ключевых тем)
  - groups.get (топ-паблики — для матчинга по интересам)

Что НЕ делаем:
  - audio.get — VK закрыл доступ к аудио для большинства приложений с 2016 года,
    сервисный токен здесь бесполезен. Если нужно — придётся OAuth с правами audio.

Хранение токена: env `VK_SERVICE_TOKEN` (Render env). В коде/git токен не лежит.

Rate-limit: VK API даёт 3 rps сервисному приложению. Глобальный asyncio.Lock
гарантирует ≥333 мс между вызовами в рамках процесса.

Кэш: in-memory dict с TTL 7 дней (юзер не меняет город каждый час, лента
тоже разворачивается за минуты, не за секунды). Persistent cache не нужен —
если процесс перезапустится, повторно дёрнем VK, это не критично.
"""

import asyncio
import logging
import os
import time
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

VK_API_BASE = "https://api.vk.com/method"
VK_API_VERSION = "5.199"

# 3 rps → минимум 333 мс между вызовами.
_RATE_LIMIT_DELAY = 0.34
_last_call_at = 0.0
_rate_lock = asyncio.Lock()

# Кэш: {(method, frozen_params): (expires_at, response)}
_cache: Dict[Tuple[str, Tuple], Tuple[float, Any]] = {}
_CACHE_TTL = 7 * 24 * 3600  # 7 дней

# Поля users.get — то, что реально используем для образа.
_USER_FIELDS = (
    "city,country,bdate,status,about,quotes,interests,music,books,movies,games,"
    "tv,activities,personal,relation,sex,photo_max,photo_max_orig,counters,"
    "is_closed,can_access_closed,site,occupation,career,last_seen"
)
_GROUP_FIELDS = "name,description,activity,members_count,is_closed"


def _get_token() -> str:
    tok = (os.environ.get("VK_SERVICE_TOKEN") or "").strip()
    if not tok:
        raise RuntimeError("VK_SERVICE_TOKEN не задан в env")
    return tok


def _cache_key(method: str, params: Dict[str, Any]) -> Tuple[str, Tuple]:
    # Не включаем access_token в ключ кэша, иначе при ротации токена кэш протухнет.
    items = tuple(sorted((k, str(v)) for k, v in params.items() if k != "access_token"))
    return method, items


async def _call(client: httpx.AsyncClient, method: str, params: Dict[str, Any]) -> Any:
    """Generic VK API call с rate-limit + кэшем."""
    key = _cache_key(method, params)
    now = time.time()
    cached = _cache.get(key)
    if cached and cached[0] > now:
        return cached[1]

    global _last_call_at
    async with _rate_lock:
        elapsed = time.time() - _last_call_at
        if elapsed < _RATE_LIMIT_DELAY:
            await asyncio.sleep(_RATE_LIMIT_DELAY - elapsed)
        _last_call_at = time.time()

    full_params = dict(params)
    full_params["access_token"] = _get_token()
    full_params["v"] = VK_API_VERSION

    try:
        r = await client.get(f"{VK_API_BASE}/{method}", params=full_params, timeout=15.0)
    except httpx.HTTPError as e:
        raise RuntimeError(f"VK API network error ({method}): {e}")

    if r.status_code != 200:
        raise RuntimeError(f"VK API HTTP {r.status_code} ({method})")

    data = r.json()
    if "error" in data:
        err = data["error"]
        code = err.get("error_code")
        msg = err.get("error_msg", "")
        # Капчу/блок не маскируем — передаём явно, оператор увидит в админке.
        raise RuntimeError(f"VK API {method} error {code}: {msg}")

    response = data.get("response")
    _cache[key] = (now + _CACHE_TTL, response)
    return response


async def parse_user(
    vk_id: Optional[int] = None,
    screen_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Тащит users.get + wall.get + groups.get для одного юзера VK.

    Принимает либо vk_id (число), либо screen_name (строка типа 'durov'). Если
    задан только screen_name — users.get сам резолвит его в id, мы возвращаем
    числовой id в `user.id`, а вызывающий код может сохранить его в БД.

    Возвращает dict:
        {
          "user":   { ... users.get item ... },
          "wall":   { count, items: [...] }   или { error: "..." },
          "groups": { count, items: [...] }   или { error: "..." },
          "fetched_at": <unix ts>
        }

    На закрытом профиле wall/groups придут с error — это нормальное поведение,
    в БД положим как есть, оператор будет видеть.
    """
    if not vk_id and not screen_name:
        raise ValueError("vk_id или screen_name обязательны")

    user_ref = str(vk_id) if vk_id else screen_name

    async with httpx.AsyncClient() as client:
        # 1) users.get — определяет id, тянет основные поля
        users_resp = await _call(client, "users.get", {
            "user_ids": user_ref,
            "fields": _USER_FIELDS,
        })
        if not users_resp:
            raise RuntimeError(f"VK user '{user_ref}' не найден")
        user = users_resp[0]
        resolved_id = user.get("id")
        if not resolved_id:
            raise RuntimeError(f"VK не вернул id для '{user_ref}'")

        # 2) wall.get — последние 100 постов
        wall: Dict[str, Any]
        try:
            wall_resp = await _call(client, "wall.get", {
                "owner_id": resolved_id,
                "count": 100,
                "extended": 0,
            })
            wall = wall_resp if isinstance(wall_resp, dict) else {"raw": wall_resp}
        except RuntimeError as e:
            wall = {"error": str(e)}

        # 3) groups.get — топ-паблики
        groups: Dict[str, Any]
        try:
            groups_resp = await _call(client, "groups.get", {
                "user_id": resolved_id,
                "extended": 1,
                "fields": _GROUP_FIELDS,
                "count": 100,
            })
            groups = groups_resp if isinstance(groups_resp, dict) else {"raw": groups_resp}
        except RuntimeError as e:
            groups = {"error": str(e)}

    return {
        "user": user,
        "wall": wall,
        "groups": groups,
        "fetched_at": int(time.time()),
    }


def cache_size() -> int:
    """Утилита для дебага — сколько ключей в кэше."""
    return len(_cache)


def cache_clear() -> None:
    _cache.clear()
