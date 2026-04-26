"""
vk_routes.py — Привязка VK-профилей к юзерам Фреди (Фаза 1) + парс (Фаза 2) + признаки (Фаза 3).
"""

import json
import logging
import os
import re
from typing import Optional

from fastapi import HTTPException, Header, Body

logger = logging.getLogger(__name__)


def _check_admin(token: Optional[str]):
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail={"error": "admin_disabled",
                    "message": "Админ-эндпоинты выключены: задайте ADMIN_TOKEN в env"},
        )
    if not token or token != expected:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


_VK_URL_RE = re.compile(
    r"""^
        (?:https?://)?
        (?:[a-z0-9.-]*\.)?vk\.
        (?:com|ru)/
        (?P<rest>[^/?#]+)
        (?:[/?#].*)?
    $""",
    re.IGNORECASE | re.VERBOSE,
)
_NUMERIC_RE = re.compile(r"^\d{1,12}$")
_ID_RE = re.compile(r"^id(\d{1,12})$", re.IGNORECASE)
_SCREEN_RE = re.compile(r"^[a-z][a-z0-9._]{2,31}$", re.IGNORECASE)


def _parse_vk_input(raw: str):
    if not raw or not isinstance(raw, str):
        raise HTTPException(status_code=400, detail={"error": "vk_id_required"})
    s = raw.strip()
    if not s:
        raise HTTPException(status_code=400, detail={"error": "vk_id_required"})
    if _NUMERIC_RE.match(s):
        return int(s), None
    m = _ID_RE.match(s)
    if m:
        return int(m.group(1)), None
    m = _VK_URL_RE.match(s)
    if m:
        rest = m.group("rest")
        m2 = _ID_RE.match(rest)
        if m2:
            return int(m2.group(1)), None
        if _NUMERIC_RE.match(rest):
            return int(rest), None
        if _SCREEN_RE.match(rest):
            return None, rest.lower()
        raise HTTPException(status_code=400, detail={"error": "vk_id_invalid", "input": s})
    if _SCREEN_RE.match(s):
        return None, s.lower()
    raise HTTPException(status_code=400, detail={"error": "vk_id_invalid", "input": s})


def _row_to_dict(r):
    return {
        "user_id": r["user_id"],
        "vk_id": r["vk_id"],
        "vk_screen_name": r["vk_screen_name"],
        "notes": r["notes"] or "",
        "linked_at": r["linked_at"].isoformat() if r["linked_at"] else None,
        "parsed_at": r["parsed_at"].isoformat() if r["parsed_at"] else None,
        "user_name": r["user_name"] or "",
    }


def register_vk_routes(app, db):
    """Регистрирует /api/admin/vk/* и возвращает init-функцию для таблицы."""

    async def init_vk_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_vk_profiles (
                    user_id        BIGINT PRIMARY KEY
                                   REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                    vk_id          BIGINT,
                    vk_screen_name TEXT,
                    notes          TEXT DEFAULT '',
                    vk_data        JSONB,
                    archetype_id   INT,
                    linked_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    parsed_at      TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT fredi_vk_profiles_id_or_screen
                        CHECK (vk_id IS NOT NULL OR vk_screen_name IS NOT NULL)
                )
            """)
            # Phase 3: «слепок признаков» от DeepSeek + время последнего извлечения.
            try:
                await conn.execute(
                    "ALTER TABLE fredi_vk_profiles ADD COLUMN IF NOT EXISTS features JSONB"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_profiles "
                    "ADD COLUMN IF NOT EXISTS features_extracted_at TIMESTAMP WITH TIME ZONE"
                )
            except Exception as e:
                logger.warning(f"features column migration skipped: {e}")
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fredi_vk_profiles_vk_id "
                "ON fredi_vk_profiles(vk_id) WHERE vk_id IS NOT NULL"
            )
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fredi_vk_profiles_screen "
                "ON fredi_vk_profiles(vk_screen_name) WHERE vk_screen_name IS NOT NULL"
            )
            # Phase 4: «близнецы» — кандидаты на outreach.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_vk_candidates (
                    id BIGSERIAL PRIMARY KEY,
                    source_user_id BIGINT NOT NULL
                        REFERENCES fredi_users(user_id) ON DELETE CASCADE,
                    candidate_vk_id BIGINT NOT NULL,
                    candidate_data JSONB,
                    match_score INT NOT NULL DEFAULT 0,
                    matched_groups JSONB DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'new',
                    notes TEXT DEFAULT '',
                    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    contacted_at TIMESTAMP WITH TIME ZONE,
                    UNIQUE(source_user_id, candidate_vk_id)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_vk_candidates_source "
                "ON fredi_vk_candidates(source_user_id, match_score DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_vk_candidates_status "
                "ON fredi_vk_candidates(status)"
            )
            # Phase 7: re-rank by post topic similarity (quality_score 0..100).
            try:
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS quality_score INT"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS quality_reasoning TEXT"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS quality_signals JSONB"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS quality_at TIMESTAMP WITH TIME ZONE"
                )
            except Exception as e:
                logger.warning(f"quality columns migration skipped: {e}")
            # Phase 8: глобальный лог контактов (антиспам + воронка).
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_vk_contacted_log (
                    id BIGSERIAL PRIMARY KEY,
                    vk_id BIGINT NOT NULL,
                    source_user_id BIGINT
                        REFERENCES fredi_users(user_id) ON DELETE SET NULL,
                    candidate_id BIGINT,
                    message TEXT,
                    contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    response_at TIMESTAMP WITH TIME ZONE,
                    response_text TEXT,
                    notes TEXT
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_vk_contacted_log_vk_id "
                "ON fredi_vk_contacted_log(vk_id, contacted_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_vk_contacted_log_source "
                "ON fredi_vk_contacted_log(source_user_id, contacted_at DESC)"
            )
            # Phase 5A: черновик сообщения и метаданные генерации.
            try:
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS draft_message TEXT"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS draft_alternatives JSONB"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS draft_meta JSONB"
                )
                await conn.execute(
                    "ALTER TABLE fredi_vk_candidates "
                    "ADD COLUMN IF NOT EXISTS draft_generated_at TIMESTAMP WITH TIME ZONE"
                )
            except Exception as e:
                logger.warning(f"draft columns migration skipped: {e}")
        logger.info("VK profiles + candidates tables ready (phase 5A)")

    @app.get("/api/admin/vk/links")
    async def vk_list_links(
        limit: int = 100,
        offset: int = 0,
        search: str = "",
        x_admin_token: Optional[str] = Header(default=None),
    ):
        _check_admin(x_admin_token)
        lim = max(1, min(int(limit), 500))
        off = max(0, int(offset))
        q = (search or "").strip()
        async with db.get_connection() as conn:
            base = (
                "SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes, "
                "p.linked_at, p.parsed_at, "
                "COALESCE(c.name, u.first_name, u.username, '') AS user_name "
                "FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id"
            )
            args = []
            where = ""
            if q:
                where = (
                    " WHERE CAST(p.user_id AS TEXT) ILIKE $1 "
                    "OR CAST(p.vk_id AS TEXT) ILIKE $1 "
                    "OR p.vk_screen_name ILIKE $1 "
                    "OR COALESCE(c.name, u.first_name, u.username, '') ILIKE $1"
                )
                args.append(f"%{q}%")
            args_page = args + [lim, off]
            ph_lim = f"${len(args)+1}"
            ph_off = f"${len(args)+2}"
            rows = await conn.fetch(
                base + where + f" ORDER BY p.linked_at DESC LIMIT {ph_lim} OFFSET {ph_off}",
                *args_page,
            )
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id" + where,
                *args,
            )
        return {"total": total or 0, "items": [_row_to_dict(r) for r in rows]}

    @app.post("/api/admin/vk/links")
    async def vk_create_link(payload: dict, x_admin_token: Optional[str] = Header(default=None)):
        _check_admin(x_admin_token)
        try:
            user_id = int(payload.get("user_id"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"error": "user_id_required"})
        if user_id <= 0:
            raise HTTPException(status_code=400, detail={"error": "user_id_invalid"})
        vk_id, screen = _parse_vk_input(payload.get("vk", ""))
        notes = (payload.get("notes") or "").strip()[:500]
        async with db.get_connection() as conn:
            exists = await conn.fetchval("SELECT 1 FROM fredi_users WHERE user_id = $1", user_id)
            if not exists:
                raise HTTPException(status_code=404, detail={"error": "user_not_found", "user_id": user_id})
            try:
                await conn.execute(
                    "INSERT INTO fredi_vk_profiles (user_id, vk_id, vk_screen_name, notes) "
                    "VALUES ($1, $2, $3, $4) "
                    "ON CONFLICT (user_id) DO UPDATE SET "
                    "vk_id = EXCLUDED.vk_id, vk_screen_name = EXCLUDED.vk_screen_name, "
                    "notes = EXCLUDED.notes, linked_at = NOW()",
                    user_id, vk_id, screen, notes,
                )
            except Exception as e:
                msg = str(e)
                if "uq_fredi_vk_profiles_vk_id" in msg or "uq_fredi_vk_profiles_screen" in msg:
                    raise HTTPException(status_code=409, detail={"error": "vk_already_linked",
                                                                  "message": "Этот VK уже привязан к другому user_id"})
                logger.error(f"vk link insert failed: {e}")
                raise HTTPException(status_code=500, detail={"error": "internal"})
            row = await conn.fetchrow(
                "SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes, p.linked_at, p.parsed_at, "
                "COALESCE(c.name, u.first_name, u.username, '') AS user_name "
                "FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id "
                "WHERE p.user_id = $1", user_id,
            )
        return _row_to_dict(row)

    @app.patch("/api/admin/vk/links/{user_id}")
    async def vk_update_link(user_id: int, payload: dict, x_admin_token: Optional[str] = Header(default=None)):
        _check_admin(x_admin_token)
        sets, args = [], []
        if "vk" in payload:
            vk_id, screen = _parse_vk_input(payload.get("vk", ""))
            args.append(vk_id); sets.append(f"vk_id = ${len(args)}")
            args.append(screen); sets.append(f"vk_screen_name = ${len(args)}")
        if "notes" in payload:
            args.append((payload.get("notes") or "").strip()[:500])
            sets.append(f"notes = ${len(args)}")
        if not sets:
            raise HTTPException(status_code=400, detail={"error": "nothing_to_update"})
        args.append(int(user_id))
        async with db.get_connection() as conn:
            try:
                res = await conn.execute(
                    f"UPDATE fredi_vk_profiles SET {', '.join(sets)} WHERE user_id = ${len(args)}",
                    *args,
                )
            except Exception as e:
                msg = str(e)
                if "uq_fredi_vk_profiles_vk_id" in msg or "uq_fredi_vk_profiles_screen" in msg:
                    raise HTTPException(status_code=409, detail={"error": "vk_already_linked"})
                logger.error(f"vk patch failed: {e}")
                raise HTTPException(status_code=500, detail={"error": "internal"})
            if res.endswith(" 0"):
                raise HTTPException(status_code=404, detail={"error": "link_not_found"})
            row = await conn.fetchrow(
                "SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes, p.linked_at, p.parsed_at, "
                "COALESCE(c.name, u.first_name, u.username, '') AS user_name "
                "FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id "
                "WHERE p.user_id = $1", int(user_id),
            )
        return _row_to_dict(row)

    @app.delete("/api/admin/vk/links/{user_id}")
    async def vk_delete_link(user_id: int, x_admin_token: Optional[str] = Header(default=None)):
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            res = await conn.execute("DELETE FROM fredi_vk_profiles WHERE user_id = $1", int(user_id))
        if res.endswith(" 0"):
            raise HTTPException(status_code=404, detail={"error": "link_not_found"})
        return {"ok": True}

    @app.get("/api/admin/vk/users")
    async def vk_users_search(
        search: str = "",
        only_unlinked: bool = True,
        limit: int = 30,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        _check_admin(x_admin_token)
        lim = max(1, min(int(limit), 100))
        q = (search or "").strip()
        where, args = [], []
        if only_unlinked:
            where.append("NOT EXISTS (SELECT 1 FROM fredi_vk_profiles p WHERE p.user_id = u.user_id)")
        if q:
            args.append(f"%{q}%")
            where.append(
                f"(CAST(u.user_id AS TEXT) ILIKE ${len(args)} "
                f"OR u.username ILIKE ${len(args)} "
                f"OR u.first_name ILIKE ${len(args)} "
                f"OR c.name ILIKE ${len(args)})"
            )
        sql = (
            "SELECT u.user_id, u.username, u.first_name, "
            "COALESCE(c.name, u.first_name, u.username, '') AS display_name, "
            "(SELECT m.content FROM fredi_messages m "
            " WHERE m.user_id = u.user_id AND m.role='user' "
            " ORDER BY m.id DESC LIMIT 1) AS last_message "
            "FROM fredi_users u "
            "LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id "
        )
        if where:
            sql += " WHERE " + " AND ".join(where)
        args.append(lim)
        sql += f" ORDER BY u.user_id DESC LIMIT ${len(args)}"
        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *args)
        return {"items": [{
            "user_id": r["user_id"],
            "username": r["username"] or "",
            "display_name": r["display_name"] or "",
            "last_message": (r["last_message"] or "")[:200],
        } for r in rows]}

    @app.get("/api/admin/vk/profile-summary/{user_id}")
    async def vk_profile_summary(
        user_id: int,
        msg_limit: int = 15,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        _check_admin(x_admin_token)
        uid = int(user_id)
        msg_lim = max(1, min(int(msg_limit), 50))
        async with db.get_connection() as conn:
            user = await conn.fetchrow(
                "SELECT user_id, username, first_name, last_name, language_code, "
                "platform, profile, settings, created_at FROM fredi_users WHERE user_id = $1", uid,
            )
            if not user:
                raise HTTPException(status_code=404, detail={"error": "user_not_found"})
            ctx = await conn.fetchrow("SELECT * FROM fredi_user_contexts WHERE user_id = $1", uid)
            messages = await conn.fetch(
                "SELECT role, content, metadata, created_at FROM fredi_messages "
                "WHERE user_id = $1 ORDER BY id DESC LIMIT $2", uid, msg_lim,
            )
            vk_link = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name, notes, linked_at, parsed_at, vk_data, "
                "       features, features_extracted_at "
                "FROM fredi_vk_profiles WHERE user_id = $1", uid,
            )
            user_msg_count = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_messages WHERE user_id = $1 AND role='user'", uid,
            ) or 0

        def _jb(v):
            if v is None:
                return None
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:
                    return v
            return v

        profile = _jb(user["profile"]) or {}
        ctx_dict = {}
        if ctx is not None:
            ctx_dict = {k: _jb(ctx[k]) if k != "user_id" else ctx[k] for k in ctx.keys()}
        msgs_chron = list(messages); msgs_chron.reverse()

        # Phase 9: cross-session memory — отдадим топ-5 сводок прошлых сессий.
        session_summaries = []
        try:
            async with db.get_connection() as conn:
                srows = await conn.fetch(
                    "SELECT id, mode, method_code, started_at, ended_at, message_count, "
                    "       summary, key_facts, continuity_hooks, client_state_at_end, "
                    "       generated_at "
                    "FROM fredi_session_summaries WHERE user_id = $1 "
                    "ORDER BY ended_at DESC LIMIT 5",
                    uid,
                )
            for sr in srows:
                session_summaries.append({
                    "id": sr["id"],
                    "mode": sr["mode"],
                    "method_code": sr["method_code"],
                    "started_at": sr["started_at"].isoformat() if sr["started_at"] else None,
                    "ended_at": sr["ended_at"].isoformat() if sr["ended_at"] else None,
                    "message_count": sr["message_count"],
                    "summary": sr["summary"],
                    "key_facts": _jb(sr["key_facts"]) or {},
                    "continuity_hooks": _jb(sr["continuity_hooks"]) or [],
                    "client_state_at_end": sr["client_state_at_end"],
                    "generated_at": sr["generated_at"].isoformat() if sr["generated_at"] else None,
                })
        except Exception as e:
            # Таблица может ещё не быть создана — это не критично для остального ответа.
            logger.debug(f"session_summaries fetch skipped: {e}")

        return {
            "user_id": uid,
            "user": {
                "username": user["username"] or "",
                "first_name": user["first_name"] or "",
                "last_name": user["last_name"] or "",
                "language_code": user["language_code"] or "",
                "platform": user["platform"] or "",
                "created_at": user["created_at"].isoformat() if user["created_at"] else None,
            },
            "profile": profile,
            "context": ctx_dict,
            "messages": [{
                "role": m["role"], "content": m["content"],
                "metadata": _jb(m["metadata"]) or {},
                "created_at": m["created_at"].isoformat() if m["created_at"] else None,
            } for m in msgs_chron],
            "stats": {"user_msg_count": user_msg_count},
            "session_summaries": session_summaries,
            "vk": ({
                "vk_id": vk_link["vk_id"],
                "vk_screen_name": vk_link["vk_screen_name"],
                "notes": vk_link["notes"] or "",
                "linked_at": vk_link["linked_at"].isoformat() if vk_link["linked_at"] else None,
                "parsed_at": vk_link["parsed_at"].isoformat() if vk_link["parsed_at"] else None,
                "vk_data": _jb(vk_link["vk_data"]),
                "features": _jb(vk_link["features"]),
                "features_extracted_at": (
                    vk_link["features_extracted_at"].isoformat()
                    if vk_link["features_extracted_at"] else None
                ),
            } if vk_link else None),
        }

    @app.get("/api/admin/vk/stats")
    async def vk_stats(x_admin_token: Optional[str] = Header(default=None)):
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            linked = await conn.fetchval("SELECT COUNT(*) FROM fredi_vk_profiles") or 0
            with_vk_id = await conn.fetchval("SELECT COUNT(*) FROM fredi_vk_profiles WHERE vk_id IS NOT NULL") or 0
            parsed = await conn.fetchval("SELECT COUNT(*) FROM fredi_vk_profiles WHERE parsed_at IS NOT NULL") or 0
            extracted = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles WHERE features IS NOT NULL"
            ) or 0
            total_users = await conn.fetchval("SELECT COUNT(*) FROM fredi_users") or 0
        return {
            "linked": linked, "with_vk_id": with_vk_id, "parsed": parsed,
            "extracted": extracted,
            "total_users": total_users,
            "coverage_pct": round((linked / total_users) * 100, 1) if total_users else 0,
        }

    @app.post("/api/admin/vk/parse/{user_id}")
    async def vk_parse_user(user_id: int, x_admin_token: Optional[str] = Header(default=None)):
        """«Копать» — выкачать публичные данные VK-страницы привязанного юзера."""
        _check_admin(x_admin_token)
        uid = int(user_id)
        async with db.get_connection() as conn:
            link = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name FROM fredi_vk_profiles WHERE user_id = $1", uid,
            )
        if not link:
            raise HTTPException(status_code=404, detail={"error": "link_not_found"})
        try:
            from vk_parser import parse_user as _parse_user
        except Exception as e:
            logger.error(f"vk_parser import failed: {e}")
            raise HTTPException(status_code=500, detail={"error": "parser_unavailable",
                                                          "message": "Модуль vk_parser недоступен"})
        try:
            data = await _parse_user(vk_id=link["vk_id"], screen_name=link["vk_screen_name"])
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={"error": "vk_api_error", "message": str(e)})
        except ValueError as e:
            raise HTTPException(status_code=400, detail={"error": "bad_input", "message": str(e)})
        resolved_id = data.get("user", {}).get("id") if isinstance(data.get("user"), dict) else None
        async with db.get_connection() as conn:
            if resolved_id and not link["vk_id"]:
                try:
                    await conn.execute(
                        "UPDATE fredi_vk_profiles SET vk_id = $1, vk_data = $2::jsonb, parsed_at = NOW() "
                        "WHERE user_id = $3",
                        int(resolved_id), json.dumps(data, ensure_ascii=False), uid,
                    )
                except Exception as e:
                    if "uq_fredi_vk_profiles_vk_id" in str(e):
                        await conn.execute(
                            "UPDATE fredi_vk_profiles SET vk_data = $1::jsonb, parsed_at = NOW() "
                            "WHERE user_id = $2", json.dumps(data, ensure_ascii=False), uid,
                        )
                    else:
                        raise
            else:
                await conn.execute(
                    "UPDATE fredi_vk_profiles SET vk_data = $1::jsonb, parsed_at = NOW() WHERE user_id = $2",
                    json.dumps(data, ensure_ascii=False), uid,
                )
        u = data.get("user", {}) if isinstance(data.get("user"), dict) else {}
        wall = data.get("wall", {}) if isinstance(data.get("wall"), dict) else {}
        groups = data.get("groups", {}) if isinstance(data.get("groups"), dict) else {}
        return {
            "ok": True, "user_id": uid,
            "vk_id": resolved_id or link["vk_id"],
            "summary": {
                "name": (str(u.get("first_name") or "") + " " + str(u.get("last_name") or "")).strip(),
                "city": (u.get("city") or {}).get("title") if isinstance(u.get("city"), dict) else None,
                "is_closed": bool(u.get("is_closed")),
                "wall_posts": wall.get("count") if "count" in wall else (None if "error" in wall else 0),
                "wall_error": wall.get("error"),
                "groups_count": groups.get("count") if "count" in groups else (None if "error" in groups else 0),
                "groups_error": groups.get("error"),
            },
        }

    @app.post("/api/admin/vk/extract-features/{user_id}")
    async def vk_extract_features_endpoint(
        user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """«Извлечь признаки» — DeepSeek-анализ собирательного образа + VK-данных.

        На вход берёт всё что есть в БД о юзере: профиль (тест), контекст,
        последние 30 user-сообщений, спарсенный VK. Шлёт в DeepSeek с
        промптом, который требует строгого JSON-слепка с ключевыми темами,
        marker-группами, marker-словами, демографией и стратегиями поиска
        близнецов. Кладёт результат в fredi_vk_profiles.features JSONB.
        """
        _check_admin(x_admin_token)
        uid = int(user_id)

        async with db.get_connection() as conn:
            link = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name, vk_data, parsed_at "
                "FROM fredi_vk_profiles WHERE user_id = $1", uid,
            )
            if not link:
                raise HTTPException(status_code=404, detail={"error": "link_not_found"})
            if not link["parsed_at"]:
                raise HTTPException(status_code=409, detail={
                    "error": "not_parsed",
                    "message": "Сначала нажми «Копать», потом извлекай признаки",
                })
            user = await conn.fetchrow(
                "SELECT user_id, username, first_name, last_name, language_code, "
                "platform, profile FROM fredi_users WHERE user_id = $1", uid,
            )
            if not user:
                raise HTTPException(status_code=404, detail={"error": "user_not_found"})
            ctx = await conn.fetchrow("SELECT * FROM fredi_user_contexts WHERE user_id = $1", uid)
            # Берём больше сообщений чем в profile-summary — модели нужен материал.
            messages = await conn.fetch(
                "SELECT role, content, metadata, created_at FROM fredi_messages "
                "WHERE user_id = $1 ORDER BY id DESC LIMIT 30", uid,
            )

        def _jb(v):
            if v is None:
                return None
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:
                    return v
            return v

        composite = {
            "user": {
                "username": user["username"] or "",
                "first_name": user["first_name"] or "",
                "last_name": user["last_name"] or "",
                "language_code": user["language_code"] or "",
                "platform": user["platform"] or "",
            },
            "profile": _jb(user["profile"]) or {},
            "context": (
                {k: _jb(ctx[k]) if k != "user_id" else ctx[k] for k in ctx.keys()}
                if ctx is not None else {}
            ),
            "messages": list(reversed([{
                "role": m["role"], "content": m["content"],
                "created_at": m["created_at"].isoformat() if m["created_at"] else None,
            } for m in messages])),
        }
        vk_data = _jb(link["vk_data"]) or {}

        try:
            from vk_feature_extractor import extract_features as _extract
        except Exception as e:
            logger.error(f"vk_feature_extractor import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "extractor_unavailable",
                "message": "Модуль vk_feature_extractor недоступен",
            })

        try:
            features = await _extract(composite, vk_data)
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={
                "error": "deepseek_error", "message": str(e),
            })

        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_profiles "
                "SET features = $1::jsonb, features_extracted_at = NOW() "
                "WHERE user_id = $2",
                json.dumps(features, ensure_ascii=False), uid,
            )

        return {
            "ok": True,
            "user_id": uid,
            "features": features,
            "extracted_at_unix": None,  # фронт сам через features_extracted_at в profile-summary возьмёт
        }

    @app.post("/api/admin/vk/find-twins/{user_id}")
    async def vk_find_twins(
        user_id: int,
        max_groups: int = 3,
        max_candidates: int = 50,
        geo_scope: str = "auto",
        min_intersections: int = 3,
        re_rank: bool = False,
        quality_threshold: int = 60,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Найти «близнецов» в VK (Phase 7: двухэтапный поиск).

        Этап 1 (всегда): groups.getMembers + пересечение по marker_groups
          — min_intersections (default 3) — минимум групп пересечения
          — фильтр по demographics + geo_scope
          — сохранение в fredi_vk_candidates

        Этап 2 (опционально, re_rank=true): для каждого кандидата
          — wall.get(count=20) → DeepSeek сравнивает посты со слепком
          — quality_score 0..100, отсев по quality_threshold (default 60)
          — кандидаты ниже порога помечаются status='rejected'
          — стоит DeepSeek-токенов и rate-limit'а VK
        """
        _check_admin(x_admin_token)
        uid = int(user_id)
        max_groups = max(1, min(int(max_groups), 5))
        max_candidates = max(10, min(int(max_candidates), 200))
        min_int = max(1, min(int(min_intersections), 5))
        q_thr = max(0, min(int(quality_threshold), 100))

        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name, features "
                "FROM fredi_vk_profiles WHERE user_id = $1", uid,
            )
        if not row:
            raise HTTPException(status_code=404, detail={"error": "link_not_found"})
        if row["features"] is None:
            raise HTTPException(status_code=409, detail={
                "error": "no_features",
                "message": "Сначала «🧠 Признаки» — без слепка нечего искать",
            })

        features_raw = row["features"]
        features = (
            json.loads(features_raw) if isinstance(features_raw, str) else features_raw
        )
        seed_vk_id = row["vk_id"] or 0

        try:
            from vk_twin_finder import find_twins as _find_twins
        except Exception as e:
            logger.error(f"vk_twin_finder import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "twin_finder_unavailable",
                "message": "Модуль vk_twin_finder недоступен",
            })

        # Whitelist geo_scope; невалидные значения → "auto"
        gs = (geo_scope or "auto").strip().lower()
        if gs not in ("auto", "same_city", "russia", "worldwide"):
            gs = "auto"

        try:
            result = await _find_twins(
                seed_vk_id=int(seed_vk_id),
                features=features,
                max_groups_to_scan=max_groups,
                max_candidates=max_candidates,
                geo_scope=gs,
                min_intersections=min_int,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={"error": "vk_api_error", "message": str(e)})

        candidates = result.get("candidates") or []
        # Записываем кандидатов в БД (UPSERT). Сохраняем match_score, обновляем
        # candidate_data при повторном поиске — чтобы свежие данные ложились.
        if candidates:
            async with db.get_connection() as conn:
                for c in candidates:
                    cvk = int(c.get("vk_id") or 0)
                    if not cvk:
                        continue
                    await conn.execute(
                        "INSERT INTO fredi_vk_candidates "
                        "(source_user_id, candidate_vk_id, candidate_data, match_score, matched_groups, status) "
                        "VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, 'new') "
                        "ON CONFLICT (source_user_id, candidate_vk_id) DO UPDATE SET "
                        "  candidate_data = EXCLUDED.candidate_data, "
                        "  match_score = GREATEST(fredi_vk_candidates.match_score, EXCLUDED.match_score), "
                        "  matched_groups = EXCLUDED.matched_groups",
                        uid, cvk,
                        json.dumps(c, ensure_ascii=False),
                        int(c.get("match_score") or 0),
                        json.dumps(c.get("matched_groups") or [], ensure_ascii=False),
                    )

        # Phase 7B: опциональный re-rank по постам через DeepSeek
        rerank_stats = None
        if re_rank and candidates:
            try:
                from vk_twin_reranker import (
                    fetch_candidate_wall as _fetch_wall,
                    rerank_candidate as _rerank,
                )
                import httpx as _httpx
            except Exception as e:
                logger.error(f"vk_twin_reranker import failed: {e}")
                raise HTTPException(status_code=500, detail={
                    "error": "reranker_unavailable",
                    "message": "Модуль vk_twin_reranker недоступен",
                })

            reranked: list = []
            failed_reranks = 0
            try:
                async with _httpx.AsyncClient() as _vk_client:
                    for c in candidates:
                        cvk = int(c.get("vk_id") or 0)
                        if not cvk:
                            continue
                        wall = await _fetch_wall(_vk_client, cvk)
                        try:
                            rr = await _rerank(features, c, wall)
                        except RuntimeError as _e:
                            logger.warning(f"rerank({cvk}) failed: {_e}")
                            failed_reranks += 1
                            continue
                        reranked.append((c, rr))
            except RuntimeError as e:
                raise HTTPException(status_code=502, detail={"error": "vk_api_error", "message": str(e)})

            # Сохраняем quality_* и переводим status
            async with db.get_connection() as conn:
                for c, rr in reranked:
                    cvk = int(c.get("vk_id") or 0)
                    score = int(rr.get("quality_score") or 0)
                    new_status = "rejected" if score < q_thr else "reviewed"
                    await conn.execute(
                        "UPDATE fredi_vk_candidates "
                        "SET quality_score = $1, quality_reasoning = $2, "
                        "    quality_signals = $3::jsonb, quality_at = NOW(), "
                        "    status = CASE WHEN status IN ('new','reviewed') THEN $4 ELSE status END "
                        "WHERE source_user_id = $5 AND candidate_vk_id = $6",
                        score,
                        rr.get("reasoning") or "",
                        json.dumps({
                            "matched": rr.get("matched_signals") or [],
                            "missing": rr.get("missing_signals") or [],
                        }, ensure_ascii=False),
                        new_status,
                        uid, cvk,
                    )
            rerank_stats = {
                "reranked": len(reranked),
                "failed": failed_reranks,
                "passed_threshold": sum(1 for _, rr in reranked if int(rr.get("quality_score") or 0) >= q_thr),
                "rejected_below_threshold": sum(1 for _, rr in reranked if int(rr.get("quality_score") or 0) < q_thr),
                "threshold": q_thr,
            }

        return {
            "ok": True,
            "user_id": uid,
            "stats": result.get("stats"),
            "groups_used": result.get("groups_used"),
            "demographics_used": result.get("demographics_used"),
            "note": result.get("note"),
            "rerank_stats": rerank_stats,
            "candidates_preview": candidates[:20],  # фронт сам подгрузит остальное через GET
        }

    @app.get("/api/admin/vk/candidates/{user_id}")
    async def vk_list_candidates(
        user_id: int,
        status: str = "",
        limit: int = 100,
        offset: int = 0,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Список найденных близнецов для конкретного source-юзера."""
        _check_admin(x_admin_token)
        uid = int(user_id)
        lim = max(1, min(int(limit), 500))
        off = max(0, int(offset))
        st = (status or "").strip()

        sql = (
            "SELECT id, candidate_vk_id, candidate_data, match_score, matched_groups, "
            "       status, notes, found_at, contacted_at, "
            "       draft_message, draft_alternatives, draft_meta, draft_generated_at, "
            "       quality_score, quality_reasoning, quality_signals, quality_at "
            "FROM fredi_vk_candidates WHERE source_user_id = $1 "
        )
        args: list = [uid]
        if st:
            args.append(st)
            sql += f" AND status = ${len(args)}"
        args.extend([lim, off])
        sql += (
            f" ORDER BY COALESCE(quality_score, -1) DESC, match_score DESC, found_at DESC "
            f"LIMIT ${len(args)-1} OFFSET ${len(args)}"
        )

        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *args)
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_candidates WHERE source_user_id = $1", uid,
            ) or 0

        def _jb(v):
            if v is None:
                return None
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:
                    return v
            return v

        return {
            "total": total,
            "items": [{
                "id": r["id"],
                "vk_id": r["candidate_vk_id"],
                "data": _jb(r["candidate_data"]) or {},
                "match_score": r["match_score"],
                "matched_groups": _jb(r["matched_groups"]) or [],
                "status": r["status"],
                "notes": r["notes"] or "",
                "found_at": r["found_at"].isoformat() if r["found_at"] else None,
                "contacted_at": r["contacted_at"].isoformat() if r["contacted_at"] else None,
                "draft_message": r["draft_message"] or "",
                "draft_alternatives": _jb(r["draft_alternatives"]) or [],
                "draft_meta": _jb(r["draft_meta"]) or {},
                "draft_generated_at": (
                    r["draft_generated_at"].isoformat() if r["draft_generated_at"] else None
                ),
                "quality_score": r["quality_score"],
                "quality_reasoning": r["quality_reasoning"] or "",
                "quality_signals": _jb(r["quality_signals"]) or {},
                "quality_at": (
                    r["quality_at"].isoformat() if r["quality_at"] else None
                ),
            } for r in rows],
        }

    @app.patch("/api/admin/vk/candidates/{candidate_id}")
    async def vk_update_candidate(
        candidate_id: int,
        payload: dict,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Обновить статус и/или заметку кандидата."""
        _check_admin(x_admin_token)
        sets: list = []
        args: list = []
        if "status" in payload:
            allowed = {"new", "reviewed", "contacted", "responded", "rejected", "scheduled"}
            st = str(payload.get("status") or "").strip()
            if st not in allowed:
                raise HTTPException(status_code=400, detail={"error": "bad_status",
                                                              "allowed": sorted(allowed)})
            args.append(st); sets.append(f"status = ${len(args)}")
            if st == "contacted":
                sets.append("contacted_at = NOW()")
        if "notes" in payload:
            args.append(str(payload.get("notes") or "").strip()[:500])
            sets.append(f"notes = ${len(args)}")
        if not sets:
            raise HTTPException(status_code=400, detail={"error": "nothing_to_update"})
        args.append(int(candidate_id))
        new_status = payload.get("status") if "status" in payload else None
        async with db.get_connection() as conn:
            res = await conn.execute(
                f"UPDATE fredi_vk_candidates SET {', '.join(sets)} WHERE id = ${len(args)}",
                *args,
            )
            if res.endswith(" 0"):
                raise HTTPException(status_code=404, detail={"error": "candidate_not_found"})

            # Phase 8: при переводе в 'contacted' пишем в глобальный лог
            # (если ещё не писали для этого кандидата за последний час —
            # защита от двойного клика).
            if new_status == "contacted":
                row = await conn.fetchrow(
                    "SELECT candidate_vk_id, source_user_id, draft_message "
                    "FROM fredi_vk_candidates WHERE id = $1", int(candidate_id),
                )
                if row and row["candidate_vk_id"]:
                    recent = await conn.fetchval(
                        "SELECT 1 FROM fredi_vk_contacted_log "
                        "WHERE candidate_id = $1 AND contacted_at > NOW() - INTERVAL '1 hour'",
                        int(candidate_id),
                    )
                    if not recent:
                        await conn.execute(
                            "INSERT INTO fredi_vk_contacted_log "
                            "(vk_id, source_user_id, candidate_id, message) "
                            "VALUES ($1, $2, $3, $4)",
                            int(row["candidate_vk_id"]),
                            int(row["source_user_id"]) if row["source_user_id"] else None,
                            int(candidate_id),
                            (row["draft_message"] or "")[:2000],
                        )
        return {"ok": True, "id": int(candidate_id)}

    @app.post("/api/admin/vk/candidates/{candidate_id}/draft-message")
    async def vk_draft_message(
        candidate_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Phase 5A: сгенерировать черновик личного сообщения кандидату.

        Берёт features исходного source_user_id (что за проблематика) +
        candidate_data (имя, статус, общие группы), шлёт в DeepSeek через
        vk_outreach. Сохраняет черновик в fredi_vk_candidates.draft_message.

        НЕ отправляет — только генерит. Отправляет оператор вручную.
        """
        _check_admin(x_admin_token)
        cid = int(candidate_id)

        async with db.get_connection() as conn:
            cand = await conn.fetchrow(
                "SELECT id, source_user_id, candidate_vk_id, candidate_data, matched_groups "
                "FROM fredi_vk_candidates WHERE id = $1", cid,
            )
            if not cand:
                raise HTTPException(status_code=404, detail={"error": "candidate_not_found"})
            src = await conn.fetchrow(
                "SELECT features FROM fredi_vk_profiles WHERE user_id = $1",
                int(cand["source_user_id"]),
            )

        if not src or src["features"] is None:
            raise HTTPException(status_code=409, detail={
                "error": "no_features",
                "message": "У source-юзера нет features — сначала «🧠 Признаки»",
            })

        def _jb(v):
            if v is None:
                return None
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:
                    return v
            return v

        features = _jb(src["features"]) or {}
        cand_payload = {
            "data": _jb(cand["candidate_data"]) or {},
            "matched_groups": _jb(cand["matched_groups"]) or [],
        }

        try:
            from vk_outreach import draft_message as _draft
        except Exception as e:
            logger.error(f"vk_outreach import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "outreach_unavailable",
                "message": "Модуль vk_outreach недоступен",
            })

        try:
            result = await _draft(features, cand_payload)
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={
                "error": "deepseek_error", "message": str(e),
            })

        draft = (result.get("draft") or "").strip()
        alts = result.get("alternatives") or []
        meta = {
            "reasoning": result.get("reasoning") or "",
            "hook_used": result.get("hook_used") or "",
            "pain_targeted": result.get("pain_targeted") or "",
            "_meta": result.get("_meta") or {},
        }

        # Phase 8: проверка cooldown — не писали ли уже этому VK ID
        # за последние 30 дней (хоть от другого source-юзера).
        cooldown_warning = None
        if cand["candidate_vk_id"]:
            async with db.get_connection() as conn:
                last = await conn.fetchrow(
                    "SELECT contacted_at, source_user_id, candidate_id "
                    "FROM fredi_vk_contacted_log "
                    "WHERE vk_id = $1 AND contacted_at > NOW() - INTERVAL '30 days' "
                    "ORDER BY contacted_at DESC LIMIT 1",
                    int(cand["candidate_vk_id"]),
                )
            if last:
                # Определяем сколько дней прошло
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                delta = now - last["contacted_at"].replace(tzinfo=timezone.utc) if last["contacted_at"].tzinfo is None else now - last["contacted_at"]
                days_ago = delta.days
                same_source = last["source_user_id"] == int(cand["source_user_id"])
                cooldown_warning = {
                    "days_ago": days_ago,
                    "same_source": same_source,
                    "previous_candidate_id": last["candidate_id"],
                    "message": (
                        f"⚠ Этому VK уже писали {days_ago} дн. назад"
                        + (" (тот же source-юзер)" if same_source else " (другой source-юзер)")
                        + ". Подумай дважды перед повторным контактом."
                    ),
                }

        async with db.get_connection() as conn:
            # При первой генерации статус new → reviewed (оператор посмотрел
            # черновик = просмотрел кандидата). Если уже > reviewed, не трогаем.
            await conn.execute(
                "UPDATE fredi_vk_candidates "
                "SET draft_message = $1, draft_alternatives = $2::jsonb, "
                "    draft_meta = $3::jsonb, draft_generated_at = NOW(), "
                "    status = CASE WHEN status = 'new' THEN 'reviewed' ELSE status END "
                "WHERE id = $4",
                draft,
                json.dumps(alts, ensure_ascii=False),
                json.dumps(meta, ensure_ascii=False),
                cid,
            )

        return {
            "ok": True,
            "candidate_id": cid,
            "candidate_vk_id": cand["candidate_vk_id"],
            "draft": draft,
            "alternatives": alts,
            "reasoning": meta["reasoning"],
            "hook_used": meta["hook_used"],
            "pain_targeted": meta["pain_targeted"],
            "vk_chat_url": f"https://vk.com/im?sel={cand['candidate_vk_id']}",
            "cooldown_warning": cooldown_warning,
        }

    # =========================================================
    # ПОИСК ПО ПРОБЛЕМЕ — альтернативный вход в воронку.
    # Не требует source-юзера Фреди: оператор выбирает категорию,
    # бэк тащит участников из тематических сообществ + фильтрует
    # по демографии. Кандидаты возвращаются транзитом, без записи
    # в fredi_vk_candidates (черновик и отметка «отправил» — отдельным
    # шагом, через драфт по категории, в следующей итерации).
    # =========================================================
    @app.get("/api/admin/vk/problem-categories")
    async def vk_problem_categories(
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Список доступных проблемных категорий для UI."""
        _check_admin(x_admin_token)
        try:
            from services.problem_categories import all_categories
        except Exception as e:
            logger.error(f"problem_categories import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "problem_categories_unavailable",
                "message": "Модуль problem_categories недоступен",
            })
        items = []
        for c in all_categories():
            items.append({
                "code": c["code"],
                "name_ru": c["name_ru"],
                "icon": c["icon"],
                "audience_brief": c.get("audience_brief", ""),
                "best_send_hours": c.get("best_send_hours") or [],
                "demographics": c.get("demographics") or {},
                "archetype_affinity": c.get("archetype_affinity") or [],
            })
        return {"success": True, "categories": items}

    @app.post("/api/admin/vk/search-by-problem")
    async def vk_search_by_problem(
        category: str,
        max_groups: int = 3,
        max_candidates: int = 50,
        members_per_group: int = 1000,
        geo_scope: str = "auto",
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Найти кандидатов по проблемной категории.

        Работает напрямую с VK API — `groups.getById` → `groups.getMembers` →
        фильтр по `category.demographics`. Не сохраняет в БД (транзитный
        результат для оператора). Возвращает список кандидатов с VK-ссылками.
        """
        _check_admin(x_admin_token)
        max_groups = max(1, min(int(max_groups), 5))
        max_candidates = max(10, min(int(max_candidates), 200))
        members_per_group = max(100, min(int(members_per_group), 1000))

        try:
            from vk_problem_search import search_by_problem as _search
        except Exception as e:
            logger.error(f"vk_problem_search import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "problem_search_unavailable",
                "message": "Модуль vk_problem_search недоступен",
            })

        try:
            result = await _search(
                category_code=str(category),
                max_groups_to_scan=max_groups,
                members_per_group=members_per_group,
                max_candidates=max_candidates,
                geo_scope=str(geo_scope or "auto"),
            )
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={
                "error": "vk_api_error", "message": str(e),
            })
        if not result.get("category"):
            raise HTTPException(status_code=400, detail={
                "error": "unknown_category",
                "message": f"Категория не найдена: {category}",
            })
        return {"success": True, **result}

    @app.post("/api/admin/vk/draft-by-problem")
    async def vk_draft_by_problem(
        body: Dict[str, Any] = Body(...),
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Сгенерить черновик для кандидата из поиска по проблеме.

        В отличие от твин-драфта, тут нет источника-Fredi-юзера. Поэтому
        строим синтетический source_features из категории
        (problem_categories.synthesize_features) и кормим существующий
        vk_outreach.draft_message — он пишет в нашем этичном регистре,
        с подтянутыми архетипными директивами.

        Тело запроса:
          {
            "category": "BURNOUT",
            "candidate": { vk_id, first_name, last_name, sex,
                           bdate, city, status, about, from_group: {...} }
          }
        Ответ — то же, что у обычного draft-message: draft, alternatives,
        reasoning, hook_used, pain_targeted.
        """
        _check_admin(x_admin_token)
        category = (body or {}).get("category")
        candidate = (body or {}).get("candidate")
        if not category or not isinstance(candidate, dict):
            raise HTTPException(status_code=400, detail={
                "error": "bad_request",
                "message": "category и candidate обязательны",
            })

        try:
            from services.problem_categories import synthesize_features
        except Exception as e:
            logger.error(f"problem_categories import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "problem_categories_unavailable", "message": str(e),
            })

        source_features = synthesize_features(str(category))
        if not source_features:
            raise HTTPException(status_code=400, detail={
                "error": "unknown_category",
                "message": f"Категория не найдена: {category}",
            })

        # Передаём from_group как matched_groups — copywriter использует
        # это как «нейтральный мостик» при формировании крючка.
        from_group = candidate.get("from_group") or {}
        cand_for_outreach = dict(candidate)
        if from_group and not cand_for_outreach.get("matched_groups"):
            cand_for_outreach["matched_groups"] = [{
                "id": from_group.get("id"),
                "name": from_group.get("name"),
            }]

        try:
            from vk_outreach import draft_message as _draft
        except Exception as e:
            logger.error(f"vk_outreach import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "outreach_unavailable", "message": str(e),
            })

        try:
            result = await _draft(source_features, cand_for_outreach)
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail={
                "error": "deepseek_error", "message": str(e),
            })

        return {
            "success": True,
            "category": category,
            "draft": result.get("draft", ""),
            "alternatives": result.get("alternatives") or [],
            "reasoning": result.get("reasoning") or "",
            "hook_used": result.get("hook_used") or "",
            "pain_targeted": result.get("pain_targeted") or "",
            "vk_chat_url": f"https://vk.com/im?sel={candidate.get('vk_id')}" if candidate.get("vk_id") else None,
        }

    @app.get("/api/admin/vk/funnel")
    async def vk_funnel(
        user_id: Optional[int] = None,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Phase 8: воронка эффективности подбора.

        Если user_id передан — статистика только по этому source-юзеру.
        Без user_id — глобальная по всему VK-таргетингу.
        """
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            if user_id is not None:
                uid = int(user_id)
                # Per-source funnel
                linked = await conn.fetchval(
                    "SELECT 1 FROM fredi_vk_profiles WHERE user_id = $1", uid,
                )
                parsed = await conn.fetchval(
                    "SELECT 1 FROM fredi_vk_profiles WHERE user_id = $1 AND parsed_at IS NOT NULL", uid,
                )
                with_features = await conn.fetchval(
                    "SELECT 1 FROM fredi_vk_profiles WHERE user_id = $1 AND features IS NOT NULL", uid,
                )
                cand_total = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_vk_candidates WHERE source_user_id = $1", uid,
                ) or 0
                by_status = await conn.fetch(
                    "SELECT status, COUNT(*) AS c FROM fredi_vk_candidates "
                    "WHERE source_user_id = $1 GROUP BY status", uid,
                )
                contacted = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_vk_contacted_log WHERE source_user_id = $1", uid,
                ) or 0
                responded = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_vk_contacted_log "
                    "WHERE source_user_id = $1 AND response_at IS NOT NULL", uid,
                ) or 0
                return {
                    "scope": "user", "user_id": uid,
                    "linked": bool(linked), "parsed": bool(parsed),
                    "with_features": bool(with_features),
                    "candidates_total": cand_total,
                    "candidates_by_status": {r["status"]: r["c"] for r in by_status},
                    "contacted_total": contacted,
                    "responded_total": responded,
                    "response_rate_pct": round(100 * responded / contacted, 1) if contacted else 0,
                }

            # Global funnel
            linked = await conn.fetchval("SELECT COUNT(*) FROM fredi_vk_profiles") or 0
            parsed = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles WHERE parsed_at IS NOT NULL"
            ) or 0
            with_features = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles WHERE features IS NOT NULL"
            ) or 0
            cand_total = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_candidates"
            ) or 0
            by_status = await conn.fetch(
                "SELECT status, COUNT(*) AS c FROM fredi_vk_candidates GROUP BY status"
            )
            contacted = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_contacted_log"
            ) or 0
            unique_contacted = await conn.fetchval(
                "SELECT COUNT(DISTINCT vk_id) FROM fredi_vk_contacted_log"
            ) or 0
            responded = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_contacted_log WHERE response_at IS NOT NULL"
            ) or 0
            recent_7d = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_contacted_log "
                "WHERE contacted_at > NOW() - INTERVAL '7 days'"
            ) or 0
            return {
                "scope": "global",
                "linked": linked,
                "parsed": parsed,
                "with_features": with_features,
                "candidates_total": cand_total,
                "candidates_by_status": {r["status"]: r["c"] for r in by_status},
                "contacted_total": contacted,
                "contacted_unique_vk_ids": unique_contacted,
                "contacted_last_7d": recent_7d,
                "responded_total": responded,
                "response_rate_pct": round(100 * responded / contacted, 1) if contacted else 0,
            }

    return init_vk_table
