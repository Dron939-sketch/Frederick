# -*- coding: utf-8 -*-
"""Робот-обзвонщик «Перекличка» — настройка кампаний и поиск клиентов.

Страница: https://meysternlp.ru/callbot.html

Ручки:
  GET  /api/callbot/catalog            справочники: направления, действия, голоса, источники
  GET  /api/callbot/campaigns          список кампаний
  POST /api/callbot/campaigns          создать кампанию (направление + действие + голос)
  GET  /api/callbot/campaigns/{id}     одна кампания с контактами и скриптом
  POST /api/callbot/campaigns/{id}/numbers   добавить номера текстом
  POST /api/callbot/campaigns/{id}/start     проверить готовность и запустить
  POST /api/callbot/parse              поиск клиентов по городу и тематике

Что важно: сам обзвон живёт в Fish Audio (агент + импортированный SIP-номер).
Здесь — только настройка кампании, база контактов и готовность к запуску.
Ключ Fish в браузер не отдаётся никогда.
"""
import logging
import os
import re
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── справочники ─────────────────────────────────────────────────────

DIRECTIONS = [
    {"id": "auto_services", "title": "Авто — услуги",
     "topics": ["автосервис", "шиномонтаж", "детейлинг", "кузовной ремонт",
                "автоэлектрик", "эвакуация", "автоподбор"]},
    {"id": "auto_goods", "title": "Авто — товары",
     "topics": ["автозапчасти", "шины и диски", "автомасла", "автоаксессуары"]},
    {"id": "build", "title": "Строительство и ремонт",
     "topics": ["стройматериалы", "окна и двери", "натяжные потолки",
                "ремонт квартир", "кровля", "фасады"]},
    {"id": "home", "title": "Дом и быт",
     "topics": ["клининг", "грузчики", "мебель на заказ", "бытовая техника",
                "сантехника", "электрика"]},
    {"id": "beauty_health", "title": "Красота и здоровье",
     "topics": ["салон красоты", "барбершоп", "косметология", "стоматология",
                "массаж", "фитнес"]},
    {"id": "education", "title": "Образование",
     "topics": ["курсы", "репетиторы", "автошкола", "детский центр", "языковая школа"]},
    {"id": "food", "title": "Общепит и доставка",
     "topics": ["кафе", "ресторан", "доставка еды", "кейтеринг", "кофейня"]},
    {"id": "realty", "title": "Недвижимость и аренда",
     "topics": ["агентство недвижимости", "аренда квартир", "аренда складов",
                "аренда офисов"]},
    {"id": "b2b", "title": "B2B и производство",
     "topics": ["производство", "оптовая торговля", "логистика", "склад",
                "промышленное оборудование"]},
    {"id": "finance_legal", "title": "Финансы и юруслуги",
     "topics": ["бухгалтерия", "юридические услуги", "страхование", "кредитование"]},
]

TARGET_ACTIONS = [
    {"id": "appointment", "title": "Запись на приём или консультацию",
     "goal": "человек согласился на дату и время",
     "call_to_action": "Давайте запишу вас на консультацию — когда удобнее, в четверг или в пятницу?"},
    {"id": "offer", "title": "Коммерческое предложение",
     "goal": "человек согласился получить КП",
     "call_to_action": "Могу отправить предложение — на какую почту или мессенджер удобнее?"},
    {"id": "meeting", "title": "Встреча или показ",
     "goal": "назначены дата и место встречи",
     "call_to_action": "Когда удобно посмотреть — завтра после обеда или в субботу утром?"},
    {"id": "survey", "title": "Опрос (оценка качества)",
     "goal": "получена оценка и один комментарий",
     "call_to_action": "Оцените, пожалуйста, от одного до пяти — как всё прошло?"},
    {"id": "confirm", "title": "Подтверждение заявки",
     "goal": "человек подтвердил или отменил заявку",
     "call_to_action": "Подтверждаете заявку на завтра? Если нет — перенесём."},
    {"id": "reminder", "title": "Напоминание о сроке или событии",
     "goal": "человек в курсе срока",
     "call_to_action": "Напоминаю: срок до четырнадцатого. Успеваете?"},
    {"id": "event", "title": "Приглашение на мероприятие",
     "goal": "человек сказал, придёт или нет",
     "call_to_action": "Придёте? Скажите да или нет — я запишу."},
    {"id": "status", "title": "Информирование о статусе обращения",
     "goal": "человек знает срок и следующий шаг",
     "call_to_action": "Записал: ответ до четырнадцатого, позвоню двадцатого."},
]

VOICES = [
    {"id": "own", "title": "Голос Вяткина (свой клон)",
     "voice_id": os.environ.get("FISH_AUDIO_VOICE_ID", "")},
    {"id": "male_calm", "title": "Мужской, спокойный", "voice_id": ""},
    {"id": "male_business", "title": "Мужской, деловой", "voice_id": ""},
    {"id": "female_calm", "title": "Женский, спокойный", "voice_id": ""},
    {"id": "female_friendly", "title": "Женский, приветливый", "voice_id": ""},
]

SOURCES = [
    {"id": "manual", "title": "Ввести номера вручную", "kind": "manual", "available": True,
     "note": "самый быстрый способ начать"},
    {"id": "csv", "title": "Выгрузить списком (CSV/TXT)", "kind": "upload", "available": True,
     "note": "колонки: телефон, имя, город"},
    {"id": "2gis", "title": "2ГИС — организации по городу и тематике", "kind": "parse",
     "available": True, "requires_key": "TWOGIS_KEY",
     "note": "нужен ключ 2ГИС Catalog API"},
    {"id": "yandex_maps", "title": "Яндекс.Карты — организации по городу", "kind": "parse",
     "available": True, "requires_key": "YANDEX_MAPS_KEY",
     "note": "нужен ключ API Поиска по организациям"},
    {"id": "avito", "title": "Авито — объявления по теме и городу", "kind": "parse",
     "available": False,
     "note": "автосбор закрыт: капча и запрет в правилах; только официальный Avito API"},
    {"id": "autoru", "title": "Auto.ru — объявления по марке и городу", "kind": "parse",
     "available": False,
     "note": "автосбор закрыт: капча и запрет в правилах"},
]

REGIONS = [
    {"id": "kolomna", "title": "Коломна", "region": "Московская область"},
    {"id": "moscow", "title": "Москва", "region": "Москва"},
    {"id": "ryazan", "title": "Рязань", "region": "Рязанская область"},
    {"id": "vladimir", "title": "Владимир", "region": "Владимирская область"},
    {"id": "lukhovitsy", "title": "Луховицы", "region": "Московская область"},
    {"id": "voskresensk", "title": "Воскресенск", "region": "Московская область"},
]

MAX_CONTACTS_PER_CAMPAIGN = 5000


def _by_id(items, item_id):
    for item in items:
        if item["id"] == item_id:
            return item
    return None


# ── телефон и скрипт ────────────────────────────────────────────────

def normalize_phone(raw) -> Optional[str]:
    """Приводит номер к +7XXXXXXXXXX, иначе None."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 11 and digits[0] in "78":
        return "+7" + digits[1:]
    if len(digits) == 10:
        return "+7" + digits
    return None


def parse_phone_blob(blob: str) -> List[dict]:
    """Разбирает текст: номер в строке или CSV-строка «телефон; имя; город»."""
    out, seen = [], set()
    for line in (blob or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in re.split(r"[;,\t]", line)]
        phone = normalize_phone(parts[0])
        if not phone or phone in seen:
            continue
        seen.add(phone)
        out.append({
            "phone": phone,
            "name": parts[1] if len(parts) > 1 else "",
            "city": parts[2] if len(parts) > 2 else "",
        })
    return out


def build_script(direction: dict, action: dict, city: str) -> str:
    """Скрипт разговора из направления и целевого действия."""
    return (
        "Направление: {d} ({topics}).\n"
        "Целевое действие: {a}.\n"
        "Город: {city}.\n\n"
        "1. Здравствуйте! Меня зовут [имя], звоню по поводу {topic}.\n"
        "2. Уточните: «Вам удобно две минуты?»\n"
        "3. Одна выгода, одна цифра, без давления.\n"
        "4. «{cta}»\n"
        "5. Зафиксируйте результат: дата, время или отказ.\n"
        "6. Попрощайтесь и запишите итог.\n\n"
        "Запрещено: обещать то, чего нет; давить срочностью; звонить повторно "
        "при отказе; продолжать, если человек просит не звонить."
    ).format(
        d=direction["title"], topics=", ".join(direction["topics"][:3]),
        a=action["title"], city=city or "не указан",
        topic=direction["topics"][0], cta=action["call_to_action"],
    )


# ── модели запросов ─────────────────────────────────────────────────

class CampaignIn(BaseModel):
    name: str = ""
    direction_id: str
    action_id: str
    voice_id: str = ""
    city: str = ""
    user_id: int = 0


class NumbersIn(BaseModel):
    text: str
    source: str = "manual"


class ParseIn(BaseModel):
    source_id: str
    direction_id: str
    city: str = ""
    topic: str = ""
    limit: int = 50


def register_callbot_routes(app, db, limiter=None):
    """Подключает ручки обзвона. Вызывается из main.py после db."""
    router = APIRouter(prefix="/api/callbot", tags=["callbot"])

    async def init_tables():
        async with db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS callbot_campaigns (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT,
                    name TEXT NOT NULL,
                    direction_id TEXT NOT NULL,
                    action_id TEXT NOT NULL,
                    voice_id TEXT DEFAULT '',
                    city TEXT DEFAULT '',
                    script TEXT DEFAULT '',
                    status TEXT DEFAULT 'draft',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS callbot_contacts (
                    id BIGSERIAL PRIMARY KEY,
                    campaign_id BIGINT REFERENCES callbot_campaigns(id) ON DELETE CASCADE,
                    phone TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    city TEXT DEFAULT '',
                    source TEXT DEFAULT 'manual',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE (campaign_id, phone)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_callbot_contacts_campaign "
                "ON callbot_contacts(campaign_id)"
            )


    @router.get("/catalog")
    async def catalog():
        return {"directions": DIRECTIONS, "target_actions": TARGET_ACTIONS,
                "voices": VOICES, "sources": SOURCES, "regions": REGIONS}

    @router.get("/campaigns")
    async def list_campaigns(user_id: int = 0, limit: int = 50):
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT c.id, c.name, c.direction_id, c.action_id, c.voice_id, c.city,
                       c.status, c.created_at,
                       (SELECT COUNT(*) FROM callbot_contacts t WHERE t.campaign_id = c.id) AS contacts
                FROM callbot_campaigns c
                WHERE ($1 = 0 OR c.user_id = $1)
                ORDER BY c.id DESC
                LIMIT $2
            """, user_id, max(1, min(limit, 200)))
        return {"campaigns": [dict(r) for r in rows]}

    @router.post("/campaigns")
    async def create_campaign(payload: CampaignIn):
        direction = _by_id(DIRECTIONS, payload.direction_id)
        action = _by_id(TARGET_ACTIONS, payload.action_id)
        if not direction or not action:
            raise HTTPException(400, "Неизвестное направление или целевое действие")
        name = (payload.name or "%s — %s" % (direction["title"], action["title"])).strip()
        script = build_script(direction, action, payload.city)
        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO callbot_campaigns
                    (user_id, name, direction_id, action_id, voice_id, city, script)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            """, payload.user_id, name, payload.direction_id, payload.action_id,
                payload.voice_id, payload.city, script)
        return {"id": row["id"], "name": name, "script": script}

    @router.get("/campaigns/{campaign_id}")
    async def get_campaign(campaign_id: int):
        async with db.get_connection() as conn:
            camp = await conn.fetchrow(
                "SELECT * FROM callbot_campaigns WHERE id = $1", campaign_id)
            if not camp:
                raise HTTPException(404, "Кампании нет")
            contacts = await conn.fetch(
                "SELECT phone, name, city, source FROM callbot_contacts "
                "WHERE campaign_id = $1 ORDER BY id", campaign_id)
        data = dict(camp)
        data["contacts"] = [dict(c) for c in contacts]
        data["contacts_count"] = len(data["contacts"])
        return data

    @router.post("/campaigns/{campaign_id}/numbers")
    async def add_numbers(campaign_id: int, payload: NumbersIn):
        items = parse_phone_blob(payload.text)
        if not items:
            raise HTTPException(400, "Не нашли ни одного номера")
        async with db.get_connection() as conn:
            if not await conn.fetchrow(
                    "SELECT id FROM callbot_campaigns WHERE id = $1", campaign_id):
                raise HTTPException(404, "Кампании нет")
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM callbot_contacts WHERE campaign_id = $1", campaign_id)
            if total + len(items) > MAX_CONTACTS_PER_CAMPAIGN:
                raise HTTPException(
                    400, "В кампании уже %s номеров, лимит %s"
                    % (total, MAX_CONTACTS_PER_CAMPAIGN))
            added = 0
            for item in items:
                status = await conn.execute("""
                    INSERT INTO callbot_contacts (campaign_id, phone, name, city, source)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (campaign_id, phone) DO NOTHING
                """, campaign_id, item["phone"], item["name"], item["city"], payload.source)
                if status.endswith("1"):
                    added += 1
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM callbot_contacts WHERE campaign_id = $1", campaign_id)
        return {"parsed": len(items), "added": added,
                "duplicates": len(items) - added, "total": total}

    @router.post("/campaigns/{campaign_id}/start")
    async def start_campaign(campaign_id: int):
        """Проверяет готовность. Сам обзвон идёт через Fish Audio."""
        async with db.get_connection() as conn:
            camp = await conn.fetchrow(
                "SELECT id, status FROM callbot_campaigns WHERE id = $1", campaign_id)
            if not camp:
                raise HTTPException(404, "Кампании нет")
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM callbot_contacts WHERE campaign_id = $1", campaign_id)
            if not count:
                raise HTTPException(400, "В кампании нет номеров")
            await conn.execute(
                "UPDATE callbot_campaigns SET status = 'ready' WHERE id = $1", campaign_id)
        return {
            "campaign_id": campaign_id,
            "status": "ready",
            "contacts": count,
            "note": "Кампания готова. Звонки пойдут через агента Fish Audio, "
                    "когда к аккаунту привязан номер телефона.",
        }

    @router.post("/parse")
    async def parse_clients(payload: ParseIn):
        """Поиск клиентов. Источник без ключа честно об этом сообщает."""
        source = _by_id(SOURCES, payload.source_id)
        if not source:
            raise HTTPException(400, "Неизвестный источник")
        direction = _by_id(DIRECTIONS, payload.direction_id)
        if not direction:
            raise HTTPException(400, "Неизвестное направление")
        topic = payload.topic or direction["topics"][0]

        if not source["available"]:
            return {"status": "unavailable", "source": source["title"],
                    "reason": source["note"],
                    "alternative": "Введите номера вручную или загрузите CSV"}

        key_name = source.get("requires_key", "")
        if key_name and not (os.environ.get(key_name) or "").strip():
            return {"status": "needs_key", "source": source["title"],
                    "reason": "Нет ключа %s в настройках сервера" % key_name,
                    "next": "Добавьте ключ в переменные окружения — поиск включится"}

        found = await _search_organizations(payload.source_id, topic, payload.city,
                                            payload.limit)
        return {"status": "ok", "source": source["title"],
                "query": {"topic": topic, "city": payload.city,
                          "limit": payload.limit},
                "found": len(found), "items": found}

    app.include_router(router)
    return router, init_tables


async def _search_organizations(source_id: str, topic: str, city: str, limit: int):
    """Поиск организаций через открытые API. Пока реализован 2ГИС."""
    import requests

    if source_id != "2gis":
        raise HTTPException(501, "Источник ещё не подключён")

    key = (os.environ.get("TWOGIS_KEY") or "").strip()
    query = ("%s %s" % (topic, city)).strip()
    resp = requests.get(
        "https://catalog.api.2gis.com/3.0/items",
        params={"q": query, "key": key, "page_size": max(1, min(limit, 50)),
                "fields": "items.contact_groups"},
        timeout=20)
    if resp.status_code != 200:
        raise HTTPException(502, "2ГИС ответил %s" % resp.status_code)
    items = (resp.json().get("result") or {}).get("items") or []
    out = []
    for item in items:
        phones = []
        for group in item.get("contact_groups") or []:
            for contact in group.get("contacts") or []:
                if contact.get("type") == "phone":
                    phones.append(contact.get("value"))
        out.append({"name": item.get("name", ""),
                    "address": item.get("address_name", ""),
                    "phone": phones[0] if phones else ""})
    return out
