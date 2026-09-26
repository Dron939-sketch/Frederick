# -*- coding: utf-8 -*-
"""Письмо тем, кто записался на курс Лектория из «Скоро», когда курс вышел.

26.09.2026 вышел «Дело жизни», на него была заявка от 16.09, и оповестить
человека было нечем: заявки копились в course_waitlist, а ручки «курс
готов — напиши записавшимся» не было. Теперь она есть и общая для любого
курса: название, адрес и первая лекция берутся из каталога
data/lektorij_catalog.json, тот же, что собирает план на неделю.

Кому уходит: заявки на этот slug с контактом-почтой и пустым notified_at.
Одно письмо на заявку, повторно не уйдёт. Контакты не-почта (телеграм,
телефон) в отчёте считаются отдельно — их надо оповещать руками.
"""
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

SITE = "https://meysternlp.ru"
CATALOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lektorij_catalog.json")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня", "июля",
           "августа", "сентября", "октября", "ноября", "декабря")

MIGRATION_SQL = "ALTER TABLE course_waitlist ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE"

CANDIDATES_SQL = """
    SELECT id, contact, name, created_at
      FROM course_waitlist
     WHERE course_slug = $1 AND notified_at IS NULL
     ORDER BY created_at
"""


def course_info(slug: str) -> Optional[Dict[str, Any]]:
    """Курс из каталога: title, url, description, lectures. None — нет такого."""
    try:
        with open(CATALOG, encoding="utf-8") as f:
            cat = json.load(f)
    except (OSError, ValueError):
        return None
    c = cat.get("courses", {}).get(slug)
    if not c or not c.get("lectures"):
        return None
    return c


def _plural(n: int, one: str, few: str, many: str) -> str:
    n = abs(n) % 100
    if 11 <= n <= 14:
        return many
    n %= 10
    if n == 1:
        return one
    if 2 <= n <= 4:
        return few
    return many


def _when(created_at) -> str:
    try:
        return f"{created_at.day} {_MONTHS[created_at.month - 1]}"
    except (AttributeError, IndexError):
        return "недавно"


def _mask(email: str) -> str:
    try:
        local, dom = email.split("@", 1)
        return (local[:2] + "…@" + dom) if len(local) > 2 else ("…@" + dom)
    except ValueError:
        return "…"


def letter(course: Dict[str, Any], name: str = "", created_at=None) -> Dict[str, str]:
    """Тема, текст и html письма. Голос сайта: на «вы», конкретика, без
    обещаний; цен нет — курс бесплатный, и это единственное число про деньги."""
    title = course["title"]
    n = len(course["lectures"])
    first = course["lectures"][0]
    url = SITE + course["url"]
    first_url = SITE + first["url"]
    fredi = f"{SITE}/fredi/?from=lektorij-{course['url'].rstrip('/').rsplit('/', 1)[-1]}"
    greeting = f"{name.strip()}, здравствуйте." if name and name.strip() else "Здравствуйте."
    lec = f"{n} {_plural(n, 'лекция', 'лекции', 'лекций')}"
    paragraphs = [
        greeting,
        (f"{_when(created_at)} вы оставили заявку на курс «{title}» в Лектории. "
         f"Курс готов и открыт целиком: {lec}, бесплатно и без регистрации."),
        (f"С чего начать. Первая лекция — «{first['title']}»: {first_url}. "
         "В ней замер на входе: несколько чисел, которые вы посчитаете снова в последней лекции, "
         "и по ним будет видно, сдвинулось ли что-то. Дальше по одной лекции в неделю: у каждой есть "
         "действие недели, и следующая начинается с проверки, что вышло. Быстрее не имеет смысла."),
        f"Страница курса со всеми лекциями: {url}",
        ("Если после первой лекции захочется разобрать своё, это можно сделать с Фреди: он ведёт по той же "
         f"цепочке, что курс, и после разговора собирает план на семь дней из его лекций. {fredi}"),
        ("Это письмо одно: вы получили его, потому что сами записались на этот курс в каталоге Лектория. "
         "Больше писем по этой заявке не будет."),
        "Андрей Мейстер",
    ]
    subject = f"Курс «{title}» готов — вы на него записывались"
    plain = "\n\n".join(paragraphs)

    def link(u: str) -> str:
        return f'<a href="{u}" style="color:#3A86FF">{u}</a>'

    html_ps = []
    for p in paragraphs:
        esc = (p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        esc = re.sub(r"(https?://\S+)", lambda m: link(m.group(1)), esc)
        html_ps.append(f'<p style="margin:0 0 14px">{esc}</p>')
    html = ("<!doctype html><html lang=\"ru\"><body style=\"margin:0;padding:24px 16px;"
            "font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff\">"
            "<div style=\"max-width:640px;margin:0 auto\">" + "".join(html_ps) + "</div></body></html>")
    return {"subject": subject, "plain": plain, "html": html}


async def candidates(db, slug: str) -> Dict[str, Any]:
    async with db.get_connection() as conn:
        await conn.execute(MIGRATION_SQL)
        rows = await conn.fetch(CANDIDATES_SQL, slug)
    emails = [r for r in rows if _EMAIL_RE.match((r["contact"] or "").strip())]
    other = [r for r in rows if r not in emails]
    return {"emails": emails, "other": other}


async def send_for_course(db, email_service, slug: str) -> Dict[str, Any]:
    course = course_info(slug)
    if not course:
        return {"error": "no_course", "slug": slug}
    c = await candidates(db, slug)
    sent, failed = 0, 0
    for r in c["emails"]:
        to = r["contact"].strip()
        m = letter(course, r["name"] or "", r["created_at"])
        ok = await email_service.send(to, m["subject"], m["plain"], html=m["html"])
        if ok:
            sent += 1
            async with db.get_connection() as conn:
                await conn.execute("UPDATE course_waitlist SET notified_at = NOW() WHERE id = $1", r["id"])
        else:
            failed += 1
            logger.error(f"[waitlist_notify] не ушло: {slug} {_mask(to)}")
    return {"slug": slug, "course": course["title"], "candidates": len(c["emails"]),
            "sent": sent, "failed": failed,
            "not_email": [(r["contact"] or "")[:3] + "…" for r in c["other"]]}


def register_waitlist_notify_routes(app, db, email_service_getter):
    from fastapi import Header, HTTPException, Request
    from analytics_routes import _check_admin

    @app.get("/api/lektorij/waitlist/notify")
    async def waitlist_notify_preview(request: Request, course: str = "",
                                      x_admin_token: Optional[str] = Header(default=None)):
        """Кому уйдёт письмо о вышедшем курсе (почты замаскированы). Ничего не шлёт."""
        _check_admin(x_admin_token)
        info = course_info(course)
        if not info:
            raise HTTPException(status_code=404, detail={"error": "no_course", "slug": course})
        c = await candidates(db, course)
        svc = email_service_getter()
        sample = letter(info, "", None)
        return {
            "slug": course, "course": info["title"], "lectures": len(info["lectures"]),
            "emails": [_mask(r["contact"]) for r in c["emails"]],
            "not_email": len(c["other"]),
            "email_enabled": bool(svc and getattr(svc, "enabled", False)),
            "subject": sample["subject"],
        }

    @app.post("/api/lektorij/waitlist/notify")
    async def waitlist_notify_send(request: Request, course: str = "", test_to: str = "",
                                   x_admin_token: Optional[str] = Header(default=None)):
        """test_to=почта — пробное письмо туда, заявки не трогаются.
        Без test_to — всем записавшимся на курс, кто ещё не получал."""
        _check_admin(x_admin_token)
        info = course_info(course)
        if not info:
            raise HTTPException(status_code=404, detail={"error": "no_course", "slug": course})
        svc = email_service_getter()
        if not svc or not getattr(svc, "enabled", False):
            raise HTTPException(status_code=503, detail={"error": "email_disabled"})
        if test_to:
            m = letter(info, "", None)
            ok = await svc.send(test_to.strip(), m["subject"], m["plain"], html=m["html"])
            return {"test": True, "to": _mask(test_to), "ok": bool(ok)}
        return {"test": False, **(await send_for_course(db, svc, course))}
