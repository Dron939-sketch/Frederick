"""expert_scout.py — отбор друзей ВК под предложение о странице в справочнике.

Задача другая, чем у drip_campaign, поэтому и модуль отдельный. Там прогрев
холодной аудитории по полу и возрасту; здесь — разовый разбор собственного
списка друзей: кому справочная страница реально нужна и кто захочет ей
заниматься.

Почему нельзя было обойтись friends.get, как в drip_campaign: он отдаёт
только имя, пол, возраст и признак «можно ли писать». По этим полям видно
«женщина 34 года», но не видно, мастер это с частной практикой или бухгалтер
в найме. Поэтому здесь второй проход — users.get с полями occupation, career,
site, about, status, followers_count. Пачками по 300: это потолок VK на один
запрос.

Две шкалы, а не одна общая оценка:

  «надо»    — профессия, где человека ищут по имени. Клиент перед записью
              гуглит фамилию; если находит однофамильцев, страница закрывает
              дыру. Для наёмного бухгалтера она не закрывает ничего.
  «захочет» — человек уже вкладывается в присутствие: заполнена карьера, есть
              сайт, в статусе зовёт клиентов, есть подписчики. Такому не
              придётся объяснять идею с нуля.

Складывать их в одно число нельзя: «надо 3, захочет 0» — это человек, которому
предложение полезно, но он им не займётся; «надо 0, захочет 5» — активный
продавец, которому справочник не нужен. Нужны те, у кого высоки обе.
"""
from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

VK_API = "https://api.vk.com/method/"
VK_V = "5.199"

# Поля, по которым вообще можно судить о занятии человека.
USER_FIELDS = (
    "sex,bdate,city,country,status,about,site,occupation,career,"
    "followers_count,verified,last_seen,is_closed,can_access_closed,"
    "can_write_private_message,deactivated,photo_100"
)

# Профессии, где решение о человеке принимают, посмотрев на него в интернете.
# Вес 3 — ищут по имени всегда, 2 — часто.
PROFESSIONS: List[Tuple[str, str, int]] = [
    (r'психолог|психотерапевт|психиатр|коуч|расстановщ|таролог|астролог', 'помогающая практика', 3),
    (r'врач|доктор|стоматолог|хирург|терапевт|педиатр|остеопат|нутрициолог|диетолог', 'медицина', 3),
    (r'юрист|адвокат|нотариус|медиатор|бухгалтер на аутсорс', 'право и финансы', 3),
    (r'преподавател|педагог|учител|тренер|репетитор|наставник|инструктор', 'обучение', 3),
    (r'консультант|эксперт|аудитор|оценщик|методолог|супервизор', 'экспертиза', 3),
    (r'мастер|барбер|парикмахер|стилист|визажист|бровист|мастер маникюра|ногтев|'
     r'массажист|косметолог|тату|лешмейкер|шугаринг|педикюр', 'частный мастер', 3),
    (r'основател|со-?основател|владел|учредител|предпринимател|бизнес', 'основатель', 2),
    (r'директор|руководител|управляющ|глава|начальник', 'руководитель', 2),
    (r'архитектор|дизайнер|фотограф|режисс|художник|декоратор|флорист|кондитер', 'авторская профессия', 2),
    (r'автор|писател|блогер|спикер|ведущ|журналист', 'публичность', 2),
    (r'риелтор|риэлтор|брокер|агент по недвижимост|страхов|турагент', 'посредник', 2),
    (r'\bип\b|самозанят|частная практика|частный|своё дело|свой бизнес|студи', 'частная практика', 2),
]

# Человек, который зовёт клиентов прямо в профиле, уже согласен с идеей,
# что присутствием надо заниматься. Ему остаётся показать инструмент.
SELLS = re.compile(
    r'запис(ь|аться|ываю)|консультац|услуг|прайс|портфолио|мои работы|отзыв|'
    r'сотрудничеств|пишите в личн|для связи|телеграм|telegram|t\.me|'
    r'whatsapp|ватсап|сайт|записаться можно|свободн[ыо]е окош',
    re.I)

INACTIVE_DAYS = 180


async def _vk(method: str, **params) -> Any:
    """Вызов VK API user-токеном. Тот же токен, что у рассылки."""
    import httpx
    token = (os.environ.get("VK_USER_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("VK_USER_TOKEN не задан")
    params.update(access_token=token, v=VK_V)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(VK_API + method, params=params)
    data = r.json()
    if "error" in data:
        e = data["error"]
        raise RuntimeError("VK %s: %s/%s" % (method, e.get("error_code"), e.get("error_msg")))
    return data.get("response")


def _searchable_text(u: Dict[str, Any]) -> str:
    """Всё, по чему можно понять занятие, одной строкой в нижнем регистре."""
    parts = [u.get("status") or "", u.get("about") or ""]
    occ = u.get("occupation") or {}
    parts.append(occ.get("name") or "")
    for c in (u.get("career") or []):
        parts.append(str(c.get("position") or ""))
        parts.append(str(c.get("company") or ""))
    return " ".join(parts).lower()


def score(u: Dict[str, Any]) -> Dict[str, Any]:
    """Две шкалы и человекочитаемое объяснение каждой прибавки."""
    why: List[str] = []
    nado = 0
    hochet = 0
    profession = ""
    text = _searchable_text(u)

    for rx, label, weight in PROFESSIONS:
        if re.search(rx, text):
            if weight > nado:
                nado, profession = weight, label
            if label not in why:
                why.append(label)

    occ = u.get("occupation") or {}
    if occ.get("type") == "work" and occ.get("name"):
        hochet += 1
        why.append("указано место работы")
    if u.get("career"):
        hochet += 1
        why.append("заполнена карьера")
    if (u.get("site") or "").strip():
        hochet += 2
        why.append("есть свой сайт")
    if SELLS.search(text):
        hochet += 2
        why.append("зовёт клиентов в профиле")

    followers = int(u.get("followers_count") or 0)
    if followers >= 300:
        hochet += 2
        why.append("подписчиков %d" % followers)
    elif followers >= 100:
        hochet += 1
        why.append("подписчиков %d" % followers)
    if u.get("verified"):
        hochet += 1
        why.append("верифицирован")

    seen = (u.get("last_seen") or {}).get("time") or 0
    days = int((time.time() - seen) / 86400) if seen else 9999
    if days > INACTIVE_DAYS:
        why.append("не заходил %d дн." % days)

    return {
        "nado": nado,
        "hochet": hochet,
        "profession": profession,
        "days_since_seen": days,
        "why": ", ".join(dict.fromkeys(why)),
    }


async def fetch_friends_enriched(max_count: int = 10000) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """friends.get за идентификаторами, users.get за содержанием.

    Возвращает открытые живые профили, которым можно написать, и счётчики
    отсева — чтобы в интерфейсе было видно, куда делись остальные.
    """
    ids = ((await _vk("friends.get", count=max(1, min(int(max_count), 10000)),
                      order="name")) or {}).get("items") or []
    skipped = {"удалённые": 0, "закрытые": 0, "нельзя написать": 0, "пустой профиль": 0}
    users: List[Dict[str, Any]] = []

    for i in range(0, len(ids), 300):
        chunk = ids[i:i + 300]
        got = await _vk("users.get",
                        user_ids=",".join(str(x) for x in chunk),
                        fields=USER_FIELDS) or []
        users.extend(got)

    out = []
    for u in users:
        if u.get("deactivated"):
            skipped["удалённые"] += 1
            continue
        if u.get("is_closed") and not u.get("can_access_closed"):
            skipped["закрытые"] += 1
            continue
        if u.get("can_write_private_message") == 0:
            skipped["нельзя написать"] += 1
            continue
        if not _searchable_text(u).strip():
            skipped["пустой профиль"] += 1
            continue
        out.append(u)

    logger.info("expert scout: друзей %d, разобрано %d, отсев %s", len(ids), len(out), skipped)
    return out, skipped


OUTREACH_CATEGORY = "lichnosty"
# Потолок на сутки. ВК режет серии одинаковых сообщений со ссылками, и
# аккаунт теряется целиком, а не по одному адресату. Пятнадцать — то, что
# проходит незаметно; у прогрева стоит сорок, но там разнесено по времени
# планировщиком, а здесь человек жмёт кнопки подряд.
DAILY_CAP = int(os.environ.get("EXPERTS_DAILY_CAP") or 15)


async def sent_today(db) -> int:
    """Сколько предложений уже ушло за сегодня."""
    try:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT COUNT(*) AS n FROM fredi_vk_b2b_outreach "
                "WHERE category = $1 AND marked_at >= date_trunc('day', NOW())",
                OUTREACH_CATEGORY)
        return int(row["n"] if row else 0)
    except Exception as e:
        logger.warning("expert scout: счётчик за сутки недоступен (%s)", e)
        return 0


async def send_offer(db, *, vk_id: int, text: str) -> Dict[str, Any]:
    """Отправить предложение одному человеку и отметить его.

    Текст приходит с фронта уже отредактированным: заготовка там показывается
    целиком и правится перед отправкой. Готовый шаблон не подставляется здесь
    намеренно — одинаковые сообщения и есть то, на что срабатывает антиспам.
    """
    text = (text or "").strip()
    if len(text) < 40:
        raise ValueError("Текст слишком короткий — похоже, его не дописали")
    if len(text) > 4000:
        raise ValueError("Текст длиннее 4000 знаков, ВК его не примет")

    used = await sent_today(db)
    if used >= DAILY_CAP:
        raise RuntimeError(
            "На сегодня лимит: %d из %d. Остальное завтра — так аккаунт доживёт "
            "до конца акции." % (used, DAILY_CAP))

    from drip_campaign import _send_text_only
    result = await _send_text_only(int(vk_id), text)

    try:
        async with db.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO fredi_vk_b2b_outreach (vk_id, status, note, category)
                VALUES ($1, 'sent', $2, $3)
                ON CONFLICT (vk_id) DO UPDATE SET
                    status = 'sent', note = EXCLUDED.note,
                    category = EXCLUDED.category, marked_at = NOW()
                """,
                int(vk_id), text[:500], OUTREACH_CATEGORY)
    except Exception as e:
        # Сообщение уже ушло — падать поздно, но в лог это обязано попасть,
        # иначе человек напишет тому же адресату второй раз.
        logger.error("expert scout: отправлено %s, но отметка не легла: %s", vk_id, e)

    used += 1
    return {"message_id": result.get("message_id"), "sent_today": used,
            "daily_cap": DAILY_CAP, "left_today": max(0, DAILY_CAP - used)}


async def find_experts(db, *, min_nado: int = 2, min_hochet: int = 1,
                       limit: int = 300) -> Dict[str, Any]:
    """Ранжированный список кандидатов с пометкой «уже писали».

    Ничего не отправляет и никуда не пишет: это разбор, а не кампания.
    Отметку «отправили» ставит существующая ручка outreach-mark.
    """
    users, skipped = await fetch_friends_enriched()

    rows: List[Dict[str, Any]] = []
    for u in users:
        s = score(u)
        if s["nado"] < min_nado or s["hochet"] < min_hochet:
            continue
        rows.append({
            "vk_id": int(u["id"]),
            "name": ("%s %s" % (u.get("first_name") or "", u.get("last_name") or "")).strip(),
            "url": "https://vk.com/id%d" % int(u["id"]),
            "photo": u.get("photo_100") or "",
            "sex": int(u.get("sex") or 0),
            "city": (u.get("city") or {}).get("title") or "",
            "occupation": (u.get("occupation") or {}).get("name") or "",
            "site": u.get("site") or "",
            "status": (u.get("status") or "").replace("\n", " ")[:160],
            "followers": int(u.get("followers_count") or 0),
            **s,
            # Итог только для сортировки. Решение принимается по двум шкалам:
            # человек с «надо 3, захочет 0» и «надо 0, захочет 6» дают
            # одинаковую сумму, а предлагать им нужно разное.
            "rank": s["nado"] * 2 + s["hochet"] - (3 if s["days_since_seen"] > INACTIVE_DAYS else 0),
        })

    rows.sort(key=lambda r: -r["rank"])
    rows = rows[:max(1, min(int(limit), 1000))]

    # Кому уже писали — чтобы не написать второй раз.
    if rows:
        ids = [r["vk_id"] for r in rows]
        try:
            async with db.get_connection() as conn:
                marked = await conn.fetch(
                    "SELECT vk_id, status, marked_at FROM fredi_vk_b2b_outreach "
                    "WHERE vk_id = ANY($1::bigint[])", ids)
            seen = {int(m["vk_id"]): m for m in marked}
            for r in rows:
                m = seen.get(r["vk_id"])
                r["contacted"] = bool(m)
                r["contacted_status"] = (m["status"] if m else "")
        except Exception as e:            # таблицы может не быть на свежей базе
            logger.warning("expert scout: отметки недоступны (%s)", e)
            for r in rows:
                r["contacted"] = False
                r["contacted_status"] = ""

    hot = sum(1 for r in rows if r["nado"] >= 3 and r["hochet"] >= 3)
    used = await sent_today(db)
    return {
        "total": len(rows),
        "hot": hot,
        "skipped": skipped,
        "candidates": rows,
        "sent_today": used,
        "daily_cap": DAILY_CAP,
        "left_today": max(0, DAILY_CAP - used),
    }
