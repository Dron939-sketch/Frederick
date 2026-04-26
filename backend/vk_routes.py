"""
vk_routes.py — Привязка VK-профилей к юзерам Фреди (Фаза 1) + парс (Фаза 2) + признаки (Фаза 3).
"""

import json
import logging
import os
import re
from typing import Optional

from fastapi import HTTPException, Header

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
        logger.info("VK profiles + candidates tables ready (phase 4)")

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
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Найти «близнецов» в VK по слепку признаков юзера (нужен extract-features).

        Стратегия (см. backend/vk_twin_finder.py):
          1) groups.getMembers для топ-N marker_groups
          2) пересечение → фильтр по demographics → скоринг
          3) запись в fredi_vk_candidates (UPSERT по (source_user_id, candidate_vk_id))
          4) возвращает stats + первые 50 кандидатов
        """
        _check_admin(x_admin_token)
        uid = int(user_id)
        max_groups = max(1, min(int(max_groups), 5))
        max_candidates = max(10, min(int(max_candidates), 200))

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

        try:
            result = await _find_twins(
                seed_vk_id=int(seed_vk_id),
                features=features,
                max_groups_to_scan=max_groups,
                max_candidates=max_candidates,
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

        return {
            "ok": True,
            "user_id": uid,
            "stats": result.get("stats"),
            "groups_used": result.get("groups_used"),
            "demographics_used": result.get("demographics_used"),
            "note": result.get("note"),
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
            "       status, notes, found_at, contacted_at "
            "FROM fredi_vk_candidates WHERE source_user_id = $1 "
        )
        args: list = [uid]
        if st:
            args.append(st)
            sql += f" AND status = ${len(args)}"
        args.extend([lim, off])
        sql += f" ORDER BY match_score DESC, found_at DESC LIMIT ${len(args)-1} OFFSET ${len(args)}"

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
        async with db.get_connection() as conn:
            res = await conn.execute(
                f"UPDATE fredi_vk_candidates SET {', '.join(sets)} WHERE id = ${len(args)}",
                *args,
            )
        if res.endswith(" 0"):
            raise HTTPException(status_code=404, detail={"error": "candidate_not_found"})
        return {"ok": True, "id": int(candidate_id)}

    return init_vk_table
