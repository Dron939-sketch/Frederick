"""
reengagement_routes.py — публичные endpoint'ы для reengagement-кампаний.

GET /api/reengagement/optout?t=<token>
    Помечает email_opted_in=FALSE для юзера, чей opt_out_token
    лежит в fredi_reengagement_log. Возвращает простую HTML-страницу
    «Вы отписались». Безопасно вызывать повторно.

GET /api/reengagement/track?t=<token>
    Помечает clicked_at и редиректит на APP_BASE_URL?ref=reeng&cid=t.
    Используется как «прозрачная» ссылка возврата — иначе бы пришлось
    клиенту самому слать событие, что хуже доставляется.

Лимитов специально мягких — это публичные ссылки из писем, и
жёсткий rate-limit может ломать клики из медленных корпоративных
ESP, кеширующих ссылки.
"""
from __future__ import annotations
import os
import logging
from fastapi import APIRouter, Request
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


def register_reengagement_routes(app, db):
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
    logger.info("✅ reengagement routes registered")
    return router
