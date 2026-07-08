# -*- coding: utf-8 -*-
"""Запись на будущие курсы Лектория (waitlist) для валидации спроса.

Публичная форма на каталоге шлёт заявку сюда, мы копим её в PostgreSQL,
а админ-дашборд показывает рейтинг курсов по числу желающих — так видно,
какой курс наполнять первым. Никакой персоналки кроме добровольного
контакта (email/telegram) не собираем.
"""
import json
import logging
import os
import re

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# slug курса: латиница/цифры/дефис — как каталожные директории Лектория
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,80}$")


def register_waitlist_routes(app, db, limiter):

    async def init_waitlist_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS course_waitlist (
                    id BIGSERIAL PRIMARY KEY,
                    course_slug TEXT NOT NULL,
                    course_title TEXT,
                    contact TEXT NOT NULL,
                    name TEXT,
                    source TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_course_waitlist_course "
                "ON course_waitlist(course_slug, created_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_course_waitlist_created "
                "ON course_waitlist(created_at DESC)"
            )
        logger.info("Course waitlist table ready")

    @app.post("/api/lektorij/waitlist")
    @limiter.limit("10/minute")
    async def waitlist_signup(request: Request):
        """Приём заявки «записаться на курс». Публичный, антиспам — лимитер
        и дедуп по (курс, контакт). Тело: {course, title, contact, name}."""
        try:
            body = await request.body()
            if len(body) > 4000:
                return JSONResponse({"ok": False, "error": "too_large"}, status_code=413)
            data = json.loads(body or "{}")
        except Exception:
            return JSONResponse({"ok": False, "error": "bad_json"}, status_code=400)
        if not isinstance(data, dict):
            return JSONResponse({"ok": False, "error": "bad_body"}, status_code=400)

        slug = str(data.get("course", "")).strip().lower()
        if not _SLUG_RE.match(slug):
            return JSONResponse({"ok": False, "error": "bad_course"}, status_code=400)
        contact = str(data.get("contact", "")).strip()
        if not (3 <= len(contact) <= 200):
            return JSONResponse({"ok": False, "error": "bad_contact"}, status_code=400)
        title = str(data.get("title", "")).strip()[:120] or None
        name = str(data.get("name", "")).strip()[:120] or None

        try:
            async with db.get_connection() as conn:
                # дедуп: тот же контакт на тот же курс за последние 90 дней
                dup = await conn.fetchval(
                    "SELECT 1 FROM course_waitlist "
                    "WHERE course_slug = $1 AND lower(contact) = lower($2) "
                    "AND created_at > NOW() - INTERVAL '90 days' LIMIT 1",
                    slug, contact,
                )
                if dup:
                    return {"ok": True, "dup": True}
                await conn.execute(
                    "INSERT INTO course_waitlist (course_slug, course_title, contact, name, source) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    slug, title, contact, name, "catalog",
                )
        except Exception as e:
            logger.error(f"waitlist insert error: {e}")
            return JSONResponse({"ok": False, "error": "server"}, status_code=500)
        return {"ok": True}

    @app.get("/api/lektorij/waitlist")
    async def waitlist_list(request: Request):
        """Сводка заявок для дашборда (админ). Рейтинг курсов по числу
        желающих + последние заявки. Защита — X-Admin-Token = env ADMIN_TOKEN."""
        expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
        if not expected or (request.headers.get("X-Admin-Token") or "").strip() != expected:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        try:
            async with db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT course_slug, "
                    "  max(course_title) AS course_title, "
                    "  count(*) AS cnt, "
                    "  count(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS cnt_7d, "
                    "  max(created_at) AS last_at "
                    "FROM course_waitlist "
                    "GROUP BY course_slug ORDER BY cnt DESC, last_at DESC"
                )
                recent = await conn.fetch(
                    "SELECT course_slug, course_title, contact, name, created_at "
                    "FROM course_waitlist ORDER BY created_at DESC LIMIT 100"
                )
                total = await conn.fetchval("SELECT count(*) FROM course_waitlist")
        except Exception as e:
            logger.error(f"waitlist list error: {e}")
            return JSONResponse({"error": "server"}, status_code=500)

        courses = [{
            "slug": r["course_slug"],
            "title": r["course_title"],
            "count": r["cnt"],
            "count_7d": r["cnt_7d"],
            "last_at": r["last_at"].isoformat() if r["last_at"] else None,
        } for r in rows]
        recent_list = [{
            "slug": r["course_slug"],
            "title": r["course_title"],
            "contact": r["contact"],
            "name": r["name"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        } for r in recent]
        return {"total": total or 0, "courses": courses, "recent": recent_list}

    return init_waitlist_table
