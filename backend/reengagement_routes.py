"""
reengagement_routes.py — публичные endpoint'ы и админские
управления для reengagement-кампаний.

Публичные (для юзеров):
  GET /api/reengagement/optout?t=<token>  — мягкая HTML-страница отписки
  GET /api/reengagement/track?t=<token>   — редирект с отметкой клика

Админские (под X-Admin-Token):
  GET  /api/admin/reengagement/d3-candidates  — счётчик и список
  POST /api/admin/reengagement/d3-send        — батч-отправка вручную
  GET  /api/admin/reengagement/stats          — отправлено/доставлено/clicks

Полу-автомат: cron-шедулер по умолчанию НЕ шлёт автоматически
(REENG_AUTOSEND=0). Каждый час он считает кандидатов в логи, а
оператор смотрит в админку и нажимает «Отправить» — после ревью
списка. Так избегаем «AI шлёт нашим юзерам без нашего ведома»,
сохраняя при этом всю автоматическую часть (поиск, генерация,
доставка).
"""
from __future__ import annotations
import asyncio
import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

logger = logging.getLogger(__name__)

APP_BASE_URL = (os.environ.get("APP_BASE_URL")
                or "https://meysternlp.ru/fredi/").rstrip("/") + "/"

_OK_HTML = """<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><title>Готово — Фреди</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;
 max-width:520px;margin:64px auto;padding:0 24px;color:#1c1c1e;line-height:1.55}
 h1{font-size:22px;margin-bottom:12px} p{color:#555}
 a{color:#1c1c1e}</style></head><body>
<h1>Готово</h1>
<p>Вы отписались от писем возврата. Спасибо, что были с нами.</p>
<p style="margin-top:24px;font-size:13px;color:#888">
Если передумаете — заходите в любой момент: <a href="%s">%s</a>.
</p></body></html>"""

_GONE_HTML = """<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><title>Ссылка устарела — Фреди</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;
 max-width:520px;margin:64px auto;padding:0 24px;color:#1c1c1e;line-height:1.55}
 h1{font-size:22px;margin-bottom:12px} p{color:#555}</style></head><body>
<h1>Ссылка устарела</h1>
<p>Похоже, эта ссылка отписки уже не действительна.
Откройте Фреди и измените настройки уведомлений в профиле.</p>
</body></html>"""


def _check_admin(token: Optional[str]):
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail={
            "error": "admin_disabled",
            "message": "Админ-эндпоинты выключены: задайте ADMIN_TOKEN в env"
        })
    if not token or token != expected:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


# SQL для поиска кандидатов d3. Выделен в константу — используется
# в /admin/d3-candidates И в /admin/d3-send (одинаковый фильтр —
# одинаковая выборка).
_D3_CANDIDATES_SQL = """
    SELECT u.user_id, u.email,
           COALESCE(uc.name, u.first_name) AS name,
           u.created_at, u.last_activity,
           EXTRACT(EPOCH FROM (NOW() - u.last_activity)) / 86400.0 AS days_inactive,
           EXTRACT(EPOCH FROM (NOW() - u.created_at))   / 86400.0 AS days_since_signup,
           EXISTS (
               SELECT 1 FROM fredi_messenger_links m
               WHERE m.user_id = u.user_id AND m.platform = 'max'
                 AND COALESCE(m.is_active, TRUE) = TRUE
           ) AS has_max
    FROM fredi_users u
    LEFT JOIN fredi_user_contexts uc ON uc.user_id = u.user_id
    WHERE u.created_at < NOW() - INTERVAL '3 days'
      AND u.last_activity < NOW() - INTERVAL '3 days'
      AND u.last_activity > NOW() - INTERVAL '14 days'
      AND u.email IS NOT NULL
      AND COALESCE(u.email_opted_in, TRUE) = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM fredi_reengagement_log l
          WHERE l.user_id = u.user_id AND l.campaign = 'd3_first'
      )
    ORDER BY u.last_activity ASC
"""


def register_reengagement_routes(app, db, email_service_getter=None):
    router = APIRouter(prefix="/api/reengagement", tags=["reengagement"])

    @router.get("/optout")
    async def optout(t: str = ""):
        if not t or len(t) < 8:
            return HTMLResponse(_GONE_HTML, status_code=404)
        row = await db.fetchrow(
            "SELECT user_id FROM fredi_reengagement_log "
            "WHERE opt_out_token = $1 LIMIT 1",
            t
        )
        if not row:
            return HTMLResponse(_GONE_HTML, status_code=404)
        await db.execute(
            "UPDATE fredi_users SET email_opted_in = FALSE, "
            "email_opted_out_at = NOW() WHERE user_id = $1",
            row['user_id']
        )
        # И отметим сам клик — opt-out тоже клик, не теряем сигнал.
        await db.execute(
            "UPDATE fredi_reengagement_log SET clicked_at = COALESCE(clicked_at, NOW()), "
            "opted_out_at = NOW() WHERE opt_out_token = $1",
            t
        )
        logger.info(f"[reeng] user {row['user_id']} opted out via token {t[:6]}…")
        return HTMLResponse(_OK_HTML % (APP_BASE_URL, APP_BASE_URL))

    @router.get("/track")
    async def track(t: str = "", request: Request = None):
        """Прозрачный редирект — отмечаем клик и пуляем юзера в приложение."""
        if t and len(t) >= 8:
            await db.execute(
                "UPDATE fredi_reengagement_log "
                "SET clicked_at = COALESCE(clicked_at, NOW()) "
                "WHERE opt_out_token = $1",
                t
            )
        # Пробрасываем ref/cid в URL — фронт может прочитать и
        # показать «С возвращением!» контекстный onboarding.
        return RedirectResponse(
            url=f"{APP_BASE_URL}?ref=reeng&cid={t or ''}",
            status_code=302
        )

    app.include_router(router)

    # ============================================================
    # ADMIN ROUTES (под X-Admin-Token)
    # ============================================================
    admin_router = APIRouter(prefix="/api/admin/reengagement",
                              tags=["admin-reengagement"])

    @admin_router.get("/d3-candidates")
    async def d3_candidates(request: Request):
        """Возвращает счётчик и список кандидатов на кампанию d3."""
        _check_admin(request.headers.get("X-Admin-Token"))
        rows = await db.fetch(_D3_CANDIDATES_SQL + " LIMIT 200")
        cands = []
        for r in rows:
            cands.append({
                "user_id": r["user_id"],
                "email": r["email"],
                "name": r["name"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "last_activity": r["last_activity"].isoformat() if r["last_activity"] else None,
                "days_inactive": round(float(r["days_inactive"] or 0), 1),
                "days_since_signup": round(float(r["days_since_signup"] or 0), 1),
                "has_max": bool(r["has_max"]),
            })
        return {"success": True, "count": len(cands), "candidates": cands}

    @admin_router.post("/d3-send")
    async def d3_send(request: Request):
        """Манульная батч-отправка. body = {dry_run?: bool, limit?: int,
        user_ids?: list[int]}."""
        _check_admin(request.headers.get("X-Admin-Token"))
        try:
            body = await request.json()
        except Exception:
            body = {}
        dry = bool(body.get("dry_run"))
        limit = int(body.get("limit") or 50)
        ids = body.get("user_ids") or []
        if not isinstance(ids, list):
            ids = []

        from services.reengagement import send_reengagement, CAMPAIGN_D3

        # Если переданы user_ids — шлём именно им (но только если они
        # удовлетворяют фильтру кандидатов: тот же SQL + WHERE user_id = ANY).
        # Если не переданы — берём первые `limit` из общей выборки.
        if ids:
            try:
                ids_int = [int(x) for x in ids][:limit]
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail={"error": "bad_user_ids"})
            rows = await db.fetch(
                _D3_CANDIDATES_SQL + " AND u.user_id = ANY($1::bigint[]) LIMIT $2",
                ids_int, limit
            )
        else:
            rows = await db.fetch(_D3_CANDIDATES_SQL + " LIMIT $1", limit)

        if dry:
            return {"success": True, "dry_run": True,
                    "would_send": len(rows),
                    "user_ids": [r["user_id"] for r in rows]}

        es = email_service_getter() if callable(email_service_getter) else email_service_getter
        sent = 0
        failed = 0
        for r in rows:
            try:
                ok = await send_reengagement(db, es, r["user_id"], CAMPAIGN_D3)
                if ok:
                    sent += 1
                else:
                    failed += 1
            except Exception as e:
                logger.warning(f"[reeng-admin] send failed for {r['user_id']}: {e}")
                failed += 1
            # Мягкий rate-limit между отправками — для SMTP/MAX.
            await asyncio.sleep(1.0)
        return {"success": True, "dry_run": False,
                "total_candidates": len(rows),
                "sent": sent, "failed": failed}

    @admin_router.get("/stats")
    async def stats(request: Request):
        """Общая статистика по reengagement-кампаниям."""
        _check_admin(request.headers.get("X-Admin-Token"))
        rows = await db.fetch(
            """SELECT campaign,
                      COUNT(*)::int                                  AS total,
                      COUNT(*) FILTER (WHERE delivered)::int          AS delivered_count,
                      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int  AS clicked_count,
                      COUNT(*) FILTER (WHERE opted_out_at IS NOT NULL)::int AS optouts,
                      MAX(sent_at)                                    AS last_sent_at
               FROM fredi_reengagement_log
               GROUP BY campaign
               ORDER BY MAX(sent_at) DESC NULLS LAST"""
        )
        # Также вернём opt-in / opt-out total в users
        opt = await db.fetchrow(
            """SELECT COUNT(*) FILTER (WHERE COALESCE(email_opted_in, TRUE) = TRUE)::int AS opted_in,
                      COUNT(*) FILTER (WHERE email_opted_in = FALSE)::int AS opted_out,
                      COUNT(*)::int AS total_users_with_email
               FROM fredi_users WHERE email IS NOT NULL"""
        )
        return {
            "success": True,
            "campaigns": [dict(r) for r in rows],
            "users": dict(opt) if opt else {},
        }

    app.include_router(admin_router)
    logger.info("✅ reengagement routes registered (incl. admin)")
    return router
