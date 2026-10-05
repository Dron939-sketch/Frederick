# -*- coding: utf-8 -*-
"""Замок Лектория: первая лекция нового курса открыта, остальные — по подписке Фреди.

Решение владельца 05.10.2026: новые курсы («Обида», «Измена и ревность» и
дальше по очереди) продаются подпиской. На сайте у лекций 2–10 в HTML
остаются только шапка, врез, возврат к прошлой лекции, план и FAQ, а тело
лекции лежит здесь, в data/lektorij_locked/<slug>.html, и отдаётся
страницей по /api/lektorij/lecture/<slug>?user_id=… только тому, у кого
активная подписка. Озвучка таких лекций тоже за замком: /status не выдаёт
подписанный адрес mp3 без подписки (blog_tts_routes).

Фрагменты кладёт сборщик курса на сайте (scratchpad/<kurs>/build.py →
LOCK_DIR), конвейер озвучки подставляет их обратно в страницу перед
извлечением текста (inject), чтобы диктор читал лекцию целиком.
"""
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

LOCK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lektorij_locked")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,120}$")
_GATE_RE = re.compile(r'<div id="lockGate"[^>]*></div>')
_CANON_RE = re.compile(r'<link rel="canonical" href="https?://[^"/]+/blog/([a-z0-9][a-z0-9-]{2,120})\.html"')


def _path(slug: str) -> str:
    return os.path.join(LOCK_DIR, f"{slug}.html")


def is_locked(slug: str) -> bool:
    return bool(slug and SLUG_RE.match(slug)) and os.path.exists(_path(slug))


def locked_slugs() -> list:
    try:
        return sorted(f[:-5] for f in os.listdir(LOCK_DIR) if f.endswith(".html"))
    except FileNotFoundError:
        return []


def fragment(slug: str) -> Optional[str]:
    if not is_locked(slug):
        return None
    with open(_path(slug), encoding="utf-8") as f:
        return f.read()


def inject(page: str, slug: str = "") -> str:
    """Возвращает страницу с телом лекции на месте замка (для озвучки и
    любых серверных читателей). Слаг берётся из canonical, если не передан."""
    if not slug:
        m = _CANON_RE.search(page or "")
        slug = m.group(1) if m else ""
    frag = fragment(slug)
    if not frag or "lockGate" not in page:
        return page
    return _GATE_RE.sub(lambda _m: frag, page, count=1)


def _uid(user_id) -> Optional[int]:
    s = str(user_id or "").strip()
    return int(s) if s.isdigit() and len(s) < 20 else None


async def is_premium(user_id) -> bool:
    """Активная подписка (проба или месяц). Тихий: при сбое — нет."""
    uid = _uid(user_id)
    if not uid:
        return False
    try:
        from meter_routes import subscription_meter as _m
        return bool(_m and await _m.has_active_subscription(uid))
    except Exception as e:
        logger.debug(f"lektorij lock premium check skip: {e}")
        return False


def register_lektorij_lock_routes(app, limiter):
    from fastapi import Request
    from fastapi.responses import JSONResponse

    @app.get("/api/lektorij/lecture/{slug}")
    @limiter.limit("60/minute")
    async def lektorij_lecture(request: Request, slug: str, user_id: str = ""):
        if not SLUG_RE.match(slug or ""):
            return JSONResponse({"error": "bad slug"}, status_code=400)
        if not is_locked(slug):
            return {"locked": False, "open": True}
        if not _uid(user_id):
            return {"locked": True, "open": False, "reason": "anon"}
        if await is_premium(user_id):
            return {"locked": True, "open": True, "html": fragment(slug)}
        return {"locked": True, "open": False, "reason": "nosub"}

    @app.get("/api/lektorij/locked")
    async def lektorij_locked(request: Request):
        return {"slugs": locked_slugs(), "count": len(locked_slugs())}

    logger.info(f"🔒 Лекторий: за замком {len(locked_slugs())} лекций")
