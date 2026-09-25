# -*- coding: utf-8 -*-
"""Ручки «семи дней по теме» (см. week_plan.py).

POST /api/week-plan/start        {user_id, topic?, channel?, tz?, notify_time?, force?}
GET  /api/week-plan/{user_id}    состояние: день сегодня, шаг, сделано
POST /api/week-plan/{user_id}/done  {day}

План пишется в fredi_skill_plans — ту же таблицу, что 21-дневный план
навыка, — и дальше живёт на его трубах: планировщик skill_notify шлёт
утренний шаг в выбранный канал, вкладка «Сообщения» даёт кнопку
«Выполнил», экраны «Тренировка дня» и «Прогресс» показывают неделю.
Одна таблица — один план на человека: если у него уже идёт навык,
второй план не создаётся, ручка отдаёт active_skill_exists.

Строковых аннотаций из будущего здесь нет нарочно: FastAPI разбирает
подписи по живым типам, и с ними регистрация ручек молча падала
(подарок подписчикам, 25.09.2026).
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import week_plan as wp

logger = logging.getLogger(__name__)

TOPIC_GAP_SECONDS = 2 * 3600
TOPIC_MAX_CHARS = 200
DEFAULT_NOTIFY_TIME = "10:00"


def _ts(m: Dict[str, Any]) -> Optional[datetime]:
    v = m.get("created_at")
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def last_user_topic(rows: List[Dict[str, Any]]) -> str:
    """Тема последнего захода: первая реплика человека в последней серии
    сообщений с паузами меньше двух часов. rows — новые первыми, как
    отдаёт ORDER BY created_at DESC."""
    msgs = [r for r in rows if r.get("content")]
    if not msgs:
        return ""
    session = [msgs[0]]
    for prev, cur in zip(msgs, msgs[1:]):
        a, b = _ts(cur), _ts(prev)
        if a and b and (b - a).total_seconds() > TOPIC_GAP_SECONDS:
            break
        session.append(cur)
    session.reverse()
    first_user = next((m for m in session if m.get("role") == "user"), None)
    if not first_user:
        return ""
    text = " ".join(str(first_user["content"]).split())
    if len(text) > TOPIC_MAX_CHARS:
        cut = text[:TOPIC_MAX_CHARS].rsplit(" ", 1)[0]
        text = (cut or text[:TOPIC_MAX_CHARS]).rstrip(" ,.;:—-") + "…"
    return text


def _j(v: Any, default: Any) -> Any:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return default
    return v if v is not None else default


def plan_is_active(plan_data: Any, days_done: Any, started_at: Optional[datetime], now: datetime) -> bool:
    """План идёт, пока не прошли все его дни и не отмечены все."""
    if not started_at:
        return False
    plan_data = _j(plan_data, {}) or {}
    done = _j(days_done, []) or []
    try:
        total = int(plan_data.get("days_total") or 21) if isinstance(plan_data, dict) else 21
    except (TypeError, ValueError):
        total = 21
    elapsed = (now.date() - started_at.date()).days + 1
    return elapsed <= total and len(done) < total


async def _infer_channel(conn, user_id: int) -> Optional[str]:
    """Куда слать утренний шаг: web push, если разрешён; иначе привязанный
    мессенджер; иначе никуда — план живёт на дашборде."""
    try:
        if await conn.fetchval(
            "SELECT 1 FROM fredi_push_subscriptions WHERE user_id = $1 AND is_active = TRUE LIMIT 1", user_id
        ):
            return "web"
    except Exception:
        pass
    try:
        ch = await conn.fetchval(
            "SELECT channel FROM fredi_messenger_links WHERE user_id = $1 AND is_active = TRUE LIMIT 1", user_id
        )
        if ch in ("telegram", "max"):
            return ch
    except Exception:
        pass
    return None


def register_week_plan_routes(app, db, ai_getter, limiter):
    from fastapi import Request

    async def _view_for(conn, user_id: int, now: datetime) -> Optional[Dict[str, Any]]:
        row = await conn.fetchrow(
            "SELECT plan, days_done, started_at FROM fredi_skill_plans WHERE user_id = $1", user_id
        )
        if not row or not row["started_at"]:
            return None
        plan_data = _j(row["plan"], {}) or {}
        done = _j(row["days_done"], []) or []
        if not plan_is_active(plan_data, done, row["started_at"], now) and len(done) < wp.DAYS:
            return None
        return wp.view_from_skill_row(plan_data, done, row["started_at"], now)

    @app.post("/api/week-plan/start")
    @limiter.limit("6/minute")
    async def week_plan_start(request: Request):
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            user_id = int(data.get("user_id") or 0)
        except (TypeError, ValueError):
            user_id = 0
        if not user_id:
            return {"success": False, "error": "user_id required"}
        now = datetime.now(timezone.utc)
        try:
            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT skill_id, skill_name, plan, days_done, started_at "
                    "FROM fredi_skill_plans WHERE user_id = $1", user_id
                )
                if row and not data.get("force") and plan_is_active(
                        row["plan"], row["days_done"], row["started_at"], now):
                    view = wp.view_from_skill_row(_j(row["plan"], {}) or {}, _j(row["days_done"], []) or [],
                                                  row["started_at"], now)
                    if view:
                        return {"success": True, "existing": True, "plan": view}
                    return {"success": False, "error": "active_skill_exists",
                            "skill_name": row["skill_name"]}
                topic = " ".join(str(data.get("topic") or "").split())[:TOPIC_MAX_CHARS]
                if not topic:
                    rows = await conn.fetch(
                        "SELECT role, content, created_at FROM fredi_messages "
                        "WHERE user_id = $1 ORDER BY created_at DESC LIMIT 60", user_id
                    )
                    topic = last_user_topic([dict(r) for r in rows])
                if not topic:
                    return {"success": False, "error": "no_topic"}
                name = await conn.fetchval(
                    "SELECT COALESCE(NULLIF(c.name, ''), NULLIF(u.first_name, ''), '') "
                    "FROM fredi_users u LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id "
                    "WHERE u.user_id = $1", user_id
                ) or ""
                channel = data.get("channel") if data.get("channel") in ("web", "telegram", "max", "email") \
                    else await _infer_channel(conn, user_id)
        except Exception as e:
            logger.error(f"week_plan start (db) for {user_id}: {type(e).__name__}: {e}")
            return {"success": False, "error": "internal"}

        ai = ai_getter() if callable(ai_getter) else ai_getter
        if ai is None:
            return {"success": False, "error": "ai_unavailable"}

        slug = wp.pick_course_by_rules(topic)
        if not slug:
            try:
                s, u = wp.choose_course_prompt(topic)
                raw = await ai._call_deepseek(s, u, max_tokens=80, temperature=0.1,
                                              thinking=False, json_mode=True)
                slug = wp.parse_course_choice(raw or "")
            except Exception as e:
                logger.warning(f"week_plan choose course for {user_id}: {e}")
        if not slug:
            return {"success": False, "error": "no_course"}

        plan = None
        for _attempt in range(2):
            try:
                s, u = wp.plan_prompt(topic, slug, name)
                raw = await ai._call_deepseek(s, u, max_tokens=1800, temperature=0.6,
                                              thinking=False, json_mode=True)
                plan = wp.parse_plan(raw or "", slug)
            except Exception as e:
                logger.warning(f"week_plan generate for {user_id}: {e}")
            if plan:
                break
        if not plan:
            return {"success": False, "error": "generation_failed"}

        skill_plan = wp.to_skill_plan(plan, topic)
        try:
            async with db.get_connection() as conn:
                await conn.execute("""
                    INSERT INTO fredi_skill_plans (
                        user_id, skill_id, skill_name, skill_desc, skill_long_desc,
                        skill_promise, plan, days_done, started_at, channel, notify_time,
                        mode, tz, last_sent_at, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, '[]'::jsonb,
                              $8, $9, $10, 'calm', $11, NOW(), NOW(), NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        skill_id        = EXCLUDED.skill_id,
                        skill_name      = EXCLUDED.skill_name,
                        skill_desc      = EXCLUDED.skill_desc,
                        skill_long_desc = EXCLUDED.skill_long_desc,
                        skill_promise   = EXCLUDED.skill_promise,
                        plan            = EXCLUDED.plan,
                        days_done       = '[]'::jsonb,
                        started_at      = EXCLUDED.started_at,
                        channel         = EXCLUDED.channel,
                        notify_time     = EXCLUDED.notify_time,
                        mode            = 'calm',
                        tz              = COALESCE(EXCLUDED.tz, fredi_skill_plans.tz),
                        last_sent_at    = NOW(),
                        last_check_sent_at = NULL,
                        last_eve_sent_at   = NULL,
                        updated_at      = NOW()
                """,
                    user_id, f"week:{slug}", plan["title"], topic, plan["course_title"],
                    f"Семь дней по три минуты — шаги из курса «{plan['course_title']}»",
                    json.dumps(skill_plan, ensure_ascii=False), now, channel,
                    str(data.get("notify_time") or DEFAULT_NOTIFY_TIME)[:5],
                    str(data.get("tz") or "UTC")[:64],
                )
        except Exception as e:
            logger.error(f"week_plan save for {user_id}: {type(e).__name__}: {e}")
            return {"success": False, "error": "internal"}

        try:
            from analytics_routes import log_server_event
            await log_server_event(user_id, "week_plan_started", {
                "course": slug, "channel": channel or "", "source": str(data.get("source") or "")[:30],
                "topic_len": len(topic),
            })
        except Exception:
            pass

        view = wp.public_view(plan, now, now, {})
        view["topic"] = topic
        view["channel"] = channel
        return {"success": True, "plan": view}

    @app.get("/api/week-plan/{user_id}")
    @limiter.limit("60/minute")
    async def week_plan_get(request: Request, user_id: int):
        try:
            async with db.get_connection() as conn:
                view = await _view_for(conn, int(user_id), datetime.now(timezone.utc))
            if not view:
                return {"success": True, "active": False}
            return {"success": True, **view}
        except Exception as e:
            logger.error(f"week_plan get for {user_id}: {type(e).__name__}: {e}")
            return {"success": False, "error": "internal"}

    @app.post("/api/week-plan/{user_id}/done")
    @limiter.limit("60/minute")
    async def week_plan_done(request: Request, user_id: int):
        try:
            data = await request.json()
            day = int(data.get("day") or 0)
        except Exception:
            day = 0
        if day < 1 or day > wp.DAYS:
            return {"success": False, "error": f"day must be 1..{wp.DAYS}"}
        now = datetime.now(timezone.utc)
        try:
            async with db.get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT days_done FROM fredi_skill_plans WHERE user_id = $1", int(user_id)
                )
                if not row:
                    return {"success": False, "error": "plan not found"}
                done = _j(row["days_done"], []) or []
                if day not in done:
                    done = sorted(set(int(d) for d in done) | {day})
                    await conn.execute(
                        "UPDATE fredi_skill_plans SET days_done = $1::jsonb, updated_at = NOW() "
                        "WHERE user_id = $2", json.dumps(done), int(user_id)
                    )
                view = await _view_for(conn, int(user_id), now)
            try:
                from analytics_routes import log_server_event
                await log_server_event(int(user_id), "week_plan_day_done", {"day": day})
            except Exception:
                pass
            return {"success": True, "days_done": done, **(view or {})}
        except Exception as e:
            logger.error(f"week_plan done for {user_id}: {type(e).__name__}: {e}")
            return {"success": False, "error": "internal"}

    logger.info("week_plan routes registered")
