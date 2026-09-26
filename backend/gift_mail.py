# -*- coding: utf-8 -*-
"""Подарок подписчикам: сборник заданий «Три пути» двумя PDF на почту.

Решение владельца 25.09.2026: тем, у кого сейчас действует подписка,
отправить письмом три сборника тренировочных заданий «Три пути» —
редакция с легендой курсанта (парень), с легендой курсантки (девушка) и с легендой курсанта 30+ (взрослый),
16–19 лет, — как подарок для их детей, с объяснением, какой навык это
ставит и что даёт.

Как устроено:
- письмо одно, персонализация — только имя в обращении;
- получатели — активная подписка (status = 'active', expires_at в
  будущем), есть почта, от писем не отказывался;
- каждому не больше одного раза: строка в fredi_mail_campaign_log
  ставится ДО отправки (как в напоминаниях), повторный запуск кнопки
  никого не побеспокоит дважды;
- запускается вручную из админки, под X-Admin-Token: сначала dry-run
  с числом получателей, потом пробное письмо себе, потом отправка.
  Никакого автозапуска — рассылка подписчикам не то, что должно
  случаться само по деплою.

Файлы лежат в assets/gifts/ и уходят вложениями: ссылка на PDF живёт
до первого чищенного браузера, а вложение остаётся в почте.

FastAPI импортируется внутри register_*: текст письма и запрос
получателей проверяются тестами в окружении без веб-стека.

Без `from __future__ import annotations` — намеренно. С ним аннотации
маршрутов становятся строками, FastAPI разбирает их по глобалам модуля,
а Request и Header импортированы внутри функции — и регистрация падала
на старте (25.09.2026, флаг gift_mail в /health был false).
"""
import html as _html
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CAMPAIGN = "tri_puti_gift_2026_09"

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "gifts")
ATTACHMENTS = (
    ("Три пути — сборник заданий (курсант).pdf", "tri-puti-kursant.pdf"),
    ("Три пути — сборник заданий (курсантка).pdf", "tri-puti-kursantka.pdf"),
    ("Три пути — сборник заданий (курсант 30+).pdf", "tri-puti-kursant-30.pdf"),
)

SITE = "https://meysternlp.ru"
LINK_GAME = f"{SITE}/igry/tri-puti.html"
LINK_LECTURE = f"{SITE}/blog/lekciya-stimul-6-hochu-a-etogo-net.html"
LINK_COURSE = f"{SITE}/blog/lektorij/stimulnyj-kontrol/"

SUBJECT = "«Три пути»: сборник заданий для вашего сына или дочери — в подарок"

# Активная подписка + почта + не отказывался от писем + ещё не получал.
RECIPIENTS_SQL = """
    SELECT u.user_id,
           COALESCE(NULLIF(uc.name, ''), NULLIF(u.first_name, ''), '') AS name,
           u.email
      FROM fredi_users u
      JOIN fredi_subscriptions s ON s.user_id = u.user_id
      LEFT JOIN fredi_user_contexts uc ON uc.user_id = u.user_id
     WHERE s.status = 'active'
       AND s.expires_at > NOW()
       AND u.email IS NOT NULL AND u.email <> ''
       AND COALESCE(u.email_opted_in, TRUE) = TRUE
       AND NOT EXISTS (SELECT 1 FROM fredi_mail_campaign_log l
                        WHERE l.campaign = $1 AND l.user_id = u.user_id)
     ORDER BY u.user_id
"""

MIGRATION_SQL = """
    CREATE TABLE IF NOT EXISTS fredi_mail_campaign_log (
        campaign TEXT NOT NULL,
        user_id  BIGINT NOT NULL,
        email    TEXT,
        sent_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ok       BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (campaign, user_id)
    )
"""


def _greeting(name: str) -> str:
    name = (name or "").strip()
    return f"{name}, здравствуйте." if name else "Здравствуйте."


# Текст письма — один источник, из него собираются и plain, и html.
# Голос — сайта: на «вы», конкретика, без «изменить жизнь».
def _paragraphs(name: str) -> List[Any]:
    return [
        _greeting(name),
        ("Вы с подпиской на Фреди, и у меня для вас подарок. К письму приложены "
         "три сборника тренировочных заданий «Три пути»: два для вашего сына "
         "или дочери, если им от шестнадцати до девятнадцати, — с легендой "
         "курсанта, для парня, и с легендой курсантки, для девушки, — и третий "
         "для вас самих, с легендой курсанта за тридцать: работа, ипотека, "
         "дети, машина. Это одно и то же по устройству, разная только жизнь "
         "внутри заданий. Выберите свой."),
        ("<b>Какой навык это ставит.</b> Момент, который вы наверняка видели: "
         "подросток хочет чего-то, а этого нет — денег, вещи, разрешения, "
         "человека. И дальше он видит только дыру. Просит, давит, "
         "обижается или говорит «да и ладно». Навык, который ставит сборник, — "
         "другой: когда основной путь закрыт, за минуту найти три обходных из "
         "того, что есть, и сохранить хотя бы два, когда один из них тоже "
         "закроется. В сборнике это называется сухо: поиск путей при "
         "блокировании рабочего пути и комбинирование наличных ресурсов."),
        ("<b>Как он устроен.</b> Шесть этапов по десять заданий: числа, "
         "предметы, карта местности, ситуации, личный контекст, цепочка из "
         "трёх звеньев. Первые четыре этапа — про чужое и безличное: "
         "«дано: 2, 3, 4, 5, 10 — надо: 14», «дано: ключ на 9, ключ на 11, "
         "плоскогубцы, фольга — надо: ключ на 10». Пятый — про свою жизнь: "
         "у курсанта есть легенда, и задания идут из неё. Так навык сначала "
         "ставится на чистом материале и только потом переносится на себя. "
         "Объяснять правило заранее не нужно, и это не оговорка: тот, кому "
         "объяснили, начинает думать вместо того, чтобы делать."),
        ("<b>Что нужно от вас.</b> Распечатать сборник и быть инструктором: "
         "зачитать «дано» и «надо», включить секундомер, после трёх "
         "записанных маршрутов зачитать «вводную» с листа инструктора — "
         "«закрыто число 10», — и посчитать, сколько маршрутов уцелело. "
         "Не подсказывать, не комментировать по ходу, разбор — только после "
         "серии из пяти заданий. Первое задание каждого этапа заполнено как "
         "образец, его разбирают вместе до начала. Партия — двадцать-тридцать "
         "минут. Три «отлично» подряд — допуск к следующему этапу."),
        ("<b>Что это даёт.</b> Признак сформированного навыка в сборнике "
         "назван прямо: вопрос «а какие ещё пути?» возникает у человека сам, "
         "в первые секунды после того, как путь закрылся, — вместо «дайте». "
         "Это и есть то, что потом называют самостоятельностью. Ещё одно, что "
         "стоит знать: этап с личным контекстом взрослому нужен не меньше. "
         "Если детей такого возраста рядом нет — племянник, крестник, младший "
         "брат, или пройдите сборник сами, с кем-то в роли инструктора."),
        ("Откуда это. Навык — из шестой лекции курса «Стимульный контроль для "
         "родителей», а настольная версия с историями и листом задач лежит на "
         "сайте: [game]. Сборник в приложении — тот же навык в форме зачёта, "
         "для тех, кому нужна не игра, а норматив."),
        "С уважением, Андрей Мейстер.",
        ("Это разовое письмо подписчикам Фреди; вопросы — через форму на сайте "
         "или в Telegram, ссылки внизу любой страницы."),
    ]


def plain_text(name: str = "") -> str:
    out = []
    for p in _paragraphs(name):
        p = p.replace("<b>", "").replace("</b>", "")
        p = p.replace("[game]", LINK_GAME)
        out.append(p)
    out.append(f"Лекция 6: {LINK_LECTURE}")
    return "\n\n".join(out) + "\n"


def html_body(name: str = "") -> str:
    ps = []
    for p in _paragraphs(name):
        # Экранируем всё, кроме наших собственных <b>.
        safe = _html.escape(p, quote=False).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
        safe = safe.replace("[game]", f'<a href="{LINK_GAME}">{LINK_GAME.replace("https://", "")}</a>')
        ps.append(f'<p style="margin:0 0 14px">{safe}</p>')
    ps.append(f'<p style="margin:0 0 14px;color:#666;font-size:13px">Лекция 6 курса: '
              f'<a href="{LINK_LECTURE}">«Хочу, а этого нет»: индексация ресурсов</a> · '
              f'весь курс: <a href="{LINK_COURSE}">Стимульный контроль для родителей</a></p>')
    return ("<!doctype html><html lang=\"ru\"><body style=\"margin:0;padding:24px 16px;"
            "font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff\">"
            "<div style=\"max-width:640px;margin:0 auto\">"
            + "".join(ps) +
            "<p style=\"margin:18px 0 0;color:#888;font-size:12px\">Во вложении три PDF: сборники с "
            "легендой курсанта, курсантки и курсанта 30+, по 25 страниц А4.</p>"
            "</div></body></html>")


def load_attachments() -> List[tuple]:
    """(имя файла в письме, bytes, 'pdf') для каждого сборника."""
    out = []
    for shown, fname in ATTACHMENTS:
        path = os.path.join(ASSETS_DIR, fname)
        with open(path, "rb") as f:
            out.append((shown, f.read(), "pdf"))
    return out


def _mask(email: str) -> str:
    try:
        local, dom = email.split("@", 1)
        return (local[:2] + "…@" + dom) if len(local) > 2 else ("…@" + dom)
    except ValueError:
        return "…"


async def list_recipients(db) -> List[Dict[str, Any]]:
    async with db.get_connection() as conn:
        await conn.execute(MIGRATION_SQL)
        rows = await conn.fetch(RECIPIENTS_SQL, CAMPAIGN)
    return [{"user_id": int(r["user_id"]), "name": r["name"] or "", "email": r["email"]} for r in rows]


async def send_to_all(db, email_service) -> Dict[str, Any]:
    """Отправка всем, кто ещё не получал. Строка в лог — до письма."""
    recipients = await list_recipients(db)
    attachments = load_attachments()
    sent, failed = 0, 0
    for r in recipients:
        async with db.get_connection() as conn:
            claimed = await conn.fetchval(
                "INSERT INTO fredi_mail_campaign_log (campaign, user_id, email, ok) "
                "VALUES ($1, $2, $3, FALSE) ON CONFLICT DO NOTHING RETURNING user_id",
                CAMPAIGN, r["user_id"], r["email"])
        if claimed is None:
            continue
        ok = await email_service.send(r["email"], SUBJECT, plain_text(r["name"]),
                                      html=html_body(r["name"]), attachments=attachments)
        async with db.get_connection() as conn:
            await conn.execute(
                "UPDATE fredi_mail_campaign_log SET ok = $3, sent_at = NOW() "
                "WHERE campaign = $1 AND user_id = $2", CAMPAIGN, r["user_id"], bool(ok))
        if ok:
            sent += 1
        else:
            failed += 1
            logger.error(f"[gift_mail] не ушло: user={r['user_id']} {_mask(r['email'])}")
    return {"candidates": len(recipients), "sent": sent, "failed": failed}


def register_gift_mail_routes(app, db, email_service_getter):
    from fastapi import Header, HTTPException, Request
    from analytics_routes import _check_admin

    @app.get("/api/analytics/gift/tri-puti")
    async def gift_tri_puti_preview(request: Request,
                                    x_admin_token: Optional[str] = Header(default=None)):
        """Сколько получателей и кто (почта замаскирована). Ничего не шлёт."""
        _check_admin(x_admin_token)
        rs = await list_recipients(db)
        svc = email_service_getter()
        return {
            "campaign": CAMPAIGN,
            "count": len(rs),
            "sample": [_mask(r["email"]) for r in rs[:10]],
            "email_enabled": bool(svc and getattr(svc, "enabled", False)),
            "attachments": [{"name": n, "bytes": len(b)} for n, b, _ in load_attachments()],
            "subject": SUBJECT,
        }

    @app.post("/api/analytics/gift/tri-puti")
    async def gift_tri_puti_send(request: Request, test_to: str = "",
                                 x_admin_token: Optional[str] = Header(default=None)):
        """test_to=почта — пробное письмо на этот адрес, без лога.
        Без test_to — отправка всем подписчикам, кто ещё не получал."""
        _check_admin(x_admin_token)
        svc = email_service_getter()
        if not svc or not getattr(svc, "enabled", False):
            raise HTTPException(status_code=503, detail={"error": "email_disabled"})
        if test_to:
            ok = await svc.send(test_to.strip(), SUBJECT, plain_text(""),
                                html=html_body(""), attachments=load_attachments())
            return {"test": True, "to": _mask(test_to), "ok": bool(ok)}
        return {"test": False, **(await send_to_all(db, svc))}
