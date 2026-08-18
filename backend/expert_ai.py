"""expert_ai.py — ИИ-слой над expert_scout: разбор кандидатов и тексты писем.

Что здесь делает модель, а что — регулярки.

Регулярки (expert_scout.score) остаются предфильтром: они бесплатны и
мгновенны, и отсекают тех, у кого в профиле вообще ничего нет. Но они путают
«я мастер маникюра» и «ищу мастера маникюра», не видят, что «руководитель
отдела продаж в найме» — это не про частную практику, и не умеют достать из
профиля зацепку для первой строки. Всё это делает модель.

Модель отвечает за три вещи:

  1. Пригодность 0–10 — с учётом того, что регулярка прочитать не может:
     наёмный это человек или свой, действующая практика или бывшая, реальная
     профессия или шутка в статусе.
  2. Сегмент — мастер, практикующий специалист, основатель или мимо. От него
     зависит, какой текст уместен.
  3. Зацепка — конкретный факт из профиля, с которого начинается письмо.
     Это ключевое: одинаковые первые строки ВК распознаёт как рассылку, а
     придумать их на триста человек руками невозможно.

Тексты пишет тоже модель, но по жёсткому каркасу: механизм двух источников,
ссылка на раздел «Эксперты», честная оговорка про предел. Каркас в промпте
задан явно, потому что без него модель уходит в рекламный тон, а он тут
убивает всё — люди пишут своим знакомым.

Результат кладётся в fredi_expert_ai и переиспользуется: повторный разбор не
платит за тех, кого уже разобрали.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

LINK = "https://lichnosty.ru/type/eksperty/"
BATCH = 20                     # профилей в одном запросе на разбор
MSG_TOP_DEFAULT = 10           # для скольких сразу писать текст
RANK_TOP_DEFAULT = 80          # сколько профилей отдавать модели за заход
SEGMENTS = ("master", "expert", "founder", "skip")


async def ensure_table(db) -> None:
    async with db.get_connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fredi_expert_ai (
                vk_id      BIGINT PRIMARY KEY,
                fit        SMALLINT NOT NULL DEFAULT 0,
                segment    TEXT,
                hook       TEXT,
                why        TEXT,
                message    TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)


async def _llm(prompt: str, *, max_tokens: int = 1800, temperature: float = 0.4) -> str:
    """Вызов модели с выключённым размышлением.

    call_deepseek() размышление не выключает, а deepseek-v4-pro тратит на него
    бюджет токенов молча: видимого текста не остаётся, ответ приходит пустым
    или обрубленным на полуслове. В этом репозитории такое уже чинили для
    /api/ai/generate — здесь та же болезнь, поэтому идём напрямую в
    _simple_call с thinking=False.

    Пустой ответ поднимаем исключением с причиной из last_error: молча
    вернуть пустую строку — значит потом гадать, почему «разобрано 0».
    """
    from services.ai_service import AIService
    service = AIService()
    out = await service._simple_call(prompt, max_tokens, temperature, thinking=False)
    out = (out or "").strip()
    if not out:
        raise RuntimeError(getattr(service, "last_error", "") or "модель вернула пустой ответ")
    return out


def _json_block(raw: str) -> Any:
    """Достать JSON из ответа модели.

    Модель почти всегда отдаёт чистый JSON, но иногда оборачивает его в
    ```json или предваряет фразой. Пытаемся по-хорошему, потом вырезаем
    первый массив или объект.
    """
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\s*|\s*```$", "", raw, flags=re.S).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r"[\[{].*[\]}]", raw, re.S)
    if not m:
        raise ValueError("модель вернула не JSON: " + raw[:200])
    return json.loads(m.group(0))


def _digest(c: Dict[str, Any]) -> Dict[str, Any]:
    """Компактная выжимка профиля: только то, по чему можно судить."""
    return {
        "id": c["vk_id"],
        "имя": c.get("name") or "",
        "занятие": c.get("occupation") or "",
        "город": c.get("city") or "",
        "статус": (c.get("status") or "")[:200],
        "сайт": c.get("site") or "",
        "подписчиков": c.get("followers") or 0,
    }


RANK_PROMPT = """Ты помогаешь отобрать людей, которым имеет смысл предложить
страницу в справочнике экспертов. Предложение адресовано тем, кого ищут по
имени: клиент слышит рекомендацию и идёт проверять человека в интернете.

Кому подходит: частные мастера (маникюр, парикмахер, косметолог, массаж),
практикующие специалисты (психолог, юрист, врач, репетитор, коуч),
основатели и владельцы небольшого дела, авторские профессии (фотограф,
дизайнер, кондитер). То есть те, кто продаёт себя, а не работает на ставке.

Кому не подходит: наёмные сотрудники без частной практики, студенты,
пенсионеры, люди без признаков занятия в профиле.

Разбери каждый профиль и верни МАССИВ JSON, по объекту на человека:
{"id": <число>, "fit": <0-10>, "segment": "master|expert|founder|skip",
 "hook": "<зацепка>", "why": "<до 12 слов>"}

fit — насколько человеку это нужно и насколько он этим займётся.
  9-10 — действующая частная практика, видно, что зовёт клиентов;
  6-8  — профессия подходит, но признаков активности мало;
  3-5  — сомнительно, похоже на наёмную работу;
  0-2  — мимо.

segment — по типу занятия. Если fit ниже 3, ставь "skip".

hook — КОНКРЕТНЫЙ факт из профиля, с которого можно начать личное письмо:
«открыла студию», «работает с подростками», «снимает свадьбы». Не общие
слова. Если зацепиться не за что — пустая строка.

Важно: «ищу мастера» — это клиент, а не мастер. Статус-шутка занятием не
является. Судить только по тому, что есть в профиле, не додумывать.

Профили:
%s

Верни только JSON-массив, без пояснений."""


async def ai_rank(db, candidates: List[Dict[str, Any]], *,
                  refresh: bool = False) -> Dict[str, Any]:
    """Прогнать кандидатов через модель. Разобранных ранее не трогаем."""
    await ensure_table(db)
    ids = [c["vk_id"] for c in candidates]

    known: Dict[int, Dict[str, Any]] = {}
    if not refresh and ids:
        async with db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT vk_id, fit, segment, hook, why, message FROM fredi_expert_ai "
                "WHERE vk_id = ANY($1::bigint[])", ids)
        known = {int(r["vk_id"]): dict(r) for r in rows}

    todo = [c for c in candidates if c["vk_id"] not in known]
    logger.info("expert ai: всего %d, из кэша %d, разбираем %d",
                len(candidates), len(known), len(todo))

    fresh: Dict[int, Dict[str, Any]] = {}
    errors: List[str] = []
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        payload = json.dumps([_digest(c) for c in chunk], ensure_ascii=False, indent=1)
        try:
            data = _json_block(await _llm(RANK_PROMPT % payload))
        except Exception as e:
            logger.error("expert ai: пачка %d не разобрана (%s)", i // BATCH, e)
            errors.append(str(e)[:200])
            continue
        for item in (data if isinstance(data, list) else []):
            try:
                vk_id = int(item.get("id"))
            except (TypeError, ValueError):
                continue
            seg = str(item.get("segment") or "skip")
            fresh[vk_id] = {
                "fit": max(0, min(int(item.get("fit") or 0), 10)),
                "segment": seg if seg in SEGMENTS else "skip",
                "hook": (str(item.get("hook") or "")).strip()[:200],
                "why": (str(item.get("why") or "")).strip()[:200],
                "message": None,
            }

    if fresh:
        async with db.get_connection() as conn:
            for vk_id, v in fresh.items():
                await conn.execute("""
                    INSERT INTO fredi_expert_ai (vk_id, fit, segment, hook, why)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (vk_id) DO UPDATE SET
                        fit = EXCLUDED.fit, segment = EXCLUDED.segment,
                        hook = EXCLUDED.hook, why = EXCLUDED.why,
                        updated_at = NOW()
                """, vk_id, v["fit"], v["segment"], v["hook"], v["why"])

    known.update(fresh)
    if errors:
        # Прицепляем к результату, чтобы run_pipeline мог показать причину.
        known["_errors"] = errors[:3]
    return known


MSG_PROMPT = """Напиши личное сообщение во ВКонтакте знакомому человеку.
Это не рассылка: он есть в друзьях, вы знакомы.

О ком пишем:
имя: %(name)s
занятие: %(occupation)s
чем зацепиться: %(hook)s
город: %(city)s

Что предлагаем: завести страницу в справочнике экспертов — %(link)s

СТРОЕНИЕ ТЕКСТА — соблюдай порядок, он и есть смысл:

1. Первой строкой — тезис, слово в слово:
   «Человек считает правдой то, что узнал из двух не связанных между собой
   источников.»

2. Узнавание. Дай человеку подтвердить тезис на СВОЁМ опыте: напомни, как он
   сам кого-то выбирал — врача, мастера, репетитора. Подруга посоветовала, а
   он всё равно пошёл смотреть. Не потому что не доверял — просто одного
   источника мало. Здесь и вплети зацепку из профиля, чтобы пример был про
   его жизнь, а не абстрактный.

3. Разворот. То же самое происходит с ним самим: его рекомендуют, и человек
   идёт проверять.

4. Обрыв. Он находит профиль в соцсети — но это тот же источник, сам о себе.
   Или находит однофамильцев. Второго подтверждения нет, решение
   откладывается.

5. Предложение: страница в справочнике, ссылка %(link)s отдельной строкой.
   Площадка сторонняя — поэтому и работает как второй источник.

6. Честная оговорка: страница не приведёт клиентов и не заставит о нём
   говорить. Разговоры — его работа. Страница закрывает только шаг проверки.

7. Выход: «если не в тему — просто скажи».

К концу человек должен не согласиться с новой мыслью, а узнать свою: тезис из
первой строки он к этому моменту уже подтвердил сам, на своём примере.

Требования: обращение на «ты», тепло, без продающего тона и пафоса;
900–1300 знаков; короткие абзацы; без эмодзи, списков и markdown;
никаких выдуманных фактов о человеке — только то, что дано выше.

Верни только текст сообщения."""


async def ai_message(db, candidate: Dict[str, Any], *,
                     hook: str = "", refresh: bool = False) -> str:
    """Написать письмо под конкретного человека (или взять из кэша)."""
    await ensure_table(db)
    vk_id = int(candidate["vk_id"])

    if not refresh:
        async with db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT message FROM fredi_expert_ai WHERE vk_id = $1", vk_id)
        if row and row["message"]:
            return row["message"]

    text = await _llm(MSG_PROMPT % {
        "name": (candidate.get("name") or "").split()[0] if candidate.get("name") else "",
        "occupation": candidate.get("occupation") or candidate.get("profession") or "",
        "hook": hook or candidate.get("hook") or "—",
        "city": candidate.get("city") or "—",
        "link": LINK,
    }, max_tokens=900, temperature=0.75)

    text = text.strip().strip('"')
    # Ссылка обязана быть: без неё письмо бессмысленно, а модель иногда её
    # «перефразирует». Проверяем и дописываем, а не переспрашиваем модель.
    if LINK not in text:
        text += "\n\n" + LINK

    async with db.get_connection() as conn:
        await conn.execute("""
            INSERT INTO fredi_expert_ai (vk_id, message)
            VALUES ($1, $2)
            ON CONFLICT (vk_id) DO UPDATE SET
                message = EXCLUDED.message, updated_at = NOW()
        """, vk_id, text)
    return text


async def run_pipeline(db, *, min_nado: int = 2, min_hochet: int = 0,
                       min_fit: int = 6, rank_top: int = RANK_TOP_DEFAULT,
                       write_top: int = MSG_TOP_DEFAULT,
                       refresh: bool = False) -> Dict[str, Any]:
    """Вся цепочка одной кнопкой: сбор → предфильтр → разбор → тексты.

    Предфильтр регулярками оставлен сознательно: он бесплатен и снимает с
    модели тех, у кого в профиле пусто. Дальше решает модель — и её оценка
    выше по приоритету, потому что она видит разницу между «я мастер» и
    «ищу мастера».

    rank_top ограничивает, сколько профилей уходит в модель за один заход, и
    это не экономия, а условие работоспособности. Разбор трёхсот профилей —
    пятнадцать последовательных запросов к модели, плюс письма; всё вместе
    занимает минуты, а прокси рвёт соединение задолго до конца, и человек
    видит «Failed to fetch» вместо результата. Восемьдесят профилей — четыре
    запроса, около минуты. Остальных добирают повторным нажатием: разобранные
    лежат в кэше и второй раз не оплачиваются.
    """
    from expert_scout import find_experts

    # Таблицу создаём здесь, а не полагаемся на ai_rank: ниже мы читаем из неё
    # очередь ещё до того, как ai_rank будет вызван. Пока разбор шёл одним
    # куском, порядок был обратный и это не всплывало — на свежей базе первый
    # же прогон падал с «relation fredi_expert_ai does not exist».
    await ensure_table(db)

    base = await find_experts(db, min_nado=min_nado, min_hochet=min_hochet, limit=1000)
    cands = base["candidates"]
    if not cands:
        return {**base, "ai": {"ranked": 0, "written": 0, "queue_left": 0}}

    # Сначала те, кого модель ещё не видела: повторное нажатие продвигает
    # очередь дальше, а не перемалывает одних и тех же.
    try:
        async with db.get_connection() as conn:
            seen_rows = await conn.fetch(
                "SELECT vk_id FROM fredi_expert_ai WHERE vk_id = ANY($1::bigint[])",
                [c["vk_id"] for c in cands])
        seen = {int(r["vk_id"]) for r in seen_rows}
    except Exception as e:
        # Не знать, кого уже разбирали, — не повод не работать: в худшем
        # случае модель пересмотрит тех же людей.
        logger.warning("expert ai: очередь не прочиталась (%s)", e)
        seen = set()
    queue = [c for c in cands if c["vk_id"] not in seen]
    portion = (queue + [c for c in cands if c["vk_id"] in seen])[:max(1, int(rank_top))]
    queue_left = max(0, len(queue) - len([c for c in portion if c["vk_id"] not in seen]))

    verdicts = await ai_rank(db, portion, refresh=refresh)
    ai_errors = verdicts.pop("_errors", [])

    for c in cands:
        v = verdicts.get(c["vk_id"]) or {}
        c["fit"] = v.get("fit", 0)
        c["segment"] = v.get("segment") or ""
        c["hook"] = v.get("hook") or ""
        c["ai_why"] = v.get("why") or ""
        c["message"] = v.get("message") or ""

    cands = [c for c in cands if c["fit"] >= min_fit]
    cands.sort(key=lambda c: (-c["fit"], -c["rank"]))

    written = 0
    for c in cands[:max(0, int(write_top))]:
        if c.get("message") and not refresh:
            continue
        try:
            c["message"] = await ai_message(db, c, hook=c.get("hook") or "", refresh=refresh)
            written += 1
        except Exception as e:
            logger.error("expert ai: письмо для %s не написалось (%s)", c["vk_id"], e)

    return {
        **base,
        "candidates": cands,
        "total": len(cands),
        "hot": sum(1 for c in cands if c["fit"] >= 8),
        "ai": {"ranked": len(verdicts), "written": written, "min_fit": min_fit,
               "queue_left": queue_left, "errors": ai_errors},
    }
