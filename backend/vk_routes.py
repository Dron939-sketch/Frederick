"""
vk_routes.py — Привязка VK-профилей к юзерам Фреди (Фаза 1).

Это первый кирпичик модуля «Психологический таргетинг через поведенческие
паттерны в соцсетях». На этом этапе VK-профили вводятся вручную из админки:
оператор смотрит диалог юзера, находит его VK и привязывает.

Что доступно сейчас:
  - таблица fredi_vk_profiles (user_id ↔ vk_id/screen_name + заметки),
  - CRUD-эндпоинты под X-Admin-Token,
  - простой парсер вкладывания "id123 / vk.com/durov / 123" в (vk_id, screen_name).

Что будет дальше (отдельные ветки, не в этом модуле):
  - выкачка users.get/wall.get/groups.get/audio.get → vk_data JSONB,
  - таблицы archetypes / archetype_vk_patterns / vk_candidates,
  - матчинг кандидатов и outreach.
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


# Принимаемые форматы:
#   123456                       → vk_id=123456
#   id123456                     → vk_id=123456
#   https://vk.com/id123456      → vk_id=123456
#   vk.com/id123456              → vk_id=123456
#   durov                        → screen_name="durov"
#   https://vk.com/durov         → screen_name="durov"
#   m.vk.com/durov?w=...         → screen_name="durov" (query отбрасываем)
_VK_URL_RE = re.compile(
    r"""^
        (?:https?://)?            # схема — опциональна
        (?:[a-z0-9.-]*\.)?vk\.    # любой поддомен (m.vk., new.vk., …)
        (?:com|ru)/
        (?P<rest>[^/?#]+)         # первый сегмент пути
        (?:[/?#].*)?              # хвост игнорим
    $""",
    re.IGNORECASE | re.VERBOSE,
)
_NUMERIC_RE = re.compile(r"^\d{1,12}$")
_ID_RE = re.compile(r"^id(\d{1,12})$", re.IGNORECASE)
# Допустимые символы screen_name: латиница, цифры, точка, подчёркивание.
# Длина — от 5 до 32 (правило VK), но для club/public пускаем и короче.
_SCREEN_RE = re.compile(r"^[a-z][a-z0-9._]{2,31}$", re.IGNORECASE)


def _parse_vk_input(raw: str):
    """Возвращает (vk_id_int_or_none, screen_name_or_none) или кидает HTTPException(400)."""
    if not raw or not isinstance(raw, str):
        raise HTTPException(status_code=400, detail={"error": "vk_id_required"})
    s = raw.strip()
    if not s:
        raise HTTPException(status_code=400, detail={"error": "vk_id_required"})

    # 1) Голое число
    if _NUMERIC_RE.match(s):
        return int(s), None

    # 2) idNNN
    m = _ID_RE.match(s)
    if m:
        return int(m.group(1)), None

    # 3) URL → достаём первый сегмент
    m = _VK_URL_RE.match(s)
    if m:
        rest = m.group("rest")
        m2 = _ID_RE.match(rest)
        if m2:
            return int(m2.group(1)), None
        if _NUMERIC_RE.match(rest):
            return int(rest), None
        # public123 / club456 — это id со знаком минус в VK API,
        # но тут пока кладём как screen_name, парсер потом разрулит.
        if _SCREEN_RE.match(rest):
            return None, rest.lower()
        raise HTTPException(status_code=400, detail={"error": "vk_id_invalid",
                                                      "input": s})

    # 4) Голый screen_name
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
            # Уникальные индексы по vk_id и screen_name (NULL'ы разрешены —
            # это норма для частичных уникальных индексов в Postgres).
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fredi_vk_profiles_vk_id "
                "ON fredi_vk_profiles(vk_id) WHERE vk_id IS NOT NULL"
            )
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fredi_vk_profiles_screen "
                "ON fredi_vk_profiles(vk_screen_name) WHERE vk_screen_name IS NOT NULL"
            )
        logger.info("VK profiles table ready")

    @app.get("/api/admin/vk/links")
    async def vk_list_links(
        limit: int = 100,
        offset: int = 0,
        search: str = "",
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Список привязок VK ↔ user_id (с именем из контекста)."""
        _check_admin(x_admin_token)
        lim = max(1, min(int(limit), 500))
        off = max(0, int(offset))
        q = (search or "").strip()

        async with db.get_connection() as conn:
            base = """
                SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes,
                       p.linked_at, p.parsed_at,
                       COALESCE(c.name, u.first_name, u.username, '') AS user_name
                FROM fredi_vk_profiles p
                LEFT JOIN fredi_users u ON u.user_id = p.user_id
                LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id
            """
            args = []
            where = ""
            if q:
                where = (
                    " WHERE CAST(p.user_id AS TEXT) ILIKE $1 "
                    "    OR CAST(p.vk_id AS TEXT) ILIKE $1 "
                    "    OR p.vk_screen_name ILIKE $1 "
                    "    OR COALESCE(c.name, u.first_name, u.username, '') ILIKE $1 "
                )
                args.append(f"%{q}%")
            args_with_paging = args + [lim, off]
            placeholder_lim = f"${len(args)+1}"
            placeholder_off = f"${len(args)+2}"
            rows = await conn.fetch(
                base + where + f" ORDER BY p.linked_at DESC LIMIT {placeholder_lim} OFFSET {placeholder_off}",
                *args_with_paging,
            )
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id"
                + where,
                *args,
            )

        return {"total": total or 0, "items": [_row_to_dict(r) for r in rows]}

    @app.post("/api/admin/vk/links")
    async def vk_create_link(
        payload: dict,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Привязать VK к юзеру. Body: {user_id, vk: "id123 | url | screen", notes?}."""
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
            exists = await conn.fetchval(
                "SELECT 1 FROM fredi_users WHERE user_id = $1", user_id
            )
            if not exists:
                raise HTTPException(status_code=404, detail={"error": "user_not_found",
                                                              "user_id": user_id})

            try:
                await conn.execute(
                    "INSERT INTO fredi_vk_profiles "
                    "(user_id, vk_id, vk_screen_name, notes) "
                    "VALUES ($1, $2, $3, $4) "
                    "ON CONFLICT (user_id) DO UPDATE SET "
                    "  vk_id = EXCLUDED.vk_id, "
                    "  vk_screen_name = EXCLUDED.vk_screen_name, "
                    "  notes = EXCLUDED.notes, "
                    "  linked_at = NOW()",
                    user_id, vk_id, screen, notes,
                )
            except Exception as e:
                # Конфликт по уникальности vk_id или screen_name = другой
                # юзер уже привязан к этому VK.
                msg = str(e)
                if "uq_fredi_vk_profiles_vk_id" in msg or "uq_fredi_vk_profiles_screen" in msg:
                    raise HTTPException(status_code=409, detail={
                        "error": "vk_already_linked",
                        "message": "Этот VK уже привязан к другому user_id",
                    })
                logger.error(f"vk link insert failed: {e}")
                raise HTTPException(status_code=500, detail={"error": "internal"})

            row = await conn.fetchrow(
                "SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes, "
                "       p.linked_at, p.parsed_at, "
                "       COALESCE(c.name, u.first_name, u.username, '') AS user_name "
                "FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id "
                "WHERE p.user_id = $1",
                user_id,
            )
        return _row_to_dict(row)

    @app.patch("/api/admin/vk/links/{user_id}")
    async def vk_update_link(
        user_id: int,
        payload: dict,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Обновить vk и/или notes у уже привязанного юзера."""
        _check_admin(x_admin_token)

        sets = []
        args: list = []
        if "vk" in payload:
            vk_id, screen = _parse_vk_input(payload.get("vk", ""))
            args.append(vk_id)
            sets.append(f"vk_id = ${len(args)}")
            args.append(screen)
            sets.append(f"vk_screen_name = ${len(args)}")
        if "notes" in payload:
            args.append((payload.get("notes") or "").strip()[:500])
            sets.append(f"notes = ${len(args)}")
        if not sets:
            raise HTTPException(status_code=400, detail={"error": "nothing_to_update"})

        args.append(int(user_id))
        async with db.get_connection() as conn:
            try:
                res = await conn.execute(
                    f"UPDATE fredi_vk_profiles SET {', '.join(sets)} "
                    f"WHERE user_id = ${len(args)}",
                    *args,
                )
            except Exception as e:
                msg = str(e)
                if "uq_fredi_vk_profiles_vk_id" in msg or "uq_fredi_vk_profiles_screen" in msg:
                    raise HTTPException(status_code=409, detail={
                        "error": "vk_already_linked",
                    })
                logger.error(f"vk patch failed: {e}")
                raise HTTPException(status_code=500, detail={"error": "internal"})
            if res.endswith(" 0"):
                raise HTTPException(status_code=404, detail={"error": "link_not_found"})

            row = await conn.fetchrow(
                "SELECT p.user_id, p.vk_id, p.vk_screen_name, p.notes, "
                "       p.linked_at, p.parsed_at, "
                "       COALESCE(c.name, u.first_name, u.username, '') AS user_name "
                "FROM fredi_vk_profiles p "
                "LEFT JOIN fredi_users u ON u.user_id = p.user_id "
                "LEFT JOIN fredi_user_contexts c ON c.user_id = p.user_id "
                "WHERE p.user_id = $1",
                int(user_id),
            )
        return _row_to_dict(row)

    @app.delete("/api/admin/vk/links/{user_id}")
    async def vk_delete_link(
        user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Отвязать VK от юзера."""
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            res = await conn.execute(
                "DELETE FROM fredi_vk_profiles WHERE user_id = $1", int(user_id)
            )
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
        """Поиск юзеров для привязки. По умолчанию — без VK (only_unlinked=true).

        Используется автокомплитом в форме «привязать»: вводишь user_id или имя,
        видишь подходящих юзеров с превью последнего сообщения.
        """
        _check_admin(x_admin_token)
        lim = max(1, min(int(limit), 100))
        q = (search or "").strip()

        where = []
        args: list = []
        if only_unlinked:
            where.append(
                "NOT EXISTS (SELECT 1 FROM fredi_vk_profiles p WHERE p.user_id = u.user_id)"
            )
        if q:
            args.append(f"%{q}%")
            where.append(
                f"(CAST(u.user_id AS TEXT) ILIKE ${len(args)} "
                f" OR u.username ILIKE ${len(args)} "
                f" OR u.first_name ILIKE ${len(args)} "
                f" OR c.name ILIKE ${len(args)})"
            )
        sql = (
            "SELECT u.user_id, u.username, u.first_name, "
            "       COALESCE(c.name, u.first_name, u.username, '') AS display_name, "
            "       (SELECT m.content FROM fredi_messages m "
            "         WHERE m.user_id = u.user_id AND m.role='user' "
            "         ORDER BY m.id DESC LIMIT 1) AS last_message "
            "FROM fredi_users u "
            "LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id "
        )
        if where:
            sql += " WHERE " + " AND ".join(where)
        args.append(lim)
        sql += f" ORDER BY u.user_id DESC LIMIT ${len(args)}"

        async with db.get_connection() as conn:
            rows = await conn.fetch(sql, *args)
        return {
            "items": [{
                "user_id": r["user_id"],
                "username": r["username"] or "",
                "display_name": r["display_name"] or "",
                "last_message": (r["last_message"] or "")[:200],
            } for r in rows]
        }

    @app.get("/api/admin/vk/profile-summary/{user_id}")
    async def vk_profile_summary(
        user_id: int,
        msg_limit: int = 15,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """«Собирательный образ» юзера: тесты + профиль + диалоги.

        Это то, что оператор смотрит, прежде чем ввести VK ID — чтобы потом
        связать поведение в VK с конкретной проблематикой и архетипом.

        Источники (всё, что есть в БД сейчас):
          - fredi_users.profile (JSONB) — результаты теста, vectors, attachment
          - fredi_user_contexts (имя, что про себя рассказывал)
          - fredi_messages — последние N user-сообщений (диалог с Фреди)
          - fredi_vk_profiles — уже ли привязан VK
        """
        _check_admin(x_admin_token)
        uid = int(user_id)
        msg_lim = max(1, min(int(msg_limit), 50))

        async with db.get_connection() as conn:
            user = await conn.fetchrow(
                "SELECT user_id, username, first_name, last_name, language_code, "
                "       platform, profile, settings, created_at "
                "FROM fredi_users WHERE user_id = $1",
                uid,
            )
            if not user:
                raise HTTPException(status_code=404, detail={"error": "user_not_found"})

            ctx = await conn.fetchrow(
                "SELECT * FROM fredi_user_contexts WHERE user_id = $1", uid
            )
            messages = await conn.fetch(
                "SELECT role, content, metadata, created_at FROM fredi_messages "
                "WHERE user_id = $1 ORDER BY id DESC LIMIT $2",
                uid, msg_lim,
            )
            vk_link = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name, notes, linked_at, parsed_at "
                "FROM fredi_vk_profiles WHERE user_id = $1",
                uid,
            )
            user_msg_count = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_messages WHERE user_id = $1 AND role='user'",
                uid,
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

        msgs_chron = list(messages)
        msgs_chron.reverse()  # от старых к новым — читать как чат

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
            # Сюда попадают результаты теста, vectors, profile_code, attachment,
            # core_fears, defenses — всё, что бэкенд кладёт в users.profile.
            "profile": profile,
            "context": ctx_dict,  # имя + произвольные поля fredi_user_contexts
            "messages": [{
                "role": m["role"],
                "content": m["content"],
                "metadata": _jb(m["metadata"]) or {},
                "created_at": m["created_at"].isoformat() if m["created_at"] else None,
            } for m in msgs_chron],
            "stats": {
                "user_msg_count": user_msg_count,
            },
            "vk": ({
                "vk_id": vk_link["vk_id"],
                "vk_screen_name": vk_link["vk_screen_name"],
                "notes": vk_link["notes"] or "",
                "linked_at": vk_link["linked_at"].isoformat() if vk_link["linked_at"] else None,
                "parsed_at": vk_link["parsed_at"].isoformat() if vk_link["parsed_at"] else None,
            } if vk_link else None),
        }

    @app.get("/api/admin/vk/stats")
    async def vk_stats(x_admin_token: Optional[str] = Header(default=None)):
        """Сводка для шапки вкладки: сколько привязано / спарсено / всего юзеров."""
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            linked = await conn.fetchval("SELECT COUNT(*) FROM fredi_vk_profiles") or 0
            with_vk_id = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles WHERE vk_id IS NOT NULL"
            ) or 0
            parsed = await conn.fetchval(
                "SELECT COUNT(*) FROM fredi_vk_profiles WHERE parsed_at IS NOT NULL"
            ) or 0
            total_users = await conn.fetchval("SELECT COUNT(*) FROM fredi_users") or 0
        return {
            "linked": linked,
            "with_vk_id": with_vk_id,
            "parsed": parsed,
            "total_users": total_users,
            "coverage_pct": round((linked / total_users) * 100, 1) if total_users else 0,
        }

    return init_vk_table
