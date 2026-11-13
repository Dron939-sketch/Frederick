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

# Сообщение после звонка — только SMS: это единственный канал, который
# работает по одному номеру телефона. Telegram и MAX пишут лишь тем, кто
# сначала сам написал боту, почта требует адреса — для нашего случая это
# лишние ветки, поэтому канал один.
MESSAGE_CHANNELS = [
    {"id": "sms", "title": "SMS по номеру", "needs": "SMSRU_API_ID",
     "note": "шлём через SMS.RU; ключ api_id — в переменных окружения сервера"},
]

# SMS.RU: https://sms.ru/docs/api/api_group_sms/send
# Авторизация одним api_id, ответ JSON, есть режим test=1 (не тратит баланс).
SMSRU_URL = "https://sms.ru/sms/send"

DEFAULT_FOLLOWUP = (
    "Здравствуйте, {имя}! Спасибо за разговор. "
    "Наш сайт: {ссылка}. Если появятся вопросы — ответьте на это сообщение."
)

MESSAGE_MAX_LEN = 480


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
    # Сообщение после звонка: канал, текст и ссылка на сайт
    followup_channel: str = "sms"
    followup_text: str = ""
    site_link: str = ""


class SendMessageIn(BaseModel):
    phone: str
    name: str = ""
    campaign_id: int = 0
    text: str = ""


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
            # Колонки сообщения после звонка — добавляем к уже созданной таблице.
            await conn.execute(
                "ALTER TABLE callbot_campaigns "
                "ADD COLUMN IF NOT EXISTS followup_channel TEXT DEFAULT 'manual'")
            await conn.execute(
                "ALTER TABLE callbot_campaigns "
                "ADD COLUMN IF NOT EXISTS followup_text TEXT DEFAULT ''")
            await conn.execute(
                "ALTER TABLE callbot_campaigns "
                "ADD COLUMN IF NOT EXISTS site_link TEXT DEFAULT ''")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS callbot_messages (
                    id BIGSERIAL PRIMARY KEY,
                    campaign_id BIGINT,
                    phone TEXT NOT NULL,
                    channel TEXT NOT NULL,
                    text TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    error TEXT DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_callbot_messages_campaign "
                "ON callbot_messages(campaign_id, created_at DESC)"
            )


    @router.get("/catalog")
    async def catalog():
        return {"directions": DIRECTIONS, "target_actions": TARGET_ACTIONS,
                "voices": VOICES, "sources": SOURCES, "regions": REGIONS,
                "message_channels": MESSAGE_CHANNELS,
                "default_followup": DEFAULT_FOLLOWUP}

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
        channel = _by_id(MESSAGE_CHANNELS, payload.followup_channel or "sms")
        if not channel:
            raise HTTPException(400, "Неизвестный канал сообщения")
        name = (payload.name or "%s — %s" % (direction["title"], action["title"])).strip()
        followup = (payload.followup_text or DEFAULT_FOLLOWUP).strip()
        script = build_script(direction, action, payload.city)
        script += ("\n\nПосле разговора отправить сообщение (%s): «%s»"
                   % (channel["title"], followup))
        async with db.get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO callbot_campaigns
                    (user_id, name, direction_id, action_id, voice_id, city, script,
                     followup_channel, followup_text, site_link)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            """, payload.user_id, name, payload.direction_id, payload.action_id,
                payload.voice_id, payload.city, script, channel["id"], followup,
                payload.site_link)
        return {"id": row["id"], "name": name, "script": script,
                "followup_channel": channel["id"], "followup_text": followup}

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

    @router.post("/send-message")
    async def send_message(payload: SendMessageIn):
        """SMS после звонка: контакт, ссылка на сайт или дата.

        Текст берётся из кампании, если не передан явно. Если SMS.RU не
        настроен, текст всё равно ложится в журнал со статусом need_setup.
        """
        phone = normalize_phone(payload.phone)
        if not phone:
            raise HTTPException(400, "Телефон не разобрали")

        text, site_link = payload.text, ""
        campaign_id = payload.campaign_id
        if campaign_id:
            async with db.get_connection() as conn:
                camp = await conn.fetchrow(
                    "SELECT followup_text, site_link FROM callbot_campaigns "
                    "WHERE id = $1", campaign_id)
            if camp:
                text = text or camp["followup_text"] or ""
                site_link = camp["site_link"] or ""

        body = _render_message(text or DEFAULT_FOLLOWUP, payload.name, site_link)
        status, error = await _deliver_message(body, phone)
        async with db.get_connection() as conn:
            await conn.execute("""
                INSERT INTO callbot_messages (campaign_id, phone, channel, text, status, error)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, campaign_id or None, phone, "sms", body, status, error)
        return {"phone": phone, "channel": "sms", "text": body,
                "status": status, "error": error}

    @router.get("/campaigns/{campaign_id}/messages")
    async def campaign_messages(campaign_id: int, limit: int = 100):
        async with db.get_connection() as conn:
            rows = await conn.fetch("""
                SELECT phone, channel, text, status, error, created_at
                FROM callbot_messages WHERE campaign_id = $1
                ORDER BY id DESC LIMIT $2
            """, campaign_id, max(1, min(limit, 500)))
        return {"messages": [dict(r) for r in rows]}

    app.include_router(router)
    return router, init_tables


def _render_message(template: str, name: str, site_link: str) -> str:
    """Подставляет имя и ссылку, обрезает длинное — шлюзы режут сами.

    Если имени нет, запятая перед ним убирается; если нет ссылки — из текста
    уходит предложение с ней, чтобы не осталось «Наш сайт: .».
    """
    text = (template or DEFAULT_FOLLOWUP)
    clean_name = (name or "").strip()
    if clean_name:
        text = text.replace("{имя}", clean_name)
    else:
        text = text.replace(", {имя}", "").replace("{имя}", "")

    link = (site_link or "").strip()
    if link:
        text = text.replace("{ссылка}", link)
    else:
        text = re.sub(r"[^.!?]*\{ссылка\}[^.!?]*[.!?]?\s*", "", text)

    text = re.sub(r"\s*[,:]\s*([.!?])", r"\1", text)
    # После вырезанного предложения мог пропасть пробел: «разговор.Если»
    text = re.sub(r"([.!?])([А-ЯЁA-Z])", r"\1 \2", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    if len(text) > MESSAGE_MAX_LEN:
        text = text[:MESSAGE_MAX_LEN - 1].rstrip() + "…"
    return text


async def _deliver_message(text: str, phone: str):
    """Отправка SMS через SMS.RU. Возврат (статус, текст ошибки).

    statuses: sent — принято оператором, need_setup — нет api_id (текст
    остаётся в журнале), failed — шлюз ответил ошибкой.
    """
    import requests

    api_id = (os.environ.get("SMSRU_API_ID") or "").strip()
    if not api_id:
        return "need_setup", "нет SMSRU_API_ID"

    # SMS.RU принимает номер без «+», в формате 7XXXXXXXXXX
    msisdn = phone.lstrip("+")
    params = {"api_id": api_id, "to": msisdn, "msg": text, "json": "1"}
    sender = (os.environ.get("SMSRU_FROM") or "").strip()
    if sender:
        params["from"] = sender
    if (os.environ.get("SMSRU_TEST") or "").strip() in ("1", "true", "yes"):
        params["test"] = "1"

    try:
        resp = requests.post(SMSRU_URL, data=params, timeout=25)
    except Exception as exc:  # сеть — сообщение остаётся в журнале
        return "failed", type(exc).__name__

    if resp.status_code >= 400:
        return "failed", "SMS.RU ответил %s" % resp.status_code
    try:
        data = resp.json()
    except ValueError:
        return "failed", "SMS.RU вернул не JSON"

    if data.get("status") != "OK":
        return "failed", "код %s: %s" % (data.get("status_code"),
                                         (data.get("status_text") or "")[:120])
    sms = (data.get("sms") or {}).get(msisdn) or {}
    if sms.get("status") == "OK":
        return "sent", sms.get("sms_id", "")
    return "failed", "код %s: %s" % (sms.get("status_code"),
                                     (sms.get("status_text") or "")[:120])


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
