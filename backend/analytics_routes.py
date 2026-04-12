"""
analytics_routes.py — Lightweight analytics endpoint.
Usage: from analytics_routes import register_analytics_routes
       register_analytics_routes(app, db)
"""

import json
import logging
from datetime import datetime
from fastapi import Request

logger = logging.getLogger(__name__)


def register_analytics_routes(app, db):
    """Register analytics endpoints."""

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
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_user "
                "ON fredi_analytics(user_id, created_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_fredi_analytics_event "
                "ON fredi_analytics(event, created_at DESC)"
            )
        logger.info("Analytics table ready")

    @app.post("/api/analytics/events")
    async def receive_events(request: Request):
        """Receive a batch of analytics events (fire-and-forget from frontend)."""
        try:
            body = await request.body()
            if len(body) > 50000:
                return {"ok": False}
            data = json.loads(body)
            events = data.get("events", [])
            if not events or not isinstance(events, list):
                return {"ok": False}
            # Limit batch size
            events = events[:20]
            async with db.get_connection() as conn:
                for ev in events:
                    user_id = ev.get("user_id")
                    try:
                        user_id = int(user_id) if user_id else None
                    except (ValueError, TypeError):
                        user_id = None
                    event_name = str(ev.get("event", ""))[:50]
                    session_id = str(ev.get("session_id", ""))[:50]
                    screen = str(ev.get("screen", ""))[:50]
                    event_data = ev.get("data", {})
                    if not isinstance(event_data, dict):
                        event_data = {}
                    # Truncate data values
                    safe_data = {}
                    for k, v in list(event_data.items())[:20]:
                        safe_data[str(k)[:30]] = str(v)[:200]
                    await conn.execute(
                        "INSERT INTO fredi_analytics "
                        "(user_id, session_id, event, screen, data) "
                        "VALUES ($1, $2, $3, $4, $5)",
                        user_id, session_id, event_name, screen,
                        json.dumps(safe_data, ensure_ascii=False)
                    )
            return {"ok": True}
        except Exception as e:
            logger.error(f"analytics error: {e}")
            return {"ok": False}

    @app.get("/api/analytics/summary")
    async def analytics_summary(request: Request):
        """Get aggregated analytics summary (last 7 days)."""
        try:
            async with db.get_connection() as conn:
                # Total events
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days'"
                )
                # Unique users
                users = await conn.fetchval(
                    "SELECT COUNT(DISTINCT user_id) FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' AND user_id IS NOT NULL"
                )
                # Events by type
                rows = await conn.fetch(
                    "SELECT event, COUNT(*) as cnt "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "GROUP BY event ORDER BY cnt DESC LIMIT 20"
                )
                by_event = {r['event']: r['cnt'] for r in rows}
                # Screens by popularity
                screens = await conn.fetch(
                    "SELECT screen, COUNT(*) as cnt "
                    "FROM fredi_analytics "
                    "WHERE created_at > NOW() - INTERVAL '7 days' "
                    "AND event = 'screen_view' AND screen != '' "
                    "GROUP BY screen ORDER BY cnt DESC LIMIT 15"
                )
                by_screen = {r['screen']: r['cnt'] for r in screens}
                # Avg session duration
                avg_dur = await conn.fetchval(
                    "SELECT AVG((data->>'duration_sec')::int) "
                    "FROM fredi_analytics "
                    "WHERE event = 'session_end' "
                    "AND created_at > NOW() - INTERVAL '7 days'"
                )
                return {
                    "period": "7d",
                    "total_events": total or 0,
                    "unique_users": users or 0,
                    "avg_session_sec": round(avg_dur or 0),
                    "by_event": by_event,
                    "by_screen": by_screen
                }
        except Exception as e:
            logger.error(f"analytics summary error: {e}")
            return {"error": "internal"}

    return init_analytics_table
