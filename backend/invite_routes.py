# -*- coding: utf-8 -*-
"""Приглашение второго человека в разговор — ссылки и их учёт.

См. modes/prompts/invite.py — зачем это и как Фреди предлагает.

Ручки:
  POST /api/invite/create           {user_id, relation} → {success, token, url}
  GET  /api/invite/{token}          → {ok, relation}  (отмечает открытие)
  POST /api/invite/{token}/accept   {user_id} → {ok}   (второй человек начал)
  GET  /api/admin/invites?days=7    сводка: выдано / открыто / принято

Что хранится: кто выдал, кому (слово «муж», «сын» — как назвала модель),
когда открыли и кто принял. Никакого содержания разговоров: второй
человек не видит слов первого и наоборот, и база этого не нарушает —
связь между двумя user_id есть только здесь, для счёта воронки.

Ограничение: не больше пяти ссылок в сутки на одного приглашающего —
защита от скрипта, который наделает тысячу токенов.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import hmac
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

SITE_BASE = os.environ.get("SITE_BASE_URL", "https://meysternlp.ru").rstrip("/")
MAX_PER_DAY = 5
RELATION_MAX = 20
INVITE_SENT_WINDOW_DAYS = 7


def _check_admin(token):
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail={"error": "admin_disabled"})
    if not token or not hmac.compare_digest(str(token), expected):
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


def _uid(v):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 else 0


def _clean_relation(v) -> str:
    s = str(v or "").strip().lower()
    s = "".join(ch for ch in s if ch.isalpha() or ch in " -")
    return s[:RELATION_MAX] or "близкий"


def _token_ok(t: str) -> bool:
    return bool(t) and 8 <= len(t) <= 32 and all(c.isalnum() or c in "-_" for c in t)


async def invite_flags(db, user_id: int) -> dict:
    """Флаги для промпта: выдавал ли человек ссылку за последнюю неделю и
    пришёл ли он сам по приглашению. Оба запроса дешёвые, таблица мала."""
    out = {"invite_sent": False, "invited_as": ""}
    if not user_id:
        return out
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM fredi_invites WHERE inviter_user_id = $1 "
                "AND created_at > NOW() - make_interval(days => $2) LIMIT 1",
                user_id, INVITE_SENT_WINDOW_DAYS)
            out["invite_sent"] = row is not None
            row = await conn.fetchrow(
                "SELECT relation FROM fredi_invites WHERE invitee_user_id = $1 "
                "ORDER BY accepted_at DESC NULLS LAST LIMIT 1", user_id)
            if row:
                out["invited_as"] = row["relation"] or "близкий"
    except Exception as e:
        logger.debug(f"invite_flags skip: {e}")
    return out


def register_invite_routes(app, db, limiter):

    async def init_invite_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_invites (
                    token TEXT PRIMARY KEY,
                    inviter_user_id BIGINT NOT NULL,
                    relation TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    opened_at TIMESTAMPTZ,
                    invitee_user_id BIGINT,
                    accepted_at TIMESTAMPTZ
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS fredi_invites_inviter_idx "
                "ON fredi_invites (inviter_user_id, created_at)")
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS fredi_invites_invitee_idx "
                "ON fredi_invites (invitee_user_id)")
        logger.info("Invites table ready")

    @app.post("/api/invite/create")
    @limiter.limit("10/minute")
    async def invite_create(request: Request):
        try:
            data = await request.json()
        except Exception:
            return {"success": False, "error": "invalid JSON"}
        user_id = _uid(data.get("user_id"))
        if not user_id:
            return {"success": False, "error": "user_id"}
        relation = _clean_relation(data.get("relation"))
        async with db.get_connection() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_invites WHERE inviter_user_id = $1 "
                "AND created_at > NOW() - INTERVAL '1 day'", user_id)
            if int(n or 0) >= MAX_PER_DAY:
                return {"success": False, "error": "limit"}
            token = secrets.token_urlsafe(9)
            await conn.execute(
                "INSERT INTO fredi_invites (token, inviter_user_id, relation) VALUES ($1, $2, $3)",
                token, user_id, relation)
        url = f"{SITE_BASE}/fredi/?invite={token}"
        logger.info(f"invite created by {user_id} for {relation}")
        return {"success": True, "token": token, "url": url, "relation": relation}

    @app.get("/api/invite/{token}")
    @limiter.limit("30/minute")
    async def invite_get(request: Request, token: str):
        if not _token_ok(token):
            return {"ok": False}
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT relation, inviter_user_id, created_at FROM fredi_invites WHERE token = $1", token)
            if not row:
                return {"ok": False}
            await conn.execute(
                "UPDATE fredi_invites SET opened_at = COALESCE(opened_at, NOW()) WHERE token = $1", token)
        return {"ok": True, "relation": row["relation"] or "близкий"}

    @app.post("/api/invite/{token}/accept")
    @limiter.limit("30/minute")
    async def invite_accept(request: Request, token: str):
        if not _token_ok(token):
            return {"ok": False}
        try:
            data = await request.json()
        except Exception:
            return {"ok": False, "error": "invalid JSON"}
        user_id = _uid(data.get("user_id"))
        if not user_id:
            return {"ok": False, "error": "user_id"}
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT inviter_user_id, invitee_user_id FROM fredi_invites WHERE token = $1", token)
            if not row:
                return {"ok": False}
            # Сам себе ссылку открыл — не считаем вторым человеком.
            if int(row["inviter_user_id"]) == user_id:
                return {"ok": True, "self": True}
            if row["invitee_user_id"] and int(row["invitee_user_id"]) != user_id:
                # Ссылка уже занята другим — это не ошибка для человека,
                # но второго приглашённого по одной ссылке не ведём.
                return {"ok": True, "taken": True}
            await conn.execute(
                "UPDATE fredi_invites SET invitee_user_id = $2, accepted_at = COALESCE(accepted_at, NOW()) "
                "WHERE token = $1", token, user_id)
        return {"ok": True}

    @app.get("/api/admin/invites")
    async def admin_invites(request: Request):
        _check_admin(request.headers.get("X-Admin-Token") or request.headers.get("x-admin-token"))
        try:
            days = max(1, min(90, int(request.query_params.get("days") or 7)))
        except ValueError:
            days = 7
        async with db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT token, inviter_user_id, relation, created_at, opened_at, invitee_user_id, accepted_at "
                "FROM fredi_invites WHERE created_at > NOW() - make_interval(days => $1) "
                "ORDER BY created_at DESC LIMIT 500", days)
        items = []
        for r in rows:
            items.append({
                "inviter": int(r["inviter_user_id"]),
                "relation": r["relation"],
                "created_at": str(r["created_at"]),
                "opened_at": str(r["opened_at"]) if r["opened_at"] else None,
                "invitee": int(r["invitee_user_id"]) if r["invitee_user_id"] else None,
                "accepted_at": str(r["accepted_at"]) if r["accepted_at"] else None,
            })
        return {
            "days": days,
            "created": len(items),
            "opened": sum(1 for i in items if i["opened_at"]),
            "accepted": sum(1 for i in items if i["accepted_at"]),
            "items": items,
        }

    return init_invite_table
