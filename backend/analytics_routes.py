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

from fastapi import Request, HTTPException, Header, Body

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
                # Cap session duration at 1 hour — у старых клиентов
                # (до PR #138) в session_end лежит wall-time, который может
                # доходить до нескольких часов (вкладка оставлена открытой).
                # Без кэпа среднее превращается в artifact.
                avg_dur = await conn.fetchval(
                    "SELECT AVG(LEAST((data->>'duration_sec')::int, 3600)) "
                    "FROM fredi_analytics "
                    "WHERE event = 'session_end' "
                    "AND created_at > NOW() - INTERVAL '7 days' "
                    "AND (data->>'duration_sec') ~ '^[0-9]+$'"
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
                # Средняя длительность фич (feature_closed.duration_sec).
                # LEAST cap 7200с (2 часа): защита от старых wall-clock
                # значений (юзер открыл вкладку и закрыл через сутки →
                # duration_sec = 86400). После fix tracker.js дальше всё
                # будет коротким, но исторические данные ещё неделю в окне.
                feat_rows = await conn.fetch(
                    "SELECT (data->>'feature') AS feature, "
                    "AVG(LEAST((data->>'duration_sec')::int, 7200)) AS avg_sec, "
                    "COUNT(*) AS opens "
                    "FROM fredi_analytics "
                    "WHERE event = 'feature_closed' "
                    "AND created_at > NOW() - INTERVAL '7 days' "
                    "AND data ? 'feature' AND data ? 'duration_sec' "
                    "AND (data->>'duration_sec') ~ '^[0-9]+$' "
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
                # Счёт клиентских ошибок за неделю.
                # Набор событий совпадает с разбивкой health_7d ниже, чтобы
                # плитка KPI была равна сумме разбивки (раньше здесь не хватало
                # 'js_error' — самой частой ошибки — и цифра занижалась в разы).
                api_err = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE event IN ('js_error','error','promise_unhandled',"
                    "'api_network_error','api_aborted','ai_response_error') "
                    "AND created_at > NOW() - INTERVAL '7 days'") or 0
                # Сегментация по ключевым attrs
                seg_device_rows = await conn.fetch(
                    "SELECT COALESCE(attrs->>'device','unknown') AS seg, "
                    "COUNT(DISTINCT user_id) AS users, "
                    "COUNT(*) AS events, "
                    "AVG(LEAST((data->>'duration_sec')::int, 3600)) FILTER (WHERE event='session_end' AND (data->>'duration_sec') ~ '^[0-9]+$') AS avg_sec "
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
                    "AVG(LEAST((data->>'duration_sec')::int, 3600)) FILTER (WHERE event='session_end' AND (data->>'duration_sec') ~ '^[0-9]+$') AS avg_sec "
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
                    "AVG(LEAST((data->>'duration_sec')::int, 3600)) FILTER (WHERE event='session_end' AND (data->>'duration_sec') ~ '^[0-9]+$') AS avg_sec "
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

    @app.get("/api/analytics/product")
    async def analytics_product(request: Request,
                                x_admin_token: Optional[str] = Header(default=None)):
        """Продуктовые метрики для решений «что дорабатывать»: когортное
        удержание, активация первой сессии, влияние фич на возврат, глубина
        сессий, завершение игр, paywall-воронка, здоровье клиента.

        Когорта: пользователи, впервые появившиеся 8–38 дней назад — у каждого
        есть минимум 7 полных дней на возврат, метрики честные. Закрыт X-Admin-Token."""
        _check_admin(x_admin_token)
        out: Dict[str, Any] = {}
        try:
            async with db.get_connection() as conn:
                # ---------- 1. Когорта: D1 / Ret7 / активация первой сессии ----------
                rows = await conn.fetch("""
                    WITH firsts AS (
                        SELECT user_id, MIN(created_at) AS first_seen
                        FROM fredi_analytics
                        WHERE user_id IS NOT NULL AND user_id > 0
                        GROUP BY user_id
                    ), cohort AS (
                        SELECT user_id, first_seen FROM firsts
                        WHERE first_seen >= NOW() - INTERVAL '38 days'
                          AND first_seen <  NOW() - INTERVAL '8 days'
                    )
                    SELECT
                        COUNT(*) AS cohort_size,
                        COUNT(*) FILTER (WHERE EXISTS (
                            SELECT 1 FROM fredi_analytics a
                            WHERE a.user_id = c.user_id
                              AND a.created_at >= c.first_seen + INTERVAL '20 hours'
                              AND a.created_at <  c.first_seen + INTERVAL '48 hours'
                        )) AS d1,
                        COUNT(*) FILTER (WHERE EXISTS (
                            SELECT 1 FROM fredi_analytics a
                            WHERE a.user_id = c.user_id
                              AND a.created_at >= c.first_seen + INTERVAL '20 hours'
                              AND a.created_at <  c.first_seen + INTERVAL '8 days'
                        )) AS ret7,
                        COUNT(*) FILTER (WHERE EXISTS (
                            SELECT 1 FROM fredi_analytics a
                            WHERE a.user_id = c.user_id AND a.event = 'message_sent'
                              AND a.created_at < c.first_seen + INTERVAL '60 minutes'
                        )) AS sent_msg,
                        COUNT(*) FILTER (WHERE (
                            SELECT COUNT(*) FROM fredi_analytics a
                            WHERE a.user_id = c.user_id AND a.event = 'message_sent'
                              AND a.created_at < c.first_seen + INTERVAL '60 minutes'
                        ) >= 3) AS sent_3plus,
                        COUNT(*) FILTER (WHERE EXISTS (
                            SELECT 1 FROM fredi_analytics a
                            WHERE a.user_id = c.user_id AND a.event = 'game_round_start'
                              AND a.created_at < c.first_seen + INTERVAL '24 hours'
                        )) AS tried_game
                    FROM cohort c
                """)
                r = rows[0] if rows else None
                cohort_size = (r and r["cohort_size"]) or 0
                def _pct(x):
                    return round(100.0 * (x or 0) / cohort_size, 1) if cohort_size else None
                out["cohort"] = {
                    "size": cohort_size,
                    "window": "первые визиты 8–38 дней назад",
                    "d1_pct": _pct(r and r["d1"]),
                    "ret7_pct": _pct(r and r["ret7"]),
                    "activation": {
                        "sent_message_pct": _pct(r and r["sent_msg"]),
                        "sent_3plus_pct": _pct(r and r["sent_3plus"]),
                        "tried_game_pct": _pct(r and r["tried_game"]),
                    },
                }

                # ---------- 2. Фичи первой сессии → возврат за 7 дней ----------
                # Среди когорты: кто открыл фичу X в первые 24 часа — какой % вернулся.
                # Сравнение со средним по когорте = «lift» фичи.
                feat_rows = await conn.fetch("""
                    WITH firsts AS (
                        SELECT user_id, MIN(created_at) AS first_seen
                        FROM fredi_analytics
                        WHERE user_id IS NOT NULL AND user_id > 0
                        GROUP BY user_id
                    ), cohort AS (
                        SELECT user_id, first_seen FROM firsts
                        WHERE first_seen >= NOW() - INTERVAL '38 days'
                          AND first_seen <  NOW() - INTERVAL '8 days'
                    ), used AS (
                        SELECT DISTINCT c.user_id, c.first_seen,
                               a.data->>'feature' AS feature
                        FROM cohort c
                        JOIN fredi_analytics a ON a.user_id = c.user_id
                        WHERE a.event = 'feature_opened'
                          AND a.created_at < c.first_seen + INTERVAL '24 hours'
                          AND COALESCE(a.data->>'feature','') != ''
                    )
                    SELECT feature,
                           COUNT(*) AS users,
                           COUNT(*) FILTER (WHERE EXISTS (
                               SELECT 1 FROM fredi_analytics b
                               WHERE b.user_id = used.user_id
                                 AND b.created_at >= used.first_seen + INTERVAL '20 hours'
                                 AND b.created_at <  used.first_seen + INTERVAL '8 days'
                           )) AS returned
                    FROM used
                    GROUP BY feature
                    HAVING COUNT(*) >= 3
                    ORDER BY COUNT(*) DESC
                    LIMIT 30
                """)
                out["feature_lift"] = [{
                    "feature": fr["feature"],
                    "users": fr["users"],
                    "returned_pct": round(100.0 * fr["returned"] / fr["users"], 1) if fr["users"] else 0,
                } for fr in feat_rows]

                # ---------- 3. Глубина сессий (30 дней) ----------
                depth = await conn.fetchrow("""
                    WITH s AS (
                        SELECT session_id,
                               COUNT(*) FILTER (WHERE event = 'message_sent') AS msgs
                        FROM fredi_analytics
                        WHERE created_at > NOW() - INTERVAL '30 days'
                          AND session_id IS NOT NULL AND session_id != ''
                        GROUP BY session_id
                    )
                    SELECT COUNT(*) AS sessions,
                           ROUND(100.0 * COUNT(*) FILTER (WHERE msgs = 0) / GREATEST(COUNT(*),1), 1) AS zero_msg_pct,
                           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY msgs) AS median_msgs
                    FROM s
                """)
                med_dur = await conn.fetchval("""
                    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
                        ORDER BY LEAST((data->>'duration_sec')::int, 3600))
                    FROM fredi_analytics
                    WHERE event = 'session_end'
                      AND created_at > NOW() - INTERVAL '30 days'
                      AND (data->>'duration_sec') ~ '^[0-9]+$'
                """)
                spu = await conn.fetch("""
                    WITH u AS (
                        SELECT user_id, COUNT(DISTINCT session_id) AS n
                        FROM fredi_analytics
                        WHERE created_at > NOW() - INTERVAL '30 days'
                          AND user_id IS NOT NULL AND user_id > 0
                          AND session_id IS NOT NULL AND session_id != ''
                        GROUP BY user_id
                    )
                    SELECT
                        COUNT(*) FILTER (WHERE n = 1)  AS one,
                        COUNT(*) FILTER (WHERE n BETWEEN 2 AND 4) AS few,
                        COUNT(*) FILTER (WHERE n >= 5) AS core,
                        COUNT(*) AS total
                    FROM u
                """)
                sp = spu[0] if spu else None
                out["depth"] = {
                    "sessions_30d": (depth and depth["sessions"]) or 0,
                    "zero_msg_pct": float(depth["zero_msg_pct"]) if depth and depth["zero_msg_pct"] is not None else None,
                    "median_msgs": float(depth["median_msgs"]) if depth and depth["median_msgs"] is not None else None,
                    "median_duration_sec": int(med_dur) if med_dur is not None else None,
                    "sessions_per_user": {
                        "one": (sp and sp["one"]) or 0,
                        "two_four": (sp and sp["few"]) or 0,
                        "five_plus": (sp and sp["core"]) or 0,
                        "total_users": (sp and sp["total"]) or 0,
                    },
                }

                # ---------- 4. Игры: доигрываемость (30 дней) ----------
                games = await conn.fetch("""
                    SELECT COALESCE(data->>'feature','?') AS game,
                           COUNT(*) FILTER (WHERE event = 'game_round_start')  AS starts,
                           COUNT(*) FILTER (WHERE event = 'game_round_finish') AS finishes,
                           ROUND(AVG(CASE
                               WHEN event = 'game_round_finish'
                                AND (data->>'score') ~ '^[0-9]+(\\.[0-9]+)?$'
                               THEN (data->>'score')::numeric
                           END), 1) AS avg_score
                    FROM fredi_analytics
                    WHERE created_at > NOW() - INTERVAL '30 days'
                      AND event IN ('game_round_start','game_round_finish')
                    GROUP BY 1
                    HAVING COUNT(*) FILTER (WHERE event = 'game_round_start') > 0
                    ORDER BY starts DESC
                    LIMIT 30
                """)
                out["games"] = [{
                    "game": g["game"],
                    "starts": g["starts"],
                    "finishes": g["finishes"],
                    "completion_pct": round(100.0 * g["finishes"] / g["starts"], 1) if g["starts"] else 0,
                    "avg_score": float(g["avg_score"]) if g["avg_score"] is not None else None,
                } for g in games]

                # ---------- 5. Paywall-воронка (30 дней, уникальные юзеры) ----------
                pw = await conn.fetchrow("""
                    SELECT
                        COUNT(DISTINCT user_id) FILTER (WHERE event = 'meter_blocked_shown')     AS blocked,
                        COUNT(DISTINCT user_id) FILTER (WHERE event = 'meter_subscribe_clicked') AS clicked,
                        COUNT(DISTINCT user_id) FILTER (WHERE event = 'checkout_opened')         AS checkout
                    FROM fredi_analytics
                    WHERE created_at > NOW() - INTERVAL '30 days'
                """)
                out["paywall"] = {
                    "blocked_users": (pw and pw["blocked"]) or 0,
                    "subscribe_clicked": (pw and pw["clicked"]) or 0,
                    "checkout_opened": (pw and pw["checkout"]) or 0,
                }

                # ---------- 6. Здоровье клиента (7 дней) ----------
                health = await conn.fetch("""
                    SELECT event, COUNT(*) AS cnt
                    FROM fredi_analytics
                    WHERE created_at > NOW() - INTERVAL '7 days'
                      AND event IN ('js_error','error','promise_unhandled',
                                    'api_network_error','api_aborted','ai_response_error')
                    GROUP BY event ORDER BY cnt DESC
                """)
                out["health_7d"] = [{"event": h["event"], "count": h["cnt"]} for h in health]

                return out
        except Exception as e:
            # Эндпоинт под X-Admin-Token — можно вернуть текст ошибки, чтобы
            # в дашборде было видно ПРИЧИНУ, а не глухое «internal».
            logger.error(f"analytics product error: {type(e).__name__}: {e}")
            return {"error": f"{type(e).__name__}: {str(e)[:300]}"}

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
                    "       COALESCE(NULLIF(c.name, ''), "
                    "                NULLIF(u.first_name, ''), "
                    "                CASE WHEN NULLIF(u.username, '') IS NOT NULL "
                    "                     THEN '@' || u.username END, "
                    "                CASE WHEN NULLIF(u.email, '') IS NOT NULL "
                    "                     THEN split_part(u.email, '@', 1) END, "
                    "                '') AS user_name, "
                    "       c.name AS context_name, c.age, c.gender, c.city "
                    "FROM fredi_messages m "
                    "LEFT JOIN fredi_user_contexts c ON c.user_id = m.user_id "
                    "LEFT JOIN fredi_users u ON u.user_id = m.user_id "
                    "WHERE m.role = 'user' "
                    "ORDER BY m.id DESC LIMIT $1", lim
                )
            return {
                "messages": [{
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "user_name": r["user_name"] or "",
                    "context_name": r["context_name"],
                    "age": r["age"],
                    "gender": r["gender"],
                    "city": r["city"],
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
                meta = await conn.fetchrow(
                    "SELECT COALESCE("
                    "    NULLIF(c.name, ''), "
                    "    NULLIF(u.first_name, ''), "
                    "    CASE WHEN NULLIF(u.username, '') IS NOT NULL "
                    "         THEN '@' || u.username END, "
                    "    CASE WHEN NULLIF(u.email, '') IS NOT NULL "
                    "         THEN split_part(u.email, '@', 1) END, "
                    "    '') AS user_name, "
                    "    c.name AS context_name, c.age, c.gender, c.city "
                    "FROM fredi_users u "
                    "LEFT JOIN fredi_user_contexts c ON c.user_id = u.user_id "
                    "WHERE u.user_id = $1", int(user_id)
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
                "user_name": (meta["user_name"] if meta else "") or "",
                "context_name": meta["context_name"] if meta else None,
                "age": meta["age"] if meta else None,
                "gender": meta["gender"] if meta else None,
                "city": meta["city"] if meta else None,
                "messages": messages,
            }
        except Exception as e:
            logger.error(f"analytics messages user error: {e}")
            return {"error": "internal"}

    @app.get("/api/analytics/costs")
    async def analytics_costs(
        period: str = "7d",
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Расходы на внешние API за период.

        period: '24h' | '7d' | '30d' | 'all'
        Возвращает: total_usd, by_provider, by_feature, daily_trend.
        """
        _check_admin(x_admin_token)
        period = (period or "7d").lower()
        if period == "24h":
            interval = "24 hours"
        elif period == "30d":
            interval = "30 days"
        elif period == "all":
            interval = None
        else:
            interval = "7 days"

        where_clause = f"WHERE created_at > NOW() - INTERVAL '{interval}'" if interval else ""

        try:
            async with db.get_connection() as conn:
                # Total
                total_usd = await conn.fetchval(
                    f"SELECT COALESCE(SUM(cost_usd),0) FROM fredi_api_usage {where_clause}"
                )
                total_calls = await conn.fetchval(
                    f"SELECT COUNT(*) FROM fredi_api_usage {where_clause}"
                )
                total_tokens_in = await conn.fetchval(
                    f"SELECT COALESCE(SUM(tokens_in),0) FROM fredi_api_usage {where_clause}"
                )
                total_tokens_out = await conn.fetchval(
                    f"SELECT COALESCE(SUM(tokens_out),0) FROM fredi_api_usage {where_clause}"
                )

                # By provider+model
                by_provider_rows = await conn.fetch(
                    f"""
                    SELECT provider, model,
                           COUNT(*) AS calls,
                           COALESCE(SUM(tokens_in),0) AS tokens_in,
                           COALESCE(SUM(tokens_out),0) AS tokens_out,
                           COALESCE(SUM(chars),0) AS chars,
                           COALESCE(SUM(seconds),0) AS seconds,
                           COALESCE(SUM(cost_usd),0) AS cost_usd
                    FROM fredi_api_usage
                    {where_clause}
                    GROUP BY provider, model
                    ORDER BY cost_usd DESC
                    """
                )

                # By feature
                by_feature_rows = await conn.fetch(
                    f"""
                    SELECT COALESCE(feature, '(none)') AS feature,
                           provider,
                           COUNT(*) AS calls,
                           COALESCE(SUM(cost_usd),0) AS cost_usd
                    FROM fredi_api_usage
                    {where_clause}
                    GROUP BY feature, provider
                    ORDER BY cost_usd DESC
                    LIMIT 30
                    """
                )

                # Daily trend
                daily_rows = await conn.fetch(
                    f"""
                    SELECT DATE(created_at) AS day,
                           provider,
                           COUNT(*) AS calls,
                           COALESCE(SUM(cost_usd),0) AS cost_usd
                    FROM fredi_api_usage
                    {where_clause}
                    GROUP BY day, provider
                    ORDER BY day ASC
                    """
                )

            return {
                "period": period,
                "totals": {
                    "cost_usd": float(total_usd or 0.0),
                    "calls": int(total_calls or 0),
                    "tokens_in": int(total_tokens_in or 0),
                    "tokens_out": int(total_tokens_out or 0),
                },
                "by_provider": [
                    {
                        "provider": r["provider"],
                        "model": r["model"] or "",
                        "calls": int(r["calls"]),
                        "tokens_in": int(r["tokens_in"] or 0),
                        "tokens_out": int(r["tokens_out"] or 0),
                        "chars": int(r["chars"] or 0),
                        "seconds": float(r["seconds"] or 0),
                        "cost_usd": float(r["cost_usd"] or 0),
                    }
                    for r in by_provider_rows
                ],
                "by_feature": [
                    {
                        "feature": r["feature"],
                        "provider": r["provider"],
                        "calls": int(r["calls"]),
                        "cost_usd": float(r["cost_usd"] or 0),
                    }
                    for r in by_feature_rows
                ],
                "daily": [
                    {
                        "day": r["day"].isoformat() if r["day"] else None,
                        "provider": r["provider"],
                        "calls": int(r["calls"]),
                        "cost_usd": float(r["cost_usd"] or 0),
                    }
                    for r in daily_rows
                ],
            }
        except Exception as e:
            logger.error(f"analytics costs error: {e}")
            return {"error": "internal", "message": str(e)}

    # === Admin control panel ===
    @app.get("/api/admin/basic-mode-preset")
    async def get_basic_preset(
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Текущий пресет промпта BasicMode + список доступных."""
        _check_admin(x_admin_token)
        try:
            from modes.prompts.basic_presets import PRESET_META, get_preset_text
        except Exception as e:
            return {"error": "presets_unavailable", "message": str(e)}
        try:
            async with db.get_connection() as conn:
                row = await conn.fetchval(
                    "SELECT value FROM fredi_admin_settings WHERE key = 'basic_mode_preset'"
                )
            active = (row or "current").strip().lower()
        except Exception:
            active = "current"
        return {
            "active": active,
            "presets": PRESET_META,
            "active_text": get_preset_text(active),
        }

    @app.post("/api/admin/basic-mode-preset")
    async def set_basic_preset(
        body: Dict[str, Any] = Body(...),
        x_admin_token: Optional[str] = Header(default=None),
    ):
        """Переключить активный пресет. Body: {value: 'current'|'jarvis'|'house'}."""
        _check_admin(x_admin_token)
        try:
            from modes.prompts.basic_presets import all_keys, PRESET_KEY_DEFAULT
        except Exception as e:
            return {"error": "presets_unavailable", "message": str(e)}
        val = ((body or {}).get("value") or "").strip().lower()
        if val not in all_keys():
            val = PRESET_KEY_DEFAULT
        try:
            async with db.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO fredi_admin_settings (key, value, updated_at)
                    VALUES ('basic_mode_preset', $1, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                    """,
                    val,
                )
            logger.info(f"basic_mode_preset → {val}")
            return {"success": True, "active": val}
        except Exception as e:
            logger.error(f"set basic_mode_preset failed: {e}")
            return {"success": False, "error": str(e)}

    # === VK targeting (phase 1) chain-bootstrap ===
    # Цепляем регистрацию vk_routes сюда, чтобы не править main.py из этой
    # ============================================================
    # 📱 Messenger-link статистика (TG / MAX)
    # ============================================================
    # Сколько собрано MAX/TG user_id через флоу «PDF в MAX» после теста.
    # Это сильный sales-сигнал: каждый chat_id — потенциальная точка
    # реактивации (можно слать через бота).
    @app.get("/api/analytics/messenger-links")
    async def messenger_links_stats(
        platform: str = "",
        limit: int = 50,
        offset: int = 0,
        x_admin_token: Optional[str] = Header(default=None),
    ):
        _check_admin(x_admin_token)
        lim = max(1, min(int(limit), 500))
        off = max(0, int(offset))
        plat = (platform or "").strip().lower()
        args: List[Any] = []

        try:
            async with db.get_connection() as conn:
                # Сводка по платформам
                summary_rows = await conn.fetch(
                    "SELECT platform, "
                    "       COUNT(*) FILTER (WHERE is_active) AS active, "
                    "       COUNT(*) FILTER (WHERE is_active AND linked_at > NOW() - INTERVAL '24 hours') AS last_24h, "
                    "       COUNT(*) FILTER (WHERE is_active AND linked_at > NOW() - INTERVAL '7 days') AS last_7d, "
                    "       COUNT(*) FILTER (WHERE is_active AND linked_at > NOW() - INTERVAL '30 days') AS last_30d "
                    "FROM fredi_messenger_links "
                    "GROUP BY platform"
                )
                summary: Dict[str, Dict[str, int]] = {}
                for r in summary_rows:
                    summary[r["platform"]] = {
                        "active": int(r["active"] or 0),
                        "last_24h": int(r["last_24h"] or 0),
                        "last_7d": int(r["last_7d"] or 0),
                        "last_30d": int(r["last_30d"] or 0),
                    }

                # Список последних с именами из user_contexts
                sql = (
                    "SELECT ml.user_id, ml.platform, ml.chat_id, ml.username, "
                    "       ml.linked_at, ml.is_active, "
                    "       COALESCE(c.name, u.first_name, u.username, '') AS display_name "
                    "FROM fredi_messenger_links ml "
                    "LEFT JOIN fredi_users u ON u.user_id = ml.user_id "
                    "LEFT JOIN fredi_user_contexts c ON c.user_id = ml.user_id "
                    "WHERE ml.is_active = TRUE "
                )
                if plat in ("max", "telegram"):
                    args.append(plat)
                    sql += f"AND ml.platform = ${len(args)} "
                args.extend([lim, off])
                sql += f"ORDER BY ml.linked_at DESC LIMIT ${len(args)-1} OFFSET ${len(args)}"
                rows = await conn.fetch(sql, *args)

            items = [{
                "user_id": int(r["user_id"]),
                "platform": r["platform"],
                "chat_id": r["chat_id"],
                "username": r["username"] or "",
                "display_name": r["display_name"] or "",
                "linked_at": r["linked_at"].isoformat() if r["linked_at"] else None,
            } for r in rows]
            return {
                "success": True,
                "summary": summary,
                "items": items,
                "limit": lim,
                "offset": off,
            }
        except Exception as e:
            logger.error(f"messenger-links stats failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "internal", "message": str(e),
            })

    # ============================================================
    # 📨 Messenger broadcast — массовая отправка на собранные chat_id
    # ============================================================
    @app.post("/api/analytics/messenger-broadcast")
    async def messenger_broadcast(
        body: Dict[str, Any] = Body(...),
        x_admin_token: Optional[str] = Header(default=None),
    ):
        _check_admin(x_admin_token)
        try:
            from services.messenger_broadcast import broadcast, init_broadcast_table
            await init_broadcast_table(db)
        except Exception as e:
            logger.error(f"messenger_broadcast import failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "module_unavailable", "message": str(e),
            })

        text = (body or {}).get("text", "")
        platform = (body or {}).get("platform", "max")
        target = (body or {}).get("target", "all")
        user_ids = (body or {}).get("user_ids") or None
        test_chat_id = (body or {}).get("test_chat_id") or None
        broadcast_kind = (body or {}).get("kind", "manual")
        cooldown_hours = int((body or {}).get("cooldown_hours", 24))
        dry_run = bool((body or {}).get("dry_run", False))
        voice_text = (body or {}).get("voice_text") or None
        voice_mode = (body or {}).get("voice_mode") or "psychologist"

        try:
            if isinstance(user_ids, list):
                user_ids = [int(u) for u in user_ids if str(u).isdigit()]
                if not user_ids:
                    user_ids = None
        except Exception:
            user_ids = None

        try:
            result = await broadcast(
                db,
                text=text,
                platform=platform,
                target=target,
                user_ids=user_ids,
                test_chat_id=test_chat_id,
                broadcast_kind=str(broadcast_kind)[:64],
                cooldown_hours=cooldown_hours,
                dry_run=dry_run,
                voice_text=voice_text,
                voice_mode=str(voice_mode)[:32],
            )
        except Exception as e:
            logger.error(f"broadcast failed: {e}")
            raise HTTPException(status_code=500, detail={
                "error": "broadcast_failed", "message": str(e),
            })
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result)
        return {"success": True, **result}

    # ============================================================
    # VK auto-outreach routes — регистрируем здесь, в той же chain'е,
    try:
        from vk_routes import register_vk_routes as _register_vk_routes
        _vk_init = _register_vk_routes(app, db)
        logger.info("VK routes registered via analytics chain")
    except Exception as e:
        logger.warning(f"vk_routes register failed: {e}")

    # Phase 2 chain — POST /parse, GET /parsed (vk_phase2_routes.py).
    # Отдельный файл, потому что 24-КБ vk_routes.py не лезет в один MCP push.
    try:
        from vk_phase2_routes import register_vk_phase2_routes as _register_vk_phase2
        _register_vk_phase2(app, db)
        logger.info("VK phase 2 routes registered via analytics chain")
    except Exception as e:
        logger.warning(f"vk_phase2_routes register failed: {e}")

    # Кросс-сессионная память Фреди (session_memory.py).
    # Таблица fredi_session_summaries + admin endpoints для управления.
    _sm_init = None
    try:
        from session_memory import (
            register_session_memory as _register_sm,
            register_session_memory_routes as _register_sm_routes,
        )
        _sm_init = _register_sm(app, db)
        _register_sm_routes(app, db)
        logger.info("Session-memory registered via analytics chain")
    except Exception as e:
        logger.warning(f"session_memory register failed: {e}")

    async def _combined_init():
        await init_analytics_table()
        if _vk_init is not None:
            try:
                await _vk_init()
            except Exception as e:
                logger.warning(f"vk init failed: {e}")
        if _sm_init is not None:
            try:
                await _sm_init()
            except Exception as e:
                logger.warning(f"session_memory init failed: {e}")

    return _combined_init
