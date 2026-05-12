#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backend/services/vk_outreach_queue.py
Очередь авто-аутрича для B2C.

Pipeline:
  1. parse_all_categories(city, age, sex, active_only) — пробежать
     ПО ВСЕМ fisherman-категориям, дедуп по vk_id, вернуть единый
     список «живых» женщин 30+ из указанного города.
  2. add_to_queue(vk_ids) — записать в fredi_vk_outreach_queue с
     status='queued'. UNIQUE(vk_id) — повторно не добавится.
  3. process_one() — worker берёт следующий queued, делает
     B2C profile-analysis с pitch=true, отправляет голос+текст,
     помечает sent. Анти-дубль: проверка fredi_vk_b2b_outreach
     и fredi_vk_contacted_log за 30 дней.

Запускается из /api/admin/vk/outreach-queue/* endpoints (vk_routes.py).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Таблица очереди — миграция выполняется один раз при старте
# (vk_routes.init_vk_table добавляет ALTER/CREATE).
TABLE_SQL = """
CREATE TABLE IF NOT EXISTS fredi_vk_outreach_queue (
    id            BIGSERIAL PRIMARY KEY,
    vk_id         BIGINT NOT NULL,
    full_name     TEXT,
    city          TEXT,
    category      TEXT,
    source_meta   JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'queued',
    added_at      TIMESTAMPTZ DEFAULT NOW(),
    processed_at  TIMESTAMPTZ,
    sent_message  TEXT,
    sent_voice    TEXT,
    send_result   JSONB,
    error_message TEXT,
    CONSTRAINT fredi_vk_outreach_queue_uq UNIQUE (vk_id)
)
"""
INDEX_STATUS = (
    "CREATE INDEX IF NOT EXISTS idx_fredi_vk_outreach_queue_status "
    "ON fredi_vk_outreach_queue(status, added_at)"
)


async def init_outreach_queue_table(db) -> None:
    """Создаёт таблицу очереди (idempotent)."""
    async with db.get_connection() as conn:
        await conn.execute(TABLE_SQL)
        await conn.execute(INDEX_STATUS)
    logger.info("fredi_vk_outreach_queue ready")


async def parse_all_categories(
    *,
    city_id: Optional[int] = None,
    city_name: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    sex: Optional[int] = None,
    active_only: bool = True,
    active_inactivity_days: int = 90,
    max_per_term: int = 100,
    max_per_category: int = 100,
) -> Dict[str, Any]:
    """Пробегается по всем fisherman-категориям, собирает уникальные vk_id.

    Возвращает {'candidates': [...], 'by_category': {...}, 'total_unique': N}.
    """
    from vk_fisherman_search import search_fishermen, resolve_city
    from services.fisherman_categories import all_fishermen

    # Резолвим город один раз (если только name)
    if (not city_id or int(city_id) <= 0) and city_name:
        try:
            rc = await resolve_city(city_name)
            if rc:
                city_id = rc["id"]
                city_name = rc["title"]
        except Exception as e:
            logger.warning(f"resolve_city({city_name}) failed: {e}")

    all_cats = all_fishermen()
    by_category: Dict[str, int] = {}
    seen: Dict[int, Dict[str, Any]] = {}

    for cat in all_cats:
        code = cat["code"]
        try:
            r = await search_fishermen(
                category_code=code,
                max_per_term=max_per_term,
                min_audience=0,
                max_results=max_per_category,
                include_newsfeed=False,
                include_groups=False,
                city_id=city_id,
                city_name=city_name,
                age_min=age_min,
                age_max=age_max,
                sex=sex,
                active_only=active_only,
                active_inactivity_days=active_inactivity_days,
            )
        except Exception as e:
            logger.warning(f"category {code} search failed: {e}")
            by_category[code] = 0
            continue
        cands = r.get("candidates") or []
        by_category[code] = len(cands)
        for c in cands:
            vid = c.get("vk_id")
            if not vid or int(vid) <= 0:
                continue
            # Дедуп по vk_id — оставляем первое попадание
            if int(vid) not in seen:
                # Сохраняем категорию, по которой нашли (полезно для пометки)
                c = dict(c)
                c["matched_category"] = code
                seen[int(vid)] = c

    return {
        "candidates": list(seen.values()),
        "by_category": by_category,
        "total_unique": len(seen),
        "city_id": city_id,
        "city_name": city_name,
    }


async def add_batch_to_queue(
    db,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Добавляет батч кандидатов в очередь. Возвращает {added, skipped}."""
    if not candidates:
        return {"added": 0, "skipped": 0}
    added, skipped = 0, 0
    async with db.get_connection() as conn:
        for c in candidates:
            vid = c.get("vk_id")
            try:
                vid = int(vid)
            except (TypeError, ValueError):
                continue
            if vid <= 0:
                continue
            full_name = ((c.get("first_name") or "") + " " + (c.get("last_name") or "")).strip()
            city = ""
            if isinstance(c.get("city"), dict):
                city = c["city"].get("title") or ""
            elif isinstance(c.get("city"), str):
                city = c["city"]
            category = c.get("matched_category") or c.get("category") or ""
            try:
                res = await conn.execute(
                    "INSERT INTO fredi_vk_outreach_queue "
                    "(vk_id, full_name, city, category, source_meta) "
                    "VALUES ($1, $2, $3, $4, $5::jsonb) "
                    "ON CONFLICT (vk_id) DO NOTHING",
                    vid, full_name[:200], city[:100], category[:64],
                    json.dumps({
                        "bdate": c.get("bdate") or "",
                        "sex": c.get("sex"),
                        "screen_name": c.get("screen_name"),
                        "source": c.get("source"),
                    }, ensure_ascii=False),
                )
                if res and res.endswith(" 0"):
                    skipped += 1
                else:
                    added += 1
            except Exception as e:
                logger.warning(f"queue add vk_id={vid} failed: {e}")
                skipped += 1
    return {"added": added, "skipped": skipped}


async def list_queue(
    db,
    *,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """Список очереди с пагинацией и фильтром по статусу."""
    lim = max(1, min(int(limit), 500))
    off = max(0, int(offset))
    args: List[Any] = []
    sql = (
        "SELECT id, vk_id, full_name, city, category, status, "
        "       added_at, processed_at, error_message "
        "FROM fredi_vk_outreach_queue "
    )
    if status:
        args.append(status.strip().lower())
        sql += f"WHERE status = ${len(args)} "
    args.extend([lim, off])
    sql += f"ORDER BY added_at DESC LIMIT ${len(args)-1} OFFSET ${len(args)}"

    async with db.get_connection() as conn:
        rows = await conn.fetch(sql, *args)
        # Сводка по статусам
        stats_rows = await conn.fetch(
            "SELECT status, COUNT(*) AS c FROM fredi_vk_outreach_queue GROUP BY status"
        )

    items = [{
        "id": r["id"],
        "vk_id": int(r["vk_id"]),
        "full_name": r["full_name"] or "",
        "city": r["city"] or "",
        "category": r["category"] or "",
        "status": r["status"],
        "added_at": r["added_at"].isoformat() if r["added_at"] else None,
        "processed_at": r["processed_at"].isoformat() if r["processed_at"] else None,
        "error_message": (r["error_message"] or "")[:300],
        "vk_url": f"https://vk.com/id{r['vk_id']}",
    } for r in rows]
    stats = {r["status"]: r["c"] for r in stats_rows}
    return {"items": items, "stats": stats, "limit": lim, "offset": off}


async def process_one(db) -> Dict[str, Any]:
    """Берёт следующий queued, делает B2C profile-analysis + send-voice.

    Анти-дубль: ДО отправки проверяем fredi_vk_b2b_outreach +
    fredi_vk_contacted_log (30 дней). Если совпадение — status=skipped.

    Возвращает {status: 'sent'|'skipped'|'error'|'empty', vk_id?, ...}.
    """
    async with db.get_connection() as conn:
        # Атомарно берём один queued и помечаем processing
        row = await conn.fetchrow(
            "UPDATE fredi_vk_outreach_queue "
            "SET status = 'processing', processed_at = NOW() "
            "WHERE id = ("
            "  SELECT id FROM fredi_vk_outreach_queue "
            "  WHERE status = 'queued' "
            "  ORDER BY added_at ASC LIMIT 1 "
            "  FOR UPDATE SKIP LOCKED"
            ") "
            "RETURNING id, vk_id, full_name, category"
        )
    if not row:
        return {"status": "empty", "message": "Очередь пуста"}

    qid = int(row["id"])
    vid = int(row["vk_id"])
    full_name = row["full_name"] or ""
    category = row["category"] or ""

    # --- Анти-дубль ---
    async with db.get_connection() as conn:
        dup_b2b = await conn.fetchval(
            "SELECT 1 FROM fredi_vk_b2b_outreach WHERE vk_id = $1", vid
        )
        dup_log = None
        if not dup_b2b:
            try:
                dup_log = await conn.fetchval(
                    "SELECT 1 FROM fredi_vk_contacted_log "
                    "WHERE vk_id = $1 AND contacted_at > NOW() - INTERVAL '30 days'",
                    vid,
                )
            except Exception:
                dup_log = None
    if dup_b2b or dup_log:
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_outreach_queue "
                "SET status = 'skipped', error_message = $1 "
                "WHERE id = $2",
                "already contacted (anti-dup)", qid,
            )
        return {"status": "skipped", "vk_id": vid, "reason": "already_contacted"}

    # --- B2C profile-analysis + pitch + voice ---
    try:
        from vk_b2c_analyzer import analyze_profile
        from vk_mirror_pitch import _compose_body, _llm_tail, _llm_voice_script
        import asyncio as _asyncio
    except Exception as e:
        logger.error(f"outreach process_one imports failed: {e}")
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_outreach_queue "
                "SET status = 'error', error_message = $1 WHERE id = $2",
                f"imports: {e}"[:500], qid,
            )
        return {"status": "error", "vk_id": vid, "error": str(e)}

    try:
        url = f"https://vk.com/id{vid}"
        analysis = await analyze_profile(url)
        if analysis.get("error"):
            raise RuntimeError(f"analyze_profile: {analysis.get('error')}")

        ub = (analysis.get("vk_data") or {}).get("user_basic") or {}
        first_name = (ub.get("first_name") or full_name.split()[0] if full_name else "").strip()
        last_name = (ub.get("last_name") or "").strip()
        f_name_full = " ".join(filter(None, [first_name, last_name])).strip() or full_name

        body_text = _compose_body(
            analysis.get("profile") or {},
            analysis.get("pain") or {},
            analysis.get("hooks") or {},
            f_name_full,
            first_name=first_name,
        )
        empty_cat: Dict[str, Any] = {}
        tail, voice_script = await _asyncio.gather(
            _llm_tail(
                empty_cat,
                first_name or "коллега",
                pain_summary=analysis.get("pain") or {},
                profile_summary=analysis.get("profile") or {},
            ),
            _llm_voice_script(
                analysis.get("profile") or {},
                analysis.get("pain") or {},
                empty_cat,
                first_name,
            ),
        )
        greet = (first_name or f_name_full or "").strip()
        greet_line = f"Привет, {greet}!\n\n" if greet else ""
        message = greet_line + tail

        # --- Отправка через VK ---
        from vk_send_voice import send_voice_message_to_vk
        send_result = await send_voice_message_to_vk(
            voice_text=voice_script,
            vk_peer_id=vid,
            text_followup=message,
        )

        # --- Пометка sent + запись в b2b_outreach как защита от повторов ---
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_outreach_queue "
                "SET status = 'sent', sent_message = $1, sent_voice = $2, "
                "    send_result = $3::jsonb "
                "WHERE id = $4",
                message[:4000], voice_script[:4000],
                json.dumps(send_result or {}, ensure_ascii=False), qid,
            )
            try:
                await conn.execute(
                    "INSERT INTO fredi_vk_b2b_outreach (vk_id, status, category, note) "
                    "VALUES ($1, 'sent', $2, $3) "
                    "ON CONFLICT (vk_id) DO UPDATE SET status='sent', marked_at=NOW()",
                    vid, category[:64], "auto-outreach"[:500],
                )
            except Exception as _e:
                logger.warning(f"b2b_outreach mark failed: {_e}")

        return {
            "status": "sent",
            "vk_id": vid,
            "id": qid,
            "name": f_name_full,
            "message_len": len(message),
            "voice_len": len(voice_script or ""),
        }
    except Exception as e:
        logger.error(f"process_one vk_id={vid} failed: {e}")
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_vk_outreach_queue "
                "SET status = 'error', error_message = $1 WHERE id = $2",
                str(e)[:500], qid,
            )
        return {"status": "error", "vk_id": vid, "id": qid, "error": str(e)}


async def delete_item(db, queue_id: int) -> bool:
    async with db.get_connection() as conn:
        res = await conn.execute(
            "DELETE FROM fredi_vk_outreach_queue WHERE id = $1", int(queue_id),
        )
    return not (res or "").endswith(" 0")


async def reset_status(db, *, from_status: str, to_status: str) -> int:
    """Массово меняет статус — для re-try error → queued или paused."""
    async with db.get_connection() as conn:
        res = await conn.execute(
            "UPDATE fredi_vk_outreach_queue "
            "SET status = $1, error_message = NULL WHERE status = $2",
            to_status, from_status,
        )
    # res = "UPDATE N"
    try:
        return int((res or "0").split()[-1])
    except Exception:
        return 0
