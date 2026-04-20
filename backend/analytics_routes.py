"""
analytics_routes.py — Lightweight analytics + admin endpoints.

Фронт-события приходят батчем на /api/analytics/events.
Серверные события пишем через log_server_event(db, user_id, event, data).
Админ-эндпоинты защищены заголовком X-Admin-Token = env ADMIN_TOKEN.
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import Request, HTTPException, Header

logger = logging.getLogger(__name__)

# Глобальная ссылка на db, чтобы log_server_event работал из любых модулей
# без необходимости таскать db через все функции.
_db_ref = None


def _event_name(name: str) -> str:
    return (name or "")[:50]


def _screen_name(screen: str) -> str:
    return (screen or "")[:50]


def _sanitize_event_data(data: Any) -> Dict[str, str]:
    """Отсечь мусор и ограничить размеры значений (защита от абьюза)."""
    if not isinstance(data, dict):
        return {}
    safe: Dict[str, str] = {}
    for k, v in list(data.items())[:20]:
        safe[str(k)[:30]] = str(v)[:200]
    return safe


# Whitelist user-level атрибутов: то что реально нужно для сегментации.
# Всё остальное с клиента игнорируется (защита от абьюза и раздувания БД).
_ALLOWED_ATTRS = {
    "is_authed", "is_premium", "device", "pwa",
    "lang", "connection", "theme", "channel",
    "days_since_signup", "app_version",
}


def _sanitize_attrs(attrs: Any) -> Dict[str, Any]:
    if not isinstance(attrs, dict):
        return {}
    safe: Dict[str, Any] = {}
    for k in list(attrs.keys())[:20]:
        if k not in _ALLOWED_ATTRS:
            continue
        v = attrs.get(k)
        if isinstance(v, bool):
            safe[k] = v
        elif isinstance(v, (int, float)):
            safe[k] = v
        elif v is None:
            continue
        else:
            safe[k] = str(v)[:50]
    return safe


async def log_server_event(
    user_id: Optional[int],
    event: str,
    data: Optional[Dict[str, Any]] = None,
    screen: Optional[str] = None,
    session_id: str = "server",
    attrs: Optional[Dict[str, Any]] = None,
):
    """Пишет серверное событие в fredi_analytics. Не кидает исключений
    (логирует и продолжает — аналитика не должна ломать бизнес-логику).

    Если attrs не переданы, но есть user_id — попробуем подтянуть
    is_premium с meter_routes, чтобы серверные события тоже сегментировались.
    """
    if _db_ref is None:
        return
    try:
        uid: Optional[int] = None
        if user_id is not None:
            try:
                uid = int(user_id)
                if uid <= 0:
                    uid = None
            except (ValueError, TypeError):
                uid = None

        # Автоматически подкидываем is_premium для серверных событий, если uid есть.
        enriched_attrs: Dict[str, Any] = dict(attrs or {})
        if uid and "is_premium" not in enriched_attrs:
            try:
                from meter_routes import subscription_meter as _meter
                if _meter is not None:
                    is_prem = await _meter.has_active_subscription(uid)
                    enriched_attrs["is_premium"] = bool(is_prem)
            except Exception:
                pass

        safe = _sanitize_event_data(data or {})
        safe_attrs = _sanitize_attrs(enriched_attrs)
        async with _db_ref.get_connection() as conn:
            await conn.execute(
                "INSERT INTO fredi_analytics "
                "(user_id, session_id, event, screen, data, attrs) "
                "VALUES ($1, $2, $3, $4, $5, $6)",
                uid, session_id[:50], _event_name(event),
                _screen_name(screen or ""),
                json.dumps(safe, ensure_ascii=False),
                json.dumps(safe_attrs, ensure_ascii=False),
            )
    except Exception as e:
        logger.warning(f"log_server_event({event}) failed: {e}")


def _check_admin(token: Optional[str]):
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail={"error": "admin_disabled",
                                                      "message": "Админ-эндпоинты выключены: задайте ADMIN_TOKEN в env"})
    if not token or token != expected:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


def register_analytics_routes(app, db):
    """Register analytics endpoints."""
    global _db_ref
    _db_ref = db

    async def init_analytics_table():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fredi_analytics (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT,
                    session_id TEXT,
                    event TEXT NOT NULL,
                    screen TEXT,
                    data JSONB DEFAULT '{}',
                    attrs JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            # Если таблица уже существовала без attrs — добавим.
            try:
                await conn.execute(
                    "ALTER TABLE fredi_analytics ADD COLUMN IF NOT EXISTS attrs JSONB DEFAULT '{}'"
                )
            except Exception:
                pass
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_user "
                "ON fredi_analytics(user_id, created_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_event "
                "ON fredi_analytics(event, created_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_created "
                "ON fredi_analytics(created_at DESC)"
            )
            # Частичные GIN-индексы на attrs — ускоряют сегментацию
            try:
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_attrs_gin "
                    "ON fredi_analytics USING GIN (attrs)"
                )
            except Exception:
                pass
        logger.info("Analytics table ready (with attrs column)")

    @app.post("/api/analytics/events")
    async def receive_events(request: Request):
        """Приём батча фронт-событий (fire-and-forget)."""
        try:
            body = await request.body()
            if len(body) > 50000:
                return {"ok": False}
            data = json.loads(body)
            events = data.get("events", [])
            if not events or not isinstance(events, list):
                return {"ok": False}
            events = events[:20]
            async with db.get_connection() as conn:
                for ev in events:
                    user_id = ev.get("user_id")
                    try:
                        user_id = int(user_id) if user_id else None
                    except (ValueError, TypeError):
                        user_id = None
                    event_name = _event_name(ev.get("event", ""))
                    session_id = str(ev.get("session_id", ""))[:50]
                    screen = _screen_name(ev.get("screen", ""))
                    safe_data = _sanitize_event_data(ev.get("data"))
                    safe_attrs = _sanitize_attrs(ev.get("attrs"))
                    await conn.execute(
                        "INSERT INTO fredi_analytics "
                        "(user_id, session_id, event, screen, data, attrs) "
                        "VALUES ($1, $2, $3, $4, $5, $6)",
                        user_id, session_id, event_name, screen,
                        json.dumps(safe_data, ensure_ascii=False),
                        json.dumps(safe_attrs, ensure_ascii=False),
                    )
            return {"ok": True}
        except Exception as e:
            logger.error(f"analytics error: {e}")
            return {"ok": False}

    @app.get("/api/analytics/summary")
    async def analytics_summary(request: Request,
                                x_admin_token: Optional[str] = Header(default=None)):
        """Агрегаты за 7 дней. Закрыт X-Admin-Token."""
        _check_admin(x_admin_token)
        try:
            async with db.get_connection() as conn:
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days'"
                )
                users = await conn.fetchval(
                    "SELECT COUNT(DISTINCT user_id) FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' AND user_id IS NOT NULL"
                )
                rows = await conn.fetch(
                    "SELECT event, COUNT(*) as cnt "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "GROUP BY event ORDER BY cnt DESC LIMIT 30"
                )
                by_event = [{"event": r["event"], "count": r["cnt"]} for r in rows]
                screens = await conn.fetch(
                    "SELECT screen, COUNT(*) as cnt "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "AND event = 'screen_view' AND screen != '' "
                    "GROUP BY screen ORDER BY cnt DESC LIMIT 20"
                )
                by_screen = [{"screen": r["screen"], "count": r["cnt"]} for r in screens]
                avg_dur = await conn.fetchval(
                    "SELECT AVG((data->>'duration_sec')::int) "
                    "FROM fredi_analytics "
                    "WHERE event = 'session_end' "
                    "AND created_at > NOW() - INTERVAL '7 days'"
                )
                # Daily active users за 7 дней (день + уникальные user_id)
                dau_rows = await conn.fetch(
                    "SELECT DATE(created_at) AS day, "
                    "COUNT(DISTINCT user_id) AS users, COUNT(*) AS events "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "GROUP BY DATE(created_at) ORDER BY day"
                )
                dau = [{"day": r["day"].isoformat(), "users": r["users"],
                        "events": r["events"]} for r in dau_rows]
                # Воронка meter → subscribe
                mws = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event IN ('meter_warning_server','meter_warning_shown') "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                mbs = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event = 'meter_blocked_shown' "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                msc = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event = 'meter_subscribe_clicked' "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                sub_act = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event = 'subscription_activated' "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                funnel = {
                    "meter_warning": mws,
                    "meter_blocked_shown": mbs,
                    "meter_subscribe_clicked": msc,
                    "subscription_activated": sub_act,
                }
                # Средняя длительность фич (feature_closed.duration_sec)
                feat_rows = await conn.fetch(
                    "SELECT (data->>'feature') AS feature, "
                    "AVG((data->>'duration_sec')::int) AS avg_sec, "
                    "COUNT(*) AS opens "
                    "FROM fredi_analytics "
                    "WHERE event = 'feature_closed' "
                    "AND created_at > NOW() - INTERVAL '7 days' "
                    "AND data ? 'feature' AND data ? 'duration_sec' "
                    "GROUP BY feature ORDER BY avg_sec DESC NULLS LAST LIMIT 20"
                )
                features = [{
                    "feature": r["feature"],
                    "avg_sec": round(float(r["avg_sec"] or 0), 1),
                    "opens": r["opens"],
                } for r in feat_rows]
                # Среднее latency_ms для AI-ответов (индикатор качества UX)
                ai_lat = await conn.fetchval(
                    "SELECT AVG((data->>'latency_ms')::int) FROM fredi_analytics "
                    "WHERE event = 'ai_response_received' "
                    "AND data ? 'latency_ms' "
                    "AND created_at > NOW() - INTERVAL '7 days'"
                )
                # Счёт ошибок API за неделю
                api_err = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event IN ('api_error','api_network_error','error','promise_unhandled') "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                # Сегментация по ключевым attrs
                seg_device_rows = await conn.fetch(
                    "SELECT COALESCE(attrs->>'device','unknown') AS seg, "
                    "COUNT(DISTINCT user_id) AS users, "
                    "COUNT(*) AS events, "
                    "AVG((data->>'duration_sec')::int) FILTER (WHERE event='session_end') AS avg_sec "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "GROUP BY seg ORDER BY users DESC NULLS LAST"
                )
                by_device = [{
                    "seg": r["seg"] or "unknown",
                    "users": r["users"] or 0,
                    "events": r["events"] or 0,
                    "avg_session_sec": round(float(r["avg_sec"] or 0)),
                } for r in seg_device_rows]

                seg_plan_rows = await conn.fetch(
                    "SELECT "
                    "CASE WHEN (attrs->>'is_premium')::boolean THEN 'premium' "
                    "ELSE 'free' END AS seg, "
                    "COUNT(DISTINCT user_id) AS users, "
                    "COUNT(*) AS events, "
                    "AVG((data->>'duration_sec')::int) FILTER (WHERE event='session_end') AS avg_sec "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "AND attrs ? 'is_premium' "
                    "GROUP BY seg ORDER BY users DESC NULLS LAST"
                )
                by_plan = [{
                    "seg": r["seg"],
                    "users": r["users"] or 0,
                    "events": r["events"] or 0,
                    "avg_session_sec": round(float(r["avg_sec"] or 0)),
                } for r in seg_plan_rows]

                seg_authed_rows = await conn.fetch(
                    "SELECT "
                    "CASE WHEN (attrs->>'is_authed')::boolean THEN 'authed' "
                    "ELSE 'anon' END AS seg, "
                    "COUNT(DISTINCT user_id) AS users, "
                    "COUNT(*) AS events, "
                    "AVG((data->>'duration_sec')::int) FILTER (WHERE event='session_end') AS avg_sec "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "AND attrs ? 'is_authed' "
                    "GROUP BY seg ORDER BY users DESC NULLS LAST"
                )
                by_auth = [{
                    "seg": r["seg"],
                    "users": r["users"] or 0,
                    "events": r["events"] or 0,
                    "avg_session_sec": round(float(r["avg_sec"] or 0)),
                } for r in seg_authed_rows]

                return {
                    "period": "7d",
                    "total_events": total or 0,
                    "unique_users": users or 0,
                    "avg_session_sec": round(avg_dur or 0),
                    "ai_avg_latency_ms": round(ai_lat or 0),
                    "api_errors_7d": api_err,
                    "by_event": by_event,
                    "by_screen": by_screen,
                    "features": features,
                    "dau": dau,
                    "funnel": funnel,
                    "segments": {
                        "device": by_device,
                        "plan": by_plan,
                        "auth": by_auth,
                    },
                }
        except Exception as e:
            logger.error(f"analytics summary error: {e}")
            return {"error": "internal"}

    @app.get("/api/analytics/recent")
    async def analytics_recent(request: Request, limit: int = 100,
                               x_admin_token: Optional[str] = Header(default=None)):
        """Последние N событий — для живой ленты."""
        _check_admin(x_admin_token)
        try:
            lim = max(1, min(int(limit), 500))
            async with db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT id, user_id, session_id, event, screen, data, created_at "
                    "FROM fredi_analytics ORDER BY id DESC LIMIT $1", lim
                )
            return {
                "events": [{
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "session_id": r["session_id"],
                    "event": r["event"],
                    "screen": r["screen"],
                    "data": (json.loads(r["data"]) if isinstance(r["data"], str)
                             else (r["data"] or {})),
                    "created_at": r["created_at"].isoformat(),
                } for r in rows]
            }
        except Exception as e:
            logger.error(f"analytics recent error: {e}")
            return {"error": "internal"}

    @app.get("/api/analytics/user/{user_id}")
    async def analytics_user(request: Request, user_id: int, limit: int = 200,
                             x_admin_token: Optional[str] = Header(default=None)):
        """Timeline событий одного юзера."""
        _check_admin(x_admin_token)
        try:
            lim = max(1, min(int(limit), 500))
            async with db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT id, event, screen, data, created_at FROM fredi_analytics "
                    "WHERE user_id = $1 ORDER BY id DESC LIMIT $2", int(user_id), lim
                )
            return {
                "user_id": user_id,
                "events": [{
                    "id": r["id"],
                    "event": r["event"],
                    "screen": r["screen"],
                    "data": (json.loads(r["data"]) if isinstance(r["data"], str)
                             else (r["data"] or {})),
                    "created_at": r["created_at"].isoformat(),
                } for r in rows]
            }
        except Exception as e:
            logger.error(f"analytics user error: {e}")
            return {"error": "internal"}

    @app.get("/api/analytics/messages")
    async def analytics_messages(request: Request, limit: int = 100,
                                  x_admin_token: Optional[str] = Header(default=None)):
        """Последние N вопросов от юзеров (только role='user')."""
        _check_admin(x_admin_token)
        try:
            lim = max(1, min(int(limit), 500))
            async with db.get_connection() as conn:
                rows = await conn.fetch(
                    "SELECT m.id, m.user_id, m.role, m.content, m.metadata, m.created_at, "
                    "       COALESCE(c.name, '') AS user_name "
                    "FROM fredi_messages m "
                    "LEFT JOIN fredi_user_contexts c ON c.user_id = m.user_id "
                    "WHERE m.role = 'user' "
                    "ORDER BY m.id DESC LIMIT $1", lim
                )
            return {
                "messages": [{
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "user_name": r["user_name"] or "",
                    "role": r["role"],
                    "content": r["content"],
                    "metadata": (json.loads(r["metadata"]) if isinstance(r["metadata"], str)
                                 else (r["metadata"] or {})),
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                } for r in rows]
            }
        except Exception as e:
            logger.error(f"analytics messages error: {e}")
            return {"error": "internal"}

    @app.get("/api/analytics/messages/user/{user_id}")
    async def analytics_messages_user(request: Request, user_id: int, limit: int = 200,
                                        x_admin_token: Optional[str] = Header(default=None)):
        """Полный диалог одного юзера (user + assistant)."""
        _check_admin(x_admin_token)
        try:
            lim = max(1, min(int(limit), 1000))
            async with db.get_connection() as conn:
                name = await conn.fetchval(
                    "SELECT name FROM fredi_user_contexts WHERE user_id = $1", int(user_id)
                )
                rows = await conn.fetch(
                    "SELECT id, role, content, metadata, created_at FROM fredi_messages "
                    "WHERE user_id = $1 ORDER BY id DESC LIMIT $2", int(user_id), lim
                )
            # Разворачиваем: старые → новые, чтобы в UI читалось как чат.
            messages = [{
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "metadata": (json.loads(r["metadata"]) if isinstance(r["metadata"], str)
                             else (r["metadata"] or {})),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            } for r in rows]
            messages.reverse()
            return {
                "user_id": user_id,
                "user_name": name or "",
                "messages": messages,
            }
        except Exception as e:
            logger.error(f"analytics messages user error: {e}")
            return {"error": "internal"}

    return init_analytics_table
