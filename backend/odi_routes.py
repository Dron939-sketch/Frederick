# ============================================================
# odi_routes.py — «Оргдеятельностная игра» (ОДИ) с Фреди-игротехником.
#
# Мультиплеер по коду-приглашению: хост создаёт игру (тема из списка
# или своя), делится ссылкой, компания играет с телефонов. Фреди ведёт
# игру как игротехник по канону Г.П. Щедровицкого (упрощённый однодневный
# формат): установочный доклад → самоопределение → версии (работа с
# позиций) → проблематизация (игротехник атакует версии) → проект
# (схематизация) → рефлексия → итоговый протокол.
#
# Синхронизация — поллинг GET /state (без вебсокетов: single-process
# uvicorn на Amvera, 3-секундный опрос достаточен для темпа ОДИ).
# Доступ — по токену участника (авторизация не нужна: гости входят
# по ссылке, вводят только имя).
# ============================================================
import asyncio
import logging
import secrets
from typing import Optional

from fastapi import Request, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

MAX_MEMBERS = 12
MAX_TEXT = 2000

# Этапы игры. stage=0 — лобби; переход N→N+1 делает хост, на переходе
# Фреди-игротехник произносит слово, открывающее новый этап.
STAGES = {
    0: {"key": "lobby", "title": "Сбор участников"},
    1: {"key": "samoopredelenie", "title": "Самоопределение", "ask": "Кто ты в этой теме и чего ты в ней на самом деле хочешь?"},
    2: {"key": "versii", "title": "Версии с позиций", "ask": "Как выглядит ситуация с твоей позиции? В чём настоящий разрыв?"},
    3: {"key": "problematizaciya", "title": "Проблематизация", "ask": "Фреди атаковал версии. Ответь на удар по твоей — держи позицию или перестрой её."},
    4: {"key": "proekt", "title": "Проект", "ask": "Предложи один конкретный ход, который сдвигает общую ситуацию."},
    5: {"key": "refleksiya", "title": "Рефлексия", "ask": "Что ты понял про тему и про себя? Что делал в игре на самом деле?"},
    6: {"key": "final", "title": "Итог игры"},
}

TOPICS = {
    "buksuem": "Почему наше общее дело буксует — и где настоящий разрыв",
    "razvitie": "Куда нам развиваться дальше: следующий масштаб нашего дела",
    "konflikt": "Наш повторяющийся конфликт: что мы на самом деле делим",
    "budushee": "Наше общее будущее: как мы хотим жить вместе",
    "dengi": "Деньги в нашей жизни: инструмент, мерило или поле боя",
    "klient": "Наш продукт глазами клиента: за что нам платят на самом деле",
}


class OdiCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    topic_key: Optional[str] = None
    topic_custom: Optional[str] = Field(default=None, max_length=300)


class OdiJoin(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    name: str = Field(min_length=1, max_length=60)


class OdiSay(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    token: str = Field(min_length=8, max_length=64)
    text: str = Field(min_length=1, max_length=MAX_TEXT)


class OdiAdvance(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    token: str = Field(min_length=8, max_length=64)


def _fmt(text: str) -> str:
    """ai_service._simple_call схлопывает \\n — просим ИИ разделять
    абзацы «||» и оставляем маркер как есть: фронт превратит в переносы."""
    return (text or "").strip()


def register_odi_routes(app, db, limiter, get_ai):
    """get_ai — лямбда, возвращающая актуальный ai_service (как в
    reengagement с email_service)."""

    async def init_tables():
        await db.execute("""
            CREATE TABLE IF NOT EXISTS fredi_odi_games (
                code TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                stage INT NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'lobby',
                busy BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS fredi_odi_members (
                id SERIAL PRIMARY KEY,
                code TEXT NOT NULL,
                token TEXT NOT NULL,
                name TEXT NOT NULL,
                is_host BOOLEAN NOT NULL DEFAULT FALSE,
                joined_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS fredi_odi_messages (
                id SERIAL PRIMARY KEY,
                code TEXT NOT NULL,
                member_id INT,
                author TEXT NOT NULL,
                kind TEXT NOT NULL,
                stage INT NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_odi_msg_code_id ON fredi_odi_messages(code, id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_odi_members_code ON fredi_odi_members(code)")
        logger.info("✅ ОДИ: таблицы готовы")

    # ---------- helpers ----------

    async def _game(code: str):
        g = await db.fetchrow("SELECT * FROM fredi_odi_games WHERE code = $1", code)
        if not g:
            raise HTTPException(status_code=404, detail="Игра не найдена")
        return g

    async def _member(code: str, token: str):
        m = await db.fetchrow(
            "SELECT * FROM fredi_odi_members WHERE code = $1 AND token = $2", code, token)
        if not m:
            raise HTTPException(status_code=403, detail="Нет доступа к игре")
        return m

    async def _members(code: str):
        return await db.fetch(
            "SELECT id, name, is_host, joined_at FROM fredi_odi_members WHERE code = $1 ORDER BY id", code)

    async def _add_msg(code: str, member_id, author: str, kind: str, stage: int, text: str):
        await db.execute(
            "INSERT INTO fredi_odi_messages (code, member_id, author, kind, stage, text) VALUES ($1,$2,$3,$4,$5,$6)",
            code, member_id, author, kind, stage, text)

    async def _transcript(code: str, limit_chars: int = 7000) -> str:
        rows = await db.fetch(
            "SELECT author, kind, stage, text FROM fredi_odi_messages WHERE code = $1 ORDER BY id", code)
        lines = []
        for r in rows:
            who = "Фреди-игротехник" if r["kind"] == "fredi" else r["author"]
            st = STAGES.get(r["stage"], {}).get("title", "")
            lines.append(f"[{st}] {who}: {r['text']}")
        full = "\n".join(lines)
        return full[-limit_chars:]

    def _rules_block() -> str:
        return (
            "Ты — Фреди, игротехник оргдеятельностной игры (ОДИ) по методологии Г.П. Щедровицкого. "
            "Твоя работа: держать содержание, вскрывать разрывы между ситуацией и целью, "
            "проблематизировать слабые версии (жёстко к идеям, бережно к людям), собирать схемы, "
            "организовывать рефлексию. Говори на «ты», живо и по делу, без канцелярита. "
            "Абзацы разделяй строго символами || (двойная вертикальная черта) — это перенос строки. "
            "Не используй markdown."
        )

    async def _fredi_speech(code: str, topic: str, new_stage: int, members) -> str:
        names = ", ".join(m["name"] for m in members) or "участники"
        transcript = await _transcript(code)
        rules = _rules_block()
        ask = STAGES.get(new_stage, {}).get("ask", "")

        if new_stage == 1:
            prompt = (
                f"{rules}\n\nИгра начинается. Тема: «{topic}». Участники: {names}.\n"
                "Произнеси установочный доклад (5-8 коротких абзацев):\n"
                "1) Поприветствуй и скажи, что это не обсуждение и не спор, а ОДИ — машина коллективного мышления, "
                "где обычные разговоры «по кругу» запрещены самой конструкцией игры.\n"
                "2) Разверни тему: почему она не решается обычным путём, какой в ней спрятан разрыв "
                "(между тем, что делаем, и тем, чего хотим).\n"
                "3) Правила: говорим с позиции, а не «вообще»; здесь нет начальников и обиженных; "
                "я буду атаковать версии — это удар по конструкции, не по человеку; выжившие после атаки идеи и есть результат.\n"
                f"4) Дай задание первого этапа — самоопределение: «{STAGES[1]['ask']}» — и попроси каждого ответить честно, "
                "не должностью, а живым интересом."
            )
        elif new_stage == 2:
            prompt = (
                f"{rules}\n\nТема игры: «{topic}».\nПротокол игры:\n{transcript}\n\n"
                "Этап самоопределения закончен. Сделай ход игротехника (4-6 абзацев):\n"
                "1) Коротко верни каждому его позицию своими словами — как ты её услышал (по имени). "
                "Если кто-то самоопределился формально или спрятался за общими словами — скажи об этом прямо.\n"
                "2) Покажи, где позиции участников уже расходятся — это топливо игры.\n"
                f"3) Дай задание нового этапа — версии: «{STAGES[2]['ask']}» — каждый отвечает строго со своей позиции, "
                "про конкретную ситуацию, без «мы должны» и «надо просто»."
            )
        elif new_stage == 3:
            prompt = (
                f"{rules}\n\nТема игры: «{topic}».\nПротокол игры:\n{transcript}\n\n"
                "Начинается главный этап ОДИ — проблематизация. Твоя задача — атаковать версии (5-8 абзацев):\n"
                "1) Разбери версию КАЖДОГО участника по имени: найди в ней дыру — скрытое допущение, подмену проблемы задачей, "
                "перекладывание ответственности, «решение», которое консервирует ситуацию. Один точный удар по каждой версии.\n"
                "2) Покажи главное противоречие между версиями участников: что они на самом деле делят.\n"
                f"3) Дай задание: «{STAGES[3]['ask']}» — пусть каждый либо защитит свою версию против твоего удара, "
                "либо честно перестроит её. Отмалчиваться нельзя."
            )
        elif new_stage == 4:
            prompt = (
                f"{rules}\n\nТема игры: «{topic}».\nПротокол игры:\n{transcript}\n\n"
                "Проблематизация пройдена. Сделай ход схематизации (4-6 абзацев):\n"
                "1) Собери из выживших после атаки идей общую схему ситуации: назови действующие позиции, "
                "их интересы, главный разрыв и то место, где ситуация поддаётся сдвигу.\n"
                "2) Скажи, какие версии игра похоронила и почему это хорошо.\n"
                f"3) Дай задание этапа проекта: «{STAGES[4]['ask']}» — один ход от каждого, конкретный, "
                "с указанием кто его делает и что изменится. Не «нам нужно», а «я делаю»."
            )
        elif new_stage == 5:
            prompt = (
                f"{rules}\n\nТема игры: «{topic}».\nПротокол игры:\n{transcript}\n\n"
                "Проектные ходы собраны. Переходим к рефлексии — обязательной части любой ОДИ (4-5 абзацев):\n"
                "1) Собери предложенные ходы в один короткий проект: что делаем, кто делает, с чего начинается.\n"
                "2) Скажи честно, где проект пока слабый.\n"
                f"3) Дай задание рефлексии: «{STAGES[5]['ask']}» — не отчёт, а честный взгляд на себя: "
                "какую роль каждый на самом деле играл, что нового увидел в теме и в себе."
            )
        else:  # 6 — финал
            prompt = (
                f"{rules}\n\nТема игры: «{topic}».\nПолный протокол игры:\n{transcript}\n\n"
                "Игра закончена. Составь итоговый протокол ОДИ (6-9 абзацев):\n"
                "1) Как группа прошла игру: где был перелом, кто удержал позицию, кто вырос по ходу.\n"
                "2) Главный разрыв темы — как он теперь сформулирован (после проблематизации, а не до).\n"
                "3) Схема ситуации: позиции и их интересы, одной-двумя фразами каждая.\n"
                "4) Проект: принятые ходы — кто и что делает, с чего начать в ближайшие три дня.\n"
                "5) По одной личной строке каждому участнику по имени — что игра показала именно ему.\n"
                "6) Закрой игру фразой игротехника — коротко и сильно."
            )

        ai = get_ai()
        result = None
        try:
            result = await ai._simple_call(prompt=prompt, max_tokens=1400, temperature=0.6)
        except Exception as e:
            logger.error(f"ОДИ: AI ошибка на этапе {new_stage}: {e}")
        if not result:
            # Фолбэк: игра не должна вставать из-за ИИ — даём формальное
            # слово игротехника с заданием этапа.
            ask_line = f"|| Задание этапа: {ask}" if ask else ""
            result = (
                f"Этап «{STAGES[new_stage]['title']}» открыт. Связь с полем игры сейчас шумит, "
                f"поэтому скажу коротко.{ask_line} || Пишите по очереди, я вернусь со следующим ходом."
            )
        return _fmt(result)

    # ---------- endpoints ----------

    @app.post("/api/odi/create")
    @limiter.limit("10/minute")
    async def odi_create(request: Request, data: OdiCreate):
        topic = ""
        if data.topic_key and data.topic_key in TOPICS:
            topic = TOPICS[data.topic_key]
        if data.topic_custom and data.topic_custom.strip():
            topic = data.topic_custom.strip()
        if not topic:
            raise HTTPException(status_code=422, detail="Выбери тему или впиши свою")
        code = secrets.token_hex(3).upper()  # 6 hex-символов
        token = secrets.token_hex(16)
        await db.execute(
            "INSERT INTO fredi_odi_games (code, topic) VALUES ($1, $2)", code, topic)
        row = await db.fetchrow(
            "INSERT INTO fredi_odi_members (code, token, name, is_host) VALUES ($1,$2,$3,TRUE) RETURNING id",
            code, token, data.name.strip())
        await _add_msg(code, None, "Игра", "system", 0,
                       f"{data.name.strip()} создал игру. Тема: «{topic}». Ждём участников.")
        return {"success": True, "code": code, "token": token, "member_id": row["id"], "topic": topic}

    @app.post("/api/odi/join")
    @limiter.limit("20/minute")
    async def odi_join(request: Request, data: OdiJoin):
        code = data.code.strip().upper()
        g = await _game(code)
        if g["status"] == "finished":
            raise HTTPException(status_code=409, detail="Игра уже завершена")
        members = await _members(code)
        if len(members) >= MAX_MEMBERS:
            raise HTTPException(status_code=409, detail="Игра заполнена")
        name = data.name.strip()
        token = secrets.token_hex(16)
        row = await db.fetchrow(
            "INSERT INTO fredi_odi_members (code, token, name) VALUES ($1,$2,$3) RETURNING id",
            code, token, name)
        await _add_msg(code, None, "Игра", "system", g["stage"], f"{name} вошёл в игру.")
        return {"success": True, "code": code, "token": token, "member_id": row["id"], "topic": g["topic"]}

    @app.get("/api/odi/state/{code}")
    @limiter.limit("60/minute")
    async def odi_state(request: Request, code: str, token: str = "", after: int = 0):
        code = code.strip().upper()
        g = await _game(code)
        me = await _member(code, token)
        members = await _members(code)
        msgs = await db.fetch(
            "SELECT id, member_id, author, kind, stage, text FROM fredi_odi_messages "
            "WHERE code = $1 AND id > $2 ORDER BY id LIMIT 200", code, int(after))
        # кто уже ответил на текущем этапе (для хоста и общего прогресса)
        answered = await db.fetch(
            "SELECT DISTINCT member_id FROM fredi_odi_messages "
            "WHERE code = $1 AND stage = $2 AND kind = 'user' AND member_id IS NOT NULL",
            code, g["stage"])
        return {
            "success": True,
            "game": {"code": code, "topic": g["topic"], "stage": g["stage"],
                     "status": g["status"], "busy": g["busy"],
                     "stage_title": STAGES.get(g["stage"], {}).get("title", ""),
                     "stage_ask": STAGES.get(g["stage"], {}).get("ask", "")},
            "me": {"id": me["id"], "name": me["name"], "is_host": me["is_host"]},
            "members": [{"id": m["id"], "name": m["name"], "is_host": m["is_host"]} for m in members],
            "answered": [r["member_id"] for r in answered],
            "messages": [{"id": r["id"], "member_id": r["member_id"], "author": r["author"],
                          "kind": r["kind"], "stage": r["stage"], "text": r["text"]} for r in msgs],
        }

    @app.post("/api/odi/say")
    @limiter.limit("30/minute")
    async def odi_say(request: Request, data: OdiSay):
        code = data.code.strip().upper()
        g = await _game(code)
        me = await _member(code, data.token)
        if g["status"] == "finished":
            raise HTTPException(status_code=409, detail="Игра завершена")
        if g["stage"] < 1:
            raise HTTPException(status_code=409, detail="Игра ещё не началась")
        await _add_msg(code, me["id"], me["name"], "user", g["stage"], data.text.strip())
        return {"success": True}

    @app.post("/api/odi/advance")
    @limiter.limit("10/minute")
    async def odi_advance(request: Request, data: OdiAdvance):
        code = data.code.strip().upper()
        g = await _game(code)
        me = await _member(code, data.token)
        if not me["is_host"]:
            raise HTTPException(status_code=403, detail="Этап переключает только ведущий")
        if g["status"] == "finished":
            raise HTTPException(status_code=409, detail="Игра уже завершена")
        old_stage = g["stage"]
        new_stage = old_stage + 1
        if new_stage > 6:
            raise HTTPException(status_code=409, detail="Дальше этапов нет")
        # оптимистичная блокировка: один переход за раз, busy — для UI
        upd = await db.execute(
            "UPDATE fredi_odi_games SET busy = TRUE, updated_at = NOW() "
            "WHERE code = $1 AND stage = $2 AND busy = FALSE", code, old_stage)
        if not upd.endswith("1"):
            raise HTTPException(status_code=409, detail="Переход уже выполняется")
        try:
            members = await _members(code)
            speech = await _fredi_speech(code, g["topic"], new_stage, members)
            new_status = "finished" if new_stage == 6 else "active"
            await db.execute(
                "UPDATE fredi_odi_games SET stage = $2, status = $3, busy = FALSE, updated_at = NOW() WHERE code = $1",
                code, new_stage, new_status)
            await _add_msg(code, None, "Фреди", "fredi", new_stage, speech)
        except Exception:
            await db.execute("UPDATE fredi_odi_games SET busy = FALSE WHERE code = $1", code)
            raise
        return {"success": True, "stage": new_stage}

    @app.get("/api/odi/topics")
    @limiter.limit("30/minute")
    async def odi_topics(request: Request):
        return {"success": True, "topics": [{"key": k, "title": v} for k, v in TOPICS.items()]}

    return init_tables
