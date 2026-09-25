# -*- coding: utf-8 -*-
"""«Семь дней по теме»: план из лекций Лектория после первого разговора.

Зачем. Выгрузка 259 диалогов 18–25.09.2026: на следующий день возвращается
1%. Анониму возвращаться не к чему — «приходите ещё» причиной не является.
План даёт причину на каждый день: один шаг по три минуты по его теме,
на дашборде «день 3 из 7», подписка предлагается на четвёртый-пятый день
человеку, который уже ходит.

Шаги берутся не из головы модели, а из лекций Лектория: каталог
data/lektorij_catalog.json собирается скриптом сайта
tools/build_lektorij_catalog.py со страниц курсов — названия и адреса
настоящие, придуманной лекции здесь быть не может. Курс подбирается
теми же правилами, что ставят дверь в Лекторий в статьях блога, а где
правило не сработало — модель выбирает из списка названий курсов.

Чистые функции (подбор, промпт, разбор ответа) без БД и без FastAPI —
их проверяет tests/test_week_plan.py. Хранение и ручки — в
week_plan_routes.py.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

DAYS = 7
STEP_MINUTES = 3
SITE = "https://meysternlp.ru"
CATALOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lektorij_catalog.json")

_catalog: Optional[Dict[str, Any]] = None
_rules: List[Tuple[Any, str]] = []


def catalog() -> Dict[str, Any]:
    """Каталог курсов; читается один раз."""
    global _catalog, _rules
    if _catalog is None:
        with open(CATALOG_PATH, encoding="utf-8") as f:
            _catalog = json.load(f)
        _rules = [(re.compile(p, re.I), s) for p, s in _catalog.get("rules", [])
                  if s in _catalog.get("courses", {})]
    return _catalog


def pick_course_by_rules(topic: str) -> Optional[str]:
    """Первое совпавшее правило — как в link_lektorij.py на сайте."""
    catalog()
    text = topic or ""
    for rx, slug in _rules:
        if rx.search(text):
            return slug
    return None


def course_titles_block() -> str:
    """Список «slug — название» для выбора курса моделью."""
    c = catalog()["courses"]
    return "\n".join(f"{slug} — {v['title']}" for slug, v in c.items())


def choose_course_prompt(topic: str) -> Tuple[str, str]:
    system = (
        "Ты подбираешь курс лекций под тему разговора. Ответ — строго JSON вида "
        '{"slug": "<slug из списка>"}. Если ни один курс не подходит по существу — '
        '{"slug": null}. Не придумывай slug, которого нет в списке.'
    )
    user = f"Тема разговора: «{topic}»\n\nКурсы (slug — название):\n{course_titles_block()}"
    return system, user


def parse_course_choice(text: str) -> Optional[str]:
    try:
        m = re.search(r"\{.*\}", text or "", re.S)
        data = json.loads(m.group()) if m else {}
    except (ValueError, AttributeError):
        return None
    slug = data.get("slug") if isinstance(data, dict) else None
    return slug if isinstance(slug, str) and slug in catalog()["courses"] else None


def lectures_block(slug: str, limit: int = 12) -> str:
    c = catalog()["courses"][slug]
    return "\n".join(f"{l['n']}. {l['title']} — {SITE}{l['url']}" for l in c["lectures"][:limit])


def plan_prompt(topic: str, slug: str, name: str = "") -> Tuple[str, str]:
    """Промпт на семь шагов. Каждый шаг — одно действие на три минуты,
    выполнимое сегодня, с опорой на конкретную лекцию курса."""
    c = catalog()["courses"][slug]
    system = (
        "Ты Фреди — практик, а не лектор. Составь план на семь дней по теме человека: "
        "каждый день одно действие на три минуты, которое можно сделать сегодня вечером, "
        "без подготовки и без покупок. Действие — конкретное: что именно сделать, сказать или записать. "
        "Не «подумайте о границах», а «скажите маме одну фразу: …». "
        "Каждый шаг опирается на одну лекцию курса из списка: указывай её номер. "
        "Дни идут от простого к сложному; седьмой — итог недели, что изменилось. "
        "Обращение на «вы». Без восклицательных знаков, без эмодзи, без обещаний изменить жизнь. "
        "Ответ — строго JSON: "
        '{"title": "<название плана до 40 знаков>", '
        '"days": [{"day": 1, "title": "<до 40 знаков>", "action": "<1–2 предложения, что сделать>", '
        '"lecture": <номер лекции или null>}, ... ровно 7 объектов]}'
    )
    who = f"Имя: {name}\n" if name else ""
    user = (
        f"{who}Тема разговора: «{topic}»\n"
        f"Курс: «{c['title']}» — {c.get('description', '')}\n"
        f"Лекции курса:\n{lectures_block(slug)}"
    )
    return system, user


def parse_plan(text: str, slug: str) -> Optional[Dict[str, Any]]:
    """Разбор ответа модели. Возвращает план с адресами лекций или None,
    если дней не семь или JSON битый — тогда план не создаётся, и человек
    получает обычный ответ, а не половину плана."""
    try:
        m = re.search(r"\{.*\}", text or "", re.S)
        data = json.loads(m.group()) if m else None
    except (ValueError, AttributeError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("days"), list):
        return None
    c = catalog()["courses"].get(slug)
    if not c:
        return None
    by_n = {l["n"]: l for l in c["lectures"]}
    days: List[Dict[str, Any]] = []
    for i, d in enumerate(data["days"][:DAYS], start=1):
        if not isinstance(d, dict):
            return None
        action = str(d.get("action") or "").strip()
        title = str(d.get("title") or "").strip()[:60]
        if len(action) < 15:
            return None
        lec = by_n.get(d.get("lecture")) if isinstance(d.get("lecture"), int) else None
        days.append({
            "day": i,
            "title": title or f"День {i}",
            "action": action[:400],
            "lecture_title": lec["title"] if lec else None,
            "lecture_url": (SITE + lec["url"]) if lec else None,
        })
    if len(days) != DAYS:
        return None
    return {
        "title": str(data.get("title") or c["title"]).strip()[:60],
        "course_slug": slug,
        "course_title": c["title"],
        "course_url": SITE + c["url"],
        "days": days,
    }


def to_skill_plan(plan: Dict[str, Any], topic: str) -> Dict[str, Any]:
    """План в форме fredi_skill_plans.plan: {"weeks": [{"exercises": [...]}]}.

    Хранится в той же таблице и ходит по тем же трубам, что 21-дневный
    план навыка: планировщик skill_notify шлёт утреннее задание, вкладка
    «Сообщения» рисует кнопку «Выполнил», экраны «Тренировка дня» и
    «Прогресс» читают weeks/exercises. Отличия — days_total и kind, по
    ним трубы знают, что дней семь, а не двадцать один."""
    exercises = []
    for d in plan["days"]:
        inst = d["action"]
        if d.get("lecture_url"):
            inst += f"\n\nЛекция к шагу: «{d['lecture_title']}» — {d['lecture_url']}"
        exercises.append({
            "day": d["day"],
            "task": d["title"],
            "dur": f"{STEP_MINUTES} мин",
            "inst": inst,
            "why": "",
            "lecture_title": d.get("lecture_title"),
            "lecture_url": d.get("lecture_url"),
        })
    return {
        "kind": "week_topic",
        "days_total": DAYS,
        "topic": topic,
        "course_slug": plan["course_slug"],
        "course_title": plan["course_title"],
        "course_url": plan["course_url"],
        "weeks": [{"week": 1, "title": plan["title"], "exercises": exercises}],
    }


def view_from_skill_row(plan_data: Dict[str, Any], days_done: List[int], started_at, now) -> Optional[Dict[str, Any]]:
    """Обратно из строки fredi_skill_plans — то, что видит клиент.
    Для планов другого вида (21-дневный навык) возвращает None."""
    if not isinstance(plan_data, dict) or plan_data.get("kind") != "week_topic":
        return None
    weeks = plan_data.get("weeks") or []
    exercises = [e for w in weeks for e in (w.get("exercises") or [])]
    days = [{
        "day": e.get("day"),
        "title": e.get("task", ""),
        "action": (e.get("inst") or "").split("\n\nЛекция к шагу:")[0],
        "lecture_title": e.get("lecture_title"),
        "lecture_url": e.get("lecture_url"),
    } for e in exercises]
    if len(days) != DAYS:
        return None
    plan = {
        "title": (weeks[0].get("title") if weeks else "") or plan_data.get("course_title", ""),
        "course_slug": plan_data.get("course_slug", ""),
        "course_title": plan_data.get("course_title", ""),
        "course_url": plan_data.get("course_url", ""),
        "days": days,
    }
    done = {str(int(d)): True for d in (days_done or []) if str(d).isdigit() or isinstance(d, int)}
    view = public_view(plan, started_at, now, done)
    view["topic"] = plan_data.get("topic", "")
    return view


def current_day(started_at, now, done: Dict[str, Any]) -> int:
    """Номер дня плана: по календарным суткам с начала, но не дальше
    первого невыполненного — пропущенный день не сгорает, он ждёт."""
    elapsed = max(0, (now.date() - started_at.date()).days)
    day = min(DAYS, elapsed + 1)
    for i in range(1, day + 1):
        if not done.get(str(i)):
            return i
    return day


def public_view(plan: Dict[str, Any], started_at, now, done: Dict[str, Any]) -> Dict[str, Any]:
    """То, что видит клиент: день сегодня, шаг на сегодня, сделано ли."""
    day = current_day(started_at, now, done)
    done_days = sorted(int(k) for k, v in done.items() if v)
    return {
        "active": True,
        "title": plan["title"],
        "course_title": plan["course_title"],
        "course_url": plan["course_url"],
        "day": day,
        "days_total": DAYS,
        "done_days": done_days,
        "finished": len(done_days) >= DAYS,
        "today": plan["days"][day - 1],
        "days": plan["days"],
        "started_at": started_at.isoformat(),
    }
