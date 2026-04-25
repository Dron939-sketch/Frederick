"""
vk_phase2_routes.py — Эндпоинты фазы 2: парсинг VK + просмотр сырых данных.

Вынесено в отдельный модуль, чтобы не пушить 24-килобайтный vk_routes.py
ради двух новых ручек (большие push'ы через MCP падают по stream timeout).

Регистрируется chain-bootstrap'ом из analytics_routes.py — рядом с
register_vk_routes из фазы 1. Парсер импортируется лениво: если httpx
или VK_SERVICE_TOKEN отсутствуют, основные эндпоинты VK не падают.

TODO: когда signing-сервер харнесса починят — слить всё это обратно
в vk_routes.py одним нормальным коммитом.
"""

import json
import logging
import os
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


def register_vk_phase2_routes(app, db):
    """Регистрирует /api/admin/vk/parse/{user_id} и /api/admin/vk/parsed/{user_id}."""

    @app.post("/api/admin/vk/parse/{user_id}")
    async def vk_parse(
        user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Парсит публичные данные VK через API и кладёт сырой JSON в vk_data.

        Что выкачиваем (см. backend/vk_parser.py):
          - users.get  (имя, город, статус, интересы, музыка, цитаты, ...)
          - wall.get   (последние 100 постов — если стена открыта)
          - groups.get (паблики — часто закрыто, ок)

        Кэш на стороне парсера 7 суток: повторные «Копать» по тому же
        юзеру не будут стучать в VK API.
        """
        _check_admin(x_admin_token)
        uid = int(user_id)

        async with db.get_connection() as conn:
            link = await conn.fetchrow(
                "SELECT vk_id, vk_screen_name FROM fredi_vk_profiles WHERE user_id = $1",
                uid,
            )
        if not link:
            raise HTTPException(status_code=404, detail={"error": "link_not_found"})

        # Ленивый импорт парсера: если httpx/токен не настроены — отдаём 503,
        # а не 500, чтобы фронт мог отрисовать понятную ошибку.
        try:
            from vk_parser import get_parser, VKParserError
        except Exception as e:
            raise HTTPException(status_code=503, detail={
                "error": "parser_unavailable",
                "message": f"vk_parser import failed: {e}",
            })

        parser = get_parser()
        if not parser.enabled:
            raise HTTPException(status_code=503, detail={
                "error": "vk_token_missing",
                "message": "VK_SERVICE_TOKEN не задан в env Render",
            })

        try:
            data = await parser.fetch_profile(link["vk_id"], link["vk_screen_name"])
        except VKParserError as e:
            raise HTTPException(status_code=502, detail={
                "error": "vk_api_error",
                "message": str(e),
            })

        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_profiles "
                "SET vk_data = $1::jsonb, parsed_at = NOW() "
                "WHERE user_id = $2",
                json.dumps(data, ensure_ascii=False), uid,
            )

        # Сводка для фронта — чтобы сразу показать, что выкачали.
        wall = data.get("wall") or {}
        groups = data.get("groups") or {}
        return {
            "ok": True,
            "user_id": uid,
            "summary": {
                "user": bool(data.get("user")),
                "wall_count": wall.get("count", 0) if isinstance(wall, dict) else 0,
                "groups_count": groups.get("count", 0) if isinstance(groups, dict) else 0,
                "errors": data.get("errors", {}),
            },
        }

    @app.get("/api/admin/vk/parsed/{user_id}")
    async def vk_get_parsed(
        user_id: int,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Отдать сырой vk_data одного юзера — для просмотра в админке."""
        _check_admin(x_admin_token)
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT vk_data, parsed_at FROM fredi_vk_profiles WHERE user_id = $1",
                int(user_id),
            )
        if not row:
            raise HTTPException(status_code=404, detail={"error": "link_not_found"})
        if not row["vk_data"]:
            raise HTTPException(status_code=404, detail={"error": "not_parsed_yet"})

        data = row["vk_data"]
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                pass
        return {
            "user_id": int(user_id),
            "parsed_at": row["parsed_at"].isoformat() if row["parsed_at"] else None,
            "data": data,
        }

    logger.info("VK phase 2 routes registered (/parse, /parsed)")
